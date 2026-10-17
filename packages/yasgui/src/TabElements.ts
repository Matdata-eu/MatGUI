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

// MatData glyph and the MatGUI name at the start of the top bar
const BRAND_GLYPH =
  '<svg class="yasgui-brand__glyph" width="22" height="22" viewBox="77 51.6 31.8 30.5" fill="currentColor" aria-hidden="true"><circle cx="92.95" cy="67.63" r="2.62"/><path d="M 106.109375 73.820312 C 105.519531 73.820312 104.980469 74.023438 104.539062 74.351562 L 98.109375 70.136719 C 98.480469 69.378906 98.707031 68.539062 98.707031 67.636719 C 98.707031 65.894531 97.910156 64.347656 96.679688 63.292969 L 101.003906 56.984375 C 101.246094 57.054688 101.496094 57.105469 101.757812 57.105469 C 103.203125 57.105469 104.378906 55.929688 104.378906 54.480469 C 104.378906 53.035156 103.203125 51.859375 101.757812 51.859375 C 100.308594 51.859375 99.132812 53.035156 99.132812 54.484375 C 99.132812 55.273438 99.492188 55.976562 100.046875 56.457031 L 95.792969 62.667969 C 94.953125 62.183594 93.992188 61.886719 92.953125 61.886719 C 91.484375 61.886719 90.152344 62.460938 89.132812 63.371094 L 86.175781 60.289062 C 86.542969 59.835938 86.773438 59.269531 86.773438 58.640625 C 86.773438 57.195312 85.597656 56.015625 84.148438 56.015625 C 82.703125 56.015625 81.527344 57.195312 81.527344 58.640625 C 81.527344 60.089844 82.703125 61.265625 84.152344 61.265625 C 84.578125 61.265625 84.972656 61.152344 85.328125 60.972656 L 88.394531 64.171875 C 87.65625 65.140625 87.203125 66.332031 87.203125 67.636719 C 87.203125 68.539062 87.425781 69.378906 87.796875 70.136719 L 81.714844 74.082031 C 81.234375 73.5625 80.554688 73.234375 79.796875 73.234375 C 78.351562 73.234375 77.171875 74.410156 77.171875 75.859375 C 77.171875 77.304688 78.351562 78.480469 79.796875 78.480469 C 81.242188 78.480469 82.421875 77.304688 82.421875 75.859375 C 82.421875 75.5625 82.359375 75.285156 82.269531 75.019531 L 88.363281 71.066406 C 89.179688 72.15625 90.359375 72.957031 91.738281 73.253906 L 91.566406 76.707031 C 90.269531 76.867188 89.261719 77.960938 89.261719 79.296875 C 89.261719 80.742188 90.4375 81.921875 91.882812 81.921875 C 93.332031 81.921875 94.507812 80.742188 94.507812 79.296875 C 94.507812 78.121094 93.722656 77.132812 92.652344 76.800781 L 92.820312 73.375 C 92.867188 73.378906 92.90625 73.390625 92.953125 73.390625 C 94.835938 73.390625 96.492188 72.46875 97.542969 71.066406 L 103.820312 75.183594 C 103.613281 75.558594 103.484375 75.984375 103.484375 76.441406 C 103.484375 77.886719 104.660156 79.066406 106.105469 79.066406 C 107.554688 79.066406 108.730469 77.886719 108.730469 76.441406 C 108.730469 74.996094 107.554688 73.820312 106.109375 73.820312 Z M 101.757812 52.949219 C 102.601562 52.949219 103.292969 53.636719 103.292969 54.484375 C 103.292969 55.328125 102.601562 56.019531 101.757812 56.019531 C 100.910156 56.019531 100.222656 55.328125 100.222656 54.484375 C 100.222656 53.636719 100.910156 52.949219 101.757812 52.949219 Z M 79.796875 77.394531 C 78.953125 77.394531 78.261719 76.703125 78.261719 75.859375 C 78.261719 75.011719 78.953125 74.324219 79.796875 74.324219 C 80.644531 74.324219 81.332031 75.011719 81.332031 75.859375 C 81.332031 76.703125 80.644531 77.394531 79.796875 77.394531 Z M 93.421875 79.296875 C 93.421875 80.144531 92.730469 80.832031 91.886719 80.832031 C 91.039062 80.832031 90.351562 80.144531 90.351562 79.296875 C 90.351562 78.453125 91.039062 77.761719 91.886719 77.761719 C 92.730469 77.761719 93.421875 78.453125 93.421875 79.296875 Z M 82.617188 58.640625 C 82.617188 57.792969 83.304688 57.105469 84.152344 57.105469 C 84.996094 57.105469 85.6875 57.792969 85.6875 58.640625 C 85.6875 59.488281 84.996094 60.175781 84.152344 60.175781 C 83.304688 60.175781 82.617188 59.488281 82.617188 58.640625 Z M 92.953125 72.300781 C 90.382812 72.300781 88.289062 70.210938 88.289062 67.636719 C 88.289062 65.066406 90.382812 62.972656 92.953125 62.972656 C 95.527344 62.972656 97.617188 65.066406 97.617188 67.636719 C 97.617188 70.210938 95.523438 72.300781 92.953125 72.300781 Z M 106.109375 77.976562 C 105.265625 77.976562 104.574219 77.289062 104.574219 76.441406 C 104.574219 75.59375 105.265625 74.90625 106.109375 74.90625 C 106.957031 74.90625 107.644531 75.59375 107.644531 76.441406 C 107.644531 77.289062 106.957031 77.976562 106.109375 77.976562 Z"/></svg>';

function drawBrand(): HTMLDivElement {
  const brand = document.createElement("div");
  brand.className = "yasgui-brand";
  brand.innerHTML = BRAND_GLYPH + '<span class="yasgui-brand__name">Mat<span>GUI</span></span>';
  return brand;
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

    if (this.yasgui.config.showBrand) this._queryBrowserToggleEl.appendChild(drawBrand());

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
