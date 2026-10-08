# Decisions

One running log. Every decision gets its date, what was decided, why, and what it
costs if wrong. Fixed product lists are not restated here: they live in PRD v9.0
Appendix A, which is their only home.

The authority is `docs/prd/ORBIT_OS_PRD_v9_0.md`. v8.0 and v7.0 are the
historical record and are not corrected. Where v9.0 and an earlier entry
disagree, v9.0 wins.

## 2026-10-05 - Orbitcrew is the customer-facing name

**Decision:** Orbitcrew. ORBIT-OS stays the internal name. PRD v8.0 open
decision 1 closed as answered; carried into v9.0 section 18.1.

**Reason:** the name sets what customers expect, and the product is no longer a
lead-reply tool.

**Cost if wrong:** a rename across customer copy before the first pilot.

## 2026-10-05 - The lead-reply slice is frozen

**Decision:** the 44 merged commits of stage 0 and stage 1 slice 1 are frozen. No
new features, no deletions. Every existing test keeps running and passing for the
life of the project. The slice becomes one example job behind the Action Gateway
once the engine exists. The old exit criterion of one real lead end to end is
retired; the proof is now the first real job, with OrbitumAI as customer zero.

**Reason:** PRD v8.0 widened the product from lead replies to any task in any
department, so proving the email path again would prove the wrong thing. Deleting
it would throw away the only path with real coverage.

**Cost if wrong:** the frozen code carries style findings and two credential
deviations for the life of the project.

**Enforced by:** guards/freeze.test.ts over frontdesk, api, db, shared, template,
ops and design.

## 2026-10-05 - Standing Authority is held at UI-only

**Decision:** open-pending, and it blocks build. PRD v9.0 section 12 is modelled
but not approved for build. The contract exposes listGrants only, with no create,
no revoke and no check. The screens sit behind a feature flag defaulting to off
and are read-only. The v6.2 rule that an AI may never approve still stands.

**Reason:** it reverses a recorded Vision decision, and it is the newest risk in
the product. It needs an explicit ruling, not an assumption.

**Cost if wrong:** the grant screens are built twice if the shape changes after
the answer.

**Owed to the founder:** a one-page decision before any engine work begins.

## 2026-10-05 - Stream A takes a new dashboards package, not web

**Decision:** Stream A lives in dashboards/, with its rules in
dashboards/CLAUDE.md. web/ is left untouched.

**Reason:** decided on evidence against the spec's own recommendation.
web/src/main.ts is a Stage 0 health-server stub that imports from the frozen
shared package, and template/test/compose.test.ts:22 asserts the exact set of
compose services, so repurposing the web service would disturb a frozen test for
no gain. Checked before relying on it: no test pins the workspace package list,
and a new package adds no compose service.

**Cost if wrong:** one more workspace package than strictly needed.

## 2026-10-05 - The real-data gate, three conditions (superseded)

**Superseded by:** the 2026-10-06 entry below, which states four. Kept because commit
afc0beb recorded the three-condition version, and a reader of that commit needs
the correction.

## 2026-10-05 - The mock bundle scan moves to sub-project 1

**Decision:** sub-project 0 ships the MockApiClient import-boundary guard. The
bundle scan moves to sub-project 1.

**Reason:** the scan builds with VITE_API_MODE=http and reads the output. No
production build exists until Stream A has one.

**Cost if wrong:** the mock could reach a bundle during sub-project 1 before the
scan lands. The import-boundary guard closes most of that window.

## 2026-10-05 - Lint findings in the frozen packages are recorded, not fixed

**Decision:** pnpm lint reports its counts per directory here, and nothing in the
frozen packages is changed. A lint fix in frozen code needs the founder's explicit
approval, case by case, and never as part of another task.

**Reason:** a lint fix is still a change to frozen code, and 44 commits and 442
tests depend on that code behaving exactly as it does.

**Cost if wrong:** the frozen packages carry style findings visible in every lint
run.

**Counts:** to be filled by Task 3 of the sub-project 0 plan.

## 2026-10-06 - PRD v9.0 supersedes v8.0

**Decision:** docs/prd/ORBIT_OS_PRD_v9_0.md is the authority. v8.0 and v7.0 are
the historical record and are not corrected. The spec, the plan and the contract
are rebased onto v9.0. Appendix A is the only home for the fixed product lists.

**Reason:** v8.0 stated some rules in prose, some inside an open-decision table
and some nowhere at all, so building from it required guessing. The end-to-end
read of v8.0 on 2026-10-05 found one design collision that would have made roughly
thirty screens wrong, seven contract corrections and five load-bearing omissions.
v9.0 removes the ambiguity rather than patching the symptoms.

**Cost if wrong:** another rebase if a later version restructures again.

## 2026-10-06 - Design tokens come from the frozen design package

**Decision:** tokens come from design/, proven by design/tokens.test.ts. Layout
follows PRD section 15.2: plain lists, no card grids, no KPI tiles, no template
gallery, one red used only for errors, Inter, theme follows the phone. The
prototype supplies behaviour, copy and screen flow only; its purple, pink, radii
and card layouts are not carried over.

**Reason:** the prototype's visuals are v7.0-era inventions and contradict both
the PRD and the palette this repo already tests. Following the earlier plan would
have built roughly thirty screens in the wrong visual language.

**Cost if wrong:** a token swap and a layout pass, which is the cost this decision
avoids paying later.

**Enforced by:** S-43, the design and naming build check.

## 2026-10-06 - Rule 3 is replaced

**Decision:** reproduce the prototype's behaviour, copy and screen flow. Take
names, roles, tools and visuals from the PRD, never from the prototype. Where
prototype copy names Atlas, or a role or tool not in Appendix A, substitute the
PRD name and change nothing else in the sentence.

**Reason:** the earlier rule said to copy the prototype's seed data exactly, which
conflicts with Appendix A in three places: the nine roles, the ten-tool catalog
and the design tokens.

**Cost if wrong:** prototype copy that reads oddly after a name substitution.

## 2026-10-06 - The prototype's nine roles are parked

**Decision:** Atlas, Scout, Echo, Ledger, Compass, Beacon, Pulse, Quill and Relay
are parked in docs/backlog.md and are not seeded. Appendix A.1 ships: Orbi as the
only Coordinator, plus Finance Clerk, Sales Analyst, Support Triager, HR
Coordinator and Operations Reporter.

**Reason:** Appendix A.1 is the single source of truth for roles, and Report
Writer in the v8.0 change table was a wording slip.

**Cost if wrong:** the nine are recoverable from the backlog and from
reference/orbit-os-frontend/assets/data/jobs.js.

## 2026-10-06 - The naming rule is scoped, not global

**Decision:** customer screens, which are the User and Org Admin apps plus every
customer email and push alert, never say ORBIT-OS, Paperclip, Hermes, OpenClaw,
MCP, token, agent id or adapter name, including in the title tag, email subjects
and error text. The Super Admin fleet console is exempt. The User and Org Admin
titles change to Orbitcrew; the fleet title stays as it is.

**Reason:** PRD section 15.3. The fleet console is an internal operator surface
and runtime names are correct there. A global ban would be wrong and would fail on
the fleet console by design.

**Cost if wrong:** a title and a guard scope to change.

## 2026-10-06 - The real-data gate has four conditions

**Decision:** supersedes the 2026-10-05 three-condition entry. No live inbox, real
mailbox or real customer data in any environment until all four exist and pass
their tests, per PRD section 14.3:

1. the Action Gateway,
2. the audit log,
3. budget pausing,
4. Anthropic no-training and zero-retention terms confirmed in writing, attested
   in docs/gates/anthropic-terms.md naming who confirmed it, when, and where the
   signed document lives.

Until then, a dedicated test mailbox and test accounts only. When all four are met
the founder is told, and the founder decides, not the code.

**Status: OPEN-PENDING.**

