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

const emptyLead = async (workspaceId: string, cleanBody: string | null, rawBody: string) => {
  const lead = await newLead(prisma, workspaceId);
  await prisma.emailBody.create({ data: { leadId: lead.id, rawBody, cleanBody, receivedAt: new Date() } });
  return lead;
};

test('I1: an empty cleanBody falls back to the raw body, and an empty message never reaches the classifier', async () => {
  const ws = await newWorkspace(prisma);
  const fallback = await emptyLead(ws.id, '', 'Only the raw text survived');
  const nothing = await emptyLead(ws.id, '', '');
  const classifier = answer('not_lead');
  await advanceLeads({ prisma, classifier, engine: engine(), setup, workspaceId: ws.id });
  expect(classifier.ask).toHaveBeenCalledTimes(1); // the empty one is not sent for a 400
  expect(JSON.stringify(classifier.ask.mock.calls[0])).toContain('Only the raw text survived');
  expect((await prisma.lead.findUniqueOrThrow({ where: { id: fallback.id } })).state).toBe('not_lead');
  expect(await prisma.lead.findUniqueOrThrow({ where: { id: nothing.id } })).toMatchObject({ state: 'awaiting_verdict', classification: 'unsure' });
  const alerts = await prisma.job.findMany({ where: { leadId: nothing.id, kind: 'notice' } });
  expect(alerts.map((j) => j.payload)).toEqual([{ type: 'alert', reason: 'empty_body' }]);
});

test('I6: a lead resting at awaiting_verdict (unsure, or failed twice) alerts the owner once', async () => {
  const ws = await newWorkspace(prisma);
  const unsure = await leadWithBody(ws.id);
  await advanceLeads({ prisma, classifier: answer('unsure'), engine: engine(), setup, workspaceId: ws.id });
  const failing = await leadWithBody(ws.id);
  const classifier = { ask: vi.fn().mockRejectedValue(new Error('down')) };
  await advanceLeads({ prisma, classifier, engine: engine(), setup, workspaceId: ws.id });
  const reasonFor = async (id: string) => (await prisma.job.findMany({ where: { leadId: id, kind: 'notice' } })).map((j) => (j.payload as { reason: string }).reason);
  expect(await reasonFor(unsure.id)).toEqual(['unsure']);
  expect(await reasonFor(failing.id)).toEqual(['classification_failed']);
});

test('I5: a createIssue whose outcome is unknown is tried three times, then the lead goes to a human', async () => {
  const ws = await newWorkspace(prisma);
  const lead = await leadWithBody(ws.id);
  const e = engine();
  e.createIssue.mockRejectedValue(Object.assign(new Error('create issue (no id returned)'), { status: 200 }));
  for (let i = 0; i < 6; i++) await advanceLeads({ prisma, classifier: answer('lead'), engine: e, setup, workspaceId: ws.id });
  expect(e.createIssue).toHaveBeenCalledTimes(3);
  expect(await prisma.lead.findUniqueOrThrow({ where: { id: lead.id } })).toMatchObject({ state: 'draft_failed', issueAttempts: 3 });
  expect((await prisma.job.findMany({ where: { leadId: lead.id, kind: 'notice' } })).map((j) => (j.payload as { reason: string }).reason)).toEqual(['draft_failed']);
});

test('I5: a createIssue refused with an HTTP error created nothing, so it is retried without limit', async () => {
  const ws = await newWorkspace(prisma);
  const lead = await leadWithBody(ws.id);
  const e = engine();
  e.createIssue.mockRejectedValue(Object.assign(new Error('create issue'), { status: 503 }));
  for (let i = 0; i < 5; i++) await advanceLeads({ prisma, classifier: answer('lead'), engine: e, setup, workspaceId: ws.id });
  expect(e.createIssue).toHaveBeenCalledTimes(5);
  expect(await prisma.lead.findUniqueOrThrow({ where: { id: lead.id } })).toMatchObject({ state: 'classifying', issueAttempts: 0 });
});
