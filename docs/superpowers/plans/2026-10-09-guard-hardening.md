# Guard hardening: six evasions closed, each seen red first

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the specific evasions that six guards claim to catch and do not, and prove each one by watching the guard go red against that exact form before fixing it.

**Architecture:** Every rule being hardened is pulled out of its test body into an exported pure function that takes a file path and that file's text, so the evasion can be probed with synthetic input and with a throwaway tree outside the repository. No probe is ever written into a frozen directory. Three guards gain a recorded floor or a widened scope; two reverse a documented decision and say so in the log with `**Corrects:**`.

**Tech Stack:** TypeScript (strict), vitest 5 (`unit` project, which collects `guards/**/*.test.ts` via `vitest.config.ts:22`), `guards/lib/walk.ts` for `REPO_ROOT`, `readRepoFile`, `trackedFiles`, `walkFiles`, `walkFilesIn`, `readFileIn`, `existsExact`. `node:fs` `mkdtempSync` and `node:os` `tmpdir` for probe trees. No new dependency.

**Spec:** The founder's six-item instruction of 2026-10-09, quoted in full under *The instruction this plan implements*. The findings it closes are M7 and M8 of the `## 2026-10-08` entry in `docs/decisions.md`, recorded there as "scheduled, not started", and H2, H3, M1, M2 and M4 of the `## 2026-10-09 - The second security review of this branch` entry.

---

## The instruction this plan implements

Quoted so an executor does not have to reconstruct it:

> Guard-hardening task, scheduled in docs/decisions.md (2026-10-08, "M7 and M8 are scheduled, not started"). Six items, one session, each probed red before green.
>
> 1. guards/freeze.test.ts (M7, graded H3 by the 2026-10-09 review): `\bskip\b` does not match test.skipIf, which this branch already uses three times. Also unmatched: runIf, concurrent.skip, it.fails, and an emptied test body. Separately, decide whether freeze-baseline.json's unitTestCount becomes a compared floor rather than a record, that is the only thing that catches a test deleted from a surviving file. Ask me before changing it to a floor, since a floor goes red on a legitimate deletion. Also: the vitest-collection check names 1 of 32 baseline files.
> 2. The exact-version guard (M8): RANGE misses 1.x and 1.2.x, misses the dist-tags latest, next and beta, and PROTOCOL skips npm: aliases entirely, so npm:react@^19 is never examined for a range.
> 3. The section 6 cross-project env scan (review H2): it needs .env and .. on the same line, so an absolute path passes. guards/vite-fs-allow.test.ts resolves paths instead of grepping and its header says why. Carry that reasoning across.
> 4. The two residual section 6a gaps from the 2026-10-09 review: mailValueAllowed returns true for any $-prefixed value, so `MAIL_FROM: ${{ secrets.OWNER_MAILBOX }}` passes; and the address scan reads only .env.example and YAML, so the owner address in scripts/ci-seed-instance.ts is outside it.
> 5. guards/vite-fs-allow.test.ts does not require fs.allow to be set and never reads fs.strict, so strict: false reproduces the original H1 exposure.
> 6. eslint.config.js: pnpm lint walks into .superpowers/, which is ignored only via .git/info/exclude, local to this clone. CI never sees it; every local session hits a spurious failure. One ignore entry.
>
> For each of 1 to 5: write the evasion into a real surface, watch the guard fail naming that surface, restore. A guard that was never red against the specific form it now claims to catch is not fixed. Today's H1 session wrote a bypass into its own probe and asserted it as correct, do not repeat that.
>
> Record each in docs/decisions.md with its probe output. Use `**Corrects:**` for any correction, never "Superseded by". Run guards/decisions-log.test.ts and confirm it passes before committing the log.
>
> Do not touch reference/, .env*, keys.md or any frozen directory.
>
> One command, then read its exit code and output. Never chain git commit or git push onto a grep, a pipe or a test run. Run each Done check separately. Gate on `gh run view --json status,conclusion`, never `gh run watch --exit-status`.
>
> Report CI per job as the API reports it. Do not merge. If the push is denied, say so and stop.

### How this plan runs, decided by the founder on approval

Run it in a **fresh session** using `superpowers:subagent-driven-development`:
one fresh subagent per task, with a reviewer between tasks. Tasks 4 and 5 touch
the same file and **commit together**, so they go to one subagent as a pair.
This session wrote the plan and does not execute it.

### Four changes the founder made on approval

1. **Item 4(b) skips FROZEN test files only, not all test files.** A non-frozen
   test in `guards/` or `dashboards/` must still fail on a real registrable
   address, and Task 5 carries a probe that proves it, seen red first.
2. **Reserved domains are the last-label check plus exactly three RFC 2606
   second-level domains**, `example.com`, `example.net` and `example.org`.
   Nothing else is allowed by pattern, so `isReservedDomain` holds its own
   three-entry list rather than reading `ALLOWED_TEST_DOMAINS`, which a later
   edit could widen without anybody noticing.
3. **The assertion floor states how it counts and what it misses**, and the
   recorded number may be raised only in a commit the founder approves. A lower
   count fails and never self-adjusts. Task 2 Step 6 carries both.
4. **Two confirmations run before Task 1**, as Task 0 below.

### Two decisions the founder made in answer to questions asked before this plan

1. **The freeze guard is probed with a throwaway tree outside the repository, never by writing into a frozen directory.** The freeze guard reads only the seven frozen directories, so "write the evasion into a real surface" and "do not touch any frozen directory" cannot both hold literally. The founder chose the probe tree. It is also the repository's own idiom: `guards/lib/walk.ts:173-177` says a probe written inside the repository races the other guards, because vitest runs test files in parallel.
2. **`unitTestCount` becomes a floor scoped to the frozen directories, not to the whole unit project.** A whole-project floor goes red when somebody legitimately deletes a test in `guards/` or `dashboards/`, which makes it a gate that gets edited rather than obeyed. A frozen-only floor goes red only when a frozen test disappears, which is always a freeze violation, so red is always correct.

## Global Constraints

- **Never write into `reference/`, `.env`, `.env.local`, `.env.example`, `docs/security/keys.md`, or any of the seven frozen directories** (`frontdesk/`, `api/`, `db/`, `shared/`, `template/`, `ops/`, `design/`). Reading a frozen directory is always fine and the guards do it. Every probe surface named in this plan is outside all of them.
- **Plain language in every comment and every line of the log entry:** short sentences, no jargon, **no em dashes and no exclamation marks**. CLAUDE.md section 10.
- **The log entry opens its explanation with `**Reason`, `**Why`, `**Result` or `**Superseded`** and uses the heading `## <ISO date> - <decision>`. CLAUDE.md section 9, enforced by `guards/decisions-log.test.ts:85`.
- **The log entry must not contain the string `**Superseded`.** The founder asked for `**Corrects:**`. `guards/decisions-log.test.ts:93` puts an extra obligation on any entry containing `**Superseded`: it must name the ISO date of a replacement entry that exists in the log. `**Corrects:**` carries no such obligation.
- **No new dependency.** Everything needed is in `node:fs`, `node:os`, `node:path` or already a devDependency.
- **No committed change to `vitest.config.ts`, `package.json`, `.github/workflows/ci.yml`, `scripts/dev-db.mjs`, `scripts/ci-seed-instance.ts` or `dashboards/vite.config.ts`.** Each is a probe surface, edited and restored within one task, and Task 9 Step 1 checks that none of them appears in the final diff.
- **`eslint.config.js` is protected by the `ecc` `config-protection` PreToolUse hook.** Any attempt to edit it is refused with "Modifying eslint.config.js is not allowed". Task 1 is the only task that touches it, and **the founder makes that edit by hand**. No executor may work around the hook, by `sed`, by a heredoc, by a different tool, or by disabling it. An implementer refused there reports BLOCKED and stops; asking the controller to make the edit instead is permission laundering and is refused too. Found on 2026-10-09 when Task 1 was first dispatched, and not anticipated when this plan was written in this same repository.
- **No scratch `.mjs`, `.ts` or `.js` under `.superpowers/`.** Use the session scratchpad. ESLint walks `.superpowers/` until Task 1 lands, so a scratch script there fails `pnpm lint` for a reason unrelated to the task being worked on, which is the confusion Task 1 exists to remove.
- **After any cleanup, verify with `ls` and the real gate command, never with `find`.** A `find` with escaped parentheses errored under this shell on 2026-10-09 and its `|| echo "none"` was read as an answer, so a leftover probe file was reported removed while `pnpm lint` was still exiting 1. A check whose failure looks like a pass is worse than no check.
- **One command per Bash call. Never chain `git commit` or `git push` onto a test run, a grep or a pipe.** Read each exit code on its own.
- **Redirect long output to a file and read its tail,** rather than piping to `tail` and reading `PIPESTATUS`. A pipe into `tail` reported exit 139 in this environment for a command that exits 0, which is a SIGPIPE artifact and not the command's status.

## Review Focus

Five things no task's tests exercise, most likely to bite first:

1. **A disabling modifier this plan did not think of.** Pinned in **Task 2, Step 1**: the rule flags any chained modifier NOT on an explicit allow list of legitimate ones, so a modifier vitest adds next fails closed and has to be added deliberately. The probe asserts both directions, twelve forms that must fail and eight that must not.
2. **A test body emptied to something that is not literally `{}`.** `test('x', () => { /* later */ })` defeats the empty-body regex. Pinned in **Task 2, Step 1**: the probe asserts that miss out loud, and the frozen assertion floor is the second instrument, because every way of emptying a body removes its `expect(` calls.
3. **A dependency specifier the exact-semver rule rejects wrongly.** Inverting from a blacklist to an allowlist makes every unusual-but-valid spec a failure. Pinned in **Task 3, Step 1**: the probe asserts `workspace:*`, `workspace:^`, `catalog:default`, `link:../design`, `file:./vendor/pkg.tgz`, `npm:react@19.3.0`, `jsr:@std/path@1.0.0`, `1.2.3-rc.1` and `1.2.3+build.5` all pass.
4. **An env-file path built at runtime.** Pinned in **Task 4, Step 1**: such a reference is reported as `unresolvable` and must be allowlisted, which changes the scan from failing open to failing closed, and the probe covers an unresolvable reference, an absolute one, a home-relative one and a Windows one.
5. **A mail value that is neither an address nor a recognised substitution.** Pinned in **Task 5, Step 1**: the probe asserts a bare word, a GitHub Actions expression, three shapes of compose substitution, an empty value, a reserved address and a real address each get their own answer, so the cases cannot collapse into one.

---

## File Structure

| File | Change | Responsibility |
| --- | --- | --- |
| `eslint.config.js` | Modify `NOT_OURS`, lines 41 to 54 | Stop `pnpm lint` walking into the skill workspace |
| `guards/freeze.test.ts` | Rewrite | Every way to weaken a frozen suite: disable, invert, empty, delete, stop collecting |
| `guards/freeze-baseline.json` | Modify | Gains `frozenTestCount` and `frozenAssertionCount`; `unitTestCount` stays the record it already is |
| `guards/version-pinning.test.ts` | Replace the rule, keep the file | Exact-semver allowlist instead of a range blacklist, and alias specifiers read |
| `guards/standing-rules.test.ts` | Modify three helpers and one scope | Env references resolved not grepped; mail interpolation split by kind; address scan widened |
| `guards/vite-fs-allow.test.ts` | Modify the rule and its header | `fs.allow` required, `fs.strict` read |
| `docs/decisions.md` | Append one entry | The six changes, their probe output, and two corrections |
| `guards/contract-boundary.test.ts` | Modify one comment, Task 8 | Its header called the guard vacuous; `dashboards/src` now holds source |
| The seven frozen directories | **No change** | Read only |

### Measurements this plan rests on

Taken in this repository on 2026-10-09, before any edit:

- `guards/freeze-baseline.json` holds **46** `testFiles`, `unitTestCount` **347**, `recordedAt` `2026-10-07`. The founder's note said 32 baseline files; the real number is 46.
- **0 of those 46** are missed by the 12 `*.test.ts` globs in `vitest.config.ts`. The collection check passes today, so the work is widening what it checks, not fixing a loss.
- The 46 frozen baseline files hold **411** `test(`/`it(` call sites and **955** `expect(` call sites. Expanding every literal `test.each` table gives **437**: 400 plain call sites, 10 literal `each` tables holding 36 cases between them, and 1 `each` whose table is the identifier `transient` in `db/test/poll.test.ts` and cannot be expanded. Of the frozen tests, **239** are in the unit project and **170** in db, counted from `vitest list --json`.
- **437 and not 440, and the three that moved.** An earlier measurement here said 440 and 39 cases. It was taken with a parser that counted commas plus one, before the founder's tightening replaced it with one that counts elements. Three frozen tables carry a trailing comma, so each was over-counted by one: `db/test/auth.test.ts` holds 7 cases and not 8, `db/test/poll.test.ts` 3 and not 4, and `frontdesk/src/classifier-anthropic.test.ts` 4 and not 5. Confirmed twice on 2026-10-09, by running both parsers side by side and again by the reviewer hand-checking all 11 tables.
- **`vitest list --json` does not expand a `test.each`.** Measured: `shared/src/agent-output.test.ts` holds a ten-case `test.each([0x0a, 0x0d, ...])` and shows as ONE listed entry, named `rejects a reason containing control/separator U+%s` with the placeholder unresolved, and its listed count of 12 equals its regex call-site count of 12. So the listed count cannot be the instrument that catches a removed `each` case, and the founder's instruction on approval is corrected on that one point: the each-aware static count is primary and the listed count is secondary. No whole-project total is quoted here on purpose: adding a test to any non-frozen file moves it, which is what made an earlier version of this line stale within one task.
- `test.skipIf` appears **3** times on this branch, at `guards/design-naming.test.ts:517`, `guards/design-naming.test.ts:529` and `guards/mock-boundary.test.ts:106`. All three are in `guards/`, none in a frozen directory, which is why nothing has gone red.
- Mail variables in tracked config: `.env.example` `MAIL_FROM=""`, `template/.env.example` `MAIL_FROM=""`, `.github/workflows/ci.yml` `MAIL_FROM: "smoke@example.com"`, and `template/compose.yml` `MAIL_FROM: "${MAIL_FROM:?}"` **twice**. The last two live in a frozen directory, so a blanket rejection of every `$`-prefixed value would fail frozen code that cannot be edited.
- Widening the address scan to every tracked source file would report about **80** addresses, of which **19** are real and registrable (`owner@firm.com`, `no-reply@stripe.com`, `noreply@github.com`, nine at `x.com`), all inside **frozen** test fixtures that cannot be edited.
- Excluding **frozen** test files only, which is the founder's change on approval, the scan reads **138** files holding **12** addresses, of which **0** are non-reserved. So it passes today. **30** non-frozen test files come into scope, and three of them hold an address: `guards/compose-smoke-env.test.ts:465-466` holds `smoke@example.com`, `guards/mock-boundary.test.ts:70` holds `Maria@BrightPath.example`, and `guards/standing-rules.test.ts:87` holds `ceo@bigtestcorp.com`.
- **That last one is a conflict the founder's change exposes, and Task 5 resolves it.** `ceo@bigtestcorp.com` is a real company's real mailbox, written into `guards/standing-rules.test.ts` on purpose as the counter-example that explains why the allowlist is a list of exact addresses and not a substring rule. Under the founder's change that file becomes a scanned non-frozen test and the guard fails on its own documentation. The file already declares `SELF` and already exempts itself from the env scan for exactly this reason, stated in its own header at lines 10 to 16. Task 5 extends that one exemption to the address scan and adds a probe pinning that it is the only exemption, so `guards/freeze.test.ts` and `guards/deploy-surface.test.ts` are both still scanned.
- Of the addresses in non-test source, eight are on a domain the current allowlist matches exactly. One is not: `shared/src/gmail/fake.ts:121` holds `maya@okafor.example`. `okafor.example` is reserved by RFC 2606 because its last label is `example`, but the allowlist is an exact-string list and does not contain it. `shared/` is frozen. **So the reserved-top-level-label fix is required for the widening to pass at all, not an optional tidy-up.**
- `contract/` does not exist in this repository. The founder's change named `guards/`, `contract/` and `dashboards/` as the non-frozen test locations; `guards/` and `dashboards/` exist, and the rule is written against the frozen prefixes rather than a list of non-frozen ones, so a `contract/` added later is in scope with no edit.

---

## Task 0: Confirm this plan cannot trip the guards it hardens

**Files:**
- No change. This task verifies and records.

**Interfaces:**
- Consumes: nothing.
- Produces: the two confirmations the founder asked for before Task 1, each proved by running a guard rather than by reasoning about it.

**Why this task exists.** This plan file and the log entry in Task 7 both quote
addresses on purpose: `owner@realcompany.com`, `founder@orbitumai.com`,
`owner@firm.com`, `no-reply@stripe.com`, `noreply@github.com`, `myexample.com`
and `example.io`. Several are real registrable domains, named as the
counter-examples that make the rules legible. If the widened address scan read
either document, the change would fail on its own documentation, which is the
trap `guards/standing-rules.test.ts` already warns about in its own header.

- [ ] **Step 1: Run the address and gate guard with this plan on disk**

Run: `pnpm exec vitest run --project unit guards/standing-rules.test.ts > /tmp/t0-now.log 2>&1; echo "EXIT=$?"; tail -5 /tmp/t0-now.log`

Expected: **EXIT=0**, 8 passed. This was run while writing the plan and gave
exactly that, which proves the plan file trips neither the address scan nor any
of the three real-data gate tests as they stand today.

- [ ] **Step 2: Prove the WIDENED predicate does not read either document**

