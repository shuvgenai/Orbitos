import type { PrismaClient } from '@orbit/db/client';
import { enqueueJob } from '@orbit/db/jobs';
import type { MailerPort } from '@orbit/shared/mailer';
import { pino } from 'pino';
import { findOwnerEmail } from './notice.ts';

const log = pino({ name: 'frontdesk-alert' });

/**
 * Owner alerts with no approval behind them: a lost Gmail connection, or a lead that stopped where no
 * one will look. Every line is a fixed string written here. No lead text, name, address or subject can
 * reach an alert, so a later edit cannot leak one by accident (NTC-1).
 */
const ALERT_LINES = {
  classification_failed: 'A new enquiry could not be classified.',
  unsure: 'A new enquiry needs your judgement: Orbit could not tell whether it is a lead.',
  empty_body: 'A new enquiry arrived with no readable text (for example, only an image or attachment).',
  draft_failed: 'A reply to a new enquiry could not be drafted.',
} as const;
export type AlertReason = keyof typeof ALERT_LINES;
const isAlertReason = (v: unknown): v is AlertReason => typeof v === 'string' && Object.hasOwn(ALERT_LINES, v);

const ALERT_MAX_ATTEMPTS = 40; // an alert is worth retrying through a long mail outage
const FROM_ORBIT = { 'X-Orbitcrew': '1' }; // FD-1: the poller drops mail carrying this, so our own mail is never a lead

/** One alert per lead and reason, however many times the code that raises it runs. */
export async function enqueueAlert(
  prisma: PrismaClient,
  alert: { workspaceId: string; leadId: string; reason: AlertReason },
): Promise<void> {
  await enqueueJob(prisma, {
    workspaceId: alert.workspaceId,
    kind: 'notice',
    dedupeKey: `alert:${alert.reason}:${alert.leadId}`,
    leadId: alert.leadId,
    payload: { type: 'alert', reason: alert.reason },
    maxAttempts: ALERT_MAX_ATTEMPTS,
  });
}

/** Thrown when a notice job with no approval carries nothing this program knows how to send. */
export class UnknownAlertError extends Error {
  override name = 'UnknownAlertError';
}

/** Mails the owner the fixed line for an approval-less `notice` job. Throws on mail failure, so the loop retries it. */
export async function sendOwnerAlert(
  deps: { prisma: PrismaClient; mailer: MailerPort },
  job: { workspaceId: string; leadId: string | null; payload: unknown },
): Promise<void> {
  const payload = job.payload as { type?: unknown; reason?: unknown } | null;
  let subject: string;
  let text: string;
  if (payload?.type === 'gmail_revoked') {
    subject = 'Orbit has stopped reading your inbox';
    text = 'Orbit has lost access to your inbox and has stopped reading mail. Reconnect it to resume.\n';
  } else if (payload?.type === 'alert' && isAlertReason(payload.reason)) {
    subject = 'Orbit needs your attention';
    text =
      `${ALERT_LINES[payload.reason]} Nothing was sent to the customer. ` +
      'Check your Gmail inbox for the original message.\n' +
      (job.leadId === null ? '' : `\nReference: ${job.leadId}\n`);
  } else {
    throw new UnknownAlertError('notice job has no approval and no known alert type');
  }
  const to = await findOwnerEmail(deps.prisma, job.workspaceId);
  if (to === null) {
    log.warn({ workspaceId: job.workspaceId }, 'alert: workspace has no owner, nothing sent');
    return;
  }
  await deps.mailer.send({ to, headers: FROM_ORBIT, subject, text });
  log.info({ workspaceId: job.workspaceId, type: payload.type }, 'alert: sent');
}
