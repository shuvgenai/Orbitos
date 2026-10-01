# Stage 0b Engine Spike Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prove that Orbi and Scout run through Paperclip's `hermes_local` adapter at pinned versions, and lock that configuration into the instance template behind a posture check.

**Architecture:** One extra container per instance, built from this repo (`template/engine/Dockerfile`), holds both Paperclip and Hermes, because the `hermes_local` adapter spawns a local `hermes` binary and cannot reach a Hermes on another host. That container gets the `paperclip` database login only, a read-only root filesystem with named volumes for its data directories, its own model key, and no Gmail, Resend or token-encryption secret. Hermes behaviour (memory off, toolset allowlist, no self-written skills) lives in per-profile `config.yaml` files baked into the image and copied over the profile volume on every start, so an upgrade cannot inherit drifted config. A pure posture function in `ops/` reads the compose file and those profile files and fails on any of those rules, which is what the Stage 0b exit criterion checks.

**Tech Stack:** Docker Compose, `ghcr.io/paperclipai/paperclip` (digest-pinned), `nousresearch/hermes-agent` (digest-pinned), Paperclip HTTP API on port 3100, Hermes `config.yaml`, Node 24, TypeScript, Vitest, and the existing Zod contracts in `shared/src/agent-output.ts`.

**Spec:**
- `ORBIT_OS_PRD_v6_1.md`: section 18 row 0b (deliverable and exit criterion), section 6 (architecture diagram), section 7 (technology stack), DEP-1, DEP-5, SEC-1, SEC-2a, SEC-6, SEC-10, COST-1 to COST-3, FLT-7, DAT-3, DEC-2, UX-6, and build tasks E3-T1 and E3-T2.
- `ORBIT_OS_Eng_Review_v3_2026-09-30.md`: S1/D3 (`hermes_local` now), S2/D4 (allowlist plus own container), S3/D5 (15 s comment poll, fixed JSON block, one corrective comment), S4/D6 (memory off, 90-day purge), S5/D7 (one session per issue, to be verified in this spike).
- `docs/superpowers/plans/2026-09-30-stage-0-foundations.md`: the template, the compose test and the shared contracts this plan extends.

**Upstream documentation** that every config field name in this plan was read from, on 2026-09-30. Re-read these before changing a field, and record any difference in the spike log:

- Paperclip Hermes adapter fields (`provider`, `timeoutSec`, `graceSec`, `toolsets`, `maxTurnsPerRun`, `persistSession`, `worktreeMode`, `checkpoints`, `verbose`, `quiet`, `promptTemplate`, `paperclipApiUrl`): <https://docs.paperclip.ing/reference/adapters/hermes/>
- Paperclip Docker image, port 3100 and the deployment variables: <https://github.com/paperclipai/paperclip/blob/master/doc/DOCKER.md>
- Paperclip API auth, company-scoped routes and the `X-Paperclip-Run-Id` rule: <https://docs.paperclip.ing/reference/api/overview/> and <https://docs.paperclip.ing/reference/api/issues/>
- Hermes `config.yaml` keys and the `~/.hermes` layout: <https://hermes-agent.nousresearch.com/docs/user-guide/configuration>
- Hermes Docker image, `/opt/data` and the profile layout: <https://hermes-agent.nousresearch.com/docs/user-guide/docker>
- The adapter's toolset vocabulary: <https://github.com/NousResearch/hermes-paperclip-adapter>

## Global Constraints

- Node 24 LTS, 24.11 or newer (PRD section 7). The engine image's Node version comes from the pinned upstream images; record it, and if it is below 24.11 stop and report.
- One Postgres server per instance, PostgreSQL 16 with pgvector, databases `orbit` and `paperclip` with separate logins (DEP-1). Paperclip's own compose ships PostgreSQL 17, so this plan verifies Paperclip runs against the instance's PG16 and raises a decision if it does not.
- Both upstream images are pinned by digest, never by a floating tag (FLT-1 pinned versions, SEC-6 drift blocks health).
- The engine container holds no Gmail token, no Resend key and no `TOKEN_ENCRYPTION_KEY`, and uses only the `paperclip` database login (SEC-2a).
- The engine container holds its own model key, separate from the Front Desk's (SEC-10). Host variable `ENGINE_ANTHROPIC_API_KEY`, passed in as `ANTHROPIC_API_KEY`.
- Every published port binds to `127.0.0.1` only (SEC-1). Engine UIs are reached over OrbitumAI's tailnet from the host, never from a public interface (DEP-5).
- The `data` network stays `internal: true` (SEC-1).
- Scout's Hermes toolsets: `web` only. Orbi's: none. No terminal, file-write, browser, code execution, MCP or delegation on either profile (SEC-2a).
- Persistent memory off and self-written skills off on both profiles (S4/D6, CEO R7).
- Turn caps: Orbi 20, Scout 30 (COST-3). No scheduled heartbeats; the only schedule is Orbi's Friday routine (COST-2).
- Customer-facing words only in anything a customer could read: Orbitcrew, never ORBIT-OS, Paperclip or Hermes (UX-6). Internal files, logs and this plan are exempt.
- Agent output is untrusted (FD-2a). Every comment Scout or Orbi writes goes through `parseAgentComment` from `shared/src/agent-output.ts`. Do not add a second parser.
- This is a spike. Several facts about Paperclip and Hermes are unverified until a step records them. Where a step says "stop and report", stop. Do not improvise a replacement design.

## Review Focus

Five conditions the spec implies that no happy path exercises. Each has its test named in the task that owns the code.

1. **A Hermes profile config that omits a safety key.** `memory_enabled` defaults to `true`, so a config missing the key is memory-on while reading as clean. The posture check must fail on an absent key, not only on an explicit `true` (Task 5).
2. **A read-only root filesystem that stops Paperclip from starting.** Paperclip must write to `PAPERCLIP_HOME`, its data mount and its agent workspace. If any of those is not a mounted volume the container crash-loops on first boot, and the instance looks provisioned but is dead (Task 4).
3. **Hermes writing a self-made skill into its profile directory.** That directory is a writable volume, so a skill written once survives restarts and quietly restores a capability the allowlist removed. The posture check must fail when skill writing is allowed, and the entrypoint must restore the config on every start (Tasks 3 and 5).
4. **Paperclip refusing an agent comment with `403 cross_issue_influence_run_context_required`.** The poll must surface that error once, not read it as "no draft yet" and retry until the 10-minute timeout, which would hide a broken setup behind a generic hand-off to Orbi (Task 6).
5. **A comment that arrives while the engine container is restarting.** An empty comment list must read as pending, and a malformed comment must read as invalid exactly once, because D5 allows one corrective comment and no more (Task 6).

## File Structure

| File | Responsibility |
|---|---|
| `template/engine/pinned-versions.json` | The two upstream image refs with digests. Single source for the compose build args and the posture version assertion. |
| `template/engine/Dockerfile` | Builds the one container holding both Paperclip and Hermes. No secrets, no config values. |
| `template/engine/entrypoint.sh` | Copies the baked profile configs over the profile volumes, then starts Paperclip. The only place that decides the live Hermes config. |
| `template/engine/hermes/orbi.config.yaml` | Orbi's Hermes config: memory off, every toolset disabled, no skill writes. |
| `template/engine/hermes/scout.config.yaml` | Scout's Hermes config: memory off, `web` allowed, everything else disabled, no skill writes. |
| `template/engine/paperclip-adapters.json` | The `hermes_local` adapter settings per agent. Applied by the provisioning script in E3-T7; asserted by the posture check now. |
| `template/engine/README.md` | Why one container holds both programs, and what changes when `hermes_gateway` is fixed. |
| `template/compose.yml` | Gains the `paperclip` service, its volumes and the engine variables. |
| `template/.env.example` | Gains the engine variable names. |
| `template/test/engine.test.ts` | Static tests over the Dockerfile, pinned versions, profile configs and adapter config. |
| `template/test/compose.test.ts` | Extended with the engine containment rules. |
| `ops/src/posture.ts` | `checkEnginePosture`, a pure function returning findings. No filesystem, no network. |
| `ops/src/posture-check.ts` | CLI that reads the repo files and prints findings. |
| `ops/src/posture.test.ts` | Proves the function passes on the real config and fails on each injected violation. |
| `ops/src/spike/draft-poll.ts` | `pollForAgentBlock`, the comment poll state machine. Reused by E3-T3. |
| `ops/src/spike/draft-poll.test.ts` | Drives the state machine against a fake comment source. No network. |
| `ops/src/spike/run-spike.ts` | The live two-issue golden-thread run against a real Paperclip. |
| `docs/superpowers/spikes/2026-09-30-engine-spike-log.md` | Every recorded fact: versions, Node version, config paths, session behaviour, failures. Later tasks read it. |
| `vitest.config.ts` | Adds `template/test/engine.test.ts` to the `unit` project. |

---

### Task 1: Pin the two upstream images and open the spike log

**Files:**
- Create: `template/engine/pinned-versions.json`, `docs/superpowers/spikes/2026-09-30-engine-spike-log.md`, `template/test/engine.test.ts`
- Modify: `vitest.config.ts`
- Test: `template/test/engine.test.ts`

**Interfaces:**
- Produces: `template/engine/pinned-versions.json` with the shape `{ recordedOn: string, paperclip: { image: string, tag: string, digest: string }, hermes: { image: string, tag: string, digest: string } }`. Every `digest` starts with `sha256:`. Tasks 2, 4 and 5 read this file.
- Produces: `docs/superpowers/spikes/2026-09-30-engine-spike-log.md`, an append-only record. Tasks 2, 3 and 6 append to it.

- [x] **Step 1: Write the failing test**

`template/test/engine.test.ts`:

```ts
import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';

const pinned = JSON.parse(readFileSync(new URL('../engine/pinned-versions.json', import.meta.url), 'utf8')) as {
  recordedOn: string;
  paperclip: { image: string; tag: string; digest: string };
  hermes: { image: string; tag: string; digest: string };
};

test('both engine images are pinned by digest (FLT-1, SEC-6)', () => {
  for (const name of ['paperclip', 'hermes'] as const) {
    expect(pinned[name].digest, name).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(pinned[name].image, name).not.toContain('@');
    expect(pinned[name].image, name).not.toContain(':');
  }
});

test('the pinned images are the expected upstream repositories', () => {
  expect(pinned.paperclip.image).toBe('ghcr.io/paperclipai/paperclip');
  expect(pinned.hermes.image).toBe('nousresearch/hermes-agent');
});

test('the pinning date is recorded', () => {
  expect(pinned.recordedOn).toMatch(/^\d{4}-\d{2}-\d{2}$/);
});
```

- [x] **Step 2: Add the test file to the unit project**

In `vitest.config.ts`, change the `unit` project's `include` array from:

```ts
          include: ['shared/**/*.test.ts', 'design/**/*.test.ts', 'ops/**/*.test.ts', 'template/test/compose.test.ts'],
```

