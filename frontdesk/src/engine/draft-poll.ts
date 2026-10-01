import { createHash } from 'node:crypto';
import type { PrismaClient } from '@orbit/db/client';
import { type Draft, parseAgentComment } from '@orbit/shared/agent-output';
import { pino } from 'pino';
import type { EnginePort } from './port.ts';

const log = pino({ name: 'frontdesk-draft-poll' });

export type DraftPollDeps = {
  prisma: PrismaClient;
  engine: EnginePort;
  now: () => Date;
  log?: Pick<typeof log, 'info' | 'warn'>;
};
export type DraftPollOutcome = 'approved' | 'retry' | 'corrected' | 'failed';

const DRAFT_TIMEOUT_MS = 10 * 60_000;
const APPROVAL_WINDOW_MS = 72 * 3_600_000;
const FENCE = /```/;

// A fixed string: it never echoes Scout's output, which is derived from a customer's email.
const CORRECTION =
  'Your last comment was not a valid draft block. Reply with exactly one fenced json block holding ' +
  'kind "draft", schemaVersion 1, draft, category, flags and reason, as your instructions describe.';

// Atomic: only one caller can flip the marker, so two polls can never both post the correction.
// It lives on the job row so a worker restart cannot reset it.
// The comment's SHA-256 is stored with it, so the same stale comment is recognised on later polls.
async function claimCorrection(prisma: PrismaClient, jobId: string, sha: string): Promise<boolean> {
  const count = await prisma.$executeRaw`
    UPDATE jobs
    SET payload = payload || jsonb_build_object('corrective_comment_posted', true, 'corrected_comment_sha256', ${sha}::text),
        updated_at = now()
    WHERE id = ${jobId}::uuid
      AND COALESCE(payload->>'corrective_comment_posted', '') <> 'true'`;
  return count === 1;
}

// Moves a lead out of drafting only if it is still drafting, so a late result can never overwrite
// a lead the other path already finished.
// Finds the bridge's draft_poll row, or repairs a missing one. A repaired row is created with
// createdAt = lead.updatedAt, not now, so repairing it does not restart the 10-minute window.
async function jobRow(prisma: PrismaClient, lead: { id: string; workspaceId: string; updatedAt: Date }) {
  const dedupeKey = `draft_poll:${lead.id}`;
  await prisma.job.createMany({
    data: [{ workspaceId: lead.workspaceId, kind: 'draft_poll', dedupeKey, leadId: lead.id, createdAt: lead.updatedAt }],
    skipDuplicates: true,
  });
  return prisma.job.findUniqueOrThrow({ where: { dedupeKey }, select: { id: true, payload: true } });
}

async function failLead(deps: DraftPollDeps, leadId: string, reason: string): Promise<'failed'> {
  const { count } = await deps.prisma.lead.updateMany({
    where: { id: leadId, state: 'drafting' },
    data: { state: 'draft_failed' },
  });
  (deps.log ?? log).warn({ leadId, reason, moved: count === 1 }, 'draft-poll: lead marked draft_failed');
  return 'failed';
}

export async function handleDraftPoll(
  deps: DraftPollDeps,
  job: { id: string; leadId: string },
): Promise<DraftPollOutcome> {
  const { prisma } = deps;
  const lead = await prisma.lead.findUniqueOrThrow({
    where: { id: job.leadId },
    select: { id: true, workspaceId: true, state: true, paperclipIssueId: true, receivedAt: true, updatedAt: true },
  });
  // Already past drafting (an earlier poll won, or the lead finished or failed): nothing left to do.
  if (lead.state !== 'drafting') return lead.state === 'awaiting_owner' ? 'approved' : 'failed';
  // Drafting with no issue means there is nothing to poll: fail it visibly rather than leave it stuck.
  if (lead.paperclipIssueId === null) return failLead(deps, lead.id, 'no_issue');

  // The window starts when the bridge handed the lead to Scout: the draft_poll job's createdAt, which is
  // written once and never rewritten. lead.updatedAt moves on any write to the lead, so it is only the
  // fallback for a lead with no job row (jobRow() below repairs a missing row with that same origin).
  const pollJob = await prisma.job.findUnique({
    where: { dedupeKey: `draft_poll:${lead.id}` },
    select: { createdAt: true },
  });
  const startedAt = (pollJob?.createdAt ?? lead.updatedAt).getTime();
  const timedOut = () => deps.now().getTime() - startedAt > DRAFT_TIMEOUT_MS;

  const all = await deps.engine.comments(lead.paperclipIssueId); // oldest-first (see EnginePort)
  // Any comment with a code fence is a draft attempt, whatever its case or language tag; a comment with no
  // fence is prose and is skipped. Newest first, so the latest good draft wins. Only parseAgentComment
  // decides validity. The correction text has no fence, so Scout's echo of our own comment never counts.
  const attempts = all.filter((c) => FENCE.test(c)).reverse();

  // The first comment that parses as a draft wins, even if malformed comments came after it.
  // A late draft is deliberately accepted while the lead is still drafting: a usable draft beats punctuality,
  // so the timeout below only applies when there is no valid draft.
  let draft: Draft | undefined;
  for (const c of attempts) {
    const parsed = parseAgentComment(c, 'draft');
    if (parsed.ok && parsed.block.kind === 'draft') {
      draft = parsed.block;
      break;
    }
  }

  if (draft === undefined) {
    const newest = attempts[0];
    if (newest === undefined) return timedOut() ? failLead(deps, lead.id, 'timeout') : 'retry';
    // parseAgentComment's error is never logged: it can embed the model's own text.
    const row = await jobRow(prisma, lead);
    const sha = createHash('sha256').update(newest).digest('hex');
    const stored = row.payload as { corrective_comment_posted?: boolean; corrected_comment_sha256?: string } | null;
    if (stored?.corrective_comment_posted === true) {
      // Same comment we already corrected: Scout has not answered yet, so wait (the timeout is the backstop).
      if (stored.corrected_comment_sha256 === sha) return timedOut() ? failLead(deps, lead.id, 'timeout') : 'retry';
      return failLead(deps, lead.id, 'second_malformed_draft');
    }
    if (!(await claimCorrection(prisma, row.id, sha))) return 'retry'; // a concurrent poll just claimed it
    await deps.engine.comment(lead.paperclipIssueId, CORRECTION);
    (deps.log ?? log).info({ leadId: lead.id, issueId: lead.paperclipIssueId, jobId: job.id }, 'draft-poll: correction posted');
    return 'corrected';
  }
  const valid = draft;

  // One transaction: the lead claim, the approval and the notice commit together or not at all.
  // The claim makes a concurrent poll (or one racing the timeout) lose rather than add a second approval.
  const approvalId = await prisma.$transaction(async (tx) => {
    const claim = await tx.lead.updateMany({
      where: { id: lead.id, state: 'drafting' },
      data: { state: 'awaiting_owner' },
    });
    if (claim.count !== 1) return null;
    const approval = await tx.approval.create({
      data: {
        workspaceId: lead.workspaceId,
        leadId: lead.id,
        category: valid.category,
        draftText: valid.draft,
        reason: valid.reason,
        expiresAt: new Date(lead.receivedAt.getTime() + APPROVAL_WINDOW_MS),
      },
      select: { id: true },
    });
    // A plain create: the key holds a fresh approval id, so a conflict is unreachable, and if it ever
    // happened it must roll the approval back rather than leave one nobody is told about.
    await tx.job.create({
      data: {
        workspaceId: lead.workspaceId,
        kind: 'notice',
        dedupeKey: `notice:${approval.id}`,
        leadId: lead.id,
        approvalId: approval.id,
      },
    });
    return approval.id;
  });
  if (approvalId === null) {
    const now = await prisma.lead.findUniqueOrThrow({ where: { id: lead.id }, select: { state: true } });
    return now.state === 'awaiting_owner' ? 'approved' : 'failed';
  }
  (deps.log ?? log).info({ leadId: lead.id, approvalId }, 'draft-poll: approval issued, notice queued');
  return 'approved';
}
