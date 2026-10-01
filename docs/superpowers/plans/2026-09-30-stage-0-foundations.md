# Stage 0 Foundations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Stage 0 foundations from PRD v6.1 §18: repo + CI, Node 24, the Postgres template (two databases, two logins), the ORBIT schema with the approvals and job-row schemas frozen first, the shared draft/verdict schema module, a compose template for the four ORBIT programs, DESIGN.md, and a verified Resend sending domain.

**Architecture:** A pnpm workspace monorepo. `shared/` holds pure TypeScript contracts (state machines, Zod schemas, enums). `db/` owns the Prisma schema, the migrations and small typed helpers for approvals, jobs, timers and the ledger. `api/`, `web/`, `worker/` and `frontdesk/` are health-check stubs in this stage, so the compose template can be built, started and tested. The three partitioned ledger tables live in a separate Postgres schema (`ledger`) so Prisma never sees them.

**Tech Stack:** Node 24.14.1, pnpm 10.33.0, TypeScript 7.0.2, Vitest 5.0.3, Zod 4.6.5, Prisma 7.10.0 with `@prisma/adapter-pg`, PostgreSQL 16 (pgvector image), Redis 7, pino 10.3.1, tsx 4.23.15, Resend 6.31.0, Docker Compose, GitHub Actions.

**Spec:** `ORBIT_OS_PRD_v6_2.md` (§5, §6, §7, §8A, §12, §14A, §15, §16, §18, §23 tasks 1–3, 5 and 7), with decisions from `ORBIT_OS_Eng_Review_v3_2026-09-30.md` (worktree strategy, S1–S2) and `ORBIT_OS_CEO_Review_v2_2026-09-30.md`.

**Not in this plan:** Stage 0b, the engine spike (Paperclip + Hermes via `hermes_local`, PRD §18 row 0b, task E3-T1). It gets its own plan because its contents depend on the pinned upstream versions. It runs in parallel with Tasks 4–6. The Paperclip + Hermes container definition (E3-T2) is added to `template/compose.yml` by that plan. See "Open questions" item 3.

## Global Constraints

- Runtime: "Node 24 LTS (Paperclip needs 24.11+)" (PRD §7). Pin `node:24.14.1-slim` in Docker and `24.14.1` in `.nvmrc`.
- Data: "PostgreSQL 16 with pgvector; one server per instance, databases `orbit` and `paperclip`" with "separate logins" (PRD §7, DEP-1).
- "The schema keeps `workspace_id` with a single workspace per instance. No row-level security or tenant filtering is implemented." (DEP-6)
- `.env.local` is never committed (E-T1). Secrets never appear in code, logs or fixtures.
- "Postgres rows are the source of truth for every pending step … Bull only executes." (PRD §6)
- "Approval ID states: `issued → sending → sent / failed / void`, with a database lock. Invalid transitions are `sent → sending` and `void → sending`." (FD-5)
- "Timers are Postgres rows checked every minute, so they survive a restart or restore." (FD-4)
- "`events` … append-only"; "`events`, `llm_calls` and `decision_calls` are partitioned by month." (DAT-1, DAT-2)
- "Retention is configuration in `retention_policies` … No retention is hard-coded elsewhere." (DAT-3)
- "No database, Redis, Paperclip or Hermes port is reachable from the public internet." (SEC-1)
- "Only the Front Desk service can send through Gmail … The web and API programs never hold Gmail credentials." (SEC-2)
- DESIGN.md tokens: "ink `#000`, paper `#fff`, canvas `#f4f4f5`, muted `#52525b`, line `#e4e4e7`, plus dark variants"; "Inter, body ≥ 16 px"; "10 px button radius, 1 px dividers, no shadows"; "One `--color-danger` (AA red)" (UX-1). "Contrast ≥ 4.5:1 … 3 px focus ring" (UX-7).
- Customer-facing text says "Orbitcrew", never "ORBIT-OS, Paperclip, Hermes, adapters, heartbeats or tokens" (UX-6). This includes the Resend check email.
- Exact dependency versions only (`.npmrc` sets `save-exact=true`). Upgrades go through a pull request, matching UPG-1.

## Review Focus

1. **Two actors race on one approval** (two send workers, or two owner taps). Exactly one transition and exactly one decision must win (AUTH-10, FD-5). Tests: Task 4, "concurrent issued→sending: exactly one wins" and "a second decision on the same approval is rejected".
2. **A hostile or malformed agent comment** (two JSON blocks, extra keys, a multi-line reason, a 1 MB comment). It must be rejected with an error and never parse into a draft (FD-2a, FD-3). Tests: Task 2.
3. **A worker crashes mid-job.** Its lease expires and another worker reclaims the job. After `max_attempts` the job becomes `dead`, never stuck in `running` (E3-T4). Tests: Task 5.
4. **An event is written for a month with no partition.** The insert must fail loudly, never drop silently. Creating partitions must be idempotent (DAT-1, DAT-2). Tests: Task 6.
5. **The same Gmail message arrives twice, or an address differs only in case.** A duplicate Message-ID is rejected. An uppercase address is rejected by a CHECK constraint, so dedupe and the known-contact index cannot split one person in two (FD-1, FD-1a). Tests: Task 4.

---

## File Structure

```
.gitattributes                 LF endings for shell scripts (the init script runs in Linux)
.npmrc                         save-exact=true
.nvmrc                         24.14.1
package.json                   root scripts + shared dev tools
pnpm-workspace.yaml            workspace package list
tsconfig.json                  one typecheck for the whole repo
vitest.config.ts               two projects: unit (no DB) and db (needs Postgres)
compose.dev.yml                local/CI Postgres + Redis on 127.0.0.1 only
Dockerfile, .dockerignore      one image recipe for the four ORBIT programs
.github/workflows/ci.yml       CI on every push
DESIGN.md                      the single design system (UX-1)
design/tokens.css              DESIGN.md tokens as CSS variables
design/tokens.test.ts          token/DESIGN.md consistency + contrast checks
shared/                        @orbit/shared: pure contracts, no I/O except the health server
  src/health.ts                GET /healthz server used by every program stub
  src/approvals.ts             approval states, categories, transition table (frozen)
  src/agent-output.ts          Zod draft/verdict blocks + comment parser (frozen)
  src/jobs.ts                  job kinds, job states, timer kinds (frozen)
  src/events.ts                ledger event types
db/                            @orbit/db: Prisma schema, migrations, typed helpers
  prisma.config.ts
  prisma/schema.prisma
  prisma/migrations/…          core, jobs_timers, ledger
  src/client.ts                createPrisma()
  src/approvals.ts             transitionApproval()
  src/jobs.ts                  enqueueJob, claimDueJobs, completeJob, failJob, markStuckJobsDead
  src/timers.ts                scheduleTimer, cancelTimer, fireDueTimers
  src/ledger.ts                appendEvent, ensureMonthPartitions
  test/…                       integration tests against real Postgres
api/ web/ worker/ frontdesk/   program stubs: src/main.ts starts the health server
ops/                           @orbit/ops: Resend sending-domain check
template/
  compose.yml                  per-instance stack (engine container added by the Stage 0b plan)
  .env.example                 variable names only
  postgres/init/01-databases.sh  creates orbit + paperclip databases and logins
  test/compose.test.ts         static checks of compose.yml (SEC-1, SEC-2)
  test/postgres-logins.test.ts login isolation against the dev Postgres
```

Build order: Task 0 (human) → Task 1 → Tasks 2, 3, 8 and 9 in any order → Task 4 → Tasks 5 and 6 → Task 7.

---

### Task 0: Machine prerequisites (founder, ~30 min)

**Files:** none.

- [ ] **Step 1: Install Docker Desktop for Windows** with the WSL 2 backend (docker.com → Docker Desktop). Restart when asked.
- [ ] **Step 2: Confirm Docker works**

Run: `docker version` and `docker compose version`
Expected: both print a version; no "command not found".

- [ ] **Step 3: Confirm the GitHub repo is private.** Open github.com/shuvgenai/Orbitos → Settings → General → "Danger Zone". The visibility button offers "Make public", which means the repo is private now.
- [ ] **Step 4: Add the local database URL to `.env.local`** (the file stays out of Git):

```
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/orbit_test
```

---

### Task 1: Repo scaffold, health server and CI

**Files:**
- Create: `.gitattributes`, `.npmrc`, `.nvmrc`, `package.json`, `pnpm-workspace.yaml`, `tsconfig.json`, `vitest.config.ts`, `.github/workflows/ci.yml`
- Create: `shared/package.json`, `shared/src/health.ts`
- Test: `shared/src/health.test.ts`
- Modify: `.gitignore`

**Interfaces:**
- Produces: `startHealthServer(opts: { name: string; port: number }): Server` exported from `@orbit/shared/health`. `GET /healthz` returns 200 with JSON `{ "status": "ok", "program": name }`; any other path returns 404.
- Produces: root scripts `pnpm test`, `pnpm test:unit`, `pnpm typecheck`.
- Produces: the Vitest project `unit`, which already covers `shared/`, `design/`, `ops/` and `template/test/compose.test.ts`, so later tasks do not edit it.

- [ ] **Step 1: Write the root config files**

`.gitattributes`:
```
* text=auto
*.sh text eol=lf
```

`.npmrc`:
```
save-exact=true
```

`.nvmrc`:
```
24.14.1
```

`pnpm-workspace.yaml`:
```yaml
packages:
  - shared
  - db
  - api
  - web
  - worker
  - frontdesk
  - ops
```

`package.json`:
```json
{
  "name": "orbit-os",
  "private": true,
  "type": "module",
  "packageManager": "pnpm@10.33.0",
  "engines": { "node": ">=24.11" },
  "scripts": {
    "test": "vitest run",
    "test:unit": "vitest run --project unit",
    "typecheck": "tsc -p tsconfig.json"
  },
  "devDependencies": {
    "@types/node": "24.19.0",
    "typescript": "7.0.2",
    "vitest": "5.0.3"
  }
}
```

`tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "es2024",
    "lib": ["es2024"],
    "module": "nodenext",
    "moduleResolution": "nodenext",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "allowImportingTsExtensions": true,
    "noEmit": true,
    "skipLibCheck": true,
    "types": ["node"]
  },
  "include": ["**/*.ts"],
  "exclude": ["node_modules", "**/node_modules", "landing", "archive", "**/generated/**"]
}
```

`vitest.config.ts`:
```ts
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
```

Append to `.gitignore`:
```
# Dependencies and generated code
node_modules/
**/generated/
```

`shared/package.json`:
```json
{
  "name": "@orbit/shared",
  "private": true,
  "type": "module",
  "exports": {
    "./health": "./src/health.ts"
  }
}
```

- [ ] **Step 2: Install and confirm the toolchain**

Run: `pnpm install`
Expected: creates `pnpm-lock.yaml`, no errors.

Run: `git check-ignore .env.local`
Expected: prints `.env.local`.

- [ ] **Step 3: Write the failing test**

`shared/src/health.test.ts`:
```ts
import { afterEach, expect, test } from 'vitest';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { startHealthServer } from './health.ts';

let server: Server | undefined;
afterEach(() => new Promise<void>((done) => (server ? server.close(() => done()) : done())));

async function listen(name: string): Promise<string> {
  server = startHealthServer({ name, port: 0 });
  await new Promise<void>((resolve) => server!.once('listening', () => resolve()));
  const { port } = server.address() as AddressInfo;
  return `http://127.0.0.1:${port}`;
}

test('GET /healthz returns ok with the program name', async () => {
  const base = await listen('api');
  const res = await fetch(`${base}/healthz`);
  expect(res.status).toBe(200);
  expect(await res.json()).toEqual({ status: 'ok', program: 'api' });
});

test('any other path returns 404', async () => {
  const base = await listen('api');
  const res = await fetch(`${base}/`);
  expect(res.status).toBe(404);
});
```

- [ ] **Step 4: Run it and confirm it fails**

Run: `pnpm test:unit`
Expected: FAIL, "Failed to load url ./health.ts" (or "Cannot find module").

- [ ] **Step 5: Implement the health server**

`shared/src/health.ts`:
```ts
import { createServer, type Server } from 'node:http';

// Every ORBIT program exposes GET /healthz so compose and the uptime check can probe it.
export function startHealthServer(opts: { name: string; port: number }): Server {
  const server = createServer((req, res) => {
    if (req.method === 'GET' && req.url === '/healthz') {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok', program: opts.name }));
      return;
    }
    res.writeHead(404).end();
  });
  server.listen(opts.port);
  return server;
}
```

- [ ] **Step 6: Run the tests and the typecheck**

Run: `pnpm test:unit` → Expected: 2 passed.
Run: `pnpm typecheck` → Expected: no output, exit 0.

- [ ] **Step 7: Add CI**

`.github/workflows/ci.yml`:
```yaml
name: CI
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-24.04
    steps:
      - uses: actions/checkout@v5
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v5
        with:
          node-version-file: .nvmrc
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm typecheck
      - run: pnpm test
