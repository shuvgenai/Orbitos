import { randomUUID } from 'node:crypto';
import { afterAll, beforeEach, expect, test } from 'vitest';
import { claimDueJobs, completeJob, deadJob, enqueueJob, failJob, markStuckJobsDead } from '../src/jobs.ts';
import { newWorkspace, testPrisma } from './helpers.ts';

const prisma = testPrisma();
afterAll(() => prisma.$disconnect());
// Jobs are claimed across workspaces, so each test starts from an empty queue.
beforeEach(() => prisma.job.deleteMany());

const key = () => `test:${randomUUID()}`;

test('enqueue is idempotent on the dedupe key', async () => {
  const ws = await newWorkspace(prisma);
  const dedupeKey = key();
  const first = await enqueueJob(prisma, { workspaceId: ws.id, kind: 'draft_poll', dedupeKey });
  const second = await enqueueJob(prisma, { workspaceId: ws.id, kind: 'draft_poll', dedupeKey });
  expect(first.created).toBe(true);
  expect(second).toEqual({ id: first.id, created: false });
});

test('claim returns only due jobs and leases them', async () => {
  const ws = await newWorkspace(prisma);
  const due = await enqueueJob(prisma, { workspaceId: ws.id, kind: 'notice', dedupeKey: key() });
  await enqueueJob(prisma, { workspaceId: ws.id, kind: 'notice', dedupeKey: key(), runAt: new Date(Date.now() + 60_000) });
  const claimed = await claimDueJobs(prisma, 'w1');
  expect(claimed.map((j) => j.id)).toEqual([due.id]);
  expect(claimed[0]).toMatchObject({ kind: 'notice', attempts: 1 });
  expect(await claimDueJobs(prisma, 'w2')).toEqual([]);
});

test('two concurrent claimers never get the same job', async () => {
  const ws = await newWorkspace(prisma);
  for (let i = 0; i < 20; i++) await enqueueJob(prisma, { workspaceId: ws.id, kind: 'digest', dedupeKey: key() });
  const [a, b] = await Promise.all([
    claimDueJobs(prisma, 'w1', { limit: 20 }),
    claimDueJobs(prisma, 'w2', { limit: 20 }),
  ]);
  const ids = [...a, ...b].map((j) => j.id);
  expect(new Set(ids).size).toBe(ids.length);
  expect(ids).toHaveLength(20);
});

test('an expired lease is reclaimed by another worker', async () => {
  const ws = await newWorkspace(prisma);
  const job = await enqueueJob(prisma, { workspaceId: ws.id, kind: 'send', dedupeKey: key() });
  await claimDueJobs(prisma, 'crashed');
  await prisma.job.update({ where: { id: job.id }, data: { lockedUntil: new Date(Date.now() - 1000) } });
  const reclaimed = await claimDueJobs(prisma, 'w2');
  expect(reclaimed.map((j) => j.id)).toEqual([job.id]);
  expect(reclaimed[0]!.attempts).toBe(2);
});

test('complete only works for the worker holding the lease', async () => {
  const ws = await newWorkspace(prisma);
  const job = await enqueueJob(prisma, { workspaceId: ws.id, kind: 'send', dedupeKey: key() });
  await claimDueJobs(prisma, 'w1');
  expect(await completeJob(prisma, job.id, 'w2')).toBe(false);
  expect(await completeJob(prisma, job.id, 'w1')).toBe(true);
  expect((await prisma.job.findUniqueOrThrow({ where: { id: job.id } })).state).toBe('done');
});

