# TODOS

## Infrastructure

### Consume infra's built engine image instead of building our own (FD-35)

**What:** Point `template/compose.yml`'s `paperclip` service at infra's built image —
`localhost/orbitos/paperclip-hermes` as pinned in `orbitos-infra` `infra/VERSIONS.md`, or a
published digest-pinned build of it — instead of building `template/engine/Dockerfile` from
`PAPERCLIP_REF` and `HERMES_REF`.

**Why:** There are three records of the engine's versions and two of them disagree with the
one that runs. infra's is canonical: it is what the ten migrations were applied against and
what the restore drill proved. Decided by the founder on 2026-11-10 — FD-35 and its
addendum in `orbitos-infra` `governing/founder-decisions.md`.

**Why it is a port and not an edit:** infra builds Hermes from commit `bf0203a79` with
`uv sync --frozen`, so there is no image digest for `FROM ${HERMES_REF}` to consume — the
two records cannot be made to agree while the two engines are built differently. What this
template adds on top has to come with it: the two Hermes profiles (`orbi`, `scout`), the
`--source` shim, `paperclip-adapters.json`, and the posture checks that read them.

**What it removes when it lands:** `template/engine/pinned-versions.json` and the
`PAPERCLIP_REF`/`HERMES_REF` env pair in `.github/workflows/ci.yml` (lines 37-38), leaving
one engine record. **Until then both stay** — `pnpm stack:up`,
`docs/runbooks/slice-1-local.md` and the CI smoke job require them, and the interim wording
is in `VERSIONS.md`, `CLAUDE.md` and `template/engine/README.md`.

**Files:** `template/compose.yml`, `template/engine/*`, `template/test/engine.test.ts`,
`ops/src/posture*.ts`, `.github/workflows/ci.yml`, `VERSIONS.md`.

### ~~An instance does not migrate itself~~ — DONE 2026-11-16

**What:** Nothing in `template/compose.yml` or in any image applies the ORBIT migrations.
`docs/runbooks/slice-1-local.md` has the operator run `pnpm db:migrate` by hand, which means a
deploy that skips that step brings up an `api` that connects, fails every read with
`could not read the database (PrismaClientKnownRequestError)`, and never becomes healthy.

**How it was found:** the compose smoke job, once the image stopped crashing earlier than this.
The job was not broken — it was faithfully reproducing a deploy where the manual step had not
been run. CI now runs the documented step so the rest of the job can be reached, which does
not fix the product.

**The options, in increasing order of commitment:**

1. **Leave it manual** and make the runbook's step impossible to miss — a preflight in
   `pnpm stack:up` that refuses to start the programs against an unmigrated database. Honest,
   cheap, still a step a human can skip.
2. **A one-shot `migrate` service** in `template/compose.yml` that `api`, `worker` and
   `frontdesk` wait on with `depends_on: { migrate: { condition: service_completed_successfully } }`.
   Its image is the `dbgen` stage, which already has the prisma CLI, the schema and the
   migrations. It runs as `orbit_app`, which owns the `orbit` database, so no new grant.
3. **Migrate on boot** inside each program. Rejected on sight: three programs racing to apply
   the same migrations is worse than the problem.

**Recommendation: option 2.** It is the only one where a customer cannot deploy a broken
instance by forgetting a command, and the build stage it needs already exists.

**SHIPPED 2026-11-16, option 2 as recommended.** `template/compose.yml` has a one-shot
`migrate` service built from the `dbgen` target, running
`prisma migrate deploy` as `orbit_app` on the `data` network, with
`api`, `worker` and `frontdesk` each carrying
`depends_on: { migrate: { condition: service_completed_successfully } }`. `web` does not,
because it has no `DATABASE_URL` and reads nothing.

Three behaviours were measured on Compose v5.6.1, and **one of them was read wrong, which
cost a red run the same day**. What holds: `service_completed_successfully` does wait for exit
0; a later `up` of a dependent is still satisfied by the already-completed container; and a
migration that exits non-zero fails the whole `up` with
`service "migrate" didn't complete successfully: exit N`. What does **not** hold, and was
claimed here for a few hours: `up -d --wait <one-shot>` does not wait for it. With no
healthcheck Compose treats a *running* container as ready — it returned 0 after 3s on an 8s
command — so the CI step's follow-up read `ExitCode` `0` off a container that had not
finished, passed, and the next step died on `The table public.gmail_connections does not
exist`. A check that passed by not looking, shipped in the commit that removed one. The step
now uses `docker compose wait migrate`, which blocks and returns the real exit code. The
product's gate was never affected. Four assertions in
`template/test/compose.test.ts` pin the service list, the three gates, the one-shot
properties (`restart: "no"`, no healthcheck, no ports) and the exact command — `migrate
deploy` rather than `migrate dev` or `reset`, either of which would be destructive inside a
customer deploy. Removing one gate fails that suite; watched.

