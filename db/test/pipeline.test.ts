import { afterAll, expect, test, vi } from 'vitest';
import { advanceLeads } from '../../frontdesk/src/pipeline.ts';
import { newLead, newWorkspace, testPrisma } from './helpers.ts';

const prisma = testPrisma();
afterAll(() => prisma.$disconnect());

const setup = { toneSamples: 't', facts: 'f' };
const answer = (verdict: string) => ({ ask: vi.fn().mockResolvedValue({ verdict, confidence: 0.9, inputTokens: 1, outputTokens: 1, costUsd: 0 }) });
const engine = () => ({ createIssue: vi.fn().mockResolvedValue({ issueId: 'i1' }), comments: vi.fn(), comment: vi.fn() });

async function leadWithBody(workspaceId: string) {
  const lead = await newLead(prisma, workspaceId);
  await prisma.emailBody.create({ data: { leadId: lead.id, rawBody: 'raw', cleanBody: 'Can you quote?', receivedAt: new Date() } });
  return lead;
}

test('a lead verdict hands the lead to Scout and queues its draft poll', async () => {
  const ws = await newWorkspace(prisma);
  const lead = await leadWithBody(ws.id);
  const e = engine();
  expect(await advanceLeads({ prisma, classifier: answer('lead'), engine: e, setup, workspaceId: ws.id })).toEqual({ advanced: 1 });
  expect(e.createIssue).toHaveBeenCalledTimes(1);
  expect(await prisma.lead.findUniqueOrThrow({ where: { id: lead.id } })).toMatchObject({ state: 'drafting', classification: 'lead' });
  expect(await prisma.job.count({ where: { leadId: lead.id, kind: 'draft_poll' } })).toBe(1);
  // Running again does not hand it over twice.
  await advanceLeads({ prisma, classifier: answer('lead'), engine: e, setup, workspaceId: ws.id });
  expect(e.createIssue).toHaveBeenCalledTimes(1);
});

test('not_lead is closed, and unsure or a failed classification waits for a verdict, with no Scout run', async () => {
  const ws = await newWorkspace(prisma);
  const a = await leadWithBody(ws.id);
  const b = await leadWithBody(ws.id);
  const c = await leadWithBody(ws.id);
  const e = engine();
  const verdicts = ['not_lead', 'unsure', 'boom', 'boom']; // a failure is retried once
  const classifier = { ask: vi.fn().mockImplementation(async () => {
    const v = verdicts.shift()!;
    if (v === 'boom') throw new Error('down');
    return { verdict: v, confidence: 0.5, inputTokens: 1, outputTokens: 1, costUsd: 0 };
  }) };
  await advanceLeads({ prisma, classifier, engine: e, setup, workspaceId: ws.id });
  const states = await prisma.lead.findMany({ where: { id: { in: [a.id, b.id, c.id] } }, orderBy: { createdAt: 'asc' } });
  expect(states.map((l) => l.state).sort()).toEqual(['awaiting_verdict', 'awaiting_verdict', 'not_lead']);
  expect(e.createIssue).not.toHaveBeenCalled();
});
