import { showConfirm } from "../dialogs";
/**
 * "AI" page of the settings: the AI services as cards (the site's, the user's own, and "No AI service") with the
 * default one picked, and a form to add or edit one of the user's own services: a provider, its base URL (filled in,
 * still editable), the API key and a model fetched from the service. Changes apply at once; the form has its own
 * Save, because its fields only make sense together.
 */
import type AiAssistant from "./AiAssistant";
import Combobox from "./Combobox";
import type { ComboOption } from "./Combobox";
import { hostOf, isLocalUrl, newServiceId, normalizeBaseUrl, ownConnection, siteServices } from "./aiSettings";
import { AiRequestError, listModels } from "./openaiClient";
import {
  aiProviders,
  CUSTOM_PROVIDER_ID,
  isChatModel,
  providerById,
  providerGroupLabels,
  providerOf,
} from "./providers";
import type { AiProvider } from "./providers";
import { AI_SERVICE_OFF } from "./types";
import type { AiServiceSettings } from "./types";
import { icon } from "../icons";
import { controlId, settingsGroup, settingsRow, settingsSwitch } from "../settingsUi";

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

/** The service being added or edited, before it is saved */
interface Draft extends AiServiceSettings {
  isNew: boolean;
  makeDefault: boolean;
}

/** Models found for a base URL: from the service, or the provider's list when the browser can't read it */
interface FoundModels {
  ids: string[];
  fromService: boolean;
  hidden: number;
}

export default class AiSettingsForm {
  private container!: HTMLElement;
  private draft: Draft | undefined;
  /** Models fetched in this session, by base URL, so reopening a service doesn't fetch them again */
  private found = new Map<string, FoundModels>();

  constructor(
    private assistant: AiAssistant,
    /** Called after a change was stored */
    private onSaved: () => void = () => {},
  ) {}

  public draw(container: HTMLElement) {
    this.container = container;
    this.load();
  }

  /** Show the stored settings (the list of services) */
  public load() {
    if (!this.container) return;
    this.draft = undefined;
    this.render();
  }

  private render() {
    this.container.innerHTML = "";
    if (this.draft) this.renderForm(this.draft);
    else this.renderList();
  }

  private settings() {
    return this.assistant.settings.get();
  }

  /** The default service as the AI view uses it: the stored one when it still exists, else the first one */
  private defaultId(): string {
    const stored = this.settings().defaultService;
    const ids = this.assistant.getConnections().map((connection) => connection.id);
    if (stored === AI_SERVICE_OFF || (stored && ids.includes(stored))) return stored;
    return ids[0] || AI_SERVICE_OFF;
  }

  private providerOfService(service: AiServiceSettings): AiProvider | undefined {
    return (
      providerById(service.providerId) || providerOf(service.baseUrl || this.assistant.config.defaultBaseUrl || "")
    );
  }

  /** Name shown for one of the user's own services */
  private serviceName(service: AiServiceSettings): string {
    const baseUrl = service.baseUrl || this.assistant.config.defaultBaseUrl;
    const provider = this.providerOfService(service);
    return (
      service.name?.trim() ||
      (provider && provider.id !== CUSTOM_PROVIDER_ID ? provider.name : "") ||
      hostOf(baseUrl) ||
      "New service"
    );
  }

  private store(changes: Parameters<AiAssistant["settings"]["update"]>[0]) {
    this.assistant.settings.update(changes);
    // The new default applies right away, also in the AI view
    this.assistant.selectService(undefined);
    this.onSaved();
  }

  // ─── The list of services ────────────────────────────────────────────────────────────────────────────────────────

