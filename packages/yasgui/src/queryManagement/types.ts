export type BackendType = "git" | "sparql" | "http";

export interface WorkspaceConfigBase {
  id: string;
  label: string;
  description?: string;
  type: BackendType;
  /**
   * When true, queries can be browsed and opened from this workspace, but never saved, updated,
   * renamed, moved or deleted in it. Edits to a query opened from it can only be saved to another workspace.
   */
  readOnly?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface GitWorkspaceAuthPat {
  type: "pat";
  token: string;
  username?: string;
}

export interface GitWorkspaceConfig extends WorkspaceConfigBase {
  type: "git";
  remoteUrl: string;
  branch: string;
  rootPath: string;
  auth: GitWorkspaceAuthPat;
  /** Optional hint for selecting a git provider client. Defaults to auto-detection. */
  provider?: "auto" | "github" | "gitlab" | "bitbucket" | "gitea";
  /** Optional override for provider API base URL (useful for self-hosted/enterprise instances). */
  apiBaseUrl?: string;
}

export interface SparqlWorkspaceConfig extends WorkspaceConfigBase {
  type: "sparql";
  endpoint: string;
  workspaceIri: string;
  defaultGraph?: string;
}

/**
 * A read-only workspace published as plain files on a web server: a `workspace.json` manifest
 * that lists `.rq` files. Shown as "Web" in the settings.
 */
export interface HttpWorkspaceConfig extends WorkspaceConfigBase {
  type: "http";
  /** URL of the `workspace.json` manifest. Query URLs in it are resolved relative to this URL. */
  manifestUrl: string;
}

export type WorkspaceConfig = GitWorkspaceConfig | SparqlWorkspaceConfig | HttpWorkspaceConfig;

export interface FolderEntry {
  kind: "folder" | "query";
  id: string;
  label: string;
  parentId?: string;
}

export interface ReadResult {
  queryText: string;
  versionTag?: string;
  associatedEndpoint?: string;
  description?: string;
}

export interface VersionInfo {
  id: string;
  createdAt: string;
  author?: string;
  message?: string;
}

export interface WriteQueryOptions {
  message?: string;
  expectedVersionTag?: string;
  /** Optional label for backends where the query ID is not derived from the label (e.g., SPARQL workspace). */
  label?: string;
  /** Optional folder id/path for backends where folder is not encoded in the query ID (e.g., SPARQL workspace). */
  folderId?: string;
  /** Optional associated endpoint for this saved version (e.g., SPARQL query execution endpoint). */
  associatedEndpoint?: string;
}

/** Git and web workspaces: the path of the query file (for a web workspace, relative to the manifest, or an absolute URL) */
export type GitQueryRef = { path: string };
export type SparqlQueryRef = { managedQueryIri: string };
export type QueryRef = GitQueryRef | SparqlQueryRef;

export type GitVersionRef = { commitSha?: string };
export type SparqlVersionRef = { managedQueryVersionIri: string };
export type VersionRef = GitVersionRef | SparqlVersionRef;

export interface ManagedTabMetadata {
  workspaceId: string;
  backendType: BackendType;
  queryRef: QueryRef;
  lastSavedVersionRef?: VersionRef;
  lastSavedTextHash?: string;
}
