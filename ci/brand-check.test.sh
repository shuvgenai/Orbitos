#!/usr/bin/env bash
# Self-test for brand-check.sh.
#
# PRD launch checklist: "CI brand check green, AND PROVEN TO FAIL when an unbranded string
# is introduced." A check nobody has watched fail is not a check. This is that proof.
#
#   ./brand-check.test.sh
set -uo pipefail

here="$(cd "$(dirname "$0")" && pwd)"
check="$here/brand-check.sh"
fixtures="$here/fixtures"

pass=0
fail=0

expect() {
    local want="$1" name="$2"; shift 2
    local out status
    out="$(bash "$check" "$@" 2>&1)"; status=$?
    if [ "$status" -eq "$want" ]; then
        printf '  ok    %s (exit %d)\n' "$name" "$status"
        pass=$((pass + 1))
    else
        printf '  FAIL  %s — wanted exit %d, got %d\n' "$name" "$want" "$status"
        printf '%s\n' "$out" | sed 's/^/        /'
        fail=$((fail + 1))
    fi
}

printf 'brand-check self-test\n'

# 1. Branded copy passes.
expect 0 "clean fixture passes" "$fixtures/clean"

# 2. An injected upstream display string fails. This is the one that matters.
expect 1 "dirty fixture FAILS (proves the check works)" "$fixtures/dirty"

# 3. Identifiers are never renamed, so they must never trip the check.
#    Covered by clean/identifiers.ts inside case 1, asserted again alone for clarity.
expect 0 "lowercase identifiers do not trip it" "$fixtures/clean/identifiers.ts"

# 4. The attribution page is exempt — MIT requires the upstream names there.
expect 0 "attribution page is allowlisted" "$fixtures/allowed"

# 5. A missing root FAILS. CHANGED 2026-11-16, when this guard moved here from the infra
#    repo. It used to exit 2 and print INCONCLUSIVE, which `check-all.sh` reported as "not a
#    pass" — correct in the letter and useless in practice, because the guard's DEFAULT root
#    did not exist either. Every run was that case, and the output read as "no dashboard yet"
#    rather than "pointed at the wrong repository". A guard that cannot find what it guards
#    has failed, and it has to say where it looked.
expect 1 "absent root FAILS, it does not report 'not yet'" "$fixtures/does-not-exist"

says() {  # says <name> <substring> <args...>
    local name="$1" want="$2"; shift 2
    local out; out="$(bash "$check" "$@" 2>&1)"
    if printf '%s' "$out" | grep -qF -- "$want"; then
        printf '  ok    %s\n' "$name"; pass=$((pass + 1))
    else
        printf '  FAIL  %s — output did not contain: %s\n' "$name" "$want"
        printf '%s\n' "$out" | sed 's/^/        /'; fail=$((fail + 1))
    fi
}
says "the failure names the path it looked for" "does-not-exist" "$fixtures/does-not-exist"
says "the failure says which directory it looked from" "Looked from:" "$fixtures/does-not-exist"

printf '\n%d passed, %d failed\n' "$pass" "$fail"
[ "$fail" -eq 0 ] || exit 1
printf 'brand-check.sh is proven to fail on an unbranded string.\n'
