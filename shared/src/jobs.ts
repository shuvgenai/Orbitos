// Frozen contract (PRD §18): Front Desk and worker both write job rows.
export const JOB_KINDS = ['draft_poll', 'verdict_poll', 'notice', 'digest', 'send', 'ack_send'] as const;
export type JobKind = (typeof JOB_KINDS)[number];

export const JOB_STATES = ['pending', 'running', 'done', 'failed', 'dead'] as const;
export type JobState = (typeof JOB_STATES)[number];

// FD-4 timers: 2 h reminder, 72 h void, daily digest, ack cap window (ACK-3).
export const TIMER_KINDS = ['reminder_2h', 'void_72h', 'digest_daily', 'ack_cap_window'] as const;
export type TimerKind = (typeof TIMER_KINDS)[number];
