import type { HttpWorkspaceConfig, WorkspaceConfig } from "./types";

/** The link parameter that names the workspace.json of a web workspace to add: `?workspace=<url>` */
export const WORKSPACE_LINK_PARAM = "workspace";

/**
 * The web workspace URL a page was opened with, from its query string or its hash.
 * Only absolute http(s) URLs count.
 */
export function getWorkspaceUrlFromLink(href: string): string | undefined {
  let url: URL;
  try {
    url = new URL(href);
  } catch {
    return undefined;
  }
  const fromHash = url.hash.length > 1 ? new URLSearchParams(url.hash.slice(1)).get(WORKSPACE_LINK_PARAM) : null;
  const value = (url.searchParams.get(WORKSPACE_LINK_PARAM) || fromHash || "").trim();
  if (!value) return undefined;
  try {
    const target = new URL(value);
    if (target.protocol !== "https:" && target.protocol !== "http:") return undefined;
    return target.toString();
  } catch {
    return undefined;
  }
}

/** The page URL without the workspace parameter, so a reload does not ask again */
export function removeWorkspaceParamFromLink(href: string): string {
  const url = new URL(href);
  url.searchParams.delete(WORKSPACE_LINK_PARAM);
  if (url.hash.length > 1) {
    const hashParams = new URLSearchParams(url.hash.slice(1));
    if (hashParams.has(WORKSPACE_LINK_PARAM)) {
      hashParams.delete(WORKSPACE_LINK_PARAM);
      const rest = hashParams.toString();
      url.hash = rest ? `#${rest}` : "";
    }
  }
  return url.toString();
}

/** A link to this page that adds the web workspace for whoever opens it */
export function createWorkspaceLink(pageHref: string, manifestUrl: string): string {
  const url = new URL(pageHref);
  url.hash = "";
  url.searchParams.set(WORKSPACE_LINK_PARAM, manifestUrl);
  return url.toString();
}

/** The configured web workspace for a workspace.json URL, if there is one */
export function findWebWorkspace(workspaces: WorkspaceConfig[], manifestUrl: string): HttpWorkspaceConfig | undefined {
  const normalize = (u: string) => {
    try {
      return new URL(u.trim()).toString();
    } catch {
      return u.trim();
    }
  };
  const target = normalize(manifestUrl);
  return workspaces.find((w): w is HttpWorkspaceConfig => w.type === "http" && normalize(w.manifestUrl) === target);
}
