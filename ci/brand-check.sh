#!/usr/bin/env bash
# Brand check — PRD rule 4: "no visible 'Paperclip' or 'Hermes' string reaches the built UI."
#
# Fails loudly and names the file and line. When an upstream release adds new copy, the
# build goes red instead of shipping unbranded text to a customer.
#
#   ./brand-check.sh [dir ...]      default roots: orbitcrew/dashboard, dist
#
# THE CASING RULE THIS CHECK RELIES ON
#   Display copy is capitalized ("Paperclip", "Hermes"). Identifiers are lowercase
#   ("hermes_local", "@paperclipai/", "HERMES_HOME", "~/.hermes"). So this check matches
#   capitalized forms only, and never flags an identifier the PRD forbids renaming.
#
# Exit 0 clean, 1 on any finding, 2 on a usage or environment error.
set -uo pipefail

die() { printf 'brand-check: %s\n' "$1" >&2; exit 2; }
command -v grep >/dev/null 2>&1 || die "grep not found"

# MOVED HERE FROM THE INFRA REPO, 2026-11-16, because the artefact is here.
#
# The default was `orbitcrew/dashboard dist` in a repo where neither path exists and never
# will -- the dashboard was built in THIS repo as `src/apps/*`. So the guard reported
# INCONCLUSIVE on every run it ever made, and INCONCLUSIVE reads as "not yet" rather than
# "wrong place". Infra is PRIVATE and this repo is PUBLIC, so the alternative -- having this
# repo's CI check out infra to borrow the guard -- would have meant a private-repo credential
# in a public repo's secrets. That is a worse thing than the gap it closes.
#
# `dist` is not a default here either, deliberately: the BUILT bundles are checked by
# `src/shared/seeds/customer-surface.test.ts`, which greps the chunks each customer entry
# actually loads. This guard reads the SOURCE, so a leak is caught before it is built.
ROOTS=("$@")
if [ "${#ROOTS[@]}" -eq 0 ]; then
    ROOTS=(src/apps/user src/apps/org-admin src/apps/landing dashboards)
fi

# Capitalized display names that must never reach a customer-visible surface.
# Kept as fragments so this script never matches itself.
FORBIDDEN=(
    "Paper""clip"        # upstream Orchestrator, display form
    "Her""mes"           # upstream Agents runtime, display form
    "Nous ""Research"    # upstream vendor
    "Orbit""crew"        # wrong casing; the PRD settles on OrbitCrew
)
# Deliberately NOT forbidden:
#   ORBITCREW  — the SCREAMING_SNAKE identifier form, as in ORBITCREW_PSQL or
#                VITE_ORBITCREW_API_URL. Identifiers are never renamed.
#   orbitcrew  — the lowercase identifier form: the schema name, the directory.

# Paths exempt from the check.
#   Attribution: MIT requires the upstream names on the "Open source components" page,
#   so rule 4 would otherwise contradict the licence. Narrow, named exemption.
#   Governing docs, CLAUDE.md and VERSIONS.md are internal, not built UI.
# Note: only the ci *scripts* are exempt, not orbitcrew/ci/fixtures — the fixtures exist
# precisely to be scanned, and exempting them would make the self-test vacuous.
# `\.test\.(ts|tsx)$` was added 2026-11-16, on the guard's first run against the real tree.
# It flagged `src/apps/landing/landing.test.tsx:38`
#     expect(text).not.toContain('Orbitcrew');
# which is a test ASSERTING the banned lowercase form is absent. A test file is not a customer
# surface: Vite never bundles it, so no string in it can reach a browser. The built output is
# checked separately by `src/shared/seeds/customer-surface.test.ts`, which greps the chunks
# each entry actually loads — so this exemption removes nothing from the real assertion.
ALLOW_RE='(^|/)(\.git|node_modules|dist/assets/vendor)/|(^|/)(LICENSE|LICENCE|NOTICE|COPYING)([^/]*)$|open-source-components|attribution|(^|/)orbitcrew/ci/[^/]*\.sh$|(^|/)governing/|(^|/)CLAUDE\.md$|(^|/)infra/VERSIONS\.md$|\.map$|\.test\.(ts|tsx)$'

findings=0
scanned=0
found=0
missing_roots=0

for root in "${ROOTS[@]}"; do
    if [ ! -e "$root" ]; then
        # NOT a skip. A guard that cannot find what it guards has failed; "skipped" is how
        # this one reported a pass it had not earned, every run, for months.
        printf 'brand-check: FAIL — root does not exist: %s\n' "$root" >&2
        printf 'Looked from: %s\n' "$(pwd)" >&2
        exit 1
    fi

    while IFS= read -r file; do
        case "$file" in */) continue;; esac
        # Counted BEFORE the allowlist, and that distinction is the whole point: a root whose
        # files are all legitimately exempt (the attribution page, an `advanced/` directory)
        # has been read and has nothing to report. A root with no files in it at all has not
        # been read. Only the second is a failure.
        found=$((found + 1))
        printf '%s' "$file" | grep -Eq "$ALLOW_RE" && continue
        # Skip binaries.
        grep -Iq . "$file" 2>/dev/null || continue
        scanned=$((scanned + 1))

        for term in "${FORBIDDEN[@]}"; do
            if hits=$(grep -n -- "$term" "$file" 2>/dev/null); then
                while IFS= read -r hit; do
                    [ -n "$hit" ] || continue
                    printf 'BRAND LEAK  %s:%s\n' "$file" "$hit"
                    findings=$((findings + 1))
                done <<< "$hits"
            fi
        done
    done < <(find "$root" -type f 2>/dev/null)
done

if [ "$found" -eq 0 ]; then
    printf 'brand-check: FAIL — roots exist but hold no scannable file: %s\n' "${ROOTS[*]}" >&2
    printf 'A guard with nothing to read is not a guard that passed.\n' >&2
    exit 1
fi

if [ "$findings" -gt 0 ]; then
    printf '\nbrand-check: FAIL — %d visible upstream brand string(s) in %d file(s) scanned.\n' \
        "$findings" "$scanned" >&2
    printf 'Rename the visible copy. Never rename an identifier (package name, env var,\n' >&2
    printf 'import path, HTTP route, database object, adapter registry key).\n' >&2
    exit 1
fi

printf 'brand-check: PASS — %d file(s) scanned, no visible upstream brand strings.\n' "$scanned"
exit 0