```

- [ ] **Step 8: Commit and push**

```bash
git add .gitattributes .npmrc .nvmrc .gitignore package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.json vitest.config.ts .github shared
git commit -m "chore: scaffold pnpm workspace, health server and CI"
git push -u origin stage-0
```

- [ ] **Step 9: Prove CI turns red on a failing test (E-T1 verify)**

Temporarily change `toBe(200)` to `toBe(201)` in `shared/src/health.test.ts`, then:
```bash
git commit -am "test: deliberately failing test to prove CI goes red"
git push
```
Expected: GitHub → Actions shows the run **red**. Then revert:
```bash
git revert --no-edit HEAD
git push
```
Expected: the next run is **green**.

---

### Task 2: Frozen shared contracts (approvals, jobs, events, agent output)

**Files:**
- Create: `shared/src/approvals.ts`, `shared/src/jobs.ts`, `shared/src/events.ts`, `shared/src/agent-output.ts`
- Test: `shared/src/approvals.test.ts`, `shared/src/agent-output.test.ts`
- Modify: `shared/package.json`

**Interfaces:**
- Produces (`@orbit/shared/approvals`): `APPROVAL_STATES`, `type ApprovalState`, `APPROVAL_CATEGORIES`, `type ApprovalCategory`, `canTransition(from: ApprovalState, to: ApprovalState): boolean`.
- Produces (`@orbit/shared/jobs`): `JOB_KINDS`, `type JobKind`, `JOB_STATES`, `type JobState`, `TIMER_KINDS`, `type TimerKind`.
- Produces (`@orbit/shared/events`): `EVENT_TYPES`, `type EventType`.
- Produces (`@orbit/shared/agent-output`): `DraftBlock`, `VerdictBlock` (Zod schemas), `type Draft`, `type Verdict`, `MAX_COMMENT_CHARS`, `parseAgentComment(comment: string, expected: 'draft' | 'verdict'): ParseResult`, where `ParseResult = { ok: true; block: Draft | Verdict } | { ok: false; error: string }`.

- [ ] **Step 1: Add the Zod dependency and exports**

`shared/package.json`:
```json
{
  "name": "@orbit/shared",
  "private": true,
  "type": "module",
  "exports": {
    "./health": "./src/health.ts",
    "./approvals": "./src/approvals.ts",
    "./jobs": "./src/jobs.ts",
    "./events": "./src/events.ts",
    "./agent-output": "./src/agent-output.ts"
  },
  "dependencies": {
    "zod": "4.6.5"
  }
}
```

Run: `pnpm install` → Expected: lockfile updated.

- [ ] **Step 2: Write the failing approvals test**

`shared/src/approvals.test.ts`:
```ts
import { expect, test } from 'vitest';
import { APPROVAL_STATES, canTransition, type ApprovalState } from './approvals.ts';

const ALLOWED: Array<[ApprovalState, ApprovalState]> = [
  ['issued', 'sending'],
  ['issued', 'void'],
  ['sending', 'sent'],
  ['sending', 'failed'],
  ['failed', 'sending'], // the owner's "Resend" button (FD-5)
  ['failed', 'void'],
];

test('exactly the allowed transitions pass', () => {
  for (const from of APPROVAL_STATES) {
    for (const to of APPROVAL_STATES) {
      const expected = ALLOWED.some(([f, t]) => f === from && t === to);
      expect(canTransition(from, to), `${from} -> ${to}`).toBe(expected);
    }
  }
});

test('the transitions FD-5 names as invalid are rejected', () => {
  expect(canTransition('sent', 'sending')).toBe(false);
  expect(canTransition('void', 'sending')).toBe(false);
});

test('sent and void are terminal', () => {
  for (const to of APPROVAL_STATES) {
    expect(canTransition('sent', to)).toBe(false);
    expect(canTransition('void', to)).toBe(false);
  }
});
```

- [ ] **Step 3: Run it and confirm it fails**

Run: `pnpm test:unit` → Expected: FAIL, cannot load `./approvals.ts`.

- [ ] **Step 4: Implement approvals, jobs and events**

`shared/src/approvals.ts`:
```ts
// Frozen contract (PRD §18): change only with a migration and a review.
export const APPROVAL_STATES = ['issued', 'sending', 'sent', 'failed', 'void'] as const;
export type ApprovalState = (typeof APPROVAL_STATES)[number];

// AUTH-2 categories, least to most sensitive.
export const APPROVAL_CATEGORIES = ['routine', 'decline_refer', 'board_level'] as const;
export type ApprovalCategory = (typeof APPROVAL_CATEGORIES)[number];

// FD-5. The database trigger in db/prisma/migrations/*_core enforces the same table.
const ALLOWED: Record<ApprovalState, readonly ApprovalState[]> = {
  issued: ['sending', 'void'],
  sending: ['sent', 'failed'],
  failed: ['sending', 'void'],
  sent: [],
  void: [],
};

export function canTransition(from: ApprovalState, to: ApprovalState): boolean {
  return ALLOWED[from].includes(to);
}
```

`shared/src/jobs.ts`:
```ts
// Frozen contract (PRD §18): Front Desk and worker both write job rows.
export const JOB_KINDS = ['draft_poll', 'verdict_poll', 'notice', 'digest', 'send', 'ack_send'] as const;
export type JobKind = (typeof JOB_KINDS)[number];

export const JOB_STATES = ['pending', 'running', 'done', 'failed', 'dead'] as const;
export type JobState = (typeof JOB_STATES)[number];

// FD-4 timers: 2 h reminder, 72 h void, daily digest, ack cap window (ACK-3).
export const TIMER_KINDS = ['reminder_2h', 'void_72h', 'digest_daily', 'ack_cap_window'] as const;
export type TimerKind = (typeof TIMER_KINDS)[number];
```

`shared/src/events.ts`:
```ts
// DAT-1 event types. Receipts, audit views, rollups and exports are projections of these.
export const EVENT_TYPES = [
  'email_received',
  'ack_sent',
  'issue_created',
  'draft_delivered',
  'orbi_verdict',
  'decision_recorded',
  'message_sent',
  'auto_ack_switched_off',
  'budget_warning',
  'upgrade_applied',
] as const;
export type EventType = (typeof EVENT_TYPES)[number];
```

- [ ] **Step 5: Run the approvals tests**

Run: `pnpm test:unit` → Expected: approvals tests pass.

- [ ] **Step 6: Write the failing agent-output test**

`shared/src/agent-output.test.ts`:
```ts
import { expect, test } from 'vitest';
import { MAX_COMMENT_CHARS, parseAgentComment } from './agent-output.ts';

const fence = (json: unknown) => '```json\n' + JSON.stringify(json, null, 2) + '\n```';

const draft = {
  kind: 'draft',
  schemaVersion: 1,
  draft: 'Hi Maya, thanks for reaching out about the audit.',
  category: 'routine',
  flags: [],
  reason: 'Routine intro request; no pricing mentioned.',
};
const verdict = { kind: 'verdict', schemaVersion: 1, verdict: 'lead', reason: 'Asks for a quote.' };

test('parses a valid draft wrapped in prose', () => {
  const r = parseAgentComment(`Here is my draft.\n\n${fence(draft)}\n\nDone.`, 'draft');
  expect(r).toEqual({ ok: true, block: draft });
});

test('parses a valid verdict', () => {
  expect(parseAgentComment(fence(verdict), 'verdict')).toEqual({ ok: true, block: verdict });
});

test('rejects a comment with no JSON block', () => {
  const r = parseAgentComment('I could not draft this.', 'draft');
  expect(r).toEqual({ ok: false, error: 'no JSON block found' });
});

test('rejects more than one JSON block', () => {
  const r = parseAgentComment(`${fence(draft)}\n${fence(draft)}`, 'draft');
  expect(r).toEqual({ ok: false, error: 'more than one JSON block found' });
});

test('rejects invalid JSON', () => {
  const r = parseAgentComment('```json\n{ "kind": "draft", \n```', 'draft');
  expect(r.ok).toBe(false);
  if (!r.ok) expect(r.error).toMatch(/^invalid JSON/);
});

test('rejects unknown keys (strict schema)', () => {
  const r = parseAgentComment(fence({ ...draft, sendNow: true }), 'draft');
  expect(r.ok).toBe(false);
});

test('rejects a multi-line reason', () => {
  expect(parseAgentComment(fence({ ...draft, reason: 'line one\nline two' }), 'draft').ok).toBe(false);
  expect(parseAgentComment(fence({ ...draft, reason: 'line one line two' }), 'draft').ok).toBe(false);
});

test('rejects an empty draft and an unknown category', () => {
  expect(parseAgentComment(fence({ ...draft, draft: '   ' }), 'draft').ok).toBe(false);
  expect(parseAgentComment(fence({ ...draft, category: 'urgent' }), 'draft').ok).toBe(false);
});

test('rejects a verdict where a draft was expected', () => {
  const r = parseAgentComment(fence(verdict), 'draft');
  expect(r).toEqual({ ok: false, error: 'expected a draft block, got verdict' });
});

test('rejects an oversized comment before parsing', () => {
  const r = parseAgentComment('x'.repeat(MAX_COMMENT_CHARS + 1), 'draft');
  expect(r).toEqual({ ok: false, error: `comment longer than ${MAX_COMMENT_CHARS} characters` });
});
```

- [ ] **Step 7: Run it and confirm it fails**

Run: `pnpm test:unit` → Expected: FAIL, cannot load `./agent-output.ts`.

- [ ] **Step 8: Implement the agent-output module**

`shared/src/agent-output.ts`:
```ts
import { z } from 'zod';
import { APPROVAL_CATEGORIES } from './approvals.ts';

// Frozen contract (PRD §18, FD-3, FD-3b): the JSON block Scout and Orbi post as a Paperclip comment.
// Agent output is untrusted (FD-2a): strict objects, bounded sizes, one block only.

export const MAX_COMMENT_CHARS = 20_000;

const oneLine = z
  .string()
  .trim()
  .min(1)
  .max(200)
  .regex(/^[^\r\n  ]+$/, 'must be a single line');

export const DRAFT_FLAGS = [
  'price',
  'fee',
  'discount',
  'contract_terms',
  'payment',
  'multiple_recipients',
  'commitment',
  'decline_or_refer',
] as const;

export const DraftBlock = z.strictObject({
  kind: z.literal('draft'),
  schemaVersion: z.literal(1),
  draft: z.string().trim().min(1).max(8_000),
  category: z.enum(APPROVAL_CATEGORIES),
  flags: z.array(z.enum(DRAFT_FLAGS)).max(DRAFT_FLAGS.length),
  reason: oneLine,
});
export type Draft = z.infer<typeof DraftBlock>;

export const VerdictBlock = z.strictObject({
  kind: z.literal('verdict'),
  schemaVersion: z.literal(1),
  verdict: z.enum(['lead', 'not_lead']),
  reason: oneLine,
});
export type Verdict = z.infer<typeof VerdictBlock>;

const AgentBlock = z.discriminatedUnion('kind', [DraftBlock, VerdictBlock]);

export type ParseResult = { ok: true; block: Draft | Verdict } | { ok: false; error: string };

const FENCE = /```json[ \t]*\r?\n([\s\S]*?)\r?\n```/g;

export function parseAgentComment(comment: string, expected: 'draft' | 'verdict'): ParseResult {
  if (comment.length > MAX_COMMENT_CHARS) {
    return { ok: false, error: `comment longer than ${MAX_COMMENT_CHARS} characters` };
  }
  const blocks = [...comment.matchAll(FENCE)].map((m) => m[1] ?? '');
  if (blocks.length === 0) return { ok: false, error: 'no JSON block found' };
  if (blocks.length > 1) return { ok: false, error: 'more than one JSON block found' };

  let raw: unknown;
  try {
    raw = JSON.parse(blocks[0]!);
  } catch (err) {
    return { ok: false, error: `invalid JSON: ${(err as Error).message}` };
  }

  const parsed = AgentBlock.safeParse(raw);
  if (!parsed.success) return { ok: false, error: z.prettifyError(parsed.error) };
  if (parsed.data.kind !== expected) {
    return { ok: false, error: `expected a ${expected} block, got ${parsed.data.kind}` };
  }
  return { ok: true, block: parsed.data };
}
```

- [ ] **Step 9: Run all unit tests and the typecheck**

Run: `pnpm test:unit` → Expected: all pass.
Run: `pnpm typecheck` → Expected: exit 0.

- [ ] **Step 10: Commit**

```bash
git add shared pnpm-lock.yaml
git commit -m "feat(shared): freeze approval, job, event and agent-output contracts"
```

---

### Task 3: Postgres template with two databases and separate logins

**Files:**
- Create: `template/postgres/init/01-databases.sh`, `compose.dev.yml`
- Test: `template/test/postgres-logins.test.ts`
- Modify: `vitest.config.ts`, `package.json`, `.github/workflows/ci.yml`

**Interfaces:**
- Produces: logins `orbit_app` (owns database `orbit`) and `paperclip_app` (owns database `paperclip`). Neither can connect to the other's database. Passwords come from `ORBIT_DB_PASSWORD` and `PAPERCLIP_DB_PASSWORD`.
- Produces: `pnpm db:up` / `pnpm db:down`. They start a dev Postgres on `127.0.0.1:5432` (superuser `postgres`/`postgres`, test database `orbit_test`) and Redis on `127.0.0.1:6379`.
- Produces: the Vitest project `db` (`pnpm test:db`). Task 4 adds its global setup.

- [ ] **Step 1: Write the init script**

`template/postgres/init/01-databases.sh`:
```bash
#!/usr/bin/env bash
# Creates the instance's two databases with separate logins (PRD DEP-1, SEC-2a).
# Runs once, on an empty data directory, from docker-entrypoint-initdb.d.
set -euo pipefail
: "${ORBIT_DB_PASSWORD:?ORBIT_DB_PASSWORD is required}"
: "${PAPERCLIP_DB_PASSWORD:?PAPERCLIP_DB_PASSWORD is required}"

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname postgres \
  -v orbit_pw="$ORBIT_DB_PASSWORD" -v paperclip_pw="$PAPERCLIP_DB_PASSWORD" <<'SQL'
CREATE ROLE orbit_app LOGIN PASSWORD :'orbit_pw';
CREATE ROLE paperclip_app LOGIN PASSWORD :'paperclip_pw';
CREATE DATABASE orbit OWNER orbit_app;
CREATE DATABASE paperclip OWNER paperclip_app;
REVOKE ALL ON DATABASE orbit FROM PUBLIC;
REVOKE ALL ON DATABASE paperclip FROM PUBLIC;
\connect orbit
CREATE EXTENSION IF NOT EXISTS vector;
SQL
```

- [ ] **Step 2: Write the dev compose file**

`compose.dev.yml`:
```yaml
# Local and CI databases only. Ports bind to 127.0.0.1 (SEC-1). Dev passwords are not secrets.
name: orbit-dev
services:
  postgres:
    image: pgvector/pgvector:pg16
    command: ["postgres", "-c", "timezone=UTC"]
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: orbit_test
      ORBIT_DB_PASSWORD: orbit_dev
      PAPERCLIP_DB_PASSWORD: paperclip_dev
    ports: ["127.0.0.1:5432:5432"]
    volumes:
      - ./template/postgres/init:/docker-entrypoint-initdb.d:ro
    healthcheck:
      # TCP check: the temporary server used during init listens on the socket only,
      # so this passes only after the init script has finished.
      test: ["CMD-SHELL", "pg_isready -h 127.0.0.1 -U postgres -d orbit_test"]
      interval: 2s
      timeout: 3s
      retries: 30
  redis:
    image: redis:7-alpine
    ports: ["127.0.0.1:6379:6379"]
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 2s
      timeout: 3s
      retries: 30
