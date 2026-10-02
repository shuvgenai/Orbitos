import type { JobKind } from '@orbit/shared/jobs';
import type { PrismaClient } from './client.ts';
import { Prisma } from './generated/prisma/client.ts';

export type EnqueueInput = {
  workspaceId: string;
  kind: JobKind;
  dedupeKey: string;
  runAt?: Date;
  leadId?: string;
  approvalId?: string;
  payload?: Prisma.InputJsonValue;
  maxAttempts?: number;
};

export type ClaimedJob = {
  workspaceId: string;
  id: string;
  kind: JobKind;
  attempts: number;
  maxAttempts: number;
  payload: unknown;
  leadId: string | null;
  approvalId: string | null;
};

export async function enqueueJob(prisma: PrismaClient, input: EnqueueInput): Promise<{ id: string; created: boolean }> {
  const { count } = await prisma.job.createMany({ data: [input], skipDuplicates: true });
  const job = await prisma.job.findUniqueOrThrow({ where: { dedupeKey: input.dedupeKey }, select: { id: true } });
  return { id: job.id, created: count === 1 };
}

// Claims due jobs, and jobs whose lease expired (a crashed worker), with SKIP LOCKED so
// concurrent workers never share a job. Jobs out of attempts are left for markStuckJobsDead.
export async function claimDueJobs(
  prisma: PrismaClient,
  workerId: string,
  opts: { limit?: number; leaseSeconds?: number; kinds?: readonly JobKind[] } = {},
): Promise<ClaimedJob[]> {
  const limit = opts.limit ?? 10;
  const leaseSeconds = opts.leaseSeconds ?? 120;
  // A program claims only the kinds it can run, so it never leases (and fails) another program's job.
  const kindFilter = opts.kinds ? Prisma.sql`AND kind::text = ANY(${[...opts.kinds]}::text[])` : Prisma.empty;
  return prisma.$queryRaw<ClaimedJob[]>`
    UPDATE jobs
    SET state = 'running',
        attempts = attempts + 1,
        locked_by = ${workerId},
        locked_until = now() + make_interval(secs => ${leaseSeconds}),
        updated_at = now()
    WHERE id IN (
      SELECT id FROM jobs
      WHERE attempts < max_attempts
        AND ((state = 'pending' AND run_at <= now())
          OR (state = 'running' AND locked_until < now()))
        ${kindFilter}
      ORDER BY run_at
      LIMIT ${limit}
      FOR UPDATE SKIP LOCKED
    )
    RETURNING id, workspace_id AS "workspaceId", kind::text AS kind, attempts, max_attempts AS "maxAttempts", payload,
              lead_id AS "leadId", approval_id AS "approvalId"`;
}

export async function completeJob(prisma: PrismaClient, id: string, workerId: string): Promise<boolean> {
  const { count } = await prisma.job.updateMany({
    where: { id, lockedBy: workerId, state: 'running' },
    data: { state: 'done', lockedBy: null, lockedUntil: null },
  });
  return count === 1;
}

// One conditional UPDATE decides retry vs dead from the row's own attempts, so there is no
// read-then-write window: only the current lease holder can change the job.
export async function failJob(
  prisma: PrismaClient,
  id: string,
  workerId: string,
  error: string,
  retryAt: Date,
): Promise<'retry' | 'dead' | 'lost'> {
  const rows = await prisma.$queryRaw<{ state: 'pending' | 'dead' }[]>`
    UPDATE jobs
    SET state = CASE WHEN attempts >= max_attempts THEN 'dead'::job_state ELSE 'pending'::job_state END,
        run_at = CASE WHEN attempts >= max_attempts THEN run_at ELSE ${retryAt}::timestamptz END,
        last_error = ${error.slice(0, 2000)},
        locked_by = NULL,
        locked_until = NULL,
        updated_at = now()
    WHERE id = ${id}::uuid AND locked_by = ${workerId} AND state = 'running'
    RETURNING state::text AS state`;
  const row = rows[0];
  if (!row) return 'lost';
  return row.state === 'dead' ? 'dead' : 'retry';
}

// For a failure that retrying cannot fix (and might make worse, e.g. by paying for a second engine run).
// Same lease guard as failJob: only the current holder can end the job.
export async function deadJob(prisma: PrismaClient, id: string, workerId: string, error: string): Promise<boolean> {
  const { count } = await prisma.job.updateMany({
    where: { id, lockedBy: workerId, state: 'running' },
    data: { state: 'dead', lastError: error.slice(0, 2000), lockedBy: null, lockedUntil: null },
  });
  return count === 1;
}

// Called by the reconciler: jobs whose worker died on their last attempt become dead
// (and alert, in Stage 1) instead of staying in running forever.
export async function markStuckJobsDead(prisma: PrismaClient): Promise<number> {
  // Compared against the database clock, the same one claimDueJobs used to set the lease.
  return prisma.$executeRaw`
    UPDATE jobs
    SET state = 'dead', last_error = 'lease expired on final attempt',
        locked_by = NULL, locked_until = NULL, updated_at = now()
    WHERE state = 'running' AND locked_until < now() AND attempts >= max_attempts`;
}