to:

```ts
          include: [
            'shared/**/*.test.ts',
            'design/**/*.test.ts',
            'ops/**/*.test.ts',
            'template/test/compose.test.ts',
            'template/test/engine.test.ts',
          ],
```

`template/test/postgres-logins.test.ts` stays in the `db` project only. Do not switch the `unit` include to a `template/test/*.test.ts` glob, because that would pull the database test into the unit run.

- [x] **Step 3: Run it and confirm it fails**

Run: `pnpm test:unit`
Expected: FAIL, cannot find `../engine/pinned-versions.json`.

- [x] **Step 4: Resolve the Paperclip digest**

Paperclip publishes `ghcr.io/paperclipai/paperclip` with canonical `sha-<FULL_SHA>` tags. Pick the newest `sha-` tag and resolve it:

```bash
docker buildx imagetools inspect ghcr.io/paperclipai/paperclip:<the sha- tag>
```

Copy the `Digest:` line. If `buildx` is unavailable:

```bash
docker pull ghcr.io/paperclipai/paperclip:<the sha- tag>
docker image inspect ghcr.io/paperclipai/paperclip:<the sha- tag> --format '{{index .RepoDigests 0}}'
```

Record the command and its full output in the spike log (Step 6).

- [x] **Step 5: Resolve the Hermes digest**

Hermes publishes `nousresearch/hermes-agent` with `X.Y.Z`, `main` and `latest`/`stable` tags. Pick the newest `X.Y.Z` tag, never `latest`:

```bash
docker buildx imagetools inspect nousresearch/hermes-agent:<X.Y.Z>
```

- [x] **Step 6: Write the spike log with the recorded facts**

`docs/superpowers/spikes/2026-09-30-engine-spike-log.md`:

```markdown
# Stage 0b Engine Spike Log

Append-only. Every entry records a command and its real output, not a summary.
Plan: `docs/superpowers/plans/2026-09-30-stage-0b-engine-spike.md`.

## 1. Pinned versions

Paperclip:

- Tag chosen:
- Command:
- Digest:

Hermes:

- Tag chosen:
- Command:
- Digest:

## 2. Node version inside each image

Command: `docker run --rm --entrypoint node <ref> --version`

- Paperclip image:
- Hermes image:

PRD section 7 requires 24.11 or newer. Verdict:

## 3. Paperclip against PostgreSQL 16

(filled in Task 2)

## 4. Where Hermes reads a profile config from

(filled in Task 3)

## 5. Session behaviour across two issues

(filled in Task 6)

## 6. Failures and workarounds

(any step that did not behave as the plan expected, with the exact error)
```

- [x] **Step 7: Record the Node version in each image**

```bash
docker run --rm --entrypoint node ghcr.io/paperclipai/paperclip@<digest> --version
docker run --rm --entrypoint node nousresearch/hermes-agent@<digest> --version
```

Write both outputs into spike log section 2. If the version the engine will actually run (decided in Task 2) is below `v24.11.0`, stop and report: PRD section 7 names 24.11 as Paperclip's floor, and a lower runtime is a spec violation, not a detail to work around.

- [x] **Step 8: Write the pinned versions file**

`template/engine/pinned-versions.json`, with the real digests from Steps 4 and 5:

```json
{
  "recordedOn": "2026-09-30",
  "paperclip": {
    "image": "ghcr.io/paperclipai/paperclip",
    "tag": "sha-REPLACE_WITH_FULL_SHA",
    "digest": "sha256:REPLACE_WITH_64_HEX"
  },
  "hermes": {
    "image": "nousresearch/hermes-agent",
    "tag": "REPLACE_WITH_X.Y.Z",
    "digest": "sha256:REPLACE_WITH_64_HEX"
  }
}
```

- [x] **Step 9: Run the tests and the typecheck**

Run: `pnpm test:unit` -> Expected: all pass, including the three new engine tests.
Run: `pnpm typecheck` -> Expected: no output.

- [x] **Step 10: Commit**

```bash
git add template/engine/pinned-versions.json template/test/engine.test.ts vitest.config.ts docs/superpowers/spikes
git commit -m "feat(engine): pin the Paperclip and Hermes images by digest"
```

---

### Task 2: Build the engine image that holds both Paperclip and Hermes

**Files:**
- Create: `template/engine/Dockerfile`, `template/engine/entrypoint.sh`, `template/engine/README.md`
- Modify: `template/test/engine.test.ts`, `docs/superpowers/spikes/2026-09-30-engine-spike-log.md`
- Test: `template/test/engine.test.ts`

