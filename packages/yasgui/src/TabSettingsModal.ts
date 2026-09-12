import { addClass, removeClass } from "@matdata/yasgui-utils";
import "./TabSettingsModal.scss";
import Tab from "./Tab";
import * as ConfigExportImport from "./ConfigExportImport";
import { VERSION } from "./version";
import * as OAuth2Utils from "./OAuth2Utils";
import PersistentConfig from "./PersistentConfig";
import { deduplicatePrefixes } from "./prefixUtils";
import { WorkspaceSettingsForm } from "./queryManagement/WorkspaceSettingsForm";

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

// Default API Key header name
const DEFAULT_API_KEY_HEADER = "X-API-Key";

export default class TabSettingsModal {
  private tab: Tab;
  private modalOverlay!: HTMLElement;
  private modalContent!: HTMLElement;
  private settingsButton!: HTMLButtonElement;
  private themeToggleButton!: HTMLButtonElement;
  private prefixButton!: HTMLButtonElement;
  private mapButton!: HTMLButtonElement;
  private prefixTextarea!: HTMLTextAreaElement;
  private autoCaptureCheckbox!: HTMLInputElement;
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
    // Settings button
    this.settingsButton = document.createElement("button");
    addClass(this.settingsButton, "tabContextButton", "desktopOnly");
    this.settingsButton.setAttribute("aria-label", "Settings");
    this.settingsButton.title = "Settings";
    this.settingsButton.innerHTML = '<i class="fas fa-cog"></i>';
    this.settingsButton.onclick = () => this.open();
    controlBarEl.appendChild(this.settingsButton);

    // Theme toggle button (if enabled)
    if (this.tab.yasgui.config.showThemeToggle) {
      this.themeToggleButton = document.createElement("button");
      addClass(this.themeToggleButton, "tabContextButton", "themeToggle", "desktopOnly");
      this.themeToggleButton.setAttribute("aria-label", "Toggle between light and dark theme");
      this.themeToggleButton.title = "Toggle theme";
      this.themeToggleButton.innerHTML = this.getThemeToggleIcon();
      this.themeToggleButton.addEventListener("click", () => {
        this.tab.yasgui.toggleTheme();
        this.themeToggleButton.innerHTML = this.getThemeToggleIcon();
      });
      controlBarEl.appendChild(this.themeToggleButton);
    }

    // Prefix button
    this.prefixButton = document.createElement("button");
    this.prefixButton.setAttribute("aria-label", "Insert Prefixes");
    this.prefixButton.title = "Insert saved prefixes into query";
    this.prefixButton.innerHTML = '<i class="fas fa-arrow-up-right-from-square"></i>';
    addClass(this.prefixButton, "tabContextButton", "prefixButton", "desktopOnly");
    controlBarEl.appendChild(this.prefixButton);
    this.prefixButton.onclick = () => this.insertPrefixesIntoQuery();

    // Map button
    this.mapButton = document.createElement("button");
    this.mapButton.setAttribute("aria-label", "Open map");
    this.mapButton.title = "Open map";
    this.mapButton.innerHTML = '<i class="fas fa-map-location-dot"></i>';
    addClass(this.mapButton, "tabContextButton", "desktopOnly");
    controlBarEl.appendChild(this.mapButton);
    this.mapButton.onclick = (event: MouseEvent) => this.openMapWidget(event);

    // Hamburger menu button and dropdown (mobile only)
    const hamburgerContainer = document.createElement("div");
    addClass(hamburgerContainer, "hamburgerContainer", "mobileOnly");

    this.hamburgerMenuButton = document.createElement("button");
    addClass(this.hamburgerMenuButton, "tabContextButton", "hamburgerMenuButton");
    this.hamburgerMenuButton.setAttribute("aria-label", "Menu");
    this.hamburgerMenuButton.title = "Open menu";
    this.hamburgerMenuButton.innerHTML = '<i class="fas fa-bars"></i>';
    this.hamburgerMenuButton.onclick = (e) => {
      e.stopPropagation();
      this.toggleHamburgerMenu();
    };
    hamburgerContainer.appendChild(this.hamburgerMenuButton);

    // Create hamburger dropdown menu
    this.createHamburgerDropdown(hamburgerContainer);

    controlBarEl.appendChild(hamburgerContainer);

    // Close hamburger menu when clicking outside
    document.addEventListener("click", (e) => {
      if (
        this.isHamburgerOpen &&
        !this.hamburgerDropdown.contains(e.target as Node) &&
        e.target !== this.hamburgerMenuButton
      ) {
        this.closeHamburgerMenu();
      }
    });

