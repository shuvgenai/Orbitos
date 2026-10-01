# Stage 0b Engine Spike Log

Append-only. Every entry records a command and its real output, not a summary.
Plan: `docs/superpowers/plans/2026-09-30-stage-0b-engine-spike.md`.

## 1. Pinned versions

Both images were resolved through the registry HTTP API rather than `docker pull`, because the
digest and the image config are both readable without downloading the layers. That answers Task 1
Steps 4, 5 and 7 without a 2.8 GB download; the pull happens in Task 2, where the build needs it.

### Paperclip

The repository publishes no semantic version tag. The tag list holds `latest`, `beta`, `canary`,
`nightly`, their `-cloud` variants, and one `sha-<short-sha>` tag per commit. `latest` and
`sha-d554c47` resolve to the same digest, so the immutable `sha-` tag is the pin and `latest` is
recorded only as the thing it currently equals.

- Tag chosen: `sha-d554c47`
- Command:
  ```bash
  TOKEN=$(curl -sS "https://ghcr.io/token?scope=repository%3Apaperclipai%2Fpaperclip%3Apull&service=ghcr.io" | jq -r .token)
  curl -sS -I -H "Authorization: Bearer $TOKEN" \
    -H "Accept: application/vnd.oci.image.index.v1+json" \
    "https://ghcr.io/v2/paperclipai/paperclip/manifests/sha-d554c47"
  ```
- Digest: `sha256:a02ac35ac41df911af477422ea0e781cf41d2b2c600c66f0a5ac9d8c63f52c2c`
- The same digest answers for tag `latest`, confirmed the same way. Tag `sha-d554c4789` (full SHA)
  does not exist: `doc/DOCKER.md` describes the convention as `sha-<FULL_SHA>`, but the registry
  carries the 7-character short SHA.
- Media type: `application/vnd.oci.image.index.v1+json`. Platforms: `linux/amd64`
  (`sha256:f203471a38603026aa861efef343c56a2785202f5f83da440a48f85e5a949a49`) and `linux/arm64`
  (`sha256:4e2e1e59219129a4b687cd54ba439fb7fed0a5710af9f1551277dedd23dc61f1`), plus two
  `unknown/unknown` attestation entries.
- Compressed layer bytes, amd64: 1,830,603,940 (1.83 GB).

### Hermes

- Tag chosen: `v2026.9.24`
- Command:
  ```bash
  HTOKEN=$(curl -sS "https://auth.docker.io/token?service=registry.docker.io&scope=repository%3Anousresearch%2Fhermes-agent%3Apull" | jq -r .token)
  curl -sS -I -H "Authorization: Bearer $HTOKEN" \
    -H "Accept: application/vnd.oci.image.index.v1+json" \
    "https://registry-1.docker.io/v2/nousresearch/hermes-agent/manifests/v2026.9.24"
  ```
- Digest: `sha256:fca358f12efd65bfaaca05884166f15c0e2788375ca30d77061ac1ebc96452b7`
- Versioning is calendar-based (`vYYYY.M.D`), not `X.Y.Z` as the plan assumed. Newest versioned tag
  at the time of pinning: `v2026.9.24` (pushed 2026-09-24). Moving tags present and deliberately not
  used: `latest`, `main`, and the `-desktop` variants of both. 36 tags in total.
- Compressed layer bytes, amd64: 967,802,678 (0.97 GB).
- The `-desktop` variants were not chosen: a customer instance needs the headless agent.

## 2. Node version inside each image

Read from each image's config blob, which carries the environment the image was built with.

- Paperclip image: `NODE_VERSION=24.21.0`. PRD section 7 requires 24.11 or newer, so this passes.
- Hermes image: **no Node version in the image environment.** Its `PATH` is Python-first
  (`/opt/hermes/bin:/opt/hermes/.venv/bin:/opt/data/.local/bin:...`) and it sets
  `PYTHONUNBUFFERED`, `PYTHONDONTWRITEBYTECODE` and `npm_config_install_links=false`. Whether a Node
  runtime is present at all has to be read off the filesystem, which needs the pull in Task 2.

Verdict: the runtime that serves Paperclip is Node 24.21.0, above the 24.11 floor. The constraint is
satisfied for the program that carries the requirement.

