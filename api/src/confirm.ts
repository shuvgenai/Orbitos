import { pino } from 'pino';
import { verifyApprovalLink } from '@orbit/shared/approval-link';
import type { GmailPort } from '@orbit/shared/gmail/port';
import type { PrismaClient } from '@orbit/db/client';
import { transitionApproval } from '@orbit/db/approvals';

// Logs carry identifiers and codes only. Never the draft, the final text, or anything from the lead.
const log = pino({ name: 'api-confirm' });

export type ConfirmView =
  | 'draft'
  | 'expired'
  | 'already_decided'
  | 'sent'
  | 'send_failed'
  | 'needs_sign_in'
  | 'rejected_header';

export type ConfirmResult = { status: number; view: ConfirmView };
export type ConfirmAction = 'send' | 'send_edited' | 'discard';

export type ConfirmDeps = {
  prisma: PrismaClient;
  gmail: GmailPort;
  secret: string;
  /** Task 12 supplies the real one. The request is opaque here. */
  requireSession: (req: unknown) => Promise<{ userId: string; freshAt: Date } | null>;
};

const FRESH_WINDOW_MS = 24 * 3600_000;

const AUTHORITY_FOR = {
  routine: 'approve_routine',
  decline_refer: 'approve_decline_refer',
  board_level: 'approve_board_level',
} as const;

// A bad link answers 404 and says nothing else: no hint whether the id exists or the signature was close.
const NOT_FOUND: ConfirmResult = { status: 404, view: 'expired' };
const NEEDS_SIGN_IN: ConfirmResult = { status: 401, view: 'needs_sign_in' };
const FORBIDDEN: ConfirmResult = { status: 403, view: 'needs_sign_in' };
const ALREADY_DECIDED: ConfirmResult = { status: 409, view: 'already_decided' };
const EXPIRED: ConfirmResult = { status: 410, view: 'expired' };
const SEND_FAILED: ConfirmResult = { status: 502, view: 'send_failed' };

const loadApproval = (prisma: PrismaClient, id: string) =>
  prisma.approval.findUnique({
    where: { id },
    include: { lead: true, decision: { select: { id: true } } },
  });
type LoadedApproval = NonNullable<Awaited<ReturnType<typeof loadApproval>>>;

type Gate = { early: ConfirmResult } | { approval: LoadedApproval; userId: string };

/** Steps 1-3 of the order: the link, the session and its authority, then the approval itself. */
async function gate(deps: ConfirmDeps, token: string, req: unknown): Promise<Gate> {
  const now = new Date();
  // 1. A valid token proves only that we minted it. It says nothing about whether the approval still waits.
  const link = verifyApprovalLink(token, deps.secret, now);
  if (!link.ok) return { early: link.reason === 'expired' ? EXPIRED : NOT_FOUND };

  // 2. A session, or nothing. The link alone never authorises anything.
  const session = await deps.requireSession(req);
  if (!session) return { early: NEEDS_SIGN_IN };

  // 3. The approval, and whether this person may act on it.
  const approval = await loadApproval(deps.prisma, link.approvalId);
  if (!approval) return { early: NOT_FOUND };

  const user = await deps.prisma.user.findUnique({
    where: { id: session.userId },
    include: { authorities: { select: { authority: true } } },
  });
  if (!user || user.workspaceId !== approval.workspaceId) return { early: FORBIDDEN };
  const needed = AUTHORITY_FOR[approval.category];
  if (!user.authorities.some((a) => a.authority === needed)) return { early: FORBIDDEN };
  if (approval.category === 'board_level' && now.getTime() - session.freshAt.getTime() > FRESH_WINDOW_MS) {
    return { early: NEEDS_SIGN_IN };
  }
  return { approval, userId: user.id };
}

export async function handleConfirmGet(deps: ConfirmDeps, token: string, req: unknown): Promise<ConfirmResult> {
  const g = await gate(deps, token, req);
  if ('early' in g) return g.early;
  const { approval } = g;
  // A send that did not finish: the page offers the retry, which checks the Sent folder first.
  if (approval.state === 'sending') return { status: 200, view: 'send_failed' };
  if (approval.state !== 'issued' || approval.decision) return ALREADY_DECIDED;
  if (approval.expiresAt.getTime() <= Date.now()) return EXPIRED;
  return { status: 200, view: 'draft' };
}

class MovedOn extends Error {}

const isUniqueViolation = (err: unknown): boolean => (err as { code?: unknown } | null)?.code === 'P2002';
const hasLineBreak = (s: string): boolean => /[\r\n]/.test(s);

