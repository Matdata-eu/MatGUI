import { addClass, removeClass } from "@matdata/yasgui-utils";
import type { Yasgui } from "../";
import type { SidePanelState } from "../PersistentConfig";
import { iconButton, IconName, modKeyLabel } from "../icons";
import "./SidePanel.scss";

export type SidePanelView = SidePanelState["view"];

const MIN_WIDTH = 260;
const MAX_WIDTH = 640;
const DEFAULT_WIDTH = 300;
/** Below this width the panel floats over the content instead of pushing it aside */
export const NARROW_BREAKPOINT = 768;

function defaultState(): SidePanelState {
  return { open: false, collapsed: false, pinned: false, view: "queries", width: DEFAULT_WIDTH };
}

interface ViewEntry {
  view: SidePanelView;
  label: string;
  icon: IconName;
  tabButton: HTMLButtonElement;
  railButton: HTMLButtonElement;
  container: HTMLDivElement;
}

/**
 * The single left side panel of Yasgui. It hosts the query browser ("Queries") and the
 * endpoint overview ("Endpoint") as tabs, and can be pinned, collapsed to a rail or closed.
 *
 * The existing public entry points (`yasgui.queryBrowser.*`, `yasgui.endpointDescribe.*`) delegate to this panel.
 */
export default class SidePanel {
  private yasgui: Yasgui;
  private rootEl: HTMLElement;
  private railEl: HTMLDivElement;
  private bodyEl: HTMLDivElement;
  private tabsEl: HTMLDivElement;
  private viewsEl: HTMLDivElement;
  private pinButton: HTMLButtonElement;
  private resizerEl: HTMLDivElement;
  private views = new Map<SidePanelView, ViewEntry>();
  private state: SidePanelState;
  private listeners: Array<(state: SidePanelState) => void> = [];
  private returnFocusEl?: HTMLElement;

  constructor(yasgui: Yasgui) {
    this.yasgui = yasgui;
    // Only a pinned panel is restored when the page loads
    const persisted = yasgui.persistentConfig.getSidePanelState();
    this.state = { ...defaultState(), ...(persisted || {}) };
    if (!this.state.pinned) this.state.open = false;

    this.rootEl = document.createElement("aside");
    addClass(this.rootEl, "yasgui-sidePanel");
    this.rootEl.setAttribute("aria-label", "Side panel");

    // Rail with a button per view, shown whenever the panel is not expanded (on narrow screens only when collapsed)
    this.railEl = document.createElement("div");
    addClass(this.railEl, "yasgui-sidePanel__rail");
    const expand = iconButton("panelLeft", "Open side panel", {
      className: "yasgui-sidePanel__railButton yasgui-sidePanel__expand",
      title: `Open side panel (${modKeyLabel()}+B)`,
    });
    expand.addEventListener("click", () => this.show());
    this.railEl.appendChild(expand);
    const railDivider = document.createElement("div");
    addClass(railDivider, "yasgui-sidePanel__railDivider");
    this.railEl.appendChild(railDivider);
    this.rootEl.appendChild(this.railEl);
    document.addEventListener("keydown", this.handleGlobalKeydown);

    this.bodyEl = document.createElement("div");
    addClass(this.bodyEl, "yasgui-sidePanel__body");

    const header = document.createElement("div");
    addClass(header, "yasgui-sidePanel__header");
    this.tabsEl = document.createElement("div");
    addClass(this.tabsEl, "yasgui-sidePanel__tabs");
    this.tabsEl.setAttribute("role", "tablist");
    this.tabsEl.setAttribute("aria-label", "Side panel views");
    header.appendChild(this.tabsEl);

    const actions = document.createElement("div");
    addClass(actions, "yasgui-sidePanel__actions");
    this.pinButton = iconButton("pin", "Pin panel", { className: "yasgui-sidePanel__action yasgui-sidePanel__pin" });
    this.pinButton.addEventListener("click", () => this.setPinned(!this.state.pinned));
    const collapseButton = iconButton("chevronsLeft", `Collapse panel (${modKeyLabel()}+B)`, {
      className: "yasgui-sidePanel__action yasgui-sidePanel__collapse",
    });
    collapseButton.addEventListener("click", () => this.collapse());
    const closeButton = iconButton("x", "Close panel", {
      className: "yasgui-sidePanel__action yasgui-sidePanel__close",
    });
    closeButton.addEventListener("click", () => this.close());
    actions.append(this.pinButton, collapseButton, closeButton);
    header.appendChild(actions);
    this.bodyEl.appendChild(header);

    this.viewsEl = document.createElement("div");
    addClass(this.viewsEl, "yasgui-sidePanel__views");
    this.bodyEl.appendChild(this.viewsEl);
    this.rootEl.appendChild(this.bodyEl);

    this.resizerEl = document.createElement("div");
    addClass(this.resizerEl, "yasgui-sidePanel__resizer");
    this.resizerEl.title = "Drag to resize, double-click to reset";
    this.resizerEl.addEventListener("mousedown", this.startResize);
    this.resizerEl.addEventListener("dblclick", () => {
      this.state.width = DEFAULT_WIDTH;
      this.apply();
    });
    this.rootEl.appendChild(this.resizerEl);

    this.rootEl.addEventListener("keydown", (event) => {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      if (!this.isOpen() || this.state.collapsed) return;
      // Leave Escape to open menus, pickers and modals inside the panel
      if ((event.target as HTMLElement | null)?.closest?.("[role='menu'], .yasgui-query-browser__context-menu")) return;
      if (this.state.pinned && !this.isNarrow()) return;
      event.preventDefault();
      this.close();
    });

    this.apply(false);
  }

