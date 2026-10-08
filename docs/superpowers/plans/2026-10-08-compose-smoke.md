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

---

### Task 5: Cause 8, the seed step that reports success while inserting nothing

**Added 2026-10-08, after the run on `b69c55a`.** Tasks 1 to 4 fixed causes 1
to 7 and the job is still red. Run `37847150901`, job `113550751764`: step 8
`Seed the one GmailConnection row api requires` reported **success** and step 9
`Now every service can be healthy` failed with
`container orbit-instance-api-1 is unhealthy`. The container log says
`expected exactly one GmailConnection row, found 0; see the runbook`.

The decisive line in step 8's own log is

```
/home/runner/work/_temp/e4c866b2-4e9a-467d-b851-7401ee72ad65.sh: line 1: pnpm: command not found
```

That is sharper than the earlier diagnosis in `docs/decisions.md`, which said
"there are no `node_modules`". The job never ran `pnpm install`, true, but it
also never put `pnpm` on the runner: `compose-smoke` has no
`pnpm/action-setup` and no `actions/setup-node`. The generator did not fail
part way, it never started. The step still went green, because a GitHub Actions
`run:` block is `bash -e` and not `bash -eo pipefail`, so the pipeline's exit
status was `psql`'s, and `psql` with empty stdin exits 0.

**Goal of this task.** The three-part fix the 2026-10-08 decisions entry
proposed and deliberately did not apply, plus a guard for each part.

**Files:**
- Modify: `.github/workflows/ci.yml` (the `compose-smoke` job: the seed step at
  about line 257 and the steps around it)
- Modify: `guards/compose-smoke-env.test.ts` (four tests appended)

**Interfaces:**
- Consumes: `readRepoFile` from `guards/lib/walk.ts` and the `WORKFLOW`
  constant, both already present in this guard file.
- Produces: nothing other code consumes. The four tests are static assertions
  on the workflow text.

**Constraints that apply to this task only.** Change only what cause 8
requires. Do not touch the steps for causes 1 to 7. Do not edit the staging
comment at `.github/workflows/ci.yml:217`, which already carries its own
correction. Reuse the action SHAs the `test` job pins, because
`guards/workflow-pins.test.ts` requires a full commit SHA with a version
comment: `pnpm/action-setup@b906affcce14559ad1aafd4ab0e942779e9f58b1` (v4) and
`actions/setup-node@a0853c24544627f65ddf259abe73b1d18a591444` (v5).

**Note on line endings.** `readRepoFile` returns the file as checked out, so on
Windows every line ends `\r\n`, and a regex `.` does not match `\r`. That
mistake made an earlier version of this guard read 8 of 18 variables. Use
`includes` on plain substrings, and bound any regex with `[^\n]*` rather than
`.*`.

**Review focus for this task.** Five ways the fix could still pass while the
thing it checks has not happened. Each is pinned by one of the four tests in
Step 1.

1. `psql` exits 0 on empty stdin. That is cause 8 itself. Pinned by
   "every compose-smoke step that pipes sets pipefail".
2. The count query returns an empty string, because the `psql` call in the
   assertion failed. `test "$rows" -eq 1` would error with "integer expression
   expected" instead of failing on the value, so the comparison is a string
   one. Pinned by "the seed is followed by a count that fails on anything but
   one row".
3. `psql` pads tuple output unless `-tA` is given, so a correct seed would fail
   the string comparison. The DEP-1 step in this job already uses `-tAc` for
   that reason. Pinned by the same test.
4. Two rows instead of zero. api requires exactly one, so a double seed is as
   wrong as none, and the comparison is against `1` and not a minimum. Pinned
   by the same test.
5. The assertion placed after the final `--wait`. Then api fails first and the
   log says `container orbit-instance-api-1 is unhealthy`, the message that hid
   this cause for a day. Pinned by "the count assertion runs between the seed
   and the final wait".

- [ ] **Step 1: Write the four failing tests**

Append to `guards/compose-smoke-env.test.ts`:

```ts
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
  // The pipe is matched at end of line, which is how every piped step in this
  // job is written. A pipe written inline on one line would not be caught, and
  // adding one is a reason to extend this test rather than loosen it.
  const offenders = composeSmokeSteps()
    .filter((s) => /\|[ \t]*$/m.test(s))
    .filter((s) => !s.includes('set -o pipefail'))
    .map((s) => (s.split('\n')[0] ?? '').trim());

  expect(offenders, 'a step with a pipe needs `set -o pipefail`, or it reports the wrong exit code').toEqual(
    [],
  );
});

test('compose-smoke installs its dependencies before the seed generator runs', () => {
  // The job was a checkout and Docker commands only, so pnpm was not on the
  // runner at all. The log line was `pnpm: command not found`.
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
```

- [ ] **Step 2: Run the file and watch all four fail**

```bash
pnpm vitest run guards/compose-smoke-env.test.ts
```

Expected: FAIL. Four new tests red, the seven existing ones green. The messages
should be: a step with a pipe needs `set -o pipefail`; compose-smoke never
installs dependencies; exactly one compose-smoke step counts the seeded rows;
no count assertion found in the compose-smoke job.

If any of the four passes now, stop. It is asserting something other than what
it claims, which is the defect this task exists to fix.

- [ ] **Step 3: Add the Node and pnpm setup to the compose-smoke job**

In `.github/workflows/ci.yml`, immediately before the
`Seed the one GmailConnection row api requires` step, insert:

```yaml
      # The seed generator is TypeScript and needs node and tsx, and this job
      # was a checkout and Docker commands only, so pnpm was not on the runner
      # at all. The log said `pnpm: command not found`, the step still reported
      # success, and api started on an empty table.
      #
      # Placed here rather than after the checkout, so the Docker build runs
      # first and this install sits next to the one step that needs it. The same
      # pinned actions and the same .nvmrc the test job uses, because a second
      # way of getting node onto a runner is a second thing to keep right.
      - uses: pnpm/action-setup@b906affcce14559ad1aafd4ab0e942779e9f58b1  # v4
      - uses: actions/setup-node@a0853c24544627f65ddf259abe73b1d18a591444  # v5
        with:
          node-version-file: .nvmrc
          cache: pnpm
      - run: pnpm install --frozen-lockfile
```

- [ ] **Step 4: Add `set -o pipefail` to the seed step**

Add one line to the comment above that step:

```yaml
      # A GitHub Actions run block is `bash -e`, which does not set pipefail, so
      # the pipeline's status was psql's, and psql exits 0 on empty stdin.
```

Then make the step read:

```yaml
      - name: Seed the one GmailConnection row api requires
        run: |
          set -o pipefail
          pnpm --filter @orbit/ops exec node --import tsx ../scripts/ci-seed-instance.ts \
            | docker compose -f template/compose.yml exec -T \
                -e PGPASSWORD="$ORBIT_DB_PASSWORD" postgres \
                psql -v ON_ERROR_STOP=1 -h 127.0.0.1 -U orbit_app -d orbit
```

- [ ] **Step 5: Add the row-count assertion after the seed**

Insert immediately after the seed step, before
`Now every service can be healthy`:

```yaml
      # The seed step reporting success is not evidence that it inserted
      # anything. This is. api/src/main.ts reads gmail_connections before it
      # listens and refuses to start on anything but exactly one row, so two
      # rows are as wrong as none and the comparison is against 1.
      #
      # Before the health wait on purpose. After it, api fails first and the log
      # says `container orbit-instance-api-1 is unhealthy`, which names the
      # service and not the reason.
      - name: Exactly one GmailConnection row, or the seed did nothing
        run: |
          set -o pipefail
          rows=$(docker compose -f template/compose.yml exec -T \
            -e PGPASSWORD="$ORBIT_DB_PASSWORD" postgres \
            psql -v ON_ERROR_STOP=1 -h 127.0.0.1 -U orbit_app -d orbit \
            -tAc "select count(*) from gmail_connections")
          test "$rows" = 1 || { echo "expected exactly one gmail_connections row, found [$rows]"; exit 1; }
```

