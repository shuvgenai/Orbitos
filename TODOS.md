# TODOS

## Infrastructure

### Switch Scout and Orbi to the `hermes_gateway` adapter

**What:** Change both agents from Paperclip's `hermes_local` adapter to `hermes_gateway`, with Hermes as its own API server in its own container (profiles under `/p/<profile>/`, one `API_SERVER_KEY` per profile).

**Why:** Restores the original gateway design and moves Hermes out of Paperclip's container. A long-running Hermes also removes the per-run cold start.

**Pros:** Cleaner isolation between Paperclip and Hermes; no per-run process start.
**Cons:** One more container per customer server; needs a staging golden-thread run.

**Context:** Eng review v3 (2026-09-30, decision D3) chose `hermes_local` because `hermes_gateway` cannot be saved or run (paperclipai/paperclip issue #14426; fix in PR #14526, unreleased). To start: watch #14426, pin the Paperclip release that contains the fix, flip the adapter config on staging, then rerun the posture check (D4) and the two-lead session test (D7).

**Effort:** S
**Priority:** P2
**Depends on:** A Paperclip release that includes PR #14526.

## Completed