**Reason:** v8.0 recorded three conditions in its settled decisions and stated the
Anthropic condition separately in its architecture section, so it reached neither
the decision log nor the guard.

**Cost if wrong:** customer data reaching a model under terms that permit training
or retention. Not recoverable.

**Enforced by:** guards/standing-rules.test.ts, which fails closed.
docs/gates/anthropic-terms.md is deliberately absent and sub-project 0 does not
create it. Condition 4 is a contract to request and sign rather than code to
write, and it has the longest lead time of anything in this plan. The request must
name every API organization the product will use and ask for ZDR approval, which
planned models are Covered Models and their retention, which API features are
ZDR-eligible, and the no-training commitment in the commercial agreement.

## 2026-10-06 - Connector decisions CD-1 to CD-5 encode the safe default

**Decision:** until each is answered, the contract and the seed data encode the
safe-default column of PRD section 13.1, not the suggestion column: custom
connectors disabled with C-07 showing coming soon; no published review target
time; own budget per connector; Appendix A.2 as the catalog; and a Leader approves
every change-capable connector.

**Reason:** the v8.0 catalog list sat inside an open-decision table rather than in
its requirements, and an earlier reading of mine treated it as settled. It is not.

**Cost if wrong:** seed data and one permission rule change when each decision
lands.

## 2026-10-06 - Two prototype screens have no PRD counterpart

**Decision:** reported to the founder rather than resolved. The prototype's Agent
map and Performance screens have no feature ID in PRD section 15.6. Recorded in
docs/backlog.md with the nearest PRD screens named.

**Reason:** PRD Appendix C item 9 says to report a difference between the planned
screens and the inventory rather than resolving it.

**Cost if wrong:** nothing yet. Neither screen is built.

## 2026-10-06 - The title rule governs dashboards, not the prototype

**Decision:** PRD v9.0 section 15.3 is amended. The customer title rule governs
the three entry files Stream A creates under dashboards/: the User and Org Admin
titles say Orbitcrew, and the fleet title keeps ORBIT-OS under the section 15.3
exemption. It does not apply to reference/orbit-os-frontend/, which stays
read-only. S-43 enforces the dashboards titles and excludes reference/.

**Reason:** the earlier wording asked for the three prototype entry files to be
corrected. The prototype is the behaviour and copy spec and it is read-only.
Editing it would make the spec disagree with the artifact it documents, and
nobody ships its titles.

**Cost if wrong:** the prototype keeps a title that never reaches a customer.

## 2026-10-06 - No screen is cut: 52 shells, 26 filled

**Decision:** PRD section 15.8 is added. All 52 screens in sections 15.5 to 15.7
ship as shells in Stream A, each with its route, nav entry, correct title, all six
section 15.4 states, design tokens from the frozen design package, and S-43 green.
A shell says plainly what will fill it and when. Twenty-six then get working logic
in Stream A; the other twenty-six are Fill later, each with its unblocker recorded
in section 15.8: open decision 2, CD-1 to CD-5, open decisions 3, 5 and 9, the
test office producing real numbers, the second customer, or the task engine.

**Reason:** the screen inventories name 52 screens where sub-project 1 was sized
against the prototype's fourteen. Cutting screens would hide the gap; shipping
shells makes the shape of the product visible and navigable while the logic
lands behind it, and makes the design and naming check meaningful on every route
from the first week.

**Cost if wrong:** twenty-six shells that sit empty longer than expected. Each is
cheap, and each states its own condition, so an empty one is informative rather
than broken.

## 2026-10-06 - Six Fill later screens have data that ships at launch

**Decision:** where a Fill later screen's data is load-bearing, the data ships and
only the screen waits. Six cases, listed in section 15.8: the audit log (gate
condition 2); the per-teammate data boundary, which ships defaulting closed; the
office-change routing that A-14 depends on; the nightly numbers rollup that the
fleet table reads; the job-understanding test set, which is Checkpoint B; and
backup status and incident counts, already columns on the fleet table.

**Reason:** the founder named the audit log. Five more have the same shape: a
Fill-now screen or a gate depends on data whose own screen is deferred. A deferred
screen is a choice; deferred data behind a gate is a defect.

**Cost if wrong:** data recorded that nothing reads yet, which is the cheap
direction to be wrong in.

## 2026-10-06 - The two orphan screens are resolved

**Decision:** the prototype's Agent map is folded into the /teammates list as
columns, with no new screen and no new feature ID, because it was a second view of
data that list already holds. The prototype's Performance table becomes A-45, a
per-teammate tab on /results, marked Fill later. The feature register moves to Org
Admin 45 and 111 in total. The screen count stays at 52, because A-45 is a tab.

**Reason:** both were v7.0-era prototype screens with no counterpart in v9.0. One
was duplication, one was a real missing feature.

**Cost if wrong:** a teammates list that carries more columns than it needs.

## 2026-10-06 - Sub-project 1 is re-sized, and sub-projects 2 and 5 are absorbed

**Decision:** sub-project 1 splits into 1a foundation and all 52 shells, about 1.5
weeks; 1b the 15 Fill-now screens that have a prototype behaviour spec, about 2
weeks; and 1c the 12 Fill-now screens with no prototype counterpart, about 2.5
weeks. Sub-projects 2 and 5 are absorbed: the v8.0 gap screens and the Standing
Authority screens are both inside the 52, with /authority shipping as a shell that
is flagged off and read-only. Prompts 5b and 5c are retired.

**Reason:** the old sizing counted the prototype's fourteen screens and called
that the dashboards. Section 15.8 names 52. Against the original sub-project 1
plus sub-project 2, which was 5 to 6 weeks for the same ground, Stream A is now
about 6 weeks, so the work did not grow. The estimate got honest.

**Cost if wrong:** 52 shells is only cheap if the shell is one component. If each
screen hand-rolls its own six states, the shell work alone exceeds the logic work.
Sub-project 1a builds the six states once, and S-43 and the accessibility check
run on every route from the first week, which is what keeps that from happening.

## 2026-10-06 - U-19 and A-03 move to Fill now: 28 and 24

**Decision:** Request a teammate (U-19) and Org chart (A-03) move into the Fill
now set. Fill now becomes 28, Fill later 24. A-03 is built as an indented list at
every width with a side panel that sets the selected node's manager, and is sized
in 1c rather than 1b.

**Reason:** U-19 is the only producer for A-14, which was already Fill now, so the
request queue could only ever have been empty. A-03 is the only editing home for
reporting lines: A-15 assigns a teammate to a department or to people, while A-03
sets who manages whom, and with contract/v1 refusing a tree that breaks one
Coordinator, one manager each, no loops or maximum depth three, a refused tree had
nowhere to be repaired.

**Cost if wrong:** U-19 was already counted in 1c so it is free. A-03 widens 1c
from about 2.5 weeks to 2.5 to 3, because it has no prototype interaction to copy.

## 2026-10-06 - The org chart drag-and-drop canvas is parked

**Decision:** the prototype's drag-and-drop org canvas and its curved SVG status
connectors are both parked in docs/backlog.md. /org/chart renders an indented list
at every width with a side panel. What carries over is the validation behaviour,
not the interaction.

**Reason:** PRD section 15.2 requires plain lists and bans card grids. Section
15.6 already specified the indented list below 768 px; it now applies at every
width.

**Cost if wrong:** a section 15.2 change would bring either back, which is a PRD
version bump.

## 2026-10-06 - SP-6 Fleet and operations backend is added, because it was missing

**Decision:** a new sub-project SP-6, Stream B, size M, after SP-4. It owns the
nightly numbers rollup (S-38), backup status records (S-07), incident records
(S-21), setup-tracker state (S-02) and the operator audit trail written inside the
affected office (S-23). Office-change routing (A-34) becomes SP-0 Task 15, a pure
function in contract/v1.

