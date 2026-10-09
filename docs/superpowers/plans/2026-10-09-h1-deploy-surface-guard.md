# H1 remediation: a guard on the deploy surfaces, and reference out of the Docker context

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make it a test failure for any tracked build or deploy surface to name `reference/`, keep the prototype out of every Docker build context, and record the H1 decision with what it does and does not cover.

**Architecture:** One new guard file, `guards/deploy-surface.test.ts`, reads the seven classes of tracked build and deploy surface and fails when any names the top-level `reference/` directory as a COPY source, a Vite input, an `fs.allow` entry, a served root or an artifact path. The matcher compares the first path segment exactly, so `docs/reference/` never trips it. Path-shaped and command-shaped values are extracted from structured positions, never by grepping whole files, so a comment naming the prototype is not a finding. One line is added to `.dockerignore`. One entry is appended to `docs/decisions.md`. Nothing inside `reference/` is read for content, and nothing inside it is edited.

**Tech Stack:** TypeScript (strict), vitest 5 (`unit` project), the `yaml` package (already a devDependency at `package.json:47`, already used by `template/test/compose.test.ts:3`), `guards/lib/walk.ts` for `REPO_ROOT`, `readRepoFile` and `trackedFiles`.

**Spec:** The founder's decision on H1, 2026-10-09, quoted in full under *The decision this plan implements* below. The finding it answers is the H1 row of the `## 2026-10-09 - The second security review of this branch, four high findings, none fixed` entry in `docs/decisions.md:2624`. The read-only investigation that supplies every file and line cited here was run in this repository on 2026-10-09 and its findings are reproduced inline, so no task has to re-derive them.

---

## The decision this plan implements

Quoted from the founder, 2026-10-09, so an executor does not have to reconstruct it:

> Decision on H1. Do (a) and the .dockerignore gap. Not (b). Defer (c).
>
> Do NOT edit anything inside reference/. The read-only ruling stands.
>
> 1. GUARD (option a). New guard file. Read the tracked build and deploy surfaces — Dockerfile, .dockerignore, \*compose\*.yml, .github/workflows/\*.yml, package.json scripts, dashboards/vite.config.ts, playwright.config.ts — and fail if any names reference/ as a COPY source, a Vite input or fs.allow entry, a served root, or an artifact path.
>    - Match the path precisely, not by substring. docs/reference/ is a live distinction (guards/lib/walk.ts:65) and must not trip it.
>    - Include the anti-vacuity floor this repo uses: fail if zero surfaces were examined.
>    - It will be green on arrival, so probe it: write each prohibited form into a temporary surface, watch the guard fail naming that surface, restore. Record the probe output in the decisions entry the way every guard added this week has been. A guard never seen red is not a guard.
> 2. .dockerignore. Add reference to .dockerignore, alongside landing, archive, docs and .superpowers. Reason for the entry: template/compose.yml builds with context: .., so reference/orbit-os-frontend/ and orbit-os-frontend.zip are sent to the Docker daemon on every stack:up. Nothing COPYs them today, so nothing ships — this stops a future COPY . . from shipping them silently. Confirm the build context still works after the change.
> 3. DECISIONS LOG. One entry recording the H1 decision. The six required elements are reproduced in Task 4.
>
> Run guards/decisions-log.test.ts and confirm it passes before committing the log. Run each Done check separately and confirm each exits 0. One command, then read its exit code. Never chain git commit or git push onto a grep, a pipe or a test run. Gate on gh run view --json status,conclusion.
>
> If the push is denied again, say so and stop. I will run it.

## Global Constraints

- **Never edit anything under `reference/`.** Read-only by the ruling at `docs/prd/ORBIT_OS_PRD_v9_0.md:731`. This includes the live probe in Task 2: no probe is ever written into `reference/`.
- **Never read from or write to `.env`, `.env.local`, `.env.example` or `docs/security/keys.md`.** CLAUDE.md section 6.
- **Never write into a frozen directory:** `frontdesk/`, `api/`, `db/`, `shared/`, `template/`, `ops/`, `design/`. CLAUDE.md section 4. The guard **reads** `template/compose.yml` and `template/engine/Dockerfile`; reading a frozen directory is always fine, and guards do it. The live probe in Task 2 therefore uses only surfaces outside the freeze: `Dockerfile`, `.dockerignore`, `compose.dev.yml`, `.github/workflows/ci.yml`, `package.json`, `dashboards/vite.config.ts`, `playwright.config.ts`.
- **The directory name is matched as one exact path segment:** `reference`. A substring rule breaks `docs/reference/`, which `guards/lib/walk.ts:65` exists to keep distinct.
- **Plain language in every comment and every line of the log entry:** short sentences, no jargon, **no em dashes and no exclamation marks**. CLAUDE.md section 10.
- **The decisions entry must open its explanation with `**Reason`, `**Why`, `**Result` or `**Superseded`** and must use the heading form `## <ISO date> - <decision>`. CLAUDE.md section 9, enforced by `guards/decisions-log.test.ts:85`.
- **The decisions entry must not contain the string `**Superseded`.** The founder asked for the marker `**Corrects:**` instead. `guards/decisions-log.test.ts:93` puts an extra obligation on any entry containing `**Superseded`: it must name the ISO date of a replacement entry that exists in the log. `**Corrects:**` carries no such obligation, which is why it is the right marker here.
- **No new dependency.** `yaml` is already in `devDependencies`.
- **No change to `vitest.config.ts`.** Its `unit` project already includes `guards/**/*.test.ts` at `vitest.config.ts:22`, so a new guard file is picked up with no configuration.
- **One command per Bash call. Never chain `git commit` or `git push` onto a test run, a grep or a pipe.** Read the exit code of each command on its own.

## Review Focus

Five things this plan's own tests do not cover, most likely to bite first:

1. **A deploy surface of a class the guard does not read at all.** The guard reads seven named classes. A `netlify.toml`, `vercel.json`, `wrangler.toml`, `Procfile`, Coolify descriptor or a GitHub Pages workflow added later is invisible to it, and the prototype README names Coolify, Netlify and Cloudflare Pages by name. Pinned in **Task 2, Step 16**: a test asserts the set of surface classes is exactly the seven recorded here, so adding an eighth kind of deploy config without widening the guard is a visible failure rather than a silent gap.
2. **A bare `reference` as a mid-command argument under a key the guard does not treat as a path key.** `run: cp -r reference dist` is caught because `run` is a path key. `shell: cp -r reference dist` is not, because free-form strings are scanned prose-safely and a slash-free token mid-sentence is ignored. Pinned in **Task 2, Step 11**: a probe asserts both the catch and the miss, so the limit is recorded as behaviour rather than discovered later.
3. **An untracked deploy surface.** Everything is discovered through `trackedFiles()`, so a local `docker-compose.override.yml` naming `reference/` passes. This is deliberate, and it is the same choice `guards/lib/walk.ts:46` makes for the same reason: an untracked scratch file must not fail a guard locally while CI passes. Pinned in **Task 2, Step 13** as a comment beside the discovery helper, and stated in the decisions entry.
4. **`.dockerignore` pattern precedence.** The guard accepts only a pattern whose first segment is `reference`, and rejects a glob form as proof of exclusion even though Docker would honour it. Pinned in **Task 2, Step 10**: a probe asserts the glob form alone does **not** satisfy the rule, so the narrowness is intentional and visible, not an accident.
5. **The identifiers themselves.** Neither the guard nor the `.dockerignore` line removes `shuv@orbitumai.com`, the hardcoded `Shuv Chowdhury` / `Operator` identity or `office.orbitumai.com` labelled customer zero. No test can cover this, because the decision is to leave them. Pinned in **Task 4** as a required paragraph of the decisions entry.

---

## File Structure

| File | Change | Responsibility |
| --- | --- | --- |
| `guards/deploy-surface.test.ts` | Create | The whole guard: the exact-segment matcher, one extractor per surface class, the real-surface assertions, the permanent probes, the anti-vacuity floors. |
| `.dockerignore` | Modify (append one entry with its reason) | Keep `reference/` and `orbit-os-frontend.zip` out of every Docker build context. |
| `docs/decisions.md` | Modify (append one entry) | Record the H1 decision, the probe output, what is deferred and on what event, and what none of this removes. |
| `vitest.config.ts` | **No change** | `guards/**/*.test.ts` at line 22 already collects the new file. |
| `reference/**` | **No change** | Read-only by ruling. |

