import { addClass, removeClass, Storage as YStorage } from "@matdata/yasgui-utils";
import { Parser } from "@matdata/yasr";
import type { Yasgui } from "../";
import type Tab from "../Tab";
import { storageNamespace } from "../PersistentConfig";
import DescribeStore, { DescribeResult, StoredDescribeState } from "./DescribeStore";
import {
  buildQuery,
  COMMON_PREFIXES,
  DEFAULT_PAGE_SIZE,
  defaultCategories,
  defaultDescribeQueries,
  DescribeBinding,
  DescribeCategory,
  DescribeQuery,
  DescribeTable,
} from "./describeQueries";
import { EndpointMetadata, fetchEndpointMetadata, VoidDataset } from "./metadataSources";
import { describeQueryError, isPartialResponse } from "./responseUtils";
import "./EndpointDescribePanel.scss";

export interface EndpointDescribeConfig {
  /** Show the "Describe endpoint" button and panel */
  enabled: boolean;
  /** Replace or extend the default describe queries */
  queries?: DescribeQuery[] | ((defaults: DescribeQuery[]) => DescribeQuery[]);
  /** Replace or extend the default categories */
  categories?: DescribeCategory[] | ((defaults: DescribeCategory[]) => DescribeCategory[]);
  /** Timeout of a single describe query, in milliseconds */
  timeoutMs: number;
  /** Maximum number of describe queries running at the same time */
  maxConcurrentQueries: number;
  /** Automatically fetch the SPARQL service description and VoID description when the panel opens */
  fetchMetadata: boolean;
}

export const defaultEndpointDescribeConfig: EndpointDescribeConfig = {
  enabled: true,
  timeoutMs: 60000,
  maxConcurrentQueries: 2,
  fetchMetadata: true,
};

const MIN_WIDTH = 280;
const SPARQL_JSON = "application/sparql-results+json,application/sparql-results+xml;q=0.8";

interface RunningQuery {
  controller: AbortController;
  timedOut: boolean;
}

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

function iconButton(icon: string, title: string, className = ""): HTMLButtonElement {
  const button = el("button", `yasgui-describe__icon-button ${className}`.trim());
  button.type = "button";
  button.title = title;
  button.setAttribute("aria-label", title);
  button.innerHTML = `<i class="fas ${icon}" aria-hidden="true"></i>`;
  return button;
}

