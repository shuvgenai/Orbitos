// FD-1: deterministic drops before any model call. Rules only; a model never decides this.
export type DropReason = 'self_sent' | 'system_mail' | 'bulk' | 'automated' | 'calendar';

export type FilterInput = {
  fromEmail: string;
  headers: Record<string, string>;
  subject: string;
  listUnsubscribe?: string;
};

const AUTOMATED = /^(no-?reply|do-?not-?reply|mailer-daemon|postmaster|bounces?)@/i;

export function shouldDrop(input: FilterInput, ownerAddress: string): false | DropReason {
  const headers = Object.fromEntries(Object.entries(input.headers).map(([k, v]) => [k.toLowerCase(), v]));
  if ('x-orbitcrew' in headers) return 'system_mail';
  if (input.fromEmail.toLowerCase() === ownerAddress.toLowerCase()) return 'self_sent';
  if (
    input.listUnsubscribe ||
    'list-unsubscribe' in headers ||
    'list-id' in headers ||
    headers['precedence'] === 'bulk'
  ) {
    return 'bulk';
  }
  if (AUTOMATED.test(input.fromEmail)) return 'automated';
  if ((headers['content-type'] ?? '').includes('text/calendar')) return 'calendar';
  return false;
}