### What each surface class contributes

Counts verified in this repository on 2026-10-09 with `git ls-files`. They are the anti-vacuity floors.

| Class | Pattern | Tracked today | Prohibited form checked |
| --- | --- | --- | --- |
| dockerfile | `/(^\|\/)Dockerfile$/` | 2: `Dockerfile`, `template/engine/Dockerfile` | `COPY` or `ADD` source or destination |
| dockerignore | `/(^\|\/)\.dockerignore$/` | 1: `.dockerignore` | must exclude `reference`; no `!` negation may re-include it |
| compose | `/(^\|\/)[^/]*compose[^/]*\.ya?ml$/` | 2: `compose.dev.yml`, `template/compose.yml` | any path or command value, and any other string naming `reference/` |
| workflow | `/^\.github\/workflows\/[^/]+\.ya?ml$/` | 1: `.github/workflows/ci.yml` | artifact `path`, `run`, `working-directory`, and any other string naming `reference/` |
| manifest | `/(^\|\/)package\.json$/` | 9: root plus 8 workspaces | any `scripts` value |
| vite | `/(^\|\/)vite\.config\.[cm]?[jt]s$/` | 1: `dashboards/vite.config.ts` | resolved `build.rollupOptions.input` entry, resolved `server.fs.allow` entry |
| playwright | `/(^\|\/)playwright\.config\.[cm]?[jt]s$/` | 1: `playwright.config.ts` | `webServer[].command`, `webServer[].cwd`, `testDir`, `outputDir` |

Total floor: **17 surfaces**.

### Why this reads structured positions and not whole files

A whole-file grep for `reference` would fire on every comment, and these files are heavily commented: `Dockerfile:24-32` explains the generated Prisma client, `playwright.config.ts:3-34` runs to 30 lines of reasoning. A guard that fires on a comment gets switched off, and takes its real rules with it. So:

- Dockerfile: only `COPY` and `ADD` argument lists, which are paths by construction.
- YAML: `parse()` from the `yaml` package returns values with comments already dropped.
- `package.json`: only the `scripts` object.
- Vite and Playwright configs: imported and read as values, the way `guards/vite-fs-allow.test.ts:11-15` argues for. A text scan there would pass on `allow: [join(ROOT, '..')]` and on an identifier defined three lines higher, which is the shape that config already uses.

---

## Task 1: Keep the prototype out of every Docker build context

**Files:**
- Modify: `.dockerignore:1-10`

**Interfaces:**
- Consumes: nothing.
- Produces: a `.dockerignore` whose non-comment lines include `reference`. Task 2's `dockerignoreComplaints` asserts on exactly this, so the two tasks must agree on the literal spelling: one line, lowercase, no slash, no glob, `reference`.

**Why this task comes first.** Task 2's guard asserts `.dockerignore` excludes `reference`. If the guard landed first it would be red for a reason unrelated to its own correctness, and a red guard with two possible causes is harder to trust than either alone.

**Context an executor needs.** `template/compose.yml:7` and its four service builds at lines 79, 87, 109 and 122 all use `context: ..`, which is the repository root. Everything not ignored is sent to the Docker daemon on every `pnpm stack:up`. `.dockerignore` today lists `landing`, `archive`, `docs`, `.superpowers` and `**/*.md`, and does **not** list `reference`. So the `.js`, `.css`, `.html` and `.py` files under `reference/orbit-os-frontend/` go to the daemon, and so does the untracked `orbit-os-frontend.zip` at the repository root. `README.md` is already excluded by `**/*.md`. Nothing copies any of it: `Dockerfile:48-56` copies `shared`, `db` and `${APP}` only, and there is no `COPY . .`. So nothing ships today. The entry stops a future `COPY . .` from shipping it silently.

- [ ] **Step 1: Read the file as it stands**

Run: `cat -n .dockerignore`

Expected: exactly 10 lines, ending `**/*.md`. If it differs, stop and report: the line numbers below are wrong and the plan needs updating before anything is edited.

- [ ] **Step 2: Append the entry with its reason**

Edit `.dockerignore`. Add these four lines at the end, after `**/*.md`:

```
# The prototype. template/compose.yml builds with `context: ..`, so everything
# here goes to the daemon on every stack:up. Nothing copies it today, and this
# line is what keeps a later `COPY . .` from shipping the founder's mailbox.
reference
```

The result is 14 lines. `reference` with no slash and no glob, which is the form `landing`, `archive` and `docs` already use on lines 6 to 8. Task 2's rule accepts a pattern whose first path segment is `reference`; a glob form would not satisfy it, by design.

- [ ] **Step 3: Confirm the file says what it should**

Run: `cat -n .dockerignore`

Expected: 14 lines. Line 14 is exactly `reference`. Lines 1 to 10 are unchanged.

- [ ] **Step 4: Confirm the build context still transfers**

The founder asked for this confirmation. Docker runs in WSL2 in this environment, so commands take the `wsl` prefix.

Run: `wsl docker build --target manifests -t orbit-dockerignore-probe .`

Expected: exit 0, and a successful build of the `manifests` stage. That stage is `Dockerfile:7-15`: it copies the root manifests and the eight workspace `package.json` files and nothing else. A green build proves the context transfers with the new ignore entry in place and that no copy in that stage depended on `reference`.

What this proves and what it does not: it proves the context is still valid and the manifest copies still resolve. It does not build the `generate` or `runtime` stages, and it does not start the stack. Those are covered separately: `guards/image-build.test.ts` asserts the runtime copy list from the repository, `template/test/compose.test.ts` validates the compose file, and both run in Task 5's `pnpm test`.

If `wsl docker build` is unavailable in this environment, say so plainly, record it as not run, and do not claim it passed. `pnpm test` still covers the static assertions.

- [ ] **Step 5: Remove the probe image**

Run: `wsl docker image rm orbit-dockerignore-probe`

Expected: exit 0. Skip this step if Step 4 did not run.

- [ ] **Step 6: Commit**

One command. Nothing chained.

```bash
git add .dockerignore
```

Then, as a separate command:

```bash
git commit -m "build: keep reference out of every docker build context

template/compose.yml builds with context: .., so reference/orbit-os-frontend/
and orbit-os-frontend.zip were sent to the daemon on every stack:up. Nothing
copies them today, so nothing shipped. This entry is what keeps a later
COPY . . from shipping the founder's mailbox without a word.

Finding H1 of the 2026-10-09 security review."
```

---

## Task 2: The guard

**Files:**
- Create: `guards/deploy-surface.test.ts`
- Test: the same file. A guard is its own test, and this one also carries the permanent probes that make it fail on demand.

**Interfaces:**
- Consumes: `REPO_ROOT`, `readRepoFile`, `trackedFiles` from `./lib/walk.ts`; `parse` from `yaml`; the `.dockerignore` as left by Task 1.
- Produces: the exported helpers below. They are exported so the probes can call them with synthetic input, which is how this guard is seen red permanently rather than once.

```ts
export function namesReference(token: string): boolean
export function commandOffenders(value: string): readonly string[]
export function proseSafeOffenders(value: string): readonly string[]
export function dockerfileOffenders(text: string): readonly string[]
export function dockerignoreComplaints(text: string): readonly string[]
export function yamlOffenders(node: unknown, key?: string): readonly string[]
export function scriptOffenders(json: string): readonly string[]
```

**The two kinds of scan, and why there are two.** `commandOffenders` splits on whitespace and flags any token whose first segment is `reference`. It is used where values are paths or commands by construction, so `cp -r reference dist` is caught. `proseSafeOffenders` flags a token only when it carries a separator, or when the whole trimmed value is the path. It is used on every other string, so a step named `Run reference checks` is not a finding. A guard that fires on correct prose gets switched off, and `guards/design-naming.test.ts:16-19` says so in this repository already.

- [ ] **Step 1: Write the file header and the matcher**