**Interfaces:**
- Consumes: `template/engine/pinned-versions.json` from Task 1, through the build arguments `PAPERCLIP_REF` and `HERMES_REF`, each a full `image@sha256:...` reference.
- Produces: an image whose entrypoint is `/engine/entrypoint.sh`, which copies `/engine/config/<profile>.config.yaml` to `/opt/data/profiles/<profile>/config.yaml` for `orbi` and `scout`, chowns them to uid 1000, checks that `hermes` is on `PATH`, and then hands off to Paperclip's own `tini` plus `docker-entrypoint.sh` chain.
- Produces: the writable path contract Task 4 mounts volumes for: `/paperclip` (Paperclip's own `HOME` and `PAPERCLIP_HOME`), `/opt/data` (Hermes' `HERMES_HOME`), and a tmpfs at `/tmp` (Hermes' `XDG_RUNTIME_DIR` is `/tmp/hermes-runtime`).

**Facts from Task 1 that this task must respect** (spike log sections 2, 4 and 6; do not re-guess them):

| Fact | Value |
|---|---|
| Paperclip `WorkingDir` | `/app` |
| Paperclip `Entrypoint` | `["/usr/bin/tini","--","docker-entrypoint.sh"]` |
| Paperclip `Cmd` | `["node","--import","./server/node_modules/tsx/dist/loader.mjs","server/dist/index.js"]` |
| Paperclip `User` | unset: starts as root on purpose, drops to `USER_UID=1000` in its own entrypoint |
| Paperclip `HOME` and `PAPERCLIP_HOME` | `/paperclip` |
| Paperclip Node | `24.21.0` |
| Hermes `HERMES_HOME` and `HERMES_WRITE_SAFE_ROOT` | `/opt/data` (also its declared `VOLUME`) |
| Hermes install root | `/opt/hermes`, venv at `/opt/hermes/.venv`, `PATH` entries `/opt/hermes/bin` and `/opt/hermes/.venv/bin` |
| Hermes `Entrypoint` | `["/opt/hermes/docker/entrypoint-dispatch.sh"]`, no `Cmd` |

Keep both images' own `HOME` defaults. The plan's earlier `/engine/...` layout fought them for no gain.

- [x] **Step 1: Add the failing static tests**

Append to `template/test/engine.test.ts`:

```ts
const dockerfile = readFileSync(new URL('../engine/Dockerfile', import.meta.url), 'utf8');
const entrypoint = readFileSync(new URL('../engine/entrypoint.sh', import.meta.url), 'utf8');

test('the Dockerfile takes both image refs as build args and pins nothing itself', () => {
  expect(dockerfile).toMatch(/^ARG PAPERCLIP_REF$/m);
  expect(dockerfile).toMatch(/^ARG HERMES_REF$/m);
  expect(dockerfile).not.toMatch(/FROM\s+(ghcr\.io\/paperclipai|nousresearch)/);
});

test('the Dockerfile bakes no secrets and no model key', () => {
  for (const name of ['ANTHROPIC_API_KEY', 'GMAIL_', 'RESEND_', 'TOKEN_ENCRYPTION_KEY', 'BETTER_AUTH_SECRET']) {
    expect(dockerfile, name).not.toContain(name);
  }
});

// The Paperclip image sets no USER: it starts as root and drops to USER_UID=1000 in its own
// entrypoint (spike log section 6). Asserting a non-root USER line would fail a correct build, so
// the rule is that this Dockerfile must not override the base image's privilege handling.
test('the Dockerfile does not pin a USER, leaving the base image to drop privileges (SEC-2a)', () => {
  expect(dockerfile).not.toMatch(/^USER\s/m);
});

test('the Dockerfile keeps the base entrypoint reachable rather than discarding it', () => {
  expect(dockerfile).toContain('/usr/bin/tini');
  expect(dockerfile).toContain('docker-entrypoint.sh');
});

test('the entrypoint restores both profile configs on every start (Review Focus 3)', () => {
  for (const profile of ['orbi', 'scout']) {
    expect(entrypoint).toContain(`/engine/config/${profile}.config.yaml`);
    expect(entrypoint).toContain(`/opt/data/profiles/${profile}/config.yaml`);
  }
});

test('the entrypoint hands off to the base image chain as PID 1', () => {
  expect(entrypoint).toMatch(/^exec .*tini/m);
});

test('the entrypoint fails fast rather than starting with missing config', () => {
  expect(entrypoint).toMatch(/^set -euo pipefail$/m);
});
```

- [x] **Step 2: Run it and confirm it fails**

Run: `pnpm test:unit` -> Expected: FAIL, cannot find `../engine/Dockerfile`.

- [x] **Step 3: Write the entrypoint**

`template/engine/entrypoint.sh`:

```bash
#!/usr/bin/env bash
# Starts the instance's engine container: Paperclip, with Hermes available as a local binary
# for Paperclip's hermes_local adapter (Eng v3 D3).
#
# HERMES_HOME is /opt/data and is a writable volume, so Hermes could change its own config
# between restarts. Copying the baked config over the volume on every start makes the live
# config a property of the pinned image, not of accumulated container state
# (FLT-7 "toolsets match the allowlist").
#
# This runs as root, before Paperclip's own entrypoint drops to uid 1000, which is why the
# profile directories are chowned here.
set -euo pipefail

HERMES_DATA="${HERMES_HOME:-/opt/data}"

for profile in orbi scout; do
  src="/engine/config/${profile}.config.yaml"
  dir="${HERMES_DATA}/profiles/${profile}"
  [ -f "$src" ] || { echo "engine: missing baked config $src" >&2; exit 1; }
  mkdir -p "$dir"
  cp "$src" "$dir/config.yaml"
done
chown -R "${USER_UID:-1000}:${USER_GID:-1000}" "${HERMES_DATA}/profiles"

command -v hermes >/dev/null || { echo 'engine: hermes is not on PATH' >&2; exit 1; }

# Paperclip expects tini as PID 1 and its own docker-entrypoint.sh (spike log section 6).
# Replacing that chain breaks its privilege drop and signal handling, so hand off to it.
exec /usr/bin/tini -- docker-entrypoint.sh "$@"
```

- [x] **Step 4: Write the Dockerfile, base A (Paperclip image as the base)**

Try this one first. Task 1 settled the direction: Paperclip needs Node 24.21, tini and its own entrypoint script, while the Hermes image declares no Node at all. Hermes is the self-contained side, living under `/opt/hermes` with its venv at `/opt/hermes/.venv` and its data under `/opt/data`, so Hermes is the part that moves.

`template/engine/Dockerfile`:

```dockerfile
# The instance's engine container: Paperclip plus Hermes in one image.
# Both must share a container because Paperclip's hermes_local adapter spawns a local
# hermes binary (Eng v3 D3). Refs come from template/engine/pinned-versions.json.
#
# Paperclip is the base: it carries Node 24.21, tini and the entrypoint that drops privileges.
# Hermes moves in whole, because everything it needs sits under /opt/hermes and /opt/data.
ARG PAPERCLIP_REF
ARG HERMES_REF

FROM ${HERMES_REF} AS hermes

FROM ${PAPERCLIP_REF} AS runtime

# /opt/hermes holds the CLI, its Python venv and the Playwright pack. /opt/data is Hermes' own
# data root (HERMES_HOME); it is a mount point at runtime, created here so the entrypoint can
# write into it before the volume is populated.
COPY --from=hermes /opt/hermes /opt/hermes
RUN mkdir -p /opt/data/profiles

# Hermes resolves its CLI and venv through PATH, and keys every data path off HERMES_HOME.
ENV PATH="/opt/hermes/bin:/opt/hermes/.venv/bin:${PATH}" \
    HERMES_HOME=/opt/data \
    HERMES_WRITE_SAFE_ROOT=/opt/data \
    HERMES_DISABLE_LAZY_INSTALLS=1 \
    HERMES_LAZY_INSTALL_TARGET=/opt/data/lazy-packages \
    PLAYWRIGHT_BROWSERS_PATH=/opt/hermes/.playwright \
    XDG_RUNTIME_DIR=/tmp/hermes-runtime

COPY hermes/orbi.config.yaml /engine/config/orbi.config.yaml
COPY hermes/scout.config.yaml /engine/config/scout.config.yaml
COPY entrypoint.sh /engine/entrypoint.sh
RUN chmod +x /engine/entrypoint.sh

# No USER line: the base image starts as root by design and drops to USER_UID in its own
# entrypoint (spike log section 6). PAPERCLIP_HOME stays the image default, /paperclip.
# Setting ENTRYPOINT resets the inherited CMD, so the base image's command is restated here
# verbatim and passed through by entrypoint.sh.
ENTRYPOINT ["/engine/entrypoint.sh"]
CMD ["node", "--import", "./server/node_modules/tsx/dist/loader.mjs", "server/dist/index.js"]
```

Two things this step must confirm rather than assume, because Task 1 could not read them from the image config:

1. **Whether the Hermes venv still works after the copy.** A venv hard-codes its interpreter path. If `/opt/hermes/.venv/bin/python` points at a Python that exists only in the Hermes image, the copy brings a broken venv. Check with `docker run --rm --entrypoint sh orbit-engine:spike -c 'hermes --version'` in Step 6. If it fails on a missing interpreter, copy the interpreter too by adding its directory to the `COPY --from=hermes` list; read the path from `docker run --rm --entrypoint sh <hermes ref> -c 'readlink -f /opt/hermes/.venv/bin/python; cat /opt/hermes/.venv/pyvenv.cfg'`.
2. **Whether anything Hermes needs lives outside `/opt/hermes`.** The same command shows `pyvenv.cfg`'s `home` key. Anything it names outside `/opt` has to be copied as well.

Record both answers in spike log section 6.

- [x] **Step 5: Build it**

```bash
PAPERCLIP_REF="ghcr.io/paperclipai/paperclip@$(node -e "console.log(require('./template/engine/pinned-versions.json').paperclip.digest)")"
HERMES_REF="nousresearch/hermes-agent@$(node -e "console.log(require('./template/engine/pinned-versions.json').hermes.digest)")"
docker build -t orbit-engine:spike \
  --build-arg PAPERCLIP_REF="$PAPERCLIP_REF" \
  --build-arg HERMES_REF="$HERMES_REF" \
  template/engine
```

Expected: a successful build.

- [x] **Step 6: Confirm both programs are present and runnable**

```bash
docker run --rm --entrypoint sh orbit-engine:spike -c 'hermes --version; node --version; ls /app; ls /opt/hermes'
```

Expected: a Hermes version, Node `v24.21.0`, the Paperclip application files and the Hermes install root. Record the full output in spike log section 6. A Python error here means the venv did not survive the copy; follow Step 4's note 1 before moving on.

- [x] **Step 7: If base A failed, write base B instead (Hermes image as the base)**

Only if Step 5 or Step 6 failed in a way Step 4's two notes do not fix. Record the exact failure in the spike log first, then invert the bases: Hermes as the base, with Paperclip's `/app` and the Node runtime copied in.

```dockerfile
# Base B: Hermes' own image, with Paperclip copied in.
# Used when the Hermes venv cannot be moved into the Paperclip image (see the spike log).
ARG PAPERCLIP_REF
ARG HERMES_REF

FROM ${PAPERCLIP_REF} AS paperclip

FROM ${HERMES_REF} AS runtime
COPY --from=paperclip /app /app
COPY --from=paperclip /usr/local/bin/node /usr/local/bin/node
COPY --from=paperclip /usr/bin/tini /usr/bin/tini
COPY --from=paperclip /usr/local/bin/docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
COPY hermes/orbi.config.yaml /engine/config/orbi.config.yaml
COPY hermes/scout.config.yaml /engine/config/scout.config.yaml
COPY entrypoint.sh /engine/entrypoint.sh
RUN chmod +x /engine/entrypoint.sh && mkdir -p /paperclip /opt/data/profiles
ENV HOME=/paperclip \
    PAPERCLIP_HOME=/paperclip \
    PAPERCLIP_CONFIG=/paperclip/instances/default/config.json \
    HOST=0.0.0.0 \
    PORT=3100 \
    SERVE_UI=true \
    NODE_ENV=production \
    USER_UID=1000 \
    USER_GID=1000
WORKDIR /app
ENTRYPOINT ["/engine/entrypoint.sh"]
CMD ["node", "--import", "./server/node_modules/tsx/dist/loader.mjs", "server/dist/index.js"]
```

Base B carries more risk than base A: the Paperclip image's environment has to be restated by hand (the block above is copied from spike log section 6), and `docker-entrypoint.sh` may expect packages the Hermes image lacks. Confirm the real paths of `node`, `tini` and `docker-entrypoint.sh` before building:

```bash
docker run --rm --entrypoint sh ghcr.io/paperclipai/paperclip@<digest> -c 'command -v node tini docker-entrypoint.sh'
```

Then repeat Steps 5 and 6.

- [x] **Step 8: If base B also failed, stop and report**

Write both failures into spike log section 6 and stop. Report: "`hermes_local` needs both programs in one container (Eng v3 D3). Neither image composes with the other. The options are a third base image that installs both from source, or reopening D3." Do not pick one; D3 is a founder decision.

- [x] **Step 9: Confirm Paperclip starts against PostgreSQL 16**

The instance runs one PostgreSQL 16 server with pgvector (DEP-1), while Paperclip's own compose ships PostgreSQL 17. Prove PG16 works before the compose task depends on it. The dev stack already runs on `127.0.0.1:5433` with an empty `paperclip` database and the `paperclip_app` login. Read the dev password from the compose file rather than guessing it: `grep -n PASSWORD compose.dev.yml`.

```bash
docker run --rm --network host \
  -e DATABASE_URL="postgresql://paperclip_app:<dev password>@127.0.0.1:5433/paperclip" \
  -e BETTER_AUTH_SECRET="$(openssl rand -hex 32)" \
  -e PAPERCLIP_TOOL_ACTION_SIGNING_SECRET="$(openssl rand -hex 32)" \
  -e PAPERCLIP_DEPLOYMENT_MODE=authenticated \
  -e PAPERCLIP_DEPLOYMENT_EXPOSURE=private \
  -e PAPERCLIP_PUBLIC_URL="http://127.0.0.1:3100" \
  orbit-engine:spike
```

Expected: Paperclip starts, runs its migrations and answers `curl -sS http://127.0.0.1:3100/api/health`. Record the health response in spike log section 3.

If Paperclip refuses PG16, record the exact error and stop. Report: "Paperclip requires PostgreSQL 17; DEP-1 says one server per instance. The options are moving the instance to `pgvector/pgvector:pg17` or running a second server for the `paperclip` database." Both change DEP-1, so both are founder decisions.

- [x] **Step 10: Write the engine README**

`template/engine/README.md`:

```markdown
# Engine container (Paperclip + Hermes)

One container holds both programs. Paperclip's `hermes_local` adapter spawns a local `hermes`
binary, so a Hermes on another host or in another container is unreachable (Eng v3 D3).

- Image refs are pinned by digest in `pinned-versions.json`. Nothing here uses a floating tag.
- `entrypoint.sh` copies the baked `hermes/<profile>.config.yaml` over the profile volume on
  every start, so the live Hermes config always matches the pinned image.
- Hermes profiles are `orbi` and `scout`, under `HERMES_HOME=/opt/data/profiles/<name>/`. Both
  images keep their own data roots: Paperclip writes to `/paperclip`, Hermes to `/opt/data`.
  The exact per-profile filename is recorded in the spike log, section 4; if it differs, the
  entrypoint is the one place to change.
- This container holds no Gmail token, no Resend key and no `TOKEN_ENCRYPTION_KEY`, and uses
  the `paperclip` database login only (SEC-2a). Its model key is `ENGINE_ANTHROPIC_API_KEY`
  on the host, separate from the Front Desk's key (SEC-10).
- The Hermes image ships a Playwright browser pack at `/opt/hermes/.playwright` and Paperclip
  ships other agent runtimes (`OPENCODE_ALLOW_ALL_MODELS`, `GEMINI_SANDBOX`). Nothing in ORBIT
  uses them. The posture check is what keeps them out of reach.

## When `hermes_gateway` is fixed

`TODOS.md` tracks the switch. It changes the `adapter` field for both agents in
`paperclip-adapters.json` and splits this image in two. Nothing else in the template depends
on the single-container shape.
```

- [x] **Step 11: Run the tests and the typecheck**

Run: `pnpm test:unit` -> Expected: all pass.
Run: `pnpm typecheck` -> Expected: no output.

- [x] **Step 12: Commit**

```bash
git add template/engine docs/superpowers/spikes template/test/engine.test.ts
git commit -m "feat(engine): one image for Paperclip and Hermes with a config-restoring entrypoint"
```

---

### Task 3: Hermes profiles for Orbi and Scout

**Files:**
- Create: `template/engine/hermes/orbi.config.yaml`, `template/engine/hermes/scout.config.yaml`
- Modify: `template/test/engine.test.ts`, `docs/superpowers/spikes/2026-09-30-engine-spike-log.md`
- Test: `template/test/engine.test.ts`

**Interfaces:**
- Produces: two Hermes `config.yaml` files. Both set `memory.memory_enabled: false`, `memory.user_profile_enabled: false`, `skills.write_approval: true`, `skills.auto_load: []`, `cron.enabled: false`, and an `agent.disabled_toolsets` list. Scout omits `web` from that list; Orbi includes it.
- Produces: the toolset vocabulary the posture check in Task 5 uses: `terminal`, `file`, `web`, `browser`, `code_execution`, `vision`, `mcp`, `creative`, `productivity`, `memory`.

- [x] **Step 1: Record where Hermes reads a profile config from**

The two upstream documents disagree. The configuration reference says a profile maps to a sibling directory (`hermes -p work` reads `~/.hermes-work/`), while the Docker guide says profiles live under `/opt/data/profiles/<name>/`. Settle it against the built image:

```bash
docker run --rm --entrypoint sh orbit-engine:spike -c 'hermes --help; hermes config --help 2>&1 | head -40'
docker run --rm --entrypoint sh orbit-engine:spike -c 'HERMES_PROFILE=scout hermes config show 2>&1 | head -40'
```

Write the exact output and the resolved path into spike log section 4. Task 1 already established that Hermes keys its data off `HERMES_HOME=/opt/data`, so the expected path is `/opt/data/profiles/scout/config.yaml`. What is still unknown is whether a profile's config file is named `config.yaml` inside that directory or something else. If the resolved path differs, change the two destination paths in `entrypoint.sh` and the matching assertions in `template/test/engine.test.ts` to the real path, and note the change in the log. Do not leave the entrypoint writing to a path Hermes never reads; a config that is never loaded is the silent failure this task exists to prevent.

- [x] **Step 2: Add the failing tests**

Append to `template/test/engine.test.ts`:

```ts
import { parse } from 'yaml';

type HermesConfig = {
  memory?: { memory_enabled?: boolean; user_profile_enabled?: boolean };
  skills?: { write_approval?: boolean; auto_load?: string[] };
  agent?: { disabled_toolsets?: string[] };
  cron?: { enabled?: boolean };
};

const ALL_TOOLSETS = [
  'terminal',
  'file',
  'web',
  'browser',
  'code_execution',
  'vision',
  'mcp',
  'creative',
  'productivity',
  'memory',
] as const;

const profiles = {
  orbi: parse(readFileSync(new URL('../engine/hermes/orbi.config.yaml', import.meta.url), 'utf8')) as HermesConfig,
  scout: parse(readFileSync(new URL('../engine/hermes/scout.config.yaml', import.meta.url), 'utf8')) as HermesConfig,
};

test.each(['orbi', 'scout'] as const)('%s has persistent memory off (S4/D6)', (name) => {
  expect(profiles[name].memory?.memory_enabled).toBe(false);
  expect(profiles[name].memory?.user_profile_enabled).toBe(false);
});

test.each(['orbi', 'scout'] as const)('%s cannot write its own skills (CEO R7)', (name) => {
  expect(profiles[name].skills?.write_approval).toBe(true);
  expect(profiles[name].skills?.auto_load).toEqual([]);
});

test('scout may use web and nothing else (SEC-2a)', () => {
  const disabled = profiles.scout.agent?.disabled_toolsets ?? [];
  expect([...disabled].sort()).toEqual(ALL_TOOLSETS.filter((t) => t !== 'web').sort());
});

test('orbi may use no Hermes toolset; its issue tools come from Paperclip (SEC-2a)', () => {
  const disabled = profiles.orbi.agent?.disabled_toolsets ?? [];
  expect([...disabled].sort()).toEqual([...ALL_TOOLSETS].sort());
});

test.each(['orbi', 'scout'] as const)('%s runs no schedule of its own (COST-2, FLT-7)', (name) => {
  expect(profiles[name].cron?.enabled).toBe(false);
});
```

- [x] **Step 3: Run it and confirm it fails**

Run: `pnpm test:unit` -> Expected: FAIL, cannot find `../engine/hermes/orbi.config.yaml`.

- [x] **Step 4: Write Scout's profile**

`template/engine/hermes/scout.config.yaml`:

```yaml
# Scout's Hermes profile. Scout reads hostile lead email, so everything it does not need is off.
# Hermes profiles do not sandbox the filesystem (SEC-2a), which is why the container boundary in
# template/compose.yml carries the rest of the containment.
model: anthropic/claude-sonnet-5

memory:
  # No cross-lead memory: each draft is written from that lead's own email, the owner's tone
  # samples and the facts file (Eng v3 D6).
  memory_enabled: false
  user_profile_enabled: false

skills:
  # Scout cannot write itself new abilities (CEO R7).
  write_approval: true
  auto_load: []

agent:
  # Allowlist by subtraction: web search and fetch stay, everything else goes (SEC-2a).
  disabled_toolsets:
    - terminal
    - file
    - browser
    - code_execution
    - vision
    - mcp
    - creative
    - productivity
    - memory

cron:
  # No heartbeats. Scout wakes on assignment and comments only (COST-2).
  enabled: false
```

- [x] **Step 5: Write Orbi's profile**

`template/engine/hermes/orbi.config.yaml`:

```yaml
# Orbi's Hermes profile. Orbi reads unclear leads and stuck drafts and answers with a verdict.
# It needs no Hermes toolset at all: its issue actions come from Paperclip, not from Hermes.
model: anthropic/claude-sonnet-5

memory:
  memory_enabled: false
  user_profile_enabled: false

skills:
  write_approval: true
  auto_load: []

agent:
  disabled_toolsets:
    - terminal
    - file
    - web
    - browser
    - code_execution
    - vision
    - mcp
    - creative
    - productivity
    - memory

cron:
  # Orbi's Friday routine is a Paperclip routine, not a Hermes cron job (COST-2).
  enabled: false
```

- [x] **Step 6: Confirm Hermes accepts both configs**

```bash
docker build -t orbit-engine:spike \
  --build-arg PAPERCLIP_REF="$PAPERCLIP_REF" \
  --build-arg HERMES_REF="$HERMES_REF" \
  template/engine
docker run --rm --entrypoint sh orbit-engine:spike -c 'HERMES_PROFILE=scout hermes config show 2>&1 | head -40'
```

Expected: the shown config reports memory off and the disabled toolsets. Record it in spike log section 4. If Hermes rejects or ignores a key name, correct the key to what Hermes reports, update the `HermesConfig` type and the assertions in Step 2 to match, and note the correction in the log. Do not keep a key Hermes ignores: it would read as containment that is not there.

`memory`, `skills` and `agent.disabled_toolsets` come from the Hermes configuration reference. `cron.enabled` does not: the reference documents a `~/.hermes/cron/` directory but no config key that turns scheduling off. Check this key specifically against `hermes config show`. If Hermes has no such key, find the real control (an empty cron directory, a CLI flag, or nothing at all), use it, and change the `cron_enabled` rule in Task 5 to assert whatever actually holds. If scheduling cannot be turned off from config, record that and drop the `cron_enabled` rule rather than asserting a key that does nothing; COST-2 is then enforced by Paperclip's heartbeat setting alone, which Task 6 Step 5 confirms.

- [x] **Step 7: Run the tests and the typecheck**

Run: `pnpm test:unit` -> Expected: all pass.
Run: `pnpm typecheck` -> Expected: no output.

- [x] **Step 8: Commit**

```bash
git add template/engine/hermes template/test/engine.test.ts docs/superpowers/spikes
git commit -m "feat(engine): Hermes profiles for Orbi and Scout with memory off and a toolset allowlist"
```

---

### Task 4: Add the engine service to the instance template (E3-T2)

**Files:**
- Create: `template/engine/paperclip-adapters.json`
- Modify: `template/compose.yml`, `template/.env.example`, `template/test/compose.test.ts`, `template/test/engine.test.ts`
- Test: `template/test/compose.test.ts`, `template/test/engine.test.ts`

**Interfaces:**
- Consumes: `template/engine/Dockerfile` and its build arguments from Task 2.
- Produces: a `paperclip` service in `template/compose.yml` with `read_only: true`, the volumes `paperclip_home`, `hermes_orbi`, `hermes_scout`, a `tmpfs` at `/tmp`, networks `[data, egress]`, one published port `127.0.0.1:3100:3100`, and `DATABASE_URL` using the `paperclip_app` login.
- Produces: the host variable names `PAPERCLIP_REF`, `HERMES_REF`, `PAPERCLIP_AUTH_SECRET`, `PAPERCLIP_SIGNING_SECRET`, `PAPERCLIP_PUBLIC_URL`, `ENGINE_ANTHROPIC_API_KEY`.
- Produces: `template/engine/paperclip-adapters.json` with the shape `{ "<agent>": { adapter, provider, toolsets, maxTurnsPerRun, persistSession, worktreeMode, checkpoints, timeoutSec, graceSec, quiet } }`. Task 5 asserts it; E3-T7 applies it.

- [x] **Step 1: Write the failing compose tests**

In `template/test/compose.test.ts`, widen the `Service` type:

```ts
type Service = {
  ports?: string[];
  networks?: string[];
  environment?: Record<string, string>;
  healthcheck?: unknown;
  read_only?: boolean;
  volumes?: string[];
  tmpfs?: string[];
};
```

Replace:

```ts
test('the stack defines the four programs, Postgres and Redis', () => {
  expect(Object.keys(services).sort()).toEqual(['api', 'frontdesk', 'postgres', 'redis', 'web', 'worker']);
});
```

with:

```ts
test('the stack defines the four programs, Postgres, Redis and the engine', () => {
  expect(Object.keys(services).sort()).toEqual([
    'api',
    'frontdesk',
    'paperclip',
    'postgres',
    'redis',
    'web',
    'worker',
  ]);
});
```

Replace:

```ts
test('only frontdesk receives Gmail credentials and the model key (SEC-2, SEC-10)', () => {
  for (const [name, svc] of Object.entries(services)) {
    const keys = Object.keys(svc.environment ?? {});
    const secret = keys.filter((k) => k.startsWith('GMAIL_') || k === 'ANTHROPIC_API_KEY' || k === 'TOKEN_ENCRYPTION_KEY');
    if (name === 'frontdesk') expect(secret.length).toBe(4);
    else expect(secret, name).toEqual([]);
  }
});
```

with:

```ts
test('only frontdesk receives Gmail credentials and the token key (SEC-2)', () => {
  for (const [name, svc] of Object.entries(services)) {
    const keys = Object.keys(svc.environment ?? {});
    const secret = keys.filter((k) => k.startsWith('GMAIL_') || k === 'TOKEN_ENCRYPTION_KEY');
    if (name === 'frontdesk') {
      expect(secret.sort()).toEqual(['GMAIL_CLIENT_ID', 'GMAIL_CLIENT_SECRET', 'TOKEN_ENCRYPTION_KEY']);
    } else {
      expect(secret, name).toEqual([]);
    }
  }
});

test('the engine and the Front Desk hold separate model keys (SEC-10)', () => {
  expect(services.frontdesk!.environment!.ANTHROPIC_API_KEY).toBe('${ANTHROPIC_API_KEY:?}');
  expect(services.paperclip!.environment!.ANTHROPIC_API_KEY).toBe('${ENGINE_ANTHROPIC_API_KEY:?}');
});

test('no service but api and worker holds the Resend key (SEC-2a)', () => {
  for (const [name, svc] of Object.entries(services)) {
    if (name === 'api' || name === 'worker') continue;
    expect(Object.keys(svc.environment ?? {}), name).not.toContain('RESEND_API_KEY');
  }
});

test('the engine uses the paperclip database login only (SEC-2a)', () => {
  const url = services.paperclip!.environment!.DATABASE_URL!;
  expect(url).toContain('paperclip_app');
  expect(url).toContain('/paperclip');
  expect(url).not.toContain('orbit_app');
});

test('the engine root filesystem is read-only, with a volume for every writable path (Review Focus 2)', () => {
  const engine = services.paperclip!;
  expect(engine.read_only).toBe(true);
  const targets = (engine.volumes ?? []).map((v) => v.split(':')[1]);
  expect(targets).toEqual(
    expect.arrayContaining(['/paperclip', '/opt/data']),
  );
  expect(engine.tmpfs).toEqual(['/tmp']);
});

test('the engine runs in private authenticated mode (DEP-5)', () => {
  expect(services.paperclip!.environment!.PAPERCLIP_DEPLOYMENT_MODE).toBe('authenticated');
  expect(services.paperclip!.environment!.PAPERCLIP_DEPLOYMENT_EXPOSURE).toBe('private');
});

test('the Front Desk reaches the engine over the internal network, with no key in the template', () => {
  expect(services.frontdesk!.environment!.PAPERCLIP_API_URL).toBe('http://paperclip:3100');
  expect(Object.keys(services.frontdesk!.environment ?? {})).not.toContain('PAPERCLIP_API_KEY');
});
```

The published-port test and the `data` network test already in this file cover the engine once it exists; do not duplicate them.

- [x] **Step 2: Run them and confirm they fail**

Run: `pnpm test:unit` -> Expected: FAIL, `services.paperclip` is undefined.

- [x] **Step 3: Add the engine service to the compose file**

In `template/compose.yml`, add after the `redis` service:

```yaml
  paperclip:
    # The engine: Paperclip plus Hermes in one container (Eng v3 D3). No Gmail token, no Resend
    # key, no TOKEN_ENCRYPTION_KEY, and the paperclip database login only (SEC-2a).
    build:
      context: ./engine
      args:
        PAPERCLIP_REF: ${PAPERCLIP_REF:?}
        HERMES_REF: ${HERMES_REF:?}
    restart: unless-stopped
    read_only: true # SEC-2a; every writable path below is a named volume
    environment:
      HOST: 0.0.0.0
      DATABASE_URL: postgresql://paperclip_app:${PAPERCLIP_DB_PASSWORD:?}@postgres:5432/paperclip
      PAPERCLIP_DEPLOYMENT_MODE: authenticated # DEP-5
      PAPERCLIP_DEPLOYMENT_EXPOSURE: private # DEP-5
      PAPERCLIP_PUBLIC_URL: ${PAPERCLIP_PUBLIC_URL:?}
      BETTER_AUTH_SECRET: ${PAPERCLIP_AUTH_SECRET:?}
      PAPERCLIP_TOOL_ACTION_SIGNING_SECRET: ${PAPERCLIP_SIGNING_SECRET:?}
      ANTHROPIC_API_KEY: ${ENGINE_ANTHROPIC_API_KEY:?} # its own key, not the Front Desk's (SEC-10)
    volumes:
      - paperclip_home:/paperclip # the image's own HOME and PAPERCLIP_HOME
      - hermes_data:/opt/data # HERMES_HOME: both profiles, their sessions and logs
    tmpfs: ["/tmp"] # Hermes' XDG_RUNTIME_DIR is /tmp/hermes-runtime
    ports: ["127.0.0.1:3100:3100"] # reached over the host's tailnet only (SEC-1, DEP-5)
    networks: [data, egress] # data to reach Postgres and the Front Desk; egress for model calls
    depends_on:
      postgres: { condition: service_healthy }
    healthcheck:
      test: ["CMD", "node", "-e", "fetch('http://127.0.0.1:3100/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]
      interval: 10s
      timeout: 3s
      retries: 10
```

Add `PAPERCLIP_API_URL` to the `frontdesk` service's environment, after `REDIS_URL`:

```yaml
      PAPERCLIP_API_URL: http://paperclip:3100
```

Replace the `volumes:` block at the end of the file with:

```yaml
volumes:
  pgdata: {}
  paperclip_home: {} # Paperclip data; DEC-2 wipes it with `docker compose down -v`
  hermes_data: {} # HERMES_HOME: both profiles, sessions and logs (DAT-3 purge target, E3-T5)
```

- [x] **Step 4: Add the engine variable names to the example env file**

Append to `template/.env.example`:

```
PAPERCLIP_REF=
HERMES_REF=
PAPERCLIP_PUBLIC_URL=
PAPERCLIP_AUTH_SECRET=
PAPERCLIP_SIGNING_SECRET=
ENGINE_ANTHROPIC_API_KEY=
```

- [x] **Step 5: Write the adapter configuration file**

`template/engine/paperclip-adapters.json`:

```json
{
  "orbi": {
    "adapter": "hermes_local",
    "provider": "anthropic",
    "toolsets": "",
    "maxTurnsPerRun": 20,
    "persistSession": true,
    "worktreeMode": false,
    "checkpoints": false,
    "timeoutSec": 600,
    "graceSec": 10,
    "quiet": true
  },
  "scout": {
    "adapter": "hermes_local",
    "provider": "anthropic",
    "toolsets": "web",
    "maxTurnsPerRun": 30,
    "persistSession": true,
    "worktreeMode": false,
    "checkpoints": false,
    "timeoutSec": 600,
    "graceSec": 10,
    "quiet": true
  }
}
```

`timeoutSec` is 600 because D5 gives a draft 10 minutes before the poll times out and hands the lead to Orbi; a longer engine timeout would keep a run alive after ORBIT stopped waiting. `maxTurnsPerRun` values are COST-3. `persistSession` is `true` because D7 wants one session per issue; Task 6 verifies what that actually keys on.

- [x] **Step 6: Add the adapter assertions**

Append to `template/test/engine.test.ts`:

```ts
const adapters = JSON.parse(
  readFileSync(new URL('../engine/paperclip-adapters.json', import.meta.url), 'utf8'),
) as Record<string, { adapter: string; toolsets: string; maxTurnsPerRun: number; timeoutSec: number; persistSession: boolean }>;

test('both agents run on hermes_local until the upstream gateway fix (Eng v3 D3)', () => {
  expect(Object.keys(adapters).sort()).toEqual(['orbi', 'scout']);
  for (const [name, cfg] of Object.entries(adapters)) expect(cfg.adapter, name).toBe('hermes_local');
});

test('turn caps match COST-3', () => {
  expect(adapters.orbi!.maxTurnsPerRun).toBe(20);
  expect(adapters.scout!.maxTurnsPerRun).toBe(30);
});

test('the adapter toolsets match the profile allowlist (SEC-2a)', () => {
  expect(adapters.scout!.toolsets).toBe('web');
  expect(adapters.orbi!.toolsets).toBe('');
});

test('the engine run timeout does not outlive the 10-minute draft poll (D5)', () => {
  for (const [name, cfg] of Object.entries(adapters)) expect(cfg.timeoutSec, name).toBeLessThanOrEqual(600);
});
```

- [x] **Step 7: Run the tests and the typecheck**

Run: `pnpm test:unit` -> Expected: all pass.
Run: `pnpm typecheck` -> Expected: no output.

- [x] **Step 8: Start the full template stack and confirm the engine survives the read-only filesystem**

Create a throwaway `template/.env` from `template/.env.example` with generated values. Never commit it; the repo already ignores env files at any depth.

```bash
docker compose -f template/compose.yml --env-file template/.env up -d --build --wait
docker compose -f template/compose.yml --env-file template/.env ps
curl -sS http://127.0.0.1:3100/api/health
```

Expected: every service healthy, including `paperclip`, and a healthy response from the API.

If the engine crash-loops, read its logs:

```bash
docker compose -f template/compose.yml --env-file template/.env logs paperclip | tail -40
```

Add whatever path it could not write as a named volume in the compose file and to the `arrayContaining` list in the read-only test, so the next person inherits the finding. Record it in spike log section 6.

- [x] **Step 9: Confirm the engine has no route to the Gmail or Resend credentials**

```bash
docker compose -f template/compose.yml --env-file template/.env exec paperclip env | grep -Ei 'gmail|resend|token_encryption' || echo clean
```

Expected: `clean`.

- [x] **Step 10: Commit**

```bash
git add template/compose.yml template/.env.example template/engine/paperclip-adapters.json template/test
git commit -m "feat(template): engine service with read-only root, own model key and paperclip login"
```

---

### Task 5: The posture check (E3-T2 verify, FLT-7)

**Files:**
- Create: `ops/src/posture.ts`, `ops/src/posture-check.ts`, `ops/src/posture.test.ts`
- Modify: `package.json`, `.github/workflows/ci.yml`
- Test: `ops/src/posture.test.ts`

**Interfaces:**
- Consumes: the parsed `template/compose.yml` engine service, the two parsed Hermes profile configs, and `template/engine/paperclip-adapters.json`.
- Produces: `checkEnginePosture(input: PostureInput): PostureFinding[]`, returning an empty array when the posture holds. `PostureFinding` is `{ code: PostureCode; detail: string }`; `PostureCode` is the string-literal union listed in Step 3. E3-T7 calls this function against a provisioned instance.

- [ ] **Step 1: Write the failing tests**

`ops/src/posture.test.ts`:

```ts
import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { parse } from 'yaml';
import { checkEnginePosture, type PostureInput } from './posture.ts';

const compose = parse(readFileSync(new URL('../../template/compose.yml', import.meta.url), 'utf8'), {
  merge: true,
}) as { services: Record<string, { environment: Record<string, string>; read_only: boolean; volumes: string[]; ports: string[] }> };
const engine = compose.services.paperclip!;
const profile = (name: string) =>
  parse(readFileSync(new URL(`../../template/engine/hermes/${name}.config.yaml`, import.meta.url), 'utf8'));

const real: PostureInput = {
  engine: {
    environment: engine.environment,
    readOnlyRootFs: engine.read_only,
    volumeTargets: engine.volumes.map((v) => v.split(':')[1]!),
    ports: engine.ports,
  },
  profiles: { orbi: profile('orbi'), scout: profile('scout') },
  adapters: JSON.parse(readFileSync(new URL('../../template/engine/paperclip-adapters.json', import.meta.url), 'utf8')),
};

// Each test mutates its own copy.
const clone = (): PostureInput => structuredClone(real);
const codes = (input: PostureInput) => checkEnginePosture(input).map((f) => f.code);

test('the shipped template passes', () => {
  expect(checkEnginePosture(real)).toEqual([]);
});

test('a Gmail secret in the engine container fails the check (E3-T2 verify)', () => {
  const input = clone();
  input.engine.environment.GMAIL_CLIENT_SECRET = '${GMAIL_CLIENT_SECRET:?}';
  expect(codes(input)).toContain('engine_holds_forbidden_secret');
});

test('a Resend key in the engine container fails the check', () => {
  const input = clone();
  input.engine.environment.RESEND_API_KEY = '${RESEND_API_KEY:?}';
  expect(codes(input)).toContain('engine_holds_forbidden_secret');
});

test('the ORBIT database login in the engine container fails the check (SEC-2a)', () => {
  const input = clone();
  input.engine.environment.DATABASE_URL = 'postgresql://orbit_app:pw@postgres:5432/orbit';
  expect(codes(input)).toContain('engine_wrong_db_login');
});

test('a terminal toolset on Scout fails the check (E3-T2 verify)', () => {
  const input = clone();
  const scout = input.profiles.scout as { agent: { disabled_toolsets: string[] } };
  scout.agent.disabled_toolsets = scout.agent.disabled_toolsets.filter((t) => t !== 'terminal');
  expect(codes(input)).toContain('toolset_not_allowed');
});

test('an omitted memory key fails the check, because Hermes defaults it on (Review Focus 1)', () => {
  const input = clone();
  delete (input.profiles.orbi as { memory?: unknown }).memory;
  expect(codes(input)).toContain('memory_not_disabled');
});

test('allowing skill writes fails the check (Review Focus 3, CEO R7)', () => {
  const input = clone();
  (input.profiles.scout as { skills: { write_approval: boolean } }).skills.write_approval = false;
  expect(codes(input)).toContain('skill_writes_allowed');
});

test('a Hermes cron schedule fails the check (COST-2)', () => {
  const input = clone();
  (input.profiles.orbi as { cron: { enabled: boolean } }).cron.enabled = true;
  expect(codes(input)).toContain('cron_enabled');
});

test('a writable root filesystem fails the check', () => {
  const input = clone();
  input.engine.readOnlyRootFs = false;
  expect(codes(input)).toContain('engine_root_fs_writable');
});

test('a missing data volume fails the check (Review Focus 2)', () => {
  const input = clone();
  input.engine.volumeTargets = input.engine.volumeTargets.filter((t) => t !== '/paperclip');
  expect(codes(input)).toContain('engine_missing_data_volume');
});

test('a publicly bound engine port fails the check (SEC-1, DEP-5)', () => {
  const input = clone();
  input.engine.ports = ['0.0.0.0:3100:3100'];
  expect(codes(input)).toContain('engine_port_public');
});

test('switching an agent off hermes_local fails the check until TODOS says otherwise (D3)', () => {
  const input = clone();
  (input.adapters.scout as { adapter: string }).adapter = 'hermes_gateway';
  expect(codes(input)).toContain('adapter_not_pinned');
});

test('a turn cap above COST-3 fails the check', () => {
  const input = clone();
  (input.adapters.scout as { maxTurnsPerRun: number }).maxTurnsPerRun = 500;
  expect(codes(input)).toContain('turn_cap_too_high');
});

test('every finding carries a detail a human can act on', () => {
  const input = clone();
  input.engine.environment.GMAIL_CLIENT_SECRET = 'x';
  for (const finding of checkEnginePosture(input)) expect(finding.detail.length).toBeGreaterThan(10);
});
```

- [ ] **Step 2: Run them and confirm they fail**

Run: `pnpm test:unit` -> Expected: FAIL, cannot load `./posture.ts`.

- [ ] **Step 3: Implement the posture function**

`ops/src/posture.ts`:

```ts
// FLT-7 posture report, engine section. Pure: callers read the files and pass the values in, so
// the same function checks the repo template in CI and a provisioned instance during ops.
// SEC-6: drift found here blocks an instance from being marked healthy.

export type PostureCode =
  | 'engine_holds_forbidden_secret'
  | 'engine_wrong_db_login'
  | 'engine_root_fs_writable'
  | 'engine_missing_data_volume'
  | 'engine_port_public'
  | 'toolset_not_allowed'
  | 'memory_not_disabled'
  | 'skill_writes_allowed'
  | 'cron_enabled'
  | 'adapter_not_pinned'
  | 'turn_cap_too_high';

export type PostureFinding = { code: PostureCode; detail: string };

export type PostureInput = {
  engine: {
    environment: Record<string, string>;
    readOnlyRootFs: boolean;
    volumeTargets: string[];
    ports: string[];
  };
  profiles: Record<'orbi' | 'scout', unknown>;
  adapters: Record<'orbi' | 'scout', unknown>;
};

const AGENTS = ['orbi', 'scout'] as const;
type Agent = (typeof AGENTS)[number];

// Every Hermes toolset. The allowlist is expressed by subtraction, so a toolset added upstream
// must be added here too, or it would pass unnoticed.
const ALL_TOOLSETS = [
  'terminal',
  'file',
  'web',
  'browser',
  'code_execution',
  'vision',
  'mcp',
  'creative',
  'productivity',
  'memory',
] as const;

const ALLOWED_TOOLSETS: Record<Agent, readonly string[]> = { orbi: [], scout: ['web'] };
const TURN_CAPS: Record<Agent, number> = { orbi: 20, scout: 30 }; // COST-3
// Both upstream images keep their own data roots (spike log sections 4 and 6). Without these two
// mounts a read-only root filesystem stops the container on first boot.
const REQUIRED_VOLUMES = ['/paperclip', '/opt/data'];

function isForbiddenSecret(key: string): boolean {
  return key.startsWith('GMAIL_') || key.startsWith('RESEND_') || key === 'TOKEN_ENCRYPTION_KEY';
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};
}

export function checkEnginePosture(input: PostureInput): PostureFinding[] {
  const findings: PostureFinding[] = [];
  const add = (code: PostureCode, detail: string) => findings.push({ code, detail });

  for (const key of Object.keys(input.engine.environment)) {
    if (isForbiddenSecret(key)) {
      add('engine_holds_forbidden_secret', `the engine container must not hold ${key} (SEC-2a)`);
    }
  }

  const url = input.engine.environment.DATABASE_URL ?? '';
  if (!url.includes('paperclip_app') || !url.endsWith('/paperclip')) {
    add('engine_wrong_db_login', 'the engine must use the paperclip_app login on the paperclip database (SEC-2a)');
  }

  if (!input.engine.readOnlyRootFs) {
    add('engine_root_fs_writable', 'the engine root filesystem must be read-only except its data volumes (SEC-2a)');
  }

  for (const target of REQUIRED_VOLUMES) {
    if (!input.engine.volumeTargets.includes(target)) {
      add('engine_missing_data_volume', `${target} must be a named volume or the engine cannot start (SEC-2a)`);
    }
  }

  for (const port of input.engine.ports) {
    if (!port.startsWith('127.0.0.1:')) {
      add('engine_port_public', `engine port ${port} must bind 127.0.0.1 and be reached over the tailnet (SEC-1, DEP-5)`);
    }
  }

  for (const agent of AGENTS) {
    const profile = asRecord(input.profiles[agent]);

    // Hermes defaults memory_enabled and user_profile_enabled to true, so an absent key is on.
    const memory = asRecord(profile.memory);
    if (memory.memory_enabled !== false || memory.user_profile_enabled !== false) {
      add('memory_not_disabled', `${agent} must set memory.memory_enabled and memory.user_profile_enabled to false (D6)`);
    }

    const skills = asRecord(profile.skills);
    const autoLoad = skills.auto_load;
    if (skills.write_approval !== true || !Array.isArray(autoLoad) || autoLoad.length !== 0) {
      add('skill_writes_allowed', `${agent} must set skills.write_approval true and skills.auto_load empty (CEO R7)`);
    }

    if (asRecord(profile.cron).enabled !== false) {
      add('cron_enabled', `${agent} must set cron.enabled false; the only schedule is the Friday routine (COST-2)`);
    }

    const disabled = asRecord(profile.agent).disabled_toolsets;
    const disabledList = Array.isArray(disabled) ? (disabled as string[]) : [];
    for (const toolset of ALL_TOOLSETS) {
      if (!ALLOWED_TOOLSETS[agent].includes(toolset) && !disabledList.includes(toolset)) {
        add('toolset_not_allowed', `${agent} must disable the ${toolset} toolset (SEC-2a)`);
      }
    }

    const adapter = asRecord(input.adapters[agent]);
    if (adapter.adapter !== 'hermes_local') {
      add('adapter_not_pinned', `${agent} must run on hermes_local until the upstream fix lands (D3, TODOS.md)`);
    }
    const cap = adapter.maxTurnsPerRun;
    if (typeof cap !== 'number' || cap > TURN_CAPS[agent]) {
      add('turn_cap_too_high', `${agent} must cap turns at ${TURN_CAPS[agent]} per run (COST-3)`);
    }
  }

  return findings;
}
```

- [ ] **Step 4: Run the tests and confirm they pass**

Run: `pnpm test:unit` -> Expected: all pass.

- [ ] **Step 5: Write the CLI**

`ops/src/posture-check.ts`:

```ts
// Reads the instance template and prints the FLT-7 engine findings. Exits 1 on any finding, so
// CI and the provisioning script can both gate on it (SEC-6).
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { checkEnginePosture, type PostureInput } from './posture.ts';

const root = new URL('../../template/', import.meta.url);
const read = (path: string) => readFileSync(new URL(path, root), 'utf8');

const compose = parse(read('compose.yml'), { merge: true }) as {
  services: Record<string, { environment?: Record<string, string>; read_only?: boolean; volumes?: string[]; ports?: string[] }>;
};
const engine = compose.services.paperclip;
if (!engine) {
  console.error('posture: the template has no paperclip service');
  process.exit(1);
}

const input: PostureInput = {
  engine: {
    environment: engine.environment ?? {},
    readOnlyRootFs: engine.read_only === true,
    volumeTargets: (engine.volumes ?? []).map((v) => v.split(':')[1] ?? ''),
    ports: engine.ports ?? [],
  },
  profiles: {
    orbi: parse(read('engine/hermes/orbi.config.yaml')),
    scout: parse(read('engine/hermes/scout.config.yaml')),
  },
  adapters: JSON.parse(read('engine/paperclip-adapters.json')),
};

const findings = checkEnginePosture(input);
for (const finding of findings) console.error(`${finding.code}: ${finding.detail}`);
console.log(findings.length === 0 ? 'posture: engine section passes' : `posture: ${findings.length} finding(s)`);
process.exit(findings.length === 0 ? 0 : 1);
```

- [ ] **Step 6: Add the script**

In the root `package.json` `scripts`, after `resend:check`:

```json
"posture:check": "pnpm --filter @orbit/ops exec node --import tsx src/posture-check.ts"
```

- [ ] **Step 7: Run it**

Run: `pnpm posture:check`
Expected: `posture: engine section passes`, exit 0.

- [ ] **Step 8: Add it to CI**

In `.github/workflows/ci.yml`, immediately after the step that runs `pnpm test:unit`:

```yaml
      - name: Posture check (FLT-7 engine section)
        run: pnpm posture:check
```

- [ ] **Step 9: Run the full suite and the typecheck**

Run: `pnpm test:unit` -> Expected: all pass.
Run: `pnpm typecheck` -> Expected: no output.

- [ ] **Step 10: Commit**

```bash
git add ops/src/posture.ts ops/src/posture-check.ts ops/src/posture.test.ts package.json .github/workflows/ci.yml
git commit -m "feat(ops): FLT-7 engine posture check with a CI gate"
```

---

### Task 6: The golden-thread spike run (E3-T1 verify, D7)

**Files:**
- Create: `ops/src/spike/draft-poll.ts`, `ops/src/spike/draft-poll.test.ts`, `ops/src/spike/run-spike.ts`
- Modify: `package.json`, `docs/superpowers/spikes/2026-09-30-engine-spike-log.md`
- Test: `ops/src/spike/draft-poll.test.ts`

**Interfaces:**
- Consumes: `parseAgentComment`, `type Draft`, `type Verdict` from `shared/src/agent-output.ts`.
- Produces:

```ts
export type Comment = { id: string; body: string; authorIsAgent: boolean };
export type CommentSource = (
  afterCommentId: string | undefined,
) => Promise<{ ok: true; comments: Comment[] } | { ok: false; status: number; code?: string }>;
export type PollOutcome =
  | { state: 'ok'; block: Draft | Verdict }
  | { state: 'invalid'; error: string; corrected: boolean }
  | { state: 'timeout' }
  | { state: 'error'; status: number; code?: string };
export function pollForAgentBlock(opts: {
  source: CommentSource;
  expected: 'draft' | 'verdict';
  onCorrection: (error: string) => Promise<void>;
  intervalMs: number;
  timeoutMs: number;
  now: () => number;
  sleep: (ms: number) => Promise<void>;
}): Promise<PollOutcome>;
```

E3-T3 reuses `pollForAgentBlock` unchanged; `run-spike.ts` is the only throwaway part.

- [ ] **Step 1: Write the failing tests**

`ops/src/spike/draft-poll.test.ts`:

```ts
import { expect, test, vi } from 'vitest';
import { pollForAgentBlock, type CommentSource } from './draft-poll.ts';

const VALID_DRAFT = [
  'Here is the draft.',
  '```json',
  JSON.stringify({
    kind: 'draft',
    schemaVersion: 1,
    draft: 'Thanks for reaching out. Happy to help with the lease review.',
    category: 'reply',
    flags: [],
    reason: 'standard enquiry, no commercial terms',
  }),
  '```',
].join('\n');

