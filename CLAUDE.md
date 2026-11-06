# CLAUDE.md — ORBIT-OS web

Guidance for Claude Code working in this repository. This is the **frontend** repo: three
role-gated dashboards built in React against a typed mock API. The pinned Paperclip +
Hermes stack, the `orbitcrew` database schema and its migrations live in a **different**
repo (`shuvgenai/orbitos-infra`) and nothing here depends on them yet.

## STOP — the Build Prompts contain known errors

**`ORBIT-OS_Claude_Code_Build_Prompts.md` contains known errors. Read
`docs/spec-errata.md` BEFORE running any prompt from it, and apply every E-entry that
touches the prompt you are about to run. The repo copy is not corrected in place — see
FD-17 on why copies are not edited.**

18 of its statements are stale against FD-18 to FD-25: the nine agent templates, the
ten-tool catalog, three authorities, a single budget number, `org.js` as the source of five
people it does not contain, and an Agent map screen the PRD deletes by name. Its acceptance
checks name roles that no longer exist.

**This is enforced, not trusted.** `src/test/errata.test.ts` runs in `pnpm test:web` and
holds one exact anchor from each E-entry's *old* text. It fails when an anchor is no longer
findable in the repo copy, because that means one of two things, and both need a human:
the canonical copy was corrected and re-copied down (so mark the entry `STATUS: applied`),
or the repo copy was edited in place, which FD-17 forbids. A stale errata list is worse
than none, and this is what stops it going stale silently.

## Read in this order

1. **`ORBIT_OS_PRD_v9_0.md`** — the spec. §7 access roles and authorities, §15 design,
   naming and screens.
2. **`ORBIT-OS_Claude_Code_Build_Prompts.md`** — the build plan. Its *shared spec* section
   carries the types, validation rules, seed data and screen behaviour, and is referenced
   by every phase rather than pasted into each one.
3. **`docs/auth-three-portals-build-prompt.md`** — Prompt 1.5, the auth layer and the three
   sign-in entries, with decisions D1–D6.
4. **`reference/orbit-os-frontend/`** — the working prototype. Behaviour, copy and screen
   flow. See the read-only rule below.

### Precedence

- The **founder decision register** outranks the PRD on any point it decides, until the PRD
  is amended to match. It lives in the infra repo at `governing/founder-decisions.md`.
  Every decision binding on this repo is summarised below, so you do not need that repo
  open to work here.
- Where the PRD and the Build Prompts disagree, the **PRD** wins — then fix the prompt.

#### Settled 2026-11-05 — the answers to Prompt 0 (FD-18 to FD-25)

These eight close Prompt 0 and bind this repo. **Read `docs/spec-errata.md` before trusting
any list in the Build Prompts** — 18 of its statements are stale against these.

| FD | Decision |
|---|---|
| **FD-18** | **Seed data comes only from PRD Appendix A.** Five hireable roles (Finance Clerk, Sales Analyst, Support Triager, HR Coordinator, Operations Reporter) plus **Orbi**, the Coordinator — always present, exactly one, never removable, **not hired**. The prototype's nine are retired to `docs/backlog.md`. Appendix A.2 is the connector catalog: **QuickBooks, Intercom and Salesforce are out**; every first permission is read-only. `Agent.budget` is A.5's **three** numbers. |
| **FD-19** | **No Agent map.** §15.6 deletes it; it folds into the Team tab of `#/agents` as a plain list. No `#/map` route, no map nav item. |
| **FD-20** | **Phase 1 builds the prototype's fourteen screens, not §15.8's 52.** A recorded deviation — `D-3` in the infra repo's `governing/deviations.md`. Do not quietly widen it, and do not quietly narrow it either. |
| **FD-21** | **`assets/data/people.js` is the source for the five demo people.** The Build Prompts' `org.js` is a defect (`DEF-3`, errata E-7). |
| **FD-22** | **Four authorities** — `leader`, `approver`, `backup`, `budget`, matching `orbitcrew.authority` in migration `0002`. `AccessRole` matches `orbitcrew.access_role`: `user`, `admin`, `super`. |
| **FD-23** | **Maximum tree depth three**, enforced in the validator now. Orbi is level 1; the board does not count a level. |
| **FD-24** | **The mock ticker writes activity receipts** when it moves a teammate to `running`. |
| **FD-25** | **Budget defaults are PROPOSED** and await confirmation. Named constants, one file. |

### Those first three files are copies

