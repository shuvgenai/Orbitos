import { GmailApiError } from './client.ts';

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const SAFETY_MS = 60_000;

/**
 * Exchanges the stored refresh token for short-lived access tokens, cached until a minute before expiry.
 * `getRefreshToken` is read on every refresh so a re-connected account is picked up without a restart.
 * Google's `invalid_grant` means the owner revoked access: it surfaces as a 401 GmailApiError, which the poller
 * already treats as a revocation.
 */
export function createAccessTokenProvider(deps: {
  clientId: string;
  clientSecret: string;
  getRefreshToken: () => Promise<string>;
  fetch?: typeof fetch;
  now?: () => number;
}): () => Promise<string> {
  const doFetch = deps.fetch ?? fetch;
  const now = deps.now ?? Date.now;
  let cached: { token: string; expiresAt: number } | null = null;
  let inflight: Promise<string> | null = null;

  async function refresh(): Promise<string> {
    const res = await doFetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: deps.clientId,
        client_secret: deps.clientSecret,
        refresh_token: await deps.getRefreshToken(),
        grant_type: 'refresh_token',
      }),
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: unknown };
      const revoked = res.status === 400 && body.error === 'invalid_grant';
      throw new GmailApiError(revoked ? 401 : res.status, `Gmail token refresh failed with status ${res.status}`);
    }
    const json = (await res.json()) as { access_token?: unknown; expires_in?: unknown };
    if (typeof json.access_token !== 'string') throw new GmailApiError(502, 'Gmail token refresh returned no token');
    const ttl = typeof json.expires_in === 'number' ? json.expires_in * 1000 : 3_600_000;
    cached = { token: json.access_token, expiresAt: now() + ttl - SAFETY_MS };
    return json.access_token;
  }

  return async () => {
    if (cached && cached.expiresAt > now()) return cached.token;
    inflight ??= refresh().finally(() => {
      inflight = null;
    });
    return inflight;
  };
}
