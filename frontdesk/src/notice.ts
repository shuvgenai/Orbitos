import { pino } from 'pino';
import { signApprovalLink } from '@orbit/shared/approval-link';
import type { MailerPort } from '@orbit/shared/mailer';
import type { PrismaClient } from '@orbit/db/client';

const log = pino({ name: 'frontdesk-notice' });

export type NoticeDeps = { prisma: PrismaClient; mailer: MailerPort; baseUrl: string; secret: string };

/**
 * NTC-1: the notice reveals nothing about the lead. The subject is fixed text and the body is the
 * link and the deadline only. The lead and the draft are deliberately never read here, so no later
 * edit can interpolate them by accident.
 *
 * A retried job may send twice. Accepted: a doubled notice annoys, a missing one loses the lead.
 */
export async function sendNotice(deps: NoticeDeps, approvalId: string): Promise<void> {
  const approval = await deps.prisma.approval.findUnique({
    where: { id: approvalId },
    select: { id: true, workspaceId: true, state: true, expiresAt: true },
  });
  if (!approval) {
    log.warn({ approvalId }, 'notice: approval not found, nothing sent');
    return;
  }
  // A decided or voided approval has nothing left to confirm; a link for it would only mislead.
  if (approval.state !== 'issued') {
    log.info({ approvalId, state: approval.state }, 'notice: approval no longer waiting, nothing sent');
    return;
  }
  const owner = await deps.prisma.user.findFirst({
    where: { workspaceId: approval.workspaceId },
    orderBy: { createdAt: 'asc' },
    select: { email: true },
  });
  if (!owner) {
    log.warn({ approvalId, workspaceId: approval.workspaceId }, 'notice: workspace has no owner, nothing sent');
    return;
  }

  const token = signApprovalLink({ approvalId: approval.id, expiresAt: approval.expiresAt, secret: deps.secret });
  const link = `${deps.baseUrl.replace(/\/+$/, '')}/c/${token}`;
  const deadline = approval.expiresAt.toUTCString();

  await deps.mailer.send({
    to: owner.email,
    // FD-1: the poller drops mail carrying this header, so our own notice is never classified as a lead.
    headers: { 'X-Orbitcrew': '1' },
    subject: 'A reply is waiting',
    text: `A reply is waiting for your approval.\n\nReview and send it here:\n${link}\n\nThis link stops working on ${deadline}.\n`,
  });
  log.info({ approvalId }, 'notice: sent');
}
