import type { PrismaClient } from '@orbit/db/client';
import { pino } from 'pino';
import { enqueueAlert, type AlertReason } from './alert.ts';

const log = pino({ name: 'frontdesk-fail-lead' });

/**
 * Moves a lead to `draft_failed` and queues the owner alert in one transaction, so a lead never ends
 * up in a terminal state nobody was told about. Conditional on the lead still being in one of `from`,
 * so a late failure can never overwrite a lead another path already finished; only the caller that
 * actually moves it raises the alert. `reason` is a fixed code and is logged, never customer text.
 */
export async function failLead(
  prisma: PrismaClient,
  input: { leadId: string; from: Array<'drafting' | 'classifying'>; reason: string; alert?: AlertReason },
  logger: Pick<typeof log, 'warn'> = log,
): Promise<boolean> {
  const moved = await prisma.$transaction(async (tx) => {
    const lead = await tx.lead.findUnique({ where: { id: input.leadId }, select: { workspaceId: true } });
    if (!lead) return false;
    const { count } = await tx.lead.updateMany({
      where: { id: input.leadId, state: { in: input.from } },
      data: { state: 'draft_failed' },
    });
    if (count !== 1) return false;
    await enqueueAlert(tx as unknown as PrismaClient, {
      workspaceId: lead.workspaceId,
      leadId: input.leadId,
      reason: input.alert ?? 'draft_failed',
    });
    return true;
  });
  logger.warn({ leadId: input.leadId, reason: input.reason, moved }, 'lead marked draft_failed');
  return moved;
}
