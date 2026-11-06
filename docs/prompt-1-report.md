# Prompt 1 — Foundation: what was built, and what needs your sign-off

**Date:** 2026-11-05 · **Repo:** `shuvgenai/Orbitos`, working copy `C:\Projects\orbitos-web`
**Authority:** FD-18 to FD-25. Errata: `docs/spec-errata.md`. Deviation: `D-3`.

No commit was made. `reference/` and `design/` are untouched — `git status` is clean under
both.

---

## 1. Awaiting your decision

### 1.1 FD-25 — the three budget numbers (Appendix A.5)

Implemented as named constants in `src/shared/seeds/roles.ts`; changing them is one file.

| A.5 number | Proposed | Reasoning |
|---|---|---|
| Monthly budget | **$25** | The prototype's nine ranged $10–$40, median $20, mean $21.11. Appendix A.2 makes every first permission read-only, so a v1 teammate drafts and reports rather than acts — mid-range, not top. Leaves headroom under the $30 the two busiest prototype roles used. |
| Daily cap on cheap checks | **$2** | A.5 separates routine polling from real work. $2/day is ~$60/month, i.e. **more** than the monthly budget, so the cap binds first and cheap checks can never quietly consume the month. That is the point of a separate number. |
| Turn limit | **12** | One model round-trip inside a single task. The prototype's receipts ran 1.4–4.4s on single-step jobs; 12 leaves room for a tool call, a retry and a summary without letting a confused agent loop, and is low enough that hitting it is a signal. |

Per-connector limits sit on the **connection**, not the teammate — C-11, and CD-3's safe
default "own budget per connector". Proposed **200 calls/day** and **$5/day**, both above the
demo office's traffic so they never fire in a demo but exist as the enforcement point.

### 1.2 FD-18 — the two roles with no source copy

Appendix A.1 gives a role name and a department only. Appendix C instruction 2 supplied the
rest for four of the six by substituting the PRD's name into the prototype's sentence:
Orbi←`coordinator`, Sales Analyst←`scout`, Support Triager←`beacon`, Operations
Reporter←`pulse`. Two have no counterpart, are marked `PROVENANCE: PROPOSED` in the seed, and
are listed here rather than written as though they had a source:

**Finance Clerk.** Both prototype Finance roles (`ledger`, `compass`) are QuickBooks jobs and
Appendix A.2 excludes QuickBooks, so there is no sentence to substitute into.
- Job: *Chases overdue invoices*
- Tools: **Stripe + Email** — Stripe is A.2's payments connector, read-only first, and A.2
  notes change-capable actions need Leader approval, which suits a clerk that reads and drafts
- Instructions: *"Each morning list payments more than 30 days overdue and draft a polite
  reminder for each. Escalate anything over $5,000 to the owner."* — `ledger`'s shape, with
  the source moved from QuickBooks to Stripe. The $5,000 escalation is also one of
  `config.js`'s five suggested guardrails.

**HR Coordinator.** The prototype has no HR role of any kind.
- Job: *Drafts and keeps the team handbook current*
- Tools: **Notion + Drive**, both in A.2
- Instructions: *"Keep the team handbook current: draft updates when a policy changes, flag
  anything out of date for more than a quarter, and answer handbook questions from the pages
  only. Drafts only."* — `quill`'s drafts-only shape pointed at the handbook. "Drafts only."
  is lifted from `config.js`.

### 1.3 FD-23 — the depth convention

PRD 15.6 and 15.8 require "maximum depth three" but never define a level. **Proposed:** depth
counts AI teammates only. Orbi is level 1, a teammate reporting to Orbi is level 2, one
reporting to that is level 3, a fourth is refused. The board is people, not teammates, and
counts no level. Both sides of the boundary are pinned by tests.

### 1.4 One naming question I did not act on

`Agent.roleId` replaced the spec's `jobId`, because FD-18 made these Appendix A.1 **roles**
rather than job templates. Mechanical, and the only identifier renamed.

Separately: the prototype's adapter value is **`hermes_gateway`**, while the infra repo
documents the real registry key as **`hermes_local`** and records it appearing 35 times in the
running build. `hermes_gateway` looks like invented display text, which would mean the fleet
console shows an adapter that does not exist. Carried unchanged — not Prompt 1's call. Noted
in `src/shared/seeds/fleet-runtime.ts` and `docs/plan.md` §4-F3.

---

## 2. The three defects: red, then green

Each fix has a test that fails against the behaviour you described. Proven by reverting each
fix in turn and running the suite — all four reverted, all four restored.

| Defect | Test | Reverted behaviour |
|---|---|---|
| Self-manager accepted, then vanishing from the chart | `tree.test.ts` | `expected false to be true` ×2 |
| Update path nulling every omitted field | `mock.test.ts` | `expected null to be 'sales-analyst'` ×3 |
| Disconnect/reconnect discarding a person's pause | `mock.test.ts` | `expected 'tool' to be 'user'` ×2 |
| Ticker not writing receipts (FD-24) | `mock.test.ts` | `expected 12 to be greater than 12` ×2 |

