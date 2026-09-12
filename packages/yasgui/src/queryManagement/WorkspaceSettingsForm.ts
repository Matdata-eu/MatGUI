import type PersistentConfig from "../PersistentConfig";
import type { WorkspaceConfig } from "./types";
import { addClass } from "@matdata/yasgui-utils";
import { validateWorkspaceConfig } from "./validateWorkspaceConfig";
import { getWorkspaceBackend } from "./backends/getWorkspaceBackend";
import { asWorkspaceBackendError } from "./backends/errors";
import { countManagedQueries } from "./countManagedQueries";

export interface WorkspaceSettingsFormOptions {
  persistentConfig: PersistentConfig;
  onDeleteRequested: (workspaceId: string) => void;
}

function isNonEmpty(value: string | undefined): boolean {
  return !!value && value.trim().length > 0;
}

function newWorkspaceId(): string {
  return `ws_${Date.now().toString(36)}_${Math.random().toString(16).slice(2)}`;
}

export class WorkspaceSettingsForm {
  private options: WorkspaceSettingsFormOptions;
  private container: HTMLElement;

  constructor(container: HTMLElement, options: WorkspaceSettingsFormOptions) {
    this.container = container;
    this.options = options;
  }

  private async fetchExistingWorkspaces(endpoint: string): Promise<string[]> {
    try {
      const query = `
PREFIX yasgui: <https://matdata.eu/ns/yasgui#>

SELECT DISTINCT ?workspace WHERE {
  ?workspace a yasgui:Workspace .
}
ORDER BY ?workspace`;

      // Get authentication for this endpoint
      const endpointConfig = this.options.persistentConfig.getEndpointConfig(endpoint);
      const headers: Record<string, string> = {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/sparql-results+json",
      };

      // Add authentication headers if configured
      if (endpointConfig?.authentication) {
        const auth = endpointConfig.authentication;
        if (auth.type === "basic") {
          const credentials = btoa(`${auth.username}:${auth.password}`);
          headers["Authorization"] = `Basic ${credentials}`;
        } else if (auth.type === "bearer") {
          headers["Authorization"] = `Bearer ${auth.token}`;
        } else if (auth.type === "apiKey") {
          headers[auth.headerName] = auth.apiKey;
        } else if (auth.type === "oauth2" && auth.accessToken) {
          headers["Authorization"] = `Bearer ${auth.accessToken}`;
        }
      }

      const response = await fetch(endpoint, {
        method: "POST",
        headers,
        body: new URLSearchParams({ query }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      const workspaces: string[] = [];

      if (data.results?.bindings) {
        for (const binding of data.results.bindings) {
          const workspace = binding.workspace?.value;
          if (workspace) {
            workspaces.push(workspace);
          }
        }
      }

      return workspaces;
    } catch (error) {
      console.error("Failed to fetch existing workspaces:", error);
      return [];
    }
  }

  public render() {
    this.container.innerHTML = "";

    const header = document.createElement("div");
    addClass(header, "settingsSection");

    const label = document.createElement("label");
    label.textContent = "Workspaces";
    addClass(label, "settingsLabel");

    const help = document.createElement("div");
    help.textContent =
      "Configure managed-query workspaces (Git or SPARQL). Credentials are stored locally and are never shown again after entry.";
    addClass(help, "settingsHelp");

    header.appendChild(label);
    header.appendChild(help);

    const activeRow = document.createElement("div");
    addClass(activeRow, "checkboxContainer");

    const activeLabel = document.createElement("label");
    activeLabel.textContent = "Default workspace";
    activeLabel.style.marginRight = "10px";

    const activeSelect = document.createElement("select");
    activeSelect.setAttribute("aria-label", "Select default workspace");
    addClass(activeSelect, "settingsSelect");

    const workspaces = this.options.persistentConfig.getWorkspaces();
    const persistedActive = this.options.persistentConfig.getActiveWorkspaceId();

    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = workspaces.length ? "Select workspace" : "No workspaces";
    activeSelect.appendChild(placeholder);

    for (const w of workspaces) {
      const opt = document.createElement("option");
      opt.value = w.id;
      opt.textContent = w.label;
      activeSelect.appendChild(opt);
    }

    activeSelect.value = persistedActive || "";
    activeSelect.onchange = () => {
      const selected = activeSelect.value || undefined;
      this.options.persistentConfig.setActiveWorkspaceId(selected);
    };

    activeRow.appendChild(activeLabel);
    activeRow.appendChild(activeSelect);

    header.appendChild(activeRow);
    this.container.appendChild(header);

    if (workspaces.length === 0) {
      const empty = document.createElement("div");
      addClass(empty, "settingsHelp");
      empty.textContent = "No workspaces configured yet. Add one below.";
      this.container.appendChild(empty);
    }

    this.renderWorkspaceList(workspaces);
    this.renderAddWorkspaceButton();
  }

  private renderWorkspaceList(workspaces: WorkspaceConfig[]) {
    if (workspaces.length === 0) return;

    const section = document.createElement("div");
    addClass(section, "settingsSection");

    const label = document.createElement("label");
    label.textContent = "Configured workspaces";
    addClass(label, "settingsLabel");
    section.appendChild(label);

    const list = document.createElement("div");
    addClass(list, "workspaceList");

    for (const workspace of workspaces) {
      const row = document.createElement("div");
      addClass(row, "workspaceListRow");

      const nameEl = document.createElement("div");
      addClass(nameEl, "workspaceListLabel");
      nameEl.textContent = workspace.label || workspace.id;
      row.appendChild(nameEl);

      const actions = document.createElement("div");
      addClass(actions, "workspaceListActions");

      const status = document.createElement("div");
      addClass(status, "workspaceListStatus");

      const editBtn = document.createElement("button");
      editBtn.type = "button";
      editBtn.textContent = "Edit";
      addClass(editBtn, "secondaryButton");
      editBtn.onclick = () => {
        status.textContent = "";
        this.openWorkspaceConfigModal({ mode: "edit", workspace });
      };

      const validateBtn = document.createElement("button");
      validateBtn.type = "button";
      validateBtn.textContent = "Validate";
      addClass(validateBtn, "secondaryButton");
      validateBtn.onclick = async () => {
        try {
          status.textContent = "Validating…";
          const backend = getWorkspaceBackend(workspace, { persistentConfig: this.options.persistentConfig });
          await backend.validateAccess();
          const queryCount = await countManagedQueries(backend);
          const queryLabel = queryCount === 1 ? "query" : "queries";
          status.textContent = `✓ Access OK (${queryCount} saved managed ${queryLabel})`;
        } catch (e) {
          const err = asWorkspaceBackendError(e);
          status.textContent = err.message;
        }
      };

      const removeBtn = document.createElement("button");
      removeBtn.type = "button";
      removeBtn.textContent = "Remove";
      addClass(removeBtn, "dangerButton");
      removeBtn.onclick = () => {
        status.textContent = "";
        this.options.onDeleteRequested(workspace.id);
      };

      actions.appendChild(editBtn);
      actions.appendChild(validateBtn);
      actions.appendChild(removeBtn);
      row.appendChild(actions);
      row.appendChild(status);
      list.appendChild(row);
    }

    section.appendChild(list);
    this.container.appendChild(section);
  }

  private createEndpointSelect(currentValue?: string): HTMLSelectElement {
    const select = document.createElement("select");
    select.setAttribute("aria-label", "SPARQL endpoint");
    addClass(select, "settingsSelect");

    const configs = this.options.persistentConfig.getEndpointConfigs();
    const endpoints = configs
      .map((c) => ({ endpoint: c.endpoint, label: c.label?.trim() }))
      .filter((c) => !!c.endpoint && c.endpoint.trim().length > 0);

    endpoints.sort((a, b) => {
      const aKey = (a.label || a.endpoint).toLowerCase();
      const bKey = (b.label || b.endpoint).toLowerCase();
      return aKey.localeCompare(bKey);
    });

    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = endpoints.length ? "Select SPARQL endpoint" : "No SPARQL endpoints configured";
    select.appendChild(placeholder);

    const trimmedCurrent = currentValue?.trim();
    if (trimmedCurrent && !endpoints.some((e) => e.endpoint === trimmedCurrent)) {
      const opt = document.createElement("option");
      opt.value = trimmedCurrent;
      opt.textContent = `${trimmedCurrent} (not in list)`;
      select.appendChild(opt);
    }

    for (const e of endpoints) {
      const opt = document.createElement("option");
      opt.value = e.endpoint;
      opt.textContent = e.label ? `${e.label} (${e.endpoint})` : e.endpoint;
      select.appendChild(opt);
    }

    select.value = trimmedCurrent || "";
    return select;
  }

  private renderAddWorkspaceButton() {
    const section = document.createElement("div");
    addClass(section, "settingsSection");

    const label = document.createElement("label");
    label.textContent = "Add workspace";
    addClass(label, "settingsLabel");

    const help = document.createElement("div");
    help.textContent = "Add a new workspace configuration.";
    addClass(help, "settingsHelp");

    const addBtn = document.createElement("button");
    addBtn.type = "button";
    addBtn.textContent = "+ Add new workspace";
    addClass(addBtn, "primaryButton");
    addBtn.onclick = () => this.openWorkspaceConfigModal({ mode: "add" });

    section.appendChild(label);
    section.appendChild(help);
    section.appendChild(addBtn);
    this.container.appendChild(section);
  }

  private openWorkspaceConfigModal(input: { mode: "add" } | { mode: "edit"; workspace: WorkspaceConfig }) {
    // Track mousedown for proper modal close behavior
    let mouseDownOnOverlay = false;

    const overlay = document.createElement("div");
    addClass(overlay, "tabSettingsModalOverlay", "workspaceConfigModalOverlay", "open");

    const modal = document.createElement("div");
    addClass(modal, "workspaceConfigModal");
    modal.onclick = (e) => e.stopPropagation();

    const close = () => {
      mouseDownOnOverlay = false;
      overlay.remove();
      document.removeEventListener("keydown", onKeyDown);
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      close();
    };
    document.addEventListener("keydown", onKeyDown);

    // Track mousedown on overlay to distinguish from text selection that moves outside
    overlay.addEventListener("mousedown", (e) => {
      if (e.target === overlay) {
        mouseDownOnOverlay = true;
      }
    });

    // Only close if mousedown also happened on overlay (not during text selection)
    overlay.addEventListener("mouseup", (e) => {
      if (e.target === overlay && mouseDownOnOverlay) {
        close();
      }
      mouseDownOnOverlay = false;
    });

    const header = document.createElement("div");
    addClass(header, "modalHeader");

    const title = document.createElement("h2");
    title.textContent = input.mode === "add" ? "Add workspace" : "Edit workspace";
    header.appendChild(title);

    const closeBtn = document.createElement("button");
    closeBtn.textContent = "×";
    addClass(closeBtn, "closeButton");
    closeBtn.onclick = () => close();
    header.appendChild(closeBtn);

    const body = document.createElement("div");
    addClass(body, "workspaceConfigModalBody");

    const status = document.createElement("div");
    addClass(status, "settingsHelp");
    status.style.fontStyle = "normal";

    const mode = input.mode;
    const existing = mode === "edit" ? input.workspace : undefined;

    const typeSelect = document.createElement("select");
    typeSelect.setAttribute("aria-label", "Workspace type");
    addClass(typeSelect, "settingsSelect");
    const optSparql = document.createElement("option");
    optSparql.value = "sparql";
    optSparql.textContent = "SPARQL";
    const optGit = document.createElement("option");
    optGit.value = "git";
    optGit.textContent = "Git";
    typeSelect.appendChild(optSparql);
    typeSelect.appendChild(optGit);

    if (existing) {
      typeSelect.value = existing.type;
      typeSelect.disabled = true;
    }

    const labelInput = document.createElement("input");
    labelInput.type = "text";
    labelInput.placeholder = "Workspace label";
    labelInput.value = existing?.label || "";
    addClass(labelInput, "settingsInput");

    const descriptionInput = document.createElement("input");
    descriptionInput.type = "text";
    descriptionInput.placeholder = "Optional description";
    descriptionInput.value = existing?.description || "";
    addClass(descriptionInput, "settingsInput");

    const dynamic = document.createElement("div");

    const renderDynamic = () => {
      dynamic.innerHTML = "";
      status.textContent = "";

      const typeValue = existing?.type ?? (typeSelect.value as WorkspaceConfig["type"]);

      if (typeValue === "git") {
        const gitHelp = document.createElement("div");
        addClass(gitHelp, "settingsHelp");
        gitHelp.textContent =
          "Supported Git providers: GitHub, GitLab, Bitbucket Cloud, Gitea. Note: ssh:// and SCP-style remotes are only parsed to identify the repository; Matgui uses provider HTTPS APIs (not SSH) to read/write files.";

        const remoteUrlInput = document.createElement("input");
        remoteUrlInput.type = "url";
        remoteUrlInput.placeholder = "Git remote URL (https://..., ssh://..., or git@host:org/repo.git)";
        remoteUrlInput.value = existing && existing.type === "git" ? existing.remoteUrl : "";
        addClass(remoteUrlInput, "settingsInput");

        const branchInput = document.createElement("input");
        branchInput.type = "text";
        branchInput.placeholder = "Branch (optional; e.g., main)";
        branchInput.value = existing && existing.type === "git" ? existing.branch : "";
        addClass(branchInput, "settingsInput");

        const rootPathInput = document.createElement("input");
        rootPathInput.type = "text";
        rootPathInput.placeholder = "Root path in repo (optional)";
        rootPathInput.value = existing && existing.type === "git" ? existing.rootPath : "";
        addClass(rootPathInput, "settingsInput");

        const usernameInput = document.createElement("input");
        usernameInput.type = "text";
        usernameInput.placeholder = "Username (optional)";
        usernameInput.value = existing && existing.type === "git" ? existing.auth.username || "" : "";
        addClass(usernameInput, "settingsInput");

        const providerSelect = document.createElement("select");
        providerSelect.setAttribute("aria-label", "Git provider");
        addClass(providerSelect, "settingsSelect");
        const providerOptions: Array<{ value: "auto" | "github" | "gitlab" | "bitbucket" | "gitea"; label: string }> = [
          { value: "auto", label: "Auto-detect" },
          { value: "github", label: "GitHub" },
          { value: "gitlab", label: "GitLab" },
          { value: "bitbucket", label: "Bitbucket Cloud" },
          { value: "gitea", label: "Gitea" },
        ];
        for (const opt of providerOptions) {
          const option = document.createElement("option");
          option.value = opt.value;
          option.textContent = opt.label;
          providerSelect.appendChild(option);
        }
        providerSelect.value = (existing && existing.type === "git" && existing.provider) || "auto";

        const apiBaseUrlInput = document.createElement("input");
        apiBaseUrlInput.type = "url";
        apiBaseUrlInput.placeholder = "API base URL (optional; for self-hosted/enterprise)";
        apiBaseUrlInput.value = existing && existing.type === "git" ? existing.apiBaseUrl || "" : "";
        addClass(apiBaseUrlInput, "settingsInput");

        const tokenInput = document.createElement("input");
        tokenInput.type = "password";
        tokenInput.value = "";
        tokenInput.placeholder =
          existing && existing.type === "git" && existing.auth.token
            ? "Token configured (enter to replace)"
            : "Personal access token";
        tokenInput.autocomplete = "new-password";
        addClass(tokenInput, "settingsInput");

        const advancedToggle = document.createElement("button");
        advancedToggle.type = "button";
        addClass(advancedToggle, "secondaryButton");

        const advancedContainer = document.createElement("div");
        let isAdvancedOpen = false;
        const syncAdvanced = () => {
          advancedToggle.textContent = isAdvancedOpen ? "Hide advanced" : "Show advanced";
          advancedContainer.style.display = isAdvancedOpen ? "" : "none";
        };
        advancedToggle.onclick = () => {
          isAdvancedOpen = !isAdvancedOpen;
          syncAdvanced();
        };
        syncAdvanced();

        advancedContainer.appendChild(this.wrapField("Provider", providerSelect));
        advancedContainer.appendChild(this.wrapField("API base URL", apiBaseUrlInput));
        advancedContainer.appendChild(this.wrapField("Branch", branchInput));
        advancedContainer.appendChild(this.wrapField("Root path", rootPathInput));
        advancedContainer.appendChild(this.wrapField("Username", usernameInput));

        dynamic.appendChild(gitHelp);
        dynamic.appendChild(this.wrapField("Remote URL", remoteUrlInput));
        dynamic.appendChild(this.wrapField("Token", tokenInput));
        dynamic.appendChild(this.wrapField("Advanced", advancedToggle));
        dynamic.appendChild(advancedContainer);

        (dynamic as any).__getConfig = (): WorkspaceConfig => {
          const token = tokenInput.value.trim();
          const previousToken = existing && existing.type === "git" ? existing.auth.token : undefined;
          const provider = providerSelect.value as "auto" | "github" | "gitlab" | "bitbucket" | "gitea";
          return {
            id: existing?.id || newWorkspaceId(),
            type: "git",
            label: labelInput.value.trim(),
            description: descriptionInput.value.trim() || undefined,
            remoteUrl: remoteUrlInput.value.trim(),
            branch: branchInput.value.trim(),
            rootPath: rootPathInput.value.trim(),
            auth: {
              type: "pat",
              username: usernameInput.value.trim() || undefined,
              token: isNonEmpty(token) ? token : previousToken || "",
            },
            provider: provider === "auto" ? undefined : provider,
            apiBaseUrl: apiBaseUrlInput.value.trim() || undefined,
          };
        };
        return;
      }

      const endpointSelect = this.createEndpointSelect(
        existing && existing.type === "sparql" ? existing.endpoint : undefined,
      );

      const sparqlHelp = document.createElement("div");
      addClass(sparqlHelp, "settingsHelp");
      sparqlHelp.textContent =
        "Tip: you can reuse an existing Workspace IRI to point to an already-populated workspace, or choose a new IRI to start a fresh workspace.";

      // Workspace IRI selection (dropdown + custom input)
      const workspaceIriSelect = document.createElement("select");
      workspaceIriSelect.setAttribute("aria-label", "Workspace IRI");
      addClass(workspaceIriSelect, "settingsSelect");

      const loadingOption = document.createElement("option");
      loadingOption.value = "";
      loadingOption.textContent = "Select endpoint first";
      workspaceIriSelect.appendChild(loadingOption);

      const workspaceIriCustomInput = document.createElement("input");
      workspaceIriCustomInput.type = "url";
      workspaceIriCustomInput.placeholder =
        "Enter new workspace IRI (e.g., https://example.org/workspace/my-workspace)";
      workspaceIriCustomInput.style.display = "none";
      workspaceIriCustomInput.style.marginTop = "5px";
      addClass(workspaceIriCustomInput, "settingsInput");

      if (existing && existing.type === "sparql") {
        workspaceIriCustomInput.value = existing.workspaceIri;
      }

      // Function to populate workspace options
      const populateWorkspaceOptions = async (endpoint: string) => {
        // Clear existing options
        workspaceIriSelect.innerHTML = "";

        // Add loading option
        const loading = document.createElement("option");
        loading.value = "";
        loading.textContent = "Loading workspaces...";
        workspaceIriSelect.appendChild(loading);
        workspaceIriSelect.disabled = true;

        try {
          const workspaces = await this.fetchExistingWorkspaces(endpoint);

          workspaceIriSelect.innerHTML = "";
          workspaceIriSelect.disabled = false;

          if (workspaces.length > 0) {
            const selectPlaceholder = document.createElement("option");
            selectPlaceholder.value = "";
            selectPlaceholder.textContent = "Select existing workspace";
            workspaceIriSelect.appendChild(selectPlaceholder);

            for (const workspace of workspaces) {
              const option = document.createElement("option");
              option.value = workspace;
              option.textContent = workspace;
              workspaceIriSelect.appendChild(option);
            }
          } else {
            const noWorkspaces = document.createElement("option");
            noWorkspaces.value = "";
            noWorkspaces.textContent = "No existing workspaces found";
            workspaceIriSelect.appendChild(noWorkspaces);
          }

          // Add custom option
          const customOption = document.createElement("option");
          customOption.value = "__custom__";
          customOption.textContent = "➕ Enter new workspace IRI";
          workspaceIriSelect.appendChild(customOption);

          // Set current value if editing existing
          if (existing && existing.type === "sparql") {
            const existingIri = existing.workspaceIri;
            const matchingOption = workspaces.find((w) => w === existingIri);
            if (matchingOption) {
              workspaceIriSelect.value = existingIri;
            } else {
              workspaceIriSelect.value = "__custom__";
              workspaceIriCustomInput.style.display = "";
              workspaceIriCustomInput.value = existingIri;
            }
          }
        } catch (error) {
          workspaceIriSelect.innerHTML = "";
          workspaceIriSelect.disabled = false;

          const errorOption = document.createElement("option");
          errorOption.value = "";
          errorOption.textContent = "Failed to load workspaces";
          workspaceIriSelect.appendChild(errorOption);

          const customOption = document.createElement("option");
          customOption.value = "__custom__";
          customOption.textContent = "➕ Enter new workspace IRI";
          workspaceIriSelect.appendChild(customOption);
        }
      };

      // Handle workspace selection change
      workspaceIriSelect.onchange = () => {
        if (workspaceIriSelect.value === "__custom__") {
          workspaceIriCustomInput.style.display = "";
          workspaceIriCustomInput.focus();
        } else {
          workspaceIriCustomInput.style.display = "none";
        }
      };

      // Handle endpoint change
      endpointSelect.onchange = () => {
        const selectedEndpoint = endpointSelect.value.trim();
        if (selectedEndpoint) {
          void populateWorkspaceOptions(selectedEndpoint);
        } else {
          workspaceIriSelect.innerHTML = "";
          const placeholder = document.createElement("option");
          placeholder.value = "";
          placeholder.textContent = "Select endpoint first";
          workspaceIriSelect.appendChild(placeholder);
        }
      };

      // Initial load if endpoint is already selected
      const initialEndpoint = endpointSelect.value.trim();
      if (initialEndpoint) {
        void populateWorkspaceOptions(initialEndpoint);
      }

      // Wrapper for workspace IRI selection
      const workspaceIriWrapper = document.createElement("div");
      workspaceIriWrapper.appendChild(workspaceIriSelect);
      workspaceIriWrapper.appendChild(workspaceIriCustomInput);

      const defaultGraphInput = document.createElement("input");
      defaultGraphInput.type = "url";
      defaultGraphInput.placeholder = "Default graph (optional)";
      defaultGraphInput.value = existing && existing.type === "sparql" ? existing.defaultGraph || "" : "";
      addClass(defaultGraphInput, "settingsInput");

      dynamic.appendChild(this.wrapField("SPARQL endpoint", endpointSelect));
      dynamic.appendChild(sparqlHelp);
      dynamic.appendChild(this.wrapField("Workspace IRI", workspaceIriWrapper));
      dynamic.appendChild(this.wrapField("Default graph", defaultGraphInput));

      (dynamic as any).__getConfig = (): WorkspaceConfig => {
        let workspaceIri = "";
        if (workspaceIriSelect.value === "__custom__") {
          workspaceIri = workspaceIriCustomInput.value.trim();
        } else {
          workspaceIri = workspaceIriSelect.value.trim();
        }

        return {
          id: existing?.id || newWorkspaceId(),
          type: "sparql",
          label: labelInput.value.trim(),
          description: descriptionInput.value.trim() || undefined,
          endpoint: endpointSelect.value.trim(),
          workspaceIri,
          defaultGraph: defaultGraphInput.value.trim() || undefined,
        };
      };
    };

    typeSelect.onchange = () => renderDynamic();
    renderDynamic();

    const footer = document.createElement("div");
    addClass(footer, "workspaceConfigModalFooter");

    const cancelBtn = document.createElement("button");
    cancelBtn.type = "button";
    cancelBtn.textContent = "Cancel";
    addClass(cancelBtn, "secondaryButton");
    cancelBtn.onclick = () => close();

    const saveBtn = document.createElement("button");
    saveBtn.type = "button";
    saveBtn.textContent = "Save";
    addClass(saveBtn, "primaryButton");
    saveBtn.onclick = () => {
      status.textContent = "";
      const getConfig = (dynamic as any).__getConfig as undefined | (() => WorkspaceConfig);
      if (!getConfig) return;
      const config = getConfig();

      if (config.type === "git" && !isNonEmpty(config.auth.token)) {
        status.textContent = "Git token is required.";
        return;
      }

      const result = validateWorkspaceConfig(config);
      if (!result.valid) {
        status.textContent = result.errors.join("\n");
        return;
      }

      this.options.persistentConfig.addOrUpdateWorkspace(config);
      if (!this.options.persistentConfig.getActiveWorkspaceId()) {
        this.options.persistentConfig.setActiveWorkspaceId(config.id);
      }
      close();
      this.render();
    };

    footer.appendChild(cancelBtn);
    footer.appendChild(saveBtn);

    body.appendChild(this.wrapField("Type", typeSelect));
    body.appendChild(this.wrapField("Label", labelInput));
    body.appendChild(this.wrapField("Description", descriptionInput));
    body.appendChild(dynamic);
    body.appendChild(status);

    modal.appendChild(header);
    modal.appendChild(body);
    modal.appendChild(footer);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    // Focus first input for faster entry.
    labelInput.focus();
  }

  private wrapField(labelText: string, inputEl: HTMLElement): HTMLElement {
    const wrapper = document.createElement("div");
    addClass(wrapper, "settingsField");

    const label = document.createElement("div");
    addClass(label, "settingsFieldLabel");
    label.textContent = labelText;

    wrapper.appendChild(label);
    wrapper.appendChild(inputEl);

    return wrapper;
  }
}
