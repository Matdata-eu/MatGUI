/**
 * "AI" section of the settings: the user's own AI services (base URL, API key, model), the services of the site,
 * and which one is the default.
 */
import { addClass } from "@matdata/yasgui-utils";
import type AiAssistant from "./AiAssistant";
import { hostOf, isLocalUrl, newServiceId, normalizeBaseUrl, ownConnection, siteServices } from "./aiSettings";
import { listModels } from "./openaiClient";
import { aiProviders, providerOf } from "./providers";
import { AI_SERVICE_OFF } from "./types";
import type { AiServiceSettings } from "./types";

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

export default class AiSettingsForm {
  private servicesEl!: HTMLDivElement;
  private editorTitle!: HTMLLabelElement;
  private nameInput!: HTMLInputElement;
  private baseUrlInput!: HTMLInputElement;
  private apiKeyInput!: HTMLInputElement;
  private modelInput!: HTMLInputElement;
  private modelList!: HTMLDataListElement;
  private checkQueriesInput?: HTMLInputElement;
  private ownFields!: HTMLDivElement;
  private testResult!: HTMLDivElement;
  private consentEl!: HTMLDivElement;
  /** The user's own services as edited in the form; stored on save */
  private services: AiServiceSettings[] = [];
  private defaultId: string = AI_SERVICE_OFF;
  private editingId: string | undefined;
  private formId = Math.random().toString(36).substring(7);

  constructor(private assistant: AiAssistant) {}

