import type { FolderEntry, HttpWorkspaceConfig, ReadResult, VersionInfo, WriteQueryOptions } from "../types";
import type { WorkspaceBackend } from "./WorkspaceBackend";
import { WorkspaceBackendError } from "./errors";
import {
  folderDefaultEndpoint,
  nameFromFileUrl,
  normalizeFolderPath,
  parseHttpWorkspaceManifest,
  parseQueryFile,
  resolveEndpointAlias,
  type HttpWorkspaceQueryEntry,
  type ParsedHttpWorkspace,
} from "./httpWorkspaceManifest";

/** How long a fetched manifest or query file is reused before it is fetched again */
const CACHE_TTL_MS = 60_000;

type CacheEntry<T> = { at: number; value: Promise<T> };

// Backends are created anew for every call of getWorkspaceBackend, so the cache lives at module level.
const manifestCache = new Map<string, CacheEntry<ParsedHttpWorkspace>>();
const fileCache = new Map<string, CacheEntry<string>>();

function cached<T>(cache: Map<string, CacheEntry<T>>, key: string, load: () => Promise<T>): Promise<T> {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.value;
  const value = load();
  cache.set(key, { at: Date.now(), value });
  // Never keep a failure: the next call tries again.
  value.catch(() => {
    if (cache.get(key)?.value === value) cache.delete(key);
  });
  return value;
}

/** Forget fetched manifests and query files, so the next read fetches them again */
export function clearHttpWorkspaceCache() {
  manifestCache.clear();
  fileCache.clear();
}

function isMixedContent(url: string): boolean {
  try {
    return (
      typeof window !== "undefined" &&
      window.location?.protocol === "https:" &&
      new URL(url, window.location.href).protocol === "http:"
    );
  } catch {
    return false;
  }
}

async function fetchText(url: string, what: string): Promise<string> {
  if (isMixedContent(url)) {
    throw new WorkspaceBackendError(
      "NETWORK_ERROR",
      `The ${what} is served over http, and browsers block it on an https page. Use an https URL: ${url}`,
    );
  }
  let res: Response;
  try {
    res = await fetch(url, { credentials: "omit", headers: { Accept: "application/json, text/plain, */*" } });
  } catch {
    throw new WorkspaceBackendError(
      "NETWORK_ERROR",
      `Could not load the ${what} (${url}). Check the URL, and that the web server allows cross-origin requests (CORS).`,
    );
  }
  if (res.status === 404 || res.status === 410) {
    throw new WorkspaceBackendError("NOT_FOUND", `The ${what} was not found (${url})`);
  }
  if (res.status === 401) throw new WorkspaceBackendError("AUTH_FAILED", `The ${what} needs a login (${url})`);
  if (res.status === 403) throw new WorkspaceBackendError("FORBIDDEN", `Access to the ${what} is forbidden (${url})`);
  if (res.status === 429) throw new WorkspaceBackendError("RATE_LIMITED", `Too many requests for the ${what} (${url})`);
  if (!res.ok) {
    throw new WorkspaceBackendError("UNKNOWN", `Could not load the ${what} (${url}): HTTP ${res.status}`);
  }
  return res.text();
}

/**
 * A read-only workspace published as plain files on a web server (GitHub Pages, any static host):
 * a `workspace.json` manifest that lists `.rq` files. See httpWorkspaceManifest.ts for the format.
 */
export default class HttpWorkspaceBackend implements WorkspaceBackend {
  public readonly type = "http" as const;

  constructor(private readonly config: HttpWorkspaceConfig) {}

  private loadManifest(): Promise<ParsedHttpWorkspace> {
    const manifestUrl = this.config.manifestUrl?.trim();
    if (!manifestUrl) return Promise.reject(new WorkspaceBackendError("NOT_FOUND", "No workspace.json URL configured"));
    return cached(manifestCache, manifestUrl, async () => {
      const text = await fetchText(manifestUrl, "workspace.json");
      let json: unknown;
      try {
        json = JSON.parse(text);
      } catch {
        throw new WorkspaceBackendError("UNKNOWN", `workspace.json is not valid JSON (${manifestUrl})`);
      }
      try {
        return parseHttpWorkspaceManifest(json, manifestUrl);
      } catch (e) {
        throw new WorkspaceBackendError("UNKNOWN", e instanceof Error ? e.message : String(e));
      }
    });
  }

  private loadFile(entry: HttpWorkspaceQueryEntry): Promise<string> {
    return cached(fileCache, entry.url, () => fetchText(entry.url, "query file"));
  }