**Reason:** this is the answer to the founder's question about which load-bearing
data items have no stream. Two had none, and the cause was a mistake in the
decomposition rather than a gap in the PRD. PRD section 17 has five build streams
and the fifth is the fleet console. When the screen inventories arrived, that
stream was absorbed into Stream A as twelve shells and four Fill-now screens, and
its server side disappeared with it: there was a sub-project for the fleet
console's screens and none for the thing that produces what they display.
Office-change routing had a different problem, not a missing stream but a missing
task: it is a pure function both streams need, so it belongs with the other
validators in contract/v1 and in neither stream.

**Cost if wrong:** SP-6 does not gate Stream A, because Stream A is mock-backed by
design, so the fleet table fills from MockApiClient and waits for nothing. What
SP-6 gates is the first real numbers, which belong to the test office. The risk is
the opposite of a blocked stream: a fleet table that looks finished while every
number in it is invented. The Task 6 mock-boundary guard is what keeps that from
shipping.

## 2026-10-06 - Why SP-6 appeared after the plan was written

**Decision:** recorded for a later reader who finds a sub-project that is not in
the original decomposition. SP-6 Fleet and operations backend is accepted.

**Reason, stated plainly:** the decomposition absorbed PRD stream S5, the fleet
console, into Stream A as twelve shells and four Fill-now screens, and did not
carry its server side across. That left a sub-project for the fleet console's
screens and none for the thing that produces what those screens display, so the
nightly numbers rollup, the backup status records and the incident records had no
owner. The PRD did not change and nothing was missing from it. The error was in
reading a stream as a set of screens.

**Cost if wrong:** one Stream B sub-project that gates nothing in Stream A.

## 2026-10-06 - Every Fill-now Super Admin screen is mock-backed until SP-6

**Decision:** stated in PRD section 15.8 as well as here. The fleet table, Office
view, Provision and Security render from MockApiClient in Stream A. Their numbers
are invented until S-38, S-07 and S-21 exist in SP-6. The same holds for the
office-change routing in the Requests queue until SP-0 Task 15 lands.

**Reason:** the risk here is not a blocked stream, it is a fleet console that
looks finished while every number in it is made up. Saying so in the PRD and the
plan is cheaper than discovering it during a demo.

**Cost if wrong:** none. The statement costs nothing and removes a
misunderstanding that would cost a lot.

## 2026-10-06 - The landing page is a separate marketing site, not screen 53

**Decision:** the marketing site stays separate, at orbitcrew.com, and is not part
of the 52-screen inventory. It already exists as `landing/` in this repo: a Vite
and React app of 24 source files with three commits, its copy in
orbitcrew-landing-page-content.md. Nothing is built. Task 12 of the sub-project 0
plan brings it under version control with its history preserved.

**Reason:** public self-signup is out of scope (PRD section 2), so a landing page
has nothing to sign anyone up to. The app lives at assistant.<customer-domain>
(section 14.1) while marketing lives at one fixed domain. And a marketing site has
constraints the app does not: SEO, open-graph tags, no auth, no MockApiClient.
Folding it into the 52 would subject it to the S-43 customer-screen rules for no
benefit.

**Cost if wrong:** if the two ever need shared components, they are in separate
packages and sharing means extracting a third. Unlikely: they share a wordmark and
a colour set, and the colour set is already the frozen design package.

## 2026-10-06 - Fleet-only components live in dashboards/src/apps/fleet

**Decision:** operator-only components live in `dashboards/src/apps/fleet/**`, which
is excluded from the S-43 CUSTOMER_DIRS scan. `dashboards/src/shared` is
customer-safe by definition and is scanned.

**Reason:** the fleet console must render runtime ids, adapter names and ORBIT-OS
under the section 15.3 exemption, and the Office view's whole job is showing them.
If any fleet-only component sat in src/shared, S-43 would fail it correctly and
there would be nowhere legal to put it.

**Consequence worth stating:** a fleet screen that needs a table of runtime ids
cannot reuse a shared table that renders them. It composes the shared primitive and
supplies operator-only cells from apps/fleet.

**Cost if wrong:** some duplication between a customer table and an operator table.
Cheaper than a shared component that has to know which surface it is on.

## 2026-10-06 - The six screen states are three components and one hook

**Decision:** PRD section 15.4's six states are built as three components, not one:

| Component | States | Shape |
|---|---|---|
| ScreenState | empty, loading, error | inline, replaces the content region |
| PausedBanner | office paused | rendered once by AppShell, not per screen |
| Blocked | not yours, expired or already decided | whole-screen, no content preview |

Plus a useScreenState hook to pick which applies.

**Reason:** section 15.4 describes three different shapes, not one. Empty, loading
and error replace the content region. Office paused is a banner that persists above
content with actions disabled. Not yours, expired and already decided replace the
whole screen with no content preview.

**Effect on the estimate: 1a stays at about 1.5 weeks.** The reason it holds is that
the banner lifts into AppShell, so 52 screens stop handling it individually, and
Blocked is one component with a three-case copy table. The state system is about 2
days of the 1.5 weeks.

**Cost if wrong:** forcing all six into one component is the expensive error, not
this one. Every screen would then choose between inline and whole-screen rendering
at its own call site, which is where a slip would have appeared around shell 20.

## 2026-10-07 - Lint findings in the frozen packages are recorded, not fixed

**Decision:** `pnpm lint` reports the counts below inside the seven frozen
packages. None are fixed. A lint fix in frozen code needs the founder's explicit
approval, case by case, and never as part of another task.

**Counts at the time the linter was added:**

| Frozen package | Errors | Rules |
|---|---|---|
| `frontdesk/` | 0 | — |
| `api/` | 1 | `no-control-regex` 1 |
| `db/` | 0 | — |
| `shared/` | 0 | — |
| `template/` | 0 | — |
| `ops/` | 0 | — |
| `design/` | 0 | — |

The one finding is `api/src/auth.ts:25:50`, `no-control-regex`: a regular
expression that matches the control characters `\x00` to `\x1f`. It is doing that
on purpose, because it rejects header and token input containing them. It is
reported here and left alone.

The frozen packages are not linted by `pnpm lint`: they are in the config's
ignore list, because a gate that cannot go green is a gate somebody switches
off. The counts above were collected by running ESLint against a throwaway
config that imports `eslint.config.js` and filters the seven directories back
out of the ignore list. `--no-ignore` cannot be used for this, because it lifts
the `node_modules` and `generated` ignores at the same time and reports on
vendored code.

**Reason:** a lint fix is still a change to frozen code. The freeze exists
because 44 merged commits and 442 tests depend on that code behaving exactly as
it does, and a reformat that looks harmless is still a diff nobody asked for.

**Cost if wrong:** the frozen packages carry style findings for the life of the
project, visible in every lint run and ignored by everyone. At one finding, that
cost is currently near zero.

## 2026-10-07 - no-undef and no-unused-vars are off for TypeScript, and tsc owns them

**Decision:** in `eslint.config.js`, core `no-undef` and `no-unused-vars` are
`off` for `**/*.{ts,tsx}` and stay on for `.js`, `.mjs` and `.cjs`. In exchange,
`noUnusedLocals` and `noUnusedParameters` are turned on in both `tsconfig.json`
and `dashboards/tsconfig.json`.

**Reason:** `@babel/eslint-parser` strips the types before ESLint sees the file.
Core `no-undef` then reads every type name and every type-literal member name as
an undeclared global, and core `no-unused-vars` reads every `import type` as dead
code. On the first full run that produced 82 errors across `dashboards/` and
`guards/` and 670 across the frozen packages, every one of them a correct piece
of TypeScript:

```
guards/lib/walk.ts
  28:13  error  'RootedPath' is not defined            no-undef
dashboards/src/shared/states/ScreenState.tsx
  13:16  error  'kind' is not defined                  no-undef
  10:15  error  'ReactNode' is defined but never used  no-unused-vars
```