  public draw(container: HTMLElement) {
    const config = this.assistant.config;
    const id = this.formId;

    const intro = el("div", "settingsSection");
    intro.appendChild(el("label", "settingsLabel", "AI assistant"));
    intro.appendChild(
      el(
        "div",
        "settingsHelp",
        "The AI assistant writes queries from questions in your own words, explains and fixes queries, and explains results. It is in the AI tab of the side panel. Without an AI service, its actions copy a ready-made prompt that you paste in an AI chat of your choice.",
      ),
    );
    container.appendChild(intro);

    // Services
    const servicesSection = el("div", "settingsSection");
    servicesSection.appendChild(el("label", "settingsLabel", "AI services"));
    servicesSection.appendChild(
      el(
        "div",
        "settingsHelp",
        config.allowOwnKey
          ? "Add the AI services you want to use and pick the default one. You can switch between them in the AI view."
          : "Pick the default AI service. You can switch between them in the AI view.",
      ),
    );
    this.servicesEl = el("div", "yasgui-aiSettings__choices");
    this.servicesEl.setAttribute("role", "radiogroup");
    this.servicesEl.setAttribute("aria-label", "Default AI service");
    servicesSection.appendChild(this.servicesEl);
    if (config.allowOwnKey) {
      const add = el("button", "secondaryButton yasgui-aiSettings__add", "Add service");
      add.type = "button";
      add.addEventListener("click", () => this.addService());
      servicesSection.appendChild(add);
    }
    container.appendChild(servicesSection);

    // Editor of one of the user's own services
    this.ownFields = el("div", "settingsSection yasgui-aiSettings__own");
    this.editorTitle = el("label", "settingsLabel", "Service");
    this.ownFields.appendChild(this.editorTitle);
    this.ownFields.appendChild(
      el(
        "div",
        "settingsHelp",
        "Any service with an OpenAI-compatible API works, or a proxy that offers one. Pick a provider from the Base URL list or enter another URL.",
      ),
    );
    const field = (labelText: string, input: HTMLInputElement, help?: string) => {
      const wrapper = el("div", "yasgui-aiSettings__field");
      const label = el("label", undefined, labelText);
      input.id = `ai-${labelText.replace(/\W+/g, "")}-${id}`;
      label.htmlFor = input.id;
      wrapper.append(label, input);
      if (help) wrapper.appendChild(el("div", "settingsHelp", help));
      this.ownFields.appendChild(wrapper);
      return wrapper;
    };

    this.baseUrlInput = el("input", "yasgui-aiSettings__input");
    this.baseUrlInput.type = "url";
    this.baseUrlInput.placeholder = config.defaultBaseUrl;
    this.baseUrlInput.spellcheck = false;
    const providerList = el("datalist");
    providerList.id = `ai-providers-${id}`;
    for (const provider of aiProviders) {
      const option = el("option");
      option.value = provider.baseUrl;
      option.label = provider.note ? `${provider.name} (${provider.note})` : provider.name;
      providerList.appendChild(option);
    }
    this.baseUrlInput.setAttribute("list", providerList.id);
    const baseUrlField = field(
      "Base URL",
      this.baseUrlInput,
      "Requests go to <base URL>/chat/completions. Clear the field to see all providers in the list.",
    );
    baseUrlField.appendChild(providerList);
    this.baseUrlInput.addEventListener("input", () => this.editorChanged());

    this.nameInput = el("input", "yasgui-aiSettings__input");
    this.nameInput.type = "text";
    field("Name", this.nameInput, "Shown in the AI view. The provider or host when empty.");
    this.nameInput.addEventListener("input", () => this.editorChanged());

    this.apiKeyInput = el("input", "yasgui-aiSettings__input");
    this.apiKeyInput.type = "password";
    this.apiKeyInput.autocomplete = "off";
    this.apiKeyInput.spellcheck = false;
    this.apiKeyInput.placeholder = "sk-…";
    const keyField = field(
      "API key",
      this.apiKeyInput,
      "Stored in this browser only. It is sent only to the base URL above, and never included in exported settings or share links. Anyone using this browser profile can read it; use a key with a spending limit. Leave it empty for local models and proxies that need no key.",
    );
    this.apiKeyInput.addEventListener("input", () => this.editorChanged());
    const keyActions = el("div", "yasgui-aiSettings__row");
    const show = el("button", "secondaryButton", "Show");
    show.type = "button";
    show.addEventListener("click", () => {
      const hidden = this.apiKeyInput.type === "password";
      this.apiKeyInput.type = hidden ? "text" : "password";
      show.textContent = hidden ? "Hide" : "Show";
    });
    const forget = el("button", "secondaryButton", "Forget key");
    forget.type = "button";
    forget.addEventListener("click", () => {
      this.apiKeyInput.value = "";
      this.editorChanged();
      this.forgetStoredKey();
      this.testResult.textContent = "The API key was removed from this browser.";
    });
    keyActions.append(show, forget);
    keyField.insertBefore(keyActions, keyField.lastChild);

    this.modelInput = el("input", "yasgui-aiSettings__input");
    this.modelInput.type = "text";
    this.modelInput.spellcheck = false;
    this.modelInput.placeholder = config.defaultModel || "e.g. a model id from the list";
    this.modelList = el("datalist");
    this.modelList.id = `ai-models-${id}`;
    this.modelInput.setAttribute("list", this.modelList.id);
    const modelField = field("Model", this.modelInput, "Use “Test connection” to list the models of the service.");
    modelField.appendChild(this.modelList);
    this.modelInput.addEventListener("input", () => this.editorChanged());

    const testRow = el("div", "yasgui-aiSettings__row");
    const test = el("button", "secondaryButton", "Test connection");
    test.type = "button";
    test.addEventListener("click", () => void this.testConnection());
    const done = el("button", "secondaryButton", "Done");
    done.type = "button";
    done.addEventListener("click", () => this.edit(undefined));
    this.testResult = el("div", "settingsHelp yasgui-aiSettings__testResult");
    this.testResult.setAttribute("aria-live", "polite");
    testRow.append(test, done, this.testResult);
    this.ownFields.appendChild(testRow);
    container.appendChild(this.ownFields);

    // Check queries
    if (config.allowCheckQueries) {
      const section = el("div", "settingsSection");
      const row = el("div", "checkboxContainer");
      this.checkQueriesInput = el("input");
      this.checkQueriesInput.type = "checkbox";
      this.checkQueriesInput.id = `aiCheckQueries-${id}`;
      const label = el("label", undefined, "Let the assistant run check queries on the endpoint");
      label.htmlFor = this.checkQueriesInput.id;
      row.append(this.checkQueriesInput, label);
      section.appendChild(row);
      section.appendChild(
        el(
          "div",
          "settingsHelp",
          `Before answering, the assistant may run up to ${config.maxCheckQueries} small read-only queries (at most 20 rows each) to check that classes, properties and values exist. Their results are sent to the AI service, and each one is shown in the answer. Better answers, slightly more data shared.`,
        ),
      );
      container.appendChild(section);
    }

    // Consents
    this.consentEl = el("div", "settingsSection");
    container.appendChild(this.consentEl);

    this.load();
  }

  private editing(): AiServiceSettings | undefined {
    return this.services.find((service) => service.id === this.editingId);
  }

