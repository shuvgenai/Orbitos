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


---

# Errata — `orbitcrew-landing-page-content.md`

**Date:** 2026-11-06 · **Authority:** FD-5 (brand casing), FD-16 and PRD §15.1-15.2
(tokens and layout), FD-29 (the root page itself).

Same rule as above: **this document is a copy, and nothing below has been applied to it.**
Each entry is an edit to make in the canonical copy on claude.ai, after which the repo copy
is re-copied down.

The page copy itself is **approved content and was reproduced verbatim** — every headline,
subhead, trust line, department row, approval question and cost line in
`src/apps/landing/data.ts` is the spec's string. The entries below are the two places the
document contradicts a founder decision, plus one open decision it asks for.

## L-1 to L-8 · The brand is spelled `Orbitcrew` eight times — FD-5

**Old:** `Orbitcrew`, at these eight places:

| # | Where |
|---|---|
| L-1 | the document title, "Orbitcrew Landing Page Content" |
| L-2 | `**Brand:** Orbitcrew` |
| L-3 | §1, "Orbitcrew is sold as a small AI office…" |
| L-4 | §2 Header, `**Logo text:** Orbitcrew` |
| L-5 | §2 Header link, the email subject `"Orbitcrew office request"` |
| L-6 | §2 Hero subhead, "Orbitcrew gives your firm a small AI office…" |
| L-7 | §2 metadata, `**Page title:** Orbitcrew — The first hire…` |
| L-8 | §2 metadata, `**Meta description:** Orbitcrew gives your firm…` |

**New:** `OrbitCrew` in all eight.

FD-5: "`OrbitCrew` stands; the Prompt 1.5 prototype's `Orbitcrew` wordmark and `<title>`
are defects to correct, not a precedent." Prompt 1.5's acceptance also greps the built
bundles for lowercase `Orbitcrew` and expects none. **Building the page verbatim would have
failed a check already in CI**, which is why the page uses `OrbitCrew` and these are logged
rather than silently matched.

The document also contains `orbitcrew.com / orbitcrew.ai` in §5 — those are **domains, and
lowercase is correct there.** Not errata. Eight instances, not nine.

## L-9 · §4's colour palette is superseded — FD-16, PRD §15.2

**Old:** "**Colors:** cool blue-grey background, deep navy text, blue accent. Amber marks
'needs approval.' Green marks 'approved.' Light and dark modes both work."

**New:** "**Colours:** the frozen `design/` package only — the six tokens, light and dark via
`prefers-color-scheme`. No literal colour, no second accent. 'Needs approval', 'approved'
and 'on hold' are carried as a word, a weight and a dot, never by colour alone."

This is the same collision FD-16 settled for the prototype's purple and pink: a page-level
palette against `design/tokens.css` as the single source. PRD §15.2 allows "black and white,
one red, used only for errors. No second accent colour", so navy, blue, amber and green are
four colours that do not exist in the token set.

Not following it also made the page **better on this specific point**: an approval state
carried by amber-versus-green is invisible to a red-green colour-blind visitor, and the
status now reads in words. The rest of §4 — Inter, two columns on desktop, one on mobile,
ten tabs wrapping on phones, reduced-motion respected, the approval box as the memorable
element — was followed as written.

## L-10 · §6's tab scope is an OPEN DECISION the page cannot answer for itself

**Not an edit — a decision the document asks for and that is still unmade.** §6 offers
three options (keep all ten tabs; tag nine "Coming soon"; show fewer) and §7 step 1 says
"Choose one of the three options in section 6."

**Built as option 1, all ten tabs**, because that is what the copy tables specify and
because adding a "Coming soon" tag changes what the page claims. But §6 itself calls
**option 2 "the most honest option"**, and notes that only Sales is a launch office in PRD
v5.1, with Support in Phase 2 and the other eight "not specified".

Two things §6 attaches to this that outlive the decision:

- **"Have a lawyer check the page before public promotion"** — HR and Legal demos involve
  hiring and contract decisions. The copy keeps the "drafts for you to approve" wording,
  which a test asserts, but the review is still owed.
- **"Add a privacy line in the footer before public promotion"** — §5's checklist. Not
  added; there is no privacy copy to add yet.

Neither blocks a localhost page. Both block promoting it.

---

# Errata — the FD-30 URL scheme

**Date:** 2026-11-06 · **Authority:** FD-30, on the founder's instruction.

The scheme changed from the Build Prompts' `/user/`, `/org-admin/`, `/fleet/` and Prompt
1.5's `/admin/login` to:

| Landed on | Signed in at |
|---|---|
| `/user` | `/login` |
| `/orgadmin` | `/org/login` |
| `/superadmin` | `/superadmin/login` |

Same rule as every section above: **these are copies and nothing below is applied to them.**
Each entry is an edit for the canonical copy on claude.ai.

The old paths are **redirected, not dropped** — 308 in the dev server, four lines. There is
still no production rewrite config of any kind, so none of this is a deployment decision.

## In `docs/auth-three-portals-build-prompt.md`

## E-23 · The entry table, row 1 (L305)

**Old:** `| `dashboards/user/index.html` | `/login` | `user`, `admin` | `super` | OrbitCrew |`
**New:** `| `dashboards/user/index.html` → `/user` | `/login` | `user`, `admin` | `super` | OrbitCrew |`