No rule option tells a type name from a missing one. `typescript-eslint`'s
type-aware replacements are what normally do this, and this repo does not use it:
it needs every linted file to sit in a tsconfig project, and the two projects
here between them exclude `reference/`, `landing/`, `archive/` and `dashboards/`
from the root one.

**Nothing is left ungated.** An undefined name is a `tsc` error, TS2304, on the
`pnpm typecheck` gate. Unused locals, unused parameters and unused imports are
now `tsc` errors too, TS6133 and TS6196, which is a stricter reading than the
ESLint rule gave: the compiler knows which names are type-only. `pnpm typecheck`
stayed at 0 errors after the two flags went on, in every package including the
seven frozen ones, so no frozen code had to change for this.

**Consequence worth stating:** this is the one place where the `pnpm lint` gate
is deliberately quieter than ESLint's recommended set. It is recorded here rather
than left as two `off` lines somebody later reads as carelessness. Two additive
rules went the other way at the same time: `react/jsx-uses-vars` and
`react/jsx-uses-react`, which report nothing themselves and tell
`no-unused-vars` that a name used inside JSX is used. Without them the `.js`
side of the gate would blame every imported component as dead.

**Cost if wrong:** a shape-level mistake that `tsc` does not look for goes
unreported in a `.ts` file. `no-undef` and `no-unused-vars` are not that class of
rule, so the exposure is small; the fix if it bites is to adopt
`typescript-eslint` and give every linted file a tsconfig project.

## 2026-10-07 - react/no-danger is the one rule the freeze does not buy out

**Decision:** `pnpm lint:frozen` reports findings in the seven frozen
directories and exits 0, as the entry above describes. `pnpm lint:frozen:danger`
runs the same scan and exits 1 on `react/no-danger` and on nothing else. CI runs
both: the first as a report step, the second as a gate.

**Reason:** every other finding in frozen code is a style finding, and a
reformat there is still a diff nobody asked for. This one is not. A
`dangerouslySetInnerHTML` renders whatever a job, an email or a connector
produced as markup, with no escaping, and a frozen directory is not a safer
place to do that than any other. The freeze protects 44 merged commits of
behaviour; it was never meant to protect a new injection site added later.

**What the check can and cannot see, because a tripwire described as a guard is
worse than no tripwire:** `react/no-danger` matches a JSX attribute. There are
no `.tsx` or `.jsx` files in the seven frozen directories today, and no
`dangerouslySetInnerHTML` anywhere in them, so the gate currently passes by
having nothing to look at. It arms on the commit that puts JSX into frozen code,
which was verified by putting a `dangerouslySetInnerHTML` in a temporary
`shared/src/Probe.tsx` and watching the gate exit 1 while the report mode stayed
at 0. It does **not** see
`React.createElement('div', { dangerouslySetInnerHTML })`, and it does **not**
see HTML assembled by string concatenation. `shared/src/body.ts` is the frozen
code that handles HTML today, and it strips inbound markup to text rather than
rendering any, so nothing there is in this rule's reach either way.

**Consequence worth stating:** the single existing frozen finding,
`no-control-regex` in `api/src/auth.ts`, stays a report. If the gate failed on
it, it could not go green, and a gate that cannot go green is a gate somebody
switches off. A test in `guards/lint-config.test.ts` pins the fail list to the
one rule for that reason.

**Cost if wrong:** an injection site reaches frozen code through a path this
rule does not match, most likely string-built HTML. The fix then is a rule that
reads the string path, not a wider version of this one.

## 2026-10-08 - Route reconciliation: the 66 axe routes are the 52 PRD screens, with the 14 User screens tested twice

**Decision:** No route is added, removed or renamed. The axe project's 66 test
cases reconcile exactly against PRD v9.0 sections 15.5 to 15.7. There are no
extra routes, so Appendix C item 9 has nothing to report as a difference.

**Reason:** 66 is a count of test cases, not of screens. `e2e/routes.spec.ts`
iterates three role lists from `dashboards/src/shared/nav/roles.ts`: `USER_NAV`
(14), `ORG_ADMIN_NAV` (35) and `FLEET_NAV` (17). `ORG_ADMIN_NAV` is
`[...USER_SCREENS, ...ORG_ADMIN_SCREENS]`, because section 15.6 opens with "The
Org Admin reaches every User screen plus these". So the 14 User screens are
tested a second time, mounted under the `org-admin` entry, and 14 + 35 + 17 = 66
covers 14 + 21 + 17 = 52 distinct screens. Every name and route in
`screens.ts` is the PRD's own, and `guards/screen-inventory.test.ts` parses the
three PRD tables and fails on drift; it passes today, six tests.

**The one route the apps serve that axe does not cover:** the catch-all
`<Route path="*">` in `dashboards/src/shared/layout/RoleRoutes.tsx`, which
renders the not-found shell. It is not a PRD screen and carries no screen name,
so it is not in any role list and not in the 66. `routes.spec.ts` asserts the
`<h1>` equals the expected screen name precisely so a broken route falls through
to that shell and fails loudly instead of passing.

**Why the duplicate coverage stays:** the two mounts are not the same page. The
`user` and `org-admin` entries are separate Vite HTML entries with their own nav
list, so a User screen rendered inside the Org Admin shell has a different
sidebar, a different `<title>` and a different set of landmarks. An axe finding
can live in that difference. Collapsing the 66 to 52 would stop testing 14
screens in one of the two shells they ship in.

**Cost if wrong:** 14 test cases of the 66 duplicate a screen body and cost
runtime without finding a new body-level defect. The saving if they were cut is
a fraction of one Playwright run; the exposure if a shell-level finding is
missed is an accessibility defect on a shipped screen.

## 2026-10-08 - Founder decision: the 14 duplicated User routes stay in the axe project

**Decision:** The axe project keeps all 66 cases. The 14 User screens are tested
twice, once under the `user` entry and once under `org-admin`. They are not cut
to 52 (founder decision, 2026-10-08).

**Reason:** the two mounts are not the same page. `user` and `org-admin` are
separate Vite HTML entries, each with its own `<title>`, its own nav list and so
its own set of landmarks around the same screen body. An axe finding can live in
that difference and be invisible in the other mount. Testing a screen in one of
the two shells it ships in is not testing it.

**Cost if wrong:** 14 of the 66 cases re-walk a screen body and find nothing new,
for a fraction of one Playwright run.

## 2026-10-08 - The not-found shell is axe case 67 to 69, and is not a screen

**Decision:** `e2e/routes.spec.ts` runs three more cases, one per app entry, on
an address that matches no route: `#/not-a-screen`. The axe project is now 69
cases. `guards/screen-inventory.test.ts` is untouched and still asserts 52 at
three places, because the not-found shell is not a PRD screen and must never be
added to `screens.ts`.

**Reason:** `RoleScreens` ends its route list with `path="*"`, which renders a
page with a heading, a sentence and a link out. A person reaches it by following
a stale link or editing the address, so it is a real page with a real
accessibility surface. It carries no screen name, so the loop over the three
role lists cannot produce it; without these three cases nothing reads it.

**Why the two counts differ, stated once:** 69 cases cover 52 screens. 14 User
screens are tested in two mounts (the entry above), and one shared not-found
shell is tested in three. 52 + 14 + 3 = 69.

**Probe:** an `<img>` with no `alt` was added to the `NotFound` component in
`dashboards/src/shared/layout/RoleRoutes.tsx`. All three new cases failed, each
naming `image-alt: 1 node(s)`, and none of the 66 screen cases changed, which is
what proves the new cases and not an existing one are reading that page. The
probe was then removed and the three went green again.

**The address is not a near-miss on purpose:** `/not-a-screen` shares no prefix
with a real route. A typo of a real screen could start matching the day that
screen takes a parameter, and the case would then pass while reading the wrong
page.

