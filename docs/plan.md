# Prompt 0 — Audit and plan

**Date:** 2026-11-05 · **Repo:** `shuvgenai/Orbitos`, working copy `C:\Projects\orbitos-web`
**Role:** staff frontend engineer joining the ORBIT-OS web project
**Status:** no application code written. This file is the whole deliverable.

Read in the order Prompt 0 sets: `CLAUDE.md`; the Build Prompts' shared spec;
`reference/orbit-os-frontend/README.md`; every file under `reference/orbit-os-frontend/assets`
and the three screens folders (36 files, 1,169 lines — all of it, not a sample). Then the
prototype was served with `python3 -m http.server 8080` and driven through Org Admin
onboarding from blank to launch, the User dashboard and the fleet console.

**On the evidence labels.** A claim marked **verified at runtime** was observed in the running
prototype on a clean office, with one UI action per step and no partial record passed to an
API that does a full-record write. A claim marked **from source** was read in the code and not
exercised. The distinction matters: a first pass at §4-B batched several actions into one
evaluation and produced results that looked like three defects but were partly artefacts of
the harness. Those claims were re-run individually on a fresh office before being written
down here, and the two that changed shape under a clean run say so.

Also read, because sections 4 and 6 depend on them: `ORBIT_OS_PRD_v9_0.md` §7, §15 and
Appendix A and C; `docs/auth-three-portals-build-prompt.md` (Prompt 1.5, D1–D6); `DESIGN.md`
and `design/tokens.css`; the root `package.json`, `tsconfig.json` and `pnpm-workspace.yaml`.

---

## 1. What the product is

An office hires AI teammates the way it hires people. An Org Admin walks a five-step setup —
who works here and who sits on the board, which AI teammates to hire and who each reports to,
who owns each one, which outside tools they may touch — and then launches, which is a visible
seven-step hiring job that can fail and resume rather than a spinner. After launch each person
sees only the teammates they own: what each is doing right now, what it cost today, and an
editor that changes its instructions from the next run while leaving the Org Admin's
guardrails untouched and unreadable-as-editable. Anyone can ask for a new teammate; the Org
Admin reviews that request, edits the instructions, adds guardrails and approves, which is the
only way a new teammate comes into being. A separate operator console lists every customer
office with counts and health, and is the one surface allowed to show runtime identifiers. The
whole thing is a trust instrument: every screen answers "what is it doing, why, what did it
cost, and who may stop it".

---

## 2. Reference screen and file → component, hook, schema

Conventions: screens live in `src/apps/<role>/screens`, shared presentational components in
`src/shared/ui`, data access in `src/shared/api` behind `ApiClient`, derived state in
`src/shared/hooks`, validation in `src/shared/lib`, Zod in `src/shared/schemas`. Every
component stays under 150 lines; where one reference file is over that, the table splits it.

### Shared infrastructure

| Reference file | React | Hook | Schema |
|---|---|---|---|
| `assets/config.js` | — | — | `config.ts` (not Zod: `BASE_GUARDS`, `SUGGEST_GUARDS`, `STORE_KEY`) |
| `assets/store.js` | — | — | `StoreState` — the one persisted document |
| `assets/api.js` | — | `useOffice`, `useAgents`, `useRequests`, `useConnections`, `useLaunch`, `useFleet` (TanStack Query) | every request/response schema |
| `assets/router.js` | `HashRouter` per app | `useRoute` | — |
| `assets/shell.js` | `AppShell`, `SideNav`, `TopBar`, `DevTools` | `useMe`, `useNavItems`, `useTicker` | `Session` |
| `assets/ui.js` | `Button` `Pill` `StatusPill` `Chip` `Field` `Select` `Textarea` `Table` `Drawer` `Modal` `Toast` `Tabs` `Stepper` `ProgressBar` `OrgTree` `EmptyState` `Banner` `ScreenState` | `useLayer` (focus trap, Escape) | — |
| `assets/ui.js` `esc/money/ago/initials` | — | — | `src/shared/lib/format.ts` |
| `assets/data/jobs.js` | — | — | `JobTemplate` → `seeds/jobs.ts` |
| `assets/data/mcps.js` | — | — | `Tool`, `ToolTier`, `ToolMode` → `seeds/tools.ts` |
| `assets/data/org.js` | — | — | `OrgTemplate`, `Office`; `seeds/fresh.ts`, `seeds/demo.ts` |
| `assets/data/people.js` | — | — | `Person`, `Access`, `Authority` → `seeds/people.ts` |
| `assets/data/fleet.js` | — | — | `FleetOffice`, `ProvisionStep` → `seeds/fleet.ts` |
| `assets/data/tasks.js` | — | — | `Receipt` → `seeds/receipts.ts` |
| `assets/tokens.css`, `base.css`, `components.css` | **not carried over** — FD-16, PRD §15.1. Tokens from `design/` | — | — |

`UI.kpi` has no component: PRD §15.2 bans KPI tiles. Every "tiles" row becomes `StatList`, a
plain list of label-and-number rows. No `Card`, no `Kpi` (§4-D4).

### Org Admin

| Reference screen | Route | React | Hook | Schema |
|---|---|---|---|---|
| `screens/onboarding.js` | `#/onboarding` | `OnboardingPage`, `WizardStepper`, `WizardFooter`, `LaunchStep`, `LaunchJobList` | `useWizardStep`, `useStepValidity`, `useLaunch` | `LaunchJob`, `LaunchStepStatus` |
| `screens/setup.js` §1 | `#/structure` | `StructureView`, `BusinessNameField`, `TemplateChips`, `DepartmentList`, `PeopleTable`, `PersonRow`, `AuthorityChips`, `OrgChart` | `useDepartments`, `usePeople` | `Department`, `Person` |
| `screens/setup.js` §2 | — | `AgentsView`, `AgentTree`, `TemplateList`, `AgentDrawer`, `AgentForm` | `useAgents`, `useManagerOptions` | `Agent`, `AgentDraft`, `AgentType`, `AgentStatus` |
| `screens/setup.js` §3 | — | `AssignView`, `AssignTable`, `AgentsPerPerson` | `useAssignment` | — |
| `screens/setup.js` §4 | `#/connections` | `ConnectionsView`, `ToolRow`, `ConnectModal`, `ConnectLaterToggle` | `useConnections`, `useRequiredTools` | `Connection`, `ToolMode` |
| `screens/setup.js` tabs | `#/agents` | `AgentsPage` (Tabs: Team, Assignments) | — | — |
| `screens/dashboard.js` | `#/dashboard` | `AdminDashboard`, `SetupChecklist`, `NeedsAttentionBanner`, `RequestsPreview`, `WorkingNowList` | `useOfficeSummary` | — |
| `screens/requests.js` | `#/requests` | `RequestsPage`, `RequestList`, `RequestRow`, `ReviewDrawer`, `GuardrailEditor`, `AuditList` | `useRequests`, `useDecision` | `AgentRequest`, `RequestStatus`, `Decision`, `AuditEntry` |
| `screens/requests.js` `openPromptEditor` | — | `PromptEditorDrawer` (admin: instructions + guardrails) | `useSavePrompt` | `AgentVersion` |
| `screens/map.js` | `#/map` | `AgentMapPage`, `PersonPicker`, `PersonBlock`, `AgentNode` — **conditional on Q2** | `useAgentsByOwner` | — |
| `screens/performance.js` | `#/performance` | `PerformancePage`, `PerformanceTable`, `Sparkline`, `TotalsRow`, `MetricFootnote` | `usePerformance`, `useSort` | `AgentPerf` |

