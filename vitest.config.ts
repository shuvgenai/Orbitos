import { existsSync } from 'node:fs';
import { defineConfig } from 'vitest/config';

// Local runs read DATABASE_URL from .env.local; CI sets it in the workflow.
if (existsSync('.env.local')) process.loadEnvFile('.env.local');

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'unit',
          include: [
            'shared/**/*.test.ts',
            'design/**/*.test.ts',
            'ops/**/*.test.ts',
            'frontdesk/**/*.test.ts',
            'api/**/*.test.ts',
            'template/test/compose.test.ts',
            'template/test/engine.test.ts',
            'template/test/no-unapproved-send.test.ts',
            'guards/**/*.test.ts',
          ],
        },
      },
      {
        // The browser project. Component tests are colocated under
        // dashboards/src, run in jsdom, and are the only tests allowed to touch
        // the DOM. Its include list must match at least one file: a project
        // matching nothing is a test suite that passes by running nothing, which
        // dashboards/src/test-env.test.tsx exists to keep from happening.
        test: {
          name: 'dashboards',
          include: ['dashboards/src/**/*.test.tsx', 'dashboards/src/**/*.test.ts'],
          environment: 'jsdom',
          setupFiles: ['dashboards/src/vitest-setup.ts'],
        },
      },
      {
        test: {
          name: 'db',
          include: ['db/test/**/*.test.ts', 'template/test/postgres-logins.test.ts'],
          globalSetup: ['db/test/global-setup.ts'],
          fileParallelism: false,
        },
      },
    ],
  },
});
