// Frozen contract (PRD §18): change only with a migration and a review.
export const APPROVAL_STATES = ['issued', 'sending', 'sent', 'failed', 'void'] as const;
export type ApprovalState = (typeof APPROVAL_STATES)[number];

// AUTH-2 categories, least to most sensitive.
export const APPROVAL_CATEGORIES = ['routine', 'decline_refer', 'board_level'] as const;
export type ApprovalCategory = (typeof APPROVAL_CATEGORIES)[number];

// FD-5. The database trigger in db/prisma/migrations/*_core enforces the same table.
const ALLOWED: Record<ApprovalState, readonly ApprovalState[]> = {
  issued: ['sending', 'void'],
  sending: ['sent', 'failed'],
  failed: ['sending', 'void'],
  sent: [],
  void: [],
};

// Total: callers pass untrusted values (queue payloads, database rows). Own-key check so
// 'constructor', '__proto__' and friends never resolve through Object.prototype.
export function canTransition(from: ApprovalState, to: ApprovalState): boolean {
  if (!Object.hasOwn(ALLOWED, from)) return false;
  return ALLOWED[from].includes(to);
}
