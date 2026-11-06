# Errata — `ORBIT-OS_Claude_Code_Build_Prompts.md`

**Date:** 2026-11-05 · **Against:** the Build Prompts as copied into both repos
**Authority:** FD-18 to FD-25 (founder answers to Prompt 0's eight questions), plus two items
carried from `docs/plan.md` §4. Register entry: `DEF-3` in the infra repo.

## How this file is kept honest

`src/test/errata.test.ts` holds one exact fragment of each entry's **Old** text and runs in
`pnpm test:web`. It fails when a fragment stops being findable in the repo copy, because
that means either the canonical copy was corrected and re-copied down (mark the entry
`STATUS: applied`, and move its id to `APPLIED` in that test) or a copy was edited in place,
which FD-17 forbids. It also fails if an entry here has no anchor there, so a new entry
cannot be added and then forgotten.

Both `CLAUDE.md` files carry the warning at the top of their reading order. The test is what
makes it a check rather than advice.

## Read this before applying anything

`ORBIT-OS_Claude_Code_Build_Prompts.md` is a **copy**. Both `CLAUDE.md` files say the same
thing: "The canonical source is the **OrbitOS project on claude.ai**. Edit one there and the
copy here drifts silently, and nothing in CI would notice. **Re-copy them; never edit them in
place.**"

So **nothing below has been applied to either repo copy.** Each entry is an exact
old-text-to-new-text edit to make **in the canonical copy on claude.ai**, after which both
repo copies are re-copied down from it. Patching the repo copy instead would create exactly
the failure PRD v9.0 §2 row 9 exists to end: a fixed list stated twice, differently, with no
check between them.

Line numbers are the repo copy's, as an aid to finding the text; match on the text, not the
number.

**Count.** 18 edits are required by the founder's answers. 2 more are carried from Prompt 0
§4 and are marked `[plan §4]`; they need no decision but belong in the same pass. Total 20.
(`docs/plan.md` first said "eleven" and FD-18 first said "15". Both were undercounts, written
before the document was grepped end to end; this file is the count.)

---

## E-1 · `Authority` has four members (L50) — FD-22

**Old:** `type Authority = 'leader' | 'approver' | 'budget';`
**New:** `type Authority = 'leader' | 'approver' | 'backup' | 'budget';`

PRD §7.2 names four and Appendix C instruction 3 restores Backup approver. The applied
database enum already has all four: `CREATE TYPE orbitcrew.authority AS ENUM ('leader',
'approver', 'backup', 'budget')` (migration `0002`). Member spelling is `backup`; the display
label is "Backup approver".

## E-2 · `budget` is Appendix A.5's three numbers (L58) — FD-18, FD-25

**Old:** `guardrails: string[]; tools: string[]; budget: number;       // USD per month`
**New:**
```ts
  guardrails: string[]; tools: string[];
  budget: { monthlyUsd: number; dailyCheapCheckUsd: number; turnLimit: number };  // A.5
```
Appendix A.5 is "three numbers per teammate": monthly budget, daily cap on cheap checks, turn
limit. The separate per-connector daily call and cost limits (C-11) go on `Connection`, not
here — see E-20.

## E-3 · Agents valid when (L74) — FD-18, FD-23

**Old:** "**Agents valid when:** exactly 1 coordinator; at least 1 specialist; names unique
(case-insensitive); each specialist has a manager; no loops (a manager cannot be the agent
itself or one of its descendants); prompt at least 20 characters; budget above 0; a second
coordinator is refused."

**New:** "**Agents valid when:** at least 1 specialist; names unique (case-insensitive); each
specialist has a manager; no loops (a manager cannot be the agent itself or one of its
descendants); **no teammate more than three levels deep, counting Orbi as level 1**; prompt at
least 20 characters; every budget number above 0. **Orbi, the Coordinator, is seeded with the
office and cannot be created, hired or removed (Appendix A.1), so "exactly one coordinator" is
an invariant of the seed rather than a rule the gate checks, and a second Coordinator cannot
be requested at all.**"

Two changes, both from the PRD: Orbi is "always present, exactly one, never removable, not
hired" (A.1), and the tree carries "a maximum depth of three" (§15.6, §15.8). The depth
convention — teammates only, Orbi as level 1, the board not counted — is **PROPOSED** in
FD-23 because the PRD does not define a level.

## E-4 · Removal rules (L77) — FD-18

**Old:** "… cannot remove an agent others report to; cannot remove the Coordinator while other
agents exist."
**New:** "… cannot remove an agent others report to; **Orbi, the Coordinator, can never be
removed at all (Appendix A.1), not even from an office with no other teammates.**"

The prototype's conditional rule becomes absolute.

## E-5 · The teammate roster (L86) — FD-18

**Old:** "- **Agent job templates (9):** Atlas (Coordinator), Scout, Echo, Ledger, Compass,
Beacon, Pulse, Quill, Relay. Copy the exact names, jobs, tools, budgets and prompts from
`reference/orbit-os-frontend/assets/data/jobs.js`."

**New:** "- **AI teammate roles — PRD Appendix A.1 is the source, and may not be restated
here.** Five hireable roles (Finance Clerk, Sales Analyst, Support Triager, HR Coordinator,
Operations Reporter) plus **Orbi**, the Coordinator: always present, exactly one, never
removable, **not hired**. Appendix A.1 gives a role and a department only; the one-line job,
instructions and sample activity come from the prototype's nearest counterpart with the PRD's
name substituted and nothing else in the sentence changed, per Appendix C instruction 2.
Finance Clerk and HR Coordinator have no counterpart and their copy is **proposed** — see
FD-18. The prototype's nine are retired to `docs/backlog.md` as Appendix A.1 instructs."

## E-6 · The connector catalog (L87) — FD-18

**Old:** "- **Tool catalog (10):** Gmail, Google Calendar, Slack, HubSpot, QuickBooks Online,
Stripe, Google Drive, Notion (selectable) and Intercom, Salesforce (shown as "Coming soon",
disabled, cannot be assigned). Each has can / ask first / never lists and an access mode: Read
only, Read and prepare drafts, Read and act with approval. Copy from `assets/data/mcps.js`."

**New:** "- **Connector catalog — PRD Appendix A.2 is the source, and may not be restated
here.** Email, Calendar, Drive, Slack, HubSpot, Stripe, Notion, and WhatsApp as **not
available** (behind a switch until Meta approves). **QuickBooks, Intercom and Salesforce are
not carried over** — Appendix A.2 names them as excluded. Every first permission is
**read-only** (A.2), custom connectors stay **disabled** and show "coming soon" (CD-1's safe
default), and **every** change-capable connector needs a Leader approval (CD-5's safe
default); §13.1 requires the contract to encode the safe-default column, not the suggestion.
The can / ask first / never lists and the three access modes keep the prototype's shape and
copy, with connector names substituted per Appendix C instruction 2."

## E-7 · The demo office, and the `org.js` defect (L89) — FD-21, FD-18

**Old:** "- **Demo office:** "BrightPath Advisors", 5 people (Maria Santos admin, David Park
leader, Jordan Lee, Priya Nair, Marcus Reed), 9 agents, 2 pending requests. Copy from
`assets/data/org.js`."