function harness(source: CommentSource, onCorrection = vi.fn(async () => {})) {
  let clock = 0;
  return {
    onCorrection,
    run: () =>
      pollForAgentBlock({
        source,
        expected: 'draft',
        onCorrection,
        intervalMs: 15_000,
        timeoutMs: 600_000,
        now: () => clock,
        sleep: async (ms: number) => {
          clock += ms;
        },
      }),
  };
}

test('an empty comment list reads as pending, not as a failure (Review Focus 5)', async () => {
  let calls = 0;
  const source: CommentSource = async () => {
    calls += 1;
    return calls < 3
      ? { ok: true, comments: [] }
      : { ok: true, comments: [{ id: 'c1', body: VALID_DRAFT, authorIsAgent: true }] };
  };
  const h = harness(source);
  await expect(h.run()).resolves.toMatchObject({ state: 'ok' });
  expect(h.onCorrection).not.toHaveBeenCalled();
});

test('a valid draft returns the parsed block', async () => {
  const source: CommentSource = async () => ({
    ok: true,
    comments: [{ id: 'c1', body: VALID_DRAFT, authorIsAgent: true }],
  });
  const result = await harness(source).run();
  expect(result).toMatchObject({ state: 'ok' });
  if (result.state === 'ok' && result.block.kind === 'draft') expect(result.block.category).toBe('reply');
});

