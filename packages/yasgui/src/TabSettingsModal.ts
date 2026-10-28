import { addClass, removeClass } from "@matdata/yasgui-utils";
import "./TabSettingsModal.scss";
import Tab from "./Tab";
import * as ConfigExportImport from "./ConfigExportImport";
import { VERSION } from "./version";
import * as OAuth2Utils from "./OAuth2Utils";
import PersistentConfig from "./PersistentConfig";
import { deduplicatePrefixes } from "./prefixUtils";
import { WorkspaceSettingsForm } from "./queryManagement/WorkspaceSettingsForm";
import { icon, IconName } from "./icons";
import AiSettingsForm from "./ai/AiSettingsForm";
import type { EditorSettings, RequestSettings } from "./PersistentConfig";
import { controlId, settingsGroup, settingsRow, settingsSegmented, settingsSelect, settingsSwitch } from "./settingsUi";

const AcceptOptionsMap: { key: string; value: string }[] = [
  { key: "JSON", value: "application/sparql-results+json" },
  { key: "XML", value: "application/sparql-results+xml" },
  { key: "CSV", value: "text/csv" },
  { key: "TSV", value: "text/tab-separated-values" },
];
const AcceptHeaderGraphMap: { key: string; value: string }[] = [
  { key: "Turtle", value: "text/turtle,*/*;q=0.9" },
  { key: "JSON", value: "application/rdf+json,*/*;q=0.9" },
  { key: "RDF/XML", value: "application/rdf+xml,*/*;q=0.9" },
  { key: "TriG", value: "application/trig,*/*;q=0.9" },
  { key: "N-Triples", value: "application/n-triples,*/*;q=0.9" },
  { key: "N-Quads", value: "application/n-quads,*/*;q=0.9" },
  { key: "CSV", value: "text/csv,*/*;q=0.9" },
  { key: "TSV", value: "text/tab-separated-values,*/*;q=0.9" },
];

// Type for key-value pairs (headers, args, etc.)
type KeyValuePair = { name: string; value: string };

// Editor themes: each is a `cm-s-<name>` class applied to the CodeMirror 6 editor root; the styles ship with yasgui
const EDITOR_THEMES: { value: string; label: string; mode: "light" | "dark" }[] = [
  { value: "default", label: "Default", mode: "light" },
  { value: "eclipse", label: "Eclipse", mode: "light" },
  { value: "idea", label: "IntelliJ IDEA", mode: "light" },
  { value: "solarized-light", label: "Solarized Light", mode: "light" },
  { value: "github-dark", label: "GitHub Dark", mode: "dark" },
  { value: "monokai", label: "Monokai", mode: "dark" },
  { value: "dracula", label: "Dracula", mode: "dark" },
  { value: "material-darker", label: "Material Darker", mode: "dark" },
];

/** A page of the settings and its place in the navigation */
interface SettingsPage {
  id: string;
  label: string;
  icon: IconName;
  group: string;
  className?: string;
  draw: (container: HTMLElement) => void;
}

/** Older names of settings pages, still accepted by open() */
const SECTION_ALIASES: { [name: string]: string } = { request: "general" };

// Default API Key header name
const DEFAULT_API_KEY_HEADER = "X-API-Key";

export default class TabSettingsModal {
  private tab: Tab;
  private modalOverlay!: HTMLElement;
  private modalContent!: HTMLElement;
  private hamburgerContainer!: HTMLElement;
  private contentArea?: HTMLElement;
  private currentPage = "general";
  private savedStatus!: HTMLElement;
  private savedTimer?: ReturnType<typeof setTimeout>;
  private prefixTextarea?: HTMLTextAreaElement;
  private prefixTimer?: ReturnType<typeof setTimeout>;
  private aiSettingsForm?: AiSettingsForm;
  private hamburgerMenuButton!: HTMLButtonElement;
  private hamburgerDropdown!: HTMLElement;
  private isHamburgerOpen = false;
  private mouseDownOnOverlay = false;
  private handleKeyDown = (e: KeyboardEvent) => {
    if (e.key !== "Escape") return;
    if (!this.modalOverlay.classList.contains("open")) return;
    e.preventDefault();
    this.close();
  };

  constructor(tab: Tab, controlBarEl: HTMLElement) {
    this.tab = tab;
    this.init(controlBarEl);
  }

  private init(controlBarEl: HTMLElement) {
    // Settings and the theme toggle live in the top bar of Yasgui; Prefixes, Explore endpoint and
    // the map are labelled buttons of the query bar (see Tab). On narrow screens they move into this menu.
    const hamburgerContainer = document.createElement("div");
    addClass(hamburgerContainer, "hamburgerContainer", "mobileOnly");
    this.hamburgerContainer = hamburgerContainer;

    this.hamburgerMenuButton = document.createElement("button");
    this.hamburgerMenuButton.type = "button";
    addClass(this.hamburgerMenuButton, "tabContextButton", "hamburgerMenuButton");
    this.hamburgerMenuButton.setAttribute("aria-label", "Menu");
    this.hamburgerMenuButton.setAttribute("aria-haspopup", "true");
    this.hamburgerMenuButton.setAttribute("aria-expanded", "false");
    this.hamburgerMenuButton.title = "Open menu";
    this.hamburgerMenuButton.innerHTML = icon("menu", 20);
    this.hamburgerMenuButton.onclick = (e) => {
      e.stopPropagation();
      this.toggleHamburgerMenu();
    };
    hamburgerContainer.appendChild(this.hamburgerMenuButton);

    // Create hamburger dropdown menu
    this.createHamburgerDropdown(hamburgerContainer);

    controlBarEl.appendChild(hamburgerContainer);

    // Close hamburger menu when clicking outside
    document.addEventListener("click", this.handleDocumentClick);

    this.createModal();
  }

  /** The mobile menu of the query bar */
  public getHamburgerElement(): HTMLElement {
    return this.hamburgerContainer;
  }

  private handleDocumentClick = (e: MouseEvent) => {
    if (
      this.isHamburgerOpen &&
      !this.hamburgerDropdown.contains(e.target as Node) &&
      !this.hamburgerMenuButton.contains(e.target as Node)
    ) {
      this.closeHamburgerMenu();
    }
  };

  private menuItem(iconName: IconName, label: string, onClick: (event: MouseEvent) => void, ...classes: string[]) {
    const item = document.createElement("button");
    item.type = "button";
    addClass(item, "hamburgerMenuItem", ...classes);
    item.innerHTML = icon(iconName, 18) + "<span></span>";
    (item.querySelector("span") as HTMLElement).textContent = label;
    item.onclick = onClick;
    return item;
  }

  private createHamburgerDropdown(hamburgerContainer: HTMLElement) {
    this.hamburgerDropdown = document.createElement("div");
    addClass(this.hamburgerDropdown, "hamburgerDropdown");
    this.hamburgerDropdown.style.display = "none";

    this.hamburgerDropdown.appendChild(
      this.menuItem("tag", "Prefixes", () => {
        this.insertPrefixes();
        this.closeHamburgerMenu();
      }),
    );

    if (this.tab.yasgui.config.endpointDescribe?.enabled) {
      this.hamburgerDropdown.appendChild(
        this.menuItem("compass", "Explore endpoint", () => {
          this.tab.yasgui.endpointDescribe?.toggle();
          this.closeHamburgerMenu();
        }),
      );
    }

    this.hamburgerDropdown.appendChild(
      this.menuItem("fileText", "Saved queries", () => {
        this.tab.yasgui.queryBrowser.open();
        this.closeHamburgerMenu();
      }),
    );

    this.hamburgerDropdown.appendChild(
      this.menuItem("map", "Geometry from a map", (event) => {
        this.openMapWidget(event);
        this.closeHamburgerMenu();
      }),
    );

    // Theme toggle menu item (if enabled)
    if (this.tab.yasgui.config.showThemeToggle) {
      const themeItem = this.menuItem(
        this.tab.yasgui.getTheme() === "dark" ? "sun" : "moon",
        "Switch theme",
        () => {
          this.tab.yasgui.toggleTheme();
          themeItem.querySelector("svg")!.outerHTML = icon(this.tab.yasgui.getTheme() === "dark" ? "sun" : "moon", 18);
          // Keep menu open for theme toggle so user can see the change
        },
        "themeMenuItem",
      );
      this.hamburgerDropdown.appendChild(themeItem);
    }

    // Layout orientation menu item
    const layoutItem = document.createElement("button");
    layoutItem.type = "button";
    addClass(layoutItem, "hamburgerMenuItem", "layoutMenuItem");
    this.updateLayoutMenuItemContent(layoutItem);
    layoutItem.onclick = () => {
      this.tab.toggleOrientation();
      this.updateLayoutMenuItemContent(layoutItem);
      // Keep menu open for layout toggle so user can see the change
    };
    this.hamburgerDropdown.appendChild(layoutItem);

    this.hamburgerDropdown.appendChild(
      this.menuItem("settings", "Settings", () => {
        this.open();
        this.closeHamburgerMenu();
      }),
    );

    hamburgerContainer.appendChild(this.hamburgerDropdown);
  }

  private updateLayoutMenuItemContent(layoutItem: HTMLButtonElement) {
    const orientation = this.tab.getCurrentOrientation();
    const label = orientation === "vertical" ? "Side-by-side layout" : "Stacked layout";
    layoutItem.innerHTML = icon(orientation === "vertical" ? "columns" : "rows", 18) + "<span></span>";
    (layoutItem.querySelector("span") as HTMLElement).textContent = label;
  }

  private toggleHamburgerMenu() {
    if (this.isHamburgerOpen) {
      this.closeHamburgerMenu();
    } else {
      this.openHamburgerMenu();
    }
  }

  private openHamburgerMenu() {
    this.isHamburgerOpen = true;
    this.hamburgerDropdown.style.display = "block";
    addClass(this.hamburgerMenuButton, "active");
    this.hamburgerMenuButton.setAttribute("aria-expanded", "true");
  }