  private renderList() {
    const config = this.assistant.config;
    const group = el("section", "settingsGroup");
    group.appendChild(el("h3", "settingsGroupTitle", "AI services"));
    group.appendChild(
      el(
        "p",
        "settingsGroupLede",
        "The AI assistant writes queries from your questions, explains and fixes queries, and explains results. Pick the default service; you can switch in the AI view. Without a service, its actions copy a prompt that you paste in an AI chat of your choice.",
      ),
    );
    const cards = el("div", "yasgui-aiSettings__cards");
    cards.setAttribute("role", "radiogroup");
    cards.setAttribute("aria-label", "Default AI service");
    group.appendChild(cards);
    this.container.appendChild(group);

    const defaultId = this.defaultId();
    const name = controlId("aiDefault");
    const card = (
      value: string,
      logo: { text: string; color: string },
      title: string,
      badges: Array<[string, string]>,
      meta: string,
      actions: HTMLElement[] = [],
    ) => {
      const row = el("div", "yasgui-aiSettings__card");
      const label = el("label", "yasgui-aiSettings__cardMain");
      const input = el("input", "yasgui-aiSettings__radio");
      input.type = "radio";
      input.name = name;
      input.value = value;
      input.checked = value === defaultId;
      if (input.checked) row.classList.add("default");
      input.addEventListener("change", () => {
        this.store({ defaultService: value });
        this.render();
      });
      const logoEl = el("span", "yasgui-aiSettings__logo", logo.text);
      logoEl.style.background = logo.color;
      logoEl.setAttribute("aria-hidden", "true");
      const text = el("span", "yasgui-aiSettings__cardText");
      const head = el("span", "yasgui-aiSettings__cardTitle");
      head.appendChild(el("strong", undefined, title));
      if (value === defaultId) head.appendChild(el("span", "yasgui-badge yasgui-badge--default", "Default"));
      for (const [badge, kind] of badges) head.appendChild(el("span", `yasgui-badge yasgui-badge--${kind}`, badge));
      text.append(head, el("span", "yasgui-aiSettings__cardMeta", meta));
      label.append(input, logoEl, text);
      row.appendChild(label);
      if (actions.length) {
        const box = el("span", "yasgui-aiSettings__cardActions");
        box.append(...actions);
        row.appendChild(box);
      }
      cards.appendChild(row);
    };

    siteServices(config).forEach((proxy, index) => {
      const title = proxy.label || hostOf(proxy.url);
      card(
        `site:${index}`,
        { text: title.charAt(0).toUpperCase(), color: "var(--yasgui-accent-color, #0563bb)" },
        title,
        [["From this site", "site"]],
        `No key needed · ${proxy.model ? proxy.model : "model chosen by the service"} · ${hostOf(proxy.url)}`,
      );
    });

    if (config.allowOwnKey) {
      for (const service of this.settings().services || []) {
        const provider = this.providerOfService(service);
        const baseUrl = normalizeBaseUrl(service.baseUrl || config.defaultBaseUrl);
        const serviceName = this.serviceName(service);
        const edit = el("button", "yasgui-aiSettings__linkButton", "Edit");
        edit.type = "button";
        edit.setAttribute("aria-label", `Edit ${serviceName}`);
        edit.addEventListener("click", () => this.edit(service));
        const remove = el("button", "yasgui-aiSettings__linkButton danger", "Remove");
        remove.type = "button";
        remove.setAttribute("aria-label", `Remove ${serviceName}`);
        remove.addEventListener("click", () => void this.removeService(service));
        const meta = [
          service.model || config.defaultModel || "no model chosen",
          hostOf(baseUrl),
          service.apiKey
            ? `key ••••${service.apiKey.slice(-4)}`
            : isLocalUrl(baseUrl)
              ? "on your computer"
              : "no API key",
        ];
        card(
          service.id,
          {
            text: (provider && provider.id !== CUSTOM_PROVIDER_ID ? provider.name : hostOf(baseUrl))
              .charAt(0)
              .toUpperCase(),
            color: provider?.color || "#808893",
          },
          serviceName,
          provider?.region ? [[provider.region, "region"]] : [],
          meta.join(" · "),
          [edit, remove],
        );
      }
    }
    card(
      AI_SERVICE_OFF,
      { text: "∅", color: "#808893" },
      "No AI service",
      [],
      "Nothing is sent. The AI actions copy a prompt to the clipboard.",
    );

    if (config.allowOwnKey) {
      const add = el("button", "yasgui-aiSettings__add");
      add.type = "button";
      add.innerHTML = icon("plus", 14) + "<span>Add AI service</span>";
      add.addEventListener("click", () => this.addService());
      cards.appendChild(add);
    }

    // Behaviour of the assistant
    const behaviour = settingsGroup(this.container, "Assistant behaviour");
    if (config.allowCheckQueries) {
      const id = controlId("aiCheckQueries");
      settingsRow(
        behaviour,
        "Check queries on the endpoint",
        `Before answering, the assistant may run up to ${config.maxCheckQueries} small read-only queries (at most 20 rows each) to check that classes, properties and values exist. Their results go to the AI service and are shown in the answer.`,
        [settingsSwitch(id, this.settings().checkQueries !== false, (on) => this.store({ checkQueries: on }))],
        id,
      );
    }
    const hosts = this.settings().consentedHosts || [];
    const reset = el("button", "secondaryButton", "Ask again");
    reset.type = "button";
    reset.addEventListener("click", () => {
      this.store({ consentedHosts: undefined });
      this.render();
    });
    settingsRow(
      behaviour,
      "Privacy notice",
      hosts.length
        ? `Ask before sending. You chose not to be asked again for ${hosts.join(", ")}.`
        : "Before sending a request, the assistant shows what it sends and asks you to confirm.",
      hosts.length ? [reset] : [],
    );
  }