    this.createModal();
  }

  private createHamburgerDropdown(hamburgerContainer: HTMLElement) {
    this.hamburgerDropdown = document.createElement("div");
    addClass(this.hamburgerDropdown, "hamburgerDropdown");
    this.hamburgerDropdown.style.display = "none";

    // Settings menu item
    const settingsItem = document.createElement("button");
    addClass(settingsItem, "hamburgerMenuItem");
    settingsItem.innerHTML = '<i class="fas fa-cog"></i><span>Settings</span>';
    settingsItem.onclick = () => {
      this.open();
      this.closeHamburgerMenu();
    };
    this.hamburgerDropdown.appendChild(settingsItem);

    // Prefix menu item
    const prefixItem = document.createElement("button");
    addClass(prefixItem, "hamburgerMenuItem");
    prefixItem.innerHTML = '<i class="fas fa-arrow-up-right-from-square"></i><span>Insert Prefixes</span>';
    prefixItem.onclick = () => {
      this.insertPrefixesIntoQuery();
      this.closeHamburgerMenu();
    };
    this.hamburgerDropdown.appendChild(prefixItem);

    const mapItem = document.createElement("button");
    addClass(mapItem, "hamburgerMenuItem");
    mapItem.innerHTML = '<i class="fas fa-map-location-dot"></i><span>Open map</span>';
    mapItem.onclick = (event) => {
      this.openMapWidget(event);
      this.closeHamburgerMenu();
    };
    this.hamburgerDropdown.appendChild(mapItem);

    // Theme toggle menu item (if enabled)
    if (this.tab.yasgui.config.showThemeToggle) {
      const themeItem = document.createElement("button");
      addClass(themeItem, "hamburgerMenuItem", "themeMenuItem");
      themeItem.innerHTML = this.getThemeToggleIcon() + "<span>Toggle Theme</span>";
      themeItem.onclick = () => {
        this.tab.yasgui.toggleTheme();
        themeItem.innerHTML = this.getThemeToggleIcon() + "<span>Toggle Theme</span>";
        // Keep menu open for theme toggle so user can see the change
      };
      this.hamburgerDropdown.appendChild(themeItem);
    }

    // Layout orientation menu item
    const layoutItem = document.createElement("button");
    addClass(layoutItem, "hamburgerMenuItem", "layoutMenuItem");
    this.updateLayoutMenuItemContent(layoutItem);
    layoutItem.onclick = () => {
      this.tab.toggleOrientation();
      this.updateLayoutMenuItemContent(layoutItem);
      // Keep menu open for layout toggle so user can see the change
    };
    this.hamburgerDropdown.appendChild(layoutItem);

    hamburgerContainer.appendChild(this.hamburgerDropdown);
  }

  private updateLayoutMenuItemContent(layoutItem: HTMLButtonElement) {
    const orientation = this.tab.getCurrentOrientation();
    const icon =
      orientation === "vertical" ? '<i class="fas fa-grip-lines-vertical"></i>' : '<i class="fas fa-grip-lines"></i>';
    const label = orientation === "vertical" ? "Horizontal Layout" : "Vertical Layout";
    layoutItem.innerHTML = icon + "<span>" + label + "</span>";
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
  }

  private closeHamburgerMenu() {
    this.isHamburgerOpen = false;
    this.hamburgerDropdown.style.display = "none";
    removeClass(this.hamburgerMenuButton, "active");
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
    this.modalContent.onclick = (e) => e.stopPropagation();

    // Header
    const header = document.createElement("div");
    addClass(header, "modalHeader");
    const title = document.createElement("h2");
    title.textContent = "Settings";
    header.appendChild(title);

    const closeBtn = document.createElement("button");
    closeBtn.textContent = "×";
    addClass(closeBtn, "closeButton");
    closeBtn.onclick = () => this.close();
    header.appendChild(closeBtn);

    this.modalContent.appendChild(header);

    // Body with sidebar navigation
    const body = document.createElement("div");
    addClass(body, "modalBody");

    // Sidebar navigation
    const sidebar = document.createElement("div");
    addClass(sidebar, "modalSidebar");

    const requestTab = document.createElement("button");
    requestTab.textContent = "Request";
    addClass(requestTab, "modalNavButton", "active");
    requestTab.onclick = () => this.switchTab("request");

    const endpointsTab = document.createElement("button");
    endpointsTab.textContent = "SPARQL Endpoints";
    addClass(endpointsTab, "modalNavButton");
    endpointsTab.onclick = () => this.switchTab("endpoints");

    const workspacesTab = document.createElement("button");
    workspacesTab.textContent = "Workspaces";
    addClass(workspacesTab, "modalNavButton");
    workspacesTab.onclick = () => this.switchTab("workspaces");

    const prefixTab = document.createElement("button");
    prefixTab.textContent = "Prefixes";
    addClass(prefixTab, "modalNavButton");
    prefixTab.onclick = () => this.switchTab("prefix");

    const editorTab = document.createElement("button");
    editorTab.textContent = "Editor";
    addClass(editorTab, "modalNavButton");
    editorTab.onclick = () => this.switchTab("editor");

    const importExportTab = document.createElement("button");
    importExportTab.textContent = "Import/Export";
    addClass(importExportTab, "modalNavButton");
    importExportTab.onclick = () => this.switchTab("importexport");

    const shortcutsTab = document.createElement("button");
    shortcutsTab.textContent = "Keyboard Shortcuts";
    addClass(shortcutsTab, "modalNavButton");
    shortcutsTab.onclick = () => this.switchTab("shortcuts");

    const aboutTab = document.createElement("button");
    aboutTab.textContent = "About";
    addClass(aboutTab, "modalNavButton");
    aboutTab.onclick = () => this.switchTab("about");

    sidebar.appendChild(requestTab);
    sidebar.appendChild(endpointsTab);
    sidebar.appendChild(workspacesTab);
    sidebar.appendChild(prefixTab);
    sidebar.appendChild(editorTab);
    sidebar.appendChild(importExportTab);
    sidebar.appendChild(shortcutsTab);
    sidebar.appendChild(aboutTab);

    // Content area container
    const contentArea = document.createElement("div");
    addClass(contentArea, "modalContentArea");

    body.appendChild(sidebar);
    body.appendChild(contentArea);

    // Tab content containers
    const requestContent = document.createElement("div");
    addClass(requestContent, "modalTabContent", "active");
    requestContent.id = "request-content";
    this.drawRequestSettings(requestContent);

    const endpointsContent = document.createElement("div");
    addClass(endpointsContent, "modalTabContent");
    endpointsContent.id = "endpoints-content";
    this.drawEndpointsSettings(endpointsContent);

    const workspacesContent = document.createElement("div");
    addClass(workspacesContent, "modalTabContent");
    workspacesContent.id = "workspaces-content";
    this.drawWorkspacesSettings(workspacesContent);

    const prefixContent = document.createElement("div");
    addClass(prefixContent, "modalTabContent");
    prefixContent.id = "prefix-content";
    this.drawPrefixSettings(prefixContent);

    const editorContent = document.createElement("div");
    addClass(editorContent, "modalTabContent");
    editorContent.id = "editor-content";
    this.drawEditorSettings(editorContent);

    const importExportContent = document.createElement("div");
    addClass(importExportContent, "modalTabContent");
    importExportContent.id = "importexport-content";
    this.drawImportExportSettings(importExportContent);

    const shortcutsContent = document.createElement("div");
    addClass(shortcutsContent, "modalTabContent");
    shortcutsContent.id = "shortcuts-content";
    this.drawKeyboardShortcuts(shortcutsContent);

    const aboutContent = document.createElement("div");
    addClass(aboutContent, "modalTabContent");
    aboutContent.id = "about-content";
    this.drawAboutSettings(aboutContent);

    contentArea.appendChild(requestContent);
    contentArea.appendChild(endpointsContent);
    contentArea.appendChild(workspacesContent);
    contentArea.appendChild(prefixContent);
    contentArea.appendChild(editorContent);
    contentArea.appendChild(importExportContent);
    contentArea.appendChild(shortcutsContent);
    contentArea.appendChild(aboutContent);

    this.modalContent.appendChild(body);

    // Footer
    const footer = document.createElement("div");
    addClass(footer, "modalFooter");

    const saveBtn = document.createElement("button");
    saveBtn.textContent = "Save";
    addClass(saveBtn, "primaryButton");
    saveBtn.onclick = () => this.save();

    const cancelBtn = document.createElement("button");
    cancelBtn.textContent = "Cancel";
    addClass(cancelBtn, "secondaryButton");
    cancelBtn.onclick = () => this.close();

    footer.appendChild(cancelBtn);
    footer.appendChild(saveBtn);

    this.modalContent.appendChild(footer);

    this.modalOverlay.appendChild(this.modalContent);
    document.body.appendChild(this.modalOverlay);
  }

  private switchTab(tabName: string) {
    const buttons = this.modalContent.querySelectorAll(".modalNavButton");
    const contents = this.modalContent.querySelectorAll(".modalTabContent");

    buttons.forEach((btn, index) => {
      if (
        (tabName === "request" && index === 0) ||
        (tabName === "endpoints" && index === 1) ||
        (tabName === "workspaces" && index === 2) ||
        (tabName === "prefix" && index === 3) ||
        (tabName === "editor" && index === 4) ||
        (tabName === "importexport" && index === 5) ||
        (tabName === "shortcuts" && index === 6) ||
        (tabName === "about" && index === 7)
      ) {
        addClass(btn as HTMLElement, "active");
      } else {
        removeClass(btn as HTMLElement, "active");
      }
    });

    contents.forEach((content) => {
      if (content.id === `${tabName}-content`) {
        addClass(content as HTMLElement, "active");
        // Reload editor settings if switching to editor tab and it hasn't been loaded yet
        if (tabName === "editor" && content.innerHTML.indexOf("not yet initialized") > -1) {
          content.innerHTML = "";
          this.drawEditorSettings(content as HTMLElement);
        }
        // Refresh endpoints list when switching to endpoints tab
        if (tabName === "endpoints") {
          const endpointsList = content.querySelector(".endpointsTable");
          if (endpointsList) {
            this.renderEndpointsList(endpointsList as HTMLElement);
          }
        }
      } else {
        removeClass(content as HTMLElement, "active");
      }
    });
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
    const section = document.createElement("div");
    addClass(section, "settingsSection");

    const label = document.createElement("label");
    label.textContent = "Saved Prefixes";
    addClass(label, "settingsLabel");

    const help = document.createElement("div");
    help.textContent = "Enter PREFIX declarations (one per line). These will be available for insertion into queries.";
    addClass(help, "settingsHelp");

    this.prefixTextarea = document.createElement("textarea");
    addClass(this.prefixTextarea, "prefixTextarea");
    this.prefixTextarea.placeholder =
      "PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>\nPREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>";
    this.prefixTextarea.rows = 10;

    const checkboxContainer = document.createElement("div");
    addClass(checkboxContainer, "checkboxContainer");

    this.autoCaptureCheckbox = document.createElement("input");
    this.autoCaptureCheckbox.type = "checkbox";
    this.autoCaptureCheckbox.id = "autoCapturePrefixes";

    const checkboxLabel = document.createElement("label");
    checkboxLabel.htmlFor = "autoCapturePrefixes";
    checkboxLabel.textContent = "Automatically capture new prefixes from query editor";

    checkboxContainer.appendChild(this.autoCaptureCheckbox);
    checkboxContainer.appendChild(checkboxLabel);

    section.appendChild(label);
    section.appendChild(help);
    section.appendChild(this.prefixTextarea);
    section.appendChild(checkboxContainer);

    container.appendChild(section);
  }

  private drawEditorSettings(container: HTMLElement) {
    const yasqe = this.tab.getYasqe();
    if (!yasqe) {
      const notice = document.createElement("div");
      notice.textContent = "Query editor is not yet initialized.";
      addClass(notice, "settingsHelp");
      container.appendChild(notice);
      return;
    }

    // Available editor themes. Each theme is a `cm-s-<name>` class applied to the
    // CodeMirror 6 editor root; the styles for these ship with yasgui.
    const themes = [
      { value: "default", label: "Default (Light)" },
      { value: "eclipse", label: "Eclipse (Light)" },
      { value: "idea", label: "IntelliJ IDEA (Light)" },
      { value: "solarized-light", label: "Solarized Light" },
      { value: "github-dark", label: "GitHub Dark Default" },
      { value: "monokai", label: "Monokai (Dark)" },
      { value: "dracula", label: "Dracula (Dark)" },
      { value: "material-darker", label: "Material Darker (Dark)" },
    ];

    // Light Mode Theme Section
    const themeLightSection = document.createElement("div");
    addClass(themeLightSection, "settingsSection");

    const themeLightLabel = document.createElement("label");
    themeLightLabel.textContent = "Editor Theme (Light Mode)";
    addClass(themeLightLabel, "settingsLabel");

    const themeLightHelp = document.createElement("div");
    themeLightHelp.textContent = "Syntax highlighting theme when using light mode.";
    addClass(themeLightHelp, "settingsHelp");

    const themeLightSelect = document.createElement("select");
    themeLightSelect.id = "codeMirrorThemeLightSelect";
    addClass(themeLightSelect, "settingsSelect");

    themes.forEach((theme) => {
      const option = document.createElement("option");
      option.value = theme.value;
      option.textContent = theme.label;
      themeLightSelect.appendChild(option);
    });

    const storedLightTheme = this.tab.yasgui.persistentConfig.getCodeMirrorTheme("light");
    themeLightSelect.value = storedLightTheme || "default";

    themeLightSection.appendChild(themeLightLabel);
    themeLightSection.appendChild(themeLightHelp);
    themeLightSection.appendChild(themeLightSelect);
    container.appendChild(themeLightSection);

    // Dark Mode Theme Section
    const themeDarkSection = document.createElement("div");
    addClass(themeDarkSection, "settingsSection");

    const themeDarkLabel = document.createElement("label");
    themeDarkLabel.textContent = "Editor Theme (Dark Mode)";
    addClass(themeDarkLabel, "settingsLabel");

    const themeDarkHelp = document.createElement("div");
    themeDarkHelp.textContent = "Syntax highlighting theme when using dark mode.";
    addClass(themeDarkHelp, "settingsHelp");

    const themeDarkSelect = document.createElement("select");
    themeDarkSelect.id = "codeMirrorThemeDarkSelect";
    addClass(themeDarkSelect, "settingsSelect");

    themes.forEach((theme) => {
      const option = document.createElement("option");
      option.value = theme.value;
      option.textContent = theme.label;
      themeDarkSelect.appendChild(option);
    });

    const storedDarkTheme = this.tab.yasgui.persistentConfig.getCodeMirrorTheme("dark");
    themeDarkSelect.value = storedDarkTheme || "github-dark";

    themeDarkSection.appendChild(themeDarkLabel);
    themeDarkSection.appendChild(themeDarkHelp);
    themeDarkSection.appendChild(themeDarkSelect);
    container.appendChild(themeDarkSection);

    // Formatter Type Section
    const formatterSection = document.createElement("div");
    addClass(formatterSection, "settingsSection");

    const formatterLabel = document.createElement("label");
    formatterLabel.textContent = "Query Formatter";
    addClass(formatterLabel, "settingsLabel");

    const formatterHelp = document.createElement("div");
    formatterHelp.textContent = "Choose which formatter to use when formatting SPARQL queries (Shift+Ctrl+F).";
    addClass(formatterHelp, "settingsHelp");

    const formatterSelect = document.createElement("select");
    formatterSelect.id = "formatterTypeSelect";
    addClass(formatterSelect, "settingsSelect");

    const sparqlFormatterOption = document.createElement("option");
    sparqlFormatterOption.value = "sparql-formatter";
    sparqlFormatterOption.textContent = "SPARQL Formatter (external library)";
    formatterSelect.appendChild(sparqlFormatterOption);

    const legacyOption = document.createElement("option");
    legacyOption.value = "legacy";
    legacyOption.textContent = "Legacy Formatter (built-in)";
    formatterSelect.appendChild(legacyOption);

    const currentFormatter = yasqe.persistentConfig?.formatterType || "sparql-formatter";
    formatterSelect.value = currentFormatter;

    formatterSection.appendChild(formatterLabel);
    formatterSection.appendChild(formatterHelp);
    formatterSection.appendChild(formatterSelect);
    container.appendChild(formatterSection);

    // Auto-format on Query Section
    const autoformatSection = document.createElement("div");
    addClass(autoformatSection, "settingsSection");

    const autoformatCheckboxContainer = document.createElement("div");
    addClass(autoformatCheckboxContainer, "checkboxContainer");

    const autoformatCheckbox = document.createElement("input");
    autoformatCheckbox.type = "checkbox";
    autoformatCheckbox.id = "autoformatOnQuery";
    autoformatCheckbox.checked = yasqe.persistentConfig?.autoformatOnQuery || true;

    const autoformatLabel = document.createElement("label");
    autoformatLabel.htmlFor = "autoformatOnQuery";
    autoformatLabel.textContent = "Auto-format query before execution";

    const autoformatHelp = document.createElement("div");
    autoformatHelp.textContent = "Automatically format the query using the selected formatter before executing it.";
    addClass(autoformatHelp, "settingsHelp");
    autoformatHelp.style.marginTop = "5px";

    autoformatCheckboxContainer.appendChild(autoformatCheckbox);
    autoformatCheckboxContainer.appendChild(autoformatLabel);

    autoformatSection.appendChild(autoformatCheckboxContainer);
    autoformatSection.appendChild(autoformatHelp);
    container.appendChild(autoformatSection);

    // CONSTRUCT Variable Validation Section
    const constructValidationSection = document.createElement("div");
    addClass(constructValidationSection, "settingsSection");

    const constructValidationCheckboxContainer = document.createElement("div");
    addClass(constructValidationCheckboxContainer, "checkboxContainer");

    const constructValidationCheckbox = document.createElement("input");
    constructValidationCheckbox.type = "checkbox";
    constructValidationCheckbox.id = "checkConstructVariables";
    constructValidationCheckbox.checked = yasqe.config.checkConstructVariables ?? true;

    const constructValidationLabel = document.createElement("label");
    constructValidationLabel.htmlFor = "checkConstructVariables";
    constructValidationLabel.textContent = "Validate CONSTRUCT query variables";

    const constructValidationHelp = document.createElement("div");
    constructValidationHelp.textContent =
      "Show warnings for variables used in CONSTRUCT template but not defined in WHERE clause.";
    addClass(constructValidationHelp, "settingsHelp");
    constructValidationHelp.style.marginTop = "5px";

    constructValidationCheckboxContainer.appendChild(constructValidationCheckbox);
    constructValidationCheckboxContainer.appendChild(constructValidationLabel);

    constructValidationSection.appendChild(constructValidationCheckboxContainer);
    constructValidationSection.appendChild(constructValidationHelp);
    container.appendChild(constructValidationSection);

    // Code Snippets Bar Visibility Section
    const snippetsBarSection = document.createElement("div");
    addClass(snippetsBarSection, "settingsSection");

    const snippetsBarCheckboxContainer = document.createElement("div");
    addClass(snippetsBarCheckboxContainer, "checkboxContainer");

    const snippetsBarCheckbox = document.createElement("input");
    snippetsBarCheckbox.type = "checkbox";
    snippetsBarCheckbox.id = "showSnippetsBar";
    // Read from global config
    const persistedValue = this.tab.yasgui.persistentConfig.getShowSnippetsBar();
    snippetsBarCheckbox.checked =
      persistedValue !== undefined ? persistedValue : this.tab.yasgui.config.showSnippetsBar !== false;

    const snippetsBarLabel = document.createElement("label");
    snippetsBarLabel.htmlFor = "showSnippetsBar";
    snippetsBarLabel.textContent = "Show code snippets bar";

    const snippetsBarHelp = document.createElement("div");
    snippetsBarHelp.textContent =
      "Display the code snippets bar above the editor for quick insertion of common SPARQL patterns.";
    addClass(snippetsBarHelp, "settingsHelp");
    snippetsBarHelp.style.marginTop = "5px";

    snippetsBarCheckboxContainer.appendChild(snippetsBarCheckbox);
    snippetsBarCheckboxContainer.appendChild(snippetsBarLabel);

    snippetsBarSection.appendChild(snippetsBarCheckboxContainer);
    snippetsBarSection.appendChild(snippetsBarHelp);
    container.appendChild(snippetsBarSection);
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

  private drawRequestSettings(container: HTMLElement) {
    // This is a simplified version - you can expand based on TabPanel.ts
    const reqConfig = this.tab.getRequestConfig();

    // Request Method section
    const methodSection = this.createSection("Request Method");
    const methodSelect = this.createSelect(
      ["GET", "POST"],
      typeof reqConfig.method === "function" ? "POST" : reqConfig.method,
    );
    methodSelect.setAttribute("data-config", "method");
    methodSection.appendChild(methodSelect);
    container.appendChild(methodSection);

    // Accept Header sections
    const acceptSection = this.createSection("Accept Header (SELECT/ASK)");
    const acceptSelect = this.createOptionsSelect(AcceptOptionsMap, <string>reqConfig.acceptHeaderSelect);
    acceptSelect.setAttribute("data-config", "acceptHeaderSelect");
    acceptSection.appendChild(acceptSelect);
    container.appendChild(acceptSection);

    const acceptGraphSection = this.createSection("Accept Header (CONSTRUCT/DESCRIBE)");
    const acceptGraphSelect = this.createOptionsSelect(AcceptHeaderGraphMap, <string>reqConfig.acceptHeaderGraph);
    acceptGraphSelect.setAttribute("data-config", "acceptHeaderGraph");
    acceptGraphSection.appendChild(acceptGraphSelect);
    container.appendChild(acceptGraphSection);

    // Custom Headers section
    const headersSection = this.createSection("Custom HTTP Headers");
    const headersContainer = document.createElement("div");
    addClass(headersContainer, "keyValueContainer");
    headersContainer.setAttribute("data-config", "headers");

    // Get existing headers
    const existingHeaders = typeof reqConfig.headers === "function" ? {} : reqConfig.headers || {};
    const headerPairs: KeyValuePair[] = Object.entries(existingHeaders).map(([name, value]) => ({
      name,
      value,
    }));

    // Draw existing headers
    headerPairs.forEach((pair, index) => {
      this.createKeyValueRow(headersContainer, pair, index);
    });

    // Add empty row for adding new headers
    this.createKeyValueRow(headersContainer, { name: "", value: "" }, headerPairs.length);

    headersSection.appendChild(headersContainer);
    container.appendChild(headersSection);
  }

  private createKeyValueRow(container: HTMLElement, pair: KeyValuePair, index: number) {
    const row = document.createElement("div");
    addClass(row, "keyValueRow");

    const nameInput = document.createElement("input");
    nameInput.type = "text";
    nameInput.placeholder = "Header Name";
    nameInput.value = pair.name;
    addClass(nameInput, "keyInput");

    const valueInput = document.createElement("input");
    valueInput.type = "text";
    valueInput.placeholder = "Header Value";
    valueInput.value = pair.value;
    addClass(valueInput, "valueInput");

    const removeButton = document.createElement("button");
    removeButton.type = "button";
    removeButton.innerHTML = '<i class="fas fa-times"></i>';
    removeButton.title = "Remove header";
    addClass(removeButton, "removeButton");

    // Auto-add new empty row when typing in the last row
    const onInput = () => {
      const allRows = container.querySelectorAll(".keyValueRow");
      const isLastRow = row === allRows[allRows.length - 1];

      if (isLastRow && (nameInput.value.trim() || valueInput.value.trim())) {
        // Add a new empty row
        this.createKeyValueRow(container, { name: "", value: "" }, allRows.length);
      }
    };

    nameInput.addEventListener("input", onInput);
    valueInput.addEventListener("input", onInput);

    removeButton.onclick = () => {
      row.remove();
      // Ensure there's always at least one empty row
      const remainingRows = container.querySelectorAll(".keyValueRow");
      if (remainingRows.length === 0) {
        this.createKeyValueRow(container, { name: "", value: "" }, 0);
      }
    };

    row.appendChild(nameInput);
    row.appendChild(valueInput);
    row.appendChild(removeButton);
    container.appendChild(row);
  }

  private createSection(title: string): HTMLElement {
    const section = document.createElement("div");
    addClass(section, "settingsSection");
    const label = document.createElement("div");
    addClass(label, "settingsLabel");
    label.textContent = title;
    section.appendChild(label);
    return section;
  }

  private createSelect(options: string[], selected?: string): HTMLSelectElement {
    const select = document.createElement("select");
    addClass(select, "settingsSelect");
    options.forEach((opt) => {
      const option = document.createElement("option");
      option.value = opt;
      option.textContent = opt;
      if (opt === selected) option.selected = true;
      select.appendChild(option);
    });
    return select;
  }

  private createOptionsSelect(options: { key: string; value: string }[], selected?: string): HTMLSelectElement {
    const select = document.createElement("select");
    addClass(select, "settingsSelect");
    options.forEach((opt) => {
      const option = document.createElement("option");
      option.value = opt.value;
      option.textContent = opt.key;
      if (opt.value === selected) option.selected = true;
      select.appendChild(option);
    });
    return select;
  }

  public open() {
    this.loadSettings();
    // Reload editor settings in case yasqe wasn't available during init
    const editorContent = this.modalContent.querySelector("#editor-content");
    if (editorContent && editorContent.innerHTML === "") {
      this.drawEditorSettings(editorContent as HTMLElement);
    }
    // Refresh endpoints list in case new endpoints were added while modal was closed
    const endpointsContent = this.modalContent.querySelector("#endpoints-content");
    if (endpointsContent) {
      const endpointsList = endpointsContent.querySelector(".endpointsTable");
      if (endpointsList) {
        this.renderEndpointsList(endpointsList as HTMLElement);
      }
    }
    addClass(this.modalOverlay, "open");
    document.addEventListener("keydown", this.handleKeyDown);
  }

  public close() {
    this.mouseDownOnOverlay = false;
    removeClass(this.modalOverlay, "open");
    document.removeEventListener("keydown", this.handleKeyDown);
  }

  private loadSettings() {
    // Load prefix settings
    let prefixes = this.tab.yasgui.persistentConfig.getPrefixes();
    const autoCapture = this.tab.yasgui.persistentConfig.getAutoCaptureEnabled();

    // Set default prefixes if none exist
    if (!prefixes || prefixes.trim().length === 0) {
      prefixes = `PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>\nPREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>`;
      this.tab.yasgui.persistentConfig.setPrefixes(prefixes);
    }

    this.prefixTextarea.value = prefixes;
    this.autoCaptureCheckbox.checked = autoCapture;
  }

  private save() {
    // Save prefix settings
    const prefixText = this.prefixTextarea.value;
    const autoCapture = this.autoCaptureCheckbox.checked;

    // Parse and deduplicate prefixes
    const deduplicated = deduplicatePrefixes(prefixText);
    this.tab.yasgui.persistentConfig.setPrefixes(deduplicated);
    this.tab.yasgui.persistentConfig.setAutoCaptureEnabled(autoCapture);

    // Save editor settings
    const yasqe = this.tab.getYasqe();
    if (yasqe && yasqe.persistentConfig) {
      const codeMirrorThemeLightSelect = document.getElementById("codeMirrorThemeLightSelect") as HTMLSelectElement;
      const codeMirrorThemeDarkSelect = document.getElementById("codeMirrorThemeDarkSelect") as HTMLSelectElement;
      const formatterSelect = document.getElementById("formatterTypeSelect") as HTMLSelectElement;
      const autoformatCheckbox = document.getElementById("autoformatOnQuery") as HTMLInputElement;
      const constructValidationCheckbox = document.getElementById("checkConstructVariables") as HTMLInputElement;

      // Save CodeMirror themes for both light and dark modes
      if (codeMirrorThemeLightSelect) {
        const selectedTheme = codeMirrorThemeLightSelect.value;
        this.tab.yasgui.persistentConfig.setCodeMirrorTheme("light", selectedTheme);
      }

      if (codeMirrorThemeDarkSelect) {
        const selectedTheme = codeMirrorThemeDarkSelect.value;
        this.tab.yasgui.persistentConfig.setCodeMirrorTheme("dark", selectedTheme);
      }

      // Apply the appropriate theme based on current mode
      const currentMode = this.tab.yasgui.getTheme();
      const themeToApply =
        currentMode === "dark"
          ? codeMirrorThemeDarkSelect?.value || "github-dark"
          : codeMirrorThemeLightSelect?.value || "default";

      // Apply theme to all CodeMirror instances
      const cmElements = document.querySelectorAll(".CodeMirror");
      cmElements.forEach((element) => {
        const cm = (element as any).CodeMirror;
        if (cm && cm.setOption) {
          cm.setOption("theme", themeToApply);
        }
      });

      if (formatterSelect) {
        yasqe.persistentConfig.formatterType = formatterSelect.value as "sparql-formatter" | "legacy";
      }
      if (autoformatCheckbox) {
        yasqe.persistentConfig.autoformatOnQuery = autoformatCheckbox.checked;
      }
      if (constructValidationCheckbox) {
        yasqe.setCheckConstructVariables(constructValidationCheckbox.checked);
      }
      const snippetsBarCheckbox = document.getElementById("showSnippetsBar") as HTMLInputElement;
      if (snippetsBarCheckbox) {
        // Save globally to config and persistent storage
        this.tab.yasgui.config.showSnippetsBar = snippetsBarCheckbox.checked;
        this.tab.yasgui.persistentConfig.setShowSnippetsBar(snippetsBarCheckbox.checked);

        // Apply to all tabs by updating each Yasqe instance's config and refreshing
        this.tab.yasgui.persistentConfig.getTabs().forEach((tabId: string) => {
          const tab = this.tab.yasgui.getTab(tabId);
          if (tab) {
            const tabYasqe = tab.getYasqe();
            if (tabYasqe) {
              // Update the individual Yasqe instance's config
              tabYasqe.config.showSnippetsBar = snippetsBarCheckbox.checked;
              // Refresh the snippets bar to reflect the change
              tabYasqe.refreshSnippetsBar();
            }
          }
        });
      }
      yasqe.saveQuery();
    }

    // Save request settings
    const requestContent = this.modalContent.querySelector("#request-content");
    if (requestContent) {
      const selects = requestContent.querySelectorAll("select[data-config]");
      const updates: any = {};
      selects.forEach((select) => {
        const config = (select as HTMLSelectElement).getAttribute("data-config");
        if (config) {
          updates[config] = (select as HTMLSelectElement).value;
        }
      });

      // Save custom headers
      const headersContainer = requestContent.querySelector(".keyValueContainer[data-config='headers']");
      if (headersContainer) {
        const headers: { [key: string]: string } = {};
        const rows = headersContainer.querySelectorAll(".keyValueRow");
        rows.forEach((row) => {
          const nameInput = row.querySelector(".keyInput") as HTMLInputElement;
          const valueInput = row.querySelector(".valueInput") as HTMLInputElement;
          if (nameInput && valueInput && nameInput.value.trim()) {
            headers[nameInput.value.trim()] = valueInput.value;
          }
        });
        updates.headers = headers;
      }

      this.tab.setRequestConfig(updates);
    }

    // Note: Authentication is now handled per-endpoint in the Endpoints tab,
    // not per-tab anymore. No need to save it here.

    // Refresh endpoint buttons to show any changes
    this.tab.refreshEndpointButtons();

    this.close();
  }

  private insertPrefixesIntoQuery() {
    const yasqe = this.tab.getYasqe();
    if (!yasqe) return;

    const savedPrefixes = this.tab.yasgui.persistentConfig.getPrefixes();
    if (!savedPrefixes.trim()) return;

    // Get current query and find where PREFIX declarations end
    const currentQuery = yasqe.getValue();
    const lines = currentQuery.split("\n");

    let firstNonPrefixLine = 0;
    for (let i = 0; i < lines.length; i++) {
      const trimmed = lines[i].trim();
      // Skip empty lines and PREFIX lines
      if (trimmed.length > 0 && !trimmed.toUpperCase().startsWith("PREFIX")) {
        firstNonPrefixLine = i;
        break;
      }
    }

    // If we didn't find a non-PREFIX line, all lines are PREFIX or empty
    if (firstNonPrefixLine === 0 && lines.length > 0) {
      // Check if there's any content at all
      const hasContent = lines.some((line: string) => line.trim().length > 0);
      if (
        !hasContent ||
        lines.every((line: string) => line.trim().length === 0 || line.trim().toUpperCase().startsWith("PREFIX"))
      ) {
        firstNonPrefixLine = lines.length;
      }
    }

    // Keep the rest of the query (non-PREFIX lines)
    const restOfQuery = lines.slice(firstNonPrefixLine).join("\n").trim();

    // Build new query with saved prefixes + rest of query
    const newQuery = savedPrefixes + (restOfQuery ? "\n\n" + restOfQuery : "");
    yasqe.setValue(newQuery);
    yasqe.focus();
  }

  private openMapWidget(event?: MouseEvent) {
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

  private getThemeToggleIcon(): string {
    const currentTheme = this.tab.yasgui.getTheme();
    // In dark mode, show lightbulb icon (clicking will switch to light)
    // In light mode, show moon icon (clicking will switch to dark)
    return currentTheme === "dark" ? '<i class="fas fa-lightbulb"></i>' : '<i class="fas fa-moon"></i>';
  }

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
          { keys: ["Ctrl+Click"], description: "Explore URI connections (on URI)" },
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
    if (this.modalOverlay && this.modalOverlay.parentNode) {
      this.modalOverlay.parentNode.removeChild(this.modalOverlay);
    }
  }
}
