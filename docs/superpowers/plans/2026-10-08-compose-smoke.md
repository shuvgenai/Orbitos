# compose-smoke Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the `compose-smoke` CI job pass by supplying every variable the
compose stack and the programs inside it require, using clearly fake values set
in the workflow only, and leave a guard so the job cannot silently lose a
variable again.

**Architecture:** Two changes to `.github/workflows/ci.yml` and one new guard.
The guard reads `template/compose.yml` for the variables compose marks required,
knows the names the two programs require, and asserts the `compose-smoke` job
env supplies all of them with values their own validators accept. Guard first
and failing, then the workflow.

**Tech Stack:** GitHub Actions, Docker Compose, vitest, the validators in
`shared/src/config.ts`.

**Spec:** `docs/decisions.md`, the 2026-10-08 entries "The first CI run, the
accepted advisories and the key this log leaked" (which records compose-smoke as
a known pre-existing failure) and "H2 closed" (which added the mail-variable
rule these values must satisfy). Founder instruction of 2026-10-08 chose option
(a): supply fake Paperclip values rather than scale `frontdesk` to zero.

## Global Constraints

- `template/` is frozen. No edit to `template/compose.yml`, no edit to
  `template/.env.example`, no file created inside `template/`. Reading it is
  fine; guards already do.
- The other six frozen directories are `frontdesk/`, `api/`, `db/`, `shared/`,
  `ops/`, `design/`. Read only.
- Fake values carry no vendor prefix: not `sk-`, `re_`, `AKIA`, `ghp_`,
  `github_pat_`, `xox`, `AIza`, `eyJ`.
- Fake values live in the `compose-smoke` job's `env:` block only. Not in
  `.env.example`, not in `template/.env.example`.
- `MAIL_FROM` must satisfy `guards/standing-rules.test.ts`: empty, an
  interpolation, or an address on a reserved test domain. Use
  `smoke@example.com`.
- Every `uses:` stays a 40-character SHA with its tag in a trailing comment, per
  `guards/workflow-pins.test.ts`.
- Plain language in comments: no em dashes, no exclamation marks.

## Review Focus

Five conditions the spec implies and no task's tests would otherwise exercise,
most likely to bite first:

1. **A variable added to `template/compose.yml` later, with no job env entry.**
   Compose fails at interpolation before any container starts, and its error
   names only what it reached, which is how this job came to be missing four
   variables while the log recorded two. Pinned by Task 1's guard, which reads
   the required set from the compose file rather than from a list in the guard.
2. **A value that is present but invalid for its program.**
   `TOKEN_ENCRYPTION_KEY: smoke` satisfies compose and fails `hex32Check` at
   startup, so the job turns red one layer later with a different message.
   Pinned by Task 1's guard, which runs each value through the real validator.
3. **A name a program requires that compose never supplies.** The four Paperclip
   ids come from `template/.env.frontdesk`, declared `required: false`, so they
   are absent in CI and `frontdesk` crash-loops. Pinned by Task 2's first test.
4. **A fake value that later looks real.** Somebody copies a value out of the
   workflow into `.env.example` or `docs/security/keys.md`. The mail-variable
   check and the `keys.md` shape check already cover those two files. Task 2
   adds the case that the workflow's own values carry no vendor prefix.
5. **A name a program requires reaching the job env but not the container.**
   Compose passes a job-level `env:` entry to its own `${...}` interpolation, not
   into a container. A service receives only what its own `environment:` block
   or an `env_file` gives it. Pinned by Task 2's delivery-path test.

**Corrected after the first CI run, 2026-10-08.** Item 5 originally read
"`frontdesk` or `worker` failing with no healthcheck to report it. Neither
service declares one." That was wrong. Both inherit a healthcheck from the
`x-program` anchor at `template/compose.yml:9`, and the run proved it: `worker`
reported Healthy and `frontdesk` reported unhealthy, which is how the real
failure was found. The replacement above is the condition that actually bit.

---

## File Structure

- `guards/compose-smoke-env.test.ts` — new. Reads the required variable set from
  `template/compose.yml` and the `compose-smoke` job env from
  `.github/workflows/ci.yml`, and asserts the job supplies every required name
  with a value its validator accepts. One responsibility: that job's env is
  complete and valid.