**Cost if wrong:** the not-found shell is one component, so three cases read the
same markup three times and differ only in the surrounding app shell, which is
the same reason the 14 duplicates stay.

## 2026-10-08 - Census before the mock-boundary guard: MockApiClient does not exist yet

**Result:** no file imports `MockApiClient`, because no file defines it. A
repo-wide search over `.ts`, `.tsx`, `.js` and `.json` finds the name in eight
files, all of them prose: this log, `dashboards/CLAUDE.md`,
`docs/prd/ORBIT_OS_PRD_v9_0.md`, two plans, one spec, one task brief and
`ORBIT-OS_Claude_Code_Build_Prompts.md`. `dashboards/src/dev/` does not exist,
`dashboards/src/shared/api/` does not exist, and `ApiClient` appears in no
TypeScript file.

**Why this is recorded rather than assumed:** Task 6 says the guard is written
before the thing it guards, so "zero importers" is the state the guard must pass
in, and it is also the state in which a guard can pass by finding nothing. The
probe step is what separates the two, and it is not optional here.

**Cost if wrong:** an importer outside the search set, most likely a `.mjs`
script or a path not in the guard's `SEARCHED` list, is missed. The search above
covered the whole repo rather than that list, which is why the census is wider
than the guard.

## 2026-10-08 - The MockApiClient import-boundary guard, and the demo office moves under dev/

**Decision:** `guards/mock-boundary.test.ts` holds four tests. The rule is that
the name `MockApiClient`, and the demo office seed, are reachable only from
`dashboards/src/dev/**` or from a file ending `.test.ts` or `.test.tsx`. It
scans the working tree of `dashboards`, `contract`, `web`, `worker`, `api`,
`frontdesk` and `shared`, skipping `node_modules`, `.git`, `dist` and
`generated`. It is in the `unit` project already, through the existing
`guards/**/*.test.ts` include, so no config changed.

**Reason:** the mock holds a demo office for the whole project, and the moment
it can be imported from a screen is the moment it can reach a build. A guard
written before the thing it guards means the first import from a real path fails
on the commit that adds it, which is the only moment the fix is cheap.

**Five corrections to the Task 6 code in the plan, each with its reason:**

1. **The seed check pins its sentinels.** The plan matched the one literal
   `BrightPath Advisors`. Rename the demo office and that test keeps passing
   while watching a string nothing writes. A third test asserts every sentinel
   still matches something under `dashboards/`, so the rename fails here instead
   of going quiet.

2. **Three sentinels, not one:** `/BrightPath Advisors/i`, `/Maria Santos/` and
   `/brightpath\.example/i`. One office name is one commit away from being
   renamed. Two of the three are case-insensitive because the prototype itself
   varies the case, writing the address as `Maria@BrightPath.example`.

3. **The scan reads file text, not the import graph**, and that is deliberate
   rather than a shortcut. A text scan cannot be routed around by a dynamic
   `import()`, a re-export, a name reached through an index barrel, or a string
   built from two halves. The cost is that a code comment naming
   `MockApiClient` in a screen file fails this guard. The file says so, and says
   to reword the comment rather than widen the rule.

4. **`guards/` and `e2e/` are outside the searched list**, which is why this
   guard may name the sentinels in full. Stated in the file, because it reads
   like an omission.

5. **A tripwire keeps the skip from outliving the seed (founder, 2026-10-08).**
   The pin is skipped while the seed package is absent. A fourth test runs
   always: when the package is absent, no file under `dashboards/` may hold a
   sentinel. So demo data landing anywhere else fails rather than sitting under
   a skipped pin. The skip condition reads the directory and the assertion reads
   the file contents, on purpose: a skip condition that reads the same scan as
   its assertion is a skip that can never end.

**The demo office seed moves to `dashboards/src/dev/seeds/`, not
`dashboards/src/shared/seeds/`.** The `dashboards/CLAUDE.md` layout lists five
things under `shared/seeds/`: jobs, connectors, org templates, the demo office
and the fleet registry. Four are product data from PRD Appendix A and are meant
to ship. The demo office is not. A rule that reaches the mock only from dev code
cannot also allow the mock's data to sit in a shipped shared package, so the
demo office splits off under `dev/` and the other four stay where the layout
puts them. This is a correction to that layout line, found by probing the guard,
and `SEED_PACKAGE` in the guard is the one place the path is written.

**Probe output, both sides.**

Allowed side, both PASS. `dashboards/src/dev/probe.ts` and `shared/src/x.test.ts`
each holding `MockApiClient`:

```
Tests  3 passed | 1 skipped (4)
```

Denied side, FAIL naming the path. `dashboards/src/scratch.ts` holding
`MockApiClient`:

```
× MockApiClient is named only by dev-only code and tests
AssertionError: expected [ 'dashboards/src/scratch.ts' ] to deeply equal []
```

Denied side, sentinels on a real path. The same file holding all three:

```
× the demo office seed is not reachable from a non-dev path
× no demo data exists outside dashboards/src/dev/seeds while the pin is skipped
AssertionError: BrightPath Advisors is reachable from a real path:
  expected [ 'dashboards/src/scratch.ts' ] to deeply equal []
```

Tripwire, a sentinel on an ALLOWED path with no seed package. The boundary test
passes, correctly, and the tripwire still fails:

```
× no demo data exists outside dashboards/src/dev/seeds while the pin is skipped
AssertionError: BrightPath Advisors exists but dashboards/src/dev/seeds does not,
  so the pin cannot run: expected [ 'dashboards/src/dev/probe.ts' ] to deeply equal []
```

The pin itself, proven both ways. With `dashboards/src/dev/seeds/office.ts`
holding all three sentinels, `Tests 4 passed (4)`: the pin ran rather than
skipping. Renaming the office in that file to `Northwind Partners`:

```
× every sentinel still names real demo data
AssertionError: BrightPath Advisors matches nothing under dashboards:
  rename or replace it: expected [] to not deeply equal []
```

All probe files were then deleted and the tree confirmed clean: the only changes
are `docs/decisions.md`, `e2e/routes.spec.ts` and the new
`guards/mock-boundary.test.ts`.

**What a text scan cannot see.** It reads `.ts` and `.tsx`, plus `.json` for the
seed sentinels. Demo data in a `.mjs` script, a `.csv`, a fixture under another
extension, or a base64 blob is invisible to it. A comment, a dead branch and a
live import all count the same, so the guard says where a name may appear and
not whether it is used. And it is not the bundle scan: a mock kept out of every
source path can still reach a bundle through a build config. The bundle scan
needs a production build, which does not exist yet; decision 6 moves it to
sub-project 1.

**Cost if wrong:** a mock import arrives by a path this scan does not read, most
likely a `.mjs` build script. The fix then is the bundle scan, which reads the
output rather than the sources, and which is already owned.

## 2026-10-08 - dashboards/CLAUDE.md: the mock and the demo office move to src/dev

**Decision:** the layout tree in `dashboards/CLAUDE.md` gains a `src/dev/`
entry, holding `MockApiClient` and `src/dev/seeds/` for the demo office. Two
existing lines change with it: `shared/api/` now reads "ApiClient interface,
queryKeys, hooks. No implementation", and `shared/seeds/` now lists four things
rather than five, the demo office having left it.

**Reason:** the founder asked for the seeds line. The `shared/api/` line had the
identical fault and was not mentioned, so it is called out here rather than left
for the guard to find: the tree put `MockApiClient` itself in a shipped shared
package, which `guards/mock-boundary.test.ts` would fail on the first commit
that followed the layout as written. Amending one line and not the other would
have left a document that cannot be obeyed.

The four remaining seeds — jobs, connectors, org templates, fleet registry — are
PRD Appendix A product data and are meant to ship, so they stay. Only the demo
office moves. A paragraph under the tree states the split and names the guard,
because a tree alone does not say which part of it is enforced.