The CI step that used to apply migrations by hand is gone, replaced by one that runs the
compose service. **The runbook's manual `pnpm db:migrate` step is no longer required**, and
`docs/runbooks/slice-1-local.md` says so.

**Files:** `template/compose.yml`, `template/test/compose.test.ts`,
`docs/runbooks/slice-1-local.md`, `.github/workflows/ci.yml`.

### An instance cannot provision itself either — PROPOSAL, nothing built

**What:** `ops/seed-instance.mjs` takes `GMAIL_EMAIL_ADDRESS`, `GMAIL_HISTORY_ID` and
`GMAIL_REFRESH_TOKEN` as inputs. That is right for CI and for a restore drill, and wrong for
a first install: a real owner has no refresh token to paste, and the history id has to be read
from Gmail *at the moment of connecting* or the Front Desk starts polling from a point that is
not now and classifies old mail. Asked for 2026-11-16; this is the proposal, not a second
script.

**The blocking discovery, and it decides the shape.** The provisioning UI cannot be served by
the api. `api/src/main.ts:34` and `frontdesk/src/main.ts` both refuse to start unless there is
EXACTLY ONE `GmailConnection` row:

    expected exactly one GmailConnection row, found 0; see the runbook

So a setup screen hosted in the api can never run on a fresh instance — the program that would
serve it is the program that will not boot until the thing it serves has already been done.
Any proposal that puts first-install provisioning "in the setup UI" has to answer this first,
and none of the three options below is free.

**The flow itself, whichever option carries it.** The owner is already in the right place at
first install: they accept the invitation, set a password and land on `#/onboarding`
(`e2e/provision.spec.ts` walks exactly that). One more step there — *Connect your mailbox* —
then: Google consent → the api exchanges the code for a refresh token → encrypts it with
`TOKEN_ENCRYPTION_KEY` → calls `users.getProfile` for the CURRENT `historyId` → writes the
workspace, the owner and the single `GmailConnection` row in one transaction. The row-writing
half is already factored (`db/src/owner.ts`'s `createOwner`, and `seed-instance.mjs`'s
transaction), so both paths can share it rather than drifting — which is the way to honour
"no second seed script": `seed-instance.mjs` stays, demoted to the CI and restore path.

**Where it lives — three options, increasing commitment:**

1. **Setup mode in the api.** Relax the boot rule from "exactly one" to "zero or one", and when
   it is zero the api serves the setup route and refuses every other route. Cheapest, and the
   only option where the owner provisions without an operator. **It weakens a boot assertion**,
   so it ships with a test that no other route answers in setup mode — otherwise an instance
   that silently lost its connection row degrades into a half-open api instead of failing.
2. **A one-shot `setup` service**, the same shape as `migrate`: its own container, its own port,
   serves the setup UI, exits when the row exists, and `api`/`frontdesk` gate on it completing.
   Leaves the api's boot rule untouched, costs a second web surface and a port in the template.
3. **Keep it operator-run.** The owner sends the operator a consent code out of band and the
   operator runs `seed-instance.mjs`. Honest, and it means every customer's first install needs
   OrbitumAI in the loop.

**Recommendation: option 1**, with the setup-mode route test as part of it. Option 2 is the
same work plus a container.

**Not proposed here, and genuinely the founder's call:** whose OAuth client the consent uses.
That is BYO-per-customer versus one OrbitumAI client, it changes what the consent screen says
and who holds the secret, and the findings are already written up in `orbitos-infra`
`governing/google-byo-oauth-findings.md` and `governing/google-connector-feasibility.md`.
Nothing above should be built before that is decided, because option 1 and option 2 both put
the client id somewhere different.

**Files, when it is built:** `api/src/main.ts`, `api/src/routes/*`, `src/apps/org-admin/*`,
`db/src/owner.ts`, `ops/seed-instance.mjs`, `template/compose.yml`,
`.github/workflows/ci.yml`.

### ~~Stop shipping `db` into the `web` and `worker` images~~ — RECOMMEND CLOSING, measured 2026-11-16

