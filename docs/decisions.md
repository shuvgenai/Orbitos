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

Superseded by the 2026-10-06 entry below, which states four. Kept because commit
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