```

Add to the root `package.json` `scripts`:
```json
"test:db": "vitest run --project db",
"db:up": "docker compose -f compose.dev.yml up -d --wait",
"db:down": "docker compose -f compose.dev.yml down -v"
```

Add to the root `devDependencies`:
```json
"pg": "8.23.1",
"@types/pg": "8.23.1"
```

Run: `pnpm install`, then `pnpm db:up`
Expected: `Container orbit-dev-postgres-1 Healthy` and `Container orbit-dev-redis-1 Healthy`.

- [ ] **Step 3: Add the `db` Vitest project**

In `vitest.config.ts`, add a second entry to `projects`:
```ts
      {
        test: {
          name: 'db',
          include: ['template/test/postgres-logins.test.ts'],
          fileParallelism: false,
        },
      },
```

- [ ] **Step 4: Write the login isolation test**

`template/test/postgres-logins.test.ts`:
```ts
import { expect, test } from 'vitest';
import pg from 'pg';

// Dev passwords from compose.dev.yml; production values come from the instance's secrets.
const orbitPw = process.env.ORBIT_DB_PASSWORD ?? 'orbit_dev';
const paperclipPw = process.env.PAPERCLIP_DB_PASSWORD ?? 'paperclip_dev';

async function connect(user: string, password: string, database: string) {
  const client = new pg.Client({ host: '127.0.0.1', port: 5432, user, password, database });
  await client.connect();
  return client;
}

test('orbit_app can use the orbit database', async () => {
  const c = await connect('orbit_app', orbitPw, 'orbit');
  await c.query('CREATE TABLE IF NOT EXISTS login_probe (id int)');
  await c.query('DROP TABLE login_probe');
  await c.end();
});

test('paperclip_app can use the paperclip database', async () => {
  const c = await connect('paperclip_app', paperclipPw, 'paperclip');
  await c.query('CREATE TABLE IF NOT EXISTS login_probe (id int)');
  await c.query('DROP TABLE login_probe');
  await c.end();
});

test('paperclip_app cannot connect to the orbit database (E3-T2)', async () => {
  await expect(connect('paperclip_app', paperclipPw, 'orbit')).rejects.toMatchObject({ code: '42501' });
});

test('orbit_app cannot connect to the paperclip database', async () => {
  await expect(connect('orbit_app', orbitPw, 'paperclip')).rejects.toMatchObject({ code: '42501' });
});
```

- [ ] **Step 5: Confirm the test fails without the init script, then passes with it**

Run `pnpm db:down`. Temporarily rename the folder `template/postgres/init` to `template/postgres/init-off`. Then run `pnpm db:up` and `pnpm test:db`.
Expected: FAIL, `password authentication failed for user "orbit_app"`.

Rename the folder back to `template/postgres/init`, then run `pnpm db:down`, `pnpm db:up` and `pnpm test:db`.
Expected: 4 passed.

- [ ] **Step 6: Run the database tests in CI**

In `.github/workflows/ci.yml`, insert before `- run: pnpm typecheck`:
```yaml
      - run: pnpm db:up
```

- [ ] **Step 7: Commit**

```bash
git add template compose.dev.yml vitest.config.ts package.json pnpm-lock.yaml .github
git commit -m "feat(template): postgres with orbit and paperclip databases and separate logins"
```

---

### Task 4: Core ORBIT schema, with the approvals schema frozen

**Files:**
- Create: `db/package.json`, `db/prisma.config.ts`, `db/prisma/schema.prisma`, `db/prisma/migrations/migration_lock.toml`, `db/prisma/migrations/20260930000100_core/migration.sql`
- Create: `db/src/client.ts`, `db/src/approvals.ts`
- Test: `db/test/global-setup.ts`, `db/test/helpers.ts`, `db/test/core.test.ts`, `db/test/approvals.test.ts`, `db/test/enums.test.ts`
- Modify: `vitest.config.ts`, `package.json`, `.github/workflows/ci.yml`

**Interfaces:**
- Consumes: `APPROVAL_STATES`, `APPROVAL_CATEGORIES`, `canTransition`, `type ApprovalState` from `@orbit/shared/approvals` (Task 2).
- Produces: `createPrisma(connectionString: string): PrismaClient` from `@orbit/db/client`.
- Produces: `transitionApproval(prisma: PrismaClient, id: string, from: ApprovalState, to: ApprovalState): Promise<boolean>` from `@orbit/db/approvals`. It returns `false` when another actor already moved the row, and throws on a transition that `canTransition` forbids.
- Produces tables: `workspaces`, `users`, `user_authorities`, `sessions`, `sign_in_links`, `contacts`, `leads`, `email_bodies`, `ack_template_versions`, `acks`, `approvals`, `decisions`, `retention_policies`. Also the trigger `approvals_state_guard`.
- Produces: the test helpers `testPrisma()`, `newWorkspace(prisma)`, `newLead(prisma, workspaceId)` and `newApproval(prisma, workspaceId, state?)` in `db/test/helpers.ts`.

- [ ] **Step 1: Create the db package**

`db/package.json`:
```json
{
  "name": "@orbit/db",
  "private": true,
  "type": "module",
  "exports": {
    "./client": "./src/client.ts",
    "./approvals": "./src/approvals.ts"
  },
  "dependencies": {
    "@orbit/shared": "workspace:*",
    "@prisma/adapter-pg": "7.10.0",
    "@prisma/client": "7.10.0"
  },
  "devDependencies": {
    "prisma": "7.10.0"
  }
}
```

`db/prisma.config.ts`:
```ts
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig, env } from 'prisma/config';

// Prisma commands run from db/ (pnpm --filter @orbit/db exec …); CI sets DATABASE_URL directly.
const envFile = resolve(process.cwd(), '..', '.env.local');
if (existsSync(envFile)) process.loadEnvFile(envFile);

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  datasource: { url: env('DATABASE_URL') },
});
```

`db/prisma/migrations/migration_lock.toml`:
```toml
provider = "postgresql"
```

Add to the root `package.json` `scripts`:
```json
"db:generate": "pnpm --filter @orbit/db exec prisma generate",
"db:migrate": "pnpm --filter @orbit/db exec prisma migrate deploy"
```

Run: `pnpm install` → Expected: no errors.

- [ ] **Step 2: Write the Prisma schema**

`db/prisma/schema.prisma`:
```prisma
// ORBIT database (`orbit`). One workspace per instance (DEP-6).
// Partitioned ledger tables live in the `ledger` schema, outside Prisma (migration *_ledger).
// Rule: migrations are generated with `prisma migrate diff` and applied with `migrate deploy`.
// Never run `prisma migrate dev` against this database.

generator client {
  provider            = "prisma-client"
  output              = "../src/generated/prisma"
  moduleFormat        = "esm"
  importFileExtension = "ts"
}

datasource db {
  provider = "postgresql"
}

enum Authority {
  approve_routine
  approve_decline_refer
  approve_board_level

  @@map("authority")
}

enum LeadState {
  received
  filtered
  classifying
  not_lead
  awaiting_verdict
  drafting
  draft_failed
  awaiting_owner
  sent
  discarded
  void
  resolved

  @@map("lead_state")
}

enum Classification {
  lead
  not_lead
  unsure
  failed

  @@map("classification")
}

enum ApprovalState {
  issued
  sending
  sent
  failed
  void

  @@map("approval_state")
}

enum ApprovalCategory {
  routine
  decline_refer
  board_level

  @@map("approval_category")
}

enum DecisionAction {
  send
  send_edited
  discard

  @@map("decision_action")
}

enum DiscardReason {
  not_a_lead
  reply_myself
  draft_wrong

  @@map("discard_reason")
}

enum AckVariant {
  with_name
  without_name

  @@map("ack_variant")
}

enum SendState {
  sending
  sent
  failed

  @@map("send_state")
}

enum RetentionMethod {
  partition_drop
  purge
  file_delete
  keep

  @@map("retention_method")
}

model Workspace {
  id        String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  name      String
  createdAt DateTime @default(now()) @map("created_at") @db.Timestamptz(3)

  users               User[]
  contacts            Contact[]
  leads               Lead[]
  ackTemplateVersions AckTemplateVersion[]
  acks                Ack[]
  approvals           Approval[]

  @@map("workspaces")
}

model User {
  id          String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  workspaceId String   @map("workspace_id") @db.Uuid
  email       String
  createdAt   DateTime @default(now()) @map("created_at") @db.Timestamptz(3)

  workspace         Workspace            @relation(fields: [workspaceId], references: [id])
  authorities       UserAuthority[]
  sessions          Session[]
  signInLinks       SignInLink[]
  decisions         Decision[]
  approvedTemplates AckTemplateVersion[]

  @@unique([workspaceId, email])
  @@map("users")
}

// AUTH-1: authorities are stored apart from roles and checked at decision time.
model UserAuthority {
  userId    String    @map("user_id") @db.Uuid
  authority Authority
  grantedAt DateTime  @default(now()) @map("granted_at") @db.Timestamptz(3)

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@id([userId, authority])
  @@map("user_authorities")
}

// SIGN-2: 30-day session; board-level actions need fresh_at within 24 h.
model Session {
  id        String    @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  userId    String    @map("user_id") @db.Uuid
  tokenHash String    @unique @map("token_hash")
  createdAt DateTime  @default(now()) @map("created_at") @db.Timestamptz(3)
  freshAt   DateTime  @default(now()) @map("fresh_at") @db.Timestamptz(3)
  expiresAt DateTime  @map("expires_at") @db.Timestamptz(3)
  revokedAt DateTime? @map("revoked_at") @db.Timestamptz(3)

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@map("sessions")
}

// SIGN-1: single-use magic link, 15-minute expiry.
model SignInLink {
  id           String    @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  userId       String    @map("user_id") @db.Uuid
  tokenHash    String    @unique @map("token_hash")
  redirectPath String?   @map("redirect_path")
  createdAt    DateTime  @default(now()) @map("created_at") @db.Timestamptz(3)
  expiresAt    DateTime  @map("expires_at") @db.Timestamptz(3)
  usedAt       DateTime? @map("used_at") @db.Timestamptz(3)

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@map("sign_in_links")
}

// FD-1a: known-contact index, from headers only.
model Contact {
  workspaceId String   @map("workspace_id") @db.Uuid
  email       String
  firstSeenAt DateTime @map("first_seen_at") @db.Timestamptz(3)
  lastSeenAt  DateTime @map("last_seen_at") @db.Timestamptz(3)

  workspace Workspace @relation(fields: [workspaceId], references: [id])

  @@id([workspaceId, email])
  @@map("contacts")
}

model Lead {
  id               String          @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  workspaceId      String          @map("workspace_id") @db.Uuid
  messageId        String          @map("message_id")
  gmailMessageId   String          @map("gmail_message_id")
  gmailThreadId    String          @map("gmail_thread_id")
  fromEmail        String          @map("from_email")
  fromName         String?         @map("from_name")
  subject          String
  receivedAt       DateTime        @map("received_at") @db.Timestamptz(3)
  state            LeadState       @default(received)
  classification   Classification?
  confidence       Decimal?        @db.Decimal(4, 3)
  paperclipIssueId String?         @map("paperclip_issue_id")
  createdAt        DateTime        @default(now()) @map("created_at") @db.Timestamptz(3)
  updatedAt        DateTime        @updatedAt @map("updated_at") @db.Timestamptz(3)

  workspace Workspace  @relation(fields: [workspaceId], references: [id])
  body      EmailBody?
  ack       Ack?
  approvals Approval[]

  @@unique([workspaceId, messageId])
  @@index([workspaceId, state])
  @@map("leads")
}

// Raw bodies are kept apart so the 90-day purge (DAT-3) deletes rows, not columns.
model EmailBody {
  leadId     String   @id @map("lead_id") @db.Uuid
  rawBody    String   @map("raw_body")
  cleanBody  String?  @map("clean_body")
  receivedAt DateTime @map("received_at") @db.Timestamptz(3)

  lead Lead @relation(fields: [leadId], references: [id], onDelete: Cascade)

  @@index([receivedAt])
  @@map("email_bodies")
}

// ACK-4, ACK-7: versioned template; approved_at is the standing template approval (AUTH-0).
model AckTemplateVersion {
  id               String    @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  workspaceId      String    @map("workspace_id") @db.Uuid
  version          Int
  withNameText     String    @map("with_name_text")
  withoutNameText  String    @map("without_name_text")
  approvedByUserId String?   @map("approved_by_user_id") @db.Uuid
  approvedAt       DateTime? @map("approved_at") @db.Timestamptz(3)
  createdAt        DateTime  @default(now()) @map("created_at") @db.Timestamptz(3)

  workspace  Workspace @relation(fields: [workspaceId], references: [id])
  approvedBy User?     @relation(fields: [approvedByUserId], references: [id])
  acks       Ack[]

  @@unique([workspaceId, version])
  @@map("ack_template_versions")
}

model Ack {
  id                String     @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  workspaceId       String     @map("workspace_id") @db.Uuid
  leadId            String     @unique @map("lead_id") @db.Uuid
  toEmail           String     @map("to_email")
  templateVersionId String     @map("template_version_id") @db.Uuid
  variant           AckVariant
  state             SendState  @default(sending)
  gmailMessageId    String?    @map("gmail_message_id")
  createdAt         DateTime   @default(now()) @map("created_at") @db.Timestamptz(3)
  sentAt            DateTime?  @map("sent_at") @db.Timestamptz(3)

  workspace       Workspace          @relation(fields: [workspaceId], references: [id])
  lead            Lead               @relation(fields: [leadId], references: [id])
  templateVersion AckTemplateVersion @relation(fields: [templateVersionId], references: [id])

  @@index([workspaceId, toEmail, createdAt])
  @@index([workspaceId, createdAt])
  @@map("acks")
}

