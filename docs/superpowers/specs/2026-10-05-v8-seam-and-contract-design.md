# Sub-project 0: the seam and the spec reset

Date: 2026-10-05
Product owner: Shuv Chowdhury (OrbitumAI)
Status: awaiting founder review

## 1. Why this sub-project exists

PRD v8.0 widened Orbitcrew from a lead-reply tool into the place where an
organization runs all of its tasks. The build that follows runs as two parallel
streams: Stream A builds the three dashboards against a mock, and Stream B
builds the task engine and the Action Gateway. Nothing else can start safely
until three things are settled.

1. **One interface both streams build to.** If Stream A invents its own shape
   for a job or a task while Stream B invents another, the two meet weeks later
   and one of them is a rewrite. The contract is the seam, and it is written
   first.
2. **A repo layout with exactly one copy of the prototype.** The prototype is
   currently nested two levels deep inside `Prompts_Frontend_docs/`, with a
   second copy of the whole tree sitting beside it as a zip. Two copies of a
   behavior spec drift, and nobody notices which one is stale.
3. **Rules files that gate the right stream.** The frontend-only rule is what
   makes the mock-backed parallelism real. It must keep gating Stream A and must
   never be able to block Stream B.

This sub-project writes no product code. Its output is the contract, the layout,
the rules, the re-specced build prompts, and the checks that enforce the Done
definition.

## 2. Scope

**In scope**

- Repo layout and the single-copy prototype move
- The three rules files and their scoping
- The ApiClient contract, split into a stable dashboard layer and an
  experimental engine layer, plus its OpenAPI document
- Re-specifying build prompts 0 to 6 against PRD v9.0, with the screen list taken
  from §15.5 to §15.7 rather than invented
- The phase 0 audit instruction: a screen-by-screen gap list with file evidence
- Worktrees, branches and the pull request flow
- The Done checks as runnable CI, including the lead-reply freeze guard
- `docs/decisions.md` and the security document skeletons

**Out of scope**

- Any React component, screen or hook (Stream A, sub-project 1)
- Any engine, gateway or connector code (Stream B, sub-projects 3 and 4)
- Standing Authority enforcement. Blocked until the founder answers the
  one-page decision. This sub-project reserves its contract surface as
  read-only and nothing more.
- Changes of any kind inside the frozen lead-reply path

## 3. Repo layout

```
CLAUDE.md                          shared rules for the whole repo (new)
ORBIT-OS_Claude_Code_Build_Prompts.md   re-specced to v8 (moved to root)
docs/
  prd/            ORBIT_OS_PRD_v9_0.md (authority), v8_0, v7_0 (historical)
  backlog.md      parked items, including the prototype's nine roles
  gates/          anthropic-terms.md — absent on purpose; the guard fails closed
  decisions.md    one running log of every decision and its reason (new)
  rules/          engine.md                                      (new)
  security/       threat-model-engine.md, threat-model-gateway.md, keys.md
  contracts/      api-contract.md, openapi.yaml                   (new)
  superpowers/    specs/, plans/, decisions/, spikes/  (existing, unchanged)
reference/
  orbit-os-frontend/   the prototype, flattened, read-only, one copy only
dashboards/
  CLAUDE.md       the frontend-only rule, scoped to this folder
  src/            Stream A lives here
contract/
  src/v1/, src/experimental/, src/client.ts   the seam, as code
guards/           repo-wide guard tests, outside the frozen packages
frontdesk/ api/ db/ shared/ worker/ ops/ design/ template/   frozen
web/              untouched: a Stage 0 health-server stub, covered by the freeze
```

Three moves make that true, each as its own commit:

| From | To |
|---|---|
| `Prompts_Frontend_docs/orbit-os-frontend/orbit-os-frontend/` | `reference/orbit-os-frontend/` |
| `Prompts_Frontend_docs/CLAUDE.md` | `dashboards/CLAUDE.md` |
| `Prompts_Frontend_docs/ORBIT-OS_Claude_Code_Build_Prompts.md` | repo root |

