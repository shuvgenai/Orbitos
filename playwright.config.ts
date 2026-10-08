import { defineConfig, devices } from '@playwright/test';

// The end-to-end and accessibility rows of spec section 8.
//
// testDir is e2e and nothing wider on purpose. Without it Playwright walks the
// whole repository and tries to run the vitest suites, which fail on a
// `test()` called outside a vitest run rather than on anything real.
//
// webServer serves the harness fixture. When Stream A has a dev server, the
// command changes to it and the fixture becomes its own Playwright project, so
// the self-proving harness survives rather than being replaced by the first
// real screen.
export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  // A `.only` left in a spec passes locally and silently skips its
  // neighbours in CI. There it is an error instead.
  forbidOnly: !!process.env['CI'],
  retries: process.env['CI'] ? 1 : 0,
  reporter: process.env['CI'] ? 'github' : 'list',
  use: { baseURL: 'http://127.0.0.1:4318', trace: 'on-first-retry' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npx http-server e2e/fixture -p 4318 -s',
    url: 'http://127.0.0.1:4318',
    reuseExistingServer: !process.env['CI'],
  },
});
