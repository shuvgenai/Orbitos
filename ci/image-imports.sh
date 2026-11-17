#!/usr/bin/env bash
# Every `@orbit/*` subpath a program imports must RESOLVE INSIDE THAT PROGRAM'S BUILT IMAGE.
#
#   bash ci/image-imports.sh
#
# WHY THIS EXISTS. `api` and `frontdesk` imported `@orbit/db` from 2026-10-01. No image
# carried the package until 2026-11-11 — 41 days in which both programs crash-looped on
#
#     Cannot find module '/app/<app>/node_modules/@orbit/db/src/client.ts'
#
# the moment they started. Nothing read inside an image, so nothing noticed: `pnpm test`
# passed, `pnpm typecheck` passed, and the one job that would have caught it was red and
# unread. This is the check that turns that into a build-time failure.
#
# It is deliberately NOT a test of whether the module works. It asks the one question the
# 41-day defect turned on: given this program's image and this program's working directory,
# does Node find the file? It executes nothing, so a module with side effects, or one that
# needs env vars, is still safe to ask about.
#
# IT RESOLVES **AND THEN STATS**, and the second half is not belt-and-braces — it is the
# check. The first version of this script called `import.meta.resolve` alone and PASSED on an
# image built with the `COPY --from=dbgen /app/db db` line deleted, which is precisely the
# defect it exists to catch. `import.meta.resolve` is syntactic: it walks the exports map and
# returns a URL without asking whether anything is there. pnpm links `@orbit/db` into
# `api/node_modules` as a SYMLINK, so the specifier resolved happily to
#     api/node_modules/@orbit/db/src/client.ts
# inside an image where `/app/db` did not exist at all. Caught by running the RED case; a
# check that can pass by not looking is a defect, not a check.
#
# Resolution is done FROM `/app/<app>`, because that is where the program runs (`CMD` does
# `cd "$APP"`), and pnpm links `@orbit/*` into each package's own `node_modules` rather than
# at the root. The same specifier resolves from one directory and not another, which is the
# whole reason the deep import looked fine in the repo and failed in the image.
#
# It holds whether or not the images are ever split per-app. See TODOS.md, "Stop shipping
# `db` into the `web` and `worker` images".
#
# EXIT 0 every import resolves · 1 one does not · 2 an image is missing (never a pass).
set -uo pipefail

here="$(cd "$(dirname "$0")" && pwd)"
cd "$(dirname "$here")" || { printf 'image-imports: cannot reach the repo root\n' >&2; exit 2; }

PROJECT="${COMPOSE_PROJECT_NAME:-orbit-instance}"
APPS=("${@:-}")
[ -z "${APPS[0]:-}" ] && APPS=(web api worker frontdesk)

fail=0
checked=0

for app in "${APPS[@]}"; do
    img="$PROJECT-$app"
    if ! docker image inspect "$img" >/dev/null 2>&1; then
        printf 'image-imports: INCONCLUSIVE — no image %s. Build the stack first. NOT a pass.\n' "$img" >&2
        exit 2
    fi

    # Every distinct `@orbit/...` specifier this program's own source imports. Type-only
    # imports are excluded: `import type` is erased before it runs, so it cannot fail at
    # runtime and demanding it resolve would flag a package the image correctly does without.
    specs="$(grep -rhoE "^[[:space:]]*import[[:space:]]+(type[[:space:]]+)?[^;]*from[[:space:]]+'@orbit/[^']+'" "$app/src" 2>/dev/null \
        | grep -v "import[[:space:]]\+type" \
        | grep -oE "'@orbit/[^']+'" | tr -d "'" | sort -u)"

    # A MISSING SOURCE TREE IS NOT "NO IMPORTS". `grep ... 2>/dev/null` over a path that
    # does not exist yields nothing, which printed "no @orbit/* imports" and continued --
    # and with all four programs in that state the final line read
    #     image-imports: PASS - 0 import(s) resolve inside their own image
    # a pass produced by reading no source, in the guard written to close a 41-day defect.
    # Found by sweeping for the shape on 2026-11-16.
    if [ ! -d "$app/src" ]; then
        printf 'image-imports: INCONCLUSIVE -- %s/src does not exist, so nothing was read\n' "$app" >&2
        printf '               for %s. Renamed, or run from the wrong directory. NOT a pass.\n' "$app" >&2
        exit 2
    fi

    if [ -z "$specs" ]; then
        printf '  %-10s no @orbit/* imports\n' "$app"
        continue
    fi

    while IFS= read -r spec; do
        [ -n "$spec" ] || continue
        checked=$((checked + 1))
        # One line in, one line out. A raw Node stack trace here is unreadable and, when two
        # imports fail at once, interleaves with the passing lines.
        probe="import{statSync}from'node:fs';import{fileURLToPath}from'node:url';"
        probe="${probe}let u;try{u=import.meta.resolve('$spec')}catch(e){console.log('NO-RESOLVE '+e.code);process.exit(3)}"
        probe="${probe}const p=fileURLToPath(u);"
        probe="${probe}try{statSync(p)}catch{console.log('NO-FILE '+p);process.exit(3)}"
        probe="${probe}console.log('OK '+p);"
        out="$(docker run --rm -w "/app/$app" --entrypoint node "$img" \
                 --input-type=module -e "$probe" 2>&1 | tail -1)"
        case "$out" in
            OK\ *)
                printf '  %-10s %-34s -> %s\n' "$app" "$spec" "${out#OK /app/}" ;;
            *)
                # NO-FILE is the interesting one: the specifier RESOLVED and the file is not
                # there. That is a pnpm symlink pointing into a package the image never
                # copied, which is what `Cannot find module` looks like one layer down.
                printf 'UNRESOLVED  %-10s %-30s %s\n' "$app" "$spec" "$out" >&2
                fail=$((fail + 1)) ;;
        esac
    done <<< "$specs"
done

if [ "$fail" -gt 0 ]; then
    printf '\nimage-imports: FAIL — %d of %d import(s) do not resolve inside their image.\n' "$fail" "$checked" >&2
    printf 'The program will crash-loop on start. Check the COPY lines in Dockerfile.\n' >&2
    exit 1
fi

# And zero is not a pass either. Every program here imports at least one `@orbit/*` package;
# a run that checked none of them has verified nothing, however green it looks.
if [ "$checked" -eq 0 ]; then
    printf '\nimage-imports: INCONCLUSIVE -- not one @orbit/* import was checked across %d\n' "${#APPS[@]}" >&2
    printf 'program(s). The imports moved, or the source was not read. NOT a pass.\n' >&2
    exit 2
fi

printf '\nimage-imports: PASS — %d import(s) resolve inside their own image.\n' "$checked"
exit 0
