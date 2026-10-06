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