`Prompts_Frontend_docs/` is then empty and removed. Three files are left out of
git, and they are not all left out the same way:

- `ORBIT_OS_OBJECTIVES_AND_PROGRESS_2026-10-05.xlsx` and
  `ORBIT_OS_STATUS_2026-10-05.xlsx` are **added to `.gitignore`**, as instructed.
- `orbit-os-frontend.zip` is a second copy of the whole prototype tree. This
  spec proposes **adding it to `.gitignore` as well**, so the single-copy rule
  cannot be broken by accident. That goes slightly beyond the instruction, which
  named only the two xlsx files, so it is called out rather than slipped in.
- `ORBIT_OS_PRD_v8_0.docx` stays **untracked but not ignored**: it is a binary
  export of a Markdown file that is now tracked, and ignoring it would hide a
  future revision that arrived only as a docx.

**`reference/` is read-only.** Nothing in it is edited, linted, typechecked,
tested or built. It is excluded from `tsconfig.json`, from the lint config and
from every vitest project, because it is a vanilla-JS prototype that was never
reviewed as code and would otherwise pour hundreds of findings into every
quality gate.

### What is copied from the prototype, and what is not

**This rule was replaced on 2026-10-06.** The earlier version said to copy the
prototype's seed data exactly, including its nine agent templates, its ten-tool
catalog and its design tokens. PRD v9.0 §15.1 and Appendix A override that: the
prototype's names, roles, tools and visuals are v7.0-era inventions, and copying
them would have built roughly thirty screens in the wrong visual language and
seeded a catalog the PRD does not have.

**Taken from the prototype:** behaviour, copy and screen flow. How the wizard
gates each step, what a validator refuses, what an empty state says, the order
of fields in a form, the wording of a confirmation. That is what a working
prototype is good for and it remains the best record of it.

**Taken from the PRD, never from the prototype:** names, roles, tools, visuals.

| What | Source |
|---|---|
| Design tokens | the frozen `design/` package, proven by `design/tokens.test.ts` |
| Layout | PRD §15.2: plain lists, no card grids, no KPI tiles, no template gallery |
| AI teammate roles | PRD Appendix A.1: five hireable roles, Orbi the only Coordinator |
| Connector catalog | PRD Appendix A.2 |
| Task states | PRD Appendix A.3: seven |
| Risk categories | PRD Appendix A.4: four |
| Budget | PRD Appendix A.5: three numbers |
| Approval bases | PRD Appendix A.6: three, with no nullable case |
| Standing Authority never-covers | PRD Appendix A.7: fixed, not per-grant text |
| Escalation defaults | PRD Appendix A.8 |
| Six safe approval states | PRD Appendix A.9 |
| Screen list | PRD §15.5 to §15.7 |

**Substitution rule.** Where prototype copy names Atlas, or a role or tool that
is not in Appendix A, substitute the PRD's name and change nothing else in the
sentence. The sentence's shape is the thing worth keeping.

The prototype's nine roles are parked in `docs/backlog.md`. They are not seeded.

**Not carried over at all:** its code, its patterns and its structure. No string
templates, no `window` globals, no shared mutable store, no file organisation.
It is not a starting point for the implementation and it is not treated as
reviewed code.

## 4. Rules files

Three files, scoped by location, because Claude Code loads a `CLAUDE.md` for the
directory it is working in.

**`CLAUDE.md` at the repo root.** Shared rules that apply everywhere: quality and
security before speed; ask the founder on any decision affecting security,
money, customer data or the product definition; the Done definition; the branch
and pull request flow; the secrets policy; the naming rule that customers never
see Paperclip, Hermes, OpenClaw, MCP, token, agent id or adapter name **and
never see ORBIT-OS either** (PRD §15.3); and pointers to the two scoped files.
It does **not** contain the frontend-only rule.

The naming rule is **scoped, not global**. Customer screens — the User and Org
Admin apps, and every email and push alert to a customer — follow it, including
the `<title>` tag, email subjects and error text. The Super Admin fleet console
is **exempt**: it is an internal operator surface, and ORBIT-OS, Paperclip,
Hermes, runtime ids and adapter names are correct there. A guard that bans those
words everywhere would be wrong, and would fail on the fleet console by design.