// Frozen (PRD §18). The approval ID is the sole authority to send a full reply (SEC-3).
model Approval {
  id             String           @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  workspaceId    String           @map("workspace_id") @db.Uuid
  leadId         String           @map("lead_id") @db.Uuid
  category       ApprovalCategory
  state          ApprovalState    @default(issued)
  draftText      String           @map("draft_text")
  reason         String
  issuedAt       DateTime         @default(now()) @map("issued_at") @db.Timestamptz(3)
  expiresAt      DateTime         @map("expires_at") @db.Timestamptz(3)
  sendingAt      DateTime?        @map("sending_at") @db.Timestamptz(3)
  sentAt         DateTime?        @map("sent_at") @db.Timestamptz(3)
  gmailMessageId String?          @map("gmail_message_id")
  sendAttempts   Int              @default(0) @map("send_attempts")

  workspace Workspace @relation(fields: [workspaceId], references: [id])
  lead      Lead      @relation(fields: [leadId], references: [id])
  decision  Decision?

  @@index([workspaceId, state])
  @@map("approvals")
}

// AUTH-1, AUTH-10, WAIT-3: one decision per approval; the unique key makes the first one win.
model Decision {
  id            String         @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  approvalId    String         @unique @map("approval_id") @db.Uuid
  userId        String         @map("user_id") @db.Uuid
  authorityUsed Authority      @map("authority_used")
  action        DecisionAction
  finalText     String?        @map("final_text")
  discardReason DiscardReason? @map("discard_reason")
  decidedAt     DateTime       @default(now()) @map("decided_at") @db.Timestamptz(3)

  approval Approval @relation(fields: [approvalId], references: [id])
  user     User     @relation(fields: [userId], references: [id])

  @@map("decisions")
}

// DAT-3: retention is configuration. keep_days NULL means "keep" (life of the customer).
model RetentionPolicy {
  dataClass String          @id @map("data_class")
  keepDays  Int?            @map("keep_days")
  method    RetentionMethod

  @@map("retention_policies")
}
```

Run: `pnpm db:generate`
Expected: "Generated Prisma Client (7.10.0) to ./src/generated/prisma".

- [ ] **Step 3: Generate the core migration SQL**

```bash
mkdir -p db/prisma/migrations/20260930000100_core
pnpm --filter @orbit/db exec prisma migrate diff --from-empty --to-schema prisma/schema.prisma --script --output prisma/migrations/20260930000100_core/migration.sql
```
Expected: the file exists and starts with `-- CreateEnum`.

- [ ] **Step 4: Append the hand-written SQL to the same migration file**

Append to the end of `db/prisma/migrations/20260930000100_core/migration.sql`:
```sql
-- ---------------------------------------------------------------------------
-- Hand-written below this line (Prisma does not model CHECKs, triggers or seed rows).
-- ---------------------------------------------------------------------------

-- FD-1, FD-1a: addresses are stored lowercase so dedupe and contact lookups cannot split a person.
ALTER TABLE "users" ADD CONSTRAINT "users_email_lowercase" CHECK ("email" = lower("email"));
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_email_lowercase" CHECK ("email" = lower("email"));
ALTER TABLE "leads" ADD CONSTRAINT "leads_from_email_lowercase" CHECK ("from_email" = lower("from_email"));
ALTER TABLE "acks" ADD CONSTRAINT "acks_to_email_lowercase" CHECK ("to_email" = lower("to_email"));

-- FD-5: the approval state machine, enforced in the database as well as in @orbit/shared/approvals.
CREATE FUNCTION approval_state_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.state = OLD.state THEN
    RETURN NEW;
  END IF;
  IF (OLD.state::text, NEW.state::text) IN (
    ('issued', 'sending'), ('issued', 'void'),
    ('sending', 'sent'), ('sending', 'failed'),
    ('failed', 'sending'), ('failed', 'void')
  ) THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'invalid approval transition % -> %', OLD.state, NEW.state
    USING ERRCODE = 'check_violation';
END $$;

CREATE TRIGGER approvals_state_guard
  BEFORE UPDATE OF state ON "approvals"
  FOR EACH ROW EXECUTE FUNCTION approval_state_guard();

-- DAT-3 retention defaults. Changing a period is a data change, never a code change.
INSERT INTO "retention_policies" ("data_class", "keep_days", "method") VALUES
  ('raw_email_bodies', 90, 'purge'),
  ('hermes_sessions', 90, 'file_delete'),
  ('ledger_events', 730, 'partition_drop'),
  ('receipts', NULL, 'keep'),
  ('backups', 30, 'file_delete');
```

- [ ] **Step 5: Write the client and the test setup**

`db/src/client.ts`:
```ts
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from './generated/prisma/client.ts';

export type { PrismaClient };

export function createPrisma(connectionString: string): PrismaClient {
  return new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
}
```

`db/test/global-setup.ts`:
```ts
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
```

`db/test/helpers.ts`:
```ts
import { randomUUID } from 'node:crypto';
import { createPrisma, type PrismaClient } from '../src/client.ts';

export function testPrisma(): PrismaClient {
  return createPrisma(process.env.DATABASE_URL!);
}

export function newWorkspace(prisma: PrismaClient) {
  return prisma.workspace.create({ data: { name: `ws-${randomUUID()}` } });
}

export async function newLead(prisma: PrismaClient, workspaceId: string) {
  return prisma.lead.create({
    data: {
      workspaceId,
      messageId: `<${randomUUID()}@mail.example.com>`,
      gmailMessageId: randomUUID(),
      gmailThreadId: randomUUID(),
      fromEmail: 'maya@example.com',
      subject: 'Audit quote',
      receivedAt: new Date(),
    },
  });
}

export async function newApproval(
  prisma: PrismaClient,
  workspaceId: string,
  state: 'issued' | 'sending' | 'sent' | 'failed' | 'void' = 'issued',
) {
  const lead = await newLead(prisma, workspaceId);
  return prisma.approval.create({
    data: {
      workspaceId,
      leadId: lead.id,
      category: 'routine',
      state,
      draftText: 'Hi Maya, thanks for reaching out.',
      reason: 'Routine intro request.',
      expiresAt: new Date(Date.now() + 72 * 3600_000),
    },
  });
}
```

In `vitest.config.ts`, change the `db` project to:
```ts
      {
        test: {
          name: 'db',
          include: ['db/test/**/*.test.ts', 'template/test/postgres-logins.test.ts'],
          globalSetup: ['db/test/global-setup.ts'],
          fileParallelism: false,
        },
      },
```

- [ ] **Step 6: Write the failing tests**

`db/test/enums.test.ts`:
```ts
import { expect, test } from 'vitest';
import { ApprovalCategory, ApprovalState } from '../src/generated/prisma/enums.ts';
import { APPROVAL_CATEGORIES, APPROVAL_STATES } from '@orbit/shared/approvals';

// The shared contract and the database enums must never drift apart.
test('approval states match the shared contract', () => {
  expect(Object.values(ApprovalState)).toEqual([...APPROVAL_STATES]);
});

test('approval categories match the shared contract', () => {
  expect(Object.values(ApprovalCategory)).toEqual([...APPROVAL_CATEGORIES]);
});
```

`db/test/core.test.ts`:
```ts
import { afterAll, expect, test } from 'vitest';
import { newApproval, newLead, newWorkspace, testPrisma } from './helpers.ts';

const prisma = testPrisma();
afterAll(() => prisma.$disconnect());

test('a duplicate Message-ID in one workspace is rejected (FD-1 dedupe)', async () => {
  const ws = await newWorkspace(prisma);
  const lead = await newLead(prisma, ws.id);
  await expect(
    prisma.lead.create({
      data: {
        workspaceId: ws.id,
        messageId: lead.messageId,
        gmailMessageId: 'other',
        gmailThreadId: 'other',
        fromEmail: 'maya@example.com',
        subject: 'Audit quote',
        receivedAt: new Date(),
      },
    }),
  ).rejects.toMatchObject({ code: 'P2002' });
});

test('uppercase addresses are rejected', async () => {
  const ws = await newWorkspace(prisma);
  await expect(
    prisma.contact.create({
      data: { workspaceId: ws.id, email: 'Maya@Example.com', firstSeenAt: new Date(), lastSeenAt: new Date() },
    }),
  ).rejects.toThrow(/contacts_email_lowercase/);
});

test('a second decision on the same approval is rejected (AUTH-10)', async () => {
  const ws = await newWorkspace(prisma);
  const user = await prisma.user.create({ data: { workspaceId: ws.id, email: 'owner@firm.example' } });
  const approval = await newApproval(prisma, ws.id);
  const decide = () =>
    prisma.decision.create({
      data: { approvalId: approval.id, userId: user.id, authorityUsed: 'approve_routine', action: 'send' },
    });
  await decide();
  await expect(decide()).rejects.toMatchObject({ code: 'P2002' });
});

test('retention defaults are seeded (DAT-3)', async () => {
  const rows = await prisma.retentionPolicy.findMany({ orderBy: { dataClass: 'asc' } });
  expect(rows.map((r) => [r.dataClass, r.keepDays, r.method])).toEqual([
    ['backups', 30, 'file_delete'],
    ['hermes_sessions', 90, 'file_delete'],
    ['ledger_events', 730, 'partition_drop'],
    ['raw_email_bodies', 90, 'purge'],
    ['receipts', null, 'keep'],
  ]);
});
```

`db/test/approvals.test.ts`:
```ts
import { afterAll, expect, test } from 'vitest';
import { APPROVAL_STATES, canTransition } from '@orbit/shared/approvals';
import { transitionApproval } from '../src/approvals.ts';
import { newApproval, newWorkspace, testPrisma } from './helpers.ts';

const prisma = testPrisma();
afterAll(() => prisma.$disconnect());

test('the database trigger agrees with the shared transition table', async () => {
  const ws = await newWorkspace(prisma);
  for (const from of APPROVAL_STATES) {
    for (const to of APPROVAL_STATES) {
      if (from === to) continue;
      const a = await newApproval(prisma, ws.id, from);
      const attempt = prisma.$executeRaw`UPDATE approvals SET state = ${to}::approval_state WHERE id = ${a.id}::uuid`;
      if (canTransition(from, to)) {
        await expect(attempt, `${from} -> ${to}`).resolves.toBe(1);
      } else {
        await expect(attempt, `${from} -> ${to}`).rejects.toThrow(/invalid approval transition/);
      }
    }
  }
});

test('transitionApproval moves the row and stamps sending_at', async () => {
  const ws = await newWorkspace(prisma);
  const a = await newApproval(prisma, ws.id);
  expect(await transitionApproval(prisma, a.id, 'issued', 'sending')).toBe(true);
  const row = await prisma.approval.findUniqueOrThrow({ where: { id: a.id } });
  expect(row.state).toBe('sending');
  expect(row.sendingAt).toBeInstanceOf(Date);
});

test('transitionApproval returns false when the row is no longer in the from-state', async () => {
  const ws = await newWorkspace(prisma);
  const a = await newApproval(prisma, ws.id, 'void');
  expect(await transitionApproval(prisma, a.id, 'issued', 'sending')).toBe(false);
});

test('transitionApproval throws on a forbidden transition', async () => {
  const ws = await newWorkspace(prisma);
  const a = await newApproval(prisma, ws.id, 'sent');
  await expect(transitionApproval(prisma, a.id, 'sent', 'sending')).rejects.toThrow(/sent -> sending/);
});

test('concurrent issued→sending: exactly one wins', async () => {
  const ws = await newWorkspace(prisma);
  const a = await newApproval(prisma, ws.id);
  const results = await Promise.all(
    Array.from({ length: 5 }, () => transitionApproval(prisma, a.id, 'issued', 'sending')),
  );
  expect(results.filter(Boolean)).toHaveLength(1);
});
```

- [ ] **Step 7: Run them and confirm they fail**

Run: `pnpm test:db`
Expected: FAIL, cannot load `../src/approvals.ts`. The migration applies and the other test files run.

- [ ] **Step 8: Implement `transitionApproval`**

`db/src/approvals.ts`:
```ts
import { canTransition, type ApprovalState } from '@orbit/shared/approvals';
import type { PrismaClient } from './client.ts';

// Compare-and-set on the state column: the row lock taken by UPDATE makes concurrent callers
// serialize, and only the one that still sees `from` wins (FD-5 "with a database lock").
export async function transitionApproval(
  prisma: PrismaClient,
  id: string,
  from: ApprovalState,
  to: ApprovalState,
): Promise<boolean> {
  if (!canTransition(from, to)) throw new Error(`Invalid approval transition ${from} -> ${to}`);
  const now = new Date();
  const { count } = await prisma.approval.updateMany({
    where: { id, state: from },
    data: {
      state: to,
      ...(to === 'sending' ? { sendingAt: now } : {}),
      ...(to === 'sent' ? { sentAt: now } : {}),
    },
  });
  return count === 1;
}
```

- [ ] **Step 9: Run all tests and the typecheck**

Run: `pnpm test` → Expected: unit and db projects pass.
Run: `pnpm typecheck` → Expected: exit 0.

- [ ] **Step 10: Generate the client and point tests at the database in CI**

In `.github/workflows/ci.yml`, add under `runs-on: ubuntu-24.04`:
```yaml
    env:
      DATABASE_URL: postgresql://postgres:postgres@localhost:5432/orbit_test
```
Then insert after `- run: pnpm db:up`:
```yaml
      - run: pnpm db:generate