The canonical source is the **OrbitOS project on claude.ai**. Edit one there and the copy
here drifts silently, and nothing in CI would notice. **Re-copy them; never edit them in
place.** Say so when you do.

---

## Design tokens — the frozen `design/` package, and nothing else

`design/tokens.css` is the implementation, `DESIGN.md` is the source it must match, and
**`design/tokens.test.ts` fails CI when the two drift.**

Six colours — `--color-ink`, `--color-paper`, `--color-canvas`, `--color-muted`,
`--color-line`, `--color-danger`. Inter, body at least 16px. 10px button radius, 1px
dividers, 3px focus ring, light and dark via `prefers-color-scheme`, no shadows.

**Never write a literal colour.** Point `tailwind.config.ts` at the CSS variables; do not
restate their values there.

### The prototype's palette is dead (FD-16)

`reference/orbit-os-frontend/assets/tokens.css` carries purple `#6316F9`, pink `#E94BB5`,
canvas `#F3F2F8` and radii 18/12/8. Those are **v7.0-era and superseded.** PRD v9.0 §15
exists *because of them*: its own preamble records that a build agent's plan proposed
copying exactly those values, with KPI tiles, agent cards and a template grid, and that
"roughly thirty screens would have been built wrong."

### FD-3 is OPEN — do not resolve it

A separate accent, `#FF9933`, is specified by the infra repo's `CLAUDE.md`, by PRD v1.1
§15, and is already seeded in that database. PRD v9.0 §15.2 says "no second accent
colour". **That decision is the founder's and is not yet made.**

Binding interim rule: **build on `design/tokens.css`. Do not introduce `#FF9933` into the
app.** A token swap is one file; a layout rebuild is not.

---

## Layout — PRD §15.2

| Rule | Detail |
|---|---|
| Colour | Black and white. One red, errors only. No second accent. |
| Lists | **Plain lists. No card grids, no KPI tiles, no template gallery.** A list row may carry a label and a number; it may not become a tile. |
| Buttons | At least 44px; Approve at least 48px. |
| Contrast | At least 4.5:1, verified by the token tests. |
| Zoom and keyboard | Works at 200% zoom, keyboard reachable everywhere, status changes announced, zero serious automated findings. |

**Build no `Card` component and no `Kpi` component.** Where a prompt or a screen
description says "tiles" — the User home's four, the Org Admin dashboard's four, the fleet
console's four — **render a plain list.** The prototype shows them as tiles; the prototype
is not the visual spec.

Components to build: Button (primary, ghost, danger, sm), Pill (ok, warn, err), Chip
(toggle), Field (label, help, error), Select, Textarea, Table (sortable), Drawer, Modal,
Toast, Tabs, Stepper, ProgressBar, OrgTree, EmptyState, Banner, plus the six §15.4 states
as one component.

---

## Naming

**OrbitCrew — capital O, capital C, one word.** Everywhere, including `<title>`.

> PRD v9.0 §15.3 writes it "Orbitcrew" in prose. **FD-5 overrides that**: the lowercase
> form is a defect, and prose is not a naming rule. Follow FD-5.

Customer surfaces — the **user** and **org-admin** entries — must never contain
**Paperclip, Hermes, OpenClaw, MCP, adapter, token, agent id** or **ORBIT-OS**. That
includes the `<title>` tag, email subjects, push alerts and error text. Say OrbitCrew,
Orbi, and the teammate names.

The **fleet** entry is **exempt** (§15.3): it is an internal operator surface, and
ORBIT-OS, Paperclip, Hermes, runtime ids and adapter names are correct there.

| Entry | `<title>` |
|---|---|
| `dashboards/user/index.html` | OrbitCrew |
| `dashboards/org-admin/index.html` | OrbitCrew |
| `dashboards/fleet/index.html` | ORBIT-OS |

The naming rule does **not** apply to `reference/orbit-os-frontend/` — §15.3 says so
explicitly. Its titles stay as they are, and nobody ships them.

---

## `reference/` is READ-ONLY

It holds the **original prototype tree**, recovered verbatim from commit `d53ff29` on
`stream-0/seam-and-contract` (FD-17). Originals, not a reconstruction.

**Never edit it. Never add to it.** Not a string, not a token, not a title. A later session
must be able to tell the prototype's own `jobs.js` from something rebuilt by hand, and the
moment anything in there is touched, it cannot.

**It is the source of truth for behaviour, copy and screen flow — never for visuals.**
Tokens, layout and component shape come from `design/` and PRD §15.

