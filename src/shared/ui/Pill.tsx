import type { AgentStatus } from '@/shared/schemas';

export type PillTone = 'ok' | 'warn' | 'err' | 'plain';

const tones: Record<PillTone, string> = {
  // One red, errors only (PRD 15.2). "ok" and "warn" carry weight and a dot, not a colour.
  ok: 'border-ink text-ink font-medium',
  warn: 'border-line text-ink',
  err: 'border-danger text-danger',
  plain: 'border-line text-muted',
};

export function Pill({ tone = 'plain', children }: { tone?: PillTone; children: React.ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-button border px-2 py-0.5 text-base ${tones[tone]}`}>
      {children}
    </span>
  );
}

export const STATUS_LABELS: Record<AgentStatus, string> = {
  draft: 'Not started',
  running: 'Running',
  waiting: 'Waiting for approval',
  idle: 'Idle',
  paused: 'Paused',
  blocked: 'Blocked',
};

const statusTone: Record<AgentStatus, PillTone> = {
  draft: 'plain',
  running: 'ok',
  waiting: 'warn',
  idle: 'plain',
  paused: 'err',
  blocked: 'err',
};

/** The status is announced as text, never by colour alone (PRD 15.2 zoom-and-keyboard row). */
export function StatusPill({ status }: { status: AgentStatus }) {
  return (
    <Pill tone={statusTone[status]}>
      <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-current" />
      {STATUS_LABELS[status]}
    </Pill>
  );
}