### User

| Reference screen | Route | React | Hook | Schema |
|---|---|---|---|---|
| `screens/home.js` | `#/home` | `UserHome`, `StatList`, `AgentList`, `AgentRow`, `InstructionsDrawer`, `GuardrailsReadOnly`, `VersionHistory` | `useMyAgents`, `useSavePrompt`, `useTogglePause` | `Agent`, `AgentVersion` |
| `screens/new.js` | `#/new` | `RequestAgentPage`, `RequestForm`, `ToolChips`, `MyRequestsList` | `useSubmitRequest`, `useMyRequests` | `AgentRequest` (request form variant) |
| `screens/activity.js` | `#/activity` | `ActivityPage`, `ReceiptList`, `ReceiptRow` (expandable "Why") | `useMyReceipts` | `Receipt` |

### Super Admin

| Reference screen | Route | React | Hook | Schema |
|---|---|---|---|---|
| `screens/fleet.js` | `#/fleet` | `FleetPage`, `StatList`, `FleetTable` | `useFleetOffices` | `FleetOffice`, `FleetStatus`, `Health` |
| `screens/office.js` | `#/office/:id` | `OfficePage`, `RuntimeTable`, `SampleOfficeNote` | `useFleetOffice` | `AgentRuntime` |
| `screens/provision.js` | `#/provision` | `ProvisionPage`, `ProvisionForm`, `ProvisionProgress`, `ProvisionDone` | `useProvision` | `ProvisionInput`, `ProvisionJob` |

The two definitions confirmed in the founder's item 3 are already the prototype's own
footnote copy, verified at runtime in `performance.js`: "Success means the run finished
without an error or a rejected result. 'Edited by people' is the share of drafts a person
changed before approving." `MetricFootnote` carries it verbatim.

---

## 3. Folder tree

Chosen to match `CLAUDE.md`'s "Repo shape, as it stands", which states that Prompts 0–1 create
`vite.config.ts`, `dashboards/{user,org-admin,fleet}/` and `src/shared/{schemas,lib,seeds}`.
Nothing existing moves; see §4-D1 for why `src/` must be excluded from the root `tsconfig.json`.

```
orbitos-web/
├─ vite.config.ts                  three HTML entries, per-entry base path
├─ tailwind.config.ts              points AT the design/ CSS variables, restates no value
├─ tsconfig.web.json               DOM + jsx for src/ and dashboards/; root tsconfig excludes src
├─ postcss.config.js
├─ package.json                    gains React 19, Vite, Tailwind 3, TanStack Query, RHF, zod 4.6.5
├─ design/                         FROZEN. tokens.css, tokens.test.ts, DESIGN.md. Wired, never authored
├─ dashboards/
│  ├─ user/index.html              <title>OrbitCrew
│  ├─ org-admin/index.html         <title>OrbitCrew
│  └─ fleet/index.html             <title>ORBIT-OS   (§15.3 exemption)
├─ src/
│  ├─ apps/
│  │  ├─ user/        main.tsx  routes.tsx  nav.ts  screens/{home,new,activity}/
│  │  ├─ org-admin/   main.tsx  routes.tsx  nav.ts  screens/{dashboard,onboarding,requests,map,performance,structure,agents,connections}/
│  │  └─ fleet/       main.tsx  routes.tsx  nav.ts  screens/{fleet,office,provision}/
│  ├─ shared/
│  │  ├─ schemas/     index.ts  person.ts  department.ts  agent.ts  connection.ts  request.ts
│  │  │                office.ts  launch.ts  receipt.ts  audit.ts  fleet.ts  tool.ts
│  │  ├─ lib/         validate-org.ts  validate-agents.ts  validate-assign.ts
│  │  │                validate-connections.ts  removal-rules.ts  tree.ts  format.ts
│  │  │                + one .test.ts per file
│  │  ├─ api/         client.ts (the ApiClient interface)  mock/  keys.ts  hooks/
│  │  │                mock/{store.ts,office.ts,agents.ts,tools.ts,launch.ts,requests.ts,fleet.ts,ticker.ts}
│  │  │                supabase/   — planned, EMPTY until Prompt 1.5 (see §4-E2)
│  │  ├─ seeds/       jobs.ts  tools.ts  org-templates.ts  people.ts  fresh.ts  demo.ts  fleet.ts  receipts.ts
│  │  ├─ ui/          one file per component in §2, each with a .test.tsx
│  │  ├─ layout/      AppShell.tsx  SideNav.tsx  TopBar.tsx  MobileNav.tsx  DevTools.tsx
│  │  └─ hooks/       the hooks named in §2
│  └─ styles/         index.css   @import "../../design/tokens.css" + Tailwind layers
├─ reference/orbit-os-frontend/    READ-ONLY. 36 files. Never edited, never imported, never built
├─ docs/               plan.md (this file)  qa-report.md (Prompt 6)  api-contract.md openapi.yaml (Prompt 7)
├─ e2e/                Playwright specs
└─ (unchanged) shared/ db/ api/ web/ worker/ frontdesk/ ops/ archive/ scripts/
```

---

## 4. Where the spec and the reference disagree, or the spec is ambiguous

Precedence used throughout, from `CLAUDE.md`: **founder decisions → PRD v9.0 → Build Prompts →
reference prototype**, and the reference wins only on behaviour, copy and screen flow, never on
visuals (FD-16, PRD §15.1). Each item gives a recommendation. Eight of them need the founder,
and those are §6's questions.

### A. The PRD and the Build Prompts describe two different products

