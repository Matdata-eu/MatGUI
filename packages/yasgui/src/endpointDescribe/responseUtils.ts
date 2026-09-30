/**
 * Helpers to interpret describe query responses of real-world endpoints.
 */

const MAX_ERROR_LENGTH = 500;

function getHeader(response: any, name: string): string | undefined {
  const headers = response?.headers;
  if (!headers) return undefined;
  if (typeof headers.get === "function") return headers.get(name) ?? undefined;
  const key = Object.keys(headers).find((k) => k.toLowerCase() === name.toLowerCase());
  return key ? headers[key] : undefined;
}

/**
 * Whether the endpoint returned an incomplete result, e.g. Virtuoso "anytime queries"
 * which stop at a time limit and answer with HTTP 206 and X-SQL-State S1TAT.
 */
export function isPartialResponse(response: any): boolean {
  return response?.status === 206 || getHeader(response, "X-SQL-State") === "S1TAT";
}

/**
 * Turn an HTML error page into a short text: its title (or heading), otherwise its text content.
 */
export function htmlToText(content: string): string {
  const title =
    content.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || content.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1];
  const text = title ?? content.replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, " ").replace(/<[^>]+>/g, " ");
  return text
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Extract the root cause from a Java stack trace (e.g. Blazegraph / Wikidata errors), if any.
 */
export function javaRootCause(message: string): string | undefined {
  const pattern = /[\w.$]+(?:Exception|Error): /g;
  let last: RegExpExecArray | null = null;
  for (let match = pattern.exec(message); match; match = pattern.exec(message)) last = match;
  if (!last) return undefined;
  const cause = message
    .substring(last.index + last[0].length)
    .split("\n")[0]
    .trim();
  return cause || undefined;
}

/**
 * A readable error message for a failed describe query.
 */
export function describeQueryError(error: any, options: { timedOut?: boolean; timeoutMs?: number } = {}): string {
  if (options.timedOut) return `Timed out after ${Math.round((options.timeoutMs || 0) / 1000)} s`;
  let message = error instanceof Error ? error.message : String(error ?? "Query failed");
  if (/^\s*<(!doctype|html|\?xml)/i.test(message) || /<\/(html|body|title)>/i.test(message)) {
    message = htmlToText(message);
  }
  if (/\n\s*(at |Caused by: )|java\.\w/.test(message)) message = javaRootCause(message) ?? message;
  const status: number | undefined = error?.status;
  if (status === 429) {
    const retryAfter = getHeader(error?.response, "Retry-After");
    message =
      "The endpoint is rate limiting requests. Wait a moment before running more queries" +
      (retryAfter && /^\d+$/.test(retryAfter) ? ` (retry after ${retryAfter} s).` : ".");
  } else if (status === 502 || status === 503 || status === 504) {
    message = `The endpoint (or a gateway in front of it) did not answer in time. ${message}`.trim();
  }
  if (status) message = `HTTP ${status}${error?.statusText ? " " + error.statusText : ""}: ${message}`;
  return message.length > MAX_ERROR_LENGTH ? message.substring(0, MAX_ERROR_LENGTH) + "…" : message;
}
