import { EventEmitter } from "events";
import { addClass, removeClass, getAsValue } from "@matdata/yasgui-utils";
import { TabListEl } from "./TabElements";
import TabSettingsModal from "./TabSettingsModal";
import { default as Yasqe, RequestConfig, PlainRequestConfig, PartialConfig as YasqeConfig } from "@matdata/yasqe";
import {
  default as Yasr,
  Parser,
  Config as YasrConfig,
  PersistentConfig as YasrPersistentConfig,
  PluginQueryOptions as YasrPluginQueryOptions,
  buildSubjectOfQuery,
  buildObjectOfQuery,
} from "@matdata/yasr";
import { mapValues, eq, mergeWith, words, deburr, invert } from "lodash-es";
import * as shareLink from "./linkUtils";
import EndpointSelect from "./endpointSelect";
import "./tab.scss";
import { getRandomId, default as Yasgui, YasguiRequestConfig } from "./";
import * as OAuth2Utils from "./OAuth2Utils";
import type { ManagedTabMetadata } from "./queryManagement/types";
import { hashQueryText } from "./queryManagement/textHash";
import SaveManagedQueryModal from "./queryManagement/SaveManagedQueryModal";
import { saveManagedQuery } from "./queryManagement/saveManagedQuery";
import { getWritableWorkspaces, isWorkspaceReadOnly } from "./queryManagement/readOnlyWorkspace";
import { getWorkspaceBackend } from "./queryManagement/backends/getWorkspaceBackend";
import { asWorkspaceBackendError } from "./queryManagement/backends/errors";
import { normalizeQueryFilename } from "./queryManagement/normalizeQueryFilename";
import { resolveEndpointUrl } from "./urlUtils";
import InsertMenu, { SnippetLike } from "./InsertMenu";
import { createIriHover } from "./IriHoverInfo";
import { icon, iconButton, runShortcutLabel, IconName } from "./icons";

export interface PersistedJsonYasr extends YasrPersistentConfig {
  responseSummary: Parser.ResponseSummary;
}

export interface PersistedJson {
  name: string;
  id: string;
  yasqe: {
    value: string;
    editorHeight?: string;
  };
  yasr: {
    settings: YasrPersistentConfig;
    response: Parser.ResponseSummary | undefined;
  };
  requestConfig: YasguiRequestConfig;
  orientation?: "vertical" | "horizontal";
  managedQuery?: ManagedTabMetadata;
}

export interface Tab {
  on(event: string | symbol, listener: (...args: any[]) => void): this;

  on(event: "change", listener: (tab: Tab, config: PersistedJson) => void): this;
  emit(event: "change", tab: Tab, config: PersistedJson): boolean;
  on(event: "query", listener: (tab: Tab) => void): this;
  emit(event: "query", tab: Tab): boolean;
  on(event: "queryBefore", listener: (tab: Tab) => void): this;
  emit(event: "queryBefore", tab: Tab): boolean;
  on(event: "queryAbort", listener: (tab: Tab) => void): this;
  emit(event: "queryAbort", tab: Tab): boolean;
  on(event: "queryResponse", listener: (tab: Tab) => void): this;
  emit(event: "queryResponse", tab: Tab): boolean;
  on(event: "close", listener: (tab: Tab) => void): this;
  emit(event: "close", tab: Tab): boolean;
  on(event: "endpointChange", listener: (tab: Tab, endpoint: string) => void): this;
  emit(event: "endpointChange", tab: Tab, endpoint: string): boolean;
  on(event: "autocompletionShown", listener: (tab: Tab, widget: any) => void): this;
  emit(event: "autocompletionShown", tab: Tab, widget: any): boolean;
  on(event: "autocompletionClose", listener: (tab: Tab) => void): this;
  emit(event: "autocompletionClose", tab: Tab): boolean;
}

export class Tab extends EventEmitter {
  private persistentJson: PersistedJson;
  public yasgui: Yasgui;
  private yasqe: Yasqe | undefined;
  private yasr: Yasr | undefined;
  private rootEl: HTMLDivElement | undefined;
  private controlBarEl: HTMLDivElement | undefined;
  private yasqeWrapperEl: HTMLDivElement | undefined;
  private yasrWrapperEl: HTMLDivElement | undefined;
  private endpointSelect: EndpointSelect | undefined;
  private settingsModal?: TabSettingsModal;
  private runButton?: HTMLButtonElement;
  private insertMenu?: InsertMenu;
  private versionChipEl?: HTMLSpanElement;
  private editorToolbarEl?: HTMLDivElement;
  private titleEl?: HTMLDivElement;
  private currentOrientation: "vertical" | "horizontal";
  private orientationToggleButton?: HTMLButtonElement;
  private editorToolsEl?: HTMLDivElement;
  private verticalResizerEl?: HTMLDivElement;
  private editorWrapperEl?: HTMLDivElement;

  constructor(yasgui: Yasgui, conf: PersistedJson) {
    super();
    if (!conf || conf.id === undefined) throw new Error("Expected a valid configuration to initialize tab with");
    this.yasgui = yasgui;
    this.persistentJson = conf;
    this.currentOrientation = this.yasgui.config.orientation || "vertical";
  }

  public name() {
    return this.persistentJson.name;
  }

  public getPersistedJson() {
    return this.persistentJson;
  }

  public getId() {
    return this.persistentJson.id;
  }

  public getManagedQueryMetadata(): ManagedTabMetadata | undefined {
    return this.persistentJson.managedQuery;
  }

  public setManagedQueryMetadata(metadata: ManagedTabMetadata | undefined) {
    if (metadata) {
      this.persistentJson.managedQuery = metadata;
    } else {
      delete this.persistentJson.managedQuery;
    }
    this.emit("change", this, this.persistentJson);
  }

  public isManagedQueryTab(): boolean {
    return !!this.persistentJson.managedQuery;
  }

  public hasUnsavedManagedChanges(): boolean {
    const meta = this.getManagedQueryMetadata();
    if (!meta) return false;
    if (!meta.lastSavedTextHash) return false;
    // Edits to a query from a read-only workspace can never be saved back, so they are not "unsaved changes".
    if (isWorkspaceReadOnly(this.yasgui.persistentConfig.getWorkspace(meta.workspaceId))) return false;

    try {
      const current = this.yasqe ? this.yasqe.getValue() : this.persistentJson.yasqe.value;
      const currentHash = hashQueryText(current);
      return currentHash !== meta.lastSavedTextHash;
    } catch {
      return false;
    }
  }

  private getDefaultSaveModalValues(): { workspaceId?: string; folderPath?: string; filename?: string; name?: string } {
    const meta = this.getManagedQueryMetadata();
    if (!meta) return { name: this.name() };
    if (meta.backendType !== "git") return { workspaceId: meta.workspaceId };
    const path = (meta.queryRef as any)?.path as string | undefined;
    if (!path) return { workspaceId: meta.workspaceId };

    const parts = path.split("/");
    const filename = parts.pop();
    const folderPath = parts.join("/");

    return {
      workspaceId: meta.workspaceId,
      folderPath,
      filename,
      name: this.name(),
    };
  }

  private getManagedQueryIdFromMetadata(meta: ManagedTabMetadata): string | undefined {
    if (meta.backendType === "git") return (meta.queryRef as any)?.path as string | undefined;
    return (meta.queryRef as any)?.managedQueryIri as string | undefined;
  }

  private versionRefFromVersionTag(backendType: "git" | "sparql", versionTag: string | undefined) {
    if (!versionTag) return undefined;
    if (backendType === "git") return { commitSha: versionTag };
    return { managedQueryVersionIri: versionTag };
  }

  private getQueryTextForSave(): string {
    // Saving can be triggered while the tab exists but the editor isn't initialized yet.
    // In that case fall back to the persisted tab value.
    try {
      if (this.yasqe) return this.yasqe.getValue();
    } catch {
      // ignore
    }
    return this.persistentJson.yasqe.value;
  }

