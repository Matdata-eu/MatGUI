import type Yasgui from "../index";
import { addClass, removeClass } from "@matdata/yasgui-utils";
import { getWorkspaceBackend } from "./backends/getWorkspaceBackend";
import { normalizeQueryFilename } from "./normalizeQueryFilename";
import { getWritableWorkspaces } from "./readOnlyWorkspace";
import type { FolderEntry, WorkspaceConfig } from "./types";

import "./SaveManagedQueryModal.scss";

export interface SaveManagedQueryModalResult {
  workspaceId: string;
  folderPath: string;
  name: string;
  filename: string;
  message?: string;
}

export default class SaveManagedQueryModal {
  private yasgui: Yasgui;
  private overlayEl: HTMLDivElement;
  private modalEl: HTMLDivElement;

  private formEl: HTMLFormElement;
  private workspaceSelectEl: HTMLSelectElement;
  private folderPathEl: HTMLInputElement;
  private folderPickerToggleEl: HTMLButtonElement;
  private folderPickerEl: HTMLDivElement;
  private folderPickerPathEl: HTMLDivElement;
  private folderPickerListEl: HTMLDivElement;
  private folderPickerErrorEl: HTMLDivElement;
  private newFolderNameEl: HTMLInputElement;

  private nameEl: HTMLInputElement;
  private filenameEl: HTMLInputElement;
  private messageEl: HTMLInputElement;

  private nameRowEl: HTMLDivElement;
  private filenameRowEl: HTMLDivElement;
  private messageRowEl: HTMLDivElement;
  private messageLabelEl: HTMLLabelElement;

  private saveBtn!: HTMLButtonElement;
  private cancelBtn!: HTMLButtonElement;
  private saveBtnOriginalText = "Save";
  private titleEl!: HTMLHeadingElement;
  private workspaceRowEl!: HTMLDivElement;

  private filenameTouched = false;
  private folderPickerOpen = false;
  private folderBrowsePath = "";
  private mouseDownOnOverlay = false;

  private resolve?: (value: SaveManagedQueryModalResult) => void;
  private reject?: (reason?: unknown) => void;
  private moveResolve?: (value: string | undefined) => void;
  private isMoveMode = false;

