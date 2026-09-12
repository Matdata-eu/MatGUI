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
import { getWorkspaceBackend } from "./queryManagement/backends/getWorkspaceBackend";
import { asWorkspaceBackendError } from "./queryManagement/backends/errors";
import { normalizeQueryFilename } from "./queryManagement/normalizeQueryFilename";
import { resolveEndpointUrl } from "./urlUtils";

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
  private endpointButtonsContainer: HTMLDivElement | undefined;
  private endpointOverflowButton: HTMLButtonElement | undefined;
  private endpointOverflowDropdown: HTMLDivElement | undefined;
  private endpointButtonConfigs: Array<{ endpoint: string; label: string }> = [];
  private resizeObserver: ResizeObserver | undefined;
  private settingsModal?: TabSettingsModal;
  private currentOrientation: "vertical" | "horizontal";
  private orientationToggleButton?: HTMLButtonElement;
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

    const backend = getWorkspaceBackend(workspace, { persistentConfig: this.yasgui.persistentConfig });
    const meta = this.getManagedQueryMetadata();

    const expectedVersionTag = (() => {
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

  private initControlbar() {
    this.initOrientationToggle();
    this.initEndpointSelectField();
    this.initEndpointButtons();
    if (this.yasgui.config.endpointInfo && this.controlBarEl) {
      this.controlBarEl.appendChild(this.yasgui.config.endpointInfo());
    }
  }

  private initOrientationToggle() {
    if (!this.controlBarEl) return;

    this.orientationToggleButton = document.createElement("button");
    this.orientationToggleButton.className = "tabContextButton orientationToggle desktopOnly";
    this.orientationToggleButton.setAttribute("aria-label", "Toggle layout orientation");
    this.orientationToggleButton.title = "Toggle layout orientation";

    this.updateOrientationToggleIcon();

    this.orientationToggleButton.addEventListener("click", () => {
      this.toggleOrientation();
    });

    this.controlBarEl.appendChild(this.orientationToggleButton);
  }

  public updateOrientationToggleIcon() {
    if (!this.orientationToggleButton) return;

    // Show the icon for the layout we'll switch TO (not the current layout)
    // fa-columns for horizontal (side-by-side), fa-grip-lines for vertical (stacked)
    this.orientationToggleButton.innerHTML =
      this.currentOrientation === "vertical"
        ? '<i class="fas fa-grip-lines-vertical"></i>'
        : '<i class="fas fa-grip-lines"></i>';
    this.orientationToggleButton.title =
      this.currentOrientation === "vertical" ? "Switch to horizontal layout" : "Switch to vertical layout";
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
  }

  private initEndpointButtons() {
    if (!this.controlBarEl) throw new Error("Need to initialize wrapper elements before drawing endpoint buttons");

    // Create container if it doesn't exist
    if (!this.endpointButtonsContainer) {
      this.endpointButtonsContainer = document.createElement("div");
      addClass(this.endpointButtonsContainer, "endpointButtonsContainer");
      this.controlBarEl.appendChild(this.endpointButtonsContainer);
    }

    this.refreshEndpointButtons();
    this.initEndpointButtonsResizeObserver();
  }

  private initEndpointButtonsResizeObserver() {
    if (!this.controlBarEl || !this.endpointButtonsContainer) return;

    // Clean up existing observer
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
    }

    // Create resize observer to detect when we need to show overflow
    this.resizeObserver = new ResizeObserver(() => {
      this.updateEndpointButtonsOverflow();
    });

    this.resizeObserver.observe(this.controlBarEl);
  }

  private updateEndpointButtonsOverflow() {
    if (!this.endpointButtonsContainer || !this.controlBarEl) return;

    // Get all actual endpoint buttons (not the overflow button)
    const buttons = Array.from(
      this.endpointButtonsContainer.querySelectorAll(".endpointButton:not(.endpointOverflowBtn)"),
    ) as HTMLButtonElement[];

    if (buttons.length === 0) {
      this.hideOverflowButton();
      return;
    }

    // Get the container's available width
    const containerRect = this.controlBarEl.getBoundingClientRect();
    const containerWidth = containerRect.width;

    // Calculate the space used by other elements (endpoint select, settings buttons, etc.)
    const endpointButtonsRect = this.endpointButtonsContainer.getBoundingClientRect();
    const buttonsContainerLeft = endpointButtonsRect.left - containerRect.left;

    // Estimate available space for endpoint buttons (leave some margin for overflow button)
    const overflowButtonWidth = 40; // Approximate width of overflow button
    const availableWidth = containerWidth - buttonsContainerLeft - overflowButtonWidth - 20; // 20px margin

    // Make all buttons temporarily visible to measure
    buttons.forEach((btn) => btn.classList.remove("endpointButtonHidden"));

    // Check if buttons overflow
    let totalWidth = 0;
    let overflowIndex = -1;

    for (let i = 0; i < buttons.length; i++) {
      const btn = buttons[i];
      const btnWidth = btn.offsetWidth + 4; // Include gap
      totalWidth += btnWidth;

      if (totalWidth > availableWidth && overflowIndex === -1) {
        overflowIndex = i;
      }
    }

    if (overflowIndex === -1) {
      // All buttons fit, hide overflow button
      this.hideOverflowButton();
      buttons.forEach((btn) => btn.classList.remove("endpointButtonHidden"));
    } else {
      // Some buttons need to go into overflow
      buttons.forEach((btn, index) => {
        if (index >= overflowIndex) {
          btn.classList.add("endpointButtonHidden");
        } else {
          btn.classList.remove("endpointButtonHidden");
        }
      });
      this.showOverflowButton(overflowIndex);
    }
  }

  private showOverflowButton(overflowStartIndex: number) {
    if (!this.endpointButtonsContainer) return;

    // Create overflow button if it doesn't exist
    if (!this.endpointOverflowButton) {
      this.endpointOverflowButton = document.createElement("button");
      addClass(this.endpointOverflowButton, "endpointOverflowBtn");
      this.endpointOverflowButton.innerHTML = '<i class="fas fa-ellipsis-vertical"></i>';
      this.endpointOverflowButton.title = "More endpoints";
      this.endpointOverflowButton.setAttribute("aria-label", "More endpoint options");
      this.endpointOverflowButton.setAttribute("aria-haspopup", "true");
      this.endpointOverflowButton.setAttribute("aria-expanded", "false");

      this.endpointOverflowButton.addEventListener("click", (e) => {
        e.stopPropagation();
        this.toggleOverflowDropdown();
      });

      this.endpointButtonsContainer.appendChild(this.endpointOverflowButton);
    }

    // Update the overflow button's data with which buttons are hidden
    this.endpointOverflowButton.dataset.overflowStart = String(overflowStartIndex);
    this.endpointOverflowButton.style.display = "flex";
  }

  private hideOverflowButton() {
    if (this.endpointOverflowButton) {
      this.endpointOverflowButton.style.display = "none";
    }
    this.closeOverflowDropdown();
  }

  private toggleOverflowDropdown() {
    if (this.endpointOverflowDropdown && this.endpointOverflowDropdown.style.display !== "none") {
      this.closeOverflowDropdown();
    } else {
      this.openOverflowDropdown();
    }
  }

  private openOverflowDropdown() {
    if (!this.endpointOverflowButton || !this.endpointButtonsContainer) return;

    const overflowStartIndex = parseInt(this.endpointOverflowButton.dataset.overflowStart || "0", 10);
    const overflowButtons = this.endpointButtonConfigs.slice(overflowStartIndex);

    if (overflowButtons.length === 0) return;

    // Create dropdown if it doesn't exist
    if (!this.endpointOverflowDropdown) {
      this.endpointOverflowDropdown = document.createElement("div");
      addClass(this.endpointOverflowDropdown, "endpointOverflowDropdown");
      this.endpointButtonsContainer.appendChild(this.endpointOverflowDropdown);
    }

    // Clear and populate dropdown
    this.endpointOverflowDropdown.innerHTML = "";

    overflowButtons.forEach((buttonConfig) => {
      const item = document.createElement("button");
      addClass(item, "endpointOverflowItem");
      item.textContent = buttonConfig.label;
      item.title = `Set endpoint to ${buttonConfig.endpoint}`;
      item.setAttribute("aria-label", `Set endpoint to ${buttonConfig.endpoint}`);

      item.addEventListener("click", () => {
        this.setEndpoint(buttonConfig.endpoint);
        this.closeOverflowDropdown();
      });

      this.endpointOverflowDropdown!.appendChild(item);
    });

    // Position and show dropdown
    this.endpointOverflowDropdown.style.display = "block";
    this.endpointOverflowButton.setAttribute("aria-expanded", "true");

    // Add click-outside listener to close dropdown
    const closeHandler = (e: MouseEvent) => {
      if (
        this.endpointOverflowDropdown &&
        !this.endpointOverflowDropdown.contains(e.target as Node) &&
        e.target !== this.endpointOverflowButton
      ) {
        this.closeOverflowDropdown();
        document.removeEventListener("click", closeHandler);
      }
    };

    // Delay adding listener to avoid immediate close
    setTimeout(() => {
      document.addEventListener("click", closeHandler);
    }, 0);
  }

  private closeOverflowDropdown() {
    if (this.endpointOverflowDropdown) {
      this.endpointOverflowDropdown.style.display = "none";
    }
    if (this.endpointOverflowButton) {
      this.endpointOverflowButton.setAttribute("aria-expanded", "false");
    }
  }

  public refreshEndpointButtons() {
    if (!this.endpointButtonsContainer) return;

    // Clear existing buttons (but keep overflow button reference)
    this.endpointButtonsContainer.innerHTML = "";
    this.endpointOverflowButton = undefined;
    this.endpointOverflowDropdown = undefined;

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

    const allButtons = [...configButtons, ...endpointButtons, ...customButtons];

    // Store button configs for overflow dropdown
    this.endpointButtonConfigs = allButtons;

    if (allButtons.length === 0) {
      // Hide container if no buttons
      this.endpointButtonsContainer.style.display = "none";
      return;
    }

    // Show container
    this.endpointButtonsContainer.style.display = "flex";

    allButtons.forEach((buttonConfig) => {
      const button = document.createElement("button");
      addClass(button, "endpointButton");
      button.textContent = buttonConfig.label;
      button.title = `Set endpoint to ${buttonConfig.endpoint}`;
      button.setAttribute("aria-label", `Set endpoint to ${buttonConfig.endpoint}`);

      button.addEventListener("click", () => {
        this.setEndpoint(buttonConfig.endpoint);
      });

      this.endpointButtonsContainer!.appendChild(button);
    });

    // Trigger overflow check after rendering
    requestAnimationFrame(() => {
      this.updateEndpointButtonsOverflow();
    });
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
      // Use global showSnippetsBar setting if it exists
      showSnippetsBar: this.yasgui.config.showSnippetsBar !== false,
      showMapButton: false,
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

    this.yasqe.on("blur", this.handleYasqeBlur);
    this.yasqe.on("query", this.handleYasqeQuery);
    this.yasqe.on("queryBefore", this.handleYasqeQueryBefore);
    this.yasqe.on("queryAbort", this.handleYasqeQueryAbort);
    this.yasqe.on("resize", this.handleYasqeResize);

    this.yasqe.on("autocompletionShown", this.handleAutocompletionShown);
    this.yasqe.on("autocompletionClose", this.handleAutocompletionClose);

    this.yasqe.on("queryResponse", this.handleQueryResponse);

    // Add Ctrl+Click handler for URIs
    this.attachYasqeMouseHandler();
  }

  private updateSaveButtonVisibility() {
    if (!this.yasqe) return;
    const workspaces = this.yasgui.persistentConfig.getWorkspaces();
    const hasWorkspaces = workspaces && workspaces.length > 0;
    this.yasqe.setSaveButtonVisible(hasWorkspaces);
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
    this.detachYasqeMouseHandler();
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
    const token = this.yasqe.getTokenAt(pos);

    // Check if token is a URI (not a variable)
    // URIs typically have token.type of 'string-2' or might be in angle brackets
    let tokenString = token.string.trim();

    // Skip if it's a variable (starts with ? or $)
    if (tokenString.startsWith("?") || tokenString.startsWith("$")) return;

    // Handle prefixed names that may be split into multiple tokens by the tokenizer
    // The tokenizer splits "prefix:localname" into two tokens:
    // - PNAME_LN_PREFIX (e.g., "bnd:") with type "string-2"
    // - PNAME_LN_LOCAL (e.g., "_subnetwork_bane_KVGB") with type "string"
    // We need to combine them to get the full prefixed name
    if (token.type === "string-2" && tokenString.endsWith(":")) {
      // This is a prefix token, get the next token for the local name
      const nextToken = this.yasqe.getTokenAt({ line: pos.line, ch: token.end + 1 });
      if (nextToken && nextToken.type === "string" && nextToken.start === token.end) {
        tokenString = `${tokenString}${nextToken.string.trim()}`;
      }
    } else if (token.type === "string" && token.start > 0) {
      // This might be a local name token, check if previous token is a prefix
      const prevToken = this.yasqe.getTokenAt({ line: pos.line, ch: token.start - 1 });
      if (
        prevToken &&
        prevToken.type === "string-2" &&
        prevToken.string.trim().endsWith(":") &&
        prevToken.end === token.start
      ) {
        tokenString = `${prevToken.string.trim()}${tokenString}`;
      }
    }

    // Check if it's a URI - either in angle brackets or a prefixed name
    const isFullUri = tokenString.startsWith("<") && tokenString.endsWith(">");
    const isPrefixedName = /^[\w-]+:/.test(tokenString);

    if (!isFullUri && !isPrefixedName) return;

    event.preventDefault();
    event.stopPropagation();

    // Extract the URI
    let uri = tokenString;
    if (isFullUri) {
      // Remove angle brackets
      uri = tokenString.slice(1, -1);
    } else if (isPrefixedName) {
      // Expand prefixed name to full URI
      const prefixes = this.yasqe.getPrefixesFromQuery();
      const [prefix, ...localParts] = tokenString.split(":");
      const localName = localParts.join(":");
      const prefixUri = prefixes[prefix];
      if (prefixUri) {
        uri = prefixUri + localName;
      }
    }

    // Construct the query based on whether Shift is held
    let constructQuery: string;
    if (event.shiftKey) {
      // Ctrl+Shift+Click: find all triples where URI is the object
      constructQuery = buildObjectOfQuery(uri);
    } else {
      // Ctrl+Click: find all triples where URI is subject or object
      constructQuery = `CONSTRUCT {   
  ?s_left ?p_left ?target .
  ?target ?p_right ?o_right .
}
WHERE {
  BIND(<${uri}> as ?target)
  {
    ?s_left ?p_left ?target .
  }
  UNION
  {
    ?target ?p_right ?o_right .
  }  
} LIMIT 1000`;
    }

    // Execute query in background without changing editor content
    // Note: void operator is intentional - errors are handled in the catch block of executeBackgroundQuery
    void this.executeBackgroundQuery(constructQuery);
  };

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
          silent: true,
        });
        return response;
      },
    };
    // Allow getDownloadFilName to be overwritten by the global config
    if (yasrConf.getDownloadFileName === undefined) {
      yasrConf.getDownloadFileName = () => words(deburr(this.getName())).join("-");
    }

    this.yasr = new Yasr(this.yasrWrapperEl, yasrConf, this.persistentJson.yasr.response);

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
    this.verticalResizerEl.addEventListener("mousedown", this.initVerticalDrag, false);
    this.verticalResizerEl.addEventListener("dblclick", this.resetVerticalSplit, false);
    this.rootEl.appendChild(this.verticalResizerEl);
  }

  private initVerticalDrag = () => {
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

    const offset = this.calculateVerticalDragOffset(event);
    const totalWidth = this.rootEl.offsetWidth;

    // Ensure minimum widths (at least 200px for each panel)
    const minWidth = 200;
    const maxWidth = totalWidth - minWidth - 10; // 10px for resizer

    const newWidth = Math.max(minWidth, Math.min(maxWidth, offset));
    this.editorWrapperEl.style.width = newWidth + "px";
    this.editorWrapperEl.style.flex = "0 0 " + newWidth + "px";
  };

  private stopVerticalDrag = () => {
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

    // Clean up resize observer for endpoint buttons overflow
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = undefined;
    }

    this.removeAllListeners();
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
