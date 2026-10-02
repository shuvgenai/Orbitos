import { expect, test, vi } from 'vitest';
import { createAccessTokenProvider } from './access-token.ts';

const ok = (token: string, expires_in = 3600) => new Response(JSON.stringify({ access_token: token, expires_in }));
const base = { clientId: 'cid', clientSecret: 'cs', getRefreshToken: async () => 'rt' };

test('exchanges the refresh token and caches the access token until near expiry', async () => {
  let t = 0;
  const fetch = vi.fn().mockResolvedValueOnce(ok('a1')).mockResolvedValueOnce(ok('a2'));
  const get = createAccessTokenProvider({ ...base, fetch, now: () => t });
  expect(await get()).toBe('a1');
  expect(await get()).toBe('a1');
  expect(fetch).toHaveBeenCalledTimes(1);
  const form = fetch.mock.calls[0]![1].body as URLSearchParams;
  expect(form.get('grant_type')).toBe('refresh_token');
  expect(form.get('refresh_token')).toBe('rt');
  t = 3_600_000 - 60_000 + 1;
  expect(await get()).toBe('a2');
});

test('concurrent callers share one refresh', async () => {
  const fetch = vi.fn().mockResolvedValue(ok('a1'));
  const get = createAccessTokenProvider({ ...base, fetch });
  expect(await Promise.all([get(), get(), get()])).toEqual(['a1', 'a1', 'a1']);
  expect(fetch).toHaveBeenCalledTimes(1);
});

test('invalid_grant is a revocation: a 401 the poller recognises', async () => {
  const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: 'invalid_grant' }), { status: 400 }));
  await expect(createAccessTokenProvider({ ...base, fetch })()).rejects.toMatchObject({ name: 'GmailApiError', status: 401 });
});

test('another failure keeps its status, and a failed refresh is not cached', async () => {
  const fetch = vi.fn().mockResolvedValueOnce(new Response('{}', { status: 503 })).mockResolvedValueOnce(ok('a1'));
  const get = createAccessTokenProvider({ ...base, fetch });
  await expect(get()).rejects.toMatchObject({ status: 503 });
  expect(await get()).toBe('a1');
});
