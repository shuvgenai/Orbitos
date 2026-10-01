import type { PrismaClient } from '@orbit/db/client';
import { enqueueJob } from '@orbit/db/jobs';
import { pino } from 'pino';
import type { EnginePort } from './port.ts';

const log = pino({ name: 'frontdesk-bridge' });

export type SetupInputs = { toneSamples: string; facts: string };
export type BridgeDeps = {
  prisma: PrismaClient;
  engine: EnginePort;
  setup: SetupInputs;
  log?: Pick<typeof log, 'warn'>;
};
export type LeadForDraft = { id: string; workspaceId: string; subject: string; cleanBody: string };

const POLL_DELAY_MS = 15_000;
const POLL_MAX_ATTEMPTS = 40; // 15s interval across the 10-minute draft timeout

const storedIssueId = async (prisma: PrismaClient, leadId: string) =>
  (await prisma.lead.findUniqueOrThrow({ where: { id: leadId }, select: { paperclipIssueId: true } }))
    .paperclipIssueId;

// Idempotent per lead: a stored issue id is reused, never replaced, so a retry cannot start a second Scout run.
export async function sendToScout(deps: BridgeDeps, lead: LeadForDraft): Promise<{ issueId: string }> {
  let issueId = await storedIssueId(deps.prisma, lead.id);
  if (issueId === null) {
    const created = await deps.engine.createIssue({
      assignee: 'scout',
      title: `Lead: ${lead.subject}`,
      // Scout's instructions live in its Paperclip profile (Stage 0b). The issue carries data only.
      body: [
        '## Lead email', lead.cleanBody,
        '## Owner tone samples', deps.setup.toneSamples,
        '## Firm facts', deps.setup.facts,
      ].join('\n\n'),
    });
    // Claim the slot only if nobody else has: a stored id is never overwritten.
    const { count } = await deps.prisma.lead.updateMany({
      where: { id: lead.id, paperclipIssueId: null },
      data: { paperclipIssueId: created.issueId, state: 'drafting' },
    });
    if (count === 1) {
      issueId = created.issueId;
    } else {
      issueId = (await storedIssueId(deps.prisma, lead.id))!;
      (deps.log ?? log).warn(
        { leadId: lead.id, storedIssueId: issueId, orphanIssueId: created.issueId },
        'bridge: lost the race, orphan issue created; keeping the stored issue id',
      );
    }
  }
  // Always last and unconditional: the unique key dedupes it, and it repairs a lead left drafting with no job.
  await enqueueJob(deps.prisma, {
    workspaceId: lead.workspaceId,
    kind: 'draft_poll',
    dedupeKey: `draft_poll:${lead.id}`, // one poll job per lead, enforced by the unique key
    leadId: lead.id,
    runAt: new Date(Date.now() + POLL_DELAY_MS),
    maxAttempts: POLL_MAX_ATTEMPTS,
  });
  return { issueId };
}