```

- [ ] **Step 11: Commit**

```bash
git add db vitest.config.ts package.json pnpm-lock.yaml .github
git commit -m "feat(db): core ORBIT schema with frozen approvals state machine"
```

---

### Task 5: Job rows and timers (frozen job-row schema)

**Files:**
- Modify: `db/prisma/schema.prisma`, `db/package.json`
- Create: `db/prisma/migrations/20260930000200_jobs_timers/migration.sql`, `db/src/jobs.ts`, `db/src/timers.ts`
- Test: `db/test/jobs.test.ts`, `db/test/timers.test.ts`, and append to `db/test/enums.test.ts`

**Interfaces:**
- Consumes: `JOB_KINDS`, `JOB_STATES`, `TIMER_KINDS`, `type JobKind`, `type TimerKind` from `@orbit/shared/jobs` (Task 2). `PrismaClient` from `@orbit/db/client` (Task 4).
- Produces (`@orbit/db/jobs`):
  - `enqueueJob(prisma, input: EnqueueInput): Promise<{ id: string; created: boolean }>`, where `EnqueueInput = { workspaceId: string; kind: JobKind; dedupeKey: string; runAt?: Date; leadId?: string; approvalId?: string; payload?: Prisma.InputJsonValue; maxAttempts?: number }`.
  - `claimDueJobs(prisma, workerId: string, opts?: { limit?: number; leaseSeconds?: number }): Promise<ClaimedJob[]>`, where `ClaimedJob = { id: string; kind: JobKind; attempts: number; maxAttempts: number; payload: unknown; leadId: string | null; approvalId: string | null }`.
  - `completeJob(prisma, id: string, workerId: string): Promise<boolean>`.
  - `failJob(prisma, id: string, workerId: string, error: string, retryAt: Date): Promise<'retry' | 'dead' | 'lost'>`.
  - `markStuckJobsDead(prisma): Promise<number>`.
- Produces (`@orbit/db/timers`):
  - `scheduleTimer(prisma, input: { workspaceId: string; kind: TimerKind; fireAt: Date; dedupeKey: string; approvalId?: string; payload?: Prisma.InputJsonValue }): Promise<{ id: string; created: boolean }>`.
  - `cancelTimer(prisma, dedupeKey: string): Promise<boolean>`.
  - `fireDueTimers(prisma, limit: number, handler: (tx: Prisma.TransactionClient, timers: FiredTimer[]) => Promise<void>): Promise<number>`, where `FiredTimer = { id: string; kind: TimerKind; approvalId: string | null; payload: unknown }`. The timers are marked fired in the same transaction as the handler. If the handler throws, nothing is marked.

- [ ] **Step 1: Add the models**

Append to `db/prisma/schema.prisma`:
```prisma
enum JobKind {
  draft_poll
  verdict_poll
  notice
  digest
  send
  ack_send

  @@map("job_kind")
}

enum JobState {
  pending
  running
  done
  failed
  dead

  @@map("job_state")
}

enum TimerKind {
  reminder_2h
  void_72h
  digest_daily
  ack_cap_window

  @@map("timer_kind")
}

// Frozen (PRD §18). Postgres rows are the record; Bull only executes (§6, E3-T4).
model Job {
  id          String    @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  workspaceId String    @map("workspace_id") @db.Uuid
  kind        JobKind
  state       JobState  @default(pending)
  runAt       DateTime  @default(now()) @map("run_at") @db.Timestamptz(3)
  attempts    Int       @default(0)
  maxAttempts Int       @default(5) @map("max_attempts")
  lockedBy    String?   @map("locked_by")
  lockedUntil DateTime? @map("locked_until") @db.Timestamptz(3)
  dedupeKey   String    @unique @map("dedupe_key")
  leadId      String?   @map("lead_id") @db.Uuid
  approvalId  String?   @map("approval_id") @db.Uuid
  payload     Json      @default("{}")
  lastError   String?   @map("last_error")
  createdAt   DateTime  @default(now()) @map("created_at") @db.Timestamptz(3)
  updatedAt   DateTime  @updatedAt @map("updated_at") @db.Timestamptz(3)

  @@index([state, runAt])
  @@map("jobs")
}

// FD-4: timers survive restart and restore because they are rows.
model Timer {
  id          String    @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  workspaceId String    @map("workspace_id") @db.Uuid
  kind        TimerKind
  fireAt      DateTime  @map("fire_at") @db.Timestamptz(3)
  firedAt     DateTime? @map("fired_at") @db.Timestamptz(3)
  cancelledAt DateTime? @map("cancelled_at") @db.Timestamptz(3)
  dedupeKey   String    @unique @map("dedupe_key")
  approvalId  String?   @map("approval_id") @db.Uuid
  payload     Json      @default("{}")
  createdAt   DateTime  @default(now()) @map("created_at") @db.Timestamptz(3)

  @@index([fireAt])
  @@map("timers")
}
```

Add to `db/package.json` `exports`:
```json
"./jobs": "./src/jobs.ts",
"./timers": "./src/timers.ts"
```

- [ ] **Step 2: Generate the migration from the current test database**

```bash
pnpm test:db
pnpm db:generate
mkdir -p db/prisma/migrations/20260930000200_jobs_timers
pnpm --filter @orbit/db exec prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script --output prisma/migrations/20260930000200_jobs_timers/migration.sql
```
Expected: the new file holds only `CREATE TYPE "job_kind"…`, `CREATE TABLE "jobs"…`, `CREATE TABLE "timers"…` and their indexes. If it contains anything that touches the core tables, stop: the schema and the core migration have drifted.

- [ ] **Step 3: Write the failing tests**

Append to `db/test/enums.test.ts`:
```ts
import { JobKind, JobState, TimerKind } from '../src/generated/prisma/enums.ts';
import { JOB_KINDS, JOB_STATES, TIMER_KINDS } from '@orbit/shared/jobs';

test('job and timer enums match the shared contract', () => {
  expect(Object.values(JobKind)).toEqual([...JOB_KINDS]);
  expect(Object.values(JobState)).toEqual([...JOB_STATES]);
  expect(Object.values(TimerKind)).toEqual([...TIMER_KINDS]);
});
```

`db/test/jobs.test.ts`:
```ts
import { randomUUID } from 'node:crypto';
import { afterAll, beforeEach, expect, test } from 'vitest';
import { claimDueJobs, completeJob, enqueueJob, failJob, markStuckJobsDead } from '../src/jobs.ts';
import { newWorkspace, testPrisma } from './helpers.ts';

const prisma = testPrisma();
afterAll(() => prisma.$disconnect());
// Jobs are claimed across workspaces, so each test starts from an empty queue.
beforeEach(() => prisma.job.deleteMany());

const key = () => `test:${randomUUID()}`;

test('enqueue is idempotent on the dedupe key', async () => {
  const ws = await newWorkspace(prisma);
  const dedupeKey = key();
  const first = await enqueueJob(prisma, { workspaceId: ws.id, kind: 'draft_poll', dedupeKey });
  const second = await enqueueJob(prisma, { workspaceId: ws.id, kind: 'draft_poll', dedupeKey });
  expect(first.created).toBe(true);
  expect(second).toEqual({ id: first.id, created: false });
});

test('claim returns only due jobs and leases them', async () => {
  const ws = await newWorkspace(prisma);
  const due = await enqueueJob(prisma, { workspaceId: ws.id, kind: 'notice', dedupeKey: key() });
  await enqueueJob(prisma, { workspaceId: ws.id, kind: 'notice', dedupeKey: key(), runAt: new Date(Date.now() + 60_000) });
  const claimed = await claimDueJobs(prisma, 'w1');
  expect(claimed.map((j) => j.id)).toEqual([due.id]);
  expect(claimed[0]).toMatchObject({ kind: 'notice', attempts: 1 });
  expect(await claimDueJobs(prisma, 'w2')).toEqual([]);
});

test('two concurrent claimers never get the same job', async () => {
  const ws = await newWorkspace(prisma);
  for (let i = 0; i < 20; i++) await enqueueJob(prisma, { workspaceId: ws.id, kind: 'digest', dedupeKey: key() });
  const [a, b] = await Promise.all([
    claimDueJobs(prisma, 'w1', { limit: 20 }),
    claimDueJobs(prisma, 'w2', { limit: 20 }),
  ]);
  const ids = [...a, ...b].map((j) => j.id);
  expect(new Set(ids).size).toBe(ids.length);
  expect(ids).toHaveLength(20);
});

test('an expired lease is reclaimed by another worker', async () => {
  const ws = await newWorkspace(prisma);
  const job = await enqueueJob(prisma, { workspaceId: ws.id, kind: 'send', dedupeKey: key() });
  await claimDueJobs(prisma, 'crashed');
  await prisma.job.update({ where: { id: job.id }, data: { lockedUntil: new Date(Date.now() - 1000) } });
  const reclaimed = await claimDueJobs(prisma, 'w2');
  expect(reclaimed.map((j) => j.id)).toEqual([job.id]);
  expect(reclaimed[0]!.attempts).toBe(2);
});

test('complete only works for the worker holding the lease', async () => {
  const ws = await newWorkspace(prisma);
  const job = await enqueueJob(prisma, { workspaceId: ws.id, kind: 'send', dedupeKey: key() });
  await claimDueJobs(prisma, 'w1');
  expect(await completeJob(prisma, job.id, 'w2')).toBe(false);
  expect(await completeJob(prisma, job.id, 'w1')).toBe(true);
  expect((await prisma.job.findUniqueOrThrow({ where: { id: job.id } })).state).toBe('done');
});

test('fail retries until max attempts, then marks dead', async () => {
  const ws = await newWorkspace(prisma);
  const job = await enqueueJob(prisma, { workspaceId: ws.id, kind: 'send', dedupeKey: key(), maxAttempts: 2 });
  await claimDueJobs(prisma, 'w1');
  expect(await failJob(prisma, job.id, 'w1', 'timeout', new Date(Date.now() - 1))).toBe('retry');
  await claimDueJobs(prisma, 'w1');
  expect(await failJob(prisma, job.id, 'w1', 'timeout', new Date())).toBe('dead');
  const row = await prisma.job.findUniqueOrThrow({ where: { id: job.id } });
  expect(row).toMatchObject({ state: 'dead', lastError: 'timeout', lockedBy: null });
  expect(await failJob(prisma, job.id, 'w1', 'late', new Date())).toBe('lost');
});

test('a job stuck in running past max attempts is marked dead, not left running', async () => {
  const ws = await newWorkspace(prisma);
  const job = await enqueueJob(prisma, { workspaceId: ws.id, kind: 'send', dedupeKey: key(), maxAttempts: 1 });
  await claimDueJobs(prisma, 'crashed');
  await prisma.job.update({ where: { id: job.id }, data: { lockedUntil: new Date(Date.now() - 1000) } });
  expect(await claimDueJobs(prisma, 'w2')).toEqual([]);
  expect(await markStuckJobsDead(prisma)).toBe(1);
  expect((await prisma.job.findUniqueOrThrow({ where: { id: job.id } })).state).toBe('dead');
});
```

`db/test/timers.test.ts`:
```ts
import { randomUUID } from 'node:crypto';
import { afterAll, beforeEach, expect, test } from 'vitest';
import { cancelTimer, fireDueTimers, scheduleTimer } from '../src/timers.ts';
import { newWorkspace, testPrisma } from './helpers.ts';

const prisma = testPrisma();
afterAll(() => prisma.$disconnect());
beforeEach(() => prisma.timer.deleteMany());

const past = () => new Date(Date.now() - 1000);

test('schedule is idempotent on the dedupe key', async () => {
  const ws = await newWorkspace(prisma);
  const dedupeKey = `reminder:${randomUUID()}`;
  const a = await scheduleTimer(prisma, { workspaceId: ws.id, kind: 'reminder_2h', fireAt: past(), dedupeKey });
  const b = await scheduleTimer(prisma, { workspaceId: ws.id, kind: 'reminder_2h', fireAt: past(), dedupeKey });
  expect(b).toEqual({ id: a.id, created: false });
});

test('due timers fire once; future and cancelled timers do not', async () => {
  const ws = await newWorkspace(prisma);
  const due = await scheduleTimer(prisma, { workspaceId: ws.id, kind: 'void_72h', fireAt: past(), dedupeKey: randomUUID() });
  await scheduleTimer(prisma, { workspaceId: ws.id, kind: 'void_72h', fireAt: new Date(Date.now() + 60_000), dedupeKey: randomUUID() });
  const cancelledKey = randomUUID();
  await scheduleTimer(prisma, { workspaceId: ws.id, kind: 'void_72h', fireAt: past(), dedupeKey: cancelledKey });
  expect(await cancelTimer(prisma, cancelledKey)).toBe(true);

  const seen: string[] = [];
  const fired = await fireDueTimers(prisma, 10, async (_tx, timers) => {
    seen.push(...timers.map((t) => t.id));
  });
  expect(fired).toBe(1);
  expect(seen).toEqual([due.id]);
  expect(await fireDueTimers(prisma, 10, async () => {})).toBe(0);
});

test('an overdue timer fires after a restart (FD-4)', async () => {
  const ws = await newWorkspace(prisma);
  await scheduleTimer(prisma, { workspaceId: ws.id, kind: 'reminder_2h', fireAt: past(), dedupeKey: randomUUID() });
  await prisma.$disconnect();
  const restarted = testPrisma();
  expect(await fireDueTimers(restarted, 10, async () => {})).toBe(1);
  await restarted.$disconnect();
});

test('if the handler throws, the timers stay due', async () => {
  const ws = await newWorkspace(prisma);
  await scheduleTimer(prisma, { workspaceId: ws.id, kind: 'digest_daily', fireAt: past(), dedupeKey: randomUUID() });
  await expect(
    fireDueTimers(prisma, 10, async () => {
      throw new Error('boom');
    }),
  ).rejects.toThrow('boom');
  expect(await fireDueTimers(prisma, 10, async () => {})).toBe(1);
});
```

- [ ] **Step 4: Run them and confirm they fail**

Run: `pnpm test:db` → Expected: FAIL, cannot load `../src/jobs.ts` and `../src/timers.ts`.

- [ ] **Step 5: Implement jobs**

`db/src/jobs.ts`:
```ts
import type { JobKind } from '@orbit/shared/jobs';
import type { PrismaClient } from './client.ts';
import type { Prisma } from './generated/prisma/client.ts';

