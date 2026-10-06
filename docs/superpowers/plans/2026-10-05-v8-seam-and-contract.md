# Sub-project 0: the seam and the spec reset — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Put one reviewed interface, one copy of the prototype, correctly scoped rules files and a runnable Done checklist in place, so Stream A (dashboards) and Stream B (engine) can build in parallel without either colliding with the other or with the frozen lead-reply code.

**Architecture:** A new `contract/` workspace package holds the seam as code: Zod schemas and the `ApiClient` interface types, split into a stable `v1` dashboard layer and an `experimental` engine layer, with no implementations. A new `dashboards/` workspace package is where Stream A will later live, and it carries the frontend-only rule in its own `CLAUDE.md` so that rule can never gate Stream B. A new top-level `guards/` directory holds repo-wide guard tests, kept out of the frozen packages so adding them cannot disturb the freeze.

**Tech Stack:** TypeScript 7 strict, Zod, Vitest 5, ESLint 9 flat config, typescript-eslint, Playwright with axe-core, pnpm 10 workspaces, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-10-05-v8-seam-and-contract-design.md`

## Global Constraints

- Quality and security before speed. Ask the founder on any decision affecting security, money, customer data or the product definition.
- The lead-reply code is frozen: no new features, no deletions. Every existing test keeps running and passing. Flag immediately if any change would skip or weaken a test.
- Frozen directories: `frontdesk/`, `api/`, `db/`, `shared/`, `template/`, `ops/`, `design/`. **This corrects the spec**, which named only the first five; `vitest list` shows `ops/` and `design/` also hold collected tests.
- No file in those seven directories is modified by this sub-project. `vitest.config.ts`, `tsconfig.json`, `.gitignore`, `pnpm-workspace.yaml`, `package.json` and `.github/workflows/ci.yml` are root files and may be added to, never reduced.
- `reference/` is read-only: excluded from typecheck, lint, every vitest project and every build.
- **The authority is `docs/prd/ORBIT_OS_PRD_v9_0.md`.** It supersedes v8.0. v8.0 and v7.0 are the historical record and are not corrected. Where v9.0 and an earlier decision disagree, v9.0 wins.
- **Fixed product lists live only in PRD v9.0 Appendix A** and are never restated in code, seed files or documents without citing it: A.1 roles, A.2 connector catalog, A.3 the seven task states, A.4 the four risk categories, A.5 the three-number budget, A.6 the three approval bases, A.7 the never-covers list, A.8 escalation defaults, A.9 the six safe states.
- **Design tokens come from the frozen `design/` package**, proven by `design/tokens.test.ts`. Layout follows PRD §15.2: plain lists, no card grids, no KPI tiles, no template gallery; one red used only for errors; Inter; theme follows the phone. The prototype's purple, pink, radii and card layouts are **not** carried over.
- **The prototype supplies behaviour, copy and screen flow only.** Names, roles, tools and visuals come from the PRD. Where prototype copy names Atlas, or a role or tool not in Appendix A, substitute the PRD's name and change nothing else in the sentence.
- **The naming rule is scoped** (PRD §15.3). Customer screens — the User and Org Admin apps, and every customer email and push alert — never say ORBIT-OS, Paperclip, Hermes, OpenClaw, MCP, token, agent id or adapter name, including in the `<title>` tag, email subjects and error text. **The Super Admin fleet console is exempt**: it is an internal operator surface and those names are correct there.
- Customer-facing name is **Orbitcrew**, settled in PRD v9.0 §18.1. ORBIT-OS stays the internal name.
- Standing Authority: UI surface only, feature-flagged off, contract surface read-only (`listGrants` and nothing else). No enforcement. Blocked pending the founder's one-page decision.
- Dependency versions are pinned exact. `.npmrc` already sets `save-exact=true`; every `pnpm add` uses `-E` as well.
- Secrets: this project's own `.env`, never committed, `.env.example` checked in. No shared or cross-project env file is read or written.
- Every code diff gets a security review in a fresh session that reads only the diff. Docs-only commits are exempt.
- Checkpoints carry no dates. They are gates.
- Plain language in all user-facing and document copy: short sentences, no jargon, no em dashes, no exclamation marks.

## Review Focus

Five failure modes the spec implies that no task's happy-path tests would catch. Each one's test is assigned to the task that owns the code.

1. **A stale path survives the prototype move.** The build prompts and the dashboards rules reference `reference/orbit-os-frontend/...` paths; after the move one could point at a file that is not there, or at the deleted `Prompts_Frontend_docs/`, and nothing would notice until an executor followed it. Pinned in **Task 1**.
2. **The root `CLAUDE.md` regains a frontend-only rule later.** The whole mock-backed parallelism rests on that rule not being at the root. A future edit could reintroduce it and silently gate Stream B. Pinned in **Task 2**.
3. **A frozen test is removed rather than skipped.** A guard that only looks for `.skip`, `.only` and `.todo` stays green if the file is deleted. Pinned in **Task 5**.
4. **`pnpm lint` passes because its ignore list excludes the code.** A config that ignores `dashboards/` or `contract/` makes the Done checklist's lint row meaningless. Pinned in **Task 3**.
5. **A job summary is accepted with fewer than its seven fixed lines.** PRD objective B2 fixes the seven lines; a loose schema would let the engine return six and the dashboard render a gap where the limits should be. Pinned in **Task 8**.

---

## File Structure

| Path | Responsibility |
|---|---|
| `reference/orbit-os-frontend/` | The prototype. Behavior and copy spec. Read-only, one copy. |
| `CLAUDE.md` | Rules true everywhere: security, secrets, decisions log, naming, Done checklist. No frontend-only rule. |
| `dashboards/CLAUDE.md` | The frontend-only rule, scoped by location. |
| `docs/rules/engine.md` | Stream B rules, including threat-model-before-code. |
| `docs/decisions.md` | One running log: decision, date, reason, cost if wrong. |
| `docs/security/threat-model-engine.md` | Skeleton with the five threats. Filled in sub-project 3. |
| `docs/security/threat-model-gateway.md` | Skeleton with the five threats. Filled in sub-project 4. |
| `docs/security/keys.md` | Key inventory: what each key actually is, and its rotation owner. |
| `docs/contracts/api-contract.md` | Prose contract: operations, errors, auth, idempotency, pagination. |
| `docs/contracts/openapi.yaml` | OpenAPI 3.1 for every operation. |
| `contract/src/v1/` | Stable dashboard-layer Zod schemas and inferred types. |
| `contract/src/experimental/` | Unstable engine-layer Zod schemas and inferred types. |
| `contract/src/client.ts` | The `ApiClient` interface composed of both layers. No implementations. |
| `guards/paths.test.ts` | Single-copy and path-resolution guard. |
| `guards/rules.test.ts` | Rules-file and threat-model structure guards. |
| `guards/freeze.test.ts` | The lead-reply freeze guard. |
| `guards/mock-boundary.test.ts` | `MockApiClient` import-boundary guard. |
| `guards/lint-config.test.ts` | Guard on the linter's own ignore list. |
| `eslint.config.js` | Flat config. `react/no-danger` is an error. |
| `playwright.config.ts` | End-to-end and accessibility harness. |
| `e2e/axe.ts` | `expectNoSeriousViolations`, used by every later spec. |
| `e2e/harness.spec.ts` | Proves the browser and axe toolchain actually run in CI. |
| `archive/landing-history.bundle` | `landing/`'s three commits, preserved before its `.git` is removed. |

---

## Task 1: Move the prototype into `reference/`, one copy only

> **Status, 2026-10-06. Steps 1 to 3 are DONE**, in commits `d53ff29` and
> `018b8ca`. The move ran as Option B: the seven children moved into
> `reference/orbit-os-frontend/` (36 files) because a process holds an open handle
> on the old directory and Windows refuses to rename a held directory. `CLAUDE.md`
> is at `dashboards/CLAUDE.md`, the build prompts and the zip are at the repo
> root, and `Prompts_Frontend_docs/orbit-os-frontend/orbit-os-frontend` remains as
> two empty directories holding zero files.
>
> **Remaining: step 4 onward** — `.gitignore`, the `tsconfig.json` exclude, the
> new `guards/` directory, `guards/paths.test.ts`, the `vitest.config.ts` include,
> and the step 9 commit. Skip the `rmdir` in step 4: it fails on the held
> directory, and nothing is to be deleted or force-killed.

**Files:**
- Move: `Prompts_Frontend_docs/orbit-os-frontend/orbit-os-frontend/` → `reference/orbit-os-frontend/`
- Move: `Prompts_Frontend_docs/CLAUDE.md` → `dashboards/CLAUDE.md`
- Move: `Prompts_Frontend_docs/ORBIT-OS_Claude_Code_Build_Prompts.md` → `ORBIT-OS_Claude_Code_Build_Prompts.md`
- Move: `Prompts_Frontend_docs/orbit-os-frontend.zip` → `orbit-os-frontend.zip`
- Modify: `tsconfig.json` (add `reference` to `exclude`)
- Modify: `.gitignore` (add the two xlsx files and the zip)
- Modify: `vitest.config.ts` (add `guards/**/*.test.ts` to the `unit` include)
- Test: `guards/paths.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: the path `reference/orbit-os-frontend/` that every later task and both streams cite. `dashboards/` exists as a directory holding one file.

- [ ] **Step 1: Confirm the source tree before moving anything**

```bash
cd /e/Projects/OrbitOS
find Prompts_Frontend_docs -type f | sort
```

Expected: 39 files. The prototype tree under `Prompts_Frontend_docs/orbit-os-frontend/orbit-os-frontend/`, plus `CLAUDE.md`, `ORBIT-OS_Claude_Code_Build_Prompts.md` and `orbit-os-frontend.zip` at the top level. If the count differs, stop and report.

- [ ] **Step 2: Move the prototype tree and commit**

```bash
mkdir -p reference
mv Prompts_Frontend_docs/orbit-os-frontend/orbit-os-frontend reference/orbit-os-frontend
git add reference/orbit-os-frontend
git commit -F - <<'EOF'
docs(reference): flatten the prototype to one read-only copy

The vanilla-JS prototype arrived nested two levels deep inside
Prompts_Frontend_docs/orbit-os-frontend/orbit-os-frontend/. It is the
behavior and copy spec for all three dashboards, so it has to be findable
at one stable path that specs and build prompts can cite.

It is reference material, not code we own. Nothing in it is edited,
linted, typechecked, tested or built: it was never reviewed as code, and
including it in the quality gates would pour findings from a throwaway
prototype into every future diff.
EOF
```

- [ ] **Step 3: Move the two rule and prompt documents and commit**

`CLAUDE.md` goes to `dashboards/`, not the repo root. The founder confirmed the split: the root file holds only rules true everywhere, and the frontend-only rule lives in the folder Stream A occupies. Stream A occupies `dashboards/` because `web/` is covered by the freeze: `web/src/main.ts` imports from frozen `shared/`, and `template/test/compose.test.ts:22` asserts the exact compose service set.

```bash
mkdir -p dashboards
mv Prompts_Frontend_docs/CLAUDE.md dashboards/CLAUDE.md
mv Prompts_Frontend_docs/ORBIT-OS_Claude_Code_Build_Prompts.md ./
git add dashboards/CLAUDE.md ORBIT-OS_Claude_Code_Build_Prompts.md
git commit -F - <<'EOF'
docs(rules): scope the frontend-only rule to the dashboards folder

The frontend-only rule is what keeps the two build streams parallel: the
dashboards can be finished against a mock while the engine is still being
written. Claude Code loads the CLAUDE.md of the folder it is working in,
so putting that rule at the repo root would gate the engine stream on its
first command, which is the opposite of its purpose.

It therefore sits in dashboards/CLAUDE.md. The repo root gets its own file
in the next commit, holding only the rules that are true everywhere.

Stream A takes a new dashboards/ package rather than the existing web/
one. web/src/main.ts is a Stage 0 health-server stub that imports from the
frozen shared/ package, and template/test/compose.test.ts asserts the
exact set of compose services, so repurposing web/ would disturb a frozen
test for no gain.

The build prompts move to the repo root unchanged. Re-specifying them
against PRD v8.0 is its own task.
EOF
```

- [ ] **Step 4: Move the zip out, remove the empty folder, and ignore the duplicates**

```bash
mv Prompts_Frontend_docs/orbit-os-frontend.zip ./
rmdir Prompts_Frontend_docs/orbit-os-frontend Prompts_Frontend_docs
test ! -d Prompts_Frontend_docs && echo "removed"
```

Then edit `.gitignore`, inserting after the `# Secrets` block:

```gitignore
# Working documents and duplicates, deliberately not tracked.
# The two xlsx reports are generated, not authored.
# The zip is a second copy of reference/orbit-os-frontend/, and the single-copy
# rule must not be breakable by an accidental `git add`.
ORBIT_OS_OBJECTIVES_AND_PROGRESS_*.xlsx
ORBIT_OS_STATUS_*.xlsx
orbit-os-frontend.zip
```

Then edit `tsconfig.json`, changing the `exclude` array to:

```json
"exclude": ["node_modules", "**/node_modules", "landing", "archive", "reference", "**/generated/**"]
```

- [ ] **Step 5: Write the failing path guard**

Create `guards/paths.test.ts`:

```ts
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from 'vitest';

const ROOT = new URL('../', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (['node_modules', '.git', 'reference', 'landing', 'archive', '.vitest'].includes(entry)) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

function filesUnder(dir: string): string[] {
  try {
    return walk(join(ROOT, dir));
  } catch {
    return []; // absent is fine: a fresh clone has no husk
  }
}

test('the prototype exists at exactly one path, and the husk holds no files', () => {
  expect(existsSync(join(ROOT, 'reference/orbit-os-frontend/README.md'))).toBe(true);
  // NOT `existsSync(...) === false`. A process on the founder's machine held an
  // open handle on the old directory, so its seven children moved and two empty
  // directories were left behind. Git does not track empty directories, so the
  // absent-directory form passes in CI and fails on that machine, which is
  // backwards for a guard. What matters is that no FILE lives there.
  expect(filesUnder('Prompts_Frontend_docs')).toEqual([]);
});

test('nothing outside reference/ still points at the old nested location', () => {
  const offenders = walk(ROOT)
    .filter((f) => /\.(ts|tsx|js|json|md|yml|yaml)$/.test(f))
    .filter((f) => readFileSync(f, 'utf8').includes('Prompts_Frontend_docs'))
    .map((f) => f.slice(ROOT.length));
  expect(offenders).toEqual([]);
});

test('every reference path named by the build prompts and the dashboards rules resolves on disk', () => {
  const docs = ['ORBIT-OS_Claude_Code_Build_Prompts.md', 'dashboards/CLAUDE.md'];
  const missing: string[] = [];
  for (const doc of docs) {
    const text = readFileSync(join(ROOT, doc), 'utf8');
    for (const match of text.matchAll(/reference\/orbit-os-frontend\/[A-Za-z0-9_./-]+/g)) {
      const path = match[0].replace(/[.,)]+$/, '');
      if (path.endsWith('/') || path.includes('*')) continue;
      if (!existsSync(join(ROOT, path))) missing.push(`${doc}: ${path}`);
    }
  }
  expect(missing).toEqual([]);
});
```

Add `'guards/**/*.test.ts'` to the `include` array of the `unit` project in `vitest.config.ts`. This is an addition to a root config file; nothing is removed.

- [ ] **Step 6: Run the guard and expect the third test to fail**

Run: `npx vitest run --project unit guards/paths.test.ts`
Expected: the first two tests PASS. The third FAILS: `dashboards/CLAUDE.md` writes the reference path with a leading slash (`/reference/orbit-os-frontend/`) and the build prompts carry several `reference/orbit-os-frontend/assets/...` paths written before the move, at least one of which will not resolve.

- [ ] **Step 7: Fix every path the guard names**

Edit `ORBIT-OS_Claude_Code_Build_Prompts.md` and `dashboards/CLAUDE.md` so every path the guard reports resolves. Known cases: the leading slash in the dashboards rules, and in the build prompts `reference/orbit-os-frontend/assets/data/jobs.js`, `assets/data/mcps.js`, `assets/config.js`, `assets/tokens.css`, `assets/data/org.js`, `assets/data/fleet.js` and `reference/orbit-os-frontend/org-admin/screens/setup.js`. Do not change their meaning. Only make the paths correct.

- [ ] **Step 8: Run the guard, typecheck and the whole suite**

Run:
```bash
npx vitest run --project unit guards/paths.test.ts
pnpm typecheck
pnpm test:unit
```
Expected: all three guard tests PASS, typecheck clean, and every pre-existing unit test still passes. If a previously passing test now fails, stop and report: that is a freeze violation.

- [ ] **Step 9: Commit**

```bash
git add .gitignore tsconfig.json vitest.config.ts guards/paths.test.ts ORBIT-OS_Claude_Code_Build_Prompts.md dashboards/CLAUDE.md
git commit -F - <<'EOF'
chore(reference): ignore the duplicates and prove the moved paths resolve

The two xlsx reports are generated rather than authored, and the zip is a
second copy of the prototype tree, so all three are ignored. The single-copy
rule now cannot be broken by an accidental `git add`.

reference/ is excluded from typecheck for the reason given when it was
moved: it is a prototype, not code we own.

A guard test replaces the promise that the move left no stale paths. It
follows every reference/orbit-os-frontend path written in the build prompts
and the dashboards rules and checks the file is really there, and it fails
if the old nested folder is named by anything an executor follows.
EOF
```

> **Corrected 2026-10-06.** This message previously ended "Several were wrong
> and are fixed in this commit", which the Task 1 implementer used verbatim as
> instructed and then flagged as untrue: every path resolved on the first run and
> no document was edited. The sentence is removed here so the error is not
> reproduced. Commit `f382081` carries the old wording; `git --amend` is refused
> by this environment's command gate, and the harness prefers a new commit to an
> amend, so the record of the discrepancy lives in the ledger and in this note
> rather than in a rewritten message.
>
> Two further corrections the implementer found, both folded into the step 5 code
> above: paths are normalised to forward slashes before matching, because the
> directory walk returns backslashes on Windows; and the second test skips only
> the guard's own file plus five named history-recording documents, with
> `ORBIT-OS_Claude_Code_Build_Prompts.md` and `dashboards/CLAUDE.md` deliberately
> kept in scope.

---

## Task 2: Rules files and the governance documents

**Files:**
- Create: `CLAUDE.md`
- Modify: `dashboards/CLAUDE.md`
- Create: `docs/rules/engine.md`
- Create: `docs/decisions.md`
- Create: `docs/security/threat-model-engine.md`
- Create: `docs/security/threat-model-gateway.md`
- Create: `docs/security/keys.md`
- Test: `guards/rules.test.ts`, `guards/standing-rules.test.ts`

**Interfaces:**
- Consumes: `dashboards/CLAUDE.md` and the `reference/` path from Task 1.
- Produces: `docs/decisions.md` with the heading format `## <ISO date> — <decision>` that every later task appends to.

- [ ] **Step 1: Write the failing rules guard**

Create `guards/rules.test.ts`:

```ts
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from 'vitest';

const ROOT = new URL('../', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8');

const FRONTEND_ONLY = [/frontend only/i, /no backend/i, /no database/i, /MockApiClient/];

test('the root rules file holds no frontend-only rule, which would gate the engine stream', () => {
  const root = read('CLAUDE.md');
  const found = FRONTEND_ONLY.filter((r) => r.test(root)).map(String);
  expect(found).toEqual([]);
});

test('the frontend-only rule does live in the dashboards rules file', () => {
  const dash = read('dashboards/CLAUDE.md');
  for (const rule of FRONTEND_ONLY) expect(dash).toMatch(rule);
});

test('the engine rules file requires a threat model before code', () => {
  const engine = read('docs/rules/engine.md');
  expect(engine).toMatch(/threat model/i);
  expect(engine).toMatch(/before (any )?code/i);
});

const THREATS = [
  /prompt injection/i,
  /tool it was not granted/i,
  /bypass(es)? the Action Gateway/i,
  /secret leakage/i,
  /one office read/i,
];

test.each(['docs/security/threat-model-engine.md', 'docs/security/threat-model-gateway.md'])(
  '%s names all five threats and the four things each one needs',
  (path) => {
    const text = read(path);
    for (const threat of THREATS) expect(text).toMatch(threat);
    for (const part of [/attack/i, /control/i, /test that proves/i, /when the control fails/i]) {
      expect(text).toMatch(part);
    }
  },
);

test('no governance document promises a date for a checkpoint', () => {
  for (const p of ['CLAUDE.md', 'docs/rules/engine.md', 'docs/decisions.md']) {
    expect(read(p), p).not.toMatch(/\bweek \d/i);
  }
});

test('the key inventory records what TYPESAFE_API_KEY actually is', () => {
  const keys = read('docs/security/keys.md');
  expect(keys).toMatch(/TYPESAFE_API_KEY/);
  expect(keys).toMatch(/OpenRouter/i);
});
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `npx vitest run --project unit guards/rules.test.ts`
Expected: FAIL with `ENOENT` on `CLAUDE.md`, because none of the files exist yet.

- [ ] **Step 3: Write the root `CLAUDE.md`**

Only rules true everywhere. Required sections, in this order:

1. **What this repo is.** Orbitcrew, the AI office, in one paragraph. `docs/prd/ORBIT_OS_PRD_v8_0.md` is the source of truth. ORBIT-OS is the internal name, Orbitcrew the customer-facing one.
2. **Ask first.** Any decision affecting security, money, customer data or the product definition goes to the founder. Quality and security before speed.
3. **Scoped rules live elsewhere.** A table pointing at `dashboards/CLAUDE.md` (the web app) and `docs/rules/engine.md` (engine and gateway), with one line saying the frontend-only rule must never be written in this file because it would gate the engine stream.
4. **The freeze.** The seven frozen directories; no new features and no deletions in them; every existing test keeps running and passing. `guards/freeze.test.ts` enforces it.
5. **Naming.** Customers never see Paperclip, Hermes, OpenClaw or MCP. Say agents, teammates, tools, office. Runtime ids and adapter names appear only in the Super Admin Office view.
6. **Secrets.** This project's own `.env`, never committed, `.env.example` checked in. **Never read from or write to any shared or cross-project env file.** Keys scoped to this project and rotatable. Never log or store a secret. The inventory is `docs/security/keys.md`. Enforced by `guards/standing-rules.test.ts`.
6a. **No real data until the gate opens.** No live inbox, real mailbox or real customer data in **any** environment until the Action Gateway, the audit log and budget pausing all exist and pass their tests. Until then, a dedicated test mailbox and test accounts only. **The founder decides when that condition is met, not the code.** Enforced by `guards/standing-rules.test.ts`.
7. **Done.** The checklist from section 8 of the spec, as a list of commands. Every code diff also gets a security review in a fresh session that reads only the diff; docs-only commits are exempt.
8. **Branches and review.** Code goes on a branch, opens as a pull request, and is merged by the founder after the Done checks pass. Docs-only commits may go to `main`.
9. **Decisions.** Every decision is appended to `docs/decisions.md` with its reason and its cost if wrong.
10. **Plain language.** Short sentences, no jargon, no em dashes, no exclamation marks. Empty states say what to do next.

- [ ] **Step 4: Rescope `dashboards/CLAUDE.md`**

Keep every frontend rule it already has: frontend only, no backend, no database; all data through one typed `ApiClient` with a `MockApiClient` now and an `HttpApiClient` as a one-file swap; screens never touch storage or `fetch`; Zod at every form and boundary; guardrails outrank instructions and users can read but never edit them; the org chart is a strict tree; access and authority are separate; accessibility is not optional; plain language; no dead buttons, no lorem ipsum, no `any`.

Make these edits:

- Add one line at the top: this file governs `dashboards/` only, and nothing in it applies to the engine or gateway.
- Point its "Reference implementation" paths at `reference/orbit-os-frontend/` with no leading slash.
- Change its entry-file table to `dashboards/` paths rather than the prototype's.
- Delete its rule 11 about secrets and its "Working agreement" commit instruction. Both now live at the root, and two copies would drift.
- Add the v8 routes: User gains `#/waiting` and `#/tasks`, Org Admin gains `#/jobs`, Super Admin gains `#/quality` and `#/catalog`.
- Add: Standing Authority screens are feature-flagged off and are UI only.

- [ ] **Step 5: Write `docs/rules/engine.md`**

Required content:

- This file governs `contract/src/experimental/`, the engine, the Action Gateway, the connectors and the worker. The frontend-only rule in `dashboards/CLAUDE.md` does not apply here and must never be used to block work in these areas.
- A threat model is written and reviewed **before any code** in the area it covers: `docs/security/threat-model-engine.md` and `docs/security/threat-model-gateway.md`.
- The Action Gateway's tests are written **before** its code, including the repo-wide scan that proves there is exactly one route out.
- Authorization is enforced server-side on every action. A client-side check is a convenience and is never the control.
- Budgets pause the agent that spent them, and nothing else stops.
- Every action is audit-logged: what, why, by whom, approved by whom, when, at what cost.
- One office can never read another office's data.
- Standing Authority enforcement is blocked pending the founder's decision. Do not design or build it.
- The first real job runs against a dedicated test mailbox and test accounts. No live inbox and no real customer data until the Action Gateway, the audit log and budget pausing are all in place and tested, and the founder has said so.

- [ ] **Step 6: Verify `docs/decisions.md`, which already exists**

**Changed by the v9.0 rebase.** `docs/decisions.md` was created by the rebase commit and already holds fourteen entries, including the four-condition real-data gate, the design-token decision, the replaced rule 3 and the parked roles. This step no longer writes it. It verifies the entries the guards depend on are present and appends anything missing. The format is `## <ISO date> - <decision>` followed by `**Decision:**`, `**Reason:**` and `**Cost if wrong:**`.

The original instruction for this step is kept below for the record, because it describes what those entries must contain:

Format, one block each: `## <ISO date> — <decision>`, then `**Decision:**`, `**Reason:**`, `**Cost if wrong:**`.

1. `2026-10-05 — Orbitcrew is the customer-facing name.` PRD v8.0 open decision 1 closed as answered. ORBIT-OS stays internal.
2. `2026-10-05 — The lead-reply slice is frozen.` No new features, no deletions; it becomes one example job behind the Action Gateway when the engine exists. The old "one real lead end to end" exit criterion is retired: the new proof is the first real job, with OrbitumAI as customer zero.
3. `2026-10-05 — Standing Authority is held at UI-only.` Feature-flagged off, contract surface read-only. Enforcement blocked until the founder answers the one-page decision.
4. `2026-10-05 — Stream A takes a new dashboards/ package, not web/.` Evidence: `web/src/main.ts` imports from frozen `shared/`, and `template/test/compose.test.ts:22` asserts the exact compose service set.
5. `2026-10-05 — The real-data gate.` Status: **open-pending**. No live inbox, real mailbox or real customer data in any environment; a dedicated test mailbox and test accounts only. Three conditions must all be in place **and tested** before real data: the Action Gateway, the audit log, budget pausing. When all three are met the founder is told, and **the founder decides**, not the code. `guards/standing-rules.test.ts` asserts this entry still says `open-pending`, so the gate cannot be closed by a code change alone.
6. `2026-10-05 — The mock bundle scan moves to sub-project 1.` Sub-project 0 ships the import-boundary guard; the bundle scan needs a production build, which does not exist until Stream A has one.

- [ ] **Step 7: Write the two threat-model skeletons and the key inventory**

Each threat model: one line stating what it covers, then one section per threat, each with four labelled parts — the attack, the control, the test that proves the control, and what happens when the control fails. The five threats are prompt injection from an inbound message; an agent using a tool it was not granted; a send that bypasses the Action Gateway; secret leakage; one office reading another office's data. Under each part, one sentence naming the sub-project that completes it. Write no "TBD": the sentence names the owner and the condition, which is information, where "TBD" is not.

`docs/security/keys.md`: a table of every key in `.env.example` with what it actually is, which program holds it, and who rotates it. Include the correction that `TYPESAFE_API_KEY` in `.env.local` is an OpenRouter key, not a TypeSafe console key. Record the two credential deviations already in the repo: `api` holds the Gmail send credentials because the confirm route sends, and `frontdesk` holds the Resend key because it runs the notice job. Both close when the worker takes the queue and the send path.

- [ ] **Step 7a: Write the two standing-rule guards**

These are the founder's own rules, recorded nowhere in this repo before now. Each gets a check so it cannot quietly lapse.

Create `guards/standing-rules.test.ts`:

```ts
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from 'vitest';

const ROOT = new URL('../', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');

function tracked(): string[] {
  return execFileSync('git', ['ls-files'], { cwd: ROOT, encoding: 'utf8' }).split('\n').filter(Boolean);
}

function sources(dir: string, out: string[] = []): string[] {
  let entries: string[];
  try {
    entries = readdirSync(join(ROOT, dir));
  } catch {
    return out;
  }
  for (const entry of entries) {
    if (['node_modules', 'dist', 'generated', 'reference', 'landing', 'archive'].includes(entry)) continue;
    const child = `${dir}/${entry}`;
    if (statSync(join(ROOT, child)).isDirectory()) sources(child, out);
    else if (/\.(ts|tsx|mjs|js|yml|yaml)$/.test(child)) out.push(child);
  }
  return out;
}

// Rule: this project's own env, and no other.

test('no .env file is tracked by git', () => {
  expect(tracked().filter((f) => /(^|\/)\.env($|\.)/.test(f) && !f.endsWith('.env.example'))).toEqual([]);
});

test('.env.example is present and tracked, so a fresh clone knows what it needs', () => {
  expect(existsSync(join(ROOT, '.env.example'))).toBe(true);
  expect(tracked()).toContain('.env.example');
});

test('no code path reads an env file outside this repo', () => {
  const climbing = /['"`][^'"`]*\.\.\/[^'"`]*\.env[^'"`]*['"`]|['"`](?:[A-Za-z]:)?[\\/][^'"`]*\.env[^'"`]*['"`]/;
  const offenders = ['scripts', 'ops', 'guards', 'contract', 'dashboards', 'api', 'frontdesk', 'worker', 'web', 'shared', 'db', 'template']
    .flatMap((d) => sources(d))
    .filter((f) => climbing.test(readFileSync(join(ROOT, f), 'utf8')));
  expect(offenders).toEqual([]);
});

// Rule: no real data until the gate opens.

test('the real-data gate is recorded with all four conditions, and recorded as not yet met', () => {
  const decisions = readFileSync(join(ROOT, 'docs/decisions.md'), 'utf8');
  expect(decisions).toMatch(/real-data gate/i);
  expect(decisions).toMatch(/dedicated test mailbox/i);
  expect(decisions).toMatch(/the founder decides/i);
  expect(decisions).toMatch(/open-pending/i);
  // PRD v9.0 section 14.3. Three conditions is the v8.0 count and is wrong.
  for (const condition of [/Action Gateway/i, /audit log/i, /budget pausing/i, /no-training/i]) {
    expect(decisions, String(condition)).toMatch(condition);
  }
});

test('the gate fails closed: the Anthropic attestation does not yet exist', () => {
  const attestation = join(ROOT, 'docs/gates/anthropic-terms.md');
  if (!existsSync(attestation)) return; // absent is the expected state, and the gate holds

  // Present means someone is asserting the terms are signed. Then it must say
  // who, when and where, or it is not an attestation and the gate must not open.
  const text = readFileSync(attestation, 'utf8');
  for (const required of [/confirmed by/i, /date/i, /signed document/i]) {
    expect(text, String(required)).toMatch(required);
  }
});

test('no tracked configuration names a mailbox that is not a test mailbox', () => {
  const offenders: string[] = [];
  for (const file of ['.env.example', 'compose.dev.yml', 'template/compose.yml']) {
    if (!existsSync(join(ROOT, file))) continue;
    for (const match of readFileSync(join(ROOT, file), 'utf8').matchAll(/[\w.+-]+@[\w.-]+\.\w+/g)) {
      const address = match[0];
      if (!/test|example|invalid|localhost/i.test(address)) offenders.push(`${file}: ${address}`);
    }
  }
  expect(offenders).toEqual([]);
});
```

- [ ] **Step 7b: Run the standing-rule guards and prove each fails when its rule is broken**

Run: `npx vitest run --project unit guards/standing-rules.test.ts`
Expected: 5 passed.

Then break each rule on purpose and confirm the guard catches it:

```bash
printf "SECRET=x\n" > .env && git add -f .env
npx vitest run --project unit guards/standing-rules.test.ts
git rm --cached .env && rm .env
```

Expected: FAIL on the tracked `.env` test, then PASS once removed.

```bash
node -e "const f='docs/decisions.md';const fs=require('fs');fs.writeFileSync(f,fs.readFileSync(f,'utf8').replace(/open-pending/g,'met'))"
npx vitest run --project unit guards/standing-rules.test.ts
git checkout docs/decisions.md
```

Expected: FAIL on the gate test, then PASS once restored.

- [ ] **Step 8: Run the guards and the suite**

Run:
```bash
npx vitest run --project unit guards/rules.test.ts guards/standing-rules.test.ts
pnpm test:unit
pnpm typecheck
```
Expected: every guard test PASSES, the existing suite still passes, typecheck clean.

- [ ] **Step 9: Commit**

```bash
git add CLAUDE.md dashboards/CLAUDE.md docs/rules/engine.md docs/decisions.md docs/security/ guards/rules.test.ts guards/standing-rules.test.ts
git commit -F - <<'EOF'
docs(rules): split the rules by scope and start the decision log

Three rules files instead of one. The root holds what is true everywhere:
ask first on security, money, customer data and the product definition;
the freeze; naming; secrets; Done; branches; plain language. The
frontend-only rule stays in dashboards/CLAUDE.md, and the engine and
gateway get docs/rules/engine.md, which carries the requirement that a
threat model is written before any code it covers.

A guard test enforces the split rather than trusting it. The root file is
checked for the frontend-only phrases, because a later edit that moved them
up would gate the engine stream on its first command and the symptom would
look like an unrelated refusal.

The decision log opens with the six decisions already taken, each with its
reason and its cost if wrong, so the reasoning survives the people who were
in the room. The two threat models exist as skeletons with their five
threats named; the sub-projects that own them fill them in before writing
code.

The key inventory records what each key is rather than what its name
suggests: TYPESAFE_API_KEY holds an OpenRouter key.
EOF
```

---

## Task 3: `pnpm lint`

**Files:**
- Create: `eslint.config.js`
- Modify: `package.json` (add the `lint` script)
- Test: `guards/lint-config.test.ts`

**Interfaces:**
- Consumes: the `reference/` exclusion from Task 1.
- Produces: `pnpm lint`, used by the CI workflow in Task 10 and by the Done checklist.

- [ ] **Step 1: Install ESLint and the plugins, pinned**

```bash
pnpm add -D -E -w eslint @eslint/js typescript-eslint eslint-plugin-react eslint-plugin-react-hooks eslint-plugin-jsx-a11y
```

Record the resolved versions in the commit message.

- [ ] **Step 2: Write the failing lint-config guard**

Create `guards/lint-config.test.ts`:

```ts
import { expect, test } from 'vitest';

type Block = { ignores?: string[]; rules?: Record<string, unknown> };

async function blocks(): Promise<Block[]> {
  const { default: config } = (await import('../eslint.config.js')) as { default: Block[] };
  return config;
}

test('the lint config does not ignore the code the Done checklist depends on', async () => {
  const ignores = (await blocks()).flatMap((b) => b.ignores ?? []);
  for (const must of ['dashboards/', 'contract/', 'guards/']) {
    expect(
      ignores.some((i) => i.startsWith(must)),
      `${must} is ignored, so the lint row would be green without reading it`,
    ).toBe(false);
  }
});

test('the lint config does ignore the prototype and the vendored trees', async () => {
  const ignores = (await blocks()).flatMap((b) => b.ignores ?? []);
  for (const must of ['reference/**', 'landing/**', 'archive/**', '**/node_modules/**', '**/generated/**']) {
    expect(ignores, must).toContain(must);
  }
});

test('react/no-danger is configured as an error', async () => {
  const rules = Object.assign({}, ...(await blocks()).map((b) => b.rules ?? {}));
  expect(rules['react/no-danger']).toBe('error');
});
```

- [ ] **Step 3: Run it to make sure it fails**

Run: `npx vitest run --project unit guards/lint-config.test.ts`
Expected: FAIL, cannot resolve `../eslint.config.js`.

- [ ] **Step 4: Write `eslint.config.js`**

```js
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import jsxA11y from 'eslint-plugin-jsx-a11y';