export function formatRelativeTime(timestamp: number, now = Date.now()): string {
  const seconds = Math.max(0, Math.round((now - timestamp) / 1000));
  if (seconds < 60) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours} h ago`;
  return `${Math.round(hours / 24)} days ago`;
}

function formatNumber(value: number | undefined): string {
  return value === undefined ? "–" : value.toLocaleString();
}

export default class EndpointDescribePanel {
  private yasgui: Yasgui;
  private store: DescribeStore;
  private config: EndpointDescribeConfig;
  private queries: DescribeQuery[];
  private categories: DescribeCategory[];

  private rootEl: HTMLDivElement;
  private resizerEl!: HTMLDivElement;
  private railEl!: HTMLButtonElement;
  private drawerEl!: HTMLDivElement;
  private endpointEl!: HTMLDivElement;
  private pinButton!: HTMLButtonElement;
  private metadataEl!: HTMLDivElement;
  private queryEls = new Map<string, HTMLElement>();

  private endpoint: string | undefined;
  private running = new Map<string, RunningQuery>();
  private queue: Array<{ key: string; start: () => Promise<void>; cancel: () => void }> = [];
  private activeCount = 0;
  private metadataController: AbortController | undefined;
  private renderedEndpoint: string | undefined | null = null;

  constructor(yasgui: Yasgui) {
    this.yasgui = yasgui;
    this.config = { ...defaultEndpointDescribeConfig, ...(yasgui.config.endpointDescribe || {}) };
    this.queries =
      typeof this.config.queries === "function"
        ? this.config.queries(defaultDescribeQueries)
        : this.config.queries || defaultDescribeQueries;
    this.categories =
      typeof this.config.categories === "function"
        ? this.config.categories(defaultCategories)
        : this.config.categories || defaultCategories;

    const storageId = yasgui.getStorageId("endpointDescribe");
    const storage = new YStorage(storageNamespace);
    this.store = new DescribeStore(
      storageId
        ? {
            get: () => storage.get<StoredDescribeState>(storageId),
            set: (state) =>
              storage.set(storageId, state, yasgui.config.persistencyExpire, () => {
                // Quota exceeded: drop the cache instead of the whole Matgui configuration
                storage.remove(storageId);
              }),
          }
        : undefined,
    );

    this.rootEl = el("div", "yasgui-describe");
    this.rootEl.setAttribute("role", "complementary");
    this.rootEl.setAttribute("aria-label", "Endpoint overview");
    this.draw();
    this.registerListeners();

    const ui = this.store.getUiState();
    // Only a pinned panel is restored on load
    if (ui.pinned && ui.open) this.open();
    else this.applyState(false);
  }

  public getElement(): HTMLDivElement {
    return this.rootEl;
  }

  public isOpen(): boolean {
    return this.store.getUiState().open;
  }

  public open() {
    this.store.setUiState({ open: true, collapsed: false });
    this.applyState();
    this.syncEndpoint();
  }

  public close() {
    this.store.setUiState({ open: false });
    this.applyState();
  }

  public toggle() {
    const ui = this.store.getUiState();
    if (ui.open && !ui.collapsed) this.close();
    else this.open();
  }

  public collapse() {
    this.store.setUiState({ collapsed: true });
    this.applyState();
  }

  public setPinned(pinned: boolean) {
    this.store.setUiState({ pinned });
    this.applyState(false);
  }

  /**
   * Run a describe query for the current endpoint.
   * @param loadMore fetch the next page and append it to the existing rows
   */
  public runQuery(queryId: string, loadMore = false): Promise<void> {
    const query = this.queries.find((q) => q.id === queryId);
    const tab = this.yasgui.getTab();
    // The panel may be closed, so make sure the endpoint of the active tab is used
    this.syncEndpoint(tab);
    const endpoint = this.endpoint;
    if (!query || !tab || !endpoint) return Promise.resolve();
    const key = `${endpoint}\n${queryId}`;
    if (this.running.has(key)) return Promise.resolve();

    const running: RunningQuery = { controller: new AbortController(), timedOut: false };
    this.running.set(key, running);
    this.renderQuery(queryId);

    return new Promise<void>((resolve) => {
      const finish = () => {
        this.running.delete(key);
        if (this.endpoint === endpoint) this.renderQuery(queryId);
        resolve();
      };
      this.enqueue(
        key,
        async () => {
          try {
            await this.executeQuery(tab, endpoint, query, running, loadMore);
          } finally {
            finish();
          }
        },
        finish,
      );
    });
  }

  public cancelQuery(queryId: string) {
    if (!this.endpoint) return;
    const key = `${this.endpoint}\n${queryId}`;
    const running = this.running.get(key);
    if (running) running.controller.abort();
    const queued = this.queue.findIndex((item) => item.key === key);
    if (queued >= 0) this.queue.splice(queued, 1)[0].cancel();
  }

  public runCategory(categoryId: string) {
    for (const query of this.queries.filter((q) => q.category === categoryId)) {
      void this.runQuery(query.id);
    }
  }

  public refreshMetadata() {
    if (!this.endpoint) return;
    void this.loadMetadata(this.endpoint, true);
  }

  /**
   * Called when the active tab or its endpoint may have changed
   */
  public syncEndpoint(tab: Tab | undefined = this.yasgui.getTab()) {
    const endpoint = tab?.getEndpoint() || undefined;
    this.endpoint = endpoint;
    if (!this.isOpen() || endpoint === this.renderedEndpoint) return;
    this.renderedEndpoint = endpoint;
    if (endpoint) this.store.touch(endpoint);
    this.endpointEl.textContent = endpoint || "No endpoint selected";
    this.endpointEl.title = endpoint || "";
    this.renderMetadata();
    for (const query of this.queries) this.renderQuery(query.id);
    if (endpoint && this.config.fetchMetadata && !this.store.getMetadata(endpoint)) {
      void this.loadMetadata(endpoint, false);
    }
  }

  private registerListeners() {
    this.yasgui.on("tabSelect", (_yasgui, tabId) => this.syncEndpoint(this.yasgui.getTab(tabId)));
    // Endpoint changes are persisted through a tab change
    this.yasgui.on("tabChange", (_yasgui, tab) => {
      if (tab === this.yasgui.getTab() && tab.getEndpoint() !== this.endpoint) this.syncEndpoint(tab);
    });
    // An unpinned panel moves out of the way when the user starts writing a query
    this.yasgui.tabPanelsEl.addEventListener("focusin", (event) => {
      const ui = this.store.getUiState();
      if (!ui.open || ui.pinned || ui.collapsed) return;
      const target = event.target as HTMLElement | null;
      if (target && target.closest && target.closest(".yasqe")) this.collapse();
    });
  }

  private applyState(refreshTab = true) {
    const ui = this.store.getUiState();
    this.rootEl.classList.toggle("open", ui.open);
    this.rootEl.classList.toggle("collapsed", ui.open && ui.collapsed);
    this.rootEl.classList.toggle("pinned", ui.pinned);
    this.drawerEl.style.width = `${Math.max(MIN_WIDTH, ui.width)}px`;
    this.pinButton.setAttribute("aria-pressed", String(ui.pinned));
    this.pinButton.title = ui.pinned ? "Unpin panel" : "Pin panel (keep it open)";
    if (refreshTab) this.refreshActiveTab();
  }

  private refreshActiveTab() {
    const tab = this.yasgui.getTab();
    if (!tab) return;
    tab.getYasqe()?.refresh();
    tab.getYasr()?.refresh();
  }

  /**
   * Drawing
   */
  private draw() {
    this.resizerEl = el("div", "yasgui-describe__resizer");
    this.resizerEl.title = "Drag to resize";
    this.resizerEl.addEventListener("mousedown", this.startResize);
    this.rootEl.appendChild(this.resizerEl);

    this.railEl = el("button", "yasgui-describe__rail");
    this.railEl.type = "button";
    this.railEl.title = "Show endpoint overview";
    this.railEl.innerHTML = '<i class="fas fa-angles-left" aria-hidden="true"></i><span>Endpoint overview</span>';
    this.railEl.addEventListener("click", () => this.open());
    this.rootEl.appendChild(this.railEl);

    this.drawerEl = el("div", "yasgui-describe__drawer");
    this.rootEl.appendChild(this.drawerEl);

    const header = el("div", "yasgui-describe__header");
    const headerTop = el("div", "yasgui-describe__header-top");
    const title = el("h2", "yasgui-describe__title", "Endpoint overview");
    const buttons = el("div", "yasgui-describe__header-buttons");
    const refreshButton = iconButton("fa-rotate-right", "Reload service description and VoID");
    refreshButton.addEventListener("click", () => this.refreshMetadata());
    this.pinButton = iconButton("fa-thumbtack", "Pin panel (keep it open)", "yasgui-describe__pin");
    this.pinButton.addEventListener("click", () => this.setPinned(!this.store.getUiState().pinned));
    const collapseButton = iconButton("fa-angles-right", "Move out of the way");
    collapseButton.addEventListener("click", () => this.collapse());
    const closeButton = iconButton("fa-xmark", "Close");
    closeButton.addEventListener("click", () => this.close());
    buttons.append(refreshButton, this.pinButton, collapseButton, closeButton);
    headerTop.append(title, buttons);
    this.endpointEl = el("div", "yasgui-describe__endpoint");
    header.append(headerTop, this.endpointEl);
    this.drawerEl.appendChild(header);

    const body = el("div", "yasgui-describe__body");
    this.metadataEl = el("div", "yasgui-describe__metadata");
    body.appendChild(this.metadataEl);

    const expanded = this.store.getUiState().expandedCategories;
    for (const category of this.categories) {
      const queries = this.queries.filter((q) => q.category === category.id);
      if (queries.length === 0) continue;
      const section = el("details", "yasgui-describe__category");
      section.open = expanded.indexOf(String(category.id)) >= 0;
      section.addEventListener("toggle", () => {
        const current = this.store.getUiState().expandedCategories.filter((id) => id !== category.id);
        if (section.open) current.push(String(category.id));
        this.store.setUiState({ expandedCategories: current });
      });
      const summary = el("summary", "yasgui-describe__category-summary");
      const summaryLabel = el("span", "yasgui-describe__category-label");
      summaryLabel.innerHTML = `<i class="fas ${category.icon}" aria-hidden="true"></i>`;
      summaryLabel.appendChild(document.createTextNode(" " + category.label));
      const runAll = el("button", "yasgui-describe__run-all", "Run all");
      runAll.type = "button";
      runAll.title = `Run all queries in "${category.label}"`;
      runAll.addEventListener("click", (event) => {
        event.preventDefault();
        section.open = true;
        this.runCategory(String(category.id));
      });
      summary.append(summaryLabel, runAll);
      section.appendChild(summary);
      for (const query of queries) {
        const queryEl = el("div", "yasgui-describe__query");
        queryEl.dataset.queryId = query.id;
        this.queryEls.set(query.id, queryEl);
        section.appendChild(queryEl);
      }
      body.appendChild(section);
    }
    this.drawerEl.appendChild(body);
  }

  private renderMetadata() {
    const container = this.metadataEl;
    container.innerHTML = "";
    const endpoint = this.endpoint;
    if (!endpoint) {
      container.appendChild(el("p", "yasgui-describe__muted", "Select an endpoint to explore it."));
      return;
    }
    const metadata = this.store.getMetadata(endpoint);
    const card = el("div", "yasgui-describe__card");
    const heading = el("div", "yasgui-describe__card-heading");
    heading.appendChild(el("strong", undefined, "Service description & VoID"));
    if (metadata) heading.appendChild(el("span", "yasgui-describe__muted", formatRelativeTime(metadata.fetchedAt)));
    card.appendChild(heading);

    if (!metadata) {
      if (this.metadataController) {
        card.appendChild(el("p", "yasgui-describe__muted", "Looking for a service description and VoID…"));
      } else {
        const load = el("button", "yasgui-describe__button", "Load service description & VoID");
        load.type = "button";
        load.addEventListener("click", () => this.refreshMetadata());
        card.appendChild(load);
      }
      container.appendChild(card);
      return;
    }

    const status = el("div", "yasgui-describe__status-list");
    status.append(
      this.statusBadge("Service description", metadata.sdStatus === "ok", metadata.sdError),
      this.statusBadge("VoID", metadata.voidStatus === "ok", metadata.voidError),
    );
    card.appendChild(status);

    if (metadata.sd) {
      const sd = metadata.sd;
      const list = el("dl", "yasgui-describe__facts");
      this.addFact(list, "Languages", sd.languages);
      this.addFact(list, "Features", sd.features);
      this.addFact(list, "Extension functions", sd.extensionFunctions);
      this.addFact(list, "Extension aggregates", sd.extensionAggregates);
      this.addFact(list, "Entailment", sd.entailmentRegimes);
      this.addFact(list, "Result formats", sd.resultFormats);
      this.addFact(list, "Named graphs", sd.namedGraphs);
      if (list.childElementCount) card.appendChild(list);
    }
    for (const dataset of metadata.datasets) card.appendChild(this.renderDataset(dataset));
    if (metadata.truncated) {
      card.appendChild(
        el(
          "p",
          "yasgui-describe__muted",
          "The description is very large: only its first part was read, so some partitions may be missing.",
        ),
      );
    }
    if (metadata.sdStatus !== "ok" && metadata.voidStatus !== "ok") {
      card.appendChild(
        el(
          "p",
          "yasgui-describe__muted",
          "This endpoint does not publish a service description or VoID. Use the queries below to explore it.",
        ),
      );
    }
    container.appendChild(card);
  }

  private statusBadge(label: string, ok: boolean, error?: string): HTMLElement {
    const badge = el("span", `yasgui-describe__badge ${ok ? "ok" : "unavailable"}`);
    badge.textContent = `${label}: ${ok ? "available" : "not available"}`;
    if (!ok && error) badge.title = error;
    return badge;
  }

  private addFact(list: HTMLElement, label: string, values: string[]) {
    if (!values.length) return;
    list.appendChild(el("dt", undefined, label));
    const dd = el("dd");
    values.slice(0, 50).forEach((value, i) => {
      if (i > 0) dd.appendChild(document.createTextNode(", "));
      dd.appendChild(this.renderIri(value));
    });
    if (values.length > 50) dd.appendChild(document.createTextNode(` … (+${values.length - 50})`));
    list.appendChild(dd);
  }

  private renderDataset(dataset: VoidDataset): HTMLElement {
    const wrapper = el("div", "yasgui-describe__dataset");
    const title = el("div", "yasgui-describe__dataset-title");
    title.appendChild(el("i", "fas fa-database"));
    title.appendChild(document.createTextNode(" "));
    if (dataset.title) title.appendChild(el("strong", undefined, dataset.title + " "));
    if (!dataset.blank) title.appendChild(this.renderIri(dataset.iri));
    else if (!dataset.title) title.appendChild(el("strong", undefined, "Dataset"));
    wrapper.appendChild(title);

    const stats = el("dl", "yasgui-describe__facts yasgui-describe__facts--stats");
    const addStat = (label: string, value: number | undefined) => {
      if (value === undefined) return;
      stats.append(el("dt", undefined, label), el("dd", undefined, formatNumber(value)));
    };
    addStat("Triples", dataset.triples);
    addStat("Entities", dataset.entities);
    addStat("Classes", dataset.classes);
    addStat("Properties", dataset.properties);
    addStat("Distinct subjects", dataset.distinctSubjects);
    addStat("Distinct objects", dataset.distinctObjects);
    if (stats.childElementCount) wrapper.appendChild(stats);
    const vocabularies = el("dl", "yasgui-describe__facts");
    this.addFact(vocabularies, "Vocabularies", dataset.vocabularies);
    if (vocabularies.childElementCount) wrapper.appendChild(vocabularies);

    const partitionTable = (label: string, key: string, rows: VoidDataset["classPartitions"]) => {
      if (!rows.length) return;
      const details = el("details", "yasgui-describe__partition");
      details.appendChild(el("summary", undefined, `${label} (${rows.length}, from VoID)`));
      const table: DescribeTable = {
        vars: [key, "entities", "triples"].filter((v) => v === key || rows.some((r) => (r as any)[v] !== undefined)),
        bindings: rows.map((row) => {
          const binding: DescribeBinding = { [key]: { type: "uri", value: row.iri } };
          if (row.entities !== undefined) binding.entities = { type: "literal", value: String(row.entities) };
          if (row.triples !== undefined) binding.triples = { type: "literal", value: String(row.triples) };
          return binding;
        }),
      };
      details.appendChild(this.renderTable(table));
      wrapper.appendChild(details);
    };
    partitionTable("Classes", "class", dataset.classPartitions);
    partitionTable("Properties", "property", dataset.propertyPartitions);
    if (dataset.linksets.length) {
      const list = el("dl", "yasgui-describe__facts");
      this.addFact(
        list,
        "Linksets",
        dataset.linksets.map((l) => l.target || l.iri),
      );
      wrapper.appendChild(list);
    }
    return wrapper;
  }

  private renderQuery(queryId: string) {
    const container = this.queryEls.get(queryId);
    const query = this.queries.find((q) => q.id === queryId);
    if (!container || !query) return;
    container.innerHTML = "";
    const endpoint = this.endpoint;
    const running = endpoint ? this.running.has(`${endpoint}\n${queryId}`) : false;
    const result = endpoint ? this.store.getResult(endpoint, queryId) : undefined;

    const header = el("div", "yasgui-describe__query-header");
    const label = el("div", "yasgui-describe__query-label");
    label.appendChild(el("span", undefined, query.label));
    if (query.expensive) {
      const badge = el("span", "yasgui-describe__slow", "may be slow");
      badge.title = "This query scans the whole dataset and may be slow or time out on large endpoints";
      label.appendChild(badge);
    }
    header.appendChild(label);

    const actions = el("div", "yasgui-describe__query-actions");
    if (running) {
      const cancel = iconButton("fa-stop", "Cancel");
      cancel.addEventListener("click", () => this.cancelQuery(queryId));
      actions.appendChild(cancel);
    } else {
      const run = iconButton(result ? "fa-rotate-right" : "fa-play", result ? "Run again" : "Run");
      run.disabled = !endpoint;
      run.addEventListener("click", () => void this.runQuery(queryId));
      actions.appendChild(run);
    }
    const openInTab = iconButton("fa-arrow-up-right-from-square", "Open query in a new tab");
    openInTab.disabled = !endpoint;
    openInTab.addEventListener("click", () => this.openInNewTab(query));
    actions.appendChild(openInTab);
    header.appendChild(actions);
    container.appendChild(header);

    if (query.description) container.appendChild(el("div", "yasgui-describe__query-description", query.description));

    if (running) {
      container.appendChild(el("div", "yasgui-describe__loading", "Running…"));
    }
    if (!result) return;

    const meta: string[] = [`fetched ${formatRelativeTime(result.fetchedAt)}`];
    if (result.durationMs !== undefined) meta.push(`${result.durationMs.toLocaleString()} ms`);
    if (result.status === "done") meta.push(`${result.bindings.length.toLocaleString()} rows`);
    if (result.truncated) meta.push("truncated");
    container.appendChild(el("div", "yasgui-describe__query-meta", meta.join(" · ")));
    if (result.partial) {
      const warning = el(
        "div",
        "yasgui-describe__partial",
        "Partial result: the endpoint stopped this query at its time limit. Counts and lists may be incomplete, and an empty result does not mean there is no such data.",
      );
      container.appendChild(warning);
    }

    if (result.error || result.status === "error") {
      container.appendChild(el("div", "yasgui-describe__error", result.error || "Query failed"));
    }
    if (result.status === "error") return;
    if (result.bindings.length === 0) {
      container.appendChild(el("div", "yasgui-describe__muted", "No results"));
      return;
    }
    container.appendChild(this.renderTable(result));
    if (query.paginated && result.hasMore && !running) {
      const more = el("button", "yasgui-describe__button", "Load more");
      more.type = "button";
      more.addEventListener("click", () => void this.runQuery(queryId, true));
      container.appendChild(more);
    }
  }

  private renderTable(table: DescribeTable): HTMLElement {
    const wrapper = el("div", "yasgui-describe__table-wrapper");
    const tableEl = el("table", "yasgui-describe__table");
    const thead = el("thead");
    const headRow = el("tr");
    for (const variable of table.vars) headRow.appendChild(el("th", undefined, variable));
    thead.appendChild(headRow);
    const tbody = el("tbody");
    for (const binding of table.bindings) {
      const row = el("tr");
      for (const variable of table.vars) {
        const cell = el("td");
        const term = binding[variable];
        if (term) cell.appendChild(this.renderTerm(term));
        row.appendChild(cell);
      }
      tbody.appendChild(row);
    }
    tableEl.append(thead, tbody);
    wrapper.appendChild(tableEl);
    return wrapper;
  }

  private renderTerm(term: DescribeBinding[string]): Node {
    if (term.type === "uri") return this.renderIri(term.value);
    if (term.type === "bnode") return document.createTextNode(`_:${term.value}`);
    const value = term.value;
    const span = el("span", "yasgui-describe__literal");
    span.textContent = /^-?\d{4,}$/.test(value) ? Number(value).toLocaleString() : value;
    if (term["xml:lang"]) span.appendChild(el("span", "yasgui-describe__lang", `@${term["xml:lang"]}`));
    return span;
  }

  private renderIri(iri: string): HTMLElement {
    const shortened = this.shortenIri(iri);
    const button = el("button", "yasgui-describe__iri", shortened ? shortened.prefixed : iri);
    button.type = "button";
    button.title = `${iri}\nClick to insert into the query`;
    button.addEventListener("click", () => this.insertIntoEditor(iri));
    return button;
  }

  /**
   * Prefix handling
   */
  private getPrefixes(): { [prefix: string]: string } {
    const prefixes: { [prefix: string]: string } = { ...COMMON_PREFIXES };
    // Saved prefixes (Settings > Prefixes)
    const saved = this.yasgui.persistentConfig.getPrefixes() || "";
    for (const line of saved.split("\n")) {
      const match = line.trim().match(/^PREFIX\s+(\w[\w.-]*|):\s*<([^>]+)>/i);
      if (match) prefixes[match[1]] = match[2];
    }
    // Prefixes declared in the current query take precedence
    const fromQuery = this.yasgui.getTab()?.getYasqe()?.getPrefixesFromQuery() || {};
    return { ...prefixes, ...fromQuery };
  }

  public shortenIri(iri: string): { prefixed: string; prefix: string; namespace: string } | undefined {
    const localPart = (namespace: string) => iri.substring(namespace.length);
    const isValidLocal = (local: string) => /^[\w-]*$/.test(local) && !/^-/.test(local);
    let best: { prefix: string; namespace: string } | undefined;
    for (const [prefix, namespace] of Object.entries(this.getPrefixes())) {
      if (iri.startsWith(namespace) && isValidLocal(localPart(namespace))) {
        if (!best || namespace.length > best.namespace.length) best = { prefix, namespace };
      }
    }
    if (!best) return undefined;
    return { ...best, prefixed: `${best.prefix}:${localPart(best.namespace)}` };
  }

  private insertIntoEditor(iri: string) {
    const yasqe = this.yasgui.getTab()?.getYasqe();
    if (!yasqe) return;
    const shortened = this.shortenIri(iri);
    if (shortened) {
      const declared = yasqe.getPrefixesFromQuery();
      if (declared[shortened.prefix] === undefined) {
        yasqe.addPrefixes({ [shortened.prefix]: shortened.namespace });
      } else if (declared[shortened.prefix] !== shortened.namespace) {
        yasqe.replaceSelection(`<${iri}>`);
        return;
      }
      yasqe.replaceSelection(shortened.prefixed);
    } else {
      yasqe.replaceSelection(`<${iri}>`);
    }
  }

  private openInNewTab(query: DescribeQuery) {
    const endpoint = this.endpoint;
    if (!endpoint) return;
    const queryString = buildQuery(query, {
      limit: query.pageSize || DEFAULT_PAGE_SIZE,
      offset: 0,
      getResult: (id) => this.store.getResult(endpoint, id),
    });
    const tab = this.yasgui.addTab(true, {
      name: this.yasgui.createTabName(query.label),
      requestConfig: { endpoint },
    } as any);
    tab.setQuery(queryString);
  }

  /**
   * Query execution
   */
  private enqueue(key: string, start: () => Promise<void>, cancel: () => void) {
    this.queue.push({ key, start, cancel });
    this.drainQueue();
  }

  private drainQueue() {
    while (this.activeCount < Math.max(1, this.config.maxConcurrentQueries) && this.queue.length) {
      const item = this.queue.shift()!;
      this.activeCount++;
      void item.start().finally(() => {
        this.activeCount--;
        this.drainQueue();
      });
    }
  }

  private async executeQuery(
    tab: Tab,
    endpoint: string,
    query: DescribeQuery,
    running: RunningQuery,
    loadMore: boolean,
  ): Promise<void> {
    if (query.dependsOn && !this.store.getResult(endpoint, query.dependsOn)) {
      // Run the dependency within this slot, so it can't deadlock on the concurrency limit
      const dependency = this.queries.find((q) => q.id === query.dependsOn);
      if (dependency) {
        await this.executeQuery(tab, endpoint, dependency, running, false);
        if (this.endpoint === endpoint) this.renderQuery(dependency.id);
      }
    }
    if (running.controller.signal.aborted) return;

    const pageSize = query.pageSize || DEFAULT_PAGE_SIZE;
    const previous = this.store.getResult(endpoint, query.id);
    const offset = loadMore && previous?.status === "done" ? previous.bindings.length : 0;
    const queryString = buildQuery(query, {
      limit: pageSize,
      offset,
      getResult: (id) => this.store.getResult(endpoint, id),
    });

    const timeout = setTimeout(() => {
      running.timedOut = true;
      running.controller.abort();
    }, this.config.timeoutMs);
    const start = Date.now();
    try {
      const response = await tab.runBackgroundQuery(queryString, {
        accept: SPARQL_JSON,
        signal: running.controller.signal,
        skipGraphArgs: true,
      });
      const parser = new Parser(response, Date.now() - start);
      if (parser.hasError()) {
        const error = parser.getError();
        throw new Error(error?.text || error?.statusText || "Query failed");
      }
      let table: DescribeTable = {
        vars: parser.getVariables(),
        bindings: (parser.getBindings() || []) as DescribeBinding[],
      };
      if (!table.vars.length && parser.getBoolean() !== undefined) {
        table = { vars: ["result"], bindings: [{ result: { type: "literal", value: String(parser.getBoolean()) } }] };
      }
      const partial = isPartialResponse(response);
      const hasMore = !!query.paginated && table.bindings.length >= pageSize;
      if (query.postProcess) table = query.postProcess(table);
      const result: DescribeResult = {
        status: "done",
        vars: table.vars,
        bindings: offset > 0 && previous ? [...previous.bindings, ...table.bindings] : table.bindings,
        fetchedAt: Date.now(),
        durationMs: Date.now() - start,
        hasMore,
        partial: partial || undefined,
      };
      this.store.setResult(endpoint, query.id, result);
    } catch (e: any) {
      if (running.controller.signal.aborted && !running.timedOut) return; // Cancelled by the user
      const message = describeQueryError(e, { timedOut: running.timedOut, timeoutMs: this.config.timeoutMs });
      // Keep the rows that were already loaded when loading another page fails
      this.store.setResult(endpoint, query.id, {
        ...(offset > 0 && previous ? previous : { vars: [], bindings: [] }),
        status: offset > 0 && previous ? previous.status : "error",
        error: message,
        fetchedAt: Date.now(),
        durationMs: Date.now() - start,
        hasMore: false,
      });
    } finally {
      clearTimeout(timeout);
    }
  }

  private async loadMetadata(endpoint: string, force: boolean) {
    if (!force && this.store.getMetadata(endpoint)) return;
    this.metadataController?.abort();
    const controller = new AbortController();
    this.metadataController = controller;
    this.renderMetadata();
    const timeout = setTimeout(() => controller.abort(), Math.min(this.config.timeoutMs, 20000));
    try {
      const tab = this.yasgui.getTab();
      const init = (tab && tab.getEndpoint() === endpoint && (await tab.getRequestInit())) || {};
      const metadata: EndpointMetadata = await fetchEndpointMetadata(endpoint, { ...init, signal: controller.signal });
      this.store.setMetadata(endpoint, metadata);
    } catch (e) {
      // Superseded by a newer request: nothing to store
      if (this.metadataController === controller) {
        const message = controller.signal.aborted ? "Timed out" : e instanceof Error ? e.message : String(e);
        this.store.setMetadata(endpoint, {
          fetchedAt: Date.now(),
          sdStatus: "unavailable",
          voidStatus: "unavailable",
          datasets: [],
          sdError: message,
          voidError: message,
        });
      }
    } finally {
      clearTimeout(timeout);
      if (this.metadataController === controller) this.metadataController = undefined;
      if (this.endpoint === endpoint) this.renderMetadata();
    }
  }

  /**
   * Resizing
   */
  private startResize = (event: MouseEvent) => {
    event.preventDefault();
    addClass(this.rootEl, "resizing");
    document.documentElement.addEventListener("mousemove", this.doResize);
    document.documentElement.addEventListener("mouseup", this.stopResize);
  };

  private doResize = (event: MouseEvent) => {
    const right = this.rootEl.getBoundingClientRect().right;
    const maxWidth = Math.max(MIN_WIDTH, this.yasgui.rootEl.getBoundingClientRect().width * 0.7);
    const width = Math.min(maxWidth, Math.max(MIN_WIDTH, right - event.clientX));
    this.drawerEl.style.width = `${width}px`;
  };

  private stopResize = () => {
    removeClass(this.rootEl, "resizing");
    document.documentElement.removeEventListener("mousemove", this.doResize);
    document.documentElement.removeEventListener("mouseup", this.stopResize);
    this.store.setUiState({ width: Math.round(this.drawerEl.getBoundingClientRect().width) });
    this.refreshActiveTab();
  };

  public destroy() {
    this.metadataController?.abort();
    for (const running of this.running.values()) running.controller.abort();
    for (const item of this.queue.splice(0)) item.cancel();
    this.rootEl.remove();
  }
}