> **ANSWERED 2026-11-05.** The founder settled all of §4-A: **FD-18** (Appendix A is the seed
> source; the nine are retired), **FD-19** (no Agent map), **FD-20** (Phase 1 builds the
> fourteen screens). FD-20 is a **deviation from PRD §15.8** and is recorded as **`D-3`** in
> the infra repo's `governing/deviations.md`, in the founder's name and with the founder's
> reason — §15.8 itself says a finished-looking console is not working software, and fourteen
> working screens beat 52 shells of which 24 are "fill later". §15.8's inventory becomes the
> Phase-2 scope. The analysis below is kept as the record of how the collision was found; the
> 18 document edits it implies are in `docs/spec-errata.md`.

This is the largest finding in the audit and it is not a detail. `CLAUDE.md` says "Where the
PRD and the Build Prompts disagree, the PRD wins — then fix the prompt." Applied literally,
that rule invalidates most of Prompts 2–5.

**A1 — Screen inventory: 14 vs 52.** PRD §15.5–15.7 list 52 screens on routes that do not
exist in the prototype: `/tasks`, `/tasks/:id`, `/waiting`, `/waiting/:id`, `/new/summary`,
`/new/practice`, `/jobs`, `/jobs/:id`, `/authority`, `/rules`, `/spending`, `/results`,
`/privacy`, `/upgrades`, `/backups`, `/incidents`, `/quality` and more. §15.8 is explicit:
"The inventories above name 52 screens where the earlier plan was sized against the
prototype's fourteen. **No screen is cut.** Every one of the 52 ships as a shell in Stream A",
with 28 marked Fill now. The Build Prompts build the fourteen.

**A2 — The Agent map is deleted by name.** PRD §15.6 row 5 says the AI teammates list "carries
what the prototype drew as a separate Agent map; **there is no map screen** and no new feature
ID". §15.8 repeats it: "the agent map's curved connectors do not [survive §15.2]: §15.2
requires plain lists." Prompt 3 item 3 and Prompt 6's e2e both build and test `#/map`.

**A3 — The teammate roster.** PRD Appendix A.1 fixes **five** hireable roles — Finance Clerk,
Sales Analyst, Support Triager, HR Coordinator, Operations Reporter — plus **Orbi**, the
Coordinator, "always present, exactly one, never removable, **not hired**". It then says in
terms: "The prototype's nine (Atlas, Scout, Echo, Ledger, Compass, Beacon, Pulse, Quill,
Relay) are parked in `docs/backlog.md` and are not seeded." The shared spec says "Agent job
templates (9) … Copy the exact names, jobs, tools, budgets and prompts from
`assets/data/jobs.js`", and the prototype hires its Coordinator (Atlas) from a template and
allows removing it under a rule. Appendix A also forbids restating a fixed list anywhere else,
so a nine-template seed file is itself a violation.

**A4 — The connector catalog.** PRD Appendix A.2 fixes eight connectors (Email, Calendar,
Drive, Slack, HubSpot, Stripe, Notion, WhatsApp-unavailable) and says "**Not in the catalog:**
QuickBooks, Intercom, Salesforce … These appear in the prototype's seed data and are not
carried over." The shared spec's catalog of ten is the prototype's, QuickBooks included — and
QuickBooks is the tool two of the nine templates depend on, and the one the launch-paused path
was demonstrated with.

**A5 — Authorities: three vs four.** The shared spec types `Authority = 'leader' | 'approver' |
'budget'`. PRD §7.2 names four, and Appendix C item 3 says "**Backup approver is a named
authority again.**" The prototype renders exactly three chips, verified at runtime.

**A5b — "Seed only from Appendix A" reaches further than the roster and the catalog.**
Appendix C item 2 names six fixed lists, not two, and two of them change a type the fourteen
screens already use:

- **A.5, the three-number budget.** "1 Monthly budget, 2 Daily cap on cheap checks, 3 Turn
  limit", plus a daily call limit and a daily cost limit *per connector*. The shared spec and
  the prototype have `budget: number`, a single monthly figure, and it surfaces in the agent
  drawer, the template list, the approve path, the fleet table and `AgentPerf`. This is the
  one Appendix A item that rewrites a schema rather than a seed file, and it makes **Q8** moot.
- **A.3 task states (seven), A.4 risk categories (four), A.6 approval bases (three), A.7, A.8,
  A.9.** These describe a *task* and an *approval* — entities the fourteen screens do not
  model at all. The prototype's six `AgentStatus` values are not A.3's task states and do not
  collide with them; the lists simply have nowhere to live until the PRD's `/tasks` and
  `/waiting` screens exist. So they are not a rename, they are new entities, and they belong
  with the §4-A1 scope question rather than with the seeds.
- **Appendix C item 5** adds a build requirement regardless: "one test per fixed list in
  Appendix A that fails if the list changes without a matching PRD section reference." That is
  a new CI check, not a screen, and it is cheap to add in Prompt 1 next to the token test.

**A6 — Tree depth.** PRD §15.8 requires "exactly one Coordinator, one manager each, no loops
and a **maximum depth of three**". Neither the shared spec nor the prototype has a depth rule;
the prototype's tree is flat (every specialist reports to the Coordinator).

**A7 — Appendix C is the PRD's own instruction for exactly this collision**, and it is the
cleanest available reading: "Reproduce the prototype's behaviour, copy and screen flow. **Take
names, roles, tools and visuals from the PRD, never from the prototype.** Where prototype copy
names Atlas, a role or a tool not in Appendix A, substitute the PRD's name and change nothing
else in the sentence."

**Recommendation.** Follow Appendix C, which splits the difference the way the precedence rule
demands without discarding the prototype: build the prototype's fourteen screens, flows, gates,
copy and states exactly as Prompts 1–6 describe, but seed them from Appendix A — Orbi as the
unhireable Coordinator, five hireable roles, eight connectors, four authorities, the
three-number budget — and carry the PRD's extra rules (depth three) into the validators. Treat
the remaining 38 PRD screens, A.3/A.4/A.6's task and approval entities, and
§15.8's Stream A shell requirement as **out of scope for Prompts 1–7**, to be planned
separately, because nothing in the Build Prompts sizes them. Do **not** build `#/map`: fold it
into the AI teammates list per §15.6, which costs one screen and removes the one component
(curved SVG connectors) that §15.2 rules out anyway.

This is a founder call on scope, not an engineering one — **Q1, Q2, Q3**.

**What is actually blocked, and by which question.** Prompt 1 items 1, 2, 5, 7, 8 and 9 —
Vite's three entries, Tailwind wired to `design/`, the `ApiClient` interface, `MockApiClient`,
the UI kit, `AppShell` and the three route shells — depend on none of the questions below and
can start now. The three that are blocked are items 3 (schemas), 4 (seeds) and 6 (validators),
and the questions that block them are **Q1** (which roster, catalog and budget shape to seed),
**Q5** (whether `Authority` has three members or four) and **Q6** (whether the validators
enforce a depth limit). **Q2** and **Q3** are scope questions about which *screens* get built
in Prompts 3–6; neither changes a schema, a seed or a validator, so neither blocks Prompt 1 at
all. **Recommended order: start Prompt 1 on the six unblocked items; hold schemas, seeds and
validators for Q1, Q5 and Q6.**

