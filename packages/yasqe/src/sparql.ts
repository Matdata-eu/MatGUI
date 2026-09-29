import { default as Yasqe, Config, RequestConfig } from "./";
import { merge, isFunction } from "lodash-es";
import * as queryString from "query-string";
export type YasqeAjaxConfig = Config["requestConfig"];
export interface PopulatedAjaxConfig {
  url: string;
  reqMethod: "POST" | "GET";
  headers: { [key: string]: string };
  accept: string;
  args: RequestArgs;
  withCredentials: boolean;
}
function getRequestConfigSettings(yasqe: Yasqe, conf?: Partial<Config["requestConfig"]>): RequestConfig<Yasqe> {
  if (isFunction(conf)) {
    return conf(yasqe) as RequestConfig<Yasqe>;
  }
  return (conf ?? {}) as RequestConfig<Yasqe>;
}

/**
 * Create a Basic Authentication header value
 */
function createBasicAuthHeader(username: string, password: string): string {
  const credentials = `${username}:${password}`;
  const encoded = base64EncodeUnicode(credentials);
  return `Basic ${encoded}`;
}

/**
 * Base64-encode a Unicode string using UTF-8 encoding.
 * This avoids errors with btoa() and supports all Unicode characters.
 */
export function base64EncodeUnicode(str: string): string {
  if (typeof window !== "undefined" && typeof window.TextEncoder !== "undefined") {
    const utf8Bytes = new window.TextEncoder().encode(str);
    let binary = "";
    for (let i = 0; i < utf8Bytes.length; i++) {
      binary += String.fromCharCode(utf8Bytes[i]);
    }
    return btoa(binary);
  } else if (typeof TextEncoder !== "undefined") {
    // For environments where TextEncoder is global (e.g., Node.js)
    const utf8Bytes = new TextEncoder().encode(str);
    let binary = "";
    for (let i = 0; i < utf8Bytes.length; i++) {
      binary += String.fromCharCode(utf8Bytes[i]);
    }
    return btoa(binary);
  } else {
    // Fallback: try btoa directly, but warn about possible errors
    try {
      return btoa(str);
    } catch (e) {
      throw new Error(
        "Basic authentication credentials contain unsupported Unicode characters. Please use a modern browser or restrict credentials to Latin1 characters.",
      );
    }
  }
}
// type callback = AjaxConfig.callbacks['complete'];
export function getAjaxConfig(
  yasqe: Yasqe,
  _config: Partial<Config["requestConfig"]> = {},
): PopulatedAjaxConfig | undefined {
  const config: RequestConfig<Yasqe> = merge(
    {},
    getRequestConfigSettings(yasqe, yasqe.config.requestConfig),
    getRequestConfigSettings(yasqe, _config),
  );
  if (!config.endpoint || config.endpoint.length == 0) return; // nothing to query!

  var queryMode = yasqe.getQueryMode();
  /**
   * initialize ajax config
   */
  const endpoint = isFunction(config.endpoint) ? config.endpoint(yasqe) : config.endpoint;
  var reqMethod: "GET" | "POST" =
    queryMode == "update" ? "POST" : isFunction(config.method) ? config.method(yasqe) : config.method;
  const headers = isFunction(config.headers) ? config.headers(yasqe) : config.headers;
  // console.log({headers})
  let withCredentials = isFunction(config.withCredentials) ? config.withCredentials(yasqe) : config.withCredentials;

  // Add Authentication headers if configured
  const finalHeaders = { ...headers };
  let hasAuthConfigured = false;

  try {
    // Check for OAuth 2.0 authentication (highest priority for access tokens)
    const oauth2Auth = isFunction(config.oauth2Auth) ? config.oauth2Auth(yasqe) : config.oauth2Auth;
    // Prefer ID token over access token for authentication:
    // - OAuth2 Proxy and similar gateways expect ID tokens (issued by OIDC providers like Azure AD)
    // - ID tokens contain identity/authentication info and match the expected issuer
    // - Access tokens are for API authorization and may have different issuers
    // - Azure AD issues both: id_token (from sts.windows.net or login.microsoftonline.com) for auth,
    //   and access_token for API access
    const oauth2Token = oauth2Auth?.idToken || oauth2Auth?.accessToken;
    const trimmedOAuth2Token = oauth2Token ? oauth2Token.trim() : "";
    if (oauth2Auth && trimmedOAuth2Token.length > 0) {
      hasAuthConfigured = true;
      if (finalHeaders["Authorization"] !== undefined) {
        console.warn(
          "Authorization header already exists in request headers; skipping OAuth 2.0 Auth header to avoid overwrite.",
        );
      } else {
        finalHeaders["Authorization"] = `Bearer ${trimmedOAuth2Token}`;
      }
    }

    // Check for Bearer Token authentication
    const bearerAuth = isFunction(config.bearerAuth) ? config.bearerAuth(yasqe) : config.bearerAuth;
    const trimmedBearerToken = bearerAuth && bearerAuth.token ? bearerAuth.token.trim() : "";
    if (bearerAuth && trimmedBearerToken.length > 0) {
      hasAuthConfigured = true;
      if (finalHeaders["Authorization"] !== undefined) {
        console.warn(
          "Authorization header already exists in request headers; skipping Bearer Auth header to avoid overwrite.",
        );
      } else {
        finalHeaders["Authorization"] = `Bearer ${trimmedBearerToken}`;
      }
    }

    // Check for API Key authentication
    const apiKeyAuth = isFunction(config.apiKeyAuth) ? config.apiKeyAuth(yasqe) : config.apiKeyAuth;
    const trimmedHeaderName = apiKeyAuth && apiKeyAuth.headerName ? apiKeyAuth.headerName.trim() : "";
    const trimmedApiKey = apiKeyAuth && apiKeyAuth.apiKey ? apiKeyAuth.apiKey.trim() : "";
    if (apiKeyAuth && trimmedHeaderName.length > 0 && trimmedApiKey.length > 0) {
      hasAuthConfigured = true;
      if (finalHeaders[trimmedHeaderName] !== undefined) {
        console.warn(
          `Header "${trimmedHeaderName}" already exists in request headers; skipping API Key header to avoid overwrite.`,
        );
      } else {
        finalHeaders[trimmedHeaderName] = trimmedApiKey;
      }
    }

    // Check for Basic Authentication (lowest priority)
    const basicAuth = isFunction(config.basicAuth) ? config.basicAuth(yasqe) : config.basicAuth;
    if (basicAuth && basicAuth.username && basicAuth.password) {
      hasAuthConfigured = true;
      if (finalHeaders["Authorization"] !== undefined) {
        console.warn(
          "Authorization header already exists in request headers; skipping Basic Auth header to avoid overwrite.",
        );
      } else {
        finalHeaders["Authorization"] = createBasicAuthHeader(basicAuth.username, basicAuth.password);
      }
    }
  } catch (error) {
    console.warn("Failed to configure authentication:", error);
    // Continue without authentication if there's an error
  }

  // If authentication is configured and withCredentials wasn't explicitly set, enable it
  // This ensures credentials are sent with cross-origin requests when auth is needed
  if (hasAuthConfigured) {
    withCredentials = true;
  }

  return {
    reqMethod,
    url: endpoint,
    args: getUrlArguments(yasqe, config),
    headers: finalHeaders,
    accept: getAcceptHeader(yasqe, config),
    withCredentials: withCredentials ?? false,
  };
  /**
   * merge additional request headers
   */
}