Each also carries a permanent *discriminating* test that reproduces the prototype's own logic
and asserts it produces the defect — so if the old logic is ever reinstated, the failure names
what regressed instead of just going red.

**How each was fixed, not just patched:**
1. `wouldCycle` in `src/shared/lib/tree.ts` covers `agentId === managerId`, runs on create as
   well as edit, and lives in the validator rather than in a dropdown's option list.
2. `createAgent` and `updateAgent` are separate operations; `updateAgent` takes a patch and
   touches only the keys sent. `roleId`, `ownerId`, `perf`, `versions` and `guardrails` are
   not in `AgentPatch` and cannot be reached from it.
3. The pause reason is data — `pausedBy: 'user' | 'tool' | 'budget' | null`. `connect` resumes
   only `'tool'`; `disconnect` records the missing tool but never overwrites a person's pause.

**A fourth defect found while testing,** not on your list: the mock's read methods returned
live references into its own store, so a caller that held an `Agent` saw it mutate underneath
them. A network client never does that, and TanStack Query compares by identity, so a
mutated-in-place object looks unchanged and a screen silently stops re-rendering. Reads now
return copies.

**And a fifth, found by measuring instead of assuming.** `docs/plan.md` §4-F3 predicted the
runtime fields would leak into the customer bundles. They did: `MockApiClient` minted the
profile and adapter names at provision time, the mock ships in all three bundles, and
`hermes_gateway` plus the key name `adapterKey` landed in a chunk **both** customer entries
load. Isolating the schema was not enough. The mock now stores an opaque `runtimeRef` and the
fleet entry composes the operator-visible names from `fleet-runtime.ts`, which only it
imports. Verified against `dist`:

```
user:      clean
org-admin: clean
fleet:     LEAK in fleet-zq-qOmaI.js   <- correct; PRD 15.3 exempts the fleet console
```

That check is now a test (`customer-surface.test.ts`), so it runs every time rather than once.

---

## 3. The acceptance checks that had to change

Your brief said eleven. **The real number is 18**, and that figure came from grepping the
document end to end rather than from my earlier estimate, which was wrong. All 18 are written
as old-text-to-new-text in `docs/spec-errata.md` (E-1 to E-18), plus two carried from Prompt 0
§4 and two build deviations, 22 entries in total.

**Nothing was applied to the repo copy.** Both `CLAUDE.md` files forbid editing it: the
canonical source is the OrbitOS project on claude.ai, and patching the copy produces exactly
the silent drift PRD v9.0 §2 row 9 exists to end. Apply the errata there, then re-copy down.

The 18, by what broke them:

| Errata | Line | What changes |
|---|---|---|
| E-1 | 50 | `Authority` gains `'backup'` (FD-22) |
| E-2 | 58 | `budget: number` → A.5's three numbers |
| E-3 | 74 | Agents-valid: specialist-only gate, Orbi an invariant, depth three |
| E-4 | 77 | Orbi never removable, absolutely |
| E-5 | 86 | Nine templates → Appendix A.1 |
| E-6 | 87 | Ten tools → Appendix A.2 |
| E-7 | 89 | **The `org.js` defect**, and 9 agents → 6 |
| E-8 | 102 | The `map` screen bullet deleted |
| E-9 | 112 | The ticker writes receipts |
| E-10 | 194 | Authority toggles gain Backup approver |
| E-11 | 196 | No Coordinator template; role is read-only |
| E-12 | 206 | Step 2 gate; self-manager and fourth level refused |
| E-13 | 226 | Prompt 3's `#/map` → the Team tab |
| E-14 | 235 | **"Relay and Quill" → the Operations Reporter and the HR Coordinator** |
| E-15 | 297 | Prompt 6 e2e: map → Team tab |
| E-16 | 299 | Prompt 6 responsive: map clause dropped |
| E-17 | 333 | Verification step 3: hire PRD roles, confirm Orbi is fixed |
| E-18 | 335 | Verification step 5: edit Orbi's instructions |

### What "Relay and Quill are flagged" became

Computed by running the rule against the new seed, not reasoned out, and pinned by a test:

> **the Operations Reporter (88% success) and the HR Coordinator (44% of drafts edited) — and
> no one else. Assert the exact set, not a contains-check.**

Two separate corrections in one line. The old text was wrong *before* the reseed: the rule
`success < 90 || edited >= 40` flagged **three** of the prototype's nine — Pulse 88%, Quill
90% but 44% edited, Relay 86% — so as a contains-check it passed while leaving the rule
untested. And under FD-18 all three of those roles are retired. The new seed deliberately
keeps **one teammate per cause** so the Performance screen still demonstrates both halves of
the rule.