  private addService() {
    const config = this.assistant.config;
    const provider = providerOf(config.defaultBaseUrl) || aiProviders[0];
    const noDefault = this.settings().defaultService === AI_SERVICE_OFF || !this.assistant.getConnections().length;
    this.draft = {
      id: newServiceId(),
      isNew: true,
      providerId: provider.id,
      baseUrl: provider.baseUrl,
      model: config.defaultModel,
      makeDefault: noDefault || !siteServices(config).length,
    };
    this.render();
  }

  private edit(service: AiServiceSettings) {
    const provider = this.providerOfService(service);
    this.draft = {
      ...service,
      providerId: provider?.id || CUSTOM_PROVIDER_ID,
      baseUrl: service.baseUrl || this.assistant.config.defaultBaseUrl,
      isNew: false,
      makeDefault: this.defaultId() === service.id,
    };
    this.render();
  }

  private async removeService(service: AiServiceSettings) {
    const confirmed = await showConfirm("Its API key is deleted from this browser too.", {
      title: `Remove the AI service “${this.serviceName(service)}”?`,
      confirmLabel: "Remove",
      danger: true,
    });
    if (!confirmed) return;
    const services = (this.settings().services || []).filter((candidate) => candidate.id !== service.id);
    const changes: Parameters<AiAssistant["settings"]["update"]>[0] = {
      services: services.length ? services : undefined,
    };
    if (this.settings().defaultService === service.id) changes.defaultService = undefined;
    this.store(changes);
    this.render();
  }

  // ─── The form of one service ─────────────────────────────────────────────────────────────────────────────────────

