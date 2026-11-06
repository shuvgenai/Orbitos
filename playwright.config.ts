import { defineConfig } from '@playwright/test';

/**
 * Real-browser tests. These exist for the questions jsdom cannot answer at all: jsdom runs
 * no layout engine, so it has no scrollWidth, no wrapping and no colour -- an overflow test
 * written there would pass on a page that is visibly broken.
 *
 * It starts its own dev server rather than assuming one, so the suite is runnable from a
 * clean checkout and does not fight a server someone is already using.
 */
export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env['CI']),
  reporter: process.env['CI'] ? 'line' : [['list']],
  use: {
    // localhost, not 127.0.0.1: Vite binds to ::1 on this machine, so the IPv4 literal
    // never answers and the webServer poll times out.
    baseURL: 'http://localhost:5174',
  },
  webServer: {
    command: 'pnpm vite --port 5174 --strictPort',
    url: 'http://localhost:5174/',
    reuseExistingServer: !process.env['CI'],
    stdout: 'ignore',
    timeout: 120_000,
  },
});
