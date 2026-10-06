import type { FolderEntry, ReadResult, VersionInfo, WriteQueryOptions } from "../types";
import type { WorkspaceBackend } from "./WorkspaceBackend";
import { WorkspaceBackendError } from "./errors";

/**
 * Wraps a backend so that only read operations are exposed.
 * Optional write operations (rename/move/delete) are left undefined so the UI hides them,
 * and `writeQuery` always rejects.
 */
export default class ReadOnlyWorkspaceBackend implements WorkspaceBackend {
  public readonly type;

  constructor(private readonly inner: WorkspaceBackend) {
    this.type = inner.type;
    if (inner.searchByName) this.searchByName = (query) => inner.searchByName!(query);
    if (inner.getQueryUri) this.getQueryUri = (queryId) => inner.getQueryUri!(queryId);
  }

  searchByName?: (query: string) => Promise<FolderEntry[]>;

  getQueryUri?: (queryId: string) => string | undefined;

  validateAccess(): Promise<void> {
    return this.inner.validateAccess();
  }

  listFolder(folderId?: string): Promise<FolderEntry[]> {
    return this.inner.listFolder(folderId);
  }

  readQuery(queryId: string): Promise<ReadResult> {
    return this.inner.readQuery(queryId);
  }

  listVersions(queryId: string): Promise<VersionInfo[]> {
    return this.inner.listVersions(queryId);
  }

  readVersion(queryId: string, versionId: string): Promise<ReadResult> {
    return this.inner.readVersion(queryId, versionId);
  }

  async writeQuery(_queryId: string, _queryText: string, _options?: WriteQueryOptions): Promise<void> {
    throw new WorkspaceBackendError("FORBIDDEN", "This workspace is read-only");
  }
}