  private renderForm(draft: Draft) {
    const config = this.assistant.config;
    const crumb = el("div", "yasgui-aiSettings__crumb");
    const back = el("button", "yasgui-aiSettings__back", "‹ AI services");
    back.type = "button";
    back.addEventListener("click", () => this.load());
    crumb.append(
      back,
      el("span", undefined, "/"),
      el("span", undefined, draft.isNew ? "New AI service" : this.serviceName(draft)),
    );
    this.container.appendChild(crumb);

    const form = el("div", "yasgui-aiSettings__form");
    const head = el("div", "yasgui-aiSettings__formTitle");
    head.appendChild(el("strong", undefined, draft.isNew ? "New AI service" : `Edit ${this.serviceName(draft)}`));
    head.appendChild(el("span", undefined, "Any service with an OpenAI-compatible API"));
    form.appendChild(head);

    const field = (labelText: string, control: HTMLElement, extra?: HTMLElement[], hint?: string, forId?: string) => {
      const wrapper = el("div", "yasgui-aiSettings__field");
      const label = el("div", "yasgui-aiSettings__fieldLabel");
      const name = el(forId ? "label" : "span", undefined, labelText);
      if (forId) (name as HTMLLabelElement).htmlFor = forId;
      label.appendChild(name);
      if (extra) label.append(...extra);
      wrapper.append(label, control);
      if (hint) wrapper.appendChild(el("div", "yasgui-aiSettings__hint", hint));
      return wrapper;
    };
    const provider = () => providerById(draft.providerId) || providerById(CUSTOM_PROVIDER_ID)!;

    // Provider and name
    const providerCombo = new Combobox({
      ariaLabel: "Provider",
      placeholder: "Pick a provider",
      searchPlaceholder: "Search providers",
      onChange: (id) => {
        const picked = providerById(id)!;
        draft.providerId = picked.id;
        draft.baseUrl = picked.baseUrl;
        draft.model = picked.recommended?.[0];
        this.render();
        if (picked.id === CUSTOM_PROVIDER_ID || picked.id === "azure") {
          (this.container.querySelector(".yasgui-aiSettings__baseUrl") as HTMLInputElement | null)?.focus();
        }
      },
    });
    providerCombo.setOptions(
      aiProviders.map((candidate) => ({
        value: candidate.id,
        label: candidate.name,
        group: providerGroupLabels[candidate.group],
        sub: candidate.note,
        badge: candidate.region,
        logo: { text: candidate.id === CUSTOM_PROVIDER_ID ? "+" : candidate.name.charAt(0), color: candidate.color },
      })),
    );
    providerCombo.setValue(draft.providerId);
    const nameInput = el("input", "yasgui-aiSettings__input");
    nameInput.type = "text";
    nameInput.id = controlId("aiName");
    nameInput.value = draft.name || "";
    nameInput.placeholder = this.serviceName({ ...draft, name: undefined });
    nameInput.addEventListener("input", () => (draft.name = nameInput.value.trim() || undefined));
    const pair = el("div", "yasgui-aiSettings__pair");
    pair.append(
      field("Provider", providerCombo.el),
      field(
        "Name",
        nameInput,
        [el("span", "yasgui-aiSettings__aside", "shown in the AI view")],
        undefined,
        nameInput.id,
      ),
    );
    form.appendChild(pair);

    // Base URL: the provider's, until the user changes it
    const baseInput = el("input", "yasgui-aiSettings__input yasgui-aiSettings__baseUrl");
    baseInput.type = "url";
    baseInput.id = controlId("aiBaseUrl");
    baseInput.spellcheck = false;
    baseInput.value = draft.baseUrl || "";
    baseInput.placeholder = "https://…/v1";
    const fromProvider = el("span", "yasgui-pill", "From provider");
    const changed = el("span", "yasgui-pill yasgui-pill--changed", "Changed");
    const resetBase = el("button", "yasgui-aiSettings__linkButton", "Reset to provider default");
    resetBase.type = "button";
    const showBaseState = () => {
      const preset = provider().baseUrl;
      const same = !!preset && normalizeBaseUrl(baseInput.value) === normalizeBaseUrl(preset);
      fromProvider.hidden = !same;
      changed.hidden = same || !preset;
      resetBase.hidden = same || !preset;
    };
    resetBase.addEventListener("click", () => {
      baseInput.value = provider().baseUrl;
      draft.baseUrl = baseInput.value;
      showBaseState();
    });
    baseInput.addEventListener("input", () => {
      draft.baseUrl = baseInput.value.trim() || undefined;
      showBaseState();
    });
    showBaseState();
    form.appendChild(
      field(
        "Base URL",
        baseInput,
        [fromProvider, changed, resetBase],
        provider().id === CUSTOM_PROVIDER_ID
          ? "Requests go to <base URL>/chat/completions."
          : provider().note && provider().id === "azure"
            ? "Replace YOUR-RESOURCE with the name of your Azure resource."
            : "Filled in from the provider. Change it for a gateway, a proxy or a self-hosted server.",
        baseInput.id,
      ),
    );

    // API key
    if (!provider().noKey) {
      const keyBox = el("div", "yasgui-aiSettings__keyBox");
      const keyInput = el("input", "yasgui-aiSettings__input");
      keyInput.type = "password";
      keyInput.id = controlId("aiKey");
      keyInput.autocomplete = "off";
      keyInput.spellcheck = false;
      keyInput.placeholder = "sk-…";
      keyInput.value = draft.apiKey || "";
      keyInput.addEventListener("input", () => (draft.apiKey = keyInput.value.trim() || undefined));
      const eye = el("button", "yasgui-aiSettings__eye");
      eye.type = "button";
      eye.setAttribute("aria-label", "Show the API key");
      eye.textContent = "Show";
      eye.addEventListener("click", () => {
        const hidden = keyInput.type === "password";
        keyInput.type = hidden ? "text" : "password";
        eye.textContent = hidden ? "Hide" : "Show";
        eye.setAttribute("aria-label", hidden ? "Hide the API key" : "Show the API key");
      });
      keyBox.append(keyInput, eye);
      const extra: HTMLElement[] = [];
      const keyUrl = provider().keyUrl;
      if (keyUrl) {
        const link = el("a", "yasgui-aiSettings__keyLink", `Get a key at ${hostOf(keyUrl)} ↗`);
        link.href = keyUrl;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        extra.push(link);
      }
      const keyField = field(
        "API key",
        keyBox,
        extra,
        "Stored in this browser only, and sent only to the base URL above; never exported or shared. Use a key with a spending limit. Leave it empty for a proxy that needs no key.",
        keyInput.id,
      );
      const stored = (this.settings().services || []).find((service) => service.id === draft.id);
      if (stored?.apiKey) {
        // Removes the key from this browser right away, also when the form is cancelled
        const forget = el("button", "yasgui-aiSettings__linkButton danger yasgui-aiSettings__forget", "Forget key");
        forget.type = "button";
        forget.addEventListener("click", () => {
          this.store({
            services: (this.settings().services || []).map((service) =>
              service.id === draft.id ? { ...service, apiKey: undefined } : service,
            ),
          });
          draft.apiKey = undefined;
          keyInput.value = "";
          forget.replaceWith(el("span", "yasgui-aiSettings__hint", "The API key was removed from this browser."));
        });
        keyField.appendChild(forget);
      }
      form.appendChild(keyField);
    }

    // Model: a list fetched from the service, the provider's recommended models, or any id typed in
    const modelCombo = new Combobox({
      ariaLabel: "Model",
      placeholder: "Fetch models, or type a model id",
      searchPlaceholder: "Search models or type a model id",
      mono: true,
      allowCustom: true,
      onChange: (id) => (draft.model = id),
    });
    modelCombo.setValue(draft.model);
    const fetchButton = el("button", "secondaryButton yasgui-aiSettings__fetch");
    fetchButton.type = "button";
    fetchButton.innerHTML = icon("refresh", 14) + "<span>Fetch models</span>";
    const modelRow = el("div", "yasgui-aiSettings__modelRow");
    modelRow.append(modelCombo.el, fetchButton);
    const status = el("div", "yasgui-aiSettings__status");
    status.setAttribute("aria-live", "polite");
    const notice = el("div", "yasgui-aiSettings__notice");
    notice.hidden = true;
    const modelField = field("Model", modelRow);
    modelField.append(status, notice);
    form.appendChild(modelField);

    const showModels = (models: FoundModels | undefined) => {
      const recommended = provider().recommended || [];
      const ids = models ? models.ids : recommended;
      const starred = recommended.filter((id) => ids.includes(id));
      const options: ComboOption[] = [
        ...starred.map((id) => ({ value: id, label: id, star: true, group: "Recommended" })),
        ...ids
          .filter((id) => !starred.includes(id))
          .map((id) => ({ value: id, label: id, group: starred.length ? "All models" : undefined })),
      ];
      const footer = models?.hidden ? `${models.hidden} embedding, speech and image models hidden` : undefined;
      modelCombo.setOptions(options, footer);
      modelCombo.setSearchPlaceholder(
        ids.length ? `Search ${ids.length} models or type a model id` : "Type a model id",
      );
    };
    showModels(this.found.get(normalizeBaseUrl(draft.baseUrl || "")));

    const fetchModels = async () => {
      const connection = ownConnection(config, draft);
      status.className = "yasgui-aiSettings__status";
      notice.hidden = true;
      if (!connection) {
        status.textContent = "Enter the base URL first.";
        return;
      }
      fetchButton.disabled = true;
      status.textContent = `Fetching the models of ${connection.host}…`;
      try {
        const all = await listModels(connection);
        const ids = all.filter(isChatModel);
        const models = { ids, fromService: true, hidden: all.length - ids.length };
        this.found.set(normalizeBaseUrl(connection.baseUrl), models);
        showModels(models);
        if (!draft.model || !ids.includes(draft.model)) {
          const pick =
            (provider().recommended || []).find((id) => ids.includes(id)) || (draft.model ? undefined : ids[0]);
          if (pick) {
            draft.model = pick;
            modelCombo.setValue(pick);
          }
        }
        status.classList.add("ok");
        status.textContent = ids.length
          ? `Connected · ${ids.length} models found`
          : "Connected. The service doesn't list its models; type the model id.";
      } catch (e: any) {
        const recommended = provider().recommended || [];
        status.classList.add(e instanceof AiRequestError && e.unreachable ? "warn" : "error");
        if (e instanceof AiRequestError && e.unreachable) {
          showModels(undefined);
          status.textContent = recommended.length
            ? `The model list can't be read from the browser. Showing the ${recommended.length} models MatGUI knows for ${provider().name}.`
            : "The model list can't be read from the browser. Type the model id.";
          notice.textContent =
            provider().corsHint ||
            `${connection.host} doesn't let a browser read its models (CORS), or it can't be reached. You can still type a model id. If questions to the assistant fail the same way, use the service through a proxy of this site or through OpenRouter.`;
          notice.hidden = false;
        } else {
          status.textContent = e?.message || `Could not fetch the models of ${connection.host}.`;
        }
      } finally {
        fetchButton.disabled = false;
      }
    };
    fetchButton.addEventListener("click", () => void fetchModels());

    // Default, Cancel and Save
    const footer = el("div", "yasgui-aiSettings__formFooter");
    const defaultId = controlId("aiMakeDefault");
    const defaultLabel = el("label", "yasgui-aiSettings__defaultSwitch");
    defaultLabel.htmlFor = defaultId;
    defaultLabel.append(
      settingsSwitch(defaultId, draft.makeDefault, (on) => (draft.makeDefault = on)),
      el("span", undefined, "Make this the default service"),
    );
    const cancel = el("button", "secondaryButton", "Cancel");
    cancel.type = "button";
    cancel.addEventListener("click", () => this.load());
    const save = el("button", "primaryButton", "Save service");
    save.type = "button";
    save.addEventListener("click", () => this.saveDraft(draft, status));
    footer.append(defaultLabel, cancel, save);
    form.appendChild(footer);

    this.container.appendChild(form);
  }

