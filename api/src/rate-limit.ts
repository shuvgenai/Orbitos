/**
 * A fixed-window counter keyed by caller (the client IP). In memory on purpose: slice 1 runs one api
 * process. It does NOT survive a restart and is not shared between instances; the runbook says so.
 */
export function createRateLimiter(opts: { max: number; windowMs: number; now?: () => number }) {
  const now = opts.now ?? Date.now;
  const windows = new Map<string, { start: number; count: number }>();
  return {
    /** True when this call is within the limit. Counts every call, allowed or not. */
    allow(key: string): boolean {
      const t = now();
      if (windows.size > 10_000) {
        for (const [k, w] of windows) if (t - w.start >= opts.windowMs) windows.delete(k);
      }
      const w = windows.get(key);
      if (!w || t - w.start >= opts.windowMs) {
        windows.set(key, { start: t, count: 1 });
        return true;
      }
      w.count += 1;
      return w.count <= opts.max;
    },
  };
}
export type RateLimiter = ReturnType<typeof createRateLimiter>;