Create `guards/deploy-surface.test.ts` with this content:

```ts
// No build or deploy surface names the prototype.
//
// Written because of finding H1 of the 2026-10-09 security review.
// reference/orbit-os-frontend/ holds the founder's mailbox, the founder's name
// and office.orbitumai.com labelled customer zero, and its README line 11 says
// to upload the whole folder as static files. The read-only investigation of
// 2026-10-09 found no path from this repository to that outcome: CI runs no
// deploy step, the Dockerfile has no whole-context copy, Vite's root is
// dashboards/ and its fs.allow names dashboards/ and design/ only. This guard
// is what keeps that true.
//
// It removes no identifier and does not claim to. The folder is read-only by
// the ruling at docs/prd/ORBIT_OS_PRD_v9_0.md:731, so the addresses stay where
// they are, and anybody who serves the folder by hand still publishes them.
// What this guard stops is the machine doing it.
//
// The directory is matched as one exact path segment, never as a substring.
// docs/reference/ is a live distinction that guards/lib/walk.ts:65 exists to
// keep, and a substring rule would fail on it.
//
// Everything is read from a structured position: copy argument lists, parsed
// YAML values, the scripts object, imported config values. Never a whole-file
// grep. These files carry 30-line comment blocks, a grep would fire on them,
// and a guard that fires on a comment gets switched off and takes its real
// rules with it.
import { execFileSync } from 'node:child_process';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { expect, test } from 'vitest';
import { parse } from 'yaml';
import { REPO_ROOT, readRepoFile, trackedFiles } from './lib/walk.ts';

/** The directory this guard protects. One segment, compared exactly. */
const PROTECTED = 'reference';

/**
 * Whether a path token names the top-level reference/ directory.
 *
 * The first segment has to be the whole word, so docs/reference/deep.md,
 * references/ and my-reference/ are all false. Surrounding quotes, a leading
 * ./ and a leading ! are stripped, because the surfaces that carry them write
 * the same path three different ways. Backslashes fold to forward slashes: a
 * Dockerfile is POSIX only, but a package.json script written on Windows is
 * not.
 *
 * The token is cut at its first colon, because a compose volume in short
 * syntax is `./reference:/site:ro` and the host path is the field before the
 * first colon. Without the cut the first segment reads `reference:` and the
 * one surface that mounts a directory by name is the one surface this misses.
 * A Windows drive letter is cut the same way and yields `C`, which is not this
 * directory, so the cut cannot create a false positive.
 */
export function namesReference(token: string): boolean {
  const bare = token
    .trim()
    .replace(/^["'`]+/, '')
    .replace(/["'`]+$/, '')
    .replace(/^!/, '')
    .split(':')[0] ?? '';
  const segments = bare.split(/[\\/]+/).filter((part) => part !== '' && part !== '.');
  return segments[0] === PROTECTED;
}
```

- [ ] **Step 2: Run the file to confirm vitest collects it**

Run: `pnpm exec vitest run --project unit guards/deploy-surface.test.ts`

Expected: FAIL, with vitest reporting no test found in the file. This confirms `vitest.config.ts:22` picks the file up with no configuration change. If it reports the file was not collected at all, stop: the include pattern is not what the plan assumed.

- [ ] **Step 3: Add the two scans and their probes**

Append to `guards/deploy-surface.test.ts`:

```ts
/**
 * Every whitespace-delimited token of a value that is a path or a command.
 *
 * Loose on purpose. These values are never prose, so `cp -r reference dist`
 * has to be a finding.
 */
export function commandOffenders(value: string): readonly string[] {
  return value.split(/\s+/).filter((token) => token !== '' && namesReference(token));
}

/**
 * Offenders in a free-form string, without firing on prose.
 *
 * A token counts only when it carries a separator, or when the whole trimmed
 * value is the path itself. Without that rule a workflow step named "Run
 * reference checks" is a finding, and a guard that fires on correct prose gets
 * switched off.
 *
 * The cost is a known miss: a slash-free token in the middle of a
 * sentence-shaped value is not reported. Command-bearing keys do not come
 * through here, so the miss needs a command hidden under a key that is not one
 * of them. The probes below pin both halves of this.
 */
export function proseSafeOffenders(value: string): readonly string[] {
  const whole = value.trim();
  if (!/\s/.test(whole)) return namesReference(whole) ? [whole] : [];
  return whole.split(/\s+/).filter((token) => /[\\/]/.test(token) && namesReference(token));
}

test('the matcher takes the prototype and leaves docs/reference alone', () => {
  for (const token of [
    'reference',
    'reference/',
    './reference',
    'reference/orbit-os-frontend',
    'reference/orbit-os-frontend/assets/data/people.js',
    '"reference"',
    '!reference',
    'reference\\orbit-os-frontend',
    // A compose volume in short syntax. The host path is the field before the
    // first colon, and this is the one surface that mounts a directory by name.
    './reference:/site:ro',
    'reference/orbit-os-frontend:/site',
  ]) {
    expect(namesReference(token), `${token} names the prototype`).toBe(true);
  }

  for (const token of [
    'docs/reference',
    'docs/reference/deep.md',
    'references',
    'references/',
    'my-reference',
    'dashboards/reference',
    'shared',
    '',
    '.',
    '../reference',
    'C:/reference',
    'docs/reference:/site:ro',
  ]) {
    expect(namesReference(token), `${token} does not name the prototype`).toBe(false);
  }
});

test('a command value is scanned loosely and a prose value is not', () => {
  expect(commandOffenders('cp -r reference dist')).toEqual(['reference']);
  expect(commandOffenders('npx http-server reference/orbit-os-frontend -p 8080')).toEqual([
    'reference/orbit-os-frontend',
  ]);
  expect(commandOffenders('cp -r docs/reference dist')).toEqual([]);

  expect(proseSafeOffenders('reference')).toEqual(['reference']);
  expect(proseSafeOffenders('upload reference/orbit-os-frontend as static files')).toEqual([
    'reference/orbit-os-frontend',
  ]);
  // The documented miss. A slash-free token inside a sentence is left alone, so
  // that a step named after the prototype is not a finding.
  expect(proseSafeOffenders('Run reference checks')).toEqual([]);
  expect(proseSafeOffenders('check the docs/reference notes')).toEqual([]);
});
```

- [ ] **Step 4: Run the probes and watch them pass**

Run: `pnpm exec vitest run --project unit guards/deploy-surface.test.ts`

Expected: PASS, 2 tests. These two are unit probes on synthetic input, so they exercise the rule without touching any surface.

- [ ] **Step 5: Commit the matcher**

```bash
git add guards/deploy-surface.test.ts
```

Then, separately:

```bash
git commit -m "test(guards): exact-segment matcher for the reference directory

First segment compared exactly, so docs/reference/ does not trip it, which is
the distinction guards/lib/walk.ts:65 exists to keep. Two scans: loose for
values that are paths or commands, prose-safe for everything else, so a step
named after the prototype is not a finding.

Finding H1 of the 2026-10-09 security review."
```

- [ ] **Step 6: Write the failing Dockerfile probe**

Append to `guards/deploy-surface.test.ts`:

```ts
test('a copy naming the prototype is reported, and a comment is not', () => {
  expect(dockerfileOffenders('COPY reference reference\n')).toEqual(['reference', 'reference']);
  expect(dockerfileOffenders('ADD reference/orbit-os-frontend /site\n')).toEqual([
    'reference/orbit-os-frontend',
  ]);
  // A wrapped copy. The source is on the second line, and a line-by-line scan
  // would miss it.
  expect(dockerfileOffenders('COPY \\\n  reference /site\n')).toEqual(['reference']);
  // A flag is not a path.
  expect(dockerfileOffenders('COPY --from=build reference /site\n')).toEqual(['reference']);

  expect(dockerfileOffenders('# COPY reference /site\n')).toEqual([]);
  expect(dockerfileOffenders('COPY docs/reference /site\n')).toEqual([]);
  expect(dockerfileOffenders('COPY shared shared\nCOPY db/package.json db/\n')).toEqual([]);
});
```

- [ ] **Step 7: Run it to verify it fails**

Run: `pnpm exec vitest run --project unit guards/deploy-surface.test.ts`

Expected: FAIL with `dockerfileOffenders is not defined`.

- [ ] **Step 8: Write the Dockerfile and Docker ignore extractors**

Insert above the test added in Step 6:

```ts
/** A COPY or ADD instruction and its argument list. Docker instructions are case insensitive. */
const COPY_LINE = /^(?:COPY|ADD)\s+(.+)$/gim;

/**
 * Offending copy arguments in one Dockerfile's text.
 *
 * Line continuations are joined first, so a source written on the second line
 * of a wrapped instruction is seen. Flags are dropped. A --from source names a
 * build stage rather than the context, so it cannot be this directory in
 * practice; it is checked anyway, because over-reporting here costs nothing and
 * a quiet skip is how a guard goes green while checking less than it says.
 *
 * The destination is checked too. A copy writing into a path called reference
 * inside an image is not finding H1, but it is close enough that a person
 * should look.
 */
export function dockerfileOffenders(text: string): readonly string[] {
  const joined = text.replace(/\\\r?\n/g, ' ');
  return [...joined.matchAll(COPY_LINE)].flatMap((match) =>
    (match[1] ?? '')
      .split(/\s+/)
      .filter((argument) => argument !== '' && !argument.startsWith('--'))
      .filter((argument) => namesReference(argument)),
  );
}

/**
 * What is wrong with one .dockerignore's text, as a list of complaints.
 *
 * Two rules. The file has to exclude this directory, because
 * template/compose.yml builds with `context: ..` and the whole repository goes
 * to the daemon on every stack:up; without the entry a later whole-context copy
 * ships the prototype and nothing says a word. And no line may re-include it
 * with a negation, because the last matching pattern in a Docker ignore file
 * wins.
 *
 * Only a pattern whose first segment is the directory counts as excluding it. A
 * glob form would work in Docker and does NOT satisfy this rule. That is
 * deliberate: accepting more forms means reasoning about Docker's pattern
 * precedence, which this guard does not do, and the plain form is the one the
 * file already uses for landing, archive and docs.
 */
export function dockerignoreComplaints(text: string): readonly string[] {
  const lines = text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '' && !line.startsWith('#'));

  const complaints: string[] = [];
  if (!lines.some((line) => !line.startsWith('!') && namesReference(line))) {
    complaints.push(`no line excludes ${PROTECTED}/`);
  }
  for (const line of lines) {
    if (line.startsWith('!') && namesReference(line)) complaints.push(`${line} re-includes ${PROTECTED}/`);
  }
  return complaints;
}
```

- [ ] **Step 9: Run it to verify the Dockerfile probe passes**

Run: `pnpm exec vitest run --project unit guards/deploy-surface.test.ts`

Expected: PASS, 3 tests.

- [ ] **Step 10: Write the Docker ignore probe, including the deliberate narrowness**

Append to `guards/deploy-surface.test.ts`:

```ts
test('a docker ignore file that drops the prototype, or takes it back, is reported', () => {
  expect(dockerignoreComplaints('landing\narchive\nreference\n')).toEqual([]);
  expect(dockerignoreComplaints('# reference is handled elsewhere\nlanding\n')).toEqual([
    'no line excludes reference/',
  ]);
  expect(dockerignoreComplaints('reference\n!reference/orbit-os-frontend\n')).toEqual([
    '!reference/orbit-os-frontend re-includes reference/',
  ]);
  // Review Focus 4. A glob form would work in Docker and does not satisfy this
  // rule, because the rule does not reason about pattern precedence. The plain
  // form is the one the file already uses.
  expect(dockerignoreComplaints('landing\n**/reference\n')).toEqual(['no line excludes reference/']);
  // docs/reference/ is not this directory, so it proves nothing either way.
  expect(dockerignoreComplaints('docs/reference\n')).toEqual(['no line excludes reference/']);
});
```

- [ ] **Step 11: Write the YAML and manifest probes, including the documented miss**

Append to `guards/deploy-surface.test.ts`:

```ts
test('a YAML artifact path, served root or volume naming the prototype is reported', () => {
  expect(yamlOffenders(parse('jobs:\n  e2e:\n    steps:\n      - with:\n          path: reference\n'))).toEqual([
    'path: reference',
  ]);
  expect(
    yamlOffenders(
      parse('jobs:\n  e2e:\n    steps:\n      - with:\n          path: |\n            reference/orbit-os-frontend\n'),
    ),
  ).toEqual(['path: reference/orbit-os-frontend']);
  expect(yamlOffenders(parse('jobs:\n  e2e:\n    steps:\n      - run: npx http-server reference -p 8080\n'))).toEqual([
    'run: reference',
  ]);
  expect(yamlOffenders(parse('services:\n  web:\n    volumes:\n      - ./reference:/site:ro\n'))).toEqual([
    'volumes: ./reference:/site:ro',
  ]);

  // A comment is not a finding. parse() drops comments, so this is structural
  // rather than a rule, and the probe records it.
  expect(
    yamlOffenders(parse('jobs:\n  e2e:\n    # deploy reference/orbit-os-frontend one day\n    steps: []\n')),
  ).toEqual([]);
  // Prose under a key that is not a path key is left alone.
  expect(yamlOffenders(parse('jobs:\n  e2e:\n    steps:\n      - name: Run reference checks\n'))).toEqual([]);
  // Review Focus 2. The documented miss: a command under a key that is not a
  // path key, with no separator on the token.
  expect(yamlOffenders(parse('jobs:\n  e2e:\n    steps:\n      - shell: cp -r reference dist\n'))).toEqual([]);
  // The same command under a path key IS reported.
  expect(yamlOffenders(parse('jobs:\n  e2e:\n    steps:\n      - run: cp -r reference dist\n'))).toEqual([
    'run: reference',
  ]);

  expect(yamlOffenders(parse('jobs:\n  e2e:\n    steps:\n      - with:\n          path: docs/reference\n'))).toEqual([]);
});