test('a malformed draft is corrected exactly once, then gives up (D5)', async () => {
  let calls = 0;
  const source: CommentSource = async () => {
    calls += 1;
    return { ok: true, comments: [{ id: `c${calls}`, body: 'no json here', authorIsAgent: true }] };
  };
  const h = harness(source);
  const result = await h.run();
  expect(h.onCorrection).toHaveBeenCalledTimes(1);
  expect(result).toMatchObject({ state: 'invalid', corrected: true });
});

test('comments from the board, not the agent, are ignored', async () => {
  let calls = 0;
  const source: CommentSource = async () => {
    calls += 1;
    return calls === 1
      ? { ok: true, comments: [{ id: 'c1', body: 'owner note', authorIsAgent: false }] }
      : { ok: true, comments: [{ id: 'c2', body: VALID_DRAFT, authorIsAgent: true }] };
  };
  const h = harness(source);
  await expect(h.run()).resolves.toMatchObject({ state: 'ok' });
  expect(h.onCorrection).not.toHaveBeenCalled();
});

test('a 403 cross_issue_influence_run_context_required surfaces at once (Review Focus 4)', async () => {
  const source: CommentSource = async () => ({
    ok: false,
    status: 403,
    code: 'cross_issue_influence_run_context_required',
  });
  const h = harness(source);
  const result = await h.run();
  expect(result).toEqual({ state: 'error', status: 403, code: 'cross_issue_influence_run_context_required' });
  expect(h.onCorrection).not.toHaveBeenCalled();
});