The allow list is unchanged. Only the landed path is new.

## E-24 · The entry table, row 2 (L306)

**Old:** `| `dashboards/org-admin/index.html` | `/org/login` | `admin` | `user`, `super` | OrbitCrew |`
**New:** `| `dashboards/orgadmin/index.html` → `/orgadmin` | `/org/login` | `admin` | `user`, `super` | OrbitCrew |`

## E-25 · The entry table, row 3 (L307)

**Old:** `| `dashboards/fleet/index.html` | `/admin/login` | `super` | `user`, `admin` | ORBIT-OS |`
**New:** `| `dashboards/superadmin/index.html` → `/superadmin` | `/superadmin/login` | `super` | `user`, `admin` | ORBIT-OS |`

Two changes on this row: the sign-in path and the entry name.

## E-26 · The objective line (L4)

**Old:** "three role-gated sign-in entries (`/login`, `/org/login`, `/admin/login`)"
**New:** "three role-gated sign-in entries (`/login`, `/org/login`, `/superadmin/login`)"

## E-27 · The refuse-never-redirect paragraph (L311)

**Old:** "If a signed-in User opens `/admin/login`, show …"
**New:** "If a signed-in User opens `/superadmin/login`, show …"

**The rule itself is unchanged and still holds**, which is the point of changing only the
path: refuse, never redirect, and one generic failure message. Verified after the rename.

## E-28 · The acceptance check naming the operator sign-in (L391)

**Old:** "- An Org Admin signing in at /admin/login is refused."
**New:** "- An Org Admin signing in at /superadmin/login is refused."

## In `ORBIT-OS_Claude_Code_Build_Prompts.md`

## E-29 · The executive summary's outcome (L13)

**Old:** "three separately deployable dashboards (`/user/`, `/org-admin/`, `/fleet/`)"
**New:** "three separately deployable dashboards (`/user`, `/orgadmin`, `/superadmin`)"

## E-30 · Prompt 1's acceptance (L176)

**Old:** "- npm run dev serves /user/, /org-admin/ and /fleet/, each with working navigation."
**New:** "- `pnpm dev` serves /user, /orgadmin and /superadmin, each with working navigation."

Two corrections in one line: the paths, and `npm` → `pnpm` (errata E-22's toolchain note —
the repo pins `packageManager: pnpm@10.33.0`).

## E-31 · Prompt 4's task line (L248)

**Old:** "Task: Build the User dashboard at /user/."
**New:** "Task: Build the User dashboard at /user."

## E-32 · Prompt 5's task line (L272)

**Old:** "Task: Build the Super Admin (fleet) dashboard at /fleet/."
**New:** "Task: Build the Super Admin dashboard at /superadmin."

PRD §15.7 still calls that surface the fleet console and the domain objects are still a
fleet of offices, so `FleetOffice`, `fleet-runtime.ts` and the console's own wording are
unchanged. Only the **portal** is renamed.

## E-33 · Verification script, step 1 (L331)

**Old:** "1. Open `/org-admin/`. Dev tools, Start fresh onboarding."
**New:** "1. Open `/orgadmin`. Dev tools, Start fresh onboarding."

## E-34 · Verification script, step 5 (L335)

**Old:** "5. `/user/`: Dev tools, sign in as David. See "x of y running". …"
**New:** "5. `/user`: Dev tools, sign in as David. See "x of y running". …"

The rest of that line is separately errata'd as E-18: it still says to edit Scout's
instructions, and Scout was retired by FD-18.

## E-35 · Verification script, step 6 (L336)

**Old:** "6. `/org-admin/` Requests: review, add a guardrail, approve. Open Agent map and
Performance."
**New:** "6. `/orgadmin` Requests: review, add a guardrail, approve. Open Performance."

Two corrections in one line. **FD-19 deleted the Agent map**, so "Open Agent map and
Performance" sends a reader to a screen that does not exist — E-8 and E-13's consequence
reaching the verification script, which the earlier pass missed.

## E-36 · Verification script, step 7 (L337)

**Old:** "7. `/fleet/`: open the office, confirm runtime ids; provision a new office."
**New:** "7. `/superadmin`: open the office, confirm runtime ids; provision a new office."

## E-37 · The hosting decision (L353)

**Old:** "three static entries deployed together (for example `app.orbitumai.com/user/`,
`/org-admin/`, `/fleet/`), or three subdomains."
**New:** "three static entries deployed together (for example `app.orbitumai.com/user`,
`/orgadmin`, `/superadmin`), or three subdomains."

## Not changed, deliberately

- **`reference/orbit-os-frontend/{user,org-admin,fleet}/…`** in Prompts 2 to 5. Those are
  source paths into the read-only prototype, not URLs. `reference/` is frozen (FD-17) and
  renaming anything in it is forbidden.
- **`GET /api/fleet/offices`, `POST /api/fleet/offices`** in Prompt 7. API routes, not
  dashboard paths, and the resource really is a fleet of offices.
- **PRD §15.3's entry table** names `dashboards/{user,org-admin,fleet}/index.html` and is now
  out of step. It is not listed as errata here because this file errata's the two build
  documents; the PRD needs its own amendment, noted in FD-30. CLAUDE.md's precedence has a
  founder decision outranking the PRD until the PRD is amended, so the build follows FD-30.