test('a package script naming the prototype is reported', () => {
  expect(scriptOffenders('{"scripts":{"preview":"npx http-server reference -p 8080"}}')).toEqual([
    'preview: reference',
  ]);
  expect(scriptOffenders('{"scripts":{"build":"cp -r reference/orbit-os-frontend dist"}}')).toEqual([
    'build: reference/orbit-os-frontend',
  ]);
  expect(scriptOffenders('{"scripts":{"lint":"eslint ."}}')).toEqual([]);
  expect(scriptOffenders('{"scripts":{"docs":"cp -r docs/reference out"}}')).toEqual([]);
  expect(scriptOffenders('{"name":"x"}')).toEqual([]);
});
```

- [ ] **Step 12: Run it to verify both fail**

Run: `pnpm exec vitest run --project unit guards/deploy-surface.test.ts`

Expected: FAIL with `yamlOffenders is not defined` and `scriptOffenders is not defined`.

- [ ] **Step 13: Write the YAML walker, the manifest reader and the surface discovery**

Insert above the tests added in Step 11:

```ts
/**
 * Keys whose values are paths or commands, so their tokens get the loose scan.
 *
 * Everything not listed here is scanned prose-safely. A key added to this list
 * widens what is reported, never narrows it.
 */
const PATH_KEYS: ReadonlySet<string> = new Set([
  'run',
  'command',
  'entrypoint',
  'args',
  'path',
  'paths',
  'working-directory',
  'cwd',
  'context',
  'dockerfile',
  'volumes',
  'env_file',
]);

/**
 * Offenders anywhere in one parsed YAML document.
 *
 * `key` is the mapping key the current value sits under, and it chooses the
 * scan. An array inherits its parent's key, so each entry of a volumes list is
 * treated as a path.
 *
 * Comments are already gone: parse() returns values only. That is deliberate
 * and recorded in the probes. A comment ships nothing.
 */
export function yamlOffenders(node: unknown, key?: string): readonly string[] {
  if (typeof node === 'string') {
    const found = key !== undefined && PATH_KEYS.has(key) ? commandOffenders(node) : proseSafeOffenders(node);
    return found.map((token) => (key === undefined ? token : `${key}: ${token}`));
  }
  if (Array.isArray(node)) return node.flatMap((child) => yamlOffenders(child, key));
  if (node !== null && typeof node === 'object') {
    return Object.entries(node).flatMap(([childKey, child]) => yamlOffenders(child, childKey));
  }
  return [];
}

