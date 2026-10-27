/**
 * The "Source" view of the side panel: the structure of a SPARQL Anything source of the active tab (click a
 * property to insert it), a preview of its first triples, and a query builder. The view is only listed while the
 * query of the active tab has a SPARQL Anything block.
 */
import type { SparqlAnythingSource } from "@matdata/yasqe";
import type { Yasgui } from "../";
import type Tab from "../Tab";
import { iconButton } from "../icons";
import type SparqlAnythingSupport from "./SparqlAnythingSupport";
import type { SourceState } from "./SparqlAnythingSupport";
import { iconElement } from "./SparqlAnythingSupport";
import { FX, PREVIEW_LIMIT, previewQuery, SLOT } from "./probeQueries";
import { buildStructure, StructureNode, walk } from "./structure";
import { buildPatterns, buildQuery, builderPrefixes, PickedValue, writeIri } from "./queryBuilder";

type SubView = "structure" | "preview" | "build";
const SUB_VIEWS: { id: SubView; label: string }[] = [
  { id: "structure", label: "Structure" },
  { id: "preview", label: "Preview" },
  { id: "build", label: "Build query" },
];
const FORMAT_LABELS = { csv: "CSV", json: "JSON", xml: "XML", other: "" };

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function button(label: string, className: string, title?: string): HTMLButtonElement {
  const b = el("button", className, label);
  b.type = "button";
  if (title) b.title = title;
  return b;
}

/** A key for a node that stays the same when the structure is reloaded */
function stableKey(node: StructureNode): string {
  return `${node.parent ? stableKey(node.parent) : ""}/${node.step ?? ""}@${node.type ?? ""}#${node.kind}`;
}

function ago(time: number): string {
  const minutes = Math.round((Date.now() - time) / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  return `${Math.round(minutes / 60)} h ago`;
}

/** Light highlighting of Turtle: IRIs, literals, prefixed names, keywords */
function highlightTurtle(text: string): DocumentFragment {
  const fragment = document.createDocumentFragment();
  const pattern =
    /(<[^>\s]*>)|("""[\s\S]*?"""|"(?:[^"\\\n]|\\.)*")|(@prefix|@base|PREFIX|BASE)|(_:[\w-]+|\b[A-Za-z][\w-]*:[\w.%-]*|(?<=\s)a(?=\s))/g;
  let last = 0;
  for (let match = pattern.exec(text); match; match = pattern.exec(text)) {
    if (match.index > last) fragment.append(text.substring(last, match.index));
    const cls = match[1]
      ? "iri"
      : match[2]
        ? "literal"
        : match[3]
          ? "keyword"
          : match[0].startsWith("_:")
            ? "bnode"
            : "name";
    fragment.append(el("span", `yasgui-sa__tt-${cls}`, match[0]));
    last = match.index + match[0].length;
  }
  if (last < text.length) fragment.append(text.substring(last));
  return fragment;
}

export default class SourceView {
  private rootEl: HTMLDivElement;
  private visible = false;
  private selectedKey: string | undefined;
  private subView: SubView = "structure";
  private collapsed = new Set<string>();
  /** Picked values of the query builder per source, in the order they were picked */
  private picked = new Map<string, { key: string; optional: boolean }[]>();
  private structureCache = new WeakMap<object, StructureNode[]>();
  private renderTimer: ReturnType<typeof setTimeout> | undefined;
  private renderedTabId: string | undefined;

  constructor(
    private yasgui: Yasgui,
    private support: SparqlAnythingSupport,
  ) {
    this.rootEl = el("div", "yasgui-sa");
    const container = yasgui.sidePanel.addView("source", "Source", "fileSearch", { before: "assistant" });
    container.appendChild(this.rootEl);
    yasgui.sidePanel.setViewVisible("source", false);
    yasgui.on("tabSelect", () => setTimeout(() => this.render(), 0));
    yasgui.sidePanel.onChange(() => {
      if (yasgui.sidePanel.isViewVisible("source")) this.render();
    });
  }

  private getTab(): Tab | undefined {
    return this.yasgui.getTab();
  }

  private getSources(): SparqlAnythingSource[] {
    return this.getTab()?.getYasqe()?.getSparqlAnythingSources() || [];
  }

