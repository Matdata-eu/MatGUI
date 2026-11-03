import type { WorkspaceBackend } from "./backends/WorkspaceBackend";
import type { BackendType, ManagedTabMetadata } from "./types";
import { queryRefFromId, versionRefFromTag } from "./queryRefs";
import { asWorkspaceBackendError } from "./backends/errors";
import { hashQueryText } from "./textHash";
import { normalizeQueryFilename } from "./normalizeQueryFilename";

export interface SaveManagedQueryInput {
  backend: WorkspaceBackend;
  backendType: BackendType;
  workspaceId: string;
  /** Required for SPARQL workspaces to mint immutable query/version IRIs. */
  workspaceIri?: string;
  queryText: string;
  folderPath?: string;
  /** Tab/query label (used as SPARQL rdfs:label). */
  name?: string;
  filename: string;
  /** Optional SPARQL query execution endpoint to store on the version (sparql backends only). */
  associatedEndpoint?: string;
  message?: string;
  expectedVersionTag?: string;
}

export interface SaveManagedQueryResult {
  queryId: string;
  managedMetadata: ManagedTabMetadata;
}

function normalizeFolderPath(folderPath: string | undefined): string {
  if (!folderPath) return "";
  const trimmed = folderPath.trim();
  if (!trimmed) return "";
  return trimmed.replace(/^\/+/, "").replace(/\/+$/, "");
}

function buildQueryId(folderPath: string | undefined, filename: string): string {
  const normalizedFolder = normalizeFolderPath(folderPath);
  const normalizedFilename = normalizeQueryFilename(filename);
  return normalizedFolder ? `${normalizedFolder}/${normalizedFilename}` : normalizedFilename;
}

function uuidV4(): string {
  const cryptoObj = (globalThis as any).crypto as Crypto | undefined;
  if (cryptoObj?.randomUUID) return cryptoObj.randomUUID();
  // RFC4122 v4 fallback (best-effort)
  const rnds = new Uint8Array(16);
  if (cryptoObj?.getRandomValues) {
    cryptoObj.getRandomValues(rnds);
  } else {
    for (let i = 0; i < rnds.length; i++) rnds[i] = Math.floor(Math.random() * 256);
  }
  rnds[6] = (rnds[6] & 0x0f) | 0x40;
  rnds[8] = (rnds[8] & 0x3f) | 0x80;
  const hex = Array.from(rnds, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function mintSparqlManagedQueryIri(workspaceIri: string): string {
  return `${workspaceIri.trim()}_mq_${uuidV4()}`;
}

export async function saveManagedQuery(input: SaveManagedQueryInput): Promise<SaveManagedQueryResult> {
  const folderId = normalizeFolderPath(input.folderPath);
  if (input.backendType === "http") {
    throw new Error("Web workspaces are read-only");
  }
  const queryId = input.backendType === "git" ? buildQueryId(input.folderPath, input.filename) : "";

  if (input.backendType === "sparql" && !input.workspaceIri?.trim()) {
    throw new Error("workspaceIri is required for SPARQL workspaces");
  }

  const label = (input.name || "").trim();
  if (input.backendType === "sparql" && !label) {
    throw new Error("name is required for SPARQL workspaces");
  }

  const resolvedQueryId = await (async () => {
    if (input.backendType !== "sparql") return queryId;

    // Overwrite behavior: if a query with the same label already exists in this folder,
    // write a new version to that managed query instead of creating a duplicate.
    try {
      const entries = await input.backend.listFolder(folderId || undefined);
      const existing = entries.find(
        (e) => e.kind === "query" && e.label.trim().toLowerCase() === label.trim().toLowerCase(),
      );
      if (existing?.id) return existing.id;
    } catch {
      // If listing fails for any reason, fall back to creating a new managed query.
    }

    return mintSparqlManagedQueryIri(input.workspaceIri || "");
  })();

  try {
    await input.backend.writeQuery(resolvedQueryId, input.queryText, {
      message: input.message,
      expectedVersionTag: input.expectedVersionTag,
      ...(input.backendType === "sparql"
        ? {
            label: label || undefined,
            folderId: folderId || undefined,
            associatedEndpoint: input.associatedEndpoint || undefined,
          }
        : {}),
    });
  } catch (e) {
    const err = asWorkspaceBackendError(e);
    if (err.code === "CONFLICT") {
      const extra =
        input.backendType === "git"
          ? " Resolve the conflict externally (e.g., pull/rebase/merge) and then try saving again."
          : " Refresh the query and try again.";
      throw new Error(`Save conflict.${extra}`);
    }
    throw err;
  }

  const read = await input.backend.readQuery(resolvedQueryId);
  const lastSavedTextHash = hashQueryText(read.queryText);

  const managedMetadata: ManagedTabMetadata = {
    workspaceId: input.workspaceId,
    backendType: input.backendType,
    queryRef: queryRefFromId(input.backendType, resolvedQueryId),
    lastSavedVersionRef: versionRefFromTag(input.backendType, read.versionTag),
    lastSavedTextHash,
  };

  return { queryId: resolvedQueryId, managedMetadata };
}
