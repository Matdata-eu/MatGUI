import type Yasgui from "../index";
import { addClass, removeClass } from "@matdata/yasgui-utils";
import { getWorkspaceBackend } from "./backends/getWorkspaceBackend";
import type { BackendType, ManagedTabMetadata, ReadResult, VersionInfo, VersionRef } from "./types";
import { queryRefFromId, versionRefFromTag } from "./queryRefs";
import { hashQueryText } from "./textHash";
import { getEndpointToAutoSwitch } from "./openManagedQuery";
import { asWorkspaceBackendError } from "./backends/errors";

import "./QueryHistoryModal.scss";

export default class QueryHistoryModal {
  private yasgui: Yasgui;

  private overlayEl: HTMLDivElement;
  private modalEl: HTMLDivElement;
  private titleEl: HTMLHeadingElement;
  private versionsListEl: HTMLDivElement;
  private loadingEl: HTMLDivElement;
  private errorEl: HTMLDivElement;
  private previewEmptyEl: HTMLDivElement;
  private previewContentEl: HTMLPreElement;
  private openTabBtn: HTMLButtonElement;

  private workspaceId?: string;
  private backend?: ReturnType<typeof getWorkspaceBackend>;
  private backendType?: BackendType;
  private queryId?: string;
  private queryLabel?: string;

  private selectedVersionId?: string;
  private selectedVersionRead?: ReadResult;

  private mouseDownOnOverlay = false;
  private resolve?: () => void;

  constructor(yasgui: Yasgui) {
    this.yasgui = yasgui;

    this.overlayEl = document.createElement("div");
    addClass(this.overlayEl, "queryHistoryModalOverlay");

    this.modalEl = document.createElement("div");
    addClass(this.modalEl, "queryHistoryModal");
    this.modalEl.setAttribute("role", "dialog");
    this.modalEl.setAttribute("aria-modal", "true");
    this.modalEl.addEventListener("click", (e) => e.stopPropagation());

    // ── Header ───────────────────────────────────────────────────────────────
    const headerEl = document.createElement("div");
    addClass(headerEl, "queryHistoryModalHeader");

    this.titleEl = document.createElement("h2");
    this.titleEl.textContent = "Query History";

    const closeBtn = document.createElement("button");
    closeBtn.type = "button";
    closeBtn.className = "closeButton";
    closeBtn.setAttribute("aria-label", "Close");
    closeBtn.innerHTML = "&times;";
    closeBtn.addEventListener("click", () => this.close());

    headerEl.appendChild(this.titleEl);
    headerEl.appendChild(closeBtn);

    // ── Body ─────────────────────────────────────────────────────────────────
    const bodyEl = document.createElement("div");
    addClass(bodyEl, "queryHistoryModalBody");

    // Left panel – version list
    const versionsPanel = document.createElement("div");
    addClass(versionsPanel, "queryHistoryVersionsPanel");

    const versionsPanelTitle = document.createElement("div");
    addClass(versionsPanelTitle, "queryHistoryPanelTitle");
    versionsPanelTitle.textContent = "Versions";

    this.loadingEl = document.createElement("div");
    addClass(this.loadingEl, "queryHistoryLoading");
    this.loadingEl.textContent = "Loading versions…";

    this.errorEl = document.createElement("div");
    addClass(this.errorEl, "queryHistoryError");

    this.versionsListEl = document.createElement("div");
    addClass(this.versionsListEl, "queryHistoryVersionsList");

    versionsPanel.appendChild(versionsPanelTitle);
    versionsPanel.appendChild(this.loadingEl);
    versionsPanel.appendChild(this.errorEl);
    versionsPanel.appendChild(this.versionsListEl);

    // Right panel – preview
    const previewPanel = document.createElement("div");
    addClass(previewPanel, "queryHistoryPreviewPanel");

    const previewPanelTitle = document.createElement("div");
    addClass(previewPanelTitle, "queryHistoryPanelTitle");
    previewPanelTitle.textContent = "Preview";

    this.previewEmptyEl = document.createElement("div");
    addClass(this.previewEmptyEl, "queryHistoryPreviewEmpty");
    this.previewEmptyEl.textContent = "Select a version to preview";

    this.previewContentEl = document.createElement("pre");
    addClass(this.previewContentEl, "queryHistoryPreviewContent");

    previewPanel.appendChild(previewPanelTitle);
    previewPanel.appendChild(this.previewEmptyEl);
    previewPanel.appendChild(this.previewContentEl);

    bodyEl.appendChild(versionsPanel);
    bodyEl.appendChild(previewPanel);

    // ── Footer ────────────────────────────────────────────────────────────────
    const footerEl = document.createElement("div");
    addClass(footerEl, "queryHistoryModalFooter");

    const cancelBtn = document.createElement("button");
    cancelBtn.type = "button";
    cancelBtn.textContent = "Close";
    cancelBtn.addEventListener("click", () => this.close());

    this.openTabBtn = document.createElement("button");
    this.openTabBtn.type = "button";
    this.openTabBtn.textContent = "Open in tab";
    addClass(this.openTabBtn, "primary");
    this.openTabBtn.disabled = true;
    this.openTabBtn.addEventListener("click", () => void this.openSelectedVersionInTab());

    footerEl.appendChild(cancelBtn);
    footerEl.appendChild(this.openTabBtn);

    // ── Assemble ──────────────────────────────────────────────────────────────
    this.modalEl.appendChild(headerEl);
    this.modalEl.appendChild(bodyEl);
    this.modalEl.appendChild(footerEl);

    this.overlayEl.appendChild(this.modalEl);

    this.overlayEl.addEventListener("mousedown", (e) => {
      if (e.target === this.overlayEl) this.mouseDownOnOverlay = true;
    });
    this.overlayEl.addEventListener("mouseup", (e) => {
      if (e.target === this.overlayEl && this.mouseDownOnOverlay) this.close();
      this.mouseDownOnOverlay = false;
    });
  }

