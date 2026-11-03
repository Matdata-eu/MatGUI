import type { WorkspaceConfig } from "./types";

export interface WorkspaceValidationResult {
  valid: boolean;
  errors: string[];
}

function isNonEmpty(value: string | undefined): boolean {
  return !!value && value.trim().length > 0;
}

export function validateWorkspaceConfig(config: WorkspaceConfig): WorkspaceValidationResult {
  const errors: string[] = [];

  if (!isNonEmpty(config.id)) errors.push("Workspace id is required");
  if (!isNonEmpty(config.label)) errors.push("Workspace label is required");

  if (config.type === "git") {
    if (!isNonEmpty(config.remoteUrl)) errors.push("Git remote URL is required");
    // rootPath can be empty string to mean repo root
    if (typeof config.rootPath !== "string") errors.push("Git rootPath must be a string");
    if (!config.auth || config.auth.type !== "pat") errors.push("Git auth is required");

    const anyCfg = config as any;
    if (anyCfg.provider && !["auto", "github", "gitlab", "bitbucket", "gitea"].includes(anyCfg.provider)) {
      errors.push("Git provider must be one of: auto, github, gitlab, bitbucket, gitea");
    }

    if (anyCfg.apiBaseUrl && typeof anyCfg.apiBaseUrl !== "string") {
      errors.push("Git apiBaseUrl must be a string");
    }
  }

  if (config.type === "http") {
    if (!isNonEmpty(config.manifestUrl)) {
      errors.push("Web workspace URL (workspace.json) is required");
    } else {
      try {
        const url = new URL(config.manifestUrl.trim());
        if (url.protocol !== "https:" && url.protocol !== "http:") errors.push("Web workspace URL must be http(s)");
      } catch {
        errors.push("Web workspace URL is not a valid URL");
      }
    }
  }

  if (config.type === "sparql") {
    if (!isNonEmpty(config.endpoint)) errors.push("SPARQL endpoint is required");
    if (!isNonEmpty(config.workspaceIri)) errors.push("Workspace IRI is required");
  }

  return { valid: errors.length === 0, errors };
}
