import type { PrismaClient } from '@orbit/db/client';
import { claimDueJobs, completeJob, deadJob, failJob, type ClaimedJob } from '@orbit/db/jobs';
import type { MailerPort } from '@orbit/shared/mailer';
import { pino } from 'pino';
import { handleDraftPoll } from './engine/draft-poll.ts';
import type { EnginePort } from './engine/port.ts';
import { sendNotice } from './notice.ts';

const log = pino({ name: 'frontdesk-loop' });

export type LoopDeps = {
  prisma: PrismaClient;
  engine: EnginePort;
  mailer: MailerPort;
  baseUrl: string;
  secret: string;
  now: () => Date;
};

/** The only kinds this program runs; claiming others would lease and fail a job it cannot do. */
export const FRONTDESK_JOB_KINDS = ['draft_poll', 'notice'] as const;

const ERROR_BACKOFF_MS = 30_000; // times attempts
const POLL_INTERVAL_MS = 15_000; // a deliberate reschedule is a fixed beat, not a growing one

/** An error that says retrying cannot help (and may cost money): see LeadNotDraftableError. */
class NotRetryable extends Error {}
const isNotRetryable = (err: unknown): boolean =>
  err instanceof NotRetryable || (err as { retryable?: unknown } | null)?.retryable === false;

/** Content-free: a name and, when present, an HTTP status. Never the message, which can echo a lead. */
function describe(err: unknown): string {
  const name = err instanceof Error ? err.name : typeof err;
  const status = (err as { status?: unknown } | null)?.status;
  return typeof status === 'number' ? `${name} (status ${status})` : name;
}

/** Returns 'done', or the number of ms to wait before the job runs again. */
async function dispatch(deps: LoopDeps, job: ClaimedJob): Promise<'done' | { retryInMs: number }> {
  switch (job.kind) {
    case 'draft_poll': {
      if (job.leadId === null) throw new NotRetryable('draft_poll job has no lead');
      const outcome = await handleDraftPoll(
        { prisma: deps.prisma, engine: deps.engine, now: deps.now },
        { id: job.id, leadId: job.leadId },
      );
      // 'retry' and 'corrected' mean Scout has not produced a usable draft yet: poll again, never sleep here.
      return outcome === 'retry' || outcome === 'corrected' ? { retryInMs: POLL_INTERVAL_MS } : 'done';
    }
    case 'notice': {
      // The gmail_revoked alert carries no approval; nothing in this slice mails it, so do not retry it.
      if (job.approvalId === null) throw new NotRetryable('notice job has no approval');
      await sendNotice(
        { prisma: deps.prisma, mailer: deps.mailer, baseUrl: deps.baseUrl, secret: deps.secret },
        job.approvalId,
      );
      return 'done';
    }
    default:
      throw new NotRetryable(`no handler for job kind ${job.kind}`);
  }
}

export async function runJobLoop(
  deps: LoopDeps,
  opts: { workerId: string; limit: number },
): Promise<{ claimed: number }> {
  const jobs = await claimDueJobs(deps.prisma, opts.workerId, { limit: opts.limit, kinds: FRONTDESK_JOB_KINDS });
  for (const job of jobs) {
    try {
      const result = await dispatch(deps, job);
      if (result === 'done') await completeJob(deps.prisma, job.id, opts.workerId);
      else await failJob(deps.prisma, job.id, opts.workerId, 'waiting for the next poll', new Date(Date.now() + result.retryInMs));
    } catch (err) {
      const error = describe(err);
      if (isNotRetryable(err)) {
        // Retrying would repeat the work (a second Paperclip issue is a second Scout run and charge).
        await deadJob(deps.prisma, job.id, opts.workerId, error);
        log.error({ jobId: job.id, kind: job.kind, error }, 'job is not retryable, marked dead');
      } else {
        const outcome = await failJob(
          deps.prisma, job.id, opts.workerId, error, new Date(Date.now() + ERROR_BACKOFF_MS * job.attempts),
        );
        log.warn({ jobId: job.id, kind: job.kind, attempts: job.attempts, error, outcome }, 'job failed');
      }
    }
  }
  return { claimed: jobs.length };
}