export default [
  {
    ignores: [
      'reference/**',
      'landing/**',
      'archive/**',
      '**/node_modules/**',
      '**/generated/**',
      '**/dist/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    plugins: { react, 'react-hooks': reactHooks, 'jsx-a11y': jsxA11y },
    settings: { react: { version: 'detect' } },
    rules: {
      'react/no-danger': 'error',
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/consistent-type-imports': 'error',
      'no-console': ['error', { allow: ['warn', 'error'] }],
    },
  },
];
```

Add to `package.json` scripts: `"lint": "eslint ."`

- [ ] **Step 5: Run the guard to verify it passes**

Run: `npx vitest run --project unit guards/lint-config.test.ts`
Expected: 3 passed.

- [ ] **Step 6: Run lint across the repo and report before fixing anything**

Run: `pnpm lint`

This will report findings inside the frozen directories. **Do not fix them.** Group the counts:

```bash
pnpm lint --format json > /tmp/lint.json 2>/dev/null || true
node -e "const r=require('/tmp/lint.json');const by={};for(const f of r){if(!f.errorCount&&!f.warningCount)continue;const d=f.filePath.split(/[\\\\/]/).find(p=>['frontdesk','api','db','shared','template','ops','design','contract','guards','dashboards','scripts','web','worker'].includes(p))??'root';by[d]=(by[d]??0)+f.errorCount+f.warningCount;}console.log(by)"
```

**Report only. Change nothing in the frozen directories.** The founder has ruled: record the per-directory counts in `docs/decisions.md` and continue. A lint fix in frozen code needs their explicit approval, case by case, and never as part of another task. So this step does not stop and does not wait.

Append to `docs/decisions.md`:

```markdown
## 2026-10-05 — Lint findings in the frozen packages are recorded, not fixed

**Decision:** `pnpm lint` reports the counts below inside the frozen packages. None are fixed. A lint fix in frozen code needs the founder's explicit approval, case by case, and never as part of another task.

**Counts at the time the linter was added:** <the per-directory output of the command above>

**Reason:** a lint fix is still a change to frozen code. The freeze exists because 44 merged commits and 442 tests depend on that code behaving exactly as it does, and a reformat that looks harmless is still a diff nobody asked for.

**Cost if wrong:** the frozen packages carry style findings for the life of the project, visible in every lint run and ignored by everyone.
```

Findings in `guards/`, `contract/`, `dashboards/`, `scripts/` and root files are not frozen: fix those in this task.

- [ ] **Step 7: Commit**

```bash
git add eslint.config.js package.json pnpm-lock.yaml guards/lint-config.test.ts docs/decisions.md
git commit -F - <<'EOF'
build(lint): add pnpm lint, with a guard on its own ignore list

The Done checklist has a lint row and there was no linter, so the row could
not be true. This adds ESLint 9 flat config with typescript-eslint and the
React, hooks and jsx-a11y plugins the dashboards will need.

react/no-danger is an error. The dashboards render instructions, guardrail
text and job summaries that originate outside the office, and
dangerouslySetInnerHTML is the one call that turns that text into markup.

A guard test checks the linter's own ignore list, because a linter that
passes by ignoring the code it was added to check is worse than no linter:
the checklist shows a green row for work nobody examined. The test fails if
dashboards/, contract/ or guards/ is ever ignored, and fails if the
prototype is not.

Findings inside the frozen directories are reported to the founder rather
than fixed. A lint fix there is still a change to frozen code.
EOF
```

---

## Task 4: `pnpm e2e`

**Files:**
- Create: `playwright.config.ts`
- Create: `e2e/axe.ts`
- Create: `e2e/harness.spec.ts`
- Create: `e2e/fixture/index.html`
- Modify: `package.json` (add the `e2e` script)

**Interfaces:**
- Consumes: nothing.
- Produces: `pnpm e2e`, and `expectNoSeriousViolations(page)` exported from `e2e/axe.ts`, which Stream A's specs import.

- [ ] **Step 1: Install Playwright and axe, pinned**

```bash
pnpm add -D -E -w @playwright/test @axe-core/playwright http-server
pnpm exec playwright install --with-deps chromium
```

- [ ] **Step 2: Write the fixture page with one deliberate defect**

Create `e2e/fixture/index.html`. Its only purpose is to prove the browser and axe actually run. It carries one real, named defect so a passing axe run cannot be a false green.

```html
<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><title>Harness fixture</title></head>
<body>
<h1>Harness fixture</h1>
<p id="ok">This page exists to prove the browser and axe both run.</p>
<img id="defect" src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7">
</body>
</html>
```

The `img` has no `alt`, which axe reports as a serious `image-alt` violation.

- [ ] **Step 3: Write the axe helper and the failing harness spec**

Create `e2e/axe.ts`:

```ts
import AxeBuilder from '@axe-core/playwright';
import { expect } from '@playwright/test';
import type { Page } from '@playwright/test';

export async function axeViolations(page: Page) {
  const { violations } = await new AxeBuilder({ page }).analyze();
  return violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
}

export async function expectNoSeriousViolations(page: Page) {
  const found = await axeViolations(page);
  expect(found.map((v) => `${v.id}: ${v.nodes.length} node(s)`)).toEqual([]);
}
```

Create `e2e/harness.spec.ts`:

```ts
import { expect, test } from '@playwright/test';
import { axeViolations, expectNoSeriousViolations } from './axe';

test('a browser really loads a page in this environment', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#ok')).toHaveText(/prove the browser and axe both run/);
});

test('axe really runs and really reports a known defect', async ({ page }) => {
  await page.goto('/');
  const found = await axeViolations(page);
  expect(found.map((v) => v.id)).toContain('image-alt');
});

test('expectNoSeriousViolations passes once the known defect is removed', async ({ page }) => {
  await page.goto('/');
  await page.locator('#defect').evaluate((node) => node.remove());
  await expectNoSeriousViolations(page);
});
```

- [ ] **Step 4: Run it to make sure it fails**

Run: `npx playwright test`
Expected: FAIL, no `playwright.config.ts` so there is no base URL and no server.

- [ ] **Step 5: Write `playwright.config.ts`**

```ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: { baseURL: 'http://127.0.0.1:4318', trace: 'on-first-retry' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npx http-server e2e/fixture -p 4318 -s',
    url: 'http://127.0.0.1:4318',
    reuseExistingServer: !process.env.CI,
  },
});
```

Add to `package.json` scripts: `"e2e": "playwright test"`

When Stream A has a dev server, `webServer.command` changes to it and the fixture becomes its own Playwright project so the harness check survives.

- [ ] **Step 6: Run the tests to verify they pass**

Run: `pnpm e2e`
Expected: 3 passed.

- [ ] **Step 7: Commit**

```bash
git add playwright.config.ts e2e/ package.json pnpm-lock.yaml
git commit -F - <<'EOF'
build(e2e): add pnpm e2e with an accessibility harness that proves itself

The Done checklist has an end-to-end row and an accessibility row, and
neither had a command behind it. There are no screens yet, so the obvious
move is an empty Playwright run, which reports green while proving nothing:
the row would stay green through a CI image that cannot launch a browser at
all.

Instead the harness tests itself against a fixture page carrying one known
serious defect, an image with no alt text. One test proves a browser loads a
page here, one proves axe finds that defect, and one proves the shared
helper goes quiet once the defect is removed. If the browser or axe stops
working in CI, these fail rather than passing vacuously.

The helper expectNoSeriousViolations is what the dashboards' own specs will
call, so accessibility runs with each phase rather than once at the end.
EOF
```

---

## Task 5: The lead-reply freeze guard

**Files:**
- Create: `guards/freeze.test.ts`
- Create: `guards/freeze-baseline.json`

**Interfaces:**
- Consumes: `vitest.config.ts`'s `unit` and `db` project definitions.
- Produces: `guards/freeze-baseline.json`, shape `{ "recordedAt": string, "testFiles": string[], "unitTestCount": number }`.

- [ ] **Step 1: Record the baseline**

```bash
npx vitest list --project unit > /tmp/unit.txt
npx vitest list --project unit --filesOnly > /tmp/unitfiles.txt
npx vitest list --project db --filesOnly > /tmp/dbfiles.txt
wc -l /tmp/unit.txt /tmp/unitfiles.txt /tmp/dbfiles.txt
```

When this plan was written those were 239 collected unit tests, 25 unit test files and 21 db test files. **Re-measure rather than trusting those numbers.** Write `guards/freeze-baseline.json` from the measurement: `recordedAt` today's ISO date, `testFiles` the sorted union of the two `--filesOnly` lists restricted to the seven frozen directories, `unitTestCount` the collected count.

- [ ] **Step 2: Write the failing freeze guard**

Create `guards/freeze.test.ts`:

```ts
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from 'vitest';

const ROOT = new URL('../', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const FROZEN = ['frontdesk', 'api', 'db', 'shared', 'template', 'ops', 'design'];
const baseline = JSON.parse(readFileSync(join(ROOT, 'guards/freeze-baseline.json'), 'utf8')) as {
  recordedAt: string;
  testFiles: string[];
  unitTestCount: number;
};

function testFilesUnder(dir: string, out: string[] = []): string[] {
  const full = join(ROOT, dir);
  if (!existsSync(full)) return out;
  for (const entry of readdirSync(full)) {
    if (entry === 'node_modules' || entry === 'generated') continue;
    const child = `${dir}/${entry}`;
    if (statSync(join(ROOT, child)).isDirectory()) testFilesUnder(child, out);
    else if (child.endsWith('.test.ts')) out.push(child);
  }
  return out;
}

test('no frozen test is skipped, isolated or turned into a todo', () => {
  const offenders: string[] = [];
  for (const dir of FROZEN) {
    for (const file of testFilesUnder(dir)) {
      const text = readFileSync(join(ROOT, file), 'utf8');
      for (const bad of [/\b(test|it|describe)\.skip\b/, /\b(test|it|describe)\.only\b/, /\b(test|it)\.todo\b/]) {
        if (bad.test(text)) offenders.push(`${file}: ${String(bad)}`);
      }
    }
  }
  expect(offenders).toEqual([]);
});

test('no frozen test file has been deleted since the freeze', () => {
  const present = new Set(FROZEN.flatMap((d) => testFilesUnder(d)));
  const missing = baseline.testFiles.filter((f) => !present.has(f));
  expect(missing).toEqual([]);
});

test('the single route to Gmail is still proven by a collected test', () => {
  const guard = 'template/test/no-unapproved-send.test.ts';
  expect(existsSync(join(ROOT, guard))).toBe(true);
  expect(readFileSync(join(ROOT, 'vitest.config.ts'), 'utf8')).toContain(guard);
});
```

- [ ] **Step 3: Run it to make sure it fails, then passes**

Run: `npx vitest run --project unit guards/freeze.test.ts`
Expected: before `guards/freeze-baseline.json` exists, FAIL with `ENOENT`. After Step 1 wrote it, all three PASS.

- [ ] **Step 4: Prove the guard catches a weakened test (spec acceptance item 7)**

```bash
cp template/test/no-unapproved-send.test.ts /tmp/guarded.bak
node -e "const f='template/test/no-unapproved-send.test.ts';const fs=require('fs');fs.writeFileSync(f,fs.readFileSync(f,'utf8').replace(/^test\(/m,'test.skip('))"
npx vitest run --project unit guards/freeze.test.ts
```

Expected: FAIL, naming `template/test/no-unapproved-send.test.ts`. Then restore and confirm byte-identical:

```bash
cp /tmp/guarded.bak template/test/no-unapproved-send.test.ts
git diff --exit-code template/test/no-unapproved-send.test.ts && echo "restored clean"
npx vitest run --project unit guards/freeze.test.ts
```

Expected: `restored clean`, then PASS.

Repeat for deletion, which the first test cannot catch:

```bash
git mv template/test/compose.test.ts /tmp/compose.test.ts
npx vitest run --project unit guards/freeze.test.ts
```

Expected: FAIL, naming `template/test/compose.test.ts`. Then:

```bash
git mv /tmp/compose.test.ts template/test/compose.test.ts
git status --porcelain template/ | wc -l
npx vitest run --project unit guards/freeze.test.ts
```

Expected: `0`, then PASS.

- [ ] **Step 5: Run the whole suite and commit**

Run: `pnpm test:unit && pnpm typecheck`
Expected: all pass, and the collected unit count is at or above `unitTestCount`.

```bash
git add guards/freeze.test.ts guards/freeze-baseline.json
git commit -F - <<'EOF'
test(guard): make the lead-reply freeze a check instead of a promise

The slice that replies to a sales lead is frozen: no new features, no
deletions, and every test it has keeps running for the life of the project.
A promise like that decays quietly. A test skipped to get a build green
looks identical to a test that passes, and a deleted test file looks like
nothing at all.

Three checks, because there are three ways to weaken a suite. One scans the
seven frozen directories for .skip, .only and .todo. One compares the test
files present against a recorded baseline, which is the only one of the
three that catches deletion. One asserts the scan proving there is exactly
one route to Gmail still exists and is still collected by vitest.config.ts,
since dropping it from the include list would disarm it while leaving the
file in place.

The guard was verified by weakening a frozen test on purpose and by moving
one away, confirming it fails both times, then restoring both and checking
the tree came back byte-identical.
EOF
```

---

## Task 6: The `MockApiClient` import-boundary guard

**Files:**
- Create: `guards/mock-boundary.test.ts`

**Interfaces:**
- Consumes: nothing. Runs against whatever exists, and is written before `MockApiClient` does.
- Produces: the rule that `MockApiClient` is reachable only from `dashboards/src/dev/**` or a file ending `.test.ts` or `.test.tsx`.

The bundle scan named in the spec cannot run here: there is no build yet. This task ships the import-boundary half; the bundle half moves to sub-project 1, with the first production build. Decision 6 of `docs/decisions.md` records the split.

- [ ] **Step 1: Write the guard**

Create `guards/mock-boundary.test.ts`:

```ts
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from 'vitest';

const ROOT = new URL('../', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const ALLOWED = [/^dashboards\/src\/dev\//, /\.test\.tsx?$/];
const SEARCHED = ['dashboards', 'contract', 'web', 'worker', 'api', 'frontdesk', 'shared'];

function sources(dir: string, out: string[] = []): string[] {
  let entries: string[];
  try {
    entries = readdirSync(join(ROOT, dir));
  } catch {
    return out;
  }
  for (const entry of entries) {
    if (entry === 'node_modules' || entry === 'dist' || entry === 'generated') continue;
    const child = `${dir}/${entry}`;
    if (statSync(join(ROOT, child)).isDirectory()) sources(child, out);
    else if (/\.(ts|tsx)$/.test(child)) out.push(child);
  }
  return out;
}

function offendersMatching(pattern: RegExp): string[] {
  return SEARCHED.flatMap((d) => sources(d))
    .filter((f) => pattern.test(readFileSync(join(ROOT, f), 'utf8')))
    .filter((f) => !ALLOWED.some((ok) => ok.test(f)));
}

test('MockApiClient is named only by dev-only code and tests', () => {
  expect(offendersMatching(/MockApiClient/)).toEqual([]);
});

test('the demo office seed is not reachable from a non-dev path', () => {
  expect(offendersMatching(/BrightPath Advisors/)).toEqual([]);
});
```

- [ ] **Step 2: Run it**

Run: `npx vitest run --project unit guards/mock-boundary.test.ts`
Expected: both PASS, vacuously, because neither `MockApiClient` nor the demo office name exists yet. That is the point: the guard is armed before the code it guards arrives, so the first import that breaks the rule fails on the commit that introduces it.

- [ ] **Step 3: Prove it is not vacuous**

```bash
mkdir -p dashboards/src
printf "export const x = 'MockApiClient';\n" > dashboards/src/scratch.ts
npx vitest run --project unit guards/mock-boundary.test.ts
```

Expected: FAIL, naming `dashboards/src/scratch.ts`. Then:

```bash
rm dashboards/src/scratch.ts
npx vitest run --project unit guards/mock-boundary.test.ts
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add guards/mock-boundary.test.ts
git commit -F - <<'EOF'
test(guard): keep the mock client and its seed data out of real paths

The dashboards are finished against a mock while the engine is still being
built, which means a mock holding a demo office, five invented people and
nine invented agents sits in the repo for the whole project. Shipping it is
a real risk: a customer seeing BrightPath Advisors inside their own office
would reasonably conclude their data had been mixed with someone else's.

This guard names where the mock may be reached from: dev-only code and
tests. It is written before MockApiClient exists, so the first import from
anywhere else fails on the commit that adds it, which is the only moment
the fix is cheap.

The bundle scan the spec also calls for cannot run yet, because there is no
production build to scan. It moves to sub-project 1 with the first build,
and the split is recorded as decision 6.
EOF
```

---

## Task 7: `contract/` package and the stable dashboard layer

**Files:**
- Create: `contract/package.json`
- Create: `contract/src/v1/common.ts`, `org.ts`, `teammates.ts`, `tools.ts`, `launch.ts`, `requests.ts`, `fleet.ts`, `index.ts`
- Modify: `pnpm-workspace.yaml` (add `contract`)
- Modify: `vitest.config.ts` (add `contract/**/*.test.ts` to the `unit` include)
- Test: `contract/src/v1/org.test.ts`, `contract/src/v1/teammates.test.ts`, plus one test file per remaining module

**Interfaces:**
- Consumes: nothing.
- Produces: `PersonSchema`, `DepartmentSchema`, `OfficeSchema`, `LaunchJobSchema`, `TeammateSchema`, `OrgChartSchema`, `ConnectionSchema`, `ToolSchema`, `AgentRequestSchema`, `FleetOfficeSchema`, and the inferred types `Person`, `Department`, `Office`, `LaunchJob`, `Teammate`, `Connection`, `Tool`, `AgentRequest`, `FleetOffice`. Tasks 8 and 9 import from `@orbit/contract/v1`.

- [ ] **Step 1: Create the package and install Zod, pinned**

```bash
mkdir -p contract/src/v1
```

`contract/package.json`:

```json
{
  "name": "@orbit/contract",
  "private": true,
  "type": "module",
  "exports": {
    "./v1": "./src/v1/index.ts",
    "./experimental": "./src/experimental/index.ts",
    "./client": "./src/client.ts"
  }
}
```

Add `contract` to the `packages` list in `pnpm-workspace.yaml`, then:

```bash
pnpm add -E zod --filter @orbit/contract
```

That writes the resolved exact version into `contract/package.json` itself, so no version is hand-typed. Add `'contract/**/*.test.ts'` to the `unit` project's `include` in `vitest.config.ts`.

- [ ] **Step 2: Write the failing org schema test**

Create `contract/src/v1/org.test.ts`:

```ts
import { expect, test } from 'vitest';
import { DepartmentSchema, OfficeSchema, PersonSchema } from './org.ts';

const person = {
  id: 'p1',
  name: 'Maria Santos',
  email: 'maria@brightpath.example',
  title: 'Managing Partner',
  deptId: 'd1',
  access: 'admin' as const,
  authorities: ['leader' as const],
};

test('a person needs a name and a valid email', () => {
  expect(PersonSchema.parse(person).email).toBe('maria@brightpath.example');
  expect(PersonSchema.safeParse({ ...person, email: 'not-an-email' }).success).toBe(false);
  expect(PersonSchema.safeParse({ ...person, name: '' }).success).toBe(false);
});

test('an email is stored lowercased and trimmed, so one person is one person', () => {
  expect(PersonSchema.parse({ ...person, email: '  Maria@BrightPath.example ' }).email).toBe(
    'maria@brightpath.example',
  );
});

test('access is one of two values and authority is a separate list', () => {
  expect(PersonSchema.safeParse({ ...person, access: 'leader' }).success).toBe(false);
  expect(PersonSchema.parse({ ...person, authorities: ['leader', 'approver', 'budget'] }).authorities).toHaveLength(3);
  expect(PersonSchema.safeParse({ ...person, authorities: ['admin'] }).success).toBe(false);
});

test('a department needs a name that is not only whitespace', () => {
  expect(DepartmentSchema.parse({ id: 'd1', name: 'Operations' }).name).toBe('Operations');
  expect(DepartmentSchema.safeParse({ id: 'd1', name: '  ' }).success).toBe(false);
});

test('an office carries its onboarding step, and only the five real steps', () => {
  const office = {
    name: 'BrightPath Advisors',
    domain: 'brightpath.example',
    template: 'services',
    step: 3 as const,
    launched: false,
    connectLater: false,
    guardrails: ['Never send to a customer without approval'],
    job: null,
  };
  expect(OfficeSchema.parse(office).step).toBe(3);
  expect(OfficeSchema.safeParse({ ...office, step: 6 }).success).toBe(false);
  expect(OfficeSchema.safeParse({ ...office, step: 0 }).success).toBe(false);
});
```

- [ ] **Step 3: Run it to make sure it fails**

Run: `npx vitest run --project unit contract/src/v1/org.test.ts`
Expected: FAIL, cannot resolve `./org.ts`.

- [ ] **Step 4: Write `common.ts` and `org.ts`**

`contract/src/v1/common.ts`:

```ts
import { z } from 'zod';

export const Id = z.string().min(1);
export const NonEmpty = z.string().trim().min(1);
export const Email = z.string().trim().toLowerCase().email();
export const Timestamp = z.number().int().nonnegative();
export const Usd = z.number().finite().nonnegative();
```

`contract/src/v1/org.ts`:

```ts
import { z } from 'zod';
import { Email, Id, NonEmpty } from './common.ts';

/** PRD v9.0 §7.1. One access role per person per office: the sign-in level. */
export const AccessSchema = z.enum(['user', 'admin']);

/**
 * PRD v9.0 §7.2. Authorities are separate from the access role, and a person may
 * hold none, one or several. `backup` is Backup approver, restored as a named
 * authority in v9.0: v8.0 named it only inside an escalation rule, which is why
 * it was missing from the first draft of this schema.
 */
export const AuthoritySchema = z.enum(['leader', 'approver', 'backup', 'budget']);

export const PersonSchema = z.object({
  id: Id,
  name: NonEmpty,
  email: Email,
  title: z.string().trim(),
  deptId: Id.nullable(),
  access: AccessSchema,
  authorities: z.array(AuthoritySchema),
  invited: z.boolean().optional(),
});

/**
 * PRD v9.0 §7.3: each department has a default Approver and an escalation path,
 * and each job belongs to exactly one department. Escalation defaults are in
 * Appendix A.8 and are editable per job.
 */
export const DepartmentSchema = z.object({
  id: Id,
  name: NonEmpty,
  defaultApproverId: Id.nullable(),
  escalation: z.array(Id),
});

export const LaunchStepSchema = z.object({
  k: NonEmpty,
  label: NonEmpty,
  status: z.enum(['pending', 'run', 'done', 'fail']),
});

export const LaunchJobSchema = z.object({
  steps: z.array(LaunchStepSchema).min(1),
  simFail: z.boolean(),
  failedOnce: z.boolean(),
  error: z.string(),
  done: z.boolean(),
});

export const OfficeSchema = z.object({
  name: NonEmpty,
  domain: NonEmpty,
  template: z.string().nullable(),
  step: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]),
  launched: z.boolean(),
  connectLater: z.boolean(),
  guardrails: z.array(NonEmpty),
  job: LaunchJobSchema.nullable(),
});

