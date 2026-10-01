// FD-1: deterministic drops before any model call. Rules only; a model never decides this.
export type DropReason = 'self_sent' | 'system_mail' | 'bulk' | 'automated' | 'calendar';

export type FilterInput = {
  // Contract: a bare, lowercase address (the Gmail port splits the From header into
  // fromEmail + fromName). The filter still normalises defensively via bareAddress.
  fromEmail: string;
  headers: Record<string, string>;
  subject: string;
  listUnsubscribe?: string;
  // MIME types of the inner body parts, e.g. msg.parts.map((p) => p.mimeType).
  partMimeTypes?: readonly string[];
};

const AUTOMATED = /^(no-?reply|do-?not-?reply|mailer-daemon|postmaster|bounces?)@/i;
const BULK_PRECEDENCE = new Set(['bulk', 'list', 'junk']);
const CALENDAR_TYPES = ['text/calendar', 'application/ics'];

// "Name" <Owner+tag@Example.com> -> owner@example.com
function bareAddress(raw: string): string {
  const angle = /<([^>]*)>/.exec(raw);
  const addr = (angle?.[1] ?? raw).trim().toLowerCase();
  const at = addr.lastIndexOf('@');
  if (at < 0) return addr;
  const local = addr.slice(0, at);
  const plus = local.indexOf('+');
  return (plus < 0 ? local : local.slice(0, plus)) + addr.slice(at);
}

export function shouldDrop(input: FilterInput, ownerAddress: string): false | DropReason {
  const headers = Object.fromEntries(
    Object.entries(input.headers).map(([k, v]) => [k.trim().toLowerCase(), v]),
  );
  const from = bareAddress(input.fromEmail);
  // Order is deliberate but unconstrained: nothing downstream reads the specific reason in
  // this slice, so do not treat the precedence below as a requirement.
  if ('x-orbitcrew' in headers) return 'system_mail';
  if (from === bareAddress(ownerAddress)) return 'self_sent';
  if (
    input.listUnsubscribe ||
    'list-unsubscribe' in headers ||
    'list-id' in headers ||
    BULK_PRECEDENCE.has((headers['precedence'] ?? '').trim().toLowerCase())
  ) {
    return 'bulk';
  }
  if (AUTOMATED.test(from)) return 'automated';
  const types = [headers['content-type'] ?? '', ...(input.partMimeTypes ?? [])].map((t) => t.toLowerCase());
  if (types.some((t) => CALENDAR_TYPES.some((c) => t.includes(c)))) return 'calendar';
  return false;
}
