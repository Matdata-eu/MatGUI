/**
 * OAuth 2.0 Utility Functions
 * Handles OAuth 2.0 Authorization Code flow with PKCE
 */

/**
 * Generate a random string for PKCE code verifier
 */
function generateRandomString(length: number): string {
  const possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~";
  const values = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(values)
    .map((v) => possible[v % possible.length])
    .join("");
}

/**
 * Generate SHA-256 hash and base64url encode it
 */
async function sha256(plain: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(plain);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return base64urlEncode(hash);
}

/**
 * Base64url encode (without padding)
 */
function base64urlEncode(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

export interface OAuth2Config {
  clientId: string;
  authorizationEndpoint: string;
  tokenEndpoint: string;
  redirectUri: string;
  scope?: string;
}

export interface OAuth2TokenResponse {
  access_token: string;
  id_token?: string; // ID token for authentication (Azure AD, OIDC)
  refresh_token?: string;
  expires_in?: number; // seconds
  token_type: string;
}

/** Origin of a URL, or of the current page for a relative one */
export function originOf(url: string): string {
  try {
    return new URL(url, window.location.href).origin;
  } catch {
    return window.location.origin;
  }
}

/**
 * Check if a token has expired
 */
export function isTokenExpired(tokenExpiry?: number): boolean {
  if (!tokenExpiry) return true;
  // Add 60 second buffer to refresh before actual expiration
  return Date.now() >= tokenExpiry - 60000;
}

/**
 * Start OAuth 2.0 Authorization Code flow with PKCE
 * Opens a popup window for user authentication
 */
export async function startOAuth2Flow(config: OAuth2Config): Promise<OAuth2TokenResponse> {
  // Generate PKCE code verifier and challenge
  const codeVerifier = generateRandomString(128);
  const codeChallenge = await sha256(codeVerifier);

  // Generate state for CSRF protection
  const state = generateRandomString(32);

  // Generate unique flow ID to prevent collisions across multiple OAuth flows
  const flowId = generateRandomString(16);

  // The code verifier and state stay in this closure: nothing else needs them, so they aren't written to storage
  const redirectOrigin = originOf(config.redirectUri);

  // Build authorization URL
  const authUrl = new URL(config.authorizationEndpoint);
  authUrl.searchParams.set("client_id", config.clientId);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("redirect_uri", config.redirectUri);
  authUrl.searchParams.set("code_challenge", codeChallenge);
  authUrl.searchParams.set("code_challenge_method", "S256");
  // Include flowId in state to link the callback to this specific flow
  authUrl.searchParams.set("state", `${state}:${flowId}`);
  if (config.scope) {
    authUrl.searchParams.set("scope", config.scope);
  }

  // Open popup window
  const width = 600;
  const height = 700;
  const left = window.screenX + (window.outerWidth - width) / 2;
  const top = window.screenY + (window.outerHeight - height) / 2;
  const popup = window.open(
    authUrl.toString(),
    "OAuth2 Authorization",
    `width=${width},height=${height},left=${left},top=${top},popup=yes,scrollbars=yes`,
  );

  if (!popup) {
    throw new Error("Failed to open OAuth 2.0 authorization popup. Please allow popups for this site.");
  }

  // Wait for the OAuth callback
  return new Promise<OAuth2TokenResponse>((resolve, reject) => {
    // Flag to prevent race condition between polling and messageHandler
    let flowCompleted = false;

    const cleanup = () => {
      clearInterval(checkInterval);
      window.removeEventListener("message", messageHandler);
    };

    const checkInterval = setInterval(() => {
      try {
        // Check if popup is closed
        if (popup.closed) {
          if (!flowCompleted) {
            flowCompleted = true;
            cleanup();
            reject(new Error("OAuth 2.0 authorization was cancelled"));
          }
          return;
        }

        // Try to read popup URL (will throw if cross-origin)
        try {
          const popupUrl = popup.location.href;
          if (popupUrl.startsWith(config.redirectUri) && !flowCompleted) {
            flowCompleted = true;
            cleanup();
            popup.close();

            // Parse the authorization code from URL
            const url = new URL(popupUrl);
            const code = url.searchParams.get("code");
            const returnedState = url.searchParams.get("state");
            const error = url.searchParams.get("error");
            const errorDescription = url.searchParams.get("error_description");

            if (error) {
              reject(new Error(`OAuth 2.0 error: ${error}${errorDescription ? " - " + errorDescription : ""}`));
              return;
            }

            if (!code) {
              reject(new Error("No authorization code received"));
              return;
            }

            // Validate state includes our flowId
            const expectedState = `${state}:${flowId}`;
            if (returnedState !== expectedState) {
              reject(new Error("State mismatch - possible CSRF attack"));
              return;
            }

            // Exchange code for tokens
            exchangeCodeForToken(config, code, codeVerifier).then(resolve).catch(reject);
          }
        } catch (e) {
          // Reading the location of a cross-origin popup throws while it is on the provider's domain: keep
          // waiting. Anything else is a real error.
          if (!(e instanceof DOMException && e.name === "SecurityError") && !flowCompleted) {
            flowCompleted = true;
            cleanup();
            reject(e instanceof Error ? e : new Error(String(e)));
          }
        }
      } catch (e) {
        // `popup.closed` itself can throw in some browsers while the popup navigates; check again next time
      }
    }, 500);

    // Also listen for postMessage from redirect page (alternative method)
    const messageHandler = (event: MessageEvent) => {
      // Only the redirect page, on the origin of the redirect URI, may report the result
      if (event.origin !== redirectOrigin) return;
      if (event.data && event.data.type === "oauth2_callback" && !flowCompleted) {
        flowCompleted = true;
        cleanup();
        if (popup && !popup.closed) {
          popup.close();
        }

        const { code, state: returnedState, error, error_description } = event.data;

        if (error) {
          reject(new Error(`OAuth 2.0 error: ${error}${error_description ? " - " + error_description : ""}`));
          return;
        }

        if (!code) {
          reject(new Error("No authorization code received"));
          return;
        }

        // Validate state includes our flowId
        const expectedState = `${state}:${flowId}`;
        if (returnedState !== expectedState) {
          reject(new Error("State mismatch - possible CSRF attack"));
          return;
        }

        // Exchange code for tokens
        exchangeCodeForToken(config, code, codeVerifier).then(resolve).catch(reject);
      }
    };

    window.addEventListener("message", messageHandler);

    // Cleanup timeout after 5 minutes
    setTimeout(
      () => {
        if (!flowCompleted) {
          flowCompleted = true;
          cleanup();
          if (popup && !popup.closed) {
            popup.close();
          }
          reject(new Error("OAuth 2.0 authorization timeout"));
        }
      },
      5 * 60 * 1000,
    );
  });
}

/**
 * Exchange authorization code for access token
 */
async function exchangeCodeForToken(
  config: OAuth2Config,
  code: string,
  codeVerifier: string,
): Promise<OAuth2TokenResponse> {
  const tokenUrl = config.tokenEndpoint;

  const body = new URLSearchParams();
  body.set("grant_type", "authorization_code");
  body.set("code", code);
  body.set("redirect_uri", config.redirectUri);
  body.set("client_id", config.clientId);
  body.set("code_verifier", codeVerifier);

  try {
    const response = await fetch(tokenUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: body.toString(),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Token exchange failed: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const tokenResponse: OAuth2TokenResponse = await response.json();

    // Note: sessionStorage cleanup is handled by the caller
    return tokenResponse;
  } catch (error) {
    // Note: sessionStorage cleanup is handled by the caller
    throw error;
  }
}

/**
 * Refresh an OAuth 2.0 access token using a refresh token
 */
export async function refreshOAuth2Token(
  config: Omit<OAuth2Config, "authorizationEndpoint" | "redirectUri">,
  refreshToken: string,
): Promise<OAuth2TokenResponse> {
  const tokenUrl = config.tokenEndpoint;

  const body = new URLSearchParams();
  body.set("grant_type", "refresh_token");
  body.set("refresh_token", refreshToken);
  body.set("client_id", config.clientId);

  try {
    const response = await fetch(tokenUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: body.toString(),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Token refresh failed: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const tokenResponse: OAuth2TokenResponse = await response.json();
    return tokenResponse;
  } catch (error) {
    throw error;
  }
}

/**
 * Calculate token expiry timestamp from expires_in value
 */
export function calculateTokenExpiry(expiresIn?: number): number | undefined {
  if (!expiresIn) return undefined;
  return Date.now() + expiresIn * 1000;
}