  private closeHamburgerMenu() {
    this.isHamburgerOpen = false;
    this.hamburgerDropdown.style.display = "none";
    removeClass(this.hamburgerMenuButton, "active");
    this.hamburgerMenuButton.setAttribute("aria-expanded", "false");
  }

  /** The pages of the settings, in the order of the navigation */
  private pages(): SettingsPage[] {
    const pages: SettingsPage[] = [
      {
        id: "general",
        label: "General",
        icon: "alignLeft",
        group: "Querying",
        draw: (c) => this.drawGeneralSettings(c),
      },
      {
        id: "endpoints",
        label: "Endpoints",
        icon: "database",
        group: "Querying",
        draw: (c) => this.drawEndpointsSettings(c),
      },
      { id: "prefix", label: "Prefixes", icon: "tag", group: "Querying", draw: (c) => this.drawPrefixSettings(c) },
      { id: "editor", label: "Editor", icon: "code", group: "Querying", draw: (c) => this.drawEditorSettings(c) },
      {
        id: "workspaces",
        label: "Workspaces",
        icon: "folder",
        group: "Your data",
        draw: (c) => this.drawWorkspacesSettings(c),
      },
      {
        id: "importexport",
        label: "Import / export",
        icon: "fileDown",
        group: "Your data",
        draw: (c) => this.drawImportExportSettings(c),
      },
    ];
    const assistant = this.tab.yasgui.aiAssistant;
    if (assistant) {
      pages.push({
        id: "ai",
        label: "AI",
        icon: "sparkles",
        group: "Assistant",
        className: "yasgui-aiSettings",
        draw: (c) => {
          this.aiSettingsForm = new AiSettingsForm(assistant, () => this.saved());
          this.aiSettingsForm.draw(c);
        },
      });
    }
    pages.push(
      {
        id: "shortcuts",
        label: "Keyboard shortcuts",
        icon: "keyboard",
        group: "Help",
        draw: (c) => this.drawKeyboardShortcuts(c),
      },
      { id: "about", label: "About", icon: "help", group: "Help", draw: (c) => this.drawAboutSettings(c) },
    );
    return pages;
  }

  private createModal() {
    // Modal overlay
    this.modalOverlay = document.createElement("div");
    addClass(this.modalOverlay, "tabSettingsModalOverlay");

    // Track mousedown on overlay to distinguish from text selection that moves outside
    this.modalOverlay.addEventListener("mousedown", (e) => {
      if (e.target === this.modalOverlay) {
        this.mouseDownOnOverlay = true;
      }
    });

    // Only close if mousedown also happened on overlay (not during text selection)
    this.modalOverlay.addEventListener("mouseup", (e) => {
      if (e.target === this.modalOverlay && this.mouseDownOnOverlay) {
        this.close();
      }
      this.mouseDownOnOverlay = false;
    });

    // Modal content
    this.modalContent = document.createElement("div");
    addClass(this.modalContent, "tabSettingsModal");
    this.modalContent.setAttribute("role", "dialog");
    this.modalContent.setAttribute("aria-modal", "true");
    this.modalContent.tabIndex = -1;
    this.modalContent.onclick = (e) => e.stopPropagation();

    // Header: the title and a close button; they stay in place while the page scrolls
    const header = document.createElement("div");
    addClass(header, "modalHeader");
    const title = document.createElement("h2");
    title.textContent = "Settings";
    title.id = controlId("title");
    this.modalContent.setAttribute("aria-labelledby", title.id);
    header.appendChild(title);

    const closeBtn = document.createElement("button");
    closeBtn.type = "button";
    closeBtn.innerHTML = icon("x", 18);
    closeBtn.setAttribute("aria-label", "Close settings");
    closeBtn.title = "Close";
    addClass(closeBtn, "closeButton");
    closeBtn.onclick = () => this.close();
    header.appendChild(closeBtn);

    this.modalContent.appendChild(header);

    // Body: the pages, grouped in the navigation on the left
    const body = document.createElement("div");
    addClass(body, "modalBody");

    const sidebar = document.createElement("nav");
    addClass(sidebar, "modalSidebar");
    sidebar.setAttribute("aria-label", "Settings pages");

    const contentArea = document.createElement("div");
    addClass(contentArea, "modalContentArea");
    this.contentArea = contentArea;

    let group: string | undefined;
    for (const page of this.pages()) {
      if (page.group !== group) {
        group = page.group;
        const heading = document.createElement("div");
        addClass(heading, "modalNavGroup");
        heading.textContent = group;
        sidebar.appendChild(heading);
      }
      const button = document.createElement("button");
      button.type = "button";
      addClass(button, "modalNavButton");
      button.dataset.tab = page.id;
      button.innerHTML = icon(page.icon, 16) + "<span></span>";
      (button.querySelector("span") as HTMLElement).textContent = page.label;
      button.onclick = () => this.switchTab(page.id);
      sidebar.appendChild(button);

      const content = document.createElement("div");
      addClass(content, "modalTabContent");
      if (page.className) addClass(content, page.className);
      content.id = `${page.id}-content`;
      page.draw(content);
      contentArea.appendChild(content);
    }

    body.appendChild(sidebar);
    body.appendChild(contentArea);
    this.modalContent.appendChild(body);

    // Footer: changes apply at once, so it only says so and closes the settings
    const footer = document.createElement("div");
    addClass(footer, "modalFooter");

    const note = document.createElement("p");
    addClass(note, "modalFooterNote");
    this.savedStatus = document.createElement("span");
    addClass(this.savedStatus, "modalSavedStatus");
    this.savedStatus.setAttribute("aria-live", "polite");
    note.appendChild(this.savedStatus);
    note.appendChild(document.createTextNode("Changes apply at once. Settings stay in this browser."));
    footer.appendChild(note);

    const doneBtn = document.createElement("button");
    doneBtn.type = "button";
    doneBtn.textContent = "Done";
    addClass(doneBtn, "primaryButton");
    doneBtn.onclick = () => this.close();
    footer.appendChild(doneBtn);

    this.modalContent.appendChild(footer);

    this.modalOverlay.appendChild(this.modalContent);
    document.body.appendChild(this.modalOverlay);
    this.switchTab("general");
  }

  private switchTab(tabName: string) {
    const name = SECTION_ALIASES[tabName] || tabName;
    const buttons = this.modalContent.querySelectorAll(".modalNavButton");
    const contents = this.modalContent.querySelectorAll(".modalTabContent");
    if (!this.modalContent.querySelector(`#${name}-content`)) return;
    this.currentPage = name;

    buttons.forEach((btn) => {
      const active = (btn as HTMLElement).dataset.tab === name;
      (btn as HTMLElement).classList.toggle("active", active);
      if (active) btn.setAttribute("aria-current", "page");
      else btn.removeAttribute("aria-current");
    });

    contents.forEach((content) => {
      if (content.id === `${name}-content`) {
        addClass(content as HTMLElement, "active");
        // Refresh endpoints list when switching to endpoints tab
        if (name === "endpoints") {
          const endpointsList = content.querySelector(".endpointsTable");
          if (endpointsList) {
            this.renderEndpointsList(endpointsList as HTMLElement);
          }
        }
      } else {
        removeClass(content as HTMLElement, "active");
      }
    });
    if (this.contentArea) this.contentArea.scrollTop = 0;
  }

  /** Says "Saved" in the footer for a moment, after a change was stored */
  private saved() {
    if (!this.savedStatus) return;
    this.savedStatus.textContent = "Saved";
    addClass(this.savedStatus, "visible");
    if (this.savedTimer) clearTimeout(this.savedTimer);
    this.savedTimer = setTimeout(() => {
      removeClass(this.savedStatus, "visible");
      this.savedStatus.textContent = "";
    }, 2500);
  }

  private drawWorkspacesSettings(container: HTMLElement) {
    const form = new WorkspaceSettingsForm(container, {
      persistentConfig: this.tab.yasgui.persistentConfig,
      onDeleteRequested: (workspaceId) => {
        const w = this.tab.yasgui.persistentConfig.getWorkspace(workspaceId);
        const name = w?.label || workspaceId;
        if (confirm(`Delete workspace "${name}"? This only removes the local configuration.`)) {
          this.tab.yasgui.persistentConfig.deleteWorkspace(workspaceId);
          form.render();
        }
      },
    });

    form.render();
  }

  private drawPrefixSettings(container: HTMLElement) {
    container.innerHTML = "";
    const config = this.tab.yasgui.persistentConfig;
    let prefixes = config.getPrefixes();
    // Set default prefixes if none exist
    if (!prefixes || prefixes.trim().length === 0) {
      prefixes = `PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>\nPREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>`;
      config.setPrefixes(prefixes);
    }

    const group = document.createElement("section");
    addClass(group, "settingsGroup");
    const title = document.createElement("h3");
    addClass(title, "settingsGroupTitle");
    title.textContent = "Saved prefixes";
    const lede = document.createElement("p");
    addClass(lede, "settingsGroupLede");
    lede.textContent =
      "PREFIX declarations, one per line. The Prefixes button of the query bar inserts them into the query.";
    this.prefixTextarea = document.createElement("textarea");
    addClass(this.prefixTextarea, "prefixTextarea");
    this.prefixTextarea.setAttribute("aria-label", "Saved prefixes");
    this.prefixTextarea.spellcheck = false;
    this.prefixTextarea.placeholder =
      "PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>\nPREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>";
    this.prefixTextarea.rows = 10;
    this.prefixTextarea.value = prefixes;
    this.prefixTextarea.addEventListener("input", () => {
      if (this.prefixTimer) clearTimeout(this.prefixTimer);
      this.prefixTimer = setTimeout(() => this.storePrefixes(), 500);
    });
    this.prefixTextarea.addEventListener("change", () => this.storePrefixes());
    group.append(title, lede, this.prefixTextarea);
    container.appendChild(group);

    const list = settingsGroup(container, "Capture");
    const id = controlId("autoCapture");
    settingsRow(
      list,
      "Capture new prefixes from queries",
      "Prefixes declared in a query you run are added to this list.",
      [
        settingsSwitch(id, config.getAutoCaptureEnabled(), (on) => {
          config.setAutoCaptureEnabled(on);
          this.saved();
        }),
      ],
      id,
    );
  }

