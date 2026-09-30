import { execSync } from 'node:child_process';
import pg from 'pg';

// Rebuilds the test database from the migrations once per test run.
export default async function setup(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is not set (see .env.local or the CI workflow)');
  const dbName = new URL(url).pathname.slice(1);
  if (!dbName.endsWith('_test')) {
    throw new Error(`Refusing to reset "${dbName}": test databases must end in _test`);
  }
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  await client.query('DROP SCHEMA IF EXISTS ledger CASCADE');
  await client.query('DROP SCHEMA IF EXISTS public CASCADE');
  await client.query('CREATE SCHEMA public');
  await client.end();
  execSync('pnpm --filter @orbit/db exec prisma migrate deploy', { stdio: 'inherit' });
}
