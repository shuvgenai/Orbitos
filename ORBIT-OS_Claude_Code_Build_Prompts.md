# ORBIT-OS: Claude Code Build Prompts (User, Org Admin, Super Admin)

**For:** Shuv Chowdhury (Ai), OrbitumAI
**Goal:** Turn the working prototype into the real React + TypeScript frontend, one phase at a time.
**Scope:** Frontend only. Mock data behind a typed API client. No backend.

---

## Executive summary

You have a working vanilla-JS prototype of three dashboards (zip: `orbit-os-frontend.zip`). Claude Code will rebuild it in React with proper types, tests and accessibility. Because the prototype is the spec, the prompts below point Claude Code at it and add what a prototype cannot say: data types, validation rules, and acceptance tests.

**Outcome after 7 phases:** three separately deployable dashboards (`/user/`, `/org-admin/`, `/fleet/`) that behave exactly like the prototype, with tests, and an API contract ready for your backend.

## Setup checklist (10 minutes)

- [ ] Create an empty GitHub repo `orbit-os-web` and clone it.
- [ ] Unzip `orbit-os-frontend.zip` into `reference/` so you have `reference/orbit-os-frontend/README.md`.
- [ ] Put `CLAUDE.md` in the repo root.
- [ ] Put this file in the repo root.
- [ ] Open a terminal in the repo and start Claude Code (`claude`).
- [ ] Start with **Prompt 0**, then one phase at a time. After each phase, read the summary and run the test script before moving on.

## Roadmap

| Phase | Builds | You verify |
|---|---|---|
| 0 | Audit and plan (no code) | You approve the plan |
| 1 | Foundation: project, design system, API client, shell, dev tools | Three empty dashboards load with navigation |
| 2 | Org Admin onboarding wizard (5 steps) | Full setup from blank to launched |
| 3 | Org Admin daily screens | Requests, map, performance, agents, connections |
| 4 | User dashboard | Running count, edit instructions, request an agent |
| 5 | Super Admin dashboard | Offices, office detail, provision |
| 6 | Tests, accessibility, polish | All checks green |
| 7 | Backend readiness | API contract and schemas ready to hand to a backend |

---

## The shared spec (referenced by every phase)

Claude Code reads this section from the repo. Do not paste it into each prompt.

### Vocabulary
- **Office:** one customer workspace. **Agent:** an AI teammate. **Owner:** the person responsible for an agent. **Board:** the people with the Leader authority.
- **Statuses:** agent = `draft | running | waiting | idle | paused | blocked`; request = `pending | approved | changes | rejected`.

### Types (put in `src/shared/schemas`, infer from Zod)
```ts
type Access = 'user' | 'admin';
type Authority = 'leader' | 'approver' | 'budget';
type Person = { id; name; email; title; deptId: string|null; access: Access; authorities: Authority[]; invited?: boolean };
type Department = { id; name };
type Agent = {
  id; jobId: string|null; name; job; type: 'coordinator'|'specialist';
  deptId: string|null; managerId: string|null; ownerId: string|null;
  status: AgentStatus; doing: string; prompt: string; version: number;
  versions: { v: number; prompt: string; at: number; by: string }[];
  guardrails: string[]; tools: string[]; budget: number;       // USD per month
  runsToday: number; costToday: number; lastActive: number;
  provisioned: boolean; blockedBy?: string[];
  runtime?: { paperclipId: string; hermesProfile: string; adapter: string }; // operator-only
  perf: { daily: number[7]; success: number; avgSec: number; edited: number; cost7: number };
};
type Connection = { on: boolean; mode: 'read'|'draft'|'act'; at: number; by: string };
type AgentRequest = { id; by: string /*personId*/; name; purpose; prompt; tools: string[]; reason;
  status: RequestStatus; adminNote: string; at: number };
type Office = { name; domain; template: string|null; step: 1|2|3|4|5; launched: boolean;
  connectLater: boolean; guardrails: string[]; job: LaunchJob|null };
type LaunchJob = { steps: { k; label; status: 'pending'|'run'|'done'|'fail' }[]; simFail: boolean; failedOnce: boolean; error: string; done: boolean };
```