  /** Store the prefixes of the textarea, without duplicates */
  private storePrefixes() {
    if (this.prefixTimer) clearTimeout(this.prefixTimer);
    this.prefixTimer = undefined;
    if (!this.prefixTextarea) return;
    const deduplicated = deduplicatePrefixes(this.prefixTextarea.value);
    if (deduplicated === this.tab.yasgui.persistentConfig.getPrefixes()) return;
    this.tab.yasgui.persistentConfig.setPrefixes(deduplicated);
    this.saved();
  }

  /** Settings → General: appearance, requests and what happens before a query runs */
  private drawGeneralSettings(container: HTMLElement) {
    container.innerHTML = "";
    const yasgui = this.tab.yasgui;
    const config = yasgui.persistentConfig;

    // Appearance
    const appearance = settingsGroup(container, "Appearance");
    if (yasgui.config.showThemeToggle !== false) {
      settingsRow(appearance, "Theme", "Follows your system unless you pick one.", [
        settingsSegmented(
          "Theme",
          [
            { value: "light", label: "Light" },
            { value: "dark", label: "Dark" },
            { value: "system", label: "System" },
          ],
          yasgui.themeManager.getPreference(),
          (value) => {
            if (value === "system") yasgui.themeManager.followSystem();
            else yasgui.setTheme(value as "light" | "dark");
            this.saved();
          },
        ),
      ]);
    }
    const lightId = controlId("editorThemeLight");
    const themeSelect = (mode: "light" | "dark", id: string, fallback: string) =>
      settingsSelect(
        id,
        EDITOR_THEMES.filter((theme) => theme.mode === mode).map(({ value, label }) => ({ value, label })),
        config.getCodeMirrorTheme(mode) || fallback,
        (value) => {
          config.setCodeMirrorTheme(mode, value);
          yasgui.themeManager.refresh();
          this.saved();
        },
        `Editor theme in ${mode} mode`,
      );
    settingsRow(
      appearance,
      "Editor theme",
      "Syntax colours in light mode and in dark mode.",
      [themeSelect("light", lightId, "default"), themeSelect("dark", controlId("editorThemeDark"), "github-dark")],
      lightId,
    );

    // Requests, shared by all tabs
    const requests = settingsGroup(container, "Requests", "These apply to every tab.");
    const current = this.tab.getRequestConfig();
    const stored = config.getRequestSettings() || {};
    const method = stored.method || (typeof current.method === "string" ? current.method : "POST");
    settingsRow(requests, "Request method", "POST works with every endpoint and with long queries.", [
      settingsSegmented(
        "Request method",
        [
          { value: "POST", label: "POST" },
          { value: "GET", label: "GET" },
        ],
        method,
        (value) => this.applyRequestSettings({ method: value as "GET" | "POST" }),
      ),
    ]);
    const selectId = controlId("acceptSelect");
    settingsRow(
      requests,
      "Results format",
      "Accept header for SELECT and ASK queries.",
      [
        settingsSelect(
          selectId,
          AcceptOptionsMap.map(({ key, value }) => ({ value, label: key })),
          stored.acceptHeaderSelect ||
            (typeof current.acceptHeaderSelect === "string" ? current.acceptHeaderSelect : undefined),
          (value) => this.applyRequestSettings({ acceptHeaderSelect: value }),
        ),
      ],
      selectId,
    );
    const graphId = controlId("acceptGraph");
    settingsRow(
      requests,
      "Graph format",
      "Accept header for CONSTRUCT and DESCRIBE queries.",
      [
        settingsSelect(
          graphId,
          AcceptHeaderGraphMap.map(({ key, value }) => ({ value, label: key })),
          stored.acceptHeaderGraph ||
            (typeof current.acceptHeaderGraph === "string" ? current.acceptHeaderGraph : undefined),
          (value) => this.applyRequestSettings({ acceptHeaderGraph: value }),
        ),
      ],
      graphId,
    );
    const headers = stored.headers || (typeof current.headers === "object" && current.headers ? current.headers : {});
    this.drawHeadersRow(requests, headers);

    // Before running a query
    const yasqe = this.tab.getYasqe();
    const run = settingsGroup(container, "Before running a query");
    const editorSettings = config.getEditorSettings();
    if (yasqe) {
      const formatId = controlId("autoformat");
      settingsRow(
        run,
        "Format the query",
        "With the formatter chosen under Editor.",
        [
          settingsSwitch(
            formatId,
            editorSettings.autoformatOnQuery ?? yasqe.persistentConfig?.autoformatOnQuery !== false,
            (on) => this.applyEditorSettings({ autoformatOnQuery: on }),
          ),
        ],
        formatId,
      );
      const constructId = controlId("constructCheck");
      settingsRow(
        run,
        "Check CONSTRUCT variables",
        "Warn about template variables that the WHERE clause never binds.",
        [
          settingsSwitch(
            constructId,
            editorSettings.checkConstructVariables ?? yasqe.config.checkConstructVariables ?? true,
            (on) => this.applyEditorSettings({ checkConstructVariables: on }),
          ),
        ],
        constructId,
      );
    }
    // Not shown when the embedding page switched the feature off
    if (yasgui.config.iriHover !== false) {
      const hoverId = controlId("iriHover");
      settingsRow(
        run,
        "IRI information on hover",
        "Label, description and type of an IRI or prefixed name, from the endpoint.",
        [
          settingsSwitch(hoverId, config.getIriHoverEnabled(), (on) => {
            config.setIriHoverEnabled(on);
            this.saved();
          }),
        ],
        hoverId,
      );
    }
    if (!run.children.length) run.parentElement?.remove();
  }

  /** The custom HTTP headers: a summary in the row, and an editor that opens under it */
  private drawHeadersRow(list: HTMLElement, headers: { [name: string]: string }) {
    const summary = (current: { [name: string]: string }) => {
      const names = Object.keys(current);
      if (!names.length) return "None. Sent with every query, e.g. an API key of the endpoint.";
      return names.length === 1 ? `${names[0]}: ${current[names[0]]}` : `${names.join(", ")}`;
    };
    const toggle = document.createElement("button");
    toggle.type = "button";
    addClass(toggle, "secondaryButton");
    toggle.textContent = "Edit headers";
    toggle.setAttribute("aria-expanded", "false");
    const row = settingsRow(list, "Custom HTTP headers", summary(headers), [toggle]);
    const description = row.querySelector(".settingsRowDescription") as HTMLElement;

    const editor = document.createElement("div");
    addClass(editor, "keyValueContainer", "settingsRowEditor");
    editor.hidden = true;
    const store = () => {
      const next: { [name: string]: string } = {};
      editor.querySelectorAll(".keyValueRow").forEach((pair) => {
        const name = (pair.querySelector(".keyInput") as HTMLInputElement).value.trim();
        const value = (pair.querySelector(".valueInput") as HTMLInputElement).value;
        if (name) next[name] = value;
      });
      description.textContent = summary(next);
      this.applyRequestSettings({ headers: next });
    };
    const pairs = Object.entries(headers).map(([name, value]) => ({ name, value }));
    pairs.forEach((pair, index) => this.createKeyValueRow(editor, pair, index, store));
    this.createKeyValueRow(editor, { name: "", value: "" }, pairs.length, store);
    row.appendChild(editor);
    toggle.onclick = () => {
      editor.hidden = !editor.hidden;
      toggle.textContent = editor.hidden ? "Edit headers" : "Close";
      toggle.setAttribute("aria-expanded", String(!editor.hidden));
      if (!editor.hidden) (editor.querySelector(".keyInput") as HTMLInputElement | null)?.focus();
    };
  }

  /** Store request settings and apply them to every open tab; new tabs get them too */
  private applyRequestSettings(settings: RequestSettings) {
    this.tab.yasgui.persistentConfig.setRequestSettings(settings);
    for (const tab of this.tab.yasgui.getTabs()) tab.setRequestConfig(settings);
    this.saved();
  }

  /** Store editor settings and apply them to the editor of every open tab */
  private applyEditorSettings(settings: EditorSettings) {
    this.tab.yasgui.persistentConfig.setEditorSettings(settings);
    for (const tab of this.tab.yasgui.getTabs()) tab.applyEditorSettings();
    this.saved();
  }

  private drawEditorSettings(container: HTMLElement) {
    container.innerHTML = "";
    const yasqe = this.tab.getYasqe();
    const list = settingsGroup(container, "Formatting");
    const id = controlId("formatter");
    const current =
      this.tab.yasgui.persistentConfig.getEditorSettings().formatterType ||
      yasqe?.persistentConfig?.formatterType ||
      "sparql-formatter";
    settingsRow(
      list,
      "Query formatter",
      "Used by Format (Shift+Ctrl+F) and before running a query.",
      [
        settingsSelect(
          id,
          [
            { value: "sparql-formatter", label: "SPARQL 1.2 formatter" },
            { value: "legacy", label: "Legacy formatter (built-in)" },
          ],
          current,
          (value) => this.applyEditorSettings({ formatterType: value as "sparql-formatter" | "legacy" }),
        ),
      ],
      id,
    );
  }

  private drawEndpointsSettings(container: HTMLElement) {
    // Developer-configured endpoint buttons section (if any)
    const devButtons = this.tab.yasgui.config.endpointButtons;
    if (devButtons && devButtons.length > 0) {
      this.drawDeveloperButtonsSettings(container);
    }

    const section = document.createElement("div");
    addClass(section, "settingsSection");

    const label = document.createElement("label");
    label.textContent = "SPARQL Endpoints";
    addClass(label, "settingsLabel");

    const help = document.createElement("div");
    help.textContent =
      "Manage your SPARQL endpoints. Each endpoint can have its own authentication and be displayed as a quick-switch button.";
    addClass(help, "settingsHelp");

    section.appendChild(label);
    section.appendChild(help);

    // List of endpoints
    const endpointsList = document.createElement("div");
    addClass(endpointsList, "endpointsTable");
    this.renderEndpointsList(endpointsList);
    section.appendChild(endpointsList);

    container.appendChild(section);
  }