test('silence past the timeout reads as timeout (D5)', async () => {
  const source: CommentSource = async () => ({ ok: true, comments: [] });
  await expect(harness(source).run()).resolves.toEqual({ state: 'timeout' });
});
```

- [ ] **Step 2: Run them and confirm they fail**

Run: `pnpm test:unit` -> Expected: FAIL, cannot load `./draft-poll.ts`.

- [ ] **Step 3: Implement the poll**

`ops/src/spike/draft-poll.ts`:

```ts
// The comment poll from Eng v3 D5: every 15 s until a valid agent block arrives, one corrective
// comment on a malformed block, and a 10-minute ceiling. Clock and sleep are injected so tests
// run instantly and E3-T3 can drive it from a worker job.
import { parseAgentComment, type Draft, type Verdict } from '../../../shared/src/agent-output.ts';

export type Comment = { id: string; body: string; authorIsAgent: boolean };
export type CommentSource = (
  afterCommentId: string | undefined,
) => Promise<{ ok: true; comments: Comment[] } | { ok: false; status: number; code?: string }>;

export type PollOutcome =
  | { state: 'ok'; block: Draft | Verdict }
  | { state: 'invalid'; error: string; corrected: boolean }
  | { state: 'timeout' }
  | { state: 'error'; status: number; code?: string };

