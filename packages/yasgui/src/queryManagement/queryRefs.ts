import type { BackendType, ManagedTabMetadata, QueryRef, VersionRef } from "./types";

/**
 * The reference that is stored in a tab for a query of a workspace.
 * Git and web workspaces identify a query by its path, SPARQL workspaces by the managed query IRI.
 */
export function queryRefFromId(backendType: BackendType, queryId: string): QueryRef {
  if (backendType === "sparql") return { managedQueryIri: queryId };
  return { path: queryId };
}

/** The query id (path or managed query IRI) stored in a tab's metadata */
export function queryIdFromMetadata(meta: ManagedTabMetadata): string | undefined {
  const ref = meta.queryRef as any;
  if (meta.backendType === "sparql") return ref?.managedQueryIri as string | undefined;
  return ref?.path as string | undefined;
}

/** The version reference for a version tag returned by a backend. Web workspaces have no versions. */
export function versionRefFromTag(backendType: BackendType, versionTag: string | undefined): VersionRef | undefined {
  if (!versionTag) return undefined;
  if (backendType === "git") return { commitSha: versionTag };
  if (backendType === "sparql") return { managedQueryVersionIri: versionTag };
  return undefined;
}

/** The version tag of a stored version reference, used for optimistic concurrency on save */
export function versionTagFromRef(backendType: BackendType, versionRef: VersionRef | undefined): string | undefined {
  if (!versionRef) return undefined;
  if (backendType === "git") return (versionRef as any)?.commitSha as string | undefined;
  if (backendType === "sparql") return (versionRef as any)?.managedQueryVersionIri as string | undefined;
  return undefined;
}