**`dashboards/CLAUDE.md`.** The prototype-era frontend rules, scoped to the web
app by sitting in its folder: frontend only, no backend, no database; all data through
one typed `ApiClient`; screens never touch storage or `fetch`; Zod at every form
and every boundary; the accessibility and plain-language rules; no dead buttons;
no `any`.

**`docs/rules/engine.md`.** Rules for Stream B: the threat model comes before
code; the Action Gateway's tests come before its code; authorization is enforced
server-side on every action; budgets pause the agent that spent them; every
action is audit-logged; one office can never read another's data.

The root file also carries two standing rules of the founder's that nothing else
in this repo records, each with a guard so it cannot quietly lapse.

**No real data until the gate opens, and the gate has four conditions.** No live
inbox, real mailbox or real customer data in **any** environment until all four
of these exist and pass their tests (PRD v9.0 §14.3):

1. the Action Gateway,
2. the audit log,
3. budget pausing,
4. **Anthropic's no-training and zero-retention terms confirmed in writing**,
   recorded in `docs/gates/anthropic-terms.md` naming who confirmed it, when, and
   where the signed document lives.

Until then, a dedicated test mailbox and test accounts only. The founder decides
when the gate is met, not the code. Condition 4 is unlike the other three: it is
a contract to request and sign rather than code to write, it has the longest lead
time of anything in this plan, and the request must name every API organization
the product will use and ask for ZDR approval, which planned models are Covered
Models and their retention, which API features are ZDR-eligible, and the
no-training commitment in the commercial agreement.

The guard **fails closed**: it asserts the gate is still recorded as open-pending
in `docs/decisions.md`, that `docs/gates/anthropic-terms.md` does not yet exist
or does not yet record all three facts, and that no committed configuration names
a non-test mailbox. `docs/gates/anthropic-terms.md` is deliberately **not**
created by this sub-project. Creating it would open the gate.

**This project's own env, and no other.** Its own `.env`, never committed, with
`.env.example` checked in. No shared or cross-project env file is read or
written. Keys are scoped to this project and rotatable. The guard fails if `.env`
is tracked, if `.env.example` is missing, or if any code path references an env
file outside this repo.

> **Resolved.** The founder confirmed the split: the root file holds only rules
> true everywhere, and the frontend-only rule lives in the folder Stream A
> occupies. A root `CLAUDE.md` is loaded for the whole repo, so a frontend-only
> rule written there would gate Stream B on its first command.

## 5. The contract

Split into two layers that live in separate modules, carry separate Zod schema
namespaces and separate TanStack Query key roots.

### 5.1 Dashboard layer, `contract/v1`, stable

Operations whose shape is settled by the prototype and by the PRD's role
features. Stream A builds directly against these. A change here needs founder
approval and a version bump, because screens depend on it.

| Group | Operations |
|---|---|
| org | `getOffice`, `saveOffice`, `applyTemplate`, department add / rename / remove, person add / update / remove, `toggleAuthority` |
| teammates | `list`, `create`, `update`, `remove`, `assign`, `autoAssign`, `savePrompt`, `togglePause` |
| tools | `listConnections`, `connect`, `disconnect` |
| launch | `startLaunch`, `retryLaunch`, `getLaunchStatus` |
| requests | `list`, `submit`, `cancel`, `decide` |
| fleet | `listOffices`, `getOffice`, `provisionOffice` |
| dev | `loadDemo`, `resetFresh`, `setSimulation` |

### 5.2 Engine layer, `contract/experimental`, unstable

The v8 core. Stream B will change these while it learns, so Stream A reaches
them only through hooks under `dashboards/src/features/engine/`, which is the
single place churn lands.