export async function pollForAgentBlock(opts: {
  source: CommentSource;
  expected: 'draft' | 'verdict';
  onCorrection: (error: string) => Promise<void>;
  intervalMs: number;
  timeoutMs: number;
  now: () => number;
  sleep: (ms: number) => Promise<void>;
}): Promise<PollOutcome> {
  const deadline = opts.now() + opts.timeoutMs;
  let after: string | undefined;
  let corrected = false;

  while (opts.now() < deadline) {
    const page = await opts.source(after);
    // An API refusal is a broken setup, not a slow agent: surface it instead of waiting out the
    // timeout, which would hide the real cause behind a generic hand-off to Orbi.
    if (!page.ok) return { state: 'error', status: page.status, code: page.code };

    for (const comment of page.comments) {
      after = comment.id;
      if (!comment.authorIsAgent) continue;

      const parsed = parseAgentComment(comment.body, opts.expected);
      if (parsed.ok) return { state: 'ok', block: parsed.block };

      if (corrected) return { state: 'invalid', error: parsed.error, corrected: true };
      corrected = true;
      await opts.onCorrection(parsed.error);
    }

    await opts.sleep(opts.intervalMs);
  }

  return { state: 'timeout' };
}
```

- [ ] **Step 4: Run the tests and confirm they pass**

Run: `pnpm test:unit` -> Expected: all pass.

- [ ] **Step 5: Create the company and hire both agents by hand**

The provisioning script that does this is E3-T7, not this task. For the spike, use the Paperclip UI on `http://127.0.0.1:3100` with the stack from Task 4 Step 8 running:

1. Complete the first-run sign-in (authenticated mode, private exposure).
2. Create one company. Record its id.
3. Hire two agents named `orbi` and `scout`. Record both agent ids.
4. On each agent, set the adapter to `hermes_local` and copy every field from `template/engine/paperclip-adapters.json` for that agent.
5. Set a per-agent budget (COST-1) and confirm heartbeats are off (COST-2).
6. Create a service API key and export it as `PAPERCLIP_API_KEY` in your shell. Never write it into a file in the repo.

Record the company id, both agent ids and every adapter field as the UI finally shows it in spike log section 5. If the UI refuses to save `hermes_local`, that contradicts D3's premise: record the exact error and stop. Report it, because it reopens D3.

- [ ] **Step 6: Write the live spike script**

`ops/src/spike/run-spike.ts`:

```ts
// Live two-issue run against a real Paperclip (E3-T1 verify, D7). Throwaway: the durable parts
// are draft-poll.ts and the shared schema. Reads PAPERCLIP_API_URL, PAPERCLIP_API_KEY,
// PAPERCLIP_COMPANY_ID and PAPERCLIP_SCOUT_AGENT_ID from the environment.
import { pollForAgentBlock, type CommentSource } from './draft-poll.ts';

const { PAPERCLIP_API_URL, PAPERCLIP_API_KEY, PAPERCLIP_COMPANY_ID, PAPERCLIP_SCOUT_AGENT_ID } = process.env;
if (!PAPERCLIP_API_URL || !PAPERCLIP_API_KEY || !PAPERCLIP_COMPANY_ID || !PAPERCLIP_SCOUT_AGENT_ID) {
  console.error('Set PAPERCLIP_API_URL, PAPERCLIP_API_KEY, PAPERCLIP_COMPANY_ID and PAPERCLIP_SCOUT_AGENT_ID');
  process.exit(1);
}

const headers = { Authorization: `Bearer ${PAPERCLIP_API_KEY}`, 'Content-Type': 'application/json' };
const CANARY = 'ORBIT-CANARY-A7F3';

// The output contract Scout must follow. E3-T3 turns this into the real prompt; keeping it here
// proves the shared schema and the engine agree before any Front Desk code exists.
function description(lead: string, canary: string | null): string {
  return [
    'A prospective client sent this message to the firm:',
    '',
    lead,
    '',
    canary ? `Reference code for this enquiry: ${canary}` : '',
    '',
    'Write a reply for the owner to review. Do not send anything.',
    'Post exactly one comment on this issue holding exactly one ```json fenced block:',
    '```json',
    '{"kind":"draft","schemaVersion":1,"draft":"<the reply>","category":"reply","flags":[],"reason":"<one line>"}',
    '```',
    'In "reason", list every reference code you have seen in this conversation so far, or the word "none".',
  ].join('\n');
}

