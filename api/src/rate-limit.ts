/**
 * A fixed-window counter keyed by caller. In memory on purpose: slice 1 runs one api process. It does NOT
 * survive a restart and is not shared between instances; the runbook says so.
 *
 * Bounded: the map never holds more than `maxKeys` entries. When a new key arrives at the cap, the oldest
 * window is evicted (insertion order is window-start order), so a flood of distinct keys costs O(1) per
 * request and cannot grow memory. `sweep()` drops expired windows; the program calls it on an interval.
 */
export function createRateLimiter(opts: { max: number; windowMs: number; maxKeys?: number; now?: () => number }) {
  const now = opts.now ?? Date.now;
  const maxKeys = opts.maxKeys ?? 10_000;
  const windows = new Map<string, { start: number; count: number }>();
  return {
    /** True when this call is within the limit. Counts every call, allowed or not. */
    allow(key: string): boolean {
      const t = now();
      const w = windows.get(key);
      if (w && t - w.start < opts.windowMs) {
        w.count += 1;
        return w.count <= opts.max;
      }
      // A new window: re-insert so the map stays ordered by window start.
      windows.delete(key);
      if (windows.size >= maxKeys) windows.delete(windows.keys().next().value as string);
      windows.set(key, { start: t, count: 1 });
      return true;
    },
    sweep(): void {
      const t = now();
      for (const [k, w] of windows) {
        if (t - w.start < opts.windowMs) break; // ordered by start: the rest are newer
        windows.delete(k);
      }
    },
    size: () => windows.size,
  };
}
export type RateLimiter = ReturnType<typeof createRateLimiter>;