| Group | Operations |
|---|---|
| jobs | `draftJob` (plain English in, seven-line summary out), `askQuestions`, `answerQuestion`, `practiceRun`, `activateJob`, `listJobs`, `pauseJob` |
| tasks | `listTasks`, `getTask`, `waitingForMe`, `actOnTask` |
| receipts | `listReceipts`, `getReceipt`, `exportCsv` |
| quality | `jobQualityScores` |
| authority | `listGrants` **read-only**, no create, no revoke, no enforcement |
| undo | `undoAction` — the exact 30-second window on an approved outside action (PRD §16) |

Three groups gain fields rather than operations, from PRD v9.0: a task carries
its **risk category** (A.4), its **evidence** (TASK-3) and its **reminder and
expiry times** (TASK-6); a job carries its **version history** (JOB-7) and its
**department** (§7.3); and a receipt names **exactly one of three approval
bases** (A.6) with no nullable case, and records both the original and the edited
action when a person edited before approving (U-22).

The seven lines of a job summary are fixed by PRD objective B2 and are part of
the schema, not free text: when it starts, who does it, what it may touch, the
limits, who approves, what happens if nobody answers, and three examples.

### 5.3 Mechanics

- One `ApiClient` interface composed of the two layers. `MockApiClient`
  implements both. A later `HttpApiClient` is a one-file swap, selected by
  `VITE_API_MODE=mock|http`.
- Zod schemas are the source of truth; TypeScript types are inferred from them.
  Every response is parsed at the boundary in both modes.
- `docs/contracts/api-contract.md` and `docs/contracts/openapi.yaml` are written
  in this sub-project and reviewed by the founder before either stream builds
  against them.

> **While the contract is in review, Stream A does not idle.** It builds what
> does not depend on it: project setup and the three Vite entries, the design
> tokens and Tailwind theme, the UI component library with its keyboard and aria
> tests, and the pure validators (org, teammates, assignment, connections,
> removal rules, the loop check, the second-coordinator refusal) with a unit test
> for every rule in the spec.

## 6. Build prompts, re-specced

Prompts 1 to 6 stay as written: they cover the prototype, which the dashboards
still need. Prompt 7's contract work moves into this sub-project, since both
streams need the seam up front. Two prompts are added.

**Prompt 0, rewritten.** The audit produces `docs/plan.md` with a gap list
**screen by screen, with file evidence**: for each of the fourteen prototype
screens, the v8 role features it already covers, the ones it does not, and the
`reference/orbit-os-frontend/...` file and line that proves each claim. No
percentages and no "about". The earlier "roughly 70% aligned" estimate is
explicitly not to be relied on.

**Prompt 5b, new.** The v8 gap screens. User: Waiting for you, the task board,
the "Ask or describe a job" box, and the seven-line job summary check. Org
Admin: the Jobs screen. Super Admin: the job quality scoreboard and the
connector catalog.

**Prompt 5c, new.** Standing Authority screens: Org Admin grants, Super Admin
watch. Behind a feature flag defaulting to **off**. UI only. No enforcement, no
server-side authority logic, and no contract operation that could create or
revoke a grant.

## 7. Streams, branches and review

Two git worktrees off this repo, so the two streams never share a working tree:

```
git worktree add ../orbit-stream-a stream-a/dashboards-core
git worktree add ../orbit-stream-b stream-b/task-engine
```

Branch names are `stream-a/<sub-project>` and `stream-b/<sub-project>`. Every
code change goes on a branch, opens as a pull request, and is merged by the
founder only after the Done checks pass. Docs-only commits may go straight to
`main`.

## 8. Done, enforced as CI

Item 9 of the founder's rules, turned into checks that run rather than a list
that is remembered.

| Check | Command | Gate |
|---|---|---|
| Types | `pnpm typecheck` | zero errors |
| Lint | `pnpm lint` | zero errors; `react/no-danger` is an error |
| Unit | `pnpm test:unit` | all pass |
| Database | `pnpm test:db` | all pass |
| End to end | `pnpm e2e` | all pass |
| Accessibility | axe per screen in the unit suite, axe per route in Playwright | zero serious, zero critical, **run each phase, not at the end** |
| Dependencies | `pnpm audit --audit-level=high` | clean |
| Lockfile | `pnpm install --frozen-lockfile` | no drift; versions pinned exact, no `^` |
| Secrets | secret scan over the diff | clean |
| Security review | fresh session, reads only the diff | performed and recorded |
| Decisions | `docs/decisions.md` | an entry per decision, with its reason |