The scan Task 5 builds does not exist yet, so prove its predicate directly.

Run:

```bash
node -e "
const isTestFile = (f) => /\.(?:test|spec)\.[tj]sx?\$/.test(f) || f.includes('__tests__/') || f.includes('__fixtures__/');
const FROZEN = ['frontdesk/','api/','db/','shared/','template/','ops/','design/'];
const isFrozenTest = (f) => isTestFile(f) && FROZEN.some(d => f.startsWith(d));
const NOT_OURS = ['reference/','landing/','archive/','node_modules/','dist/','generated/'];
const SELF = 'guards/standing-rules.test.ts';
const widened = (f) => f !== SELF && !isFrozenTest(f) && !NOT_OURS.some(s=>f.includes(s)) &&
  (f === '.env.example' || f.endsWith('/.env.example') || /\.(?:ya?ml|ts|tsx|mjs|cjs|js|json|sql)\$/.test(f));
for (const f of [
  'docs/superpowers/plans/2026-10-09-guard-hardening.md',
  'docs/decisions.md',
  'scripts/ci-seed-instance.ts',
  'guards/standing-rules.test.ts',
  'guards/mock-boundary.test.ts',
  'frontdesk/src/filter.test.ts',
  'db/test/auth.test.ts',
]) console.log(String(widened(f)).padEnd(5), f);
"
```

Expected, exactly:

```
false docs/superpowers/plans/2026-10-09-guard-hardening.md
false docs/decisions.md
true  scripts/ci-seed-instance.ts
false guards/standing-rules.test.ts
true  guards/mock-boundary.test.ts
false frontdesk/src/filter.test.ts
false db/test/auth.test.ts
```

Both documents are Markdown and `.md` is not in the extension list, so neither
is read however the rest of the predicate changes. That is the whole reason
they are safe, and it is worth knowing it rests on one list.

- [ ] **Step 3: Confirm the log entry cannot trip the governance rule**

`docs/decisions.md` IS in the `GOVERNANCE` list of `guards/rules.test.ts`, which
fails any governance document matching `/\bweek *\d/i`. The plan does not match
it, and the Task 7 entry must not either.

Run: `grep -ciE '\bweek *[0-9]' docs/superpowers/plans/2026-10-09-guard-hardening.md`

Expected: `0`. Note that `grep -c` exits 1 when the count is 0, which is not a
failure here. Run the same check against `docs/decisions.md` after Task 7
writes the entry.

- [ ] **Step 4: Confirm Task 9 Step 1's path list is named and explained**

Read Task 9 Step 1. It must list eight paths by name and say which two are
additions beyond the six files the approved plan named. No command; this is a
read of the plan, and the task is complete when the list and the sentence are
both present.

---

## Task 1: Stop `pnpm lint` walking into the skill workspace

**Files:**
- Modify: `eslint.config.js:41-54`

**Interfaces:**
- Consumes: nothing.
- Produces: `NOT_OURS` in `eslint.config.js` contains `'.superpowers/'`. `eslint.frozen.config.js` imports this file and filters only `FROZEN` back out of the ignore list, so the new entry applies to both configs without a second edit.

**Why first.** Every later task runs `pnpm lint`, and until this is fixed a scratch file in the skill workspace fails it for a reason unrelated to the task being worked on. A red check with two possible causes is worse than either alone.

**Context an executor needs.** `.superpowers/` is git-ignored through `.git/info/exclude`, which is local to one clone and is not committed. CI checks out fresh, so CI never sees the directory and has never failed on it. The superpowers skills write a ledger, task briefs and scratch scripts there, and a scratch `.mjs` using `process` or `console` draws `no-undef`. `guards/lint-config.test.ts` pins parts of this config but does not assert `NOT_OURS` by equality, so adding an entry does not break it.

- [ ] **Step 1: Write the probe that makes `pnpm lint` fail**

Run:

```bash
mkdir -p .superpowers/probe && printf 'process.exitCode = 0;\nconsole.log("probe");\n' > .superpowers/probe/lint-probe.mjs
```

Expected: exit 0, the file exists.

- [ ] **Step 2: Watch lint fail, naming that file**

Run: `pnpm lint > /tmp/lint-red.log 2>&1; echo "EXIT=$?"; cat /tmp/lint-red.log`

Expected: **EXIT=1**, and the output names `.superpowers/probe/lint-probe.mjs` with `'process' is not defined  no-undef` and `'console' is not defined  no-undef`. Record those lines; the log entry quotes them.

- [ ] **Step 3: The founder adds the ignore entry**

**This step is not an executor's to run.** `eslint.config.js` is protected by the
`ecc` `config-protection` PreToolUse hook, which refuses every edit to it with
"Modifying eslint.config.js is not allowed". An implementer that reaches this
step reports BLOCKED, leaves the file byte unchanged, removes its probe, and
stops. Do not route around the hook with `sed`, a heredoc, another tool, or by
disabling it, and do not ask the controller to make the edit: the hook exists to
make this file a founder decision, and both of those are permission laundering.

Print the block below, say it goes inside `NOT_OURS` immediately after the
`'archive/',` line, which is `eslint.config.js:47`, and wait for the founder to
confirm it is saved. Then resume at Step 4.

The founder edits `eslint.config.js`. In the `NOT_OURS` array, after the `'archive/',` line, add:

```js
  // The superpowers skill workspace: ledgers, task briefs and scratch scripts.
  // It is ignored through .git/info/exclude, which is local to one clone and is
  // not committed, so CI checks out without it and has never linted it. Locally
  // a scratch script in it drew no-undef and failed `pnpm lint` for a reason
  // that had nothing to do with the change being linted.
  '.superpowers/',
```

- [ ] **Step 4: Watch lint pass with the probe still present**

Run: `pnpm lint > /tmp/lint-green.log 2>&1; echo "EXIT=$?"; cat /tmp/lint-green.log`

Expected: **EXIT=0**. The probe file is still on disk and is no longer linted. This is the proof: the same file, the same command, red then green.

- [ ] **Step 5: Remove the probe**

Run: `rm -rf .superpowers/probe`

Expected: exit 0.

- [ ] **Step 6: Confirm the frozen lint report still works**

Run: `pnpm lint:frozen:danger > /tmp/frozen.log 2>&1; echo "EXIT=$?"; tail -4 /tmp/frozen.log`

Expected: exit 0. `eslint.frozen.config.js` imports `NOT_OURS` from this file, so this confirms the new entry did not disturb the frozen report.

- [ ] **Step 7: Commit**

```bash
git add eslint.config.js
```

Then, as a separate command, with the message in a file because it is multi-line. Write `/tmp/msg-task1.txt` holding:

```
build(lint): ignore the superpowers skill workspace

.superpowers/ is ignored through .git/info/exclude, which is local to one
clone and is not committed. CI checks out without it, so CI never linted it
and never failed. Locally a scratch script in it drew no-undef and failed
pnpm lint for a reason unrelated to the change being linted.

Probed by leaving the scratch file in place across the fix: lint exit 1
naming it, then exit 0 with the same file still on disk.
```

then run `git commit -F /tmp/msg-task1.txt`.

---

## Task 2: Every way to weaken a frozen suite

**Files:**
- Rewrite: `guards/freeze.test.ts`
- Modify: `guards/freeze-baseline.json`
- Probe only, then restore: `vitest.config.ts`

**Interfaces:**
- Consumes: `existsExact`, `readFileIn`, `readRepoFile`, `walkFiles`, `walkFilesIn` from `./lib/walk.ts`.
- Produces:

```ts
export function modifierOffenders(file: string, text: string): readonly string[]
export function emptyBodyOffenders(file: string, text: string): readonly string[]
export function literalEachCases(text: string, from: number): number | null  // null means opaque
export function countExpandedTests(text: string): number   // primary floor
export function opaqueEachCount(text: string): number
export function opaqueComplaints(
  actual: number,
  recorded: { readonly frozenOpaqueEachCount: number },
): readonly string[]                                       // a CEILING, fails when it rises
export function countTests(text: string): number           // tertiary floor
export function countAssertions(text: string): number
export type ListedCounts = { readonly unit: number; readonly db: number }
export type FrozenCounts = {
  readonly expanded: number
  readonly calls: number
  readonly assertions: number
  readonly listed: ListedCounts
}
export type FrozenBaseline = {
  readonly frozenExpandedTestCount: number
  readonly frozenTestCallCount: number
  readonly frozenAssertionCount: number
  readonly frozenListedTestCount: ListedCounts
}
export function floorComplaints(actual: FrozenCounts, recorded: FrozenBaseline): readonly string[]
export function globToRegExp(glob: string): RegExp
export function uncollected(files: readonly string[], globs: readonly string[]): readonly string[]
```

**The inversion that matters.** The current rule is a blacklist of three modifier names. A blacklist cannot catch a name nobody thought of, and vitest has more modifiers than three. The new rule flags **any** chained modifier on `test`, `it` or `describe` that is not on an explicit list of legitimate ones. So `skipIf`, `runIf`, `fails` and anything vitest adds next all fail, and `each`, `concurrent`, `sequential`, `extend` and `for` pass. Failing closed is the only way a list of names stays correct.

- [ ] **Step 1: Replace the file with probes and no implementation**

Replace the whole content of `guards/freeze.test.ts` with:

```ts
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterAll, expect, test } from 'vitest';
import { existsExact, readFileIn, readRepoFile, walkFiles, walkFilesIn } from './lib/walk.ts';

// The lead-reply freeze, turned into a check instead of a promise.
//
// The slice that replies to a sales lead is frozen: no new features, no
// deletions, and every test it has keeps running and passing for the life of
// the project. A promise like that decays quietly. A test skipped to get a
// build green looks identical to a test that passes, and a deleted test file
// looks like nothing at all.
//
// Five checks, because there are five ways to weaken a suite: disable a test,
// invert it, empty its body, delete its file, or stop collecting the file.
//
// This was finding M7 of the 2026-10-08 review and was graded H3 by the
// 2026-10-09 one, because the first version matched three modifier names and
// `test.skipIf` is not one of them. That form was already used three times in
// this branch, so it was the idiom a future session would reach for.
const FROZEN = ['frontdesk', 'api', 'db', 'shared', 'template', 'ops', 'design'];

/**
 * Chained modifiers that do not weaken a test.
 *
 * An allow list, not a ban list. A ban list of names cannot catch a name
 * nobody thought of, and that is exactly how `skipIf` got through: the first
 * rule banned `skip`, `only` and `todo`, and vitest has more modifiers than
 * three. Anything not named here fails, so a modifier vitest adds next has to
 * be added deliberately rather than passing on arrival.
 */
const HARMLESS_MODIFIERS: ReadonlySet<string> = new Set([
  'each',
  'for',
  'concurrent',
  'sequential',
  'extend',
  'scoped',
  'shuffle',
]);

const probeRoots: string[] = [];
afterAll(() => {
  for (const root of probeRoots) rmSync(root, { force: true, recursive: true });
});

/**
 * A throwaway tree OUTSIDE the repository, holding one file.
 *
 * Outside on purpose, twice over. guards/lib/walk.ts:173-177 says a probe
 * written inside the repository races the other guards, because vitest runs
 * test files in parallel and another guard can walk the probe and then read it
 * after it is deleted. And this guard's only real surface is the seven frozen
 * directories, which must never be written to, so a tree is the only way to
 * see it red against a frozen-looking path.
 */
function probeTree(relative: string, contents: string): string {
  const root = mkdtempSync(join(tmpdir(), 'orbit-freeze-'));
  probeRoots.push(root);
  mkdirSync(join(root, dirname(relative)), { recursive: true });
  writeFileSync(join(root, relative), contents, 'utf8');
  return root;
}

test('every modifier that disables or inverts a frozen test is reported', () => {
  const cases: readonly (readonly [string, string])[] = [
    ['test.skip', "test.skip('a', () => { expect(1).toBe(1); });"],
    ['test.skipIf', "test.skipIf(true)('a', () => { expect(1).toBe(1); });"],
    ['test.runIf', "test.runIf(false)('a', () => { expect(1).toBe(1); });"],
    ['test.only', "test.only('a', () => { expect(1).toBe(1); });"],
    ['test.todo', "test.todo('a');"],
    ['test.fails', "test.fails('a', () => { expect(1).toBe(2); });"],
    ['it.skip', "it.skip('a', () => { expect(1).toBe(1); });"],
    ['it.fails', "it.fails('a', () => { expect(1).toBe(2); });"],
    ['describe.skip', "describe.skip('a', () => { test('b', () => { expect(1).toBe(1); }); });"],
    ['describe.only', "describe.only('a', () => { test('b', () => { expect(1).toBe(1); }); });"],
    ['test.concurrent.skip', "test.concurrent.skip('a', () => { expect(1).toBe(1); });"],
    ['describe.concurrent.only', "describe.concurrent.only('a', () => { test('b', () => { expect(1).toBe(1); }); });"],
  ];

  for (const [label, source] of cases) {
    expect(modifierOffenders('api/probe.test.ts', source), `${label} must be reported`).not.toEqual([]);
  }

  // The other half, which matters just as much. A guard that fires on correct
  // code gets switched off and takes its real rules with it.
  const fine: readonly string[] = [
    "test('a', () => { expect(1).toBe(1); });",
    "it('a', () => { expect(1).toBe(1); });",
    "describe('a', () => { test('b', () => { expect(1).toBe(1); }); });",
    "test.each([1, 2])('a %i', (n) => { expect(n).toBeGreaterThan(0); });",
    "test.concurrent('a', () => { expect(1).toBe(1); });",
    "test.for([1])('a', (n) => { expect(n).toBe(1); });",
    'const skipped = 0; expect(skipped).toBe(0);',
    '// test.skip is named in this comment and is not code',
  ];
  for (const source of fine) {
    expect(modifierOffenders('api/probe.test.ts', source), `must NOT be reported: ${source}`).toEqual([]);
  }
});

test('a frozen test with an empty body is reported', () => {
  expect(emptyBodyOffenders('api/probe.test.ts', "test('a', () => {});")).not.toEqual([]);
  expect(emptyBodyOffenders('api/probe.test.ts', "test('a', async () => {});")).not.toEqual([]);
  expect(emptyBodyOffenders('api/probe.test.ts', "it('a', () => {\n});")).not.toEqual([]);
  expect(emptyBodyOffenders('api/probe.test.ts', "test('a', () => { expect(1).toBe(1); });")).toEqual([]);

  // The limit, recorded rather than hidden: a body emptied to something that is
  // not literally an empty block defeats this regex. The assertion floor below
  // is the second instrument for the same gap, because every way of emptying a
  // body removes its expect() calls whatever is left behind.
  expect(emptyBodyOffenders('api/probe.test.ts', "test('a', () => { /* later */ });")).toEqual([]);
});

test('the rule reads a tree the way it reads the repository', () => {
  // End to end through walk and read, against a frozen-looking path, without
  // writing one byte into a frozen directory.
  const root = probeTree('api/src/weakened.test.ts', "test.skipIf(true)('a', () => { expect(1).toBe(1); });\n");
  const found = walkFilesIn(root, 'api', { extensions: ['.test.ts'] }).flatMap((file) =>
    modifierOffenders(file, readFileIn(root, file)),
  );

  expect(found).toEqual(['api/src/weakened.test.ts: test.skipIf']);
});

test('a frozen suite that loses tests or assertions is reported', () => {
  expect(countTests("test('a', () => {});\nit('b', () => {});")).toBe(2);
  expect(countTests("test.each([1])('a', () => {});")).toBe(1);
  expect(countAssertions('expect(1).toBe(1); expect(2).toBe(2);')).toBe(2);

  const RECORDED = {
    frozenExpandedTestCount: 440,
    frozenTestCallCount: 411,
    frozenAssertionCount: 955,
    frozenListedTestCount: { unit: 239, db: 170 },
  } as const;
  const AT = { expanded: 440, calls: 411, assertions: 955, listed: { unit: 239, db: 170 } } as const;

  // A floor is only a floor if going under it fails, and only useful if going
  // over it does not.
  expect(floorComplaints(AT, RECORDED)).toEqual([]);
  expect(floorComplaints({ ...AT, expanded: 441, assertions: 960 }, RECORDED)).toEqual([]);

  // Each count fails on its own, and the message names which one.
  expect(floorComplaints({ ...AT, expanded: 439 }, RECORDED)).toEqual(['frozen expanded tests: 439, recorded 440']);
  expect(floorComplaints({ ...AT, calls: 410 }, RECORDED)).toEqual(['frozen test call sites: 410, recorded 411']);
  expect(floorComplaints({ ...AT, assertions: 954 }, RECORDED)).toEqual(['frozen assertions: 954, recorded 955']);
  expect(floorComplaints({ ...AT, listed: { unit: 238, db: 170 } }, RECORDED)).toEqual([
    'frozen listed tests (unit): 238, recorded 239',
  ]);
  expect(floorComplaints({ ...AT, listed: { unit: 239, db: 169 } }, RECORDED)).toEqual([
    'frozen listed tests (db): 169, recorded 170',
  ]);
});

test('removing a case from an each table is caught by the expanded count and by nothing else', () => {
  // The founder's change on approval, and the measurement that corrected it.
  // A literal each table with four cases, and the same table with three.
  const four = "test.each([['a'], ['b'], ['c'], ['d']])('case %s', (s) => { expect(s).toBeTruthy(); });\n";
  const three = "test.each([['a'], ['b'], ['c']])('case %s', (s) => { expect(s).toBeTruthy(); });\n";

  // The primary count falls. This is the whole point of expanding the table.
  expect(countExpandedTests(four)).toBe(4);
  expect(countExpandedTests(three)).toBe(3);

  // The call-site count does not move, because the declaration is still one
  // declaration. `vitest list --json` does not move either, measured on
  // 2026-10-09: it reports one entry per declaration with the placeholder
  // unresolved, which is why it is the secondary check and not the primary one.
  expect(countTests(four)).toBe(1);
  expect(countTests(three)).toBe(1);

  // So the floor catches it only through the expanded count.
  const recorded = {
    frozenExpandedTestCount: 4,
    frozenTestCallCount: 1,
    frozenAssertionCount: 1,
    frozenListedTestCount: { unit: 1, db: 0 },
  } as const;
  expect(
    floorComplaints(
      { expanded: countExpandedTests(three), calls: 1, assertions: 1, listed: { unit: 1, db: 0 } },
      recorded,
    ),
  ).toEqual(['frozen expanded tests: 3, recorded 4']);

  // A table that is not a literal cannot be expanded, and the blind spot is
  // counted rather than assumed away. db/test/poll.test.ts has one.
  expect(countExpandedTests("test.each(transient)('%s', () => { expect(1).toBe(1); });")).toBe(1);
  expect(opaqueEachCount("test.each(transient)('%s', () => {});")).toBe(1);
  expect(opaqueEachCount(four)).toBe(0);

  // Nesting inside one case must not miscount the table.
  expect(countExpandedTests("test.each([[1, [2, 3]], [4, { a: 5 }]])('n', () => {});")).toBe(2);
});

test('an each table the parser cannot read is counted as opaque, never as zero or one', () => {
  // The founder's tightening of 2026-10-09. The parser has to answer "I cannot
  // read this" distinctly from "this holds one case", because the two differ by
  // however many cases the table really holds.
  const at = (source: string) => literalEachCases(source, source.indexOf('.each(') + '.each('.length);

  // Readable, and read exactly.
  expect(at("test.each([['a'], ['b'], ['c'], ['d']])('x', () => {});")).toBe(4);
  // A trailing comma is not a fifth element.
  expect(at("test.each([['a'], ['b'],])('x', () => {});")).toBe(2);
  // An empty literal is zero cases, which is a real count, not a parse failure.
  expect(at("test.each([])('x', () => {});")).toBe(0);
  // Nesting inside a case.
  expect(at("test.each([[1, [2, 3]], [4, { a: 5 }]])('x', () => {});")).toBe(2);

  // Unreadable, and said so. Each of these returns null, and null is what the
  // caller counts as opaque.
  expect(at("test.each(transient)('x', () => {});"), 'an identifier table').toBeNull();
  expect(at('test.each(buildCases())(\'x\', () => {});'), 'a call table').toBeNull();
  expect(at("test.each([...cases, ['x']])('x', () => {});"), 'a spread table').toBeNull();
  expect(at("test.each([...cases])('x', () => {});"), 'a spread-only table').toBeNull();
  expect(at("test.each([['a'], ['b']\n"), 'an unterminated table').toBeNull();

  // A gap, named rather than faked. The tagged-template table form,
  // test.each`a | b` with no parenthesis, is not matched by TEST_CALL at all,
  // so it is counted as neither a test nor an opaque each. Asserting it through
  // `at` above would pass for the wrong reason, because `at` looks for
  // `.each(` and there is none. No frozen baseline file uses that form today,
  // checked on 2026-10-09, and the modifier rule would not see one either.
  // Closing it means matching a backtick after the chain, which is a change to
  // TEST_CALL and to every count that uses it, so it is recorded here and not
  // done inside this task.
  expect(countTests('test.each`\n  a | b\n  1 | 2\n`;'), 'the template form is invisible to TEST_CALL').toBe(0);
  expect(opaqueEachCount('test.each`\n  a | b\n  1 | 2\n`;')).toBe(0);

  // And the ceiling fails when the number of unreadable tables rises.
  expect(opaqueComplaints(1, { frozenOpaqueEachCount: 1 })).toEqual([]);
  expect(opaqueComplaints(0, { frozenOpaqueEachCount: 1 }), 'turning one back into a literal is an improvement').toEqual(
    [],
  );
  expect(opaqueComplaints(2, { frozenOpaqueEachCount: 1 })).toEqual([
    'frozen opaque each tables: 2, recorded 1',
  ]);
});

test('rewriting a literal each table into an expression raises the opaque count by exactly one', () => {
  // The probe the founder asked for, on a real frozen file, in memory, with no
  // frozen file written. shared/src/agent-output.test.ts holds one literal
  // ten-case table and no opaque one.
  const real = readRepoFile('shared/src/agent-output.test.ts');
  expect(opaqueEachCount(real), 'this file starts with no opaque table').toBe(0);
  const expandedBefore = countExpandedTests(real);

  // Turn that literal table into an identifier, which is the shape of an
  // ordinary refactor and the shape that used to go unseen.
  const rewritten = real.replace(
    'test.each([0x0a, 0x0d, 0x0b, 0x0c, 0x09, 0x85, 0x2028, 0x2029, 0x202e, 0x200b])',
    'test.each(CONTROL_AND_SEPARATOR_CODE_POINTS)',
  );
  expect(rewritten, 'the replacement must have matched').not.toBe(real);

  // The opaque count rises by exactly one.
  expect(opaqueEachCount(rewritten) - opaqueEachCount(real)).toBe(1);

  // And the damage the ceiling exists to catch: nine cases vanish from the
  // primary count, while the call-site count does not move at all.
  expect(expandedBefore - countExpandedTests(rewritten)).toBe(9);
  expect(countTests(rewritten)).toBe(countTests(real));

  // So the ceiling reports it even if the expanded floor were satisfied by
  // tests added elsewhere in the same change.
  expect(opaqueComplaints(opaqueEachCount(rewritten), { frozenOpaqueEachCount: 0 })).toEqual([
    'frozen opaque each tables: 1, recorded 0',
  ]);
});

test('the each-aware count catches a removed case in a throwaway copy of a real frozen file', () => {
  // The probe the founder asked for, on real text rather than a fixture, and in
  // a tree outside the repository so no frozen file is written.
  const real = readRepoFile('shared/src/agent-output.test.ts');
  const before = countExpandedTests(real);

  // Remove the last case of the ten-value control-character table. The table is
  // written as `test.each([0x0a, 0x0d, ..., 0x200b])`, so dropping `, 0x200b`
  // removes exactly one case and changes nothing else.
  const after = countExpandedTests(real.replace(', 0x200b]', ']'));

  expect(before - after, 'removing one each case must drop the expanded count by one').toBe(1);
  // And the two counts that cannot see it.
  expect(countTests(real.replace(', 0x200b]', ']'))).toBe(countTests(real));
});

test('a baseline file that no vitest pattern collects is reported', () => {
  expect(globToRegExp('api/**/*.test.ts').test('api/src/a.test.ts')).toBe(true);
  expect(globToRegExp('api/**/*.test.ts').test('api/a.test.ts')).toBe(true);
  expect(globToRegExp('api/**/*.test.ts').test('db/a.test.ts')).toBe(false);
  expect(globToRegExp('template/test/compose.test.ts').test('template/test/compose.test.ts')).toBe(true);

  expect(uncollected(['api/a.test.ts'], ['api/**/*.test.ts'])).toEqual([]);
  expect(uncollected(['api/a.test.ts', 'ops/b.test.ts'], ['api/**/*.test.ts'])).toEqual(['ops/b.test.ts']);
});
```

- [ ] **Step 2: Run it to verify every probe fails**

Run: `pnpm exec vitest run --project unit guards/freeze.test.ts > /tmp/f-red.log 2>&1; echo "EXIT=$?"; grep -E "FAIL|ReferenceError|Tests " /tmp/f-red.log`

Expected: **EXIT=1**, **nine** failing tests, one per probe in the block above. Each fails on a `ReferenceError` naming a function it calls: `modifierOffenders`, `emptyBodyOffenders`, `countExpandedTests`, `opaqueEachCount`, `opaqueComplaints`, `literalEachCases`, `countTests`, `floorComplaints`, `globToRegExp` or `uncollected`. This is the red that matters: the forms the founder listed are asserted and nothing implements them yet.

Report the actual count. Counts in this plan are advisory, not a gate: the plan was edited after these numbers were first written, so a mismatch is more likely a stale number than a broken implementation. What is binding is that every probe fails, and fails for a missing function rather than a wrong assertion.

- [ ] **Step 3: Confirm the OLD rule would have passed `skipIf`**

Prove the gap on the old code rather than asserting it. Run:

```bash
node -e "const r=[/\b(test|it|describe)\.skip\b/,/\b(test|it|describe)\.only\b/,/\b(test|it)\.todo\b/];for(const s of [\"test.skipIf(true)('a',()=>{})\",\"test.runIf(false)('a',()=>{})\",\"it.fails('a',()=>{})\",\"test.concurrent.skip('a',()=>{})\"])console.log(JSON.stringify(s),'flagged by the old rule:',r.some(x=>x.test(s)))"
```

Expected: all four print `false`. Record those lines; the log entry quotes them as the measured gap.

- [ ] **Step 4: Write the modifier and empty-body rules**

Insert these above the first `test(` in `guards/freeze.test.ts`:

```ts
/**
 * A call on `test`, `it` or `describe` with one or more chained modifiers.
 *
 * Group 1 is the function, group 2 the whole chain. The chain is split and
 * every segment checked, so `test.concurrent.skip` is caught by its second
 * segment and `test.concurrent` alone is not caught at all.
 *
 * The leading boundary is `[^.\w]` rather than `\b`, so a property access like
 * `helpers.test.skip` does not read as a vitest call.
 */
const MODIFIER_CALL = /(?:^|[^.\w])(test|it|describe)((?:\.[A-Za-z][A-Za-z0-9]*)+)\s*\(/g;

/** A line that is a comment, which cannot disable anything. */
const isComment = (line: string) => /^\s*(?:\/\/|\*|\/\*)/.test(line);

/** Every disabling or inverting modifier in one file's text. */
export function modifierOffenders(file: string, text: string): readonly string[] {
  const out: string[] = [];
  for (const line of text.split('\n')) {
    if (isComment(line)) continue;
    for (const match of line.matchAll(MODIFIER_CALL)) {
      const fn = match[1] ?? '';
      const chain = (match[2] ?? '').split('.').filter((part) => part !== '');
      for (const segment of chain) {
        if (!HARMLESS_MODIFIERS.has(segment)) out.push(`${file}: ${fn}.${segment}`);
      }
    }
  }
  return out;
}

/**
 * A test whose callback body is empty.
 *
 * Only the literal empty block. A body emptied to a comment or a no-op is not
 * matched, and the assertion floor is the instrument for that, because every
 * form of emptying removes the body's expect() calls. Two rules for one gap,
 * said out loud rather than left for a reader to discover.
 */
const EMPTY_BODY =
  /(?:^|[^.\w])(?:test|it)(?:\.[A-Za-z][A-Za-z0-9]*)*\s*\(\s*(['"`])(?:\\.|(?!\1)[^\\])*\1\s*,\s*(?:async\s*)?\(\s*\)\s*=>\s*\{\s*\}\s*\)/g;

export function emptyBodyOffenders(file: string, text: string): readonly string[] {
  return [...text.matchAll(EMPTY_BODY)].map(() => `${file}: a test with an empty body`);
}
```

- [ ] **Step 5: Run it to verify the first three probes pass**

Run: `pnpm exec vitest run --project unit guards/freeze.test.ts > /tmp/f2.log 2>&1; echo "EXIT=$?"; grep -E "FAIL|ReferenceError|Tests " /tmp/f2.log`

Expected: **EXIT=1** still, but now **3 passing and 6 failing**. Step 4 defines two functions, `modifierOffenders` and `emptyBodyOffenders`, so the modifier probe, the empty-body probe and the tree probe pass. The other six still fail, because Step 6 defines everything they call. Counts advisory as above; what is binding is that exactly those three pass.

- [ ] **Step 6: Write the counts, the floor and the collection rule**

Insert below the functions added in Step 4:

```ts
// THREE counts, not one, because no single instrument catches every way a
// frozen suite can shrink. Each is recorded in freeze-baseline.json and each is
// a floor. The founder asked on approval for the primary check to catch what
// the regex overcounts, and for the counting rule and its blind spots to be
// written down. This is that, with one correction measured on 2026-10-09 and
// recorded in the log entry: `vitest list --json` does NOT expand a
// `test.each`, so it cannot be the instrument that catches a removed case.
//
//   | Instrument            | Frozen count | Catches a removed each case |
//   | --------------------- | ------------ | --------------------------- |
//   | each-aware, primary   | 437          | yes                         |
//   | vitest list, secondary| unit 239, db 170 | no                      |
//   | regex call sites      | 411          | no                          |

/**
 * A `test` or `it` call site, with its dotted modifier chain in group 1.
 *
 * Not an AST walk. A `test` or `it` identifier, not preceded by a dot or a word
 * character, then any dotted modifiers, then an open parenthesis.
 */
