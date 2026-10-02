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

test('the map is hard-capped: a flood of distinct keys evicts the oldest, never grows', () => {
  let t = 0;
  const l = createRateLimiter({ max: 1, windowMs: 1000, maxKeys: 3, now: () => t });
  for (const k of ['a', 'b', 'c', 'd', 'e']) {
    t += 1;
    l.allow(k);
  }
  expect(l.size()).toBe(3);
  expect(l.allow('e')).toBe(false); // newest kept and still counted
  expect(l.allow('a')).toBe(true); // oldest was evicted, so it starts fresh
});

test('sweep drops expired windows only', () => {
  let t = 0;
  const l = createRateLimiter({ max: 1, windowMs: 1000, now: () => t });
  l.allow('old');
  t = 900;
  l.allow('new');
  t = 1100;
  l.sweep();
  expect(l.size()).toBe(1);
});
