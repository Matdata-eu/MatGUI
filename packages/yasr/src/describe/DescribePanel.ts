/**
 * Shared describe panel
 *
 * A right-hand panel inside yasr that shows the triples of one resource,
 * fetched with a background CONSTRUCT query through `yasr.executeQuery()`.
 * Plugins open it through `yasr.describe(iri, options)`.
 *
 * Ported from the describe modal of yasgui-table-plugin
 * (src/controls/describe-modal.ts), redesigned as a non-modal panel: it sits
 * next to the results on wide screens and overlays them on narrow ones.
 * The docked panel can be widened, floated as a movable window, or maximized.
 */
import type { Yasr } from "../index";
import { DescribeHistory, DescribeHistoryEntry } from "./describeHistory";
import {
  DescribeParseResult,
  DescribeTerm,
  DescribeTriple,
  RDF_TYPE,
  formatDescribeTerm,
  parseDescribeResponse,
  pickLabel,
  pickTypes,
} from "./describeParser";
import {
  DescribeDirection,
  INCOMING_TRIPLE_LIMIT,
  PrefixMap,
  buildDescribeQuery,
  localName,
  normalizeDirection,
  sanitizePrefixes,
  toPrefixedName,
} from "./resourceQuery";
import { icon, IconName } from "./icons";
import {
  DescribeLayout,
  DescribeMode,
  DEFAULT_DOCKED_WIDTH,
  clampDockedWidth,
  clampFloatingRect,
  defaultFloatingRect,
  loadLayout,
  saveLayout,
} from "./describeLayout";

export type { DescribeMode } from "./describeLayout";

export interface DescribeOptions {
  /** Which triples to show. Defaults to `"outgoing"` (the resource is the subject). */
  direction?: DescribeDirection;
  /** Label of the calling view, e.g. "Table" or "Map", shown as "Opened from Map". */
  source?: string;
  /** Start a fresh back/forward history (default `true`); `false` pushes onto the current one. */
  newHistory?: boolean;
}

/** Types shown in the panel head before the rest is folded behind "…". */
const MAX_VISIBLE_TYPES = 3;

type PanelState =
  | { state: "loading" }
  | { state: "results"; result: DescribeParseResult }
  | { state: "error"; error: unknown; raw: string };

/** Shown compacted even when the query does not declare them. Never added to the describe query. */
const WELL_KNOWN_PREFIXES: PrefixMap = {
  rdf: "http://www.w3.org/1999/02/22-rdf-syntax-ns#",
  rdfs: "http://www.w3.org/2000/01/rdf-schema#",
  owl: "http://www.w3.org/2002/07/owl#",
  xsd: "http://www.w3.org/2001/XMLSchema#",
  skos: "http://www.w3.org/2004/02/skos/core#",
};

/** Below this yasr width the panel overlays the results instead of sitting next to them. */
const OVERLAY_BREAKPOINT = 820;

export class DescribePanel {
  private el: HTMLElement | undefined;
  private scrim: HTMLElement | undefined;
  private history = new DescribeHistory();
  private abortController: AbortController | undefined;
  private requestId = 0;
  private tab: "triples" | "raw" = "triples";
  private payload: PanelState = { state: "loading" };
  private query = "";
  private returnFocus: HTMLElement | null = null;
  private resizeObserver: ResizeObserver | undefined;
  private keydownHandler = (e: KeyboardEvent) => this.onKeydown(e);
  /** Labels and types learned from earlier outgoing describes, for the title of incoming views. */
  private labelCache = new Map<string, string>();
  private typeCache = new Map<string, string[]>();
  private layout: DescribeLayout = loadLayout();
  private mode: DescribeMode = this.layout.mode;
  /** Mode to go back to when leaving maximized. */
  private restoreMode: "docked" | "floating" = this.layout.mode;
  private resizer: HTMLElement | undefined;
  private panelObserver: ResizeObserver | undefined;
  private windowResizeHandler = () => this.updateLayout();

  constructor(private yasr: Yasr) {}

  public getMode(): DescribeMode {
    return this.mode;
  }