- `.github/workflows/ci.yml` — modified. The `compose-smoke` job gains nine env
  entries and one step. No other job changes.
- `docs/decisions.md` — modified. One entry recording the four-not-two
  correction, the one invalid value, the fake-value policy, and the first run's
  result.

---

### Task 1: The guard, and the five values compose itself needs

**Files:**
- Create: `guards/compose-smoke-env.test.ts`
- Modify: `.github/workflows/ci.yml` (the `compose-smoke` job's `env:` block, and one new step)

**Interfaces:**
- Consumes: `readRepoFile` from `guards/lib/walk.ts`; `hex32Check`, `secretCheck`, `urlCheck` from `shared/src/config.ts`.
- Produces: `requiredByCompose(): readonly string[]` and `jobEnv(job: string): Record<string, string>`, exported from the new guard file so Task 2 extends it without re-parsing either file.

- [ ] **Step 1: Write the failing guard**

Create `guards/compose-smoke-env.test.ts`:

```ts
// The compose-smoke job supplies every variable the stack requires, with values
// the programs inside it accept.
//
// The job was red for two reasons at once and the log recorded one of them.
// Compose marks eighteen variables required with the `:?` form and fails during
// interpolation, before any container starts, naming only what it reached. Four
// were missing. Separately, TOKEN_ENCRYPTION_KEY was set to `smoke`, which
// compose accepts and hex32Check rejects, so fixing the four alone would have
// moved the failure one layer later.
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
 * dependency to read one block of one file is a worse trade than forty lines
 * that fail loudly. The block ends at the first line indented less than its
 * entries.
 */
export function jobEnv(job: string): Record<string, string> {
  const lines = readRepoFile(WORKFLOW).split('\n');
  const start = lines.findIndex((line) => line.startsWith(`  ${job}:`));
  if (start === -1) throw new Error(`${WORKFLOW} has no job named ${job}`);

  const envAt = lines.findIndex((line, i) => i > start && /^    env:\s*$/.test(line));
  if (envAt === -1) throw new Error(`job ${job} has no env block`);

  const out: Record<string, string> = {};
  for (const line of lines.slice(envAt + 1)) {
    if (/^\s*(#.*)?$/.test(line)) continue;
    const entry = line.match(/^      ([A-Z_][A-Z0-9_]*):\s*(.*?)\s*$/);
    if (entry === null) break;
    const [, name = '', raw = ''] = entry;
    out[name] = raw.replace(/\s+#.*$/, '').replace(/^["']|["']$/g, '');
  }
  return out;
}

/** The validator each name faces at program startup, from the two config files. */
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
    // are fake, and a guard that prints them teaches the habit anyway.
    if (problem) bad.push(`${name} ${problem}`);
  }

  expect(bad).toEqual([]);
});

test('the guard is reading both files, not an empty list', () => {
  // Either parse returning nothing makes every assertion above pass vacuously.
  // compose.yml marked eighteen variables required when this was written, and
  // the job set fourteen entries.
  expect(requiredByCompose().length).toBeGreaterThanOrEqual(15);
  expect(Object.keys(jobEnv(JOB)).length).toBeGreaterThanOrEqual(10);
});
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `pnpm vitest run --project unit guards/compose-smoke-env.test.ts`

Expected: FAIL on two tests.
- `the compose-smoke job sets every variable compose requires` lists
  `APPROVAL_LINK_SECRET`, `MAIL_FROM`, `PUBLIC_BASE_URL`, `SETUP_HOST_DIR`.
- `every value the compose-smoke job sets passes its own validator` reports
  `TOKEN_ENCRYPTION_KEY must be 32 bytes as 64 hex characters`.

The third test passes. Record both failure messages for the Task 3 entry.

- [ ] **Step 3: Add the five values to the workflow**

In `.github/workflows/ci.yml`, in the `compose-smoke` job's `env:` block,
replace the `TOKEN_ENCRYPTION_KEY` line and add four entries:

```yaml
      # Sixty-four zeros, which is what hex32Check asks for and nothing more.
      # Zero entropy on purpose: anything encrypted with it is readable by
      # anyone, so it cannot be mistaken for a production key, and the secret
      # scan has no entropy to match.
      TOKEN_ENCRYPTION_KEY: "0000000000000000000000000000000000000000000000000000000000000000"
      # At least 32 characters, per secretCheck, and it says what it is.
      APPROVAL_LINK_SECRET: ci-smoke-not-a-real-secret-000000
      # .invalid is reserved by RFC 2606 and cannot resolve, so a confirm link
      # built on this base cannot be followed from anywhere.
      PUBLIC_BASE_URL: https://ci-smoke.invalid
      # example.com is reserved and cannot receive mail. guards/standing-rules
      # requires a reserved-domain address here.
      MAIL_FROM: smoke@example.com
      # The read-only /setup mount. Created by the step below, under the runner
      # workspace, because template/ is frozen and nothing may be written there.
      SETUP_HOST_DIR: ${{ github.workspace }}/ci-smoke-setup
```

- [ ] **Step 4: Add the step that creates the mount source**

Immediately before the `docker compose ... up` step in the same job:

```yaml
      - name: The /setup mount, which compose mounts read-only
        run: |
          mkdir -p "$SETUP_HOST_DIR"
          : > "$SETUP_HOST_DIR/tone-samples.md"
          : > "$SETUP_HOST_DIR/facts.md"
```

- [ ] **Step 5: Run the guard to verify it passes**

Run: `pnpm vitest run --project unit guards/compose-smoke-env.test.ts`
Expected: PASS, 3 tests.

- [ ] **Step 6: Probe each rule by breaking it**

```bash
cp .github/workflows/ci.yml /tmp/ci.bak
sed -i '/MAIL_FROM: smoke@example.com/d' .github/workflows/ci.yml
pnpm vitest run --project unit guards/compose-smoke-env.test.ts
cp /tmp/ci.bak .github/workflows/ci.yml
sed -i 's/APPROVAL_LINK_SECRET: ci-smoke-not-a-real-secret-000000/APPROVAL_LINK_SECRET: short/' .github/workflows/ci.yml
pnpm vitest run --project unit guards/compose-smoke-env.test.ts
cp /tmp/ci.bak .github/workflows/ci.yml
```

Expected: the first fails naming `MAIL_FROM`; the second fails with
`APPROVAL_LINK_SECRET must be at least 32 characters`. Record both.

- [ ] **Step 7: Run the suites this change can affect**

Run:
```bash
pnpm vitest run --project unit guards/
pnpm typecheck
pnpm lint
```
Expected: all pass. `guards/standing-rules.test.ts` must still pass, because
`MAIL_FROM: smoke@example.com` now sits in a tracked workflow and that guard's
mail-variable check reads workflow files.

- [ ] **Step 8: Commit**

```bash
git add guards/compose-smoke-env.test.ts .github/workflows/ci.yml
git commit -m "fix(ci): compose-smoke supplies every variable compose requires

Four required variables were unset and one was set to a value its program
rejects. Compose fails during interpolation and names only what it reached,
which is why the log recorded two of the five.

APPROVAL_LINK_SECRET, MAIL_FROM, PUBLIC_BASE_URL and SETUP_HOST_DIR are added.
TOKEN_ENCRYPTION_KEY moves from smoke to sixty-four zeros, which is what
hex32Check asks for. Every value is fake by construction: .invalid cannot
resolve, example.com cannot receive mail, and a zero-entropy key cannot be
mistaken for a production one.

The guard reads the required set from template/compose.yml rather than from a
list, so a variable added there fails here instead of in CI."
```

---

### Task 2: The four Paperclip ids compose never supplies

**Files:**
- Modify: `guards/compose-smoke-env.test.ts` (two tests appended)
- Modify: `.github/workflows/ci.yml` (four env entries)

**Interfaces:**
- Consumes: `jobEnv` from Task 1.
- Produces: nothing further.

- [ ] **Step 1: Write the failing tests**

Append to `guards/compose-smoke-env.test.ts`:

```ts
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
```

- [ ] **Step 2: Run them to make sure the first fails**

Run: `pnpm vitest run --project unit guards/compose-smoke-env.test.ts`
Expected: FAIL on `the compose-smoke job sets the names frontdesk needs`,
listing all four. The vendor-prefix test passes already, and it is there to stay
passing.

- [ ] **Step 3: Add the four values to the workflow**

In the same `env:` block:

```yaml
      # frontdesk reads these four from template/.env.frontdesk, which compose
      # marks not required, so CI has to supply them or loadFrontdeskConfig
      # throws and the container crash-loops. readEnv checks presence only for
      # these, so the values only have to be non-empty and obviously fake.
      PAPERCLIP_API_KEY: ci-smoke-not-a-real-key-000000
      PAPERCLIP_COMPANY_ID: ci-smoke-company
      PAPERCLIP_SCOUT_AGENT_ID: ci-smoke-scout-agent
      PAPERCLIP_ORBI_AGENT_ID: ci-smoke-orbi-agent
```

- [ ] **Step 4: Run the guard to verify it passes**

Run: `pnpm vitest run --project unit guards/compose-smoke-env.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 5: Prove the whole frontdesk config loads with exactly these values**

This is the check the founder asked for, and it is stronger than checking each
value alone: `readEnv` applies a format check to only four of frontdesk's fifteen
names, so per-value checks would say nothing about the other eleven.

Create `guards/tmp-frontdesk-env.test.ts`, run it, delete it:

```ts
import { expect, test } from 'vitest';
import { loadFrontdeskConfig } from '../frontdesk/src/config.ts';
import { jobEnv } from './compose-smoke-env.test.ts';

test('frontdesk loads with the job env plus what compose hardcodes', () => {
  const env = {
    ...jobEnv('compose-smoke'),
    // compose sets these on the service rather than from the job env
    DATABASE_URL: 'postgresql://orbit_app:smoke@postgres:5432/orbit',
    REDIS_URL: 'redis://redis:6379',
    PAPERCLIP_API_URL: 'http://paperclip:3100',
    SETUP_DIR: '/setup',
  };
  expect(() => loadFrontdeskConfig(env)).not.toThrow();
});
```

Run: `pnpm vitest run --project unit guards/tmp-frontdesk-env.test.ts`
Expected: PASS. Then `rm guards/tmp-frontdesk-env.test.ts`.

Deleted rather than kept, because importing a test file from another test file
runs that file's tests a second time. The permanent coverage is the five tests
above.

- [ ] **Step 6: Probe by removing one value**

```bash
cp .github/workflows/ci.yml /tmp/ci.bak
sed -i '/PAPERCLIP_COMPANY_ID: ci-smoke-company/d' .github/workflows/ci.yml
pnpm vitest run --project unit guards/compose-smoke-env.test.ts
cp /tmp/ci.bak .github/workflows/ci.yml
```

Expected: FAIL naming `PAPERCLIP_COMPANY_ID`. Record it.

- [ ] **Step 7: Run every suite**

Run:
```bash
pnpm vitest run --project unit guards/
pnpm typecheck
pnpm lint
```
Expected: all pass.

- [ ] **Step 8: Commit**

```bash
git add guards/compose-smoke-env.test.ts .github/workflows/ci.yml
git commit -m "fix(ci): compose-smoke supplies the four ids frontdesk needs

frontdesk requires PAPERCLIP_API_KEY, PAPERCLIP_COMPANY_ID,
PAPERCLIP_SCOUT_AGENT_ID and PAPERCLIP_ORBI_AGENT_ID. They come from
template/.env.frontdesk, which compose declares not required, so CI did not have
them. loadFrontdeskConfig would have thrown and restart: unless-stopped would
have crash-looped the container, which the four missing compose variables were
hiding until now.

readEnv checks presence only for these four, so the values are non-empty and
obviously fake. A second test asserts that no value in this job starts like a
real credential: no sk-, re_, AKIA, ghp_, github_pat_, xox, AIza or eyJ.

Verified by loading the whole frontdesk config with exactly this env, which is
stronger than checking the four alone, since only four of fifteen names have a
format check."
```

---

### Task 3: The record, and what the first CI run actually did

**Files:**
- Modify: `docs/decisions.md`

**Interfaces:**
- Consumes: the probe output from Tasks 1 and 2, and the first CI run's logs.
- Produces: nothing.

- [ ] **Step 1: Push and watch the run**

```bash
git push
gh run watch --exit-status
```

- [ ] **Step 2: Read what frontdesk and worker did**

Neither declares a healthcheck, so `up --wait` may pass on a container that is
restarting. Find out which:

```bash
gh run view --log --job compose-smoke | grep -E 'frontdesk|worker|Container|unhealthy|Waiting'
```

Record, for each of `frontdesk` and `worker`: whether `up --wait` waited for it
at all, whether it reached a running state, and whether it stayed there. If
either crash-looped while the job still passed, that is a finding about this
smoke test's value and goes in the entry as one.

- [ ] **Step 3: Write the entry**

Append to `docs/decisions.md`, heading
`## 2026-10-08 - compose-smoke passes, and what it does not prove`.

It must carry: the four-not-two correction, with the reason compose reports only
what it reached; that one value was invalid rather than missing; the fake-value
policy and why each value cannot be mistaken for a real one; the two probe
outputs from Task 1 and the one from Task 2; and Step 2's finding about the two
services with no healthcheck.

- [ ] **Step 4: Verify the log guard still passes**

Run: `pnpm vitest run --project unit guards/decisions-log.test.ts`
Expected: PASS, 3 tests.

- [ ] **Step 5: Commit and push**

```bash
git add docs/decisions.md
git commit -m "docs(decisions): compose-smoke, and what a green smoke test does not prove"
git push
```

---

### Task 4: The schema and the one row api refuses to start without

**Added 2026-10-08, after the second CI run.** Tasks 1 and 2 fixed the env and
the failure moved twice: `frontdesk` unhealthy, then `api` unhealthy.
`api/src/main.ts:32-35` runs before it listens, reads
`prisma.gmailConnection.findMany({ take: 2 })`, and calls `fail()` unless it
finds **exactly one** row. `template/postgres/init/01-databases.sh` creates two
roles and two empty databases, so compose-smoke has no schema and no row. Env
was never the whole problem. Founder chose migrate-and-seed over excluding `api`.

**Files:**
- Create: `scripts/ci-seed-instance.ts`
- Modify: `guards/compose-smoke-env.test.ts` (one test appended)
- Modify: `.github/workflows/ci.yml` (the `compose-smoke` steps, resequenced)

**Interfaces:**
- Consumes: `encryptToken` from `shared/src/token-crypto.ts`; `jobEnv` from this guard file.
- Produces: `scripts/ci-seed-instance.ts` writes SQL to stdout and nothing else, so the workflow can pipe it into `psql`.

**Why psql and not `prisma migrate deploy`.** The `postgres` service publishes no
host port, so nothing on the runner can reach the database. The DEP-1 step
already shells in with `docker compose exec -T postgres psql`, so the migrations
go the same way. All five migration files were checked for `CREATE EXTENSION`
and none needs one, so `orbit_app`, which owns the database, can apply them.

- [ ] **Step 1: Write the failing test**

Append to `guards/compose-smoke-env.test.ts`:

```ts
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

  // The schema has to exist before api's startup query runs, and api starts
  // with the stack, so the wait for health comes after the seed.
  const seedAt = job.indexOf('ci-seed-instance');
  const waitAt = job.indexOf('--wait');
  expect(seedAt, 'compose-smoke never runs the seed').toBeGreaterThan(-1);
  expect(waitAt, 'compose-smoke never waits for health').toBeGreaterThan(-1);
  expect(seedAt, 'the seed must run before the wait, or api is still crash-looping').toBeLessThan(waitAt);

  // Named, not counted. A migration added later and not applied here is the
  // failure this pins, and it would otherwise show up as api unhealthy with no
  // clue why.
  const unapplied = migrationDirs().filter((dir) => !job.includes(dir));
  expect(unapplied, 'apply these migrations in the compose-smoke job').toEqual([]);
});
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `pnpm vitest run --project unit guards/compose-smoke-env.test.ts`
Expected: FAIL with `compose-smoke never runs the seed`.

- [ ] **Step 3: Write the seed script**

Create `scripts/ci-seed-instance.ts`:

```ts
// The one row api refuses to start without, as SQL on stdout.
//
// api/src/main.ts reads gmailConnection.findMany({ take: 2 }) before it
// listens and calls fail() unless it finds exactly one row. The compose stack
// creates empty databases, so CI has to put the row there.
//
// SQL on stdout rather than a database connection, because the postgres service
// publishes no host port. The workflow pipes this into psql inside the
// container, which is how the DEP-1 check already reaches the database.
//
// The cipher is generated here rather than hardcoded: encryptToken uses a random
// IV, so there is no fixed string to paste, and a hand-written one would decrypt
// to nothing the first time anybody exercised that path.
import { encryptToken } from '../shared/src/token-crypto.ts';

const key = process.env['TOKEN_ENCRYPTION_KEY'];
if (key === undefined || key === '') throw new Error('TOKEN_ENCRYPTION_KEY is required');

// Not a real refresh token and not shaped like one. It is never sent anywhere:
// PUBLIC_BASE_URL is an unresolvable .invalid host and MAIL_FROM is a reserved
// domain, so nothing in this stack can reach Google or a mailbox.
const cipher = encryptToken('ci-smoke-not-a-real-refresh-token', key);

// One workspace, one connection. email_address is on a reserved domain, which
// guards/standing-rules.test.ts also requires of anything in tracked YAML.
process.stdout.write(`BEGIN;
INSERT INTO workspaces (name) VALUES ('CI smoke') RETURNING id \\gset ws_
INSERT INTO gmail_connections (workspace_id, email_address, refresh_token_cipher, history_id)
VALUES (:'ws_id', 'smoke@example.com', '${cipher}', '1');
COMMIT;
`);
```

- [ ] **Step 4: Resequence the workflow steps**

Replace the single `up` step. The order matters and the reason is `api`: it
starts with the stack, fails its startup query, and `restart: unless-stopped`
keeps restarting it, so once the row exists it comes up on its own.

```yaml
      # No --wait here. api fails its startup query until the row below exists,
      # so waiting for health now would time out on a container that is about to
      # be fine. restart: unless-stopped brings it back once the seed lands.
      - run: docker compose -f template/compose.yml up -d --build --scale paperclip=0
      - name: Wait for postgres, which the migrations need
        run: docker compose -f template/compose.yml up -d --wait postgres redis
      - name: Apply every migration, oldest first
        run: |
          for dir in db/prisma/migrations/*/; do
            name=$(basename "$dir")
            echo "applying $name"
            docker compose -f template/compose.yml exec -T postgres \
              psql -v ON_ERROR_STOP=1 -U orbit_app -d orbit < "$dir/migration.sql"
          done
      - name: Seed the one GmailConnection row api requires
        run: |
          node --import tsx scripts/ci-seed-instance.ts \
            | docker compose -f template/compose.yml exec -T postgres \
                psql -v ON_ERROR_STOP=1 -U orbit_app -d orbit
      - name: Now every service can be healthy
        run: docker compose -f template/compose.yml up -d --wait --scale paperclip=0
      # Whatever happens next, say what the containers did. The first two runs of
      # this job reported only "container X is unhealthy", which named the
      # service and not the reason, and both reasons were in a container log.
      - if: failure()
        run: docker compose -f template/compose.yml logs --tail 50
```

- [ ] **Step 5: Run the guard to verify it passes**

Run: `pnpm vitest run --project unit guards/compose-smoke-env.test.ts`
Expected: PASS, 6 tests.

- [ ] **Step 6: Probe**

```bash
cp .github/workflows/ci.yml /tmp/ci.bak
sed -i 's/ci-seed-instance/ci-seed-absent/' .github/workflows/ci.yml
pnpm vitest run --project unit guards/compose-smoke-env.test.ts
cp /tmp/ci.bak .github/workflows/ci.yml
sed -i 's/20261001000200_lead_issue_attempts/x/' .github/workflows/ci.yml
pnpm vitest run --project unit guards/compose-smoke-env.test.ts
cp /tmp/ci.bak .github/workflows/ci.yml
```

Expected: the first fails with `compose-smoke never runs the seed`. The second
is a no-op, because the migration loop globs the directory rather than naming
each one, so instead delete the whole `Apply every migration` step and expect the
unapplied list to name all five.

- [ ] **Step 7: Run every suite**

```bash
pnpm vitest run --project unit guards/
pnpm typecheck
pnpm lint
git status --porcelain template/
```
Expected: all pass, and `template/` shows no change.

- [ ] **Step 8: Commit, push, and read the run**

```bash
git add scripts/ci-seed-instance.ts guards/compose-smoke-env.test.ts .github/workflows/ci.yml
git commit -F - <<'EOF'
fix(ci): compose-smoke migrates the schema and seeds the row api needs
EOF
git push
gh run watch --exit-status
```

Expected: `compose-smoke` passes, or the new `if: failure()` step prints the
container log that says why. Record whichever happens in Task 3's entry.