Three of those commands do not exist yet. `package.json` today has `test`,
`test:unit`, `test:db`, `typecheck`, the `db:*` and `stack:*` scripts,
`posture:check`, `resend:check` and `spike:run`. This sub-project adds `lint`,
`e2e` and the two guard scripts, and wires every check above into
`.github/workflows/`. Until they exist the table describes an intention, which
is exactly the gap this sub-project closes.

**Lint findings inside the frozen directories are reported, never fixed.** The
counts per directory are recorded in `docs/decisions.md` and the work continues.
A lint fix in frozen code needs the founder's explicit approval, case by case,
and never as part of another task.

Four checks are specific to this project and are built in this sub-project.

**The lead-reply freeze guard.** The freeze means no new features and no
deletions, and every existing test keeps running and passing for the life of the
project. The frozen directories are `frontdesk/`, `api/`, `db/`, `shared/`,
`template/`, `ops/` and `design/`: **seven, not the five this spec first named**,
because `vitest list` shows `ops/` and `design/` also hold collected tests, and
leaving them out would have left two packages unguarded. A guard test asserts
three things, because there are three ways to weaken a suite: no `.skip`,
`.only` or `.todo` appears in any test under those seven; no test **file**
present at freeze time has been deleted, compared against a recorded baseline,
which is the only one of the three that catches deletion; and
`template/test/no-unapproved-send.test.ts` both exists and is still collected by
`vitest.config.ts`, since dropping it from the include list would disarm it while
leaving the file in place. If any freeze-related change would skip or weaken a
test, the guard fails and the founder is told immediately rather than the change
being worked around.

**The mock import-boundary guard.** `MockApiClient` and its seed data are
reachable only from `dashboards/src/dev/**` and test files. The guard is written
before `MockApiClient` exists, so the first import from anywhere else fails on
the commit that introduces it.

**The mock bundle scan moves to sub-project 1.** This spec first placed it here,
which cannot work: the scan builds with `VITE_API_MODE=http` and asserts the
output contains none of the seed strings, and there is no production build to
scan until Stream A has one. It becomes an acceptance item of sub-project 1.
Authentication tokens are issued by the API as httpOnly, secure, same-site
cookies and never written anywhere JavaScript can read. The mock's use of
`localStorage` is for mock app state only, under one namespaced key, and a test
asserts no key or value in it is named like a credential. A content security
policy is configured for all three entries.

**The two standing-rule guards** from section 4: the real-data gate and the env
policy.

## 9. Secrets

This project uses its own `.env`, never committed, with `.env.example` checked
in. `.gitignore` already enforces that (`.env`, `.env.*`, with `!.env.example`).
No shared or cross-project env file is read or written. Every key is scoped to
this project and rotatable, and the key inventory with its rotation owner is
recorded in `docs/security/keys.md`.

One correction belongs there: `.env.local` holds `TYPESAFE_API_KEY`, which is an
OpenRouter key rather than a TypeSafe console key. The inventory records what
each key actually is, not what its name suggests.

A guard enforces this rule rather than restating it. It fails if `.env` is
tracked by git, if `.env.example` is missing, or if any code path references an
env file outside this repo. The last of the three is the one a person would not
notice: a relative path that climbs out of the tree reads a neighbouring
project's secrets and nothing looks wrong.

## 10. Security documents created here, filled later

`docs/security/threat-model-engine.md` and
`docs/security/threat-model-gateway.md` are created in this sub-project as
skeletons with their required headings, and are filled in sub-project 3's and
sub-project 4's specs **before any engine or gateway code is written**. The
required headings are the five threats named by the founder:

1. Prompt injection from an inbound message
2. An agent using a tool it was not granted
3. A send that bypasses the Action Gateway
4. Secret leakage
5. One office reading another office's data

