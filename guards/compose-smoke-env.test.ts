// The compose-smoke job supplies every variable the stack requires, with values
// the programs inside it accept.
//
// The job was red for two reasons at once and the log recorded one of them.
// Compose marks variables required with the `${NAME:?}` form and fails during
// interpolation, before any container starts, naming only what it reached. Four
// were missing. Separately, TOKEN_ENCRYPTION_KEY was set to `smoke`, which
// compose accepts and hex32Check rejects, so fixing the four alone would have
// moved the failure one layer later and produced a different message.
//
// The required set is read from template/compose.yml rather than listed here. A
// list in this file would go stale the moment a variable is added there, which
// is the failure this guard exists to prevent.
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { expect, test } from 'vitest';
import { hex32Check, secretCheck, urlCheck } from '../shared/src/config.ts';
import { REPO_ROOT, readRepoFile, trackedFiles } from './lib/walk.ts';

const COMPOSE = 'template/compose.yml';
const WORKFLOW = '.github/workflows/ci.yml';
const JOB = 'compose-smoke';

/** `${NAME:?}`, compose's own "this is required" form. */
const REQUIRED = /\$\{([A-Z_][A-Z0-9_]*):\?/g;

/** Variables compose refuses to start without. */
export function requiredByCompose(): readonly string[] {
  const text = readRepoFile(COMPOSE);
  return [...new Set([...text.matchAll(REQUIRED)].map((m) => m[1] ?? ''))].filter(Boolean).sort();
}

/**
 * One job's `env:` block, as a map.
 *
 * Parsed by indentation rather than with a YAML library, because adding a
 * dependency to read one block of one file is a worse trade than thirty lines
 * that fail loudly. The block ends at the first line that is not an entry at
 * its indentation.
 */
export function jobEnv(job: string): Record<string, string> {
  // Split on either ending. A CRLF checkout leaves a trailing carriage return
  // on every line, and in a JavaScript regex `.` does not match one, because it
  // counts as a line terminator. So `(#.*)?$` never matched a comment line, the
  // loop broke at the first comment inside the block, and six variables the job
  // does set were reported missing. Caught by watching this guard fail.
  const lines = readRepoFile(WORKFLOW).split(/\r?\n/);
  const start = lines.findIndex((line) => line.startsWith(`  ${job}:`));
  if (start === -1) throw new Error(`${WORKFLOW} has no job named ${job}`);

  const envAt = lines.findIndex((line, i) => i > start && /^ {4}env:\s*$/.test(line));
  if (envAt === -1) throw new Error(`job ${job} has no env block`);

  const out: Record<string, string> = {};
  for (const line of lines.slice(envAt + 1)) {
    if (/^\s*(#.*)?$/.test(line)) continue;
    const entry = line.match(/^ {6}([A-Z_][A-Z0-9_]*):\s*(.*?)\s*$/);
    if (entry === null) break;
    const [, name = '', raw = ''] = entry;
    out[name] = raw
      .replace(/\s+#.*$/, '')
      .replace(/^["']|["']$/g, '')
      .trim();
  }
  return out;
}

/**
 * The validator each name faces at program startup.
 *
 * Taken from the `checks` maps in api/src/config.ts and
 * frontdesk/src/config.ts. Named here rather than imported from those files,
 * because importing them would make this guard pass the moment somebody
 * loosened a check, which is exactly when it should be read again.
 */
const VALIDATORS: Readonly<Record<string, (v: string) => string | null>> = {
  TOKEN_ENCRYPTION_KEY: hex32Check,
  APPROVAL_LINK_SECRET: secretCheck,
  PUBLIC_BASE_URL: urlCheck,
  PAPERCLIP_PUBLIC_URL: urlCheck,
};

test('the compose-smoke job sets every variable compose requires', () => {
  const env = jobEnv(JOB);
  const missing = requiredByCompose().filter((name) => (env[name] ?? '') === '');

  expect(missing, `add these to the ${JOB} job env block`).toEqual([]);
});

test('every value the compose-smoke job sets passes its own validator', () => {
  const env = jobEnv(JOB);
  const bad: string[] = [];

  for (const [name, check] of Object.entries(VALIDATORS)) {
    const value = env[name];
    if (value === undefined) continue;
    const problem = check(value);
    // The name and the validator's own message, never the value. These values
    // are fake, and a guard that printed them would teach the habit anyway.
    if (problem) bad.push(`${name} ${problem}`);
  }

  expect(bad).toEqual([]);
});

/**
 * Names a program requires that compose does not supply.
 *
 * frontdesk reads these four from template/.env.frontdesk, which compose
 * declares `required: false`, so in CI they are absent, loadFrontdeskConfig
 * throws, and `restart: unless-stopped` crash-loops the container. Neither
 * frontdesk nor worker declares a healthcheck, so `up --wait` may not report
 * that as a failure at all. That is why this is a test and not a comment.
 */
const FROM_INSTANCE_ENV = [
  'PAPERCLIP_API_KEY',
  'PAPERCLIP_COMPANY_ID',
  'PAPERCLIP_SCOUT_AGENT_ID',
  'PAPERCLIP_ORBI_AGENT_ID',
] as const;

/** Prefixes a real credential starts with. A fake value must not look like one. */
const VENDOR_PREFIX = [
  /^sk-/,
  /^re_/,
  /^AKIA/,
  /^gh[pousr]_/,
  /^github_pat_/,
  /^xox[abprs]-/,
  /^AIza/,
  /^eyJ/,
] as const;

/** The per-instance env file compose reads for frontdesk, with `required: false`. */
const INSTANCE_ENV_FILE = 'template/.env.frontdesk';

/**
 * The names one service's `environment:` block passes into its container.
 *
 * This is the distinction the first version of this guard missed. A job-level
 * `env:` entry feeds compose's `${...}` interpolation; it does NOT reach a
 * container unless that service's own `environment:` block or an `env_file`
 * puts it there. Setting the four names in the job env made this guard green
 * and changed nothing inside frontdesk, and the CI run said
 * `container orbit-instance-frontdesk-1 is unhealthy`.
 */
function serviceEnvNames(service: string): readonly string[] {
  const lines = readRepoFile(COMPOSE).split(/\r?\n/);
  const start = lines.findIndex((line) => line === `  ${service}:`);
  if (start === -1) throw new Error(`${COMPOSE} has no service named ${service}`);

  const envAt = lines.findIndex((line, i) => i > start && /^ {4}environment:\s*$/.test(line));
  if (envAt === -1) return [];

  const out: string[] = [];
  for (const line of lines.slice(envAt + 1)) {
    if (/^\s*#/.test(line)) continue;
    const entry = line.match(/^ {6}([A-Za-z_][A-Za-z0-9_]*):/);
    if (entry === null) break;
    out.push(entry[1] ?? '');
  }
  return out;
}

/**
 * The names the workflow writes into the per-instance env file.
 *
 * compose declares that file `required: false`, so it is absent in CI unless a
 * step creates it. Reading the step rather than trusting it means a step that
 * is edited or deleted fails here.
 */
function instanceEnvFileNames(): readonly string[] {
  const text = readRepoFile(WORKFLOW);
  const at = text.indexOf(INSTANCE_ENV_FILE);
  if (at === -1) return [];
  // The heredoc that follows the redirect, up to its terminator.
  const after = text.slice(at);
  const body = after.match(/<<'?EOF'?\r?\n([\s\S]*?)\r?\n\s*EOF/);
  if (body === null) return [];
  return [...(body[1] ?? '').matchAll(/^\s*([A-Z_][A-Z0-9_]*)=/gm)].map((m) => m[1] ?? '');
}

test('every name frontdesk requires actually reaches its container', () => {
  // The union of the two delivery paths, because either one works and neither
  // is the job env on its own.
  const delivered = new Set([...serviceEnvNames('frontdesk'), ...instanceEnvFileNames()]);
  const missing = FROM_INSTANCE_ENV.filter((name) => !delivered.has(name));

  expect(
    missing,
    `a job env entry does not reach a container. Put these in frontdesk's environment block or in ${INSTANCE_ENV_FILE}`,
  ).toEqual([]);
});

test('no value the compose-smoke job sets looks like a real credential', () => {
  const offenders: string[] = [];

  for (const [name, value] of Object.entries(jobEnv(JOB))) {
    if (value.startsWith('${{')) continue; // a workflow expression, not a value
    for (const prefix of VENDOR_PREFIX) {
      // The name and the pattern, never the value.
      if (prefix.test(value)) offenders.push(`${name} starts like ${String(prefix)}`);
    }
  }

  expect(offenders, 'a fake value must not be shaped like a real one').toEqual([]);
});

/** Every migration directory, oldest first, which is the order they must be applied in. */
function migrationDirs(): readonly string[] {
  return trackedFiles()
    .filter((f) => /^db\/prisma\/migrations\/[^/]+\/migration\.sql$/.test(f))
    .map((f) => f.split('/')[3] ?? '')
    .sort();
}

test('compose-smoke applies every migration and seeds, before it waits for health', () => {
  const text = readRepoFile(WORKFLOW);
  const job = text.slice(text.indexOf('  compose-smoke:'));

  // The schema has to exist before api's startup query runs, and api starts with
  // the stack, so the wait for health comes after the seed.
  const seedAt = job.indexOf('ci-seed-instance');
  // The LAST wait, not the first. The job waits twice on purpose: once for
  // postgres and redis, which the migrations need, and once at the end for every
  // service. Only the second one gates api, and the first legitimately comes
  // before the seed. Written as indexOf first, which made this test fail against
  // a correct workflow.
  const finalWaitAt = job.lastIndexOf('--wait');
  expect(seedAt, 'compose-smoke never runs the seed').toBeGreaterThan(-1);
  expect(finalWaitAt, 'compose-smoke never waits for health').toBeGreaterThan(-1);
  expect(seedAt, 'the seed must run before the final wait, or api is still crash-looping').toBeLessThan(
    finalWaitAt,
  );

  // The glob, not each name. The first version of this test required every
  // migration directory name to appear in the job, and the job globs the
  // directory instead, which is the better design: a migration added later is
  // applied with no workflow edit. Requiring the names would have forced one.
  expect(job, 'apply the migrations by globbing the directory, so a new one needs no workflow edit').toContain(
    'db/prisma/migrations/*/',
  );

  // The glob is only worth anything if there is something to glob. Five
  // migrations existed when this was written.
  expect(migrationDirs().length, 'no migration was found, so the loop above applies nothing').toBeGreaterThanOrEqual(
    5,
  );
});

/** The two files frontdesk reads from SETUP_DIR. Both must be non-empty. */
const SETUP_FILES = ['tone-samples.md', 'facts.md'] as const;

test('the setup files are created with content, because an empty one stops frontdesk', () => {
  // frontdesk/src/main.ts:31 reads each file, trims it, and calls fail() when
  // the result is empty. The first version of this step created them with `: >`,
  // and frontdesk reported `tone-samples.md is missing or empty in SETUP_DIR`
  // and never became healthy. A touched file is not a created file here.
  const text = readRepoFile(WORKFLOW);
  const job = text.slice(text.indexOf('  compose-smoke:'));

  const emptied = SETUP_FILES.filter(
    (name) =>
      !new RegExp(
        String.raw`echo\s+\S[^\n]*>\s*"?\$\{?SETUP_HOST_DIR\}?/${name.replace('.', String.raw`\.`)}`,
      ).test(job),
  );

  expect(emptied, 'write a line of placeholder text into each, not an empty file').toEqual([]);
});

test('the guard is reading both files, not an empty list', () => {
  // Either parse returning nothing makes every assertion above pass vacuously.
  // compose.yml marked eighteen variables required when this was written, and
  // the job set fourteen entries.
  expect(requiredByCompose().length).toBeGreaterThanOrEqual(15);
  expect(Object.keys(jobEnv(JOB)).length).toBeGreaterThanOrEqual(10);
});

/**
 * The compose-smoke job's steps, one chunk per step.
 *
 * Steps sit at six-space indent under `steps:`, so splitting on that boundary
 * gives one chunk per step without a YAML parser. Each chunk keeps its own
 * `name:` and its whole `run:` block, which is what every test below reads.
 */
function composeSmokeSteps(): readonly string[] {
  const text = readRepoFile(WORKFLOW);
  const job = text.slice(text.indexOf('  compose-smoke:'));
  const steps = job.slice(job.indexOf('    steps:'));
  return steps.split('\n      - ').slice(1);
}

test('every compose-smoke step that pipes sets pipefail', () => {
  // Cause 8. A GitHub Actions `run:` block is `bash -e`, not `bash -eo
  // pipefail`, so a pipeline's exit status is the last command's. The seed
  // piped a generator that could not start into a psql that exits 0 on empty
  // stdin, and the step went green having inserted nothing.
  //
  // Scoped to a pipe into psql, which is where the exit code is the whole
  // point: a generator that cannot start must fail the step rather than hand
  // psql empty stdin.
  //
  // The first version of this test matched a pipe at end of line and reported
  // five offenders when one step pipes. `run: |` ends with a pipe too, so it
  // was matching the YAML block scalar indicator and not shell pipes at all.
  // The second candidate, any pipe anywhere, catches
  // `git status --porcelain template/ | grep .` in the frozen-check step, where
  // `|| true` swallows every exit code and pipefail would buy nothing.
  //
  // The `\r` strip is not decoration: on a CRLF checkout every line ends
  // `\r\n`, and an earlier version of this guard read 8 of 18 variables
  // because a regex `.` does not match a carriage return.
  const pipesIntoPsql = (step: string): boolean => {
    const lines = step.split('\n').map((l) => l.replace(/\r$/, ''));
    // A leading pipe is the continuation style this job uses. ` | ` catches an
    // inline one. Neither matches `||`, which is not a pipe.
    const piped = lines.some((l) => /^[ \t]*\|[ \t]/.test(l) || / \| /.test(l));
    return piped && /\bpsql\b/.test(step);
  };

  const offenders = composeSmokeSteps()
    .filter(pipesIntoPsql)
    .filter((s) => !s.includes('set -o pipefail'))
    .map((s) => (s.split('\n')[0] ?? '').trim());

  expect(offenders, 'a step with a pipe needs `set -o pipefail`, or it reports the wrong exit code').toEqual(
    [],
  );
});

test('compose-smoke installs its dependencies before the seed generator runs', () => {
  // The job was a checkout and Docker commands only, so pnpm was not on the
  // runner at all. The log line was `pnpm: command not found`. That is sharper
  // than "there are no node_modules": the generator never started.
  const text = readRepoFile(WORKFLOW);
  const job = text.slice(text.indexOf('  compose-smoke:'));

  const installAt = job.indexOf('pnpm install --frozen-lockfile');
  const seedAt = job.indexOf('ci-seed-instance');

  expect(job, 'pin pnpm/action-setup, or pnpm is not on the runner').toContain('pnpm/action-setup@');
  expect(job, 'pin actions/setup-node, or the node version is whatever the runner happens to have').toContain(
    'actions/setup-node@',
  );
  expect(installAt, 'compose-smoke never installs dependencies').toBeGreaterThan(-1);
  expect(seedAt, 'compose-smoke never runs the seed generator').toBeGreaterThan(-1);
  expect(installAt, 'install before the seed, or the generator has no node_modules').toBeLessThan(seedAt);
});

test('the seed is followed by a count that fails on anything but one row', () => {
  // The part that matters most. The first two parts make this instance work.
  // This one makes the class of error visible: a step that inserts nothing can
  // never report success again.
  //
  // api/src/main.ts refuses to start unless it finds exactly one row, so two
  // rows are as wrong as none, and the comparison is against 1 and not a
  // minimum.
  const assertions = composeSmokeSteps().filter((s) => /count\(\*\)[^\n]*gmail_connections/.test(s));
  expect(assertions.length, 'exactly one compose-smoke step counts the seeded rows').toBe(1);
  const step = assertions[0] ?? '';

  // -tAc, because psql pads tuple output otherwise and a correct seed would
  // fail the comparison. The DEP-1 check in this job already reads values this
  // way.
  expect(step, 'read the count with -tAc, or psql pads it with spaces').toContain('-tAc');
  // String comparison, not -eq. If the psql call fails, the variable is empty,
  // and `test "" -eq 1` errors with "integer expression expected" instead of
  // failing on the value.
  expect(step, 'compare as a string against 1, so an empty result fails rather than errors').toMatch(
    /test "\$[A-Za-z_][A-Za-z0-9_]*" = 1/,
  );
  expect(step, 'the step has to exit non-zero when the count is wrong').toContain('exit 1');
});

test('the count assertion runs between the seed and the final wait', () => {
  // Order is the whole value of the assertion. After the final `--wait`, api
  // fails first and the log says `container orbit-instance-api-1 is unhealthy`,
  // which names the service and not the reason. That message hid this cause for
  // a day.
  const text = readRepoFile(WORKFLOW);
  const job = text.slice(text.indexOf('  compose-smoke:'));

  const seedAt = job.indexOf('ci-seed-instance');
  const countAt = job.search(/count\(\*\)[^\n]*gmail_connections/);
  const finalWaitAt = job.lastIndexOf('--wait');

  expect(countAt, 'no count assertion found in the compose-smoke job').toBeGreaterThan(-1);
  expect(countAt, 'count the rows after the seed, not before it').toBeGreaterThan(seedAt);
  expect(countAt, 'count the rows before the health wait, or api reports the failure first').toBeLessThan(
    finalWaitAt,
  );
});

/**
 * The SQL the seed generator writes, read by running it.
 *
 * Cause 9. frontdesk/src/main.ts:69 reads the first `users` row for the
 * workspace the single GmailConnection names and calls fail() when it finds
 * none, so the seed has to produce that row and exactly that row.
 *
 * Running the generator rather than grepping it, for the reason
 * guards/vite-fs-allow.test.ts gives: a text scan passes on a statement built
 * from an identifier defined three lines higher. The module writes its SQL on
 * import, so the capture has to be in place before the import, and the import
 * is cached, so the result is memoised here rather than re-run per test.
 *
 * Sixty-four zeros for the key, the same value the compose-smoke job sets, so
 * nothing encrypted by this run is private to anybody.
 */
let seedSqlCache: string | undefined;
async function seedSql(): Promise<string> {
  if (seedSqlCache !== undefined) return seedSqlCache;

  const previousKey = process.env['TOKEN_ENCRYPTION_KEY'];
  process.env['TOKEN_ENCRYPTION_KEY'] = '0'.repeat(64);

  const chunks: string[] = [];
  const realWrite = process.stdout.write;
  process.stdout.write = ((chunk: unknown) => {
    chunks.push(typeof chunk === 'string' ? chunk : String(chunk));
    return true;
  }) as typeof process.stdout.write;

  try {
    await import(pathToFileURL(join(REPO_ROOT, 'scripts/ci-seed-instance.ts')).href);
  } finally {
    process.stdout.write = realWrite;
    if (previousKey === undefined) delete process.env['TOKEN_ENCRYPTION_KEY'];
    else process.env['TOKEN_ENCRYPTION_KEY'] = previousKey;
  }

  seedSqlCache = chunks.join('');
  return seedSqlCache;
}

test('the seed produces exactly one users row for the seeded workspace', async () => {
  // Founder decision, 2026-10-09: the owner address equals the
  // gmail_connections address, as seed data. The users model requires
  // workspace_id and email and nothing else, and neither is a credential.
  const sql = await seedSql();

  // First, that the capture read something. An empty capture makes every
  // assertion below fail with the same message as a missing statement, and
  // this file's history is of parses that quietly read nothing.
  expect(sql, 'the generator wrote no SQL, so the capture is reading nothing').toContain(
    'INSERT INTO gmail_connections',
  );

  const inserts = [...sql.matchAll(/INSERT INTO users\b[^;]*;/g)].map((m) => m[0]);
  expect(inserts.length, 'the seed must insert exactly one users row').toBe(1);
  const insert = inserts[0] ?? '';

  // The workspace id is a database default, so it cannot be written in the
  // script and has to come back through \gset. A literal here would insert an
  // orphan row that frontdesk's workspace-scoped findFirst never sees.
  expect(insert, "the users row belongs to the seeded workspace, so use :'ws_id'").toContain(":'ws_id'");
  expect(insert, 'name the two required columns, workspace_id and email').toMatch(
    /\(\s*workspace_id\s*,\s*email\s*\)/,
  );
  // Same address as the connection, by founder decision and as seed data only.
  // No code anywhere requires the two to be equal: assertOwnerAddress at
  // frontdesk/src/main.ts:64 constrains the connection address and never reads
  // a user.
  expect(insert, "the owner address is the connection address, 'smoke@example.com'").toContain(
    "'smoke@example.com'",
  );

  // Inside the one transaction, after the connection row. A half-seeded
  // instance is what the transaction exists to prevent.
  const connectionAt = sql.indexOf('INSERT INTO gmail_connections');
  const usersAt = sql.indexOf('INSERT INTO users');
  const commitAt = sql.indexOf('COMMIT;');
  expect(connectionAt, 'the seed no longer inserts a gmail_connections row').toBeGreaterThan(-1);
  expect(usersAt, 'insert the users row after the connection row').toBeGreaterThan(connectionAt);
  expect(usersAt, 'insert the users row inside the transaction, before COMMIT').toBeLessThan(commitAt);
});

test('the seed is followed by a count that fails on anything but one users row', async () => {
  // The same shape as the gmail_connections assertion above, and for the same
  // reason: a step that inserts nothing must never report success again.
  // frontdesk reads the first users row for the workspace, so one row is
  // right and the comparison is against 1.
  const assertions = composeSmokeSteps().filter((s) => /count\(\*\)[^\n]*\busers\b/.test(s));
  expect(assertions.length, 'exactly one compose-smoke step counts the seeded users row').toBe(1);
  const step = assertions[0] ?? '';

  expect(step, 'read the count with -tAc, or psql pads it with spaces').toContain('-tAc');
  expect(step, 'compare as a string against 1, so an empty result fails rather than errors').toMatch(
    /test "\$[A-Za-z_][A-Za-z0-9_]*" = 1/,
  );
  expect(step, 'the step has to exit non-zero when the count is wrong').toContain('exit 1');
});

test('the users count assertion runs between the seed and the final wait', () => {
  // Order, for the reason the gmail_connections assertion gives: after the
  // final `--wait`, frontdesk fails first and the log says
  // `container orbit-instance-frontdesk-1 is unhealthy`, which names the
  // service and not the reason.
  const text = readRepoFile(WORKFLOW);
  const job = text.slice(text.indexOf('  compose-smoke:'));

  const seedAt = job.indexOf('ci-seed-instance');
  const countAt = job.search(/count\(\*\)[^\n]*\busers\b/);
  const finalWaitAt = job.lastIndexOf('--wait');

  expect(countAt, 'no users count assertion found in the compose-smoke job').toBeGreaterThan(-1);
  expect(countAt, 'count the users row after the seed, not before it').toBeGreaterThan(seedAt);
  expect(countAt, 'count the users row before the health wait, or frontdesk reports the failure first').toBeLessThan(
    finalWaitAt,
  );
});