/**
 * Offenders in one package.json's scripts.
 *
 * A script value is a command, never prose, so the loose scan is right here. A
 * scripts field that is present but not an object throws rather than being
 * skipped: this guard cannot reason about it, and going quiet is how a guard
 * reports green while checking nothing.
 */
export function scriptOffenders(json: string): readonly string[] {
  const parsed: unknown = JSON.parse(json);
  const scripts = (parsed as { scripts?: unknown }).scripts;
  if (scripts === undefined) return [];
  if (scripts === null || typeof scripts !== 'object' || Array.isArray(scripts)) {
    throw new Error('scripts is present but is not an object');
  }
  return Object.entries(scripts).flatMap(([name, value]) =>
    typeof value === 'string' ? commandOffenders(value).map((token) => `${name}: ${token}`) : [],
  );
}

/**
 * The classes of tracked file this guard reads, and the pattern that finds each.
 *
 * Discovery is through trackedFiles(), so an untracked local override is
 * invisible here. That is the same choice guards/lib/walk.ts:46 makes, for the
 * same reason: an untracked scratch file must not fail a guard locally while
 * CI passes. It is Review Focus 3 of the plan, and it is stated in the
 * decisions entry.
 *
 * Each floor is the count in this repository on 2026-10-09. It is a floor and
 * not an equality, so adding a surface is not a failure and losing one is.
 */
const SURFACES = [
  { name: 'dockerfile', pattern: /(^|\/)Dockerfile$/, floor: 2 },
  { name: 'dockerignore', pattern: /(^|\/)\.dockerignore$/, floor: 1 },
  { name: 'compose', pattern: /(^|\/)[^/]*compose[^/]*\.ya?ml$/, floor: 2 },
  { name: 'workflow', pattern: /^\.github\/workflows\/[^/]+\.ya?ml$/, floor: 1 },
  { name: 'manifest', pattern: /(^|\/)package\.json$/, floor: 9 },
  { name: 'vite', pattern: /(^|\/)vite\.config\.[cm]?[jt]s$/, floor: 1 },
  { name: 'playwright', pattern: /(^|\/)playwright\.config\.[cm]?[jt]s$/, floor: 1 },
] as const;

/** Tracked files of one class. node_modules is excluded: those manifests are not ours. */
const filesOf = (pattern: RegExp): readonly string[] =>
  trackedFiles().filter((file) => pattern.test(file) && !file.includes('node_modules/'));

/**
 * A tracked file's text, falling back to the index when it is gone from disk.
 *
 * git lists a file it still tracks after an unstaged delete, and reading the
 * disk then throws. Without the fallback this guard crashes on somebody's
 * half-finished delete while CI, which has a clean checkout, passes. That is
 * the failure guards/lib/walk.ts:46 exists to avoid, and
 * guards/paths.test.ts:43 already solves it this way. The fallback is not a
 * silent skip: the committed content is still checked, which is what this
 * guard is about. Any error other than a missing file propagates.
 */
function readTracked(rel: string): string {
  try {
    return readRepoFile(rel);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
    return execFileSync('git', ['show', `:${rel}`], { cwd: REPO_ROOT, encoding: 'utf8' });
  }
}
```

- [ ] **Step 14: Run it to verify the YAML and manifest probes pass**

Run: `pnpm exec vitest run --project unit guards/deploy-surface.test.ts`

Expected: PASS, 6 tests.

- [ ] **Step 15: Commit the extractors**

```bash
git add guards/deploy-surface.test.ts
```

Then, separately:

```bash
git commit -m "test(guards): extractors for each build and deploy surface class

Structured positions only: copy argument lists, parsed YAML values, the
scripts object. Never a whole-file grep, because these files carry 30-line
comment blocks and a guard that fires on a comment gets switched off.

Each extractor has a probe with synthetic input, so the rule is seen red in
its own suite and not only once by hand.

Finding H1 of the 2026-10-09 security review."
```

- [ ] **Step 16: Write the real-surface assertions and the floors**

Append to `guards/deploy-surface.test.ts`:

```ts
test('no tracked Dockerfile copies the prototype', () => {
  const offenders = filesOf(SURFACES[0].pattern).flatMap((file) =>
    dockerfileOffenders(readTracked(file)).map((token) => `${file}: ${token}`),
  );

  expect(offenders, 'the image must not carry the prototype').toEqual([]);
});

test('the docker ignore file keeps the prototype out of every build context', () => {
  const complaints = filesOf(SURFACES[1].pattern).flatMap((file) =>
    dockerignoreComplaints(readTracked(file)).map((complaint) => `${file}: ${complaint}`),
  );

  expect(
    complaints,
    'template/compose.yml builds with context: .., so the whole repository goes to the daemon',
  ).toEqual([]);
});

test('no tracked compose file or workflow names the prototype', () => {
  const files = [...filesOf(SURFACES[2].pattern), ...filesOf(SURFACES[3].pattern)];
  const offenders = files.flatMap((file) => {
    const text = readTracked(file);
    // parse() returns the FIRST document only, so a multi-document file would
    // be half read and the rest never checked. It throws instead.
    if (/^---\s*$/m.test(text.replace(/^---\s*\r?\n/, ''))) {
      throw new Error(`${file}: multi-document YAML is not handled`);
    }
    return yamlOffenders(parse(text)).map((token) => `${file}: ${token}`);
  });

  expect(offenders, 'no served root, volume or artifact path may be the prototype').toEqual([]);
});

test('no package script names the prototype', () => {
  const offenders = filesOf(SURFACES[4].pattern).flatMap((file) =>
    scriptOffenders(readTracked(file)).map((token) => `${file}: ${token}`),
  );

  expect(offenders, 'no script may serve or copy the prototype').toEqual([]);
});

test('this guard examined every surface class, and enough of each', () => {
  // Every assertion above passes vacuously over zero files. A rename, a move or
  // a pattern that stopped matching would cause exactly that, and the guard
  // would stay green while checking nothing.
  const short = SURFACES.filter((surface) => filesOf(surface.pattern).length < surface.floor).map(
    (surface) => `${surface.name}: ${filesOf(surface.pattern).length} found, ${surface.floor} expected`,
  );

  expect(short, 'a surface class stopped matching, so this guard checks less than it says').toEqual([]);

  const total = SURFACES.reduce((sum, surface) => sum + filesOf(surface.pattern).length, 0);
  expect(total, 'no surface was examined at all').toBeGreaterThanOrEqual(17);
});

test('the surface list is the seven classes that were reviewed, and no fewer', () => {
  // Review Focus 1. A deploy config of a kind nobody anticipated is invisible
  // to this guard, and the prototype README names Coolify, Netlify and
  // Cloudflare Pages by name. Pinning the list means adding an eighth kind of
  // deploy descriptor without widening the guard is a visible failure here,
  // rather than a silent gap. Written out by hand, never looped from SURFACES,
  // because a loop would shrink with the list it is meant to pin.
  expect(SURFACES.map((surface) => surface.name)).toEqual([
    'dockerfile',
    'dockerignore',
    'compose',
    'workflow',
    'manifest',
    'vite',
    'playwright',
  ]);
});
```

- [ ] **Step 17: Run the real-surface assertions**

Run: `pnpm exec vitest run --project unit guards/deploy-surface.test.ts`

Expected: PASS, 12 tests. Every real-surface assertion is green on arrival. That is the point of Step 22's live probe: a guard never seen red against a real surface is not a guard.

- [ ] **Step 18: Write the resolved Vite and Playwright assertions**

Append to `guards/deploy-surface.test.ts`:

```ts
/** Whether a resolved absolute path is the protected directory or anything inside it. */
function insideProtected(target: string): boolean {
  const rel = relative(join(REPO_ROOT, PROTECTED), target);
  return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel));
}

