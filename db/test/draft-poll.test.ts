// db/test/draft-poll.test.ts
import { afterAll, expect, test, vi } from 'vitest';
import { handleDraftPoll } from '../../frontdesk/src/engine/draft-poll.ts';
import { newLead, newWorkspace, testPrisma } from './helpers.ts';

const prisma = testPrisma();
afterAll(() => prisma.$disconnect());

const validDraft = [
  'Here is the draft.',
  '```json',
  JSON.stringify({ kind: 'draft', schemaVersion: 1, draft: 'Thanks for reaching out — happy to help.',
    category: 'routine', flags: [], reason: 'Routine intro request.' }),
  '```',
].join('\n');

test('a valid draft becomes an approval and a queued notice', async () => {
  const ws = await newWorkspace(prisma);
  const lead = await newLead(prisma, ws.id);
  await prisma.lead.update({ where: { id: lead.id }, data: { paperclipIssueId: 'i1', state: 'drafting' } });
  const engine = { comments: vi.fn().mockResolvedValue([validDraft]), comment: vi.fn(), createIssue: vi.fn() };

  const out = await handleDraftPoll({ prisma, engine, now: () => new Date('2026-10-01T09:00:00Z') },
    { id: 'j1', leadId: lead.id });

  expect(out).toBe('approved');
  const approval = await prisma.approval.findFirstOrThrow({ where: { leadId: lead.id } });
  expect(approval.state).toBe('issued');
  expect(approval.category).toBe('routine');
  expect(approval.draftText).toContain('happy to help');
  expect(await prisma.job.count({ where: { approvalId: approval.id, kind: 'notice' } })).toBe(1);
  const after = await prisma.lead.findUniqueOrThrow({ where: { id: lead.id } });
  expect(after.state).toBe('awaiting_owner');
});

test('the approval expires 72 hours after the lead arrived', async () => {
  const ws = await newWorkspace(prisma);
  const lead = await newLead(prisma, ws.id);
  await prisma.lead.update({ where: { id: lead.id }, data: { paperclipIssueId: 'i1', state: 'drafting',
    receivedAt: new Date('2026-10-01T06:00:00Z') } });
  const engine = { comments: vi.fn().mockResolvedValue([validDraft]), comment: vi.fn(), createIssue: vi.fn() };
  await handleDraftPoll({ prisma, engine, now: () => new Date('2026-10-01T09:00:00Z') }, { id: 'j1', leadId: lead.id });
  const approval = await prisma.approval.findFirstOrThrow({ where: { leadId: lead.id } });
  expect(approval.expiresAt.toISOString()).toBe('2026-10-04T06:00:00.000Z');
});

test('no comment yet means retry, with no approval created', async () => {
  const ws = await newWorkspace(prisma);
  const lead = await newLead(prisma, ws.id);
  await prisma.lead.update({ where: { id: lead.id }, data: { paperclipIssueId: 'i1', state: 'drafting' } });
  const engine = { comments: vi.fn().mockResolvedValue([]), comment: vi.fn(), createIssue: vi.fn() };
  const out = await handleDraftPoll({ prisma, engine, now: () => new Date() }, { id: 'j1', leadId: lead.id });
  expect(out).toBe('retry');
  expect(await prisma.approval.count({ where: { leadId: lead.id } })).toBe(0);
});

test('a malformed block draws exactly one corrective comment', async () => {
  const ws = await newWorkspace(prisma);
  const lead = await newLead(prisma, ws.id);
  await prisma.lead.update({ where: { id: lead.id }, data: { paperclipIssueId: 'i1', state: 'drafting' } });
  const engine = { comments: vi.fn().mockResolvedValue(['```json\n{"kind":"draft"}\n```']), comment: vi.fn(),
    createIssue: vi.fn() };
  expect(await handleDraftPoll({ prisma, engine, now: () => new Date() }, { id: 'j1', leadId: lead.id })).toBe('corrected');
  expect(engine.comment).toHaveBeenCalledTimes(1);
  // A second malformed answer must not draw a second correction.
  expect(await handleDraftPoll({ prisma, engine, now: () => new Date() }, { id: 'j1', leadId: lead.id })).toBe('failed');
  expect(engine.comment).toHaveBeenCalledTimes(1);
  const after = await prisma.lead.findUniqueOrThrow({ where: { id: lead.id } });
  expect(after.state).toBe('draft_failed');
});

test('ten minutes with no valid draft marks the lead draft_failed', async () => {
  const ws = await newWorkspace(prisma);
  const lead = await newLead(prisma, ws.id);
  const started = new Date('2026-10-01T09:00:00Z');
  await prisma.lead.update({ where: { id: lead.id }, data: { paperclipIssueId: 'i1', state: 'drafting',
    updatedAt: started } });
  const engine = { comments: vi.fn().mockResolvedValue([]), comment: vi.fn(), createIssue: vi.fn() };
  const out = await handleDraftPoll({ prisma, engine, now: () => new Date('2026-10-01T09:10:01Z') },
    { id: 'j1', leadId: lead.id });
  expect(out).toBe('failed');
  const after = await prisma.lead.findUniqueOrThrow({ where: { id: lead.id } });
  expect(after.state).toBe('draft_failed');
});
