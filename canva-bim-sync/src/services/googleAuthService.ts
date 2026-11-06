import { auth, type Oauth } from "@canva/user";

let oauthClient: Oauth | null = null;
let manualAccessToken: string | null = null;

function getOauthClient(): Oauth {
  if (!oauthClient) {
    oauthClient = auth.initOauth();
  }
  return oauthClient;
}

/**
 * Initiates user authorization through Canva's native OAuth manager.
 * Passes Google's required access_type=offline and prompt=consent to ensure
 * Google returns both an access token and refresh token to Canva's backend.
 */
export async function requestGoogleAccessToken(forceConsent: boolean = false): Promise<string> {
  const client = getOauthClient();

  try {
    // 1. Check if user already has an active, valid token cached by Canva (skip if forcing fresh consent)
    if (!forceConsent) {
      try {
        const existing = await client.getAccessToken();
        if (existing?.token) {
          return existing.token;
        }
      } catch {
        // Proceed to request authorization
      }
    }

    // 2. Request authorization with Google required parameters
    const queryParams: Record<string, string> = {
      access_type: "offline",
      prompt: "consent",
    };

    const response = await client.requestAuthorization({
      scope: new Set([
        "https://www.googleapis.com/auth/spreadsheets.readonly",
        "https://www.googleapis.com/auth/drive.readonly",
      ]),
      queryParams,
    });

    if (response.status === "completed") {
      let lastTokenError = "";

      // Retry retrieving access token to give Canva's backend time to complete exchange
      for (let attempt = 0; attempt < 8; attempt++) {
        await new Promise((r) => setTimeout(r, 600));

        try {
          const tokenResponse = await client.getAccessToken(
            attempt >= 4 ? { forceRefresh: true } : undefined,
          );
          if (tokenResponse?.token) {
            return tokenResponse.token;
          }
        } catch (err: any) {
          lastTokenError = err?.message || String(err);
        }
      }

      if (lastTokenError) {
        throw new Error(`Token exchange error: ${lastTokenError}`);
      }

      throw new Error(
        "Google login completed, but Canva could not retrieve the access token. Please verify the Token URL is https://oauth2.googleapis.com/token and Client Secret is correct.",
      );
    }

    if (response.status === "aborted") {
      throw new Error("Authorization was cancelled.");
    }

    throw new Error("Authorization flow did not complete.");
  } catch (err: any) {
    const msg = err?.message || String(err);
    if (
      msg.includes("not configured") ||
      msg.includes("OAuth") ||
      msg.includes("unsupported") ||
      msg.includes("configuration")
    ) {
      throw new Error(
        "Canva OAuth is not configured in Developer Portal. Please configure Google OAuth in your Canva Developer Portal under 'Authentication'.",
      );
    }
    throw err;
  }
}

/**
 * Checks if the user is currently authorized with Canva's OAuth client.
 */
export async function checkIsGoogleAuthenticated(): Promise<boolean> {
  if (manualAccessToken) return true;
  try {
    const client = getOauthClient();
    const tokenResponse = await client.getAccessToken();
    return !!tokenResponse?.token;
  } catch {
    return false;
  }
}

/**
 * Gets the current active access token.
 */
export async function getActiveGoogleToken(): Promise<string | null> {
  if (manualAccessToken) return manualAccessToken;
  try {
    const client = getOauthClient();
    const tokenResponse = await client.getAccessToken();
    return tokenResponse?.token || null;
  } catch {
    return null;
  }
}

/**
 * Sets a manual access token (useful for quick testing or dev bypass).
 */
export function setManualAccessToken(token: string | null): void {
  manualAccessToken = token;
}

/**
 * Deauthorizes the user and clears tokens.
 */
export async function clearGoogleSession(): Promise<void> {
  manualAccessToken = null;
  try {
    const client = getOauthClient();
    await client.deauthorize();
  } catch {
    // Ignore deauthorize errors
  }
}
