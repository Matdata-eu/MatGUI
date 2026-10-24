/**
 * Configuration of the AI assistant: natural language to SPARQL, fixing and explaining queries, and explaining
 * results. MatGUI talks to any OpenAI-compatible chat completions API, either with the user's own key or
 * through a proxy run by the embedding site.
 */

/** A proxy run by the embedding site, so end users need no key of their own */
export interface AiProxyConfig {
  /**
   * Base URL of an OpenAI-compatible API, e.g. "https://example.org/ai/v1". MatGUI posts to
   * `${url}/chat/completions` and lists models from `${url}/models`.
   */
  url: string;
  /** Name shown to users in the privacy notice and the settings, e.g. "ERA AI service" */
  label?: string;
  /** Model to request. Leave unset when the proxy picks the model itself. */
  model?: string;
  /** Extra request headers, e.g. a session token for the proxy. A function is called before every request. */
  headers?: { [name: string]: string } | (() => { [name: string]: string } | Promise<{ [name: string]: string }>);
  /** Send cookies with the request (fetch `credentials: "include"`), for proxies behind a login */
  withCredentials?: boolean;
  /** Link to the privacy policy of the service, shown in the privacy notice */
  privacyUrl?: string;
}

export interface AiConfig {
  /** Show the AI features (default: true). False hides the AI panel, buttons, commands and settings. */
  enabled: boolean;
  /** AI service of the embedding site. When set, it is the default for users who did not enter their own key. */
  proxy?: AiProxyConfig;
  /** Let users enter their own API key and base URL (default: true) */
  allowOwnKey: boolean;
  /** Base URL suggested to users who bring their own key (default: OpenAI) */
  defaultBaseUrl: string;
  /** Model suggested to users who bring their own key */
  defaultModel?: string;
  /** Maximum number of result rows sent by "Explain results" (default: 50) */
  maxResultRows: number;
  /**
   * Let the model run small read-only check queries on the endpoint (at most 20 rows each) to verify class and
   * property names before answering (default: true). Users can switch it off in the settings.
   */
  allowCheckQueries: boolean;
  /** Maximum number of check queries for one question (default: 5) */
  maxCheckQueries: number;
  /** Maximum number of classes and of properties of the endpoint sent as context (default: 150) */
  maxSchemaTerms: number;
  /** Timeout of one request to the AI service, in milliseconds (default: 90000) */
  timeoutMs: number;
}

export const defaultAiConfig: AiConfig = {
  enabled: true,
  allowOwnKey: true,
  defaultBaseUrl: "https://api.openai.com/v1",
  maxResultRows: 50,
  allowCheckQueries: true,
  maxCheckQueries: 5,
  maxSchemaTerms: 150,
  timeoutMs: 90000,
};

/** Which AI service the user picked in the settings */
export type AiServiceChoice = "proxy" | "own" | "off";

/** Settings of the user, stored in this browser only and never exported or shared */
export interface AiUserSettings {
  service?: AiServiceChoice;
  baseUrl?: string;
  apiKey?: string;
  model?: string;
  /** False when the user switched off check queries */
  checkQueries?: boolean;
  /** Hosts the user agreed to send data to, without asking again */
  consentedHosts?: string[];
}

/** The AI service requests go to */
export interface AiConnection {
  kind: "proxy" | "own";
  baseUrl: string;
  model?: string;
  apiKey?: string;
  /** Host name shown to the user, e.g. "api.openai.com" */
  host: string;
  /** Name shown to the user, e.g. "ERA AI service" or "api.openai.com" */
  label: string;
  privacyUrl?: string;
  withCredentials?: boolean;
  getHeaders?: () => Promise<{ [name: string]: string }>;
}

export type AiTaskKind = "ask" | "fix" | "explainQuery" | "explainResults" | "plugin";
