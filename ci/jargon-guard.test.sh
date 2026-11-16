#!/usr/bin/env bash
# Self-test for jargon-guard.sh.
#
# The guard's value is entirely in telling visible copy apart from identifiers. If it
# cannot, the team will either disable it or start renaming identifiers the PRD forbids
# renaming. These cases pin that distinction down.
set -uo pipefail

here="$(cd "$(dirname "$0")" && pwd)"
guard="$here/jargon-guard.sh"
fx="$here/fixtures/jargon"

pass=0; fail=0
expect() {
    local want="$1" name="$2"; shift 2
    local out status
    out="$(bash "$guard" "$@" 2>&1)"; status=$?
    if [ "$status" -eq "$want" ]; then
        printf '  ok    %s (exit %d)\n' "$name" "$status"; pass=$((pass + 1))
    else
        printf '  FAIL  %s — wanted exit %d, got %d\n' "$name" "$want" "$status"
        printf '%s\n' "$out" | sed 's/^/        /'; fail=$((fail + 1))
    fi
}

printf 'jargon-guard self-test\n'

expect 0 "plain-language screen passes"                 "$fx/clean"
expect 1 "jargon on a main screen FAILS"                "$fx/dirty"
expect 0 "Advanced panel may carry technical values"    "$fx/clean/advanced"
# CHANGED 2026-11-16 — see brand-check.test.sh case 5 for the whole reason. In short: this
# guard's DEFAULT root did not exist in the repo it used to live in, so EVERY run was the
# "absent root" case, and exit 2 read as "no dashboard yet" instead of "wrong repository".
expect 1 "absent root FAILS, it does not report 'not yet'" "$fx/does-not-exist"

# The distinction the whole guard rests on: identifiers must never trip it.
tmp="$(mktemp -d 2>/dev/null || mktemp -d -t orbitcrew-jargon)"
trap 'rm -rf "$tmp"' EXIT

mkdir -p "$tmp/identifiers"
cat > "$tmp/identifiers/client.ts" <<'TS'
import { adapterRegistry } from "@paperclipai/hermes-paperclip-adapter";
export const ADAPTER_TYPE = "hermes_local";
export const registryKey = ADAPTER_TYPE;
export const yamlConfigPath = "/paperclip/.hermes/config.yaml";
export async function listAdapters() { return adapterRegistry.all(); }
TS
expect 0 "identifiers, imports and API keys do not trip it" "$tmp/identifiers"

mkdir -p "$tmp/copy"
cat > "$tmp/copy/Screen.tsx" <<'TSX'
export const Screen = () => <p>Pick an adapter for this agent.</p>;
TSX
expect 1 "the same word in visible copy DOES trip it" "$tmp/copy"

# The documented escape hatch has to work, or people will delete the guard.
mkdir -p "$tmp/hatch"
cat > "$tmp/hatch/Screen.tsx" <<'TSX'
export const Screen = () => (
  <div>
    <p>Everything is running normally.</p>
    <code>adapter: hermes_local</code> {/* jargon-guard:advanced */}
  </div>
);
TSX
expect 0 "jargon-guard:advanced marker exempts a line" "$tmp/hatch"

# Prose is scanned too, since in-product help is customer-facing.
mkdir -p "$tmp/prose"
printf 'Open the registry and edit the YAML file.\n' > "$tmp/prose/help.md"
expect 1 "jargon in .md help text FAILS" "$tmp/prose"

# --- the gap: local-model names slipped through -------------------------------
# `llama-[0-9]` needs a hyphen-then-digit, so it matched neither `ollama` nor
# `qwen2.5:7b`. A local model identifier is no less an identifier than a hosted one.

mkdir -p "$tmp/local-model"
cat > "$tmp/local-model/Screen.tsx" <<'TSX'
export const Screen = () => <p>This agent runs on qwen2.5:7b.</p>;
TSX
expect 1 "a local model identifier in visible copy FAILS" "$tmp/local-model"

mkdir -p "$tmp/local-runtime"
cat > "$tmp/local-runtime/Screen.tsx" <<'TSX'
export const Screen = () => <p>Served by Ollama on your own hardware.</p>;
TSX
expect 1 "a local runtime name in visible copy FAILS (case-insensitive)" "$tmp/local-runtime"

mkdir -p "$tmp/local-md"
printf 'Point the agent at ollama and pick qwen2.5:7b.\n' > "$tmp/local-md/help.md"
expect 1 "local model names in .md help text FAIL" "$tmp/local-md"

# The Advanced escape hatch must still work for them, or the value has nowhere to live.
mkdir -p "$tmp/local-advanced/advanced"
cat > "$tmp/local-advanced/advanced/Panel.tsx" <<'TSX'
export const Panel = () => <code>qwen2.5:7b</code>;
TSX
expect 0 "a local model identifier under advanced/ is exempt" "$tmp/local-advanced"

# And the plain-words copy we actually propose must pass.
mkdir -p "$tmp/local-plain"
cat > "$tmp/local-plain/Screen.tsx" <<'TSX'
export const Screen = () => (
  <div>
    <h2>Where it runs</h2>
    <p>On your own hardware.</p>
    <p>On our shared service.</p>
  </div>
);
TSX
expect 0 "the plain-words tier copy passes" "$tmp/local-plain"

printf '\n%d passed, %d failed\n' "$pass" "$fail"
[ "$fail" -eq 0 ] || exit 1
printf 'jargon-guard.sh separates visible copy from identifiers, and is proven to fail.\n'
