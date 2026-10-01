// db/test/draft-poll.test.ts
import { createHash } from 'node:crypto';
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
  expect((await prisma.job.findFirstOrThrow({ where: { approvalId: approval.id, kind: 'notice' } })).dedupeKey)
    .toBe(`notice:${approval.id}`);
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

const malformed = '```json\n{"kind":"draft"}\n```';
const malformed2 = '```json\n{"kind":"draft","schemaVersion":1}\n```';

async function draftingLead() {
  const ws = await newWorkspace(prisma);
  const lead = await newLead(prisma, ws.id);
  await prisma.lead.update({ where: { id: lead.id }, data: { paperclipIssueId: 'i1', state: 'drafting' } });
  return lead;
}

test('a malformed block draws exactly one corrective comment', async () => {
  const lead = await draftingLead();
  const engine = { comments: vi.fn().mockResolvedValue([malformed]), comment: vi.fn(), createIssue: vi.fn() };
  expect(await handleDraftPoll({ prisma, engine, now: () => new Date() }, { id: 'j1', leadId: lead.id })).toBe('corrected');
  expect(engine.comment).toHaveBeenCalledTimes(1);
});

test('the same corrected comment seen again is a retry, not a second failure', async () => {
  const lead = await draftingLead();
  const engine = { comments: vi.fn().mockResolvedValue([malformed]), comment: vi.fn(), createIssue: vi.fn() };
  const deps = { prisma, engine, now: () => new Date() };
  expect(await handleDraftPoll(deps, { id: 'j1', leadId: lead.id })).toBe('corrected');
  expect(await handleDraftPoll(deps, { id: 'j1', leadId: lead.id })).toBe('retry');
  expect(engine.comment).toHaveBeenCalledTimes(1);
  expect((await prisma.lead.findUniqueOrThrow({ where: { id: lead.id } })).state).toBe('drafting');
  const job = await prisma.job.findUniqueOrThrow({ where: { dedupeKey: `draft_poll:${lead.id}` } });
  expect(job.payload).toEqual({ corrective_comment_posted: true,
    corrected_comment_sha256: createHash('sha256').update(malformed).digest('hex') });
});

test('a different malformed comment after the correction fails the lead', async () => {
  const lead = await draftingLead();
  const engine = { comments: vi.fn().mockResolvedValue([malformed]), comment: vi.fn(), createIssue: vi.fn() };
  const deps = { prisma, engine, now: () => new Date() };
  expect(await handleDraftPoll(deps, { id: 'j1', leadId: lead.id })).toBe('corrected');
  engine.comments.mockResolvedValue([malformed, malformed2]);
  expect(await handleDraftPoll(deps, { id: 'j1', leadId: lead.id })).toBe('failed');
  expect(engine.comment).toHaveBeenCalledTimes(1);
  expect((await prisma.lead.findUniqueOrThrow({ where: { id: lead.id } })).state).toBe('draft_failed');
});

test('ten minutes with no valid draft marks the lead draft_failed', async () => {
  const ws = await newWorkspace(prisma);
  const lead = await newLead(prisma, ws.id);
  const started = new Date('2026-10-01T09:00:00Z');
  await prisma.lead.update({ where: { id: lead.id }, data: { paperclipIssueId: 'i1', state: 'drafting' } });
  // The window runs from the draft_poll job's creation, not from the lead's (movable) updatedAt.
  await prisma.job.create({ data: { workspaceId: ws.id, kind: 'draft_poll', dedupeKey: `draft_poll:${lead.id}`,
    leadId: lead.id, createdAt: started } });
  const engine = { comments: vi.fn().mockResolvedValue([]), comment: vi.fn(), createIssue: vi.fn() };
  const out = await handleDraftPoll({ prisma, engine, now: () => new Date('2026-10-01T09:10:01Z') },
    { id: 'j1', leadId: lead.id });
  expect(out).toBe('failed');
  const after = await prisma.lead.findUniqueOrThrow({ where: { id: lead.id } });
  expect(after.state).toBe('draft_failed');
});

