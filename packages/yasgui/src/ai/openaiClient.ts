/**
 * Minimal client for OpenAI-compatible chat completions APIs (OpenAI, Anthropic, Azure OpenAI, Mistral, Ollama, LM Studio,
 * vLLM, or a proxy of the embedding site). Requests go straight from the browser to the service.
 */
import type { AiConnection } from "./types";

export interface ChatToolCall {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
}

export type ChatMessage =
  | { role: "system"; content: string }
  | { role: "user"; content: string }
  | { role: "assistant"; content: string | null; tool_calls?: ChatToolCall[] }
  | { role: "tool"; tool_call_id: string; content: string };

export interface ChatTool {
  type: "function";
  function: { name: string; description: string; parameters: object };
}

export interface ChatRequest {
  messages: ChatMessage[];
  tools?: ChatTool[];
  signal?: AbortSignal;
  timeoutMs?: number;
}

export interface ChatResponse {
  message: { content: string | null; tool_calls?: ChatToolCall[] };
  model?: string;
  usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
}

export class AiRequestError extends Error {
  constructor(
    message: string,
    public status?: number,
    /** True when the service seems to reject the `tools` parameter */
    public toolsUnsupported = false,
  ) {
    super(message);
    this.name = "AiRequestError";
  }
}

export function joinUrl(baseUrl: string, path: string): string {
  return baseUrl.replace(/\/+$/, "") + "/" + path.replace(/^\/+/, "");
}

async function buildHeaders(connection: AiConnection): Promise<{ [name: string]: string }> {
  const headers: { [name: string]: string } = { "Content-Type": "application/json" };
  if (connection.apiKey) headers["Authorization"] = `Bearer ${connection.apiKey}`;
  if (connection.host === "api.anthropic.com") {
    // Anthropic only accepts browser requests that opt in with this header, and its own endpoints (such as
    // `models`) read the key from `x-api-key`
    headers["anthropic-dangerous-direct-browser-access"] = "true";
    headers["anthropic-version"] = "2023-06-01";
    if (connection.apiKey) headers["x-api-key"] = connection.apiKey;
  }
  if (connection.getHeaders) Object.assign(headers, await connection.getHeaders());
  return headers;
}

/** Human readable message for a failed response, from the OpenAI error format when available */
export function describeErrorBody(status: number, body: string): string {
  let detail = "";
  try {
    const json = JSON.parse(body);
    detail = json?.error?.message || json?.message || json?.detail || "";
    if (typeof detail !== "string") detail = JSON.stringify(detail);
  } catch {
    detail = body.slice(0, 300);
  }
  const hint =
    status === 401
      ? "The API key was refused. Check it in Settings → AI."
      : status === 404
        ? "The URL or model was not found. Check the base URL and model in Settings → AI."
        : status === 429
          ? "Rate limit or quota reached at the AI service."
          : "";
  return [`The AI service answered with error ${status}.`, detail, hint].filter(Boolean).join(" ");
}

function withTimeout(signal: AbortSignal | undefined, timeoutMs: number | undefined) {
  const controller = new AbortController();
  let timedOut = false;
  const timer = timeoutMs
    ? setTimeout(() => {
        timedOut = true;
        controller.abort();
      }, timeoutMs)
    : undefined;
  const onAbort = () => controller.abort();
  signal?.addEventListener("abort", onAbort);
  return {
    signal: controller.signal,
    timedOut: () => timedOut,
    done: () => {
      if (timer) clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
    },
  };
}

export async function chatCompletion(connection: AiConnection, request: ChatRequest): Promise<ChatResponse> {
  const body: { [key: string]: unknown } = { messages: request.messages };
  if (connection.model) body.model = connection.model;
  if (request.tools?.length) body.tools = request.tools;
  const timeout = withTimeout(request.signal, request.timeoutMs);
  let response: Response;
  try {
    response = await fetch(joinUrl(connection.baseUrl, "chat/completions"), {
      method: "POST",
      headers: await buildHeaders(connection),
      body: JSON.stringify(body),
      signal: timeout.signal,
      credentials: connection.withCredentials ? "include" : "omit",
    });
  } catch (e: any) {
    if (timeout.timedOut()) throw new AiRequestError("The AI service did not answer in time.");
    if (e?.name === "AbortError") throw e;
    throw new AiRequestError(
      `Could not reach ${connection.host}. Check the base URL, your network, and whether the service allows requests from a browser (CORS).`,
    );
  } finally {
    timeout.done();
  }
  const text = await response.text();
  if (!response.ok) {
    const toolsUnsupported =
      !!request.tools?.length && response.status >= 400 && response.status < 500 && /tool|function/i.test(text);
    throw new AiRequestError(describeErrorBody(response.status, text), response.status, toolsUnsupported);
  }
  let json: any;
  try {
    json = JSON.parse(text);
  } catch {
    throw new AiRequestError("The AI service sent an answer that is not JSON. Is the base URL right?");
  }
  const message = json?.choices?.[0]?.message;
  if (!message) throw new AiRequestError("The AI service sent an empty answer.");
  return { message, model: json.model, usage: json.usage };
}

/** Model ids offered by the service, sorted; an empty list when the service doesn't list models */
export async function listModels(connection: AiConnection, signal?: AbortSignal): Promise<string[]> {
  const response = await fetch(joinUrl(connection.baseUrl, "models"), {
    headers: await buildHeaders(connection),
    signal,
    credentials: connection.withCredentials ? "include" : "omit",
  });
  const text = await response.text();
  if (!response.ok) throw new AiRequestError(describeErrorBody(response.status, text), response.status);
  try {
    const json = JSON.parse(text);
    const ids: string[] = (json?.data || json?.models || [])
      .map((m: any) => (typeof m === "string" ? m : m?.id || m?.name))
      .filter((id: unknown): id is string => typeof id === "string");
    return Array.from(new Set(ids)).sort();
  } catch {
    return [];
  }
}
