# Orbitcrew (ORBIT-OS): Design Plan Review

- **Skill:** /gstack-plan-design-review
- **Date:** 2026-09-30
- **Target:** UI scope of `ORBIT_OS_PRD_v5_1.md` (§8 Customer App, §15 UX), read with the approved decisions in `ORBIT_OS_CEO_Review_2026-09-30.md` and `ORBIT_OS_Eng_Review_2026-09-30.md`.
- **Report file:** this file. The PRD is not edited (same choice as the eng review).
- **Focus (D1):** all 7 design areas; visuals for the approval flow.
- **Visual reference (D2, D3):** HTML wireframe (the image tool needs an OpenAI key that is not set up), approved as-is: `~/.gstack/projects/OrbitOS/designs/approval-confirm-20260930/wireframe.html`.

## Pre-review audit

- UI scope: the customer app (onboarding, Office Home, Tasks, Receipts, Team, Waiting for you, Reviews, Rules, Settings) plus the new approval email and confirm page (CEO C2, eng E3).
- DESIGN.md: **none.** The de-facto system is in `landing/src/index.css`: Inter, `--color-ink #000 / paper #fff / canvas #f4f4f5 / muted #52525b / line #e4e4e7`, dark theme via `prefers-color-scheme`, 3px ink focus ring. Buttons use a 10px radius (`landing/src/components/buttons.ts`).
- Prior design reviews: none.

## Step 0