## 3. Paperclip against PostgreSQL 16

**Pass.** Paperclip starts, migrates and serves against the instance's PG16 server. Open question 1
is closed: DEP-1's single PostgreSQL 16 server stands, no second server and no bump to PG17.

Run against the dev stack (`pgvector/pgvector:pg16`, server_version `16.15`, database `paperclip`,
login `paperclip_app`), on the `orbit-dev_default` network:

```bash
docker run -d --name engine-probe --network orbit-dev_default \
  -e DATABASE_URL="postgresql://paperclip_app:<dev password>@postgres:5432/paperclip" \
  -e BETTER_AUTH_SECRET="$(openssl rand -hex 32)" \
  -e PAPERCLIP_TOOL_ACTION_SIGNING_SECRET="$(openssl rand -hex 32)" \
  -e PAPERCLIP_PUBLIC_URL="http://127.0.0.1:3100" \
  orbit-engine:spike
```

Startup banner:

```
Mode            external-postgres  |  static-ui
Deploy          authenticated (private)
Auth            ready
Server          3100
Database        postgresql://paperclip_app:***@postgres:5432/paperclip
Migrations      applied (pending migrations)
Agent JWT       missing (run `npx paperclipai onboard`)
Heartbeat       enabled (30000ms)
DB Backup       enabled (every 60m, keep 7d)
Backup Dir      /paperclip/instances/default/data/backups
Config          /paperclip/instances/default/config.json
```

Health:

```json
{"status":"ok","deploymentMode":"authenticated","deploymentExposure":"private",
 "commit":"d554c4789ed3930f8a53ac9fdf6503b3187097da","bootstrapStatus":"bootstrap_pending"}
```

PID 1 inside the container, read from `/proc/1/cmdline`, confirms the entrypoint chain and the
restated `CMD`:

```
/usr/bin/tini -- /usr/local/bin/docker-entrypoint.sh node --import ./server/node_modules/tsx/dist/loader.mjs server/dist/index.js
```

Three things in that banner need action and are not in the plan yet:

1. **`Heartbeat enabled (30000ms)`** contradicts COST-2 ("There are no scheduled heartbeats"). It is
   on by default, so turning it off is a provisioning step (E3-T7) and belongs in the posture check.
2. **`DB Backup enabled (every 60m, keep 7d)`** writing inside `/paperclip`. ORBIT already has its
   own nightly off-host backup (section 10 of the PRD). Either this is turned off or it is accepted
   and counted in the footprint; it is duplicated work and duplicated disk either way.
3. **`Agent JWT missing`** and `bootstrapStatus: bootstrap_pending`. Agents cannot act until
   onboarding runs. Task 6 Step 5 and E3-T7 both need that step.

## 4. Where Hermes reads a profile config from

Partly answered already by the Hermes image config, which reconciles the two documentation pages the
plan cited:

- `HERMES_HOME=/opt/data` and `HERMES_WRITE_SAFE_ROOT=/opt/data`. The configuration reference's
  `~/.hermes` layout and the Docker guide's `/opt/data/profiles/<name>/` are two descriptions of the
  same thing, keyed off `HERMES_HOME` rather than off `$HOME`.
- Declared volume: `/opt/data`. That is the one writable data path the image expects.
- `WorkingDir=/opt/hermes`, `User=root`, `Entrypoint=["/opt/hermes/docker/entrypoint-dispatch.sh"]`,
  no `Cmd`.
- Also set: `HERMES_WEB_DIST=/opt/hermes/hermes_cli/web_dist`, `HERMES_TUI_DIR=/opt/hermes/ui-tui`,
  `HERMES_DISABLE_LAZY_INSTALLS=1`, `HERMES_LAZY_INSTALL_TARGET=/opt/data/lazy-packages`,
  `XDG_RUNTIME_DIR=/tmp/hermes-runtime`, `PLAYWRIGHT_BROWSERS_PATH=/opt/hermes/.playwright`.
- Label `org.opencontainers.image.revision`: `f97608f178d1ffeca59860195ab7da295f7c8e5f`.

Consequence for the plan: the `HOME=/engine` plus `/engine/.hermes-<profile>` design in Tasks 2 to 5
is wrong. Profile directories hang off `HERMES_HOME`, so the writable paths and the entrypoint's copy
destinations change.