  private drawDeveloperButtonsSettings(container: HTMLElement) {
    const section = document.createElement("div");
    addClass(section, "settingsSection");

    const label = document.createElement("label");
    label.textContent = "Developer-Configured Endpoint Buttons";
    addClass(label, "settingsLabel");

    const help = document.createElement("div");
    help.textContent = "These endpoint buttons were configured by the developer. You can enable or disable them.";
    addClass(help, "settingsHelp");

    section.appendChild(label);
    section.appendChild(help);

    // List of dev buttons
    const devButtonsList = document.createElement("div");
    addClass(devButtonsList, "devButtonsTable");
    this.renderDeveloperButtonsList(devButtonsList);
    section.appendChild(devButtonsList);

    container.appendChild(section);
  }

  private renderDeveloperButtonsList(container: HTMLElement) {
    container.innerHTML = "";
    const devButtons = this.tab.yasgui.config.endpointButtons || [];
    const disabledButtons = this.tab.yasgui.persistentConfig.getDisabledDevButtons();

    // Create table
    const table = document.createElement("table");
    addClass(table, "devButtonsTableElement");

    // Header
    const thead = document.createElement("thead");
    const headerRow = document.createElement("tr");
    const headers = ["Label", "Endpoint", "Enabled"];
    headers.forEach((h) => {
      const th = document.createElement("th");
      th.textContent = h;
      headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);
    table.appendChild(thead);

    // Body
    const tbody = document.createElement("tbody");

    devButtons.forEach((button) => {
      const row = document.createElement("tr");

      // Label column
      const labelCell = document.createElement("td");
      labelCell.textContent = button.label;
      addClass(labelCell, "devButtonLabelCell");
      row.appendChild(labelCell);

      // Endpoint column
      const endpointCell = document.createElement("td");
      endpointCell.textContent = button.endpoint;
      endpointCell.title = button.endpoint;
      addClass(endpointCell, "endpointCell");
      row.appendChild(endpointCell);

      // Enabled checkbox
      const enabledCell = document.createElement("td");
      const enabledCheckbox = document.createElement("input");
      enabledCheckbox.type = "checkbox";
      enabledCheckbox.checked = !disabledButtons.includes(button.endpoint);
      enabledCheckbox.setAttribute("aria-label", `Toggle ${button.label} button`);
      enabledCheckbox.title = "Show/hide this button";
      enabledCheckbox.onchange = () => {
        this.tab.yasgui.persistentConfig.toggleDevButton(button.endpoint, enabledCheckbox.checked);
        this.tab.refreshEndpointButtons();
      };
      enabledCell.appendChild(enabledCheckbox);
      addClass(enabledCell, "centerCell");
      row.appendChild(enabledCell);

      tbody.appendChild(row);
    });

    table.appendChild(tbody);
    container.appendChild(table);
  }

  private renderEndpointsList(container: HTMLElement) {
    container.innerHTML = "";
    const configs = [...this.tab.yasgui.persistentConfig.getEndpointConfigs()];
    configs.sort((a, b) => {
      const aKey = (a.label || a.endpoint).toLowerCase();
      const bKey = (b.label || b.endpoint).toLowerCase();
      return aKey.localeCompare(bKey);
    });

    // Create table (even if empty, we'll show add form)
    const table = document.createElement("table");
    addClass(table, "endpointsTableElement");

    // Header
    const thead = document.createElement("thead");
    const headerRow = document.createElement("tr");
    const headers = ["Endpoint", "Label", "Button", "Authentication", "Actions"];
    headers.forEach((h) => {
      const th = document.createElement("th");
      th.textContent = h;
      headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);
    table.appendChild(thead);

    // Body
    const tbody = document.createElement("tbody");

    if (configs.length === 0) {
      // Show empty message in table
      const emptyRow = document.createElement("tr");
      const emptyCell = document.createElement("td");
      emptyCell.colSpan = 5;
      emptyCell.textContent = "No endpoints yet. Add one below or access an endpoint to have it automatically tracked.";
      addClass(emptyCell, "emptyMessage");
      emptyCell.style.textAlign = "center";
      emptyCell.style.padding = "20px";
      emptyRow.appendChild(emptyCell);
      tbody.appendChild(emptyRow);
    }

    configs.forEach((config, index) => {
      const row = document.createElement("tr");

      // Endpoint column
      const endpointCell = document.createElement("td");
      endpointCell.textContent = config.endpoint;
      endpointCell.title = config.endpoint;
      addClass(endpointCell, "endpointCell");
      row.appendChild(endpointCell);

      // Label column (editable)
      const labelCell = document.createElement("td");
      const labelInput = document.createElement("input");
      labelInput.type = "text";
      labelInput.value = config.label || "";
      labelInput.placeholder = "Optional label";
      addClass(labelInput, "endpointLabelInput");
      labelInput.onchange = () => {
        this.tab.yasgui.persistentConfig.addOrUpdateEndpoint(config.endpoint, {
          label: labelInput.value.trim() || undefined,
        });
        this.renderEndpointsList(container);
        this.tab.refreshEndpointButtons();
      };
      labelCell.appendChild(labelInput);
      row.appendChild(labelCell);

      // Show as Button checkbox (requires label)
      const buttonCell = document.createElement("td");
      const buttonCheckbox = document.createElement("input");
      buttonCheckbox.type = "checkbox";
      buttonCheckbox.checked = !!config.showAsButton;
      buttonCheckbox.disabled = !config.label;
      buttonCheckbox.setAttribute(
        "aria-label",
        config.label ? "Show this endpoint as a quick-switch button" : "Add a label first to enable button",
      );
      buttonCheckbox.title = config.label
        ? "Show this endpoint as a quick-switch button"
        : "Add a label first to enable button";
      buttonCheckbox.onchange = () => {
        this.tab.yasgui.persistentConfig.addOrUpdateEndpoint(config.endpoint, {
          showAsButton: buttonCheckbox.checked,
        });
        this.tab.refreshEndpointButtons();
      };
      buttonCell.appendChild(buttonCheckbox);
      addClass(buttonCell, "centerCell");
      row.appendChild(buttonCell);

      // Authentication column
      const authCell = document.createElement("td");
      const authButton = document.createElement("button");
      authButton.type = "button";
      addClass(authButton, "configureAuthButton");
      if (config.authentication) {
        authButton.textContent = "✓ Configured";
        addClass(authButton, "authenticated");
      } else {
        authButton.textContent = "Configure";
      }
      authButton.onclick = () => this.showAuthenticationModal(config.endpoint);
      authCell.appendChild(authButton);
      addClass(authCell, "centerCell");
      row.appendChild(authCell);

      // Actions column
      const actionsCell = document.createElement("td");
      const deleteButton = document.createElement("button");
      deleteButton.type = "button";
      deleteButton.textContent = "Delete";
      addClass(deleteButton, "deleteEndpointButton");
      deleteButton.onclick = () => {
        if (confirm(`Delete endpoint "${config.endpoint}"?`)) {
          this.tab.yasgui.persistentConfig.deleteEndpointConfig(config.endpoint);
          this.renderEndpointsList(container);
          this.tab.refreshEndpointButtons();
        }
      };
      actionsCell.appendChild(deleteButton);
      addClass(actionsCell, "centerCell");
      row.appendChild(actionsCell);

      tbody.appendChild(row);
    });
    table.appendChild(tbody);
    container.appendChild(table);

    // Add endpoint form
    const addForm = document.createElement("div");
    addClass(addForm, "addEndpointForm");

    const addFormTitle = document.createElement("div");
    addFormTitle.textContent = "Add New Endpoint";
    addClass(addFormTitle, "addFormTitle");
    addForm.appendChild(addFormTitle);

    const formInputs = document.createElement("div");
    addClass(formInputs, "addFormInputs");

    const endpointInput = document.createElement("input");
    endpointInput.type = "url";
    endpointInput.placeholder = "Endpoint URL (e.g., https://dbpedia.org/sparql)";
    addClass(endpointInput, "addEndpointInput");
    formInputs.appendChild(endpointInput);

    const addButton = document.createElement("button");
    addButton.type = "button";
    addButton.textContent = "+ Add Endpoint";
    addClass(addButton, "addEndpointButton");
    addButton.onclick = () => {
      const endpoint = endpointInput.value.trim();

      if (!endpoint) {
        alert("Please enter an endpoint URL.");
        return;
      }

      // Validate URL format
      // Check for supported protocol first
      if (!/^https?:\/\//i.test(endpoint)) {
        alert("Endpoint URL must start with http:// or https://");
        return;
      }
      try {
        new URL(endpoint);
      } catch (e) {
        // Show the error message if available, otherwise a generic one
        alert(e instanceof Error && e.message ? "Malformed URL: " + e.message : "Please enter a valid URL.");
        return;
      }

      // Check if endpoint already exists
      const existing = this.tab.yasgui.persistentConfig.getEndpointConfig(endpoint);
      if (existing) {
        alert("This endpoint is already in the list.");
        return;
      }

      // Add the endpoint
      this.tab.yasgui.persistentConfig.addOrUpdateEndpoint(endpoint, {});

      // Clear input
      endpointInput.value = "";

      // Refresh list
      this.renderEndpointsList(container);
      this.tab.refreshEndpointButtons();
    };
    formInputs.appendChild(addButton);

    addForm.appendChild(formInputs);
    container.appendChild(addForm);
  }

  private showAuthenticationModal(endpoint: string) {
    const config = this.tab.yasgui.persistentConfig.getEndpointConfig(endpoint);
    const existingAuth = config?.authentication;

    // Track mousedown for proper modal close behavior
    let mouseDownOnOverlay = false;

    // Create modal overlay
    const authModalOverlay = document.createElement("div");
    addClass(authModalOverlay, "authModalOverlay");

    // Track mousedown on overlay to distinguish from text selection that moves outside
    authModalOverlay.addEventListener("mousedown", (e) => {
      if (e.target === authModalOverlay) {
        mouseDownOnOverlay = true;
      }
    });

    // Only close if mousedown also happened on overlay (not during text selection)
    authModalOverlay.addEventListener("mouseup", (e) => {
      if (e.target === authModalOverlay && mouseDownOnOverlay) {
        authModalOverlay.remove();
      }
      mouseDownOnOverlay = false;
    });

    // Create modal content
    const authModal = document.createElement("div");
    addClass(authModal, "authModal");
    authModal.onclick = (e) => e.stopPropagation();

    // Header
    const header = document.createElement("div");
    addClass(header, "authModalHeader");
    const title = document.createElement("h3");
    title.textContent = "Configure Authentication";
    const subtitle = document.createElement("div");
    subtitle.textContent = endpoint;
    addClass(subtitle, "authModalSubtitle");
    header.appendChild(title);
    header.appendChild(subtitle);
    authModal.appendChild(header);

    // Body
    const body = document.createElement("div");
    addClass(body, "authModalBody");

    // Auth type
    const typeSection = document.createElement("div");
    addClass(typeSection, "authModalSection");
    const typeLabel = document.createElement("label");
    typeLabel.textContent = "Authentication Type";
    const typeSelect = document.createElement("select");

    const basicOption = document.createElement("option");
    basicOption.value = "basic";
    basicOption.textContent = "HTTP Basic Authentication";
    typeSelect.appendChild(basicOption);

    const bearerOption = document.createElement("option");
    bearerOption.value = "bearer";
    bearerOption.textContent = "Bearer Token";
    typeSelect.appendChild(bearerOption);

    const apiKeyOption = document.createElement("option");
    apiKeyOption.value = "apiKey";
    apiKeyOption.textContent = "API Key (Custom Header)";
    typeSelect.appendChild(apiKeyOption);

    const oauth2Option = document.createElement("option");
    oauth2Option.value = "oauth2";
    oauth2Option.textContent = "OAuth 2.0";
    typeSelect.appendChild(oauth2Option);

    // Set the current auth type
    if (existingAuth) {
      typeSelect.value = existingAuth.type;
    }

    typeSection.appendChild(typeLabel);
    typeSection.appendChild(typeSelect);
    body.appendChild(typeSection);

    // Basic Auth Fields
    const basicAuthFields = document.createElement("div");
    basicAuthFields.id = "basicAuthFields";
    addClass(basicAuthFields, "authFieldsContainer");

    const usernameSection = document.createElement("div");
    addClass(usernameSection, "authModalSection");
    const usernameLabel = document.createElement("label");
    usernameLabel.textContent = "Username";
    const usernameInput = document.createElement("input");
    usernameInput.type = "text";
    usernameInput.placeholder = "Enter username";
    usernameInput.value = existingAuth?.type === "basic" ? existingAuth.username : "";
    usernameInput.autocomplete = "username";
    usernameSection.appendChild(usernameLabel);
    usernameSection.appendChild(usernameInput);
    basicAuthFields.appendChild(usernameSection);

    const passwordSection = document.createElement("div");
    addClass(passwordSection, "authModalSection");
    const passwordLabel = document.createElement("label");
    passwordLabel.textContent = "Password";
    const passwordInput = document.createElement("input");
    passwordInput.type = "password";
    passwordInput.placeholder = "Enter password";
    passwordInput.value = existingAuth?.type === "basic" ? existingAuth.password : "";
    passwordInput.autocomplete = "current-password";
    passwordSection.appendChild(passwordLabel);
    passwordSection.appendChild(passwordInput);
    basicAuthFields.appendChild(passwordSection);

    body.appendChild(basicAuthFields);

    // Bearer Token Fields
    const bearerAuthFields = document.createElement("div");
    bearerAuthFields.id = "bearerAuthFields";
    addClass(bearerAuthFields, "authFieldsContainer");
    bearerAuthFields.style.display = "none";

    const tokenSection = document.createElement("div");
    addClass(tokenSection, "authModalSection");
    const tokenLabel = document.createElement("label");
    tokenLabel.textContent = "Bearer Token";
    const tokenInput = document.createElement("input");
    tokenInput.type = "password";
    tokenInput.placeholder = "Enter bearer token";
    tokenInput.autocomplete = "off";
    tokenInput.value = existingAuth?.type === "bearer" ? existingAuth.token : "";
    tokenSection.appendChild(tokenLabel);
    tokenSection.appendChild(tokenInput);
    bearerAuthFields.appendChild(tokenSection);

    body.appendChild(bearerAuthFields);

    // API Key Fields
    const apiKeyAuthFields = document.createElement("div");
    apiKeyAuthFields.id = "apiKeyAuthFields";
    addClass(apiKeyAuthFields, "authFieldsContainer");
    apiKeyAuthFields.style.display = "none";

    const headerNameSection = document.createElement("div");
    addClass(headerNameSection, "authModalSection");
    const headerNameLabel = document.createElement("label");
    headerNameLabel.textContent = "Header Name";
    const headerNameInput = document.createElement("input");
    headerNameInput.type = "text";
    headerNameInput.placeholder = `e.g., ${DEFAULT_API_KEY_HEADER}`;
    headerNameInput.value = existingAuth?.type === "apiKey" ? existingAuth.headerName : DEFAULT_API_KEY_HEADER;
    headerNameSection.appendChild(headerNameLabel);
    headerNameSection.appendChild(headerNameInput);
    apiKeyAuthFields.appendChild(headerNameSection);

    const apiKeySection = document.createElement("div");
    addClass(apiKeySection, "authModalSection");
    const apiKeyLabel = document.createElement("label");
    apiKeyLabel.textContent = "API Key";
    const apiKeyInput = document.createElement("input");
    apiKeyInput.type = "password";
    apiKeyInput.placeholder = "Enter API key";
    apiKeyInput.autocomplete = "off";
    apiKeyInput.value = existingAuth?.type === "apiKey" ? existingAuth.apiKey : "";
    apiKeySection.appendChild(apiKeyLabel);
    apiKeySection.appendChild(apiKeyInput);
    apiKeyAuthFields.appendChild(apiKeySection);

    body.appendChild(apiKeyAuthFields);

    // OAuth 2.0 Fields
    const oauth2AuthFields = document.createElement("div");
    oauth2AuthFields.id = "oauth2AuthFields";
    addClass(oauth2AuthFields, "authFieldsContainer");
    oauth2AuthFields.style.display = "none";

    const clientIdSection = document.createElement("div");
    addClass(clientIdSection, "authModalSection");
    const clientIdLabel = document.createElement("label");
    clientIdLabel.textContent = "Client ID";
    const clientIdInput = document.createElement("input");
    clientIdInput.type = "text";
    clientIdInput.placeholder = "Enter OAuth 2.0 client ID";
    clientIdInput.value = existingAuth?.type === "oauth2" ? existingAuth.clientId : "";
    clientIdSection.appendChild(clientIdLabel);
    clientIdSection.appendChild(clientIdInput);
    oauth2AuthFields.appendChild(clientIdSection);

    const authEndpointSection = document.createElement("div");
    addClass(authEndpointSection, "authModalSection");
    const authEndpointLabel = document.createElement("label");
    authEndpointLabel.textContent = "Authorization Endpoint";
    const authEndpointInput = document.createElement("input");
    authEndpointInput.type = "url";
    authEndpointInput.placeholder = "https://provider.com/oauth/authorize";
    authEndpointInput.value = existingAuth?.type === "oauth2" ? existingAuth.authorizationEndpoint : "";
    authEndpointSection.appendChild(authEndpointLabel);
    authEndpointSection.appendChild(authEndpointInput);
    oauth2AuthFields.appendChild(authEndpointSection);

    const tokenEndpointSection = document.createElement("div");
    addClass(tokenEndpointSection, "authModalSection");
    const tokenEndpointLabel = document.createElement("label");
    tokenEndpointLabel.textContent = "Token Endpoint";
    const tokenEndpointInput = document.createElement("input");
    tokenEndpointInput.type = "url";
    tokenEndpointInput.placeholder = "https://provider.com/oauth/token";
    tokenEndpointInput.value = existingAuth?.type === "oauth2" ? existingAuth.tokenEndpoint : "";
    tokenEndpointSection.appendChild(tokenEndpointLabel);
    tokenEndpointSection.appendChild(tokenEndpointInput);
    oauth2AuthFields.appendChild(tokenEndpointSection);

    const redirectUriSection = document.createElement("div");
    addClass(redirectUriSection, "authModalSection");
    const redirectUriLabel = document.createElement("label");
    redirectUriLabel.textContent = "Redirect URI (Optional)";
    const redirectUriInput = document.createElement("input");
    redirectUriInput.type = "url";
    redirectUriInput.placeholder = window.location.origin + window.location.pathname;
    redirectUriInput.value = existingAuth?.type === "oauth2" ? existingAuth.redirectUri || "" : "";
    const redirectUriHelp = document.createElement("div");
    redirectUriHelp.textContent = "Leave empty to use current page URL. Must be registered with OAuth provider.";
    addClass(redirectUriHelp, "authInputHelp");
    redirectUriSection.appendChild(redirectUriLabel);
    redirectUriSection.appendChild(redirectUriInput);
    redirectUriSection.appendChild(redirectUriHelp);
    oauth2AuthFields.appendChild(redirectUriSection);

    const scopeSection = document.createElement("div");
    addClass(scopeSection, "authModalSection");
    const scopeLabel = document.createElement("label");
    scopeLabel.textContent = "Scope (Optional)";
    const scopeInput = document.createElement("input");
    scopeInput.type = "text";
    scopeInput.placeholder = "e.g., read write";
    scopeInput.value = existingAuth?.type === "oauth2" ? existingAuth.scope || "" : "";
    const scopeHelp = document.createElement("div");
    scopeHelp.textContent = "Space-separated list of OAuth 2.0 scopes";
    addClass(scopeHelp, "authInputHelp");
    scopeSection.appendChild(scopeLabel);
    scopeSection.appendChild(scopeInput);
    scopeSection.appendChild(scopeHelp);
    oauth2AuthFields.appendChild(scopeSection);

    // Show token status if already authenticated
    if (existingAuth?.type === "oauth2" && existingAuth.accessToken) {
      const tokenStatusSection = document.createElement("div");
      addClass(tokenStatusSection, "authModalSection");
      const tokenStatusLabel = document.createElement("label");
      tokenStatusLabel.textContent = "Authentication Status";
      const tokenStatus = document.createElement("div");
      addClass(tokenStatus, "oauth2TokenStatus");
      tokenStatus.innerHTML = "✓ Authenticated";
      addClass(tokenStatus, "authenticated");
      tokenStatusSection.appendChild(tokenStatusLabel);
      tokenStatusSection.appendChild(tokenStatus);
      oauth2AuthFields.appendChild(tokenStatusSection);
    }

    body.appendChild(oauth2AuthFields);

    // Function to toggle fields based on auth type
    const toggleAuthFields = () => {
      const authType = typeSelect.value;
      basicAuthFields.style.display = authType === "basic" ? "block" : "none";
      bearerAuthFields.style.display = authType === "bearer" ? "block" : "none";
      apiKeyAuthFields.style.display = authType === "apiKey" ? "block" : "none";
      oauth2AuthFields.style.display = authType === "oauth2" ? "block" : "none";
    };

    // Set initial visibility
    toggleAuthFields();

    // Update visibility when auth type changes
    typeSelect.onchange = toggleAuthFields;

    // Help link
    const helpLink = document.createElement("div");
    addClass(helpLink, "authHelpLink");
    helpLink.innerHTML = `
      📚 <a href="https://triply.cc/docs/yasgui#authentication" target="_blank" rel="noopener noreferrer">View authentication documentation</a>
    `;
    body.appendChild(helpLink);

    // Security notice
    const securityNotice = document.createElement("div");
    addClass(securityNotice, "authSecurityNotice");
    securityNotice.innerHTML = `
      <strong>⚠️ Security Notice:</strong>
      <ul>
        <li>Credentials are stored in browser localStorage</li>
        <li>Only use with HTTPS endpoints</li>
        <li>Be cautious when using on shared computers</li>
      </ul>
    `;
    body.appendChild(securityNotice);

    authModal.appendChild(body);

    // Footer
    const footer = document.createElement("div");
    addClass(footer, "authModalFooter");

    const removeButton = document.createElement("button");
    removeButton.textContent = "Remove Authentication";
    removeButton.type = "button";
    addClass(removeButton, "authRemoveButton");
    // Helper function to close modal and refresh endpoints list
    const closeModalAndRefresh = () => {
      authModalOverlay.remove();
      const endpointsList = this.modalContent.querySelector(".endpointsTable");
      if (endpointsList) this.renderEndpointsList(endpointsList as HTMLElement);
    };

    removeButton.onclick = () => {
      this.tab.yasgui.persistentConfig.addOrUpdateEndpoint(endpoint, {
        authentication: undefined,
      });
      closeModalAndRefresh();
    };
    if (!existingAuth) {
      removeButton.disabled = true;
    }

    const cancelButton = document.createElement("button");
    cancelButton.textContent = "Cancel";
    cancelButton.type = "button";
    addClass(cancelButton, "authCancelButton");
    cancelButton.onclick = () => authModalOverlay.remove();

    const saveButton = document.createElement("button");
    saveButton.textContent = "Save";
    saveButton.type = "button";
    addClass(saveButton, "authSaveButton");
    saveButton.onclick = () => {
      const authType = typeSelect.value;

      if (authType === "basic") {
        const username = usernameInput.value.trim();
        const password = passwordInput.value;

        if (username && password) {
          this.tab.yasgui.persistentConfig.addOrUpdateEndpoint(endpoint, {
            authentication: {
              type: "basic",
              username,
              password,
            },
          });
          closeModalAndRefresh();
        } else {
          alert("Please enter both username and password.");
        }
      } else if (authType === "bearer") {
        const token = tokenInput.value.trim();

        if (token) {
          this.tab.yasgui.persistentConfig.addOrUpdateEndpoint(endpoint, {
            authentication: {
              type: "bearer",
              token,
            },
          });
          closeModalAndRefresh();
        } else {
          alert("Please enter a bearer token.");
        }
      } else if (authType === "apiKey") {
        const headerName = headerNameInput.value.trim();
        const apiKey = apiKeyInput.value.trim();

        if (headerName && apiKey) {
          this.tab.yasgui.persistentConfig.addOrUpdateEndpoint(endpoint, {
            authentication: {
              type: "apiKey",
              headerName,
              apiKey,
            },
          });
          closeModalAndRefresh();
        } else {
          alert("Please enter both header name and API key.");
        }
      } else if (authType === "oauth2") {
        const clientId = clientIdInput.value.trim();
        const authorizationEndpoint = authEndpointInput.value.trim();
        const tokenEndpoint = tokenEndpointInput.value.trim();
        const redirectUri = redirectUriInput.value.trim() || window.location.origin + window.location.pathname;
        const scope = scopeInput.value.trim();

        if (!clientId || !authorizationEndpoint || !tokenEndpoint) {
          alert("Please enter Client ID, Authorization Endpoint, and Token Endpoint.");
          return;
        }

        // Check if already authenticated (has access token)
        if (existingAuth?.type === "oauth2" && existingAuth.accessToken) {
          // Already has token, just save the configuration updates
          this.tab.yasgui.persistentConfig.addOrUpdateEndpoint(endpoint, {
            authentication: {
              type: "oauth2",
              clientId,
              authorizationEndpoint,
              tokenEndpoint,
              redirectUri,
              scope,
              accessToken: existingAuth.accessToken,
              idToken: existingAuth.idToken,
              refreshToken: existingAuth.refreshToken,
              tokenExpiry: existingAuth.tokenExpiry,
            },
          });
          closeModalAndRefresh();
          return;
        }

        // Start OAuth 2.0 flow
        saveButton.disabled = true;
        saveButton.textContent = "Authenticating...";

        OAuth2Utils.startOAuth2Flow({
          clientId,
          authorizationEndpoint,
          tokenEndpoint,
          redirectUri,
          scope,
        })
          .then((tokenResponse) => {
            const tokenExpiry = OAuth2Utils.calculateTokenExpiry(tokenResponse.expires_in);

            this.tab.yasgui.persistentConfig.addOrUpdateEndpoint(endpoint, {
              authentication: {
                type: "oauth2",
                clientId,
                authorizationEndpoint,
                tokenEndpoint,
                redirectUri,
                scope,
                accessToken: tokenResponse.access_token,
                idToken: tokenResponse.id_token,
                refreshToken: tokenResponse.refresh_token,
                tokenExpiry,
              },
            });

            closeModalAndRefresh();
            alert("OAuth 2.0 authentication successful!");
          })
          .catch((error) => {
            console.error("OAuth 2.0 authentication failed:", error);
            alert("OAuth 2.0 authentication failed: " + error.message);
            saveButton.disabled = false;
            saveButton.textContent = "Save & Authenticate";
          });
      }
    };

    footer.appendChild(removeButton);
    footer.appendChild(cancelButton);
    footer.appendChild(saveButton);
    authModal.appendChild(footer);

    authModalOverlay.appendChild(authModal);
    document.body.appendChild(authModalOverlay);
  }

  private createKeyValueRow(container: HTMLElement, pair: KeyValuePair, index: number, onChange: () => void) {
    const row = document.createElement("div");
    addClass(row, "keyValueRow");

    const nameInput = document.createElement("input");
    nameInput.type = "text";
    nameInput.placeholder = "Header name";
    nameInput.setAttribute("aria-label", "Header name");
    nameInput.value = pair.name;
    addClass(nameInput, "keyInput");

    const valueInput = document.createElement("input");
    valueInput.type = "text";
    valueInput.placeholder = "Value";
    valueInput.setAttribute("aria-label", "Header value");
    valueInput.value = pair.value;
    addClass(valueInput, "valueInput");

    const removeButton = document.createElement("button");
    removeButton.type = "button";
    removeButton.innerHTML = icon("x", 14);
    removeButton.title = "Remove header";
    removeButton.setAttribute("aria-label", "Remove header");
    addClass(removeButton, "removeButton");

    // Auto-add new empty row when typing in the last row
    const onInput = () => {
      const allRows = container.querySelectorAll(".keyValueRow");
      const isLastRow = row === allRows[allRows.length - 1];

      if (isLastRow && (nameInput.value.trim() || valueInput.value.trim())) {
        this.createKeyValueRow(container, { name: "", value: "" }, allRows.length, onChange);
      }
    };

    nameInput.addEventListener("input", onInput);
    valueInput.addEventListener("input", onInput);
    nameInput.addEventListener("change", onChange);
    valueInput.addEventListener("change", onChange);

    removeButton.onclick = () => {
      row.remove();
      // Ensure there's always at least one empty row
      const remainingRows = container.querySelectorAll(".keyValueRow");
      if (remainingRows.length === 0) {
        this.createKeyValueRow(container, { name: "", value: "" }, 0, onChange);
      }
      onChange();
    };

    row.appendChild(nameInput);
    row.appendChild(valueInput);
    row.appendChild(removeButton);
    container.appendChild(row);
  }

  /**
   * Open the settings modal, optionally on a section:
   * "general" (or "request"), "endpoints", "workspaces", "prefix", "editor", "ai", "importexport", "shortcuts"
   * or "about"
   */
  public open(section?: string) {
    // Settings may have changed in another tab, so the pages that show them are drawn again
    for (const [id, draw] of [
      ["general", (c: HTMLElement) => this.drawGeneralSettings(c)],
      ["prefix", (c: HTMLElement) => this.drawPrefixSettings(c)],
      ["editor", (c: HTMLElement) => this.drawEditorSettings(c)],
    ] as Array<[string, (c: HTMLElement) => void]>) {
      const content = this.modalContent.querySelector(`#${id}-content`);
      if (content) draw(content as HTMLElement);
    }
    this.aiSettingsForm?.load();
    this.switchTab(section || this.currentPage);
    // Refresh endpoints list in case new endpoints were added while modal was closed
    const endpointsContent = this.modalContent.querySelector("#endpoints-content");
    if (endpointsContent) {
      const endpointsList = endpointsContent.querySelector(".endpointsTable");
      if (endpointsList) {
        this.renderEndpointsList(endpointsList as HTMLElement);
      }
    }
    if (this.savedStatus) {
      removeClass(this.savedStatus, "visible");
      this.savedStatus.textContent = "";
    }
    addClass(this.modalOverlay, "open");
    document.addEventListener("keydown", this.handleKeyDown);
    this.modalContent.focus();
  }

  public close() {
    if (!this.modalOverlay.classList.contains("open")) return;
    // Changes apply at once; prefixes still being typed are stored now
    this.storePrefixes();
    this.mouseDownOnOverlay = false;
    removeClass(this.modalOverlay, "open");
    document.removeEventListener("keydown", this.handleKeyDown);
    this.tab.refreshEndpointButtons();
  }

  /** Insert the saved prefixes (Settings > Prefixes) at the top of the query */
  public insertPrefixes() {
    const yasqe = this.tab.getYasqe();
    if (!yasqe) return;

    const savedPrefixes = this.tab.yasgui.persistentConfig.getPrefixes();
    if (!savedPrefixes.trim()) return;

    const lines = yasqe.getValue().split("\n");

    // Keep leading comment lines (such as `#defaultView:Map`) above the prefixes
    let i = 0;
    const leadingComments: string[] = [];
    while (i < lines.length && lines[i].trim().startsWith("#")) leadingComments.push(lines[i++]);

    // Drop the existing PREFIX declarations (and blank lines); the saved prefixes replace them
    while (i < lines.length && (lines[i].trim().length === 0 || lines[i].trim().toUpperCase().startsWith("PREFIX"))) {
      i++;
    }
    const restOfQuery = lines.slice(i).join("\n").trim();

    const header = leadingComments.length ? leadingComments.join("\n") + "\n" : "";
    const newQuery = header + savedPrefixes + (restOfQuery ? "\n\n" + restOfQuery : "");
    yasqe.setValue(newQuery);
    yasqe.focus();
  }

  /** Open the map to draw a geometry and insert it as a WKT literal */
  public openMapWidget(event?: MouseEvent) {
    const yasqe = this.tab.getYasqe();
    if (!yasqe) return;
    const anchorPoint = event ? { x: event.clientX, y: event.clientY } : undefined;
    yasqe.toggleMapWidget(anchorPoint);
  }

  public capturePrefixesFromQuery() {
    const autoCapture = this.tab.yasgui.persistentConfig.getAutoCaptureEnabled();
    if (!autoCapture) return;

    const yasqe = this.tab.getYasqe();
    if (!yasqe) return;

    const queryPrefixes = yasqe.getPrefixesFromQuery();
    if (!queryPrefixes || Object.keys(queryPrefixes).length === 0) return;

    // Convert query prefixes to text format
    const newPrefixLines: string[] = [];
    for (const [label, uri] of Object.entries(queryPrefixes)) {
      newPrefixLines.push(`PREFIX ${label}: <${uri}>`);
    }

    // Merge with existing prefixes
    const existingPrefixes = this.tab.yasgui.persistentConfig.getPrefixes();
    const combined = existingPrefixes + "\n" + newPrefixLines.join("\n");
    const deduplicated = deduplicatePrefixes(combined);

    this.tab.yasgui.persistentConfig.setPrefixes(deduplicated);
  }

  // Old endpoint buttons functionality has been merged into drawEndpointsSettings
  // Keeping this for reference if needed for backwards compatibility

  private drawImportExportSettings(container: HTMLElement) {
    // Export Section
    const exportSection = document.createElement("div");
    addClass(exportSection, "settingsSection");

    const exportLabel = document.createElement("label");
    exportLabel.textContent = "Export Configuration";
    addClass(exportLabel, "settingsLabel");

    const exportHelp = document.createElement("div");
    exportHelp.textContent =
      "Export your Matgui configuration in RDF Turtle format. This includes tabs, queries, endpoints, and preferences.";
    addClass(exportHelp, "settingsHelp");

    const exportButtonsContainer = document.createElement("div");
    addClass(exportButtonsContainer, "exportButtons");

    const copyButton = document.createElement("button");
    copyButton.textContent = "📋 Copy to Clipboard";
    copyButton.type = "button";
    addClass(copyButton, "secondaryButton");
    copyButton.onclick = async () => {
      try {
        const config = this.tab.yasgui.persistentConfig.getPersistedConfig();
        await ConfigExportImport.copyConfigToClipboard(config);
        this.showNotification("Configuration copied to clipboard!", "success");
      } catch (error) {
        this.showNotification("Failed to copy to clipboard: " + (error as Error).message, "error");
      }
    };

    const downloadButton = document.createElement("button");
    downloadButton.textContent = "💾 Download as File";
    downloadButton.type = "button";
    addClass(downloadButton, "primaryButton");
    downloadButton.onclick = () => {
      try {
        const config = this.tab.yasgui.persistentConfig.getPersistedConfig();
        ConfigExportImport.downloadConfigAsFile(config);
        this.showNotification("Configuration downloaded!", "success");
      } catch (error) {
        this.showNotification("Failed to download: " + (error as Error).message, "error");
      }
    };

    exportButtonsContainer.appendChild(copyButton);
    exportButtonsContainer.appendChild(downloadButton);

    exportSection.appendChild(exportLabel);
    exportSection.appendChild(exportHelp);
    exportSection.appendChild(exportButtonsContainer);
    container.appendChild(exportSection);

    // Import Section
    const importSection = document.createElement("div");
    addClass(importSection, "settingsSection");

    const importLabel = document.createElement("label");
    importLabel.textContent = "Import Configuration";
    addClass(importLabel, "settingsLabel");

    const importHelp = document.createElement("div");
    importHelp.textContent = "Import a previously exported configuration in RDF Turtle format.";
    addClass(importHelp, "settingsHelp");

    // Drag and drop area
    const dropZone = document.createElement("div");
    addClass(dropZone, "dropZone");
    dropZone.innerHTML = `
      <div class="dropZoneContent">
        <div class="dropZoneIcon">📁</div>
        <div class="dropZoneText">Drag & drop a .ttl file here</div>
        <div class="dropZoneOr">or</div>
      </div>
    `;

    const fileInput = document.createElement("input");
    fileInput.type = "file";
    fileInput.accept = ".ttl,.turtle,text/turtle";
    fileInput.style.display = "none";
    fileInput.id = "config-file-input";

    const browseButton = document.createElement("button");
    browseButton.textContent = "📂 Browse Files";
    browseButton.type = "button";
    addClass(browseButton, "secondaryButton");
    browseButton.onclick = () => fileInput.click();

    const pasteButton = document.createElement("button");
    pasteButton.textContent = "📋 Paste from Clipboard";
    pasteButton.type = "button";
    addClass(pasteButton, "secondaryButton");
    pasteButton.onclick = async () => {
      try {
        const content = await ConfigExportImport.readConfigFromClipboard();
        await this.importConfiguration(content);
      } catch (error) {
        this.showNotification("Failed to read from clipboard: " + (error as Error).message, "error");
      }
    };

    // File input change handler
    fileInput.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        try {
          const content = await ConfigExportImport.readConfigFromFile(file);
          await this.importConfiguration(content);
        } catch (error) {
          this.showNotification("Failed to read file: " + (error as Error).message, "error");
        }
      }
    };

    // Drag and drop handlers
    dropZone.ondragover = (e) => {
      e.preventDefault();
      addClass(dropZone, "dragover");
    };

    dropZone.ondragleave = () => {
      removeClass(dropZone, "dragover");
    };

    dropZone.ondrop = async (e) => {
      e.preventDefault();
      removeClass(dropZone, "dragover");

      const file = e.dataTransfer?.files?.[0];
      if (file) {
        try {
          const content = await ConfigExportImport.readConfigFromFile(file);
          await this.importConfiguration(content);
        } catch (error) {
          this.showNotification("Failed to read file: " + (error as Error).message, "error");
        }
      }
    };

    const importButtonsContainer = document.createElement("div");
    addClass(importButtonsContainer, "importButtons");
    importButtonsContainer.appendChild(browseButton);
    importButtonsContainer.appendChild(pasteButton);

    dropZone.appendChild(importButtonsContainer);

    importSection.appendChild(importLabel);
    importSection.appendChild(importHelp);
    importSection.appendChild(dropZone);
    importSection.appendChild(fileInput);
    container.appendChild(importSection);
  }

