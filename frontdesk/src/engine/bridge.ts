import { randomBytes } from 'node:crypto';
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
const TITLE_SUBJECT_MAX = 120;

const read = (prisma: PrismaClient, leadId: string) =>
  prisma.lead.findUniqueOrThrow({ where: { id: leadId }, select: { paperclipIssueId: true, state: true } });

const TERMINAL_STATES = ['sent', 'discarded', 'void', 'resolved', 'not_lead'] as const;

// Thrown before any Paperclip call, so retrying it can never create another issue.
export class LeadNotDraftableError extends Error {
  readonly retryable = false;
  constructor(leadId: string) {
    super(`lead ${leadId} is no longer draftable`);
    this.name = 'LeadNotDraftableError';
  }
}

// C0 and C1 controls (incl. tab, NUL, NEL) plus the Unicode line and paragraph separators (U+2028, U+2029).
const UNSAFE_IN_TITLE = new RegExp('[\x00-\x1f\x7f-\x9f' + String.fromCharCode(0x2028, 0x2029) + ']', 'g');

// The subject is attacker-controlled: no control characters or line/paragraph separators,
// whitespace collapsed, bounded by code points (never half a character), fixed fallback if empty.
function titleFor(subject: string): string {
  const clean = subject
    .replace(UNSAFE_IN_TITLE, ' ')
    .replace(/ +/g, ' ')
    .trim();
  return `Lead: ${[...clean].slice(0, TITLE_SUBJECT_MAX).join('').trimEnd() || '(no subject)'}`;
}

// The lead's text is wrapped in markers carrying a per-call nonce it cannot guess, so it cannot
// close its own block or forge a sibling section. Scout's instructions live in its Paperclip profile.
function issueBody(leadText: string, setup: SetupInputs): string {
  const nonce = randomBytes(16).toString('hex');
  return [
    '## Lead email',
    `--- lead-body ${nonce} ---\n${leadText}\n--- end lead-body ${nonce} ---`,
    '## Owner tone samples', setup.toneSamples,
    '## Firm facts', setup.facts,
  ].join('\n\n');
}

// Idempotent per lead: a stored issue id is reused, never replaced, so a retry cannot start a second Scout run.
export async function sendToScout(deps: BridgeDeps, lead: LeadForDraft): Promise<{ issueId: string }> {
  const first = await read(deps.prisma, lead.id);
  let issueId = first.paperclipIssueId;
  if (issueId === null) {
    // Check before paying for a Scout issue; only a genuine race may orphan one.
    if ((TERMINAL_STATES as readonly string[]).includes(first.state)) {
      (deps.log ?? log).warn({ leadId: lead.id, state: first.state }, 'bridge: lead is terminal, no issue created');
      throw new LeadNotDraftableError(lead.id);
    }
    const created = await deps.engine.createIssue({
      assignee: 'scout',
      title: titleFor(lead.subject),
      body: issueBody(lead.cleanBody, deps.setup),
    });
    // Claim the slot only if nobody else has and the lead is still live: a stored id is never
    // overwritten and a finished lead is never pulled back to drafting.
    const { count } = await deps.prisma.lead.updateMany({
      where: { id: lead.id, paperclipIssueId: null, state: { notIn: [...TERMINAL_STATES] } },
      data: { paperclipIssueId: created.issueId, state: 'drafting' },
    });
    if (count === 1) {
      issueId = created.issueId;
    } else {
      issueId = (await read(deps.prisma, lead.id)).paperclipIssueId;
      (deps.log ?? log).warn(
        { leadId: lead.id, storedIssueId: issueId, orphanIssueId: created.issueId },
        'bridge: claim lost, orphan issue created; keeping the stored issue id',
      );
      if (issueId === null) throw new LeadNotDraftableError(lead.id);
    }
  }
  // Only a lead still drafting needs its poll. The unique key dedupes, so this also repairs a lead
  // left drafting with no job; a finished lead is not revived.
  if ((await read(deps.prisma, lead.id)).state === 'drafting') {
    await enqueueJob(deps.prisma, {
      workspaceId: lead.workspaceId,
      kind: 'draft_poll',
      dedupeKey: `draft_poll:${lead.id}`, // one poll job per lead, enforced by the unique key
      leadId: lead.id,
      runAt: new Date(Date.now() + POLL_DELAY_MS),
      maxAttempts: POLL_MAX_ATTEMPTS,
    });
  }
  return { issueId };
}
