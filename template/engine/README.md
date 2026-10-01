# Engine container (Paperclip + Hermes)

One container holds both programs. Paperclip's `hermes_local` adapter spawns a local `hermes`
binary, so a Hermes on another host or in another container is unreachable (Eng v3 D3).

Every value here was measured against the pinned images, not read from documentation. The
measurements are in `docs/superpowers/spikes/2026-09-30-engine-spike-log.md`.

## Shape

- Image refs are pinned by digest in `pinned-versions.json`. Nothing uses a floating tag.
- Paperclip is the base. It carries Node 24.21.0, `tini`, and
  `/usr/local/bin/docker-entrypoint.sh`, which is what drops privileges to `USER_UID` (1000).
- Hermes is copied in whole from `/opt/hermes`. Both images are Debian 13 with CPython 3.13.5 at
  `/usr/bin/python3`, which is the interpreter the Hermes venv points at (`pyvenv.cfg` has
  `home = /usr/bin`), so the venv survives the copy.
- `entrypoint.sh` runs as root, copies the baked `hermes/<profile>.config.yaml` into
  `$HERMES_HOME/profiles/<profile>/config.yaml`, makes `$HERMES_HOME` writable by uid 1000, then
  `exec`s `tini -- docker-entrypoint.sh "$@"`. Setting `ENTRYPOINT` resets the inherited `CMD`, so
  the Dockerfile restates Paperclip's command verbatim.
- Writable paths, all volumes in `template/compose.yml`: `/paperclip` (Paperclip's own `HOME` and
  `PAPERCLIP_HOME`), `/opt/data` (`HERMES_HOME`), and a tmpfs at `/tmp`
  (`XDG_RUNTIME_DIR=/tmp/hermes-runtime`).

## Things that will bite you

- **Profiles are selected with `-p <name>`, not `HERMES_PROFILE`.** The env var is ignored: with it
  set, Hermes still reads `$HERMES_HOME/config.yaml`. With `-p scout` it reads
  `$HERMES_HOME/profiles/scout/config.yaml`. Setting `HERMES_HOME` per run works too. The
  `hermes_local` adapter has no profile field, so per-agent config must go through the adapter's
  `extraArgs` (`["-p","scout"]`) or its `env` map (`HERMES_HOME=/opt/data/profiles/scout`).
- **`$HERMES_HOME` must be writable by uid 1000.** Hermes creates `cron/`, `memories/`, `skills/`,
  `sessions/` and `logs/` under it on first run and dies with
  `Cannot initialize Hermes directory /opt/data/cron: Permission denied` otherwise. Both the
  Dockerfile and the entrypoint set that ownership; a fresh named volume inherits it from the image.
- **`/opt/hermes/bin/hermes` is a privilege-drop shim.** Invoked as root it needs
  `/command/s6-setuidgid` from the Hermes image's s6 overlay, which is not copied here, and refuses
  to run. Invoked as any non-root uid it short-circuits to `/opt/hermes/.venv/bin/hermes`. Paperclip
  runs the adapter as uid 1000, so this is fine; a `docker exec` as root is not. Debug with
  `docker exec --user 1000:1000`.
- **The adapter always passes `--yolo`**, which turns off Hermes' dangerous-command approval
  prompts. Its own comment says agents "operate in a sandbox", but Hermes profiles do not sandbox
  the filesystem. The toolset allowlist and this container boundary are the only things left
  (SEC-2a, Eng v3 D4), which is why the posture check is not optional.
- **Paperclip enables heartbeats by default** (30 s) and automatic database backups (hourly, 7-day
  retention, into `/paperclip/instances/default/data/backups`). COST-2 says no heartbeats, so both
  have to be turned off per instance.
- **The image has no `ps`.** Read `/proc/<pid>/cmdline` instead.
- The Hermes image also ships a Playwright browser pack at `/opt/hermes/.playwright`, and Paperclip
  ships other agent runtimes (`OPENCODE_ALLOW_ALL_MODELS`, `GEMINI_SANDBOX`). Nothing in ORBIT uses
  them. The posture check keeps them out of reach.

## Size

The built image is 8.82 GB uncompressed. That is a per-instance cost against DEP-1's "one small
VPS per customer" and the COST-6 unit-economics check.

## When `hermes_gateway` is fixed

`TODOS.md` tracks the switch. It changes the `adapter` field for both agents in
`paperclip-adapters.json` and splits this image in two. Nothing else in the template depends on the
single-container shape.
