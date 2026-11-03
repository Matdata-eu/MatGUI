/**
 * The `workspace.json` manifest of a web (HTTP) workspace, and the `#+ key: value` header of its query files.
 *
 * ```json
 * {
 *   "label": "Example queries",
 *   "description": "Optional",
 *   "endpoints": { "era": "https://graph.data.era.europa.eu/repositories/rinf-plus" },
 *   "folders": { "era": { "label": "ERA", "endpoint": "era" } },
 *   "queries": [
 *     "./era/operational-points.rq",
 *     { "url": "./other/example.rq", "name": "…", "description": "…", "endpoint": "era", "folder": "era" }
 *   ]
 * }
 * ```
 */

export interface HttpWorkspaceManifestFolder {
  label?: string;
  description?: string;
  /** Default endpoint (alias or URL) for the queries in this folder and its sub-folders */
  endpoint?: string;
}

export interface HttpWorkspaceManifestQuery {
  url: string;
  name?: string;
  description?: string;
  endpoint?: string;
  folder?: string;
}

export interface HttpWorkspaceManifest {
  label?: string;
  description?: string;
  endpoints?: Record<string, string>;
  folders?: Record<string, HttpWorkspaceManifestFolder>;
  queries: Array<string | HttpWorkspaceManifestQuery>;
}

/** A query of the manifest, with its URL resolved and its folder known */
export interface HttpWorkspaceQueryEntry {
  /** Query id: the path relative to the manifest's directory, or the absolute URL for a file elsewhere */
  id: string;
  /** Absolute URL of the query file */
  url: string;
  /** Folder path ("" for the root) */
  folder: string;
  /** Name from the manifest (overrides the file header) */
  name?: string;
  /** Description from the manifest (overrides the file header) */
  description?: string;
  /** Endpoint (alias or URL) from the manifest (overrides the file header) */
  endpoint?: string;
}