It is executable JavaScript, and it is **inert**: no `package.json`, not in
`pnpm-workspace.yaml`, and `tsconfig.json` includes only `**/*.ts`. Nothing builds,
imports, lints or type-checks it. Run it to *use* it:

```
python3 -m http.server 8080    # inside reference/orbit-os-frontend
```

**Seed lists come from PRD Appendix A, not from here — FD-18.** The roster in
`assets/data/jobs.js` and the catalog in `assets/data/mcps.js` are **superseded**: Appendix
A.1 fixes five hireable roles plus Orbi, Appendix A.2 fixes eight connectors, and Appendix A
forbids restating either list anywhere else. The prototype's nine are parked in
`docs/backlog.md`.

What the prototype is still the source of (never edit any of it):

| File | Still the source of | Superseded |
|---|---|---|
| `assets/data/jobs.js` | the **sentences** for Orbi, Sales Analyst, Support Triager and Operations Reporter, via counterparts `coordinator`, `scout`, `beacon`, `pulse` — name substituted, nothing else in the sentence changed (Appendix C instruction 2) | the roster itself, and the single `budget` number |
| `assets/data/mcps.js` | the can / ask first / never **shape and copy**, and the three access modes | which connectors exist, and their first permission |
| `assets/data/org.js` | the office, department and request shapes; the `fresh`/`demo` seed structure | the teammate count, and **it is not the source of the five people** — FD-21 |
| `assets/data/people.js` | **the five demo people**, in full | — |
| `assets/data/fleet.js` | the 3 sample offices and the 4 provisioning steps | — |
| `assets/config.js` | the 3 default guardrails and 5 suggestions | — |
| `assets/data/tasks.js` | the receipt shape and the activity generator | — |

Prompt 1 builds `src/shared/seeds` from `reference/orbit-os-frontend/assets/` and PRD
Appendix A, with a provenance comment on every entry naming its source file and key, or
`PROVENANCE: PROPOSED` where none exists. There is no extract folder and no reconstruction
anywhere; do not create one.

---

## The `org.js` spec gap — RESOLVED 2026-11-05 by FD-21

The Build Prompts name **`assets/data/org.js`** as the source of the demo office's five
people. **It holds no person records at all** — it iterates `window.People` from
**`assets/data/people.js`**, and the only literal names in it are an audit author and the copy
"Paused by Jordan Lee".

**`people.js` is the source.** The Build Prompts are wrong, recorded as `DEF-3` in the infra
repo and as errata **E-7**. The fix belongs in the canonical copy on claude.ai, not in the
repo copy.

The rule that produced this answer still stands for everything else: **anything the spec
expects and the prototype does not contain is a gap to report, never to fill.** Two live
examples, both from FD-18: the Finance Clerk and the HR Coordinator have no counterpart copy
in the prototype, so their job line, instructions and tools carry `PROVENANCE: PROPOSED` in
the seed and are listed for the founder — not quietly written as though they had a source.

---

## Working rules

- **Every component under 150 lines.** If one grows past that, it is doing two jobs.
- **No product logic in components.** Validation lives in pure, unit-tested functions under
  `src/shared/lib`; types are inferred from Zod schemas in `src/shared/schemas`.
- **No direct `localStorage` outside `MockApiClient`.** It owns the one key, the `storage`
  event listener and the live ticker. Nothing else reads or writes persistence.
- **`ApiClient` is an interface.** `MockApiClient` is the default; a real client is a
  one-file swap behind it. Do not change the interface to suit an implementation.
- **One phase per session.** Start a phase in plan mode, read the plan before approving.
- **Stop and report at the end of each prompt.** Do not start the next one.
- **Frontend only.** If a feature is not in the spec, it does not get built — say so
  rather than inventing it.
- If the result differs from the prototype, open that reference screen and list every
  difference before changing code.

## Repo shape, as it stands

A pnpm workspace: `shared`, `db`, `api`, `web`, `worker`, `frontdesk`, `ops` — the
stage-0/stage-1 backend services. `web/` and `worker/` are one-line stubs.

**Not yet built, and what Prompts 0–1 create:** `vite.config.ts` with three entries,
`dashboards/{user,org-admin,fleet}/`, the `ApiClient` interface and `MockApiClient`,
`AppShell`, `src/shared/{schemas,lib,seeds}`, and `docs/plan.md`.

`design/` already exists — Prompt 1 **wires** it, it does not author it.
