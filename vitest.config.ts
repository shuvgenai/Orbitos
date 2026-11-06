import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import react from '@vitejs/plugin-react';
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
          ],
        },
      },
      {
        // The three dashboards. Its own project so the backend `unit` project keeps its Node
        // environment and is untouched: Prompt 1 must not change what the backend suite runs.
        plugins: [react()],
        resolve: { alias: { '@': resolve(__dirname, 'src') } },
        test: {
          name: 'web',
          environment: 'jsdom',
          globals: true,
          setupFiles: ['src/test/setup.ts'],
          include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
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