**New:** "- **Demo office:** "BrightPath Advisors", 5 people (Maria Santos admin, David Park
leader, Jordan Lee, Priya Nair, Marcus Reed) **from `assets/data/people.js`**, 5 departments
(Sales, Operations, Finance, Support, HR — PRD §7.3's example set), **6 teammates** (Orbi plus
the five Appendix A.1 roles), 2 pending requests. The office, department and request shapes
come from `assets/data/org.js`."

**This entry is the defect FD-21 records, and it is the sharpest one in the file.**
`assets/data/org.js` contains **no person records at all** — it builds them by iterating
`window.People` from `assets/data/people.js`, which the copy-from list never mentions. The
only literal names in `org.js` are an audit author and the string "Paused by Jordan Lee". A
reader following the instruction as written finds two names and either invents the other three
or stalls, which is the failure FD-17 already paid for once. The agent count changes from 9 to
6 because Appendix A.1 has six roles.

## E-8 · Remove the `map` screen from the Org Admin inventory (L102) — FD-19

**Old:** the whole "- `map`: person picker (Everyone or one person) … On mobile, stack
vertically without connectors." bullet.
**New:** delete the bullet. Add to the `agents` bullet: "The Team tab also carries what the
prototype drew as a separate Agent map — status, what each teammate is doing right now, who it
reports to, owner and cost today, filterable by person — as a plain list."

PRD §15.6: "this list carries what the prototype drew as a separate Agent map; **there is no
map screen** and no new feature ID." §15.8: "the agent map's curved connectors do not
[survive] … §15.2 requires plain lists."

## E-9 · The ticker writes receipts (L112) — FD-24

**Old:** "… and has a live ticker (every 7 seconds) that randomly changes running, waiting and
idle agents and bumps runs and cost."
**New:** "… and has a live ticker (every 7 seconds) that randomly changes running, waiting and
idle agents, bumps runs and cost, **and appends an activity receipt whenever it moves a
teammate to `running`** — without it the run count climbs while the Activity screen stays
frozen, and the receipt is the product's core promise."

