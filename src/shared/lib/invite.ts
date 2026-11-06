import type { Invite } from '@/shared/schemas/invite';

/**
 * The invitation rules, as pure functions. CLAUDE.md: "No product logic in components.
 * Validation lives in pure, unit-tested functions under src/shared/lib."
 *
 * Keeping the used/expired decision here rather than inside MockApiClient is what lets the
 * two refusal messages PRD A-04 implies be tested without a store, a clock trick or a
 * rendered screen.
 */

/** PRD A-04: "expires in 7 days". The only place the number lives. */
export const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export type InviteState = 'valid' | 'used' | 'expired' | 'unknown';

/**
 * Order matters and is deliberate: **used before expired.**
 *
 * An invitation that was accepted and has since aged out is "already used", not "expired" --
 * that is the true account of what happened, and it is the message that stops the holder
 * asking for a fresh link they do not need. The opposite order would tell someone who
 * already has an office that their invitation ran out.
 */
export function inviteState(invite: Invite | undefined, now: number): InviteState {
  if (!invite) return 'unknown';
  if (invite.usedAt !== null) return 'used';
  if (now >= invite.expiresAt) return 'expired';
  return 'valid';
}

/**
 * The words a screen shows. An unknown token and a tampered one are the same sentence: a
 * different message for "no such invitation" would turn the URL into a token oracle, which
 * is the same mistake `RequireAccess` refuses to make with roles.
 */
export const INVITE_MESSAGE: Record<Exclude<InviteState, 'valid'>, string> = {
  used: 'This invitation has already been used.',
  expired: 'This invitation has expired.',
  unknown: 'This invitation link is not valid.',
};

/**
 * A 32-byte opaque token, hex-encoded. Mock only, and NOT a credential: see the note on
 * `inviteSchema.token` for why it is not signed.
 */
export function newInviteToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Where an invitation is redeemed: the Org Admin entry, hash-routed like every other screen.
 *
 * Built from an explicit origin rather than read from `window`, so the fleet screen, the
 * email template and the tests all produce the same string. The path is the ORG ADMIN
 * entry's (FD-30) -- never the operator's, which `customer-surface.test.ts` bans from a
 * customer bundle and which would be the wrong destination anyway.
 */
export function inviteUrl(origin: string, token: string): string {
  return `${origin.replace(/\/+$/, '')}/orgadmin#/invite/${token}`;
}