Each gets the attack, the control, the test that proves the control, and what
happens when the control fails.

## 11. The first end-to-end job

The first real job runs against a **dedicated test mailbox and test accounts**.
The gate and its four conditions are stated once, in section 4. They are not
restated here, because v8.0 stating the same rule in two places with different
condition counts is exactly how condition 4 went missing from both the decision
log and the guard. Nothing in this sub-project or in Stream A can satisfy the
gate.

## 12. Non-goals of this sub-project

- No React component, screen or hook
- No engine, gateway, connector or Standing Authority enforcement code
- No change inside `frontdesk/`, `api/`, `db/`, `shared/`, `template/`, `ops/`
  or `design/`, and no change to `web/`
- No deletion of the prototype zip or the docx; they are ignored, not removed
- No week numbers on checkpoints. Checkpoints are gates: the contract is
  reviewed, the gap list is evidenced, the job-understanding test set passes, the
  golden task passes.

## 13. Acceptance

This sub-project is done when all of the following hold.

1. `docs/prd/` holds PRD v9.0 (the authority), v8.0 and v7.0 (historical record,
   not corrected). v8.0 and v7.0 done in commit 6804637; v9.0 in the rebase
   commit.
2. The prototype exists at `reference/orbit-os-frontend/` and nowhere else, is
   excluded from typecheck, lint, tests and build, and `Prompts_Frontend_docs/`
   is gone.
3. `CLAUDE.md`, `dashboards/CLAUDE.md` and `docs/rules/engine.md` exist with the
   scoping in section 4, **and a guard test asserts the root `CLAUDE.md` holds
   none of the frontend-only phrases.** This spec first asked for a
   demonstration that a Stream B command is not gated by that rule; a
   demonstration happens once and a check happens on every commit, so it is a
   check.
4. `docs/contracts/api-contract.md` and `docs/contracts/openapi.yaml` exist with
   both layers, the founder has reviewed them, and the review is recorded in
   `docs/decisions.md`. The review package includes a **coverage check against
   the `ApiClient` operation list in the build prompts**, so the founder can see
   that nothing the dashboards need is missing from `contract/v1`.
5. The build prompts at the repo root are re-specced to v8 and include 5b and 5c.
6. Prompt 0's audit instruction requires file-level evidence per screen.
7. The CI workflow runs every check in section 8, including both guards, and the
   freeze guard fails on a deliberately skipped frozen test.
8. `docs/decisions.md` exists and records: Orbitcrew as the customer-facing name
   with v8 open decision 1 closed; the lead-reply freeze; Standing Authority held
   at UI-only pending the one-pager; `dashboards/` rather than `web/` as Stream
   A's home, with its evidence; the test-data gate from section 11; the move of
   the mock bundle scan to sub-project 1; and the per-directory lint counts from
   the frozen packages.
9. `docs/security/` holds the two threat-model skeletons and `keys.md`.
10. The two worktrees and the branch and pull request flow are in place.
11. `.gitignore` excludes the two xlsx files and the prototype zip, and
    `git status` on a clean tree is empty apart from the untracked docx.
12. `pnpm lint` and `pnpm e2e` exist and run.
13. The two standing-rule guards from section 4 pass, and each fails when its
    rule is broken on purpose: a tracked `.env`, and a gate recorded as open.
14. `landing/`'s three commits exist in `archive/landing-history.bundle`, the
    bundle has been verified by cloning it outside the repo, a second copy is
    held outside the repo, and only then was `landing/.git` removed.

## 14. Questions, resolved

All four questions this spec opened have been answered by the founder.

1. **Rules file split.** Confirmed. The root file holds only rules true
   everywhere. The frontend-only rule lives in the folder Stream A occupies and
   must never sit at the root.
2. **`landing/`.** The recommendation was accepted with safeguards, and it runs
   last because it is not on the critical path: bundle the history, verify the
   bundle by cloning it outside the repo, keep a second copy outside the repo,
   and **only then** remove `landing/.git` and commit the files. Then run the
   widened `no-unapproved-send` scan and report every finding before fixing any
   of them.