  private getSelected(): SparqlAnythingSource | undefined {
    const sources = this.getSources();
    return sources.find((s) => s.key === this.selectedKey) || sources.find((s) => s.ready) || sources[0];
  }

  /** Opens the view on a source */
  public show(source: SparqlAnythingSource) {
    this.selectedKey = source.key;
    this.updateVisibility();
    this.yasgui.sidePanel.show("source");
    this.render();
  }

  /** The query or the cursor of the active tab changed */
  public editorActivity(docChanged: boolean) {
    const atCursor = this.getTab()?.getYasqe()?.getSparqlAnythingSourceAt();
    const follow = !!atCursor && atCursor.key !== this.selectedKey;
    if (follow) this.selectedKey = atCursor!.key;
    if (!docChanged && !follow) return;
    clearTimeout(this.renderTimer);
    this.renderTimer = setTimeout(() => this.render(), docChanged ? 250 : 0);
  }

  private updateVisibility() {
    const visible = this.getSources().length > 0;
    if (visible !== this.visible) {
      this.visible = visible;
      this.yasgui.sidePanel.setViewVisible("source", visible);
    }
  }

  public render() {
    this.updateVisibility();
    const tab = this.getTab();
    if (tab?.getId() !== this.renderedTabId) {
      this.renderedTabId = tab?.getId();
      this.collapsed.clear();
    }
    // Keep the scroll position of the body across redraws
    const scrollTop = this.rootEl.querySelector(".yasgui-sa__body")?.scrollTop ?? 0;
    this.rootEl.innerHTML = "";
    const source = this.getSelected();
    if (!tab || !source) {
      this.rootEl.append(
        el(
          "p",
          "yasgui-sa__empty",
          "Write a SERVICE <x-sparql-anything:location=...> { } block to inspect the file it reads.",
        ),
      );
      return;
    }
    this.selectedKey = source.key;
    const state = this.support.getState(tab, source);
    this.rootEl.append(this.drawHeader(tab, source, state));
    const body = el("div", "yasgui-sa__body");
    this.rootEl.append(body);
    if (!source.ready) {
      body.append(
        el(
          "p",
          "yasgui-sa__message",
          source.closed
            ? source.variableOptions.length
              ? `The ${source.variableOptions.join(", ")} of this source is a variable, so its structure can't be read before the query runs.`
              : "This block has no location, content or command option yet."
            : "Close the SERVICE block to inspect its source.",
        ),
      );
    } else if (!state) {
      body.append(this.drawLoad(tab, source));
    } else if (state.status === "loading") {
      body.append(this.drawLoading(tab, source));
    } else if (state.status === "error") {
      body.append(this.drawError(tab, source, state));
    } else {
      const tree = this.getStructure(state);
      if (this.subView === "structure") body.append(this.drawStructure(tab, source, state, tree));
      else if (this.subView === "preview") body.append(this.drawPreview(tab, source, state));
      else body.append(this.drawBuilder(tab, source, tree));
    }
    body.scrollTop = scrollTop;
  }

  private getStructure(state: SourceState): StructureNode[] {
    let tree = this.structureCache.get(state);
    if (!tree) {
      tree = buildStructure(state.rows || []);
      this.structureCache.set(state, tree);
    }
    return tree;
  }

