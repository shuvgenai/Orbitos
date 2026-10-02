import { afterEach, expect, test, vi } from 'vitest';
import { every, startFrontdeskTimers } from './schedule.ts';

afterEach(() => vi.useRealTimers());

test('I4: advancing leads still runs when the poll fails on every tick', async () => {
  vi.useFakeTimers();
  const poll = vi.fn().mockRejectedValue(new Error('gmail 503'));
  const advance = vi.fn().mockResolvedValue(undefined);
  const loop = vi.fn().mockResolvedValue(undefined);
  const timers = startFrontdeskTimers({ poll, advance, loop }, { pollMs: 30_000, advanceMs: 30_000, loopMs: 1_000 });
  await vi.advanceTimersByTimeAsync(90_000);
  timers.forEach(clearInterval);
  expect(poll).toHaveBeenCalledTimes(3); // failing never stops its own timer
  expect(advance).toHaveBeenCalledTimes(3);
  expect(loop.mock.calls.length).toBeGreaterThan(80);
});

test('a slow tick is skipped, not stacked', async () => {
  vi.useFakeTimers();
  let release!: () => void;
  const work = vi.fn(() => new Promise<void>((resolve) => { release = resolve; }));
  const timer = every(1_000, 'slow', work);
  await vi.advanceTimersByTimeAsync(5_000);
  expect(work).toHaveBeenCalledTimes(1);
  release();
  await vi.advanceTimersByTimeAsync(1_000);
  expect(work).toHaveBeenCalledTimes(2);
  clearInterval(timer);
});
