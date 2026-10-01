import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * The confirm link is the whole security boundary of the product's main action: it is public, it
 * arrives by email, and the button behind it sends a reply in the owner's name.
 *
 * Token: `<approvalId>.<expiresAtEpochMs>.<base64url(HMAC-SHA256(secret, "<approvalId>.<epochMs>"))>`.
 * The id and expiry stay readable; the signature covers both, and is checked BEFORE either is
 * trusted. A valid token proves only that Orbit issued it and it has not expired: it does not prove
 * the approval is still waiting. The confirm route must still load the approval and require state
 * `issued` (Task 11), or a link could be replayed after the decision.
 */

const sign = (message: string, secret: string): Buffer => createHmac('sha256', secret).update(message).digest();

export function signApprovalLink(args: { approvalId: string; expiresAt: Date; secret: string }): string {
  // The id is a segment of the token; a dot in it would let a different (id, expiry) pair share one signed string.
  if (args.approvalId === '' || args.approvalId.includes('.')) throw new Error('approvalId must be non-empty and contain no dot');
  const expiresMs = args.expiresAt.getTime();
  if (!Number.isSafeInteger(expiresMs)) throw new Error('expiresAt must be a valid date');
  const message = `${args.approvalId}.${expiresMs}`;
  return `${message}.${sign(message, args.secret).toString('base64url')}`;
}

export function verifyApprovalLink(
  token: string,
  secret: string,
  now: Date,
): { ok: true; approvalId: string } | { ok: false; reason: 'malformed' | 'bad_signature' | 'expired' } {
  const parts = token.split('.');
  if (parts.length !== 3 || parts.some((p) => p === '')) return { ok: false, reason: 'malformed' };
  const [approvalId, expiresPart, sigPart] = parts as [string, string, string];

  // Signature first. Nothing below the equality check runs on an unsigned payload.
  const expected = sign(`${approvalId}.${expiresPart}`, secret);
  const given = Buffer.from(sigPart, 'base64url');
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
    return { ok: false, reason: 'bad_signature' };
  }

  // Authentic from here on: the expiry is ours, so a bad shape is a bug in the signer, still refused.
  if (!/^\d+$/.test(expiresPart)) return { ok: false, reason: 'malformed' };
  if (now.getTime() >= Number(expiresPart)) return { ok: false, reason: 'expired' };
  return { ok: true, approvalId };
}
