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
import { expect, test } from 'vitest';
import { hex32Check, secretCheck, urlCheck } from '../shared/src/config.ts';
import { readRepoFile } from './lib/walk.ts';

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

test('the compose-smoke job sets the names frontdesk needs that compose does not pass', () => {
  const env = jobEnv(JOB);
  const missing = FROM_INSTANCE_ENV.filter((name) => (env[name] ?? '') === '');

  expect(missing, 'frontdesk reads these from .env.frontdesk, which CI does not have').toEqual([]);
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

test('the guard is reading both files, not an empty list', () => {
  // Either parse returning nothing makes every assertion above pass vacuously.
  // compose.yml marked eighteen variables required when this was written, and
  // the job set fourteen entries.
  expect(requiredByCompose().length).toBeGreaterThanOrEqual(15);
  expect(Object.keys(jobEnv(JOB)).length).toBeGreaterThanOrEqual(10);
});
