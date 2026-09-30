import type { EventType } from '@orbit/shared/events';
import type { PrismaClient } from './client.ts';

export async function appendEvent(
  prisma: PrismaClient,
  e: {
    workspaceId: string;
    type: EventType;
    actor: string;
    leadId?: string;
    approvalId?: string;
    data?: Record<string, unknown>;
    occurredAt?: Date;
  },
): Promise<void> {
  await prisma.$executeRaw`
    INSERT INTO ledger.events (workspace_id, occurred_at, type, actor, lead_id, approval_id, data)
    VALUES (${e.workspaceId}::uuid, ${e.occurredAt ?? new Date()}, ${e.type}, ${e.actor},
            ${e.leadId ?? null}::uuid, ${e.approvalId ?? null}::uuid, ${JSON.stringify(e.data ?? {})}::jsonb)`;
}

export async function ensureMonthPartitions(prisma: PrismaClient, from: Date, months: number): Promise<number> {
  const day = from.toISOString().slice(0, 10);
  const rows = await prisma.$queryRaw<{ created: number }[]>`
    SELECT ledger.ensure_month_partitions(${day}::date, ${months}::integer) AS created`;
  return rows[0]!.created;
}
