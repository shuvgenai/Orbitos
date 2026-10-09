import { defineConfig, devices } from '@playwright/test';

// The end-to-end and accessibility rows of spec section 8.
//
// Two projects and two servers. The harness project serves a static fixture and
// proves the browser and axe work at all. The routes project drives the real
// dashboards dev server and runs axe on every route of all three apps.
//
// The harness is not replaced by the routes project, and must not be. If axe
// quietly stopped reporting anything, every route test would still pass and say
// nothing, and the harness is the one check that would fail: it asserts a known
// defect is still found.
//
// testDir is e2e and nothing wider on purpose. Without it Playwright walks the
// whole repository and tries to run the vitest suites, which fail on a
// `test()` called outside a vitest run rather than on anything real.
const HARNESS_URL = 'http://127.0.0.1:4318';

// 5200, not the 5199 that `pnpm --filter @orbit/dashboards dev` uses.
//
// This run needs a server it owns. A dev server left open on 5199 is reused by
// nobody safely: the one running while this was written had a stale dependency
// cache from before the last install and answered 504 Outdated Optimize Dep for
// react, so every page loaded, mounted nothing, and 66 route tests failed on a
// missing h1 while saying nothing about why. Taking its own strict port means
// `pnpm e2e` always tests the current source, and never asks anyone to close
// their dev server first.
//
// localhost, not 127.0.0.1: Vite binds to the name, which resolves to [::1]
// here, so the v4 address answers nothing and Playwright would wait for a
// server that is already up. This is also the address dashboards/CLAUDE.md
// documents.
const DASHBOARDS_PORT = 5200;
const DASHBOARDS_URL = `http://localhost:${DASHBOARDS_PORT}`;

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  // A `.only` left in a spec passes locally and silently skips its
  // neighbours in CI. There it is an error instead.
  forbidOnly: !!process.env['CI'],
  retries: process.env['CI'] ? 1 : 0,
  // 'github' annotates the failing line in the diff; 'html' writes
  // playwright-report/, which the e2e job uploads on failure. Annotations alone
  // give a rule name and a node count with no way to see which node, and a
  // finding nobody can locate is a red build somebody switches off.
  reporter: process.env['CI'] ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: { trace: 'on-first-retry' },
  // baseURL sits on the project rather than here, because the two projects
  // answer on different ports.
  projects: [
    {
      name: 'harness',
      testMatch: /harness\.spec\.ts$/,
      use: { ...devices['Desktop Chrome'], baseURL: HARNESS_URL },
    },
    {
      name: 'routes',
      testMatch: /routes\.spec\.ts$/,
      use: { ...devices['Desktop Chrome'], baseURL: DASHBOARDS_URL },
    },
  ],
  webServer: [
    {
      command: 'npx http-server e2e/fixture -p 4318 -s',
      url: HARNESS_URL,
      reuseExistingServer: !process.env['CI'],
    },
    {
      // The dashboards dev server on this run's own port. Strict, so a
      // collision fails loudly instead of moving to another port and leaving
      // the tests pointed at nothing.
      //
      // The readiness URL is an entry page, not the bare host: this Vite
      // project has three HTML entries and nothing at the root, so / answers
      // 404 and Playwright would sit waiting for a server that is already up.
      command: `pnpm --filter @orbit/dashboards exec vite --port ${DASHBOARDS_PORT} --strictPort`,
      url: `${DASHBOARDS_URL}/user/index.html`,
      // Never reuse. Playwright stops the server it started, so there is
      // nothing of its own to reuse, and reusing someone else's is what served
      // a stale bundle to a whole run once already.
      reuseExistingServer: false,
    },
  ],
});