  constructor(yasgui: Yasgui) {
    this.yasgui = yasgui;

    this.overlayEl = document.createElement("div");
    addClass(this.overlayEl, "saveManagedQueryModalOverlay");

    this.modalEl = document.createElement("div");
    addClass(this.modalEl, "saveManagedQueryModal");
    this.modalEl.addEventListener("click", (e) => e.stopPropagation());

    const headerEl = document.createElement("div");
    addClass(headerEl, "saveManagedQueryModalHeader");

    const titleEl = document.createElement("h2");
    titleEl.textContent = "Save as managed query";
    this.titleEl = titleEl;

    const closeBtn = document.createElement("button");
    closeBtn.type = "button";
    closeBtn.className = "closeButton";
    closeBtn.setAttribute("aria-label", "Close");
    closeBtn.innerHTML = "&times;";
    closeBtn.addEventListener("click", () => this.cancel());

    headerEl.appendChild(titleEl);
    headerEl.appendChild(closeBtn);

    this.formEl = document.createElement("form");
    this.formEl.addEventListener("submit", (e) => {
      e.preventDefault();
      this.submit();
    });

    const bodyEl = document.createElement("div");
    addClass(bodyEl, "saveManagedQueryModalBody");

    this.workspaceSelectEl = document.createElement("select");
    this.workspaceSelectEl.setAttribute("aria-label", "Workspace");
    this.workspaceSelectEl.addEventListener("change", () => {
      this.applyWorkspaceTypeUI();
      if (!this.folderPickerOpen) return;
      this.folderBrowsePath = "";
      this.folderPathEl.value = "";
      void this.refreshFolderPicker();
    });

    this.folderPathEl = document.createElement("input");
    this.folderPathEl.type = "text";
    this.folderPathEl.placeholder = "Select a folder (optional)";
    this.folderPathEl.setAttribute("aria-label", "Folder path");
    this.folderPathEl.readOnly = true;

    this.folderPickerToggleEl = document.createElement("button");
    this.folderPickerToggleEl.type = "button";
    this.folderPickerToggleEl.textContent = "Choose…";
    addClass(this.folderPickerToggleEl, "folderPickerToggle");
    this.folderPickerToggleEl.addEventListener("click", () => {
      this.folderPickerOpen = !this.folderPickerOpen;
      if (this.folderPickerOpen) {
        addClass(this.folderPickerEl, "open");
        this.folderBrowsePath = this.folderPathEl.value.trim();
        void this.refreshFolderPicker();
      } else {
        removeClass(this.folderPickerEl, "open");
      }
    });

    this.folderPickerEl = document.createElement("div");
    addClass(this.folderPickerEl, "folderPicker");
    this.folderPickerPathEl = document.createElement("div");
    addClass(this.folderPickerPathEl, "folderPickerPath");
    this.folderPickerErrorEl = document.createElement("div");
    addClass(this.folderPickerErrorEl, "folderPickerError");
    this.folderPickerListEl = document.createElement("div");
    addClass(this.folderPickerListEl, "folderPickerList");

    const folderPickerActionsEl = document.createElement("div");
    addClass(folderPickerActionsEl, "folderPickerActions");

    const upBtn = document.createElement("button");
    upBtn.type = "button";
    upBtn.textContent = "Up";
    upBtn.addEventListener("click", () => {
      const parts = this.folderBrowsePath.split("/").filter(Boolean);
      parts.pop();
      this.folderBrowsePath = parts.join("/");
      this.folderPathEl.value = this.folderBrowsePath;
      void this.refreshFolderPicker();
    });

    const rootBtn = document.createElement("button");
    rootBtn.type = "button";
    rootBtn.textContent = "Root";
    rootBtn.addEventListener("click", () => {
      this.folderBrowsePath = "";
      this.folderPathEl.value = "";
      void this.refreshFolderPicker();
    });

    folderPickerActionsEl.appendChild(rootBtn);
    folderPickerActionsEl.appendChild(upBtn);

    const newFolderRowEl = document.createElement("div");
    addClass(newFolderRowEl, "newFolderRow");
    this.newFolderNameEl = document.createElement("input");
    this.newFolderNameEl.type = "text";
    this.newFolderNameEl.placeholder = "New folder name";
    this.newFolderNameEl.setAttribute("aria-label", "New folder name");
    this.newFolderNameEl.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        e.stopPropagation();
        this.createNewFolderSelection();
      }
    });

    const createFolderBtn = document.createElement("button");
    createFolderBtn.type = "button";
    createFolderBtn.textContent = "Create";
    createFolderBtn.addEventListener("click", () => this.createNewFolderSelection());

    newFolderRowEl.appendChild(this.newFolderNameEl);
    newFolderRowEl.appendChild(createFolderBtn);

    this.folderPickerEl.appendChild(this.folderPickerPathEl);
    this.folderPickerEl.appendChild(folderPickerActionsEl);
    this.folderPickerEl.appendChild(this.folderPickerErrorEl);
    this.folderPickerEl.appendChild(this.folderPickerListEl);
    this.folderPickerEl.appendChild(newFolderRowEl);

    this.nameEl = document.createElement("input");
    this.nameEl.type = "text";
    this.nameEl.placeholder = "Name";
    this.nameEl.setAttribute("aria-label", "Name");
    this.nameEl.addEventListener("input", () => {
      if (this.filenameTouched) return;
      const suggested = this.suggestFilenameFromName(this.nameEl.value);
      if (suggested) this.filenameEl.value = suggested.replace(/\.(rq|sparql)$/i, "");
    });

    this.filenameEl = document.createElement("input");
    this.filenameEl.type = "text";
    this.filenameEl.placeholder = "Filename (e.g., my-query)";
    this.filenameEl.setAttribute("aria-label", "Filename");
    this.filenameEl.addEventListener("input", () => {
      this.filenameTouched = true;
    });

    this.messageEl = document.createElement("input");
    this.messageEl.type = "text";
    this.messageEl.placeholder = "Save message (optional)";
    this.messageEl.setAttribute("aria-label", "Save message");

    const workspaceRow = this.row("Workspace", this.workspaceSelectEl);
    this.workspaceRowEl = workspaceRow;
    const folderRow = this.folderRow();
    this.nameRowEl = this.row("Name", this.nameEl);
    this.filenameRowEl = this.row("Filename", this.filenameEl);

    // Build the message row with a mutable label (Message vs Description)
    this.messageRowEl = document.createElement("div");
    addClass(this.messageRowEl, "saveManagedQueryModalRow");
    this.messageLabelEl = document.createElement("label");
    this.messageLabelEl.textContent = "Message";
    this.messageRowEl.appendChild(this.messageLabelEl);
    this.messageRowEl.appendChild(this.messageEl);

    bodyEl.appendChild(workspaceRow);
    bodyEl.appendChild(folderRow);
    bodyEl.appendChild(this.folderPickerEl);
    bodyEl.appendChild(this.nameRowEl);
    bodyEl.appendChild(this.filenameRowEl);
    bodyEl.appendChild(this.messageRowEl);

    const footerEl = document.createElement("div");
    addClass(footerEl, "saveManagedQueryModalFooter");

    this.cancelBtn = document.createElement("button");
    this.cancelBtn.type = "button";
    this.cancelBtn.textContent = "Cancel";
    this.cancelBtn.addEventListener("click", () => this.cancel());

    this.saveBtn = document.createElement("button");
    this.saveBtn.type = "submit";
    this.saveBtn.textContent = "Save";
    this.saveBtnOriginalText = "Save";
    addClass(this.saveBtn, "primary");
    // handled by form submit

    footerEl.appendChild(this.cancelBtn);
    footerEl.appendChild(this.saveBtn);

    this.formEl.appendChild(bodyEl);
    this.formEl.appendChild(footerEl);

    this.modalEl.appendChild(headerEl);
    this.modalEl.appendChild(this.formEl);

    this.overlayEl.appendChild(this.modalEl);

    // Track mousedown on overlay to distinguish from text selection that moves outside
    this.overlayEl.addEventListener("mousedown", (e) => {
      // Only mark as overlay mousedown if the target is the overlay itself (not modal content)
      if (e.target === this.overlayEl) {
        this.mouseDownOnOverlay = true;
      }
    });

    // Only close if mousedown also happened on overlay (not during text selection)
    this.overlayEl.addEventListener("mouseup", (e) => {
      if (e.target === this.overlayEl && this.mouseDownOnOverlay) {
        this.cancel();
      }
      this.mouseDownOnOverlay = false;
    });

    document.addEventListener("keydown", (e) => {
      if (!this.isOpen()) return;
      if (e.key === "Escape") {
        e.preventDefault();
        this.cancel();
      }
    });

    this.close();
  }

  private applyWorkspaceTypeUI() {
    const workspace = this.getSelectedWorkspace();
    const isGit = workspace?.type === "git";
    const isSparql = workspace?.type === "sparql";

    // SPARQL: no filename field; Message becomes Description.
    // Git: no name and no message/description.
    this.nameRowEl.style.display = isGit ? "none" : "";
    this.filenameRowEl.style.display = isSparql ? "none" : "";
    this.messageRowEl.style.display = isGit ? "none" : "";

    if (isSparql) {
      this.messageLabelEl.textContent = "Description";
      this.messageEl.placeholder = "Description (optional)";
      this.messageEl.setAttribute("aria-label", "Description");
    } else {
      this.messageLabelEl.textContent = "Message";
      this.messageEl.placeholder = "Save message (optional)";
      this.messageEl.setAttribute("aria-label", "Save message");
    }
  }

  private folderRow(): HTMLDivElement {
    const rowEl = document.createElement("div");
    addClass(rowEl, "saveManagedQueryModalRow");

    const labelEl = document.createElement("label");
    labelEl.textContent = "Folder";

    const containerEl = document.createElement("div");
    addClass(containerEl, "folderPathContainer");
    containerEl.appendChild(this.folderPathEl);
    containerEl.appendChild(this.folderPickerToggleEl);

    rowEl.appendChild(labelEl);
    rowEl.appendChild(containerEl);
    return rowEl;
  }

  private row(label: string, inputEl: HTMLElement): HTMLDivElement {
    const rowEl = document.createElement("div");
    addClass(rowEl, "saveManagedQueryModalRow");

    const labelEl = document.createElement("label");
    labelEl.textContent = label;

    rowEl.appendChild(labelEl);
    rowEl.appendChild(inputEl);

    return rowEl;
  }

  private isOpen(): boolean {
    return this.overlayEl.classList.contains("open");
  }

  private open() {
    addClass(this.overlayEl, "open");
  }

  private close() {
    removeClass(this.overlayEl, "open");
  }

  private cancel() {
    this.mouseDownOnOverlay = false;
    this.close();
    this.overlayEl.remove();
    if (this.isMoveMode) {
      this.resetMoveMode();
      const resolve = this.moveResolve;
      this.moveResolve = undefined;
      resolve?.(undefined);
    } else {
      this.reject?.(new Error("cancelled"));
      this.resolve = undefined;
      this.reject = undefined;
    }
  }

  private resetMoveMode() {
    this.isMoveMode = false;
    this.titleEl.textContent = "Save as managed query";
    this.saveBtn.textContent = "Save";
    this.saveBtnOriginalText = "Save";
    this.workspaceRowEl.style.display = "";
  }

  private setLoading(isLoading: boolean) {
    if (isLoading) {
      this.saveBtn.disabled = true;
      this.cancelBtn.disabled = true;
      this.saveBtn.textContent = "Saving…";
      addClass(this.saveBtn, "saving");
    } else {
      this.saveBtn.disabled = false;
      this.cancelBtn.disabled = false;
      this.saveBtn.textContent = this.saveBtnOriginalText;
      removeClass(this.saveBtn, "saving");
    }
  }

  public notifySaveInProgress() {
    this.setLoading(true);
  }

  public notifySaveComplete() {
    this.setLoading(false);
  }

  private submit() {
    if (this.isMoveMode) {
      const folderPath = this.folderPathEl.value.trim();
      this.mouseDownOnOverlay = false;
      this.close();
      this.overlayEl.remove();
      this.resetMoveMode();
      const resolve = this.moveResolve;
      this.moveResolve = undefined;
      resolve?.(folderPath);
      return;
    }

    const workspaceId = this.workspaceSelectEl.value;
    const name = this.nameEl.value.trim();
    const filename = this.filenameEl.value.trim();
    const folderPath = this.folderPathEl.value.trim();
    const message = this.messageEl.value.trim();

    const workspace = this.getSelectedWorkspace();
    const isGit = workspace?.type === "git";
    const isSparql = workspace?.type === "sparql";

    if (!workspaceId) {
      window.alert("Please select a workspace");
      return;
    }

    let resolvedName = name;
    let resolvedFilename = filename;

    if (isGit) {
      resolvedFilename = resolvedFilename.replace(/\.(rq|sparql)$/i, "");
      if (!resolvedFilename) {
        window.alert("Please enter a filename");
        return;
      }
      // Derive a tab label for convenience.
      const base = resolvedFilename.replace(/^.*\//, "");
      resolvedName = base || resolvedFilename;
    } else if (isSparql) {
      if (!resolvedName) {
        window.alert("Please enter a name");
        return;
      }
      resolvedFilename = this.suggestFilenameFromName(resolvedName) || normalizeQueryFilename(resolvedName);
    } else {
      // Fallback (should not happen): require both.
      if (!resolvedFilename) {
        window.alert("Please enter a filename");
        return;
      }
      if (!resolvedName) {
        window.alert("Please enter a name");
        return;
      }
    }

    this.mouseDownOnOverlay = false;
    this.close();
    this.overlayEl.remove();

    this.resolve?.({
      workspaceId,
      folderPath,
      name: resolvedName,
      filename: resolvedFilename,
      message: isGit ? undefined : message || undefined,
    });

    this.resolve = undefined;
    this.reject = undefined;
  }

  public async show(defaults?: Partial<SaveManagedQueryModalResult>): Promise<SaveManagedQueryModalResult> {
    // Read-only workspaces are never offered as a save target.
    const workspaces = getWritableWorkspaces(this.yasgui.persistentConfig.getWorkspaces());
    const isWritable = (id: string | undefined) => !!id && workspaces.some((w) => w.id === id);
    const activeWorkspaceId = this.yasgui.persistentConfig.getActiveWorkspaceId();
    const selectedWorkspaceId =
      [defaults?.workspaceId, activeWorkspaceId].find(isWritable) || (workspaces[0]?.id ?? "");

    const orderedWorkspaces = selectedWorkspaceId
      ? [
          ...workspaces.filter((w) => w.id === selectedWorkspaceId),
          ...workspaces.filter((w) => w.id !== selectedWorkspaceId),
        ]
      : workspaces;

    this.workspaceSelectEl.innerHTML = "";
    for (const w of orderedWorkspaces) {
      const opt = document.createElement("option");
      opt.value = w.id;
      opt.textContent = w.label;
      this.workspaceSelectEl.appendChild(opt);
    }

    this.workspaceSelectEl.value = selectedWorkspaceId;

    this.applyWorkspaceTypeUI();

    this.folderPathEl.value = defaults?.folderPath ?? "";
    this.filenameTouched = false;

    const defaultName = defaults?.name ?? "";
    this.nameEl.value = defaultName;

    const defaultFilename =
      defaults?.filename ?? (defaultName ? (this.suggestFilenameFromName(defaultName) ?? "") : "");
    this.filenameEl.value = defaultFilename.replace(/\.(rq|sparql)$/i, "");
    this.messageEl.value = defaults?.message ?? "";

    this.folderPickerOpen = false;
    removeClass(this.folderPickerEl, "open");
    this.folderBrowsePath = this.folderPathEl.value.trim();
    this.folderPickerErrorEl.textContent = "";
    this.folderPickerListEl.innerHTML = "";
    this.mouseDownOnOverlay = false;

    document.body.appendChild(this.overlayEl);
    this.open();

    const selected = this.getSelectedWorkspace();
    if (selected?.type === "git") {
      this.filenameEl.focus();
    } else {
      this.nameEl.focus();
    }

    return await new Promise<SaveManagedQueryModalResult>((resolve, reject) => {
      this.resolve = resolve;
      this.reject = reject;
    });
  }

  private suggestFilenameFromName(name: string): string | undefined {
    const trimmed = name.trim();
    if (!trimmed) return undefined;
    const safe = trimmed.replace(/[\\/]/g, "-");
    try {
      return normalizeQueryFilename(safe);
    } catch {
      return undefined;
    }
  }

  private getSelectedWorkspace(): WorkspaceConfig | undefined {
    const workspaceId = this.workspaceSelectEl.value;
    return this.yasgui.persistentConfig.getWorkspace(workspaceId);
  }

  private async refreshFolderPicker(): Promise<void> {
    this.folderPickerErrorEl.textContent = "";
    this.folderPickerListEl.innerHTML = "";
    this.folderPickerPathEl.textContent = this.folderBrowsePath
      ? `Current: ${this.folderBrowsePath}`
      : "Current: (root)";

    const workspace = this.getSelectedWorkspace();
    if (!workspace) {
      this.folderPickerErrorEl.textContent = "Workspace not found";
      return;
    }

    const backend = getWorkspaceBackend(workspace, { persistentConfig: this.yasgui.persistentConfig });

    let entries: FolderEntry[] = [];
    try {
      entries = await backend.listFolder(this.folderBrowsePath || undefined);
    } catch (e) {
      // For newly-staged folders that don't exist yet, treat as empty.
      const err = e as any;
      if (err?.code && err.code !== "NOT_FOUND") {
        this.folderPickerErrorEl.textContent = err.message || String(e);
        return;
      }
      entries = [];
    }

    const folders = entries
      .filter((x) => x.kind === "folder")
      .sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: "base" }));

    if (folders.length === 0) {
      const emptyEl = document.createElement("div");
      addClass(emptyEl, "folderPickerEmpty");
      emptyEl.textContent = "No subfolders";
      this.folderPickerListEl.appendChild(emptyEl);
      return;
    }

    for (const f of folders) {
      const btn = document.createElement("button");
      btn.type = "button";
      addClass(btn, "folderPickerItem");
      btn.textContent = f.label;
      btn.addEventListener("click", () => {
        this.folderBrowsePath = f.id;
        this.folderPathEl.value = f.id;
        void this.refreshFolderPicker();
      });
      this.folderPickerListEl.appendChild(btn);
    }
  }

  private createNewFolderSelection() {
    const name = this.newFolderNameEl.value.trim();
    if (!name) return;

    const safe = name.replace(/[\\/]/g, "-");
    this.folderBrowsePath = this.folderBrowsePath ? `${this.folderBrowsePath}/${safe}` : safe;
    this.folderPathEl.value = this.folderBrowsePath;
    this.newFolderNameEl.value = "";
    void this.refreshFolderPicker();
  }

  /**
   * Show a simplified modal containing only the folder picker, for moving an existing query.
   * Resolves with the selected folder path (empty string = root), or `undefined` if cancelled.
   */
  public async showFolderPickerOnly(workspaceId: string, currentFolderPath: string): Promise<string | undefined> {
    const workspaces = this.yasgui.persistentConfig.getWorkspaces();

    this.workspaceSelectEl.innerHTML = "";
    for (const w of workspaces) {
      const opt = document.createElement("option");
      opt.value = w.id;
      opt.textContent = w.label;
      this.workspaceSelectEl.appendChild(opt);
    }
    this.workspaceSelectEl.value = workspaceId;

    // Hide rows not needed for a move operation.
    this.workspaceRowEl.style.display = "none";
    this.nameRowEl.style.display = "none";
    this.filenameRowEl.style.display = "none";
    this.messageRowEl.style.display = "none";

    this.folderPathEl.value = currentFolderPath;
    this.filenameTouched = false;
    this.folderPickerOpen = false;
    removeClass(this.folderPickerEl, "open");
    this.folderBrowsePath = currentFolderPath;
    this.folderPickerErrorEl.textContent = "";
    this.folderPickerListEl.innerHTML = "";
    this.mouseDownOnOverlay = false;

    this.titleEl.textContent = "Move to folder";
    this.saveBtn.textContent = "Move";
    this.saveBtnOriginalText = "Move";

    this.isMoveMode = true;

    document.body.appendChild(this.overlayEl);
    this.open();
    this.folderPickerToggleEl.focus();

    return new Promise<string | undefined>((resolve) => {
      this.moveResolve = resolve;
    });
  }
}