export interface ExecuteQueryOptions {
  customQuery?: string;
  customAccept?: string;
  /** Optional external abort signal, useful for plugin-driven background fetches. */
  signal?: AbortSignal;
  /**
   * Execute without emitting Yasqe query lifecycle events.
   * Useful for background/plugin-driven queries that should not update main UI state.
   */
  silent?: boolean;
  /**
   * Do not send the default/named graph arguments configured for the tab.
   * Useful for queries that should describe the whole endpoint.
   */
  skipGraphArgs?: boolean;
}

const GRAPH_ARG_NAMES = [
  "default-graph-uri",
  "named-graph-uri",
  "using-graph-uri",
  "using-named-graph-uri",
  // getUrlArguments uses these (trailing space) names for update queries
  "using-graph-uri ",
  "using-named-graph-uri ",
];

export async function executeQuery(
  yasqe: Yasqe,
  config?: YasqeAjaxConfig,
  options?: ExecuteQueryOptions,
): Promise<any> {
  const queryStart = Date.now();
  const silent = !!options?.silent;
  try {
    if (!silent) yasqe.emit("queryBefore", yasqe, config);
    const populatedConfig = getAjaxConfig(yasqe, config);
    if (!populatedConfig) {
      return; // Nothing to query
    }
    const abortController = new AbortController();
    if (options?.signal) {
      if (options.signal.aborted) {
        abortController.abort();
      } else {
        options.signal.addEventListener("abort", () => abortController.abort(), { once: true });
      }
    }

    // Use custom accept header if provided, otherwise use the default
    const acceptHeader = options?.customAccept || populatedConfig.accept;

    const fetchOptions: RequestInit = {
      method: populatedConfig.reqMethod,
      headers: {
        Accept: acceptHeader,
        ...(populatedConfig.headers || {}),
      },
      credentials: populatedConfig.withCredentials ? "include" : "same-origin",
      signal: abortController.signal,
      mode: "cors",
    };
    if (fetchOptions?.headers && populatedConfig.reqMethod === "POST") {
      (fetchOptions.headers as Record<string, string>)["Content-Type"] = "application/x-www-form-urlencoded";
    }
    const searchParams = new URLSearchParams();

    // Helper function to append args to search params
    const appendArgsToParams = (args: RequestArgs, excludeKeys: string[] = []) => {
      for (const key in args) {
        if (!excludeKeys.includes(key)) {
          const value = args[key];
          if (Array.isArray(value)) {
            value.forEach((v) => searchParams.append(key, v));
          } else {
            searchParams.append(key, value);
          }
        }
      }
    };

    // Helper function to determine the query parameter name
    // SPARQL queries use 'query' parameter, updates use 'update' parameter
    const getQueryParameterName = (args: RequestArgs): string => {
      if (args.query !== undefined) {
        return "query";
      } else if (args.update !== undefined) {
        return "update";
      }
      // Default to 'query' for standard SPARQL SELECT/CONSTRUCT/DESCRIBE/ASK queries
      return "query";
    };

    // Use custom query if provided, otherwise use the args from config
    if (options?.customQuery) {
      // A custom query is always a SPARQL read query (CONSTRUCT/DESCRIBE/SELECT/ASK),
      // never an update — always use the "query" parameter regardless of editor mode.
      searchParams.append("query", options.customQuery);

      // Add other args except the query/update parameter
      appendArgsToParams(populatedConfig.args, ["query", "update", ...(options.skipGraphArgs ? GRAPH_ARG_NAMES : [])]);
    } else {
      // Add all args from config
      appendArgsToParams(populatedConfig.args, options?.skipGraphArgs ? GRAPH_ARG_NAMES : []);
    }

    if (populatedConfig.reqMethod === "POST") {
      fetchOptions.body = searchParams.toString();
    } else {
      const url = new URL(populatedConfig.url);
      searchParams.forEach((value, key) => {
        url.searchParams.append(key, value);
      });
      populatedConfig.url = url.toString();
    }
    const request = new Request(populatedConfig.url, fetchOptions);
    if (!silent) yasqe.emit("query", request, abortController);
    const response = await fetch(request);

    // Await the response content and merge with the `Response` object
    const content = await response.text();
    const queryResponse = {
      ok: response.ok,
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
      type: response.type,
      content,
      // Compatibility aliases for plugins that expect fetch-like or axios-like response objects.
      data: content,
      json: async () => JSON.parse(content),
      text: async () => content,
    };

    if (!response.ok) {
      // For HTTP errors (4xx, 5xx), create an error but include full response details
      const error: any = new Error(queryResponse.content || response.statusText);
      error.status = response.status;
      error.statusText = response.statusText;
      error.response = queryResponse;
      throw error;
    }

    if (!silent) {
      yasqe.emit("queryResponse", queryResponse, Date.now() - queryStart);
      yasqe.emit("queryResults", queryResponse.content, Date.now() - queryStart);
    }
    return queryResponse;
  } catch (e) {
    if (e instanceof Error && e.message === "Aborted") {
      // The query was aborted. We should not do or draw anything
    } else {
      // Check if this is a network/CORS error from fetch (not an error we threw with status info)
      if (e instanceof Error && !("status" in e)) {
        // Enhance the error with additional context for common fetch failures
        const enhancedError: any = e;
        if (e.message.includes("Failed to fetch") || e.message.includes("NetworkError")) {
          enhancedError.message = `${e.message}. The server may have returned an error response (check browser dev tools), but CORS headers are preventing JavaScript from accessing it. Ensure the endpoint returns proper CORS headers even for error responses (Access-Control-Allow-Origin, etc.).`;
        }
        if (!silent) yasqe.emit("queryResponse", enhancedError, Date.now() - queryStart);
      } else {
        if (!silent) yasqe.emit("queryResponse", e, Date.now() - queryStart);
      }
    }
    if (!silent) yasqe.emit("error", e);
    throw e;
  }
}