  private drawHeader(tab: Tab, source: SparqlAnythingSource, state: SourceState | undefined): HTMLElement {
    const header = el("div", "yasgui-sa__header");
    const picker = el("div", "yasgui-sa__picker");
    picker.append(iconElement("fileSearch", 16));
    const sources = this.getSources();
    if (sources.length > 1) {
      const select = el("select", "yasgui-sa__select");
      select.setAttribute("aria-label", "SPARQL Anything source");
      sources.forEach((s, index) => {
        const option = el("option", undefined, s.label);
        option.value = s.key;
        option.selected = s.key === source.key;
        // Same file twice (e.g. with other options): tell them apart by position
        if (sources.filter((other) => other.label === s.label).length > 1) option.textContent += ` (${index + 1})`;
        select.append(option);
      });
      select.addEventListener("change", () => {
        this.selectedKey = select.value;
        this.render();
      });
      picker.append(select);
    } else {
      picker.append(el("span", "yasgui-sa__name", source.label));
    }
    const format = FORMAT_LABELS[source.format];
    if (format) picker.append(el("span", "yasgui-sa__badge", format));
    header.append(picker);

    const meta = el("div", "yasgui-sa__meta");
    const options = Object.keys(source.options)
      .filter((name) => !["location", "content"].includes(name))
      .map((name) => `${name}=${source.options[name]}`)
      .join(", ");
    if (state?.status === "done") {
      meta.append(el("span", "yasgui-sa__dot ok"), el("span", undefined, `Loaded ${ago(state.fetchedAt)}`));
    } else if (state?.status === "error") {
      meta.append(el("span", "yasgui-sa__dot error"), el("span", undefined, "Could not load"));
    } else if (state?.status === "loading") {
      meta.append(el("span", "yasgui-sa__dot busy"), el("span", undefined, "Loading…"));
    } else {
      meta.append(el("span", "yasgui-sa__dot"), el("span", undefined, "Not loaded"));
    }
    if (options) {
      const optionsEl = el("span", "yasgui-sa__options", options);
      optionsEl.title = options;
      meta.append(optionsEl);
    }
    if (state && state.status !== "loading") {
      const reload = iconButton("refresh", "Reload the structure", { className: "yasgui-sa__iconButton", size: 14 });
      reload.addEventListener("click", () => void this.support.load(tab, source));
      meta.append(reload);
    }
    header.append(meta);

    if (state?.status === "done") {
      const tabs = el("div", "yasgui-sa__tabs");
      tabs.setAttribute("role", "tablist");
      for (const view of SUB_VIEWS) {
        const b = button(view.label, "yasgui-sa__tab");
        b.setAttribute("role", "tab");
        b.setAttribute("aria-selected", String(view.id === this.subView));
        b.addEventListener("click", () => {
          this.subView = view.id;
          this.render();
        });
        tabs.append(b);
      }
      header.append(tabs);
    }
    return header;
  }

  private drawLoad(tab: Tab, source: SparqlAnythingSource): HTMLElement {
    const box = el("div", "yasgui-sa__intro");
    box.append(
      el(
        "p",
        undefined,
        `Load the structure of ${source.label} to get its ${
          source.format === "csv" ? "columns" : source.format === "xml" ? "elements and attributes" : "keys"
        } in autocompletion, a preview, and a query builder.`,
      ),
      el(
        "p",
        "yasgui-sa__hint",
        "MatGUI sends a query with this SERVICE block to the endpoint, which reads the whole source once.",
      ),
    );
    const load = button("Load structure", "yasgui-sa__button primary");
    load.addEventListener("click", () => void this.support.load(tab, source));
    box.append(load);
    return box;
  }

  private drawLoading(tab: Tab, source: SparqlAnythingSource): HTMLElement {
    const box = el("div", "yasgui-sa__intro");
    const line = el("p", "yasgui-sa__loading");
    line.append(iconElement("loader", 14), ` Reading ${source.label} on the endpoint…`);
    const cancel = button("Cancel", "yasgui-sa__button");
    cancel.addEventListener("click", () => this.support.cancel(tab, source));
    box.append(line, cancel);
    return box;
  }

  private drawError(tab: Tab, source: SparqlAnythingSource, state: SourceState): HTMLElement {
    const box = el("div", "yasgui-sa__intro");
    box.append(el("p", "yasgui-sa__error", state.error || "The query failed"));
    const retry = button("Retry", "yasgui-sa__button primary");
    retry.addEventListener("click", () => void this.support.load(tab, source));
    box.append(retry);
    if (state.query) box.append(this.openQueryLink(tab, state.query, "Open the structure query in a new tab"));
    return box;
  }

  private openQueryLink(tab: Tab, query: string, label: string): HTMLButtonElement {
    const link = button(label, "yasgui-sa__link");
    link.addEventListener("click", () => this.openInNewTab(tab, query));
    return link;
  }

  private openInNewTab(tab: Tab, query: string) {
    const newTab = this.yasgui.addTab(true, {
      requestConfig: { ...tab.getRequestConfig(), endpoint: tab.getEndpoint() },
    });
    newTab.setQuery(query);
  }

