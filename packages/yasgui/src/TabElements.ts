import Yasgui from "./";
import TabContextMenu from "./TabContextMenu";
import { hasClass, addClass, removeClass } from "@matdata/yasgui-utils";
import sortablejs from "sortablejs";
import { icon, iconButton } from "./icons";
import "./TabElements.scss";

export interface TabList {}
export class TabListEl {
  private tabList: TabList;
  private tabId: string;
  private yasgui: Yasgui;
  private renameEl?: HTMLInputElement;
  private nameEl?: HTMLSpanElement;
  public tabEl?: HTMLDivElement;
  private renameSubmitted = false;
  constructor(yasgui: Yasgui, tabList: TabList, tabId: string) {
    this.tabList = tabList;
    this.yasgui = yasgui;
    this.tabId = tabId;
  }
  public delete() {
    if (this.tabEl) {
      this.tabList._tabsListEl?.removeChild(this.tabEl);
      delete this.tabList._tabs[this.tabId];
    }
  }
  public startRename() {
    if (this.renameEl) {
      const tab = this.yasgui.getTab(this.tabId);
      if (tab) {
        this.renameSubmitted = false;
        this.renameEl.value = tab.name();
        addClass(this.tabEl, "renaming");
        this.renameEl.focus();
      }
    }
  }
  public active(active: boolean) {
    if (!this.tabEl) return;
    if (active) {
      addClass(this.tabEl, "active");
      // add aria-properties
      this.tabEl.children[0].setAttribute("aria-selected", "true");
      this.tabEl.children[0].setAttribute("tabindex", "0");
    } else {
      removeClass(this.tabEl, "active");
      // remove aria-properties
      this.tabEl.children[0].setAttribute("aria-selected", "false");
      this.tabEl.children[0].setAttribute("tabindex", "-1");
    }
  }
  public rename(name: string) {
    if (this.nameEl) {
      this.nameEl.textContent = name;
    }
  }
  public setAsQuerying(querying: boolean) {
    if (querying) {
      addClass(this.tabEl, "querying");
    } else {
      removeClass(this.tabEl, "querying");
    }
  }
  public setAsRenaming(renaming: boolean) {
    if (renaming) {
      addClass(this.tabEl, "renamingInProgress");
      if (this.renameEl) this.renameEl.disabled = true;
    } else {
      removeClass(this.tabEl, "renamingInProgress");
      if (this.renameEl) this.renameEl.disabled = false;
    }
  }
  public draw(name: string) {
    this.tabEl = document.createElement("div");
    this.tabEl.setAttribute("role", "presentation");
    this.tabEl.ondblclick = () => {
      this.startRename();
    };
    addClass(this.tabEl, "tab");

    const tabConf = this.yasgui.persistentConfig.getTab(this.tabId) as any;
    if (tabConf?.managedQuery) {
      addClass(this.tabEl, "managed");
    }

    // Set initial dirty state for managed queries (e.g., after reload).
    const initialTab = this.yasgui.getTab(this.tabId);
    if (initialTab?.hasUnsavedManagedChanges?.()) {
      addClass(this.tabEl, "managedDirty");
    }

    this.tabEl.addEventListener("keydown", (e: KeyboardEvent) => {
      // Don't handle Delete key if we're renaming the tab (input field is active)
      if (!this.tabEl) return;
      if (e.code === "Delete" && !this.tabEl.classList.contains("renaming")) {
        handleDeleteTab();
      }
    });

    const handleDeleteTab = (e?: MouseEvent) => {
      e?.preventDefault();
      this.yasgui.getTab(this.tabId)?.close();
    };

    const tabLinkEl = document.createElement("a");
    tabLinkEl.setAttribute("role", "tab");
    tabLinkEl.href = "#" + this.tabId;
    tabLinkEl.id = "tab-" + this.tabId; // use the id for the tabpanel which is tabId to set the actual tab id
    tabLinkEl.setAttribute("aria-controls", this.tabId); // respective tabPanel id
    // Note: draggable attribute removed - CSS user-select:none prevents text selection during drag
    tabLinkEl.addEventListener("blur", () => {
      if (!this.tabEl) return;
      if (this.tabEl.classList.contains("active")) {
        tabLinkEl.setAttribute("tabindex", "0");
      } else {
        tabLinkEl.setAttribute("tabindex", "-1");
      }
    });
    tabLinkEl.addEventListener("focus", () => {
      if (!this.tabEl) return;
      if (this.tabEl.classList.contains("active")) {
        // Keep arrow-key navigation in sync with actual DOM order
        const listEl = this.tabList._tabsListEl;
        if (!listEl) return;
        this.tabList.tabEntryIndex = Array.prototype.indexOf.call(listEl.children, this.tabEl);
      }
    });
    // if (this.yasgui.persistentConfig.tabIsActive(this.tabId)) {
    //   this.yasgui.store.dispatch(selectTab(this.tabId))
    // }
    tabLinkEl.addEventListener("click", (e) => {
      e.preventDefault();
      this.yasgui.selectTabId(this.tabId);
    });

    // Prevent anchor default drag behavior that interferes with SortableJS in some browsers
    tabLinkEl.addEventListener("dragstart", (e) => {
      e.preventDefault();
    });
    tabLinkEl.addEventListener("mousedown", (e) => {
      // Only prevent default on middle/right click to avoid navigation
      if (e.button !== 0) {
        e.preventDefault();
      }
    });

    //tab name
    this.nameEl = document.createElement("span");
    this.nameEl.textContent = name;
    tabLinkEl.appendChild(this.nameEl);

    //tab close btn
    const closeBtn = document.createElement("div");
    closeBtn.innerHTML = icon("x", 14, 2);
    closeBtn.title = "Close tab";
    closeBtn.setAttribute("tabindex", "-1");
    closeBtn.setAttribute("aria-hidden", "true");
    addClass(closeBtn, "closeTab");
    closeBtn.addEventListener("click", handleDeleteTab);
    tabLinkEl.appendChild(closeBtn);

    const renameEl = (this.renameEl = document.createElement("input"));
    renameEl.type = "text";
    renameEl.value = name;
    const submitRename = () => {
      if (this.renameSubmitted) return;
      this.renameSubmitted = true;
      void this.yasgui.getTab(this.tabId)?.renameTab(renameEl.value);
      removeClass(this.tabEl, "renaming");
    };
    renameEl.onkeyup = (event) => {
      if (event.key === "Enter") {
        submitRename();
      }
    };
    renameEl.onblur = () => {
      submitRename();
    };
    // Prevent sortablejs from detecting drag events on the input field
    renameEl.addEventListener("mousedown", (e) => {
      e.stopPropagation();
    });
    renameEl.addEventListener("dragstart", (e) => {
      e.stopPropagation();
    });
    tabLinkEl.appendChild(this.renameEl);
    tabLinkEl.oncontextmenu = (ev: MouseEvent) => {
      // Close possible old
      this.tabList.tabContextMenu?.closeConfigMenu();
      this.openTabConfigMenu(ev);
      ev.preventDefault();
      ev.stopPropagation();
    };
    this.tabEl.appendChild(tabLinkEl);

    //draw loading animation overlay
    const loaderEl = document.createElement("div");
    addClass(loaderEl, "loader");
    this.tabEl.appendChild(loaderEl);

    return this.tabEl;
  }
  private openTabConfigMenu(event: MouseEvent) {
    this.tabList.tabContextMenu?.openConfigMenu(this.tabId, this, event);
  }
  redrawContextMenu() {
    this.tabList.tabContextMenu?.redraw();
  }
}