/**
 * The default export of one config, settled.
 *
 * defineConfig passes its argument through, but the type it returns also
 * covers a function and a promise, and a config may legitimately be either.
 * This is the shape guards/vite-fs-allow.test.ts:51 already uses, for the
 * reason its header gives: resolving the values is the only check that cannot
 * be satisfied by renaming a variable.
 */
async function settledConfig(config: string): Promise<unknown> {
  const absolute = join(REPO_ROOT, config);
  const loaded: unknown = await import(pathToFileURL(absolute).href);
  const exported = (loaded as { default?: unknown }).default;
  return typeof exported === 'function'
    ? await (exported as (env: { command: string; mode: string }) => unknown)({
        command: 'build',
        mode: 'production',
      })
    : await exported;
}

/** Resolve a config-relative path against the directory holding the config. */
const against = (config: string, entry: string): string =>
  isAbsolute(entry) ? entry : resolve(dirname(join(REPO_ROOT, config)), entry);

/** Every declared build input of one settled Vite config, as written. */
function viteInputs(settled: unknown): readonly string[] {
  const input = (settled as { build?: { rollupOptions?: { input?: unknown } } } | undefined)?.build?.rollupOptions
    ?.input;
  if (input === undefined) return [];
  if (typeof input === 'string') return [input];
  if (Array.isArray(input)) return input.map((entry) => String(entry));
  if (input !== null && typeof input === 'object') return Object.values(input).map((entry) => String(entry));
  // Not skipped. A shape this cannot read is a shape it cannot judge.
  throw new Error('build.rollupOptions.input is neither a string, an array nor an object');
}

/** The fs.allow list of one settled Vite config, or undefined when it sets none. */
function viteAllow(settled: unknown): readonly string[] | undefined {
  const allow = (settled as { server?: { fs?: { allow?: unknown } } } | undefined)?.server?.fs?.allow;
  if (allow === undefined) return undefined;
  if (!Array.isArray(allow)) throw new Error('server.fs.allow is not an array');
  return allow.map((entry: unknown) => {
    if (typeof entry !== 'string') throw new Error('server.fs.allow holds a non-string entry');
    return entry;
  });
}

test('no vite config builds from the prototype or serves it', async () => {
  const offenders: string[] = [];
  let checked = 0;

  for (const config of filesOf(SURFACES[5].pattern)) {
    const settled = await settledConfig(config);

    for (const entry of viteInputs(settled)) {
      checked += 1;
      if (insideProtected(against(config, entry))) offenders.push(`${config}: input ${entry}`);
    }
    for (const entry of viteAllow(settled) ?? []) {
      checked += 1;
      if (insideProtected(against(config, entry))) offenders.push(`${config}: fs.allow ${entry}`);
    }
  }

  expect(offenders, 'the prototype is not a build input and not a served directory').toEqual([]);
  // Three inputs and two allow entries in dashboards/vite.config.ts today.
  expect(checked, 'no vite input or fs.allow entry was examined').toBeGreaterThanOrEqual(5);
});

test('no playwright config serves the prototype', async () => {
  const offenders: string[] = [];
  let checked = 0;

  for (const config of filesOf(SURFACES[6].pattern)) {
    const settled = await settledConfig(config);
    const typed = settled as {
      testDir?: unknown;
      outputDir?: unknown;
      webServer?: readonly { command?: unknown; cwd?: unknown }[] | { command?: unknown; cwd?: unknown };
    };

    const servers = typed.webServer === undefined ? [] : [typed.webServer].flat();
    const values: readonly unknown[] = [
      typed.testDir,
      typed.outputDir,
      ...servers.flatMap((server) => [server.command, server.cwd]),
    ];

    for (const value of values) {
      if (typeof value !== 'string') continue;
      checked += 1;
      for (const token of commandOffenders(value)) offenders.push(`${config}: ${token}`);
    }
  }

  expect(offenders, 'no end-to-end server may serve the prototype').toEqual([]);
  // testDir plus two webServer commands in playwright.config.ts today.
  expect(checked, 'no playwright server command was examined').toBeGreaterThanOrEqual(3);
});
```

- [ ] **Step 19: Run the resolved assertions**

Run: `pnpm exec vitest run --project unit guards/deploy-surface.test.ts`

Expected: PASS, 14 tests.

If `settledConfig` fails on `playwright.config.ts` because importing `@playwright/test` has a side effect this plan did not anticipate, do not skip the config. Replace the import with a read of the `webServer` command strings by regex over the file text, say so in the file header, and record the change in the decisions entry. A skipped surface is a guard that checks less than it claims.

- [ ] **Step 20: Typecheck and lint the new file**

Run: `pnpm typecheck`

Expected: exit 0.

Then, as a separate command:

Run: `pnpm lint`

Expected: exit 0.

- [ ] **Step 21: Commit the guard**

```bash
git add guards/deploy-surface.test.ts
```

Then, separately:

```bash
git commit -m "test(guards): fail if any build or deploy surface names reference/

Seven classes of tracked surface: Dockerfile, .dockerignore, compose files,
workflows, package manifests, the Vite config and the Playwright config. The
prohibited forms are a copy source, a Vite input, an fs.allow entry, a served
root and an artifact path.

The Vite and Playwright configs are imported and their values resolved, not
grepped, for the reason guards/vite-fs-allow.test.ts gives: a text scan passes
on an identifier defined three lines higher.

Per-class floors and a total floor of 17, so a rename that stopped a pattern
matching fails here instead of going quiet. The surface list is pinned by hand,
so an eighth kind of deploy descriptor cannot be added without widening the
guard.

Finding H1 of the 2026-10-09 security review."
```

- [ ] **Step 22: Probe the guard against each real surface, one form at a time**

The guard is green on arrival. This step makes it red seven times, once per surface class, and captures the output for the decisions entry. **A guard never seen red is not a guard.**

Rules for this step:
- Never probe anything under `reference/`, and never probe a file in a frozen directory. The seven files below are all outside both.
- Before editing each file, confirm it is clean, so the restore discards only the probe.
- Restore with `git checkout --` and verify the restore before moving to the next file.
- Record every failure line. Task 4 quotes them.

| Surface class | File to probe | What to insert | Expected failing test |
| --- | --- | --- | --- |
| dockerfile | `Dockerfile` | a line `COPY reference reference` | `no tracked Dockerfile copies the prototype` |
| dockerignore | `.dockerignore` | a line `!reference/orbit-os-frontend` | `the docker ignore file keeps the prototype out of every build context` |
| compose | `compose.dev.yml` | under `redis:`, `    volumes: ["./reference:/site:ro"]` | `no tracked compose file or workflow names the prototype` |
| workflow | `.github/workflows/ci.yml` | in the artifact step's `path:` block, a line `            reference/orbit-os-frontend` | `no tracked compose file or workflow names the prototype` |
| manifest | `package.json` | in `scripts`, `"probe:deploy": "npx http-server reference -p 8080",` | `no package script names the prototype` |
| vite | `dashboards/vite.config.ts` | in `rollupOptions.input`, `probe: '../reference/orbit-os-frontend/fleet/index.html',` | `no vite config builds from the prototype or serves it` |
| playwright | `playwright.config.ts` | change the first `webServer` command to `'npx http-server reference -p 4318 -s'` | `no playwright config serves the prototype` |

For each row, run these five, with `<FILE>` replaced by the file from the row:

1. `git status --porcelain <FILE>`
   Expected: empty output. If anything is printed, stop: the file has uncommitted work and the restore in step 4 would discard it.
2. Edit `<FILE>` to add the line from the row.
3. `pnpm exec vitest run --project unit guards/deploy-surface.test.ts`
   Expected: **FAIL**, and the failure names `<FILE>` and the offending token. Copy the failing assertion's message verbatim.
4. `git checkout -- <FILE>`
   Expected: exit 0.
5. `git status --porcelain <FILE>`
   Expected: empty output. The probe is gone.

After all seven rows:

Run: `git status --porcelain`

Expected: only `?? ORBIT_OS_PRD_v8_0.docx`, which was untracked before this work started and is not ours to touch.

Then, as a separate command:

Run: `pnpm exec vitest run --project unit guards/deploy-surface.test.ts`

Expected: PASS, 14 tests. The guard is green again, and it has now been red against every surface class it claims to read.

Write the seven captured failure messages to `docs/superpowers/plans/2026-10-09-h1-probe-output.txt` so Task 4 can quote them without re-running anything. That file is a working note, not a decision, and Task 4 deletes it.

---

## Task 3: Prove the guard still agrees with the whole suite

**Files:**
- No change. This task runs checks.

**Interfaces:**
- Consumes: the guard from Task 2 and the `.dockerignore` from Task 1.
- Produces: the confirmation Task 4's entry records.

**Why this is its own task.** A new guard can pass alone and break a neighbour. `guards/lint-config.test.ts` pins the ESLint ignore list and `guards/paths.test.ts` reads every tracked text file for the old prototype path, so a new file under `guards/` is inside both their scopes.

- [ ] **Step 1: Bring the database up, which `pnpm test` needs**

Run: `pnpm db:up`

Expected: exit 0. Per CLAUDE.md section 7 this is required before `pnpm test`. Docker is in WSL2 here; if `pnpm db:up` cannot reach the engine, start it and retry rather than skipping the database project.

- [ ] **Step 2: Generate the Prisma client**

Run: `pnpm db:generate`

Expected: exit 0.

- [ ] **Step 3: Run the whole suite**

Run: `pnpm test`

Expected: exit 0. If `guards/lint-config.test.ts` or `guards/paths.test.ts` fails, read the failure before changing anything: the cause is likely the new file's path or a string inside it, not the guard's logic.

- [ ] **Step 4: Run the decisions-log guard on its own, before the log is touched**

Run: `pnpm exec vitest run --project unit guards/decisions-log.test.ts`

Expected: exit 0, 3 tests. This is the baseline. Task 4 runs it again after appending, and a failure there is then unambiguously the new entry.

---

## Task 4: Record the decision

**Files:**
- Modify: `docs/decisions.md` (append one entry at the end)
- Read, then delete: `docs/superpowers/plans/2026-10-09-h1-probe-output.txt` from Task 2, Step 22

**Interfaces:**
- Consumes: the probe output from Task 2, the confirmations from Task 3.
- Produces: the entry `## 2026-10-09 - H1: a guard on the deploy surfaces, the prototype out of the Docker context, and the folder left as it is`.