### B. Defects found in the prototype, reproduced at runtime

These are not spec disagreements: the spec is right and the prototype is wrong. The rebuild
should implement the spec. Each was reproduced in the running prototype.

**B1 — An agent can be made its own manager, and it then vanishes from the org chart.**
`API.createAgent` checks `descendants(spec.id).includes(spec.managerId)`, and
`descendants(id)` does not include `id`. **Verified at runtime**, on the demo office, passing
the complete draft `draftFrom(agent)` would build and changing only `managerId` to the agent's
own id: `createAgent` returned `[]` — accepted, no refusal — and Quill's `managerId` became
its own id with every other field intact. Re-rendering the Agents screen then listed eight of
the nine agents in the tree: **Quill is still in the store and no longer on the chart**,
because `agentNodes` walks down from the Coordinator and a self-parented node is unreachable.
Any subtree under it would go with it. A real loop between two agents *is* refused
("That would create a loop in the org chart"), so this is the one-node case slipping through.
The shared spec is correct and stricter: "a manager cannot be the agent itself or one of its
descendants".
The guard exists only in the drawer's `mgrOpts` (`descendants(a.id).concat(a.id)`), i.e. in the
view. **Recommendation:** put it in `src/shared/lib/tree.ts` where Prompt 1 item 6 puts the
validators, add the self-manager case as its own unit test, and have the loop check run on
create as well as edit — the reference only runs it when `spec.id` is set.

**B2 — The update path silently nulls every field the caller omits.** `createAgent` does
create-and-update in one function and `Object.assign`s a full body built as
`{… deptId: spec.deptId||null, jobId: spec.jobId||null, …}`, so **any** field absent from the
spec is overwritten with its default — not just `jobId` but `deptId`, `tools`, `managerId` and
`budget`. **Verified at runtime:** editing Ledger's manager through `createAgent` without
re-passing `jobId` and `deptId` set both to `null`. That is not cosmetic — `jobId` is the key
`Tasks.make()` and `Tasks.feed()` use, so an agent that loses it has no "Right now" lines and
generates no receipts, and a null `deptId` changes who auto-assign gives it to (§4-C5). The
reference's own UI never hits this because `draftFrom(a)` re-passes every field, which is
exactly why a view-layer-only guard is the wrong place for it.
Prompt 1 item 5 already lists `create` and `update` as **separate** operations.
**Recommendation:** keep them separate, make `update` take a patch, and never let a partial
spec reach a full-record assignment.

**B3 — Why an agent is paused is stored in a display string, so a tool round-trip discards a
person's pause.** `connect()` only resumes an agent if `/to be connected/.test(a.doing)` — a
guard meant to protect a person's pause — but `disconnect()` overwrites `doing` first, so by
the time `connect()` runs there is nothing left to distinguish the two cases.
**Verified at runtime**, each step a separate action on the demo office: Marcus Reed paused
Relay (`status: paused`, `doing: "Paused by Marcus Reed"`); disconnecting Slack, which Relay
needs, rewrote it to `doing: "Waiting for Slack to be connected"` with `blockedBy: ["slack"]`;
reconnecting Slack then set Relay to **`idle`, "Ready. Wakes on the next task"**. The pause a
person applied is gone, and nothing in the UI ever said so. **Recommendation:** model the
reason as data
(`pausedBy: 'user' | 'tool' | 'budget'`) and resume only tool-paused agents. This also makes
Prompt 3's disconnect/reconnect acceptance test meaningful rather than accidentally true.

**B4 — "Needs attention" is two different rules.** `performance.js` flags
`success < 90 || edited >= 40`; `dashboard.js` flags `success < 90 || blockedBy.length`. The
shared spec gives only the performance rule, and Prompt 3 item 1 gives only the dashboard one.
Both are deliberate and both are right for their screen. **Recommendation:** one function,
`needsAttention(agent, { reason: 'performance' | 'readiness' })`, so the difference is visible
instead of duplicated.

**B5 — Prompt 3's acceptance test names the wrong agents.** It says "Relay and Quill are
flagged in the demo office". **Verified at runtime against `Seeds.demo()`:** the rule
`success < 90 || edited >= 40` flags **three** — Pulse (88% success), Quill (90% success but
44% edited) and Relay (86% success). The test fails only if written as an exact-set assertion;
written as a contains-check it passes while silently missing Pulse, which is the worse outcome
because the rule then has no test. **Recommendation:** fix the prompt to name all three and
assert the exact set.
The sibling test in Prompt 3 — approving Meeting Summarizer after adding one guardrail —
**passes exactly as written**, verified: owner Priya Nair, 4 guardrails, reports to the
Coordinator, `idle`, provisioned.

### C. Gaps in the shared spec's types and data

**C1 — Three entities the type list omits.** The spec types `Person`, `Department`, `Agent`,
`Connection`, `AgentRequest`, `Office`, `LaunchJob` — but the store also holds, and screens
render, an **activity receipt** (`{id, t, agentId, title, status: 'waiting'|'done', why, cost,
dur}`, `tasks.js`, the whole User Activity screen), an **audit entry** (`{at, who, what}`,
capped at 40 newest-first, the Org Admin "Recent changes" list) and a **fleet registry office**
(`{id, name, domain, status: 'live'|'onboarding'|'awaiting', agents, cost, version, health,
admin}`, `fleet.js`, the entire fleet table). The spec's `Office` type is the *customer's* own
office and is not the fleet row. **Recommendation:** add `Receipt`, `AuditEntry` and
`FleetOffice` to `src/shared/schemas`; §2 and §3 already allocate them.

**C2 — The tool catalog has three tiers, not two.** The shared spec says eight tools are
selectable and Intercom and Salesforce show "Coming soon". `mcps.js` actually carries
`tier: 'ready' | 'early' | 'soon'` and a label map — Gmail, Slack and HubSpot are
"Available", five are "**Early access**", two are "Coming soon". The spec's selectable/disabled
split is right; the middle tier is simply missing from it. **Recommendation:** keep all three
tiers as data and render the pill, since only `soon` affects behaviour (the chips are
`disabled`, verified at runtime on both the admin drawer and the user request form).

