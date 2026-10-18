import { addClass } from "@matdata/yasgui-utils";
import type { Yasgui } from "./";
import { icon, IconName, modKeyLabel } from "./icons";
import { getWorkspaceBackend } from "./queryManagement/backends/getWorkspaceBackend";
import { listManagedQueries } from "./queryManagement/listManagedQueries";
import { scorePaletteItem } from "./paletteSearch";
import { displayGroupName } from "./InsertMenu";
import "./CommandPalette.scss";

type PaletteSection = "queries" | "snippets" | "commands" | "settings";

export interface PaletteItem {
  section: PaletteSection;
  label: string;
  /** Folder of a query, or the setting group */
  detail?: string;
  /** Keyboard shortcut shown at the right */
  keys?: string;
  icon: IconName;
  /** Extra words to match on */
  keywords?: string;
  run: () => void | Promise<void>;
}

const SECTION_LABELS: Record<PaletteSection, string> = {
  queries: "Queries",
  snippets: "Snippets",
  commands: "Commands",
  settings: "Settings",
};
const MAX_QUERIES = 8;
const MAX_SNIPPETS = 8;
/** Saved queries are listed again after this long, so new and renamed queries show up */
const QUERY_CACHE_MS = 60_000;

/**
 * Search box for saved queries, commands and settings, opened with Ctrl+K (⌘K) or the search button
 * of the top bar. Typing ">" first limits the results to commands and settings.
 */
export default class CommandPalette {
  private yasgui: Yasgui;
  private overlayEl?: HTMLDivElement;
  private inputEl?: HTMLInputElement;
  private listEl?: HTMLDivElement;
  private items: PaletteItem[] = [];
  private activeIndex = 0;
  private queryItems: PaletteItem[] = [];
  private queriesLoadedAt = 0;
  private queriesLoading?: Promise<void>;
  private returnFocusEl?: HTMLElement;

  constructor(yasgui: Yasgui) {
    this.yasgui = yasgui;
    document.addEventListener("keydown", this.handleGlobalKeydown, true);
  }

  public isOpen(): boolean {
    return !!this.overlayEl && !this.overlayEl.hidden;
  }

  public toggle() {
    if (this.isOpen()) this.close();
    else this.open();
  }

  public open(initialText = "") {
    if (!this.overlayEl) this.draw();
    if (!this.overlayEl || !this.inputEl) return;
    if (document.activeElement instanceof HTMLElement) this.returnFocusEl = document.activeElement;
    this.overlayEl.hidden = false;
    this.inputEl.value = initialText;
    this.activeIndex = 0;
    this.render();
    this.inputEl.focus();
    this.loadQueries();
  }

  public close(returnFocus = true) {
    if (!this.overlayEl || this.overlayEl.hidden) return;
    this.overlayEl.hidden = true;
    if (returnFocus && this.returnFocusEl?.isConnected) this.returnFocusEl.focus();
    this.returnFocusEl = undefined;
  }

  public destroy() {
    document.removeEventListener("keydown", this.handleGlobalKeydown, true);
    this.overlayEl?.remove();
    this.overlayEl = undefined;
  }

  private handleGlobalKeydown = (event: KeyboardEvent) => {
    // Escape closes the palette wherever the focus went (the input handles it when it has the focus)
    if (event.key === "Escape" && this.isOpen() && event.target !== this.inputEl) {
      event.preventDefault();
      this.close();
      return;
    }
    if (!(event.ctrlKey || event.metaKey) || event.altKey || event.shiftKey) return;
    if (event.key.toLowerCase() !== "k") return;
    // Only for the Yasgui instance the user works in (or the only one on the page)
    const target = event.target as Node | null;
    const inside = !!target && (this.yasgui.rootEl.contains(target) || target === document.body);
    if (!inside) return;
    event.preventDefault();
    event.stopPropagation();
    this.toggle();
  };