  /** Dock the panel next to the results, float it as a movable window, or maximize it over the page. */
  public setMode(mode: DescribeMode): void {
    if (mode === this.mode) return;
    if (mode === "maximized") this.restoreMode = this.mode === "floating" ? "floating" : "docked";
    else {
      this.restoreMode = mode;
      this.layout.mode = mode;
      saveLayout(this.layout);
    }
    this.mode = mode;
    if (!this.el) return;
    this.updateLayout();
    const entry = this.history.current();
    if (entry) {
      const hadFocus = this.el.contains(document.activeElement);
      this.el.replaceChild(this.renderNav(entry), this.el.querySelector(".yasr_describe_nav")!);
      if (hadFocus) (this.el.querySelector<HTMLElement>(".yasr_describe_modeButton") || this.el).focus();
    }
  }

  public isOpen(): boolean {
    return !!this.el;
  }

  public getHistory(): DescribeHistoryEntry[] {
    return this.history.getEntries();
  }

  /** Show `iri` in the panel and fetch its triples. Resolves once the triples are shown (or failed). */
  public describe(iri: string, options: DescribeOptions = {}): Promise<void> {
    const entry: DescribeHistoryEntry = {
      iri,
      direction: normalizeDirection(options.direction),
      source: options.source ?? this.history.current()?.source,
    };
    if (options.newHistory === false && this.history.length) this.history.push(entry);
    else this.history.reset({ ...entry, source: options.source });
    return this.load(this.history.current()!);
  }

  public back(): Promise<void> {
    const entry = this.history.go(-1);
    return entry ? this.load(entry) : Promise.resolve();
  }

  public forward(): Promise<void> {
    const entry = this.history.go(1);
    return entry ? this.load(entry) : Promise.resolve();
  }

  public backToStart(): Promise<void> {
    const entry = this.history.goTo(0);
    return entry ? this.load(entry) : Promise.resolve();
  }

  public close(): void {
    this.abortController?.abort();
    this.abortController = undefined;
    this.requestId++;
    if (!this.el) return;
    const hadFocus = this.el.contains(document.activeElement);
    this.el.remove();
    this.scrim?.remove();
    this.el = undefined;
    this.scrim = undefined;
    this.resizeObserver?.disconnect();
    this.resizeObserver = undefined;
    this.panelObserver?.disconnect();
    this.panelObserver = undefined;
    this.resizer = undefined;
    document.removeEventListener("keydown", this.keydownHandler);
    window.removeEventListener("resize", this.windowResizeHandler);
    this.yasr.rootEl.classList.remove(
      "yasr--describeOpen",
      "yasr--describeOverlay",
      "yasr--describeFloating",
      "yasr--describeMaximized",
    );
    this.yasr.rootEl.style.removeProperty("--yasr-describe-top");
    this.yasr.rootEl.style.removeProperty("--yasr-describe-width");
    // Maximized is for the current look only; the next one opens docked or floating again
    if (this.mode === "maximized") this.mode = this.restoreMode;
    if (hadFocus || document.activeElement === document.body) {
      if (this.returnFocus && this.returnFocus.isConnected) this.returnFocus.focus();
    }
    this.returnFocus = null;
  }

  public destroy(): void {
    this.close();
  }

  private async load(entry: DescribeHistoryEntry): Promise<void> {
    this.abortController?.abort();
    const controller = typeof AbortController !== "undefined" ? new AbortController() : undefined;
    this.abortController = controller;
    const requestId = ++this.requestId;

    this.query = buildDescribeQuery(entry.iri, entry.direction, this.getPrefixes());
    this.tab = "triples";
    this.payload = { state: "loading" };
    this.open();
    this.render();
    this.yasr.emit("describe", this.yasr, entry.iri, entry.direction);

    try {
      const response = await this.yasr.executeQuery(this.query, {
        acceptHeader: "text/turtle",
        signal: controller?.signal,
      });
      if (requestId !== this.requestId) return;
      const result = await parseDescribeResponse(response);
      if (requestId !== this.requestId) return;
      if (entry.direction === "outgoing") {
        const label = pickLabel(entry.iri, result.triples, this.languages());
        if (label) this.labelCache.set(entry.iri, label);
        this.typeCache.set(entry.iri, pickTypes(entry.iri, result.triples));
      }
      this.tab = result.triples.length > 0 ? "triples" : "raw";
      this.payload = { state: "results", result };
      this.render();
    } catch (error: any) {
      if (requestId !== this.requestId || error?.name === "AbortError") return;
      let raw = "";
      try {
        if (typeof error?.response?.text === "function") raw = await error.response.text();
        else if (typeof error?.response?.text === "string") raw = error.response.text;
      } catch {
        raw = "";
      }
      if (requestId !== this.requestId) return;
      this.tab = "raw";
      this.payload = { state: "error", error, raw };
      this.render();
    } finally {
      if (this.abortController === controller) this.abortController = undefined;
    }
  }

