import { createHash } from 'node:crypto';
import type { PrismaClient } from '@orbit/db/client';

export const SESSION_COOKIE = 'orbit_session';
export const SESSION_TTL_MS = 30 * 24 * 3600_000;

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function sessionCookie(token: string): string {
  return `${SESSION_COOKIE}=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${SESSION_TTL_MS / 1000}`;
}

function tokenFromCookies(header: string | undefined): string | null {
  for (const part of (header ?? '').split(';')) {
    const eq = part.indexOf('=');
    if (eq > 0 && part.slice(0, eq).trim() === SESSION_COOKIE) return part.slice(eq + 1).trim() || null;
  }
  return null;
}

/** The signed-in user, or null for a missing, unknown, expired or revoked session. */
export async function readSession(
  prisma: PrismaClient,
  cookieHeader: string | undefined,
): Promise<{ userId: string; freshAt: Date } | null> {
  const token = tokenFromCookies(cookieHeader);
  if (!token) return null;
  const row = await prisma.session.findUnique({ where: { tokenHash: hashToken(token) } });
  if (!row || row.revokedAt !== null || row.expiresAt.getTime() <= Date.now()) return null;
  return { userId: row.userId, freshAt: row.freshAt };
}