**The six elements the founder required.** Every one must be present:

1. The investigation's section 5 finding: no deploy path exists today, and what that rests on.
2. Option (b) rejected, with the reason.
3. Option (c) deferred, with the trigger stated as an **event**, not a date, plus its cost and what it breaks.
4. The three personal identifiers that remain, where they are, and a plain statement that neither change removes them.
5. The local-server habit, recorded as a habit to change and not a code fix.
6. The correction to the review's H1 wording, marked `**Corrects:**`.

- [ ] **Step 1: Confirm the heading count, so the entry lands at the end**

Run: `grep -c "^## " docs/decisions.md`

Expected: a number at or above 49. Note it: Step 4 checks it grew by exactly one.

- [ ] **Step 2: Append the entry**

Append this to the end of `docs/decisions.md`. Replace each `<probe N>` with the verbatim failure message captured in Task 2, Step 22, and replace nothing else.

````markdown
## 2026-10-09 - H1: a guard on the deploy surfaces, the prototype out of the Docker context, and the folder left as it is

**Reason:** finding H1 of the 2026-10-09 security review reported that
`reference/orbit-os-frontend/` holds the founder's mailbox, the founder's name
and `office.orbitumai.com` labelled customer zero, that its README says to
upload the whole folder as static files, and that no guard reads it. A
read-only investigation on 2026-10-09 checked what could act on that
instruction. Three things were decided from it: add a guard on the deploy
surfaces, keep the folder out of every Docker build context, and leave the
folder itself alone.

**What the investigation found, and what the finding rests on.** No path exists
today from this repository to a deployed copy of the prototype. Four things
carry that claim. CI runs no deploy step at all: `.github/workflows/ci.yml`
installs, audits, typechecks, lints, runs the frozen lint, the screen checks,
the tests, the end-to-end suite, the secret scan and the compose smoke check,
and its one artifact upload names `playwright-report/` and `test-results/` on
failure. The image cannot carry the folder: `Dockerfile` has no whole-context
copy and copies `shared`, `db` and the selected app only. The Vite bundle
cannot carry it: Vite's root is `dashboards/` and `build.rollupOptions.input`
names three HTML files under it. The dev server cannot read it:
`server.fs.allow` in `dashboards/vite.config.ts` names `dashboards/` and
`design/` and nothing else. The only other static server in the repository
serves `e2e/fixture`.

**What was added.** `guards/deploy-surface.test.ts` reads seven classes of
tracked surface and fails if any names the top-level `reference/` directory as
a copy source, a Vite input, an `fs.allow` entry, a served root or an artifact
path. The classes are Dockerfiles, the Docker ignore file, compose files,
workflow files, package manifests, Vite configs and Playwright configs:
seventeen tracked files today, and each class carries its own floor so a
rename that stopped a pattern matching fails here rather than going quiet. The
directory is matched as one exact path segment, so `docs/reference/` does not
trip it, which is the distinction `guards/lib/walk.ts:65` exists to keep. The
Vite and Playwright configs are imported and their values resolved rather than
grepped, for the reason `guards/vite-fs-allow.test.ts` gives in its own header:
a text scan passes on an identifier defined three lines higher.

**The guard was seen red against every class before it was committed.** It is
green on arrival, and a guard never seen red is not a guard. Each prohibited
form was written into one real surface outside `reference/` and outside the
seven frozen directories, the guard was run, the failure was read, and the file
was restored and confirmed clean. Seven probes, seven failures:

```
<probe 1>
<probe 2>
<probe 3>
<probe 4>
<probe 5>
<probe 6>
<probe 7>
```

The guard also carries permanent probes on synthetic input, one per rule, so it
stays red on demand rather than only once by hand.

**The Docker build context.** `reference` was added to `.dockerignore`.
`template/compose.yml` builds with `context: ..`, so the whole repository goes
to the daemon on every `pnpm stack:up`, and the ignore file listed `landing`,
`archive`, `docs`, `.superpowers` and every markdown file but not `reference`.
Nothing copies the folder today, so nothing shipped, and the entry is what
keeps a later whole-context copy from shipping the founder's mailbox without a
word. The build context was confirmed to still transfer afterwards.

**Option (b), a note at the top of the prototype README contradicting its
deploy instruction, was rejected.** `reference/` is read-only by the ruling at
`docs/prd/ORBIT_OS_PRD_v9_0.md:731`, which is the same ruling that settled the
page-title question: editing the prototype makes the spec disagree with the
artifact it documents. A note is also enforced by nothing. `reference/` is
excluded from lint and typecheck and no guard reads its contents, so a later
edit could delete the note and the suite would stay green. And a note removes
no identifier.

**Option (c), extracting the behaviour and copy spec and removing the folder,
is deferred, and the trigger is an event and not a date.** Do it when either of
these happens: this repository stops being private, or the prototype stops
being cited as a behaviour spec. The second is the likelier one, and it arrives
on its own as `dashboards/` is built out.

What (c) would cost: reading all 36 files and writing down, as prose a future
implementer can follow, the flows, validation rules, copy strings, empty states
and error text that currently exist only as working code. Then updating every
citation: `dashboards/CLAUDE.md`, `docs/prd/ORBIT_OS_PRD_v9_0.md`,
`docs/backlog.md` and six prompts in `ORBIT-OS_Claude_Code_Build_Prompts.md`
that say to match a named prototype screen. Then deleting the untracked zip at
the repository root.

What (c) would break: `guards/paths.test.ts` fails on its first assertion, that
the prototype README exists, and again on its check that every prototype path
cited by the build prompts and the dashboards rules resolves on disk.
`guards/lib/walk.test.ts` fails on its assertion that the walk finds files
under the prototype directory. Every exclusion listed in the guards and both
ESLint configs becomes dead configuration. All three have to be rewritten in
the same change, not after it. And the extraction is lossy in a way that is
hard to see until it bites: a prototype answers questions nobody thought to
ask, and `ORBIT-OS_Claude_Code_Build_Prompts.md` tells an implementer to open
the reference screen and compare step by step. After removal there is no screen
to open.