export type Access = z.infer<typeof AccessSchema>;
export type Authority = z.infer<typeof AuthoritySchema>;
export type Person = z.infer<typeof PersonSchema>;
export type Department = z.infer<typeof DepartmentSchema>;
export type LaunchStep = z.infer<typeof LaunchStepSchema>;
export type LaunchJob = z.infer<typeof LaunchJobSchema>;
export type Office = z.infer<typeof OfficeSchema>;
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run --project unit contract/src/v1/org.test.ts`
Expected: 5 passed.

- [ ] **Step 6: Write the failing teammate test, including the two tree rules**

Create `contract/src/v1/teammates.test.ts`:

```ts
import { expect, test } from 'vitest';
import { OrgChartSchema, TeammateSchema } from './teammates.ts';

// Names come from PRD v9.0 Appendix A.1, never from the prototype. The
// Coordinator is Orbi, exactly one per office, never removable, not hired.
const base = {
  id: 'a1',
  jobId: 'orbi',
  name: 'Orbi',
  job: 'Runs the office and hands work out',
  type: 'coordinator' as const,
  deptId: null,
  managerId: null,
  ownerId: 'p1',
  status: 'idle' as const,
  doing: '',
  prompt: 'You coordinate the office and hand work to the right teammate.',
  version: 1,
  versions: [],
  guardrails: [],
  tools: ['email'],
  budget: { monthlyUsd: 50, dailyCheapCalls: 200, turnLimit: 12 },
  dataBoundary: [],
  assignment: { deptId: null, teamId: null, personIds: [] },
  runsToday: 0,
  costToday: 0,
  lastActive: 0,
  provisioned: false,
};

test('instructions under 20 characters are refused', () => {
  expect(TeammateSchema.safeParse({ ...base, prompt: 'too short' }).success).toBe(false);
});

test('a budget is three numbers, and each one must be above zero (Appendix A.5)', () => {
  expect(TeammateSchema.parse(base).budget).toEqual({ monthlyUsd: 50, dailyCheapCalls: 200, turnLimit: 12 });
  for (const bad of [
    { monthlyUsd: 0, dailyCheapCalls: 200, turnLimit: 12 },
    { monthlyUsd: 50, dailyCheapCalls: 0, turnLimit: 12 },
    { monthlyUsd: 50, dailyCheapCalls: 200, turnLimit: 0 },
  ]) {
    expect(TeammateSchema.safeParse({ ...base, budget: bad }).success, JSON.stringify(bad)).toBe(false);
  }
  // A single number cannot express the daily cap or the turn limit, so it is refused.
  expect(TeammateSchema.safeParse({ ...base, budget: 50 }).success).toBe(false);
});

test('a specialist reports to one manager and the coordinator reports to the board', () => {
  expect(TeammateSchema.safeParse({ ...base, type: 'specialist', managerId: null }).success).toBe(false);
  expect(TeammateSchema.safeParse({ ...base, type: 'coordinator', managerId: 'a2' }).success).toBe(false);
});

test('an org chart refuses a second coordinator', () => {
  const two = [base, { ...base, id: 'a2', name: 'Orbi Two' }];
  const problem = OrgChartSchema.safeParse(two);
  expect(problem.success).toBe(false);
  expect(JSON.stringify(problem)).toMatch(/exactly one coordinator/i);
});

test('an org chart refuses a reporting loop', () => {
  const loop = [
    base,
    { ...base, id: 'a2', name: 'Sales Analyst', type: 'specialist' as const, managerId: 'a3' },
    { ...base, id: 'a3', name: 'Finance Clerk', type: 'specialist' as const, managerId: 'a2' },
  ];
  const problem = OrgChartSchema.safeParse(loop);
  expect(problem.success).toBe(false);
  expect(JSON.stringify(problem)).toMatch(/loop/i);
});

test('an org chart refuses two teammates whose names differ only by case', () => {
  const clash = [base, { ...base, id: 'a2', name: 'orbi', type: 'specialist' as const, managerId: 'a1' }];
  expect(OrgChartSchema.safeParse(clash).success).toBe(false);
});
```

- [ ] **Step 7: Run it to make sure it fails**

Run: `npx vitest run --project unit contract/src/v1/teammates.test.ts`
Expected: FAIL, cannot resolve `./teammates.ts`.

- [ ] **Step 8: Write `teammates.ts`**

```ts
import { z } from 'zod';
import { Id, NonEmpty, Timestamp, Usd } from './common.ts';

export const TeammateStatusSchema = z.enum(['draft', 'running', 'waiting', 'idle', 'paused', 'blocked']);

export const PromptVersionSchema = z.object({
  v: z.number().int().positive(),
  prompt: z.string().min(20),
  at: Timestamp,
  by: Id,
});

export const PerfSchema = z.object({
  daily: z.array(z.number().nonnegative()).length(7),
  success: z.number().min(0).max(100),
  avgSec: z.number().nonnegative(),
  edited: z.number().min(0).max(100),
  cost7: Usd,
});

/**
 * PRD v9.0 Appendix A.5: a budget is three numbers, not one. The first draft of
 * this schema had a single `budget` field, which could not express the daily cap
 * or the turn limit and so could not enforce either.
 */
export const BudgetSchema = z.object({
  monthlyUsd: Usd.refine((v) => v > 0, 'a monthly budget must be above zero'),
  dailyCheapCalls: z.number().int().positive(),
  turnLimit: z.number().int().positive(),
});

/**
 * Operator-only. Never rendered on a customer screen: PRD §15.3 bans these names
 * there. The Super Admin fleet console is exempt and is where they appear.
 */
export const RuntimeSchema = z.object({
  paperclipId: NonEmpty,
  hermesProfile: NonEmpty,
  adapter: NonEmpty,
});

export const TeammateSchema = z
  .object({
    id: Id,
    jobId: Id.nullable(),
    name: NonEmpty,
    job: NonEmpty,
    type: z.enum(['coordinator', 'specialist']),
    deptId: Id.nullable(),
    managerId: Id.nullable(),
    ownerId: Id.nullable(),
    status: TeammateStatusSchema,
    doing: z.string(),
    prompt: z.string().min(20, 'instructions need at least 20 characters'),
    version: z.number().int().positive(),
    versions: z.array(PromptVersionSchema),
    guardrails: z.array(NonEmpty),
    tools: z.array(Id),
    budget: BudgetSchema,
    dataBoundary: z.array(Id),
    assignment: z.object({ deptId: Id.nullable(), teamId: Id.nullable(), personIds: z.array(Id) }),
    runsToday: z.number().int().nonnegative(),
    costToday: Usd,
    lastActive: Timestamp,
    provisioned: z.boolean(),
    blockedBy: z.array(Id).optional(),
    perf: PerfSchema.optional(),
    runtime: RuntimeSchema.optional(),
  })
  .superRefine((t, ctx) => {
    if (t.type === 'specialist' && t.managerId === null) {
      ctx.addIssue({ code: 'custom', message: 'a specialist reports to exactly one manager', path: ['managerId'] });
    }
    if (t.type === 'coordinator' && t.managerId !== null) {
      ctx.addIssue({ code: 'custom', message: 'the coordinator reports to the board', path: ['managerId'] });
    }
  });

export const OrgChartSchema = z.array(TeammateSchema).superRefine((list, ctx) => {
  if (list.filter((t) => t.type === 'coordinator').length !== 1) {
    ctx.addIssue({ code: 'custom', message: 'an office has exactly one coordinator' });
  }

  const seen = new Set<string>();
  for (const t of list) {
    const key = t.name.toLocaleLowerCase();
    if (seen.has(key)) ctx.addIssue({ code: 'custom', message: `two teammates are named ${t.name}` });
    seen.add(key);
  }

  const byId = new Map(list.map((t) => [t.id, t]));
  for (const start of list) {
    const path = new Set<string>([start.id]);
    let cursor = start.managerId ? byId.get(start.managerId) : undefined;
    while (cursor) {
      if (path.has(cursor.id)) {
        ctx.addIssue({ code: 'custom', message: `the reporting lines form a loop at ${cursor.name}` });
        break;
      }
      path.add(cursor.id);
      cursor = cursor.managerId ? byId.get(cursor.managerId) : undefined;
    }
  }
});

export type TeammateStatus = z.infer<typeof TeammateStatusSchema>;
export type PromptVersion = z.infer<typeof PromptVersionSchema>;
export type Teammate = z.infer<typeof TeammateSchema>;
```

- [ ] **Step 9: Run the test to verify it passes**

Run: `npx vitest run --project unit contract/src/v1/teammates.test.ts`
Expected: 5 passed.

- [ ] **Step 10: Write the remaining four modules, each test-first**

Same cycle for each: write the test, run it red, write the module, run it green.

**`tools.ts`** — the catalog is **Appendix A.2**, not the prototype's ten. Eight entries: Email, Calendar, Drive, Slack, HubSpot, Stripe, Notion, each first-permission read-only, and WhatsApp marked not available behind a switch until Meta approves. QuickBooks, Intercom, Salesforce, Ramp, Xero, ADP and LinkedIn are **not** in the catalog and are parked in `docs/backlog.md`.

Permissions are **per action**, not one mode per connection (C-04), and **everything starts read-only**:

```ts
export const ToolActionSchema = z.object({
  id: Id,
  label: NonEmpty,
  /** C-04: every action is either a read or a change. A change needs approval. */
  kind: z.enum(['read', 'change']),
  allowed: z.boolean(),
});

export const ConnectorSchema = z.object({
  id: Id,
  name: NonEmpty,
  available: z.boolean(),         // WhatsApp is false until Meta approves
  custom: z.literal(false),       // CD-1 safe default: custom connectors disabled
  actions: z.array(ToolActionSchema),
  dailyCallLimit: z.number().int().positive(),   // C-11
  dailyCostLimitUsd: Usd,                        // C-11, its own budget (CD-3 default)
});

export const ConnectionSchema = z
  .object({
    connectorId: Id,
    on: z.boolean(),
    actions: z.array(ToolActionSchema),
    connectedBy: Id,
    at: Timestamp,
    /** CD-5 safe default: a Leader approves EVERY change-capable connector. */
    leaderApprovalId: Id.nullable(),
  })
  .superRefine((c, ctx) => {
    const changes = c.actions.filter((a) => a.kind === 'change' && a.allowed);
    if (changes.length > 0 && c.leaderApprovalId === null) {
      ctx.addIssue({
        code: 'custom',
        message: 'a change-capable connector needs a Leader approval',
        path: ['leaderApprovalId'],
      });
    }
  });
```

Tests: a fresh connection has every action `allowed: false`; allowing a `change` action with no `leaderApprovalId` is refused; allowing only `read` actions parses with no approval; `available: false` cannot be switched on; `custom: true` is refused while CD-1 is unanswered; the catalog has exactly the eight Appendix A.2 entries and none of the seven parked ones.

**`launch.ts`** — re-exports `LaunchJobSchema` and `LaunchStepSchema` from `org.ts` (do not redefine them) and adds `LaunchStatusSchema` = `{ job: LaunchJobSchema, retryableFrom: z.number().int().nonnegative().nullable() }` with a refinement: `retryableFrom` is the index of the first step whose status is `fail`, and `null` when no step has failed. Tests: a job whose third step is `fail` gives `retryableFrom` 2; a job with no failure gives `null`; a job claiming `retryableFrom` 0 while no step failed is refused.

**`requests.ts`** — this is the **U-19 and A-14** flow, which v9.0 adds as a scope change: a User requests a teammate in plain words, and the Org Admin approves it, edits the prompt, adds guardrails, or declines with a reason. A request never creates a teammate on its own.

`RequestStatusSchema` is `z.enum(['pending','approved','changes','rejected'])`. `TeammateRequestSchema` is `{ id: Id, by: Id, whatItWouldDo: NonEmpty, deptId: Id, why: NonEmpty, status: RequestStatusSchema, adminNote: z.string(), editedPrompt: z.string().nullable(), guardrails: z.array(NonEmpty), at: Timestamp }` with two refinements: `changes` and `rejected` both require a non-empty `adminNote`; and `approved` requires an `editedPrompt` of at least 20 characters, because approval is what sets the teammate's instructions.

The fields follow U-19's wording — what it would do, which department, why — rather than the prototype's request form, which asked for a name and a tool list the requester has no authority to choose.

Tests: a `rejected` request with an empty note is refused; a `changes` request with an empty note is refused; a `pending` request with an empty note parses; an `approved` request with a null or too-short `editedPrompt` is refused; a request with no `deptId` is refused.

**`fleet.ts`** — the fleet row carries what **S-10** lists, and provisioning takes the **six facts** of **S-01**, not the prototype's three.

`ProvisionInputSchema` is `{ name: NonEmpty, domain: NonEmpty, plan: NonEmpty, ownerEmail: Email, website: NonEmpty, calendarLink: NonEmpty }`.

`FleetOfficeSchema` is `{ id: Id, name: NonEmpty, domain: NonEmpty, status: z.enum(['live','onboarding','awaiting']), version: NonEmpty, health: z.enum(['ok','warn','error']), teammates: z.number().int().nonnegative(), backupAt: Timestamp.nullable(), teamStatus: NonEmpty, connections: z.number().int().nonnegative(), incidents: z.number().int().nonnegative(), requestsOver24h: z.number().int().nonnegative(), spendMonthUsd: Usd, operatorMinutes: z.number().int().nonnegative() }` with a refinement: an office whose status is `awaiting` has `teammates` of 0.

The spend figure is **month to date**, per S-10. The first draft had a seven-day total, which no PRD feature asks for.

Tests: provisioning with five of the six facts is refused, once per missing fact; an invalid `ownerEmail` is refused; a negative value is refused on each counter; an `awaiting` office with 3 teammates is refused; a `live` office parses with every S-10 field present.

**`index.ts`** — re-export every schema and type from the six modules. No logic.

- [ ] **Step 11: Run everything and commit**

Run: `pnpm typecheck && pnpm test:unit && pnpm lint`
Expected: all clean.

```bash
git add contract pnpm-workspace.yaml vitest.config.ts pnpm-lock.yaml
git commit -F - <<'EOF'
feat(contract): add the stable dashboard layer of the seam

Two streams now build at the same time: the dashboards against a mock, and
the engine. They stay parallel only if both read the same definition of a
person, a teammate, a connection and a request, so that definition is code
rather than prose, and it is written before either stream starts.

This is the v1 layer, the part the prototype and the role features already
settle. A change here needs the founder's approval and a version bump,
because screens depend on it.

The office rules live in the schemas, not only in the validators the screens
will call. Exactly one coordinator, a specialist reporting to exactly one
manager, no loop in the reporting lines, no two teammates whose names differ
only by case, and no request declined without a note. A validator the
screens call is a courtesy to the person typing; a refinement on the schema
is what stops a malformed org chart entering from any direction, including a
later HTTP client parsing a response it did not write.

Emails are lowercased and trimmed at the boundary. The frozen slice learned
that one the hard way: an owner provisioned in one case who typed another
was silently treated as a stranger and told nothing.
EOF
```

---

## Task 8: The experimental engine layer

**Files:**
- Create: `contract/src/experimental/jobs.ts`, `tasks.ts`, `receipts.ts`, `authority.ts`, `index.ts`
- Test: `contract/src/experimental/jobs.test.ts`, `authority.test.ts`, `tasks.test.ts`, `receipts.test.ts`

**Interfaces:**
- Consumes: `Id`, `NonEmpty`, `Timestamp`, `Usd` from `contract/src/v1/common.ts`.
- Produces: `JobSummarySchema`, `JobSchema`, `JobQuestionSchema`, `PracticeRunSchema`, `TaskSchema`, `ReceiptSchema`, `AuthorityGrantSchema` and their inferred types. Task 9 imports these.

- [ ] **Step 1: Write the failing job summary test (Review Focus 5)**

Create `contract/src/experimental/jobs.test.ts`:

```ts
import { expect, test } from 'vitest';
import { JobSchema, JobSummarySchema } from './jobs.ts';

const summary = {
  whenItStarts: 'Whenever an expense request arrives in the finance inbox.',
  whoDoesIt: 'The Finance Clerk.',
  whatItMayTouch: 'The finance inbox and the expense sheet.',
  theLimits: 'Nothing above 500 dollars, and no supplier it has not seen before.',
  whoApproves: 'Priya, the CFO.',
  ifNobodyAnswers: 'It waits two working days, then asks once more.',
  examples: [
    'A 212 dollar taxi receipt from Dana, inside the limit.',
    'An 1800 dollar laptop, over the limit, so Priya decides.',
    'A 40 dollar receipt with no supplier named, so it asks.',
  ],
};

test('a summary needs all seven lines, because the product promises seven', () => {
  expect(JobSummarySchema.parse(summary).whoApproves).toBe('Priya, the CFO.');
  for (const key of Object.keys(summary)) {
    const short: Record<string, unknown> = { ...summary };
    delete short[key];
    expect(JobSummarySchema.safeParse(short).success, `missing ${key} was accepted`).toBe(false);
  }
});