**C3 — Job templates carry a department *name*, and one undocumented field.** `jobs.js` has
`dept: 'Sales'` (a name, resolved to an id by the seeds) while the `Agent` type has
`deptId: string|null`; and every template has a `sample: string[]` the spec never mentions,
which is the source of every "Right now" line and every receipt title. The Coordinator's
`dept` is `null` and the seed places it in Operations. **Recommendation:** keep `JobTemplate`
and `Agent` as separate schemas — a template is not an agent — with `deptName` on the template
and the resolution in the seed builder, and add `sample` to `JobTemplate`.

**C4 — Step gates and create-time validation are two different things.** The spec lists eight
"Agents valid when" rules as one bullet. In the reference, `validateAgents()` (the step 2 gate)
checks only two — one Coordinator exists, one specialist exists — and the other six are
enforced per-agent inside `createAgent`. Both behaviours are correct and the UI depends on the
split: a half-filled drawer must not block the wizard. **Recommendation:** two exported
functions, `validateAgentsStep(state)` and `validateAgentDraft(draft, state)`, and have
Prompt 1 item 6's test suite cover both; the spec bullet maps to the second.

**C5 — Auto-assign has a longer fallback chain than Prompt 2 describes.** Prompt 2 says
specialists go "to an Approver in their department, else anyone in it". The reference then
falls back twice more: any user in the office, then the first person.
**Verified at runtime** on a fresh office — Services template, Maria in Operations, David in
Sales, Atlas and Ledger hired from their templates with complete drafts: Ledger sat in
**Finance**, Finance contained **nobody**, and `autoAssign()` still gave Ledger to **David
Park** through the third level, leaving `validateAssign()` empty so step 3's gate passed.
Without those last two levels the gate cannot be satisfied in any office that has a department
with no people in it — which the Services template produces by default.
**Recommendation:** implement all four levels and say so in the prompt.

**C6 — Approved requests get a hardcoded $15 budget.** `decide()` sets `budget: 15` with no
spec support; the shared spec lists owner, manager, department, guardrails and provisioned,
and says nothing about budget. **Recommendation:** keep 15 as a named constant
`DEFAULT_REQUEST_BUDGET` in `config.ts` so it is visible rather than buried, and flag it for
the founder as a product default, not a finding.

**C7 — The Activity feed is generated once at launch and never grows.** `Tasks.feed()` runs in
`finish()` and in `Seeds.demo()`; the 7-second ticker bumps `runsToday`, `costToday` and
`status` but writes no receipt. So a run counter climbs while the receipts list stays still.
**Recommendation:** have the mock ticker append a receipt when it sets an agent `running`.
It is a two-line change, it makes the User Activity screen honest, and Prompt 7 replaces the
ticker with SSE anyway.

**C9 — PRD §15.4's six screen states have no prototype counterpart, so "match the reference"
cannot supply them.** §15.4 requires every list and detail screen to implement **empty,
loading, error, office paused, not yours, expired-or-already-decided**, each with a prescribed
copy pattern — skeleton rows rather than a spinner, never an error code on a customer screen,
a banner on every screen when the office is paused. The prototype has rich *empty* states and
essentially none of the other five: it is synchronous against `localStorage`, so it has no
loading state at all, no error path, no paused-office concept and no not-yours case. `CLAUDE.md`
and the shared spec both already ask for "the six §15.4 states as one component", so the
requirement is not in dispute — but it is the one part of every screen that must be designed
rather than copied, and §2 allocates `ScreenState` for it. **Recommendation:** build
`ScreenState` in Prompt 1 item 7 with all six variants and a test per variant, and have each
screen render through it from the start; retrofitting six states across fourteen screens in
Prompt 6 is how they end up inconsistent. Note that "office paused" has no data behind it in
the mock — PRD A-30 owns it — so the variant ships with the state wired and the trigger absent.

**C10 — Prompt 7 contradicts founder item 1, and is already superseded.** Prompt 7 says to
build `HttpApiClient`, select with `VITE_API_MODE=mock|http`, and "Do not add a backend, a
database or Supabase." Founder item 1 and Prompt 1.5 both say the backend is no longer
hypothetical: FD-2 chose self-hosted Supabase and Prompt 1.5 specifies `SupabaseApiClient`
behind the same interface with `VITE_API_MODE=mock|supabase`. **Resolved, not a question:**
Prompt 1.5 is dated later and the founder restated it, so `supabase` is the second mode and
`http` is not built. Recorded here because Prompt 7 still reads the other way and a later
session will hit it. The interface is designed for both regardless (§5-R7), so nothing is lost
if an HTTP mode is wanted later.

**C8 — `org.js` vs `people.js`: reported, deliberately not resolved.** The Build Prompts name
`assets/data/org.js` as the source of the demo office's five people. **`org.js` contains no
person records at all** — it builds them by iterating `window.People` from `people.js`, which
the copy-from list does not mention. The literal strings "Maria Santos" and "Jordan Lee" do
appear in `org.js`, but only as an audit author and inside the paused-agent copy "Paused by
Jordan Lee"; David Park, Priya Nair and Marcus Reed appear nowhere in it. FD-17 and `CLAUDE.md`
both instruct Prompt 0 to **report this and not pick a file**, so no recommendation is given
and no value was invented. The five names and their fields are unambiguous in `people.js`;
the open question is which file the spec means. **Q4.**

### D. Build and toolchain

**D1 — The root `tsconfig.json` cannot type-check the dashboards, and will try to.** It is a
Node config — `lib: ["es2024"]`, `module: "nodenext"`, `types: ["node"]`, no `dom`, no `jsx` —
with `include: ["**/*.ts"]`. That glob picks up `src/shared/**/*.ts`, and `MockApiClient`
touches `localStorage`, so `pnpm typecheck` would fail on code that is correct.
**Recommendation:** add `src` and `dashboards` to the root config's `exclude`, add
`tsconfig.web.json` with `lib: ["es2024","dom","dom.iterable"]` and `jsx: "react-jsx"`, and run
both in CI. Nothing existing changes.

**D2 — `shared/` is already taken.** `shared/` is the `@orbit/shared` workspace package (Gmail
port, mailer, approvals, `zod 4.6.5`) consumed by `@orbit/web`. The Build Prompts' `src/shared`
is a different thing with the same name. **Recommendation:** keep them separate exactly as
`CLAUDE.md` describes — dashboards under root `src/`, `@orbit/shared` untouched and not
imported by the browser code — and pin the dashboards to the same `zod 4.6.5` so one Zod major
is in the tree.

