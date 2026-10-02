import { afterAll, expect, test, vi } from 'vitest';
import { FakeGmail, syntheticLead } from '@orbit/shared/gmail/fake';
import { pollOnce } from '../../frontdesk/src/poll.ts';
import { advanceLeads } from '../../frontdesk/src/pipeline.ts';
import { runJobLoop } from '../../frontdesk/src/loop.ts';
import { createRateLimiter } from '../../api/src/rate-limit.ts';
import { createRoutes } from '../../api/src/routes.ts';
import { hashToken } from '../../api/src/session.ts';
import { newWorkspace, testPrisma, withConnection, withOwner } from './helpers.ts';

const prisma = testPrisma();
afterAll(() => prisma.$disconnect());

const SECRET = 'golden-thread-secret-0123456789ab'; // 33 characters, as the programs require

const DRAFT = ['```json', JSON.stringify({ kind: 'draft', schemaVersion: 1,
  draft: 'Thanks for reaching out — happy to quote.', category: 'routine', flags: [],
  reason: 'Routine quote request.' }), '```'].join('\n');

// Stages 2 and 3 run through advanceLeads, the function frontdesk's poll tick calls, and stage 4 through
// createRoutes, the function api's server calls. Only the outside world is faked.
test('one lead walks the whole slice and lands as a sent reply', async () => {
  // The loop claims across workspaces, so jobs left by other test files must not be run here.
  await prisma.job.deleteMany();
  const ws = await newWorkspace(prisma);
  const owner = await withOwner(prisma, ws.id, 'owner@example.com');
  await withConnection(prisma, ws.id, { historyId: '100' });

  const gmail = new FakeGmail({ historyId: '100' });
  // receivedAt is now: the approval window runs 72 h from it, and the fake's default date is long past.
  gmail.queue(syntheticLead({ messageId: '<lead@mail.example>', fromEmail: 'maya@okafor.example', receivedAt: new Date() }));
  const engine = { createIssue: vi.fn().mockResolvedValue({ issueId: 'i1' }),
    comments: vi.fn().mockResolvedValue([DRAFT]), comment: vi.fn() };
  const mailer = { send: vi.fn().mockResolvedValue(undefined) };
  const setup = { toneSamples: 'Thanks for getting in touch.', facts: 'We do audits.' };
  const classifier = { ask: vi.fn().mockResolvedValue({ verdict: 'lead', confidence: 0.93,
    inputTokens: 700, outputTokens: 8, costUsd: 0.0007 }) };
  const loopDeps = { prisma, engine, mailer, baseUrl: 'https://orbit.example', secret: SECRET, now: () => new Date() };

  // 1. poll
  expect((await pollOnce({ prisma, gmail, workspaceId: ws.id, ownerAddress: 'owner@example.com' })).created).toBe(1);
  const lead = await prisma.lead.findFirstOrThrow({ where: { workspaceId: ws.id } });
  expect(lead.state).toBe('received');

  // 2 and 3. classify and hand to Scout, in one pass of the pipeline
  expect(await advanceLeads({ prisma, classifier, engine, setup, workspaceId: ws.id })).toEqual({ advanced: 1 });
  expect(classifier.ask).toHaveBeenCalledTimes(1);
  expect(classifier.ask.mock.calls[0]![0]).toContain('quote an audit');
  // A classifier that did nothing must not pass: the verdict is stored, and the call is on the ledger.
  expect(await prisma.lead.findUniqueOrThrow({ where: { id: lead.id } })).toMatchObject({
    classification: 'lead', state: 'drafting', paperclipIssueId: 'i1',
  });
  expect(await prisma.decisionCall.findFirstOrThrow({ where: { leadId: lead.id } })).toMatchObject({
    outcome: 'lead', model: 'claude-haiku-4-5',
  });
  expect(engine.createIssue.mock.calls[0]![0].body).toContain('quote an audit');

  // then the job loop until the notice is out
  await prisma.job.updateMany({ where: { leadId: lead.id }, data: { runAt: new Date() } });
  await runJobLoop(loopDeps, { workerId: 'test', limit: 10 });
  await prisma.job.updateMany({ where: { kind: 'notice' }, data: { runAt: new Date() } });
  await runJobLoop(loopDeps, { workerId: 'test', limit: 10 });

  const approval = await prisma.approval.findFirstOrThrow({ where: { leadId: lead.id } });
  expect(approval.state).toBe('issued');
  // The link is followed by the deadline sentence, so the token ends at the first whitespace.
  const token = mailer.send.mock.calls[0]![0].text.split('/c/')[1]!.split(/\s/)[0]!;

  // 4. the owner presses Send, through the api's routes with a real session cookie
  const sessionToken = 'golden-thread-session';
  await prisma.session.create({ data: { userId: owner.id, tokenHash: hashToken(sessionToken), freshAt: new Date(),
    expiresAt: new Date(Date.now() + 3600_000) } });
  const route = createRoutes({ prisma, gmail, mailer, baseUrl: 'https://orbit.example', secret: SECRET,
    workspaceId: ws.id, signInLimiter: createRateLimiter({ max: 5, windowMs: 60_000 }),
    signInCallerLimiter: createRateLimiter({ max: 20, windowMs: 60_000 }) });
  const headers = { cookie: `orbit_session=${sessionToken}` };
  const page = await route({ method: 'GET', path: `/c/${token}`, headers, body: '', ip: '1.1.1.1' });
  expect(page.status).toBe(200);
  expect(page.body).toContain('happy to quote');
  const out = await route({ method: 'POST', path: `/c/${token}`, headers, body: 'action=send', ip: '1.1.1.1' });

  expect(out.status).toBe(200);
  expect(out.body).toContain('Sent.');
  expect(gmail.sent).toHaveLength(1);
  // raw is base64url RFC 2822: decode it, and check the reply is addressed to the lead, in its thread.
  const mime = Buffer.from(gmail.sent[0]!.raw, 'base64url').toString('utf8');
  expect(mime).toContain('To: maya@okafor.example');
  expect(mime).toContain('In-Reply-To: <lead@mail.example>');
  expect(mime).toContain('happy to quote');
  // Each stage really ran: one Scout issue, one notice to the owner, both jobs finished.
  expect(engine.createIssue).toHaveBeenCalledTimes(1);
  expect(mailer.send).toHaveBeenCalledTimes(1);
  expect(mailer.send.mock.calls[0]![0].to).toBe('owner@example.com');
  expect((await prisma.job.findMany({ where: { leadId: lead.id }, select: { kind: true, state: true } }))
    .sort((x, y) => x.kind.localeCompare(y.kind))).toEqual([
    { kind: 'draft_poll', state: 'done' }, { kind: 'notice', state: 'done' },
  ]);
  expect((await prisma.approval.findUniqueOrThrow({ where: { id: approval.id } })).state).toBe('sent');
  expect((await prisma.lead.findUniqueOrThrow({ where: { id: lead.id } })).state).toBe('sent');
  expect(await prisma.decision.findUniqueOrThrow({ where: { approvalId: approval.id } })).toMatchObject({
    userId: owner.id, action: 'send',
  });
});
