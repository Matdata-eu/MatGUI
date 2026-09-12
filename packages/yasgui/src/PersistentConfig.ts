import { Storage as YStorage } from "@matdata/yasgui-utils";
import Yasgui, { EndpointButton, EndpointConfig } from "./";
import * as Tab from "./Tab";
import type { WorkspaceConfig } from "./queryManagement/types";
export var storageNamespace = "triply";
export interface PersistedJson {
  endpointHistory: string[];
  tabs: string[];
  active: string | undefined;
  tabConfig: { [tabId: string]: Tab.PersistedJson };
  lastClosedTab: { index: number; tab: Tab.PersistedJson } | undefined;
  prefixes?: string;
  autoCaptureEnabled?: boolean;
  customEndpointButtons?: EndpointButton[]; // Legacy, kept for backwards compatibility
  endpointConfigs?: EndpointConfig[]; // New endpoint-based storage with auth
  workspaces?: WorkspaceConfig[];
  activeWorkspaceId?: string;
  theme?: "light" | "dark";
  orientation?: "vertical" | "horizontal";
  showSnippetsBar?: boolean;
  disabledDevButtons?: string[]; // Endpoints of developer-configured buttons that are disabled by user
  codeMirrorThemeLight?: string; // User-selected CodeMirror theme for light mode
  codeMirrorThemeDark?: string; // User-selected CodeMirror theme for dark mode
}
function getDefaults(): PersistedJson {
  return {
    endpointHistory: [],
    tabs: [],
    active: undefined,
    tabConfig: {},
    lastClosedTab: undefined,
    prefixes: "",
    autoCaptureEnabled: true,
    customEndpointButtons: [],
    endpointConfigs: [],
    workspaces: [],
    activeWorkspaceId: undefined,
  };
}

export default class PersistentConfig {
  private persistedJson!: PersistedJson;
  private storageId: string | undefined;
  private yasgui: Yasgui;
  private storage: YStorage;
  constructor(yasgui: Yasgui) {
    this.yasgui = yasgui;
    this.storageId = this.yasgui.getStorageId(this.yasgui.config.persistenceLabelConfig);
    this.storage = new YStorage(storageNamespace);
    this.fromStorage();
    this.registerListeners();
  }

  public setActive(id: string) {
    this.persistedJson.active = id;
    this.toStorage();
  }
  public getActiveId(): string | undefined {
    return this.persistedJson.active;
  }
  public addToTabList(tabId: string, index?: number) {
    if (index !== undefined && this.persistedJson.tabs.length > index) {
      this.persistedJson.tabs.splice(index, 0, tabId);
    } else {
      this.persistedJson.tabs.push(tabId);
    }

    this.toStorage();
  }
  public setTabOrder(tabs: string[]) {
    this.persistedJson.tabs = tabs;
    this.toStorage();
  }
  public getEndpointHistory() {
    return this.persistedJson.endpointHistory;
  }
  public retrieveLastClosedTab() {
    const tabCopy = this.persistedJson.lastClosedTab;
    if (tabCopy === undefined) return tabCopy;
    this.persistedJson.lastClosedTab = undefined;
    return tabCopy;
  }
  public hasLastClosedTab() {
    return !!this.persistedJson.lastClosedTab;
  }
  public deleteTab(tabId: string) {
    const i = this.persistedJson.tabs.indexOf(tabId);
    if (i > -1) {
      this.persistedJson.tabs.splice(i, 1);
    }
    if (this.tabIsActive(tabId)) {
      this.persistedJson.active = undefined;
    }
    this.persistedJson.lastClosedTab = { index: i, tab: this.persistedJson.tabConfig[tabId] };
    delete this.persistedJson.tabConfig[tabId];
    this.toStorage();
  }
  private registerListeners() {
    this.yasgui.on("tabChange", (_yasgui, tab) => {
      this.persistedJson.tabConfig[tab.getId()] = tab.getPersistedJson();
      this.toStorage();
    });
    this.yasgui.on("endpointHistoryChange", (_yasgui, history) => {
      this.persistedJson.endpointHistory = history;
      this.toStorage();
    });
  }

