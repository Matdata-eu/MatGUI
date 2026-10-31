/**
 * The user's AI settings (their own services with base URL, API key and model, and the default one) and which
 * service requests go to.
 * The settings are stored in this browser only, under their own storage key: they are not part of the
 * persisted Yasgui config, so configuration export and share links never include the API key.
 */
import { Storage as YStorage } from "@matdata/yasgui-utils";
import { AI_SERVICE_OFF } from "./types";
import type { AiConfig, AiConnection, AiProxyConfig, AiServiceSettings, AiUserSettings } from "./types";

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

/** The AI services of the embedding site */
export function siteServices(config: AiConfig): AiProxyConfig[] {
  const proxies = Array.isArray(config.proxy) ? config.proxy : config.proxy ? [config.proxy] : [];
  return proxies.filter((proxy) => !!proxy?.url);
}

function siteConnection(proxy: AiProxyConfig, index: number): AiConnection {
  const headers = proxy.headers;
  return {
    id: `site:${index}`,
    kind: "proxy",
    baseUrl: proxy.url,
    model: proxy.model,
    host: hostOf(proxy.url),
    label: proxy.label || hostOf(proxy.url),
    privacyUrl: proxy.privacyUrl,
    withCredentials: proxy.withCredentials,
    getHeaders: headers ? async () => (typeof headers === "function" ? headers() : headers) : undefined,
  };
}

/** Connection to one of the user's own services, or undefined when it has no base URL */
export function ownConnection(config: AiConfig, service: AiServiceSettings): AiConnection | undefined {
  const baseUrl = normalizeBaseUrl(service.baseUrl || config.defaultBaseUrl || "");
  if (!baseUrl) return undefined;
  return {
    id: service.id,
    kind: "own",
    baseUrl,
    apiKey: service.apiKey || undefined,
    model: (service.model || config.defaultModel || "").trim() || undefined,
    host: hostOf(baseUrl),
    label: service.name?.trim() || hostOf(baseUrl),
  };
}

/** All services the user can pick: the services of the site first, then the user's own */
export function listConnections(config: AiConfig, settings: AiUserSettings): AiConnection[] {
  if (!config.enabled) return [];
  const connections = siteServices(config).map(siteConnection);
  if (config.allowOwnKey) {
    for (const service of settings.services || []) {
      const connection = ownConnection(config, service);
      if (connection) connections.push(connection);
    }
  }
  return connections;
}

/**
 * The service requests go to: the one with `id` (picked in the AI view), else the user's default, else the
 * first one. Undefined when none is set up or the user chose "No AI service" (the assistant then only copies
 * prompts).
 */
export function resolveConnection(config: AiConfig, settings: AiUserSettings, id?: string): AiConnection | undefined {
  const connections = listConnections(config, settings);
  for (const wanted of [id, settings.defaultService]) {
    if (wanted === AI_SERVICE_OFF) return undefined;
    const connection = wanted && connections.find((candidate) => candidate.id === wanted);
    if (connection) return connection;
  }
  return connections[0];
}

/** Moves the settings of versions with one service to the list of services */
export function migrateSettings(settings: AiUserSettings): AiUserSettings {
  if (!settings.service && !settings.baseUrl && !settings.apiKey && !settings.model) return settings;
  const { service, baseUrl, apiKey, model, ...rest } = settings;
  const migrated: AiUserSettings = { ...rest };
  if (baseUrl || apiKey || model) {
    migrated.services = [...(rest.services || []), { id: "own-1", baseUrl, apiKey, model }];
  }
  if (service === "off") migrated.defaultService = AI_SERVICE_OFF;
  else if (service === "proxy") migrated.defaultService = "site:0";
  else if (service === "own" && migrated.services?.length) migrated.defaultService = "own-1";
  return migrated;
}

/** A new id for one of the user's own services */
export function newServiceId(): string {
  return `own-${Date.now().toString(36)}${Math.random().toString(36).substring(2, 6)}`;
}

export default class AiSettingsStore {
  private storage = new YStorage("yasgui-ai");
  private settings: AiUserSettings;
  private listeners: Array<() => void> = [];

  constructor(private storageKey: string | undefined) {
    this.settings = migrateSettings((storageKey && this.storage.get<AiUserSettings>(storageKey)) || {});
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