export class TabList {
  yasgui: Yasgui;

  private _selectedTab?: string;
  private addTabEl?: HTMLDivElement;
  public _tabs: { [tabId: string]: TabListEl } = {};
  public _tabsListEl?: HTMLDivElement;
  public tabContextMenu?: TabContextMenu;
  public tabEntryIndex: number | undefined;
  private _queryBrowserToggleEl?: HTMLDivElement;
  private _actionsEl?: HTMLDivElement;
  private themeObserver?: MutationObserver;

  constructor(yasgui: Yasgui) {
    this.yasgui = yasgui;
    this.registerListeners();
    this.tabEntryIndex = this.getActiveIndex();
  }
  get(tabId: string) {
    return this._tabs[tabId];
  }

  private registerListeners() {
    this.yasgui.on("query", (_yasgui, tab) => {
      const id = tab.getId();
      if (this._tabs[id]) {
        this._tabs[id].setAsQuerying(true);
      }
    });
    this.yasgui.on("queryResponse", (_yasgui, tab) => {
      const id = tab.getId();
      if (this._tabs[id]) {
        this._tabs[id].setAsQuerying(false);
      }
    });
    this.yasgui.on("queryAbort", (_yasgui, tab) => {
      const id = tab.getId();
      if (this._tabs[id]) {
        this._tabs[id].setAsQuerying(false);
      }
    });

    this.yasgui.on("tabChange", (_yasgui, tab) => {
      const id = tab.getId();
      const tabEl = this._tabs[id]?.tabEl;
      if (!tabEl) return;

      if (tab.isManagedQueryTab()) {
        addClass(tabEl, "managed");
      } else {
        removeClass(tabEl, "managed");
      }

      if (tab.hasUnsavedManagedChanges()) {
        addClass(tabEl, "managedDirty");
      } else {
        removeClass(tabEl, "managedDirty");
      }
    });
  }
  private getActiveIndex() {
    if (!this._selectedTab) return;
    const allTabs = Object.keys(this._tabs);
    const currentTabIndex = allTabs.indexOf(this._selectedTab);
    return currentTabIndex;
  }
  private handleKeydownArrowKeys = (e: KeyboardEvent) => {
    if (e.code === "ArrowLeft" || e.code === "ArrowRight") {
      // Don't handle arrow keys if we're typing in the rename input field
      if (document.activeElement?.tagName === "INPUT") return;
      if (!this._tabsListEl) return;
      const numOfChildren = this._tabsListEl.childElementCount;
      if (typeof this.tabEntryIndex !== "number") return;

      // The side panel toggle and the global actions are not tabs
      const isQueryBrowserToggleEntry = (el: Element) =>
        !!(el as HTMLElement).querySelector?.(".queryBrowserToggle") ||
        (el as HTMLElement).classList?.contains("yasgui-topBarActions");
      const advance = (direction: -1 | 1) => {
        let nextIndex = this.tabEntryIndex as number;
        for (let i = 0; i < numOfChildren; i++) {
          nextIndex += direction;
          if (nextIndex < 0) nextIndex = numOfChildren - 1;
          if (nextIndex >= numOfChildren) nextIndex = 0;

          const candidate = this._tabsListEl!.children[nextIndex];
          if (isQueryBrowserToggleEntry(candidate)) continue;
          if (!candidate.children[0]) continue;
          return nextIndex;
        }
        return this.tabEntryIndex as number;
      };

      const tabEntryDiv = this._tabsListEl.children[this.tabEntryIndex];
      // If the current tab does not have active set its tabindex to -1
      if (!tabEntryDiv.classList.contains("active")) {
        tabEntryDiv.children[0]?.setAttribute("tabindex", "-1"); // cur tab removed from tab index
      }
      if (e.code === "ArrowLeft") {
        this.tabEntryIndex = advance(-1);
      }
      if (e.code === "ArrowRight") {
        this.tabEntryIndex = advance(1);
      }
      const newTabEntryDiv = this._tabsListEl.children[this.tabEntryIndex];
      newTabEntryDiv.children[0]?.setAttribute("tabindex", "0");
      (newTabEntryDiv.children[0] as HTMLElement | undefined)?.focus(); // focus on the a tag inside the div for click event
    }
  };
  drawTabsList() {
    this._tabsListEl = document.createElement("div");
    addClass(this._tabsListEl, "tabsList");
    this._tabsListEl.setAttribute("role", "tablist");
    this._tabsListEl.addEventListener("keydown", this.handleKeydownArrowKeys);

    this._queryBrowserToggleEl = document.createElement("div");
    this._queryBrowserToggleEl.setAttribute("role", "presentation");
    addClass(this._queryBrowserToggleEl, "yasgui-panelToggleEntry");

    // Shows or hides the left side panel (Queries / Endpoint). Keeps the `queryBrowserToggle` class
    // of the former query browser button, so existing selectors keep working.
    const panelButton = iconButton("panelLeft", "Side panel", {
      className: "queryBrowserToggle yasgui-panelToggle",
      showLabel: true,
      title: "Show or hide the side panel with your saved queries and the endpoint overview",
    });
    (panelButton.querySelector(".yasgui-btnLabel") as HTMLElement).textContent = "Panel";
    panelButton.setAttribute("aria-expanded", "false");
    panelButton.addEventListener("click", () => {
      const sidePanel = this.yasgui.sidePanel;
      if (sidePanel) sidePanel.toggle();
      else this.yasgui.queryBrowser.toggle(panelButton);
    });
    this.yasgui.sidePanel?.onChange((state) => {
      const expanded = state.open && !state.collapsed;
      panelButton.setAttribute("aria-expanded", String(expanded));
      panelButton.classList.toggle("active", expanded);
    });

    this._queryBrowserToggleEl.appendChild(panelButton);
    this._tabsListEl.appendChild(this._queryBrowserToggleEl);

    sortablejs.create(this._tabsListEl, {
      group: "tabList",
      animation: 100,
      draggable: ".tab",
      forceFallback: true,
      fallbackTolerance: 3,
      onUpdate: (_ev: any) => {
        const tabs = this.deriveTabOrderFromEls();
        this.yasgui.emit("tabOrderChanged", this.yasgui, tabs);
        this.yasgui.persistentConfig.setTabOrder(tabs);
      },
      filter: ".queryBrowserToggle, .addTab, .yasgui-topBarActions, input, .renaming, .closeTab",
      preventOnFilter: false,
      onMove: (ev: any, _origEv: any) => {
        return hasClass(ev.related, "tab");
      },
    });

    this.addTabEl = document.createElement("div");
    this.addTabEl.setAttribute("role", "presentation");

    const addTabLink = document.createElement("button");
    addTabLink.className = "addTab";
    addTabLink.innerHTML = icon("plus", 18, 2);
    addTabLink.title = "Add tab";
    addTabLink.setAttribute("aria-label", "Add a new tab");
    addTabLink.addEventListener("click", this.handleAddNewTab);
    addTabLink.addEventListener("focus", () => {
      // sets aria tabEntryIndex to active tab
      // this.tabEntryIndex = this.getActiveIndex();
      if (!this._tabsListEl) return;
      // sets tabEntry to add tab, visually makes sense, not sure about accessibility-wise
      this.tabEntryIndex = Array.prototype.indexOf.call(this._tabsListEl.children, this.addTabEl);
    });
    addTabLink.addEventListener("blur", () => {
      addTabLink.setAttribute("tabindex", "0"); // maintains tabability
    });
    this.addTabEl.appendChild(addTabLink);
    this._tabsListEl.appendChild(this.addTabEl);
    this._tabsListEl.appendChild(this.drawGlobalActions());
    this.tabContextMenu = TabContextMenu.get(
      this.yasgui,
      this.yasgui.config.contextMenuContainer ? this.yasgui.config.contextMenuContainer : this._tabsListEl,
    );
    return this._tabsListEl;
  }
  /**
   * Global actions at the right of the top bar: help, theme and settings
   */
  private drawGlobalActions(): HTMLDivElement {
    const actions = document.createElement("div");
    actions.setAttribute("role", "presentation");
    addClass(actions, "yasgui-topBarActions");
    this._actionsEl = actions;

    const helpUrl = this.yasgui.config.helpUrl;
    if (helpUrl) {
      const help = iconButton("help", "Help", {
        className: "yasgui-topBarButton yasgui-helpButton",
        title: "Open the documentation",
        size: 20,
      });
      help.addEventListener("click", () => window.open(helpUrl, "_blank", "noopener,noreferrer"));
      actions.appendChild(help);
    }

    if (this.yasgui.config.showThemeToggle) {
      const theme = document.createElement("button");
      theme.type = "button";
      theme.className = "yasgui-topBarButton themeToggle";
      const update = () => {
        const dark = this.yasgui.getTheme() === "dark";
        theme.innerHTML = icon(dark ? "sun" : "moon", 20);
        const label = dark ? "Switch to light theme" : "Switch to dark theme";
        theme.title = label;
        theme.setAttribute("aria-label", label);
      };
      update();
      theme.addEventListener("click", () => {
        this.yasgui.toggleTheme();
        update();
      });
      // The theme can also change through the system preference or the API
      if (typeof MutationObserver !== "undefined") {
        this.themeObserver = new MutationObserver(update);
        this.themeObserver.observe(this.yasgui.rootEl, { attributes: true, attributeFilter: ["data-theme"] });
      }
      actions.appendChild(theme);
    }

    const settings = iconButton("settings", "Settings", {
      className: "yasgui-topBarButton yasgui-settingsButton",
      size: 20,
    });
    settings.addEventListener("click", () => this.yasgui.getTab()?.openSettings());
    actions.appendChild(settings);
    return actions;
  }
  handleAddNewTab = (event: Event) => {
    event.preventDefault();
    this.yasgui.addTab(true);
  };
  // drawPanels() {
  //   this.tabPanelsEl = document.createElement("div");
  //   return this.tabsListEl;
  // }
  public addTab(tabId: string, index?: number) {
    return this.drawTab(tabId, index);
  }
  public deriveTabOrderFromEls() {
    const tabs: string[] = [];
    if (this._tabsListEl) {
      for (let i = 0; i < this._tabsListEl.children.length; i++) {
        const child = this._tabsListEl.children[i]; //this is the tab div
        const anchorTag = child.children[0]; //this one has an href
        if (anchorTag) {
          const href = (<HTMLAnchorElement>anchorTag).href;
          if (href && href.indexOf("#") >= 0) {
            tabs.push(href.substr(href.indexOf("#") + 1));
          }
        }
      }
    }
    return tabs;
  }

  public selectTab(tabId: string) {
    this._selectedTab = tabId;
    for (const id in this._tabs) {
      this._tabs[id].active(this._selectedTab === id);
    }
  }

  public drawTab(tabId: string, index?: number) {
    this._tabs[tabId] = new TabListEl(this.yasgui, this, tabId);
    const tabConf = this.yasgui.persistentConfig.getTab(tabId);
    if (index !== undefined && index < this.yasgui.persistentConfig.getTabs().length - 1) {
      this._tabsListEl?.insertBefore(
        this._tabs[tabId].draw(tabConf.name),
        this._tabs[this.yasgui.persistentConfig.getTabs()[index + 1]].tabEl || null,
      );
    } else {
      this._tabsListEl?.insertBefore(this._tabs[tabId].draw(tabConf.name), this.addTabEl || null);
    }
  }
  public destroy() {
    for (const tabId in this._tabs) {
      const tab = this._tabs[tabId];
      tab.delete();
    }
    this._tabs = {};
    this.tabContextMenu?.destroy();
    this.themeObserver?.disconnect();
    this._actionsEl = undefined;
    this._tabsListEl?.remove();
    this._tabsListEl = undefined;
    this._queryBrowserToggleEl = undefined;
  }
}

export default TabList;