The bundled Playwright browser pack is worth noting against SEC-2a: the `browser` toolset must stay
disabled, and the posture check is the thing that proves it.

### Measured against the built image

**The profile directory layout is confirmed. The selector is not what the plan assumed.**

`HERMES_PROFILE=scout` is ignored. With it set, `hermes config show` reports:

```
Config:       /opt/data/config.yaml
Model:
```

That is the default profile, and the empty `Model:` proves our file was never read. The `-p` flag
works:

```
$ hermes -p scout config show
Config:       /opt/data/profiles/scout/config.yaml
Secrets:      /opt/data/profiles/scout/.env
```

`hermes --help` documents it as `hermes -p <profile> <cmd>` (also `--profile`): "Run any command
against a named profile's home". Overriding `HERMES_HOME` per run reaches the same file and reads our
config:

```
$ HERMES_HOME=/opt/data/profiles/scout hermes config show
Config:       /opt/data/profiles/scout/config.yaml
Model:        anthropic/claude-sonnet-5
```

So `template/engine/entrypoint.sh` writes to the right place, and the open question is how the
adapter selects the profile. See section 6.

**`$HERMES_HOME` must be writable by the adapter uid.** First attempt failed:

```
✗ Cannot initialize Hermes directory /opt/data/cron: [Errno 13] Permission denied: '/opt/data/cron'
```

`/opt/data` was root-owned because `RUN mkdir -p` created it as root, and the entrypoint chowned only
`profiles/`. Hermes creates `cron/`, `memories/`, `skills/`, `sessions/` and `logs/` under
`HERMES_HOME` on first run. Fixed in both places: the Dockerfile chowns `/opt/data` at build time so a
fresh named volume inherits it, and the entrypoint chowns the top level flat on every start. The
top level is flat and only `profiles/` recursive, so start-up does not slow down as sessions pile up.

**The `hermes` entrypoint is a privilege-drop shim.** As root it refuses to run:

```
hermes-shim: /command/s6-setuidgid not found; refusing to silently run as root.
hermes-shim: re-run with --user hermes or set HERMES_DOCKER_EXEC_AS_ROOT=1.
```

The shim's own comments explain why: in the Hermes image the supervised gateway runs as uid 10000,
and a root-owned `auth.json` under `$HERMES_HOME` silently breaks the gateway. As any non-root uid it
short-circuits straight to `/opt/hermes/.venv/bin/hermes`. Paperclip runs the adapter as uid 1000, so
this works without the s6 overlay:

```
$ docker exec --user 1000:1000 <c> hermes --version
Hermes Agent v0.21.5 (2026.9.24) · upstream f97608f1
Install directory: /opt/hermes
Install method: docker
Python: 3.13.5
```

The s6 overlay (`/command`, `/package`, `/init`, `/etc/s6-overlay`) is deliberately not copied. Note
for ops: `docker exec` without `--user 1000:1000` will look broken.

The profile config lands correctly and with the right owner:

```
$ docker exec <c> ls -la /opt/data/profiles/scout/
-rwxr-xr-x 1 node node 1024 config.yaml
```

### Which config keys Hermes actually honours

Checked with `hermes -p scout config get <key>` against the full stack:

| Key | Result |
|---|---|
| `memory.memory_enabled` | `false` — recognized and read |
| `skills.write_approval` | `true` — recognized and read |
| `agent.disabled_toolsets` | the list is read back verbatim |
| `cron.enabled` | **rejected:** `⚠ 'cron.enabled' is not a recognized config key — Hermes may not read it; the value printed above comes from your config file.` |

`cron.enabled` was the one key the plan inferred rather than read from the reference, and it is the
one key that does nothing. `hermes cron --help` shows why: scheduling is a per-job system
(`cron list|create|edit|pause|resume|remove`), with no global switch. So COST-2's "no schedules"
means an empty job list, not a config flag.

It was removed from both profile files, and the static test now asserts its **absence**, because a
key Hermes ignores reads as containment that is not there. The runtime check is:

```
$ hermes -p orbi cron list
No scheduled jobs.
$ hermes -p scout cron list
No scheduled jobs.
```