  private getPrefixes(): PrefixMap {
    try {
      return sanitizePrefixes(this.yasr.getPrefixes());
    } catch {
      return {};
    }
  }

  private languages(): string[] {
    const langs = typeof navigator !== "undefined" ? [...(navigator.languages || []), navigator.language] : [];
    return [...langs.filter(Boolean), "en"];
  }

  /** Create the panel element (once per opening) and wire layout and keyboard handling. */
  private open(): void {
    if (this.el) return;
    const active = document.activeElement;
    this.returnFocus = active instanceof HTMLElement && active !== document.body ? active : null;

    this.el = document.createElement("aside");
    this.el.className = "yasr_describe";
    this.el.setAttribute("aria-label", "Describe resource");
    this.el.tabIndex = -1;

    this.scrim = document.createElement("div");
    this.scrim.className = "yasr_describe_scrim";
    this.scrim.addEventListener("click", () => this.close());

    this.yasr.rootEl.appendChild(this.scrim);
    this.yasr.rootEl.appendChild(this.el);
    this.resizer = this.createResizer();
    this.yasr.rootEl.classList.add("yasr--describeOpen");
    document.addEventListener("keydown", this.keydownHandler);
    window.addEventListener("resize", this.windowResizeHandler);

    this.updateLayout();
    if (typeof ResizeObserver !== "undefined") {
      this.resizeObserver = new ResizeObserver(() => this.updateLayout());
      this.resizeObserver.observe(this.yasr.rootEl);
      this.resizeObserver.observe(this.yasr.headerEl);
      // A floating panel is resized with its corner grip: remember its size
      this.panelObserver = new ResizeObserver(() => this.rememberFloatingSize());
      this.panelObserver.observe(this.el);
    }
    // Move focus into the panel so keyboard users land on it; render() keeps it there.
    requestAnimationFrame(() => {
      if (this.el && !this.el.contains(document.activeElement)) this.el.focus({ preventScroll: true });
    });
  }

  private updateLayout(): void {
    if (!this.el) return;
    const root = this.yasr.rootEl;
    const header = this.yasr.headerEl;
    root.style.setProperty("--yasr-describe-top", `${header.offsetTop + header.offsetHeight}px`);
    const rootWidth = root.getBoundingClientRect().width;
    const docked = this.mode === "docked";
    root.classList.toggle("yasr--describeOverlay", docked && rootWidth < OVERLAY_BREAKPOINT);
    root.classList.toggle("yasr--describeFloating", this.mode === "floating");
    root.classList.toggle("yasr--describeMaximized", this.mode === "maximized");
    if (this.layout.width === DEFAULT_DOCKED_WIDTH) root.style.removeProperty("--yasr-describe-width");
    else root.style.setProperty("--yasr-describe-width", `${clampDockedWidth(this.layout.width, rootWidth)}px`);

    const style = this.el.style;
    if (this.mode === "floating") {
      const viewport = { width: window.innerWidth, height: window.innerHeight };
      const rect = clampFloatingRect(this.layout.floating || defaultFloatingRect(viewport), viewport);
      this.layout.floating = rect;
      style.left = `${rect.x}px`;
      style.top = `${rect.y}px`;
      style.width = `${rect.width}px`;
      style.height = `${rect.height}px`;
    } else {
      style.removeProperty("left");
      style.removeProperty("top");
      style.removeProperty("width");
      style.removeProperty("height");
    }
  }