test('the lead.updatedAt fallback times out a lead that has no draft_poll job row', async () => {
  const ws = await newWorkspace(prisma);
  const lead = await newLead(prisma, ws.id);
  await prisma.lead.update({ where: { id: lead.id }, data: { paperclipIssueId: 'i1', state: 'drafting',
    updatedAt: new Date('2026-10-01T09:00:00Z') } });
  const engine = { comments: vi.fn().mockResolvedValue([]), comment: vi.fn(), createIssue: vi.fn() };
  expect(await handleDraftPoll({ prisma, engine, now: () => new Date('2026-10-01T09:10:01Z') },
    { id: 'j1', leadId: lead.id })).toBe('failed');
  expect((await prisma.lead.findUniqueOrThrow({ where: { id: lead.id } })).state).toBe('draft_failed');
});

test('a valid draft followed by a malformed comment still becomes an approval, with no correction', async () => {
  const lead = await draftingLead();
  const engine = { comments: vi.fn().mockResolvedValue([validDraft, malformed]), comment: vi.fn(), createIssue: vi.fn() };
  expect(await handleDraftPoll({ prisma, engine, now: () => new Date() }, { id: 'j1', leadId: lead.id })).toBe('approved');
  expect(engine.comment).not.toHaveBeenCalled();
  expect((await prisma.lead.findUniqueOrThrow({ where: { id: lead.id } })).state).toBe('awaiting_owner');
});

test('two concurrent polls make exactly one approval and one notice', async () => {
  const lead = await draftingLead();
  const engine = { comments: vi.fn().mockResolvedValue([validDraft]), comment: vi.fn(), createIssue: vi.fn() };
  const deps = { prisma, engine, now: () => new Date() };
  const outs = await Promise.all([handleDraftPoll(deps, { id: 'j1', leadId: lead.id }),
    handleDraftPoll(deps, { id: 'j1', leadId: lead.id })]);
  expect(outs).toEqual(['approved', 'approved']);
  expect(await prisma.approval.count({ where: { leadId: lead.id } })).toBe(1);
  expect(await prisma.job.count({ where: { leadId: lead.id, kind: 'notice' } })).toBe(1);
});

test('a JSON fence in another case still draws the one correction', async () => {
  const lead = await draftingLead();
  const engine = { comments: vi.fn().mockResolvedValue(['```JSON\n{"kind":"draft"}\n```']), comment: vi.fn(),
    createIssue: vi.fn() };
  expect(await handleDraftPoll({ prisma, engine, now: () => new Date() }, { id: 'j1', leadId: lead.id })).toBe('corrected');
  expect(engine.comment).toHaveBeenCalledTimes(1);
});

test('a comment with no fence is not a draft attempt: no correction, just retry', async () => {
  const lead = await draftingLead();
  const engine = { comments: vi.fn().mockResolvedValue(['{"kind":"draft"}', 'working on it']), comment: vi.fn(),
    createIssue: vi.fn() };
  expect(await handleDraftPoll({ prisma, engine, now: () => new Date() }, { id: 'j1', leadId: lead.id })).toBe('retry');
  expect(engine.comment).not.toHaveBeenCalled();
});

test('a drafting lead with no issue is failed visibly', async () => {
  const ws = await newWorkspace(prisma);
  const lead = await newLead(prisma, ws.id);
  await prisma.lead.update({ where: { id: lead.id }, data: { state: 'drafting' } });
  const engine = { comments: vi.fn(), comment: vi.fn(), createIssue: vi.fn() };
  expect(await handleDraftPoll({ prisma, engine, now: () => new Date() }, { id: 'j1', leadId: lead.id })).toBe('failed');
  expect((await prisma.lead.findUniqueOrThrow({ where: { id: lead.id } })).state).toBe('draft_failed');
});
