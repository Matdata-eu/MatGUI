/**
 * Popular services with an OpenAI-compatible API, offered in the Provider list of the AI settings. Picking one fills
 * in the base URL, which users can still change (a gateway, a proxy, a self-hosted server), and "Custom" takes any
 * other URL.
 */
export type AiProviderGroup = "popular" | "cloud" | "local" | "other";

export interface AiProvider {
  /** Stored with the service, so the form shows the same provider when it is edited */
  id: string;
  name: string;
  /** Empty for "Custom" */
  baseUrl: string;
  group: AiProviderGroup;
  /** Shown next to the name in the list */
  note?: string;
  /** "EU" for services hosted in the European Union */
  region?: string;
  /** Where users create an API key */
  keyUrl?: string;
  /** Local services and gateways that take no key */
  noKey?: boolean;
  /** Colour of the initial shown as the provider's logo */
  color: string;
  /**
   * Models shown first (with a star) in the Model list, and the list offered when the service doesn't let a browser
   * read its models. Users can always type another model id.
   */
  recommended?: string[];
  /** What to do when the browser can't reach the service (CORS), for local servers */
  corsHint?: string;
}

export const CUSTOM_PROVIDER_ID = "custom";

export const aiProviders: AiProvider[] = [
  {
    id: "openai",
    name: "OpenAI",
    baseUrl: "https://api.openai.com/v1",
    group: "popular",
    keyUrl: "https://platform.openai.com/api-keys",
    color: "#10a37f",
    recommended: ["gpt-5", "gpt-5-mini"],
  },
  {
    id: "anthropic",
    name: "Anthropic (Claude)",
    baseUrl: "https://api.anthropic.com/v1",
    group: "popular",
    keyUrl: "https://console.anthropic.com/settings/keys",
    color: "#c96442",
    recommended: ["claude-sonnet-5-5", "claude-opus-5-5", "claude-haiku-5-5"],
  },
  {
    id: "gemini",
    name: "Google Gemini",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
    group: "popular",
    keyUrl: "https://aistudio.google.com/apikey",
    color: "#1a73e8",
    recommended: ["gemini-2.5-pro", "gemini-2.5-flash"],
  },
  {
    id: "mistral",
    name: "Mistral",
    baseUrl: "https://api.mistral.ai/v1",
    group: "popular",
    region: "EU",
    keyUrl: "https://console.mistral.ai/api-keys",
    color: "#fa520f",
    recommended: ["mistral-medium-latest", "mistral-large-latest", "codestral-latest"],
  },
  {
    id: "openrouter",
    name: "OpenRouter",
    baseUrl: "https://openrouter.ai/api/v1",
    group: "popular",
    note: "many models, one key",
    keyUrl: "https://openrouter.ai/keys",
    color: "#6d28d9",
    recommended: ["openrouter/auto"],
  },
  {
    id: "deepseek",
    name: "DeepSeek",
    baseUrl: "https://api.deepseek.com/v1",
    group: "cloud",
    keyUrl: "https://platform.deepseek.com/api_keys",
    color: "#4d6bfe",
    recommended: ["deepseek-chat", "deepseek-reasoner"],
  },
  {
    id: "xai",
    name: "xAI (Grok)",
    baseUrl: "https://api.x.ai/v1",
    group: "cloud",
    keyUrl: "https://console.x.ai",
    color: "#1c2633",
  },
  {
    id: "moonshot",
    name: "Moonshot (Kimi)",
    baseUrl: "https://api.moonshot.ai/v1",
    group: "cloud",
    keyUrl: "https://platform.moonshot.ai/console/api-keys",
    color: "#16191e",
  },
  {
    id: "groq",
    name: "Groq",
    baseUrl: "https://api.groq.com/openai/v1",
    group: "cloud",
    keyUrl: "https://console.groq.com/keys",
    color: "#f55036",
  },
  {
    id: "together",
    name: "Together AI",
    baseUrl: "https://api.together.xyz/v1",
    group: "cloud",
    keyUrl: "https://api.together.ai/settings/api-keys",
    color: "#0f6fff",
  },
  {
    id: "fireworks",
    name: "Fireworks AI",
    baseUrl: "https://api.fireworks.ai/inference/v1",
    group: "cloud",
    keyUrl: "https://fireworks.ai/account/api-keys",
    color: "#6720ff",
  },
  {
    id: "cerebras",
    name: "Cerebras",
    baseUrl: "https://api.cerebras.ai/v1",
    group: "cloud",
    keyUrl: "https://cloud.cerebras.ai",
    color: "#f15a29",
  },
  {
    id: "huggingface",
    name: "Hugging Face",
    baseUrl: "https://router.huggingface.co/v1",
    group: "cloud",
    keyUrl: "https://huggingface.co/settings/tokens",
    color: "#ff9d00",
  },
  {
    id: "scaleway",
    name: "Scaleway",
    baseUrl: "https://api.scaleway.ai/v1",
    group: "cloud",
    region: "EU",
    keyUrl: "https://console.scaleway.com/iam/api-keys",
    color: "#510d8b",
  },
  {
    id: "azure",
    name: "Azure OpenAI",
    baseUrl: "https://YOUR-RESOURCE.openai.azure.com/openai/v1",
    group: "cloud",
    note: "replace YOUR-RESOURCE",
    keyUrl: "https://portal.azure.com",
    color: "#0078d4",
  },
  {
    id: "ollama",
    name: "Ollama",
    baseUrl: "http://localhost:11434/v1",
    group: "local",
    note: "no key",
    noKey: true,
    color: "#3b4250",
    corsHint: "Start Ollama with OLLAMA_ORIGINS set to this site's address (or *), so the browser may call it.",
  },
  {
    id: "lmstudio",
    name: "LM Studio",
    baseUrl: "http://localhost:1234/v1",
    group: "local",
    note: "no key",
    noKey: true,
    color: "#4338ca",
    corsHint: "Turn on “Enable CORS” in the server settings of LM Studio, so the browser may call it.",
  },
  {
    id: CUSTOM_PROVIDER_ID,
    name: "Custom (OpenAI-compatible)",
    baseUrl: "",
    group: "other",
    note: "any other URL",
    color: "#808893",
  },
];

export const providerGroupLabels: Record<AiProviderGroup, string> = {
  popular: "Popular",
  cloud: "More cloud services",
  local: "On your computer",
  other: "Other",
};

export function providerById(id: string | undefined): AiProvider | undefined {
  return id ? aiProviders.find((provider) => provider.id === id) : undefined;
}

/** The provider of a base URL, by host */
export function providerOf(baseUrl: string): AiProvider | undefined {
  const host = (url: string) => {
    try {
      return new URL(url).host;
    } catch {
      return "";
    }
  };
  const wanted = host(baseUrl);
  if (!wanted) return undefined;
  if (wanted.endsWith(".openai.azure.com")) return providerById("azure");
  return aiProviders.find((provider) => provider.baseUrl && host(provider.baseUrl) === wanted);
}

/** Model ids that are not chat models (embeddings, speech, images, moderation), hidden from the Model list */
const NOT_CHAT = /(embed|whisper|tts|dall-e|moderation|transcri|realtime|rerank|speech|audio|image|-ocr|guard)/i;

export function isChatModel(id: string): boolean {
  return !NOT_CHAT.test(id);
}
