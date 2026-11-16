#!/usr/bin/env bash
# Jargon guard — PRD: "The dashboard never shows the words Paperclip, Hermes, adapter,
# registry, YAML, or a model identifier on a main screen. […] Technical values belong in an
# Advanced panel. A jargon-guard test runs in CI alongside the brand check."
#
#   ./jargon-guard.sh [dir ...]        default: orbitcrew/dashboard
#
# WHAT IT SCANS, AND WHY IT IS NOT A PLAIN GREP
# `adapterType` is an identifier the PRD forbids renaming; "Choose an adapter" is a
# violation. A plain grep cannot tell them apart and would force the team to either ignore
# the guard or rename identifiers. So this matches only user-visible text:
#
#   * JSX/HTML text between tags            <p>Pick an adapter</p>
#   * copy-bearing props                    label="Adapter"  placeholder="…"  hint="…"
#   * prose in .md and .txt
#
# It deliberately does NOT match import paths, type names, object keys or API routes.
#
# ESCAPE HATCH. Technical values are allowed in an Advanced panel: anything under a
# directory named `advanced`, a file named `*advanced*`, or a line carrying the marker
# `jargon-guard:advanced`. The attribution page is exempt too — MIT requires the upstream
# names there.
#
# Exit 0 clean, 1 on findings, 2 on a usage or environment error.
set -uo pipefail

# MOVED HERE FROM THE INFRA REPO, 2026-11-16 — see brand-check.sh for the whole reason.
# Short version: the default was `orbitcrew/dashboard`, a path that does not exist there and
# never will, so this reported INCONCLUSIVE on every run while the dashboard sat here.
#
# WHAT IS AND IS NOT A DEFAULT ROOT, and why:
#   * `src/apps/user`, `src/apps/org-admin`, `src/apps/landing` — the customer surfaces.
#   * `dashboards` — the entry HTML, which carries each `<title>`.
#   * `src/apps/fleet` is DELIBERATELY ABSENT. It is the operator console, where technical
#     values are the subject matter; `customer-surface.test.ts` encodes the same exemption.
#   * `src/shared` is absent: shared machinery, not copy.
#   * This repo's own `.md` files are absent. The PRD and the Build Prompts say "Paperclip"
#     and "adapter" hundreds of times, correctly — they are internal documents, not customer
#     copy. Pass a path explicitly to scan one.
ROOTS=("$@")
[ "${#ROOTS[@]}" -eq 0 ] && ROOTS=("src/apps/user" "src/apps/org-admin" "src/apps/landing" "dashboards")

# Plain words that must not appear in customer-facing copy.
JARGON='adapter|registry|yaml|webhook|stdout|stderr|env var|environment variable'

# Model identifiers. The PRD bans these from main screens; they belong in Advanced.
#
# `llama-[0-9]` requires a hyphen-then-digit, so it matched neither `ollama` (no hyphen)
# nor `qwen2.5:7b` (no "llama" at all). Local-model names are exactly as much a model
# identifier as a hosted one, and a local runtime is as much a technical value as a
# provider — so both are named explicitly here. Matching is case-insensitive below, which
# is what catches "Ollama" as well as "ollama".
MODELS='claude-[a-z0-9.-]+|gpt-[0-9a-z.-]+|sonnet|haiku|opus|anthropic|openai|llama-[0-9]|ollama|qwen[a-z0-9.:-]*'

# Upstream product names, in display form. The brand check covers built output; this
# covers dashboard source so a reviewer sees it before it is ever built.
BRANDS='Paper''clip|Her''mes'

ALLOW_RE='(^|/)(\.git|node_modules|dist)/|(^|/)[^/]*advanced[^/]*(/|$)|open-source-components|attribution|(^|/)orbitcrew/ci/[^/]*\.sh$|\.map$'

findings=0
scanned=0
found=0
missing=0

report() { printf 'JARGON  %s:%s  [%s]\n' "$1" "$2" "$3"; findings=$((findings + 1)); }