**D3 — The prompts say `npm`, the repo is pnpm.** `package.json` pins
`packageManager: pnpm@10.33.0`, `engines.node >= 24.11`, `.nvmrc` 24.14.1, `save-exact=true`.
Prompt 1's acceptance says `npm run dev`. **Recommendation:** pnpm throughout; read the
acceptance criterion as "the dev server serves all three entries". Also note TypeScript is
pinned at 7.0.2 and Vitest at 5.0.3 — the dashboards use the versions already in the tree
rather than introducing a second toolchain.

**D4 — Prompt 1 asks for shadcn/ui, which ships a `Card`.** `CLAUDE.md` and PRD §15.2 say
build no `Card` and no `Kpi`. **Recommendation:** install only the primitives actually listed
in §2 (dialog, select, tabs, toast under the hood) and never add `card.tsx`; add a CI grep that
fails on `Card` or `Kpi` in `src/`, next to the forbidden-words check Prompt 6 asks for.

**D5 — The prototype has no favicon.** The only console error in the whole walkthrough was
`GET /favicon.ico 404`. **Recommendation:** three entries need a favicon and a
`site.webmanifest`; trivial, but it is the one runtime error and it should not survive into the
build.

### E. Hosting, and what a move to subdomains would cost

**E1 — Two path schemes have to coexist.** The Build Prompts deploy `/user/`, `/org-admin/`
and `/fleet/`. Prompt 1.5 fixes the login paths at `/login`, `/org/login` and `/admin/login`,
and the founder's item 4 keeps both: one domain, three entries deployed together.
**Recommendation:** three Vite entries, each built to its own directory, and one deploy
rewrite map — the only file that knows about public paths:

| Public path | Serves | Hash route on arrival |
|---|---|---|
| `/login` | `dashboards/user/index.html` | `#/login` |
| `/user/` | same file | `#/home` |
| `/org/login` | `dashboards/org-admin/index.html` | `#/login` |
| `/org-admin/` | same file | `#/dashboard` or `#/onboarding` |
| `/admin/login` | `dashboards/fleet/index.html` | `#/login` |
| `/fleet/` | same file | `#/fleet` |

Because routing is hash-based, each entry needs exactly one real file and no SPA fallback;
the login screen is a hash route inside its own entry, so `/admin/login` can refuse a signed-in
User without any server logic. Keep every cross-dashboard link (today
`CFG.ROLES[k].dir`) in one `entries.ts` module so no screen contains a public path.

**One constraint this forces: each entry needs an absolute Vite `base`, not a relative one.**
The same `index.html` is served at two different depths — `/user/` and `/login` — so a
relative `base: './'` resolves the asset URLs against whichever path the browser arrived on
and 404s at `/login`. Each entry gets an explicit absolute base (`/user/`, `/org-admin/`,
`/fleet/`) and the login paths are rewrites onto those files, so assets always resolve from
one place regardless of the URL the user typed.

**E2 — If the three entries move to subdomains, this is what changes — and one thing breaks.**

- **The deploy rewrite map, and each entry's Vite `base` becomes `/`.** Mechanical, and it is
  one line per entry — but it is a build-time value, so a move means a rebuild, not just a
  DNS and proxy change. Worth knowing before it is promised as a config switch.
- **`entries.ts`.** The only module with a cross-entry URL in it. One file, by design.
- **`MockApiClient` stops working across dashboards, and no screen change can fix it.** It
  keeps one `localStorage` key on one origin and syncs tabs with the `storage` event. Both are
  **origin-scoped**. `app.orbitumai.com/user/` and `app.orbitumai.com/org-admin/` share
  storage today — which is exactly how the demo flow works, and how Prompt 4's acceptance test
  ("the Org Admin's Requests badge increases by one in another tab") can pass at all. On
  `user.orbitumai.com` and `admin.orbitumai.com` they would be three separate stores that
  never see each other. The dev-tools cross-links, "Load demo office" and every two-tab
  acceptance test in Prompts 1, 4 and 6 would silently stop demonstrating anything.
  **This is a reason to stay on one domain until a real backend lands**, after which it stops
  mattering: `SupabaseApiClient` reads one database and the point is moot.
- **The session.** Prompt 1.5's Supabase session would need a cookie scoped to the parent
  domain, or three separate sign-ins. That is an auth decision, not a screen decision.
- **What does *not* change:** any screen, any component, any hook, any schema. That is the
  founder's stated requirement and the structure above meets it.

**E3 — Enterprise will need SAML.** Recorded here because Prompt 1.5 asks Prompt 0 to record
it. The MVP is password plus email confirmation only; magic links, SSO and 2FA are deliberately
out, and Eng Review ENG2's magic links are a different flow and stay separate.

### F. Naming

**F1 — Every prototype title carries the forbidden word, on purpose.** `shell.js` sets
`document.title = title + ' · ' + CFG.APP` with `CFG.APP = 'ORBIT-OS'`. **Verified at
runtime:** the User home title is `My agents · ORBIT-OS` and the sidebar brand reads
`ORBIT-OS / by OrbitumAI`. PRD §15.3 is explicit that this rule does **not** apply to
`reference/`, and nobody ships it. **Recommendation:** the three `dashboards/` entry titles
are fixed per §15.3; the shell's title pattern becomes `<screen> · OrbitCrew` on the customer
entries and `<screen> · ORBIT-OS` on fleet, driven by one per-app constant, never a literal in
a screen.

**F2 — Customer-surface copy names ORBIT and tokens.** Step 4's banner reads "Tools connect
through ORBIT's policy gateway. ORBIT keeps the sign-in tokens, so agents never see your
passwords" — and Prompt 2 instructs us to reproduce that sentence verbatim. PRD §15.3 bans
"ORBIT-OS" and "token" from customer screens. Appendix C resolves it: substitute the PRD's name
and change nothing else in the sentence. **Recommendation:** "Tools connect through
OrbitCrew's policy gateway. OrbitCrew keeps the sign-in details, so your teammates never see
your passwords." Same shape, same promise, no banned word. The README's step-4 heading
"Connect tools (MCP)" becomes "Connections", which is already what the wizard renders.

**F3 — The runtime fields put `paperclip` and `hermes` in all three bundles, and schema
isolation alone will not fix it.** The `Agent` type carries
`runtime?: { paperclipId, hermesProfile, adapter }`, while Prompt 5's acceptance test requires
that "Searching the User and Org Admin bundles for the words Paperclip, Hermes and adapter
finds none". Two separate leaks:

1. **The schema.** A Zod object in `src/shared/schemas/agent.ts` keeps its key names at
   runtime, so `paperclipId` and `hermesProfile` survive as string literals in every bundle
   that imports it; tree-shaking cannot remove an object key.