  /** Ctrl+B / ⌘B shows or hides the panel, from anywhere in this Yasgui instance */
  private handleGlobalKeydown = (event: KeyboardEvent) => {
    if (!(event.ctrlKey || event.metaKey) || event.altKey || event.shiftKey) return;
    if (event.key.toLowerCase() !== "b" || !this.views.size) return;
    const target = event.target as Node | null;
    if (!target || !(this.yasgui.rootEl.contains(target) || target === document.body)) return;
    // Inside a text field Ctrl+B is left alone; the query editor is not one of those
    const el = target as HTMLElement;
    if (el.closest?.("input, textarea, [contenteditable='true']") && !el.closest?.(".yasqe")) return;
    event.preventDefault();
    if (this.state.open && !this.state.collapsed) {
      if (this.isNarrow()) this.close();
      else this.collapse();
    } else {
      this.show();
    }
  };

  public getElement(): HTMLElement {
    return this.rootEl;
  }

  /**
   * Register a view (tab) of the panel. Returns the element its content should be appended to.
   * With `before`, the view is placed before that view (when it exists) instead of at the end.
   */
  public addView(
    view: SidePanelView,
    label: string,
    iconName: IconName,
    options: { before?: SidePanelView } = {},
  ): HTMLDivElement {
    const existing = this.views.get(view);
    if (existing) return existing.container;
    const tabButton = document.createElement("button");
    tabButton.type = "button";
    tabButton.setAttribute("role", "tab");
    tabButton.id = `yasgui-sidePanel-tab-${view}-${Math.random().toString(36).substring(7)}`;
    addClass(tabButton, "yasgui-sidePanel__tab");
    tabButton.dataset.view = view;
    tabButton.textContent = label;
    tabButton.addEventListener("click", () => this.show(view));
    tabButton.addEventListener("keydown", (event) => {
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      const all = Array.from(this.views.values());
      const index = all.findIndex((entry) => entry.view === view);
      const next = all[(index + (event.key === "ArrowRight" ? 1 : all.length - 1)) % all.length];
      this.show(next.view);
      next.tabButton.focus();
    });
    const next = options.before ? this.views.get(options.before) : undefined;
    this.tabsEl.insertBefore(tabButton, next ? next.tabButton : null);

    const railButton = iconButton(iconName, label, { className: "yasgui-sidePanel__railButton" });
    railButton.dataset.view = view;
    railButton.addEventListener("click", () => this.show(view));
    this.railEl.insertBefore(railButton, next ? next.railButton : null);

    const container = document.createElement("div");
    addClass(container, "yasgui-sidePanel__view");
    container.dataset.view = view;
    container.setAttribute("role", "tabpanel");
    container.setAttribute("aria-labelledby", tabButton.id);
    this.viewsEl.insertBefore(container, next ? next.container : null);

    const entry = { view, label, icon: iconName, tabButton, railButton, container };
    if (next) {
      // Keep the map in display order, for the arrow keys and the default view
      const entries = Array.from(this.views.entries());
      const index = entries.findIndex(([key]) => key === options.before);
      entries.splice(index, 0, [view, entry]);
      this.views = new Map(entries);
    } else {
      this.views.set(view, entry);
    }
    this.apply(false);
    return container;
  }

  public hasView(view: SidePanelView): boolean {
    return this.views.has(view);
  }

  public onChange(listener: (state: SidePanelState) => void) {
    this.listeners.push(listener);
  }

  public getState(): SidePanelState {
    return { ...this.state };
  }
  public isOpen(): boolean {
    return this.state.open;
  }
  public isCollapsed(): boolean {
    return this.state.open && this.state.collapsed;
  }
  public isPinned(): boolean {
    return this.state.pinned;
  }
  public getView(): SidePanelView {
    return this.state.view;
  }
  /** True when the given view is the visible content of an expanded panel */
  public isViewVisible(view: SidePanelView): boolean {
    return this.state.open && !this.state.collapsed && this.state.view === view;
  }

  /**
   * Open (or expand) the panel, optionally on a given view
   */
  public show(view?: SidePanelView) {
    if (view && this.views.has(view)) this.state.view = view;
    if (
      !this.state.open &&
      document.activeElement instanceof HTMLElement &&
      !this.rootEl.contains(document.activeElement)
    ) {
      this.returnFocusEl = document.activeElement;
    }
    this.state.open = true;
    this.state.collapsed = false;
    this.apply();
  }