  private toStorage() {
    this.storage.set(
      this.storageId,
      this.persistedJson,
      this.yasgui.config.persistencyExpire,
      this.handleLocalStorageQuotaFull,
    );
  }
  private fromStorage(): PersistedJson {
    this.persistedJson = this.storage.get<PersistedJson>(this.storageId) || getDefaults();
    /**
     * Modify some settings for backwards compatability
     */
    if (!this.persistedJson.endpointHistory) {
      this.persistedJson.endpointHistory = [];
    }
    return this.persistedJson;
  }

  private handleLocalStorageQuotaFull(_e: any) {
    console.warn("Localstorage quota exceeded. Clearing all Matgui configurations");
    PersistentConfig.clear();
  }

  public getTabs() {
    return this.persistedJson.tabs;
  }
  public getTab(tabId: string) {
    return this.persistedJson.tabConfig[tabId];
  }

  /**
   * We shouldnt normally need this (as this object simply listens to tab change events)
   * Only exception is when we're loading a tab config from the url
   * Then we'd like to forward that config to this object, so we can simply keep initializing from this persistence class
   */
  public setTab(tabId: string, tabConfig: Tab.PersistedJson) {
    this.persistedJson.tabs.push(tabId);
    this.persistedJson.tabConfig[tabId] = tabConfig;
    this.persistedJson.active = tabId;
  }
  public tabIsActive(tabId: string) {
    return tabId === this.persistedJson.active;
  }
  public currentId() {
    return this.persistedJson.active;
  }
  public getPrefixes(): string {
    return this.persistedJson.prefixes || "";
  }
  public setPrefixes(prefixes: string) {
    this.persistedJson.prefixes = prefixes;
    this.toStorage();
  }
  public getAutoCaptureEnabled(): boolean {
    return this.persistedJson.autoCaptureEnabled !== false;
  }
  public setAutoCaptureEnabled(enabled: boolean) {
    this.persistedJson.autoCaptureEnabled = enabled;
    this.toStorage();
  }
  public getCustomEndpointButtons(): EndpointButton[] {
    return this.persistedJson.customEndpointButtons || [];
  }
  public setCustomEndpointButtons(buttons: EndpointButton[]) {
    this.persistedJson.customEndpointButtons = buttons;
    this.toStorage();
  }

  public getShowSnippetsBar(): boolean | undefined {
    return this.persistedJson.showSnippetsBar;
  }

  public setShowSnippetsBar(show: boolean) {
    this.persistedJson.showSnippetsBar = show;
    this.toStorage();
  }

  public getCodeMirrorTheme(mode: "light" | "dark"): string | undefined {
    return mode === "dark" ? this.persistedJson.codeMirrorThemeDark : this.persistedJson.codeMirrorThemeLight;
  }

  public setCodeMirrorTheme(mode: "light" | "dark", theme: string) {
    if (mode === "dark") {
      this.persistedJson.codeMirrorThemeDark = theme;
    } else {
      this.persistedJson.codeMirrorThemeLight = theme;
    }
    this.toStorage();
  }

  // New endpoint configuration methods
  public getEndpointConfigs(): EndpointConfig[] {
    return this.persistedJson.endpointConfigs || [];
  }

  public setEndpointConfigs(configs: EndpointConfig[]) {
    this.persistedJson.endpointConfigs = configs;
    this.toStorage();
  }

  public addOrUpdateEndpoint(endpoint: string, updates: Partial<Omit<EndpointConfig, "endpoint">>) {
    const configs = this.getEndpointConfigs();
    const existingIndex = configs.findIndex((c) => c.endpoint === endpoint);

    if (existingIndex >= 0) {
      // Update existing endpoint
      const merged = { ...configs[existingIndex], ...updates };
      if ("authentication" in updates && updates.authentication === undefined) {
        delete merged.authentication;
      }
      configs[existingIndex] = merged;
    } else {
      // Add new endpoint
      configs.push({ endpoint, ...updates });
    }

    this.setEndpointConfigs(configs);
  }

