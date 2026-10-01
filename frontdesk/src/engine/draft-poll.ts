import { createHash } from 'node:crypto';
import type { PrismaClient } from '@orbit/db/client';
import { enqueueJob } from '@orbit/db/jobs';
import { parseAgentComment } from '@orbit/shared/agent-output';
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
const FENCE_MARKER = '```json';

// A fixed string: it never echoes Scout's output, which is derived from a customer's email.
const CORRECTION =
  'Your last comment was not a valid draft block. Reply with exactly one ```json block holding ' +
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
  if (lead.state !== 'drafting' || lead.paperclipIssueId === null) {
    return lead.state === 'awaiting_owner' ? 'approved' : 'failed';
  }

  // The window starts when the bridge handed the lead to Scout: the draft_poll job's createdAt, which is
  // written once and never rewritten. lead.updatedAt moves on any write to the lead, so it is only the
  // fallback for a lead with no job row.
  const pollJob = await prisma.job.findUnique({
    where: { dedupeKey: `draft_poll:${lead.id}` },
    select: { createdAt: true },
  });
  const startedAt = (pollJob?.createdAt ?? lead.updatedAt).getTime();
  const timedOut = () => deps.now().getTime() - startedAt > DRAFT_TIMEOUT_MS;

  const all = await deps.engine.comments(lead.paperclipIssueId);
  // Only the newest comment that carries a JSON block is judged; prose-only comments are not drafts.
  const candidate = [...all].reverse().find((c) => c.includes(FENCE_MARKER));

  if (candidate === undefined) {
    return timedOut() ? failLead(deps, lead.id, 'timeout') : 'retry';
  }

  const parsed = parseAgentComment(candidate, 'draft');
  if (!parsed.ok) {
    // parsed.error can embed the model's own text, so it is never logged.
    const row = await enqueueJob(prisma, {
      workspaceId: lead.workspaceId,
      kind: 'draft_poll',
      dedupeKey: `draft_poll:${lead.id}`, // the bridge's key: finds the real row, or repairs a missing one
      leadId: lead.id,
    });
    const sha = createHash('sha256').update(candidate).digest('hex');
    const stored = (await prisma.job.findUniqueOrThrow({ where: { id: row.id }, select: { payload: true } })).payload as
      | { corrective_comment_posted?: boolean; corrected_comment_sha256?: string }
      | null;
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
  if (parsed.block.kind !== 'draft') return failLead(deps, lead.id, 'wrong_kind'); // unreachable: parse enforces it
  const draft = parsed.block;

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
        category: draft.category,
        draftText: draft.draft,
        reason: draft.reason,
        expiresAt: new Date(lead.receivedAt.getTime() + APPROVAL_WINDOW_MS),
      },
      select: { id: true },
    });
    await tx.job.createMany({
      data: [{
        workspaceId: lead.workspaceId,
        kind: 'notice',
        dedupeKey: `notice:${approval.id}`,
        leadId: lead.id,
        approvalId: approval.id,
      }],
      skipDuplicates: true,
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
