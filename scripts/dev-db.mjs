// Starts and stops the local dev database (compose.dev.yml) without the caller exporting anything
// first. Two facts make this a script rather than a plain `docker compose` line in package.json:
//
//   1. Compose interpolates `${ORBIT_DB_HOST_PORT}` from its own environment or from --env-file,
//      and --env-file fails outright when the file is missing, which is the case in CI. Loading
//      .env.local here when it exists keeps one port setting for both `pnpm db:up` and the tests,
//      which read the same file through vitest.config.ts.
//   2. On Windows, Docker runs inside WSL2 and wsl.exe does not inherit this process's
//      environment, so the port is exported inside the command WSL runs.
//
// Usage: node scripts/dev-db.mjs [compose args...]   (default: up -d --wait)
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';

if (existsSync('.env.local')) process.loadEnvFile('.env.local');

const port = process.env.ORBIT_DB_HOST_PORT;
if (port !== undefined && !/^\d+$/.test(port)) {
  console.error(`ORBIT_DB_HOST_PORT must be a port number, got "${port}"`);
  process.exit(1);
}

const args = process.argv.slice(2);
const compose = ['docker', 'compose', '-f', 'compose.dev.yml', ...(args.length > 0 ? args : ['up', '-d', '--wait'])];

// `bash -c`, not `bash -lc`: a login shell can change the working directory, and the compose file
// path plus the init-script volume are both relative to it.
const [file, argv] =
  process.platform === 'win32'
    ? ['wsl.exe', ['bash', '-c', `${port ? `ORBIT_DB_HOST_PORT=${port} ` : ''}${compose.join(' ')}`]]
    : [compose[0], compose.slice(1)];

const result = spawnSync(file, argv, { stdio: 'inherit' });
if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}
process.exit(result.status ?? 1);
