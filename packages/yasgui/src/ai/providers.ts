/**
 * Popular services with an OpenAI-compatible API, suggested in the Base URL field of the AI settings.
 * Users can still enter any other URL.
 */
export interface AiProvider {
  name: string;
  baseUrl: string;
  /** Shown next to the name in the list */
  note?: string;
}

export const aiProviders: AiProvider[] = [
  { name: "OpenAI", baseUrl: "https://api.openai.com/v1" },
  { name: "Anthropic (Claude)", baseUrl: "https://api.anthropic.com/v1" },
  { name: "Google Gemini", baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai" },
  { name: "Mistral", baseUrl: "https://api.mistral.ai/v1" },
  { name: "Moonshot (Kimi)", baseUrl: "https://api.moonshot.ai/v1" },
  { name: "DeepSeek", baseUrl: "https://api.deepseek.com/v1" },
  { name: "xAI (Grok)", baseUrl: "https://api.x.ai/v1" },
  { name: "OpenRouter", baseUrl: "https://openrouter.ai/api/v1", note: "many providers with one key" },
  { name: "Groq", baseUrl: "https://api.groq.com/openai/v1" },
  { name: "Together AI", baseUrl: "https://api.together.xyz/v1" },
  { name: "Fireworks AI", baseUrl: "https://api.fireworks.ai/inference/v1" },
  { name: "Cerebras", baseUrl: "https://api.cerebras.ai/v1" },
  { name: "Hugging Face", baseUrl: "https://router.huggingface.co/v1" },
  { name: "Scaleway", baseUrl: "https://api.scaleway.ai/v1", note: "hosted in the EU" },
  {
    name: "Azure OpenAI",
    baseUrl: "https://YOUR-RESOURCE.openai.azure.com/openai/v1",
    note: "replace YOUR-RESOURCE",
  },
  { name: "Ollama", baseUrl: "http://localhost:11434/v1", note: "on your computer, no key" },
  { name: "LM Studio", baseUrl: "http://localhost:1234/v1", note: "on your computer, no key" },
];

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
  if (wanted.endsWith(".openai.azure.com")) return aiProviders.find((provider) => provider.name === "Azure OpenAI");
  return aiProviders.find((provider) => host(provider.baseUrl) === wanted);
}
