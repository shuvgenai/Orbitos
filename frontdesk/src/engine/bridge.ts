import type { PrismaClient } from '@orbit/db/client';
import { enqueueJob } from '@orbit/db/jobs';
import type { EnginePort } from './port.ts';

export type SetupInputs = { toneSamples: string; facts: string };
export type BridgeDeps = { prisma: PrismaClient; engine: EnginePort; setup: SetupInputs };
export type LeadForDraft = { id: string; workspaceId: string; subject: string; cleanBody: string };

const POLL_DELAY_MS = 15_000;
const POLL_MAX_ATTEMPTS = 40; // 15s interval across the 10-minute draft timeout

export async function sendToScout(deps: BridgeDeps, lead: LeadForDraft): Promise<{ issueId: string }> {
  const { issueId } = await deps.engine.createIssue({
    assignee: 'scout',
    title: `Lead: ${lead.subject}`,
    // Scout's instructions live in its Paperclip profile (Stage 0b). The issue carries data only.
    body: [
      '## Lead email', lead.cleanBody,
      '## Owner tone samples', deps.setup.toneSamples,
      '## Firm facts', deps.setup.facts,
    ].join('\n\n'),
  });
  await deps.prisma.lead.update({ where: { id: lead.id }, data: { paperclipIssueId: issueId, state: 'drafting' } });
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