  public getEndpointConfig(endpoint: string): EndpointConfig | undefined {
    const configs = this.getEndpointConfigs();
    return configs.find((c) => c.endpoint === endpoint);
  }

  public deleteEndpointConfig(endpoint: string) {
    const configs = this.getEndpointConfigs();
    const filtered = configs.filter((c) => c.endpoint !== endpoint);
    this.setEndpointConfigs(filtered);
  }

  public getWorkspaces(): WorkspaceConfig[] {
    return this.persistedJson.workspaces || [];
  }

  public getWorkspace(workspaceId: string): WorkspaceConfig | undefined {
    return this.getWorkspaces().find((w) => w.id === workspaceId);
  }

  public setWorkspaces(workspaces: WorkspaceConfig[]) {
    this.persistedJson.workspaces = workspaces;
    this.toStorage();
  }

  public addOrUpdateWorkspace(workspace: WorkspaceConfig) {
    const workspaces = this.getWorkspaces();
    const existingIndex = workspaces.findIndex((w) => w.id === workspace.id);
    const now = new Date().toISOString();

    if (existingIndex >= 0) {
      const existing = workspaces[existingIndex];
      workspaces[existingIndex] = {
        ...existing,
        ...workspace,
        createdAt: existing.createdAt || workspace.createdAt || now,
        updatedAt: now,
      };
    } else {
      workspaces.push({
        ...workspace,
        createdAt: workspace.createdAt || now,
        updatedAt: now,
      });
    }

    this.setWorkspaces(workspaces);
  }

  public deleteWorkspace(workspaceId: string) {
    const workspaces = this.getWorkspaces();
    const filtered = workspaces.filter((w) => w.id !== workspaceId);
    this.setWorkspaces(filtered);

    if (this.getActiveWorkspaceId() === workspaceId) {
      this.setActiveWorkspaceId(undefined);
    }
  }

  public getActiveWorkspaceId(): string | undefined {
    return this.persistedJson.activeWorkspaceId;
  }

  public setActiveWorkspaceId(workspaceId: string | undefined) {
    this.persistedJson.activeWorkspaceId = workspaceId;
    this.toStorage();
  }
  public static clear() {
    const storage = new YStorage(storageNamespace);
    storage.removeNamespace();
  }

  /**
   * Get the current persisted configuration (for export purposes)
   */
  public getPersistedConfig(): PersistedJson {
    return this.persistedJson;
  }

  /**
   * Update the persisted configuration (for import purposes)
   */
  public updatePersistedConfig(config: Partial<PersistedJson>) {
    Object.assign(this.persistedJson, config);
    this.toStorage();
  }

  /**
   * Get list of disabled developer-configured endpoint buttons
   */
  public getOrientation(): "vertical" | "horizontal" | undefined {
    return this.persistedJson.orientation;
  }

  public setOrientation(orientation: "vertical" | "horizontal") {
    this.persistedJson.orientation = orientation;
    this.toStorage();
  }

  public getDisabledDevButtons(): string[] {
    return this.persistedJson.disabledDevButtons || [];
  }

  /**
   * Set list of disabled developer-configured endpoint buttons
   */
  public setDisabledDevButtons(endpoints: string[]) {
    this.persistedJson.disabledDevButtons = endpoints;
    this.toStorage();
  }

  /**
   * Toggle a developer button enabled/disabled state
   */
  public toggleDevButton(endpoint: string, enabled: boolean) {
    const disabled = this.getDisabledDevButtons();
    if (enabled) {
      // Remove from disabled list
      const filtered = disabled.filter((e) => e !== endpoint);
      this.setDisabledDevButtons(filtered);
    } else {
      // Add to disabled list
      if (!disabled.includes(endpoint)) {
        disabled.push(endpoint);
        this.setDisabledDevButtons(disabled);
      }
    }
  }
}