---

## 4. Prompt 1, item by item

| # | Item | Where |
|---|---|---|
| 1 | Vite + React 19 + TS strict + Tailwind 3, three HTML entries | `vite.config.ts`, `dashboards/*/index.html`, `src/apps/*/main.tsx` |
| 2 | Tailwind theme from the tokens, light and dark | `tailwind.config.ts`, `src/styles/index.css` |
| 3 | Zod schemas, types inferred | `src/shared/schemas/{index,fleet}.ts` |
| 4 | Seeds: roles, connectors, templates, demo office, fleet | `src/shared/seeds/*` |
| 5 | `ApiClient`, `MockApiClient`, query keys, hooks | `src/shared/api/*` |
| 6 | Validators as pure functions + removal rules | `src/shared/lib/{validate,tree}.ts` |
| 7 | The design-system components, with keyboard and aria tests | `src/shared/ui/*` |
| 8 | `AppShell`, nav config, DevTools | `src/shared/layout/*` |
| 9 | Three apps, hash routing, placeholder screens | `src/apps/*` |

**Two notes on item 1.** Tailwind's `theme.colors` is *replaced*, not extended, so
`bg-blue-500` and every other stock palette class fails to compile — PRD 15.2 enforced at
build time instead of by review. `boxShadow` is emptied for the same reason. And the font is
`@fontsource-variable/inter`, not Google Fonts: DESIGN.md names the family "Inter Variable"
and Google registers it as "Inter", so the token would have silently fallen back. Confirmed
in the browser: `font-family` resolves to `"Inter Variable"`.

**Item 9 placeholders are shells, not blank divs** — each says what will fill it and which
prompt builds it, in PRD 15.4's empty-state pattern. The User home summary, the Org Admin
dashboard summary and the whole fleet table are real, because they are what prove the mock,
the ticker gate and the cross-tab sync actually work.

### Six public paths, three files

Routing is hash-based, so each login path is a rewrite onto its entry's HTML — no SPA
fallback, no second build. The dev server uses the same mapping as production, in one place
(`vite.config.ts`), which is what keeps a later move to subdomains to one file plus a `base`
per entry. All six verified live:

```
/user/         200  OrbitCrew      /login        200  OrbitCrew
/org-admin/    200  OrbitCrew      /org/login    200  OrbitCrew
/fleet/        200  ORBIT-OS       /admin/login  200  ORBIT-OS
```

---

## 5. Verification

| Check | Result |
|---|---|
| `pnpm typecheck:web` | **0 errors** |
| `pnpm lint` (oxlint) | **0 findings** |
| `pnpm test:web` | **132 passed**, 6 files |
| `pnpm build` | three entries built; largest dashboard ≈ **120 KB gzipped**, under Prompt 6's 200 KB cap |
| `pnpm typecheck` (backend) | 26 errors — **unchanged from the pre-existing baseline** |
| `pnpm test:unit` (backend) | 256 pass, 1 fail — **unchanged from baseline** |
| Three dev paths + three login paths | all 200, correct titles |
| Two tabs, no reload | Dev tools → Load demo office in the Org Admin tab; the User tab went from "Your office is being set up" to "1 of 1 agents are working for you right now" **without a reload** |
| Customer bundles | no `paperclip`/`hermes`/`adapter`; fleet does, correctly |
| `reference/`, `design/` | `git status` clean |

**The backend baseline, recorded before anything was touched**, so "unchanged" means
something: `pnpm typecheck` already failed with 26 TS errors because the Prisma client is not
generated (pnpm skips its build script), and
`template/test/no-unapproved-send.test.ts` already failed one assertion because it expects a
`landing/src/` directory that is not in this checkout. Neither is mine and neither moved.

**Accessibility at 375px**, the three regressions `docs/plan.md` §5-R3 measured in the
prototype:

| | Prototype | Now |
|---|---|---|
| Targets under 44px | 15 of 26 | **0 of 11** (the one hit is a checkbox inside a 44px label, in Dev tools) |
| Body text | 14px | **16px** |
| Focus ring | 2px | **3px**, offset 3px |
| Horizontal scroll at 375px | none | none |

---

## 6. What I did not do

- **No commit.** You did not ask for one.
- **No Prompt 1.5.** `src/shared/api/supabase/` does not exist yet; the interface is designed
  for it and `VITE_API_MODE` already reads `mock|supabase`, warning and falling back rather
  than crashing.
- **No Prompts 2–5 screens.** Routes are shells, as item 9 specifies.
- **`src/shared/seeds/fleet-runtime.ts` is written but not yet consumed** — the Office detail
  screen is Prompt 5's. It exists now because the bundle split had to happen now.
- **One `CLAUDE.md` rule knowingly overridden:** "One phase per session. Start a phase in plan
  mode." You said to run Prompt 1 directly, so I did, without stopping for plan approval.
