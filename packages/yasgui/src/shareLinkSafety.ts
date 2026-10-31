/**
 * Why a query that came in through a share link must not run on its own, if it must not.
 *
 * A link can name any query and endpoint. Running it on load would let a crafted link run an update, or a
 * query that carries the credentials this browser saved for that endpoint, as the person who opens it.
 */
export type SharedQueryRunBlocker = "update" | "invalid" | "credentials";

export interface SharedQueryRunInfo {
  queryMode: "update" | "query";
  queryValid: boolean;
  /** The request would carry an Authorization or API key header, or cookies */
  sendsCredentials: boolean;
}

export type AutoRunSharedQueries = "safe" | "always" | "never";

export function getSharedQueryRunBlocker(
  info: SharedQueryRunInfo,
  mode: AutoRunSharedQueries = "safe",
): SharedQueryRunBlocker | "disabled" | undefined {
  if (mode === "never") return "disabled";
  // Updates never run from a link, whatever the mode
  if (info.queryMode === "update") return "update";
  if (mode === "always") return undefined;
  // An invalid query may be an update the tokenizer couldn't classify
  if (!info.queryValid) return "invalid";
  if (info.sendsCredentials) return "credentials";
  return undefined;
}

export function sharedQueryBlockedMessage(blocker: SharedQueryRunBlocker | "disabled", endpoint: string): string {
  switch (blocker) {
    case "update":
      return "This link holds an update query, so it was not run. Review it, then press Run if you want to change the data.";
    case "credentials":
      return `This link was not run because it would use your saved credentials for ${endpoint}. Review the query first.`;
    case "invalid":
      return "This link holds a query with syntax errors, so it was not run.";
    case "disabled":
      return "Query loaded from the link. Press Run to execute it.";
  }
}

/** Parse a JSON-valued share link parameter, ignoring a malformed or truncated value */
export function parseJsonParam<T = any>(key: string, value: string): T | undefined {
  try {
    return JSON.parse(value);
  } catch {
    console.warn(`Ignoring the "${key}" parameter of the link: it is not valid JSON`);
    return undefined;
  }
}
