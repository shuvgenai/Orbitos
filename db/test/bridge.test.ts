import { afterAll, expect, test, vi } from 'vitest';
import { sendToScout } from '../../frontdesk/src/engine/bridge.ts';
import { newLead, newWorkspace, testPrisma } from './helpers.ts';

const prisma = testPrisma();
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
  expect(stored.paperclipIssueId).toBe('i1');
  expect(stored.state).toBe('drafting');
  const jobs = await prisma.job.findMany({ where: { leadId: lead.id, kind: 'draft_poll' } });
  expect(jobs).toHaveLength(1);
  expect(jobs[0]!.dedupeKey).toBe(`draft_poll:${lead.id}`);
  expect(jobs[0]!.maxAttempts).toBe(40);
  expect(jobs[0]!.runAt.getTime()).toBeGreaterThan(Date.now());
});
