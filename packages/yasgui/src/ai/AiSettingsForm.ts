/**
 * "AI" section of the settings: which AI service answers, and the user's own base URL, API key and model.
 */
import { addClass } from "@matdata/yasgui-utils";
import type AiAssistant from "./AiAssistant";
import { hostOf, isLocalUrl } from "./aiSettings";
import { listModels } from "./openaiClient";
import type { AiServiceChoice } from "./types";

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

export default class AiSettingsForm {
  private serviceInputs: HTMLInputElement[] = [];
  private baseUrlInput!: HTMLInputElement;
  private apiKeyInput!: HTMLInputElement;
  private modelInput!: HTMLInputElement;
  private modelList!: HTMLDataListElement;
  private checkQueriesInput?: HTMLInputElement;
  private ownFields!: HTMLDivElement;
  private testResult!: HTMLDivElement;
  private consentEl!: HTMLDivElement;

  constructor(private assistant: AiAssistant) {}

  public draw(container: HTMLElement) {
    const config = this.assistant.config;
    const id = Math.random().toString(36).substring(7);

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

    // Service choice
    const serviceSection = el("div", "settingsSection");
    serviceSection.appendChild(el("label", "settingsLabel", "AI service"));
    const choices: Array<{ value: AiServiceChoice; label: string; help: string }> = [];
    if (config.proxy) {
      choices.push({
        value: "proxy",
        label: `${config.proxy.label || hostOf(config.proxy.url)} (provided by this site)`,
        help: `Requests go to ${hostOf(config.proxy.url)}. You need no key of your own.`,
      });
    }
    if (config.allowOwnKey) {
      choices.push({
        value: "own",
        label: "My own API key",
        help: "Requests go straight from your browser to the service you choose.",
      });
    }
    choices.push({
      value: "off",
      label: "No AI service",
      help: "Nothing is sent. The AI actions copy a prompt to the clipboard.",
    });
    const group = el("div", "yasgui-aiSettings__choices");
    group.setAttribute("role", "radiogroup");
    group.setAttribute("aria-label", "AI service");
    for (const choice of choices) {
      const label = el("label", "yasgui-aiSettings__choice");
      const input = el("input");
      input.type = "radio";
      input.name = `aiService-${id}`;
      input.value = choice.value;
      input.addEventListener("change", () => this.updateVisibility());
      this.serviceInputs.push(input);
      const text = el("span");
      text.appendChild(el("strong", undefined, choice.label));
      text.appendChild(el("span", "yasgui-aiSettings__choiceHelp", choice.help));
      label.append(input, text);
      group.appendChild(label);
    }
    serviceSection.appendChild(group);
    container.appendChild(serviceSection);

    // Own key
    this.ownFields = el("div", "settingsSection yasgui-aiSettings__own");
    this.ownFields.appendChild(el("label", "settingsLabel", "Your AI service"));
    this.ownFields.appendChild(
      el(
        "div",
        "settingsHelp",
        "Any service with an OpenAI-compatible API works: OpenAI, Azure OpenAI, Mistral, OpenRouter, Groq, or a model on your own computer with Ollama (http://localhost:11434/v1) or LM Studio (http://localhost:1234/v1).",
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
    field("Base URL", this.baseUrlInput, "Requests go to <base URL>/chat/completions.");

    this.apiKeyInput = el("input", "yasgui-aiSettings__input");
    this.apiKeyInput.type = "password";
    this.apiKeyInput.autocomplete = "off";
    this.apiKeyInput.spellcheck = false;
    this.apiKeyInput.placeholder = "sk-…";
    const keyField = field(
      "API key",
      this.apiKeyInput,
      "Stored in this browser only. It is sent only to the base URL above, and never included in exported settings or share links. Anyone using this browser profile can read it; use a key with a spending limit.",
    );
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
      this.assistant.settings.update({ apiKey: undefined });
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

    const testRow = el("div", "yasgui-aiSettings__row");
    const test = el("button", "secondaryButton", "Test connection");
    test.type = "button";
    test.addEventListener("click", () => void this.testConnection());
    this.testResult = el("div", "settingsHelp yasgui-aiSettings__testResult");
    this.testResult.setAttribute("aria-live", "polite");
    testRow.append(test, this.testResult);
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

  private selectedService(): AiServiceChoice {
    const checked = this.serviceInputs.find((input) => input.checked);
    return (checked?.value as AiServiceChoice) || "off";
  }

  private updateVisibility() {
    this.ownFields.hidden = this.selectedService() !== "own";
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
    const config = this.assistant.config;
    const current = this.assistant.getConnection();
    const service: AiServiceChoice =
      settings.service ||
      (current?.kind === "own" ? "own" : config.proxy ? "proxy" : config.allowOwnKey ? "own" : "off");
    for (const input of this.serviceInputs) input.checked = input.value === service;
    if (!this.serviceInputs.some((input) => input.checked)) {
      const off = this.serviceInputs.find((input) => input.value === "off");
      if (off) off.checked = true;
    }
    this.baseUrlInput.value = settings.baseUrl || "";
    this.apiKeyInput.value = settings.apiKey || "";
    this.modelInput.value = settings.model || "";
    if (this.checkQueriesInput) this.checkQueriesInput.checked = settings.checkQueries !== false;
    this.testResult.textContent = "";
    this.updateVisibility();
    this.renderConsents();
  }

  public save() {
    if (!this.baseUrlInput) return;
    this.assistant.settings.update({
      service: this.selectedService(),
      baseUrl: this.baseUrlInput.value.trim() || undefined,
      apiKey: this.apiKeyInput.value.trim() || undefined,
      model: this.modelInput.value.trim() || undefined,
      checkQueries: this.checkQueriesInput ? this.checkQueriesInput.checked : undefined,
    });
  }

  private async testConnection() {
    const baseUrl = this.baseUrlInput.value.trim() || this.assistant.config.defaultBaseUrl;
    const apiKey = this.apiKeyInput.value.trim();
    if (!apiKey && !isLocalUrl(baseUrl)) {
      this.testResult.textContent = "Enter an API key first.";
      return;
    }
    this.testResult.textContent = `Connecting to ${hostOf(baseUrl)}…`;
    try {
      const models = await listModels({
        kind: "own",
        baseUrl,
        apiKey: apiKey || undefined,
        host: hostOf(baseUrl),
        label: hostOf(baseUrl),
      });
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