  private rememberFloatingSize(): void {
    if (!this.el || this.mode !== "floating" || !this.layout.floating) return;
    const { width, height } = this.el.getBoundingClientRect();
    if (!width || !height) return;
    const rounded = { width: Math.round(width), height: Math.round(height) };
    if (rounded.width === this.layout.floating.width && rounded.height === this.layout.floating.height) return;
    this.layout.floating = { ...this.layout.floating, ...rounded };
    saveLayout(this.layout);
  }

  /** Handle on the left edge of the docked panel; drag to change its width, double-click to reset. */
  private createResizer(): HTMLElement {
    const handle = document.createElement("div");
    handle.className = "yasr_describe_resizer";
    handle.title = "Drag to resize, double-click to reset";
    handle.setAttribute("aria-hidden", "true");
    handle.addEventListener("mousedown", (e) => {
      if (e.button !== 0 || !this.el) return;
      e.preventDefault();
      const startX = e.clientX;
      const startWidth = this.el.getBoundingClientRect().width;
      const rootWidth = this.yasr.rootEl.getBoundingClientRect().width;
      handle.classList.add("resizing");
      document.body.classList.add("yasr_describe_resizingBody");
      const move = (ev: MouseEvent) => {
        this.layout.width = clampDockedWidth(startWidth + startX - ev.clientX, rootWidth);
        this.yasr.rootEl.style.setProperty("--yasr-describe-width", `${this.layout.width}px`);
      };
      const up = () => {
        handle.classList.remove("resizing");
        document.body.classList.remove("yasr_describe_resizingBody");
        document.removeEventListener("mousemove", move);
        document.removeEventListener("mouseup", up);
        saveLayout(this.layout);
      };
      document.addEventListener("mousemove", move);
      document.addEventListener("mouseup", up);
    });
    handle.addEventListener("dblclick", () => {
      this.layout.width = DEFAULT_DOCKED_WIDTH;
      saveLayout(this.layout);
      this.yasr.rootEl.style.removeProperty("--yasr-describe-width");
    });
    return handle;
  }

  /** Move a floating panel by dragging its top bar. */
  private startFloatingDrag(e: MouseEvent): void {
    if (this.mode !== "floating" || e.button !== 0 || !this.el || !this.layout.floating) return;
    if ((e.target as HTMLElement).closest("button, a, input")) return;
    e.preventDefault();
    const start = { x: e.clientX, y: e.clientY, rect: { ...this.layout.floating } };
    this.el.classList.add("yasr_describe--moving");
    const move = (ev: MouseEvent) => {
      if (!this.el) return;
      const viewport = { width: window.innerWidth, height: window.innerHeight };
      const rect = clampFloatingRect(
        { ...start.rect, x: start.rect.x + ev.clientX - start.x, y: start.rect.y + ev.clientY - start.y },
        viewport,
      );
      this.layout.floating = rect;
      this.el.style.left = `${rect.x}px`;
      this.el.style.top = `${rect.y}px`;
    };
    const up = () => {
      this.el?.classList.remove("yasr_describe--moving");
      document.removeEventListener("mousemove", move);
      document.removeEventListener("mouseup", up);
      saveLayout(this.layout);
    };
    document.addEventListener("mousemove", move);
    document.addEventListener("mouseup", up);
  }

  private onKeydown(e: KeyboardEvent): void {
    if (!this.el || e.defaultPrevented) return;
    const target = e.target as Node | null;
    const inPanel = !!target && this.el.contains(target);
    const inYasr = !!target && this.yasr.rootEl.contains(target);
    const onBody = target === document.body || target === document.documentElement;
    if (e.key === "Escape" && this.mode === "maximized" && (inYasr || onBody)) {
      e.preventDefault();
      this.setMode(this.restoreMode);
    } else if (e.key === "Escape" && (inYasr || onBody)) {
      e.preventDefault();
      this.close();
    } else if (inPanel && e.altKey && e.key === "ArrowLeft" && this.history.canGoBack()) {
      e.preventDefault();
      void this.back();
    } else if (inPanel && e.altKey && e.key === "ArrowRight" && this.history.canGoForward()) {
      e.preventDefault();
      void this.forward();
    }
  }