3. **Stream A's home.** Decided on evidence against `web/`, which this spec had
   recommended. `web/src/main.ts` is a Stage 0 health-server stub that imports
   from the frozen `shared/` package, and `template/test/compose.test.ts:22`
   asserts the exact set of compose services, so repurposing the `web` service
   would disturb a frozen test for no gain. Stream A takes a new `dashboards/`
   package and `web/` is left untouched. Checked before relying on it: no test
   pins the workspace package list, and a new package adds no compose service.
4. **The prototype move.** Approved. It runs as three commits, and afterwards no
   second copy of the prototype or the build prompts remains anywhere, with
   every path reference inside the build prompts resolving under
   `reference/orbit-os-frontend/`.

## 15. Amendments to this spec

Recorded rather than silently rewritten, so the reasoning stays readable.

| What changed | Why |
|---|---|
| Frozen directories: five to seven, adding `ops/` and `design/` | `vitest list` shows both hold collected tests. Five would have left two packages unguarded. |
| The mock bundle scan moves to sub-project 1 | It builds and scans the output. No production build exists until Stream A has one. |
| Acceptance item 3 becomes a check, not a demonstration | A demonstration happens once; a check happens on every commit. |
| Stream A's home is `dashboards/`, not `web/` | `web/` is covered by the freeze. See question 3 above. |
| Two standing rules added to section 4, each with a guard | The real-data gate and the env policy were the founder's rules and were recorded nowhere in this repo. |
| Lint findings in frozen code are reported, never fixed | A lint fix in frozen code is still a change to frozen code, and that is the founder's call case by case. |
| The contract review includes an operation-coverage check | So the founder can see that nothing the dashboards need is missing from `contract/v1`. |

## 16. Rebase onto PRD v9.0 (2026-10-06)

`docs/prd/ORBIT_OS_PRD_v9_0.md` supersedes v8.0 and is the authority for this
spec. v8.0 and v7.0 stay as the historical record and are not corrected. Where
v9.0 and a decision recorded in commit `afc0beb` disagree, v9.0 wins.

| Overridden | Was | Now |
|---|---|---|
| Rule 3, seed data | copy the prototype's seed data exactly | behaviour, copy and flow from the prototype; names, roles, tools and visuals from the PRD |
| Design tokens | the prototype's `assets/tokens.css` | the frozen `design/` package, proven by `design/tokens.test.ts` (§15.1) |
| Layout | the prototype's KPI tiles, agent cards, template grid | plain lists, no card grids, no KPI tiles, no template gallery (§15.2) |
| Teammate roles | the prototype's nine | the five in Appendix A.1, Orbi the only Coordinator |
| Connector catalog | the prototype's ten | Appendix A.2, subject to CD-4 |
| Naming rule | global ban on Paperclip, Hermes, OpenClaw, MCP | scoped: customer screens also never say ORBIT-OS; the fleet console is exempt (§15.3) |
| Task states | six, including an invented `declined` | the seven in Appendix A.3; declining ends a task Cancelled with a receipt |
| Approval bases | two | the three in Appendix A.6, with no nullable case |
| Grant limits | `string[]` | teammate, category, a numeric limit, an end date (§12) |
| Never-covers | free text per grant | the fixed list in Appendix A.7 |
| Budget | one number | the three in Appendix A.5, plus per-connector limits |
| Authorities | Leader, Approver, Budget holder | those plus **Backup approver**, restored as a named authority (§7.2) |
| Real-data gate | three conditions | four (§14.3), the fourth attested in `docs/gates/anthropic-terms.md` |
| Declined request | contradictory in v8.0 | always writes a receipt (§6, TASK-9, U-23) |
| Catalog settled? | I read v8.0's list as settled | it sat inside an open-decision table. CD-4 is open; Appendix A.2 is the default |

**Connector decisions CD-1 to CD-5 (§13.1) encode the safe default, not the
suggestion**, until each is answered: custom connectors disabled with C-07 showing
"coming soon"; no published review target; own budget per connector; Appendix A.2
as the catalog; and a Leader approves every change-capable connector.