**Cost if wrong:** dev-only code sits one directory away from the shared code it
mirrors, so a person editing the mock has further to look. The alternative is a
mock that the boundary guard cannot let exist.

## 2026-10-08 - pnpm audit: three high advisories, all transitive, NOT wired into CI

**Result:** `pnpm audit --audit-level=high` exits 1 today. Seven advisories over
695 dependencies: 3 high, 4 moderate, 0 critical. Per the founder's
instruction the step is **not** added to `.github/workflows/ci.yml` until these
are seen. No bypass flag was used and none is proposed.

| Severity | Package | Installed | Vulnerable | Patched | Path |
| --- | --- | --- | --- | --- | --- |
| high | `deepmerge-ts` | 7.1.5 | `<8.0.0` | `>=8.0.0` | `db>prisma>@prisma/config>deepmerge-ts` |
| high | `mysql2` | 3.15.3 | `<3.22.0` | `>=3.22.0` | `db>prisma>mysql2` |
| high | `braces` | 3.0.3 | `<=3.0.3` | **none** | `dashboards>tailwindcss>chokidar>braces` |

Advisories: GHSA-ggr8-5vv4-36mx (stack exhaustion merging recursive object
graphs), GHSA-3f6p-5ww8-9rcr (auth plugin downgrade to `mysql_clear_password`
leaking plaintext credentials), GHSA-vfj7-8cjw-p6xm (stack-exhaustion denial of
service on deeply nested patterns).

**What is worth knowing before deciding.** None is first-party code; all three
are transitive, and two of the three arrive through `prisma` 7.10.0, which is
pinned. `mysql2` is the one that reads worst and matters least here: this
project runs Postgres, `db/package.json` uses `@prisma/adapter-pg`, and the
MySQL driver is a dependency Prisma declares but this code never loads. A
credential-leaking MySQL auth downgrade needs a MySQL connection to downgrade.
`braces` has **no patched version at all** — the advisory's patched range reads
`<0.0.0` — so it cannot be resolved by upgrading that package; it would need
`tailwindcss` 3.4.19 to stop depending on `chokidar` 3.6.0, which is a
Tailwind 4 change.

**Why this is not wired yet, stated plainly:** a gate that is red on the day it
is added is a gate somebody adds `--audit-level=critical` to within a week. The
honest options are to upgrade what can be upgraded and accept the rest with a
recorded reason, or to leave the row unmet and say so. Both are the founder's
call. There is no third option where the step goes in and the branch stays
green.

**Cost if wrong:** the dependency row of section 8 stays unmet, so a new
high-severity advisory in a package this code does load arrives with nothing
watching for it.

## 2026-10-08 - Decisions-log guard: one existing heading would fail, and it should not

**Result:** the census ran before the guard was written, per the founder's
instruction. `docs/decisions.md` holds 36 `## ` headings. One lacks a
`**Reason:**`, `**Why**` or `**Result:**` line:

- `## 2026-10-05 - The real-data gate, three conditions (superseded)`

No history was rewritten. One other heading failed the census when it was first
run — this session's own mock-boundary entry — and it was given the
`**Reason:**` line it should have had when it was written. That is a correction
to a new entry, not a rewrite of the record.

**Why the one remaining heading should not be made to pass.** It is four lines
long and says only that the 2026-10-06 entry supersedes it, kept because commit
`afc0beb` recorded the three-condition version of the real-data gate and a
reader of that commit needs the correction. It is a pointer, not a decision. A
`**Reason:**` line added to it would be filler written to satisfy a check, which
is the exact failure mode a shape guard invites.

**So the guard is not written yet.** The rule it would enforce needs one of two
answers from the founder: accept `**Superseded`** as a fourth acceptable opener
alongside Reason, Why and Result, or exempt headings that end in `(superseded)`.
The first is better, because it is a rule about what the entry says rather than
about how its title is punctuated. Neither is mine to choose.

**Cost if wrong:** the decisions row of section 8 stays unenforced, so an entry
landing with no reason is caught only by a reader.

## 2026-10-08 - Task 10: the section 8 rows that are now real CI steps, and the three that are not

**Decision:** `.github/workflows/ci.yml` gains `pnpm lint` in the existing
`test` job, plus two new jobs, `e2e` and `secrets`. Two new guards,
`guards/version-pinning.test.ts` and
`dashboards/src/shared/layout/screens.axe.test.tsx`, need no CI step of their
own: they run inside the `pnpm test` the job already calls.

**Reason:** before this entry, 4 of the 13 checks section 8 names were real CI
steps, 3 existed as scripts nobody ran in CI, and 6 did not exist at all. A
table in a spec that describes an intention is the gap this closes.

**`pnpm lint` goes before `pnpm test`, not after.** Lint is the cheapest failure
in that job and should not wait behind a database and 380 tests. It ignores the
seven frozen directories; the two `lint:frozen` steps below it are unchanged.

**`pnpm e2e` is its own job.** It needs a Chromium and the apt packages behind
it, and it needs no Postgres. As a step in `test`, every unit run would pay for
a browser install. As a job, the two run at once and the wall clock falls.
`playwright install --with-deps chromium` and not the default: both Playwright
projects name Desktop Chrome, so the other two browsers are about 300 MB this
job never opens.

**Failure artifacts, and a reporter change to make them exist.**
`playwright.config.ts` used the `github` reporter alone in CI, which writes
annotations and no files, so there would have been nothing to upload. It now
uses `github` plus `html` with `open` set to never. The `e2e` job uploads
`playwright-report/` and `test-results/` with `if: failure()` and a 7-day
retention. An axe failure names a rule and a node count; without the report
nobody can see which node, and a serious finding nobody can locate is a red
build that gets switched off.

**`secrets` is its own job with `fetch-depth: 0`**, because a secret committed
earlier and deleted later is still in the pack, and a shallow clone cannot see
it.

**gitleaks is pinned to a commit, with the provenance recorded.** The step is
`gitleaks/gitleaks-action@ff98106e4c7b2bc287b24eaf42907196329070c7`. That SHA
came from resolving the `v2` tag through the GitHub API on 2026-10-08. The call
`GET /repos/gitleaks/gitleaks-action/git/ref/tags/v2` returns an annotated tag
object, `dcedce43c6f43de0b836d1fe38946645c9c638dc`, and dereferencing that with
`GET /repos/gitleaks/gitleaks-action/git/tags/dcedce43c6f43de0b836d1fe38946645c9c638dc`
gives commit `ff98106e4c7b2bc287b24eaf42907196329070c7`. The tag object SHA is
not the commit SHA, and pinning to it would not resolve, which is why both calls
are recorded here. A tag is mutable: whoever can push to that repository can
move `v2` onto different code, and this step runs with the repository's token.

`v3.0.0` exists, published 2026-05-30, commit
`e0c47f4f8be36e29cdc102c57e68cb5cbf0e8d1e`. It is not used here. Upstream
states no change to inputs, outputs or behaviour, and it requires runner
2.327.1 or later; `v2` is the version this was reviewed against. Moving to v3 is
a one-line change whenever wanted.

`GITLEAKS_LICENSE` is required for organization-owned repositories and not for
personal accounts. `origin` is `github.com/shuvgenai/Orbitos`, a personal
account, so the secret is absent and the step runs without it. The env line
stays, so that moving this repository into an organization fails on a missing
licence rather than quietly stopping the scan.

**Probe output, every new gate.**

`pnpm lint`, with a dangerous-HTML property in a temporary
`dashboards/src/shared/layout/ProbeDanger.tsx` and an unused variable in
`scripts/probe-lint.mjs`:

```
dashboards\src\shared\layout\ProbeDanger.tsx
  2:15  error  Dangerous property 'dangerouslySetInnerHTML' found  react/no-danger
scripts\probe-lint.mjs
  1:7  error  'unused' is assigned a value but never used  no-unused-vars
```