  private draw() {
    const overlay = document.createElement("div");
    addClass(overlay, "yasgui-palette");
    overlay.hidden = true;
    overlay.addEventListener("mousedown", (event) => {
      if (event.target === overlay) this.close();
    });

    const dialog = document.createElement("div");
    addClass(dialog, "yasgui-palette__dialog");
    dialog.setAttribute("role", "dialog");
    dialog.setAttribute("aria-modal", "true");
    dialog.setAttribute("aria-label", "Search queries, commands and settings");

    const search = document.createElement("div");
    addClass(search, "yasgui-palette__search");
    search.innerHTML = icon("search", 18);
    const input = document.createElement("input");
    input.type = "text";
    input.placeholder = "Search queries, commands and settings";
    input.spellcheck = false;
    input.setAttribute("role", "combobox");
    input.setAttribute("aria-expanded", "true");
    input.setAttribute("aria-autocomplete", "list");
    input.addEventListener("input", () => {
      this.activeIndex = 0;
      this.render();
    });
    input.addEventListener("keydown", this.handleInputKeydown);
    search.appendChild(input);
    const esc = document.createElement("kbd");
    esc.textContent = "Esc";
    search.appendChild(esc);
    dialog.appendChild(search);

    const list = document.createElement("div");
    addClass(list, "yasgui-palette__list");
    list.setAttribute("role", "listbox");
    list.id = `yasgui-palette-list-${Math.random().toString(36).substring(7)}`;
    input.setAttribute("aria-controls", list.id);
    dialog.appendChild(list);

    const footer = document.createElement("div");
    addClass(footer, "yasgui-palette__footer");
    footer.innerHTML =
      "<span><kbd>↑</kbd><kbd>↓</kbd> to move</span><span><kbd>↵</kbd> to open</span>" +
      '<span class="yasgui-palette__tip">Tip: type <kbd>&gt;</kbd> for commands only</span>';
    dialog.appendChild(footer);

    overlay.appendChild(dialog);
    this.yasgui.rootEl.appendChild(overlay);
    this.overlayEl = overlay;
    this.inputEl = input;
    this.listEl = list;
  }