2. **The mock, which is the harder one.** `MockApiClient` has to *generate* those values —
   the reference does it in `provision()` and `finish()` with the literals `'agt_'`,
   the profile-name template and `adapter: 'hermes_gateway'`. The mock ships in all three
   bundles by definition, so moving the schema into `fleet.ts` leaves the literals behind in
   the client.

**Recommendation:** do both — put `AgentRuntime` in `src/shared/schemas/fleet.ts` so only the
fleet app imports it, *and* keep runtime-id generation in a `mock/runtime.ts` module that only
the fleet app's mock wiring pulls in, with the customer apps getting an `Agent` schema that
omits the block. Then let Prompt 6's bundle grep prove it rather than assuming it.

**On renaming.** I earlier wrote that these field names "must not be renamed under
`CLAUDE.md`'s identifier rule". That is the wrong citation and I am correcting it: the infra
rule protects *upstream* identifiers — package names, environment variables, database objects,
HTTP routes, import paths and adapter registry keys — whereas `paperclipId` and
`hermesProfile` are field names in **our own** spec type. The rule that actually applies points
the other way: "OrbitCrew code never uses an upstream name as an identifier. Write
`OrchestratorClient`, never `PaperclipClient`." So renaming the fields to
`runtimeAgentId`, `runtimeProfile` and `adapterKey` is not merely allowed, it is what that rule
asks for, and it removes leak 1 outright. The *values* must not change. **This is worth
raising with whoever owns the shared spec; it is not a Prompt 0 question** because it changes
no behaviour either way.

One related discrepancy, for whoever owns that field: the prototype's adapter string is
`hermes_gateway`, while the infra repo documents the real adapter registry key as
**`hermes_local`** and records it appearing 35 times in the running build. The prototype's
value looks like invented display text rather than the key, so the fleet console would be
showing an adapter name that does not exist.

**F4 — `DESIGN.md` and `design/tokens.css` write "Orbitcrew".** FD-5 says `OrbitCrew`, and
calls the lowercase form a defect. But `design/` is frozen, `design/tokens.test.ts` asserts
`DESIGN.md` and `tokens.css` agree, and the two occurrences are a prose heading and a CSS
comment — not UI copy. **Recommendation:** leave `design/` alone and write **OrbitCrew**
everywhere in the app. Do not "fix" a frozen package for a comment; raise it separately if the
founder wants the docs corrected.

**F5 — Minor drift, no action.** The web `CLAUDE.md` calls the infra repo
`shuvgenai/orbitos-infra`; FD-6 calls this repo `shuvgenai/Orbitos` and the infra half
`C:\Projects\OrbitOS`. Noted so a later session does not go looking for a third repo.

---

## 5. Risks, and how each is handled

**R1 — Focus loss and re-render from the live ticker.** The highest-value thing the prototype
already gets right: `Store.subscribe` drops any `'tick'` update when `UI.isOpen() ||
typing()`, and `typing()` checks `document.activeElement` against `INPUT|TEXTAREA|SELECT`
inside `#app`. In React the equivalent is not a render guard but a *data* guard, because React
will reconcile anyway. **Handling:** the ticker lives in `MockApiClient`, not in a component;
it writes to the query cache through TanStack Query, and a `useTickerGate` hook suspends cache
writes (not renders) while a Drawer or Modal is open or a field has focus, releasing them on
close. Uncontrolled inputs plus commit-on-blur (which is also what Prompt 2 asks for) means a
stray re-render cannot discard a half-typed value. Tested by typing into the instructions
editor, forcing ten ticks, and asserting both the caret position and the value.

**R2 — Cross-tab sync is origin-scoped and load-bearing.** Three acceptance tests across
Prompts 1, 4 and 6 depend on two tabs seeing each other. `storage` events do not fire in the
tab that wrote, do not cross origins, and fire for the whole key. **Handling:** one key, one
writer, a `BroadcastChannel` with a `storage`-event fallback, and a version field on the
document so a tab on stale state reloads rather than merges. See §4-E2 — this is the concrete
thing a subdomain move would break.

**R3 — Accessibility, with measurements rather than intentions.** Measured in the running
prototype at 375 px: **15 of 26 interactive targets are under 44 px**, body text computes to
**14 px**, and the focus ring is 2 px. All three fail PRD §15.2 and `DESIGN.md` UX-7 (44 px
targets, 16 px body, 3 px ring). This is expected — the prototype is not the visual spec — but
it means **no prototype CSS may be copied, not even for spacing**, or the rebuild inherits
three failures on day one. **Handling:** `Button` enforces a 44 px minimum (48 px for Approve)
in the component, not per use; body size and focus ring come from `design/tokens.css`; axe runs
on every route in all three apps per Prompt 6; the token test already guards contrast.

**R4 — Drawer and Modal focus management.** The prototype opens a layer, focuses the first
field and closes on Escape and scrim click, but it does not trap focus or restore it on close,
and it re-renders the whole drawer on every guardrail edit. **Handling:** one `Layer`
primitive owning trap, restore, Escape, `aria-modal` and scroll lock; guardrail edits update
state, not innerHTML. Keyboard tests per Prompt 1 item 7.

**R5 — The mock's state machine is the real risk to correctness, not the UI.** Launch is
resumable, tools pause and resume agents, versions accrete, and §4-B1 to B3 are all
state-machine bugs that no screen test would have caught. **Handling:** every validator and
every state transition is a pure function in `src/shared/lib` with unit tests, including the
self-manager case, the second-coordinator refusal, the four removal rules, resume-only-if-
tool-paused, and retry-resumes-from-the-failed-step. The screens get the thin tests.

**R6 — `reference/` must stay read-only, and tooling wants to touch it.** It has no
`package.json`, is not in `pnpm-workspace.yaml`, and the root `tsconfig` includes only
`**/*.ts`, so nothing builds it today. **Handling:** add it to `.eslintignore`, to
`vite.config.ts`'s ignore list and to the root `tsconfig`'s `exclude` explicitly rather than
by accident; keep Playwright output in `.playwright-mcp/` (already git-ignored) and never
inside `reference/`. Nothing in this audit wrote to it.

**R7 — Prompt 1.5 lands between Prompt 1 and Prompt 2.** It adds a login screen, a
`SessionProvider`, `RequireAccess` and `VITE_API_MODE=mock|supabase`, and the founder's item 1
confirms `SupabaseApiClient` is a planned deliverable rather than a maybe. **Handling:** the
`ApiClient` interface is designed now for both implementations — every operation async, every
response Zod-parsed, errors as a typed union, no localStorage or ticker concept in the
interface — and identity comes from a `Session` the mock can fake and Supabase can supply.
`src/shared/api/supabase/` exists as an empty folder in Prompt 1 so nobody has to move files
later. Only `MockApiClient` is built in Prompt 1, as item 1 instructs.