Worth recording from that probe: an unused **import** in a `.ts` file does not
fail `pnpm lint`. `eslint.config.js` turns `no-unused-vars` off for `.ts` and
`.tsx` on purpose, because the parser strips types and the rule then reads every
type-only import as dead. `noUnusedLocals` in both tsconfig projects reports it
instead, under `pnpm typecheck`. The first probe tried was an unused import and
it passed; that is a fact about which gate owns the rule, not a hole in the
gate.

`pnpm e2e`, with an alt-less image in `Screen.tsx`, which renders on all 52
screens. The route case fails and the harness still passes, which is the
distinction that matters: the harness is what would catch axe going silent.

```
OK   [harness] a browser really loads a page in this environment
OK   [harness] axe really runs and really reports a known defect
FAIL [routes] user /receipts has no serious or critical accessibility finding
+   "image-alt: 1 node(s)",
```

`guards/version-pinning.test.ts`, with the `axe-core` pin loosened to a caret
range:

```
AssertionError: expected [ Array(1) ] to deeply equal []
+   "dashboards/package.json devDependencies.axe-core = ^4.13.0",
```

The secret scan, probed through the `zricethezav/gitleaks` image rather than by
committing a fake key, because a canary written into history stays there:

```
Finding:     aws_access_key_id = AKIA<20-char key, redacted>
RuleID:      aws-access-token
Entropy:     4.121928
leaks found: 1
```

The key is redacted above, and the reason is the entry further down this log
dated the same day: the literal was committed here and the `secrets` job
promptly found it.

**A limit of the secret scan, found while probing it.** The first probe used
`AKIAIOSFODNN7EXAMPLE`, which is AWS's own documented example key, and gitleaks
reported `no leaks found`. Vendor example credentials are allowlisted, so a real
credential that happens to match a published example passes this gate. The scan
over the actual repository is clean today, 154 commits and 2.76 MB with no
leaks, so the job goes in green rather than red.

**After the changes, with no probe files left:** `pnpm lint` exit 0,
`pnpm typecheck` exit 0, vitest over the unit and dashboards projects 46 files
and 513 passed with 1 skipped, `playwright test` 72 passed.

**Cost if wrong:** two more jobs on every push, so a queue on a busy runner. The
`e2e` job is the slow one, and it is slow because it installs a browser. If that
becomes the complaint the fix is a cached browser, not a dropped gate.

## 2026-10-08 - axe per screen runs in jsdom, and states what jsdom cannot see

**Decision:** `dashboards/src/shared/layout/screens.axe.test.tsx` runs axe over
all 52 screens, each inside its own role's shell, filtering to serious and
critical and reporting a rule with its node count exactly as `e2e/axe.ts` does.
`axe-core` is pinned to 4.13.0, and nothing else was installed, per the
founder's choice of option A. 52 tests, 9.4 seconds.

**Reason:** it fails in the `pnpm test:unit` a person already runs before
committing, rather than waiting for a browser job. 4.13.0 and not the current
4.14.0, because `@axe-core/playwright` 4.13.0 carries axe-core 4.13.0, and the
two halves of this row must agree on what a rule is. Otherwise one half can pass
a screen the other fails and neither is wrong.

**What jsdom cannot see, which is why the Playwright half is not redundant.**
jsdom computes no layout, so every rule needing geometry or painted pixels
cannot run: `target-size`, the scroll and overflow rules, and above all
`color-contrast`. This file would pass a screen whose text is grey on grey.
`color-contrast` is disabled explicitly rather than left to return incomplete,
because axe reaches for a canvas to sample pixels, fails, and prints a
not-implemented warning about `getContext` once per screen. Fifty-two lines of
that is noise a reader learns to scroll past, and the rule could not have
produced a finding either way. Naming it makes the gap a declaration in code
instead of a sentence in a comment. Contrast belongs to `e2e/routes.spec.ts`, in
a browser that has pixels.

**The list is 52, not the Playwright half's 69.** The second mount of the 14
User screens under `org-admin`, and the not-found shell in each of the three
apps, differ from these only in the shell around them, and the shell is the part
jsdom renders without layout. Those belong to the browser half. Duplicating
them here would cost 17 more axe runs to read the same markup with less of it
resolved.

**Probe:** an alt-less image in `Screen.tsx` failed all 52 with
`expected [ 'image-alt: 1 node(s)' ] to deeply equal []`, and the probe was then
removed.

**Cost if wrong:** a contrast or hit-target defect reaches a screen and only the
Playwright job catches it, which is the job that runs last. That is the
arrangement, not a surprise.

## 2026-10-08 - Task 2 is not scheduled, and Task 10 cannot be called done without it

**Result:** Task 2 of `docs/superpowers/plans/2026-10-05-v8-seam-and-contract.md`
names eight artifacts. Seven do not exist:

| Artifact | State |
| --- | --- |
| `docs/decisions.md` | exists, and every later task appends to it |
| root `CLAUDE.md` | missing |
| `docs/rules/engine.md` | missing |
| `docs/security/threat-model-engine.md` | missing |
| `docs/security/threat-model-gateway.md` | missing |
| `docs/security/keys.md` | missing |
| `guards/rules.test.ts` | missing |
| `guards/standing-rules.test.ts` | missing |

**Reason this is recorded rather than quietly worked around:** Tasks 3, 4, 5, 6
and now 10 were all built while Task 2 sat unstarted, so the plan's order is not
the order the work happened in. Nothing scheduled Task 2 and nothing is
currently blocked on it, which is exactly how it stayed invisible. The founder
has said Task 10 is not done until those two guards exist, so the dependency is
now written down where the next session will read it.

**What the two missing guards are for, since the plan's own text is spread over
four places.** `guards/standing-rules.test.ts` holds the real-data gate and the
secrets policy: it asserts that the real-data gate entry in this log still says
`open-pending`, so the gate cannot be closed by a code change alone, and it
enforces the rule that keys stay scoped to this project and are never read from
a shared env file. `guards/rules.test.ts` checks the structure of the rules file
and the two threat models, which also do not exist yet. So Task 2 is not two
test files; it is five documents and the two guards that check their shape.

**Consequence for the section 8 table:** the Decisions row depends on the guard
discussed in the entry above, which is waiting on a founder answer. The Security
review row is a human step that CI can only gate on the record of, and there is
no record of one yet: this log contains zero security-review entries. Both rows
stay open, and neither is closed by this task.

**Cost if wrong:** Task 10 is reported as done while two of section 8's rows have
no enforcement and five governance documents do not exist, which is the kind of
gap a later reader finds by trusting the table.

## 2026-10-08 - The secret scan caught a key in this log, written by the probe that proved the scan works

**Result:** the first CI run on `stream-0/seam-and-contract` failed the `secrets`
job. The finding was real and it was ours:

```
Fingerprint: 92a86942af704f5ae0d95bfd25cd83663f90f182:docs/decisions.md:aws-access-token:1002
RuleID:      aws-access-token
leaks found: 1
```

Line 1002 was the recorded output of the probe that proved the secret scan
works. The probe used a randomised AWS-shaped key, precisely because AWS's own
published example is allowlisted and produced `no leaks found`. Recording that
output verbatim committed a key-shaped string into a document, and the gate did
exactly what it was added to do.

**Reason this is written down rather than quietly patched:** the string was
never a credential and no account exists behind it, so nothing has to be
rotated. What has to change is the habit. Probe output that proves a secret
scanner works cannot be pasted verbatim into a committed file, because the
scanner is right about it. Every future probe of that gate records the rule id,
the entropy and the count, and redacts the matched value.

**The literal is now redacted in the entry above.** Redaction alone does not fix
the gate: `fetch-depth: 0` means gitleaks reads the history, so the original
blob keeps failing until the commit that holds it is rewritten or the finding is
allowlisted. The two options were put to the founder rather than chosen here,
because one of them is a force-push and the other weakens the gate.