  /** Label of a node in the tree */
  private nodeLabel(node: StructureNode, prefixes: { [prefix: string]: string }): { text: string; tag?: string } {
    const hasSlots = node.children.some((c) => c.step === SLOT);
    const hasKeys = node.children.some((c) => c.step !== SLOT);
    if (!node.parent) return { text: node.type ? writeIri(node.type, prefixes) : "root", tag: "document" };
    if (node.kind === "literal") {
      if (node.step === SLOT) return { text: node.parent.type ? "text" : "values", tag: "rdf:_n" };
      return { text: writeIri(node.step!, prefixes) };
    }
    if (node.type) return { text: writeIri(node.type, prefixes), tag: "element" };
    if (node.step === SLOT) {
      if (!node.parent.parent && hasKeys && !hasSlots)
        return { text: "rows", tag: node.count > 1 ? `rdf:_1 … rdf:_${node.count}` : "rdf:_1" };
      return { text: "items", tag: hasSlots && !hasKeys ? "array" : "object" };
    }
    return { text: writeIri(node.step!, prefixes), tag: hasSlots && !hasKeys ? "array" : "object" };
  }

  private drawTree(
    tree: StructureNode[],
    prefixes: { [prefix: string]: string },
    decorate: (row: HTMLElement, node: StructureNode) => void,
    showExamples = true,
  ): HTMLElement {
    const list = el("div", "yasgui-sa__tree");
    list.setAttribute("role", "tree");
    const draw = (nodes: StructureNode[], depth: number) => {
      for (const node of nodes) {
        const key = stableKey(node);
        const row = el("div", `yasgui-sa__node ${node.kind}`);
        row.setAttribute("role", "treeitem");
        row.style.setProperty("--depth", String(depth));
        const caret = el("span", "yasgui-sa__caret");
        if (node.children.length) {
          const open = !this.collapsed.has(key);
          row.setAttribute("aria-expanded", String(open));
          caret.append(iconElement(open ? "chevronDown" : "chevronRight", 12));
          caret.addEventListener("click", (event) => {
            event.stopPropagation();
            if (open) this.collapsed.add(key);
            else this.collapsed.delete(key);
            this.render();
          });
        }
        row.append(caret);
        decorate(row, node);
        const label = this.nodeLabel(node, prefixes);
        row.append(el("span", `yasgui-sa__term ${node.kind === "node" && !node.type ? "structural" : ""}`, label.text));
        if (label.tag) row.append(el("span", "yasgui-sa__tag", label.tag));
        row.append(el("span", "yasgui-sa__count", node.count.toLocaleString()));
        if (showExamples && node.kind === "literal" && node.example !== undefined) {
          const example = el("span", "yasgui-sa__example", JSON.stringify(node.example));
          example.title = node.example;
          row.append(example);
        }
        list.append(row);
        if (node.children.length && !this.collapsed.has(key)) draw(node.children, depth + 1);
      }
    };
    draw(tree, 0);
    return list;
  }

  private drawStructure(tab: Tab, source: SparqlAnythingSource, state: SourceState, tree: StructureNode[]) {
    const wrapper = el("div", "yasgui-sa__section");
    const yasqe = tab.getYasqe();
    const prefixes = builderPrefixes(source, yasqe?.getPrefixesFromQuery() || {});
    if (!tree.length) {
      wrapper.append(el("p", "yasgui-sa__message", "The source produced no triples."));
    } else {
      wrapper.append(el("p", "yasgui-sa__hint", "Click a property or element to insert it at the cursor."));
      wrapper.append(
        this.drawTree(tree, prefixes, (row, node) => {
          const term = node.kind === "node" && node.type && node.parent ? node.type : node.step;
          if (!term || term === SLOT || !node.parent) return;
          row.classList.add("insertable");
          row.tabIndex = 0;
          const insert = () => {
            if (!yasqe) return;
            const used: { [prefix: string]: string } = {};
            const text = writeIri(term, prefixes, used);
            yasqe.replaceSelection(text);
            yasqe.addPrefixes(used);
            yasqe.focus();
          };
          row.title = `Insert ${writeIri(term, prefixes)}`;
          row.addEventListener("click", insert);
          row.addEventListener("keydown", (event) => {
            if (event.key === "Enter") insert();
          });
        }),
      );
    }
    const footer = el("div", "yasgui-sa__footer");
    if (state.durationMs !== undefined)
      footer.append(el("span", undefined, `Structure query took ${(state.durationMs / 1000).toFixed(1)} s`));
    if (state.query) footer.append(this.openQueryLink(tab, state.query, "Show query"));
    wrapper.append(footer);
    return wrapper;
  }

