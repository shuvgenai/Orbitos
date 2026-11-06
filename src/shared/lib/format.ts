/** PROVENANCE: assets/ui.js — money, ago, initials, verbatim behaviour. */

export const money = (n: number): string => `$${Number(n || 0).toFixed(2)}`;

export const initials = (n: string): string =>
  String(n || '?')
    .split(/\s+/)
    .map((x) => x[0] ?? '')
    .join('')
    .slice(0, 2)
    .toUpperCase();

export function ago(ts: number, now = Date.now()): string {
  const m = Math.max(1, Math.round((now - ts) / 60_000));
  if (m < 60) return `${m} min ago`;
  if (m < 1440) return `${Math.round(m / 60)} h ago`;
  return `${Math.round(m / 1440)} d ago`;
}

export const pct = (n: number): string => `${n}%`;

export const seconds = (n: number): string => `${n.toFixed(1)}s`;
