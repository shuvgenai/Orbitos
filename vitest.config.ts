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
          include: ['shared/**/*.test.ts', 'design/**/*.test.ts', 'ops/**/*.test.ts', 'template/test/compose.test.ts'],
        },
      },
    ],
  },
});