export type EnqueueInput = {
  workspaceId: string;
  kind: JobKind;
  dedupeKey: string;
  runAt?: Date;
  leadId?: string;
  approvalId?: string;
  payload?: Prisma.InputJsonValue;
  maxAttempts?: number;
};

export type ClaimedJob = {
  id: string;
  kind: JobKind;
  attempts: number;
  maxAttempts: number;
  payload: unknown;
  leadId: string | null;
  approvalId: string | null;
};

export async function enqueueJob(prisma: PrismaClient, input: EnqueueInput): Promise<{ id: string; created: boolean }> {
  const { count } = await prisma.job.createMany({ data: [input], skipDuplicates: true });
  const job = await prisma.job.findUniqueOrThrow({ where: { dedupeKey: input.dedupeKey }, select: { id: true } });
  return { id: job.id, created: count === 1 };
}

// Claims due jobs, and jobs whose lease expired (a crashed worker), with SKIP LOCKED so
// concurrent workers never share a job. Jobs out of attempts are left for markStuckJobsDead.
export async function claimDueJobs(
  prisma: PrismaClient,
  workerId: string,
  opts: { limit?: number; leaseSeconds?: number } = {},
): Promise<ClaimedJob[]> {
  const limit = opts.limit ?? 10;
  const leaseSeconds = opts.leaseSeconds ?? 120;
  return prisma.$queryRaw<ClaimedJob[]>`
    UPDATE jobs
    SET state = 'running',
        attempts = attempts + 1,
        locked_by = ${workerId},
        locked_until = now() + make_interval(secs => ${leaseSeconds}),
        updated_at = now()
    WHERE id IN (
      SELECT id FROM jobs
      WHERE attempts < max_attempts
        AND ((state = 'pending' AND run_at <= now())
          OR (state = 'running' AND locked_until < now()))
      ORDER BY run_at
      LIMIT ${limit}
      FOR UPDATE SKIP LOCKED
    )
    RETURNING id, kind::text AS kind, attempts, max_attempts AS "maxAttempts", payload,
              lead_id AS "leadId", approval_id AS "approvalId"`;
}

export async function completeJob(prisma: PrismaClient, id: string, workerId: string): Promise<boolean> {
  const { count } = await prisma.job.updateMany({
    where: { id, lockedBy: workerId, state: 'running' },
    data: { state: 'done', lockedBy: null, lockedUntil: null },
  });
  return count === 1;
}

export async function failJob(
  prisma: PrismaClient,
  id: string,
  workerId: string,
  error: string,
  retryAt: Date,
): Promise<'retry' | 'dead' | 'lost'> {
  const job = await prisma.job.findFirst({ where: { id, lockedBy: workerId, state: 'running' } });
  if (!job) return 'lost';
  const dead = job.attempts >= job.maxAttempts;
  const { count } = await prisma.job.updateMany({
    where: { id, lockedBy: workerId, state: 'running' },
    data: {
      state: dead ? 'dead' : 'pending',
      runAt: dead ? job.runAt : retryAt,
      lastError: error.slice(0, 2000),
      lockedBy: null,
      lockedUntil: null,
    },
  });
  if (count === 0) return 'lost';
  return dead ? 'dead' : 'retry';
}

// Called by the reconciler: jobs whose worker died on their last attempt become dead
// (and alert, in Stage 1) instead of staying in running forever.
export async function markStuckJobsDead(prisma: PrismaClient): Promise<number> {
  const { count } = await prisma.job.updateMany({
    where: { state: 'running', lockedUntil: { lt: new Date() }, attempts: { gte: prisma.job.fields.maxAttempts } },
    data: { state: 'dead', lastError: 'lease expired on final attempt', lockedBy: null, lockedUntil: null },
  });
  return count;
}
```

- [ ] **Step 6: Implement timers**

`db/src/timers.ts`:
```ts
import type { TimerKind } from '@orbit/shared/jobs';
import type { PrismaClient } from './client.ts';
import type { Prisma } from './generated/prisma/client.ts';

export type FiredTimer = { id: string; kind: TimerKind; approvalId: string | null; payload: unknown };

export async function scheduleTimer(
  prisma: PrismaClient,
  input: { workspaceId: string; kind: TimerKind; fireAt: Date; dedupeKey: string; approvalId?: string; payload?: Prisma.InputJsonValue },
): Promise<{ id: string; created: boolean }> {
  const { count } = await prisma.timer.createMany({ data: [input], skipDuplicates: true });
  const timer = await prisma.timer.findUniqueOrThrow({ where: { dedupeKey: input.dedupeKey }, select: { id: true } });
  return { id: timer.id, created: count === 1 };
}

export async function cancelTimer(prisma: PrismaClient, dedupeKey: string): Promise<boolean> {
  const { count } = await prisma.timer.updateMany({
    where: { dedupeKey, firedAt: null, cancelledAt: null },
    data: { cancelledAt: new Date() },
  });
  return count === 1;
}

// Marks due timers fired and runs the handler in one transaction. If the handler throws,
// the transaction rolls back and the timers fire on the next tick.
export async function fireDueTimers(
  prisma: PrismaClient,
  limit: number,
  handler: (tx: Prisma.TransactionClient, timers: FiredTimer[]) => Promise<void>,
): Promise<number> {
  return prisma.$transaction(async (tx) => {
    const timers = await tx.$queryRaw<FiredTimer[]>`
      UPDATE timers SET fired_at = now()
      WHERE id IN (
        SELECT id FROM timers
        WHERE fire_at <= now() AND fired_at IS NULL AND cancelled_at IS NULL
        ORDER BY fire_at
        LIMIT ${limit}
        FOR UPDATE SKIP LOCKED
      )
      RETURNING id, kind::text AS kind, approval_id AS "approvalId", payload`;
    if (timers.length > 0) await handler(tx, timers);
    return timers.length;
  });
}
```

- [ ] **Step 7: Run all tests and the typecheck**

Run: `pnpm test` → Expected: all pass.
Run: `pnpm typecheck` → Expected: exit 0.

- [ ] **Step 8: Commit**

```bash
git add db
git commit -m "feat(db): job rows and timers as the durable record"
```

---

### Task 6: Partitioned, append-only ledger

**Files:**
- Create: `db/prisma/migrations/20260930000300_ledger/migration.sql`, `db/src/ledger.ts`
- Modify: `db/package.json`
- Test: `db/test/ledger.test.ts`

**Interfaces:**
- Consumes: `type EventType` from `@orbit/shared/events` (Task 2). The `workspaces` table (Task 4).
- Produces (`@orbit/db/ledger`):
  - `appendEvent(prisma, e: { workspaceId: string; type: EventType; actor: string; leadId?: string; approvalId?: string; data?: Record<string, unknown>; occurredAt?: Date }): Promise<void>`.
  - `ensureMonthPartitions(prisma, from: Date, months: number): Promise<number>`. It returns the number of partitions created, across `events`, `llm_calls` and `decision_calls`.
- Produces tables: `ledger.events` (append-only), `ledger.llm_calls` (append-only) and `ledger.decision_calls` (DAT-9). `decision_calls.human_verdict` is updated later, so that table has no append-only trigger. Partitions exist for 2026-09 through 2027-08.
- Stage 1 duty (recorded here so it is not lost): the worker calls `ensureMonthPartitions(prisma, new Date(), 3)` at start and daily.

- [ ] **Step 1: Write the failing test**

`db/test/ledger.test.ts`:
```ts
import { afterAll, expect, test } from 'vitest';
import { appendEvent, ensureMonthPartitions } from '../src/ledger.ts';
import { newWorkspace, testPrisma } from './helpers.ts';

const prisma = testPrisma();
afterAll(() => prisma.$disconnect());

async function partitionOf(workspaceId: string): Promise<string> {
  const rows = await prisma.$queryRaw<{ part: string }[]>`
    SELECT tableoid::regclass::text AS part FROM ledger.events WHERE workspace_id = ${workspaceId}::uuid`;
  return rows[0]!.part;
}

test('an event lands in its month partition', async () => {
  const ws = await newWorkspace(prisma);
  await appendEvent(prisma, {
    workspaceId: ws.id,
    type: 'email_received',
    actor: 'system',
    occurredAt: new Date('2026-10-15T12:00:00Z'),
    data: { source: 'gmail' },
  });
  expect(await partitionOf(ws.id)).toBe('ledger.events_2026_10');
});

test('events cannot be updated or deleted (DAT-1)', async () => {
  const ws = await newWorkspace(prisma);
  await appendEvent(prisma, { workspaceId: ws.id, type: 'ack_sent', actor: 'system' });
  await expect(
    prisma.$executeRaw`UPDATE ledger.events SET actor = 'x' WHERE workspace_id = ${ws.id}::uuid`,
  ).rejects.toThrow(/append-only/);
  await expect(
    prisma.$executeRaw`DELETE FROM ledger.events WHERE workspace_id = ${ws.id}::uuid`,
  ).rejects.toThrow(/append-only/);
  await expect(prisma.$executeRaw`TRUNCATE ledger.events`).rejects.toThrow(/append-only/);
});

test('an event in a month without a partition fails loudly', async () => {
  const ws = await newWorkspace(prisma);
  await expect(
    appendEvent(prisma, { workspaceId: ws.id, type: 'ack_sent', actor: 'system', occurredAt: new Date('2031-01-10T00:00:00Z') }),
  ).rejects.toThrow(/no partition/);
});

test('ensureMonthPartitions creates missing months and is idempotent', async () => {
  const ws = await newWorkspace(prisma);
  const from = new Date('2031-01-01T00:00:00Z');
  expect(await ensureMonthPartitions(prisma, from, 1)).toBe(3);
  expect(await ensureMonthPartitions(prisma, from, 1)).toBe(0);
  await appendEvent(prisma, { workspaceId: ws.id, type: 'ack_sent', actor: 'system', occurredAt: new Date('2031-01-10T00:00:00Z') });
  expect(await partitionOf(ws.id)).toBe('ledger.events_2031_01');
});