const TEST_CALL = /(?:^|[^.\w])(?:test|it)((?:\.[A-Za-z][A-Za-z0-9]*)*)\s*\(/g;
const ASSERTION_CALL = /(?:^|[^.\w])expect\s*\(/g;

/**
 * How many cases a `.each(` table holds, when and only when the table is a
 * literal array this function can count with certainty.
 *
 * `from` is the index just after the opening parenthesis. Returns the element
 * count, or **null meaning opaque**. Null is not an error and not a zero: it is
 * the answer "this table's size cannot be read from the text", and the caller
 * is required to record it rather than guess. That is the founder's tightening
 * of 2026-10-09: an unparseable table must be counted as opaque and reported,
 * never silently counted as zero or one.
 *
 * It returns null, deliberately, for every one of these:
 *
 * - A table that is not an array literal at all: `test.each(transient)` in
 *   db/test/poll.test.ts, or a template-literal table.
 * - An array holding a spread, `[...cases, ['x']]`, whose size depends on a
 *   value this function cannot see.
 * - An array whose closing bracket is never found, which means the text is not
 *   what this parser assumed and any number it returned would be invented.
 *
 * It returns 0 for an empty literal `[]`, which is a real count and not a
 * failure to parse. Counting that as 1 would be the exact silent-one the
 * tightening forbids.
 *
 * Elements are counted as elements, not as commas plus one, so a trailing comma
 * in `[['a'], ['b'],]` gives 2 and not 3. Bracket depth is tracked so a nested
 * array or object inside one case does not miscount.
 *
 * This is what makes the primary count catch a case deleted from an `each`
 * table. Neither the regex call-site count nor `vitest list --json` can: both
 * count the declaration once, measured on 2026-10-09 against
 * shared/src/agent-output.test.ts, which has a ten-case `test.each` and shows
 * as ONE entry in `vitest list --json`, named with its `%s` unresolved.
 */
export function literalEachCases(text: string, from: number): number | null {
  let i = from;
  while (i < text.length && /\s/.test(text[i] ?? '')) i += 1;
  if (text[i] !== '[') return null;

  let depth = 0;
  let elements = 0;
  let sawContent = false;

  for (; i < text.length; i += 1) {
    const char = text[i];

    if (char === '[' || char === '(' || char === '{') {
      depth += 1;
      if (depth > 1) sawContent = true;
      continue;
    }

    if (char === ']' || char === ')' || char === '}') {
      depth -= 1;
      if (depth === 0) return sawContent ? elements + 1 : elements;
      continue;
    }

    // A spread at the top level makes the size unknowable from the text.
    if (depth === 1 && char === '.' && text.startsWith('...', i)) return null;

    if (depth === 1 && char === ',') {
      if (sawContent) elements += 1;
      sawContent = false;
      continue;
    }

    if (!/\s/.test(char ?? '')) sawContent = true;
  }

  // The closing bracket was never found, so this is not the shape assumed.
  return null;
}

/**
 * The TERTIARY count: call sites, one per declaration.
 *
 * Four blind spots, all of which make it HIGHER than the number of tests that
 * run, so it is weaker than it looks and never stricter:
 *
 * - A `test.each` counts once however many cases it expands to. This is the one
 *   the primary count exists to cover.
 * - A `test(` or `expect(` inside a comment or a string counts, so commenting a
 *   test out does not move it. Deliberate: a count that changed when a comment
 *   was reflowed would be useless as a floor. Measured cost of this on
 *   2026-10-09: 411 here against 409 that vitest collects, a difference of two.
 * - An assertion inside a helper counts once where the helper is written, not
 *   once per call.
 * - `assert(` instead of `expect(` counts as nothing.
 */
export function countTests(text: string): number {
  return [...text.matchAll(TEST_CALL)].length;
}

export function countAssertions(text: string): number {
  return [...text.matchAll(ASSERTION_CALL)].length;
}

/**
 * The PRIMARY count: declarations, with every literal `each` table expanded.
 *
 * This is the only one of the three that falls when a case is deleted from an
 * `each` table, which is why it is primary. An `each` whose table is not a
 * literal contributes one and is counted separately by `opaqueEachCount` below,
 * so the number of places this count is blind is itself recorded rather than
 * assumed to be zero.
 */
export function countExpandedTests(text: string): number {
  let total = 0;
  for (const match of text.matchAll(TEST_CALL)) {
    const chain = (match[1] ?? '').split('.').filter((part) => part !== '');
    if (!chain.includes('each')) {
      total += 1;
      continue;
    }
    const cases = literalEachCases(text, match.index + match[0].length);
    total += cases ?? 1;
  }
  return total;
}

/**
 * How many `each` tables this file's text cannot expand.
 *
 * The other half of failing closed. `countExpandedTests` has to return a
 * number, so an opaque table contributes one, which UNDERcounts its real cases.
 * That is safe for a floor but it is also invisible, and a literal table
 * rewritten into an expression would drop the expanded count while looking like
 * an ordinary edit. So the opaque tables are counted here and compared as a
 * CEILING: if the number rises, the expanded count has gone blind somewhere new
 * and that has to be a decision rather than a side effect.
 */
export function opaqueEachCount(text: string): number {
  let opaque = 0;
  for (const match of text.matchAll(TEST_CALL)) {
    const chain = (match[1] ?? '').split('.').filter((part) => part !== '');
    if (chain.includes('each') && literalEachCases(text, match.index + match[0].length) === null) opaque += 1;
  }
  return opaque;
}

/**
 * Whether the number of `each` tables the expanded count cannot read has risen.
 *
 * A ceiling, not a floor, which is why it is its own function. Every other
 * recorded number here fails when it DROPS. This one fails when it CLIMBS,
 * because each new opaque table is a set of cases the primary instrument stops
 * being able to see. Putting a ceiling inside a function named for floors would
 * make the next reader assume the direction.
 *
 * Lowering the recorded number by turning an expression back into a literal is
 * an improvement and does not fail. Raising it is a founder decision, the same
 * as raising any floor here.
 */
export function opaqueComplaints(
  actual: number,
  recorded: { readonly frozenOpaqueEachCount: number },
): readonly string[] {
  return actual > recorded.frozenOpaqueEachCount
    ? [`frozen opaque each tables: ${actual}, recorded ${recorded.frozenOpaqueEachCount}`]
    : [];
}

/**
 * The SECONDARY count: what vitest itself collects, per project.
 *
 * Read from `pnpm exec vitest list --project <name> --json`, counting only
 * entries whose file is a frozen baseline file. Two things it gives that the
 * regex cannot: a file dropped from the include list contributes zero, and a
 * `test(` written inside a comment or a string contributes nothing.
 *
 * One thing it does NOT give, measured on 2026-10-09 and the reason it is
 * secondary rather than primary: it does not expand a `test.each`. The
 * ten-case `test.each` in shared/src/agent-output.test.ts shows as ONE listed
 * entry, with its `%s` placeholder unresolved, and that file's listed count
 * equals its call-site count exactly.
 *
 * No whole-project total is quoted here. An earlier version of this comment
 * said the unit project lists 420 entries, which was true when it was written
 * and false by the end of the task that wrote it, because this very file
 * gained tests. A number that its own change invalidates does not belong in a
 * comment.
 *
 * It is recorded and compared, not computed inside the guard. A guard that
 * shelled out to vitest would be a test that runs the test runner.
 */
export type ListedCounts = { readonly unit: number; readonly db: number };

/**
 * Whether the frozen suites still hold at least what was recorded.
 *
 * A floor scoped to the frozen directories, which was the founder's decision
 * of 2026-10-09. `unitTestCount` in the baseline stays what it has always
 * been, a record of one measurement, because a floor over the whole unit
 * project goes red when somebody legitimately deletes a test in guards/ or
 * dashboards/, and a gate that fails on correct work is a gate somebody edits
 * rather than obeys.
 *
 * Scoped this way, red is always correct: a frozen test or a frozen assertion
 * disappearing IS the freeze violation this file exists to catch, and this is
 * the only check here that catches a test removed from a file that still
 * exists.
 *
 * A LOWER count fails and nothing here raises the recorded number to match it.
 * That is the founder's instruction on approval and it is the whole value of a
 * floor: a check that rewrote its own baseline on failure would record the loss
 * instead of reporting it. The recorded number in freeze-baseline.json may be
 * raised only in a commit the founder approves, and raising it is how a
 * genuinely larger frozen suite gets recognised.
 */
export type FrozenCounts = {
  readonly expanded: number;
  readonly calls: number;
  readonly assertions: number;
  readonly listed: ListedCounts;
};

export type FrozenBaseline = {
  readonly frozenExpandedTestCount: number;
  readonly frozenTestCallCount: number;
  readonly frozenAssertionCount: number;
  readonly frozenListedTestCount: ListedCounts;
};

export function floorComplaints(actual: FrozenCounts, recorded: FrozenBaseline): readonly string[] {
  const out: string[] = [];
  const below = (name: string, now: number, then: number) => {
    if (now < then) out.push(`${name}: ${now}, recorded ${then}`);
  };

  below('frozen expanded tests', actual.expanded, recorded.frozenExpandedTestCount);
  below('frozen test call sites', actual.calls, recorded.frozenTestCallCount);
  below('frozen assertions', actual.assertions, recorded.frozenAssertionCount);
  below('frozen listed tests (unit)', actual.listed.unit, recorded.frozenListedTestCount.unit);
  below('frozen listed tests (db)', actual.listed.db, recorded.frozenListedTestCount.db);

  return out;
}

/**
 * A vitest include glob as a regular expression.
 *
 * A globstar segment crosses directories and a single star does not, which is
 * the one distinction that matters for deciding whether a baseline file is
 * collected.
 */
const GLOB_SENTINEL = '\u0001';
export function globToRegExp(glob: string): RegExp {
  const source = glob
    .split('**/')
    .join(GLOB_SENTINEL)
    .replace(/[.+^${}()|[\]\\]/g, (char) => `\\${char}`)
    .split('*')
    .join('[^/]*')
    .split(GLOB_SENTINEL)
    .join('(?:.*/)?');
  return new RegExp(`^${source}$`);
}

/** Baseline files that no glob collects. */
export function uncollected(files: readonly string[], globs: readonly string[]): readonly string[] {
  const patterns = globs.map((glob) => globToRegExp(glob));
  return files.filter((file) => !patterns.some((pattern) => pattern.test(file)));
}
```

- [ ] **Step 7: Run it to verify all nine probes pass**

Run: `pnpm exec vitest run --project unit guards/freeze.test.ts > /tmp/f3.log 2>&1; echo "EXIT=$?"; grep -E "FAIL|Tests " /tmp/f3.log`

Expected: **EXIT=0**, 9 passed.

- [ ] **Step 8: Record the five new baseline numbers**

Edit `guards/freeze-baseline.json`. Keep `recordedAt`, `testFiles` and `unitTestCount` exactly as they are: `unitTestCount` 347 remains the record of one measurement and is still not compared. Add five keys after it:

```json
  "frozenExpandedTestCount": 437,
  "frozenTestCallCount": 411,
  "frozenAssertionCount": 955,
  "frozenListedTestCount": { "unit": 239, "db": 170 },
  "frozenOpaqueEachCount": 1
```

All five were measured on 2026-10-09 across the 46 baseline files:

| Key | Value | Direction | How it was measured |
| --- | --- | --- | --- |
| `frozenExpandedTestCount` | 437 | floor | 400 plain `test`/`it` call sites, plus 10 `test.each` with a literal table expanded to 36 cases, plus 1 opaque `each` contributing one. Three of those tables carry a trailing comma, which is why counting elements gives 36 where counting commas plus one gave 39 |
| `frozenTestCallCount` | 411 | floor | `test`/`it` call sites, one per declaration |
| `frozenAssertionCount` | 955 | floor | `expect(` call sites |
| `frozenListedTestCount` | unit 239, db 170 | floor | `pnpm exec vitest list --project unit --json` and the same for `db`, counting entries whose file is a frozen baseline file. No whole-project total is recorded, because adding a test to any non-frozen file moves it |
| `frozenOpaqueEachCount` | 1 | **ceiling** | `each` tables the text cannot expand. Exactly one today: `test.each(transient)` at `db/test/poll.test.ts:120` |

**Four floors and one ceiling.** The ceiling is the founder's tightening of
2026-10-09 and it is what makes the expanded count fail closed. An opaque table
contributes one case to the expanded count, which undercounts it, and that is
safe for a floor but invisible: rewriting a literal four-case table into
`test.each(cases)` would drop the expanded count by three while reading as an
ordinary refactor. The ceiling turns that into a failure. Lowering it, by
turning an expression back into a literal, is an improvement and passes.

**Raising any of these is a founder decision.** Nothing in the guard writes them, and a lower count fails. The command to recompute them is in the log entry so the next person can reproduce the numbers rather than trust them.

- [ ] **Step 9: Add the seven real-surface checks**

Append to `guards/freeze.test.ts`:

```ts
const baseline = JSON.parse(readRepoFile('guards/freeze-baseline.json')) as {
  recordedAt: string;
  testFiles: string[];
  unitTestCount: number;
  frozenExpandedTestCount: number;
  frozenTestCallCount: number;
  frozenAssertionCount: number;
  frozenListedTestCount: ListedCounts;
  frozenOpaqueEachCount: number;
};

const frozenTestFiles = () => FROZEN.flatMap((dir) => walkFiles(dir, { extensions: ['.test.ts'] }));

test('no frozen test is disabled, inverted, made exclusive or turned into a todo', () => {
  const offenders = frozenTestFiles().flatMap((file) => modifierOffenders(file, readRepoFile(file)));
  expect(offenders).toEqual([]);
});

test('no frozen test has had its body emptied', () => {
  const offenders = frozenTestFiles().flatMap((file) => emptyBodyOffenders(file, readRepoFile(file)));
  expect(offenders).toEqual([]);
});

test('no frozen test file has been deleted since the freeze', () => {
  // One of the two checks that catches removal. A deleted file does not fail,
  // does not warn and does not appear in a diff anybody reads closely.
  const present = new Set(frozenTestFiles());
  const missing = baseline.testFiles.filter((file) => !present.has(file));
  expect(missing).toEqual([]);
});

test('the frozen suites still hold every test and assertion that was recorded', () => {
  // The other check that catches removal, and the only one here that catches a
  // test removed from a file that still exists.
  //
  // The listed counts are read from the baseline rather than computed, because
  // computing them means shelling out to vitest and a test that runs the test
  // runner is not a test. They are compared, so a drop still fails; what the
  // guard cannot do is notice the drop by itself. The log entry records the
  // command that produces them.
  let expanded = 0;
  let calls = 0;
  let assertions = 0;
  let opaque = 0;
  for (const file of baseline.testFiles) {
    if (!FROZEN.includes(file.split('/')[0] ?? '')) continue;
    if (!existsExact(file)) continue;
    const text = readRepoFile(file);
    expanded += countExpandedTests(text);
    calls += countTests(text);
    assertions += countAssertions(text);
    opaque += opaqueEachCount(text);
  }

  expect(
    floorComplaints({ expanded, calls, assertions, listed: baseline.frozenListedTestCount }, baseline),
  ).toEqual([]);

  // The ceiling, checked here and not inside floorComplaints, because it fails
  // in the other direction. If this rises, the expanded count above has gone
  // blind to a set of cases it used to read.
  expect(opaqueComplaints(opaque, baseline)).toEqual([]);
});

test('the recorded listed counts still match what vitest collects', () => {
  // The secondary check, run as its own step rather than inside the guard. A
  // guard cannot shell out to vitest, so this test pins the number and the
  // COMMAND that produces it, and CI re-derives it in the compose-smoke job.
  //
  // If this is the only thing standing between a dropped include pattern and a
  // green run, note that `every frozen baseline file is still collected by
  // vitest` above catches that case directly, from the config, with no
  // subprocess. These two overlap on purpose.
  expect(baseline.frozenListedTestCount.unit).toBeGreaterThanOrEqual(239);
  expect(baseline.frozenListedTestCount.db).toBeGreaterThanOrEqual(170);
  expect(baseline.frozenExpandedTestCount).toBeGreaterThanOrEqual(baseline.frozenTestCallCount);
});

test('every frozen baseline file is still collected by vitest', () => {
  // Removing a file from vitest.config.ts's include list disarms it while
  // leaving it in place, so existence alone is not enough to check. The first
  // version of this guard checked one file of the 46.
  const config = readRepoFile('vitest.config.ts');
  const globs = [...config.matchAll(/'([^']*\.test\.ts)'/g)].map((match) => match[1] ?? '');

  expect(globs.length, 'no test glob was found in vitest.config.ts').toBeGreaterThanOrEqual(10);
  expect(uncollected(baseline.testFiles, globs)).toEqual([]);

  // The single route to Gmail, named on purpose as well as covered above: it is
  // the one file whose loss would be hardest to notice from a diff.
  const gmail = 'template/test/no-unapproved-send.test.ts';
  expect(existsExact(gmail), `${gmail} is gone`).toBe(true);
  expect(config, `${gmail} is no longer collected`).toContain(gmail);
});

test('this guard is reading the frozen suites, not an empty list', () => {
  expect(frozenTestFiles().length).toBeGreaterThanOrEqual(46);
  expect(baseline.testFiles.length).toBeGreaterThanOrEqual(46);
});
```

- [ ] **Step 10: Run the whole guard**

Run: `pnpm exec vitest run --project unit guards/freeze.test.ts > /tmp/f4.log 2>&1; echo "EXIT=$?"; grep -E "FAIL|AssertionError|Tests " /tmp/f4.log`

Expected: **EXIT=0**, 16 passed.

- [ ] **Step 11: Probe the collection check against the real `vitest.config.ts`**

This is the one live probe this task can run without writing into a frozen directory. `vitest.config.ts` is not frozen.

1. Run: `git status --porcelain vitest.config.ts`. Expected: empty output, before any edit.
2. Run: `cp vitest.config.ts /tmp/bak-vitest.config.ts`
3. Edit `vitest.config.ts` and delete the line `'api/**/*.test.ts',` from the `unit` project's include list.
4. Run: `pnpm exec vitest run --project unit guards/freeze.test.ts > /tmp/f-probe.log 2>&1; echo "EXIT=$?"; grep -A8 "every frozen baseline file" /tmp/f-probe.log | head -14`

   Expected: **EXIT=1**, the test `every frozen baseline file is still collected by vitest` fails and the failure lists the `api/` baseline files that no glob now matches. Record the first two lines.
5. Run: `cp /tmp/bak-vitest.config.ts vitest.config.ts`
6. Run: `git status --porcelain vitest.config.ts`. Expected: empty output.

- [ ] **Step 12: Confirm the guard is green again**

Run: `pnpm exec vitest run --project unit guards/freeze.test.ts > /tmp/f5.log 2>&1; echo "EXIT=$?"; tail -4 /tmp/f5.log`

Expected: **EXIT=0**, 16 passed.

- [ ] **Step 13: Typecheck and lint**

Run: `pnpm typecheck > /tmp/tc.log 2>&1; echo "EXIT=$?"; tail -4 /tmp/tc.log`

Expected: exit 0. Then, as a separate command:

Run: `pnpm lint > /tmp/l.log 2>&1; echo "EXIT=$?"; tail -4 /tmp/l.log`

Expected: exit 0.

- [ ] **Step 14: Commit**

```bash
git add guards/freeze.test.ts guards/freeze-baseline.json
```

Then, separately, write `/tmp/msg-task2.txt` holding:

```
test(guards): close every way to weaken a frozen suite

The modifier rule was a ban list of three names, so test.skipIf passed, and
that form was already used three times in this branch. It is now an allow
list: any chained modifier that is not one of the harmless ones fails, so
skipIf, runIf, fails and whatever vitest adds next all fail closed.

Adds an empty-body rule, a collection check over all 46 baseline files instead
of one, and three recorded floors in freeze-baseline.json.

Three floors and not one, because no single instrument catches every way a
frozen suite shrinks. frozenExpandedTestCount 437 expands every literal
test.each table, and it is the only one that falls when a case is deleted from
one. frozenListedTestCount, unit 239 and db 170, comes from vitest list --json
and is the only one immune to a test( written inside a comment.
frozenTestCallCount 411 and frozenAssertionCount 955 are regex counts of call
sites, kept with their four blind spots written down.

vitest list --json does NOT expand a test.each. Measured against
shared/src/agent-output.test.ts, whose ten-case table is one listed entry, so
the listed count is the secondary check and not the primary one.

None of the four self-adjusts. A lower count fails, and raising a recorded
number is a founder decision in a commit the founder approves. A check that
rewrote its own baseline on failure would record the loss instead of reporting
it.

All floors are scoped to the frozen directories. A floor over the whole unit
project goes red when somebody legitimately deletes a test elsewhere, and a
gate that fails on correct work gets edited.

M7 of the 2026-10-08 review, graded H3 by the 2026-10-09 one.
```

and run `git commit -F /tmp/msg-task2.txt`.

---

## Task 3: An exact version means an exact semver

**Files:**
- Modify: `guards/version-pinning.test.ts:29-41` and the loop body at `:71-74`
- Probe only, then restore: `package.json`

**Interfaces:**
- Consumes: `readRepoFile`, `trackedFiles` from `./lib/walk.ts`.
- Produces: `export function looseSpec(spec: string): string | null`, the complaint for one specifier, or `null` when it names one exact version.

**The inversion.** The current rule is a blacklist, `RANGE = /^[\^~>=<]|\s-\s|\|\||^\*$|^x$/`. It misses `1.x`, `1.2.x` and every dist-tag, because none of them starts with a range operator or equals `*` or `x` exactly. The replacement asks the opposite question: is this an exact semver? Anything that is not, fails. That covers the listed gaps and the ones nobody listed.

- [ ] **Step 1: Write the failing probe**

Append to `guards/version-pinning.test.ts`:

```ts
test('only an exact semver passes, whatever shape the range takes', () => {
  // The forms the 2026-10-08 review listed as missed, as M8.
  for (const spec of [
    '1.x',
    '1.2.x',
    'latest',
    'next',
    'beta',
    '*',
    'x',
    '^19.3.0',
    '~1.2.3',
    '>=1.0.0',
    '1.0.0 - 2.0.0',
    '1 || 2',
  ]) {
    expect(looseSpec(spec), `${spec} must be reported`).not.toBeNull();
  }

  // An alias carries its own specifier after the last @, and the first version
  // skipped every alias, so npm:react@^19 was never examined at all.
  expect(looseSpec('npm:react@^19'), 'npm:react@^19 must be reported').not.toBeNull();
  expect(looseSpec('npm:react@latest'), 'npm:react@latest must be reported').not.toBeNull();
  expect(looseSpec('jsr:@std/path@^1'), 'jsr:@std/path@^1 must be reported').not.toBeNull();

  // Review Focus 3: the other half. Inverting to an allow list makes every
  // unusual but valid specifier a failure unless it is covered on purpose.
  for (const spec of [
    '19.3.0',
    '1.2.3-rc.1',
    '1.2.3+build.5',
    '0.0.1',
    'workspace:*',
    'workspace:^',
    'catalog:default',
    'link:../design',
    'file:./vendor/pkg.tgz',
    'npm:react@19.3.0',
    'jsr:@std/path@1.0.0',
  ]) {
    expect(looseSpec(spec), `${spec} must NOT be reported`).toBeNull();
  }
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm exec vitest run --project unit guards/version-pinning.test.ts > /tmp/v-red.log 2>&1; echo "EXIT=$?"; grep -E "FAIL|ReferenceError|Tests " /tmp/v-red.log`

Expected: **EXIT=1** with `ReferenceError: looseSpec is not defined`.

- [ ] **Step 3: Confirm the old rule missed those forms**

Run:

```bash
node -e "const R=/^[\^~>=<]|\s-\s|\|\||^\*$|^x$/;for(const s of ['1.x','1.2.x','latest','next','beta'])console.log(s,'flagged by the old RANGE:',R.test(s))"
```

Expected: all five print `false`. Record those lines for the log entry.

- [ ] **Step 4: Replace the rule**

In `guards/version-pinning.test.ts`, replace the `RANGE` and `PROTOCOL` declarations with:

```ts
/**
 * An exact semver: major, minor, patch, with an optional prerelease and build.
 *
 * An allow list, asked the other way round from the first version. That one
 * listed range syntaxes and so missed `1.x`, `1.2.x` and every dist-tag:
 * `latest` starts with no range operator and equals neither `*` nor `x`, so it
 * passed a guard whose whole subject is unpinned versions. Finding M8 of the
 * 2026-10-08 review.
 */
const EXACT = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;

/**
 * Protocols that are exact by construction, so there is no version to read.
 *
 * pnpm resolves `workspace:*` to the version in this repository, and `link:`
 * and `file:` name a path. None of them can drift between two installs of the
 * same commit, which is the thing this guard protects.
 */
const EXACT_PROTOCOL = /^(?:workspace|catalog|link|file):/;

/**
 * A protocol that carries a package AND its own specifier, after the last `@`.
 *
 * The first version skipped these with everything else protocol-shaped, so
 * `npm:react@^19` was never examined for a range. The alias is exactly how a
 * range gets reintroduced without a `^` appearing at the start of the value.
 */
const ALIAS = /^(?:npm|jsr):/;

/** The complaint for one specifier, or null when it names one exact version. */
export function looseSpec(spec: string): string | null {
  if (EXACT_PROTOCOL.test(spec)) return null;

  let version = spec;
  if (ALIAS.test(spec)) {
    const at = spec.lastIndexOf('@');
    // An alias with no `@` after the protocol names no version at all, which is
    // the widest range there is.
    if (at <= spec.indexOf(':')) return `${spec} names no version`;
    version = spec.slice(at + 1);
  }

  return EXACT.test(version) ? null : `${spec} is not one exact version`;
}
```

- [ ] **Step 5: Point the existing rule at it**

In the same file, replace the inner loop over dependency entries with:

```ts
      for (const [name, spec] of Object.entries(deps as Record<string, string>)) {
        const complaint = looseSpec(spec);
        if (complaint !== null) loose.push(`${manifest} ${field}.${name}: ${complaint}`);
      }
```

- [ ] **Step 6: Run it to verify the probe passes and the repository still complies**

Run: `pnpm exec vitest run --project unit guards/version-pinning.test.ts > /tmp/v2.log 2>&1; echo "EXIT=$?"; grep -E "FAIL|AssertionError|Tests " /tmp/v2.log`

Expected: **EXIT=0**, 3 passed. Every one of the nine manifests already holds exact versions, so widening the rule must not report anything. If it does report, read the offender before changing the rule: it is a real unpinned dependency.

- [ ] **Step 7: Probe the real manifest, one form at a time**

`package.json` at the repository root is not frozen. For each row below:

1. Run: `git status --porcelain package.json`. Expected: empty, before any edit.
2. Run: `cp package.json /tmp/bak-package.json`
3. Edit `package.json` to set the named devDependency to the probe value.
4. Run: `pnpm exec vitest run --project unit guards/version-pinning.test.ts > /tmp/v-probe.log 2>&1; echo "EXIT=$?"; grep -A4 "exact version" /tmp/v-probe.log | head -8`

   Expected: **EXIT=1**, naming `package.json devDependencies.yaml` and the probe value. Record the line.
5. Run: `cp /tmp/bak-package.json package.json`
6. Run: `git status --porcelain package.json`. Expected: empty.

| Row | Dependency | Probe value | Why this form |
| --- | --- | --- | --- |
| 1 | `yaml` | `2.x` | The minor wildcard the old blacklist missed |
| 2 | `yaml` | `latest` | A dist-tag, which resolves to different bytes on different days |
| 3 | `yaml` | `npm:yaml@^2` | An alias, which the old rule skipped entirely |

Do not run `pnpm install` between the edit and the restore. The lockfile must not change.

- [ ] **Step 8: Confirm green, then typecheck and lint**

Run: `pnpm exec vitest run --project unit guards/version-pinning.test.ts > /tmp/v3.log 2>&1; echo "EXIT=$?"; tail -4 /tmp/v3.log`

Expected: exit 0. Then `pnpm typecheck` on its own, then `pnpm lint` on its own, each expected exit 0.

- [ ] **Step 9: Commit**

```bash
git add guards/version-pinning.test.ts
```

Then, separately, write `/tmp/msg-task3.txt` holding:

```
test(guards): an exact version means an exact semver, aliases included

The rule listed range syntaxes, so 1.x, 1.2.x, latest, next and beta all
passed: none starts with a range operator and none equals * or x. It now asks
the opposite question, is this one exact semver, so every shape of range fails
including the ones nobody listed.

npm: and jsr: aliases were skipped with the other protocols, so npm:react@^19
was never examined. The specifier after the last @ is now read.

M8 of the 2026-10-08 review.
```

and run `git commit -F /tmp/msg-task3.txt`.

---

## Task 4: An env-file reference is resolved, not grepped

**Files:**
- Modify: `guards/standing-rules.test.ts`, the env-climb test at `:187-213` and the helpers above it
- Probe only, then restore: `scripts/dev-db.mjs`

**Interfaces:**
- Consumes: `REPO_ROOT`, `readRepoFile`, `trackedFiles` from `./lib/walk.ts`; `ENV_CLIMB_ALLOWED` already in the file at line 74; `scannable()`, `SELF` and `readTracked` already in the file.
- Produces:

```ts
export function envTokens(line: string): readonly string[]
export function envReferenceVerdict(file: string, line: string): 'none' | 'inside' | 'outside' | 'unresolvable'
```

**The reasoning being carried across.** `guards/vite-fs-allow.test.ts:11-15` says a text scan passes on `allow: [join(ROOT, '..')]` and on an identifier defined three lines higher, so it resolves the values instead. The env scan has the same shape of hole and a worse consequence: it requires `.env` and `..` on the same line, so `/home/other/project/.env.local` and `~/.env.local` both pass, and those are the natural ways to name a file outside this repository, which is the entire subject of CLAUDE.md section 6.

**The second change, which matters as much.** Today an unresolvable reference silently passes. After this it is a failure that has to be allowlisted. The scan goes from failing open to failing closed.

- [ ] **Step 1: Write the failing probe**

Append to `guards/standing-rules.test.ts`:

```ts
test('an env-file reference is judged by where it resolves, not by whether its line holds two dots', () => {
  // Finding H2 of the 2026-10-09 review. Each of these names a file outside
  // this repository and none of them has `..` on the line, so the first
  // version passed all three.
  expect(envReferenceVerdict('scripts/dev-db.mjs', "loadEnvFile('/home/other/proj/.env.local')")).toBe('outside');
  expect(envReferenceVerdict('scripts/dev-db.mjs', "loadEnvFile('~/.env.local')")).toBe('outside');
  expect(envReferenceVerdict('scripts/dev-db.mjs', "loadEnvFile('C:/Users/other/.env.local')")).toBe('outside');

  // A climb that leaves the repository is still caught.
  expect(envReferenceVerdict('scripts/dev-db.mjs', "loadEnvFile('../../.env.local')")).toBe('outside');

  // This project's own file, named from a subdirectory and from the root, is
  // inside and is not a finding.
  expect(envReferenceVerdict('scripts/dev-db.mjs', "existsSync('.env.local')")).toBe('inside');
  expect(envReferenceVerdict('vitest.config.ts', "existsSync('.env.local')")).toBe('inside');
  expect(envReferenceVerdict('guards/compose-smoke-env.test.ts', "const F = 'template/.env.frontdesk';")).toBe(
    'inside',
  );

  // Review Focus 4: a path assembled at runtime cannot be resolved, and that is
  // now a failure to be allowlisted rather than a silent pass.
  expect(envReferenceVerdict('db/prisma.config.ts', "resolve(process.cwd(), '..', '.env.local')")).toBe(
    'unresolvable',
  );
  expect(envReferenceVerdict('x/y.ts', "loadEnvFile(join(__dirname, '.env.local'))")).toBe('unresolvable');

  // A line that names no env file at all.
  expect(envReferenceVerdict('x/y.ts', 'const u = process.env.DATABASE_URL;')).toBe('none');
  expect(envReferenceVerdict('x/y.ts', 'loadEnvFile(envPath)')).toBe('none');

  expect(envTokens("loadEnvFile('../.env.local')")).toEqual(['../.env.local']);
  expect(envTokens('cat > template/.env.frontdesk <<EOF')).toEqual(['template/.env.frontdesk']);
  expect(envTokens('const u = process.env.X;')).toEqual([]);
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm exec vitest run --project unit guards/standing-rules.test.ts > /tmp/s-red.log 2>&1; echo "EXIT=$?"; grep -E "FAIL|ReferenceError|Tests " /tmp/s-red.log`

Expected: **EXIT=1** with `ReferenceError: envReferenceVerdict is not defined`.

- [ ] **Step 3: Confirm the old rule passed an absolute path**

Run:

```bash
node -e "for(const l of [\"loadEnvFile('/home/other/proj/.env.local')\",\"loadEnvFile('~/.env.local')\"]){const p=l.replaceAll('process.env','');console.log(JSON.stringify(l),'flagged by the old rule:', /\.env\b/.test(p) && p.includes('..'))}"
```

Expected: both print `false`. Record those lines.

- [ ] **Step 4: Write the resolving rule**

Insert above the env-climb test in `guards/standing-rules.test.ts`:

```ts
/**
 * Every token on a line that names an env file.
 *
 * A token, not a string literal, because an env file is named in shell and in
 * YAML as often as in TypeScript: `cat > template/.env.frontdesk <<EOF` has no
 * quotes around the path.
 *
 * `process.env` is removed first. It is the environment, not a file on disk,
 * and leaving it in made every program that reads a variable look like a
 * program that reads a file.
 */
export function envTokens(line: string): readonly string[] {
  const stripped = line.replaceAll('process.env', '');
  return [...stripped.matchAll(/[^\s'"`(),;:=<>|]*\.env[^\s'"`(),;<>|]*/g)]
    .map((match) => match[0])
    .filter((token) => /\.env\b/.test(token));
}

/**
 * Values that make a path impossible to resolve by reading the file.
 *
 * Each is a real runtime value, so a path built from one cannot be judged here.
 * The verdict is `unresolvable`, which fails, rather than a skip, which passes.
 * That reversal is the point: the first version of this scan failed open on
 * everything it could not understand.
 */
const RUNTIME_PARTS = ['process.cwd()', '__dirname', '__filename', 'homedir(', 'os.homedir', 'import.meta.dirname'];

/** A path that starts at a filesystem root, on either platform, or at a home directory. */
const isRooted = (token: string) => token.startsWith('/') || token.startsWith('~') || /^[A-Za-z]:[\\/]/.test(token);

/**
 * Where one line's env-file reference points.
 *
 * `none` means the line names no env file. `inside` means every file it names
 * resolves within this repository. `outside` means at least one does not, which
 * is what CLAUDE.md section 6 forbids: a key read from outside this repository
 * cannot be rotated by anybody reading this repository. `unresolvable` means
 * the path is assembled from a runtime value and this file cannot tell.
 *
 * Resolution is against the directory holding the file, except for a workflow,
 * whose steps run in the workspace root. That distinction is the same one
 * guards/deploy-surface.test.ts states and pins, for the same reason: getting
 * the base wrong in either direction is a hole.
 */
export function envReferenceVerdict(file: string, line: string): 'none' | 'inside' | 'outside' | 'unresolvable' {
  const tokens = envTokens(line);
  if (tokens.length === 0) return 'none';

  const base = file.startsWith('.github/workflows/') ? REPO_ROOT : join(REPO_ROOT, dirname(file));

  for (const token of tokens) {
    if (isRooted(token)) return 'outside';
    const rel = relative(REPO_ROOT, resolve(base, token));
    if (rel.startsWith('..') || isAbsolute(rel)) return 'outside';
  }

  return RUNTIME_PARTS.some((part) => line.includes(part)) ? 'unresolvable' : 'inside';
}
```

Add `dirname`, `isAbsolute`, `join`, `relative` and `resolve` to the file's existing `node:path` import, and `REPO_ROOT` to its import from `./lib/walk.ts` if absent.

- [ ] **Step 5: Replace the env-climb test with the resolving one**

Replace the test `every env-file reference that climbs a directory is one of the recorded ones` with:

```ts
test('every env-file reference resolves inside this repository, or is one of the recorded ones', () => {
  const flagged = new Map<string, string>();

  for (const file of scannable()) {
    if (file === SELF) continue;
    const text = readTracked(file);
    if (text === undefined) continue;

    for (const line of text.split('\n')) {
      const verdict = envReferenceVerdict(file, line);
      if (verdict === 'outside' || verdict === 'unresolvable') {
        flagged.set(file, `${verdict}: ${line.trim().slice(0, 100)}`);
        break;
      }
    }
  }

  expect(
    [...flagged.keys()].sort(),
    `this guard cannot place these env references inside the repository: ${JSON.stringify([...flagged])}`,
  ).toEqual(Object.keys(ENV_CLIMB_ALLOWED).sort());

  for (const [file, snippet] of Object.entries(ENV_CLIMB_ALLOWED)) {
    expect(readRepoFile(file), `${file} no longer holds the reference this allowlist entry describes`).toContain(
      snippet,
    );
  }
});
```

- [ ] **Step 6: Run it, and expect to learn something**

Run: `pnpm exec vitest run --project unit guards/standing-rules.test.ts > /tmp/s2.log 2>&1; echo "EXIT=$?"; grep -E "FAIL|AssertionError|cannot place" /tmp/s2.log | head -6`

Expected: **EXIT=0**. The two allowlisted files are `db/prisma.config.ts`, whose line holds `process.cwd()` and so is `unresolvable`, and `package.json`, whose `--env-file=../.env.local` resolves above the root from the manifest's own directory and so is `outside`. Both are already in `ENV_CLIMB_ALLOWED` with their reasons.

If a third file is reported, do not widen the allowlist to make this green. Read the line. The point of this change is that it reports things the old scan could not see.

- [ ] **Step 7: Probe the real surface with an absolute path**

`scripts/dev-db.mjs` is not frozen and already reads an env file, so it is the honest surface.

1. Run: `git status --porcelain scripts/dev-db.mjs`. Expected: empty.
2. Run: `cp scripts/dev-db.mjs /tmp/bak-dev-db.mjs`
3. Edit `scripts/dev-db.mjs` and change `if (existsSync('.env.local')) process.loadEnvFile('.env.local');` to `if (existsSync('/home/other/project/.env.local')) process.loadEnvFile('/home/other/project/.env.local');`
4. Run: `pnpm exec vitest run --project unit guards/standing-rules.test.ts > /tmp/s-probe.log 2>&1; echo "EXIT=$?"; grep -A10 "cannot place" /tmp/s-probe.log | head -14`

   Expected: **EXIT=1**, the test fails and names `scripts/dev-db.mjs` with `outside:` and the line. Record it.
5. Run: `cp /tmp/bak-dev-db.mjs scripts/dev-db.mjs`
6. Run: `git status --porcelain scripts/dev-db.mjs`. Expected: empty.

- [ ] **Step 8: Confirm green, then go straight to Task 5**

Run: `pnpm exec vitest run --project unit guards/standing-rules.test.ts > /tmp/s3.log 2>&1; echo "EXIT=$?"; tail -4 /tmp/s3.log`

Expected: exit 0. Do not commit yet: Task 5 edits the same file and the two commit together.

---

## Task 5: The two residual section 6a gaps

**Files:**
- Modify: `guards/standing-rules.test.ts`: `mailValueAllowed` around line 130, `isConfig` at line 109, and the domain comparison in the address scan at line 290
- Probe only, then restore: `.github/workflows/ci.yml`, `scripts/ci-seed-instance.ts`

**Interfaces:**
- Consumes: everything Task 4 added to this file, plus `ALLOWED_TEST_ADDRESSES`, `ALLOWED_TEST_DOMAINS` and `NOT_OURS` already in it.
- Produces:

```ts
export function isReservedDomain(domain: string): boolean
export function mailValueAllowed(raw: string): boolean   // behaviour changed, signature unchanged
```

**Gap (a), and the trap in it.** `mailValueAllowed` returns true for any value starting with `$`, so `MAIL_FROM: ${{ secrets.OWNER_MAILBOX }}` passes. But a blanket rejection of `$` would fail `template/compose.yml`, which sets `MAIL_FROM: "${MAIL_FROM:?}"` on two lines and is **frozen**. Those are not the same thing. A compose substitution reads a value from the instance's own env file, which is never committed and never reaches CI. A GitHub Actions expression injects a repository secret into a CI run, and CI is an environment section 6a covers. So the rule splits by kind.

**Gap (b), and the two traps in it.** The address scan reads only `.env.example` and YAML. Widening it to every tracked source file reports about 80 addresses, 19 of them real and registrable, all inside frozen test fixtures such as `frontdesk/src/filter.test.ts`, which asserts that `no-reply@stripe.com` is filtered. Putting 19 real addresses on an allowlist would empty the allowlist of meaning, and the files cannot be edited because they are frozen. So the widening excludes **frozen** test files only, by the founder's change on approval: a non-frozen test can be corrected and must still fail on a real address.

That change exposes the second trap. `guards/standing-rules.test.ts:87` holds `ceo@bigtestcorp.com`, a real company's real mailbox, written there on purpose as the counter-example that explains why the allowlist is a list of exact addresses rather than a substring rule. It is a non-frozen test file, so the founder's change brings it into scope and the guard fails on its own documentation. The file already declares `SELF` and already exempts itself from the env scan for precisely this reason, in its own header at lines 10 to 16. That one exemption extends to the address scan, and a probe pins that it is the only one.

One more thing is then required rather than optional: `shared/src/gmail/fake.ts:121` holds `maya@okafor.example`, whose domain is reserved by RFC 2606 because its last label is `example`, and the exact-string allowlist does not contain it. `shared/` is frozen. Without the reserved-label fix the widened scan cannot go green at all.

- [ ] **Step 1: Write the failing probes**

Append to `guards/standing-rules.test.ts`:

```ts
test('a mail variable may read a value from outside the repository, but not from a CI secret', () => {
  // The gap: any $-prefixed value passed, so a repository secret holding a real
  // mailbox reached CI with every assertion green.
  expect(mailValueAllowed('${{ secrets.OWNER_MAILBOX }}')).toBe(false);
  expect(mailValueAllowed('${{ vars.MAIL_FROM }}')).toBe(false);
  expect(mailValueAllowed('${{ env.SOMETHING }}')).toBe(false);

  // A compose substitution is not the same thing. It reads the instance's own
  // env file, which is never committed and never reaches CI, and
  // template/compose.yml sets exactly this on two lines and is frozen.
  expect(mailValueAllowed('${MAIL_FROM:?}')).toBe(true);
  expect(mailValueAllowed('${MAIL_FROM}')).toBe(true);
  expect(mailValueAllowed('${MAIL_FROM:-smoke@example.com}')).toBe(true);
  expect(mailValueAllowed('$MAIL_FROM')).toBe(true);

  // Review Focus 5: the cases must not collapse into one.
  expect(mailValueAllowed('')).toBe(true);
  expect(mailValueAllowed('smoke@example.com')).toBe(true);
  expect(mailValueAllowed('founder@orbitumai.com')).toBe(false);
  expect(mailValueAllowed('smoke')).toBe(false);
});

test('a domain reserved by its top-level label is recognised as reserved', () => {
  // shared/src/gmail/fake.ts holds maya@okafor.example. RFC 2606 reserves
  // .example, so okafor.example cannot be delivered to, but an exact-string
  // list does not contain it and shared/ is frozen.
  expect(isReservedDomain('okafor.example')).toBe(true);
  expect(isReservedDomain('mail.example')).toBe(true);
  expect(isReservedDomain('example')).toBe(true);
  expect(isReservedDomain('a.b.test')).toBe(true);
  expect(isReservedDomain('x.invalid')).toBe(true);
  expect(isReservedDomain('localhost')).toBe(true);
  expect(isReservedDomain('example.com')).toBe(true);
  expect(isReservedDomain('mail.example.com')).toBe(true);

  // Real and registrable. The substring trap the 2026-10-08 decision named: a
  // rule accepting anything containing "example" accepts these.
  expect(isReservedDomain('example.io')).toBe(false);
  expect(isReservedDomain('myexample.com')).toBe(false);
  expect(isReservedDomain('example.com.co')).toBe(false);
  expect(isReservedDomain('orbitumai.com')).toBe(false);
  expect(isReservedDomain('firm.com')).toBe(false);
  expect(isReservedDomain('x.com')).toBe(false);
});

test('the address scan reads program source, and leaves test fixtures alone', () => {
  const scanned = trackedFiles().filter(isConfig);

  // The gap: the owner address in a seed script was outside the scan.
  expect(scanned, 'the seed script must be scanned').toContain('scripts/ci-seed-instance.ts');
  expect(scanned, 'env examples stay in scope').toContain('.env.example');
  expect(scanned, 'workflows stay in scope').toContain('.github/workflows/ci.yml');

  // FROZEN test fixtures are out of scope. frontdesk/src/filter.test.ts asserts
  // that no-reply@stripe.com is filtered, which is a fixture and not a mailbox
  // anything sends to, and including it would put 19 real addresses from files
  // that cannot be edited on an allowlist and empty it of meaning.
  expect(scanned, 'a frozen test fixture is out of scope').not.toContain('frontdesk/src/filter.test.ts');
  expect(scanned, 'a frozen test fixture is out of scope').not.toContain('db/test/auth.test.ts');
  expect(scanned, 'a frozen test fixture is out of scope').not.toContain('shared/src/gmail/client.test.ts');
  expect(scanned, 'the prototype is not ours').not.toContain('reference/orbit-os-frontend/assets/data/people.js');

  // A NON-frozen test IS in scope, by the founder's instruction on approval. A
  // test in guards/ or dashboards/ can be corrected; a frozen one cannot.
  expect(scanned, 'a non-frozen test is in scope').toContain('guards/mock-boundary.test.ts');
  expect(scanned, 'a non-frozen test is in scope').toContain('guards/compose-smoke-env.test.ts');

  // This file is the one exemption beyond the frozen tests and what is not
  // ours, because line 87 names a real mailbox as the counter-example that
  // explains the allowlist. Anything else in guards/ is scanned.
  expect(scanned, 'this file documents real addresses on purpose').not.toContain('guards/standing-rules.test.ts');
  expect(scanned, 'every other guard is scanned').toContain('guards/freeze.test.ts');
  expect(scanned, 'every other guard is scanned').toContain('guards/deploy-surface.test.ts');

  expect(scanned.length, 'the scan read a list, not nothing').toBeGreaterThanOrEqual(120);
});

test('the extension list the address scan rests on is pinned', () => {
  // The founder's change on approval. Task 0 proved that this plan and
  // docs/decisions.md are safe from the widened scan for exactly one reason:
  // `.md` is not in the extension list. Both documents quote real registrable
  // domains on purpose, as the counter-examples that make the rules legible, so
  // adding `.md` here would make the guard fail on its own documentation and on
  // the log entry that explains it.
  //
  // Written out by hand, never derived from the regex, because a test that
  // rebuilt the list from the thing it is pinning would pin nothing. Adding an
  // extension is then a deliberate change that fails here until this line is
  // updated, which is the point.
  expect(SCANNED_EXTENSIONS).toEqual(['ya?ml', 'ts', 'tsx', 'mjs', 'cjs', 'js', 'json', 'sql']);

  // The two that must stay OUT, and why each matters.
  expect(isConfig('docs/decisions.md'), 'the log quotes real domains as counter-examples').toBe(false);
  expect(isConfig('docs/superpowers/plans/2026-10-09-guard-hardening.md'), 'so does this plan').toBe(false);
  expect(isConfig('README.md')).toBe(false);
  expect(isConfig('CLAUDE.md')).toBe(false);

  // And the ones that must stay IN.
  expect(isConfig('scripts/ci-seed-instance.ts')).toBe(true);
  expect(isConfig('.github/workflows/ci.yml')).toBe(true);
  expect(isConfig('.env.example')).toBe(true);
  expect(isConfig('template/compose.yml')).toBe(true);
  expect(isConfig('db/prisma/seed.sql')).toBe(true);
});

test('a real registrable address in a NON-frozen test is reported', () => {
  // The founder's change on approval, and the half that is easy to lose: the
  // point of scanning non-frozen tests is that one of them holding a real
  // mailbox must fail. Proved against the rule rather than against the file
  // list, so it holds whatever the repository happens to contain today.
  const offendersIn = (file: string, text: string): readonly string[] => {
    if (!isConfig(file)) return [];
    const out: string[] = [];
    for (const match of text.matchAll(EMAIL)) {
      const address = match[0].toLowerCase();
      const domain = address.slice(address.indexOf('@') + 1);
      if (ALLOWED_TEST_ADDRESSES.includes(address)) continue;
      if (isReservedDomain(domain)) continue;
      out.push(`${file}: ${address}`);
    }
    return out;
  };

  // A non-frozen test with a real registrable address: reported.
  expect(offendersIn('guards/probe.test.ts', "const owner = 'owner@realcompany.com';")).toEqual([
    'guards/probe.test.ts: owner@realcompany.com',
  ]);
  expect(offendersIn('dashboards/src/apps/user/x.test.tsx', "const a = 'ceo@bigtestcorp.com';")).toEqual([
    'dashboards/src/apps/user/x.test.tsx: ceo@bigtestcorp.com',
  ]);
  // A non-frozen test with a reserved address: not reported.
  expect(offendersIn('guards/probe.test.ts', "const owner = 'maya@okafor.example';")).toEqual([]);
  // The same real address in a FROZEN test: out of scope, because that file
  // cannot be corrected.
  expect(offendersIn('frontdesk/src/filter.test.ts', "const a = 'no-reply@stripe.com';")).toEqual([]);
  expect(offendersIn('db/test/auth.test.ts', "const a = 'owner@firm.com';")).toEqual([]);
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm exec vitest run --project unit guards/standing-rules.test.ts > /tmp/m-red.log 2>&1; echo "EXIT=$?"; grep -E "FAIL|ReferenceError|AssertionError" /tmp/m-red.log | head -8`

Expected: **EXIT=1**, **five** failures, which is every test Step 1 added. `mailValueAllowed('${{ secrets.OWNER_MAILBOX }}')` returns true where false is required. `isReservedDomain is not defined`. `SCANNED_EXTENSIONS is not defined`. The seed script is absent from the scanned list. And the non-frozen-test probe calls `isReservedDomain` as well. Counts advisory as in Task 2; what is binding is that all five fail and none passes by accident.

- [ ] **Step 3: Split the mail rule by kind of substitution**

In `mailValueAllowed`, replace the line `if (value.startsWith('$')) return true; // an interpolation, resolved outside this file` with:

```ts
  // A GitHub Actions expression injects a repository secret or variable into a
  // CI run, and a secret can hold a real mailbox. Section 6a covers CI as much
  // as anywhere else, so this is not acceptable in a committed file, and the
  // founder decides case by case rather than this guard guessing.
  if (/\$\{\{/.test(value)) return false;

  // A compose or shell substitution is a different thing: it reads a value from
  // the instance's own env file, which is never committed and never reaches CI.
  // template/compose.yml sets `${MAIL_FROM:?}` on two lines and is frozen, so
  // rejecting this form would fail code that cannot be changed.
  if (/^\$\{[A-Za-z_][A-Za-z0-9_]*(?::[-?+][^}]*)?\}$/.test(value)) return true;
  if (/^\$[A-Za-z_][A-Za-z0-9_]*$/.test(value)) return true;

  // Any other $-shaped value is something this guard does not understand, and
  // not understanding a mail value is a reason to fail.
  if (value.startsWith('$')) return false;
```

Change `function mailValueAllowed` to `export function mailValueAllowed`.

- [ ] **Step 4: Add the reserved-domain rule and widen the scan**

Insert after the `ALLOWED_TEST_DOMAINS` declaration:

```ts
/**
 * Top-level labels reserved by RFC 2606 and RFC 6761. Nothing under them can be
 * delivered to and none of them can belong to a real company.
 */
const RESERVED_TLDS = ['example', 'test', 'invalid', 'localhost'];

/**
 * The three second-level domains RFC 2606 reserves. Exactly three, written out
 * here rather than read from ALLOWED_TEST_DOMAINS.
 *
 * The founder's instruction on approval: nothing else may be allowed by
 * pattern. Reading the other list would mean a later entry added there for a
 * different purpose silently widened what counts as undeliverable, and that
 * list exists to hold project-specific test mailboxes, which is a different
 * question from what the RFCs reserve.
 */
const RFC_2606_DOMAINS = ['example.com', 'example.net', 'example.org'];

/**
 * Whether a domain is reserved, and so cannot reach a real mailbox.
 *
 * Two rules and no third. The LAST label reserves a domain, which an
 * exact-string list missed: `okafor.example` is as undeliverable as `example`,
 * and `shared/src/gmail/fake.ts` holds an address at it. That file is frozen,
 * so without this the widened scan below cannot go green. And the three RFC
 * 2606 second-level domains, named one by one.
 *
 * Still not a substring rule. The 2026-10-08 decision warned that accepting
 * anything containing "example" accepts `myexample.com`, which is a real
 * company's real domain. This compares whole labels and whole domains.
 */
export function isReservedDomain(domain: string): boolean {
  const lower = domain.toLowerCase();
  const labels = lower.split('.');
  const last = labels[labels.length - 1] ?? '';
  return RESERVED_TLDS.includes(last) || RFC_2606_DOMAINS.includes(lower);
}

const isTestFile = (file: string) =>
  /\.(?:test|spec)\.[tj]sx?$/.test(file) || file.includes('__tests__/') || file.includes('__fixtures__/');

/**
 * A test file inside one of the seven frozen directories.
 *
 * Only these are excluded from the address scan, which was the founder's
 * instruction on approval. A non-frozen test must still fail on a real
 * registrable address, because a test in guards/ or dashboards/ can be
 * corrected and a frozen one cannot.
 *
 * The frozen ones are excluded because scanning them reports about 80 addresses
 * here, 19 of them real and registrable, every one inside a directory that
 * cannot be edited. `frontdesk/src/filter.test.ts` holds nine at `x.com` plus
 * `no-reply@stripe.com` and `noreply@github.com`, because it asserts that a
 * no-reply address is filtered, which is a fixture and not a mailbox anything
 * sends to. Putting those 19 on the allowlist would empty it of the meaning the
 * 2026-10-08 decision gave it.
 */
const isFrozenTestFile = (file: string) =>
  isTestFile(file) && FROZEN_DIRS.some((dir) => file.startsWith(dir));

/** The seven frozen directories, as path prefixes. */
const FROZEN_DIRS = ['frontdesk/', 'api/', 'db/', 'shared/', 'template/', 'ops/', 'design/'];
```

Then replace the `isConfig` declaration with:

```ts
/**
 * Configuration or program source a mailbox could reach a program through.
 *
 * Widened from `.env.example` and YAML, which left the owner address in
 * `scripts/ci-seed-instance.ts` outside the scan entirely. That was finding M2
 * of the 2026-10-09 review: the file writes a mailbox into a database, which is
 * exactly the reach section 6a is about.
 *
 * This file is excluded, and it is the ONLY exemption beyond the frozen tests
 * and the directories that are not ours. The reason is already written at the
 * top of this file for the env scan and applies here word for word: the
 * patterns it hunts are written out here as documentation. Line 87 names
 * `ceo@bigtestcorp.com`, a real company's real mailbox, as the counter-example
 * that explains why an allowlist of exact addresses is not a substring rule.
 * Scanning this file would make that comment a finding and the guard would fail
 * on its own reasoning. The probe below pins that this is the only exemption.
 */
/**
 * The extensions the scan reads, as one named list.
 *
 * Named and pinned by a test, which was the founder's change on approval. This
 * plan and `docs/decisions.md` are safe from the scan for exactly one reason:
 * `.md` is not here. Both quote real registrable domains on purpose, as the
 * counter-examples that make the rules legible, so adding `.md` would make the
 * guard fail on its own documentation. That should be a deliberate change that
 * fails a test, not a quiet one.
 */
const SCANNED_EXTENSIONS = ['ya?ml', 'ts', 'tsx', 'mjs', 'cjs', 'js', 'json', 'sql'] as const;
const SCANNED_EXTENSION = new RegExp(`\\.(?:${SCANNED_EXTENSIONS.join('|')})$`);

const isConfig = (file: string) =>
  file !== SELF &&
  !isFrozenTestFile(file) &&
  !NOT_OURS.some((skip) => file.includes(skip)) &&
  (file === '.env.example' || file.endsWith('/.env.example') || SCANNED_EXTENSION.test(file));
```

Finally, in the address scan test, replace the two allowlist checks with:

```ts
      if (ALLOWED_TEST_ADDRESSES.includes(address)) continue;
      if (isReservedDomain(domain)) continue;
```

- [ ] **Step 5: Run it to verify all three probes pass and the repository complies**

Run: `pnpm exec vitest run --project unit guards/standing-rules.test.ts > /tmp/m2.log 2>&1; echo "EXIT=$?"; grep -E "FAIL|AssertionError|Tests " /tmp/m2.log | head -8`

Expected: **EXIT=0**. The widened scan reads 106 non-test files holding 9 addresses, and every one is on a reserved domain once the top-level-label rule is in. If an address is reported, read it before touching the allowlist: a real address in program source is the finding this change exists to surface.

- [ ] **Step 6: Probe the real workflow with a CI secret**

1. Run: `git status --porcelain .github/workflows/ci.yml`. Expected: empty.
2. Run: `cp .github/workflows/ci.yml /tmp/bak-ci.yml`
3. Edit `.github/workflows/ci.yml` and change the `MAIL_FROM: smoke@example.com` line to `MAIL_FROM: ${{ secrets.OWNER_MAILBOX }}`.
4. Run: `pnpm exec vitest run --project unit guards/standing-rules.test.ts > /tmp/m-probe1.log 2>&1; echo "EXIT=$?"; grep -B2 -A8 "mail variable" /tmp/m-probe1.log | head -16`

   Expected: **EXIT=1**, the test `no mail variable in a tracked env example or workflow holds a non-placeholder value` fails and names `.github/workflows/ci.yml` and `MAIL_FROM`. Record it.
5. Run: `cp /tmp/bak-ci.yml .github/workflows/ci.yml`
6. Run: `git status --porcelain .github/workflows/ci.yml`. Expected: empty.

- [ ] **Step 7: Probe the seed script with a real address**

1. Run: `git status --porcelain scripts/ci-seed-instance.ts`. Expected: empty.
2. Run: `cp scripts/ci-seed-instance.ts /tmp/bak-seed.ts`
3. Edit `scripts/ci-seed-instance.ts` and change both `smoke@example.com` occurrences, at lines 52 and 53, to `owner@realcompany.com`.
4. Run: `pnpm exec vitest run --project unit guards/standing-rules.test.ts > /tmp/m-probe2.log 2>&1; echo "EXIT=$?"; grep -B2 -A8 "allowed test mailbox" /tmp/m-probe2.log | head -16`

   Expected: **EXIT=1**, the test `no tracked configuration names a mailbox that is not an allowed test mailbox` fails and names `scripts/ci-seed-instance.ts: owner@realcompany.com`. Record it. Before this change that file was not read at all.
5. Run: `cp /tmp/bak-seed.ts scripts/ci-seed-instance.ts`
6. Run: `git status --porcelain scripts/ci-seed-instance.ts`. Expected: empty.

- [ ] **Step 8: Confirm green, typecheck, lint, then commit Tasks 4 and 5 together**

Run: `pnpm exec vitest run --project unit guards/standing-rules.test.ts > /tmp/m3.log 2>&1; echo "EXIT=$?"; tail -4 /tmp/m3.log`

Expected: exit 0. Then `pnpm typecheck` alone, then `pnpm lint` alone, each exit 0.

```bash
git add guards/standing-rules.test.ts
```

Then, separately, write `/tmp/msg-task45.txt` holding:

```
test(guards): resolve env references, and close the two section 6a residuals

The cross-project env scan needed .env and .. on the same line, so an absolute
path, a home-relative path and a Windows path all passed. It now resolves each
token against the right base, repo root for a workflow and the file's own
directory otherwise, and a path assembled from a runtime value is reported as
unresolvable rather than skipped. The scan went from failing open to failing
closed. Review H2.

A mail variable may still read a compose substitution, which comes from the
instance's own uncommitted env file, but a GitHub Actions expression is now
refused: a repository secret can hold a real mailbox and CI is an environment
section 6a covers. Review M1.

The address scan read .env.example and YAML only, so the owner address in a
seed script was outside it. It now reads program source and skips test
fixtures, because scanning fixtures reports 19 real addresses in frozen files
and would empty the allowlist of meaning. Review M2.

A domain is reserved by its last label, so okafor.example is undeliverable. An
exact-string list missed it and shared/src/gmail/fake.ts holds an address at
it, in a frozen directory.
```

and run `git commit -F /tmp/msg-task45.txt`.

---

## Task 6: A Vite config must set `fs.allow` and leave `fs.strict` on

**Files:**
- Modify: `guards/vite-fs-allow.test.ts:17-20`, the paragraph that argues the opposite, and the rule
- Probe only, then restore: `dashboards/vite.config.ts`

**Interfaces:**
- Consumes: `REPO_ROOT`, `trackedFiles` from `./lib/walk.ts`; `configs()` and `allowList()` already in the file.
- Produces: `export function serverComplaints(config: string, settled: unknown): readonly string[]`, and a new internal `settledFor(config, command)` that `allowList` also uses.

**This reverses a documented decision, so the log entry needs `**Corrects:**`.** The file's header currently says, at lines 17 to 20, that it deliberately does not require `fs.allow` to be present, because a config leaving it unset gets Vite's own behaviour, which confines the server to its root. That reasoning is wrong in one specific way, finding M4 of the 2026-10-09 review: `server.fs.strict` can be set to `false`, and then Vite serves outside the root whether an allow list is present or not. A rule about what a set list may contain says nothing about a config that turns the confinement off.

- [ ] **Step 1: Write the failing probe**

Append to `guards/vite-fs-allow.test.ts`:

```ts
test('a config that turns the confinement off, or sets no allow list, is reported', () => {
  // Finding M4 of the 2026-10-09 review. strict: false serves outside the root
  // whatever the allow list says, which reproduces the exposure this file was
  // written for.
  expect(serverComplaints('dashboards/vite.config.ts', { server: { fs: { allow: ['.'], strict: false } } })).toEqual([
    'dashboards/vite.config.ts: server.fs.strict is false',
  ]);

  // A config that sets no allow list at all. The first version skipped it,
  // arguing that Vite's default confines the server. The default is only a
  // default, and the line above is how it stops applying.
  expect(serverComplaints('dashboards/vite.config.ts', {})).toEqual([
    'dashboards/vite.config.ts: server.fs.allow is not set',
  ]);
  expect(serverComplaints('dashboards/vite.config.ts', { server: { fs: {} } })).toEqual([
    'dashboards/vite.config.ts: server.fs.allow is not set',
  ]);

  // Both at once, both reported.
  expect(serverComplaints('x/vite.config.ts', { server: { fs: { strict: false } } })).toEqual([
    'x/vite.config.ts: server.fs.allow is not set',
    'x/vite.config.ts: server.fs.strict is false',
  ]);

  // The shipped shape: a list is set and strict is left alone.
  expect(serverComplaints('dashboards/vite.config.ts', { server: { fs: { allow: ['/a', '/b'] } } })).toEqual([]);
  // strict: true said out loud is fine.
  expect(serverComplaints('dashboards/vite.config.ts', { server: { fs: { allow: ['/a'], strict: true } } })).toEqual(
    [],
  );
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm exec vitest run --project unit guards/vite-fs-allow.test.ts > /tmp/fs-red.log 2>&1; echo "EXIT=$?"; grep -E "FAIL|ReferenceError|Tests " /tmp/fs-red.log`

Expected: **EXIT=1** with `ReferenceError: serverComplaints is not defined`.

- [ ] **Step 3: Write the rule**

Insert above the first `test(` in `guards/vite-fs-allow.test.ts`:

```ts
/**
 * What is wrong with one config's dev-server file access.
 *
 * Two rules the first version of this file did not have, both finding M4 of the
 * 2026-10-09 review.
 *
 * `fs.allow` must be SET. The header of this file used to argue the opposite:
 * that a config leaving it unset gets Vite's own behaviour, which confines the
 * server to its root, so the rule should only govern what a set list contains.
 * That is true until somebody writes the next line.
 *
 * `fs.strict` must not be false. With strict off, Vite serves outside the root
 * whether an allow list is present or not, so a guard that reads only the list
 * reports green on a config that has turned the confinement off. That is the
 * exact exposure this file was written for, reachable by a one-word edit.
 */
export function serverComplaints(config: string, settled: unknown): readonly string[] {
  const fs = (settled as { server?: { fs?: { allow?: unknown; strict?: unknown } } } | undefined)?.server?.fs;
  const out: string[] = [];

  if (fs?.allow === undefined) out.push(`${config}: server.fs.allow is not set`);
  if (fs?.strict === false) out.push(`${config}: server.fs.strict is false`);

  return out;
}
```

- [ ] **Step 4: Rewrite the header paragraph it contradicts**

Replace lines 17 to 20, the paragraph beginning "It deliberately does NOT require fs.allow to be present", with:

```ts
// It requires fs.allow to be SET, and requires fs.strict not to be false.
//
// An earlier version of this file argued the opposite about the first of those:
// that a config leaving the list unset gets Vite's own behaviour, which
// confines the server to its root, so the rule should govern only what a set
// list contains. Finding M4 of the 2026-10-09 review showed why that is not
// enough. `server.fs.strict: false` serves outside the root whether a list is
// present or not, so the reasoning protected a default that one word turns off.
```

- [ ] **Step 5: Extract the config loader and add the real-surface check**

Add this helper, and change `allowList(config)` to call `settledFor(config, 'serve')` instead of repeating the dynamic import:

```ts
/** One config's default export, settled for one command. */
async function settledFor(config: string, command: 'serve' | 'build'): Promise<unknown> {
  const absolute = join(REPO_ROOT, config);
  const loaded: unknown = await import(pathToFileURL(absolute).href);
  const exported = (loaded as { default?: unknown }).default;
  return typeof exported === 'function'
    ? await (exported as (env: { command: string; mode: string }) => unknown)({
        command,
        mode: command === 'build' ? 'production' : 'development',
      })
    : await exported;
}
```

Then append:

```ts
test('every vite config sets its allow list and leaves strict on', async () => {
  const offenders: string[] = [];
  let checked = 0;

  for (const config of configs()) {
    checked += 1;
    // Both commands, because a config may answer differently for each and the
    // dev server is the one that serves files.
    for (const command of ['serve', 'build'] as const) {
      offenders.push(...serverComplaints(`${config} (${command})`, await settledFor(config, command)));
    }
  }

  expect(offenders, 'a dev server with strict off, or with no allow list, serves the repository').toEqual([]);
  expect(checked, 'no vite config was examined').toBeGreaterThanOrEqual(1);
});
```

- [ ] **Step 6: Run the guard**

Run: `pnpm exec vitest run --project unit guards/vite-fs-allow.test.ts > /tmp/fs2.log 2>&1; echo "EXIT=$?"; grep -E "FAIL|AssertionError|Tests " /tmp/fs2.log`

Expected: **EXIT=0**, 4 passed. `dashboards/vite.config.ts` sets `fs.allow` at line 34 and does not mention `strict`, so it complies.

- [ ] **Step 7: Probe the real config, both ways**

`dashboards/vite.config.ts` is not frozen.

**Probe A, strict off:**
1. Run: `git status --porcelain dashboards/vite.config.ts`. Expected: empty.
2. Run: `cp dashboards/vite.config.ts /tmp/bak-vite.ts`
3. Edit it and change `fs: { allow: [DASHBOARDS, FROZEN_DESIGN] },` to `fs: { allow: [DASHBOARDS, FROZEN_DESIGN], strict: false },`
4. Run: `pnpm exec vitest run --project unit guards/vite-fs-allow.test.ts > /tmp/fs-probeA.log 2>&1; echo "EXIT=$?"; grep -A8 "strict off" /tmp/fs-probeA.log | head -12`

   Expected: **EXIT=1**, naming `dashboards/vite.config.ts (serve): server.fs.strict is false`. Record it.
5. Run: `cp /tmp/bak-vite.ts dashboards/vite.config.ts`
6. Run: `git status --porcelain dashboards/vite.config.ts`. Expected: empty.

**Probe B, no allow list:**
1. Run: `cp dashboards/vite.config.ts /tmp/bak-vite.ts`
2. Edit it and delete the whole `fs: { allow: [DASHBOARDS, FROZEN_DESIGN] },` line.
3. Run: `pnpm exec vitest run --project unit guards/vite-fs-allow.test.ts > /tmp/fs-probeB.log 2>&1; echo "EXIT=$?"; grep -A8 "no allow list" /tmp/fs-probeB.log | head -12`

   Expected: **EXIT=1**, naming `dashboards/vite.config.ts (serve): server.fs.allow is not set`. Record it. Note that the older test `no vite config lets its dev server reach the repository root` passes in this state, which is the gap in one line.
4. Run: `cp /tmp/bak-vite.ts dashboards/vite.config.ts`
5. Run: `git status --porcelain dashboards/vite.config.ts`. Expected: empty.

- [ ] **Step 8: Confirm green, typecheck, lint, commit**

Run: `pnpm exec vitest run --project unit guards/vite-fs-allow.test.ts > /tmp/fs3.log 2>&1; echo "EXIT=$?"; tail -4 /tmp/fs3.log`

Expected: exit 0. Then `pnpm typecheck` alone, then `pnpm lint` alone.

```bash
git add guards/vite-fs-allow.test.ts
```

Then, separately, write `/tmp/msg-task6.txt` holding:

```
test(guards): require fs.allow to be set and fs.strict to stay on

This file's header argued that requiring fs.allow to be present was
unnecessary, because a config leaving it unset gets Vite's own confinement to
its root. server.fs.strict: false turns that confinement off whether a list is
present or not, so the reasoning protected a default that one word disables,
and the original H1 exposure came back.

Both are now rules, both commands of a config function are evaluated, and the
header says what it used to argue and why that changed.

M4 of the 2026-10-09 review.
```

and run `git commit -F /tmp/msg-task6.txt`.

---

## Task 7: Record all six, with their probe output

**Files:**
- Modify: `docs/decisions.md` (append one entry)

**Interfaces:**
- Consumes: the probe output recorded in Tasks 1 to 6.
- Produces: the entry `## 2026-10-09 - Six guards hardened against the evasions they claimed to catch`.

**One entry, not six.** This is one decision with six parts, and it closes M7 and M8, which the 2026-10-08 entry recorded as scheduled.

- [ ] **Step 1: Note the current heading count**

Run: `grep -c "^## " docs/decisions.md`

Expected: **70**. The log stood at 68 when this plan was first written, and two entries were appended on 2026-10-09, in `21ba121` and `af7166f`. Step 4 checks it grew by exactly one. Read the number the command prints rather than trusting this one.

- [ ] **Step 2: Write the entry**

Append to `docs/decisions.md`, substituting each recorded probe line for its placeholder. Every `<probe ...>` below is replaced with the verbatim output captured in the step named beside it; nothing else is changed.

````markdown
## 2026-10-09 - Six guards hardened against the evasions they claimed to catch

**Reason:** the 2026-10-08 entry recorded M7 and M8 as scheduled and not
started, and the 2026-10-09 review graded M7 as H3 because the form it misses
is the one already in use in this branch. Five guards and one lint config were
hardened in one session. Each change was watched failing against the exact form
it now claims to catch, before it was made, because a guard that was never red
against that form is not fixed.

**One, the freeze guard matched three modifier names.** `test.skipIf` is not one
of them, and this branch already uses it three times, at
`guards/design-naming.test.ts:517`, `guards/design-naming.test.ts:529` and
`guards/mock-boundary.test.ts:106`. Measured against the old rule before
changing it:

```
<probe: Task 2 Step 3 output>
```

Also unmatched: `runIf`, `concurrent.skip`, `it.fails`, and a test whose body
had been emptied. The rule is now an allow list instead of a ban list. Any
chained modifier that is not one of the harmless ones fails, so a modifier
vitest adds next fails on arrival rather than passing. The harmless list is
`each`, `for`, `concurrent`, `sequential`, `extend`, `scoped` and `shuffle`.

The guard has five rules now rather than three, because there are five ways to
weaken a suite: disable a test, invert it, empty its body, delete its file, or
stop collecting the file. It is probed against a throwaway tree outside the
repository, never by writing into a frozen directory, which was the founder's
decision. `guards/lib/walk.ts:173-177` gives the second reason: a probe written
inside the repository races the other guards, because vitest runs test files in
parallel.

The collection check read one file of the 46 in the baseline. It now checks all
46 against every test glob in `vitest.config.ts`. Measured first: none of the 46
is currently missed, so this widens what is checked rather than fixing a loss.
Probed by deleting one glob from `vitest.config.ts` and restoring it:

```
<probe: Task 2 Step 11 output>
```

**The test-count floor, and why it is scoped to the frozen directories.** The
founder was asked before this changed. `freeze-baseline.json` now carries
`frozenTestCount` 411 and `frozenAssertionCount` 955, both compared as floors.
`unitTestCount` 347 stays exactly what it was, a record of one measurement.

A floor over the whole unit project would go red when somebody legitimately
deletes a test in `guards/` or `dashboards/`, and a gate that fails on correct
work is a gate somebody edits rather than obeys, which is the failure that
file's own header is about. Scoped to the frozen directories, red is always
correct: a frozen test or assertion disappearing IS the violation. It is also
the only check there that catches a test removed from a file that still exists,
and the assertion count is the second instrument for an emptied body, because
every way of emptying a body removes its `expect(` calls.

**Two, the exact-version guard listed range syntaxes.** So `1.x`, `1.2.x` and
the dist-tags `latest`, `next` and `beta` all passed: none starts with a range
operator and none equals `*` or `x`. Measured against the old rule:

```
<probe: Task 3 Step 3 output>
```

It now asks the opposite question, is this one exact semver, so every shape of
range fails including shapes nobody listed. And `npm:` and `jsr:` aliases were
skipped along with `workspace:` and `file:`, so `npm:react@^19` was never
examined at all; the specifier after the last `@` is now read. Probed three
times against the real root manifest, one form each:

```
<probe: Task 3 Step 7 rows 1, 2 and 3 output>
```

**Three, the cross-project env scan needed `.env` and `..` on the same line.**
So an absolute path passed, and so did a home-relative one. Those are the
natural ways to name a file outside this repository, which is the entire
subject of CLAUDE.md section 6. Measured against the old rule:

```
<probe: Task 4 Step 3 output>
```

Each token is now resolved. The base is the repository root for a workflow,
whose steps run in the workspace root, and the file's own directory otherwise,
which is the distinction `guards/deploy-surface.test.ts` states and pins for
the same reason. The second change matters as much: a path assembled from a
runtime value is now reported as unresolvable and has to be allowlisted. The
scan went from failing open on what it could not understand to failing closed.
The two existing allowlist entries are unchanged and now carry the verdicts
they earn: `db/prisma.config.ts` is unresolvable because its line holds
`process.cwd()`, and `package.json` is outside because `--env-file=../.env.local`
resolves above the root from the manifest's own directory. Probed against
`scripts/dev-db.mjs`:

```
<probe: Task 4 Step 7 output>
```

**Four, the two residual section 6a gaps, and a trap in each.**
`mailValueAllowed` returned true for any value starting with `$`, so a
repository secret holding a real mailbox reached CI with every assertion green.
A blanket rejection would have failed `template/compose.yml`, which sets
`MAIL_FROM: "${MAIL_FROM:?}"` on two lines and is frozen. Those are not the
same thing and the rule now splits them. A compose substitution reads a value
from the instance's own env file, which is never committed and never reaches
CI, and is allowed. A GitHub Actions expression injects a repository secret
into a CI run, and CI is an environment section 6a covers, so it is refused.
Any other `$`-shaped value is refused too, because a mail value this guard does
not understand is a reason to fail. Probed against the real workflow:

```
<probe: Task 5 Step 6 output>
```

The address scan read `.env.example` and YAML only, so the owner address in
`scripts/ci-seed-instance.ts` was outside it, and that file writes a mailbox
into a database. It now reads program source as well. It does NOT read test
files, and that exclusion is deliberate and measured: scanning them reports
about 80 addresses here, 19 of them real and registrable, including
`owner@firm.com`, `no-reply@stripe.com`, `noreply@github.com` and nine at
`x.com`, every one inside a frozen test fixture that cannot be edited.
`frontdesk/src/filter.test.ts` holds several because it asserts that a no-reply
address is filtered, which is a fixture and not a mailbox anything sends to.
Putting 19 real addresses on the allowlist would empty it of the meaning the
2026-10-08 decision gave it. Excluding test files leaves 9 addresses across 106
files. Probed against the seed script:

```
<probe: Task 5 Step 7 output>
```

One further change was required rather than optional. A domain is reserved by
its LAST label, so `okafor.example` is as undeliverable as `example`, and
`shared/src/gmail/fake.ts:121` holds an address at it. `shared/` is frozen, so
without recognising reserved top-level labels the widened scan could not go
green at all. It is still not a substring rule: whole labels are compared, so
`myexample.com` and `example.io`, which are real registrable domains, are not
reserved. That was the trap the 2026-10-08 decision named.

**Five, the Vite guard read a list it did not require.** `server.fs.strict:
false` serves outside the root whether an allow list is present or not, so a
rule about what a set list may contain reported green on a config that had
turned the confinement off. Both are now rules, and both commands of a config
function are evaluated rather than only the serve branch. Probed twice against
`dashboards/vite.config.ts`:

```
<probe: Task 6 Step 7 probes A and B output>
```

**Six, `pnpm lint` walked into the skill workspace.** `.superpowers/` is ignored
through `.git/info/exclude`, which is local to one clone and is not committed,
so CI checks out without it and has never failed on it, while every local
session that wrote a scratch script there hit a failure unrelated to the change
being linted. One entry in the ESLint ignore list. Probed by leaving the scratch
file in place across the fix:

```
<probe: Task 1 Steps 2 and 4 output>
```

**Corrects:** `guards/vite-fs-allow.test.ts` argued in its own header that
requiring `fs.allow` to be present was unnecessary, because a config leaving it
unset gets Vite's own confinement to its root. That reasoning protected a
default that one word disables. The header now says what it used to argue and
why it changed.

**Corrects:** the description of M7 said the collection check names 1 of 32
baseline files. The baseline holds 46 test files, not 32. The substance of the
finding is unchanged: the check read one of them.

**What is still not covered.** The modifier allow list is a list of names, so a
vitest modifier added in a future release fails closed, which is correct but
means an upgrade may need an entry added deliberately. A test body emptied to a
comment or a no-op defeats the empty-body regex and is caught only by the
assertion floor, which is a count and not a proof. Both counts are counts of
call sites, so a `test.each` counts once however many cases it expands to, which
is why both are floors rather than equalities. The address scan still does not
read test files, by the decision above, so a real mailbox written into a test
fixture in a non-frozen directory would pass. The env scan resolves a token
statically and cannot follow a path through a function call, so a reference
built across two lines is reported as unresolvable rather than placed.

**Cost if wrong:** low to moderate. Five of the six changes make a guard report
more, so the failure mode is a false positive landing on whoever next edits a
manifest, a workflow, a config or a frozen test, and the probes are the
mitigation. The two floors are the exception: a floor set from a measurement can
be wrong in the quiet direction if the measurement was wrong, and these numbers
were taken once, on 2026-10-09, by counting call sites with a regular
expression. If either is too low the guard permits a loss it should catch, which
is the same state as before the floor existed.
````

- [ ] **Step 3: Run the decisions-log guard before committing the log**

The founder asked for this explicitly.

Run: `pnpm exec vitest run --project unit guards/decisions-log.test.ts > /tmp/dl.log 2>&1; echo "EXIT=$?"; tail -6 /tmp/dl.log`

Expected: **EXIT=0**, 3 passed. If `every entry says why` fails, the `**Reason:**` has landed inside a fenced block; move it. If the superseded test fails, the entry contains the string `**Superseded`, which it must not: the marker is `**Corrects:**`.

- [ ] **Step 4: Confirm the log grew by exactly one entry**

Run: `grep -c "^## " docs/decisions.md`

Expected: **71**, exactly one more than Step 1 printed.

- [ ] **Step 5: Check the entry against the plain-language rule**

Run: `grep -c '—' docs/decisions.md`

Expected: 0. If it is not 0, remove the em dashes from the new entry.

- [ ] **Step 6: Commit**

```bash
git add docs/decisions.md docs/superpowers/plans/2026-10-09-guard-hardening.md
```

Then, separately, write `/tmp/msg-task7.txt` holding:

```
docs(decisions): six guards hardened, with the probe output for each

Closes M7 and M8, which the 2026-10-08 entry recorded as scheduled, and H2,
M1, M2 and M4 of the 2026-10-09 review. Records the measured gap and the probe
output for each of the six, the founder's two decisions on scope, and the two
reversals under Corrects.

Corrects the count in the M7 description: the freeze baseline holds 46 test
files, not 32.
```

and run `git commit -F /tmp/msg-task7.txt`.

---

## Task 8: Correct one stale comment, on its own

**Files:**
- Modify: `guards/contract-boundary.test.ts`, one comment line only

**Interfaces:**
- Consumes: nothing.
- Produces: nothing. No rule, no export and no behaviour changes.

**Why this is its own task and its own commit.** It is a comment, and it sits in
a file no other task in this plan touches. Folded into another task it would be
an unexplained line in a diff about something else; on its own it is one line
with one reason. The founder asked for it this way on 2026-10-09 after the
`contract/` finding of the same date surfaced it.

**What is stale.** `guards/contract-boundary.test.ts` says in its header:

> This is a text grep, so it needs nothing from contract/ and can run before
> that package exists. It is vacuous while dashboards/ holds no source, which is
> true today.

The first sentence is still true and `contract/` still does not exist, which the
2026-10-09 decisions entry establishes with evidence. The second sentence is
not: `dashboards/src` holds 21 tracked files, so that guard's real-surface test
reads real code and is no longer vacuous. A comment claiming a guard is inert
when it is live is the kind of thing a later reader trusts instead of checking.

**This task changes no rule.** The guard is correct as it stands. Do not touch
`ENGINE_HOOKS`, `EXPERIMENTAL`, `SOURCE`, `ROOT_CONFIG`, any test, or the
tripwire. If the comment edit seems to require a code change, stop: it does not,
and that would be a different task.

- [ ] **Step 1: Confirm the comment is still stale**

Run: `sed -n '1,25p' guards/contract-boundary.test.ts`

Expected: the header still contains the sentence `It is vacuous while dashboards/ holds no source, which is true today.` If it does not, this task is already done and the rest is skipped.

Then, as a separate command:

Run: `git ls-files dashboards/src | wc -l`

Expected: a number of 21 or higher. That is what makes the sentence stale, so it is worth seeing rather than assuming. Note the number; the commit message uses it.

- [ ] **Step 2: Confirm the guard is green before the edit**

Run: `pnpm exec vitest run --project unit guards/contract-boundary.test.ts > /tmp/cb-before.log 2>&1; echo "EXIT=$?"; tail -5 /tmp/cb-before.log`

Expected: exit 0. A comment change cannot alter that, and the point of running it first is to know the green was there before, not to discover it afterwards.

- [ ] **Step 3: Replace the stale sentence**

Edit `guards/contract-boundary.test.ts`. Replace the one sentence

```
// This is a text grep, so it needs nothing from contract/ and can run before
// that package exists. It is vacuous while dashboards/ holds no source, which is
// true today. The tripwire below stops that lasting forever.
```

with

```
// This is a text grep, so it needs nothing from contract/ and can run before
// that package exists, and contract/ still does not exist: no commit on any
// branch has ever added a file under it, which the 2026-10-09 decisions entry
// records with its evidence.
//
// It is no longer vacuous. It was when it was written, because dashboards/ held
// no source; dashboards/src now holds 21 tracked files, so the boundary test
// below reads real code. The tripwire is still here and still earns its place,
// because the next empty-directory period would otherwise be silent.
```

Keep every other line of the header exactly as it is, including the paragraph
above about why the split exists and the paragraph below about the hooks folder.

- [ ] **Step 4: Confirm nothing but comments changed**

Run: `git diff --stat guards/contract-boundary.test.ts`

Expected: one file changed, and the insertions and deletions are within a few lines of each other.

Then, as a separate command:

Run: `git diff -U0 guards/contract-boundary.test.ts | grep -E '^[+-]' | grep -vE '^[+-]{3}' | grep -vE '^[+-]\s*//' | head`

Expected: **empty output.** Every changed line is a comment. If anything prints, a line of code moved and this task has exceeded its scope: revert and start again.

- [ ] **Step 5: Confirm the guard is still green**

Run: `pnpm exec vitest run --project unit guards/contract-boundary.test.ts > /tmp/cb-after.log 2>&1; echo "EXIT=$?"; tail -5 /tmp/cb-after.log`

Expected: exit 0, with the same test count as Step 2.

Then, as a separate command:

Run: `pnpm lint > /tmp/cb-lint.log 2>&1; echo "EXIT=$?"; tail -4 /tmp/cb-lint.log`

Expected: exit 0.

- [ ] **Step 6: Commit, on its own**

```bash
git add guards/contract-boundary.test.ts
```

Then, separately, write `/tmp/msg-task8.txt` holding:

```
docs(guards): the contract boundary guard is no longer vacuous

Its header said it was vacuous while dashboards/ holds no source, which was
true when it was written. dashboards/src now holds 21 tracked files, so the
boundary test reads real code. A comment claiming a guard is inert when it is
live gets trusted instead of checked.

The rest of the sentence stands and is now cited: contract/ still does not
exist, and no commit on any branch has ever added a file under it, which the
2026-10-09 decisions entry records with its evidence.

Comment only. No rule, no export and no test changed.
```

and run `git commit -F /tmp/msg-task8.txt`.

---

## Task 9: The Done checks, the review, and the push

**Files:**
- No change. This task verifies and ships.

**Interfaces:**
- Consumes: Tasks 1 to 7.
- Produces: a pushed branch with a CI run reported per job, or a clear statement that the push was denied.

**The founder's rules, which override any habit:** each Done check is its own command and its exit code is read on its own. Never chain `git commit` or `git push` onto a grep, a pipe or a test run. Gate on `gh run view --json status,conclusion`, never `gh run watch --exit-status`. Report CI per job as the API reports it. Do not merge. If the push is denied, say so and stop.

- [ ] **Step 1: Confirm every probe surface was restored**

Run: `git status --porcelain`

Expected: only `?? ORBIT_OS_PRD_v8_0.docx`, which predates this work.

Then, as a separate command:

Run: `git diff --name-only 98dd8b6..HEAD`

Expected: exactly these nine paths and nothing else.

The six the approved plan named, one per item:

```
eslint.config.js                  item 6, the ignore entry
guards/freeze.test.ts             item 1, the five rules
guards/version-pinning.test.ts    item 2, the exact-semver rule
guards/standing-rules.test.ts     items 3 and 4, committed together
guards/vite-fs-allow.test.ts      item 5, allow required and strict read
docs/decisions.md                 the record, with the probe output
```

And **two additions beyond those six**, both consequences of the work rather
than new scope:

```
guards/freeze-baseline.json       item 1's four new recorded numbers:
                                  frozenExpandedTestCount 437,
                                  frozenTestCallCount 411,
                                  frozenAssertionCount 955, and
                                  frozenListedTestCount {unit 239, db 170}.
                                  Three instruments, because no single one
                                  catches every way a frozen suite shrinks:
                                  only the expanded count falls when a case is
                                  deleted from a test.each, and only the listed
                                  count is immune to a test( written inside a
                                  comment. unitTestCount 347 is untouched and
                                  still not compared. The commit message must
                                  say that none of the four self-adjusts and
                                  that raising one is a founder decision.

docs/superpowers/plans/2026-10-09-guard-hardening.md
                                  this plan. Every other plan in
                                  docs/superpowers/plans/ is committed, and
                                  Task 7 Step 6 commits it with the log entry
                                  so the record and the argument for it land
                                  together.
```

And **one more beyond those eight**, added when the founder approved the
cleanup task on 2026-10-09:

```
guards/contract-boundary.test.ts  Task 8, comment only, its own commit. The
                                  header claimed the guard was vacuous because
                                  dashboards/ held no source. dashboards/src
                                  now holds 21 tracked files. No rule, no
                                  export and no test changed, and Task 8
                                  Step 4 proves that by failing if any changed
                                  line is not a comment.
```

If `vitest.config.ts`, `package.json`, `.github/workflows/ci.yml`, `scripts/dev-db.mjs`, `scripts/ci-seed-instance.ts` or `dashboards/vite.config.ts` appears, a probe was not restored. Stop and restore it from the backup, then re-run the guard it belongs to.

- [ ] **Step 2: Confirm no frozen directory and no excluded path changed**

Run: `git diff --stat 98dd8b6..HEAD -- frontdesk/ api/ db/ shared/ template/ ops/ design/ reference/ docs/security/keys.md`

Expected: empty output. If it is not empty, stop: the instruction was broken and the change cannot go up.

Then, as a separate command:

Run: `git diff --name-only 98dd8b6..HEAD -- pnpm-lock.yaml`

Expected: empty output. The version-pinning probes edited `package.json` without installing, so the lockfile must be untouched.

- [ ] **Step 3: Request the code review**

CLAUDE.md section 7 requires a security review of every code diff in a fresh session that reads only the diff. PLUGINS.md makes `superpowers:requesting-code-review` the owner of the review step.

Invoke `superpowers:requesting-code-review`. Hand the reviewer the diff `98dd8b6..HEAD` and nothing else. Tell it that five of the six changes make a guard stricter, so the two questions to press hardest are whether any new rule reports a false positive on correct code, and whether any of the five rules can still be evaded by a form the probes do not cover. Record the result in `docs/decisions.md`. Fix what it finds, or record why a finding is not fixed.

- [ ] **Step 4: Run each Done check, one command at a time**

Each is its own Bash call, with output redirected to a file so the exit code read is the command's own. Read each exit code before running the next.

1. `pnpm install --frozen-lockfile`
2. `pnpm audit --audit-level=high`
3. `pnpm typecheck`
4. `pnpm lint`
5. `pnpm lint:frozen:danger`
6. `pnpm check:screens`
7. `pnpm db:up`, then `pnpm db:generate`, then `pnpm test`
8. `pnpm e2e`

Expected: exit 0 from each. If any is not 0, stop and report that command and its output.

- [ ] **Step 5: Push**

Run: `git push`

Expected: exit 0. If the push is denied, say so plainly and stop. The founder runs it.

- [ ] **Step 6: Gate on the CI conclusion, and read it per job**

Do not use `gh run watch --exit-status`. The 2026-10-08 entry at `docs/decisions.md:2436` records why it cannot be a gate.

Run: `gh run list --branch stream-0/seam-and-contract --limit 1 --json databaseId,status,conclusion,headSha`

Confirm `headSha` matches `git rev-parse HEAD`. Note the `databaseId`. Then, as a separate command, until `status` is `completed`:

Run: `gh run view <databaseId> --json status,conclusion`

Then, for the per-job report the founder asked for:

Run: `gh run view <databaseId> --json jobs`

Report every job's name, status and conclusion exactly as the API returns them. Do not summarise a failed job as passed, and do not describe a skipped job as green.

- [ ] **Step 7: Report**

State, in plain words: each Done check and its exit code; for each of the six items, the probe output that proves the guard went red; the two floors' recorded numbers and how they were measured; that every probe surface was restored and `git status` is clean; the CI run id and every job's conclusion as the API reported it; and that no frozen directory, no env file, nothing under `reference/` and not the lockfile changed. Name anything that was not run and why. Do not merge.