**What none of this removes.** Three personal identifiers stay exactly where
they are. `shuv@orbitumai.com` at
`reference/orbit-os-frontend/assets/data/fleet.js:4` and again at
`reference/orbit-os-frontend/dist/preview.html:392`. The hardcoded
`Shuv Chowdhury` / `Operator` identity at
`reference/orbit-os-frontend/assets/shell.js:15` and at
`reference/orbit-os-frontend/dist/preview.html:576`. And
`office.orbitumai.com`, labelled customer zero, at the same two `fleet.js` and
`preview.html` lines. Five addresses at `brightpath.co`, a real registrable
domain, stay in `reference/orbit-os-frontend/assets/data/people.js:3-7` and
`reference/orbit-os-frontend/dist/preview.html:315-319`. The guard and the
Docker ignore entry remove none of them. They stop this repository's machinery
from publishing the folder. Anybody who serves it by hand still publishes every
one.

**A habit to change, not a code fix.** The prototype README,
`dashboards/CLAUDE.md:45` and `ORBIT-OS_Claude_Code_Build_Prompts.md` all say
to run `python3 -m http.server` inside the prototype folder. That command binds
to every interface, not to loopback, so following it puts the founder's
mailbox, the customer-zero domain and the unauthenticated operator page on the
local network for as long as the server is up.
`reference/orbit-os-frontend/fleet/index.html:13` sets the operator role in a
script tag and there is no authentication anywhere in the folder, so a visitor
on that network is the Super Admin. The fix is to run it bound to loopback. It
is recorded here as a habit because the instruction sits in a read-only folder
and in two documents that a guard cannot sensibly police, and because no code
change makes an operator type a different command.

**What this guard does not cover.** Three gaps, stated so a green run is not
read as more than it is. It reads seven classes of surface, so a deploy
descriptor of a kind nobody anticipated, such as a Netlify, Vercel, Cloudflare
or Coolify configuration file, is invisible to it; the class list is pinned by
hand so that adding one without widening the guard fails, but the guard cannot
know about a kind that does not exist here yet. It discovers surfaces through
`git ls-files`, so an untracked local compose override naming the prototype
passes, which is the same choice `guards/lib/walk.ts` makes so that an
untracked scratch file cannot fail a guard locally while CI passes. And in a
free-form string under a key it does not treat as a path, a bare directory name
with no separator is not reported, because the alternative fires on a step
named after the prototype, and a guard that fires on correct prose gets
switched off.

**Corrects:** the H1 row of the 2026-10-09 security review entry says
`reference/` is excluded from the guards by name in `guards/paths.test.ts`. The
list named `NOT_OURS` is in `guards/standing-rules.test.ts:46`. The equivalent
list in `guards/paths.test.ts` is called `SKIP_AT_ROOT`, on line 7. Both
exclude the folder, so the finding's conclusion is unchanged. One further
detail: `guards/paths.test.ts` does read `reference/`, at lines 11 and 70 to
90, where it asserts the README exists and that every prototype path cited by
the build prompts and the dashboards rules resolves on disk. It reads paths and
never file contents, so no guard has ever read the folder for addresses, names
or domains.

**Cost if wrong:** low on what was done, high on what was deferred. The guard
and the ignore entry are reversible in one commit and neither can publish
anything. The deferral is the exposure that stays: three personal identifiers
sit in a committed folder whose own README says to upload it, and a published
operator address cannot be unpublished. The trigger is an event rather than a
date so that it fires when the risk actually changes, and the risk changes the
moment this repository stops being private.
````

- [ ] **Step 3: Run the decisions-log guard**

The founder asked for this before the log is committed.

Run: `pnpm exec vitest run --project unit guards/decisions-log.test.ts`

Expected: exit 0, 3 tests. If `every entry says why` fails, the new entry's `**Reason:**` is inside a code span or a fenced block; move it. If `a superseded entry names the dated entry that replaces it` fails, the entry contains the string `**Superseded`, which it must not: the marker is `**Corrects:**`.

- [ ] **Step 4: Confirm the log grew by exactly one entry**

Run: `grep -c "^## " docs/decisions.md`

Expected: the number from Step 1, plus one.

- [ ] **Step 5: Remove the probe working note**

Run: `rm docs/superpowers/plans/2026-10-09-h1-probe-output.txt`

Expected: exit 0. Its contents are now quoted in the log, which is where they belong.

- [ ] **Step 6: Commit**

```bash
git add docs/decisions.md docs/superpowers/plans/2026-10-09-h1-deploy-surface-guard.md
```

Then, separately:

```bash
git commit -m "docs(decisions): H1, a guard on the deploy surfaces and reference out of the docker context

Records that no deploy path exists today and what that rests on, the seven
probe failures that prove the guard can fail, option (b) rejected because
reference/ is read-only by the PRD ruling and a note removes no identifier,
and option (c) deferred on an event rather than a date.

Says plainly that neither change removes shuv@orbitumai.com, the hardcoded
operator identity or office.orbitumai.com, and records the unbound
http.server habit as a habit.

Corrects the review's H1 wording: NOT_OURS is in
guards/standing-rules.test.ts, not guards/paths.test.ts."
```

---

## Task 5: The Done checks, the review, and the push

**Files:**
- No change. This task verifies and ships.

**Interfaces:**
- Consumes: everything from Tasks 1 to 4.
- Produces: a pushed branch with a green CI run, or a clear statement that the push was denied.

**The founder's rules for this task, which override any habit:** run each Done check separately and read each exit code on its own. Never chain `git commit` or `git push` onto a grep, a pipe or a test run. Gate on `gh run view --json status,conclusion`. If the push is denied, say so and stop.

- [ ] **Step 1: Request a code review before the push**

CLAUDE.md section 7 requires a security review of every code diff in a fresh session that reads only the diff. PLUGINS.md makes `superpowers:requesting-code-review` the owner of the review step.

Invoke the `superpowers:requesting-code-review` skill. Hand the reviewer the diff of this branch against its merge base and nothing else. Record the result in `docs/decisions.md` as section 7 requires. Fix what the review finds, or record why a finding is not fixed.

- [ ] **Step 2: Run each Done check, one command at a time**

Each of these is its own Bash call. Read the exit code before running the next.

1. `pnpm install --frozen-lockfile`
2. `pnpm audit --audit-level=high`
3. `pnpm typecheck`
4. `pnpm lint`
5. `pnpm lint:frozen:danger`
6. `pnpm check:screens`
7. `pnpm test`
8. `pnpm e2e`

Expected: exit 0 from each. If any is not 0, stop and report that command and its output. Do not continue to the push with a red check.

- [ ] **Step 3: Confirm the working tree holds only what it should**

Run: `git status --porcelain`

Expected: only `?? ORBIT_OS_PRD_v8_0.docx`. Nothing under `reference/`. No env file. If anything else appears, stop and report it.

- [ ] **Step 4: Confirm nothing under reference/ was touched**

Run: `git diff --stat origin/main...HEAD -- reference/`

Expected: empty output. If it is not empty, stop: the read-only ruling was broken and the change cannot go up.

- [ ] **Step 5: Push**

Run: `git push -u origin stream-0/seam-and-contract`

Expected: exit 0. If the push is denied, say so plainly and stop. The founder runs it.

- [ ] **Step 6: Gate on the CI conclusion**

Do not read `gh run watch --exit-status` as a gate. The 2026-10-08 entry at `docs/decisions.md:2436` records why it cannot be used as one.

Run: `gh run list --branch stream-0/seam-and-contract --limit 1 --json databaseId,status,conclusion`

Note the `databaseId`. Then, as a separate command, until `status` is `completed`:

Run: `gh run view <databaseId> --json status,conclusion`

Expected, when complete: status `completed` and conclusion `success`. Any other conclusion means the branch is red. Report the failing job and stop.

- [ ] **Step 7: Report**

State, in plain words: each Done check and its exit code, the seven probe failures and that the guard is green again, that `.dockerignore` now excludes the prototype and the build context still transfers, the CI run id and its conclusion, and that nothing under `reference/` changed. Name anything that was not run and why.
