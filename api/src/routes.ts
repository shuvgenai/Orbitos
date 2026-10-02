import { verifyApprovalLink } from '@orbit/shared/approval-link';
import type { GmailPort } from '@orbit/shared/gmail/port';
import type { MailerPort } from '@orbit/shared/mailer';
import type { PrismaClient } from '@orbit/db/client';
import { normalizeEmail } from '@orbit/db/owner';
import { issueSignInLink, redeemSignInLink } from './auth.ts';
import { handleConfirmGet, handleConfirmPost, type ConfirmAction, type ConfirmResult } from './confirm.ts';
import type { RateLimiter } from './rate-limit.ts';
import { readSession } from './session.ts';

export type ApiRequest = { method: string; path: string; headers: Record<string, string | undefined>; body: string; ip: string };
export type ApiResponse = { status: number; headers: Record<string, string>; body: string };

export type RoutesDeps = {
  prisma: PrismaClient;
  gmail: GmailPort;
  mailer: MailerPort;
  baseUrl: string;
  secret: string;
  /** The instance's one customer workspace: sign-in matches users in it only. */
  workspaceId: string;
  /** Per caller asking about one address: the probing channel. Tight. */
  signInLimiter: RateLimiter;
  /** Per caller, whatever address. Looser, so one caller cannot walk a list of addresses. */
  signInCallerLimiter: RateLimiter;
};

const SECURITY_HEADERS = {
  'cache-control': 'no-store',
  'referrer-policy': 'no-referrer', // the token is in the URL
  'x-content-type-options': 'nosniff',
};

const escape = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const text = (status: number, body: string, extra: Record<string, string> = {}): ApiResponse => ({
  status,
  headers: { ...SECURITY_HEADERS, 'content-type': 'text/plain; charset=utf-8', ...extra },
  body,
});
const html = (status: number, inner: string): ApiResponse => ({
  status,
  headers: { ...SECURITY_HEADERS, 'content-type': 'text/html; charset=utf-8' },
  body: `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Orbit</title><body>${inner}</body>`,
});

const signInForm = (redirect: string): string =>
  `<p>Sign in to continue.</p><form method="post" action="/signin"><input type="hidden" name="redirect" value="${escape(redirect)}">` +
  `<input type="email" name="email" required autocomplete="email"><button>Email me a sign-in link</button></form>`;

const TEXT_FOR_VIEW = {
  draft: '',
  expired: 'This link has expired.',
  already_decided: 'This reply has already been handled.',
  sent: 'Sent. The reply is on its way to the customer.',
  send_failed: 'The send did not complete. Press Try again; Orbit checks your Sent folder first so nothing goes out twice.',
  needs_sign_in: '',
  rejected_header: 'That reply cannot be sent as written.',
} as const;

/**
 * ConfirmView cannot say not-found or forbidden: 404 reuses `expired` and 403 reuses `needs_sign_in`.
 * So this routes on `status`. A 403 must never render the sign-in page (the person is signed in, just not allowed),
 * and a 404 must never claim a link "expired" (it may never have existed).
 */
function renderConfirm(result: ConfirmResult, path: string, draft: string | null): ApiResponse {
  // Only the 'draft' view carries a form. A refused edit is 422 with that view: show the form again with a plain
  // note, never a success-sounding page for a reply that was not sent.
  const note = result.status === 422 && result.view === 'draft' ? '<p>That edit was empty. Nothing was sent.</p>' : '';
  switch (result.status) {
    case 401:
      return html(401, signInForm(path));
    case 403:
      return html(403, '<p>This account is not allowed to act on this reply.</p>');
    case 404:
      return html(404, '<p>Not found.</p>');
    default:
      break;
  }
  if (result.view === 'draft') {
    if (draft === null) return html(result.status, '<p>This reply cannot be shown right now. Nothing was sent.</p>');
    return html(result.status,
      `${note}<form method="post"><p>Review the reply, then choose.</p><textarea name="finalText" rows="12" cols="60">${escape(draft)}</textarea>` +
      `<p><button name="action" value="send">Send as drafted</button> <button name="action" value="send_edited">Send my edit</button> ` +
      `<button name="action" value="discard">Discard</button></p></form>`);
  }
  if (result.view === 'send_failed') {
    // The retry is a POST, so it needs a control. No textarea: a retry sends the reply already decided on, and a
    // second edit here would be silently dropped.
    return html(result.status,
      `<form method="post"><p>${escape(TEXT_FOR_VIEW.send_failed)}</p>` +
      `<p><button name="action" value="send">Try again</button> <button name="action" value="discard">Discard</button></p></form>`);
  }
  return html(result.status, `<p>${escape(TEXT_FOR_VIEW[result.view] || 'Something went wrong. Nothing was sent.')}</p>`);
}