  /* ------------------------------------------------------------------ */
  /* Rendering                                                            */
  /* ------------------------------------------------------------------ */

  private render(): void {
    const el = this.el;
    const entry = this.history.current();
    if (!el || !entry) return;
    const hadFocus = el.contains(document.activeElement) || document.activeElement === el;
    const prefixes = this.displayPrefixes();

    el.replaceChildren(
      this.renderNav(entry),
      this.renderHead(entry, prefixes),
      this.renderDirection(entry),
      this.renderBody(entry, prefixes),
      this.renderFooter(entry),
    );
    if (this.resizer) el.appendChild(this.resizer);
    el.setAttribute("aria-busy", String(this.payload.state === "loading"));
    if (hadFocus && !el.contains(document.activeElement)) el.focus({ preventScroll: true });
  }

  private button(className: string, label: string, iconName?: IconName, text?: string): HTMLButtonElement {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = className;
    if (iconName) btn.appendChild(icon(iconName));
    if (text) {
      const span = document.createElement("span");
      span.textContent = text;
      btn.appendChild(span);
    } else {
      btn.setAttribute("aria-label", label);
    }
    btn.title = label;
    return btn;
  }

  private renderNav(entry: DescribeHistoryEntry): HTMLElement {
    const nav = document.createElement("div");
    nav.className = "yasr_describe_nav";

    if (this.history.getIndex() > 1) {
      const start = this.button("yasr_describe_iconButton yasr_describe_start", "Back to start", "chevrons-left");
      start.addEventListener("click", () => void this.backToStart());
      nav.appendChild(start);
    }
    const back = this.button("yasr_describe_iconButton yasr_describe_back", "Back (Alt+Left)", "chevron-left");
    back.disabled = !this.history.canGoBack();
    back.addEventListener("click", () => void this.back());
    const forward = this.button(
      "yasr_describe_iconButton yasr_describe_forward",
      "Forward (Alt+Right)",
      "chevron-right",
    );
    forward.disabled = !this.history.canGoForward();
    forward.addEventListener("click", () => void this.forward());
    nav.append(back, forward);

    const source = document.createElement("span");
    source.className = "yasr_describe_source";
    if (entry.source) source.textContent = `Opened from ${entry.source}`;
    nav.appendChild(source);

    const floating = this.mode === "floating" || (this.mode === "maximized" && this.restoreMode === "floating");
    const float = floating
      ? this.button(
          "yasr_describe_iconButton yasr_describe_modeButton yasr_describe_dock",
          "Dock next to the results",
          "panel-right",
        )
      : this.button(
          "yasr_describe_iconButton yasr_describe_modeButton yasr_describe_float",
          "Float as a window",
          "picture-in-picture",
        );
    float.addEventListener("click", () => this.setMode(floating ? "docked" : "floating"));
    const maximized = this.mode === "maximized";
    const maximize = this.button(
      "yasr_describe_iconButton yasr_describe_modeButton yasr_describe_maximize",
      maximized ? "Restore (Esc)" : "Maximize",
      maximized ? "minimize" : "maximize",
    );
    maximize.setAttribute("aria-pressed", String(maximized));
    maximize.addEventListener("click", () => this.setMode(maximized ? this.restoreMode : "maximized"));
    nav.append(float, maximize);
    nav.addEventListener("mousedown", (e) => this.startFloatingDrag(e));
    nav.addEventListener("dblclick", (e) => {
      if (this.mode === "floating" && !(e.target as HTMLElement).closest("button, a")) this.setMode("maximized");
    });

    const close = this.button("yasr_describe_iconButton yasr_describe_close", "Close (Esc)", "x");
    close.addEventListener("click", () => this.close());
    nav.appendChild(close);
    return nav;
  }