Both empty on a fresh instance. That assertion belongs to the runtime posture check in E3-T7, since
the Stage 0b posture function is pure and reads files only.

## 5. Session behaviour across two issues

(filled in Task 6)

## 6. Failures and workarounds

Facts from the Paperclip image config that replace guesses in the plan's Task 2 Step 4:

- `WorkingDir`: `/app`. The plan guessed `/app`; correct.
- `Entrypoint`: `["/usr/bin/tini","--","docker-entrypoint.sh"]`. The plan assumed it could replace the
  entrypoint outright. Paperclip needs tini as PID 1 and its own `docker-entrypoint.sh`, so the engine
  entrypoint has to run before that chain and then hand off to it, not replace it.
- `Cmd`: `["node","--import","./server/node_modules/tsx/dist/loader.mjs","server/dist/index.js"]`.
  The plan guessed `node server.js`; wrong, and the real command loads tsx.
- `User`: unset, so the image starts as root and its entrypoint drops privileges using `USER_UID=1000`
  and `USER_GID=1000`. The plan's `USER node` line and its static test asserting a non-root `USER`
  both have to change: this image is built to start as root on purpose.
- `HOME=/paperclip` and `PAPERCLIP_HOME=/paperclip`, with
  `PAPERCLIP_CONFIG=/paperclip/instances/default/config.json`. The plan proposed
  `PAPERCLIP_HOME=/engine/paperclip`; keeping the image's own default is less likely to break its
  entrypoint, so the volume should mount at `/paperclip`.
- `PORT=3100`, `HOST=0.0.0.0`, `SERVE_UI=true` are already set.
- `PAPERCLIP_DEPLOYMENT_MODE=authenticated` and `PAPERCLIP_DEPLOYMENT_EXPOSURE=private` are already the
  image defaults, which matches DEP-5. The compose file should still set them explicitly, so the
  posture check reads them from the template rather than trusting an upstream default.
- `PAPERCLIP_BUILD_VERSION=v2026.916.1-0-gd554c4789`, `PAPERCLIP_BUILD_COMMIT=d554c4789ed3930f...`,
  label `org.opencontainers.image.version=2026.916.1`, created `2026-09-21T21:24:21.355Z`.
- Schema labels: `io.github.paperclipai.schema.migration-count=278`, last migration
  `0279_tired_deathstrike.sql`. Useful for the upgrade runbook: a migration count that jumps between
  pinned versions means a schema change to rehearse on staging.
- Also present: `OPENCODE_ALLOW_ALL_MODELS=true` and `GEMINI_SANDBOX=false`. The image ships other
  agent runtimes besides the Hermes adapter. Nothing in ORBIT uses them, and the posture check should
  eventually assert they stay unconfigured.

Corrections to section 2, measured on the pulled images:

- **The Hermes image does ship Node, v26.5.1.** Section 2 inferred otherwise from the absence of a
  `NODE_VERSION` env var. The inference was wrong; only the env var is absent.
- Both images are Debian 13 (trixie) with CPython 3.13.5 at `/usr/bin/python3`. The Hermes venv's
  `pyvenv.cfg` has `home = /usr/bin` and `version_info = 3.13.5`, so the interpreter it needs exists
  in the Paperclip base and the venv survives the copy. That, not the Node question, is the real
  reason the Paperclip base works.
- `docker-entrypoint.sh` resolves to `/usr/local/bin/docker-entrypoint.sh` (a second copy sits at
  `/app/scripts/`). The engine entrypoint uses the absolute path, because `command -v` did not find it
  reliably.
- Paperclip has `rg` but no `ffmpeg` and no `uv`. Hermes' lazy installs are already disabled in the
  image (`HERMES_DISABLE_LAZY_INSTALLS=1`), and the toolsets that would want ffmpeg (`creative`,
  `vision`) are disabled by the allowlist, so nothing needs them.
- The built image is **8.82 GB** uncompressed. Worth carrying into the COST-6 unit-economics check
  and DEP-1's "one small VPS per customer".

### Base image result

**Base A as rewritten (Paperclip base, Hermes copied from `/opt/hermes`) builds and runs.** Base B is
not needed. Build time about 2 minutes warm, dominated by exporting and unpacking 8.82 GB of layers.