test('fail retries until max attempts, then marks dead', async () => {
  const ws = await newWorkspace(prisma);
  const job = await enqueueJob(prisma, { workspaceId: ws.id, kind: 'send', dedupeKey: key(), maxAttempts: 2 });
  await claimDueJobs(prisma, 'w1');
  expect(await failJob(prisma, job.id, 'w1', 'timeout', new Date(Date.now() - 1))).toBe('retry');
  await claimDueJobs(prisma, 'w1');
  expect(await failJob(prisma, job.id, 'w1', 'timeout', new Date())).toBe('dead');
  const row = await prisma.job.findUniqueOrThrow({ where: { id: job.id } });
  expect(row).toMatchObject({ state: 'dead', lastError: 'timeout', lockedBy: null });
  expect(await failJob(prisma, job.id, 'w1', 'late', new Date())).toBe('lost');
});

test('a job stuck in running past max attempts is marked dead, not left running', async () => {
  const ws = await newWorkspace(prisma);
  const job = await enqueueJob(prisma, { workspaceId: ws.id, kind: 'send', dedupeKey: key(), maxAttempts: 1 });
  await claimDueJobs(prisma, 'crashed');
  await prisma.job.update({ where: { id: job.id }, data: { lockedUntil: new Date(Date.now() - 1000) } });
  expect(await claimDueJobs(prisma, 'w2')).toEqual([]);
  expect(await markStuckJobsDead(prisma)).toBe(1);
  expect((await prisma.job.findUniqueOrThrow({ where: { id: job.id } })).state).toBe('dead');
});

// Review focus: workers crash on every attempt. The job is reclaimed until attempts run
// out, then becomes dead. It is never stuck in running, and a live lease is never killed.
test('repeated worker crashes are reclaimed, then the job ends dead', async () => {
  const ws = await newWorkspace(prisma);
  const job = await enqueueJob(prisma, { workspaceId: ws.id, kind: 'send', dedupeKey: key(), maxAttempts: 3 });
  const expire = () => prisma.job.update({ where: { id: job.id }, data: { lockedUntil: new Date(Date.now() - 1000) } });
  const state = async () => (await prisma.job.findUniqueOrThrow({ where: { id: job.id } })).state;

  for (const attempt of [1, 2, 3]) {
    const claimed = await claimDueJobs(prisma, `crash-${attempt}`);
    expect(claimed.map((j) => j.attempts)).toEqual([attempt]);
    // While the lease is live, the reconciler must leave the job alone.
    expect(await markStuckJobsDead(prisma)).toBe(0);
    expect(await state()).toBe('running');
    await expire();
  }
  expect(await claimDueJobs(prisma, 'w-final')).toEqual([]);
  expect(await markStuckJobsDead(prisma)).toBe(1);
  expect(await state()).toBe('dead');
  expect(await markStuckJobsDead(prisma)).toBe(0);
  expect(await prisma.job.count({ where: { state: 'running' } })).toBe(0);
});

test('claim can be limited to the kinds a program runs', async () => {
  const ws = await newWorkspace(prisma);
  const mine = await enqueueJob(prisma, { workspaceId: ws.id, kind: 'notice', dedupeKey: key() });
  const other = await enqueueJob(prisma, { workspaceId: ws.id, kind: 'digest', dedupeKey: key() });
  const claimed = await claimDueJobs(prisma, 'w1', { kinds: ['notice', 'draft_poll'] });
  expect(claimed.map((j) => j.id)).toEqual([mine.id]);
  expect((await prisma.job.findUniqueOrThrow({ where: { id: other.id } })).state).toBe('pending');
});

test('deadJob ends a running job at once, only for the lease holder', async () => {
  const ws = await newWorkspace(prisma);
  const job = await enqueueJob(prisma, { workspaceId: ws.id, kind: 'send', dedupeKey: key(), maxAttempts: 5 });
  await claimDueJobs(prisma, 'w1');
  expect(await deadJob(prisma, job.id, 'w2', 'nope')).toBe(false);
  expect(await deadJob(prisma, job.id, 'w1', 'not retryable')).toBe(true);
  expect(await prisma.job.findUniqueOrThrow({ where: { id: job.id } })).toMatchObject({
    state: 'dead', lastError: 'not retryable', lockedBy: null,
  });
  expect(await claimDueJobs(prisma, 'w1')).toEqual([]);
});
