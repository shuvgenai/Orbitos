import { afterAll, beforeEach, expect, test, vi } from 'vitest';
import { issueSignInLink, redeemSignInLink } from '../../api/src/auth.ts';
import { readSession } from '../../api/src/session.ts';
import { newWorkspace, testPrisma, withOwner } from './helpers.ts';

const prisma = testPrisma();
afterAll(() => prisma.$disconnect());

// The tests read these tables unfiltered and look users up by address, so each starts from a clean slate.
beforeEach(async () => {
  await prisma.signInLink.deleteMany();
  await prisma.session.deleteMany();
  // Owners left by other test files share this address; rename them so only this test's owner matches.
  for (const u of await prisma.user.findMany({ where: { email: 'owner@example.com' } })) {
    await prisma.user.update({ where: { id: u.id }, data: { email: `stale-${u.id}@example.test` } });
  }
});

async function fixture() {
  const ws = await newWorkspace(prisma);
  const owner = await withOwner(prisma, ws.id, 'owner@example.com');
  const mailer = { send: vi.fn().mockResolvedValue(undefined) };
  return { ws, owner, mailer, deps: { prisma, mailer, baseUrl: 'https://orbit.example' } };
}

function tokenFrom(mailer: { send: { mock: { calls: { text: string }[][] } } }): string {
  const text = mailer.send.mock.calls[0]![0]!.text;
  return text.split('/s/')[1]!.trim();
}

test('a link is mailed to the owner and redeems into a session', async () => {
  const { deps, mailer, owner } = await fixture();
  await issueSignInLink(deps, 'owner@example.com', '/c/abc');
  expect(mailer.send.mock.calls[0]![0].to).toBe('owner@example.com');

  const out = await redeemSignInLink(deps, tokenFrom(mailer));
  if ('error' in out) throw new Error(out.error);
  expect(out.redirectPath).toBe('/c/abc');
  expect(out.cookie).toMatch(/HttpOnly/);
  expect(out.cookie).toMatch(/Secure/);
  expect(out.cookie).toMatch(/SameSite=Lax/);
  expect(await readSession(prisma, out.cookie)).toMatchObject({ userId: owner.id });
});

test('a link redeems exactly once (SIGN-1)', async () => {
  const { deps, mailer } = await fixture();
  await issueSignInLink(deps, 'owner@example.com', '/');
  const token = tokenFrom(mailer);
  expect('error' in (await redeemSignInLink(deps, token))).toBe(false);
  expect(await redeemSignInLink(deps, token)).toEqual({ error: 'used' });
});

test('an unknown address mails nothing and reveals nothing (APP-1)', async () => {
  const { deps, mailer } = await fixture();
  const out = await issueSignInLink(deps, 'stranger@elsewhere.example', '/');
  expect(out).toEqual({ sent: true });      // the same answer either way
  expect(mailer.send).not.toHaveBeenCalled();
});

test('the stored token is a hash, not the token itself', async () => {
  const { deps, mailer } = await fixture();
  await issueSignInLink(deps, 'owner@example.com', '/');
  const token = tokenFrom(mailer);
  const row = await prisma.signInLink.findFirstOrThrow();
  expect(row.tokenHash).not.toBe(token);
  expect(row.tokenHash).toHaveLength(64);
});

test('an expired link is refused', async () => {
  const { deps, mailer } = await fixture();
  await issueSignInLink(deps, 'owner@example.com', '/');
  await prisma.signInLink.updateMany({ data: { expiresAt: new Date(Date.now() - 1000) } });
  expect(await redeemSignInLink(deps, tokenFrom(mailer))).toEqual({ error: 'expired' });
});

test('a session expires after 30 days and reads as absent', async () => {
  const { deps, mailer } = await fixture();
  await issueSignInLink(deps, 'owner@example.com', '/');
  const out = await redeemSignInLink(deps, tokenFrom(mailer));
  if ('error' in out) throw new Error(out.error);
  await prisma.session.updateMany({ data: { expiresAt: new Date(Date.now() - 1000) } });
  expect(await readSession(prisma, out.cookie)).toBeNull();
});

// --- additions beyond the brief ---

test('the sign-in email carries X-Orbitcrew so the poller never reads it as a lead', async () => {
  const { deps, mailer } = await fixture();
  await issueSignInLink(deps, 'owner@example.com', '/');
  expect(mailer.send.mock.calls[0]![0].headers).toMatchObject({ 'X-Orbitcrew': expect.any(String) });
});

test('a token that was never issued is invalid', async () => {
  const { deps } = await fixture();
  expect(await redeemSignInLink(deps, 'not-a-real-token')).toEqual({ error: 'invalid' });
});

test('two clicks at once: exactly one wins, one session is created', async () => {
  const { deps, mailer, owner } = await fixture();
  await issueSignInLink(deps, 'owner@example.com', '/');
  const token = tokenFrom(mailer);
  const results = await Promise.all([redeemSignInLink(deps, token), redeemSignInLink(deps, token)]);
  expect(results.filter((r) => 'cookie' in r)).toHaveLength(1);
  expect(results.filter((r) => 'error' in r && r.error === 'used')).toHaveLength(1);
  expect(await prisma.session.count({ where: { userId: owner.id } })).toBe(1);
});

test('a revoked session reads as absent', async () => {
  const { deps, mailer } = await fixture();
  await issueSignInLink(deps, 'owner@example.com', '/');
  const out = await redeemSignInLink(deps, tokenFrom(mailer));
  if ('error' in out) throw new Error(out.error);
  await prisma.session.updateMany({ data: { revokedAt: new Date() } });
  expect(await readSession(prisma, out.cookie)).toBeNull();
});

test('missing, malformed or unknown cookies read as absent', async () => {
  expect(await readSession(prisma, undefined)).toBeNull();
  expect(await readSession(prisma, '')).toBeNull();
  expect(await readSession(prisma, 'other=1')).toBeNull();
  expect(await readSession(prisma, 'orbit_session=nope')).toBeNull();
});

test('the session stores a hash and carries a 30-day lifetime and freshAt', async () => {
  const { deps, mailer } = await fixture();
  await issueSignInLink(deps, 'owner@example.com', '/');
  const out = await redeemSignInLink(deps, tokenFrom(mailer));
  if ('error' in out) throw new Error(out.error);
  expect(out.cookie).toMatch(/Path=\//);
  expect(out.cookie).toMatch(/Max-Age=2592000/);
  const row = await prisma.session.findFirstOrThrow();
  expect(out.cookie).not.toContain(row.tokenHash);
  expect(row.tokenHash).toHaveLength(64);
  expect(row.expiresAt.getTime() - row.freshAt.getTime()).toBe(30 * 86_400_000);
  expect(Math.abs(row.freshAt.getTime() - Date.now())).toBeLessThan(10_000);
});

test('an off-site redirect path is replaced with /', async () => {
  const { deps, mailer } = await fixture();
  await issueSignInLink(deps, 'owner@example.com', '//evil.example');
  const out = await redeemSignInLink(deps, tokenFrom(mailer));
  if ('error' in out) throw new Error(out.error);
  expect(out.redirectPath).toBe('/');
});