  private drawKeyboardShortcuts(container: HTMLElement) {
    const shortcutsData = [
      {
        category: "Query Editor (YASQE)",
        shortcuts: [
          { keys: ["Ctrl+Enter", "Cmd+Enter"], description: "Execute query" },
          { keys: ["Ctrl+Space", "Cmd+Space"], description: "Trigger autocomplete" },
          { keys: ["Ctrl+S", "Cmd+S"], description: "Save query to local storage" },
          { keys: ["Ctrl+Shift+F", "Cmd+Shift+F"], description: "Format query" },
          { keys: ["Ctrl+/", "Cmd+/"], description: "Toggle comment on selected lines" },
          { keys: ["Ctrl+Shift+D", "Cmd+Shift+D"], description: "Duplicate current line" },
          { keys: ["Ctrl+Shift+K", "Cmd+Shift+K"], description: "Delete current line" },
          { keys: ["Esc"], description: "Remove focus from editor" },
          { keys: ["Ctrl+Click"], description: "Find triples where URI is subject" },
          { keys: ["Ctrl+Shift+Click"], description: "Find triples where URI is object" },
        ],
      },
      {
        category: "Fullscreen",
        shortcuts: [
          { keys: ["F11"], description: "Toggle YASQE (editor) fullscreen" },
          { keys: ["F10"], description: "Toggle YASR (results) fullscreen" },
          { keys: ["F9"], description: "Switch between YASQE and YASR fullscreen" },
          { keys: ["Esc"], description: "Exit fullscreen mode" },
        ],
      },
      {
        category: "Matgui Tabs",
        shortcuts: [
          {
            keys: ["Ctrl+Alt+Tab", "Cmd+Alt+Tab"],
            description: "Switch to previously used Matgui tab",
          },
          {
            keys: ["Ctrl+Alt+Shift+Tab", "Cmd+Alt+Shift+Tab"],
            description: "Switch to next Matgui tab in recently used order",
          },
        ],
      },
      {
        category: "Workspace",
        shortcuts: [
          { keys: ["Ctrl+K", "Cmd+K"], description: "Search saved queries, commands and settings" },
          { keys: ["Ctrl+B", "Cmd+B"], description: "Show or hide the side panel" },
          { keys: ["F8"], description: "Show or hide the endpoint overview" },
        ],
      },
    ];

    shortcutsData.forEach((section) => {
      const sectionEl = document.createElement("div");
      addClass(sectionEl, "shortcutsSection");

      const categoryLabel = document.createElement("h3");
      categoryLabel.textContent = section.category;
      addClass(categoryLabel, "shortcutsCategory");
      sectionEl.appendChild(categoryLabel);

      const table = document.createElement("table");
      addClass(table, "shortcutsTable");
      table.setAttribute("role", "table");
      table.setAttribute("aria-label", `${section.category} keyboard shortcuts`);

      // Add table caption for screen readers
      const caption = document.createElement("caption");
      caption.textContent = `${section.category} keyboard shortcuts`;
      caption.style.position = "absolute";
      caption.style.left = "-10000px";
      caption.style.width = "1px";
      caption.style.height = "1px";
      caption.style.overflow = "hidden";
      table.appendChild(caption);

      // Add thead with proper headers
      const thead = document.createElement("thead");
      const headerRow = document.createElement("tr");

      const keysHeader = document.createElement("th");
      keysHeader.textContent = "Keys";
      keysHeader.setAttribute("scope", "col");
      addClass(keysHeader, "shortcutsKeysHeader");
      headerRow.appendChild(keysHeader);

      const descHeader = document.createElement("th");
      descHeader.textContent = "Description";
      descHeader.setAttribute("scope", "col");
      addClass(descHeader, "shortcutsDescHeader");
      headerRow.appendChild(descHeader);

      thead.appendChild(headerRow);
      table.appendChild(thead);

      // Add tbody
      const tbody = document.createElement("tbody");

      section.shortcuts.forEach((shortcut) => {
        const row = document.createElement("tr");

        const keysCell = document.createElement("td");
        addClass(keysCell, "shortcutsKeys");
        shortcut.keys.forEach((key, index) => {
          if (index > 0) {
            const separator = document.createElement("span");
            separator.textContent = " / ";
            addClass(separator, "shortcutsSeparator");
            keysCell.appendChild(separator);
          }
          const kbd = document.createElement("kbd");
          kbd.textContent = key;
          keysCell.appendChild(kbd);
        });
        row.appendChild(keysCell);

        const descCell = document.createElement("td");
        addClass(descCell, "shortcutsDescription");
        descCell.textContent = shortcut.description;
        row.appendChild(descCell);

        tbody.appendChild(row);
      });

      table.appendChild(tbody);

      sectionEl.appendChild(table);
      container.appendChild(sectionEl);
    });
  }

