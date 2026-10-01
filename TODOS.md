# TODOS

## Infrastructure

### Switch Scout and Orbi to the `hermes_gateway` adapter

**What:** Change both agents from Paperclip's `hermes_local` adapter to `hermes_gateway`, with Hermes as its own API server in its own container (profiles under `/p/<profile>/`, one `API_SERVER_KEY` per profile).

**Why:** Restores the original gateway design and moves Hermes out of Paperclip's container. A long-running Hermes also removes the per-run cold start.

**Pros:** Cleaner isolation between Paperclip and Hermes; no per-run process start.
**Cons:** One more container per customer server; needs a staging golden-thread run.

**Context:** Eng review v3 (2026-09-30, decision D3) chose `hermes_local` because `hermes_gateway` cannot be saved or run (paperclipai/paperclip issue #14426; fix in PR #14526, unreleased). To start: watch #14426, pin the Paperclip release that contains the fix, flip the adapter config on staging, then rerun the posture check (D4) and the two-lead session test (D7).

**Files:** `template/engine/paperclip-adapters.json` (the `adapter` field on both agents),
`template/engine/Dockerfile`, `template/engine/README.md`.

**Also drop on that day, if upstream has caught up:** `template/engine/hermes-shim.sh` exists only
because Paperclip's adapter passes `--source tool` and no published Hermes accepts it. Check
`hermes --help` for `--source`; if it is there, delete the shim, remove the `command` field from both
agents in `paperclip-adapters.json`, and delete the two shim tests in `template/test/engine.test.ts`.
Keep `adapterConfig.model` set either way: `--provider` without `-m` sends the literal model `auto`
and the API answers `HTTP 404: model: auto`.

**Effort:** S
**Priority:** P2
**Depends on:** A Paperclip release that includes PR #14526.

### Build the 90-day retention job and Hermes session purge

**What:** Build the nightly retention job (DAT-3) and the Hermes session purge (PRD task E3-T5), plus
the DEC-2 wipe of Hermes volumes. Stage 0b found that Paperclip also keys one `agent_task_sessions`
row per issue in its own database, so the purge has two targets: the Hermes data under
`HERMES_HOME=/opt/data` on the `hermes_data` volume, and those rows in the `paperclip` database.

**Why:** The 90-day promise on raw email bodies and Hermes sessions must hold before any instance keeps data that long.

**Pros:** Frees customer-zero build time; the job cannot do anything during a 4-week customer zero.
**Cons:** One more item to finish before pilots.

**Context:** Deferred by CEO review v2 (2026-09-30, D2). The 90-day rule itself is unchanged. Hard deadline: before any instance, including customer zero, holds 90 days of data. Verify: a 91-day-old session file is deleted and a 1-day-old one stays.

**Effort:** S
**Priority:** P2
**Depends on:** The worker (reconciler and timers) from stage 1.

### Build receipt CSV export and customer data export

**What:** Build the receipt CSV export (RCPT-1) and the ZIP data export (DATA-1), and decide where their buttons live (PRD §22 N-10).

**Why:** Decommission (DEC-1) delivers the export first, and an outside firm may ask to get its data out.

**Pros:** October goes to the reply path; the only user during customer zero is the founder.
**Cons:** N-10 stays open until then.

**Context:** Deferred by CEO review v2 (2026-09-30, D4). Deadline: before the named firm goes live (stage 2).

**Effort:** S
**Priority:** P2
**Depends on:** Receipts (SCR-5) from stage 1.

### Split Scout into a research run and a draft run

**What:** Replace Scout's single run with a research run (web search + web fetch; sees only the lead's email and the firm's public site) and a draft run (the owner's tone emails + facts file; no web tools).

**Why:** Restores full-page research without re-opening the leak path, where a hostile email makes Scout send the owner's emails to an attacker's URL through web fetch.

**Pros:** Deeper research with no attacker-readable channel next to private context.
**Cons:** Two runs per lead; more to test.

**Context:** CEO review v2 (2026-09-30, D10) set Scout to web search only at launch and recorded this as the safe upgrade (D15). Trigger: draft quality suffers from search-only research (unedited rate or discard reasons point to thin research).

**Effort:** M (human) / S (CC)
**Priority:** P3
**Depends on:** Customer-zero draft quality data.

## Docs

### Rewrite the Vision doc after the customer-zero go/no-go

**What:** PRD tasks 16-17: remove Telegram from Vision §5, §7 and §11 #15; apply the deferrals to the roadmap; redraw the two stale Vision diagrams to match the PRD's architecture (Orbi + Scout on Paperclip + Hermes).

**Why:** The Vision doc still describes an older plan. The PRD governs the build, so this can wait, but the Vision doc must not be shared until it is fixed.

**Pros:** Rewritten once, with customer-zero results.
**Cons:** The Vision doc stays stale for about a month.

**Context:** Deferred by CEO review v2 (2026-09-30, D3). The data-promise wording (task T2) is not part of this and stays P1.

**Effort:** S
**Priority:** P2
**Depends on:** The customer-zero go/no-go.

## Completed