test('a summary needs exactly three examples, not two and not four', () => {
  expect(JobSummarySchema.safeParse({ ...summary, examples: summary.examples.slice(0, 2) }).success).toBe(false);
  expect(JobSummarySchema.safeParse({ ...summary, examples: [...summary.examples, 'a fourth'] }).success).toBe(false);
});

test('no line of a summary may be blank or only whitespace', () => {
  expect(JobSummarySchema.safeParse({ ...summary, theLimits: '   ' }).success).toBe(false);
});

test('a job cannot be active until a person confirms its summary', () => {
  const job = {
    id: 'j1',
    text: 'Approve expenses under 500 dollars and send the rest to my CFO.',
    summary,
    status: 'active' as const,
    confirmedBy: null,
    confirmedAt: null,
    createdBy: 'p1',
    createdAt: 1,
  };
  expect(JobSchema.safeParse(job).success).toBe(false);
  expect(JobSchema.parse({ ...job, confirmedBy: 'p2', confirmedAt: 2 }).status).toBe('active');
  expect(JobSchema.parse({ ...job, status: 'draft' }).status).toBe('draft');
});
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `npx vitest run --project unit contract/src/experimental/jobs.test.ts`
Expected: FAIL, cannot resolve `./jobs.ts`.

- [ ] **Step 3: Write `jobs.ts`**

```ts
import { z } from 'zod';
import { Id, NonEmpty, Timestamp } from '../v1/common.ts';

/**
 * PRD v8.0 objective B2 fixes the seven lines a job is repeated back in. They
 * are named fields rather than a list of strings, so a missing line is a parse
 * error here instead of a gap on the screen where the limits should be.
 */
export const JobSummarySchema = z.object({
  whenItStarts: NonEmpty,
  whoDoesIt: NonEmpty,
  whatItMayTouch: NonEmpty,
  theLimits: NonEmpty,
  whoApproves: NonEmpty,
  ifNobodyAnswers: NonEmpty,
  examples: z.array(NonEmpty).length(3, 'a summary carries exactly three examples'),
});

export const JobStatusSchema = z.enum(['draft', 'asking', 'practised', 'active', 'paused']);

export const JobSchema = z
  .object({
    id: Id,
    text: NonEmpty,
    summary: JobSummarySchema.nullable(),
    status: JobStatusSchema,
    confirmedBy: Id.nullable(),
    confirmedAt: Timestamp.nullable(),
    createdBy: Id,
    createdAt: Timestamp,
  })
  .superRefine((job, ctx) => {
    if (job.status === 'active' && (job.confirmedBy === null || job.confirmedAt === null)) {
      ctx.addIssue({
        code: 'custom',
        message: 'a job goes live only after a person confirms its summary',
        path: ['confirmedBy'],
      });
    }
  });

export const JobQuestionSchema = z.object({
  id: Id,
  jobId: Id,
  question: NonEmpty,
  answer: z.string().nullable(),
  askedAt: Timestamp,
});

/** Objective B3: a practice run touches nothing real, so a run that cannot say so is not one. */
export const PracticeRunSchema = z.object({
  jobId: Id,
  wouldHaveDone: z.array(NonEmpty),
  touchedNothing: z.literal(true),
  ranAt: Timestamp,
});

export type JobSummary = z.infer<typeof JobSummarySchema>;
export type JobStatus = z.infer<typeof JobStatusSchema>;
export type Job = z.infer<typeof JobSchema>;
export type JobQuestion = z.infer<typeof JobQuestionSchema>;
export type PracticeRun = z.infer<typeof PracticeRunSchema>;
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run --project unit contract/src/experimental/jobs.test.ts`
Expected: 4 passed.

- [ ] **Step 5: Write the failing authority test, pinning read-only**

Create `contract/src/experimental/authority.test.ts`:

```ts
import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import * as authority from './authority.ts';
import { AuthorityGrantSchema } from './authority.ts';

const grant = {
  id: 'g1',
  teammateId: 'a2',
  grantedBy: 'p2',
  grantedAt: 1,
  endsAt: 2,
  category: 'routine' as const,
  maxAmountUsd: 500,
  maxPerDay: null,
  active: true,
};

test('a grant carries a category, a numeric limit and an end date', () => {
  expect(AuthorityGrantSchema.parse(grant).maxAmountUsd).toBe(500);
  expect(AuthorityGrantSchema.parse({ ...grant, maxAmountUsd: null, maxPerDay: 5 }).maxPerDay).toBe(5);
});

test('a grant with no numeric limit is refused: fixed code enforces limits, not the AI', () => {
  expect(AuthorityGrantSchema.safeParse({ ...grant, maxAmountUsd: null, maxPerDay: null }).success).toBe(false);
});

test('a grant with no end date is refused, because authority has to expire', () => {
  expect(AuthorityGrantSchema.safeParse({ ...grant, endsAt: null }).success).toBe(false);
  expect(AuthorityGrantSchema.safeParse({ ...grant, endsAt: 1 }).success).toBe(false);
});

test('a grant category must be one of the four fixed risk categories', () => {
  expect(AuthorityGrantSchema.safeParse({ ...grant, category: 'anything' }).success).toBe(false);
});

test('the never-covers list is the fixed one from Appendix A.7, not per-grant text', () => {
  expect(authority.NEVER_COVERS).toHaveLength(5);
  expect(authority.NEVER_COVERS).toContain('Signing or agreeing to contracts');
  // A grant cannot carry its own list, so it cannot omit one of these.
  expect('neverCovers' in AuthorityGrantSchema.parse(grant)).toBe(false);
});

test('the module exposes no way to create, revoke or enforce a grant', () => {
  expect(Object.keys(authority).sort()).toEqual(['AuthorityGrantSchema', 'NEVER_COVERS']);
  const source = readFileSync(new URL('./authority.ts', import.meta.url), 'utf8');
  for (const forbidden of [/createGrant/, /revokeGrant/, /enforce/i, /checkAuthority/]) {
    expect(source, String(forbidden)).not.toMatch(forbidden);
  }
});
```

- [ ] **Step 6: Run it to make sure it fails, then write `authority.ts`**

Run: `npx vitest run --project unit contract/src/experimental/authority.test.ts`
Expected: FAIL, cannot resolve `./authority.ts`.

```ts
import { z } from 'zod';
import { Id, Timestamp, Usd } from '../v1/common.ts';
import { RiskCategorySchema } from './tasks.ts';

/**
 * Standing Authority is undecided. PRD v9.0 open decision 2 asks whether an AI
 * teammate may decide inside limits a Leader sets, which reverses the v6.2 rule
 * that AI can never approve. Until the founder answers, this file holds the
 * shape of a grant so the screens can list existing ones, and nothing else.
 * No create, no revoke, no enforcement. See docs/rules/engine.md.
 */
export const AuthorityGrantSchema = z
  .object({
    id: Id,
    teammateId: Id,
    grantedBy: Id,
    grantedAt: Timestamp,
    endsAt: Timestamp,
    /** One of the four fixed risk categories, Appendix A.4. */
    category: RiskCategorySchema,
    /**
     * PRD §12: the limit is a NUMBER, because fixed code enforces it, not the AI.
     * An amount, a count per day, or both. At least one must be present. The
     * first draft of this schema used an array of sentences, which no check can
     * enforce and which made "limits are numbers" untrue.
     */
    maxAmountUsd: Usd.nullable(),
    maxPerDay: z.number().int().positive().nullable(),
    active: z.boolean(),
  })
  .superRefine((g, ctx) => {
    if (g.maxAmountUsd === null && g.maxPerDay === null) {
      ctx.addIssue({
        code: 'custom',
        message: 'a grant needs a numeric limit: an amount, a count per day, or both',
        path: ['maxAmountUsd'],
      });
    }
    if (g.endsAt <= g.grantedAt) {
      ctx.addIssue({ code: 'custom', message: 'a grant must end after it was granted', path: ['endsAt'] });
    }
  });

/**
 * Appendix A.7, fixed by the PRD. This is NOT free text per grant: a per-grant
 * array would let a grant be written that silently omits one of these.
 */
export const NEVER_COVERS = [
  'Hiring or removing people',
  'Signing or agreeing to contracts',
  'Changing roles, limits or budgets',
  'Deleting data',
  'Sending anything to an outside person that is not a fixed approved text',
] as const;

export type AuthorityGrant = z.infer<typeof AuthorityGrantSchema>;
```

`endsAt` is a required `Timestamp` rather than nullable, which is what makes the second test pass: a grant that never expires cannot be expressed. Note the file exports the schema and the type; `Object.keys` sees only the schema, because a type has no runtime presence.

- [ ] **Step 7: Run the test to verify it passes**

Run: `npx vitest run --project unit contract/src/experimental/authority.test.ts`
Expected: 4 passed.

- [ ] **Step 8: Write `tasks.ts` and `receipts.ts`, each test-first**

**`tasks.ts`** — two fixed lists from the PRD, neither invented here.

```ts
/** PRD v9.0 Appendix A.3. Seven states. Declining is NOT a state: a declined
 *  request ends the task as `cancelled` and writes a receipt (§6, TASK-9). */
export const TaskStatusSchema = z.enum([
  'new',
  'assigned',
  'in_progress',
  'waiting_for_approval',
  'done',
  'failed',
  'cancelled',
]);

/** PRD v9.0 Appendix A.4. Fixed checks set it from amounts, words, recipients
 *  and the tool. A model may raise a category, never lower it (TASK-4). */
export const RiskCategorySchema = z.enum(['routine', 'decline_or_refer', 'high_risk', 'office_change']);

/** TASK-3: what the teammate attaches, and what U-35 "Why did it do this?" renders. */
export const EvidenceSchema = z.object({
  request: NonEmpty,
  jobWords: NonEmpty,
  factsRead: z.array(NonEmpty),
  proposes: NonEmpty,
});
```

`TaskSchema` is `{ id, jobId, deptId, title, assigneeId: Id.nullable(), assigneeKind: 'person'|'teammate', status, risk: RiskCategorySchema, evidence: EvidenceSchema.nullable(), waitingOn: Id.nullable(), remindAt: Timestamp, expiresAt: Timestamp, createdAt, closedAt: Timestamp.nullable() }` with three refinements: a task whose status is `waiting_for_approval` must name a `waitingOn`; a task whose status is `done`, `failed` or `cancelled` must have a `closedAt`, and any other status must have `closedAt` null; and `expiresAt` must be after `remindAt`.

Tests: all seven states parse and an eighth does not; `declined` is refused as a state; `waiting_for_approval` with `waitingOn` null is refused; `done` with `closedAt` null is refused; `assigned` with a `closedAt` set is refused; the four risk categories parse and a fifth does not; the Appendix A.8 defaults hold, with `remindAt` two hours and `expiresAt` 72 hours after `createdAt`.

**`receipts.ts`** — the approval basis is one of exactly three, with no nullable case.

```ts
/** PRD v9.0 Appendix A.6. Every receipt names exactly one. There is no
 *  nullable or "other" case: that is what makes objective B4 checkable. */
export const ApprovalBasisSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('per_action'), approvedById: Id }),
  z.object({ kind: z.literal('standing_template'), templateId: Id, approvedById: Id }),
  z.object({ kind: z.literal('standing_authority'), grantId: Id, grantedById: Id }),
]);
```

`ReceiptSchema` is `{ id, taskId, whatWasDone: NonEmpty, why: NonEmpty, byId, byKind: 'person'|'teammate', basis: ApprovalBasisSchema, decision: z.enum(['approved','declined']), declineReason: z.string().nullable(), original: z.string().nullable(), edited: z.string().nullable(), at: Timestamp, cost: Usd }` with two refinements: `declined` requires a non-empty `declineReason`; and if `edited` is present then `original` must be too, since U-22 saves both versions on the receipt.

Tests: a per-action basis parses; a standing-template basis parses; a standing-authority basis parses; an object with no `kind` is refused; a receipt with a nullable or absent basis is refused; a declined receipt with no reason is refused; a declined task still produces a valid receipt (§6, TASK-9, U-23); an `edited` value with no `original` is refused.

**`index.ts`** — re-export every schema and type from the four modules. No logic.

- [ ] **Step 9: Run everything and commit**

Run: `pnpm typecheck && pnpm test:unit && pnpm lint`

```bash
git add contract
git commit -F - <<'EOF'
feat(contract): add the experimental engine layer of the seam

This is the part of the contract the engine stream will change as it
learns, so it is kept apart from v1 and the dashboards reach it through one
folder of hooks. Separating them means an engine change costs a hook, not a
screen.

Four promises are enforced by shape rather than by a check somewhere later.

The seven lines a job is repeated back in are seven named fields with three
examples, so a summary missing a line fails to parse instead of rendering a
blank where the limits should be. A practice run must claim it touched
nothing, so a run that cannot claim it is not a practice run. A receipt must
name either the person who approved or the grant that covered it, so an
action with no authority behind it cannot be recorded as though it had some.
And a job cannot be active without a person's confirmation: the whole
product rests on a human confirming what the system understood, and this is
the cheapest place to make skipping it impossible.

Standing Authority is undecided, so authority.ts holds the shape of a grant
and nothing else. A test asserts the module exports exactly one symbol and
that the words create, revoke and enforce do not appear in it, because the
risk is not that someone builds enforcement deliberately but that it arrives
one helper at a time. A grant also cannot be written without an end date or
without limits.
EOF
```

---

## Task 9: The `ApiClient` interface and the contract documents

**Files:**
- Create: `contract/src/client.ts`
- Create: `docs/contracts/api-contract.md`
- Create: `docs/contracts/openapi.yaml`
- Test: `contract/src/client.test.ts`

**Interfaces:**
- Consumes: every schema from Tasks 7 and 8.
- Produces: `DashboardApi`, `EngineApi` and `ApiClient`. Sub-project 1 implements `MockApiClient` against `ApiClient`.

- [ ] **Step 1: Write the failing interface test**

A TypeScript interface has no runtime presence, so the test checks the three things that can actually go wrong.

Create `contract/src/client.test.ts`:

```ts
import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import type { ApiClient } from './client.ts';

const source = () => readFileSync(new URL('./client.ts', import.meta.url), 'utf8');

test('the two layers are separate names, so a screen can depend on v1 alone', () => {
  expect(source()).toMatch(/interface DashboardApi/);
  expect(source()).toMatch(/interface EngineApi/);
  expect(source()).toMatch(/interface ApiClient/);
});

test('the engine layer carries no operation that creates or revokes authority', () => {
  expect(source()).toMatch(/listGrants/);
  for (const forbidden of [/createGrant/, /revokeGrant/, /grantAuthority/]) {
    expect(source(), String(forbidden)).not.toMatch(forbidden);
  }
});

test('a partial client does not satisfy the interface', () => {
  // @ts-expect-error an object missing every operation is not an ApiClient
  const bad: ApiClient = {};
  expect(bad).toBeDefined();
});
```

The `@ts-expect-error` is the real assertion: `pnpm typecheck` fails if `ApiClient` is ever loosened to the point that `{}` satisfies it.

- [ ] **Step 2: Run it to make sure it fails**

Run: `npx vitest run --project unit contract/src/client.test.ts`
Expected: FAIL, cannot resolve `./client.ts`.

- [ ] **Step 3: Write `contract/src/client.ts`**

Three interfaces. A header comment states that `DashboardApi` is stable and a change needs founder approval and a version bump, while `EngineApi` may change while the engine stream iterates, and that the dashboards reach `EngineApi` only through `dashboards/src/features/engine/`.

`DashboardApi` carries the seven groups from spec section 5.1, every member `(args) => Promise<T>` with argument and return types drawn from `./v1/index.ts`: `getOffice`, `saveOffice`, `applyTemplate`, `addDepartment`, `renameDepartment`, `removeDepartment`, `addPerson`, `updatePerson`, `removePerson`, `toggleAuthority`; `listTeammates`, `createTeammate`, `updateTeammate`, `removeTeammate`, `assignTeammate`, `autoAssign`, `savePrompt`, `togglePause`; `listConnections`, `connect`, `disconnect`; `startLaunch`, `retryLaunch`, `getLaunchStatus`; `listRequests`, `submitRequest`, `cancelRequest`, `decideRequest`; `listOffices`, `getFleetOffice`, `provisionOffice`; `loadDemo`, `resetFresh`, `setSimulation`.

`EngineApi` carries the five groups from 5.2, types drawn from `./experimental/index.ts`: `draftJob`, `askQuestions`, `answerQuestion`, `practiceRun`, `activateJob`, `listJobs`, `pauseJob`; `listTasks`, `getTask`, `waitingForMe`, `actOnTask`; `listReceipts`, `getReceipt`, `exportReceiptsCsv`; `jobQualityScores`; and `listGrants` as the only authority operation.

`ApiClient` is `DashboardApi & EngineApi`, declared as an interface extending both.

- [ ] **Step 4: Run the test and typecheck**

Run: `npx vitest run --project unit contract/src/client.test.ts && pnpm typecheck`
Expected: 3 passed, typecheck clean. If typecheck reports the `@ts-expect-error` as unused, `ApiClient` is too loose: fix the interface, do not delete the directive.

- [ ] **Step 5: Write `docs/contracts/api-contract.md`**

Required sections:

1. The two layers, and what each promises about stability.
2. A table of every operation: method, path, request schema, response schema.
3. The single error shape `{ error: { code, message, fields? } }`, with the code list.
4. Authentication by httpOnly, secure, same-site cookie issued by the API, stating explicitly that no token is ever written anywhere JavaScript can read, and that `MockApiClient`'s `localStorage` use is namespaced mock state only.
5. Idempotency keys on launch, on decisions and on anything that sends.
6. Pagination on every list operation.
7. **What the backend must enforce**, because the frontend only checks it for convenience: the strict tree, exactly one coordinator, guardrails outranking instructions, authority checks on every approval, budget pausing, and tool tokens never leaving the server.

- [ ] **Step 6: Write `docs/contracts/openapi.yaml`**

OpenAPI 3.1 covering every operation in both layers, `components.schemas` mirroring the Zod schemas, and a `cookieAuth` security scheme. Validate it:

```bash
pnpm dlx @redocly/cli@latest lint docs/contracts/openapi.yaml
```

Expected: no errors.

- [ ] **Step 7: Commit, then stop for the founder's review**

```bash
git add contract/src/client.ts contract/src/client.test.ts docs/contracts/
git commit -F - <<'EOF'
feat(contract): compose the ApiClient and write the contract documents

One interface, two layers. DashboardApi is stable, and a change to it needs
the founder's approval and a version bump because screens depend on it.
EngineApi may change while the engine stream iterates, and the dashboards
reach it through one folder so the churn lands in one place.

The interface is typed, so most of what could go wrong is caught by
typecheck rather than by a test. The three tests cover what typecheck
cannot: that the layers are still separate names a screen can depend on
individually, that no operation to create or revoke Standing Authority has
appeared, and that an empty object is still rejected. The last one fails if
the interface is ever loosened into something nothing has to satisfy.

The contract documents close with the list of rules a backend must enforce
because the frontend only checks them for convenience. Writing that down now
is cheaper than discovering later that a rule lived only in a screen.
EOF
```

