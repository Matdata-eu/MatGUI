/**
 * Support for SPARQL Anything queries (`SERVICE <x-sparql-anything:...> { ... }`): when the user asks for it, a
 * structure query is sent to the endpoint for the source of a block. The result feeds the autocompletion (columns,
 * keys, elements), the chips in the editor and the "Source" view of the side panel (structure, preview, query
 * builder). Nothing happens for queries without such a block.
 */
import { Parser } from "@matdata/yasr";
import { Storage as YStorage } from "@matdata/yasgui-utils";
import type { ContextTerms, SparqlAnythingSource } from "@matdata/yasqe";
import type { Yasgui } from "../";
import type Tab from "../Tab";
import type { PaletteItem } from "../CommandPalette";
import { icon, IconName } from "../icons";
import { storageNamespace } from "../PersistentConfig";
import { describeQueryError } from "../endpointDescribe/responseUtils";
import { previewQuery, structureQuery } from "./probeQueries";
import { rowsFromBindings, StructureRow, termsFromRows } from "./structure";
import SourceView from "./SourceView";
import "./SparqlAnything.scss";

const SPARQL_JSON = "application/sparql-results+json";
const TURTLE = "text/turtle,application/n-triples;q=0.9,*/*;q=0.1";
const TIMEOUT_MS = 120000;
/** Loaded structures are kept for a day, at most this many */
const MAX_PERSISTED = 50;
const PERSIST_MS = 24 * 60 * 60 * 1000;

export interface Preview {
  status: "loading" | "done" | "error";
  text?: string;
  error?: string;
  fetchedAt: number;
}

export interface SourceState {
  status: "loading" | "done" | "error";
  rows?: StructureRow[];
  error?: string;
  fetchedAt: number;
  durationMs?: number;
  /** The query that was sent, for "Open query in a new tab" */
  query?: string;
  preview?: Preview;
}

interface Persisted {
  [key: string]: { rows: StructureRow[]; fetchedAt: number; durationMs?: number };
}

export function plural(count: number, singular: string, pluralForm = singular + "s") {
  return `${count.toLocaleString()} ${count === 1 ? singular : pluralForm}`;
}

/** An icon as an element */
export function iconElement(name: IconName, size = 14): HTMLElement {
  const span = document.createElement("span");
  span.className = "yasgui-sa__icon";
  span.innerHTML = icon(name, size);
  return span;
}

export default class SparqlAnythingSupport {
  public readonly view: SourceView;
  private states = new Map<string, SourceState>();
  private controllers = new Map<string, AbortController>();
  private storage = new YStorage(storageNamespace);
  private storageId: string | undefined;

  constructor(private yasgui: Yasgui) {
    this.storageId = yasgui.getStorageId("sparqlAnything");
    this.restore();
    this.view = new SourceView(yasgui, this);
  }

  private key(tab: Tab, source: SparqlAnythingSource) {
    return `${tab.getEndpoint()}\n${source.key}`;
  }

  public getState(tab: Tab, source: SparqlAnythingSource): SourceState | undefined {
    return this.states.get(this.key(tab, source));
  }