**New in v9.0 and scheduled here:** U-19 a User requests a teammate; A-14 the Org
Admin queue that approves it and edits the prompt and guardrails; A-15 assign
teammates to people and departments; S-43 the design and naming build check; and
the reordered A-01 setup (org structure, people and roles, create teammates,
assign teammates, connect tools, first job).

**Standing Authority stays blocked** by open decision 2. It is modelled fully —
teammate, category, numeric limit, end date, the fixed never-covers list — but
the contract exposes `listGrants` only and the screens are flagged off and
read-only. v6.2's rule that an AI may never approve still stands.


### 16.1 Screens: resolved, and what it does to Stream A

The screen question is settled by PRD §15.8, added 2026-10-06. **No screen is
cut.** All 52 ship as shells in Stream A — route, nav entry, correct title, the
six §15.4 states, design tokens from the frozen `design/` package, S-43 green, and
an empty state that says what will fill it and when. Twenty-six then get working
logic; the other twenty-six are Fill later with a recorded unblocker each.

The two prototype screens with no feature ID are resolved: the Agent map folds
into the `/teammates` list with no new screen and no new ID, and the Performance
table becomes **A-45**, a per-teammate tab on `/results`, Fill later. The register
moves to Org Admin 45 and 111 in total; the screen count stays 52.

#### Re-sizing Stream A

The old sizing was wrong because it counted the prototype's fourteen screens. The
honest split is shells for 52 and logic for 26, and it changes the shape of the
stream more than its length.

| Sub-project | Contents | Size |
|---|---|---|
| **1a Foundation and shells** | Tokens from `design/`, Tailwind theme, AppShell and nav for three apps, the six §15.4 states as one component, all **52 shells**, S-43 green on every route | M, about 1.5 weeks |
| **1b Fill-now logic, prototype-derived** | The 15 Fill-now screens that have a prototype behaviour spec: Sign in, Home, Ask or describe, Task board, Receipts, Guided setup, Departments, People, AI teammates, Teammate profile, Requests, Connections, Fleet table, Office view, Provision | L, about 2 weeks |
| **1c Fill-now logic, PRD-only** | The 13 with no prototype counterpart, designed from their feature IDs: Job summary check, Practice run, Task page, Waiting for you, Approval page, Jobs library, Job detail, Spending, Intake channels, Office controls, Security, Request a teammate, **Org chart** | L, about 2.5 to 3 weeks |

**About 6 to 6.5 weeks for Stream A**, against 3 to 4 in the original sizing of
sub-project 1 alone.

Amended 2026-10-06, after U-19 and A-03 moved to Fill now: **28 screens get logic,
24 are Fill later.** U-19 Request a teammate was already in the 1c list, so it
costs nothing. A-03 Org chart is new to 1c, not 1b, because it ships as an
indented list with a side panel and the prototype's drag-and-drop canvas does not
survive §15.2 — there is no prototype interaction to copy, only the strict-tree
validation behaviour, which lives in `contract/v1` either way. That is the only
reason the 1c range widens.

**But the stream does not get longer.** The original decomposition had
sub-project 1 at 3 to 4 weeks plus sub-project 2 at 2 weeks, so 5 to 6 weeks for
the same ground. Sub-projects **2 and 5 are absorbed**: the v8.0 gap screens and
the Standing Authority screens are both inside the 52, with `/authority` shipping
as a shell that is flagged off and read-only. So the decomposition loses two
sub-projects and gains one, and Stream A's total moves from 5-6 weeks to about 6.

What actually changed is honesty, not scope. The earlier estimate covered
fourteen screens and called itself the dashboards. This one covers all 52 and
delivers a navigable product in the first two weeks rather than at the end.

**One shell count to watch.** 52 shells is only cheap if the shell is one
component. If each screen hand-rolls its own empty, loading, error, paused, not
yours and expired states, the shell work alone is larger than the logic work.
Sub-project 1a builds the six states once, and S-43 plus the a11y check run on
every route from the first week, which is what keeps that true.
