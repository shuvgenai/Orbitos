import { afterAll, expect, test, vi } from 'vitest';
import { FakeGmail, syntheticLead } from '@orbit/shared/gmail/fake';
import { pollOnce } from '../../frontdesk/src/poll.ts';
import { classifyLead } from '../../frontdesk/src/classify.ts';
import { sendToScout } from '../../frontdesk/src/engine/bridge.ts';
import { runJobLoop } from '../../frontdesk/src/loop.ts';
import { handleConfirmPost } from '../../api/src/confirm.ts';
import { newWorkspace, testPrisma, withConnection, withOwner } from './helpers.ts';

const prisma = testPrisma();
afterAll(() => prisma.$disconnect());

const DRAFT = ['```json', JSON.stringify({ kind: 'draft', schemaVersion: 1,
  draft: 'Thanks for reaching out — happy to quote.', category: 'routine', flags: [],
  reason: 'Routine quote request.' }), '```'].join('\n');

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

  // 1. poll
  expect((await pollOnce({ prisma, gmail, workspaceId: ws.id, ownerAddress: 'owner@example.com' })).created).toBe(1);
  const lead = await prisma.lead.findFirstOrThrow({ where: { workspaceId: ws.id } });
  const body = await prisma.emailBody.findUniqueOrThrow({ where: { leadId: lead.id } });

  // 2. classify
  const classifier = { ask: vi.fn().mockResolvedValue({ verdict: 'lead', confidence: 0.93,
    inputTokens: 700, outputTokens: 8, costUsd: 0.0007 }) };
  expect(await classifyLead({ prisma, classifier, now: () => Date.now() },
    { id: lead.id, workspaceId: ws.id, cleanBody: body.cleanBody! })).toBe('lead');

  // 3. hand to Scout, then run the loop until the notice is out
  await sendToScout({ prisma, engine, setup }, { ...lead, cleanBody: body.cleanBody! });
  await prisma.job.updateMany({ where: { leadId: lead.id }, data: { runAt: new Date() } });
  await runJobLoop({ prisma, engine, mailer, baseUrl: 'https://orbit.example', secret: 's',
    now: () => new Date() }, { workerId: 'test', limit: 10 });
  await prisma.job.updateMany({ where: { kind: 'notice' }, data: { runAt: new Date() } });
  await runJobLoop({ prisma, engine, mailer, baseUrl: 'https://orbit.example', secret: 's',
    now: () => new Date() }, { workerId: 'test', limit: 10 });

  const approval = await prisma.approval.findFirstOrThrow({ where: { leadId: lead.id } });
  expect(approval.state).toBe('issued');
  // The link is followed by the deadline sentence, so the token ends at the first whitespace.
  const token = mailer.send.mock.calls[0]![0].text.split('/c/')[1]!.split(/\s/)[0]!;

  // 4. the owner presses Send
  const out = await handleConfirmPost({ prisma, gmail, secret: 's',
    requireSession: async () => ({ userId: owner.id, freshAt: new Date() }) }, token, {} as never, 'send');

  expect(out.view).toBe('sent');
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