- [ ] **Step 8: Produce the operation-coverage check the founder asked for**

Write `docs/contracts/coverage.md`: a table with one row per `ApiClient` operation named anywhere in `ORBIT-OS_Claude_Code_Build_Prompts.md`, and whether `contract/v1` or `contract/experimental` provides it. The point is for the founder to see that nothing the dashboards need is missing from `contract/v1`.

Generate the list rather than typing it, so a missed operation cannot hide:

```bash
grep -oE '\b(get|list|save|apply|add|rename|remove|update|toggle|create|assign|auto|connect|disconnect|start|retry|submit|cancel|decide|provision|load|reset|set|draft|ask|answer|practice|activate|pause|act|export|job)[A-Za-z]*\b' ORBIT-OS_Claude_Code_Build_Prompts.md | sort -u > /tmp/prompt-ops.txt
grep -ohE '^\s{2}[a-z][A-Za-z]*(?=[(:])' contract/src/client.ts | tr -d ' ' | sort -u > /tmp/contract-ops.txt
comm -23 /tmp/prompt-ops.txt /tmp/contract-ops.txt
```

The third command lists every operation the prompts mention that the contract does not provide. Read each one: some will be ordinary English verbs rather than operations, and the table says which. Anything that is a real operation and is missing gets added to the contract before the founder is asked, and the addition is noted in `docs/decisions.md`.

- [ ] **Step 9: Commit the coverage check, then stop**

```bash
git add docs/contracts/coverage.md docs/decisions.md
git commit -F - <<'EOF'
docs(contracts): check the contract covers every operation the screens need

The founder asked to see, before approving the contract, that nothing the
dashboards need is missing from contract/v1. A reviewer cannot establish
that by reading two documents side by side, so the list is generated from
the build prompts and compared against the interface rather than compiled
by hand.

The comparison is deliberately noisy in one direction: it matches ordinary
English verbs as well as operation names, so the table says which of each
is which. A check that over-reports costs a minute of reading. A check that
under-reports means a screen with no operation behind it, discovered in the
middle of building it.
EOF
```

**Stop here.** Per the founder's item 7, sub-project 1 does not start until the founder has approved the contract itself, not merely the spec. Bring them: the two layers, the full operation list, `docs/contracts/coverage.md`, and the four promises enforced by schema shape. Then wait.

---

## Task 10: Wire the Done checklist into CI, and set up the worktrees

**Files:**
- Modify: `.github/workflows/ci.yml`
- Create: `docs/runbooks/streams-and-review.md`

**Interfaces:**
- Consumes: `pnpm lint` (Task 3), `pnpm e2e` (Task 4), the guards (Tasks 1, 2, 5, 6).
- Produces: a CI run that fails on any Done-checklist row.

- [ ] **Step 1: Add the missing checks to the `test` job**

In `.github/workflows/ci.yml`, inside the existing `test` job, after `- run: pnpm typecheck`, add:

```yaml
      - run: pnpm lint
      - name: Dependency audit
        run: pnpm audit --audit-level=high
      - name: Secret scan
        uses: gitleaks/gitleaks-action@v2
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

After `- run: pnpm test`, add:

```yaml
      - name: Install browsers for the end-to-end and accessibility checks
        run: pnpm exec playwright install --with-deps chromium
      - run: pnpm e2e
```

Nothing already in the file is removed. The `compose-smoke` job is untouched. `pnpm install --frozen-lockfile` is already the first install step, which is the lockfile row.

- [ ] **Step 2: Run the whole checklist locally before pushing**

```bash
pnpm install --frozen-lockfile
pnpm db:up
pnpm db:generate
pnpm typecheck
pnpm lint
pnpm test
pnpm e2e
pnpm posture:check
pnpm audit --audit-level=high
pnpm db:down
```

Expected: every command exits 0. If `pnpm audit` reports a high advisory, report it to the founder rather than upgrading a pinned dependency: a version bump is a decision that affects security.

- [ ] **Step 3: Write `docs/runbooks/streams-and-review.md`**

Content:

```bash
git worktree add ../orbit-stream-a stream-a/dashboards-core
git worktree add ../orbit-stream-b stream-b/task-engine
```

Branch naming `stream-a/<sub-project>` and `stream-b/<sub-project>`. Every code change opens a pull request and is merged by the founder only after the Done checks pass; docs-only commits may go straight to `main`. Every code diff gets a security review in a fresh session reading only the diff, and the runbook carries the exact instruction to give that session: review this diff alone, assume nothing about the rest of the repo, and report findings by severity without fixing them. Add the note that the two streams must never share a working tree, because a half-finished engine change in the same tree as a dashboard build makes both diffs unreviewable.

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/ci.yml docs/runbooks/streams-and-review.md
git commit -F - <<'EOF'
ci: run every row of the Done checklist, and write down the stream layout

The Done checklist named eleven checks and CI ran four of them. Lint, the
end-to-end and accessibility run, the dependency audit and the secret scan
are now part of the same job, so a pull request cannot be merged on a green
tick that covered a third of the list.

A dependency audit finding is reported rather than fixed by a version bump,
because bumping a pinned dependency is a decision that affects security and
belongs to the founder.

The runbook records the two worktrees, the branch names and the review flow,
including the exact instruction to give the fresh session that reviews each
diff. The streams keep separate working trees for a practical reason: a
half-finished engine change sitting in the same tree as a dashboard build
makes both diffs unreadable, which is precisely when a review stops catching
anything.
EOF
```

---

## Task 11: Re-spec the build prompts against PRD v8.0

**Files:**
- Modify: `ORBIT-OS_Claude_Code_Build_Prompts.md`

**Interfaces:**
- Consumes: `reference/orbit-os-frontend/` (Task 1), `docs/contracts/api-contract.md` (Task 9), `dashboards/CLAUDE.md` (Task 2), `e2e/axe.ts` (Task 4).
- Produces: the prompts sub-projects 1 and 2 execute.

- [ ] **Step 1: Rewrite prompt 0 to demand evidence**

Replace prompt 0 with one that produces `docs/plan.md` holding a gap list **screen by screen with file evidence**. For each of the fourteen prototype screens (`user/screens/{home,new,activity}.js`, `org-admin/screens/{setup,onboarding,requests,dashboard,map,performance}.js`, `fleet/screens/{fleet,office,provision}.js`, plus `structure`, `agents` and `connections` as reused wizard steps), list which PRD v8.0 role features it already covers, which it does not, and the `reference/orbit-os-frontend/...` file and line that proves each claim. Add the explicit instruction: no percentages, no "about", and the earlier estimate that the prototype is roughly 70% aligned is not to be relied on.

- [ ] **Step 2: Correct the stack and scope lines throughout**

Three global edits:

- The rules file is `dashboards/CLAUDE.md`, not a root `CLAUDE.md`, and Stream A's package is `dashboards/`, not the repo root.
- Prompt 7's contract work is done: point at `docs/contracts/api-contract.md`, `docs/contracts/openapi.yaml` and `@orbit/contract`, and replace prompt 7 with the `HttpApiClient` implementation plus the contract tests that run one suite against both clients.
- Add the standing instruction that accessibility runs with every phase using `expectNoSeriousViolations` from `e2e/axe.ts`, not at the end, and that phase 6 therefore hardens rather than introduces it.

- [ ] **Step 3: Add prompt 5b**

The v8 gap screens, each with its acceptance test:

- **User `#/waiting`**, "Waiting for you": tasks awaiting this person's approval, oldest first, each opening the approval panel. Acceptance: a task whose status is `waiting` and whose `waitingOn` is this person appears; one waiting on someone else does not.
- **User `#/tasks`**, the task board: tasks grouped by status, this person's first. Acceptance: a task moving from `assigned` to `done` moves column without a reload.
- **User "Ask or describe a job"**: a plain-English box on `#/home` submitting to `draftJob`. Acceptance: an empty box cannot submit; a submitted job appears as `draft`.
- **The seven-line summary check**: the seven named lines and three examples, with Confirm and "That is not what I meant". Acceptance: a summary missing a line renders an error rather than a blank line, and Confirm stays disabled until every line is present.
- **Org Admin `#/jobs`**: every job with its status, owner, approver and last run. Acceptance: a job cannot be set active from this screen without a confirmation step.
- **Super Admin `#/quality`**, the job quality scoreboard: per job, practice-run match rate, override rate and refusal count. Acceptance: a job below a 90% match rate is flagged, per objective B3.
- **Super Admin `#/catalog`**, the connector catalog: every connector with its review state. Acceptance: a connector not yet reviewed cannot be offered to an office.

- [ ] **Step 4: Add prompt 5c**

Standing Authority screens, UI only, behind a feature flag defaulting to off:

- **Org Admin grants**: list existing grants from `listGrants`, each showing its limits, end date, never-covers list and whether it is active. Read-only. No create control, no revoke control.
- **Super Admin watch**: every grant across every office, with its end date and active state.
- Acceptance: with the flag off, neither route renders and neither nav item appears. With the flag on, both render and contain no control that writes. A test asserts no component in either screen calls anything other than `listGrants`.
- The prompt states at the top that enforcement is blocked pending the founder's decision, and that no engine work on Standing Authority may begin.

- [ ] **Step 5: Verify and commit**

Run:
```bash
npx vitest run --project unit guards/paths.test.ts
npx vitest run --project unit guards/rules.test.ts
```
Expected: PASS. The path guard matters here: this task rewrites the document it reads.

```bash
git add ORBIT-OS_Claude_Code_Build_Prompts.md
git commit -F - <<'EOF'
docs(prompts): re-spec the build phases against PRD v8.0

The prompts were written for the lead-reply product. Phases 1 to 6 survive
unchanged, because they build the prototype's screens and those screens are
still wanted. What was missing is what v8.0 added: the plain-English job,
the task board, and the scoreboard that says whether the plain English was
understood.

Prompt 0 now demands evidence. It asks for a gap list screen by screen with
the reference file and line that proves each claim, and says in as many
words that the earlier "roughly 70% aligned" estimate is not to be relied
on. An audit that reports a percentage cannot be checked, and an audit that
cannot be checked is how the wrong screens get built.

Prompt 5b adds the seven v8 screens with an acceptance test each, including
the one that matters most: a job summary missing a line renders an error
rather than a blank, and Confirm stays disabled until all seven lines are
there. Prompt 5c adds the Standing Authority screens behind a flag that
defaults to off, read-only, with a test that no component in them calls
anything that writes.

Accessibility moves into each phase rather than waiting for phase 6.
EOF
```

---

## Task 12: Preserve `landing/`'s history, then commit its files

Last, and off the critical path, per the founder's instruction.

**Files:**
- Create: `archive/landing-history.bundle`
- Modify: `.gitignore` (remove the `landing/` exclusion, add `landing/dist/`)
- Add: `landing/**` as tracked files

**Interfaces:**
- Consumes: the widened scan in `template/test/no-unapproved-send.test.ts`.
- Produces: nothing other tasks depend on.

- [ ] **Step 1: Bundle the full history**

```bash
cd /e/Projects/OrbitOS
mkdir -p archive
git -C landing bundle create ../archive/landing-history.bundle --all
ls -l archive/landing-history.bundle
```

- [ ] **Step 2: Verify the bundle by cloning it outside the repo**

```bash
rm -rf /tmp/landing-verify
git clone archive/landing-history.bundle /tmp/landing-verify
git -C /tmp/landing-verify log --oneline | cat
git -C /tmp/landing-verify log --oneline | wc -l
```

Expected: exactly 3 commits, matching `f01ac8b fix: keep team activity beside the approval box on tablet and desktop`, `468a2b0 style: sleek centred layout on light grey, black and white only, demo in app window`, `949dc37 feat: Orbitcrew one-screen landing page with demo card and request pop-up`.

**If this step does not show all three commits, stop. Do not proceed to step 4.**

- [ ] **Step 3: Keep a second copy outside the repo**

```bash
cp archive/landing-history.bundle "$HOME/landing-history.bundle"
ls -l "$HOME/landing-history.bundle"
```

Report both paths to the founder.

- [ ] **Step 4: Only now remove `landing/.git` and track the files**

```bash
rm -rf landing/.git
test ! -d landing/.git && echo "nested repo removed"
```

Remove these two lines from the top of `.gitignore`:

```gitignore
# Landing page lives in its own repo
landing/
```

and add, in the generated-files section:

```gitignore
landing/dist/
```

Then:

```bash
git add archive/landing-history.bundle .gitignore landing
git status --porcelain | head -40
```

Expected: `landing/node_modules` is excluded by the existing `node_modules/` rule and `landing/dist` by the new rule. If anything under either still appears staged, stop and fix the ignore rules before committing.

- [ ] **Step 5: Run the widened scan and report every finding before fixing any**

```bash
npx vitest run --project unit template/test/no-unapproved-send.test.ts
pnpm test:unit
pnpm typecheck
pnpm lint
```

Commit `01fa410` widened that scan to tracked directories, so tracking `landing/src/` brings it into scope for the first time. **Report every finding to the founder and fix nothing** until they answer. The scan exists to prove there is exactly one route to Gmail. A finding in a marketing page is likely a false positive from the demo card's copy, but deciding that is the founder's call, and `template/` is frozen, so widening or narrowing the scan is a change to frozen code.

- [ ] **Step 6: Commit only once the scan is clean or the founder has ruled**

```bash
git commit -F - <<'EOF'
chore(landing): track the landing page, with its history preserved first

The landing page sat in its own git repository with three commits and no
remote, excluded from this repo by .gitignore. That is one disk failure away
from losing it, and it is also what broke CI on 2026-10-02: a test asserted
a scan reached landing/src, which does not exist in a clean checkout.

Its history could not survive the move as commits, because a nested .git
makes git record a gitlink instead of the files. So the history was
bundled, the bundle was verified by cloning it outside the repo and
confirming all three commits were present, and a second copy was kept
outside the repo before the nested repository was removed.

Tracking landing/src brings it into the send-surface scan for the first
time, since that scan now walks tracked directories. Its findings were
reported before anything was changed, because narrowing a scan that proves
there is exactly one route to Gmail is not a cleanup.
EOF
```

---

## Self-Review

**1. Spec coverage.** Section 3 layout → Task 1. Section 4 rules → Task 2. Section 5 contract → Tasks 7, 8, 9. Section 6 prompts → Task 11. Section 7 worktrees → Task 10. Section 8 Done → Tasks 3, 4, 10, with the two guards in Tasks 5 and 6. Section 9 secrets → Task 2 (`keys.md`). Section 10 security documents → Task 2. Section 11 real-data gate → Task 2 (decision 5) and `docs/rules/engine.md`. Section 13 acceptance items 1 to 12 → Tasks 1, 2, 3, 4, 5, 6, 9, 10. The founder's `landing/` instruction → Task 12.

**Three spec defects found and handled inline, each needing the spec amended to match:**

- The spec put the mock **bundle** scan in sub-project 0, but no build exists to scan until sub-project 1. Task 6 ships the import-boundary half; decision 6 records the split.
- The spec named five frozen directories. `vitest list` shows `ops/` and `design/` also hold collected tests, so the Global Constraints and Task 5 use seven.
- The spec's acceptance item 3 asked to *demonstrate* that a Stream B command is not gated by the frontend-only rule. A demonstration is not a check, so Task 2's guard asserts the root `CLAUDE.md` contains none of the frontend-only phrases, which is the testable form of the same claim.

**2. Placeholder scan.** No "TBD", "TODO", "implement later" or "similar to Task N". Task 7 step 10 and Task 8 step 8 give four modules each as exact field lists, exact refinements and exact test assertions rather than full source; that is the one place the plan compresses, and nothing there is left to invention. No version string is hand-typed: `pnpm add -E` writes each resolved version.

**3. Type consistency.** `Id`, `NonEmpty`, `Email`, `Timestamp`, `Usd` are defined once in `contract/src/v1/common.ts` (Task 7 step 4) and imported everywhere after, including from `contract/src/experimental/` as `../v1/common.ts` (Task 8 step 3). `LaunchJobSchema` and `LaunchStepSchema` are defined in `org.ts` and re-exported by `launch.ts`, never redefined. `OrgChartSchema` wraps `TeammateSchema` in the same file. `expectNoSeriousViolations` is defined in Task 4 step 3 and consumed in Task 11 step 2. `authority.ts` has exactly two runtime exports, `AuthorityGrantSchema` and `NEVER_COVERS`, and its own test asserts that pair; `listGrants` is the only authority operation in `client.ts` in Task 9 and is spelled identically in Tasks 8, 9 and 11. `RiskCategorySchema` is defined once in `experimental/tasks.ts` and imported by `authority.ts`, which does not re-export it. `BudgetSchema` is defined once in `v1/teammates.ts`.

**4. Review Focus.** All five lines have a test in the task owning the code: path staleness → Task 1 step 5, third test; root rules regression → Task 2 step 1, first test; frozen test deletion → Task 5 step 2, second test, proven by the deletion drill in step 4; lint ignore list → Task 3 step 2, first test; seven-line summary → Task 8 step 1, first test.

---

## Addendum: rebase onto PRD v9.0 (2026-10-06)

`docs/prd/ORBIT_OS_PRD_v9_0.md` supersedes v8.0 and is the authority. The Global
Constraints, the Task 7 and Task 8 code blocks and the Task 2 guards above are
already rebased. This addendum records the rest, task by task, and adds two tasks.

| Task | Change |
|---|---|
| 1 | `.gitignore`, `tsconfig.json` and the path guard are unchanged. **The three prototype `<title>` tags are NOT edited here.** See the ruling below. |
| 2 | `docs/decisions.md` and `docs/backlog.md` already exist from the rebase commit; step 6 verifies rather than writes. The standing-rules guard now checks all four gate conditions and fails closed on the missing attestation. |
| 3, 4, 5, 6 | Unchanged. Lint, the axe harness, the freeze guard and the mock-boundary guard are independent of the PRD version. |
| 7 | Authorities gain `backup`. `DepartmentSchema` gains `defaultApproverId` and `escalation`. `BudgetSchema` replaces the single budget. `TeammateSchema` gains `dataBoundary` (A-38) and `assignment` (A-15). `tools.ts` becomes the Appendix A.2 catalog with per-action permissions. `fleet.ts` takes the six S-01 facts and the S-10 row. `requests.ts` becomes the U-19 and A-14 teammate-request flow. Names come from Appendix A.1: Orbi, not Atlas. |
| 8 | Seven task states, four risk categories, a three-way discriminated approval basis, task evidence, reminder and expiry times, job versions and department, the numeric grant limit with its category, and the fixed `NEVER_COVERS`. `undoAction` is added for the exact 30-second window. |
| 9 | The coverage check compares the contract against the **PRD §15.5 to §15.7 screen inventories and their feature IDs**, not against operation names grepped out of the build prompts. That is a better source: a screen inventory names what each screen must hold. |
| 10 | CI gains the Appendix A guard and the S-43 design and naming check from the two new tasks below. |
| 11 | The build prompts take their screen list from **§15.5 to §15.7**, 52 screens. Prompts 5b and 5c are replaced by that inventory. The new features to schedule are U-19, A-14, A-15, S-43 and the reordered A-01 setup. |
| 12 | Unchanged. |

