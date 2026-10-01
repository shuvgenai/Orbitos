import { cleanBody } from '@orbit/shared/body';
import { GmailApiError } from '@orbit/shared/gmail/client';
import type { GmailMessage, GmailPort, HistoryPage } from '@orbit/shared/gmail/port';
import type { PrismaClient } from '../../db/src/client.ts';
import { advanceWatermark, markRevoked, readConnection } from '../../db/src/gmail-connection.ts';
import { enqueueJob } from '../../db/src/jobs.ts';
import { shouldDrop } from './filter.ts';

export type PollDeps = {
  prisma: PrismaClient;
  gmail: GmailPort;
  workspaceId: string;
  ownerAddress: string;
};
export type PollResult = { created: number; dropped: number; resynced: boolean };

const RESYNC_WINDOW_MS = 7 * 24 * 3600_000;

// A 401 or 403 means the token is gone. Everything else (429, 5xx, and errors with no status
// at all, such as a network TypeError) is transient and must propagate so the caller retries.
function isRevocation(err: unknown): boolean {
  return err instanceof GmailApiError && (err.status === 401 || err.status === 403);
}

async function handleRevocation(deps: PollDeps, historyId: string): Promise<void> {
  // Notice first: if markRevoked then fails, the retry re-enqueues the same dedupe key (a no-op).
  // The other order could mark revoked, fail to enqueue, and then never alert anyone.
  await enqueueJob(deps.prisma, {
    workspaceId: deps.workspaceId,
    kind: 'notice',
    dedupeKey: `gmail-revoked:${deps.workspaceId}:${historyId}`,
    payload: { type: 'gmail_revoked' }, // content-free: no mail, no addresses
  });
  await markRevoked(deps.prisma, deps.workspaceId);
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
      page = await deps.gmail.listByDate(new Date(Date.now() - RESYNC_WINDOW_MS));
      resynced = true;
    } else {
      page = first;
    }
  } catch (err) {
    if (!isRevocation(err)) throw err;
    await handleRevocation(deps, conn.historyId);
    return { created: 0, dropped: 0, resynced: false };
  }

  let created = 0;
  let dropped = 0;
  // Any failure below propagates before the watermark moves, so the next tick re-reads the whole
  // batch; the unique key makes the already-persisted messages no-ops.
  for (const msg of page.messages) {
    const known = await deps.prisma.lead.findFirst({
      where: { workspaceId: deps.workspaceId, gmailThreadId: msg.gmailThreadId },
      select: { id: true },
    });
    if (known) continue; // FD-1b: first inbound only
    const drop = shouldDrop(
      {
        fromEmail: msg.fromEmail,
        headers: msg.headers,
        subject: msg.subject,
        partMimeTypes: msg.parts.map((p) => p.mimeType),
      },
      deps.ownerAddress,
    );
    if (!(await persist(deps, msg, drop !== false))) continue;
    if (drop) dropped += 1;
    else created += 1;
  }

  await advanceWatermark(deps.prisma, deps.workspaceId, page.historyId);
  return { created, dropped, resynced };
}