  private saveDraft(draft: Draft, status: HTMLElement) {
    if (!draft.baseUrl?.trim()) {
      status.className = "yasgui-aiSettings__status error";
      status.textContent = "Enter the base URL of the service.";
      (this.container.querySelector(".yasgui-aiSettings__baseUrl") as HTMLInputElement | null)?.focus();
      return;
    }
    const cleaned: AiServiceSettings = { id: draft.id, baseUrl: normalizeBaseUrl(draft.baseUrl) };
    if (draft.providerId && draft.providerId !== CUSTOM_PROVIDER_ID) cleaned.providerId = draft.providerId;
    if (draft.name) cleaned.name = draft.name;
    if (draft.apiKey && !providerById(draft.providerId)?.noKey) cleaned.apiKey = draft.apiKey;
    if (draft.model) cleaned.model = draft.model;
    const services = [...(this.settings().services || [])];
    const index = services.findIndex((service) => service.id === draft.id);
    if (index >= 0) services[index] = cleaned;
    else services.push(cleaned);
    const changes: Parameters<AiAssistant["settings"]["update"]>[0] = { services };
    if (draft.makeDefault) changes.defaultService = draft.id;
    else if (this.settings().defaultService === draft.id) changes.defaultService = undefined;
    this.store(changes);
    this.load();
  }
}