async function createIssue(title: string, body: string): Promise<string> {
  const res = await fetch(`${PAPERCLIP_API_URL}/api/companies/${PAPERCLIP_COMPANY_ID}/issues`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      title,
      description: body,
      status: 'todo',
      priority: 'high',
      assigneeAgentId: PAPERCLIP_SCOUT_AGENT_ID,
    }),
  });
  if (!res.ok) throw new Error(`create issue failed: ${res.status} ${await res.text()}`);
  const json = (await res.json()) as { id: string };
  return json.id;
}

function source(issueId: string): CommentSource {
  return async (after) => {
    const url = new URL(`${PAPERCLIP_API_URL}/api/issues/${issueId}/comments`);
    url.searchParams.set('order', 'asc');
    if (after) url.searchParams.set('afterCommentId', after);
    const res = await fetch(url, { headers });
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { code?: string };
      return { ok: false, status: res.status, code: body.code };
    }
    const json = (await res.json()) as { comments: { id: string; body: string; authorAgentId?: string }[] };
    return {
      ok: true,
      comments: json.comments.map((c) => ({ id: c.id, body: c.body, authorIsAgent: Boolean(c.authorAgentId) })),
    };
  };
}

async function correct(issueId: string, error: string): Promise<void> {
  await fetch(`${PAPERCLIP_API_URL}/api/issues/${issueId}/comments`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      body: `The previous comment could not be read: ${error}. Post one corrected json block.`,
      reopen: true,
    }),
  });
}

async function run(title: string, lead: string, canary: string | null) {
  const issueId = await createIssue(title, description(lead, canary));
  console.log(`issue ${issueId}: created`);
  const outcome = await pollForAgentBlock({
    source: source(issueId),
    expected: 'draft',
    onCorrection: (error) => correct(issueId, error),
    intervalMs: 15_000,
    timeoutMs: 600_000,
    now: () => Date.now(),
    sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
  });
  console.log(`issue ${issueId}: ${JSON.stringify(outcome)}`);
  return outcome;
}

const first = await run(
  'Lead A: lease review enquiry',
  'Hi, we need help reviewing a commercial lease before Friday. What would that cost?',
  CANARY,
);
const second = await run(
  'Lead B: company formation enquiry',
  'Hello, I want to set up a limited company this month. Can you help?',
  null,
);

const leaked = second.state === 'ok' && JSON.stringify(second.block).includes(CANARY);
console.log(leaked ? `SESSION LEAK: lead B saw ${CANARY}` : 'session isolation: lead B saw no lead A reference');
process.exit(first.state === 'ok' && second.state === 'ok' && !leaked ? 0 : 1);
```

- [ ] **Step 7: Add the script**

In the root `package.json` `scripts`:

```json
"spike:run": "pnpm --filter @orbit/ops exec node --import tsx src/spike/run-spike.ts"
```

- [ ] **Step 8: Run the live spike**

With the stack from Task 4 Step 8 still up and the four variables exported:

```bash
pnpm spike:run
```

Expected: both issues reach `{"state":"ok"}` and the last line reads `session isolation: lead B saw no lead A reference`.

- [ ] **Step 9: Record what the session actually did (D7)**

This is the decision the spike exists to settle. Record all three in spike log section 5:

1. The two full outcome lines from Step 8.
2. Whether lead B's `reason` field mentioned the lead A reference code.
3. What is on disk afterwards:

```bash
docker compose -f template/compose.yml --env-file template/.env exec paperclip \
  sh -c 'ls -la /opt/data/profiles/scout; find /opt/data -name "*.db" -o -name "sessions" 2>/dev/null'
```

Then write one of these verdicts, in these words:

- **D7 holds:** lead B saw nothing from lead A. `persistSession: true` keys per issue. No change needed.
- **D7 at risk:** lead B saw lead A's reference code. `persistSession: true` shares a session across issues. Stop and report: the choices are `persistSession: false` (D7 option B, retries start cold) or a per-issue key the adapter does not document. Both change an approved decision, so neither is yours to take.

If the session store is a single SQLite database rather than per-session files, write that down too, in these words: "E3-T5 and TODOS.md say 'Hermes session files'. The store is `<the real path>`, a SQLite database. The 90-day purge must delete rows, not files." Task 7 carries that into `TODOS.md`.

- [ ] **Step 10: Run the full suite, the typecheck and the posture check**

Run: `pnpm test:unit` -> Expected: all pass.
Run: `pnpm typecheck` -> Expected: no output.
Run: `pnpm posture:check` -> Expected: `posture: engine section passes`.

- [ ] **Step 11: Commit**

```bash
git add ops/src/spike package.json docs/superpowers/spikes
git commit -m "feat(ops): comment poll state machine and the live two-issue engine spike"
```

---

### Task 7: Close the spike and carry the findings forward

**Files:**
- Modify: `TODOS.md`, `docs/superpowers/spikes/2026-09-30-engine-spike-log.md`, `template/engine/README.md`

**Interfaces:**
- Consumes: every recorded fact in the spike log.
- Produces: a `## Verdict` section in the spike log, and `TODOS.md` corrected where the spike contradicted it.

- [ ] **Step 1: Write the verdict section**

Append to `docs/superpowers/spikes/2026-09-30-engine-spike-log.md`:

```markdown
## Verdict against the PRD section 18 row 0b exit criterion

| Exit criterion | Result | Evidence |
|---|---|---|
| A Scout run posts a JSON draft comment on a Paperclip issue | | Task 6 Step 8 output |
| A second issue starts an empty session | | Task 6 Step 9 verdict |
| Posture check passes | | `pnpm posture:check` output |

Carried into Stage 1 (E3-T3): the prompt text in `ops/src/spike/run-spike.ts` is the seed of the
real Scout prompt, and `ops/src/spike/draft-poll.ts` is the poll it reuses.
```

Fill each Result cell with pass or fail and the evidence that supports it. A blank cell means an unfinished task, not a pass.

- [ ] **Step 2: Correct TODOS.md where the spike contradicted it**

The TODO "Build the 90-day retention job and Hermes session purge" says "Hermes session-file purge". If Task 6 Step 9 found a SQLite session store, replace that phrase in its **What** and **Context** paragraphs with the real shape, keep the rest of the entry as it is, and add one line to **Context**: "Stage 0b found the store at `<path>`: a SQLite database, so the purge deletes rows, not files."

The TODO "Switch Scout and Orbi to the `hermes_gateway` adapter" has no file list. Add the real files now that they exist: `template/engine/paperclip-adapters.json` (the `adapter` field on both agents), `template/engine/Dockerfile` and `template/engine/README.md`.

- [ ] **Step 3: Add anything the spike learned to the engine README**

If the Hermes profile path, the Paperclip application directory or the start command differed from this plan's guesses, correct `template/engine/README.md` so the next reader sees the real values, not the guesses.

- [ ] **Step 4: Run every check one last time**

```bash
pnpm typecheck
pnpm test:unit
ORBIT_DB_HOST_PORT=5433 pnpm test:db
pnpm posture:check
```

Expected: all green.

- [ ] **Step 5: Commit**

```bash
git add TODOS.md docs/superpowers/spikes template/engine/README.md
git commit -m "docs(engine): record the Stage 0b spike verdict and correct the retention TODO"
```

---

## Stage 0b exit check

| Criterion (PRD section 18 row 0b) | How to confirm |
|---|---|
| Paperclip company with Orbi and Scout via `hermes_local` at pinned versions | `template/engine/pinned-versions.json` merged; spike log section 5 names the company and both agents |
| Toolset allowlist | `pnpm posture:check` passes; `ops/src/posture.test.ts` proves it fails when a terminal toolset is added |
| Memory off | `ops/src/posture.test.ts` proves it fails when the memory key is removed |
| Per-issue session | spike log section 5 verdict |
| Paperclip and Hermes on Node 24 | spike log section 2 |
| A Scout run posts a JSON draft comment | `pnpm spike:run` output in spike log section 5 |
| A second issue starts an empty session | the canary line in the same output |
| Posture check passes | CI `posture:check` step green on `main` |
| The engine container holds no Gmail or Resend secret | Task 4 Step 9 output; `ops/src/posture.test.ts` |

FLT-7 has two more rows that this stage does not cover, by design: "the Front Desk static checks pass" is E3-T6, and "versions match the template" needs a provisioned instance to compare against, which is E3-T7. `checkEnginePosture` is the engine section only; those two tasks add their own sections beside it.

## Open questions (listed, not decided)

1. **PostgreSQL 16 against Paperclip.** DEP-1 says one server per instance, and the instance runs PG16 with pgvector, while Paperclip's own compose ships PG17. Task 2 Step 9 tests it. If Paperclip refuses PG16, the choice between moving the instance to PG17 and running a second server is a founder decision.
2. **Whether `persistSession: true` keys per issue.** D7 assumes it does. The adapter documents `persistSession` but no session-key strategy for `hermes_local`. Task 6 Step 9 measures it; a negative result reopens D7.
3. **Which base image carries both programs.** Task 2 tries Hermes-as-base first and Paperclip-as-base second. If neither builds, D3's premise fails and the single-container shape has to be revisited.
4. **How the operator reaches the Paperclip UI.** This plan publishes `127.0.0.1:3100` and leaves the tailnet exposure to the host, because DEP-5 says tailnet-only and SEC-1 says published ports bind to loopback. Whether that is a Tailscale serve on the host or something else belongs to the provisioning work (E3-T7), not here.
5. **The engine's own model key.** SEC-10 gives the engine its own key, so an instance now needs two Anthropic keys. Whether both come from one Anthropic account as separate keys, or the engine key is bought per customer, affects COST-6 and is not settled here.
6. **Whether `web` is one toolset or two.** SEC-2a says "web search and web fetch only", but the adapter's toolset vocabulary has a single `web` entry covering both. This plan allows `web` for Scout. If search and fetch ever need separating (the S3 research/draft split in `TODOS.md` assumes they can be), that needs a finer-grained control than `disabled_toolsets` offers.