- **Initial rating: 4/10.** The PRD names the screens, some banners, bottom navigation under 768px and basic a11y. It never says what each screen shows first, has no state coverage, has no design for the approval email or confirm page, and its color line points to a stale decision (§15 "primary color per the landing-page palette decision", §19 #2 "orange vs violet"), although the live brand is black and white.
- **10/10 for this plan:** per-screen hierarchy, a state table for every screen, the approval flow designed phone-first, one written design system (DESIGN.md), a11y rules with numbers, and the open interaction choices (edit on phone, skip reasons, empty first week) decided.

## Status: PAUSED (2026-09-30, user switched to /gstack-office-hours)

Outside voice: a Claude subagent ran (native, not outside coverage; Codex is not installed). It raised 12 findings.

**Approved so far:**
- **1A** (D5) Office Home order: Waiting for you first (oldest first, with an escalation countdown), then today in one line plus time-to-sent-reply, then the activity feed. Teammate status moves to Team.
- **2A** (D6) Confirm page gets 6 designed states: expired, already decided, updated draft, sending/failed, office paused, not yours.
- **3A** (D7) Add a loading/empty/error/partial state table for Home, Tasks, Receipts, Team, Hiring progress and Reviews.
- **4A** (D8) First week: David's first screen ("Maria set up your office…") and a Day-1 empty Home ("Watching inbox@…, last checked…").
- **5A** (D9) Team is a plain row list; drop `@xyflow/react`.

## Status: RESUMED and COMPLETED (2026-09-30)

The target was widened to the approved owner-first design doc (`~/.gstack/projects/OrbitOS/subha-unknown-design-20260930-114022.md`) and eng review v2 (`ORBIT_OS_Eng_Review_v2_2026-09-30.md`).

**Carry-forward under the owner-first plan:**
- 1A, 2A and 3A still apply. 3A also covers the new Sign-in and resolve pages.
- 4A: the "David's first screen" half is no longer relevant (the owner who sets up is the Leader). The Day-1 empty Home half stands.
- 5A: the Team screen moves to Phase 2 under 6A; the 5A treatment applies when it returns.
- The bottom-nav question and "Ask the leader" are made irrelevant by 6A and the single-owner premise. Board-level sign-in and 2FA were settled in eng v2 (D6/D7: magic link, 24 h freshness).

**Decisions in the resumed session:**

| # | Issue | Answer | What goes into the plan |
|---|---|---|---|
| 6 | Launch screens | 6A Five screens, no nav bar | Confirm page, Sign-in, Home (Waiting + today line + recent receipts), Receipt detail, Settings (ack template, facts file, pause auto-ack). A top bar links Home and Settings. Team, Tasks, Reviews and Rules wait for Phase 2. |
| 7 | Design system | 7A DESIGN.md mono + 1 red | Landing tokens (ink/paper/canvas/muted/line + dark variants), Inter, body ≥ 16px, 10px button radius, 1px dividers, no shadows, one `--color-danger` (AA red) only for errors and failed sends. Close PRD decision #2 as black and white. |
| 8 | Send below the fold | 8A Sticky bottom bar | On phones, a sticky bar holds Edit and Send (48px) and respects the safe area. Discard is a text link. On desktop, the buttons sit under the draft. |
| 9 | Accessibility | 9A Numbered rules | Targets ≥ 44px (Send 48px). Send and Discard at least 16px apart. Contrast ≥ 4.5:1. Body ≥ 16px. 3px focus ring. Every button has a text label. Status changes are announced (aria-live). Works at 200% zoom. Reduced motion respected. |
| 10 | Theme | 10A Follow the phone | `prefers-color-scheme` only; no switch. |
| 11 | Edit on phone | 11A Edit in place | The draft becomes a full-width text box. The bar becomes "Cancel edits" / "Send edited reply". The receipt stores both texts. |
| 12 | Discard reason | 12A Optional chips | After Discard: "Not a real lead" / "I'll reply myself" / "Draft was wrong" / Skip. Stored on the receipt. |
| 13 | Top bar | 13A Firm name, "by Orbitcrew" | The firm name leads in bold, with a muted "by Orbitcrew" under it. Notices come from "Orbitcrew for <Firm>". |
| 14 | Cost on confirm page | 14A Small, below the draft | "Drafted by Scout · $0.04" in muted text above the bar. Full cost on the receipt. |

Visual reference updated (D10): `~/.gstack/projects/OrbitOS/designs/approval-confirm-20260930/wireframe.html` (v2: main path plus the 6 edge states).

## Pass scores

| Pass | Before | After | Remaining gap |
|---|---|---|---|
| 1 Information architecture | 4 | 9 | Receipt detail layout not drawn |
| 2 Interaction states | 2 | 9 | State-table copy for Settings to be written |
| 3 User journey | 5 | 8 | First-week digest wording not drafted |
| 4 AI slop risk | 5 | 9 | No card grids; plain lists only |
| 5 Design system | 2 | 8 | DESIGN.md still to be written (task) |
| 6 Responsive & a11y | 4 | 9 | Desktop layout of Home not drawn |
| 7 Unresolved decisions | — | 14 decided in total, 0 open | — |

**Overall design completeness: 4/10 → 8.5/10.**

## Storyboard (owner, first week)

| Step | Owner does | Owner feels | Plan specifies |
|---|---|---|---|
| 1 | Finishes managed setup with the founder | Hopeful, a bit wary | Day-1 Home "Watching inbox…, last checked" (4A) |
| 2 | Gets a notice "1 reply waiting" | Curious | Content-free notice (eng D8) |
| 3 | Taps; signs in once by email link | Mild friction | 30-day session; sign-in only on first device (eng D7) |
| 4 | Reads the lead and draft; taps Send | In control | Sticky bar (8A), tag, reason line, quiet cost (14A) |
| 5 | Sees "Sent", views the receipt | Relief, trust | Sent screen plus receipt |
| 6 | Friday, looks at Home | "It's working" | Today line with time-to-sent-reply (1A, C4) |

## NOT in scope
- Team, Tasks, Reviews and Rules screens (Phase 2, 6A).
- Bottom navigation (irrelevant with 5 screens).
- Manual theme switch (10A).
- Full-screen editor (11B declined).

## What already exists
- `landing/src/index.css` tokens and `landing/src/components/buttons.ts` (10px radius): the source for DESIGN.md (7A).
- Wireframe v2 (above).

## TODOS.md updates
None proposed. All approved fixes are build tasks below.

## Implementation Tasks
- [ ] **DR-T1 (P1, human: ~2h / CC: ~15min)** — design — Write DESIGN.md from the landing tokens plus `--color-danger` (7A)
  - Verify: the app and notice emails use only DESIGN.md tokens
- [ ] **DR-T2 (P1, human: ~1d / CC: ~30min)** — web — Build the 5 launch screens per wireframe v2 with the sticky bar and edit in place (6A, 8A, 11A, 13A, 14A)
  - Verify: an E2E test on a 390px viewport shows Send without scrolling
- [ ] **DR-T3 (P1, human: ~4h / CC: ~20min)** — web — The 6 edge-state screens (2A)
  - Verify: each state is reachable in a test and has a single action
- [ ] **DR-T4 (P2, human: ~2h / CC: ~10min)** — a11y — Apply the 9A rules plus an automated a11y check in CI
  - Verify: axe has 0 serious issues; target-size check passes
- [ ] **DR-T5 (P2, human: ~1h / CC: ~5min)** — web — Discard reason chips stored on the receipt (12A)
  - Verify: the receipt shows the chosen reason
- [ ] **DR-T6 (P2, human: ~3h / CC: ~15min)** — web — Loading/empty/error table for Home, Receipt, Settings, Sign-in, resolve page (3A extended)
  - Verify: each screen has a designed empty and error state

## Completion Summary

```
  +====================================================================+
  |         DESIGN PLAN REVIEW — COMPLETION SUMMARY                     |
  +====================================================================+
  | System Audit         | No DESIGN.md; landing tokens reused          |
  | Step 0               | 4/10, focus all 7, visuals for approvals     |
  | Pass 1  (Info Arch)  | 4/10 -> 9/10                                 |
  | Pass 2  (States)     | 2/10 -> 9/10                                 |
  | Pass 3  (Journey)    | 5/10 -> 8/10                                 |
  | Pass 4  (AI Slop)    | 5/10 -> 9/10                                 |
  | Pass 5  (Design Sys) | 2/10 -> 8/10                                 |
  | Pass 6  (Responsive) | 4/10 -> 9/10                                 |
  | Pass 7  (Decisions)  | 14 resolved, 0 deferred                      |
  +--------------------------------------------------------------------+
  | NOT in scope         | written (4 items)                            |
  | What already exists  | written                                      |
  | TODOS.md updates     | 0 items proposed                             |
  | Approved Mockups     | 1 HTML wireframe (v2), no image mockups      |
  | Decisions made       | 14 added to plan                             |
  | Decisions deferred   | 0                                            |
  | Overall design score | 4/10 -> 8.5/10                               |
  +====================================================================+
```

## Unresolved Decisions
None.

## Approved Mockups

| Screen | Mockup path | Direction | Notes |
|---|---|---|---|
| Approval flow (notice, sign-in, confirm, edit, discard, sent + 6 edge states) | `~/.gstack/projects/OrbitOS/designs/approval-confirm-20260930/wireframe.html` | Black/white app UI, sticky Send bar, firm name first | HTML wireframe; the image designer needs an OpenAI key |

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|--------|---------|-----|------|--------|----------|
| CEO Review | `/plan-ceo-review` | Scope & strategy | 1 | CLEAR | mode: SCOPE_REDUCTION, 0 critical gaps |
| Outside Review | `codex` (auto) | Independent 2nd opinion | 3 | unavailable | Codex not installed; no completed external review |
| Eng Review | `/plan-eng-review` | Architecture & tests (required) | 2 | ISSUES OPEN | 20 issues, 0 critical gaps (mapped to tasks) |
| Design Review | `/plan-design-review` | UI/UX gaps | 1 | CLEAR | score: 4/10 → 8.5/10, 14 decisions |
| DX Review | `/plan-devex-review` | Developer experience gaps | 0 | — | — |

- **OUTSIDE COVERAGE:** design phase: a native Claude subagent ran (in-host, not outside coverage); Codex is unavailable (not installed). Plan-review phase: Codex unavailable in all attempts.
- **VERDICT:** CEO + DESIGN CLEARED. The eng review has 0 open decisions and 0 critical gaps. Its findings are build tasks, so the dashboard shows ISSUES OPEN. The plan is ready to implement once the assignment call is done.

NO UNRESOLVED DECISIONS