## E-10 · Authority toggles in the people table (L194) — FD-22

**Old:** "… access, authority toggles Leader / Approver / Budget holder, remove, never allow
removing yourself …"
**New:** "… access, authority toggles Leader / Approver / **Backup approver** / Budget holder,
remove, never allow removing yourself …"

## E-11 · Step 2 of the wizard (L196) — FD-18

**Old (two fragments in the same paragraph):**
(a) "a "Hire from a template" grid (hide templates already used; hide the Coordinator template
once one exists)"
(b) "name, role (locked to Specialist once a Coordinator exists, locked when editing)"

**New:**
(a) "a "Hire a teammate" list of the five Appendix A.1 roles (hide roles already hired).
**There is no Coordinator entry: Orbi is seeded with the office and is not hired.**"
(b) "name, **role (always Specialist — Orbi is the only Coordinator and is not created here),
shown read-only**"

Also change "an OrgTree of the board, the Coordinator and nested specialists" to "an OrgTree of
the board, **Orbi** and nested specialists".

## E-12 · Step 2 acceptance check (L206) — FD-18

**Old:** "- Step 2 is blocked until there is one Coordinator and one specialist; a second
Coordinator is impossible; setting a manager that would create a loop is impossible."
**New:** "- Step 2 is blocked until there is **at least one specialist** — **Orbi is already
present, so the Coordinator half of the gate cannot fail**; creating a second Coordinator is
impossible because no screen offers it and the validator refuses it; setting a manager that
would create a loop is impossible, **including making a teammate its own manager**; **a fourth
level of reporting is refused with its own message** (FD-23)."

The self-manager clause is the §4-B1 defect: the prototype accepts it and the teammate then
disappears from the chart.

## E-13 · Prompt 3 item 3, the map screen (L226) — FD-19

**Old:** "3. #/map: person picker; per person, a node plus SVG curved connectors plus agent
nodes as specified. Use real buttons for nodes with an aria-label that includes name, status
and what it is doing. Mobile stacks without connectors."
**New:** "3. **The Team tab of #/agents carries the former map:** a person picker (Everyone or
one person) and, per person, a plain list of their teammates. Each row is a real button with
an aria-label that includes name, status and what it is doing. No connectors and no canvas:
§15.2 requires plain lists."

## E-14 · Which teammates are flagged in the demo office (L235) — FD-18, plan §4-B5

**Old:** "- Sorting performance by each column works in both directions; Relay and Quill are
flagged in the demo office."
**New:** "- Sorting performance by each column works in both directions; **the Operations
Reporter (88% success) and the HR Coordinator (44% of drafts edited) are flagged in the demo
office, and no one else — assert the exact set, not a contains-check.**"

Two separate corrections. First, the old text was wrong even before the reseed: the rule
`success < 90 || edited >= 40` flagged **three** of the prototype's nine — Pulse (88%), Quill
(90% but 44% edited) and Relay (86%) — so the check passed only as a contains-check, which
left the rule effectively untested. Second, under FD-18 those three roles no longer exist. The
reseeded set is computed by running the rule against the new seed, not reasoned out by hand,
and is pinned by a unit test; it deliberately keeps **one agent per cause** so the screen still
demonstrates both halves of the rule.

## E-15 · Prompt 6 item 1, the e2e story (L297) — FD-19

**Old:** "… the map and performance show the new agent, the fleet page shows runtime ids."
**New:** "… the Team tab and performance show the new teammate, the fleet page shows runtime
ids."

## E-16 · Prompt 6 item 3, responsive (L299) — FD-19

**Old:** "… tables scroll inside their container; the map stacks."
**New:** "… tables scroll inside their container."

## E-17 · Verification script step 3 (L333) — FD-18

**Old:** "3. Step 2: hire Atlas, Scout, Ledger. Try a second Coordinator (should be
impossible)."
**New:** "3. Step 2: **Orbi is already there. Hire the Sales Analyst and the Finance Clerk.
Confirm no screen offers a Coordinator and that Orbi has no Remove action.**"

## E-18 · Verification script step 5 (L335) — FD-18

**Old:** "5. `/user/`: Dev tools, sign in as David. See "x of y running". Edit Scout's
instructions to version 2. Request "Proposal Chaser"."
**New:** "5. `/user/`: Dev tools, sign in as David. See "x of y running". Edit **Orbi's**
instructions to version 2. Request "Proposal Chaser"."

