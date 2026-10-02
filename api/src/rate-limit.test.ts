import { expect, test } from 'vitest';
import { createRateLimiter } from './rate-limit.ts';

test('allows up to max per window per key, then refuses', () => {
  let t = 0;
  const l = createRateLimiter({ max: 2, windowMs: 1000, now: () => t });
  expect([l.allow('a'), l.allow('a'), l.allow('a')]).toEqual([true, true, false]);
  expect(l.allow('b')).toBe(true);
});

test('a new window starts fresh', () => {
  let t = 0;
  const l = createRateLimiter({ max: 1, windowMs: 1000, now: () => t });
  l.allow('a');
  expect(l.allow('a')).toBe(false);
  t = 1000;
  expect(l.allow('a')).toBe(true);
});
