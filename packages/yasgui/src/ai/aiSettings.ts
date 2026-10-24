/**
 * The user's AI settings (service, base URL, API key, model) and which service requests go to.
 * The settings are stored in this browser only, under their own storage key: they are not part of the
 * persisted Yasgui config, so configuration export and share links never include the API key.
 */
import { Storage as YStorage } from "@matdata/yasgui-utils";
import type { AiConfig, AiConnection, AiUserSettings } from "./types";

/** Ten years: the settings stay until the user clears them */
const SETTINGS_EXPIRY_SECONDS = 60 * 60 * 24 * 365 * 10;

export function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

/** Local services (Ollama, LM Studio, …) usually need no API key */
export function isLocalUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname;
    return host === "localhost" || host === "127.0.0.1" || host === "::1" || host === "[::1]";
  } catch {
    return false;
  }
}

/**
 * Base URL without the endpoint path that people often paste with it, such as `.../v1/chat/completions` or
 * Anthropic's `.../v1/messages`: the client adds `chat/completions` and `models` itself.
 */
export function normalizeBaseUrl(url: string): string {
  return url
    .trim()
    .replace(/\/+$/, "")
    .replace(/\/(chat\/completions|completions|messages|models)$/, "");
}

/**
 * The service requests go to, or undefined when none is set up (the assistant then only copies prompts).
 */
export function resolveConnection(config: AiConfig, settings: AiUserSettings): AiConnection | undefined {
  if (!config.enabled || settings.service === "off") return undefined;
  const proxy = config.proxy;
  const wantsOwn = settings.service === "own" || (!settings.service && !proxy && !!settings.apiKey);
  if (wantsOwn && config.allowOwnKey) {
    const baseUrl = normalizeBaseUrl(settings.baseUrl || config.defaultBaseUrl || "");
    if (!baseUrl) return undefined;
    if (!settings.apiKey && !isLocalUrl(baseUrl)) return undefined;
    return {
      kind: "own",
      baseUrl,
      apiKey: settings.apiKey || undefined,
      model: (settings.model || config.defaultModel || "").trim() || undefined,
      host: hostOf(baseUrl),
      label: hostOf(baseUrl),
    };
  }
  if (proxy?.url && settings.service !== "own") {
    const headers = proxy.headers;
    return {
      kind: "proxy",
      baseUrl: proxy.url,
      model: proxy.model,
      host: hostOf(proxy.url),
      label: proxy.label || hostOf(proxy.url),
      privacyUrl: proxy.privacyUrl,
      withCredentials: proxy.withCredentials,
      getHeaders: headers ? async () => (typeof headers === "function" ? await headers() : headers) : undefined,
    };
  }
  return undefined;
}

export default class AiSettingsStore {
  private storage = new YStorage("yasgui-ai");
  private settings: AiUserSettings;
  private listeners: Array<() => void> = [];

  constructor(private storageKey: string | undefined) {
    this.settings = (storageKey && this.storage.get<AiUserSettings>(storageKey)) || {};
  }

  public get(): AiUserSettings {
    return { ...this.settings };
  }

  public update(changes: Partial<AiUserSettings>) {
    this.settings = { ...this.settings, ...changes };
    for (const key of Object.keys(this.settings) as Array<keyof AiUserSettings>) {
      if (this.settings[key] === undefined || this.settings[key] === "") delete this.settings[key];
    }
    this.persist();
  }

  /** Forget the API key (and the rest of the settings) stored in this browser */
  public clear() {
    this.settings = {};
    this.persist();
  }

  public hasConsent(host: string): boolean {
    return (this.settings.consentedHosts || []).includes(host);
  }

  public addConsent(host: string) {
    const hosts = new Set(this.settings.consentedHosts || []);
    hosts.add(host);
    this.update({ consentedHosts: Array.from(hosts) });
  }

  public onChange(listener: () => void) {
    this.listeners.push(listener);
  }

  private persist() {
    if (this.storageKey) {
      if (Object.keys(this.settings).length) {
        this.storage.set(this.storageKey, this.settings, SETTINGS_EXPIRY_SECONDS, () => {});
      } else {
        this.storage.remove(this.storageKey);
      }
    }
    for (const listener of this.listeners) listener();
  }
}