### Validation rules (pure functions in `src/shared/lib`, unit tested)
**Org structure valid when:** at least 1 department; at least 1 person with `leader`; at least 1 `admin`; every person has a name, a valid unique email and a department.
**Agents valid when:** exactly 1 coordinator; at least 1 specialist; names unique (case-insensitive); each specialist has a manager; no loops (a manager cannot be the agent itself or one of its descendants); prompt at least 20 characters; budget above 0; a second coordinator is refused.
**Assignment valid when:** every agent has an owner who exists.
**Connections valid when:** every tool used by any agent is connected, OR `connectLater` is on (then agents missing a tool launch `paused` with `blockedBy`, and resume automatically when the tool is connected).
**Removal rules:** cannot remove a department that has people or agents; cannot remove a person who owns agents; cannot remove an agent others report to; cannot remove the Coordinator while other agents exist.
**Prompt edits:** at least 20 characters; saving a changed prompt creates a new version (`v+1`) with author and time; restoring an old version loads it into the editor and requires Save.

### Org Admin onboarding (5 steps, each gated by its rule)
1 Org structure, 2 Agents, 3 Assign, 4 Connections, 5 Launch. "Continue" is disabled until the step is valid and shows the list of what is missing. Later steps are locked until earlier ones are valid. The current step persists. After launch the "Set up your office" nav item disappears and Structure, Agents and Connections become normal pages.
**Launch** is a resumable job with 7 steps in this order: Set up your office, Build the org chart, Hire your agents, Give each agent its own workspace, Set budgets, Apply tool permissions, Invite your people. Each takes about 600 ms in the mock. A dev option fails the "workspace" step once; the UI shows an error and **Retry from this step**. On finish: all agents `provisioned`, runtime ids assigned, agents missing a tool are `paused`, non-admin people marked `invited`.

### Starter data (seed files)
- **Org templates:** Professional services (Sales, Operations, Finance), Agency (Clients, Creative, Finance), Retail and e-commerce (Sales, Support, Operations), Start blank.
- **Agent job templates (9):** Atlas (Coordinator), Scout, Echo, Ledger, Compass, Beacon, Pulse, Quill, Relay. Copy the exact names, jobs, tools, budgets and prompts from `reference/orbit-os-frontend/assets/data/jobs.js`.
- **Tool catalog (10):** Gmail, Google Calendar, Slack, HubSpot, QuickBooks Online, Stripe, Google Drive, Notion (selectable) and Intercom, Salesforce (shown as "Coming soon", disabled, cannot be assigned). Each has can / ask first / never lists and an access mode: Read only, Read and prepare drafts, Read and act with approval. Copy from `assets/data/mcps.js`.
- **Guardrails:** 3 defaults (no sending to customers without approval, no pricing or contract terms, stop and ask before spending) and 5 one-click suggestions. Copy from `assets/config.js`.
- **Demo office:** "BrightPath Advisors", 5 people (Maria Santos admin, David Park leader, Jordan Lee, Priya Nair, Marcus Reed), 9 agents, 2 pending requests. Copy from `assets/data/org.js`.
- **Fleet registry:** 3 sample offices plus the live office merged in. Copy from `assets/data/fleet.js`.

### Screens (behavior is defined by the reference; key points below)
**User**
- `home`: heading "x of y agents are working for you right now"; 4 tiles (Running now, Waiting for approval, Runs today, Spent today); one card per owned agent with status, "Right now" line, runs, cost, last active, guardrail count, version; **Edit instructions** (side panel: editor, guardrails read-only, version history with restore, Save disabled until valid and changed) and **Pause / Resume**. Empty states: office not live; no agents assigned.
- `new`: form (name, one-line job, instructions, tools, reason) with inline errors; submit creates a `pending` request; "My requests" list with status pills, admin note, **Cancel** (pending) and **Revise and resend** (changes requested).
- `activity`: receipts of owned agents, expandable "Why", duration and cost.