export type RequestArgs = { [argName: string]: string | string[] };
export function getUrlArguments(yasqe: Yasqe, _config: Config["requestConfig"]): RequestArgs {
  var queryMode = yasqe.getQueryMode();

  var data: RequestArgs = {};
  const config: RequestConfig<Yasqe> = getRequestConfigSettings(yasqe, _config);
  var queryArg = isFunction(config.queryArgument) ? config.queryArgument(yasqe) : config.queryArgument;
  if (!queryArg) queryArg = yasqe.getQueryMode();
  data[queryArg] = config.adjustQueryBeforeRequest ? config.adjustQueryBeforeRequest(yasqe) : yasqe.getValue();
  /**
   * add named graphs to ajax config
   */
  const namedGraphs = isFunction(config.namedGraphs) ? config.namedGraphs(yasqe) : config.namedGraphs;
  if (namedGraphs && namedGraphs.length > 0) {
    let argName = queryMode === "query" ? "named-graph-uri" : "using-named-graph-uri ";
    data[argName] = namedGraphs;
  }
  /**
   * add default graphs to ajax config
   */
  const defaultGraphs = isFunction(config.defaultGraphs) ? config.defaultGraphs(yasqe) : config.defaultGraphs;
  if (defaultGraphs && defaultGraphs.length > 0) {
    let argName = queryMode == "query" ? "default-graph-uri" : "using-graph-uri ";
    data[argName] = defaultGraphs;
  }

  /**
   * add additional request args
   */
  const args = isFunction(config.args) ? config.args(yasqe) : config.args;
  if (args && args.length > 0)
    merge(
      data,
      args.reduce((argsObject: { [key: string]: string[] }, arg) => {
        argsObject[arg.name] ? argsObject[arg.name].push(arg.value) : (argsObject[arg.name] = [arg.value]);
        return argsObject;
      }, {}),
    );

  return data;
}
export function getAcceptHeader(yasqe: Yasqe, _config: Config["requestConfig"]) {
  const config: RequestConfig<Yasqe> = getRequestConfigSettings(yasqe, _config);
  var acceptHeader = null;
  if (yasqe.getQueryMode() == "update") {
    acceptHeader = isFunction(config.acceptHeaderUpdate) ? config.acceptHeaderUpdate(yasqe) : config.acceptHeaderUpdate;
  } else {
    var qType = yasqe.getQueryType();
    if (qType == "DESCRIBE" || qType == "CONSTRUCT") {
      acceptHeader = isFunction(config.acceptHeaderGraph) ? config.acceptHeaderGraph(yasqe) : config.acceptHeaderGraph;
    } else {
      acceptHeader = isFunction(config.acceptHeaderSelect)
        ? config.acceptHeaderSelect(yasqe)
        : config.acceptHeaderSelect;
    }
  }
  return acceptHeader;
}
/**
 * Helper to normalize URL for command-line tools
 */
