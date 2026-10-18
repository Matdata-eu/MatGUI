import type { WorkspaceBackend } from "./backends/WorkspaceBackend";

export interface ManagedQueryListing {
  id: string;
  label: string;
  /** Labels of the folders that hold the query, from the root down */
  folders: string[];
}

/**
 * All queries of a workspace with the folders they are in, walking the folders breadth first.
 * Stops after `maxFolders` folders, so a huge workspace can't keep the caller waiting.
 */
export async function listManagedQueries(
  backend: Pick<WorkspaceBackend, "listFolder">,
  maxFolders = 200,
): Promise<ManagedQueryListing[]> {
  const queries: ManagedQueryListing[] = [];
  const seenQueries = new Set<string>();
  const visitedFolderIds = new Set<string>();
  const folderQueue: Array<{ id: string | undefined; path: string[] }> = [{ id: undefined, path: [] }];

  while (folderQueue.length > 0 && visitedFolderIds.size < maxFolders) {
    const folder = folderQueue.shift()!;
    const folderKey = folder.id ?? "__root__";
    if (visitedFolderIds.has(folderKey)) continue;
    visitedFolderIds.add(folderKey);

    const entries = await backend.listFolder(folder.id);
    for (const entry of entries) {
      if (entry.kind === "query") {
        if (seenQueries.has(entry.id)) continue;
        seenQueries.add(entry.id);
        queries.push({ id: entry.id, label: entry.label, folders: folder.path });
      } else if (!visitedFolderIds.has(entry.id)) {
        folderQueue.push({ id: entry.id, path: [...folder.path, entry.label] });
      }
    }
  }

  return queries;
}
