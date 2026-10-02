import { afterAll, beforeEach, expect, test, vi } from 'vitest';
import { claimDueJobs, enqueueJob } from '../src/jobs.ts';
import { runJobLoop } from '../../frontdesk/src/loop.ts';
import { advanceLeads } from '../../frontdesk/src/pipeline.ts';
import { newLead, newWorkspace, testPrisma, withOwner } from './helpers.ts';

// C2, I3: a lead in `drafting` is moved only by its draft_poll job. When that job can no longer run, the lead
// must be failed and the owner told, never left drafting forever.
const prisma = testPrisma();
afterAll(() => prisma.$disconnect());
beforeEach(() => prisma.job.deleteMany());

const deps = () => ({
  prisma,
  engine: { createIssue: vi.fn(), comments: vi.fn(), comment: vi.fn() },
  mailer: { send: vi.fn() },
  baseUrl: 'https://orbit.example',
  secret: 's'.repeat(32),
  now: () => new Date(),
});
const pipeline = (workspaceId: string) => ({
  prisma, workspaceId, setup: { toneSamples: 't', facts: 'f' },
  classifier: { ask: vi.fn() }, engine: { createIssue: vi.fn(), comments: vi.fn(), comment: vi.fn() },
});

async function draftingLead(workspaceId: string, ageMs = 0) {
  const lead = await newLead(prisma, workspaceId);
  await prisma.lead.update({
    where: { id: lead.id },
    data: { state: 'drafting', paperclipIssueId: 'issue-1', updatedAt: new Date(Date.now() - ageMs) },
  });
  return lead;
}
const stateOf = async (id: string) => (await prisma.lead.findUniqueOrThrow({ where: { id } })).state;
const alertsFor = (leadId: string) => prisma.job.findMany({ where: { leadId, kind: 'notice', approvalId: null } });

test('a draft_poll job that dies on its last attempt fails the lead and queues an alert the owner receives', async () => {
  const ws = await newWorkspace(prisma);
  await withOwner(prisma, ws.id, 'owner@example.com');
  const lead = await draftingLead(ws.id);
  await enqueueJob(prisma, { workspaceId: ws.id, kind: 'draft_poll', dedupeKey: `draft_poll:${lead.id}`, leadId: lead.id, maxAttempts: 1 });
  const d = deps();
  d.engine.comments.mockRejectedValue(Object.assign(new Error('boom'), { status: 502 })); // Paperclip is down
  await runJobLoop(d, { workerId: 'w', limit: 10 });

  expect(await stateOf(lead.id)).toBe('draft_failed');
  expect(await alertsFor(lead.id)).toHaveLength(1);
  // The alert is mailed on the next beat, as fixed text that names no customer content.
  await runJobLoop(d, { workerId: 'w', limit: 10 });
  expect(d.mailer.send).toHaveBeenCalledTimes(1);
  const mail = d.mailer.send.mock.calls[0]![0];
  expect(mail.to).toBe('owner@example.com');
  expect(mail.headers).toEqual({ 'X-Orbitcrew': '1' });
  expect(mail.text).toContain('could not be drafted');
  expect(mail.text).toContain('Nothing was sent to the customer');
});

test('a failing engine past the 10-minute window fails the lead on the timeout, not the attempt counter', async () => {
  const ws = await newWorkspace(prisma);
  const lead = await draftingLead(ws.id);
  const job = await enqueueJob(prisma, { workspaceId: ws.id, kind: 'draft_poll', dedupeKey: `draft_poll:${lead.id}`, leadId: lead.id, maxAttempts: 60 });
  const d = deps();
  d.engine.comments.mockRejectedValue(Object.assign(new Error('boom'), { status: 502 }));

  await runJobLoop(d, { workerId: 'w', limit: 10 });
  expect(await stateOf(lead.id)).toBe('drafting'); // inside the window: retried
  expect((await prisma.job.findUniqueOrThrow({ where: { id: job.id } })).state).toBe('pending');

  await prisma.job.update({ where: { id: job.id }, data: { runAt: new Date(Date.now() - 1000) } });
  d.now = () => new Date(Date.now() + 11 * 60_000);
  await runJobLoop(d, { workerId: 'w', limit: 10 });
  expect(await stateOf(lead.id)).toBe('draft_failed');
  expect(await alertsFor(lead.id)).toHaveLength(1);
});

test('the sweep fails a drafting lead whose poll job is dead or absent, and leaves live and fresh ones alone', async () => {
  const ws = await newWorkspace(prisma);
  const noJob = await draftingLead(ws.id, 5 * 60_000);
  const deadJobLead = await draftingLead(ws.id, 5 * 60_000);
  const live = await draftingLead(ws.id, 5 * 60_000);
  const fresh = await draftingLead(ws.id, 10_000); // handed to Scout a moment ago: its job may not exist yet
  await enqueueJob(prisma, { workspaceId: ws.id, kind: 'draft_poll', dedupeKey: `draft_poll:${deadJobLead.id}`, leadId: deadJobLead.id });
  await prisma.job.update({ where: { dedupeKey: `draft_poll:${deadJobLead.id}` }, data: { state: 'dead' } });
  await enqueueJob(prisma, { workspaceId: ws.id, kind: 'draft_poll', dedupeKey: `draft_poll:${live.id}`, leadId: live.id });

  await advanceLeads(pipeline(ws.id));

  expect(await stateOf(noJob.id)).toBe('draft_failed');
  expect(await stateOf(deadJobLead.id)).toBe('draft_failed');
  expect(await stateOf(live.id)).toBe('drafting');
  expect(await stateOf(fresh.id)).toBe('drafting');
  expect(await alertsFor(noJob.id)).toHaveLength(1);
  // Running it again raises no second alert.
  await advanceLeads(pipeline(ws.id));
  expect(await alertsFor(noJob.id)).toHaveLength(1);
});

test('I3: a worker that died on the final attempt is reaped by the loop, and its lead is then failed', async () => {
  const ws = await newWorkspace(prisma);
  const lead = await draftingLead(ws.id, 5 * 60_000);
  const job = await enqueueJob(prisma, { workspaceId: ws.id, kind: 'draft_poll', dedupeKey: `draft_poll:${lead.id}`, leadId: lead.id, maxAttempts: 1 });
  await claimDueJobs(prisma, 'crashed'); // takes the only attempt, then the worker dies
  await prisma.job.update({ where: { id: job.id }, data: { lockedUntil: new Date(Date.now() - 1000) } });
  expect((await prisma.job.findUniqueOrThrow({ where: { id: job.id } })).state).toBe('running');

  await runJobLoop(deps(), { workerId: 'w', limit: 10 });
  expect((await prisma.job.findUniqueOrThrow({ where: { id: job.id } })).state).toBe('dead');

  await advanceLeads(pipeline(ws.id));
  expect(await stateOf(lead.id)).toBe('draft_failed');
});