function normalizeUrl(url: string): string {
  if (url.indexOf("http") !== 0) {
    // Relative or absolute URL - add domain, schema, etc
    let fullUrl = `${window.location.protocol}//${window.location.host}`;
    if (url.indexOf("/") === 0) {
      // Absolute path
      fullUrl += url;
    } else {
      // Relative path - ensure proper path joining
      let basePath = window.location.pathname;
      // If pathname does not end with "/", treat it as a file and use its directory
      if (!basePath.endsWith("/")) {
        const lastSlashIndex = basePath.lastIndexOf("/");
        basePath = lastSlashIndex >= 0 ? basePath.substring(0, lastSlashIndex + 1) : "/";
      }
      fullUrl += basePath + url;
    }
    return fullUrl;
  }
  return url;
}

/**
 * Check if ajax config contains authentication credentials
 */
export function hasAuthenticationCredentials(ajaxConfig: PopulatedAjaxConfig): boolean {
  if (!ajaxConfig) return false;

  // Check for Authorization header (Bearer, Basic, OAuth2)
  if (ajaxConfig.headers && ajaxConfig.headers["Authorization"]) {
    return true;
  }

  // Check for API Key headers - use more specific patterns to avoid false positives
  if (ajaxConfig.headers) {
    for (const headerName in ajaxConfig.headers) {
      const lowerHeader = headerName.toLowerCase();
      // Match common authentication header patterns with stricter rules to avoid false positives
      // Only match headers that are clearly authentication-related
      if (
        lowerHeader.startsWith("x-api-key") ||
        lowerHeader.startsWith("x-auth-") ||
        lowerHeader === "apikey" ||
        lowerHeader === "api-key" ||
        // Only match token headers that end with "token" or have "auth" in the middle
        (lowerHeader.endsWith("-token") && lowerHeader.startsWith("x-")) ||
        (lowerHeader.includes("-auth-") && lowerHeader.includes("token"))
      ) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Escape single quotes for shell commands by replacing ' with '\''
 */
function escapeShellString(str: string): string {
  return str.replace(/'/g, "'\\''");
}

/**
 * Generate cURL command string
 */
export function getAsCurlString(yasqe: Yasqe, _config?: Config["requestConfig"]) {
  let ajaxConfig = getAjaxConfig(yasqe, getRequestConfigSettings(yasqe, _config));
  if (!ajaxConfig) return "";

  let url = normalizeUrl(ajaxConfig.url);
  const segments: string[] = ["curl"];

  if (ajaxConfig.reqMethod === "GET") {
    url += `?${queryString.stringify(ajaxConfig.args)}`;
    segments.push(`'${escapeShellString(url)}'`);
  } else if (ajaxConfig.reqMethod === "POST") {
    segments.push(`'${escapeShellString(url)}'`);
    const data = queryString.stringify(ajaxConfig.args);
    segments.push("--data", `'${escapeShellString(data)}'`);
  } else {
    console.warn("Unexpected request-method", ajaxConfig.reqMethod);
    segments.push(`'${escapeShellString(url)}'`);
  }

  segments.push("-X", ajaxConfig.reqMethod);

  // Add Accept header if present
  if (ajaxConfig.accept) {
    segments.push("-H", `'Accept: ${escapeShellString(ajaxConfig.accept)}'`);
  }

  for (const header in ajaxConfig.headers) {
    segments.push("-H", `'${escapeShellString(header)}: ${escapeShellString(ajaxConfig.headers[header])}'`);
  }

  return segments.join(" \\\n  ");
}

/**
 * Escape PowerShell string by handling special characters
 */
function escapePowerShellString(str: string): string {
  // Escape backtick, double quote, and dollar sign
  return str.replace(/`/g, "``").replace(/"/g, '`"').replace(/\$/g, "`$");
}

/**
 * Generate PowerShell command string
 */
export function getAsPowerShellString(yasqe: Yasqe, _config?: Config["requestConfig"]): string {
  let ajaxConfig = getAjaxConfig(yasqe, getRequestConfigSettings(yasqe, _config));
  if (!ajaxConfig) return "";

  let url = normalizeUrl(ajaxConfig.url);
  const lines: string[] = [];

  // Determine output file extension based on Accept header
  const acceptHeader = ajaxConfig.accept;
  let fileExtension = "json"; // default
  if (acceptHeader) {
    if (acceptHeader.includes("text/turtle") || acceptHeader.includes("application/x-turtle")) {
      fileExtension = "ttl";
    } else if (acceptHeader.includes("application/rdf+xml")) {
      fileExtension = "xml";
    } else if (acceptHeader.includes("application/n-triples")) {
      fileExtension = "nt";
    } else if (acceptHeader.includes("application/ld+json")) {
      fileExtension = "jsonld";
    } else if (acceptHeader.includes("text/csv")) {
      fileExtension = "csv";
    } else if (acceptHeader.includes("text/tab-separated-values")) {
      fileExtension = "tsv";
    }
  }

  // Build headers object, including Accept header
  const headersLines: string[] = [];
  if (acceptHeader) {
    headersLines.push(`    "Accept" = "${escapePowerShellString(acceptHeader)}"`);
  }
  for (const header in ajaxConfig.headers) {
    headersLines.push(
      `    "${escapePowerShellString(header)}" = "${escapePowerShellString(ajaxConfig.headers[header])}"`,
    );
  }

  if (ajaxConfig.reqMethod === "GET") {
    url += `?${queryString.stringify(ajaxConfig.args)}`;
    lines.push("$params = @{");
    lines.push(`    Uri = "${escapePowerShellString(url)}"`);
    lines.push(`    Method = "Get"`);
    if (headersLines.length > 0) {
      lines.push("    Headers = @{");
      lines.push(headersLines.join("\n"));
      lines.push("    }");
    }
    lines.push(`    OutFile = "sparql-generated.${fileExtension}"`);
    lines.push("}");
  } else if (ajaxConfig.reqMethod === "POST") {
    // Extract the query/update parameter and other parameters separately
    // Determine the query parameter name first (query takes precedence over update)
    const queryParamName = ajaxConfig.args.query !== undefined ? "query" : "update";
    const queryParam = ajaxConfig.args[queryParamName];

    const otherArgs: RequestArgs = {};
    for (const key in ajaxConfig.args) {
      if (key !== "query" && key !== "update") {
        otherArgs[key] = ajaxConfig.args[key];
      }
    }

    // Build the query string using here-string for easy editing
    if (queryParam) {
      // Handle both string and string[] cases - use first element if array
      const queryText = Array.isArray(queryParam) ? queryParam[0] : queryParam;
      lines.push(`$${queryParamName} = @"`);
      lines.push(queryText);
      lines.push(`"@`);
      lines.push("");
    }

    // Build the body with the query variable and any other parameters
    // The query must be URL-encoded for application/x-www-form-urlencoded
    let bodyExpression: string;
    const urlEncodeExpr = `[System.Net.WebUtility]::UrlEncode($${queryParamName})`;
    if (queryParam && Object.keys(otherArgs).length > 0) {
      // Both query variable and other args
      const otherArgsString = queryString.stringify(otherArgs);
      bodyExpression = `"${queryParamName}=$(${urlEncodeExpr})&${escapePowerShellString(otherArgsString)}"`;
    } else if (queryParam) {
      // Only query variable - use subexpression for URL encoding
      bodyExpression = `"${queryParamName}=$(${urlEncodeExpr})"`;
    } else {
      // Only other args (shouldn't happen, but handle it)
      const otherArgsString = queryString.stringify(otherArgs);
      bodyExpression = `"${escapePowerShellString(otherArgsString)}"`;
    }

    lines.push("$params = @{");
    lines.push(`    Uri = "${escapePowerShellString(url)}"`);
    lines.push(`    Method = "Post"`);
    if (headersLines.length > 0) {
      lines.push("    Headers = @{");
      lines.push(headersLines.join("\n"));
      lines.push("    }");
    }
    lines.push(`    ContentType = "application/x-www-form-urlencoded"`);
    lines.push(`    Body = ${bodyExpression}`);
    lines.push(`    OutFile = "sparql-generated.${fileExtension}"`);
    lines.push("}");
  } else {
    // Handle other methods (PUT, DELETE, etc.)
    console.warn("Unexpected request-method for PowerShell", ajaxConfig.reqMethod);
    const body = queryString.stringify(ajaxConfig.args);
    lines.push("$params = @{");
    lines.push(`    Uri = "${url}"`);
    lines.push(`    Method = "${ajaxConfig.reqMethod}"`);
    if (headersLines.length > 0) {
      lines.push("    Headers = @{");
      lines.push(headersLines.join("\n"));
      lines.push("    }");
    }
    if (body) {
      lines.push(`    ContentType = "application/x-www-form-urlencoded"`);
      lines.push(`    Body = "${body.replace(/"/g, '`"')}"`);
    }
    lines.push(`    OutFile = "sparql-generated.${fileExtension}"`);
    lines.push("}");
  }

  lines.push("");
  lines.push("Invoke-WebRequest @params");

  return lines.join("\n");
}

/**
 * Generate wget command string
 */
export function getAsWgetString(yasqe: Yasqe, _config?: Config["requestConfig"]): string {
  let ajaxConfig = getAjaxConfig(yasqe, getRequestConfigSettings(yasqe, _config));
  if (!ajaxConfig) return "";

  let url = normalizeUrl(ajaxConfig.url);
  const segments: string[] = ["wget"];

  if (ajaxConfig.reqMethod === "GET") {
    url += `?${queryString.stringify(ajaxConfig.args)}`;
    segments.push(`'${escapeShellString(url)}'`);
  } else if (ajaxConfig.reqMethod === "POST") {
    segments.push(`'${escapeShellString(url)}'`);
    const data = queryString.stringify(ajaxConfig.args);
    segments.push("--post-data", `'${escapeShellString(data)}'`);
  } else {
    // Handle other methods
    console.warn("Unexpected request-method for wget", ajaxConfig.reqMethod);
    segments.push(`'${escapeShellString(url)}'`);
    const data = queryString.stringify(ajaxConfig.args);
    if (data) {
      segments.push("--post-data", `'${escapeShellString(data)}'`);
    }
  }

  // Only add --method for non-GET requests
  if (ajaxConfig.reqMethod !== "GET") {
    segments.push("--method", ajaxConfig.reqMethod);
  }

  // Add Accept header if present
  if (ajaxConfig.accept) {
    segments.push("--header", `'Accept: ${escapeShellString(ajaxConfig.accept)}'`);
  }

  for (const header in ajaxConfig.headers) {
    segments.push("--header", `'${escapeShellString(header)}: ${escapeShellString(ajaxConfig.headers[header])}'`);
  }

  segments.push("-O -");

  return segments.join(" \\\n  ");
}