  /** Name shown for one of the user's own services */
  private serviceName(service: AiServiceSettings): string {
    const baseUrl = service.baseUrl || this.assistant.config.defaultBaseUrl;
    return service.name?.trim() || providerOf(baseUrl)?.name || hostOf(baseUrl) || "New service";
  }

  private renderServices() {
    const config = this.assistant.config;
    this.servicesEl.innerHTML = "";
    const row = (value: string, title: string, help: string, actions: HTMLButtonElement[] = []) => {
      const label = el("label", "yasgui-aiSettings__choice");
      const input = el("input");
      input.type = "radio";
      input.name = `aiDefault-${this.formId}`;
      input.value = value;
      input.checked = value === this.defaultId;
      input.addEventListener("change", () => (this.defaultId = value));
      const text = el("span", "yasgui-aiSettings__choiceText");
      text.appendChild(el("strong", undefined, title));
      text.appendChild(el("span", "yasgui-aiSettings__choiceHelp", help));
      label.append(input, text);
      if (actions.length) {
        const buttons = el("span", "yasgui-aiSettings__choiceActions");
        buttons.append(...actions);
        label.appendChild(buttons);
      }
      this.servicesEl.appendChild(label);
    };
    siteServices(config).forEach((proxy, index) => {
      row(
        `site:${index}`,
        `${proxy.label || hostOf(proxy.url)} (provided by this site)`,
        `Requests go to ${hostOf(proxy.url)}. You need no key of your own.`,
      );
    });
    if (config.allowOwnKey) {
      for (const service of this.services) {
        const edit = el("button", "secondaryButton", service.id === this.editingId ? "Editing" : "Edit");
        edit.type = "button";
        edit.disabled = service.id === this.editingId;
        edit.addEventListener("click", (event) => {
          event.preventDefault();
          this.edit(service.id);
        });
        const remove = el("button", "secondaryButton", "Remove");
        remove.type = "button";
        remove.setAttribute("aria-label", `Remove ${this.serviceName(service)}`);
        remove.addEventListener("click", (event) => {
          event.preventDefault();
          this.removeService(service.id);
        });
        const baseUrl = normalizeBaseUrl(service.baseUrl || config.defaultBaseUrl);
        const details = [
          hostOf(baseUrl),
          service.model || config.defaultModel,
          service.apiKey ? "own API key" : isLocalUrl(baseUrl) ? "on your computer" : "no API key",
        ].filter(Boolean);
        row(service.id, this.serviceName(service), details.join(" · "), [edit, remove]);
      }
    }
    row(AI_SERVICE_OFF, "No AI service", "Nothing is sent. The AI actions copy a prompt to the clipboard.");
  }

  private addService() {
    const service: AiServiceSettings = { id: newServiceId() };
    this.services.push(service);
    if (this.defaultId === AI_SERVICE_OFF && !siteServices(this.assistant.config).length) this.defaultId = service.id;
    this.edit(service.id);
    this.baseUrlInput.focus();
  }

  private removeService(serviceId: string) {
    this.services = this.services.filter((service) => service.id !== serviceId);
    if (this.defaultId === serviceId) {
      const sites = siteServices(this.assistant.config);
      this.defaultId = sites.length ? "site:0" : this.services[0]?.id || AI_SERVICE_OFF;
    }
    if (this.editingId === serviceId) this.edit(undefined);
    else this.renderServices();
  }

  /** Show the editor for one of the user's own services, or hide it */
  private edit(serviceId: string | undefined) {
    this.editingId = serviceId;
    const service = this.editing();
    this.ownFields.hidden = !service;
    if (service) {
      this.editorTitle.textContent = `Service: ${this.serviceName(service)}`;
      this.baseUrlInput.value = service.baseUrl || "";
      this.nameInput.value = service.name || "";
      this.nameInput.placeholder = this.serviceName({ ...service, name: undefined });
      this.apiKeyInput.value = service.apiKey || "";
      this.apiKeyInput.type = "password";
      this.modelInput.value = service.model || "";
      this.modelList.innerHTML = "";
      this.testResult.textContent = "";
      this.testResult.classList.remove("ok");
    }
    this.renderServices();
  }

