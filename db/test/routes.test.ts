import { afterAll, expect, test, vi } from 'vitest';
import { FakeGmail } from '@orbit/shared/gmail/fake';
import { signApprovalLink } from '@orbit/shared/approval-link';
import { createOwner } from '../src/owner.ts';
import { createRateLimiter } from '../../api/src/rate-limit.ts';
import { createRoutes, type ApiRequest } from '../../api/src/routes.ts';
import { hashToken } from '../../api/src/session.ts';
import { newApproval, newWorkspace, testPrisma } from './helpers.ts';

const prisma = testPrisma();
afterAll(() => prisma.$disconnect());

const SECRET = 's'.repeat(32);

function setup(workspaceId: string, max = 5, callerMax = 20) {
  const mailer = { send: vi.fn().mockResolvedValue(undefined) };
  const route = createRoutes({
    prisma, gmail: new FakeGmail({ historyId: '1' }), mailer, baseUrl: 'https://orbit.example', secret: SECRET,
    workspaceId, signInLimiter: createRateLimiter({ max, windowMs: 60_000 }),
    signInCallerLimiter: createRateLimiter({ max: callerMax, windowMs: 60_000 }),
  });
  return { route, mailer };
}
const req = (over: Partial<ApiRequest>): ApiRequest => ({ method: 'GET', path: '/', headers: {}, body: '', ip: '1.1.1.1', ...over });

async function sessionFor(userId: string): Promise<string> {
  const token = `tok-${Math.random().toString(36).slice(2)}`;
  await prisma.session.create({ data: { userId, tokenHash: hashToken(token), freshAt: new Date(), expiresAt: new Date(Date.now() + 3600_000) } });
  return `orbit_session=${token}`;
}
const linkFor = (approval: { id: string; expiresAt: Date }) => signApprovalLink({ approvalId: approval.id, expiresAt: approval.expiresAt, secret: SECRET });

test('an unknown or malformed link is a 404 that does not say expired and shows no sign-in form', async () => {
  const ws = await newWorkspace(prisma);
  const { route } = setup(ws.id);
  for (const path of ['/c/garbage', '/c/%E0%A4%A']) {
    const out = await route(req({ path }));
    expect(out.status).toBe(404);
    expect(out.body).not.toContain('/signin');
    expect(out.body).not.toMatch(/expired/i);
  }
});

test('no session gets the sign-in form; a signed-in user without authority gets a 403 with no sign-in form', async () => {
  const ws = await newWorkspace(prisma);
  const other = await newWorkspace(prisma);
  const approval = await newApproval(prisma, ws.id);
  const stranger = await createOwner(prisma, { workspaceId: other.id, email: 'stranger@example.com' });
  const { route } = setup(ws.id);
  const path = `/c/${linkFor(approval)}`;

  const anon = await route(req({ path }));
  expect(anon.status).toBe(401);
  expect(anon.body).toContain('action="/signin"');

  const forbidden = await route(req({ path, headers: { cookie: await sessionFor(stranger.id) } }));
  expect(forbidden.status).toBe(403);
  expect(forbidden.body).not.toContain('/signin');
});

test('the owner sees the draft, escaped, and can discard it', async () => {
  const ws = await newWorkspace(prisma);
  const owner = await createOwner(prisma, { workspaceId: ws.id, email: 'owner@example.com' });
  const approval = await newApproval(prisma, ws.id);
  await prisma.approval.update({ where: { id: approval.id }, data: { draftText: 'Hi <script>x</script>' } });
  await prisma.lead.update({ where: { id: approval.leadId }, data: { state: 'awaiting_owner' } });
  const { route } = setup(ws.id);
  const path = `/c/${linkFor(approval)}`;
  const headers = { cookie: await sessionFor(owner.id) };

  const page = await route(req({ path, headers }));
  expect(page.status).toBe(200);
  expect(page.body).toContain('Hi &lt;script&gt;x&lt;/script&gt;');
  expect(page.body).not.toContain('<script>');

  const done = await route(req({ method: 'POST', path, headers, body: 'action=discard' }));
  expect(done.status).toBe(200);
  expect((await prisma.approval.findUniqueOrThrow({ where: { id: approval.id } })).state).toBe('void');
  // The lead follows its discarded reply.
  expect((await prisma.lead.findUniqueOrThrow({ where: { id: approval.leadId } })).state).toBe('discarded');
});

