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
