import type { WorkspaceConfig } from "./types";

export function isWorkspaceReadOnly(workspace: WorkspaceConfig | undefined): boolean {
  return !!workspace?.readOnly;
}

export function getWritableWorkspaces(workspaces: WorkspaceConfig[]): WorkspaceConfig[] {
  return workspaces.filter((w) => !isWorkspaceReadOnly(w));
}