```
$ docker run --rm --user 1000:1000 --entrypoint sh orbit-engine:spike -c 'hermes --version'
Hermes Agent v0.21.5 (2026.9.24) · upstream f97608f1
$ docker run --rm --entrypoint sh orbit-engine:spike -c 'node --version; python --version'
v24.21.0
Python 3.13.5
```

Two build warnings, both benign: `InvalidDefaultArgInFrom` for `PAPERCLIP_REF` and `HERMES_REF`,
because the `ARG`s have no defaults on purpose. Supplying a default would reintroduce an unpinned base.

### The `hermes_local` adapter, read from the image

Source at `/app/packages/adapters/hermes/src/server/`. This is the ground truth for D4, D5 and D7, and
it settles more than a live run would have.

**Config keys** (`config-schema.ts`): `provider`, `timeoutSec`, `graceSec`, `maxTurnsPerRun`,
`toolsets`, `persistSession`, `worktreeMode`, `checkpoints`, `quiet`, `verbose`, `paperclipApiUrl`,
`promptTemplate`. No profile key. `template/engine/paperclip-adapters.json` matches this list.

**Arguments it actually passes** (`execute.ts`): `-Q` when quiet, `-m <model>`,
`--provider <provider>`, `-t <toolsets>`, `--max-turns <n>`, `-w` for worktree mode, `--checkpoints`,
`-v` for verbose, `--source tool`, `--yolo`, `--resume <prevSessionId>` when `persistSession` is on,
then anything in `extraArgs`.

**Two undocumented config keys exist and both solve the profile problem.** `execute.ts:350` reads
`config.extraArgs` as a string array and appends it verbatim; `execute.ts:489` reads `config.env` as a
string map and merges it into the child environment. So per-agent profile selection is either
`extraArgs: ["-p","scout"]` or `env: { "HERMES_HOME": "/opt/data/profiles/scout" }`. Both were proven
to reach `/opt/data/profiles/scout/config.yaml` in section 4. Task 4 must add one of them to
`paperclip-adapters.json`; without it both agents share `/opt/data/config.yaml` and the per-agent
allowlist in D4 cannot be expressed at all.

**The adapter passes `--yolo` unconditionally** (`execute.ts:478`). Its comment:

> Bypass Hermes dangerous-command approval prompts. Paperclip agents run as non-interactive
> subprocesses with no TTY, so approval prompts would always timeout and deny legitimate commands
> (curl, python3 -c, etc.). Agents operate in a sandbox — the approval system is designed for
> human-attended interactive sessions.

The premise is false in our deployment: Hermes profiles do not sandbox the filesystem, which is the
exact finding behind Eng v3 D4. Every run therefore has Hermes' own approval layer switched off, and
the only remaining walls are the toolset allowlist and this container. D4 chose both walls; this is
the evidence that the second one is load-bearing rather than defence in depth.

**D7 is decidable from here.** `prevSessionId` is read from
`ctx.runtime?.sessionParams?.sessionId` (`execute.ts:354`) and written back after each run as
`executionResult.sessionParams = { sessionId: parsed.sessionId }` (`execute.ts:617`). So session
continuity is whatever scope Paperclip gives `ctx.runtime.sessionParams`; Hermes itself just honours
`--resume`. Confirming D7 means finding that scope in the Paperclip server (per issue or per agent),
which is a grep in `/app/server`, not a two-lead run. Task 6 should do that first and keep the live
run as confirmation.

Also noted: the adapter deletes `PAPERCLIP_API_KEY` from the child environment and replaces it with
the run's own auth token (`execute.ts:501`), and sets `PAPERCLIP_RUN_ID`, `PAPERCLIP_TASK_ID`,
`PAPERCLIP_WAKE_REASON` and `PAPERCLIP_WAKE_COMMENT_ID`. That is consistent with the
`X-Paperclip-Run-Id` rule the Front Desk bridge has to honour in E3-T3.

## 7. The engine service in the instance template (Task 4)

The full stack starts healthy with the engine's root filesystem read-only. Review Focus 2 holds with
exactly two volumes, `/paperclip` and `/opt/data`, plus a tmpfs at `/tmp`:

```
$ docker compose -f template/compose.yml --env-file template/.env up -d --wait
Container orbit-instance-postgres-1   Healthy
Container orbit-instance-redis-1      Healthy
Container orbit-instance-web-1        Healthy
Container orbit-instance-worker-1     Healthy
Container orbit-instance-frontdesk-1  Healthy
Container orbit-instance-api-1        Healthy
Container orbit-instance-paperclip-1  Healthy
```

SEC-2a check, the one E3-T2 asks for:

```
$ docker compose ... exec paperclip env | grep -Ei 'gmail|resend|token_encryption'
clean
```

Both profile directories arrive owned by uid 1000, and `/opt/data` itself is `node:node`, so the
build-time chown does survive into a fresh named volume as intended:

```
drwxr-xr-x 3 node node 4096 /opt/data
drwxr-xr-x 4 node node 4096 /opt/data/profiles   (orbi, scout)
```

The healthcheck needs a long retry budget on first boot: the image's own labels say 278 migrations,
so `retries: 30` at a 10 s interval replaces the 10 the plan proposed.

`paperclip-adapters.json` carries `extraArgs: ["-p","<agent>"]` per agent. That is the profile
selector the adapter has no field for, and without it both agents would share
`/opt/data/config.yaml`, which would make D4's per-agent allowlist unexpressible. `HERMES_HOME` via
the adapter's `env` map works equally well and was rejected only because `-p` is the documented
Hermes mechanism and keeps one data root.

## 8. The posture check (Task 5)

`pnpm posture:check` passes on the shipped template and exits 1 with a named finding on drift:

```
$ pnpm posture:check
posture: engine section passes          # exit 0

$ sed -i 's/read_only: true/read_only: false/' template/compose.yml && pnpm posture:check
engine_root_fs_writable: the engine root filesystem must be read-only except its data volumes (SEC-2a)
posture: 1 finding(s)                   # exit 1
```

