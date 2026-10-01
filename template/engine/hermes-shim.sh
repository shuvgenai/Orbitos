#!/usr/bin/env bash
# Compatibility shim between the pinned Paperclip and the pinned Hermes.
#
# Paperclip's hermes_local adapter passes `--source tool` on every run
# (packages/adapters/hermes/src/server/execute.ts), with the comment "Requires hermes-agent >=
# PR #3255 (feat/session-source-tag)". No published Hermes image has that flag: neither
# v2026.9.24 nor main accept it, and Hermes then parses the value as a command and exits 1:
#
#   hermes: 'tool' is not a `hermes` command. Did you mean: tools?
#
# The adapter reads its binary from config.hermesCommand / config.command, so pointing both agents
# at this shim fixes the skew without forking either upstream (Eng v3 D3 ruled out a fork).
#
# It drops only the one flag that is known-missing and passes everything else through untouched,
# so a future Hermes that gains --source keeps working and this file can simply be deleted.
# Remove it when `hermes --help` lists --source.
set -euo pipefail

args=()
while [ "$#" -gt 0 ]; do
  case "$1" in
    --source)
      # drop the flag and its value
      shift
      [ "$#" -gt 0 ] && shift
      ;;
    --source=*)
      shift
      ;;
    *)
      args+=("$1")
      shift
      ;;
  esac
done

exec hermes "${args[@]}"
