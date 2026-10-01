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
async function claimCorrection(prisma: PrismaClient, jobId: string): Promise<boolean> {
  const count = await prisma.$executeRaw`
    UPDATE jobs
    SET payload = payload || '{"corrective_comment_posted": true}'::jsonb, updated_at = now()
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

  const all = await deps.engine.comments(lead.paperclipIssueId);
  // Only the newest comment that carries a JSON block is judged; prose-only comments are not drafts.
  const candidate = [...all].reverse().find((c) => c.includes(FENCE_MARKER));

  if (candidate === undefined) {
    const startedAt = lead.updatedAt.getTime(); // Task 8 moved the lead to drafting at this instant
    if (deps.now().getTime() - startedAt > DRAFT_TIMEOUT_MS) return failLead(deps, lead.id, 'timeout');
    return 'retry';
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
    if (!(await claimCorrection(prisma, row.id))) return failLead(deps, lead.id, 'malformed_after_correction');
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