**Ruling on the prototype titles.** PRD §15.3 says the three prototype entry
files violate the customer naming rule and "must change". This plan also makes
`reference/` read-only. Those two cannot both hold literally. The ruling:
`reference/` stays untouched, because it is a historical artifact and editing it
would make the behaviour spec disagree with the thing it documents. The title
rule applies to the `dashboards/` entry files Stream A creates, where the User
and Org Admin titles say **Orbitcrew** and the fleet title keeps **ORBIT-OS**
under the §15.3 exemption. The S-43 guard in Task 14 asserts exactly that, and
excludes `reference/`. Cost if wrong: the prototype keeps a title nobody ships.

### Task 13: One guard per fixed list in Appendix A

**Files:**
- Create: `guards/lib/walk.ts` — the shared helper
- Create: `guards/lib/walk.test.ts` — its own tests
- Create: `guards/appendix-a.test.ts`
- Create: `guards/contract-boundary.test.ts`
- Modify: `guards/paths.test.ts` — replace its private helpers with the shared ones

**Interfaces:**
- Consumes: every fixed list from `contract/src/v1` and `contract/src/experimental`.
- Produces: `REPO_ROOT`, `walkFiles(dir, {skipAtRoot, extensions})`, `trackedFiles()`, `readRepoFile(rel)` and `existsExact(rel)` from `guards/lib/walk.ts`. **Task 14 uses these and must not write its own copies.**

**Scope changed 2026-10-06.** This task now does three things, in this order.

**First, extract the shared walk helper**, because the plan was about to contain
nine copies of it. It already holds seven `const ROOT = new URL('../', ...)` lines
and six separately named walk functions (`walk`, `sources` twice, `filesUnder`,
`testFilesUnder`, `files`). Task 1's review found seven minor defects and five of
them are the same defect copied: the skip list matching a directory name at any
depth, `startsWith` on the allow-list also exempting a `.bak` sibling, a silent
catch that hides every error rather than only a missing directory, a root path that
stays percent-encoded, and a working-tree walk where `git ls-files` is correct. Fix
them once, in the helper. **Six of the seven minors close here:**

| Minor | Fix in the helper |
|---|---|
| 1 Case sensitivity | `existsExact()` compares against a directory listing, which is case-sensitive on Windows too, so a wrong-case path fails here exactly as it would in CI |
| 2 Skip list matches at any depth | `skipAtRoot` matches only at the top of the walk, so a nested `docs/reference/` is scanned |
| 3 `startsWith` exempts `.bak` siblings | callers exact-match file entries and prefix-match directory entries |
| 4 Silent catch hides every error | only `ENOENT` is tolerated; `EACCES` and a broken link throw |
| 5 `URL.pathname` stays percent-encoded | `fileURLToPath` |
| 7 Working-tree walk | `trackedFiles()` over `git ls-files -z` |

Minor 6, the extension list, stays deferred. The helper takes `extensions` from its
caller, so widening it later is a one-line change at each call site.

The helper memoizes each distinct walk once per test run, which also answers the
performance finding: seven guards each walking the whole tree grows with 52 screens
and their components.

**Second, write the Appendix A guards.** PRD Appendix A says the fixed lists "may
not be restated anywhere else" and that changing one is a PRD change with a version
bump. Code has to restate them to work, so the guard catches a restatement drifting
from the PRD. **Every assertion reads a sliced appendix section, never the whole
document** — the first draft searched all 1,081 lines for the words "New" and
"Done", which pass against almost any prose, so the test would have gone green with
Appendix A.3 deleted.

**Third, add the contract layer-boundary test.** The spec says Stream A reaches the
engine layer only through `dashboards/src/features/engine/`. That rule is the entire
reason the contract is two layers, and nothing enforced it while every lesser rule
had a guard.

- [ ] **Step 1: Write the shared helper**

Create `guards/lib/walk.ts`:

```ts
import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { join, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Repo root. fileURLToPath, not URL.pathname, so a path with spaces or
 *  non-ASCII characters is not left percent-encoded (Task 1 minor 5). */
export const REPO_ROOT = fileURLToPath(new URL('../../', import.meta.url));

const toPosix = (p: string) => p.split(sep).join('/');

export const readRepoFile = (rel: string) => readFileSync(join(REPO_ROOT, rel), 'utf8');

let tracked: string[] | undefined;
/** Paths git tracks, POSIX-separated, relative to the repo root. Memoized.
 *  Using git rather than the working tree means an untracked local file cannot
 *  fail a guard here while passing in CI (Task 1 minor 7). */
export function trackedFiles(): string[] {
  tracked ??= execFileSync('git', ['ls-files', '-z'], { cwd: REPO_ROOT, encoding: 'utf8' })
    .split('\0')
    .filter(Boolean);
  return tracked;
}

export type WalkOptions = {
  /** Directory names skipped ONLY at the top of this walk, never at depth, so a
   *  nested docs/reference/ is still scanned (Task 1 minor 2). */
  skipAtRoot?: readonly string[];
  /** Lowercase extensions including the dot. Omit to take every file. */
  extensions?: readonly string[];
};

const walkCache = new Map<string, string[]>();

/** Every file under `dir`, POSIX-separated and relative to the repo root.
 *  Memoized per (dir, options) so seven guards do not each re-walk the tree. */
export function walkFiles(dir: string, options: WalkOptions = {}): string[] {
  const key = [dir, (options.skipAtRoot ?? []).join(','), (options.extensions ?? []).join(',')].join('\u0000');
  const hit = walkCache.get(key);
  if (hit) return hit;

  const skip = new Set(options.skipAtRoot ?? []);
  const out: string[] = [];

  const recurse = (rel: string, depth: number): void => {
    let entries;
    try {
      entries = readdirSync(join(REPO_ROOT, rel), { withFileTypes: true });
    } catch (err) {
      // Only a missing directory is tolerated, because a guard armed before its
      // code exists must pass. EACCES or a broken link throws: a swallowed error
      // is a guard that quietly stopped checking (Task 1 minor 4).
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') return;
      throw err;
    }
    for (const entry of entries) {
      const child = rel ? `${rel}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        if (depth === 0 && skip.has(entry.name)) continue;
        recurse(child, depth + 1);
      } else if (entry.isFile()) {
        const name = entry.name.toLowerCase();
        if (!options.extensions || options.extensions.some((e) => name.endsWith(e))) out.push(child);
      }
    }
  };

  const start = toPosix(dir);
  recurse(start === '.' ? '' : start, 0);
  walkCache.set(key, out);
  return out;
}

/** Case-SENSITIVE existence check. existsSync ignores case on Windows and does
 *  not on Linux, so a doc citing .../Assets/... would pass locally and fail in
 *  CI. Comparing against a directory listing behaves the same on both
 *  (Task 1 minor 1). */
export function existsExact(rel: string): boolean {
  const parts = toPosix(rel).split('/').filter(Boolean);
  if (parts.length === 0) return false;
  let cursor = '';
  for (const part of parts) {
    let entries: string[];
    try {
      entries = readdirSync(join(REPO_ROOT, cursor));
    } catch {
      return false;
    }
    if (!entries.includes(part)) return false;
    cursor = cursor ? `${cursor}/${part}` : part;
  }
  return true;
}
```

- [ ] **Step 2: Test the helper itself, then prove each fix**

Create `guards/lib/walk.test.ts`. The helper is now load-bearing for every guard,
so it gets its own tests rather than being trusted:

```ts
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, expect, test } from 'vitest';
import { REPO_ROOT, existsExact, trackedFiles, walkFiles } from './walk.ts';

const PROBE = 'guards/lib/__probe';
afterAll(() => rmSync(join(REPO_ROOT, PROBE), { recursive: true, force: true }));

test('the repo root resolves to a real directory with no percent-encoding', () => {
  expect(REPO_ROOT).not.toMatch(/%[0-9A-Fa-f]{2}/);
  expect(existsExact('package.json')).toBe(true);
});

test('skipAtRoot skips only at the top of the walk, not at depth', () => {
  mkdirSync(join(REPO_ROOT, PROBE, 'reference'), { recursive: true });
  writeFileSync(join(REPO_ROOT, PROBE, 'reference/deep.md'), 'x');
  // 'reference' is a root skip entry for the repo walk, but here it is nested,
  // so it must be found. The old name-at-any-depth matching hid it.
  expect(walkFiles(PROBE, { skipAtRoot: ['reference'], extensions: ['.md'] })).toContain(
    `${PROBE}/reference/deep.md`,
  );
});

test('a missing directory is tolerated', () => {
  expect(walkFiles('guards/lib/does-not-exist')).toEqual([]);
});

test('existsExact is case-sensitive, unlike existsSync on Windows', () => {
  expect(existsExact('package.json')).toBe(true);
  expect(existsExact('Package.json')).toBe(false);
  expect(existsExact('docs/PRD')).toBe(false);
});

test('trackedFiles comes from git, not the working tree', () => {
  const files = trackedFiles();
  expect(files).toContain('package.json');
  expect(files.some((f) => f.startsWith('reference/orbit-os-frontend/'))).toBe(true);
  // landing/ is git-ignored, so it is never tracked.
  expect(files.some((f) => f.startsWith('landing/'))).toBe(false);
});

test('a walk is memoized, so repeated calls return the same array', () => {
  expect(walkFiles('guards', { extensions: ['.ts'] })).toBe(walkFiles('guards', { extensions: ['.ts'] }));
});
```

Run: `npx vitest run --project unit guards/lib/walk.test.ts` — expected: 6 passed.

- [ ] **Step 3: Rewrite `guards/paths.test.ts` on the helper**

Replace its three private helpers (`walk`, `filesUnder`, the inline `ROOT`) with
imports from `guards/lib/walk.ts`. Keep all three tests and their meaning: the
husk-holds-no-files form, the allow-list of five history-recording documents with
`ORBIT-OS_Claude_Code_Build_Prompts.md` and `dashboards/CLAUDE.md` kept in scope,
and the path-resolution check. Two changes beyond the swap:

- the allow-list **exact-matches** its two file entries (`docs/decisions.md`,
  `docs/backlog.md`) and **prefix-matches** its three directory entries, so
  `docs/decisions.md.bak` is no longer exempt (minor 3);
- the path-resolution test uses `existsExact`, so a wrong-case reference path
  fails here instead of only in CI (minor 1).

Run: `npx vitest run --project unit guards/paths.test.ts` — expected: 3 passed,
unchanged in meaning.

- [ ] **Step 4: Write the Appendix A guards**

Create `guards/appendix-a.test.ts`. **Every assertion reads one sliced appendix
section.** The slicer throws when its heading is absent, which is what makes a
deleted appendix fail loudly rather than silently passing:

```ts
import { expect, test } from 'vitest';
import { readRepoFile } from './lib/walk.ts';
import { AuthoritySchema } from '../contract/src/v1/org.ts';
import { RiskCategorySchema, TaskStatusSchema } from '../contract/src/experimental/tasks.ts';
import { NEVER_COVERS } from '../contract/src/experimental/authority.ts';

const PRD_PATH = 'docs/prd/ORBIT_OS_PRD_v9_0.md';

/** The text of ONE appendix section. Asserting against the whole 1,081-line PRD
 *  is how the first draft of this guard passed on the words "New" and "Done":
 *  it would have stayed green with Appendix A.3 deleted. */
function prdSection(heading: string): string {
  const prd = readRepoFile(PRD_PATH);
  const start = prd.indexOf(`### ${heading}`);
  if (start === -1) throw new Error(`PRD section "${heading}" is missing`);
  const bounds = [prd.indexOf('\n### ', start + 1), prd.indexOf('\n## ', start + 1)].filter((n) => n !== -1);
  return prd.slice(start, bounds.length ? Math.min(...bounds) : prd.length);
}

/** A list may be restated in code only if the file citing it names its section. */
function citesSection(file: string, section: string): void {
  expect(readRepoFile(file), `${file} must cite ${section}`).toContain(section);
}

test('A.3 task states: the seven in the appendix, and declined is not one', () => {
  const a3 = prdSection('A.3');
  expect(TaskStatusSchema.options).toHaveLength(7);
  expect(TaskStatusSchema.options).not.toContain('declined');
  for (const state of ['New', 'Assigned', 'In progress', 'Waiting for approval', 'Done', 'Failed', 'Cancelled']) {
    expect(a3, state).toContain(state);
  }
  expect(a3).toMatch(/Seven states/i);
  citesSection('contract/src/experimental/tasks.ts', 'A.3');
});

test('A.4 risk categories: four, named in the appendix', () => {
  const a4 = prdSection('A.4');
  expect(RiskCategorySchema.options).toHaveLength(4);
  for (const c of ['Routine', 'Decline or refer', 'High-risk', 'Office change']) expect(a4, c).toContain(c);
  citesSection('contract/src/experimental/tasks.ts', 'A.4');
});

test('A.7 never-covers: five entries, each verbatim from the appendix', () => {
  const a7 = prdSection('A.7');
  expect(NEVER_COVERS).toHaveLength(5);
  for (const item of NEVER_COVERS) expect(a7, item).toContain(item);
  citesSection('contract/src/experimental/authority.ts', 'A.7');
});

test('7.2 authorities: four, including Backup approver', () => {
  expect(AuthoritySchema.options).toEqual(['leader', 'approver', 'backup', 'budget']);
  const s72 = prdSection('7.2 Authorities');
  for (const a of ['Leader', 'Approver', 'Backup approver', 'Budget holder']) expect(s72, a).toContain(a);
  citesSection('contract/src/v1/org.ts', '7.2');
});

test('A.1 roles: the five hireable ones, and no parked prototype name is seeded', () => {
  const a1 = prdSection('A.1');
  for (const role of ['Finance Clerk', 'Sales Analyst', 'Support Triager', 'HR Coordinator', 'Operations Reporter']) {
    expect(a1, role).toContain(role);
  }
  expect(a1).toContain('Orbi, the Coordinator');
  const seeds = readRepoFile('contract/src/v1/teammates.ts');
  for (const parked of ['Atlas', 'Scout', 'Echo', 'Ledger', 'Compass', 'Beacon', 'Pulse', 'Quill', 'Relay']) {
    expect(seeds, `${parked} is parked in docs/backlog.md and must not be seeded`).not.toContain(parked);
  }
});

test('A.5 budget is three numbers and A.6 has three bases with no nullable case', () => {
  expect(prdSection('A.5')).toMatch(/Monthly budget/i);
  expect(prdSection('A.6')).toMatch(/exactly one/i);
  citesSection('contract/src/v1/teammates.ts', 'A.5');
  citesSection('contract/src/experimental/receipts.ts', 'A.6');
  const receipts = readRepoFile('contract/src/experimental/receipts.ts');
  expect(receipts).toContain('discriminatedUnion');
  expect(receipts).not.toMatch(/approvedById:\s*Id\.nullable\(\)/);
});
```

- [ ] **Step 5: Write the contract layer-boundary test**

Create `guards/contract-boundary.test.ts`:

```ts
import { expect, test } from 'vitest';
import { readRepoFile, walkFiles } from './lib/walk.ts';

const ENGINE_HOOKS = 'dashboards/src/features/engine/';

test('only the engine hooks folder imports the engine layer', () => {
  const offenders = walkFiles('dashboards/src', { extensions: ['.ts', '.tsx'] })
    .filter((f) => !f.startsWith(ENGINE_HOOKS))
    .filter((f) => /@orbit\/contract\/experimental/.test(readRepoFile(f)));
  expect(offenders).toEqual([]);
});

test('the stable layer is reachable from anywhere in the dashboards', () => {
  // Proves the rule is a boundary on ONE layer, not a blanket ban on the
  // contract. If this ever has to be relaxed, the split has failed.
  const files = walkFiles('dashboards/src', { extensions: ['.ts', '.tsx'] });
  if (files.length === 0) return; // Stream A has not started
  expect(files.some((f) => /@orbit\/contract\/v1/.test(readRepoFile(f)))).toBe(true);
});
```

The first test is armed before `dashboards/src` exists, like the mock-boundary
guard: it passes vacuously now and fails on the commit that first breaks the rule.

- [ ] **Step 6: Prove every new guard can fail**

For each, break it on purpose, confirm the named failure, restore, and confirm
`git diff --exit-code` is clean:

| Break | Expect |
|---|---|
| Add an eighth entry to `TaskStatusSchema` | the A.3 length assertion fails |
| Rename `### A.3` to `### A.3x` in the PRD | `prdSection` throws "PRD section A.3 is missing" |
| Delete the `A.3` comment from `tasks.ts` | `citesSection` fails |
| Drop `backup` from `AuthoritySchema` | the 7.2 assertion fails |
| Add a sixth entry to `NEVER_COVERS` | the A.7 length assertion fails |
| Put `Atlas` in a comment in `teammates.ts` | the A.1 parked-name assertion fails |
| Create `dashboards/src/apps/user/x.ts` importing `@orbit/contract/experimental` | the boundary test names that file |

- [ ] **Step 7: Run everything and commit**

Run: `pnpm typecheck && pnpm test:unit && pnpm lint`

```bash
git add guards/lib guards/appendix-a.test.ts guards/contract-boundary.test.ts guards/paths.test.ts
git commit -F - <<'EOF'
test(guard): extract the shared walk and pin each fixed list to its appendix

The plan was heading for nine copies of the same directory walk. It already
held seven inline repo-root lines and six separately named walk functions,
and five of the seven minor defects Task 1's review found were that same
duplication reported five times. They are fixed once, in guards/lib/walk.ts.

The skip list now matches only at the top of a walk, so a nested
docs/reference/ is scanned rather than silently skipped. The allow-list
exact-matches its file entries, so a .bak sibling is no longer exempt. Only
a missing directory is tolerated: EACCES or a broken link throws, because a
swallowed error is a guard that quietly stopped checking. The root comes from
fileURLToPath, and tracked files come from git rather than the working tree,
so an untracked local file cannot fail a guard that passes in CI.

existsExact replaces existsSync for path resolution. existsSync ignores case
on Windows and does not on Linux, so a document citing a wrong-case path
passed on one machine and failed in CI. Comparing against a directory listing
behaves the same on both.

The helper has its own tests, because every guard now depends on it.

The Appendix A guards read one sliced section each. The first draft asserted
against the whole 1,081-line PRD, which meant it passed on the words "New"
and "Done" and would have stayed green with the appendix deleted. The slicer
throws when its heading is absent, so deleting an appendix fails loudly.

The contract layer-boundary test closes the one rule that had no guard while
every lesser rule had one: only the engine hooks folder may import the
experimental layer. That rule is the whole reason the contract is split in
two, and without it engine churn would land in thirty screens instead of one
folder.
EOF
```
```

### Task 14: S-43, the design and naming check

**Files:** Create `guards/design-naming.test.ts`, add `pnpm check:screens` to
`package.json`, wire it into CI beside `pnpm lint`. Runs after Task 10.

**Interfaces:** Consumes the frozen `design/` token set. Produces
`pnpm check:screens`, which Stream A runs on every phase.

S-43 is new in v9.0 and exists because the design collision was found by reading
a document, which is not a repeatable check. It fails the build if a customer
screen uses a colour outside the token set, a card grid where §15.2 requires a
plain list, or a banned word. It runs with S-20 and in CI.

- [ ] **Step 1: Write the guard on the shared helper**

Create `guards/design-naming.test.ts`. It imports from `guards/lib/walk.ts` and
writes no walk of its own.

```ts
import { expect, test } from 'vitest';
import { existsExact, readRepoFile, walkFiles } from './lib/walk.ts';