scan_file() {
    local file="$1" ext="${1##*.}"
    local -a lines=()

    case "$ext" in
        md|txt)
            # Prose: every line is visible, minus fenced code and inline code spans.
            mapfile -t lines < <(grep -nv '^[[:space:]]*```' "$file" 2>/dev/null | sed 's/`[^`]*`//g')
            ;;
        tsx|jsx|html|htm|svelte|vue)
            # JSX/HTML text nodes, plus copy-bearing props.
            # sort -u: a line can match both patterns (JSX text AND a copy prop), which
            # would otherwise report the same string twice and inflate the count.
            mapfile -t lines < <(
                {
                    grep -nE '>[^<>{}]*[A-Za-z]{3}[^<>{}]*<' "$file" 2>/dev/null
                    grep -nEi '(label|title|placeholder|hint|description|aria-label|alt|heading|subtitle|tooltip|caption|message|error)[[:space:]]*=[[:space:]]*["'"'"'][^"'"'"']+' "$file" 2>/dev/null
                } | sort -t: -k1,1n -u
            )
            ;;
        ts|js)
            # Only copy-bearing props/keys, never identifiers or imports.
            mapfile -t lines < <(
                grep -nEi '(label|title|placeholder|hint|description|message|error|heading)[[:space:]]*[:=][[:space:]]*["'"'"'][^"'"'"']+' "$file" 2>/dev/null
            )
            ;;
        *) return ;;
    esac

    scanned=$((scanned + 1))

    local entry num text
    for entry in "${lines[@]}"; do
        [ -n "$entry" ] || continue
        num="${entry%%:*}"; text="${entry#*:}"
        case "$text" in *jargon-guard:advanced*) continue ;; esac

        printf '%s' "$text" | grep -qiE "\\b($JARGON)\\b"  && report "$file" "$num" "jargon: $(printf '%s' "$text" | grep -oiE "\\b($JARGON)\\b" | head -1)"
        printf '%s' "$text" | grep -qiE "\\b($MODELS)\\b"  && report "$file" "$num" "model id: $(printf '%s' "$text" | grep -oiE "\\b($MODELS)\\b" | head -1)"
        printf '%s' "$text" | grep -qE  "($BRANDS)"        && report "$file" "$num" "upstream name: $(printf '%s' "$text" | grep -oE "($BRANDS)" | head -1)"
    done
}

for root in "${ROOTS[@]}"; do
    if [ ! -e "$root" ]; then
        # NOT a skip — see brand-check.sh.
        printf 'jargon-guard: FAIL — root does not exist: %s\n' "$root" >&2
        printf 'Looked from: %s\n' "$(pwd)" >&2
        exit 1
    fi
    if [ -f "$root" ]; then
        printf '%s' "$root" | grep -Eq "$ALLOW_RE" || scan_file "$root"
        continue
    fi
    while IFS= read -r file; do
        # Counted BEFORE the allowlist -- see brand-check.sh. A root of entirely exempt files
        # has been read; a root with no files has not.
        found=$((found + 1))
        printf '%s' "$file" | grep -Eq "$ALLOW_RE" && continue
        grep -Iq . "$file" 2>/dev/null || continue
        scan_file "$file"
    done < <(find "$root" -type f 2>/dev/null)
done

if [ "$found" -eq 0 ]; then
    printf 'jargon-guard: FAIL — roots exist but hold no scannable file: %s\n' "${ROOTS[*]}" >&2
    printf 'A guard with nothing to read is not a guard that passed.\n' >&2
    exit 1
fi

if [ "$findings" -gt 0 ]; then
    printf '\njargon-guard: FAIL — %d jargon string(s) in %d file(s) scanned.\n' "$findings" "$scanned" >&2
    printf 'Say "Orchestrator", "Agents", "your agent", "instructions", "skills".\n' >&2
    printf 'Technical values belong in an Advanced panel, or mark the line jargon-guard:advanced.\n' >&2
    exit 1
fi

printf 'jargon-guard: PASS — %d file(s) scanned, no jargon in customer-facing copy.\n' "$scanned"
