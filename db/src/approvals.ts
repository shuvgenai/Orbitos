import { APPROVAL_STATES, canTransition, type ApprovalState } from '@orbit/shared/approvals';
import type { PrismaClient } from './client.ts';

// Callers may pass a state read from a database row or a queue payload, so the type is not proof.
// canTransition indexes its table by `from` and would throw a bare TypeError on an unknown string.
function assertKnownState(state: string): asserts state is ApprovalState {
  if (!(APPROVAL_STATES as readonly string[]).includes(state)) {
    throw new Error(`Unknown approval state "${state}"`);
  }
}

// Compare-and-set on the state column: the row lock taken by UPDATE makes concurrent callers
// serialize, and only the one that still sees `from` wins (FD-5 "with a database lock").
export async function transitionApproval(
  prisma: PrismaClient,
  id: string,
  from: ApprovalState,
  to: ApprovalState,
): Promise<boolean> {
  assertKnownState(from);
  assertKnownState(to);
  if (!canTransition(from, to)) throw new Error(`Invalid approval transition ${from} -> ${to}`);
  const now = new Date();
  const { count } = await prisma.approval.updateMany({
    where: { id, state: from },
    data: {
      state: to,
      ...(to === 'sending' ? { sendingAt: now } : {}),
      ...(to === 'sent' ? { sentAt: now } : {}),
    },
  });
  return count === 1;
}