test('sign-in is limited per address, answers the same for known and unknown, and mails only this workspace', async () => {
  const ws = await newWorkspace(prisma);
  const other = await newWorkspace(prisma);
  await createOwner(prisma, { workspaceId: ws.id, email: 'in@example.com' });
  await createOwner(prisma, { workspaceId: other.id, email: 'out@example.com' });
  const { route, mailer } = setup(ws.id, 2);
  const post = (email: string) => route(req({ method: 'POST', path: '/signin', body: `email=${encodeURIComponent(email)}` }));

  const known = await post('in@example.com');
  const outsider = await post('out@example.com');
  expect(known.status).toBe(200);
  expect(outsider.body).toBe(known.body);
  await vi.waitFor(() => expect(mailer.send).toHaveBeenCalledTimes(1));
  expect(mailer.send.mock.calls[0]![0].to).toBe('in@example.com');

  expect((await post('in@example.com')).status).toBe(200); // second ask for this address, within its limit of 2
  expect((await post('in@example.com')).status).toBe(429);
});

test('a sign-in link sets the session cookie and redirects', async () => {
  const ws = await newWorkspace(prisma);
  await createOwner(prisma, { workspaceId: ws.id, email: 'in@example.com' });
  const { route, mailer } = setup(ws.id);
  await route(req({ method: 'POST', path: '/signin', body: 'email=in%40example.com&redirect=%2Fc%2Fabc' }));
  await vi.waitFor(() => expect(mailer.send).toHaveBeenCalled());
  const token = /\/s\/(\S+)/.exec(mailer.send.mock.calls[0]![0].text)![1]!;
  const out = await route(req({ path: `/s/${token}` }));
  expect(out.status).toBe(302);
  expect(out.headers.location).toBe('/c/abc');
  expect(out.headers['set-cookie']).toMatch(/^orbit_session=/);
  expect((await route(req({ path: `/s/${token}` }))).status).toBe(400); // spent
});

test('an empty edit is refused with the form and a plain message, never a success page', async () => {
  const ws = await newWorkspace(prisma);
  const owner = await createOwner(prisma, { workspaceId: ws.id, email: 'owner@example.com' });
  const approval = await newApproval(prisma, ws.id);
  const { route } = setup(ws.id);
  const out = await route(req({
    method: 'POST', path: `/c/${linkFor(approval)}`, headers: { cookie: await sessionFor(owner.id) },
    body: 'action=send_edited&finalText=',
  }));
  expect(out.status).toBe(422);
  expect(out.body).toContain('That edit was empty');
  expect(out.body).toContain('<textarea');
  expect(out.body).not.toContain('Done');
  expect((await prisma.approval.findUniqueOrThrow({ where: { id: approval.id } })).state).toBe('issued');
});

test('sign-in is limited per address as well as per caller', async () => {
  const ws = await newWorkspace(prisma);
  const { route } = setup(ws.id, 2, 3);
  const post = (email: string, ip: string) => route(req({ method: 'POST', path: '/signin', ip, body: `email=${email}` }));
  expect([(await post('a%40x.com', '9.9.9.9')).status, (await post('A%40X.com', '9.9.9.9')).status]).toEqual([200, 200]);
  // Same caller, same address (case-normalised), third ask: refused by the address bucket, though the caller bucket has room.
  expect((await post('a%40x.com', '9.9.9.9')).status).toBe(429);
  // The same caller may still ask about other addresses until its own, looser bucket runs out.
  expect((await post('b%40x.com', '9.9.9.9')).status).toBe(429); // caller bucket (3) exhausted by the three asks above
  expect((await post('a%40x.com', '8.8.8.8')).status).toBe(200); // another caller, same address: its own bucket
});