  private handleInputKeydown = (event: KeyboardEvent) => {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      this.close();
    } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!this.items.length) return;
      const step = event.key === "ArrowDown" ? 1 : -1;
      this.activeIndex = (this.activeIndex + step + this.items.length) % this.items.length;
      this.updateActive();
    } else if (event.key === "Enter") {
      event.preventDefault();
      const item = this.items[this.activeIndex];
      if (item) this.runItem(item);
    }
  };

  private runItem(item: PaletteItem) {
    this.close(false);
    Promise.resolve()
      .then(() => item.run())
      .catch((error) => window.alert(error?.message || String(error)));
  }

  /** List the saved queries of every workspace, at most once a minute */
  private loadQueries() {
    if (this.queriesLoading || Date.now() - this.queriesLoadedAt < QUERY_CACHE_MS) return;
    const workspaces = this.yasgui.persistentConfig.getWorkspaces() || [];
    if (!workspaces.length) {
      this.queryItems = [];
      return;
    }
    this.queriesLoading = Promise.all(
      workspaces.map(async (workspace) => {
        try {
          const backend = getWorkspaceBackend(workspace, { persistentConfig: this.yasgui.persistentConfig });
          const queries = await listManagedQueries(backend);
          return queries.map<PaletteItem>((query) => ({
            section: "queries",
            label: query.label,
            detail: [workspace.label, ...query.folders].join(" / "),
            icon: "fileText",
            run: () => this.yasgui.queryBrowser.openQuery(workspace.id, query.id, query.label),
          }));
        } catch {
          // A workspace that can't be read (offline, no access) just has no results
          return [];
        }
      }),
    )
      .then((lists) => {
        this.queryItems = lists.flat();
        this.queriesLoadedAt = Date.now();
      })
      .finally(() => {
        this.queriesLoading = undefined;
        if (this.isOpen()) this.render();
      });
  }

  /** Commands and settings, for the active tab */
  public getCommands(): PaletteItem[] {
    const yasgui = this.yasgui;
    const tab = () => yasgui.getTab();
    const mod = modKeyLabel();
    const clickTool = (selector: string) => () => {
      const button = tab()?.getRootEl()?.querySelector<HTMLElement>(selector);
      button?.click();
    };
    const hasTool = (selector: string) => {
      const el = tab()?.getRootEl()?.querySelector(selector);
      return !!el && el.getClientRects().length > 0;
    };
    const commands: PaletteItem[] = [
      {
        section: "commands",
        label: "Run query",
        keys: `${mod} ↵`,
        icon: "play",
        keywords: "execute",
        run: () => tab()?.query(),
      },
      {
        section: "commands",
        label: "New tab",
        icon: "plus",
        keywords: "query add",
        run: () => {
          yasgui.addTab(true);
        },
      },
      {
        section: "commands",
        label: "Insert snippet…",
        icon: "braces",
        keywords: "template",
        run: () => tab()?.openInsertMenu(),
      },
      {
        section: "commands",
        label: "Insert PREFIX declarations",
        icon: "tag",
        keywords: "prefixes namespaces",
        run: () => tab()?.insertPrefixes(),
      },
      {
        section: "commands",
        label: "Switch endpoint…",
        icon: "database",
        keywords: "sparql service url",
        run: () => tab()?.focusEndpoint(),
      },
    ];
    if (yasgui.config.endpointDescribe?.enabled) {
      commands.push({
        section: "commands",
        label: "Explore endpoint",
        keys: "F8",
        icon: "compass",
        keywords: "describe void service description overview",
        run: () => yasgui.endpointDescribe?.toggle(),
      });
    }
    commands.push(
      {
        section: "commands",
        label: "Show saved queries",
        icon: "fileText",
        keywords: "query browser workspace side panel",
        run: () => yasgui.sidePanel?.show("queries"),
      },
      {
        section: "commands",
        label: "Toggle side panel",
        keys: `${mod} B`,
        icon: "panelLeft",
        run: () => yasgui.sidePanel?.toggle(),
      },
      {
        section: "commands",
        label: "Toggle side-by-side layout",
        icon: "columns",
        keywords: "orientation stacked horizontal vertical",
        run: () => tab()?.toggleOrientation(),
      },
    );
    const tools: Array<[string, string, IconName, string]> = [
      [".yasqe_formatButton", "Format query", "alignLeft", "beautify indent"],
      [".yasqe_share", "Share query", "share", "link url copy"],
      [".yasqe_saveManagedButton", "Save query to a workspace", "save", "store"],
      [".yasqe_saveRqButton", "Download query", "fileDown", "export rq file"],
      [".yasqe_fullscreenButton", "Toggle full screen editor", "maximize", "fullscreen"],
    ];
    for (const [selector, label, iconName, keywords] of tools) {
      if (!hasTool(selector)) continue;
      commands.push({ section: "commands", label, icon: iconName, keywords, run: clickTool(selector) });
    }
    if (yasgui.config.showThemeToggle) {
      commands.push({
        section: "commands",
        label: "Toggle dark mode",
        icon: "moon",
        keywords: "theme light",
        run: () => {
          yasgui.toggleTheme();
        },
      });
    }
    if (yasgui.config.helpUrl) {
      const helpUrl = yasgui.config.helpUrl;
      commands.push({
        section: "commands",
        label: "Open the documentation",
        icon: "help",
        keywords: "help user guide",
        run: () => {
          window.open(helpUrl, "_blank", "noopener,noreferrer");
        },
      });
    }

    const settings: Array<[string, string, string]> = [
      ["request", "Request", "method headers get post accept"],
      ["endpoints", "SPARQL endpoints", "catalogue quick switch buttons"],
      ["workspaces", "Workspaces", "git repository query management"],
      ["prefix", "Prefixes", "namespaces"],
      ["editor", "Editor", "theme font snippets autocomplete"],
      ["importexport", "Import / export", "backup configuration"],
      ["shortcuts", "Keyboard shortcuts", "keys"],
      ["about", "About", "version"],
    ];
    for (const [section, label, keywords] of settings) {
      commands.push({
        section: "settings",
        label: `Settings: ${label}`,
        icon: "settings",
        keywords: `preferences ${keywords}`,
        run: () => tab()?.openSettings(section),
      });
    }
    return commands;
  }

  private collect(text: string): PaletteItem[] {
    const commandsOnly = text.startsWith(">");
    const query = (commandsOnly ? text.substring(1) : text).trim();
    const pick = (items: PaletteItem[], limit = Infinity) => {
      if (!query) return items.slice(0, limit);
      return items
        .map((item, index) => ({ item, index, score: scorePaletteItem(item, query) }))
        .filter((entry) => entry.score >= 0)
        .sort((a, b) => b.score - a.score || a.index - b.index)
        .slice(0, limit)
        .map((entry) => entry.item);
    };
    const all = this.getCommands();
    const commands = pick(all.filter((item) => item.section === "commands"));
    // Settings only show up when searched for, so the list starts with queries and commands
    const settings = query || commandsOnly ? pick(all.filter((item) => item.section === "settings")) : [];
    const queries = commandsOnly ? [] : pick(this.queryItems, query ? MAX_QUERIES : 5);
    // Snippets too: there are many, so they only show up when searched for
    const snippets = query && !commandsOnly ? pick(this.getSnippetItems(), MAX_SNIPPETS) : [];
    return [...queries, ...snippets, ...commands, ...settings];
  }

  /** The code snippets of the Insert menu; picking one inserts it at the cursor */
  private getSnippetItems(): PaletteItem[] {
    const tab = this.yasgui.getTab();
    if (!tab) return [];
    return tab.getSnippets().map((snippet) => ({
      section: "snippets",
      label: snippet.label,
      detail: snippet.group ? displayGroupName(snippet.group) : undefined,
      icon: "braces",
      // The code too, so "filter" finds the snippets that write a FILTER
      keywords: `snippet insert ${snippet.code}`,
      run: () => tab.insertSnippet(snippet),
    }));
  }

  private render() {
    if (!this.listEl || !this.inputEl) return;
    this.items = this.collect(this.inputEl.value);
    this.listEl.innerHTML = "";
    let section: PaletteSection | undefined;
    this.items.forEach((item, index) => {
      if (item.section !== section) {
        section = item.section;
        const header = document.createElement("div");
        addClass(header, "yasgui-palette__section");
        header.setAttribute("role", "presentation");
        header.textContent = SECTION_LABELS[section];
        this.listEl!.appendChild(header);
      }
      const row = document.createElement("div");
      addClass(row, "yasgui-palette__item");
      row.id = `${this.listEl!.id}-${index}`;
      row.setAttribute("role", "option");
      row.dataset.index = String(index);
      row.innerHTML = icon(item.icon, 16);
      const label = document.createElement("span");
      addClass(label, "yasgui-palette__label");
      label.textContent = item.label;
      row.appendChild(label);
      if (item.detail) {
        const detail = document.createElement("span");
        addClass(detail, "yasgui-palette__detail");
        detail.textContent = item.detail;
        row.appendChild(detail);
      }
      if (item.keys) {
        const keys = document.createElement("kbd");
        keys.textContent = item.keys;
        row.appendChild(keys);
      }
      row.addEventListener("mousemove", () => {
        if (this.activeIndex === index) return;
        this.activeIndex = index;
        this.updateActive(false);
      });
      row.addEventListener("click", () => this.runItem(item));
      this.listEl!.appendChild(row);
    });
    if (!this.items.length) {
      const empty = document.createElement("div");
      addClass(empty, "yasgui-palette__empty");
      empty.textContent = this.queriesLoading ? "Searching…" : "Nothing found";
      this.listEl.appendChild(empty);
    } else if (this.queriesLoading && !this.inputEl.value.startsWith(">")) {
      const loading = document.createElement("div");
      addClass(loading, "yasgui-palette__empty");
      loading.textContent = "Loading saved queries…";
      this.listEl.insertBefore(loading, this.listEl.firstChild);
    }
    this.updateActive();
  }

  private updateActive(scroll = true) {
    if (!this.listEl || !this.inputEl) return;
    if (this.activeIndex >= this.items.length) this.activeIndex = 0;
    this.listEl.querySelectorAll<HTMLElement>(".yasgui-palette__item").forEach((row) => {
      const active = Number(row.dataset.index) === this.activeIndex;
      row.classList.toggle("active", active);
      row.setAttribute("aria-selected", String(active));
      if (active) {
        this.inputEl!.setAttribute("aria-activedescendant", row.id);
        if (scroll) row.scrollIntoView({ block: "nearest" });
      }
    });
  }
}