  private renderHead(entry: DescribeHistoryEntry, prefixes: PrefixMap): HTMLElement {
    const head = document.createElement("div");
    head.className = "yasr_describe_head";

    const title = document.createElement("h2");
    title.className = "yasr_describe_title";
    title.id = `${this.yasr.resultsEl.id}_describeTitle`;
    title.textContent = this.labelCache.get(entry.iri) || toPrefixedName(entry.iri, prefixes) || localName(entry.iri);
    this.el?.setAttribute("aria-labelledby", title.id);

    const iri = document.createElement("a");
    iri.className = "yasr_describe_iri";
    iri.href = entry.iri;
    iri.target = "_blank";
    iri.rel = "noopener noreferrer";
    iri.title = "Open the IRI in a new browser tab";
    iri.textContent = entry.iri;
    head.append(title, iri);

    const types = this.typeCache.get(entry.iri) || [];
    if (types.length) {
      const typeList = document.createElement("div");
      typeList.className = "yasr_describe_types";
      const addPill = (type: string) => {
        const pill = this.button("yasr_describe_type", `Describe ${type}`, undefined, this.displayIri(type, prefixes));
        pill.addEventListener("click", (e) => this.hop(type, e));
        typeList.appendChild(pill);
      };
      // Many types would push the triples down: show the first few and a "…" to expand
      types.slice(0, MAX_VISIBLE_TYPES).forEach(addPill);
      const hidden = types.slice(MAX_VISIBLE_TYPES);
      if (hidden.length) {
        const more = this.button(
          "yasr_describe_type yasr_describe_typeMore",
          `Show ${hidden.length} more types`,
          undefined,
          "…",
        );
        more.setAttribute("aria-label", `Show ${hidden.length} more types`);
        more.addEventListener("click", () => {
          more.remove();
          hidden.forEach(addPill);
        });
        typeList.appendChild(more);
      }
      head.appendChild(typeList);
    }
    return head;
  }

  private renderDirection(entry: DescribeHistoryEntry): HTMLElement {
    const group = document.createElement("div");
    group.className = "yasr_describe_direction";
    group.setAttribute("role", "group");
    group.setAttribute("aria-label", "Direction");
    const options: [DescribeDirection, string, string][] = [
      ["outgoing", "Outgoing", "Triples where this resource is the subject"],
      ["incoming", "Incoming", "Triples where this resource is the object"],
    ];
    for (const [direction, text, label] of options) {
      const btn = this.button("yasr_describe_directionButton", label, undefined, text);
      btn.setAttribute("aria-pressed", String(entry.direction === direction));
      btn.addEventListener("click", () => {
        if (entry.direction === direction) return;
        this.history.push({ ...entry, direction });
        void this.load(this.history.current()!);
      });
      group.appendChild(btn);
    }
    return group;
  }

  private renderBody(entry: DescribeHistoryEntry, prefixes: PrefixMap): HTMLElement {
    const body = document.createElement("div");
    body.className = "yasr_describe_body";
    const payload = this.payload;

    if (payload.state === "loading") {
      const loading = document.createElement("div");
      loading.className = "yasr_describe_loading";
      loading.setAttribute("role", "status");
      loading.appendChild(icon("loader-circle", 20));
      const text = document.createElement("span");
      text.textContent = `Fetching ${entry.direction} triples…`;
      loading.appendChild(text);
      body.appendChild(loading);
      return body;
    }

    const triples = payload.state === "results" ? payload.result.triples : [];
    const raw = payload.state === "results" ? payload.result.raw : payload.raw;

    if (payload.state === "error") {
      const error = document.createElement("div");
      error.className = "yasr_describe_error";
      error.setAttribute("role", "alert");
      error.appendChild(icon("circle-alert"));
      const text = document.createElement("span");
      text.textContent = `Could not fetch the triples: ${this.errorMessage(payload.error)}`;
      error.appendChild(text);
      body.appendChild(error);
    }

    const tabs = document.createElement("div");
    tabs.className = "yasr_describe_tabs";
    tabs.setAttribute("role", "tablist");
    const tabButton = (tab: "triples" | "raw", text: string) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "yasr_describe_tab";
      btn.setAttribute("role", "tab");
      btn.setAttribute("aria-selected", String(this.tab === tab));
      btn.textContent = text;
      btn.addEventListener("click", () => {
        this.tab = tab;
        this.render();
      });
      return btn;
    };
    tabs.append(tabButton("triples", `Triples (${triples.length})`), tabButton("raw", "Raw"));
    body.appendChild(tabs);