export async function handleConfirmPost(
  deps: ConfirmDeps,
  token: string,
  req: unknown,
  action: ConfirmAction,
  finalText?: string,
): Promise<ConfirmResult> {
  const g = await gate(deps, token, req);
  if ('early' in g) return g.early;
  const { approval, userId } = g;
  const { lead } = approval;

  // 4. A row already in `sending` means an earlier send may or may not have reached Gmail. The Sent
  // folder is the only evidence. A hit finishes the job; a miss or an error sends NOTHING, because
  // "not found" cannot prove "not sent". Gmail's index lags, and a second reply to a customer is
  // worse than a stuck page.
  if (approval.state === 'sending') {
    try {
      const hit = await deps.gmail.findSentByTag(approval.id, { gmailThreadId: lead.gmailThreadId });
      if (!hit) {
        log.warn({ approvalId: approval.id }, 'confirm: retry found no sent reply, not resending');
        return SEND_FAILED;
      }
      await finishSent(deps.prisma, approval.id, hit.gmailMessageId);
      return { status: 200, view: 'sent' };
    } catch (err) {
      log.error({ approvalId: approval.id, ...errorCode(err) }, 'confirm: Sent-folder check failed, not resending');
      return SEND_FAILED;
    }
  }

  // Anything that is not waiting (sent, failed, void, or already carrying a decision) is decided.
  if (approval.state !== 'issued' || approval.decision) return ALREADY_DECIDED;
  if (approval.expiresAt.getTime() <= Date.now()) return EXPIRED;

  if (action === 'send_edited' && (finalText === undefined || finalText.trim() === '')) {
    return { status: 422, view: 'draft' };
  }

  // 5. Reject line breaks in every header-bound field before composing. buildRaw throws on the same
  // input as a backstop, but that would surface as a 500 after the decision was written.
  const subject = /^re:\s/i.test(lead.subject) ? lead.subject : `Re: ${lead.subject}`;
  const headerFields = [lead.fromEmail, subject, lead.messageId, lead.gmailThreadId, approval.id];
  if (headerFields.some(hasLineBreak)) {
    log.warn({ approvalId: approval.id }, 'confirm: header field contains a line break, refused');
    return { status: 422, view: 'rejected_header' };
  }

  // 6 + 7. The decision and the issued -> sending (or void) move commit together or not at all.
  // The unique key on approvalId and the compare-and-set mean exactly one request gets past here.
  // Together they also mean a crash cannot leave a decision behind with the approval still `issued`,
  // which would lock the owner out of their own reply.
  const sending = action !== 'discard';
  try {
    await deps.prisma.$transaction(async (tx) => {
      await tx.decision.create({
        data: {
          approvalId: approval.id,
          userId,
          authorityUsed: AUTHORITY_FOR[approval.category],
          action,
          finalText: action === 'send_edited' ? finalText! : null,
        },
      });
      // The transaction client has the one model transitionApproval touches.
      const moved = await transitionApproval(tx as unknown as PrismaClient, approval.id, 'issued', sending ? 'sending' : 'void');
      if (!moved) throw new MovedOn();
    });
  } catch (err) {
    if (isUniqueViolation(err) || err instanceof MovedOn) return ALREADY_DECIDED;
    log.error({ approvalId: approval.id, ...errorCode(err) }, 'confirm: recording the decision failed, nothing sent');
    return SEND_FAILED;
  }

  if (!sending) return { status: 200, view: 'already_decided' };

  // 8. The send. Past this line the row is `sending` and stays there on any doubt.
  const body = action === 'send_edited' ? finalText! : approval.draftText;
  let gmailMessageId: string;
  try {
    ({ gmailMessageId } = await deps.gmail.sendInThread({
      gmailThreadId: lead.gmailThreadId,
      toEmail: lead.fromEmail,
      subject,
      body,
      orbitcrewId: approval.id,
      inReplyToMessageId: lead.messageId,
    }));
  } catch (err) {
    // 9 (failure). Ambiguous: Gmail may have accepted it. Leave `sending`; a retry checks the Sent folder.
    log.error({ approvalId: approval.id, ...errorCode(err) }, 'confirm: send failed, left in sending');
    return SEND_FAILED;
  }

  // 9 (success). The email is out; a failure to record it must not turn into a second send.
  try {
    await finishSent(deps.prisma, approval.id, gmailMessageId);
  } catch (err) {
    log.error({ approvalId: approval.id, ...errorCode(err) }, 'confirm: sent, but recording it failed; row left in sending');
  }
  return { status: 200, view: 'sent' };
}

async function finishSent(prisma: PrismaClient, approvalId: string, gmailMessageId: string): Promise<void> {
  // False means another request already finished it; either way the reply is out.
  await transitionApproval(prisma, approvalId, 'sending', 'sent');
  await prisma.approval.updateMany({ where: { id: approvalId, gmailMessageId: null }, data: { gmailMessageId } });
}

function errorCode(err: unknown): { errorName: string; status?: number } {
  const status = (err as { status?: unknown } | null)?.status;
  return {
    errorName: err instanceof Error ? err.name : 'unknown',
    ...(typeof status === 'number' ? { status } : {}),
  };
}