- [ ] **Step 6: Run the guard file and watch all eleven pass**

```bash
pnpm vitest run guards/compose-smoke-env.test.ts
```

Expected: PASS, 11 tests, 0 failed.

- [ ] **Step 7: Run the Done checks this diff can affect, one at a time**

Run each separately and read the output of each. Never chain a commit onto any
of them.

```bash
pnpm vitest run guards/workflow-pins.test.ts
pnpm typecheck
pnpm lint
pnpm lint:frozen:danger
pnpm test
git status --porcelain template/
```

Expected: each exits 0 and reports 0 failed, and `template/` shows no change.
`pnpm test` needs the database: `pnpm db:up` then `pnpm db:generate` first if it
is not already up.

`guards/workflow-pins.test.ts` is the most likely of these to fail, because the
diff adds two third-party action references. Both reuse the SHAs the `test` job
already pins, so it should pass unmodified.

- [ ] **Step 8: Commit**

```bash
git add .github/workflows/ci.yml guards/compose-smoke-env.test.ts docs/superpowers/plans/2026-10-08-compose-smoke.md
git commit -m "fix(ci): compose-smoke installs deps, sets pipefail and counts the seeded row"
```

- [ ] **Step 9: Update the cause table and append the record**

In `docs/decisions.md`, change the cause 8 row of the
`2026-10-08 - compose-smoke: eight causes` entry from

```
| 8 | The seed step reports success while inserting nothing | **open** |
```

to `fixed, ` and the short hash from Step 8.

Then append a new entry. The heading format is `## <ISO date> - <decision>` and
the body opens with `**Reason`, `**Why`, `**Result` or `**Superseded`. Use
`**Corrects:**` for anything that corrects an earlier statement. Do not write
"Superseded by" unless a dated replacement entry exists to point at, because
`guards/decisions-log.test.ts` rejects the phrase without one. The entry says:

- the three changes and where they are,
- that the first failing line was `pnpm: command not found`, which corrects the
  earlier entry's "there are no `node_modules`": pnpm itself was absent, not
  only the install,
- that the third part is the one that changes the class of error,
- the four new guard tests by name,
- the alternative considered and not taken, below,
- the cost if wrong.

Then run, separately:

```bash
pnpm vitest run guards/decisions-log.test.ts
pnpm vitest run guards/rules.test.ts guards/standing-rules.test.ts
```

Expected: PASS, 0 failed. Commit with
`docs(decisions): cause 8 fixed, and what the fix does not prove`.

- [ ] **Step 10: Push and read the real run**

```bash
git push
```

Then read the per-job result from CI, not from a local run. If `compose-smoke`
fails on something that is not cause 8, do not fix it: record it as cause 9 in
`docs/decisions.md` with the log excerpt and a diagnosis, push that record, and
stop.

**The alternative considered and not taken.** Node 24 strips TypeScript types
natively, and both `scripts/ci-seed-instance.ts` and the one file it imports,
`shared/src/token-crypto.ts`, import nothing outside `node:crypto`. So
`node scripts/ci-seed-instance.ts` after `actions/setup-node` alone would work
with no `pnpm install` at all, saving about a minute and 315 MB of
`node_modules` on the runner.

Not taken, because it introduces a second way of running TypeScript in this
repository for a one-line saving, and its precondition is invisible at the call
site: the day somebody adds a third-party import to that script or to
`shared/src/token-crypto.ts`, the job breaks for a reason nothing in either file
explains. The pnpm path is the one the `test` job already proves every run.
Revisit if the install becomes the slowest part of this job.

**What a green compose-smoke will still not prove.** Unchanged from Task 3's
entry, and repeated so this task is not read as closing more than it does. A
green run proves the compose file parses with real values, that both databases
and both logins exist, that the schema applies, that exactly one
`GmailConnection` row is seeded, and that `postgres`, `redis`, `web`, `worker`,
`api` and `frontdesk` start and answer their healthchecks. It proves nothing
about the engine, which is excluded with `--scale paperclip=0`, and nothing
about behaviour beyond boot.