// A malformed escape becomes an empty token, which every handler treats as an unknown link.
const dec = (s: string): string => {
  try {
    return decodeURIComponent(s);
  } catch {
    return "";
  }
};
const form = (body: string): URLSearchParams => new URLSearchParams(body);

export function createRoutes(deps: RoutesDeps): (req: ApiRequest) => Promise<ApiResponse> {
  const confirmDeps = {
    prisma: deps.prisma,
    gmail: deps.gmail,
    secret: deps.secret,
    requireSession: (req: unknown) => readSession(deps.prisma, (req as ApiRequest).headers.cookie),
  };
  const authDeps = { prisma: deps.prisma, mailer: deps.mailer, baseUrl: deps.baseUrl.replace(/\/+$/, ''), workspaceId: deps.workspaceId };

  // Only called after a confirm handler returned the 'draft' view, i.e. after the link, session and authority gates
  // passed, so showing the draft is authorised.
  async function draftFor(token: string): Promise<string | null> {
    const link = verifyApprovalLink(token, deps.secret, new Date());
    if (!link.ok) return null;
    return (await deps.prisma.approval.findUnique({ where: { id: link.approvalId }, select: { draftText: true } }))?.draftText ?? null;
  }

  return async (req) => {
    const confirm = /^\/c\/([^/]+)$/.exec(req.path);
    const redeem = /^\/s\/([^/]+)$/.exec(req.path);

    if (confirm && req.method === 'GET') {
      const token = dec(confirm[1]!);
      const result = await handleConfirmGet(confirmDeps, token, req);
      return renderConfirm(result, req.path, result.view === 'draft' ? await draftFor(token) : null);
    }

    if (confirm && req.method === 'POST') {
      const token = dec(confirm[1]!);
      const fields = form(req.body);
      const action = fields.get('action') ?? '';
      const finalText = fields.get('finalText') ?? undefined;
      const result = await handleConfirmPost(confirmDeps, token, req, action as ConfirmAction, finalText);
      return renderConfirm(result, req.path, result.view === 'draft' ? await draftFor(token) : null);
    }

    if (req.path === '/signin' && req.method === 'POST') {
      // Rate limiting is the real defence for the small timing difference the sign-in path keeps by design.
      // Two buckets, both always counted: the caller, and the caller asking about one address (the probing channel).
      const fields = form(req.body);
      const perCaller = deps.signInCallerLimiter.allow(req.ip);
      const perAddress = deps.signInLimiter.allow(`${req.ip}|${normalizeEmail(fields.get('email') ?? '')}`);
      if (!perCaller || !perAddress) return text(429, 'Too many requests. Try again later.', { 'retry-after': '900' });
      await issueSignInLink(authDeps, fields.get('email') ?? '', fields.get('redirect') ?? '/');
      return html(200, '<p>If that address is registered, a sign-in link is on its way.</p>');
    }

    if (redeem && req.method === 'GET') {
      const result = await redeemSignInLink(authDeps, dec(redeem[1]!));
      if ('error' in result) return html(400, '<p>This sign-in link is not valid. Request a new one.</p>');
      return { status: 302, headers: { ...SECURITY_HEADERS, location: result.redirectPath, 'set-cookie': result.cookie }, body: '' };
    }

    return text(404, 'Not found');
  };
}