    const panel = document.createElement("div");
    panel.className = "yasr_describe_tabPanel";
    panel.setAttribute("role", "tabpanel");
    if (this.tab === "triples") {
      if (triples.length) {
        panel.appendChild(this.renderTriples(entry, triples, prefixes));
        if (entry.direction === "incoming" && triples.length >= INCOMING_TRIPLE_LIMIT) {
          panel.appendChild(this.note(`Showing the first ${INCOMING_TRIPLE_LIMIT} incoming triples.`));
        }
        panel.appendChild(this.note("Click a resource to describe it, Shift+click for its incoming triples."));
      } else if (payload.state === "results") {
        panel.appendChild(
          this.note(
            raw.trim() ? "No triples could be parsed from the response." : `No ${entry.direction} triples found.`,
          ),
        );
      }
    } else {
      panel.appendChild(this.renderRaw(raw));
    }
    body.appendChild(panel);
    return body;
  }

  private note(text: string): HTMLElement {
    const p = document.createElement("p");
    p.className = "yasr_describe_note";
    p.textContent = text;
    return p;
  }

  /** Predicate / value rows, grouped by predicate. Triples about other subjects are listed in full below. */
  private renderTriples(entry: DescribeHistoryEntry, triples: DescribeTriple[], prefixes: PrefixMap): HTMLElement {
    const wrapper = document.createElement("div");
    const outgoing = entry.direction === "outgoing";
    const main: DescribeTriple[] = [];
    const other: DescribeTriple[] = [];
    for (const t of triples) {
      ((outgoing ? t.subject.value : t.object.value) === entry.iri ? main : other).push(t);
    }

    // Group by predicate in first-seen order, with rdf:type first
    const groups = new Map<string, DescribeTriple[]>();
    for (const t of main) {
      if (!groups.has(t.predicate)) groups.set(t.predicate, []);
      groups.get(t.predicate)!.push(t);
    }
    const predicates = [...groups.keys()].sort((a, b) => Number(b === RDF_TYPE) - Number(a === RDF_TYPE));

    const list = document.createElement("dl");
    list.className = "yasr_describe_triples";
    for (const predicate of predicates) {
      const row = document.createElement("div");
      row.className = "yasr_describe_row";
      const dt = document.createElement("dt");
      dt.className = "yasr_describe_predicate";
      dt.appendChild(this.iriLink(predicate, prefixes, "yasr_describe_predicateLink"));
      row.appendChild(dt);
      for (const t of groups.get(predicate)!) {
        const dd = document.createElement("dd");
        dd.className = "yasr_describe_value";
        dd.appendChild(this.termNode(outgoing ? t.object : t.subject, prefixes));
        row.appendChild(dd);
      }
      list.appendChild(row);
    }
    wrapper.appendChild(list);

    if (other.length) {
      const heading = document.createElement("h3");
      heading.className = "yasr_describe_subheading";
      heading.textContent = "Other triples in the response";
      const table = document.createElement("table");
      table.className = "yasr_describe_otherTriples";
      const tbody = document.createElement("tbody");
      for (const t of other) {
        const tr = document.createElement("tr");
        for (const node of [
          this.termNode(t.subject, prefixes),
          this.iriLink(t.predicate, prefixes),
          this.termNode(t.object, prefixes),
        ]) {
          const td = document.createElement("td");
          td.appendChild(node);
          tr.appendChild(td);
        }
        tbody.appendChild(tr);
      }
      table.appendChild(tbody);
      wrapper.append(heading, table);
    }
    return wrapper;
  }

  private renderRaw(raw: string): HTMLElement {
    const wrapper = document.createElement("div");
    wrapper.className = "yasr_describe_raw";
    if (!raw.trim()) {
      wrapper.appendChild(this.note("No raw response text available."));
      return wrapper;
    }
    const copy = this.button("yasr_toolbarButton yasr_describe_copyRaw", "Copy raw response", "copy", "Copy raw");
    copy.addEventListener("click", () => this.copy(raw, copy));
    const pre = document.createElement("pre");
    pre.textContent = raw;
    wrapper.append(copy, pre);
    return wrapper;
  }

  private renderFooter(entry: DescribeHistoryEntry): HTMLElement {
    const footer = document.createElement("div");
    footer.className = "yasr_describe_footer";
    const openQuery = this.yasr.config.openQueryInNewTab;
    if (typeof openQuery === "function") {
      const open = this.button(
        "yasr_describe_primary yasr_describe_openQuery",
        "Open this query in a new tab",
        "file-code",
        "Open as query",
      );
      open.addEventListener("click", () => openQuery(this.query));
      footer.appendChild(open);
    }
    const copy = this.button("yasr_describe_secondary yasr_describe_copyIri", "Copy the IRI", "copy", "Copy IRI");
    copy.addEventListener("click", () => this.copy(entry.iri, copy));
    footer.appendChild(copy);
    return footer;
  }

  /** Prefixes for display only: the yasr prefixes plus a few well-known ones they don't override. */
  private displayPrefixes(): PrefixMap {
    const prefixes = this.getPrefixes();
    const namespaces = new Set(Object.values(prefixes));
    for (const [prefix, namespace] of Object.entries(WELL_KNOWN_PREFIXES)) {
      if (!(prefix in prefixes) && !namespaces.has(namespace)) prefixes[prefix] = namespace;
    }
    return prefixes;
  }

  private displayIri(iri: string, prefixes: PrefixMap, brackets = true): string {
    return toPrefixedName(iri, prefixes) ?? (brackets ? `<${iri}>` : iri);
  }

  /** A link that describes the IRI on click (Shift+click: incoming); middle click opens the IRI itself. */
  private iriLink(iri: string, prefixes: PrefixMap, className = ""): HTMLAnchorElement {
    const link = document.createElement("a");
    link.className = `yasr_describe_link ${className}`.trim();
    link.href = iri;
    link.title = iri;
    link.textContent = this.labelCache.get(iri) ?? this.displayIri(iri, prefixes, false);
    link.addEventListener("click", (e) => this.hop(iri, e));
    return link;
  }

  private hop(iri: string, e: MouseEvent): void {
    e.preventDefault();
    void this.describe(iri, { direction: e.shiftKey ? "incoming" : "outgoing", newHistory: false });
  }

  private termNode(term: DescribeTerm, prefixes: PrefixMap): Node {
    if (term.type === "uri") return this.iriLink(term.value, prefixes);
    const span = document.createElement("span");
    if (term.type === "bnode") {
      span.className = "yasr_describe_bnode";
      span.textContent = term.value;
      return span;
    }
    span.className = "yasr_describe_literal";
    span.title = formatDescribeTerm(term);
    span.textContent = term.value;
    if (term.lang || term.datatype) {
      const meta = document.createElement("span");
      meta.className = "yasr_describe_literalMeta";
      meta.textContent = term.lang ? `@${term.lang}` : this.displayIri(term.datatype!, prefixes);
      span.append(" ", meta);
    }
    return span;
  }

  private errorMessage(error: unknown): string {
    if (error instanceof Error) return error.message;
    if (typeof error === "string") return error;
    const message = (error as any)?.message || (error as any)?.statusText;
    return typeof message === "string" && message ? message : "unknown error";
  }

  private async copy(text: string, button: HTMLButtonElement): Promise<void> {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = text;
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        textarea.remove();
      }
      const label = button.querySelector("span");
      const previous = label?.textContent;
      button.classList.add("is-copied");
      if (label) label.textContent = "Copied";
      setTimeout(() => {
        button.classList.remove("is-copied");
        if (label && previous) label.textContent = previous;
      }, 1500);
    } catch (error) {
      console.error("yasr: could not copy to the clipboard", error);
    }
  }
}
