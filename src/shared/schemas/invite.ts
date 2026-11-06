import { z } from 'zod';

/**
 * An invitation to become an office's Org Admin. PRD A-04: "an invitation that works once
 * and expires in 7 days."
 *
 * ITS OWN MODULE, imported by BOTH the fleet entry (which issues invitations) and the
 * org-admin entry (which accepts them). It must not live in `schemas/fleet.ts`: a Zod
 * object keeps its key names at runtime, that file carries `adapterKey`, and
 * `customer-surface.test.ts` greps the built chunks for `/adapter/i`. Importing the fleet
 * schemas from the org-admin entry would therefore fail the bundle guard -- so the two
 * concerns stay in separate files even though both are operator-adjacent.
 *
 * Nothing here names the operator surface either: the issuer arrives as data (`issuedBy`),
 * exactly as `togglePause(id, byName)` already does, so no operator string is compiled into
 * the shared mock.
 */

/**
 * Top level in the persisted document, NOT inside an instance (FD-31 constraint 4): an
 * invitation exists before its recipient can reach the office at all, so storing it inside
 * the office it grants access to would be circular.
 */
export const inviteSchema = z.object({
  /**
   * Opaque, from `crypto.getRandomValues`. NOT signed.
   *
   * `shared/src/approval-link.ts` signs its links with an HMAC, and that is the right shape
   * for the real thing -- but it needs `node:crypto` and a secret, and a secret shipped in a
   * browser bundle is both meaningless and banned by CLAUDE.md. A mock token proves nothing
   * and is not asked to; see docs/auth.md.
   */
  token: z.string(),
  /** The instance this invitation admits its holder to. */
  officeId: z.string(),
  /** Who it was issued to, as the operator typed it on the provision form. */
  email: z.string(),
  name: z.string(),
  /** PRD A-04 needs neither of these; S-23 does -- an operator action is logged with its actor. */
  issuedBy: z.string(),
  issuedAt: z.number().int(),
  /** issuedAt + 7 days (A-04). Stored rather than computed, so changing the TTL cannot retro-expire a live invitation. */
  expiresAt: z.number().int(),
  /** Single use (A-04). Non-null means spent, and records when. */
  usedAt: z.number().int().nullable(),
});

/**
 * Operator-owned metadata about an office, kept OUT of the office's own document.
 *
 * In production this is the split between the fleet database and a customer's own: each
 * office is its own deployment with its own database (FD-1, PRD 14.1), and the fleet console
 * sees it through the nightly numbers rollup (S-38). `version` and `health` are the
 * operator's facts about an instance; `agents` and `cost` are counts rolled up FROM it.
 */
export const fleetMetaSchema = z.object({
  version: z.string(),
  health: z.enum(['ok', 'warn']),
  /** The Org Admin the office was provisioned for. Supplied by the operator, never read out of the office's people. */
  adminEmail: z.string(),
  createdAt: z.number().int(),
  /** A sample fixture rather than a real instance: it has no document behind it. */
  sample: z.boolean().optional(),
});

export type Invite = z.infer<typeof inviteSchema>;
export type FleetMeta = z.infer<typeof fleetMetaSchema>;

/** What the accept screen may know before anyone has proved anything. */
export type InvitePreview = {
  officeName: string;
  name: string;
  email: string;
  expiresAt: number;
};