  public close() {
    if (!this.state.open) return;
    const hadFocus = this.rootEl.contains(document.activeElement);
    this.state.open = false;
    this.state.collapsed = false;
    this.apply();
    if (hadFocus) {
      const target = this.returnFocusEl && this.returnFocusEl.isConnected ? this.returnFocusEl : undefined;
      (target || (this.yasgui.rootEl.querySelector(".yasgui-panelToggle") as HTMLElement | null))?.focus();
    }
    this.returnFocusEl = undefined;
  }

  /** Move the panel out of the way, leaving a narrow rail */
  public collapse() {
    if (!this.state.open || this.state.collapsed) return;
    this.state.collapsed = true;
    this.apply();
  }

  /** Toggle the panel. With a view: show that view, or close the panel when it is already showing it. */
  public toggle(view?: SidePanelView) {
    if (view ? this.isViewVisible(view) : this.state.open && !this.state.collapsed) this.close();
    else this.show(view);
  }

  public setPinned(pinned: boolean) {
    this.state.pinned = pinned;
    this.apply();
  }

  /**
   * Restore the panel on load. `legacy` is the state of the former endpoint describe panel,
   * so a describe panel that was pinned open before the redesign comes back as the Endpoint view.
   */
  public restore(legacy?: { open: boolean; pinned: boolean }) {
    const persisted = this.yasgui.persistentConfig.getSidePanelState();
    if (!persisted && legacy && legacy.open && legacy.pinned && this.views.has("endpoint")) {
      this.state = { ...this.state, open: true, collapsed: false, pinned: true, view: "endpoint" };
    }
    if (!this.views.has(this.state.view)) {
      const first = this.views.keys().next();
      if (!first.done) this.state.view = first.value;
    }
    this.apply(false);
  }

  /** Called by the auto-collapse logic: an unpinned panel moves out of the way when the user starts editing */
  public yieldToEditor() {
    if (!this.state.open || this.state.collapsed || this.state.pinned) return;
    if (this.isNarrow()) this.close();
    else this.collapse();
  }

  private isNarrow(): boolean {
    const width = this.yasgui.rootEl.getBoundingClientRect().width || window.innerWidth;
    return width < NARROW_BREAKPOINT;
  }

  private apply(persist = true) {
    const { open, collapsed, pinned } = this.state;
    const firstView = this.views.keys().next();
    const view = this.views.has(this.state.view) || firstView.done ? this.state.view : firstView.value;
    this.rootEl.classList.toggle("open", open);
    this.rootEl.classList.toggle("collapsed", open && collapsed);
    this.rootEl.classList.toggle("pinned", pinned);
    this.rootEl.classList.toggle("hasTabs", this.views.size > 1);
    this.rootEl.classList.toggle("hasViews", this.views.size > 0);
    this.rootEl.style.setProperty("--yasgui-side-panel-width", `${this.clampWidth(this.state.width)}px`);
    this.rootEl.setAttribute("aria-hidden", String(!open));
    this.pinButton.setAttribute("aria-pressed", String(pinned));
    this.pinButton.title = pinned ? "Unpin panel" : "Pin panel (keep it open)";
    this.pinButton.setAttribute("aria-label", this.pinButton.title);
    for (const entry of this.views.values()) {
      const active = entry.view === view;
      entry.tabButton.setAttribute("aria-selected", String(active));
      entry.tabButton.tabIndex = active ? 0 : -1;
      entry.railButton.setAttribute("aria-pressed", String(active && open && !collapsed));
      entry.railButton.classList.toggle("lastView", active);
      entry.container.hidden = !active;
    }
    if (persist) this.yasgui.persistentConfig.setSidePanelState({ ...this.state });
    for (const listener of this.listeners) listener(this.getState());
    if (persist) this.refreshActiveTab();
  }

  private refreshActiveTab() {
    const tab = this.yasgui.getTab();
    if (!tab) return;
    tab.getYasqe()?.refresh();
    tab.getYasr()?.refresh();
  }

  private clampWidth(width: number) {
    return Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, width || DEFAULT_WIDTH));
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
    const left = this.rootEl.getBoundingClientRect().left;
    const max = Math.min(MAX_WIDTH, this.yasgui.rootEl.getBoundingClientRect().width * 0.6);
    const width = Math.max(MIN_WIDTH, Math.min(max, event.clientX - left));
    this.state.width = Math.round(width);
    this.rootEl.style.setProperty("--yasgui-side-panel-width", `${this.state.width}px`);
  };

  private stopResize = () => {
    removeClass(this.rootEl, "resizing");
    document.documentElement.removeEventListener("mousemove", this.doResize);
    document.documentElement.removeEventListener("mouseup", this.stopResize);
    this.apply();
  };

  public destroy() {
    document.removeEventListener("keydown", this.handleGlobalKeydown);
    document.documentElement.removeEventListener("mousemove", this.doResize);
    document.documentElement.removeEventListener("mouseup", this.stopResize);
    this.listeners = [];
    this.rootEl.remove();
  }
}