test('the migration created twelve months for each ledger table', async () => {
  const rows = await prisma.$queryRaw<{ n: bigint }[]>`
    SELECT count(*) AS n FROM pg_inherits i
    JOIN pg_class c ON c.oid = i.inhrelid
    JOIN pg_namespace ns ON ns.oid = c.relnamespace
    WHERE ns.nspname = 'ledger' AND c.relname ~ '_20(26_(09|1[0-2])|27_0[1-8])$'`;
  expect(Number(rows[0]!.n)).toBe(36);
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `pnpm test:db` → Expected: FAIL, cannot load `../src/ledger.ts`.

- [ ] **Step 3: Write the ledger migration**

`db/prisma/migrations/20260930000300_ledger/migration.sql`:
```sql
-- Ledger tables (DAT-1, DAT-2, DAT-9). Kept in their own schema so Prisma never models or
-- diffs them; access goes through db/src/ledger.ts. Bounds are UTC (compose sets timezone=UTC).
CREATE SCHEMA ledger;

CREATE SEQUENCE ledger.events_id_seq;
CREATE TABLE ledger.events (
  id           bigint      NOT NULL DEFAULT nextval('ledger.events_id_seq'),
  workspace_id uuid        NOT NULL REFERENCES public.workspaces(id),
  occurred_at  timestamptz NOT NULL DEFAULT now(),
  type         text        NOT NULL,
  actor        text        NOT NULL,
  lead_id      uuid,
  approval_id  uuid,
  data         jsonb       NOT NULL DEFAULT '{}'::jsonb,
  PRIMARY KEY (id, occurred_at)
) PARTITION BY RANGE (occurred_at);
CREATE INDEX events_workspace_time ON ledger.events (workspace_id, occurred_at);
CREATE INDEX events_approval ON ledger.events (approval_id) WHERE approval_id IS NOT NULL;

CREATE SEQUENCE ledger.llm_calls_id_seq;
CREATE TABLE ledger.llm_calls (
  id                  bigint      NOT NULL DEFAULT nextval('ledger.llm_calls_id_seq'),
  workspace_id        uuid        NOT NULL REFERENCES public.workspaces(id),
  occurred_at         timestamptz NOT NULL DEFAULT now(),
  caller              text        NOT NULL,
  provider            text        NOT NULL,
  model               text        NOT NULL,
  lead_id             uuid,
  input_tokens        integer     NOT NULL,
  cached_input_tokens integer     NOT NULL DEFAULT 0,
  output_tokens       integer     NOT NULL,
  latency_ms          integer     NOT NULL,
  cost_usd            numeric(12, 6) NOT NULL,
  PRIMARY KEY (id, occurred_at)
) PARTITION BY RANGE (occurred_at);

CREATE SEQUENCE ledger.decision_calls_id_seq;
CREATE TABLE ledger.decision_calls (
  id             bigint      NOT NULL DEFAULT nextval('ledger.decision_calls_id_seq'),
  workspace_id   uuid        NOT NULL REFERENCES public.workspaces(id),
  occurred_at    timestamptz NOT NULL DEFAULT now(),
  caller         text        NOT NULL,
  provider       text        NOT NULL,
  question_type  text        NOT NULL,
  redacted_state jsonb       NOT NULL,
  question       text        NOT NULL,
  answer         text,
  confidence     numeric(4, 3),
  latency_ms     integer,
  cost_usd       numeric(12, 6),
  human_verdict  text CHECK (human_verdict IN ('agreed', 'overridden')),
  PRIMARY KEY (id, occurred_at)
) PARTITION BY RANGE (occurred_at);

-- Append-only: rows can be inserted, never changed. Retention removes whole partitions (DAT-3).
CREATE FUNCTION ledger.reject_change() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'ledger.% is append-only', TG_TABLE_NAME USING ERRCODE = 'insufficient_privilege';
END $$;

CREATE TRIGGER events_append_only BEFORE UPDATE OR DELETE ON ledger.events
  FOR EACH ROW EXECUTE FUNCTION ledger.reject_change();
CREATE TRIGGER events_no_truncate BEFORE TRUNCATE ON ledger.events
  FOR EACH STATEMENT EXECUTE FUNCTION ledger.reject_change();
CREATE TRIGGER llm_calls_append_only BEFORE UPDATE OR DELETE ON ledger.llm_calls
  FOR EACH ROW EXECUTE FUNCTION ledger.reject_change();
CREATE TRIGGER llm_calls_no_truncate BEFORE TRUNCATE ON ledger.llm_calls
  FOR EACH STATEMENT EXECUTE FUNCTION ledger.reject_change();

-- Creates monthly partitions for all three tables; safe to call repeatedly.
CREATE FUNCTION ledger.ensure_month_partitions(p_from date, p_months integer) RETURNS integer
LANGUAGE plpgsql AS $$
DECLARE
  t       text;
  m       date;
  part    text;
  created integer := 0;
BEGIN
  FOREACH t IN ARRAY ARRAY['events', 'llm_calls', 'decision_calls'] LOOP
    FOR i IN 0 .. p_months - 1 LOOP
      m := (date_trunc('month', p_from) + make_interval(months => i))::date;
      part := format('%s_%s', t, to_char(m, 'YYYY_MM'));
      IF to_regclass(format('ledger.%I', part)) IS NULL THEN
        EXECUTE format(
          'CREATE TABLE ledger.%I PARTITION OF ledger.%I FOR VALUES FROM (%L) TO (%L)',
          part, t, m, (m + interval '1 month')::date);
        created := created + 1;
      END IF;
    END LOOP;
  END LOOP;
  RETURN created;
END $$;

SELECT ledger.ensure_month_partitions(DATE '2026-09-01', 12);
```

- [ ] **Step 4: Implement the ledger helpers**

`db/src/ledger.ts`:
```ts
import type { EventType } from '@orbit/shared/events';
import type { PrismaClient } from './client.ts';

export async function appendEvent(
  prisma: PrismaClient,
  e: {
    workspaceId: string;
    type: EventType;
    actor: string;
    leadId?: string;
    approvalId?: string;
    data?: Record<string, unknown>;
    occurredAt?: Date;
  },
): Promise<void> {
  await prisma.$executeRaw`
    INSERT INTO ledger.events (workspace_id, occurred_at, type, actor, lead_id, approval_id, data)
    VALUES (${e.workspaceId}::uuid, ${e.occurredAt ?? new Date()}, ${e.type}, ${e.actor},
            ${e.leadId ?? null}::uuid, ${e.approvalId ?? null}::uuid, ${JSON.stringify(e.data ?? {})}::jsonb)`;
}

export async function ensureMonthPartitions(prisma: PrismaClient, from: Date, months: number): Promise<number> {
  const day = from.toISOString().slice(0, 10);
  const rows = await prisma.$queryRaw<{ created: number }[]>`
    SELECT ledger.ensure_month_partitions(${day}::date, ${months}::integer) AS created`;
  return rows[0]!.created;
}
```

Add to `db/package.json` `exports`:
```json
"./ledger": "./src/ledger.ts"
```

- [ ] **Step 5: Run all tests and the typecheck**

Run: `pnpm test` → Expected: all pass.
Run: `pnpm typecheck` → Expected: exit 0.

- [ ] **Step 6: Confirm Prisma still sees no drift**

Run: `pnpm --filter @orbit/db exec prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --exit-code`
Expected: exit code 0, "No difference detected". This proves the `ledger` schema stays invisible to Prisma.

- [ ] **Step 7: Commit**

```bash
git add db
git commit -m "feat(db): partitioned append-only ledger for events, llm and decision calls"
```

---

### Task 7: Program stubs, Dockerfile and the instance compose template

**Files:**
- Create: `api/package.json`, `api/src/main.ts`, and the same pair for `web/`, `worker/` and `frontdesk/`
- Create: `Dockerfile`, `.dockerignore`, `template/compose.yml`, `template/.env.example`
- Test: `template/test/compose.test.ts`
- Modify: `package.json`, `.github/workflows/ci.yml`

**Interfaces:**
- Consumes: `startHealthServer` from `@orbit/shared/health` (Task 1). `template/postgres/init/01-databases.sh` (Task 3).
- Produces: images built from one `Dockerfile` with `--build-arg APP=<api|web|worker|frontdesk>`, each serving `GET /healthz` on `PORT` (default 8080).
- Produces: `template/compose.yml`, the per-instance stack without the engine container. The Stage 0b plan adds a `paperclip` service on the `data` network. That service holds no `GMAIL_*`, `RESEND_*` or `TOKEN_ENCRYPTION_KEY` values, only its own model key (SEC-2a, SEC-10).

- [ ] **Step 1: Write the program stubs**

`api/package.json` (repeat for `web`, `worker` and `frontdesk`, changing only the name to `@orbit/web`, `@orbit/worker` and `@orbit/frontdesk`):
```json
{
  "name": "@orbit/api",
  "private": true,
  "type": "module",
  "dependencies": {
    "@orbit/shared": "workspace:*",
    "pino": "10.3.1",
    "tsx": "4.23.15"
  }
}
```

`api/src/main.ts` (repeat for the other three programs, changing only `PROGRAM`):
```ts
import { pino } from 'pino';
import { startHealthServer } from '@orbit/shared/health';

// Stage 0 stub: health endpoint only. Stage 1 adds the real program.
const PROGRAM = 'api';
const log = pino({ name: PROGRAM });
const port = Number(process.env.PORT ?? 8080);

startHealthServer({ name: PROGRAM, port }).on('listening', () => log.info({ port }, 'listening'));
```

Run `pnpm install`, then `pnpm exec tsx api/src/main.ts`. In a second terminal, run `curl http://127.0.0.1:8080/healthz`.
Expected: `{"status":"ok","program":"api"}`. Stop the program with Ctrl+C.

- [ ] **Step 2: Write the Dockerfile**

The Dockerfile copies `ops/package.json`. If Task 9 has not run yet, create `ops/package.json` now with the content from Task 9 Step 1.

`Dockerfile`:
```dockerfile
# One image recipe for the four ORBIT programs; APP selects which one runs.
FROM node:24.14.1-slim AS base
RUN corepack enable
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY shared/package.json shared/
COPY db/package.json db/
COPY api/package.json api/
COPY web/package.json web/
COPY worker/package.json worker/
COPY frontdesk/package.json frontdesk/
COPY ops/package.json ops/
RUN pnpm install --frozen-lockfile --prod

FROM deps AS runtime
ARG APP
ENV APP=${APP} NODE_ENV=production
COPY shared shared
COPY ${APP} ${APP}
USER node
CMD ["sh", "-c", "exec node --import tsx \"$APP/src/main.ts\""]
```

`.dockerignore`:
```
**/node_modules
**/generated
.git
.env*
landing
archive
docs
*.md
```

- [ ] **Step 3: Write the instance compose template**

`template/compose.yml`:
```yaml
# Per-instance stack (DEP-1). Rendered per customer with that instance's .env (DEP-3).
# The Paperclip + Hermes container is added by the Stage 0b plan.
name: orbit-instance

x-program: &program
  build:
    context: ..
  restart: unless-stopped
  healthcheck:
    test: ["CMD", "node", "-e", "fetch('http://127.0.0.1:8080/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]
    interval: 10s
    timeout: 3s
    retries: 5

services:
  postgres:
    image: pgvector/pgvector:pg16
    command: ["postgres", "-c", "timezone=UTC"]
    restart: unless-stopped
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:?}
      ORBIT_DB_PASSWORD: ${ORBIT_DB_PASSWORD:?}
      PAPERCLIP_DB_PASSWORD: ${PAPERCLIP_DB_PASSWORD:?}
    volumes:
      - pgdata:/var/lib/postgresql/data
      - ./postgres/init:/docker-entrypoint-initdb.d:ro
    networks: [data]
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -h 127.0.0.1 -U postgres"]
      interval: 5s
      timeout: 3s
      retries: 20

  redis:
    image: redis:7-alpine
    restart: unless-stopped
    networks: [data]
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 3s
      retries: 20

  web:
    <<: *program
    build: { context: .., args: { APP: web } }
    environment:
      PORT: "8080"
    ports: ["127.0.0.1:8080:8080"]
    networks: [edge]

  api:
    <<: *program
    build: { context: .., args: { APP: api } }
    environment:
      PORT: "8080"
      DATABASE_URL: postgresql://orbit_app:${ORBIT_DB_PASSWORD:?}@postgres:5432/orbit
      REDIS_URL: redis://redis:6379
      RESEND_API_KEY: ${RESEND_API_KEY:?}
    ports: ["127.0.0.1:8081:8080"]
    networks: [data, edge, egress]
    depends_on:
      postgres: { condition: service_healthy }
      redis: { condition: service_healthy }

  worker:
    <<: *program
    build: { context: .., args: { APP: worker } }
    environment:
      PORT: "8080"
      DATABASE_URL: postgresql://orbit_app:${ORBIT_DB_PASSWORD:?}@postgres:5432/orbit
      REDIS_URL: redis://redis:6379
      RESEND_API_KEY: ${RESEND_API_KEY:?}
    networks: [data, egress]
    depends_on:
      postgres: { condition: service_healthy }
      redis: { condition: service_healthy }

  frontdesk:
    <<: *program
    build: { context: .., args: { APP: frontdesk } }
    environment:
      PORT: "8080"
      DATABASE_URL: postgresql://orbit_app:${ORBIT_DB_PASSWORD:?}@postgres:5432/orbit
      REDIS_URL: redis://redis:6379
      GMAIL_CLIENT_ID: ${GMAIL_CLIENT_ID:?}
      GMAIL_CLIENT_SECRET: ${GMAIL_CLIENT_SECRET:?}
      TOKEN_ENCRYPTION_KEY: ${TOKEN_ENCRYPTION_KEY:?}
      ANTHROPIC_API_KEY: ${ANTHROPIC_API_KEY:?}
    networks: [data, egress]
    depends_on:
      postgres: { condition: service_healthy }
      redis: { condition: service_healthy }

networks:
  data:
    internal: true # no internet route; Postgres and Redis live only here (SEC-1)
  edge: {}         # web and api, reached by the host's reverse proxy via 127.0.0.1
  egress: {}       # outbound internet for Gmail, Resend and model calls

volumes:
  pgdata: {}
```

`template/.env.example`:
```
# Names only. Real values are generated per instance by the provisioning script (PRV-2).
POSTGRES_PASSWORD=
ORBIT_DB_PASSWORD=
PAPERCLIP_DB_PASSWORD=
RESEND_API_KEY=
GMAIL_CLIENT_ID=
GMAIL_CLIENT_SECRET=
TOKEN_ENCRYPTION_KEY=
ANTHROPIC_API_KEY=
```

- [ ] **Step 4: Write the static compose test**

Add to the root `devDependencies`:
```json
"yaml": "2.9.1"
```
Run: `pnpm install`.

`template/test/compose.test.ts`:
```ts
import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { parse } from 'yaml';

type Service = {
  ports?: string[];
  networks?: string[];
  environment?: Record<string, string>;
  healthcheck?: unknown;
};
const compose = parse(readFileSync(new URL('../compose.yml', import.meta.url), 'utf8')) as {
  services: Record<string, Service>;
  networks: Record<string, { internal?: boolean } | null>;
};
const services = compose.services;
const PROGRAMS = ['web', 'api', 'worker', 'frontdesk'];

test('the stack defines the four programs, Postgres and Redis', () => {
  expect(Object.keys(services).sort()).toEqual(['api', 'frontdesk', 'postgres', 'redis', 'web', 'worker']);
});

test('postgres, redis, worker and frontdesk publish no ports (SEC-1)', () => {
  for (const name of ['postgres', 'redis', 'worker', 'frontdesk']) {
    expect(services[name]!.ports, name).toBeUndefined();
  }
});

test('published ports bind to 127.0.0.1 only (SEC-1)', () => {
  for (const [name, svc] of Object.entries(services)) {
    for (const port of svc.ports ?? []) expect(port, name).toMatch(/^127\.0\.0\.1:/);
  }
});

test('the data network has no internet route, and holds Postgres and Redis alone', () => {
  expect(compose.networks.data?.internal).toBe(true);
  expect(services.postgres!.networks).toEqual(['data']);
  expect(services.redis!.networks).toEqual(['data']);
});

test('only frontdesk receives Gmail credentials and the model key (SEC-2, SEC-10)', () => {
  for (const [name, svc] of Object.entries(services)) {
    const keys = Object.keys(svc.environment ?? {});
    const secret = keys.filter((k) => k.startsWith('GMAIL_') || k === 'ANTHROPIC_API_KEY' || k === 'TOKEN_ENCRYPTION_KEY');
    if (name === 'frontdesk') expect(secret.length).toBe(4);
    else expect(secret, name).toEqual([]);
  }
});

test('the web program holds no secrets and no database access', () => {
  expect(Object.keys(services.web!.environment ?? {})).toEqual(['PORT']);
  expect(services.web!.networks).toEqual(['edge']);
});

test('every program has a healthcheck', () => {
  for (const name of PROGRAMS) expect(services[name]!.healthcheck, name).toBeDefined();
});
```

- [ ] **Step 5: Run the tests**

Run: `pnpm test:unit` → Expected: all pass.

To see a check fail, temporarily add `ports: ["5432:5432"]` to `postgres`: two tests fail. Remove the line again.

- [ ] **Step 6: Smoke-test the real stack locally**

Create a local file `template/.env`. Git ignores it through the existing `.env` rule, so use this exact name:
```
POSTGRES_PASSWORD=smoke
ORBIT_DB_PASSWORD=smoke
PAPERCLIP_DB_PASSWORD=smoke
RESEND_API_KEY=smoke
GMAIL_CLIENT_ID=smoke
GMAIL_CLIENT_SECRET=smoke
TOKEN_ENCRYPTION_KEY=smoke
ANTHROPIC_API_KEY=smoke
```
Then run:
```bash
docker compose -f template/compose.yml up -d --build --wait
curl -fsS http://127.0.0.1:8080/healthz
curl -fsS http://127.0.0.1:8081/healthz
docker compose -f template/compose.yml down -v
```
Expected: all six containers are healthy; the two curls print `{"status":"ok","program":"web"}` and `{"status":"ok","program":"api"}`.

- [ ] **Step 7: Add the smoke test to CI**

Append to `.github/workflows/ci.yml` under `jobs:`:
```yaml
  compose-smoke:
    runs-on: ubuntu-24.04
    env:
      POSTGRES_PASSWORD: smoke
      ORBIT_DB_PASSWORD: smoke
      PAPERCLIP_DB_PASSWORD: smoke
      RESEND_API_KEY: smoke
      GMAIL_CLIENT_ID: smoke
      GMAIL_CLIENT_SECRET: smoke
      TOKEN_ENCRYPTION_KEY: smoke
      ANTHROPIC_API_KEY: smoke
    steps:
      - uses: actions/checkout@v5
      - run: docker compose -f template/compose.yml up -d --build --wait
      - run: curl -fsS http://127.0.0.1:8080/healthz && curl -fsS http://127.0.0.1:8081/healthz
      - if: always()
        run: docker compose -f template/compose.yml down -v
```

Add to the root `package.json` `scripts`:
```json
"stack:up": "docker compose -f template/compose.yml up -d --build --wait",
"stack:down": "docker compose -f template/compose.yml down -v"
```

- [ ] **Step 8: Commit**

```bash
git add api web worker frontdesk ops/package.json Dockerfile .dockerignore template package.json pnpm-lock.yaml .github
git commit -m "feat(template): instance compose with the four ORBIT program stubs"
```

---

### Task 8: DESIGN.md and design tokens

**Files:**
- Create: `DESIGN.md`, `design/tokens.css`
- Test: `design/tokens.test.ts`

**Interfaces:**
- Produces: `design/tokens.css` with these CSS custom properties: `--color-ink`, `--color-paper`, `--color-canvas`, `--color-muted`, `--color-line`, `--color-danger`, `--font-sans`, `--font-size-body`, `--radius-button`, `--border-divider` and `--focus-ring`. Dark values sit under `prefers-color-scheme: dark`. The Stage 1 web app and the notice emails use these values and no others (DR-T1).

- [ ] **Step 1: Write the failing test**

`design/tokens.test.ts`:
```ts
import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';

const css = readFileSync(new URL('./tokens.css', import.meta.url), 'utf8');
const designMd = readFileSync(new URL('../DESIGN.md', import.meta.url), 'utf8');

function block(source: string): Record<string, string> {
  const vars: Record<string, string> = {};
  for (const m of source.matchAll(/--([a-z-]+):\s*([^;]+);/g)) vars[m[1]!] = m[2]!.trim();
  return vars;
}
const darkStart = css.indexOf('@media (prefers-color-scheme: dark)');
const light = block(css.slice(0, darkStart));
const dark = { ...light, ...block(css.slice(darkStart)) };

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}
function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
}

test('light tokens match UX-1 exactly', () => {
  expect(light).toMatchObject({
    'color-ink': '#000000',
    'color-paper': '#ffffff',
    'color-canvas': '#f4f4f5',
    'color-muted': '#52525b',
    'color-line': '#e4e4e7',
    'radius-button': '10px',
    'border-divider': '1px',
    'font-size-body': '16px',
    'focus-ring': '3px',
  });
});

test('text colours reach 4.5:1 on paper and canvas in both themes (UX-7)', () => {
  for (const [theme, t] of [['light', light], ['dark', dark]] as const) {
    for (const fg of ['color-ink', 'color-muted', 'color-danger']) {
      for (const bg of ['color-paper', 'color-canvas']) {
        expect(contrast(t[fg]!, t[bg]!), `${theme} ${fg} on ${bg}`).toBeGreaterThanOrEqual(4.5);
      }
    }
  }
});

test('DESIGN.md documents every colour value in both themes', () => {
  for (const value of new Set([...Object.values(light), ...Object.values(dark)])) {
    if (value.startsWith('#')) expect(designMd, value).toContain(value);
  }
});

test('no shadows (UX-1)', () => {
  expect(css).not.toMatch(/shadow/i);
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `pnpm test:unit` → Expected: FAIL, `ENOENT … tokens.css`.

- [ ] **Step 3: Write the tokens**

`design/tokens.css`:
```css
/* Orbitcrew design tokens. DESIGN.md is the source; this file must match it. */
:root {
  --color-ink: #000000;
  --color-paper: #ffffff;
  --color-canvas: #f4f4f5;
  --color-muted: #52525b;
  --color-line: #e4e4e7;
  --color-danger: #b91c1c;
  --font-sans: "Inter Variable", ui-sans-serif, system-ui, sans-serif;
  --font-size-body: 16px;
  --radius-button: 10px;
  --border-divider: 1px;
  --focus-ring: 3px;
}

@media (prefers-color-scheme: dark) {
  :root {
    --color-ink: #fafafa;
    --color-paper: #1c1c1f;
    --color-canvas: #111113;
    --color-muted: #a1a1aa;
    --color-line: #2e2e33;
    --color-danger: #f87171;
  }
}
```

- [ ] **Step 4: Write DESIGN.md**

`DESIGN.md`:
```markdown
# Orbitcrew Design System

This is the single design system for the Orbitcrew app and its notice emails (PRD UX-1).
The values come from the landing page tokens. `design/tokens.css` implements them, and
`design/tokens.test.ts` fails CI if the two drift apart.

## Colours

| Token | Light | Dark | Use |
|---|---|---|---|
| `--color-ink` | `#000000` | `#fafafa` | Text, primary buttons, focus ring |
| `--color-paper` | `#ffffff` | `#1c1c1f` | Surfaces: lists, text boxes, the sticky bar |
| `--color-canvas` | `#f4f4f5` | `#111113` | Page background |
| `--color-muted` | `#52525b` | `#a1a1aa` | Secondary text: "by Orbitcrew", timestamps, the cost line |
| `--color-line` | `#e4e4e7` | `#2e2e33` | 1 px dividers only; never text |
| `--color-danger` | `#b91c1c` | `#f87171` | Errors and failed sends only |

The theme follows the phone (`prefers-color-scheme`). There is no manual switch (UX-2).

## Type

- Inter (`"Inter Variable"`), falling back to the system sans-serif.
- Body text is at least 16 px. Nothing the owner must read is smaller.

## Shapes

- Buttons: 10 px radius.
- Dividers: 1 px, `--color-line`.
- No shadows, no gradients, no card grids. Plain lists (UX-3).

## Accessibility (UX-7)

- Text contrast is at least 4.5:1 on paper and canvas, in both themes (checked in CI).
- Focus ring: 3 px solid `--color-ink`, offset 3 px.
- Targets are at least 44 px; Send is 48 px. Send and Discard are at least 16 px apart.
- Every button has a text label. Status changes use `aria-live`.
- Works at 200% zoom and respects `prefers-reduced-motion`.

## Words (UX-6)

Customer-facing text says "Orbitcrew", "Orbi" and "Scout". It never says ORBIT-OS,
Paperclip, Hermes, adapters, heartbeats or tokens.
```

- [ ] **Step 5: Run the tests**

Run: `pnpm test:unit` → Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add DESIGN.md design
git commit -m "docs(design): DESIGN.md and tokens with contrast checks"
```

---

### Task 9: Verified Resend sending domain

**Files:**
- Create: `ops/package.json`, `ops/src/resend-check.ts`, `ops/src/send-resend-check.ts`
- Test: `ops/src/resend-check.test.ts`

**Interfaces:**
- Produces: `buildCheckEmail(from: string, to: string): CheckEmail`, where `CheckEmail = { from: string; to: string; subject: string; text: string; headers: Record<string, string> }`. The message is content-free and carries the `X-Orbitcrew` header (FD-1, NTC-1).
- Produces: the command `pnpm resend:check`, which reads `RESEND_API_KEY`, `RESEND_FROM` and `RESEND_CHECK_TO` from `.env.local`.

- [ ] **Step 1: Create the package**

`ops/package.json`:
```json
{
  "name": "@orbit/ops",
  "private": true,
  "type": "module",
  "dependencies": {
    "resend": "6.31.0",
    "tsx": "4.23.15"
  }
}
```

Add to the root `package.json` `scripts`:
```json
"resend:check": "node --env-file=.env.local --import tsx ops/src/send-resend-check.ts"
```

Run: `pnpm install`.

- [ ] **Step 2: Write the failing test**

`ops/src/resend-check.test.ts`:
```ts
import { expect, test } from 'vitest';
import { buildCheckEmail } from './resend-check.ts';

const email = buildCheckEmail('Orbitcrew <notify@mail.example.com>', 'founder@example.com');

test('carries the X-Orbitcrew header so the poller skips it (FD-1)', () => {
  expect(email.headers['X-Orbitcrew']).toBe('system');
});

test('uses only customer-facing words (UX-6)', () => {
  const text = `${email.subject} ${email.text}`;
  expect(text).toContain('Orbitcrew');
  expect(text).not.toMatch(/ORBIT-OS|Paperclip|Hermes/i);
});
```

- [ ] **Step 3: Run it and confirm it fails**

Run: `pnpm test:unit` → Expected: FAIL, cannot load `./resend-check.ts`.

- [ ] **Step 4: Implement**

`ops/src/resend-check.ts`:
```ts
export type CheckEmail = { from: string; to: string; subject: string; text: string; headers: Record<string, string> };

// A content-free message used only to prove SPF and DKIM pass for the sending domain (E2-T3).
export function buildCheckEmail(from: string, to: string): CheckEmail {
  return {
    from,
    to,
    subject: 'Orbitcrew sending check',
    text: 'This message checks that Orbitcrew email is signed correctly. No action is needed.',
    headers: { 'X-Orbitcrew': 'system' },
  };
}
```

`ops/src/send-resend-check.ts`:
```ts
import { Resend } from 'resend';
import { buildCheckEmail } from './resend-check.ts';

const { RESEND_API_KEY, RESEND_FROM, RESEND_CHECK_TO } = process.env;
if (!RESEND_API_KEY || !RESEND_FROM || !RESEND_CHECK_TO) {
  console.error('Set RESEND_API_KEY, RESEND_FROM and RESEND_CHECK_TO in .env.local');
  process.exit(1);
}

const { data, error } = await new Resend(RESEND_API_KEY).emails.send(buildCheckEmail(RESEND_FROM, RESEND_CHECK_TO));
if (error) {
  console.error(`Resend refused the message: ${error.message}`);
  process.exit(1);
}
console.log(`Sent. Resend id: ${data?.id}. Now check the headers in Gmail (see the plan, Task 9 Step 7).`);
```

- [ ] **Step 5: Run the tests**

Run: `pnpm test:unit` → Expected: all pass.

- [ ] **Step 6: Set up the domain in Resend (founder)**

1. Choose the sending domain. A subdomain of the Orbitcrew domain is recommended (for example `mail.<orbitcrew-domain>`), so system email reputation stays apart from the main domain. See "Open questions" item 2.
2. In Resend → Domains → Add Domain, enter it. Resend shows DNS records: an MX and an SPF TXT record on the `send` subdomain, and a DKIM TXT record at `resend._domainkey`.
3. Add those records at the DNS provider. Also add a DMARC record: TXT at `_dmarc.<sending-domain>` with value `v=DMARC1; p=none;`.
4. Wait until Resend shows the domain as **Verified**.
5. In Resend → API Keys, create a key with **Sending access** limited to this domain.
6. Add three lines to `.env.local` (never committed):

```
RESEND_API_KEY=<the new key>
RESEND_FROM=Orbitcrew <notify@<sending-domain>>
RESEND_CHECK_TO=<your own Gmail address>
```

- [ ] **Step 7: Send the check email and verify SPF/DKIM (E2-T3 verify)**

Run: `pnpm resend:check`
Expected: `Sent. Resend id: …`.

In Gmail, open the message → ⋮ → **Show original**.
Expected: `SPF: PASS`, `DKIM: PASS` (signed by the sending domain) and `DMARC: PASS`.

- [ ] **Step 8: Commit**

```bash
git add ops package.json pnpm-lock.yaml
git commit -m "feat(ops): Resend sending-domain check"
```

---

## Stage 0 exit check

Run these after all tasks. They map to the PRD §18 row 0 exit criterion.

| Criterion | How to confirm |
|---|---|
| CI red on a failing test | Task 1 Step 9 run history on GitHub Actions |
| `.env.local` ignored | `git check-ignore .env.local` prints `.env.local` |
| Test email passes SPF/DKIM | Task 9 Step 7 "Show original" |
| Two databases, separate logins | `pnpm test:db` → `postgres-logins.test.ts` passes |
| Approvals and job-row schemas frozen | `shared/src/approvals.ts`, `shared/src/jobs.ts`, `shared/src/agent-output.ts` and the `…_core` and `…_jobs_timers` migrations are merged; the enum drift tests pass |
| Template compose starts | CI `compose-smoke` job green |
| DESIGN.md | `design/tokens.test.ts` passes |

## Open questions (listed, not decided)

1. **Receipt retention versus event retention.** DAT-1 says receipts are projections of events. DAT-3 keeps events for 24 months but receipts "for the life of the customer". Once events older than 24 months are dropped, receipts cannot be rebuilt from them. The schema seeds both rules as written. Stage 1 must either store receipt rows permanently or exempt receipt events from the partition drop. This needs a founder answer before the retention job is built (TODOS.md, P2).
2. **The Resend sending domain.** The PRD says "a verified Orbitcrew sending domain" but does not name it. Task 9 needs the founder to choose it.
3. **Sequencing change against PRD §18 row 0.** Row 0 lists the "Paperclip + Hermes container" inside the template compose. This plan moves that one service into the Stage 0b plan, because its image, version and config depend on the spike's pinned versions. The rest of the template is here. This is sequencing only; nothing is removed from launch scope.
4. **N-16 (how the owner account is created)** must be answered before Stage 1 (CEO v2 D11). The schema has `users` and `sessions` but no invitations table, so it does not assume either answer.