David owns Orbi in the demo seed, as he owned the Coordinator in the prototype's. Signing in
as Jordan would reach the Sales Analyst instead; the step works either way, but it has to name
a teammate the signed-in person actually owns, which is what the old step did and why it named
Scout.

---

## Carried from `docs/plan.md` §4 — no decision needed

## E-19 · `[plan §4]` Step 4's banner names ORBIT and tokens (L197-ish) — plan §4-F2

**Old:** "info banner about the tool gateway ("ORBIT keeps the sign-in tokens, so agents never
see your passwords")"
**New:** "info banner about the tool gateway ("**OrbitCrew keeps the sign-in details, so your
teammates never see your passwords**")"

PRD §15.3 bans "ORBIT-OS" and "token" from customer screens; Appendix C instruction 1 says to
fix the customer surfaces. Appendix C instruction 2's method applies — substitute the name,
change nothing else in the sentence. Same shape, same promise, no banned word.

## E-20 · `[plan §4]` Prompt 7's second API mode (L320) — plan §4-C10

**Old:** "Selection is by VITE_API_MODE=mock|http." and, in Prompt 7's preamble, "Do not add a
backend, a database or Supabase."
**New:** "Selection is by `VITE_API_MODE=mock|supabase`." and "Do not add a backend or a
database **in this prompt**; the Supabase client specified by Prompt 1.5 is the second mode."

Prompt 1.5 and the founder's confirmation of 2026-11-05 both post-date Prompt 7: FD-2 chose
self-hosted Supabase and Prompt 1.5 specifies `SupabaseApiClient` behind the same interface.
`HttpApiClient` is not built. The interface is designed to take either.

Per-connector limits land here too: `Connection` gains
`limits: { dailyCalls: number; dailyCostUsd: number }` (C-11, CD-3's safe default "own budget
per connector"), which is why E-2 keeps them off `Agent`.

---

## Build deviations from Prompt 1, recorded rather than silently taken

Neither needs a founder decision; both are recorded because Prompt 1 names a specific tool
and the build did not use it.

## E-21 · Radix primitives instead of shadcn/ui (Prompt 1 item 1)

**Prompt 1 says:** "Vite + React 19 + TypeScript (strict) + Tailwind 3 + shadcn/ui".
**Built with:** Radix UI primitives (`@radix-ui/react-dialog`, `@radix-ui/react-tabs`) for the
two components that need real focus management, and hand-written components for the rest of
the list in the shared spec.

**Why.** shadcn/ui is a generator: it copies component source into the repo, and what it
copies carries `shadow-*` and `ring-offset-*` classes and its own `--background`,
`--foreground` and `--primary` variables. DESIGN.md forbids shadows, PRD 15.2 allows no
second accent, and FD-16 makes `design/tokens.css` the only source of colour, so every
generated file would have had to be scrubbed before use. It also ships a `Card`, and
`CLAUDE.md` says "Build no `Card` component and no `Kpi` component."

Radix is what shadcn/ui is built on, so this keeps the accessibility behaviour that mattered
-- focus trap, Escape, `aria-modal`, scroll lock, roving tab index -- without the styling
that would have fought the design system. `tailwind.config.ts` replaces `theme.colors`
outright, so a stray palette class cannot compile even if one is pasted in later.

**Focus restore is ours, not Radix's**, and that is worth knowing before Prompt 2: Radix
returns focus to its own `Dialog.Trigger`, while almost every panel in this app opens from a
table row, an org-chart node or a list button. `src/shared/ui/Layer.tsx` records the opener
and restores to it in `onCloseAutoFocus`.

## E-22 · oxlint instead of ESLint (Prompt 1 acceptance)

**Prompt 1 says:** "typecheck, lint and tests pass." It names no linter; the repo had none.
**Built with:** `oxlint` 1.91.0.

ESLint was configured first and could not run: the repo pins `typescript@7.0.2`, and
`typescript-eslint@8.72.1` refuses to load against TypeScript 7 ("typescript-eslint does not
support TS 7.0"). Downgrading TypeScript for the whole workspace to lint the dashboards was
the wrong trade. oxlint parses TS and TSX without a TypeScript peer dependency and carries
the `jsx-a11y`, `react` and `unicorn` rule sets this phase needs. MIT licensed, pinned exact.

It is scoped to `src/` plus the two config files. The backend packages have never been
linted and Prompt 1 is not the place to start: adding them would mix hundreds of pre-existing
findings into this phase's output. `reference/` and `design/` are excluded because both are
frozen.
