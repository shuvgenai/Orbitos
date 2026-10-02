import { pino } from 'pino';
import { cleanBody } from '@orbit/shared/body';
import { GmailApiError } from '@orbit/shared/gmail/client';
import type { GmailMessage, GmailPort, HistoryPage } from '@orbit/shared/gmail/port';
import type { PrismaClient } from '@orbit/db/client';
import { advanceWatermark, markRevoked, readConnection } from '@orbit/db/gmail-connection';
import { enqueueJob } from '@orbit/db/jobs';
import { shouldDrop } from './filter.ts';

export type PollDeps = {
  prisma: PrismaClient;
  gmail: GmailPort;
  workspaceId: string;
  ownerAddress: string;
  log?: Pick<typeof log, 'error' | 'warn'>;
};
export type PollResult = { created: number; dropped: number; resynced: boolean };

const log = pino({ name: 'frontdesk-poll' });

const RESYNC_WINDOW_MS = 7 * 24 * 3600_000;

// Revoked: 401 always; 403 unless Gmail says it is a rate or quota limit (those are retryable, like
// 429 and 5xx). A 403 with no reason counts as revoked: a wrongly stopped poller is loud, a poller
// that retries a dead token forever is silent. Errors with no status at all (a network TypeError)
// are never a revocation and propagate.
const RETRYABLE_403 = new Set(['rateLimitExceeded', 'userRateLimitExceeded', 'quotaExceeded', 'dailyLimitExceeded']);
function isRevocation(err: unknown): boolean {
  if (!(err instanceof GmailApiError)) return false;
  if (err.status === 401) return true;
  return err.status === 403 && !(err.reason !== undefined && RETRYABLE_403.has(err.reason));
}

async function handleRevocation(deps: PollDeps): Promise<void> {
  // One notice per distinct revocation: the key is the revokedAt we are about to record, so a
  // reconnect-then-revoke-again gets its own notice. Notice first: if markRevoked then fails, no
  // alert is lost (the next tick retries with a fresh timestamp; a rare duplicate beats silence).
  const revokedAt = new Date();
  await enqueueJob(deps.prisma, {
    workspaceId: deps.workspaceId,
    kind: 'notice',
    dedupeKey: `gmail-revoked:${deps.workspaceId}:${revokedAt.toISOString()}`,
    payload: { type: 'gmail_revoked' }, // content-free: no mail, no addresses
  });
  await markRevoked(deps.prisma, deps.workspaceId, revokedAt);
}

// One transaction per message: a lead never exists without its body, so a retry that finds the
// lead already there cannot be missing the body. Filtered mail keeps no body at all.
async function persist(deps: PollDeps, msg: GmailMessage, drop: boolean): Promise<boolean> {
  return deps.prisma.$transaction(async (tx) => {
    const { count } = await tx.lead.createMany({
      data: [
        {
          workspaceId: deps.workspaceId,
          messageId: msg.messageId,
          gmailMessageId: msg.gmailMessageId,
          gmailThreadId: msg.gmailThreadId,
          fromEmail: msg.fromEmail,
          fromName: msg.fromName ?? null,
          subject: msg.subject,
          receivedAt: msg.receivedAt,
          state: drop ? 'filtered' : 'received',
        },
      ],
      skipDuplicates: true, // FD-1 dedupe, enforced by the unique key
    });
    if (count === 0) return false;
    if (!drop) {
      const lead = await tx.lead.findUniqueOrThrow({
        where: { workspaceId_messageId: { workspaceId: deps.workspaceId, messageId: msg.messageId } },
        select: { id: true },
      });
      // The joined text parts, not the original RFC822 source: the port hands us parsed parts and
      // never the raw message. This is what DAT-3's 90-day purge of "raw bodies" deletes.
      const rawBody = msg.parts.map((p) => p.text ?? '').filter(Boolean).join('\n\n');
      await tx.emailBody.create({
        data: { leadId: lead.id, rawBody, cleanBody: cleanBody(msg.parts), receivedAt: msg.receivedAt },
      });
    }
    return true;
  });
}

export async function pollOnce(deps: PollDeps): Promise<PollResult> {
  const conn = await readConnection(deps.prisma, deps.workspaceId);
  if (conn.state === 'revoked') return { created: 0, dropped: 0, resynced: false };

  let page: HistoryPage;
  let resynced = false;
  try {
    const first = await deps.gmail.listSince(conn.historyId);
    if ('expired' in first) {
      // Gmail drops history older than about a week. Resyncing by date is the only way to
      // close the gap; skipping would lose every lead that arrived in it.
      const windowStart = new Date(Date.now() - RESYNC_WINDOW_MS);
      page = await deps.gmail.listByDate(windowStart);
      resynced = true;
      // A lead older than the window is lost, and "nothing arrived" looks the same as "we looked in
      // the wrong place", so say what we looked at.
      log.warn(
        { workspaceId: deps.workspaceId, windowStart: windowStart.toISOString(), messages: page.messages.length },
        'poll: history id expired, resynced by date',
      );
    } else {
      page = first;
    }
  } catch (err) {
    if (!isRevocation(err)) throw err;
    await handleRevocation(deps);
    return { created: 0, dropped: 0, resynced: false };
  }

  let created = 0;
  let dropped = 0;
  // Any failure below propagates before the watermark moves, so the next tick re-reads the whole
  // batch; the unique key makes the already-persisted messages no-ops.
  for (const msg of page.messages) {
    try {
      // Slice 1 runs a single poller, so this lookup outside the transaction cannot race another tick.
      // A filtered first message also marks its thread known: FD-1b handles only the first inbound
      // message of a thread and leaves later replies to the owner in Gmail. Intended; do not "fix".
      const known = await deps.prisma.lead.findFirst({
        where: { workspaceId: deps.workspaceId, gmailThreadId: msg.gmailThreadId },
        select: { id: true },
      });
      if (known) continue; // FD-1b: first inbound only
      const drop = Boolean(shouldDrop(
        {
          fromEmail: msg.fromEmail,
          headers: msg.headers,
          subject: msg.subject,
          partMimeTypes: msg.parts.map((p) => p.mimeType),
        },
        deps.ownerAddress,
      ));
      if (!(await persist(deps, msg, drop))) continue;
      if (drop) dropped += 1;
      else created += 1;
    } catch (err) {
      // A wedged poller must say so. Blocking never loses a lead; skipping would.
      // The error name only: a driver error from storing the message can quote the customer's email text.
      (deps.log ?? log).error(
        { errName: err instanceof Error ? err.name : typeof err, gmailMessageId: msg.gmailMessageId },
        'poll: message failed, batch halted before watermark',
      );
      throw err;
    }
  }

  await advanceWatermark(deps.prisma, deps.workspaceId, page.historyId);
  return { created, dropped, resynced };
}