  /** Bound keydown handler stored so it can be removed on close. */
  private readonly onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      e.stopPropagation();
      this.close();
    }
  };

  /**
   * Show the history modal for the given managed query.
   * Returns a promise that resolves when the modal is closed.
   */
  public show(
    workspaceId: string,
    backend: ReturnType<typeof getWorkspaceBackend>,
    backendType: BackendType,
    queryId: string,
    queryLabel: string,
  ): Promise<void> {
    this.workspaceId = workspaceId;
    this.backend = backend;
    this.backendType = backendType;
    this.queryId = queryId;
    this.queryLabel = queryLabel;

    // Reset state
    this.selectedVersionId = undefined;
    this.selectedVersionRead = undefined;
    this.versionsListEl.innerHTML = "";
    this.previewContentEl.textContent = "";
    this.previewContentEl.style.display = "none";
    this.previewEmptyEl.style.display = "block";
    this.loadingEl.style.display = "block";
    this.errorEl.textContent = "";
    this.errorEl.style.display = "none";
    this.openTabBtn.disabled = true;
    this.titleEl.textContent = `History: ${queryLabel}`;
    this.mouseDownOnOverlay = false;

    document.body.appendChild(this.overlayEl);
    addClass(this.overlayEl, "open");
    document.addEventListener("keydown", this.onKeyDown);

    void this.loadVersions();

    return new Promise<void>((resolve) => {
      this.resolve = resolve;
    });
  }

  private close() {
    document.removeEventListener("keydown", this.onKeyDown);
    removeClass(this.overlayEl, "open");
    this.overlayEl.remove();
    const resolve = this.resolve;
    this.resolve = undefined;
    resolve?.();
  }

  private async loadVersions() {
    if (!this.backend || !this.queryId) return;

    try {
      const versions = await this.backend.listVersions(this.queryId);
      this.loadingEl.style.display = "none";
      this.renderVersions(versions);
    } catch (err) {
      this.loadingEl.style.display = "none";
      this.errorEl.textContent = `Failed to load versions: ${asWorkspaceBackendError(err).message}`;
      this.errorEl.style.display = "block";
    }
  }

  private renderVersions(versions: VersionInfo[]) {
    this.versionsListEl.innerHTML = "";

    if (versions.length === 0) {
      const emptyEl = document.createElement("div");
      addClass(emptyEl, "queryHistoryEmpty");
      emptyEl.textContent = "No version history found.";
      this.versionsListEl.appendChild(emptyEl);
      return;
    }

    for (const version of versions) {
      const item = document.createElement("div");
      addClass(item, "queryHistoryVersionItem");
      item.setAttribute("role", "button");
      item.setAttribute("tabindex", "0");

      const dateEl = document.createElement("div");
      addClass(dateEl, "queryHistoryVersionDate");
      dateEl.textContent = this.formatDate(version.createdAt);
      item.appendChild(dateEl);

      if (version.author) {
        const authorEl = document.createElement("div");
        addClass(authorEl, "queryHistoryVersionMeta");
        authorEl.textContent = version.author;
        item.appendChild(authorEl);
      }

      if (version.message) {
        const msgEl = document.createElement("div");
        addClass(msgEl, "queryHistoryVersionMessage");
        msgEl.textContent = version.message;
        item.appendChild(msgEl);
      }

      const selectFn = () => void this.selectVersion(version.id, item);
      item.addEventListener("click", selectFn);
      item.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          selectFn();
        }
      });

      this.versionsListEl.appendChild(item);
    }
  }

  private async selectVersion(versionId: string, itemEl: HTMLElement) {
    // Highlight the selected item
    this.versionsListEl.querySelectorAll(".queryHistoryVersionItem").forEach((el) => {
      removeClass(el as HTMLElement, "queryHistoryVersionItem--selected");
    });
    addClass(itemEl, "queryHistoryVersionItem--selected");

    // Reset selection state and show loading in preview
    this.selectedVersionId = undefined;
    this.selectedVersionRead = undefined;
    this.openTabBtn.disabled = true;
    this.previewEmptyEl.style.display = "none";
    this.previewContentEl.style.display = "block";
    this.previewContentEl.textContent = "Loading…";

    if (!this.backend || !this.queryId) return;

    try {
      const read = await this.backend.readVersion(this.queryId, versionId);
      this.selectedVersionId = versionId;
      this.selectedVersionRead = read;
      this.previewContentEl.textContent = read.queryText;
      this.openTabBtn.disabled = false;
    } catch (err) {
      this.previewContentEl.textContent = `Error: ${asWorkspaceBackendError(err).message}`;
    }
  }

  private async openSelectedVersionInTab() {
    if (
      !this.selectedVersionId ||
      !this.selectedVersionRead ||
      !this.workspaceId ||
      !this.backendType ||
      !this.queryId
    ) {
      return;
    }

    const { workspaceId, backendType, queryId, queryLabel } = this;
    const read = this.selectedVersionRead;

    const tab = this.yasgui.addTab(true);
    if (queryLabel) tab.setName(queryLabel);

    const endpoint = getEndpointToAutoSwitch(backendType, read);
    if (endpoint) tab.setEndpoint(endpoint);

    tab.setQuery(read.queryText);

    const versionRef: VersionRef | undefined = versionRefFromTag(backendType, read.versionTag);

    const managedMetadata: ManagedTabMetadata = {
      workspaceId,
      backendType,
      queryRef: queryRefFromId(backendType, queryId),
      lastSavedVersionRef: versionRef,
      lastSavedTextHash: hashQueryText(read.queryText),
    };
    tab.setManagedQueryMetadata(managedMetadata);

    this.close();
  }

  private formatDate(isoDate: string): string {
    const d = new Date(isoDate);
    if (isNaN(d.getTime())) return "Unknown date";
    return d.toLocaleString();
  }
}
