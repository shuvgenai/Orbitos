import type { TimerKind } from '@orbit/shared/jobs';
import type { PrismaClient } from './client.ts';
import type { Prisma } from './generated/prisma/client.ts';

export type FiredTimer = { id: string; kind: TimerKind; approvalId: string | null; payload: unknown };

export async function scheduleTimer(
  prisma: PrismaClient,
  input: { workspaceId: string; kind: TimerKind; fireAt: Date; dedupeKey: string; approvalId?: string; payload?: Prisma.InputJsonValue },
): Promise<{ id: string; created: boolean }> {
  const { count } = await prisma.timer.createMany({ data: [input], skipDuplicates: true });
  const timer = await prisma.timer.findUniqueOrThrow({ where: { dedupeKey: input.dedupeKey }, select: { id: true } });
  return { id: timer.id, created: count === 1 };
}

export async function cancelTimer(prisma: PrismaClient, dedupeKey: string): Promise<boolean> {
  const { count } = await prisma.timer.updateMany({
    where: { dedupeKey, firedAt: null, cancelledAt: null },
    data: { cancelledAt: new Date() },
  });
  return count === 1;
}

// Marks due timers fired and runs the handler in one transaction. If the handler throws,
// the transaction rolls back and the timers fire on the next tick.
export async function fireDueTimers(
  prisma: PrismaClient,
  limit: number,
  handler: (tx: Prisma.TransactionClient, timers: FiredTimer[]) => Promise<void>,
): Promise<number> {
  return prisma.$transaction(async (tx) => {
    const timers = await tx.$queryRaw<FiredTimer[]>`
      UPDATE timers SET fired_at = now()
      WHERE id IN (
        SELECT id FROM timers
        WHERE fire_at <= now() AND fired_at IS NULL AND cancelled_at IS NULL
        ORDER BY fire_at
        LIMIT ${limit}
        FOR UPDATE SKIP LOCKED
      )
      RETURNING id, kind::text AS kind, approval_id AS "approvalId", payload`;
    if (timers.length > 0) await handler(tx, timers);
    return timers.length;
  });
}