  private async findEntry(queryId: string): Promise<{ manifest: ParsedHttpWorkspace; entry: HttpWorkspaceQueryEntry }> {
    const manifest = await this.loadManifest();
    const entry = manifest.queries.find((q) => q.id === queryId);
    if (!entry) throw new WorkspaceBackendError("NOT_FOUND", `Query not found: ${queryId}`);
    return { manifest, entry };
  }

  /** The name of a query: from the manifest, else the file header, else the file name */
  private async labelOf(entry: HttpWorkspaceQueryEntry): Promise<string> {
    if (entry.name) return entry.name;
    try {
      const { meta } = parseQueryFile(await this.loadFile(entry));
      if (meta.name?.trim()) return meta.name.trim();
    } catch {
      // A file that cannot be loaded is still listed; opening it shows the error.
    }
    return nameFromFileUrl(entry.url);
  }

  private async toQueryEntries(entries: HttpWorkspaceQueryEntry[]): Promise<FolderEntry[]> {
    return Promise.all(
      entries.map(
        async (q): Promise<FolderEntry> => ({
          kind: "query",
          id: q.id,
          label: await this.labelOf(q),
          parentId: q.folder || undefined,
        }),
      ),
    );
  }

  private folderLabel(manifest: ParsedHttpWorkspace, path: string): string {
    return manifest.folders[path]?.label || path.split("/").pop() || path;
  }

  async validateAccess(): Promise<void> {
    await this.loadManifest();
  }

  async listFolder(folderId?: string): Promise<FolderEntry[]> {
    const manifest = await this.loadManifest();
    const folder = normalizeFolderPath(folderId);
    const prefix = folder ? `${folder}/` : "";

    // Folders: every folder that holds a query, plus the folders named in the manifest
    const allFolders = new Set<string>();
    const addWithParents = (path: string) => {
      const parts = path.split("/").filter(Boolean);
      for (let i = 1; i <= parts.length; i++) allFolders.add(parts.slice(0, i).join("/"));
    };
    manifest.queries.forEach((q) => q.folder && addWithParents(q.folder));
    Object.keys(manifest.folders).forEach(addWithParents);

    const folders: FolderEntry[] = [];
    for (const path of allFolders) {
      if (!path.startsWith(prefix)) continue;
      const rest = path.slice(prefix.length);
      if (!rest || rest.includes("/")) continue;
      // Hide folders that are empty, all the way down
      if (!manifest.queries.some((q) => q.folder === path || q.folder.startsWith(`${path}/`))) continue;
      folders.push({
        kind: "folder",
        id: path,
        label: this.folderLabel(manifest, path),
        parentId: folder || undefined,
      });
    }

    const queries = await this.toQueryEntries(manifest.queries.filter((q) => q.folder === folder));

    const byLabel = (a: FolderEntry, b: FolderEntry) => a.label.localeCompare(b.label);
    return [...folders.sort(byLabel), ...queries.sort(byLabel)];
  }

  async searchByName(query: string): Promise<FolderEntry[]> {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const manifest = await this.loadManifest();
    const all = await this.toQueryEntries(manifest.queries);
    return all.filter((e) => e.label.toLowerCase().includes(q)).sort((a, b) => a.label.localeCompare(b.label));
  }

  async readQuery(queryId: string): Promise<ReadResult> {
    const { manifest, entry } = await this.findEntry(queryId);
    const { meta, queryText } = parseQueryFile(await this.loadFile(entry));
    const endpoint =
      entry.endpoint || meta.endpoint?.trim() || folderDefaultEndpoint(entry.folder, manifest.folders) || undefined;
    return {
      queryText,
      description: entry.description || meta.description?.trim() || undefined,
      associatedEndpoint: resolveEndpointAlias(endpoint, manifest.endpoints),
    };
  }

  async writeQuery(_queryId: string, _queryText: string, _options?: WriteQueryOptions): Promise<void> {
    throw new WorkspaceBackendError("FORBIDDEN", "Web workspaces are read-only");
  }

  async listVersions(_queryId: string): Promise<VersionInfo[]> {
    // Plain files have no history
    return [];
  }

  async readVersion(queryId: string, _versionId: string): Promise<ReadResult> {
    return this.readQuery(queryId);
  }

  getQueryUri(queryId: string): string | undefined {
    const manifestUrl = this.config.manifestUrl?.trim();
    if (!manifestUrl) return undefined;
    try {
      // Same resolution as the manifest parser: ids are relative to the manifest's directory.
      return new URL(queryId, manifestUrl).toString();
    } catch {
      return undefined;
    }
  }

  /** The label and description that the manifest gives the workspace, if any */
  async getManifestInfo(): Promise<{ label?: string; description?: string; queryCount: number }> {
    const manifest = await this.loadManifest();
    return { label: manifest.label, description: manifest.description, queryCount: manifest.queries.length };
  }
}