**R8 — Bundle size against three entries.** Prompt 6 caps each dashboard at 200 KB gzipped,
and React 19 plus TanStack Query plus RHF plus Zod is most of that before a screen exists.
**Handling:** route-level lazy imports inside each app from the start rather than as a Prompt 6
retrofit, one shared vendor chunk, seeds imported per app (the fleet app does not need
`jobs.ts`), and sizes reported in `docs/qa-report.md`.

---

## 6. Questions — eight, most important first

> **ALL EIGHT ANSWERED 2026-11-05**, as FD-18 to FD-25 in the infra repo's
> `governing/founder-decisions.md`. Q1→FD-18, Q2→FD-19, Q3→FD-20 (+ deviation `D-3`),
> Q4→FD-21, Q5→FD-22, Q6→FD-23, Q7→FD-24, Q8→FD-25. Two things remain **PROPOSED** and
> awaiting the founder: FD-25's three budget numbers, and the Finance Clerk's and HR
> Coordinator's copy, which have no counterpart in the prototype (FD-18). The questions are
> kept below as written, for the record of what was asked.

**Q1, Q5 and Q6 block Prompt 1 items 3, 4 and 6** — schemas, seeds and validators — because
each one changes a type, a seed file or a rule. **Q2 and Q3 block nothing in Prompt 1**; they
decide which screens Prompts 3–6 build, and the answer is not needed until Prompt 3. Q4 is the
gap FD-17 tells me to report rather than resolve. Q7 and Q8 are small and I have a
recommendation for each; say nothing and I will take the recommendation.

**Q1. Seed data: Appendix A or the prototype's nine?** PRD Appendix A.1 fixes five hireable
roles — Finance Clerk, Sales Analyst, Support Triager, HR Coordinator, Operations Reporter —
plus **Orbi** as an unhireable, unremovable Coordinator, and says the prototype's nine "are
parked in `docs/backlog.md` and are not seeded". Appendix A.2 fixes eight connectors and
excludes QuickBooks, Intercom and Salesforce by name. Appendix C item 2 extends this to
**A.5's three-number budget**, which replaces `budget: number` wherever it appears. The Build
Prompts say to copy the nine, the ten and the single budget verbatim. Appendix C says take
names, roles and tools from the PRD and keep the prototype's sentences otherwise — which I
recommend.

Say yes and the following all change, so it is worth seeing the size before you answer:
**all nine** prototype roles go, not just the QuickBooks pair, so Atlas becomes Orbi and
Scout, Echo, Ledger, Compass, Beacon, Pulse, Quill and Relay cease to exist as seeds; the
BrightPath demo office is rebuilt with five PRD roles; `Agent.budget` becomes three fields
reaching the agent drawer, the template list, the approve path and the fleet table; and
**eleven named checks stop matching** — Prompt 2's "hire Atlas, Scout, Ledger", Prompt 3's
"Relay and Quill are flagged" and its Meeting Summarizer assertion, Prompt 4's Scout edit,
Prompt 5's two office assertions, and steps 2, 3 and 5 of the §"Verification script", which
name Atlas, Scout and Ledger directly. None is hard to rewrite; all of them have to be.
Which do you want seeded?

**Q2. Is there an Agent map?** PRD §15.6 says the AI teammates list carries what the prototype
drew as a map, that there is no map screen, and that §15.2's plain-list rule rules out the
curved connectors; Prompt 3 item 3 and Prompt 6's e2e both build and test it. I recommend
dropping `#/map` and folding it into the teammates list. Confirm, or keep the map?

**Q3. Do Prompts 1–7 stay scoped to the prototype's fourteen screens?** PRD §15.8 says the
inventories name 52 screens, "no screen is cut", every one ships as a shell in Stream A, and 28
are Fill now. The Build Prompts build fourteen and size nothing beyond them. I recommend
treating the other 38 as a separate planning exercise after Prompt 6 rather than quietly
widening these prompts. Confirm?

**Q4. Which file does the spec mean for the demo office's five people — `org.js` or
`people.js`?** FD-17 and `CLAUDE.md` tell me to report this and not pick, so I am asking rather
than deciding. `org.js` holds no person records at all; it iterates `window.People` from
`people.js`. All five names and their departments, access levels and authorities are
unambiguous in `people.js`. The question is only which file the copy-from list should say.

**Q5. Four authorities or three?** PRD §7.2 and Appendix C item 3 name Leader, Approver,
**Backup approver** and Budget holder, and say Backup approver is a named authority again. The
shared spec types three and the prototype renders three chips. Backup approver also carries
behaviour — it receives a request after the escalation interval — which has no home in the
fourteen screens. I recommend adding it to the `Authority` enum and the People table now, and
leaving the escalation behaviour unbuilt. Confirm?

**Q6. Maximum tree depth three — enforce it now?** PRD §15.8 requires one Coordinator, one
manager each, no loops **and a maximum depth of three**. Neither the shared spec nor the
prototype has a depth rule, and the prototype's tree is flat so no seed violates it. I
recommend adding it to the validator now with its own unit test and its own refusal message,
since adding a tree rule after Prompts 2–5 ship means revisiting every tree screen. Confirm?

**Q7. Should the mock ticker write activity receipts?** Today receipts are generated once at
launch and never again, so a user watches their run count climb while the Activity screen
stays frozen. I recommend having the ticker append a receipt whenever it sets an agent
`running`. It is a small change to `MockApiClient` only, and Prompt 7 replaces the ticker with
SSE regardless — but it is me adding behaviour the spec does not ask for, so I would rather
ask.

**Q8. Is $15 the intended default monthly budget for an approved request?** `decide()` hardcodes
it with no spec support, so every teammate created through the request path starts at $15
regardless of its tools, while hired templates range from $10 to $40. I recommend keeping 15 as
a named constant and flagging it here. Confirm, or set a different default? **Note this
question disappears if Q1 is answered "Appendix A"** — A.5 replaces the single monthly figure
with three numbers, and the default then has to be three values rather than one.

---

## Stopping here

No application code was written. `reference/` was not modified — verified: `git status` shows
no change under it. The prototype was served on port 8080 for the walkthrough and the server
has been stopped. Nothing is committed.

Waiting on **Q1, Q5 and Q6** before Prompt 1 items 3, 4 and 6 (schemas, seeds, validators).
Items 1, 2, 5, 7, 8 and 9 — Vite three entries, Tailwind wired to `design/`, the `ApiClient`
interface and `MockApiClient`, the UI kit, `AppShell` and the three route shells — depend on no
answer above and can start on your word. **Q2 and Q3** are not needed until Prompt 3.