  private editorChanged() {
    const service = this.editing();
    if (!service) return;
    service.baseUrl = this.baseUrlInput.value.trim() || undefined;
    service.name = this.nameInput.value.trim() || undefined;
    service.apiKey = this.apiKeyInput.value.trim() || undefined;
    service.model = this.modelInput.value.trim() || undefined;
    this.nameInput.placeholder = this.serviceName({ ...service, name: undefined });
    this.editorTitle.textContent = `Service: ${this.serviceName(service)}`;
    this.renderServices();
  }

  /** "Forget key" removes the key from storage right away, not only when the settings are saved */
  private forgetStoredKey() {
    const stored = this.assistant.settings.get().services || [];
    if (stored.some((service) => service.id === this.editingId && service.apiKey)) {
      this.assistant.settings.update({
        services: stored.map((service) =>
          service.id === this.editingId ? { ...service, apiKey: undefined } : service,
        ),
      });
    }
  }

  private renderConsents() {
    const hosts = this.assistant.settings.get().consentedHosts || [];
    this.consentEl.innerHTML = "";
    this.consentEl.appendChild(el("label", "settingsLabel", "Privacy notice"));
    if (!hosts.length) {
      this.consentEl.appendChild(
        el(
          "div",
          "settingsHelp",
          "Before sending a request, the assistant shows what it sends and asks you to confirm.",
        ),
      );
      return;
    }
    this.consentEl.appendChild(el("div", "settingsHelp", `You chose not to be asked again for: ${hosts.join(", ")}.`));
    const reset = el("button", "secondaryButton", "Ask me again");
    reset.type = "button";
    reset.addEventListener("click", () => {
      this.assistant.settings.update({ consentedHosts: undefined });
      this.renderConsents();
    });
    this.consentEl.appendChild(reset);
  }

  /** Fill the form from the stored settings */
  public load() {
    if (!this.baseUrlInput) return;
    const settings = this.assistant.settings.get();
    this.services = (settings.services || []).map((service) => ({ ...service }));
    const ids = this.assistant.getConnections().map((connection) => connection.id);
    this.defaultId =
      settings.defaultService === AI_SERVICE_OFF || ids.includes(settings.defaultService || "")
        ? settings.defaultService!
        : ids[0] || AI_SERVICE_OFF;
    if (this.checkQueriesInput) this.checkQueriesInput.checked = settings.checkQueries !== false;
    // Someone with only their own service most likely came to change it
    const own = this.services.length === 1 && !siteServices(this.assistant.config).length;
    this.edit(own ? this.services[0].id : undefined);
    this.renderConsents();
  }

  public save() {
    if (!this.baseUrlInput) return;
    const services = this.services
      .filter((service) => service.baseUrl || service.apiKey || service.model || service.name)
      .map((service) => {
        const cleaned: AiServiceSettings = { id: service.id };
        if (service.name) cleaned.name = service.name;
        if (service.baseUrl) cleaned.baseUrl = normalizeBaseUrl(service.baseUrl);
        if (service.apiKey) cleaned.apiKey = service.apiKey;
        if (service.model) cleaned.model = service.model;
        return cleaned;
      });
    const kept = this.defaultId === AI_SERVICE_OFF || this.defaultId.startsWith("site:");
    this.assistant.settings.update({
      services: services.length ? services : undefined,
      defaultService: kept || services.some((service) => service.id === this.defaultId) ? this.defaultId : undefined,
      checkQueries: this.checkQueriesInput ? this.checkQueriesInput.checked : undefined,
    });
    // The new default applies right away, also in the AI view
    this.assistant.selectService(undefined);
  }

  private async testConnection() {
    const service = this.editing();
    const connection = service && ownConnection(this.assistant.config, service);
    if (!connection) return;
    const baseUrl = connection.baseUrl;
    this.testResult.classList.remove("ok");
    this.testResult.textContent = `Connecting to ${hostOf(baseUrl)}…`;
    try {
      const models = await listModels(connection);
      this.modelList.innerHTML = "";
      for (const model of models) {
        const option = el("option");
        option.value = model;
        this.modelList.appendChild(option);
      }
      this.testResult.textContent = models.length
        ? `Connected. ${models.length} models available; pick one in the Model field.`
        : "Connected. The service doesn't list its models; enter the model id yourself.";
      addClass(this.testResult, "ok");
    } catch (e: any) {
      this.testResult.classList.remove("ok");
      this.testResult.textContent =
        e?.message && e.name === "AiRequestError"
          ? e.message
          : `Could not reach ${hostOf(baseUrl)}. Check the base URL and whether the service allows requests from a browser (CORS).`;
    }
  }
}
