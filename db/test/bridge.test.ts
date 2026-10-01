import { afterAll, expect, test, vi } from 'vitest';

import { sendToScout } from '../../frontdesk/src/engine/bridge.ts';
import { newLead, newWorkspace, testPrisma } from './helpers.ts';

const prisma = testPrisma();
const warn = vi.fn();
afterAll(() => prisma.$disconnect());

const setup = { toneSamples: 'Thanks for getting in touch.', facts: 'We do audits. No prices in writing.' };

function fakeEngine() {
  return { createIssue: vi.fn().mockResolvedValue({ issueId: 'i1' }), comments: vi.fn(), comment: vi.fn() };
}

test('the issue carries the body, the tone samples and the facts', async () => {
  const ws = await newWorkspace(prisma);
  const lead = await newLead(prisma, ws.id);
  const engine = fakeEngine();
  await sendToScout({ prisma, engine, setup }, { ...lead, cleanBody: 'Can you quote for an audit?' });
  const args = engine.createIssue.mock.calls[0]![0];
  expect(args.assignee).toBe('scout');
  expect(args.title).toBe('Lead: Audit quote');
  expect(args.body).toContain('Can you quote for an audit?');
  expect(args.body).toContain('Thanks for getting in touch.');
  expect(args.body).toContain('No prices in writing.');
  // Data only: the three labelled sections and nothing else.
  expect(args.body).toBe(
    [
      '## Lead email', 'Can you quote for an audit?',
      '## Owner tone samples', setup.toneSamples,
      '## Firm facts', setup.facts,
    ].join('\n\n'),
  );
});

test('the issue id is stored and a draft_poll job is queued once', async () => {
  const ws = await newWorkspace(prisma);
  const lead = await newLead(prisma, ws.id);
  const engine = fakeEngine();
  await sendToScout({ prisma, engine, setup }, { ...lead, cleanBody: 'hello' });
  await sendToScout({ prisma, engine, setup }, { ...lead, cleanBody: 'hello' });
  const stored = await prisma.lead.findUniqueOrThrow({ where: { id: lead.id } });
  expect(engine.createIssue).toHaveBeenCalledTimes(1);
  expect(stored.paperclipIssueId).toBe('i1');
  expect(stored.state).toBe('drafting');
  const jobs = await prisma.job.findMany({ where: { leadId: lead.id, kind: 'draft_poll' } });
  expect(jobs).toHaveLength(1);
  expect(jobs[0]!.dedupeKey).toBe(`draft_poll:${lead.id}`);
  expect(jobs[0]!.maxAttempts).toBe(40);
  expect(jobs[0]!.runAt.getTime()).toBeGreaterThan(Date.now());
});

test('a lead that already has an issue id and no job gets the job and no new issue', async () => {
  const ws = await newWorkspace(prisma);
  const lead = await newLead(prisma, ws.id);
  await prisma.lead.update({ where: { id: lead.id }, data: { paperclipIssueId: 'old', state: 'drafting' } });
  const engine = fakeEngine();
  const out = await sendToScout({ prisma, engine, setup }, { ...lead, cleanBody: 'hello' });
  expect(out.issueId).toBe('old');
  expect(engine.createIssue).not.toHaveBeenCalled();
  expect(await prisma.job.count({ where: { leadId: lead.id, kind: 'draft_poll' } })).toBe(1);
});

test('losing the race keeps the stored id, warns with ids only, and still queues the job', async () => {
  warn.mockClear();
  const ws = await newWorkspace(prisma);
  const lead = await newLead(prisma, ws.id);
  const engine = fakeEngine();
  engine.createIssue.mockImplementation(async () => {
    // Another call stores its issue between our read and our update.
    await prisma.lead.update({ where: { id: lead.id }, data: { paperclipIssueId: 'winner', state: 'drafting' } });
    return { issueId: 'orphan' };
  });
  const out = await sendToScout({ prisma, engine, setup, log: { warn } }, { ...lead, cleanBody: 'SECRET-LEAD-TEXT' });
  const stored = await prisma.lead.findUniqueOrThrow({ where: { id: lead.id } });
  expect(out.issueId).toBe('winner');
  expect(stored.paperclipIssueId).toBe('winner');
  expect(warn).toHaveBeenCalledTimes(1);
  expect(warn.mock.calls[0]![0]).toEqual({ leadId: lead.id, storedIssueId: 'winner', orphanIssueId: 'orphan' });
  expect(JSON.stringify(warn.mock.calls)).not.toContain('SECRET-LEAD-TEXT');
  expect(await prisma.job.count({ where: { leadId: lead.id, kind: 'draft_poll' } })).toBe(1);
});