16 tests in `ops/src/posture.test.ts` drive it, each injecting one violation into a clone of the real
template. The E3-T2 verify criterion ("the posture check fails when a Gmail secret or a terminal
toolset is added to that container") is two of them.

One rule exists that the plan did not have: `profile_not_selected`. Dropping `-p <agent>` from an
adapter's `extraArgs` is the quiet way to lose every per-agent rule at once, because both agents then
fall back to `/opt/data/config.yaml` while every other check still passes.

Two FLT-7 rules are deliberately **not** in this function, because they are not readable from files.
They belong to the runtime posture check in E3-T7:

- `hermes -p <profile> cron list` must be empty on both profiles.
- Paperclip's heartbeat must be off. It defaults to on at 30 s.

### CI

`pnpm posture:check` runs in the `test` job. The `compose-smoke` job starts the stack with
`--scale paperclip=0`, on purpose: the engine image is 8.82 GB and does not fit a hosted runner's
disk alongside the rest of the stack. The engine's configuration is covered statically by the posture
check, and its boot is verified on the staging instance (PRD section 9). Revisit if CI gets a larger
runner. The engine's Compose variables are still set in that job, because Compose interpolates them
while parsing even for a service scaled to zero.

## 9. D7 answered from the Paperclip schema, not from a two-lead run

`/app/packages/db/src/schema/agent_task_sessions.ts` holds the session rows the adapter reads
`prevSessionId` from. Its unique index:

```ts
uniqueIndex("agent_task_sessions_company_agent_adapter_task_uniq").on(
  table.companyId, table.agentId, table.adapterType, table.taskKey,
)
```

`taskKey` comes from `deriveTaskKey` in `/app/server/src/services/heartbeat.ts:5519`, which reads
`taskKey ?? taskId ?? issueId` from the context or payload, and two call sites pass the issue
directly (`taskKey: session.issueId` at 19159, `taskKey: action.issueId` at 19266).

**Verdict: D7 holds, by construction.** With `persistSession: true`, one Hermes session exists per
`(company, agent, adapter, issue)`. Two leads are two issues, so they are two sessions, and
`--resume` is only ever passed the session belonging to that issue. A retry on the same issue does
see the first draft, which is the behaviour D7 wanted. No config change, and the two-lead run in
Task 6 becomes confirmation rather than the experiment.

**One exception, and it makes the heartbeat default a correctness problem, not just a cost one.**
`deriveTaskKeyWithHeartbeatFallback` (line 5546) returns a synthetic `HEARTBEAT_TASK_KEY` when there
is no issue and the wake source is `timer`. Every timer wake for an agent therefore shares one
session row. With Paperclip's heartbeat left at its 30 s default, Scout would accumulate a single
long-lived session outside any issue, which is exactly the cross-lead context D7 and D6 exist to
prevent. COST-2 already says heartbeats are off; this is the reason it is load-bearing rather than
a budget preference, and it belongs in the runtime posture check.

## 10. The toolset allowlist was wrong: 21 real toolsets were left enabled

Found while answering "where are Hermes' functions". The authoritative registry is
`CONFIGURABLE_TOOLSETS` in `/opt/hermes/hermes_cli/tools_config.py` inside the pinned image. It holds
**28** keys, each with the tool names it exposes:

| Key | Exposes |
|---|---|
| `web` | web_search, web_extract |
| `browser` | navigate, click, type, scroll |
| `terminal` | terminal, process |
| `file` | read, write, patch, search |
| `code_execution` | execute_code |
| `vision` | vision_analyze |
| `video` | video_analyze |
| `image_gen` | image_generate |
| `video_gen` | video_generate |
| `x_search` | x_search |
| `tts` | text_to_speech |
| `stt` | voice transcription |
| `skills` | list, view, manage |
| `todo` | todo_list |
| `kanban` | task board tools |
| `memory` | persistent memory across sessions |
| `context_engine` | runtime tools from the active context engine |
| `session_search` | search past conversations |
| `connections` | remote connector tools and account authorization |
| `clarify` | clarify |
| `delegation` | delegate_task |
| `cronjob` | create/list/update/pause/resume/run |
| `homeassistant` | smart home device control |
| `spotify` | playback, search, playlists, library |
| `discord` | fetch messages, search members, create thread |
| `discord_admin` | list channels/roles, pin, assign roles |
| `yuanbao` | group info, member queries, DM |
| `computer_use` | background desktop control via cua-driver |

The hermes-paperclip-adapter README lists only nine names, and three of those (`mcp`, `creative`,
`productivity`) are not in the registry at all. Sections 4 and 8 of this log, both profile configs and
the posture check were all built from that README, so they disabled seven real toolsets and three
names Hermes ignores.

**That left 21 real toolsets enabled on both agents**, every one of them reachable by a model reading
hostile lead email: `video`, `image_gen`, `video_gen`, `x_search`, `tts`, `stt`, `skills`, `todo`,
`kanban`, `context_engine`, `session_search`, `connections`, `clarify`, `delegation`, `cronjob`,
`homeassistant`, `spotify`, `discord`, `discord_admin`, `yuanbao`, `computer_use`.

Three of those contradict approved decisions outright:

- `delegation` exposes `delegate_task`. SEC-2a and Eng v3 D4 both say "no delegation" by name.
- `cronjob` lets the agent create its own schedules. COST-2 says the Friday routine is the only one.
- `skills` lets it manage skills, next to CEO R7's "self-made skills OFF".

And `discord`, `spotify`, `homeassistant`, `yuanbao` and `connections` are outbound side channels. The
threat model in D4 is a hostile email talking Scout into exfiltrating the owner's private context;
these are exactly the paths for it, independent of the container boundary, because they leave over
the network rather than through the filesystem.

Fixed: both profiles now disable the full registry minus what each agent needs (Scout 27 disabled,
`web` allowed; Orbi all 28). `ALL_TOOLSETS` in `ops/src/posture.ts` is the single shared list, which
`template/test/engine.test.ts` now imports instead of keeping its own copy. Verified in the rebuilt
image:

```
$ hermes -p scout config get agent.disabled_toolsets
- browser - terminal - file - code_execution - vision - video - image_gen - video_gen - x_search
- tts - stt - skills - todo - kanban - memory - context_engine - session_search - connections
- clarify - delegation - cronjob - homeassistant - spotify - discord - discord_admin - yuanbao
- computer_use
```

**The lesson for every later task: read the registry in the pinned image, never the adapter README.**
A static test cannot see upstream adding a toolset, because the registry lives inside the image. A
count assertion makes a version bump stop and look, but the real guard is the runtime posture check in
E3-T7, which must diff this list against the running image and fail on anything new.
