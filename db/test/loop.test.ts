import { afterAll, beforeEach, expect, test, vi } from 'vitest';
import { enqueueJob } from '../../db/src/jobs.ts';
import { runJobLoop } from '../../frontdesk/src/loop.ts';
import { newApproval, newWorkspace, testPrisma, withOwner } from './helpers.ts';

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

test('a job that can never succeed dies on the first attempt with a clear, content-free reason', async () => {
  const ws = await newWorkspace(prisma);
  const job = await enqueueJob(prisma, { workspaceId: ws.id, kind: 'draft_poll', dedupeKey: 'loop:no-lead', maxAttempts: 5 });
  await runJobLoop(deps(), { workerId: 'w', limit: 10 });
  expect(await prisma.job.findUniqueOrThrow({ where: { id: job.id } })).toMatchObject({
    state: 'dead', attempts: 1, lastError: 'NotRetryable: draft_poll job has no lead',
  });
});

test('an ordinary failure is retried later with a backoff, not killed', async () => {
  const ws = await newWorkspace(prisma);
  await withOwner(prisma, ws.id, 'owner@example.com');
  const approval = await newApproval(prisma, ws.id);
  const job = await enqueueJob(prisma, { workspaceId: ws.id, kind: 'notice', dedupeKey: 'loop:mail-down', maxAttempts: 5,
    approvalId: approval.id });
  const d = deps();
  d.mailer.send.mockRejectedValue(new Error('resend down'));
  await runJobLoop(d, { workerId: 'w', limit: 10 });
  const row = await prisma.job.findUniqueOrThrow({ where: { id: job.id } });
  expect(row).toMatchObject({ state: 'pending', attempts: 1, lastError: 'Error' });
  expect(row.runAt.getTime()).toBeGreaterThan(Date.now() + 20_000); // 30 s * attempts
});