**Org Admin**
- `dashboard`: before launch, a setup checklist with progress and a Continue button; after launch, 4 tiles (Requests to review, Running now, Waiting for approval, Spent today), a "Needs attention" banner, a requests preview and a "Working right now" list.
- `onboarding`: the wizard above.
- `requests`: pending list with badge count in the nav; review panel shows what was asked, lets the admin edit instructions, add or remove guardrails (with suggestions), and add a note. **Approve and start** creates the agent (owner = requester, manager = Coordinator, department = requester's, guardrails = the edited list, provisioned). **Request changes** and **Decline** require a note. Decided requests are viewable read-only. Includes a "Recent changes" audit list.
- `map`: person picker (Everyone or one person). For each person: a node, curved connectors coloured by status (dashed for idle, paused, draft), and one node per agent showing name, status, what it is doing, who it reports to, cost today. Clicking an agent opens the instructions and guardrails editor. On mobile, stack vertically without connectors.
- `performance`: sortable table (Agent, Owner, Status, Runs 7d, Trend sparkline, Success %, Avg time, Edited by people %, Cost 7d, Cost per run) with a totals row. "Needs attention" when success is below 90 or edited is 40 or more. Row click opens the editor.
- `structure`, `agents` (tabs: Team, Assignments), `connections`: the same components as the wizard steps, reused.

**Super Admin**
- `fleet`: 4 tiles and a table of offices (name, domain, status, agents, 7-day spend, version, health). Row opens the office.
- `office/:id`: for the live office, a table of agents with type, reports to, runtime id, profile, adapter, budget, status. This is the only screen that shows runtime names.
- `provision`: form (business name, domain, Org Admin email) with validation; a 4-step progress (Start a private instance, Create the office and org chart shell, Connect the tool gateway, Invite the Org Admin); on completion adds an "Awaiting onboarding" office to the registry.

### Mock behavior
`MockApiClient` persists to one localStorage key, emits a `storage` event listener so other tabs refresh, and has a live ticker (every 7 seconds) that randomly changes running, waiting and idle agents and bumps runs and cost. The ticker can be switched off in Dev tools and must not re-render while a form field has focus or a panel is open.
**Dev tools** (shown only in development): sign in as any user, load demo office, start fresh onboarding, toggle live activity, links to the other dashboards.

### Design system
Tokens: the frozen `design/` package only. `design/tokens.css` is the implementation, `DESIGN.md` is the source it must match, and `design/tokens.test.ts` fails CI when the two drift. Six colours (`--color-ink`, `--color-paper`, `--color-canvas`, `--color-muted`, `--color-line`, `--color-danger`), Inter with a 16 px body, a 10 px button radius, 1 px dividers, a 3 px focus ring, light and dark via `prefers-color-scheme`, and no shadows. **Never write a literal colour.** The prototype's own palette is superseded and must not be copied, whatever `reference/orbit-os-frontend/assets/tokens.css` says. Point `tailwind.config.ts` at the CSS variables; do not restate their values there. Components to build: Button (primary, ghost, danger, sm), Pill (ok, warn, err), Chip (toggle), Field (label, help, error), Select, Textarea, Table (sortable), Drawer, Modal, Toast, Tabs, Stepper, ProgressBar, OrgTree, EmptyState, Banner, plus the six §15.4 states as one component. PRD §15.2 bans card grids, KPI tiles and the template gallery: build no Card and no Kpi, and where a screen description below says "tiles", render a plain list.

---

## PROMPT 0: Audit and plan (paste first, no code)

```
Role: Staff frontend engineer joining the ORBIT-OS web project.

Read, in this order:
1. CLAUDE.md
2. ORBIT-OS_Claude_Code_Build_Prompts.md (the shared spec section)
3. reference/orbit-os-frontend/README.md
4. Every file under reference/orbit-os-frontend/assets and the three screens folders.

Then run the reference prototype (python3 -m http.server 8080 inside reference/orbit-os-frontend) and use it: go through the Org Admin onboarding from blank to launch, then the User and Super Admin dashboards.

Do NOT write application code yet. Produce a plan file docs/plan.md containing:
1. A one-paragraph summary of the product in your own words.
2. A table mapping each reference screen and file to the React component, hook and Zod schema you will create.
3. The final folder tree.
4. Any place where the spec and the reference disagree, or where the spec is ambiguous. For each, give your recommended answer.
5. Risks (accessibility, focus loss on re-render, cross-tab sync) and how you will handle each.
6. A list of questions for me. Maximum 8, most important first.

Stop after writing docs/plan.md and wait for my answers.
```

**Your move:** answer the questions, then continue.

---

## PROMPT 1: Foundation

```
Role: Staff frontend engineer. Follow CLAUDE.md strictly.

Task: Build the foundation for all three dashboards. No product screens yet.

Build:
1. Vite + React 18 + TypeScript (strict) + Tailwind 3 + shadcn/ui. Multi-page build with three HTML entries: user/index.html, org-admin/index.html, fleet/index.html, each mounting its own app from src/apps/<name>/main.tsx. Inter loaded from Google Fonts with a system fallback stack.
2. Tailwind theme from the design tokens in the shared spec, with light and dark.
3. src/shared/schemas: Zod schemas and inferred types exactly as in the shared spec.
4. src/shared/seeds: jobs, mcps, org templates, demo office, fleet registry, copied faithfully from the reference data files.
5. src/shared/api: an ApiClient interface covering every operation listed below, a MockApiClient (localStorage, storage-event sync, 600 ms job steps, live ticker), query keys, and TanStack Query hooks. Operations:
   org: getOffice, saveOffice, applyTemplate, add/rename/remove department, add/update/remove person, toggleAuthority
   agents: list, create, update, remove, assign, autoAssign, savePrompt, togglePause
   tools: listConnections, connect, disconnect
   launch: startLaunch, retryLaunch, getLaunchStatus
   requests: list, submit, cancel, decide
   fleet: listOffices, getOffice, provisionOffice
   dev: loadDemo, resetFresh, setSimulation
6. src/shared/lib: the four validators (org, agents, assign, connections) as pure functions that return string[] of problems, plus removal-rule checks. Unit test every rule in the spec, including the loop check and the second-coordinator refusal.
7. src/shared/ui: the design-system components listed in the spec, each with a keyboard and aria test where it is interactive (Drawer traps focus and closes on Escape; Toast uses aria-live; Stepper uses aria-current).
8. src/shared/layout: AppShell (sidebar, top bar, mobile top nav under 860px), role-specific nav config, DevTools panel (development only).
9. Three apps, each with HashRouter and placeholder screens for every route in CLAUDE.md, wrapped in the AppShell with the right nav and counts. Org Admin's default route is onboarding until the office is launched, otherwise dashboard.

Constraints: no product logic in components; no direct localStorage outside MockApiClient; every component under 150 lines.

Acceptance:
- npm run dev serves /user/, /org-admin/ and /fleet/, each with working navigation.
- Loading the demo office from Dev tools in one tab updates another open tab without a reload.
- typecheck, lint and tests pass. Validator tests cover every rule.

Finish with a summary and wait.
```

---

## PROMPT 2: Org Admin onboarding wizard

```
Role: Staff frontend engineer. Follow CLAUDE.md. Match reference/orbit-os-frontend/org-admin/screens/setup.js and onboarding.js in behavior and copy.

Task: Build the Org Admin onboarding wizard at #/onboarding.

Wizard shell: stepper (5 steps, done / current / locked states, aria-current="step"), page heading "Step n of 5: <name>" with a one-sentence intro, Back and Continue. Continue is disabled until the step validator returns no problems; show "To continue:" with the list of problems. Later steps are locked until earlier ones are valid. The step persists across reloads.

Step 1, Org structure: business name; template chips (applying one adds its departments without duplicating existing ones); department list with inline rename and remove (blocked if in use, with a toast); people table (name, email, title, department, access, authority toggles Leader / Approver / Budget holder, remove, never allow removing yourself); an explanatory line separating Access from Authority; a live org chart (OrgTree): board node listing the Leaders, then departments, then people. Use React Hook Form + Zod for the person rows; commit on blur.

Step 2, Agents: an info banner that Front Desk is built in and is not an agent; an OrgTree of the board, the Coordinator and nested specialists (each node opens the editor); a "Hire from a template" grid (hide templates already used; hide the Coordinator template once one exists); "Create a custom agent". The agent drawer has: name, role (locked to Specialist once a Coordinator exists, locked when editing), one-line job, department, reports to (excludes self and descendants; shows "The board" for the Coordinator), instructions, tool chips (Coming soon tools disabled), monthly budget. Errors appear inside the drawer. Editing allows removal with the removal rules.

Step 3, Assign: table of agents with department and an owner select; "Auto-assign by department" (Coordinator goes to a Leader, else an Admin; specialists go to an Approver in their department, else anyone in it); a chip row of agents per person.

Step 4, Connections: info banner about the tool gateway ("ORBIT keeps the sign-in tokens, so agents never see your passwords"); "Required by your agents" cards (tool, tier pill, which agents need it, Connect or Disconnect); the Connect modal with access mode select and the can / ask first / never lists and a 700 ms simulated sign-in; "Connect later" checkbox that appears only when something is missing; "Other tools you can add".

Step 5, Launch: summary tiles, a warning if some agents will start paused, the 7-step job with progress bar, an error state with Retry from this step, and on success a "Your office is live" panel with a link to the dashboard. In development only, a checkbox that fails the "workspace" step once.

Acceptance (write as Vitest + Testing Library tests and one Playwright e2e):
- From a fresh office: Continue is disabled on step 1; choosing the Services template, adding a Leader and giving everyone a department enables it.
- Step 2 is blocked until there is one Coordinator and one specialist; a second Coordinator is impossible; setting a manager that would create a loop is impossible.
- Step 3 is blocked until every agent has an owner; Auto-assign satisfies it.
- Step 4 is blocked until required tools are connected; with Connect later on, it passes and agents with missing tools launch paused.
- Launch with the failure option shows Retry, and Retry resumes from the failed step and finishes. After launch every agent is provisioned and the "Set up your office" nav item is gone.
- Keyboard-only run through all five steps works.

Finish with a summary and wait.
```

---

## PROMPT 3: Org Admin daily screens

```
Role: Staff frontend engineer. Follow CLAUDE.md. Match reference/orbit-os-frontend/org-admin/screens/{dashboard,requests,map,performance}.js.

Task: Build the remaining Org Admin screens.

1. #/dashboard: pre-launch checklist hero (5 items with check states, progress bar, Continue setup button); post-launch 4 KPI tiles, "Needs attention" banner (agents with success below 90 or blocked by a missing tool), requests preview with Review buttons, and a "Working right now" list.
2. #/requests: pending list (oldest first) with a nav badge; the review panel (Drawer) showing what the person asked for, whether any tool is not connected yet, an editable instructions textarea, a guardrail editor (list with Remove, add input that submits on Enter, one-click suggestions), a note field, and three actions. Approve and start creates the agent per the spec. Request changes and Decline require a note and show an inline error otherwise. Decided requests open read-only. Add the "Recent changes" audit list.
3. #/map: person picker; per person, a node plus SVG curved connectors plus agent nodes as specified. Use real buttons for nodes with an aria-label that includes name, status and what it is doing. Mobile stacks without connectors.
4. #/performance: sortable table with aria-sort, sparkline SVGs, totals row, the "Needs attention" rule, row click and Enter/Space open the editor. Include the explanatory footnote about Success and Edited by people.
5. #/agents (tabs Team and Assignments), #/structure, #/connections reuse the wizard components without the stepper. A "New agent" button on the Agents page. After launch, creating an agent provisions it immediately; editing a prompt bumps the version.
6. Every save that changes data writes an audit entry (who, what, when).

Acceptance (tests):
- Approving the "Meeting Summarizer" demo request after adding one guardrail produces an agent owned by Priya with 4 guardrails, reporting to the Coordinator, status idle and provisioned.
- Declining without a note is blocked with an inline message.
- Map shows one node per agent; selecting one person shows only that person's agents; connector styles follow status.
- Sorting performance by each column works in both directions; Relay and Quill are flagged in the demo office.
- Disconnecting a tool pauses agents that need it; reconnecting resumes them.

Finish with a summary and wait.
```

---

## PROMPT 4: User dashboard

```
Role: Staff frontend engineer. Follow CLAUDE.md. Match reference/orbit-os-frontend/user/screens/*.js.

Task: Build the User dashboard at /user/.

1. #/home: heading with "x of y agents are working for you right now"; 4 KPI tiles (Running now is highlighted); agent cards for agents this person owns; per card: status pill with a pulsing dot when running, "Right now", runs today, cost today, last active, "n guardrails set by your admin", "Instructions vN", Edit instructions and Pause or Resume (hidden until provisioned). The Edit panel: textarea with live character count and error, guardrails read-only with the line "you can't change these", version history with "Use this version" (loads into the editor, requires Save), Save disabled until valid and changed. Saving shows "<name> updated. New instructions start with the next run."
   Empty states: office not live yet; no agents assigned (with a Request an agent button).
2. #/new: the request form with inline validation, tool chips (Coming soon disabled), submit creates a pending request; below, "My requests" with status pills, the Org Admin's note, Cancel (pending only) and Revise and resend (changes requested; it prefills the form and resubmits as the same request).
3. #/activity: receipts of owned agents, newest first, expandable with Why, duration and cost; an empty state.
4. The nav shows a count on Request an agent when a request needs changes. Identity comes from the session; in development the Dev tools "Sign in as" select changes it.

Acceptance (tests):
- A user sees only their own agents. Running count updates when the ticker changes statuses, without losing focus in an open editor.
- Editing instructions below 20 characters is blocked; a valid change creates version 2 and appears in history; restoring v1 requires Save.
- Submitting a request makes the Org Admin's Requests badge increase by one in another tab. A "changes requested" request can be revised and resent.
- Users cannot edit guardrails (no control exists).

Finish with a summary and wait.
```

---

## PROMPT 5: Super Admin dashboard

```
Role: Staff frontend engineer. Follow CLAUDE.md. Match reference/orbit-os-frontend/fleet/screens/*.js.

Task: Build the Super Admin (fleet) dashboard at /fleet/.

1. #/fleet: tiles (Offices, Live, Agents, Spend over 7 days) and a table with name and domain, status pill (Live, Org Admin onboarding, Awaiting onboarding), agents, 7-day spend, version, health pill. Rows are keyboard-activatable.
2. #/office/:id: for the live office, KPI tiles and a table of agents with type, reports to (or "The board"), runtime id, profile, adapter, budget per month, status; a note explaining that each agent is one manager-reporting teammate with an isolated runtime profile. For sample offices, a clear note that detail comes from that office's own instance. A back button.
3. #/provision: form with Zod validation (name at least 2 characters, valid domain, valid email), then a 4-step progress and a success state with View offices and Provision another. The new office appears in the table as Awaiting onboarding.
4. This is the only dashboard allowed to show runtime ids, profile names and adapter names.

Acceptance (tests):
- The live office row reflects the Org Admin's onboarding state (Org Admin onboarding before launch, Live after).
- After the Org Admin launches, the Office page shows a runtime id and a profile for every agent. Before launch it shows "not created".
- Provisioning with invalid input shows inline errors and does not start; valid input adds a row.
- Searching the User and Org Admin bundles for the words Paperclip, Hermes and adapter finds none.

Finish with a summary and wait.
```

---

## PROMPT 6: Tests, accessibility and polish

```
Role: QA-minded staff engineer. Follow CLAUDE.md.

Task: Harden everything built so far.

1. Playwright e2e covering the full story in one spec: fresh office, onboarding to launch (including the failure and Retry), user edits instructions and requests an agent, Org Admin reviews, adds a guardrail and approves, the map and performance show the new agent, the fleet page shows runtime ids.
2. Accessibility: run axe in Vitest or Playwright on every route in all three apps; fix every serious and critical issue. Verify focus is trapped in Drawer and Modal, restored on close, and that Escape closes them. Verify the live ticker never steals or resets focus and never re-renders a screen while a form field has focus or a panel is open.
3. Responsive: check 360, 768 and 1280 px; navigation becomes a horizontal bar under 860 px; tables scroll inside their container; the map stacks.
4. Dark mode: every component readable in both themes; no hard-coded colours outside tokens.
5. Performance: route-level code splitting inside each app; each dashboard's initial JS under 200 KB gzipped; report sizes.
6. Copy audit: grep user-facing strings for forbidden words (Paperclip, Hermes, OpenClaw, MCP), em dashes and exclamation marks; fix.
7. Remove any dead code, console logs and TODOs. README: how to run, build, test, deploy as static files (Coolify static site, Netlify or Cloudflare Pages).

Output: a checklist in docs/qa-report.md with pass or fail per item and the commands to reproduce.
Finish with a summary and wait.
```

---

## PROMPT 7: Backend readiness (still no backend)

```
Role: Staff engineer preparing a clean handoff.

Task: Make the frontend ready to connect to a real backend without changing a single screen.

1. Write docs/api-contract.md and an OpenAPI 3.1 file docs/openapi.yaml for every ApiClient operation: method, path, request and response Zod schemas, error shape, auth (bearer token), idempotency for launch and decisions, and pagination for lists. Use this mapping as a starting point:
   POST/PUT /api/org/structure; POST/DELETE /api/agents, PUT /api/agents/:id, PUT /api/agents/:id/owner; POST/DELETE /api/connections; POST /api/org/launch, POST /api/org/launch/retry, GET /api/org/launch/status; POST /api/requests, POST /api/requests/:id/decision; GET /api/fleet/offices, POST /api/fleet/offices; live status over SSE at /api/events.
2. Implement HttpApiClient behind the same interface, configured by VITE_API_BASE_URL, with typed errors and Zod parsing of every response. Keep MockApiClient as the default. Selection is by VITE_API_MODE=mock|http. Replace the ticker with an SSE subscription when in http mode.
3. Add contract tests that run the same suite against MockApiClient, and (skipped unless VITE_API_BASE_URL is set) against HttpApiClient.
4. Document every place a backend must enforce a rule that the frontend only checks for convenience (strict tree, one Coordinator, guardrails outrank instructions, authority checks on approvals, tool tokens never leave the server).

Do not add a backend, a database or Supabase. Finish with a summary.
```

---

## Verification script (run after Phase 6)

1. Open `/org-admin/`. Dev tools, Start fresh onboarding.
2. Step 1: Services template, add David Park as Leader (david@brightpath.co), set Maria's department, add Jordan Lee. Continue.
3. Step 2: hire Atlas, Scout, Ledger. Try a second Coordinator (should be impossible).
4. Step 3: Auto-assign. Step 4: connect every required tool. Step 5: tick the failure option, Launch, Retry.
5. `/user/`: Dev tools, sign in as David. See "x of y running". Edit Scout's instructions to version 2. Request "Proposal Chaser".
6. `/org-admin/` Requests: review, add a guardrail, approve. Open Agent map and Performance.
7. `/fleet/`: open the office, confirm runtime ids; provision a new office.
8. Two tabs side by side: change something in one, confirm the other updates.

## Tips for working with Claude Code

- **Always start a phase in plan mode** (Shift+Tab twice) and read the plan before approving.
- **One phase per session.** If Claude Code drifts, say: "Re-read CLAUDE.md and the shared spec, then continue."
- **If the result differs from the prototype,** reply: "Open the reference screen X, compare step by step, and list every difference before changing code."
- **If it invents features,** reply: "Remove anything not in the spec. Frontend only."
- **Keep `reference/` read-only.** Never ask Claude Code to edit it.

## Decisions to confirm before Phase 0

1. **Stack:** React + TypeScript + Tailwind with hash routing and a typed mock API, as in your architecture document. If you prefer Supabase for the backend later, the `ApiClient` interface makes that a one-file swap.
2. **Instruction edits by users apply from the next run,** inside guardrails, with version history.
3. **Definitions:** Success = run finished with no error or rejected result; Edited by people = share of drafts changed before approval.
4. **Hosting:** three static entries deployed together (for example `app.orbitumai.com/user/`, `/org-admin/`, `/fleet/`), or three subdomains. The build supports both.