  private drawPreview(tab: Tab, source: SparqlAnythingSource, state: SourceState) {
    const wrapper = el("div", "yasgui-sa__section");
    const preview = state.preview;
    if (!preview) {
      void this.support.loadPreview(tab, source);
    }
    if (!preview || preview.status === "loading") {
      const line = el("p", "yasgui-sa__loading");
      line.append(iconElement("loader", 14), ` Fetching the first ${PREVIEW_LIMIT} triples…`);
      wrapper.append(line);
      return wrapper;
    }
    if (preview.status === "error") {
      wrapper.append(el("p", "yasgui-sa__error", preview.error || "The query failed"));
      const retry = button("Retry", "yasgui-sa__button");
      retry.addEventListener("click", () => {
        state.preview = undefined;
        this.render();
      });
      wrapper.append(retry);
      return wrapper;
    }
    wrapper.append(el("p", "yasgui-sa__hint", `First ${PREVIEW_LIMIT} triples, as the endpoint returns them.`));
    const pre = el("pre", "yasgui-sa__code");
    pre.append(highlightTurtle(preview.text || ""));
    wrapper.append(pre);
    const footer = el("div", "yasgui-sa__footer");
    const copy = button("Copy", "yasgui-sa__link");
    copy.addEventListener("click", () => {
      void navigator.clipboard?.writeText(preview.text || "").then(() => (copy.textContent = "Copied"));
    });
    const reload = button("Reload", "yasgui-sa__link");
    reload.addEventListener("click", () => {
      state.preview = undefined;
      this.render();
    });
    footer.append(
      copy,
      reload,
      this.openQueryLink(tab, previewQuery(source, tab.getYasqe()?.getPrefixesFromQuery() || {}), "Open as query"),
    );
    wrapper.append(footer);
    return wrapper;
  }