  /** Sends the structure query of the source to the endpoint of the tab */
  public async load(tab: Tab, source: SparqlAnythingSource) {
    if (!source.ready) return;
    const key = this.key(tab, source);
    this.controllers.get(key)?.abort();
    const controller = new AbortController();
    this.controllers.set(key, controller);
    const query = structureQuery(source, tab.getYasqe()?.getPrefixesFromQuery() || {});
    const previous = this.states.get(key);
    this.states.set(key, { status: "loading", fetchedAt: Date.now(), query, preview: previous?.preview });
    this.changed();
    const start = Date.now();
    let timedOut = false;
    const timeout = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, TIMEOUT_MS);
    try {
      const response = await tab.runBackgroundQuery(query, {
        accept: SPARQL_JSON,
        signal: controller.signal,
        skipGraphArgs: true,
      });
      if (!response) throw new Error("No response");
      const parser = new Parser(response, Date.now() - start);
      if (parser.hasError()) {
        const error = parser.getError();
        throw new Error(error?.text || error?.statusText || "Query failed");
      }
      const rows = rowsFromBindings((parser.getBindings() || []) as any);
      this.states.set(key, { status: "done", rows, fetchedAt: Date.now(), durationMs: Date.now() - start, query });
      this.persist();
    } catch (e: any) {
      if (controller.signal.aborted && !timedOut) {
        // Cancelled: back to how it was before
        if (previous && previous.status !== "loading") this.states.set(key, previous);
        else this.states.delete(key);
      } else {
        this.states.set(key, {
          status: "error",
          error: describeQueryError(e, { timedOut, timeoutMs: TIMEOUT_MS }),
          fetchedAt: Date.now(),
          durationMs: Date.now() - start,
          query,
        });
      }
    } finally {
      clearTimeout(timeout);
      if (this.controllers.get(key) === controller) this.controllers.delete(key);
      this.changed();
    }
  }

  public cancel(tab: Tab, source: SparqlAnythingSource) {
    this.controllers.get(this.key(tab, source))?.abort();
  }

  /** Fetches the first triples of the source as Turtle */
  public async loadPreview(tab: Tab, source: SparqlAnythingSource) {
    const key = this.key(tab, source);
    const state = this.states.get(key);
    if (!state || state.preview?.status === "loading") return;
    state.preview = { status: "loading", fetchedAt: Date.now() };
    this.changed();
    const query = previewQuery(source, tab.getYasqe()?.getPrefixesFromQuery() || {});
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
    let preview: Preview;
    try {
      const response = await tab.runBackgroundQuery(query, {
        accept: TURTLE,
        signal: controller.signal,
        skipGraphArgs: true,
      });
      preview = { status: "done", text: String(response?.content ?? ""), fetchedAt: Date.now() };
    } catch (e: any) {
      preview = {
        status: "error",
        error: describeQueryError(e, { timedOut: controller.signal.aborted, timeoutMs: TIMEOUT_MS }),
        fetchedAt: Date.now(),
      };
    } finally {
      clearTimeout(timeout);
    }
    // The structure may have been reloaded meanwhile: attach the preview to the current state
    const current = this.states.get(key);
    if (current) current.preview = preview;
    this.changed();
  }

  /** Redraws the chips of every tab and the Source view */
  public changed() {
    for (const tab of Object.values(this.yasgui._tabs)) tab.getYasqe()?.refreshSparqlAnythingChips();
    this.view.render();
  }

  /** Called by the tab when its query or cursor changed */
  public editorActivity(tab: Tab, docChanged: boolean) {
    if (tab !== this.yasgui.getTab()) return;
    this.view.editorActivity(docChanged);
  }

  /**
   * Classes or properties of the loaded sources, for the autocompleters: the source of the block holding the
   * cursor, or all loaded sources of the query when the cursor is outside a block.
   */
  public getContextTerms(tab: Tab, type: "class" | "property"): ContextTerms[] {
    const yasqe = tab.getYasqe();
    if (!yasqe) return [];
    const sources = yasqe.getSparqlAnythingSources();
    if (!sources.length) return [];
    const atCursor = yasqe.getSparqlAnythingSourceAt();
    const queryPrefixes = yasqe.getPrefixesFromQuery();
    const groups: ContextTerms[] = [];
    for (const source of atCursor ? [atCursor] : sources) {
      const state = this.getState(tab, source);
      if (state?.status !== "done" || !state.rows) continue;
      const terms = termsFromRows(state.rows)[type === "class" ? "classes" : "properties"];
      if (!terms.length) continue;
      // Shorten with the prefix of the query for the namespace, or declare xyz: (or the next free name)
      let prefix = Object.keys(queryPrefixes).find((p) => queryPrefixes[p] === source.namespace);
      if (prefix === undefined) {
        prefix = "xyz";
        for (let i = 2; queryPrefixes[prefix] !== undefined; i++) prefix = `xyz${i}`;
      }
      groups.push({
        section: `From ${source.label}`,
        terms: terms.map((term) => ({
          iri: term.iri,
          count: term.count,
          prefix: term.iri.startsWith(source.namespace) ? prefix : undefined,
          namespace: term.iri.startsWith(source.namespace) ? source.namespace : undefined,
        })),
      });
    }
    return groups;
  }

  /** Ctrl+K commands for the SPARQL Anything sources of the tab's query */
  public getPaletteCommands(tab: Tab): PaletteItem[] {
    const sources = tab.getYasqe()?.getSparqlAnythingSources() || [];
    const items: PaletteItem[] = [];
    for (const source of sources) {
      if (!source.ready) continue;
      const state = this.getState(tab, source);
      items.push({
        section: "commands",
        label: `${state?.status === "done" ? "Reload" : "Load"} structure of ${source.label}`,
        icon: "fileSearch",
        keywords: "sparql anything source columns keys autocomplete facade-x",
        run: () => {
          this.view.show(source);
          void this.load(tab, source);
        },
      });
      items.push({
        section: "commands",
        label: `Inspect ${source.label}`,
        icon: "fileSearch",
        keywords: "sparql anything source structure preview build query",
        run: () => this.view.show(source),
      });
    }
    return items;
  }

  /** The chip after the opening brace of a SPARQL Anything block */
  public renderChip(tab: Tab, source: SparqlAnythingSource): HTMLElement {
    const chip = document.createElement("span");
    chip.className = "yasgui-saChip";
    const add = (node: Node | string) => chip.append(node);
    const action = (label: string, title: string, run: () => void, className = "") => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `yasgui-saChip__action ${className}`.trim();
      button.textContent = label;
      button.title = title;
      button.addEventListener("mousedown", (event) => event.preventDefault());
      button.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        run();
      });
      return button;
    };
    const name = document.createElement("b");
    name.textContent = source.label;
    const muted = (text: string) => {
      const span = document.createElement("span");
      span.className = "yasgui-saChip__muted";
      span.textContent = text;
      return span;
    };
    if (!source.ready) {
      chip.classList.add("disabled");
      add(iconElement("fileSearch", 13));
      add(name);
      add(
        muted(
          source.variableOptions.length
            ? `· ${source.variableOptions.join(", ")} is a variable`
            : "· no location, content or command",
        ),
      );
      chip.title = "MatGUI can only inspect a source whose location (or content) is written in the query";
      return chip;
    }
    const state = this.getState(tab, source);
    const inspect = () => this.view.show(source);
    if (!state) {
      add(iconElement("fileSearch", 13));
      add(name);
      add(muted("·"));
      add(
        action("Load structure", "Send a query to the endpoint to read the structure of this source", () => {
          // Open the Source view, so the progress and the result show up next to the editor
          inspect();
          void this.load(tab, source);
        }),
      );
    } else if (state.status === "loading") {
      chip.classList.add("loading");
      add(iconElement("loader", 13));
      add(name);
      add(muted("· loading…"));
      add(action("Cancel", "Stop loading the structure", () => this.cancel(tab, source)));
    } else if (state.status === "error") {
      chip.classList.add("error");
      add(iconElement("alert", 13));
      add(name);
      add(muted("· could not load"));
      add(
        action(
          "Retry",
          state.error || "",
          () => {
            inspect();
            void this.load(tab, source);
          },
          "danger",
        ),
      );
      chip.title = state.error || "";
    } else {
      chip.classList.add("loaded");
      const terms = termsFromRows(state.rows || []);
      add(iconElement("fileSearch", 13));
      add(name);
      add(muted(`· ${plural(terms.properties.length, "property", "properties")}`));
      add(muted("·"));
      add(action("Inspect", "Show the structure in the side panel", inspect));
    }
    return chip;
  }

  private restore() {
    if (!this.storageId) return;
    let persisted: Persisted | undefined;
    try {
      persisted = this.storage.get<Persisted>(this.storageId);
    } catch {
      persisted = undefined;
    }
    if (!persisted || typeof persisted !== "object") return;
    const now = Date.now();
    for (const key of Object.keys(persisted)) {
      const entry = persisted[key];
      if (!entry || !Array.isArray(entry.rows) || now - entry.fetchedAt > PERSIST_MS) continue;
      this.states.set(key, {
        status: "done",
        rows: entry.rows,
        fetchedAt: entry.fetchedAt,
        durationMs: entry.durationMs,
      });
    }
  }

  private persist() {
    if (!this.storageId) return;
    const now = Date.now();
    const entries = Array.from(this.states.entries())
      .filter(([, state]) => state.status === "done" && state.rows && now - state.fetchedAt < PERSIST_MS)
      .sort((a, b) => b[1].fetchedAt - a[1].fetchedAt)
      .slice(0, MAX_PERSISTED);
    const persisted: Persisted = {};
    for (const [key, state] of entries) {
      persisted[key] = { rows: state.rows!, fetchedAt: state.fetchedAt, durationMs: state.durationMs };
    }
    const storageId = this.storageId;
    this.storage.set(storageId, persisted, this.yasgui.config.persistencyExpire, () => this.storage.remove(storageId));
  }

  public destroy() {
    for (const controller of this.controllers.values()) controller.abort();
    this.view.destroy();
  }
}
