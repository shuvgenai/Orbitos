import { pino } from 'pino';

const log = pino({ name: 'frontdesk-schedule' });

/** One timer, never overlapping itself: a slow or failed tick is skipped, not stacked, and never stops the timer. */
export function every(ms: number, name: string, work: () => Promise<unknown>): NodeJS.Timeout {
  let running = false;
  return setInterval(() => {
    if (running) return;
    running = true;
    work()
      .catch((err: unknown) => log.error({ tick: name, errName: err instanceof Error ? err.name : typeof err }, 'tick failed'))
      .finally(() => {
        running = false;
      });
  }, ms);
}

/**
 * Polling Gmail and moving leads on are separate timers on purpose. A poll that keeps failing (a Gmail 5xx,
 * a message that cannot be stored) must not freeze classification and drafting of leads already in the database.
 */
export function startFrontdeskTimers(work: {
  poll: () => Promise<unknown>;
  advance: () => Promise<unknown>;
  loop: () => Promise<unknown>;
}, every_: { pollMs: number; advanceMs: number; loopMs: number }): NodeJS.Timeout[] {
  return [
    every(every_.pollMs, 'poll', work.poll),
    every(every_.advanceMs, 'advance', work.advance),
    // The loop is here because worker/ is a later sub-project. claimDueJobs is the seam: moving the loop is a deployment change.
    every(every_.loopMs, 'loop', work.loop),
  ];
}
