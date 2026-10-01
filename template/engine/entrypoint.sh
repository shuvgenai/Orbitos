#!/usr/bin/env bash
# Starts the instance's engine container: Paperclip, with Hermes available as a local binary
# for Paperclip's hermes_local adapter (Eng v3 D3).
#
# HERMES_HOME is /opt/data and is a writable volume, so Hermes could change its own config
# between restarts. Copying the baked config over the volume on every start makes the live
# config a property of the pinned image, not of accumulated container state
# (FLT-7 "toolsets match the allowlist").
#
# This runs as root, before Paperclip's own entrypoint drops to USER_UID, which is why the
# profile directories are chowned here.
set -euo pipefail

HERMES_DATA="${HERMES_HOME:-/opt/data}"

ENGINE_UID="${USER_UID:-1000}"
ENGINE_GID="${USER_GID:-1000}"

for profile in orbi scout; do
  src="/engine/config/${profile}.config.yaml"
  dir="${HERMES_DATA}/profiles/${profile}"
  [ -f "$src" ] || { echo "engine: missing baked config $src" >&2; exit 1; }
  mkdir -p "$dir"
  cp "$src" "$dir/config.yaml"
done

# Hermes creates cron/, memories/, skills/, sessions/ and logs/ under HERMES_HOME on first run, so
# HERMES_HOME itself must be writable by the uid Paperclip runs the adapter as. Without this the
# CLI dies with "Cannot initialize Hermes directory /opt/data/cron: Permission denied".
# The top level is chowned flat and only profiles recursively, so start-up time does not grow with
# the session history the volume accumulates.
chown "${ENGINE_UID}:${ENGINE_GID}" "${HERMES_DATA}"
chown -R "${ENGINE_UID}:${ENGINE_GID}" "${HERMES_DATA}/profiles"

command -v hermes >/dev/null || { echo 'engine: hermes is not on PATH' >&2; exit 1; }

# Paperclip expects tini as PID 1 and its own docker-entrypoint.sh, which is what drops
# privileges and handles signals. Absolute paths: docker-entrypoint.sh is not reliably on PATH.
exec /usr/bin/tini -- /usr/local/bin/docker-entrypoint.sh "$@"
