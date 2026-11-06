# Backlog — parked by decision, not forgotten

Things a founder decision or the PRD removed from the build, kept here so a later session
finds the record rather than rediscovering the choice.

**Everything here is parked by reference.** Nothing is copied out of
`reference/orbit-os-frontend/`. That is deliberate: FD-17 retired a plan to extract the
prototype's data into a second location precisely because "a later session could not tell the
zip's own `jobs.js` from one rebuilt by hand". A backlog file holding a copy of the nine roles
would recreate that ambiguity under a new name. The originals are read-only, in the repo, and
pointed at below.

---

## B-1 · The prototype's nine teammate roles

**Parked by:** FD-18, which implements PRD Appendix A.1 — "The prototype's nine (Atlas, Scout,
Echo, Ledger, Compass, Beacon, Pulse, Quill, Relay) are parked in `docs/backlog.md` and are
not seeded."

**Where they are:** `reference/orbit-os-frontend/assets/data/jobs.js`, keyed
`coordinator`, `scout`, `echo`, `ledger`, `compass`, `beacon`, `pulse`, `quill`, `relay`.
Each entry holds the role's name, one-line job, department, tools, monthly budget,
instructions and three sample activity lines. Read it there.

**Why they are parked, not deleted.** Appendix A.1 fixes five hireable roles plus Orbi, and
Appendix A forbids restating a fixed list anywhere else. The nine predate PRD v9.0. Four of
them are still load-bearing as *source copy* under Appendix C instruction 2 — the Sales
Analyst, Support Triager and Operations Reporter take their sentences from `scout`, `beacon`
and `pulse`, and Orbi takes its own from `coordinator`, with the name substituted and nothing
else in the sentence changed. The seed file records which counterpart each role came from.

**What would unpark one.** A PRD version bump changing Appendix A.1; nothing less, since
Appendix A says "Changing a list here is a PRD change with a version bump." `echo`, `ledger`,
`compass`, `quill` and `relay` have no Appendix A.1 counterpart and would need a role of their
own before they could return. `ledger` and `compass` additionally depend on QuickBooks, which
Appendix A.2 excludes.

## B-2 · The Agent map screen

**Parked by:** FD-19, which implements PRD §15.6 — "this list carries what the prototype drew
as a separate Agent map; there is no map screen and no new feature ID" — and §15.8, "the agent
map's curved connectors do not [survive] … §15.2 requires plain lists."

**Where it is:** `reference/orbit-os-frontend/org-admin/screens/map.js` (18 lines), with its
CSS in `assets/components.css` (`.mapu`, `.mapsvg`, `.anodes`, `.unode`, and the 760 px
stacking rule).

**What survives into the build:** the *information*, not the drawing. The Team tab of
`#/agents` carries the person picker and, per person, each teammate's status, what it is doing
right now, who it reports to, owner and cost today — as a plain list (errata E-8, E-13).

**What would unpark it.** A change to §15.2's plain-lists rule. PRD §15.8 also parks the
prototype's drag-and-drop org-chart canvas in `docs/backlog.md` for the same reason; that one
was never built, so there is nothing to point at but the rule.

## B-3 · The 38 PRD screens outside Phase 1

**Parked by:** FD-20, recorded as deviation `D-3` in the infra repo.

PRD §15.8 names 52 screens and says no screen is cut. Prompts 1-7 build the prototype's
fourteen, working, rather than 52 shells of which 24 are "fill later". §15.8's inventory is
the **Phase-2 scope**.

**Where the list is:** PRD v9.0 §15.5, §15.6 and §15.7, with §15.8's Fill now / Fill later
split and, for each Fill-later screen, what unblocks it. Six of them have data that must ship
at launch even though the screen waits; §15.8 names those six and says they are not Stream A
work.

**Not parked, and still required:** the §15.4 six screen states, which apply to every screen
built in Phase 1.

## B-4 · A.3, A.4 and A.6's entities — tasks, risk categories, approval bases

**Parked by:** FD-18's scope note, and FD-20 by extension.

Appendix C instruction 2 says seed data comes only from Appendix A, which includes A.3's seven
task states, A.4's four risk categories and A.6's three approval bases. Those describe a
**task** and an **approval** — entities none of the fourteen screens model. The prototype's
six teammate statuses are not A.3's task states and do not collide with them.

They arrive with the PRD's `/tasks`, `/waiting` and `/jobs` screens in Phase 2. Appendix C
instruction 5's requirement — one test per fixed list that fails if the list changes without a
matching PRD section reference — **is** implemented now, in
`src/shared/seeds/appendix-a.test.ts`, for the lists Phase 1 actually seeds.
