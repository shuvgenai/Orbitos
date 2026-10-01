import { createHash } from 'node:crypto';
import { afterAll, expect, test, vi } from 'vitest';
import { issueSignInLink, redeemSignInLink } from '../../api/src/auth.ts';
import { readSession } from '../../api/src/session.ts';
import { createOwner } from '../src/owner.ts';
import { newWorkspace, testPrisma, withOwner } from './helpers.ts';

const prisma = testPrisma();
afterAll(() => prisma.$disconnect());

// Every test builds its own workspace and owner and scopes its queries to them, so nothing depends on
// what other tests or files left in the database.
async function fixture() {
  const ws = await newWorkspace(prisma);
  const owner = await withOwner(prisma, ws.id, 'owner@example.com');
  const mailer = { send: vi.fn().mockResolvedValue(undefined) };
  return { ws, owner, mailer, deps: { prisma, mailer, baseUrl: 'https://orbit.example', workspaceId: ws.id } };
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
  const { deps, mailer, owner } = await fixture();
  await issueSignInLink(deps, 'owner@example.com', '/');
  const token = tokenFrom(mailer);
  const row = await prisma.signInLink.findFirstOrThrow({ where: { userId: owner.id } });
  expect(row.tokenHash).not.toBe(token);
  expect(row.tokenHash).toHaveLength(64);
  expect(row.tokenHash).toBe(createHash('sha256').update(token).digest('hex'));
});

test('an expired link is refused', async () => {
  const { deps, mailer, owner } = await fixture();
  await issueSignInLink(deps, 'owner@example.com', '/');
  await prisma.signInLink.updateMany({ where: { userId: owner.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
  expect(await redeemSignInLink(deps, tokenFrom(mailer))).toEqual({ error: 'expired' });
});

test('a session expires after 30 days and reads as absent', async () => {
  const { deps, mailer, owner } = await fixture();
  await issueSignInLink(deps, 'owner@example.com', '/');
  const out = await redeemSignInLink(deps, tokenFrom(mailer));
  if ('error' in out) throw new Error(out.error);
  await prisma.session.updateMany({ where: { userId: owner.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
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
  const { deps, mailer, owner } = await fixture();
  await issueSignInLink(deps, 'owner@example.com', '/');
  const out = await redeemSignInLink(deps, tokenFrom(mailer));
  if ('error' in out) throw new Error(out.error);
  await prisma.session.updateMany({ where: { userId: owner.id }, data: { revokedAt: new Date() } });
  expect(await readSession(prisma, out.cookie)).toBeNull();
});

test('missing, malformed or unknown cookies read as absent', async () => {
  expect(await readSession(prisma, undefined)).toBeNull();
  expect(await readSession(prisma, '')).toBeNull();
  expect(await readSession(prisma, 'other=1')).toBeNull();
  expect(await readSession(prisma, 'orbit_session=nope')).toBeNull();
});

test('the session stores a hash and carries a 30-day lifetime and freshAt', async () => {
  const { deps, mailer, owner } = await fixture();
  await issueSignInLink(deps, 'owner@example.com', '/');
  const out = await redeemSignInLink(deps, tokenFrom(mailer));
  if ('error' in out) throw new Error(out.error);
  expect(out.cookie).toMatch(/Path=\//);
  expect(out.cookie).toMatch(/Max-Age=2592000/);
  const row = await prisma.session.findFirstOrThrow({ where: { userId: owner.id } });
  expect(out.cookie).not.toContain(row.tokenHash);
  expect(row.tokenHash).toHaveLength(64);
  expect(row.expiresAt.getTime() - row.freshAt.getTime()).toBe(30 * 86_400_000);
  expect(Math.abs(row.freshAt.getTime() - Date.now())).toBeLessThan(10_000);
});

test.each([
  '//evil.example',
  'https://evil.example/x',
  '/\\evil.example',
  'c/abc',
  '/\t/evil.example',
  '/\n/evil.example',
  '',
])(
  'an off-site or non-path redirect %s is replaced with /',
  async (bad) => {
    const { deps, mailer } = await fixture();
    await issueSignInLink(deps, 'owner@example.com', bad);
    const out = await redeemSignInLink(deps, tokenFrom(mailer));
    if ('error' in out) throw new Error(out.error);
    expect(out.redirectPath).toBe('/');
  },
);

test('sign-in is scoped to the instance workspace', async () => {
  const a = await fixture();
  const b = await fixture(); // a different workspace, same address
  await issueSignInLink(a.deps, 'owner@example.com', '/');
  const out = await redeemSignInLink(a.deps, tokenFrom(a.mailer));
  if ('error' in out) throw new Error(out.error);
  expect(await readSession(prisma, out.cookie)).toMatchObject({ userId: a.owner.id });
  expect(b.mailer.send).not.toHaveBeenCalled();
  expect(await prisma.signInLink.count({ where: { userId: b.owner.id } })).toBe(0);
});

test('a workspace with no such address mails nothing even when another workspace has it', async () => {
  const a = await fixture();
  const empty = await newWorkspace(prisma);
  const out = await issueSignInLink({ ...a.deps, workspaceId: empty.id }, 'owner@example.com', '/');
  expect(out).toEqual({ sent: true });
  expect(a.mailer.send).not.toHaveBeenCalled();
});

test('a bad redirect path already stored in a row is cleaned again at redemption', async () => {
  const { deps, mailer, owner } = await fixture();
  await issueSignInLink(deps, 'owner@example.com', '/ok');
  await prisma.signInLink.updateMany({ where: { userId: owner.id }, data: { redirectPath: '//evil.example' } });
  const out = await redeemSignInLink(deps, tokenFrom(mailer));
  if ('error' in out) throw new Error(out.error);
  expect(out.redirectPath).toBe('/');
});

test('the response does not wait on the mail provider', async () => {
  const { deps, mailer } = await fixture();
  mailer.send.mockReturnValue(new Promise(() => {})); // never settles
  const out = await Promise.race([
    issueSignInLink(deps, 'owner@example.com', '/'),
    new Promise((r) => setTimeout(() => r('timed out'), 2000)),
  ]);
  expect(out).toEqual({ sent: true });
  expect(mailer.send).toHaveBeenCalledTimes(1);
});

test('a failing mail provider is swallowed and the answer is unchanged', async () => {
  const { deps, mailer } = await fixture();
  mailer.send.mockRejectedValue(new Error('provider down'));
  expect(await issueSignInLink(deps, 'owner@example.com', '/')).toEqual({ sent: true });
});

test('the address is matched case-insensitively and ignoring surrounding spaces', async () => {
  const ws = await newWorkspace(prisma);
  const owner = await createOwner(prisma, { workspaceId: ws.id, email: '  Owner@Firm.COM ' });
  expect(owner.email).toBe('owner@firm.com');
  const mailer = { send: vi.fn().mockResolvedValue(undefined) };
  const deps = { prisma, mailer, baseUrl: 'https://orbit.example', workspaceId: ws.id };
  await issueSignInLink(deps, ' OWNER@firm.com', '/');
  expect(mailer.send.mock.calls[0]![0].to).toBe('owner@firm.com');
});
