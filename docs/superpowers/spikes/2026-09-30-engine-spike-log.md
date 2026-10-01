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

(filled in Task 2 Step 9)

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
destinations change. The exact per-profile subdirectory still has to be read from a running container
in Task 3 Step 1.

The bundled Playwright browser pack is worth noting against SEC-2a: the `browser` toolset must stay
disabled, and the posture check is the thing that proves it.

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

Open after Task 1, to settle in Task 2:

- Base image choice. The plan ordered base A (Hermes as base, copy Paperclip in) first. That order is
  now wrong: Paperclip needs Node 24.21, tini and its own entrypoint script, and the Hermes image
  advertises no Node at all. Hermes, by contrast, is self-contained under `/opt/hermes` with its venv
  at `/opt/hermes/.venv` and a declared data volume at `/opt/data`. Base B (Paperclip as base, copy
  `/opt/hermes` in) is the better first attempt.
- Whether the Hermes Python virtual environment survives the copy into the Paperclip image, which
  depends on the interpreter the venv points at.
