import { randomBytes } from 'node:crypto';
import { pino } from 'pino';
import type { PrismaClient } from '@orbit/db/client';
import type { MailerPort } from '@orbit/shared/mailer';
import { hashToken, sessionCookie, SESSION_TTL_MS } from './session.ts';

// Logs carry identifiers and codes only. Never the token, its hash, or the email address.
const log = pino({ name: 'api-auth' });

const LINK_TTL_MS = 15 * 60_000;

export type AuthDeps = {
  prisma: PrismaClient;
  mailer: MailerPort;
  baseUrl: string;
  /** The instance's one customer workspace. Task 14 supplies it; when absent, sign-in matches across workspaces. */
  workspaceId?: string;
};

/** Only a same-site path may be a redirect target; anything else becomes the home page. */
function safePath(path: string): string {
  return path.startsWith('/') && !path.startsWith('//') && !path.includes('\\') ? path : '/';
}

/**
 * Always answers `{ sent: true }`, and mails nothing when the address matches no user, so this
 * endpoint never confirms or denies who the owner is (APP-1).
 */
export async function issueSignInLink(
  deps: AuthDeps,
  email: string,
  redirectPath: string,
): Promise<{ sent: true }> {
  const matches = await deps.prisma.user.findMany({
    where: { email, ...(deps.workspaceId ? { workspaceId: deps.workspaceId } : {}) },
    orderBy: { createdAt: 'asc' },
  });
  const user = matches[0];
  if (matches.length > 1 && !deps.workspaceId) {
    log.warn({ code: 'multi_match', count: matches.length }, 'sign-in address matched several users; using the oldest');
  }

  const token = randomBytes(32).toString('base64url');
  if (!user) {
    // Do the same token work as the matched path and discard it. This narrows the timing difference
    // between a known and an unknown address; it does not remove it (no insert, no mail). A rate
    // limit on this endpoint is the real defence against probing.
    hashToken(token);
    return { sent: true };
  }
  const link = await deps.prisma.signInLink.create({
    data: {
      userId: user.id,
      tokenHash: hashToken(token),
      redirectPath: safePath(redirectPath),
      expiresAt: new Date(Date.now() + LINK_TTL_MS),
    },
  });
  try {
    await deps.mailer.send({
      to: user.email,
      subject: 'Your Orbit sign-in link',
      text: `Open this link to sign in. It works once and expires in 15 minutes.\n\n${deps.baseUrl}/s/${token}`,
      headers: { 'X-Orbitcrew': '1' },
    });
  } catch {
    // Same answer as every other case: a failure must not tell the caller the address exists.
    log.error({ signInLinkId: link.id, code: 'mail_failed' }, 'sign-in mail failed');
  }
  return { sent: true };
}

export async function redeemSignInLink(
  deps: Pick<AuthDeps, 'prisma'>,
  token: string,
): Promise<{ cookie: string; redirectPath: string } | { error: 'invalid' | 'expired' | 'used' }> {
  const link = await deps.prisma.signInLink.findUnique({ where: { tokenHash: hashToken(token) } });
  if (!link) return { error: 'invalid' };
  if (link.usedAt !== null) return { error: 'used' };
  if (link.expiresAt.getTime() <= Date.now()) return { error: 'expired' };

  const sessionToken = randomBytes(32).toString('base64url');
  const now = new Date();
  const won = await deps.prisma.$transaction(async (tx) => {
    // The only place a link is spent: of two clicks at once, one update matches and the other does not.
    const claimed = await tx.signInLink.updateMany({
      where: { id: link.id, usedAt: null, expiresAt: { gt: now } },
      data: { usedAt: now },
    });
    if (claimed.count === 0) return false;
    await tx.session.create({
      data: {
        userId: link.userId,
        tokenHash: hashToken(sessionToken),
        freshAt: now,
        expiresAt: new Date(now.getTime() + SESSION_TTL_MS),
      },
    });
    return true;
  });
  if (!won) return { error: 'used' };

  log.info({ signInLinkId: link.id, userId: link.userId }, 'sign-in link redeemed');
  return { cookie: sessionCookie(sessionToken), redirectPath: link.redirectPath ?? '/' };
}
