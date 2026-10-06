import type { WorkspaceConfig } from "../types";
import type { WorkspaceBackend } from "./WorkspaceBackend";
import GitWorkspaceBackend from "./GitWorkspaceBackend";
import SparqlWorkspaceBackend from "./SparqlWorkspaceBackend";
import ReadOnlyWorkspaceBackend from "./ReadOnlyWorkspaceBackend";
import { GithubProviderClient } from "./GithubProviderClient";
import { GitlabProviderClient } from "./GitlabProviderClient";
import { BitbucketProviderClient } from "./BitbucketProviderClient";
import { GiteaProviderClient } from "./GiteaProviderClient";
import type PersistentConfig from "../../PersistentConfig";
import type { EndpointConfig } from "../../index";
import * as OAuth2Utils from "../../OAuth2Utils";

const registeredBackends = new Map<string, WorkspaceBackend>();

export function registerWorkspaceBackend(workspaceId: string, backend: WorkspaceBackend) {
  registeredBackends.set(workspaceId, backend);
}

export function unregisterWorkspaceBackend(workspaceId: string) {
  registeredBackends.delete(workspaceId);
}

function base64Encode(value: string): string {
  // Browser: btoa; Node: Buffer
  if (typeof (globalThis as any).btoa === "function") return (globalThis as any).btoa(value);
  const buf = (globalThis as any).Buffer;
  if (buf && typeof buf.from === "function") return buf.from(value, "utf8").toString("base64");
  throw new Error("Base64 encoding not available in this environment");
}

function resolveSparqlAuthHeaders(persistentConfig: PersistentConfig | undefined, endpoint: string) {
  if (!persistentConfig) return undefined;
  const cfg: EndpointConfig | undefined = persistentConfig.getEndpointConfig(endpoint);
  const auth = cfg?.authentication;
  if (!auth) return undefined;

  if (auth.type === "basic") {
    const token = base64Encode(`${auth.username}:${auth.password}`);
    return { Authorization: `Basic ${token}` };
  }

  if (auth.type === "bearer") {
    return { Authorization: `Bearer ${auth.token}` };
  }

  if (auth.type === "apiKey") {
    return { [auth.headerName]: auth.apiKey };
  }

  if (auth.type === "oauth2") {
    const token = auth.accessToken || auth.idToken;
    if (!token) return undefined;
    return { Authorization: `Bearer ${token}` };
  }

  return undefined;
}

async function resolveSparqlAuthHeadersWithRefresh(persistentConfig: PersistentConfig, endpoint: string) {
  const cfg: EndpointConfig | undefined = persistentConfig.getEndpointConfig(endpoint);
  const auth = cfg?.authentication;
  if (!auth) return undefined;

  if (auth.type === "oauth2") {
    if (OAuth2Utils.isTokenExpired(auth.tokenExpiry)) {
      if (auth.refreshToken) {
        try {
          const tokenResponse = await OAuth2Utils.refreshOAuth2Token(
            {
              clientId: auth.clientId,
              tokenEndpoint: auth.tokenEndpoint,
            },
            auth.refreshToken,
          );

          const tokenExpiry = OAuth2Utils.calculateTokenExpiry(tokenResponse.expires_in);
          persistentConfig.addOrUpdateEndpoint(endpoint, {
            authentication: {
              ...auth,
              accessToken: tokenResponse.access_token,
              idToken: tokenResponse.id_token,
              refreshToken: tokenResponse.refresh_token || auth.refreshToken,
              tokenExpiry,
            },
          });
        } catch (e) {
          console.error("Failed to refresh OAuth2 token for endpoint", endpoint, e);
        }
      }
    }

    const updated = persistentConfig.getEndpointConfig(endpoint)?.authentication;
    if (updated && updated.type === "oauth2") {
      const token = updated.accessToken || updated.idToken;
      if (token) return { Authorization: `Bearer ${token}` };
    }

    return undefined;
  }

  return resolveSparqlAuthHeaders(persistentConfig, endpoint);
}

export function getWorkspaceBackend(
  config: WorkspaceConfig,
  options?: {
    persistentConfig?: PersistentConfig;
  },
): WorkspaceBackend {
  const backend = createWorkspaceBackend(config, options);
  return config.readOnly ? new ReadOnlyWorkspaceBackend(backend) : backend;
}

function createWorkspaceBackend(
  config: WorkspaceConfig,
  options?: {
    persistentConfig?: PersistentConfig;
  },
): WorkspaceBackend {
  const registered = registeredBackends.get(config.id);
  if (registered) return registered;
  if (config.type === "git") {
    const client =
      (GithubProviderClient.canHandle(config) && new GithubProviderClient()) ||
      (GitlabProviderClient.canHandle(config) && new GitlabProviderClient()) ||
      (BitbucketProviderClient.canHandle(config) && new BitbucketProviderClient()) ||
      (GiteaProviderClient.canHandle(config) && new GiteaProviderClient()) ||
      undefined;

    return new GitWorkspaceBackend(config, client);
  }

  const persistentConfig = options?.persistentConfig;
  if (!persistentConfig) {
    const authHeaders = resolveSparqlAuthHeaders(undefined, config.endpoint);
    return new SparqlWorkspaceBackend(config, { authHeaders });
  }

  return new SparqlWorkspaceBackend(config, {
    getAuthHeaders: () => resolveSparqlAuthHeadersWithRefresh(persistentConfig, config.endpoint),
  });
}