export interface ParsedHttpWorkspace {
  label?: string;
  description?: string;
  endpoints: Record<string, string>;
  folders: Record<string, HttpWorkspaceManifestFolder>;
  queries: HttpWorkspaceQueryEntry[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

export function normalizeFolderPath(path: string | undefined): string {
  return (path || "")
    .split("/")
    .map((p) => p.trim())
    .filter((p) => p && p !== ".")
    .join("/");
}

function dirnameOf(path: string): string {
  const parts = path.split("/");
  parts.pop();
  return normalizeFolderPath(parts.join("/"));
}

/** The directory URL of a manifest URL, with a trailing slash */
function baseDirectoryUrl(manifestUrl: string): string {
  const url = new URL(manifestUrl);
  url.search = "";
  url.hash = "";
  url.pathname = url.pathname.replace(/[^/]*$/, "");
  return url.toString();
}

/**
 * Parse and validate a manifest. Throws an Error with a user-facing message when it is not usable.
 * Unknown keys are ignored, so the manifest can carry extra data for other tools.
 */
export function parseHttpWorkspaceManifest(json: unknown, manifestUrl: string): ParsedHttpWorkspace {
  if (!isRecord(json)) throw new Error("workspace.json must contain a JSON object");
  if (!Array.isArray(json.queries)) {
    throw new Error('workspace.json must have a "queries" list with the URLs of the query files');
  }

  const base = baseDirectoryUrl(manifestUrl);

  const endpoints: Record<string, string> = {};
  if (isRecord(json.endpoints)) {
    for (const [alias, url] of Object.entries(json.endpoints)) {
      if (typeof url === "string" && url.trim()) endpoints[alias] = url.trim();
    }
  }

  const folders: Record<string, HttpWorkspaceManifestFolder> = {};
  if (isRecord(json.folders)) {
    for (const [path, value] of Object.entries(json.folders)) {
      const key = normalizeFolderPath(path);
      if (!key || !isRecord(value)) continue;
      folders[key] = {
        label: optionalString(value.label),
        description: optionalString(value.description),
        endpoint: optionalString(value.endpoint),
      };
    }
  }

  const queries: HttpWorkspaceQueryEntry[] = [];
  const seen = new Set<string>();
  json.queries.forEach((raw, index) => {
    const item: Partial<HttpWorkspaceManifestQuery> | undefined =
      typeof raw === "string" ? { url: raw } : isRecord(raw) ? (raw as Partial<HttpWorkspaceManifestQuery>) : undefined;
    const href = optionalString(item?.url);
    if (!item || !href) throw new Error(`Query ${index + 1} in workspace.json has no "url"`);

    let absolute: URL;
    try {
      absolute = new URL(href, base);
    } catch {
      throw new Error(`Query ${index + 1} in workspace.json has an invalid url: ${href}`);
    }
    if (absolute.protocol !== "https:" && absolute.protocol !== "http:") {
      throw new Error(`Query ${index + 1} in workspace.json must be an http(s) URL: ${href}`);
    }
    const url = absolute.toString();
    const id = url.startsWith(base) ? decodeURIComponent(url.slice(base.length)) : url;
    if (seen.has(id)) return;
    seen.add(id);

    const folder =
      item.folder !== undefined
        ? normalizeFolderPath(String(item.folder))
        : id === url
          ? "" // A file outside the manifest's directory goes in the root
          : dirnameOf(id);

    queries.push({
      id,
      url,
      folder,
      name: optionalString(item.name),
      description: optionalString(item.description),
      endpoint: optionalString(item.endpoint),
    });
  });

  return {
    label: optionalString(json.label),
    description: optionalString(json.description),
    endpoints,
    folders,
    queries,
  };
}

export interface ParsedQueryFile {
  /** Header values (keys in lower case) */
  meta: Record<string, string>;
  /** Query text without the header lines */
  queryText: string;
}

const HEADER_RE = /^#\+\s*([A-Za-z_-]+)\s*:\s*(.*?)\s*$/;

/**
 * Split the leading `#+ key: value` lines (the convention grlc uses) from a query file.
 * Only the lines at the very top count; the rest of the file is the query.
 */
export function parseQueryFile(text: string): ParsedQueryFile {
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  const meta: Record<string, string> = {};
  let start = 0;
  while (start < lines.length) {
    const match = HEADER_RE.exec(lines[start]);
    if (!match) break;
    meta[match[1].toLowerCase()] = match[2];
    start++;
  }
  if (start === 0) return { meta, queryText: text };
  const queryText = lines.slice(start).join("\n").replace(/^\n+/, "");
  return { meta, queryText };
}

/** Resolve an endpoint alias of the manifest; anything else is returned as is */
export function resolveEndpointAlias(
  endpoint: string | undefined,
  endpoints: Record<string, string>,
): string | undefined {
  const value = endpoint?.trim();
  if (!value) return undefined;
  return endpoints[value] || value;
}

/** The default endpoint of a folder: its own, else the nearest parent's */
export function folderDefaultEndpoint(
  folder: string,
  folders: Record<string, HttpWorkspaceManifestFolder>,
): string | undefined {
  const parts = normalizeFolderPath(folder).split("/").filter(Boolean);
  while (parts.length) {
    const endpoint = folders[parts.join("/")]?.endpoint;
    if (endpoint) return endpoint;
    parts.pop();
  }
  return undefined;
}

/** A readable name for a query file without a name: "operational-points.rq" → "operational points" */
export function nameFromFileUrl(url: string): string {
  const last = url.split(/[?#]/)[0].split("/").filter(Boolean).pop() || url;
  let decoded = last;
  try {
    decoded = decodeURIComponent(last);
  } catch {
    // keep as is
  }
  return (
    decoded
      .replace(/\.(rq|sparql|txt)$/i, "")
      .replace(/[-_]+/g, " ")
      .trim() || decoded
  );
}