  private drawBuilder(tab: Tab, source: SparqlAnythingSource, tree: StructureNode[]) {
    const wrapper = el("div", "yasgui-sa__section");
    const yasqe = tab.getYasqe();
    const queryPrefixes = yasqe?.getPrefixesFromQuery() || {};
    const prefixes = builderPrefixes(source, queryPrefixes);
    const nodesByKey = new Map<string, StructureNode>();
    walk(tree, (node) => nodesByKey.set(stableKey(node), node));
    const picks = (this.picked.get(source.key) || []).filter((p) => nodesByKey.has(p.key));
    this.picked.set(source.key, picks);
    const setPicks = (next: { key: string; optional: boolean }[]) => {
      this.picked.set(source.key, next);
      this.render();
    };

    // Every value of the source, in tree order, for "All values"
    const values: string[] = [];
    walk(tree, (node) => {
      if (node.kind === "literal") values.push(stableKey(node));
    });
    const pickedValues: PickedValue[] = picks.map((p) => ({ node: nodesByKey.get(p.key)!, optional: p.optional }));
    const built = pickedValues.length ? buildPatterns(pickedValues, source, queryPrefixes) : undefined;

    // The actions stay on top, so they're in reach without scrolling past a long tree
    const toolbar = el("div", "yasgui-sa__actions top");
    const allLabel = el("label", "yasgui-sa__all");
    const all = el("input", "yasgui-sa__check");
    all.type = "checkbox";
    all.checked = values.length > 0 && picks.length === values.length;
    all.indeterminate = picks.length > 0 && picks.length < values.length;
    all.disabled = !values.length;
    all.addEventListener("change", () => {
      if (!all.checked) return setPicks([]);
      // Keep what's picked; like ticking one by one, the first value is required and later ones optional
      const next = [...picks];
      for (const key of values) {
        if (!next.some((p) => p.key === key)) next.push({ key, optional: next.some((p) => !p.optional) });
      }
      setPicks(next);
    });
    allLabel.title = "Select all values, or clear the selection";
    allLabel.append(all, el("span", undefined, picks.length ? `${picks.length} of ${values.length}` : "All values"));
    toolbar.append(allLabel);

    const replace = button(
      "Replace block",
      "yasgui-sa__button primary",
      "Replace the content of the SERVICE block (Ctrl+Z undoes it)",
    );
    replace.addEventListener("click", () => {
      if (!yasqe || !built) return;
      const current = yasqe.getSparqlAnythingSources().find((s) => s.key === source.key);
      if (!current || current.closeBrace === undefined) return;
      const doc = yasqe.getDoc();
      const lineStart = doc.posFromIndex(current.from);
      const indent = (doc.getLine(lineStart.line).match(/^\s*/) || [""])[0];
      const fxPrefix = Object.keys(prefixes).find((p) => prefixes[p] === FX)!;
      const used = { ...built.prefixes };
      const body: string[] = [];
      if (current.optionTriples.length) {
        used[fxPrefix] = FX;
        body.push(
          `${fxPrefix}:properties ` +
            current.optionTriples
              .map((t) => `${fxPrefix}:${t.name} ${t.raw}`)
              .join(` ;\n${indent}  ${" ".repeat(fxPrefix.length + 12)}`) +
            " .",
        );
      }
      body.push(...built.lines);
      const text = "\n" + body.map((line) => `${indent}  ${line}`).join("\n") + `\n${indent}`;
      doc.replaceRange(text, doc.posFromIndex(current.openBrace + 1), doc.posFromIndex(current.closeBrace));
      yasqe.addPrefixes(used);
      yasqe.focus();
    });
    const insert = button("Insert at cursor", "yasgui-sa__button", "Insert the patterns at the cursor");
    insert.addEventListener("click", () => {
      if (!yasqe || !built) return;
      yasqe.replaceSelection(built.lines.join("\n"));
      yasqe.addPrefixes(built.prefixes);
      yasqe.focus();
    });
    const newTab = button("New tab", "yasgui-sa__button", "Open a SELECT query for these values in a new tab");
    newTab.addEventListener("click", () => {
      if (built) this.openInNewTab(tab, buildQuery(pickedValues, source, queryPrefixes));
    });
    for (const action of [replace, insert, newTab]) action.disabled = !built;
    toolbar.append(replace, insert, newTab);
    wrapper.append(toolbar);
    wrapper.append(el("p", "yasgui-sa__hint", "Tick the values you need. Rows and array items become fx:anySlot."));

    wrapper.append(
      this.drawTree(
        tree,
        prefixes,
        (row, node) => {
          if (node.kind !== "literal") return;
          const key = stableKey(node);
          const pick = picks.find((p) => p.key === key);
          const checkbox = el("input", "yasgui-sa__check");
          checkbox.type = "checkbox";
          checkbox.checked = !!pick;
          checkbox.setAttribute("aria-label", "Use this value");
          checkbox.addEventListener("change", () => {
            if (checkbox.checked) setPicks([...picks, { key, optional: picks.some((p) => !p.optional) }]);
            else setPicks(picks.filter((p) => p.key !== key));
          });
          row.append(checkbox);
          row.classList.add("pickable");
          if (pick) {
            const toggle = button(
              pick.optional ? "optional" : "required",
              `yasgui-sa__pill ${pick.optional ? "on" : ""}`,
            );
            toggle.title = pick.optional ? "Rows without this value are kept" : "Rows without this value are left out";
            toggle.addEventListener("click", (event) => {
              event.stopPropagation();
              setPicks(picks.map((p) => (p.key === key ? { ...p, optional: !p.optional } : p)));
            });
            // Placed after the label by CSS order
            toggle.style.order = "5";
            row.append(toggle);
          }
          row.addEventListener("click", (event) => {
            if (event.target === checkbox || (event.target as HTMLElement).closest(".yasgui-sa__caret")) return;
            checkbox.checked = !checkbox.checked;
            checkbox.dispatchEvent(new Event("change"));
          });
          // The examples are in the Structure tab; here the room goes to the names
        },
        false,
      ),
    );

    if (built) {
      const pre = el("pre", "yasgui-sa__code");
      pre.textContent = built.lines.join("\n");
      wrapper.append(pre);
    }
    return wrapper;
  }

  public destroy() {
    clearTimeout(this.renderTimer);
    this.rootEl.remove();
  }
}