  public async downloadAsRqFile() {
    const query = this.getQueryTextForSave();
    const tabName = this.name() || "query";
    const filename = tabName.endsWith(".rq") || tabName.endsWith(".sparql") ? tabName : `${tabName}.rq`;
    const blob = new Blob([query], { type: "application/sparql-query" });

    // Use File System Access API if available so the user can choose the save location
    if ("showSaveFilePicker" in window) {
      try {
        const showSaveFilePicker = (
          window as Window & { showSaveFilePicker: (...args: unknown[]) => Promise<FileSystemFileHandle> }
        ).showSaveFilePicker;
        const fileHandle = await showSaveFilePicker({
          suggestedName: filename,
          types: [{ description: "SPARQL Query", accept: { "application/sparql-query": [".rq", ".sparql"] } }],
        });
        const writable = await fileHandle.createWritable();
        await writable.write(blob);
        await writable.close();
        return;
      } catch (e: any) {
        // User cancelled the picker – abort silently
        if (e?.name === "AbortError") return;
        // Other errors fall through to the legacy download below
      }
    }

    // Fallback for browsers without File System Access API
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  public async saveManagedQueryOrSaveAsManagedQuery(): Promise<void> {
    const meta = this.getManagedQueryMetadata();
    if (!meta) {
      await this.saveAsManagedQuery();
      return;
    }

    const queryId = this.getManagedQueryIdFromMetadata(meta);
    if (!queryId) {
      await this.saveAsManagedQuery();
      return;
    }

    const workspace = this.yasgui.persistentConfig.getWorkspace(meta.workspaceId);
    if (!workspace) {
      window.alert("Selected workspace no longer exists");
      return;
    }

    // A query from a read-only workspace can never be updated in place; offer to save a copy elsewhere.
    if (isWorkspaceReadOnly(workspace)) {
      await this.saveAsManagedQuery();
      return;
    }

    const backend = getWorkspaceBackend(workspace, { persistentConfig: this.yasgui.persistentConfig });

    const expectedVersionTag = (() => {
      if (!meta?.lastSavedVersionRef) return undefined;
      if (meta.backendType === "git") return (meta.lastSavedVersionRef as any)?.commitSha;
      return (meta.lastSavedVersionRef as any)?.managedQueryVersionIri;
    })();

    try {
      await backend.writeQuery(queryId, this.getQueryTextForSave(), { expectedVersionTag });
    } catch (e) {
      const err = asWorkspaceBackendError(e);
      if (err.code === "CONFLICT") {
        if (meta.backendType === "git") {
          // Best-effort self-heal: some providers use a file sha for optimistic concurrency.
          // If our stored version tag is stale/incorrect but the remote content is unchanged,
          // refresh the tag and retry once.
          try {
            const latest = await backend.readQuery(queryId);
            const latestHash = hashQueryText(latest.queryText);
            if (meta.lastSavedTextHash && meta.lastSavedTextHash === latestHash && latest.versionTag) {
              await backend.writeQuery(queryId, this.getQueryTextForSave(), { expectedVersionTag: latest.versionTag });
            } else {
              window.alert(
                "Save conflict. Resolve the conflict externally (e.g., pull/rebase/merge) and then try saving again.",
              );
              return;
            }
          } catch {
            window.alert(
              "Save conflict. Resolve the conflict externally (e.g., pull/rebase/merge) and then try saving again.",
            );
            return;
          }
        } else {
          window.alert("Save conflict. Refresh the query and try again.");
          return;
        }
      }
      window.alert(err.message);
      return;
    }

    const read = await backend.readQuery(queryId);
    const lastSavedTextHash = hashQueryText(read.queryText);
    const lastSavedVersionRef = this.versionRefFromVersionTag(meta.backendType, read.versionTag);
    this.setManagedQueryMetadata({
      ...meta,
      lastSavedTextHash,
      lastSavedVersionRef,
    });

    // Ensure Query Browser reflects the updated version/metadata.
    this.yasgui.queryBrowser.invalidateAndRefresh(meta.workspaceId);
  }

  public async saveAsManagedQuery(): Promise<void> {
    if (getWritableWorkspaces(this.yasgui.persistentConfig.getWorkspaces()).length === 0) {
      window.alert("There is no workspace to save to. Read-only workspaces cannot be saved to.");
      return;
    }

    const modal = new SaveManagedQueryModal(this.yasgui);

    const defaults = this.getDefaultSaveModalValues();
    let result:
      | {
          workspaceId: string;
          folderPath: string;
          name: string;
          filename: string;
          message?: string;
        }
      | undefined;

    try {
      const modalDefaults: any = {
        workspaceId: defaults.workspaceId,
        folderPath: defaults.folderPath || "",
        name: defaults.name || this.name(),
      };
      // Only provide a filename default when we have one.
      // Otherwise the modal will derive a suggested filename from the provided name.
      if (defaults.filename) modalDefaults.filename = defaults.filename;

      result = await modal.show(modalDefaults);
    } catch {
      return;
    }

    const workspace = this.yasgui.persistentConfig.getWorkspace(result.workspaceId);
    if (!workspace) {
      window.alert("Selected workspace no longer exists");
      return;
    }
    if (isWorkspaceReadOnly(workspace)) {
      window.alert("This workspace is read-only");
      return;
    }

    const backend = getWorkspaceBackend(workspace, { persistentConfig: this.yasgui.persistentConfig });
    const meta = this.getManagedQueryMetadata();

    const expectedVersionTag = (() => {
      // A version tag only applies when saving over the same query in the same workspace.
      if (meta?.workspaceId !== workspace.id) return undefined;
      if (!meta?.lastSavedVersionRef) return undefined;
      if (meta.backendType === "git") return (meta.lastSavedVersionRef as any)?.commitSha;
      return (meta.lastSavedVersionRef as any)?.managedQueryVersionIri;
    })();

    try {
      modal.notifySaveInProgress();
      const { managedMetadata } = await saveManagedQuery({
        backend,
        backendType: workspace.type,
        workspaceId: workspace.id,
        workspaceIri: workspace.type === "sparql" ? workspace.workspaceIri : undefined,
        folderPath: result.folderPath,
        name: result.name,
        filename: result.filename,
        queryText: this.getQueryTextForSave(),
        associatedEndpoint: workspace.type === "sparql" ? resolveEndpointUrl(this.getEndpoint()) : undefined,
        message: result.message,
        expectedVersionTag,
      });

      modal.notifySaveComplete();
      this.setManagedQueryMetadata(managedMetadata);
      if (result.name && result.name.trim()) {
        this.setName(result.name.trim());
      }

      // Ensure the saved query shows up immediately in the Query Browser.
      this.yasgui.queryBrowser.invalidateAndRefresh(workspace.id);
    } catch (e) {
      modal.notifySaveComplete();
      const err = asWorkspaceBackendError(e);
      window.alert(err.message);
    }
  }

  private draw() {
    if (this.rootEl) return; //aready drawn
    this.rootEl = document.createElement("div");
    this.rootEl.className = "tabPanel";
    this.rootEl.id = this.persistentJson.id;
    this.rootEl.setAttribute("role", "tabpanel");
    this.rootEl.setAttribute("aria-labelledby", "tab-" + this.persistentJson.id);

    // Apply orientation class
    addClass(this.rootEl, `orientation-${this.currentOrientation}`);

    // We group controlbar and Yasqe, so that users can easily .appendChild() to the .editorwrapper div
    // to add a div that goes alongside the controlbar and editor, while YASR still goes full width
    // Useful for adding an infos div that goes alongside the editor without needing to rebuild the whole Matgui class
    const editorWrapper = document.createElement("div");
    editorWrapper.className = "editorwrapper";
    this.editorWrapperEl = editorWrapper;
    const controlbarAndYasqeDiv = document.createElement("div");
    //controlbar
    this.controlBarEl = document.createElement("div");
    this.controlBarEl.className = "controlbar";
    controlbarAndYasqeDiv.appendChild(this.controlBarEl);

    //yasqe
    this.yasqeWrapperEl = document.createElement("div");
    controlbarAndYasqeDiv.appendChild(this.yasqeWrapperEl);
    editorWrapper.appendChild(controlbarAndYasqeDiv);

    //yasr
    this.yasrWrapperEl = document.createElement("div");
    this.yasrWrapperEl.className = "yasrWrapperEl";

    this.initTabSettingsMenu();
    this.rootEl.appendChild(editorWrapper);

    // Add vertical resizer for horizontal layout
    this.drawVerticalResizer();

    this.rootEl.appendChild(this.yasrWrapperEl);
    this.initControlbar();
    this.initYasqe();
    this.initYasr();
    this.yasgui._setPanel(this.persistentJson.id, this.rootEl);
  }

  public hide() {
    removeClass(this.rootEl, "active");
    this.detachKeyboardListeners();
  }

  public show() {
    this.draw();
    addClass(this.rootEl, "active");
    this.yasgui.tabElements.selectTab(this.persistentJson.id);
    if (this.yasqe) {
      this.yasqe.refresh();
      if (this.yasgui.config.autofocus) this.yasqe.focus();
    }
    if (this.yasr) {
      this.yasr.refresh();
    }
    //refresh, as other tabs might have changed the endpoint history
    this.setEndpoint(this.getEndpoint(), this.yasgui.persistentConfig.getEndpointHistory());
    this.attachKeyboardListeners();
  }

  private handleKeyDown = (event: KeyboardEvent) => {
    if (event.defaultPrevented) return;

    // Ctrl+, → backward (less recently used), Ctrl+Alt+, → forward (more recently used)
    // Ctrl+Tab / Ctrl+Shift+Tab cannot be used: the browser intercepts them before keydown fires
    const isTabSwitchShortcut = (event.ctrlKey || event.metaKey) && !event.shiftKey && event.key === ",";
    if (isTabSwitchShortcut) {
      event.preventDefault();
      this.yasgui.selectRecentlyUsedTab(event.altKey ? "forward" : "backward");
      return;
    }

    const saveModalOpen = !!document.querySelector(".saveManagedQueryModalOverlay.open");
    if (!saveModalOpen) {
      const isSaveShortcut =
        (event.ctrlKey || event.metaKey) && !event.shiftKey && !event.altKey && event.key.toLowerCase() === "s";
      if (isSaveShortcut) {
        event.preventDefault();
        void this.saveManagedQueryOrSaveAsManagedQuery();
        return;
      }
    }

    // F8 - Toggle the endpoint describe panel
    if (event.key === "F8" && this.yasgui.endpointDescribe) {
      event.preventDefault();
      this.yasgui.endpointDescribe.toggle();
      return;
    }

    // F11 - Toggle Yasqe fullscreen
    if (event.key === "F11") {
      event.preventDefault();
      if (this.yasqe) {
        this.yasqe.toggleFullscreen();
        // If Yasr is fullscreen, exit it
        if (this.yasr?.getIsFullscreen()) {
          this.yasr.toggleFullscreen();
        }
      }
    }
    // F10 - Toggle Yasr fullscreen
    else if (event.key === "F10") {
      event.preventDefault();
      if (this.yasr) {
        this.yasr.toggleFullscreen();
        // If Yasqe is fullscreen, exit it
        if (this.yasqe?.getIsFullscreen()) {
          this.yasqe.toggleFullscreen();
        }
      }
    }
    // F9 - Switch between fullscreen modes
    else if (event.key === "F9") {
      event.preventDefault();
      const yasqeFullscreen = this.yasqe?.getIsFullscreen();
      const yasrFullscreen = this.yasr?.getIsFullscreen();

      if (yasqeFullscreen) {
        // Switch from Yasqe to Yasr fullscreen
        this.yasqe?.toggleFullscreen();
        this.yasr?.toggleFullscreen();
      } else if (yasrFullscreen) {
        // Switch from Yasr to Yasqe fullscreen
        this.yasr?.toggleFullscreen();
        this.yasqe?.toggleFullscreen();
      } else {
        // If neither is fullscreen, make Yasqe fullscreen
        this.yasqe?.toggleFullscreen();
      }
    }
  };

  private attachKeyboardListeners() {
    if (!this.rootEl) return;
    document.addEventListener("keydown", this.handleKeyDown);
  }

  private detachKeyboardListeners() {
    document.removeEventListener("keydown", this.handleKeyDown);
  }

  public select() {
    this.yasgui.selectTabId(this.persistentJson.id);
  }

  public close() {
    if (this.isManagedQueryTab() && this.hasUnsavedManagedChanges()) {
      const wantsSave = window.confirm("This managed query has unsaved changes. Save before closing?");
      if (wantsSave) {
        void this.saveManagedQueryOrSaveAsManagedQuery().then(() => {
          // Only close if we actually saved (metadata updated so no longer dirty)
          if (!this.hasUnsavedManagedChanges()) {
            this.closeNow();
          }
        });
        return;
      }

      const discard = window.confirm("Discard changes and close the tab?");
      if (!discard) return;
    }

    this.closeNow();
  }

  private closeNow() {
    this.detachKeyboardListeners();
    if (this.yasqe) this.yasqe.abortQuery();
    if (this.yasgui.getTab() === this) {
      //it's the active tab
      //first select other tab
      const tabs = this.yasgui.persistentConfig.getTabs();
      const i = tabs.indexOf(this.persistentJson.id);
      if (i > -1) {
        this.yasgui.selectTabId(tabs[i === tabs.length - 1 ? i - 1 : i + 1]);
      }
    }
    this.yasgui._removePanel(this.rootEl);
    this.yasgui.persistentConfig.deleteTab(this.persistentJson.id);
    this.yasgui.emit("tabClose", this.yasgui, this);
    this.emit("close", this);
    this.yasgui.tabElements.get(this.persistentJson.id).delete();
    delete this.yasgui._tabs[this.persistentJson.id];
  }

  public getQuery() {
    if (!this.yasqe) {
      throw new Error("Cannot get value from uninitialized editor");
    }
    return this.yasqe?.getValue();
  }

  public setQuery(query: string) {
    if (!this.yasqe) {
      throw new Error("Cannot set value for uninitialized editor");
    }
    this.yasqe.setValue(query);
    this.persistentJson.yasqe.value = query;
    this.emit("change", this, this.persistentJson);
    return this;
  }

  public getRequestConfig() {
    return this.persistentJson.requestConfig;
  }

  /**
   * The head of the query card: breadcrumbs and title of the query, then the endpoint picker, the saved
   * status and Run. The editor actions (Prefixes, Insert, format, share, layout) go in a toolbar at the
   * top right of the editor. The bar keeps the `controlbar` class of the former icon-only control bar.
   */
  private initControlbar() {
    if (!this.controlBarEl) return;
    const bar = this.controlBarEl;
    addClass(bar, "yasgui-queryBar");
    bar.setAttribute("role", "toolbar");
    bar.setAttribute("aria-label", "Query");
    // The mobile menu was added by the settings modal; it goes to the end of the bar
    const mobileMenu = this.settingsModal?.getHamburgerElement();

    this.initQueryTitle();

    const spacer = document.createElement("div");
    addClass(spacer, "yasgui-queryBar__spacer");
    bar.appendChild(spacer);

    this.initEndpointSelectField();
    if (this.yasgui.config.endpointInfo) {
      bar.appendChild(this.yasgui.config.endpointInfo());
    }

    this.versionChipEl = document.createElement("span");
    addClass(this.versionChipEl, "yasgui-versionChip", "desktopOnly");
    this.versionChipEl.hidden = true;
    bar.appendChild(this.versionChipEl);
    this.on("change", this.updateVersionChip);
    this.updateVersionChip();

    this.initRunButton();
    if (mobileMenu) bar.appendChild(mobileMenu);
    this.initEditorToolbar();
    this.initEndpointButtons();
  }

  /** Breadcrumbs (workspace and folders of a saved query) and the name of the query */
  private initQueryTitle() {
    if (!this.controlBarEl) return;
    const title = document.createElement("div");
    addClass(title, "yasgui-queryTitle");
    this.titleEl = title;
    this.controlBarEl.appendChild(title);
    this.on("change", this.updateQueryTitle);
    this.updateQueryTitle();
  }

  /** Workspace label and folder names of a saved query, empty for a query that is not saved */
  public getBreadcrumbs(): string[] {
    const meta = this.getManagedQueryMetadata();
    if (!meta) return [];
    const workspace = this.yasgui.persistentConfig.getWorkspace(meta.workspaceId);
    const crumbs = [workspace?.label || meta.workspaceId];
    const path = (meta.queryRef as any)?.path as string | undefined;
    if (meta.backendType === "git" && path) crumbs.push(...path.split("/").slice(0, -1).filter(Boolean));
    return crumbs;
  }

  private updateQueryTitle = () => {
    const el = this.titleEl;
    if (!el) return;
    const crumbs = this.getBreadcrumbs();
    const name = this.name() || "Query";
    const version = this.getSavedVersionLabel();
    const key = JSON.stringify([crumbs, name, version]);
    if (el.dataset.key === key) return;
    el.dataset.key = key;
    el.innerHTML = "";

    if (crumbs.length) {
      const nav = document.createElement("nav");
      addClass(nav, "yasgui-breadcrumbs");
      nav.setAttribute("aria-label", "Location of the query");
      crumbs.forEach((crumb, i) => {
        if (i > 0) {
          const sep = document.createElement("span");
          addClass(sep, "yasgui-breadcrumbs__sep");
          sep.setAttribute("aria-hidden", "true");
          sep.textContent = "/";
          nav.appendChild(sep);
        }
        const link = document.createElement("button");
        link.type = "button";
        addClass(link, "yasgui-breadcrumbs__item");
        link.textContent = crumb;
        link.title = "Show in the query browser";
        link.addEventListener("click", () => this.yasgui.sidePanel?.show("queries"));
        nav.appendChild(link);
      });
      el.appendChild(nav);
    }

    const heading = document.createElement("h2");
    addClass(heading, "yasgui-queryTitle__name");
    const nameEl = document.createElement("span");
    nameEl.textContent = name;
    nameEl.title = "Double-click to rename";
    nameEl.addEventListener("dblclick", () => this.getTabListEl()?.startRename());
    heading.appendChild(nameEl);
    if (version) {
      const badge = document.createElement("span");
      addClass(badge, "yasgui-queryTitle__version");
      badge.textContent = version;
      badge.title = "Saved version";
      heading.appendChild(badge);
    }
    el.appendChild(heading);
  };

  /** Floating toolbar at the top right of the editor: Prefixes, Insert, the editor tools and the layout toggle */
  private initEditorToolbar() {
    if (!this.yasqeWrapperEl) return;
    addClass(this.yasqeWrapperEl, "yasgui-editorArea");
    const toolbar = document.createElement("div");
    addClass(toolbar, "yasgui-editorToolbar");
    toolbar.setAttribute("role", "toolbar");
    toolbar.setAttribute("aria-label", "Editor");
    this.editorToolbarEl = toolbar;

    const prefixButton = iconButton("tag", "Prefixes", {
      className: "yasgui-editorToolbar__button tabContextButton prefixButton desktopOnly",
      showLabel: true,
      title: "Insert your saved prefixes into the query",
    });
    prefixButton.addEventListener("click", () => this.settingsModal?.insertPrefixes());
    toolbar.appendChild(prefixButton);

    this.insertMenu = new InsertMenu(this, toolbar, (event) => this.settingsModal?.openMapWidget(event));

    const divider = document.createElement("div");
    addClass(divider, "yasgui-editorToolbar__divider", "desktopOnly");
    toolbar.appendChild(divider);

    if (this.yasgui.aiAssistant) {
      const aiButton = iconButton("sparkles", "AI", {
        className: "yasgui-editorToolbar__button yasgui-aiButton",
        showLabel: true,
        title: "AI assistant: ask for a query, explain or fix this query",
      });
      aiButton.addEventListener("click", () => this.yasgui.aiAssistant?.panel.toggle());
      toolbar.insertBefore(aiButton, divider);
    }

    this.initOrientationToggle();
    this.yasqeWrapperEl.appendChild(toolbar);
  }

  /** The panel of this tab, holding the query card */
  public getRootEl(): HTMLDivElement | undefined {
    return this.rootEl;
  }

  /** Open the Insert menu of the editor toolbar (snippets and the map widget) */
  public openInsertMenu() {
    this.insertMenu?.open();
  }

  /** The code snippets offered by the Insert menu */
  public getSnippets(): SnippetLike[] {
    return this.insertMenu?.getSnippets() || [];
  }

  /** Insert a code snippet at the cursor */
  public insertSnippet(snippet: SnippetLike) {
    this.insertMenu?.insert(snippet);
  }

  /** Insert the saved prefixes into the query */
  public insertPrefixes() {
    this.settingsModal?.insertPrefixes();
  }

  /** Focus the endpoint picker and show its list of endpoints */
  public focusEndpoint() {
    this.endpointSelect?.open();
  }

  /** Toggle the Endpoint view of the side panel (also F8) */
  public toggleEndpointExplorer() {
    this.yasgui.endpointDescribe?.toggle();
  }

  /**
   * Run button next to the endpoint: runs the query, or stops it while it runs
   */
  private initRunButton() {
    if (!this.controlBarEl) return;
    // An embedder that switched off the Run button of the editor gets no Run button in the query bar either
    if (this.yasgui.config.yasqe?.showQueryButton === false) return;
    const button = document.createElement("button");
    button.type = "button";
    addClass(button, "yasgui-runButton");
    button.addEventListener("click", () => {
      const yasqe = this.yasqe;
      if (!yasqe || yasqe.config.queryingDisabled) return;
      if (yasqe.isQueryRunning()) {
        yasqe.abortQuery();
      } else {
        this.query().catch(() => {});
      }
    });
    this.runButton = button;
    this.controlBarEl.appendChild(button);
    this.updateRunButton();
  }

  private handleSparqlAnythingChange = () => this.yasgui.sparqlAnything?.editorActivity(this, true);
  private handleSparqlAnythingCursor = () => this.yasgui.sparqlAnything?.editorActivity(this, false);
  private updateRunButton = () => {
    const button = this.runButton;
    if (!button) return;
    const yasqe = this.yasqe;
    const running = !!yasqe?.isQueryRunning();
    const invalid = !!yasqe && !yasqe.queryValid;
    const disabledReason = yasqe?.config.queryingDisabled;
    const state = running ? "running" : invalid ? "invalid" : "ready";
    if (button.dataset.state === state && button.disabled === !!disabledReason) return;
    button.dataset.state = state;
    button.classList.toggle("running", running);
    button.classList.toggle("invalid", invalid && !running);
    button.disabled = !!disabledReason;
    if (running) {
      button.innerHTML = `${icon("stop", 16)}<span class="yasgui-btnLabel">Stop</span>`;
      button.title = "Stop the running query";
      button.setAttribute("aria-label", "Stop query");
    } else {
      button.innerHTML = `${icon(invalid ? "alert" : "play", 16, invalid ? 2 : 1.75)}<span class="yasgui-btnLabel">Run</span><kbd class="yasgui-runButton__shortcut">${runShortcutLabel()}</kbd>`;
      button.title =
        disabledReason || (invalid ? "The query has syntax errors. Run it anyway" : "Run query (Ctrl+Enter)");
      button.setAttribute("aria-label", "Run query");
    }
  };

  /**
   * Saved version of a managed (workspace) query, shown in the query bar
   */
  private updateVersionChip = () => {
    const chip = this.versionChipEl;
    if (!chip) return;
    const meta = this.getManagedQueryMetadata();
    if (!meta) {
      chip.hidden = true;
      return;
    }
    const workspace = this.yasgui.persistentConfig.getWorkspace(meta.workspaceId);
    const ref = meta.lastSavedVersionRef as any;
    const version = this.getSavedVersionLabel();
    const readOnly = isWorkspaceReadOnly(workspace);
    const dirty = this.hasUnsavedManagedChanges();
    const state = dirty ? "dirty" : readOnly ? "readOnly" : "saved";
    chip.hidden = false;
    chip.classList.toggle("dirty", dirty);
    if (chip.dataset.state !== state) {
      chip.dataset.state = state;
      const label = dirty ? "Unsaved changes" : readOnly ? "Read-only" : "Saved";
      chip.innerHTML = `${dirty ? "" : icon(readOnly ? "lock" : "check", 14, 2)}<span>${label}</span>`;
    }
    const details = [
      workspace ? `Workspace: ${workspace.label}` : undefined,
      version ? `Version: ${ref?.commitSha || ref?.managedQueryVersionIri}` : undefined,
      readOnly ? "Read-only workspace" : undefined,
    ].filter(Boolean);
    chip.title = details.join("\n");
  };

  /** Short label of the saved version of a managed query: a commit hash or the last part of a version IRI */
  public getSavedVersionLabel(): string | undefined {
    const ref = this.getManagedQueryMetadata()?.lastSavedVersionRef as any;
    if (ref?.commitSha) return String(ref.commitSha).substring(0, 7);
    if (ref?.managedQueryVersionIri) return String(ref.managedQueryVersionIri).split(/[/#]/).filter(Boolean).pop();
    return undefined;
  }

  /** Apply the editor settings shared by all tabs (Settings → General and Editor) to the query editor */
  public applyEditorSettings() {
    if (!this.yasqe) return;
    const settings = this.yasgui.persistentConfig.getEditorSettings();
    if (this.yasqe.persistentConfig) {
      if (settings.formatterType) this.yasqe.persistentConfig.formatterType = settings.formatterType;
      if (settings.autoformatOnQuery !== undefined) {
        this.yasqe.persistentConfig.autoformatOnQuery = settings.autoformatOnQuery;
      }
    }
    if (settings.checkConstructVariables !== undefined) {
      this.yasqe.setCheckConstructVariables(settings.checkConstructVariables);
    }
  }

  /** Open the settings modal of this tab, optionally on a section (e.g. "endpoints") */
  public openSettings(section?: string) {
    this.settingsModal?.open(section);
  }

  private initOrientationToggle() {
    if (!this.controlBarEl) return;

    this.orientationToggleButton = document.createElement("button");
    this.orientationToggleButton.type = "button";
    this.orientationToggleButton.className =
      "yasgui-editorToolbar__iconButton tabContextButton orientationToggle desktopOnly";

    this.updateOrientationToggleIcon();

    this.orientationToggleButton.addEventListener("click", () => {
      this.toggleOrientation();
    });

    (this.editorToolbarEl || this.controlBarEl).appendChild(this.orientationToggleButton);
  }

  public updateOrientationToggleIcon() {
    if (!this.orientationToggleButton) return;

    // Show the icon for the layout we'll switch TO (not the current layout)
    const toHorizontal = this.currentOrientation === "vertical";
    this.orientationToggleButton.innerHTML = icon(toHorizontal ? "columns" : "rows");
    const label = toHorizontal ? "Switch to side-by-side layout" : "Switch to stacked layout";
    this.orientationToggleButton.title = label;
    this.orientationToggleButton.setAttribute("aria-label", label);
  }

  /** Keep the layout item of the mobile menu in sync */
  private updateMobileMenu() {
    const item = this.controlBarEl?.querySelector(".layoutMenuItem span");
    if (item) item.textContent = this.currentOrientation === "vertical" ? "Side-by-side layout" : "Stacked layout";
  }

  public toggleOrientation() {
    if (!this.rootEl) return;

    // Toggle orientation
    const newOrientation = this.currentOrientation === "vertical" ? "horizontal" : "vertical";

    // Update global config
    this.yasgui.config.orientation = newOrientation;

    // Persist orientation
    this.yasgui.persistentConfig.setOrientation(newOrientation);

    // Apply to all tabs
    for (const tabId in this.yasgui._tabs) {
      const tab = this.yasgui._tabs[tabId];
      if (tab && tab.rootEl) {
        // Remove old orientation class
        removeClass(tab.rootEl, `orientation-${tab.currentOrientation}`);

        // Update tab's orientation
        tab.currentOrientation = newOrientation;

        // Add new orientation class
        addClass(tab.rootEl, `orientation-${newOrientation}`);

        // Update button icon if it exists
        if (tab.orientationToggleButton) {
          tab.updateOrientationToggleIcon();
        }
        tab.updateMobileMenu();

        // Reset editor wrapper width when switching orientations
        if (tab.editorWrapperEl) {
          tab.editorWrapperEl.style.width = "";
          tab.editorWrapperEl.style.flex = "";
        }

        // Refresh components to adjust to new layout
        if (tab.yasqe) {
          tab.yasqe.refresh();
          // Trigger snippets overflow detection after layout change
          tab.yasqe.refreshSnippetsBar();
        }
        if (tab.yasr) {
          tab.yasr.refresh();
        }
      }
    }
  }

  public getYasqe() {
    return this.yasqe;
  }

  public getYasr() {
    return this.yasr;
  }

  public getCurrentOrientation() {
    return this.currentOrientation;
  }

  private initTabSettingsMenu() {
    if (!this.controlBarEl) throw new Error("Need to initialize wrapper elements before drawing tab settings");
    this.settingsModal = new TabSettingsModal(this, this.controlBarEl);
  }

  private initEndpointSelectField() {
    if (!this.controlBarEl) throw new Error("Need to initialize wrapper elements before drawing endpoint field");
    this.endpointSelect = new EndpointSelect(
      this.getEndpoint(),
      this.controlBarEl,
      this.yasgui.config.endpointCatalogueOptions,
      this.yasgui.persistentConfig.getEndpointHistory(),
    );
    this.endpointSelect.on("select", (endpoint, endpointHistory) => {
      this.setEndpoint(endpoint, endpointHistory);
    });
    this.endpointSelect.on("remove", (endpoint, endpointHistory) => {
      this.setEndpoint(endpoint, endpointHistory);
    });
    this.endpointSelect.on("manage", () => this.openSettings("endpoints"));
  }

  private initEndpointButtons() {
    this.refreshEndpointButtons();
  }

  /**
   * Refresh the quick switch endpoints (config `endpointButtons`, endpoints marked "show as button" and legacy
   * custom buttons). They are listed in the "Quick switch" group of the endpoint dropdown.
   */
  public refreshEndpointButtons() {
    if (!this.endpointSelect) return;

    // Get config buttons (for backwards compatibility) and filter out disabled ones
    const disabledButtons = this.yasgui.persistentConfig.getDisabledDevButtons();
    const configButtons = (this.yasgui.config.endpointButtons || []).filter(
      (button) => !disabledButtons.includes(button.endpoint),
    );

    // Get endpoint configs where showAsButton is true
    const endpointConfigs = this.yasgui.persistentConfig.getEndpointConfigs();
    const endpointButtons = endpointConfigs
      .filter((config) => config.showAsButton && config.label)
      .map((config) => ({ endpoint: config.endpoint, label: config.label! }));

    // Also include legacy custom buttons for backwards compatibility
    const customButtons = this.yasgui.persistentConfig.getCustomEndpointButtons();

    const seen = new Set<string>();
    const allButtons = [...configButtons, ...endpointButtons, ...customButtons].filter((button) => {
      const key = `${button.endpoint}\n${button.label}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    const labels: { [endpoint: string]: string } = {};
    for (const button of this.yasgui.config.endpointButtons || []) labels[button.endpoint] = button.label;
    for (const config of endpointConfigs) if (config.label) labels[config.endpoint] = config.label;
    for (const button of customButtons) labels[button.endpoint] = button.label;

    this.endpointSelect.setQuickSwitch(allButtons);
    this.endpointSelect.setEndpointLabels(labels);
  }

  public setEndpoint(endpoint: string, endpointHistory?: string[]) {
    if (endpoint) endpoint = endpoint.trim();
    if (endpointHistory && !eq(endpointHistory, this.yasgui.persistentConfig.getEndpointHistory())) {
      this.yasgui.emit("endpointHistoryChange", this.yasgui, endpointHistory);
    }

    if (this.persistentJson.requestConfig.endpoint !== endpoint) {
      this.persistentJson.requestConfig.endpoint = endpoint;
      this.emit("change", this, this.persistentJson);

      // Auto-track this endpoint in endpoint configs (if not already present)
      if (endpoint && !this.yasgui.persistentConfig.getEndpointConfig(endpoint)) {
        this.yasgui.persistentConfig.addOrUpdateEndpoint(endpoint, {});
      }

      // Emit after endpoint is tracked
      this.emit("endpointChange", this, endpoint);
      // Loaded SPARQL Anything structures belong to an endpoint
      this.yasgui.sparqlAnything?.changed();
    }
    if (this.endpointSelect instanceof EndpointSelect) {
      this.endpointSelect.setEndpoint(endpoint, endpointHistory);
    }
    return this;
  }

  public getEndpoint(): string {
    return getAsValue(this.persistentJson.requestConfig.endpoint, this.yasgui);
  }

  /**
   * Updates the position of the Tab's contextmenu
   * Useful for when being scrolled
   */
  public updateContextMenu(): void {
    this.getTabListEl().redrawContextMenu();
  }

  public getShareableLink(baseURL?: string): string {
    return shareLink.createShareLink(baseURL || window.location.href, this);
  }

  public getShareObject() {
    return shareLink.createShareConfig(this);
  }

  private getTabListEl(): TabListEl {
    return this.yasgui.tabElements.get(this.persistentJson.id);
  }

  public setName(newName: string) {
    this.getTabListEl().rename(newName);
    this.persistentJson.name = newName;
    this.emit("change", this, this.persistentJson);
    return this;
  }

  private suggestManagedFilenameFromName(name: string): string {
    const trimmed = name.trim();
    const safe = trimmed.replace(/[\\/]/g, "-");
    return normalizeQueryFilename(safe);
  }

  /**
   * User-triggered tab rename.
   * For managed queries, also renames the managed query entry in the Query Browser.
   */
  public async renameTab(newName: string): Promise<void> {
    const nextName = newName.trim();
    if (!nextName) return;
    if (nextName === this.name()) return;

    const meta = this.getManagedQueryMetadata();
    if (!meta) {
      this.setName(nextName);
      return;
    }

    const workspace = this.yasgui.persistentConfig.getWorkspace(meta.workspaceId);
    if (!workspace) {
      window.alert("Selected workspace no longer exists");
      return;
    }

    // Queries in a read-only workspace cannot be renamed; only the tab label changes.
    if (isWorkspaceReadOnly(workspace)) {
      this.setName(nextName);
      return;
    }

    const backend = getWorkspaceBackend(workspace, { persistentConfig: this.yasgui.persistentConfig });

    if (meta.backendType === "sparql") {
      const queryId = this.getManagedQueryIdFromMetadata(meta);
      if (!queryId) return;
      if (!backend.renameQuery) {
        window.alert("This workspace does not support renaming queries");
        return;
      }

      try {
        this.getTabListEl().setAsRenaming(true);
        await backend.renameQuery(queryId, nextName);
        this.setName(nextName);
        this.yasgui.queryBrowser.invalidateAndRefresh(meta.workspaceId);
      } catch (e) {
        const err = asWorkspaceBackendError(e);
        window.alert(err.message);
      } finally {
        this.getTabListEl().setAsRenaming(false);
      }

      return;
    }

    // Git: rename underlying file path so the Query Browser label changes.
    const oldPath = (meta.queryRef as any)?.path as string | undefined;
    if (!oldPath) {
      this.setName(nextName);
      return;
    }

    const parts = oldPath.split("/").filter(Boolean);
    const oldFilename = parts.pop() || oldPath;
    const folderPrefix = parts.join("/");

    const newFilename = this.suggestManagedFilenameFromName(nextName);
    const newPath = folderPrefix ? `${folderPrefix}/${newFilename}` : newFilename;

    if (newPath === oldPath) {
      // Nothing to rename on the backend; still allow tab label change.
      this.setName(nextName);
      return;
    }

    try {
      this.getTabListEl().setAsRenaming(true);
      await backend.writeQuery(newPath, this.getQueryTextForSave(), {
        message: `Rename ${oldFilename} to ${newFilename}`,
      });

      if (!backend.deleteQuery) {
        window.alert("This workspace does not support deleting queries, so the old file could not be removed.");
      } else {
        await backend.deleteQuery(oldPath);
      }

      const read = await backend.readQuery(newPath);
      const lastSavedTextHash = hashQueryText(read.queryText);
      const lastSavedVersionRef = this.versionRefFromVersionTag("git", read.versionTag);

      this.setManagedQueryMetadata({
        ...meta,
        queryRef: { ...(meta.queryRef as any), path: newPath },
        lastSavedTextHash,
        lastSavedVersionRef,
      });

      this.setName(nextName);
      this.yasgui.queryBrowser.invalidateAndRefresh(meta.workspaceId);
    } catch (e) {
      const err = asWorkspaceBackendError(e);
      window.alert(err.message);
    } finally {
      this.getTabListEl().setAsRenaming(false);
    }
  }

  public hasResults() {
    return !!this.yasr?.results;
  }

  public getName() {
    return this.persistentJson.name;
  }
  public async query(): Promise<any> {
    if (!this.yasqe) return Promise.reject(new Error("No yasqe editor initialized"));

    // Check and refresh OAuth 2.0 token if needed
    const tokenValid = await this.ensureOAuth2TokenValid();
    if (!tokenValid) {
      return Promise.reject(new Error("OAuth 2.0 authentication failed"));
    }

    return this.yasqe.query();
  }

  public setRequestConfig(requestConfig: Partial<YasguiRequestConfig>) {
    this.persistentJson.requestConfig = {
      ...this.persistentJson.requestConfig,
      ...requestConfig,
    };

    this.emit("change", this, this.persistentJson);
  }

  /**
   * Get authentication configuration for the current endpoint
   * This retrieves auth from the endpoint-based storage
   */
  private getAuthForCurrentEndpoint() {
    const endpoint = this.getEndpoint();
    if (!endpoint) return undefined;

    const endpointConfig = this.yasgui.persistentConfig.getEndpointConfig(endpoint);
    if (!endpointConfig || !endpointConfig.authentication) return undefined;

    // Convert endpoint auth to requestConfig format
    const auth = endpointConfig.authentication;
    if (auth.type === "basic") {
      return {
        type: "basic" as const,
        config: {
          username: auth.username,
          password: auth.password,
        },
      };
    } else if (auth.type === "bearer") {
      return {
        type: "bearer" as const,
        config: {
          token: auth.token,
        },
      };
    } else if (auth.type === "apiKey") {
      return {
        type: "apiKey" as const,
        config: {
          headerName: auth.headerName,
          apiKey: auth.apiKey,
        },
      };
    } else if (auth.type === "oauth2") {
      // For OAuth 2.0, return the current access token and ID token
      // Token refresh is handled separately before query execution
      if (auth.accessToken) {
        return {
          type: "oauth2" as const,
          config: {
            accessToken: auth.accessToken,
            idToken: auth.idToken,
          },
        };
      }
    }

    return undefined;
  }

  /**
   * Check and refresh OAuth 2.0 token if needed
   * Should be called before query execution
   */
  private async ensureOAuth2TokenValid(): Promise<boolean> {
    const endpoint = this.getEndpoint();
    if (!endpoint) return true;

    const endpointConfig = this.yasgui.persistentConfig.getEndpointConfig(endpoint);
    if (!endpointConfig || !endpointConfig.authentication) return true;

    const auth = endpointConfig.authentication;
    if (auth.type !== "oauth2") return true;

    // Check if token is expired
    if (OAuth2Utils.isTokenExpired(auth.tokenExpiry)) {
      // Try to refresh the token if we have a refresh token
      if (auth.refreshToken) {
        try {
          const tokenResponse = await OAuth2Utils.refreshOAuth2Token(
            {
              clientId: auth.clientId,
              tokenEndpoint: auth.tokenEndpoint,
            },
            auth.refreshToken,
          );

          const tokenExpiry = OAuth2Utils.calculateTokenExpiry(tokenResponse.expires_in);

          // Update stored authentication with new tokens
          this.yasgui.persistentConfig.addOrUpdateEndpoint(endpoint, {
            authentication: {
              ...auth,
              accessToken: tokenResponse.access_token,
              idToken: tokenResponse.id_token,
              refreshToken: tokenResponse.refresh_token || auth.refreshToken,
              tokenExpiry,
            },
          });

          return true;
        } catch (error) {
          console.error("Failed to refresh OAuth 2.0 token:", error);
          // Token refresh failed, user needs to re-authenticate
          alert(
            "Your OAuth 2.0 session has expired and could not be refreshed. Please re-authenticate by clicking the Settings button (gear icon) and selecting the SPARQL Endpoints tab.",
          );
          return false;
        }
      } else {
        // No refresh token available, user needs to re-authenticate
        alert(
          "Your OAuth 2.0 session has expired. Please re-authenticate by clicking the Settings button (gear icon) and selecting the SPARQL Endpoints tab.",
        );
        return false;
      }
    }

    // Token is still valid
    return true;
  }

  /**
   * The Matgui configuration object may contain a custom request config
   * This request config object can contain getter functions, or plain json
   * The plain json data is stored in persisted config, and editable via the
   * tab pane.
   * The getter functions are not. This function is about fetching this part of the
   * request configuration, so we can merge this with the configuration from the
   * persistent config and tab pane.
   *
   * Considering some values will never be persisted (things that should always be a function),
   * we provide that as part of a whitelist called `keepDynamic`
   */
  private getStaticRequestConfig() {
    const config: Partial<PlainRequestConfig> = {};
    let key: keyof YasguiRequestConfig;
    for (key in this.yasgui.config.requestConfig) {
      //This config option should never be static or persisted anyway
      if (key === "adjustQueryBeforeRequest") continue;
      const val = this.yasgui.config.requestConfig[key];
      if (typeof val === "function") {
        (config[key] as any) = val(this.yasgui);
      }
    }
    return config;
  }

  private initYasqe() {
    // Set theme based on stored preference for current mode
    const currentTheme = this.yasgui.getTheme();
    const storedCmTheme = this.yasgui.persistentConfig.getCodeMirrorTheme(currentTheme);
    const cmTheme = storedCmTheme || (currentTheme === "dark" ? "github-dark" : "default");

    const yasqeConf: Partial<YasqeConfig> = {
      ...this.yasgui.config.yasqe,
      theme: cmTheme,
      value: this.persistentJson.yasqe.value,
      editorHeight: this.persistentJson.yasqe.editorHeight ? this.persistentJson.yasqe.editorHeight : undefined,
      persistenceId: null, //yasgui handles persistent storing
      consumeShareLink: null, //not handled by this tab, but by parent Matgui instance
      createShareableLink: () => this.getShareableLink(),
      // The snippets bar is off unless enabled (config or settings); the snippets are in the Insert menu
      showSnippetsBar: this.yasgui.config.showSnippetsBar === true,
      // Yasgui shows its own Run button in the query bar
      showQueryButton: false,
      showMapButton: false,
      // Classes and properties used in the endpoint, from the Endpoint overview
      endpointTerms:
        this.yasgui.config.yasqe?.endpointTerms ??
        ((_yasqe, type) => this.yasgui.endpointDescribe?.getAutocompleteTerms(this, type)),
      // Columns, keys and elements of the SPARQL Anything sources of the query
      contextTerms:
        this.yasgui.config.yasqe?.contextTerms ??
        ((_yasqe, type) => this.yasgui.sparqlAnything?.getContextTerms(this, type)),
      sparqlAnythingChip:
        this.yasgui.config.yasqe?.sparqlAnythingChip ??
        (this.yasgui.config.sparqlAnything === false
          ? undefined
          : (_yasqe, source) => this.yasgui.sparqlAnything?.renderChip(this, source)),
      iriHover:
        this.yasgui.config.yasqe.iriHover ??
        (this.yasgui.config.iriHover === false
          ? undefined
          : (_yasqe, iri) =>
              this.yasgui.persistentConfig.getIriHoverEnabled()
                ? createIriHover(this, iri, this.yasgui.config.iriHoverLovFallback !== false)
                : undefined),
      requestConfig: () => {
        const processedReqConfig: YasguiRequestConfig = {
          //setting defaults
          //@ts-ignore
          acceptHeaderGraph: "text/turtle",
          //@ts-ignore
          acceptHeaderSelect: "application/sparql-results+json",
          ...mergeWith(
            {},
            this.persistentJson.requestConfig,
            this.getStaticRequestConfig(),
            function customizer(objValue, srcValue) {
              if (Array.isArray(objValue) || Array.isArray(srcValue)) {
                return [...(objValue || []), ...(srcValue || [])];
              }
            },
          ),
          //Passing this manually. Dont want to use our own persistentJson, as that's flattened exclude functions
          //The adjustQueryBeforeRequest is meant to be a function though, so let's copy that as is
          adjustQueryBeforeRequest: this.yasgui.config.requestConfig.adjustQueryBeforeRequest,
        };

        // Inject authentication from endpoint-based storage
        // Only inject endpoint-based auth if the corresponding auth type is not already set
        const endpointAuth = this.getAuthForCurrentEndpoint();
        if (endpointAuth) {
          if (endpointAuth.type === "basic" && typeof processedReqConfig.basicAuth === "undefined") {
            processedReqConfig.basicAuth = endpointAuth.config;
          } else if (endpointAuth.type === "bearer" && typeof processedReqConfig.bearerAuth === "undefined") {
            processedReqConfig.bearerAuth = endpointAuth.config;
          } else if (endpointAuth.type === "apiKey" && typeof processedReqConfig.apiKeyAuth === "undefined") {
            processedReqConfig.apiKeyAuth = endpointAuth.config;
          } else if (endpointAuth.type === "oauth2" && typeof processedReqConfig.oauth2Auth === "undefined") {
            processedReqConfig.oauth2Auth = endpointAuth.config;
          }
        }

        return processedReqConfig as PlainRequestConfig;
      },
    };

    // Override editor-level save shortcut.
    // Yasqe binds Ctrl+S to `yasqe.saveQuery()` (local storage) by default, which can prevent our document-level handler.
    const existingExtraKeys = (yasqeConf as any).extraKeys;
    const mergedExtraKeys: Record<string, any> =
      existingExtraKeys && typeof existingExtraKeys === "object" ? { ...existingExtraKeys } : {};
    mergedExtraKeys["Ctrl-S"] = () => {
      const saveModalOpen = !!document.querySelector(".saveManagedQueryModalOverlay.open");
      if (saveModalOpen) return;
      void this.saveManagedQueryOrSaveAsManagedQuery();
    };
    mergedExtraKeys["Cmd-S"] = mergedExtraKeys["Ctrl-S"];
    (yasqeConf as any).extraKeys = mergedExtraKeys;

    if (!yasqeConf.hintConfig) {
      yasqeConf.hintConfig = {};
    }
    if (!yasqeConf.hintConfig.container) {
      yasqeConf.hintConfig.container = this.yasgui.rootEl;
    }
    if (!this.yasqeWrapperEl) {
      throw new Error("Expected a wrapper element before instantiating yasqe");
    }
    this.yasqe = new Yasqe(this.yasqeWrapperEl, yasqeConf);
    this.applyEditorSettings();

    // Hook up the save button to managed query save
    this.yasqe.on("saveManagedQuery", () => {
      void this.saveManagedQueryOrSaveAsManagedQuery();
    });

    // Hook up download as .rq file
    this.yasqe.on("downloadRqFile", () => {
      void this.downloadAsRqFile();
    });

    // Show/hide save button based on workspace configuration
    this.updateSaveButtonVisibility();

    this.mountEditorTools();

    this.yasqe.on("blur", this.handleYasqeBlur);
    this.yasqe.on("query", this.handleYasqeQuery);
    this.yasqe.on("queryBefore", this.handleYasqeQueryBefore);
    this.yasqe.on("queryAbort", this.handleYasqeQueryAbort);
    this.yasqe.on("resize", this.handleYasqeResize);

    this.yasqe.on("autocompletionShown", this.handleAutocompletionShown);
    this.yasqe.on("autocompletionClose", this.handleAutocompletionClose);

    this.yasqe.on("queryResponse", this.handleQueryResponse);

    // Keep the Run button of the query bar in sync
    this.yasqe.on("query", this.updateRunButton);
    this.yasqe.on("queryResponse", this.updateRunButton);
    this.yasqe.on("queryAbort", this.updateRunButton);
    this.yasqe.on("changes", this.updateRunButton);
    this.updateRunButton();
    this.yasqe.on("changes", this.handleSparqlAnythingChange);
    this.yasqe.on("cursorActivity", this.handleSparqlAnythingCursor);

    // Add Ctrl+Click handler for URIs
    this.attachYasqeMouseHandler();
  }

  /**
   * Move the editor's own buttons (save, share, format, fullscreen) from their floating spot
   * inside the editor into the editor toolbar, next to the layout toggle, with Lucide icons.
   * The elements keep their yasqe classes and handlers, so the share popup and the
   * save buttons keep working.
   */
  private mountEditorTools() {
    const buttons = this.yasqe?.getWrapperElement()?.querySelector<HTMLDivElement>(".yasqe_buttons");
    const host = this.editorToolbarEl || this.controlBarEl;
    if (!buttons || !host) return;
    this.editorToolsEl?.remove();
    const tools = document.createElement("div");
    addClass(tools, "yasgui-editorTools", "yasqe_buttonsHost");
    tools.setAttribute("role", "group");
    tools.setAttribute("aria-label", "Editor");
    tools.appendChild(buttons);
    const setIcon = (selector: string, name: IconName) => {
      buttons.querySelectorAll<HTMLElement>(selector).forEach((el) => {
        el.querySelectorAll("i").forEach((i) => i.remove());
        el.insertAdjacentHTML("afterbegin", icon(name));
      });
    };
    setIcon(".yasqe_saveManagedButton", "database");
    setIcon(".yasqe_saveRqButton", "fileDown");
    setIcon(".yasqe_share", "share");
    setIcon(".yasqe_formatButton", "alignLeft");
    setIcon(".yasqe_hamburgerButton", "ellipsis");
    const fullscreenBtn = buttons.querySelector<HTMLElement>(".yasqe_fullscreenButton");
    if (fullscreenBtn) {
      fullscreenBtn.querySelectorAll("i").forEach((i) => i.remove());
      fullscreenBtn.insertAdjacentHTML(
        "afterbegin",
        icon("maximize").replace('class="yasgui-icon"', 'class="yasgui-icon fullscreenIcon"') +
          icon("minimize").replace('class="yasgui-icon"', 'class="yasgui-icon fullscreenExitIcon"'),
      );
    }
    const anchor = this.orientationToggleButton?.parentElement === host ? this.orientationToggleButton : null;
    host.insertBefore(tools, anchor);
    this.editorToolsEl = tools;
  }

  private updateSaveButtonVisibility() {
    if (!this.yasqe) return;
    const workspaces = this.yasgui.persistentConfig.getWorkspaces();
    const hasWritableWorkspaces = !!workspaces && getWritableWorkspaces(workspaces).length > 0;
    this.yasqe.setSaveButtonVisible(hasWritableWorkspaces);
  }

  private initSaveManagedQueryIcon() {
    if (!this.yasqe) return;

    const wrapper = this.yasqe.getWrapperElement();
    const buttons = wrapper?.querySelector(".yasqe_buttons");
    if (!buttons) return;

    // Avoid duplicates if Yasqe ever re-renders
    if (buttons.querySelector(".yasqe_saveManagedQueryButton")) return;

    const queryBtn = buttons.querySelector(".yasqe_queryButton");
    if (!queryBtn) return;

    const saveBtn = document.createElement("button");
    saveBtn.type = "button";
    saveBtn.className = "yasqe_saveManagedQueryButton";
    saveBtn.title = "Save managed query";
    saveBtn.setAttribute("aria-label", "Save managed query");
    saveBtn.innerHTML = '<i class="fas fa-save" aria-hidden="true"></i>';

    saveBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      void this.saveManagedQueryOrSaveAsManagedQuery();
    });

    buttons.insertBefore(saveBtn, queryBtn);
  }

  private destroyYasqe() {
    // As Yasqe extends of CM instead of eventEmitter, it doesn't expose the removeAllListeners function, so we should unregister all events manually
    this.yasqe?.off("blur", this.handleYasqeBlur);
    this.yasqe?.off("query", this.handleYasqeQuery);
    this.yasqe?.off("queryAbort", this.handleYasqeQueryAbort);
    this.yasqe?.off("resize", this.handleYasqeResize);
    this.yasqe?.off("autocompletionShown", this.handleAutocompletionShown);
    this.yasqe?.off("autocompletionClose", this.handleAutocompletionClose);
    this.yasqe?.off("queryBefore", this.handleYasqeQueryBefore);
    this.yasqe?.off("queryResponse", this.handleQueryResponse);
    this.yasqe?.off("query", this.updateRunButton);
    this.yasqe?.off("queryResponse", this.updateRunButton);
    this.yasqe?.off("queryAbort", this.updateRunButton);
    this.yasqe?.off("changes", this.updateRunButton);
    this.detachYasqeMouseHandler();
    this.editorToolsEl?.remove();
    this.editorToolsEl = undefined;
    this.yasqe?.destroy();
    this.yasqe = undefined;
  }

  handleYasqeBlur = (yasqe: Yasqe) => {
    this.persistentJson.yasqe.value = yasqe.getValue();
    // Capture prefixes from query if auto-capture is enabled
    this.settingsModal?.capturePrefixesFromQuery();
    this.emit("change", this, this.persistentJson);
  };

  handleYasqeQuery = (yasqe: Yasqe) => {
    //the blur event might not have fired (e.g. when pressing ctrl-enter). So, we'd like to persist the query as well if needed
    if (yasqe.getValue() !== this.persistentJson.yasqe.value) {
      this.persistentJson.yasqe.value = yasqe.getValue();
      this.emit("change", this, this.persistentJson);
    }
    this.emit("query", this);
  };

  handleYasqeQueryAbort = () => {
    this.emit("queryAbort", this);
    // Hide loading indicator in Yasr
    if (this.yasr) {
      this.yasr.hideLoading();
    }
  };

  handleYasqeQueryBefore = () => {
    this.emit("queryBefore", this);
    // Show loading indicator in Yasr
    if (this.yasr) {
      this.yasr.showLoading();
    }
  };

  handleYasqeResize = (_yasqe: Yasqe, newSize: string) => {
    this.persistentJson.yasqe.editorHeight = newSize;
    this.emit("change", this, this.persistentJson);
  };

  handleAutocompletionShown = (_yasqe: Yasqe, widget: string) => {
    this.emit("autocompletionShown", this, widget);
  };

  handleAutocompletionClose = (_yasqe: Yasqe) => {
    this.emit("autocompletionClose", this);
  };

  handleQueryResponse = (_yasqe: Yasqe, response: any, duration: number) => {
    this.emit("queryResponse", this);
    if (!this.yasr) throw new Error("Resultset visualizer not initialized. Cannot draw results");
    // A `#defaultView:<plugin>` comment in the query picks the result view
    this.yasr.selectPluginFromQuery(this.yasqe?.getValue());
    this.yasr.setResponse(response, duration);
    if (!this.yasr.results) return;
    if (!this.yasr.results.hasError()) {
      this.persistentJson.yasr.response = this.yasr.results.getAsStoreObject(
        this.yasgui.config.yasr.maxPersistentResponseSize,
      );
    } else {
      // Don't persist if there is an error and remove the previous result
      this.persistentJson.yasr.response = undefined;
    }
    this.emit("change", this, this.persistentJson);
  };

  private handleYasqeMouseDown = (event: MouseEvent) => {
    // Only handle Ctrl+Click
    if (!event.ctrlKey || !this.yasqe) return;

    const target = event.target as HTMLElement;
    // Check if click is within CodeMirror editor
    if (!target.closest(".CodeMirror")) return;

    // Get position from mouse coordinates
    const pos = this.yasqe.coordsChar({ left: event.clientX, top: event.clientY });
    // Check if the token is a URI: either in angle brackets or a prefixed name (not a variable)
    const iri = this.yasqe.getIriAt(pos);
    if (!iri) return;

    event.preventDefault();
    event.stopPropagation();
    const uri = iri.iri;

    // Construct the query based on whether Shift is held
    let constructQuery: string;
    if (event.shiftKey) {
      // Ctrl+Shift+Click: find all triples where URI is the object
      constructQuery = buildObjectOfQuery(uri);
    } else {
      // Ctrl+Click: find all triples where URI is the subject
      constructQuery = buildSubjectOfQuery(uri);
    }

    // Execute query in background without changing editor content
    // Note: void operator is intentional - errors are handled in the catch block of executeBackgroundQuery
    void this.executeBackgroundQuery(constructQuery);
  };

  /**
   * Execute a SPARQL query against this tab's endpoint without touching the editor or the results view.
   * The request configuration and authentication of the tab are used.
   */
  public async runBackgroundQuery(
    query: string,
    options: { accept?: string; signal?: AbortSignal; skipGraphArgs?: boolean } = {},
  ): Promise<any> {
    if (!this.yasqe) throw new Error("No yasqe editor initialized");
    const tokenValid = await this.ensureOAuth2TokenValid();
    if (!tokenValid) throw new Error("OAuth 2.0 authentication failed");
    return Yasqe.Sparql.executeQuery(this.yasqe, undefined, {
      customQuery: query,
      customAccept: options.accept,
      signal: options.signal,
      silent: true,
      skipGraphArgs: options.skipGraphArgs,
    });
  }

  /**
   * Request headers (including authentication) and credentials mode used for requests to this tab's endpoint.
   */
  public async getRequestInit(): Promise<{ headers: { [key: string]: string }; withCredentials: boolean } | undefined> {
    if (!this.yasqe) return undefined;
    await this.ensureOAuth2TokenValid();
    const ajaxConfig = Yasqe.Sparql.getAjaxConfig(this.yasqe);
    if (!ajaxConfig) return undefined;
    return { headers: { ...(ajaxConfig.headers || {}) }, withCredentials: ajaxConfig.withCredentials };
  }

  private async executeBackgroundQuery(query: string) {
    if (!this.yasqe || !this.yasr) return;

    try {
      // Show loading indicator
      this.yasr.showLoading();
      this.emit("queryBefore", this);

      // Track query execution time
      const startTime = Date.now();

      // Use yasqe's executeQuery with custom query and accept header
      const queryResponse = await Yasqe.Sparql.executeQuery(
        this.yasqe,
        undefined, // Use default config
        {
          customQuery: query,
          customAccept: "text/turtle",
          silent: true,
        },
      );

      const duration = Date.now() - startTime;

      // Set the response in Yasr
      this.yasr.setResponse(queryResponse, duration);

      // Auto-select the Graph plugin if it's available
      // The selectPlugin method will call draw() which will determine if it can handle the results
      if (this.yasr.plugins["Graph"]) {
        this.yasr.selectPlugin("Graph");
      }

      this.yasr.hideLoading();
      this.emit("queryResponse", this);
    } catch (error) {
      console.error("Background query failed:", error);
      if (this.yasr) {
        this.yasr.hideLoading();
        // Set error response with detailed HTTP status if available
        const errorObj: any = error;
        let errorText = error instanceof Error ? error.message : String(error);

        this.yasr.setResponse(
          {
            error: {
              status: errorObj.status,
              statusText: errorObj.statusText || (error instanceof Error ? error.name : undefined),
              text: errorText,
            },
          },
          0,
        );
      }
    }
  }

  private attachYasqeMouseHandler() {
    if (!this.yasqe) return;
    const wrapper = this.yasqe.getWrapperElement();
    if (wrapper) {
      wrapper.addEventListener("mousedown", this.handleYasqeMouseDown);
    }
  }

  private detachYasqeMouseHandler() {
    if (!this.yasqe) return;
    const wrapper = this.yasqe.getWrapperElement();
    if (wrapper) {
      wrapper.removeEventListener("mousedown", this.handleYasqeMouseDown);
    }
  }

  private initYasr() {
    if (!this.yasrWrapperEl) throw new Error("Wrapper for yasr does not exist");

    const yasrConf: Partial<YasrConfig> = {
      persistenceId: null, //Matgui handles persistent storing
      prefixes: (yasr) => {
        // Prefixes defined in YASR's config
        const prefixesFromYasrConf =
          typeof this.yasgui.config.yasr.prefixes === "function"
            ? this.yasgui.config.yasr.prefixes(yasr)
            : this.yasgui.config.yasr.prefixes;
        const prefixesFromYasqe = this.yasqe?.getPrefixesFromQuery();
        // Invert twice to make sure both keys and values are unique
        // YASQE's prefixes should take president
        return invert(invert({ ...prefixesFromYasrConf, ...prefixesFromYasqe }));
      },
      defaultPlugin: this.persistentJson.yasr.settings.selectedPlugin,
      getPlainQueryLinkToEndpoint: () => {
        if (this.yasqe) {
          return shareLink.appendArgsToUrl(
            this.getEndpoint(),
            Yasqe.Sparql.getUrlArguments(this.yasqe, this.persistentJson.requestConfig as RequestConfig<any>),
          );
        }
      },
      plugins: mapValues(this.persistentJson.yasr.settings.pluginsConfig, (conf) => ({
        dynamicConfig: conf,
      })),
      errorRenderers: [
        // Use custom error renderer
        getCorsErrorRenderer(this),
        // Add default renderers to the end, to give our custom ones priority.
        ...(Yasr.defaults.errorRenderers || []),
      ],
      executeQuery: async (query: string, options?: YasrPluginQueryOptions) => {
        if (!this.yasqe) throw new Error("No YASQE instance available");
        const response = await Yasqe.Sparql.executeQuery(this.yasqe, undefined, {
          customQuery: query,
          customAccept: options?.acceptHeader,
          signal: options?.signal,
          extraArgs: options?.extraArgs,
          customEndpoint: options?.endpoint,
          silent: true,
        });
        return response;
      },
    };
    // Allow getDownloadFilName to be overwritten by the global config
    if (yasrConf.getDownloadFileName === undefined) {
      yasrConf.getDownloadFileName = () => words(deburr(this.getName())).join("-");
    }

    // Lets yasr ("Open as query" in its describe panel) open a query in a new tab with the same endpoint.
    // Assigned untyped, so this compiles whether or not the yasr typings already declare the hook.
    (yasrConf as { [key: string]: unknown }).openQueryInNewTab = (query: string) => {
      const tab = this.yasgui.addTab(true, {
        requestConfig: { ...this.persistentJson.requestConfig, endpoint: this.getEndpoint() },
      } as Partial<PersistedJson>);
      tab.setQuery(query);
    };

    // "Fix with AI" / "Copy for AI" in the error view, and `yasr.askAssistant()` for plugins
    if (this.yasgui.aiAssistant) {
      const assistant = this.yasgui.aiAssistant;
      const fixTask = (error: { status?: number; text: string; statusText?: string }) =>
        assistant.createTask("fix", {
          error: { source: "endpoint", status: error.status, message: error.text || error.statusText },
        });
      yasrConf.assistant = {
        isConnected: () => assistant.isConnected(),
        fixError: (error) => void assistant.run(fixTask(error)),
        copyErrorPrompt: (error) => {
          const task = fixTask(error);
          return task ? assistant.copy(task) : Promise.resolve(false);
        },
        ask: (request) => assistant.askFromPlugin(request),
      };
    }

    this.yasr = new Yasr(this.yasrWrapperEl, yasrConf, this.persistentJson.yasr.response);
    // Expose the tab reference so plugins (e.g. table plugin) can reach yasqe
    (this.yasr as any).tab = this;

    //populate our own persistent config
    this.persistentJson.yasr.settings = this.yasr.getPersistentConfig();
    this.yasr.on("change", () => {
      if (this.yasr) {
        this.persistentJson.yasr.settings = this.yasr.getPersistentConfig();
      }

      this.emit("change", this, this.persistentJson);
    });
  }

  private drawVerticalResizer() {
    if (this.verticalResizerEl || !this.rootEl) return;
    this.verticalResizerEl = document.createElement("div");
    addClass(this.verticalResizerEl, "verticalResizeWrapper");
    const chip = document.createElement("div");
    addClass(chip, "verticalResizeChip");
    this.verticalResizerEl.appendChild(chip);
    this.verticalResizerEl.title = "Drag to resize, double-click to reset";
    this.verticalResizerEl.addEventListener("mousedown", this.initVerticalDrag, false);
    this.verticalResizerEl.addEventListener("dblclick", this.resetVerticalSplit, false);
    this.rootEl.appendChild(this.verticalResizerEl);
  }

  // Pointer position and editor width when the drag started, so the split follows the pointer exactly
  private verticalDragStart?: { x: number; width: number };
  private initVerticalDrag = (event: MouseEvent) => {
    // Don't select text while dragging
    event.preventDefault();
    if (this.verticalResizerEl) addClass(this.verticalResizerEl, "resizing");
    if (this.editorWrapperEl)
      this.verticalDragStart = { x: event.clientX, width: this.editorWrapperEl.getBoundingClientRect().width };
    document.documentElement.addEventListener("mousemove", this.doVerticalDrag, false);
    document.documentElement.addEventListener("mouseup", this.stopVerticalDrag, false);
  };

  private calculateVerticalDragOffset(event: MouseEvent): number {
    if (!this.rootEl) return 0;

    let parentOffset = 0;
    if (this.rootEl.offsetParent) {
      parentOffset = (this.rootEl.offsetParent as HTMLElement).offsetLeft;
    }

    let scrollOffset = 0;
    let parentElement = this.rootEl.parentElement;
    while (parentElement) {
      scrollOffset += parentElement.scrollLeft;
      parentElement = parentElement.parentElement;
    }

    return event.clientX - parentOffset - this.rootEl.offsetLeft + scrollOffset;
  }

  private doVerticalDrag = (event: MouseEvent) => {
    if (!this.editorWrapperEl || !this.rootEl) return;

    const offset = this.verticalDragStart
      ? this.verticalDragStart.width + event.clientX - this.verticalDragStart.x
      : this.calculateVerticalDragOffset(event);
    const totalWidth = this.rootEl.offsetWidth;

    // Ensure minimum widths (at least 200px for each panel)
    const minWidth = 200;
    const maxWidth = totalWidth - minWidth - 10; // 10px for resizer

    const newWidth = Math.max(minWidth, Math.min(maxWidth, offset));
    this.editorWrapperEl.style.width = newWidth + "px";
    this.editorWrapperEl.style.flex = "0 0 " + newWidth + "px";
  };

  private stopVerticalDrag = () => {
    if (this.verticalResizerEl) removeClass(this.verticalResizerEl, "resizing");
    this.verticalDragStart = undefined;
    document.documentElement.removeEventListener("mousemove", this.doVerticalDrag, false);
    document.documentElement.removeEventListener("mouseup", this.stopVerticalDrag, false);

    // Refresh editors after resizing
    if (this.yasqe) {
      this.yasqe.refresh();
      // Trigger snippets overflow detection after horizontal resize
      this.yasqe.refreshSnippetsBar();
    }
    if (this.yasr) {
      this.yasr.refresh();
    }
  };

  private resetVerticalSplit = () => {
    if (!this.editorWrapperEl) return;

    // Reset to 50/50 split
    this.editorWrapperEl.style.width = "";
    this.editorWrapperEl.style.flex = "1 1 50%";

    // Refresh editors after resizing
    if (this.yasqe) {
      this.yasqe.refresh();
    }
    if (this.yasr) {
      this.yasr.refresh();
    }
  };

  destroy() {
    // Clean up vertical resizer event listeners
    if (this.verticalResizerEl) {
      this.verticalResizerEl.removeEventListener("mousedown", this.initVerticalDrag, false);
      this.verticalResizerEl.removeEventListener("dblclick", this.resetVerticalSplit, false);
    }
    document.documentElement.removeEventListener("mousemove", this.doVerticalDrag, false);
    document.documentElement.removeEventListener("mouseup", this.stopVerticalDrag, false);

    this.removeAllListeners();
    this.insertMenu?.destroy();
    this.settingsModal?.destroy();
    this.endpointSelect?.destroy();
    this.endpointSelect = undefined;
    this.yasr?.destroy();
    this.yasr = undefined;
    this.destroyYasqe();
  }

  public static getDefaults(yasgui?: Yasgui): PersistedJson {
    return {
      yasqe: {
        value: (yasgui ? yasgui.config.yasqe.value : Yasgui.defaults.yasqe.value) ?? "",
      },
      yasr: {
        response: undefined,
        settings: {
          selectedPlugin: yasgui ? yasgui.config.yasr.defaultPlugin : "table",
          pluginsConfig: {},
        },
      },
      requestConfig: yasgui ? yasgui.config.requestConfig : { ...Yasgui.defaults.requestConfig },
      id: getRandomId(),
      name: yasgui ? yasgui.createTabName() : Yasgui.defaults.tabName,
    };
  }
}

export default Tab;

// Return a URL that is safe to display
const safeEndpoint = (endpoint: string): string => {
  const url = new URL(endpoint);
  return encodeURI(url.href);
};

function getCorsErrorRenderer(tab: Tab) {
  return async (error: Parser.ErrorSummary): Promise<HTMLElement | undefined> => {
    // Only show CORS/mixed-content warning for actual network failures (no status code)
    // AND when querying HTTP from HTTPS
    if (!error.status) {
      const shouldReferToHttp =
        new URL(tab.getEndpoint()).protocol === "http:" && window.location.protocol === "https:";

      // Check if this looks like a network error (not just missing status)
      const isNetworkError =
        !error.text ||
        error.text.indexOf("Request has been terminated") >= 0 ||
        error.text.indexOf("Failed to fetch") >= 0 ||
        error.text.indexOf("NetworkError") >= 0 ||
        error.text.indexOf("Network request failed") >= 0;

      if (shouldReferToHttp && isNetworkError) {
        const errorEl = document.createElement("div");
        const errorSpan = document.createElement("p");
        errorSpan.innerHTML = `You are trying to query an HTTP endpoint (<a href="${safeEndpoint(
          tab.getEndpoint(),
        )}" target="_blank" rel="noopener noreferrer">${safeEndpoint(
          tab.getEndpoint(),
        )}</a>) from an HTTP<strong>S</strong> website (<a href="${safeEndpoint(window.location.href)}">${safeEndpoint(
          window.location.href,
        )}</a>).<br>This can be blocked in modern browsers, see <a target="_blank" rel="noopener noreferrer" href="https://developer.mozilla.org/en-US/docs/Web/Security/Same-origin_policy">https://developer.mozilla.org/en-US/docs/Web/Security/Same-origin_policy</a>. See also <a href="https://matgui-doc.matdata.eu/docs/user-guide#querying-local-endpoints">the Matgui documentation</a> for possible workarounds.`;
        errorEl.appendChild(errorSpan);
        return errorEl;
      }
    }
  };
}