/** Customer surfaces only. reference/ is read-only history. The fleet app is
 *  exempt under PRD section 15.3: it is an operator surface, and ORBIT-OS,
 *  Paperclip, Hermes, runtime ids and adapter names are correct there.
 *  Fleet-only components live in dashboards/src/apps/fleet, which is why that
 *  path is absent from this list (decision of 2026-10-06). */
const CUSTOMER_DIRS = ['dashboards/src/apps/user', 'dashboards/src/apps/org-admin', 'dashboards/src/shared'];
const CODE = ['.ts', '.tsx', '.css', '.html'] as const;
const BANNED = [/ORBIT-OS/, /Paperclip/i, /Hermes/i, /OpenClaw/i, /\bMCP\b/, /\btoken\b/i, /adapter/i];
const DEAD_PALETTE = ['#6316f9', '#e94bb5', '#f3f2f8', '#1a1a24', '#6b6b7b', '#e2e0eb'];

const customerFiles = () => CUSTOMER_DIRS.flatMap((d) => walkFiles(d, { extensions: CODE }));

test('no customer screen names an internal system', () => {
  const offenders: string[] = [];
  for (const file of customerFiles()) {
    const text = readRepoFile(file);
    for (const word of BANNED) if (word.test(text)) offenders.push(`${file}: ${String(word)}`);
  }
  expect(offenders).toEqual([]);
});

test('no customer screen introduces a colour outside the token set', () => {
  const offenders: string[] = [];
  for (const file of customerFiles()) {
    for (const m of readRepoFile(file).matchAll(/#[0-9a-fA-F]{3,8}\b|rgba?\(/g)) {
      offenders.push(`${file}: ${m[0]}`);
    }
  }
  expect(offenders).toEqual([]);
});

test('the prototype palette never reappears', () => {
  const offenders = customerFiles().filter((f) => {
    const text = readRepoFile(f).toLowerCase();
    return DEAD_PALETTE.some((hex) => text.includes(hex));
  });
  expect(offenders).toEqual([]);
});

test('no customer screen builds a card grid where section 15.2 requires a list', () => {
  const banned = [/grid-template-columns/, /\bgrid-cols-\d/, /\bKpiTile\b/, /className="[^"]*\bkpi\b/];
  const offenders: string[] = [];
  for (const file of customerFiles()) {
    const text = readRepoFile(file);
    for (const b of banned) if (b.test(text)) offenders.push(`${file}: ${String(b)}`);
  }
  expect(offenders).toEqual([]);
});

const ENTRIES = [
  ['dashboards/user/index.html', /<title>[^<]*Orbitcrew/],
  ['dashboards/org-admin/index.html', /<title>[^<]*Orbitcrew/],
  ['dashboards/fleet/index.html', /<title>[^<]*ORBIT-OS/],
] as const;

test('the User and Org Admin titles say Orbitcrew, and the fleet title keeps ORBIT-OS', () => {
  const missing = ENTRIES.filter(([f]) => !existsExact(f)).map(([f]) => f);

  for (const [file, want] of ENTRIES.filter(([f]) => existsExact(f))) {
    expect(readRepoFile(file), file).toMatch(want);
  }

  if (missing.length > 0) {
    // Loud on purpose, on every run. A test that skips forever and passes
    // forever is worse than no test, so the skip is visible rather than silent.
    console.warn(
      `[S-43] title check skipped for ${missing.length} of 3 dashboard entries that do not exist yet: ${missing.join(', ')}`,
    );
  }

  // This is what stops the skip above from becoming permanent. Once Stream A has
  // written any screen, the entry files must exist.
  if (walkFiles('dashboards/src', { extensions: ['.tsx'] }).length > 0) {
    expect(missing, 'Stream A has screens but a dashboard entry file is missing').toEqual([]);
  }
});

test('the fleet console is exempt, and the exemption is on its title', () => {
  // Scoped to the title rather than "some fleet file mentions ORBIT-OS", which a
  // stray comment would satisfy.
  if (!existsExact('dashboards/fleet/index.html')) {
    console.warn('[S-43] fleet exemption check skipped: dashboards/fleet/index.html does not exist yet');
    return;
  }
  expect(readRepoFile('dashboards/fleet/index.html')).toMatch(/<title>[^<]*ORBIT-OS/);
});
```

- [ ] **Step 2: Run it, add the script, prove it is not vacuous**

Run: `npx vitest run --project unit guards/design-naming.test.ts`. The scans pass
vacuously until Stream A exists, which is the point: the guard is armed before
the screens arrive, so the first violation fails on the commit that adds it.

Prove it bites: create `dashboards/src/apps/user/probe.tsx` containing
`#6316F9`, run the guard, confirm it fails naming that file and that colour, then
delete the probe and re-run. Repeat with a `grid-cols-3` class and with the word
`Paperclip`.

Add `"check:screens": "vitest run --project unit guards/design-naming.test.ts guards/appendix-a.test.ts"`
to `package.json`, and add `- run: pnpm check:screens` to the CI `test` job after
`pnpm lint`.

- [ ] **Step 3: Commit**

```bash
git add guards/design-naming.test.ts package.json .github/workflows/ci.yml
git commit -m "test(guard): add S-43, the design and naming check"
```

### Addendum 2: build order and the Stream A re-size (2026-10-06)

PRD §15.8 settles the screen question. **No screen is cut.** All 52 ship as shells
in Stream A; 26 get working logic. Task 11 of this plan writes the build prompts
against that split, not against prompts 5b and 5c, which are retired: their
content is inside the 52 shells and the 26 Fill-now screens.

**What Task 11 must now produce.** Prompt 0's audit still demands screen-by-screen
evidence, but it now compares the prototype against the **§15.5 to §15.7
inventory** rather than against a gap list I invented. For each of the 52 screens
it records: the feature IDs it carries, whether the prototype has a counterpart
and at which file and line, Fill now or Fill later, and for Fill later the
unblocker from §15.8.

**The shell contract**, which prompt 1 builds once and every screen then uses:

| Part | Rule |
|---|---|
| Route and nav | present for all 52 from the first week |
| Title | §15.3: Orbitcrew on User and Org Admin, ORBIT-OS on fleet |
| The six states | empty, loading, error, office paused, not yours, expired or already decided — **one component, built once** (§15.4) |
| Tokens | the frozen `design/` package only. No literal colour anywhere |
| Empty state | says what will appear here and the one action or condition that fills it. Never an illustration |
| Checks | S-43 and the axe check green on every route, from the first week |

**Sub-project 1 splits into three.** Recorded in the spec at §16.1: 1a foundation
and 52 shells (M, about 1.5 weeks); 1b the 15 Fill-now screens with a prototype
behaviour spec (L, about 2 weeks); 1c the 12 with no prototype counterpart (L,
about 2.5 weeks). Sub-projects 2 and 5 are **absorbed** — the v8.0 gap screens and
the Standing Authority screens are both inside the 52, with `/authority` shipping
as a shell that is flagged off and read-only.

Stream A moves from 3 to 4 weeks for sub-project 1 alone, to about 6 weeks for all
three. Against the original sub-project 1 plus sub-project 2, which was 5 to 6
weeks for the same ground, the stream is essentially unchanged. The estimate got
honest rather than the work getting bigger.

**Six Fill later screens have data that ships at launch** (§15.8): the audit log,
the per-teammate data boundary defaulting closed, the office-change routing A-14
depends on, the nightly numbers rollup the fleet table reads, the
job-understanding test set that is Checkpoint B, and backup status and incident
counts. Each is a field or a record in the contract, not a screen, so each lands
in Task 7 or Task 8 of this sub-project or in Stream B, never in Stream A.

### Addendum 3: the six load-bearing data items, with owners (2026-10-06)

PRD §15.8 states that six Fill later screens have data that ships at launch. This
is where each one is owned. **Three of the six needed something added to this
plan, and two of those had no sub-project to belong to at all.**

| # | Data | Owner | Stream, sub-project, task | Gates |
|---|---|---|---|---|
| 1 | **Audit log** (A-35) | Stream B | SP-4 gateway and org, new Task A | **The real-data gate, condition 2.** Blocks customer zero and every real-data decision |
| 2 | **Per-teammate data boundary** (A-38) | split | field and default-closed: **SP-0 Task 7**; enforcement: Stream B SP-4 | A-15 shipping in 1b, and §14.2 isolation once enforcement exists |
| 3 | **Office-change routing** (A-34) | **SP-0, new Task 15** | this sub-project | A-14 shipping in 1b |
| 4 | **Nightly numbers rollup** (S-38) | **nobody. New SP-6** | Stream B, SP-6 | the first real fleet numbers, not the screen. See below |
| 5 | **Job-understanding test set** (S-40) | Stream B | SP-3 task engine, its exit criterion | **It is Checkpoint B**, which gates SP-4 |
| 6 | **Backup status and incident counts** (S-07, S-21) | **nobody. New SP-6** | Stream B, SP-6 | the first real fleet numbers, not the screen |

#### The gap this exposed

Items 4 and 6 had no owner because of a mistake in the decomposition, not an
oversight in §15.8. PRD §17 has five build streams, and its fifth is the **fleet
console**. When the screen inventories arrived I absorbed that stream into
Stream A as twelve shells plus four Fill-now screens — and its **server side
disappeared with it**. There was a sub-project for the fleet console's screens and
none for the thing that produces what those screens display.

**Added: SP-6, Fleet and operations backend.** Stream B, size M, after SP-4.
Contents: the nightly numbers rollup (S-38), backup status records (S-07),
incident records (S-21), setup-tracker state (S-02) and the operator audit trail
written inside the affected office (S-23). It is the missing half of PRD stream
S5.

#### What items 4 and 6 do not gate

Worth stating plainly, because it changes the sequencing. **Stream A is
mock-backed by design**, so the fleet table, backup column and incident column in
1b are filled by `MockApiClient` and do not wait for SP-6. What SP-6 gates is the
first *real* numbers, which belongs to the test office, not to Stream A.

So SP-6 does not have to run early, and the fleet table is correctly Fill now.
The risk if this is misread is the opposite of a blocked stream: a fleet table
that looks finished while every number in it is invented. The mock-boundary guard
from Task 6 is what keeps that from shipping.

#### Item 3 is the one that actually blocks Stream A

Office-change routing is a **pure function**: given a change type and the actor's
authorities, which authority approves it, per the §12 table. Both streams need
it — Stream A to render the Requests queue and route a costly hire, Stream B to
enforce the decision — so it belongs with the other pure validators in
`contract/v1`, not in either stream. Hence **SP-0 Task 15**, below.

### Task 15: office-change routing, as a pure function

**Files:** Create `contract/src/v1/routing.ts` and `contract/src/v1/routing.test.ts`.
Runs after Task 7.

**Interfaces:** Consumes `AuthoritySchema` and `AccessSchema` from `./org.ts` and
`RiskCategorySchema` from `../experimental/tasks.ts`. Produces
`routeOfficeChange(change, people)`, which returns the authority that must
approve and the people who hold it. Task 9 adds it to `DashboardApi` as a pure
helper, not a network call.

- [ ] **Step 1: Write the failing test**

Cases from the PRD §12 "who approves what" table and §7.2:

```ts
import { expect, test } from 'vitest';
import { routeOfficeChange } from './routing.ts';

const people = [
  { id: 'p1', access: 'admin' as const, authorities: ['leader' as const, 'budget' as const] },
  { id: 'p2', access: 'admin' as const, authorities: [] },
  { id: 'p3', access: 'user' as const, authorities: ['approver' as const] },
];

test('a new job or a new rule routes to the Org Admin access role', () => {
  for (const kind of ['new_job', 'new_rule'] as const) {
    expect(routeOfficeChange({ kind }, people).authority).toBe('org_admin');
    expect(routeOfficeChange({ kind }, people).holders).toEqual(['p1', 'p2']);
  }
});

test('a costly hire and a teammate request route by type, not to whoever asked', () => {
  // PRD section 9, A-14: a costly hire follows the office-change rule A-34.
  expect(routeOfficeChange({ kind: 'teammate_request', costly: false }, people).authority).toBe('org_admin');
  expect(routeOfficeChange({ kind: 'teammate_request', costly: true }, people).authority).toBe('budget');
});

test('a budget increase routes to the Budget holder, which defaults to the Leader', () => {
  expect(routeOfficeChange({ kind: 'budget_increase' }, people).holders).toEqual(['p1']);
  const noBudgetHolder = [{ id: 'p9', access: 'admin' as const, authorities: ['leader' as const] }];
  // Section 7.2: Budget holder defaults to the Leader.
  expect(routeOfficeChange({ kind: 'budget_increase' }, noBudgetHolder).holders).toEqual(['p9']);
});

test('granting Standing Authority routes to a Leader, and never to an Org Admin alone', () => {
  expect(routeOfficeChange({ kind: 'standing_authority' }, people).authority).toBe('leader');
  expect(routeOfficeChange({ kind: 'standing_authority' }, [people[1]!]).holders).toEqual([]);
});

test('an empty Leader seat returns no holder rather than falling back to anyone', () => {
  // Section 9, A-08: a stated fallback applies and high-risk work is HELD. The
  // router must not quietly widen authority to fill the gap.
  const noLeader = [{ id: 'p2', access: 'admin' as const, authorities: [] }];
  const out = routeOfficeChange({ kind: 'standing_authority' }, noLeader);
  expect(out.holders).toEqual([]);
  expect(out.held).toBe(true);
});

test('an unknown change kind throws rather than defaulting to the weakest authority', () => {
  // @ts-expect-error an unlisted change kind is not routable
  expect(() => routeOfficeChange({ kind: 'something_new' }, people)).toThrow(/unknown office change/i);
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run --project unit contract/src/v1/routing.test.ts`
Expected: FAIL, cannot resolve `./routing.ts`.

- [ ] **Step 3: Write `routing.ts`**

A pure function, no I/O, no model call. A `Record` from change kind to the
authority that approves it, the Budget-holder-defaults-to-Leader rule, and a
`held: true` result when no person holds the required authority. An unknown kind
throws: defaulting to the weakest authority is how an office change gets approved
by someone who may not approve it.

- [ ] **Step 4: Run the test, then the suite**

Run: `npx vitest run --project unit contract/src/v1/routing.test.ts && pnpm test:unit && pnpm typecheck`
Expected: 6 passed, suite green, typecheck clean.

- [ ] **Step 5: Commit**

```bash
git add contract/src/v1/routing.ts contract/src/v1/routing.test.ts
git commit -m "feat(contract): route office changes by type, as a pure function"
```

---

## Addendum 4: every guard uses the shared helper (2026-10-06)

Task 13 extracts `guards/lib/walk.ts`. **Tasks 2, 5, 6 and 14 import from it and
must not re-inline a walk, a repo-root line or an existence check**, even though
their code blocks above still show the old private helpers. Those blocks were
written before the helper existed and are kept for their assertions, not their
plumbing.

| Task | Replace with |
|---|---|
| 2, `guards/rules.test.ts` and `guards/standing-rules.test.ts` | `readRepoFile`, `walkFiles`, `trackedFiles`, `existsExact` |
| 5, `guards/freeze.test.ts` | `walkFiles(dir, { extensions: ['.test.ts'] })` and `readRepoFile`; keep the file-baseline comparison exactly as specified |
| 6, `guards/mock-boundary.test.ts` | `walkFiles` and `readRepoFile`; keep the ALLOWED list and both tests |
| 14, `guards/design-naming.test.ts` | already written against the helper |

Two rules that travel with the helper:

- **`existsExact` replaces `existsSync` for any path that comes from a document.**
  `existsSync` ignores case on Windows and does not on Linux, so a wrong-case path
  passes on one machine and fails in CI. That class of bug is the worst kind to
  carry, which is why it closes here rather than being deferred.
- **Only a missing directory is tolerated.** `EACCES`, a broken link or a path too
  long throws. A guard that swallows every error is a guard that quietly stopped
  checking, and it still reports green.

Minor 6 from Task 1's review, the extension list, stays deferred. The helper takes
`extensions` from its caller, so widening it later is a one-line change per call
site rather than a rewrite.

---

## Addendum 5: Task 13 as built (2026-10-06)

Three deviations from Task 13 as written, each found by running the thing rather
than reading it.

**1. The helper needs `skipAnywhere` as well as `skipAtRoot`.** Matching a
directory name only at the top of a walk is right for `reference` and `archive`,
and wrong for `node_modules`: pnpm creates one inside every workspace package, so
a root-only rule walks all of them. `skipAnywhere` defaults to `node_modules` and
`.git` so a caller cannot forget. The any-depth matching that minor 2 complained
about was doing two jobs; the fix is two options, not one.

**2. The helper needs an optional `root`.** Its own tests built a throwaway tree
inside the repo, and `paths.test.ts` then failed with `ENOENT`: vitest runs test
files in parallel, so it walked the probe and read a file that the probe's
`afterAll` had already deleted. The probe now lives in the OS temp directory and
`walkFiles` takes the root to walk. Guards that walk and then read are racy
against anything mutating the tree, and the fix is to stop mutating the tree.

**3. The code-vs-appendix half of the Appendix A guard moves to Task 8's
acceptance.** A guard that greps files can be armed before those files exist; one
that imports real modules cannot. `await import('../contract/...')` is still
resolved statically by `tsc`, so it fails `pnpm typecheck` until the package
exists, and the only way around that is a variable specifier, which buys an
any-typed path nobody can verify today. `guards/appendix-a.test.ts` therefore
checks the appendix itself, and carries a tripwire that fires the moment
`contract/src/experimental/tasks.ts` appears, naming the assertions that are then
due. A tripwire on a precondition, not an assertion that the contract is absent,
which would have been a time bomb failing on the commit that correctly creates it.

### Added to Task 8 acceptance

When `contract/src/experimental/` is created, add these to
`guards/appendix-a.test.ts` and delete its tripwire test:

- `TaskStatusSchema.options` has the seven values from A.3 and does not contain `declined`
- `RiskCategorySchema.options` has the four from A.4
- `AuthoritySchema.options` equals `['leader', 'approver', 'backup', 'budget']` per 7.2
- `NEVER_COVERS` has five entries, each appearing verbatim in the A.7 slice
- each restating file cites its section: `tasks.ts` cites A.3 and A.4, `authority.ts` A.7, `org.ts` 7.2, `teammates.ts` A.5, `receipts.ts` A.6
- none of the nine parked prototype roles appears in `contract/src/v1/teammates.ts`
- `receipts.ts` contains `discriminatedUnion` and no `approvedById: Id.nullable()`

### One defect the drills caught

The slicer used `indexOf('### A.3')`, which also matches `### A.3x`. Renaming a
heading therefore sliced the next section silently instead of throwing, and the
drill passed when it should have failed. It is now anchored to a line start and
required to end on whitespace, with two assertions pinning it: `prdSection('A')`
and `prdSection('A.')` must both throw, because before the fix `'### A'` matched
`'### A.1'`.