  private async importConfiguration(turtleContent: string) {
    try {
      const parsedConfig = ConfigExportImport.parseFromTurtle(turtleContent);

      // Confirm with user before importing
      const confirmMsg = `This will replace your current configuration with ${parsedConfig.tabs?.length || 0} tab(s). Continue?`;
      if (!confirm(confirmMsg)) {
        return;
      }

      // Close the modal first
      this.close();

      // Apply theme if provided
      if (parsedConfig.theme) {
        this.tab.yasgui.themeManager.setTheme(parsedConfig.theme);
      }

      // Apply global orientation if provided
      if (parsedConfig.orientation) {
        this.tab.yasgui.config.orientation = parsedConfig.orientation;
      }

      // Close all existing tabs
      const existingTabIds = [...this.tab.yasgui.persistentConfig.getTabs()];
      for (const tabId of existingTabIds) {
        const tab = this.tab.yasgui.getTab(tabId);
        if (tab) {
          tab.close();
        }
      }

      // Update the configuration storage
      this.tab.yasgui.persistentConfig.updatePersistedConfig(parsedConfig);

      window.location.reload();
    } catch (error) {
      this.showNotification("Failed to import configuration: " + (error as Error).message, "error");
    }
  }

  private showNotification(message: string, type: "success" | "error") {
    const notification = document.createElement("div");
    addClass(notification, "importExportNotification", type);
    notification.textContent = message;

    this.modalContent.appendChild(notification);

    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, 5000);
  }

  private drawAboutSettings(container: HTMLElement) {
    // About Section
    const aboutSection = document.createElement("div");
    addClass(aboutSection, "settingsSection", "aboutSection");

    // Matgui Title and Version
    const titleContainer = document.createElement("div");
    addClass(titleContainer, "aboutTitle");

    const title = document.createElement("h3");
    title.textContent = "MatGUI";
    addClass(title, "aboutMainTitle");

    const versionBadge = document.createElement("span");
    versionBadge.textContent = `v${VERSION}`;
    addClass(versionBadge, "versionBadge");

    titleContainer.appendChild(title);
    titleContainer.appendChild(versionBadge);
    aboutSection.appendChild(titleContainer);

    // Subtitle
    const subtitle = document.createElement("p");
    subtitle.textContent = "A modern knowledge graph and SPARQL workbench";
    addClass(subtitle, "aboutSubtitle");
    aboutSection.appendChild(subtitle);

    // Links Section
    const linksSection = document.createElement("div");
    addClass(linksSection, "aboutLinks");

    // Documentation Link
    const docsLink = this.createAboutLink(
      "📚 Documentation",
      "https://matgui-doc.matdata.eu/docs/",
      "View the complete documentation and guides",
    );
    linksSection.appendChild(docsLink);

    // Release Notes Link
    const releasesLink = this.createAboutLink(
      "📝 Release Notes",
      "https://github.com/Matdata-eu/Matgui/releases",
      "See what's new in the latest releases",
    );
    linksSection.appendChild(releasesLink);

    // Issues/Support Link
    const issuesLink = this.createAboutLink(
      "🐛 Report Issues & Get Support",
      "https://github.com/Matdata-eu/Matgui/issues",
      "Report bugs, request features, or ask for help",
    );
    linksSection.appendChild(issuesLink);

    aboutSection.appendChild(linksSection);

    // Footer info
    const footerInfo = document.createElement("div");
    addClass(footerInfo, "aboutFooter");

    const paragraph1 = document.createElement("p");
    paragraph1.textContent = "MatGUI is an open-source project maintained by ";
    const matdataLink = document.createElement("a");
    matdataLink.href = "https://matdata.eu";
    matdataLink.target = "_blank";
    matdataLink.rel = "noopener noreferrer";
    matdataLink.textContent = "Matdata";
    paragraph1.appendChild(matdataLink);
    paragraph1.appendChild(document.createTextNode("."));

    const paragraph2 = document.createElement("p");
    paragraph2.textContent = "Licensed under the MIT License.";

    footerInfo.appendChild(paragraph1);
    footerInfo.appendChild(paragraph2);
    aboutSection.appendChild(footerInfo);

    container.appendChild(aboutSection);

    // Storage Management Section
    const storageSection = document.createElement("div");
    addClass(storageSection, "settingsSection");

    const storageTitle = document.createElement("h3");
    storageTitle.textContent = "Storage Management";
    storageSection.appendChild(storageTitle);

    const storageDescription = document.createElement("p");
    storageDescription.textContent =
      "Clear all locally stored data including tabs, queries, endpoint configurations, and preferences. This action cannot be undone.";
    addClass(storageDescription, "settingsHelp");
    storageSection.appendChild(storageDescription);

    const clearStorageButton = document.createElement("button");
    clearStorageButton.textContent = "Clear Persistent Storage";
    addClass(clearStorageButton, "dangerButton");
    clearStorageButton.onclick = () => this.clearPersistentStorage();
    storageSection.appendChild(clearStorageButton);

    container.appendChild(storageSection);
  }

  private createAboutLink(label: string, url: string, description: string): HTMLElement {
    const linkContainer = document.createElement("div");
    addClass(linkContainer, "aboutLinkItem");

    const link = document.createElement("a");
    link.href = url;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = label;
    addClass(link, "aboutLink");

    const desc = document.createElement("p");
    desc.textContent = description;
    addClass(desc, "aboutLinkDescription");

    linkContainer.appendChild(link);
    linkContainer.appendChild(desc);

    return linkContainer;
  }

  private clearPersistentStorage() {
    const confirmed = confirm(
      "Are you sure you want to clear all persistent storage?\n\n" +
        "This will delete:\n" +
        "- All saved tabs and queries\n" +
        "- Endpoint configurations and history\n" +
        "- Authentication settings\n" +
        "- Editor preferences\n" +
        "- Prefixes\n\n" +
        "This action cannot be undone and the page will reload.",
    );

    if (confirmed) {
      // Clear persistent storage
      PersistentConfig.clear();

      // Reload the page to reinitialize with empty storage
      window.location.reload();
    }
  }

  public destroy() {
    document.removeEventListener("click", this.handleDocumentClick);
    if (this.modalOverlay && this.modalOverlay.parentNode) {
      this.modalOverlay.parentNode.removeChild(this.modalOverlay);
    }
  }
}