**What:** `Dockerfile` copies the generated `db` package into all four program images. Only
`api` and `frontdesk` import `@orbit/db`. Give the runtime two stages — one with `db`, one
without — and put a `target:` on each service in `template/compose.yml`.

**Why it is a stopgap and not the fix:** `COPY` cannot be conditional, so one recipe with one
runtime stage cannot scope this. The unconditional copy is what makes `api` and `frontdesk`
start at all; before it they crash-looped on
`Cannot find module '/app/<app>/node_modules/@orbit/db/src/client.ts'` and had done since the
frontdesk services landed. Shipping a 1.7 MB package plus a generated client into two images
that do not import it is waste, not a defect — on an instance-per-customer product it is
still worth removing.

**The alternative that was costed and rejected (2026-11-11):** have the api stop importing
`@orbit/db` at all. Rejected on measurement, not taste:

- `frontdesk` imports it in **10 files / 16 import sites**, including `enqueueJob`,
  `claimDueJobs`, `completeJob`, `logDecisionCall` and the Gmail watermark functions — so
  changing only the api leaves the identical crash in the identical place.
- Something still has to own Prisma. Moving it into `shared` would put it in **all four**
  images, which is the thing this entry exists to avoid.
- The premise does not hold: `shared/package.json`'s exports also resolve to `./src/*.ts`, so
  a cross-package TypeScript import at runtime is this repo's house style — all four programs
  run `node --import tsx src/main.ts` and there is no build step. The deep import was never
  the defect. **The missing `COPY` was**, together with a `prisma generate` that no image ever
  ran.

**MEASURED 2026-11-16, and the measurement is the argument for closing this.** Sized before
building anything, as asked:

| | |
|---|---|
| `/app/db` inside a built image | **1.53 MB** |
| `orbit-instance-web` total | 919,469,469 bytes |
| `orbit-instance-api` total | 919,539,312 bytes |
| the waste, per image | **0.17 %** |
| the waste, per instance (2 images) | **3.06 MB of ~3.68 GB — 0.08 %** |

Confirmed present rather than assumed: `ls /app/db` succeeds in both `orbit-instance-web` and
`orbit-instance-worker`. And the split is genuinely available — `web/src` and `worker/src`
contain **zero** `@orbit/db` imports, `shared` does not import it either (which would have put
it in all four), and `worker` does not so much as read `DATABASE_URL`, though compose hands it
one.

**So the change is feasible, small, and not worth shipping.** 0.17 % of an image, on a product
deployed one instance per customer, against a Dockerfile that gains two near-duplicate runtime
stages and four `target:` lines.

**And it needs more than the stages and the targets, which is the second reason to stop.** A
no-db target is a tripwire: the day `worker` imports `@orbit/db` — and compose already gives it
a `DATABASE_URL`, so that day is plausible — it crash-loops with exactly the error this entry
was created by,

    Cannot find module '/app/worker/node_modules/@orbit/db/src/client.ts'

and nothing catches it until someone runs the stack, which is how that defect survived from the
frontdesk services landing until the smoke job was read. Shipping the split honestly means
shipping a guard that binds each program's import graph to its chosen target. That is a third
moving part to buy back 3 MB.

**RECOMMENDATION: close this entry.** Leave the unconditional `COPY --from=dbgen /app/db db`
and delete the `TODO` in `Dockerfile` that promises the split, so the comment stops describing a
plan nobody intends to execute.

**One thing from the acceptance criteria is worth keeping anyway, independent of all the
above:** a check that every `@orbit/*` subpath a program imports actually RESOLVES inside that
program's built image. That is the check that would have caught the original crash-loop at
build time instead of at boot, it is useful whether or not the images are ever split, and it
costs one test. Not built here; recorded so it is not lost with this entry.

**Files, if it were built:** `Dockerfile`, `template/compose.yml`,
`template/test/image-pins.test.ts`.

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

**Context:** CEO review v2 (2026-09-30, D10) set Scout to web search only at launch and recorded this as the safe upgrade (D15). On 2026-10-01 the founder resolved D10 by dropping the `web` toolset outright: the pinned Hermes image bundles web_search with web_extract, so search without fetch is not configurable, and a search query exfiltrates as readily as a fetch URL. Scout therefore has no research at launch, which makes this split the only way research returns. Trigger: draft quality suffers from the lack of research (unedited rate or discard reasons point to thin drafts).

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