**Cost if wrong:** a `.gitleaks.toml` allowlist entry, if that is the route
chosen, is a line that says "ignore this one finding" and will be read by the
next person as permission to add a second. An allowlist with one entry and a
reason beside it is defensible; the risk is entirely in what gets added to it
later.

## 2026-10-08 - Prisma cannot be upgraded past the two advisories yet

**Result:** there is no stable Prisma release that clears GHSA-ggr8-5vv4-36mx
(`deepmerge-ts`) or GHSA-3f6p-5ww8-9rcr (`mysql2`). The project is on 7.10.0,
and **7.10.0 is the newest stable release there is**: the versions after it are
`8.0.0-rc.x`, and the registry's `latest` tag currently points at
`8.0.0-rc.21`, a release candidate.

`prisma@7.10.0` declares `mysql2` 3.15.3 and `@prisma/config` 7.10.0, and
`@prisma/config@7.10.0` declares `deepmerge-ts` 7.1.5. Both are exact pins
inside Prisma, so no resolution of the current major can move them.

`prisma@8.0.0-rc.21` declares neither: it drops `mysql2`, `postgres` and
`@prisma/config` as direct dependencies in favour of `@prisma/orm-toolchain`,
`@prisma/cli-engine` and `@prisma/compute-sdk`, and a spot check of those three
found no `mysql2`, `deepmerge-ts` or `@prisma/config` among their own
dependencies. That is a direct-dependency reading, not a resolved tree; proving
it would mean installing the release candidate.

**So the answer to "the lowest Prisma version that clears both" is 8.0.0-rc.21,
and it is not being taken.** It is a major bump and a pre-release at once, in
the package that owns this project's database access. Nothing was upgraded, per
the founder's instruction to report rather than move on a major bump.

**Reason this is recorded and not left as a note:** the next person to read the
accepted-advisory list below will ask whether an upgrade was considered. The
answer is that it was, and the only version that fixes it is a release
candidate. That changes when Prisma 8 ships stable, which is the review
condition on two of the three entries.

**Cost if wrong:** the two advisories stay open for as long as Prisma 8 takes to
ship. Both are stack-exhaustion or driver-path issues in code this project does
not call, which is the reason they are acceptable to hold; see the list below.

## 2026-10-08 - Accepted advisories, ignored by GHSA id and reviewed on a condition

**Decision:** `pnpm audit --audit-level=high` is now a CI step in the `test`
job. Three advisories are ignored, each by id, in the
`pnpm.auditConfig.ignoreGhsas` block of the root `package.json`. The level stays
at `high`.

| Advisory | Package | Path | Why accepted | Review on |
| --- | --- | --- | --- | --- |
| GHSA-3f6p-5ww8-9rcr | `mysql2` <3.22.0 | `db>prisma>mysql2` | This project is Postgres. `db/package.json` uses `@prisma/adapter-pg`, and the MySQL driver is a dependency Prisma declares but this code never loads. The advisory is an auth-plugin downgrade leaking plaintext credentials over a MySQL connection, and there is no MySQL connection to downgrade. | When Prisma 8 ships stable |
| GHSA-ggr8-5vv4-36mx | `deepmerge-ts` <8.0.0 | `db>prisma>@prisma/config>deepmerge-ts` | Stack exhaustion when merging recursive object graphs. Reached only by Prisma's own config loader, over config this repository writes, which no attacker supplies. | When Prisma 8 ships stable |
| GHSA-vfj7-8cjw-p6xm | `braces` <=3.0.3 | `dashboards>tailwindcss>chokidar>braces` | Stack-exhaustion denial of service on deeply nested glob patterns. **The advisory has no patched version**: its patched range reads `<0.0.0`. Reached through the Tailwind file watcher at build and dev time, over glob patterns written in this repository's own config, never at runtime in a browser. | When the dashboards move to Tailwind 4 |

**Reason the ignore is by id and never by severity.** Dropping the gate to
`--audit-level=critical` would make it pass today and hide the next *high*
advisory in a package this code does load, which is the only thing the row
exists to catch. An id is a statement about one known finding; a severity is a
statement that a whole class stops mattering.

**Reason the list lives in `package.json` and not in the CI command.** A local
`pnpm audit` then answers the same as CI, so nobody discovers the difference by
pushing. It also keeps the list one `git log -p package.json` away from the
commit that explains it.

**What is not ignored:** the four moderate advisories. They sit below the gate's
level, so they are reported and fail nothing, and no id of theirs is on the
list. If the level ever drops to `moderate` they have to be read, not inherited.

**No `--ignore-registry-errors`.** A registry that cannot be reached fails the
step. Noisy and correct: the alternative is a check that reports clean because
it asked nobody.

**Probe:** `GHSA-3f6p-5ww8-9rcr` was removed from the list and
`pnpm audit --audit-level=high` exited 1, printing the `mysql2` advisory with
its path `db>prisma>mysql2` and `Severity: 4 moderate | 3 high (2 ignored)`. The
id was restored and the command returned to `3 high (3 ignored)` and exit 0.

**Cost if wrong:** three high advisories are carried, documented, with a review
condition each. The failure mode is nobody reading the review column, which is
why both conditions are events — Prisma 8 stable, Tailwind 4 — and not dates
that pass unnoticed.

## 2026-10-08 - The decisions-log guard, with Superseded as a fourth opener

**Decision:** `guards/decisions-log.test.ts` checks that every `## ` entry in
this log carries one of four openers — `**Reason`, `**Why`, `**Result` or
`**Superseded` — and that a superseded entry names the date of the entry
replacing it, and that this log holds a heading with that date (founder
decision, 2026-10-08).

**Reason:** the log is 42 entries long, so "somebody will notice a missing
reason" had already stopped being true. The guard checks shape and never
content: it cannot tell a reason from a sentence that looks like one, and it is
not trying to. What it prevents is an entry landing with no reason at all,
which is what happens when a task is being finished in a hurry.

**Why four openers and not one.** Reason, Why and Result cover a decision, an
explanation and a measurement. Superseded covers the fourth kind of entry this
log holds: a pointer left so that a reader of an older commit finds the
correction. A pointer has no reason of its own, and a Reason line added to one
would be filler written to satisfy the guard.

**Why a superseded entry owes a date.** A pointer that points nowhere is worse
than no pointer. The guard reads every ISO date in the body other than the
entry's own, and fails if any of them has no matching heading, so a typo in the
date is caught and not only an absent one.

**One existing entry changed, and only its punctuation.**
`## 2026-10-05 - The real-data gate, three conditions (superseded)` already said
"Superseded by the 2026-10-06 entry below". That sentence now reads
`**Superseded by:**` in bold. No wording was altered and no history was
rewritten; the entry said the right thing in the wrong shape.

**The third test exists because the other two pass over an empty file.** A
heading-style change, or a move of this file, would silence both. It asserts at
least 40 entries, which 42 clears and no accident reaches.

**Probes, each reverted:** removing the bold from the one superseded opener
failed with `add one of **Reason, **Why, **Result, **Superseded to each of
these`, naming that heading; pointing it at `2027-01-01` failed with
`points at 2027-01-01, which has no heading in this log`.

**The guard failed on this very entry, in its first version, and that is why it
reads prose rather than raw text.** This entry quotes the four opener names and
quotes a probe output naming 2027-01-01. A raw scan of the body therefore read
it as a superseded entry pointing at a date with no heading. The guard now
strips fenced blocks and inline code spans before scanning, which is what the
rule always meant: an entry's own words explain it, and a quoted log, command or
opener name is evidence inside it. The same change stops an entry satisfying the
opener rule by quoting an opener, and stops a timestamp in pasted output being
read as a pointer.

**Cost if wrong:** a four-opener shape rule is a rule somebody satisfies with a
bold word and an empty sentence. The guard cannot catch that and does not claim
to; a reader still has to read.
