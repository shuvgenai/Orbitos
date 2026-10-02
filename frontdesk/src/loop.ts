import type { PrismaClient } from '@orbit/db/client';
import { claimDueJobs, completeJob, deadJob, failJob, markStuckJobsDead, type ClaimedJob } from '@orbit/db/jobs';
import type { MailerPort } from '@orbit/shared/mailer';
import { pino } from 'pino';
import { sendOwnerAlert, UnknownAlertError } from './alert.ts';
import { handleDraftPoll } from './engine/draft-poll.ts';
import { failLead } from './fail-lead.ts';
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
class NotRetryable extends Error {
  // The reason is a fixed string written in this file, so it is safe to record.
  override name = 'NotRetryable';
}
const isNotRetryable = (err: unknown): boolean =>
  err instanceof NotRetryable || (err as { retryable?: unknown } | null)?.retryable === false;

/** Content-free: a name and, when present, an HTTP status. Never the message, which can echo a lead. */
function describe(err: unknown): string {
  const name = err instanceof Error ? err.name : typeof err;
  if (err instanceof NotRetryable) return `${name}: ${err.message}`;
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
      // No approval: an owner alert (a lost Gmail connection, a stalled lead). It is mailed, and retried like a notice.
      if (job.approvalId === null) {
        try {
          await sendOwnerAlert({ prisma: deps.prisma, mailer: deps.mailer }, job);
        } catch (err) {
          // A payload this program cannot read will never become readable: do not retry it.
          if (err instanceof UnknownAlertError) throw new NotRetryable(err.message);
          throw err;
        }
        return 'done';
      }
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

/**
 * A job that will never run again must not leave its subject silent. A dead draft_poll leaves the lead
 * drafting with nothing left to move it, so it fails the lead (which alerts the owner). A dead notice means
 * the owner was never told a reply is waiting: say so at error level, with the approval id, so it is seen.
 */
async function onJobDead(deps: LoopDeps, job: ClaimedJob): Promise<void> {
  try {
    if (job.kind === 'draft_poll' && job.leadId !== null) {
      await failLead(deps.prisma, { leadId: job.leadId, from: ['drafting'], reason: 'draft_poll_job_dead' });
    } else if (job.kind === 'notice') {
      log.error({ jobId: job.id, approvalId: job.approvalId, leadId: job.leadId }, 'notice job is dead: the owner was not told');
    }
  } catch (err) {
    // The drafting sweep finds the lead on its next pass, so this is logged, not rethrown into the job loop.
    log.error({ jobId: job.id, errName: err instanceof Error ? err.name : typeof err }, 'could not react to a dead job');
  }
}

export async function runJobLoop(
  deps: LoopDeps,
  opts: { workerId: string; limit: number },
): Promise<{ claimed: number }> {
  // A worker that died on a job's last attempt leaves it running forever; claimDueJobs will not touch it again.
  // Reaping is cheap and idempotent. The lead behind a reaped draft_poll is found by the drafting sweep.
  const reaped = await markStuckJobsDead(deps.prisma);
  if (reaped > 0) log.error({ reaped }, 'jobs whose worker died on the final attempt were marked dead');
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
        const ended = await deadJob(deps.prisma, job.id, opts.workerId, error);
        log.error({ jobId: job.id, kind: job.kind, error }, 'job is not retryable, marked dead');
        if (ended) await onJobDead(deps, job);
      } else {
        const outcome = await failJob(
          deps.prisma, job.id, opts.workerId, error, new Date(Date.now() + ERROR_BACKOFF_MS * job.attempts),
        );
        log.warn({ jobId: job.id, kind: job.kind, attempts: job.attempts, error, outcome }, 'job failed');
        if (outcome === 'dead') await onJobDead(deps, job);
      }
    }
  }
  return { claimed: jobs.length };
}
