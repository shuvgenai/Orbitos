#!/usr/bin/env bash
# OrbitCrew — first install on a customer's own machine.
#
#   bash template/install.sh                     # interactive
#   bash template/install.sh --non-interactive   # every value from the environment
#   bash template/install.sh --force             # overwrite an existing template/.env
#   bash template/install.sh --skip-engine       # do not build the 8.82 GB engine image
#
# WHAT THIS MACHINE NEEDS
#   Disk    ~25 GB free IN DOCKER'S STORAGE, not on the disk holding this checkout -- they
#           are different filesystems, and on macOS and Windows Docker's lives inside a VM.
#
#           Measured with `docker system df -v`, not estimated:
#             engine image              ~8.82 GB   (the big one; built here, not pulled)
#             four program images        ~920 MB   TOTAL, not each -- web, worker, api and
#                                                  frontdesk share one base, and their
#                                                  UNIQUE layers are 17-38 KB apiece
#             orbit-dbgen (migrations)   ~1.17 GB  (850 MB unique)
#             Postgres + Redis           ~0.5 GB
#             volumes, once in use       ~190 MB and grows with your data
#           ----------------------------------------------------------------------------
#             steady state after install  ~12 GB
#             peak during the first build ~20 GB   build cache is the part people forget
#
#           25 GB leaves real headroom; below that the engine build is the step that dies.
#           `docker system df` shows what is there now, `docker system prune` reclaims the
#           build cache afterwards and is safe once the images exist.
#   Memory  8 GB works; 16 GB is comfortable. Eight containers, and the engine applies 278
#           upstream migrations on first boot.
#   Ports   3100, 8080 and 8081, free on 127.0.0.1.
#   Tools   Docker Engine with Compose v2, bash, openssl (or /dev/urandom), and one of
#           lsof, ss or netstat for the port check.
#
# LINUX, macOS AND WINDOWS
#   Linux   Docker Engine. Nothing special.
#   macOS   Works on bash 3.2, which is what /bin/bash is -- no bash 4 syntax is used here.
#           `stat`, `netstat` and the port check all have BSD paths. Docker Desktop is fine
#           but needs a PAID SUBSCRIPTION for companies over 250 employees or $10M revenue;
#           Colima, OrbStack and Rancher Desktop avoid that and provide the same `docker`
#           plus Compose v2 this script uses. NOT YET RUN END TO END ON macOS -- the BSD
#           paths are written and reviewed, not exercised on real hardware.
#   Windows Run it inside WSL2, not Git Bash or PowerShell. Note that `chmod 0600` on a
#           Windows drive is a no-op, which stage 3 detects and warns about rather than
#           claiming the credentials file is protected.
#
# WHAT THIS DOES, AND WHERE IT STOPS. It renders `template/.env`, brings up the data
# services, proves both databases and both logins, applies the migrations, builds the
# engine and waits for it to answer. It then STOPS, because the two remaining steps
# cannot be automated yet and pretending otherwise would ship a half-installed instance
# that reports success:
#
#   * the mailbox connection — `api` and `frontdesk` both refuse to boot without
#     EXACTLY ONE GmailConnection row, and the refresh token behind it can only come
#     from the owner completing Google consent. `ops/seed-instance.mjs` takes a token as
#     an INPUT, which is right for CI and wrong for a first install.
#   * the four per-instance values in `.env.frontdesk` — a Paperclip company id, two
#     agent ids and a service key, none of which exist until an instance is provisioned.
#
# Both are tracked in TODOS.md ("An instance cannot provision itself either"), and that
# proposal is itself blocked on a founder decision about whose OAuth client the consent
# uses. So this installer deliberately does not guess at either.
#
# THE SEQUENCE IS NOT INVENTED. Every step below is one that `compose-smoke` in
# `.github/workflows/ci.yml` proves on every push, in that order, with two differences:
# this builds the engine (CI cannot — 8.82 GB does not fit a hosted runner) and this
# refuses filler values where CI supplies them deliberately.
#
# EXIT CODES
#   2  installed as far as it can go, and NOT YET USABLE. This is the expected path.
#   1  a real failure. The message names which stage and why.
#   3  preflight refused to start. Nothing was changed.
#   0  never. See stage 8 — a success code here would be a lie.
set -euo pipefail

here="$(cd "$(dirname "$0")" && pwd)"
root="$(cd "$here/.." && pwd)"
compose_file="$here/compose.yml"
env_file="$here/.env"
pins="$here/engine/pinned-versions.json"

INTERACTIVE=1
FORCE=0
SKIP_ENGINE=0
for arg in "$@"; do
    case "$arg" in
        --non-interactive) INTERACTIVE=0 ;;
        --force)           FORCE=1 ;;
        --skip-engine)     SKIP_ENGINE=1 ;;
        -h|--help)         sed -n '2,8p' "$0" | sed 's/^#\{1,\} \{0,1\}//'; exit 0 ;;
        *) printf 'install: unknown option %s\n' "$arg" >&2; exit 3 ;;
    esac
done

DC=(docker compose -f "$compose_file")

say()  { printf '\n==> %s\n' "$*"; }
ok()   { printf '    ok    %s\n' "$*"; }
info() { printf '    ..    %s\n' "$*"; }
warn() { printf '    WARN  %s\n' "$*"; }
die()  { printf '\ninstall: FAILED — %s\n' "$*" >&2; exit 1; }
nope() { printf '\ninstall: cannot start — %s\n' "$*" >&2; exit 3; }

# ---------------------------------------------------------------------------
say "1/8  Preflight"
# A missing tool or a busy port must stop the run BEFORE anything is written. Every check
# reports what it looked for, so a failure is actionable without reading this script.

command -v docker >/dev/null 2>&1 || nope "docker is not on PATH. Install Docker Engine and run this again."
docker version >/dev/null 2>&1 || nope "docker is installed but the daemon is not answering. Start Docker and run this again."
ok "docker responds"

docker compose version >/dev/null 2>&1 || nope "this needs Compose v2 (the 'docker compose' subcommand, not the old 'docker-compose' binary)."
ok "compose v2 present"

[ -r "$compose_file" ] || nope "cannot read $compose_file — run this from a complete checkout."
[ -r "$pins" ] || nope "cannot read $pins — the engine pins are part of the checkout."
ok "compose file and engine pins are readable"

# Ports. 3100 is the engine, 8080 the web surface, 8081 the api. A port already held is the
# most likely reason a first install dies halfway, and it is cheap to catch up front.
# 0 = busy, 1 = free, 2 = COULD NOT TELL. The third value is the point.
#
# This read `ss` then `netstat -ltn`, and on macOS that is a check that passes by not
# looking: BSD netstat has no `-l` and no `-t`, so it errors, `2>/dev/null` swallows it,
# grep matches nothing, and every port is reported free. The installer would then sail into
# stage 4 and fail at `docker compose up` with a port-binding error instead of the clear
# message this stage exists to give. `lsof` is tried first because it is present on macOS by
# default and answers the same way everywhere.
port_busy() {
    if command -v lsof >/dev/null 2>&1; then
        lsof -nP -iTCP:"$1" -sTCP:LISTEN >/dev/null 2>&1 && return 0
        return 1
    elif command -v ss >/dev/null 2>&1; then
        ss -ltn 2>/dev/null | grep -qE "[:.]$1[[:space:]]" && return 0
        return 1
    elif command -v netstat >/dev/null 2>&1; then
        # GNU first; if those flags are rejected (BSD/macOS), fall back to the portable form.
        if netstat -ltn >/dev/null 2>&1; then
            netstat -ltn 2>/dev/null | grep -qE "[:.]$1[[:space:]]" && return 0
            return 1
        fi
        netstat -an -p tcp 2>/dev/null | grep -qE "[:.]$1[[:space:]]+.*LISTEN" && return 0
        return 1
    fi
    return 2
}
unchecked_ports=0
for p in 3100 8080 8081; do
    # `rc=0; cmd || rc=$?` and NOT a bare `port_busy "$p"`. Under `set -e` a bare call that
    # returns 1 -- which here means "the port is FREE", the good outcome -- kills the script
    # on the spot. It was previously inside an `if`, which is exempt; moving to a three-way
    # result made it a plain command and took 14 of 18 self-test assertions down with it.
    rc=0
    port_busy "$p" || rc=$?
    case "$rc" in
        0) nope "port $p is already in use. OrbitCrew needs 3100 (engine), 8080 (web) and 8081 (api) on 127.0.0.1. Stop whatever holds $p, or change the published port in $compose_file." ;;
        2) unchecked_ports=1 ;;
    esac
done
if [ "$unchecked_ports" -eq 1 ]; then
    warn "could not check whether ports 3100, 8080 and 8081 are free -- no lsof, ss or netstat here."
    printf '          That is NOT the same as finding them free. If one is taken, stage 4 fails\n'
    printf '          at the port binding rather than here.\n'
else
    ok "ports 3100, 8080 and 8081 are free"
fi

# Disk. MEASURE THE FILESYSTEM DOCKER USES, NOT THE ONE THE CHECKOUT IS ON. This checked
# `df` on the repository path, which is the wrong volume nearly everywhere: measured on the
# development host, the checkout's filesystem reported 88.5 GB free while Docker's actual
# store had 913.9 GB. On macOS and Windows the gap is worse than wrong-by-a-bit -- Docker
# keeps its images inside a Linux VM disk image, so no host path reflects them at all.
#
# Requirement: about 25 GB free. Measured with `docker system df -v` rather than estimated:
# the engine is ~8.82 GB, the four program images are ~920 MB TOTAL (not each -- they share
# one base and their unique layers are 17-38 KB apiece), orbit-dbgen ~1.17 GB, Postgres and
# Redis ~0.5 GB. That is ~12 GB steady state; the first build peaks nearer 20 GB because of
# BUILD CACHE, which is the part people forget. 25 GB leaves real headroom.
#
# An earlier version of this file said 30 GB and "~920 MB each". Both were wrong in the same
# direction -- guessed high rather than measured -- and the second overstated the program
# images by about 2.8 GB.
docker_root="$(docker info --format '{{.DockerRootDir}}' 2>/dev/null || true)"
if [ -n "$docker_root" ] && [ -d "$docker_root" ]; then
    avail_kb="$(df -Pk "$docker_root" 2>/dev/null | awk 'NR==2{print $4}')"
    if [ -n "${avail_kb:-}" ] && [ "$avail_kb" -lt 26214400 ]; then
        if [ "$SKIP_ENGINE" -eq 0 ]; then
            nope "$(( avail_kb / 1048576 )) GB free on Docker's storage ($docker_root); the engine build needs roughly 25 GB including build cache. Free space (\`docker system prune\` reclaims build cache), or re-run with --skip-engine."
        fi
        info "low Docker disk ($(( avail_kb / 1048576 )) GB), but --skip-engine was given"
    else
        ok "Docker storage has $(( ${avail_kb:-0} / 1048576 )) GB free, on $docker_root"
    fi
else
    # Docker in a VM -- macOS and Windows. Its disk is not visible from this shell, so this
    # cannot be measured here, and saying nothing would read as "checked and fine".
    warn "could not measure Docker's free disk from here."
    printf '          Docker stores images inside a VM on macOS and Windows, so no path on this\n'
    printf '          machine reflects them. ALLOW ABOUT 25 GB in the Docker VM: the engine image\n'
    printf '          is ~8.82 GB, the four program images ~920 MB each, and build cache can add\n'
    printf '          15 GB or more. Docker Desktop: Settings > Resources > Virtual disk limit.\n'
    printf '          Check what is there now with: docker system df\n'
fi

# ---------------------------------------------------------------------------
say "2/8  Values this instance needs"

if [ -e "$env_file" ] && [ "$FORCE" -eq 0 ]; then
    nope "$env_file already exists, so this instance looks installed. Re-run with --force to overwrite it — which changes every generated secret and ORPHANS the existing databases, whose passwords are set once when the volume is created."
fi

# Generated, never prompted. A customer typing their own passwords is a customer with a weak
# one, and nothing outside the containers ever reads these.
command -v openssl >/dev/null 2>&1 || info "openssl not found; falling back to /dev/urandom"
gen_hex() {
    openssl rand -hex "$1" 2>/dev/null || head -c "$1" /dev/urandom | od -An -tx1 | tr -d ' \n'
}

POSTGRES_PASSWORD="$(gen_hex 24)"
ORBIT_DB_PASSWORD="$(gen_hex 24)"
PAPERCLIP_DB_PASSWORD="$(gen_hex 24)"
PAPERCLIP_AUTH_SECRET="$(gen_hex 32)"
PAPERCLIP_SIGNING_SECRET="$(gen_hex 32)"
# MUST match /^[0-9a-fA-F]{64}$/ — api and frontdesk validate this at boot and refuse to
# start otherwise. `openssl rand -hex 32` is exactly 64 hex characters.
TOKEN_ENCRYPTION_KEY="$(gen_hex 32)"
# The api enforces a 32-character MINIMUM at boot, one layer deeper than compose. A
# 31-character value got past interpolation and died at boot on 2026-11-10. 64 here.
APPROVAL_LINK_SECRET="$(gen_hex 32)"
ok "7 secrets generated locally (none leaves this machine, none is printed)"

[ "${#TOKEN_ENCRYPTION_KEY}" -eq 64 ] || die "stage 2: the generated TOKEN_ENCRYPTION_KEY is ${#TOKEN_ENCRYPTION_KEY} characters, not 64. The api would refuse to boot on it."
[ "${#APPROVAL_LINK_SECRET}" -ge 32 ] || die "stage 2: the generated APPROVAL_LINK_SECRET is under the api's 32-character minimum."
ok "both validated against the rules the programs enforce at boot"

# Derived from the pins file, not typed. The format is image@sha256:... with NO tag, which
# is what compose-smoke passes and what `FROM ${REF}` resolves.
json_get() {
    grep -A3 "\"$1\"" "$pins" | grep "\"$2\"" | head -1 | sed -E 's/.*: *"([^"]*)".*/\1/'
}
PAPERCLIP_REF="$(json_get paperclip image)@$(json_get paperclip digest)"
HERMES_REF="$(json_get hermes image)@$(json_get hermes digest)"
case "$PAPERCLIP_REF" in
    *@sha256:*) ok "Paperclip pin read from pinned-versions.json" ;;
    *) die "stage 2: could not read the Paperclip pin out of $pins (got '$PAPERCLIP_REF')." ;;
esac
case "$HERMES_REF" in
    *@sha256:*) ok "Hermes pin read from pinned-versions.json" ;;
    *) die "stage 2: could not read the Hermes pin out of $pins (got '$HERMES_REF')." ;;
esac

# NOT localhost, deliberately. Paperclip validates the Host header against this value and
# resets a connection that does not match — and the container's own healthcheck probes
# 127.0.0.1:3100, so this must be 127.0.0.1 for that healthcheck to pass. The infra repo
# sets `localhost` for the mirror-image reason: its probe uses localhost.
PAPERCLIP_PUBLIC_URL="http://127.0.0.1:3100"

ask() { # ask VAR "prompt" ["hint"]
    local var="$1" prompt="$2" hint="${3:-}" cur val
    cur="$(printenv "$var" 2>/dev/null || true)"
    if [ "$INTERACTIVE" -eq 0 ]; then
        [ -n "$cur" ] || die "stage 2: --non-interactive was given but \$$var is not set."
        ok "$var taken from the environment"
        return
    fi
    [ -n "$hint" ] && printf '\n    %s\n' "$hint"
    while :; do
        if [ -n "$cur" ]; then
            printf '    %s [enter keeps the current value]: ' "$prompt"
            IFS= read -r val || true
            [ -z "$val" ] && val="$cur"
        else
            printf '    %s: ' "$prompt"
            IFS= read -r val || true
        fi
        [ -n "$val" ] && break
        printf '    %s is required.\n' "$var"
    done
    eval "$var=\$val"
}

if [ "$INTERACTIVE" -eq 1 ]; then
    printf '\n    The next values cannot be generated — they are your own accounts. Nothing\n'
    printf '    here is sent anywhere; it goes into template/.env on this machine only.\n'
fi

ask ANTHROPIC_API_KEY "Anthropic API key for the Front Desk" \
    "The Front Desk classifies incoming mail with this key."
# SEC-10: the engine gets its OWN key, never the Front Desk's, so the two are billed and
# revoked independently and one being leaked does not expose both.
ask ENGINE_ANTHROPIC_API_KEY "Anthropic API key for the engine (a SECOND key, not the same one)" \
    "SEC-10 keeps these separate on purpose. Use a different key so each can be revoked alone."
ask RESEND_API_KEY "Resend API key" \
    "Resend sends the notice mail. The sender domain must already be verified there."
ask MAIL_FROM "Sender address for outgoing mail" \
    "Must be on a domain you have verified with Resend."
ask GMAIL_CLIENT_ID "Google OAuth client id" \
    "From a Google Cloud OAuth client with the Gmail API enabled and the scopes gmail.readonly and gmail.send. See docs/runbooks/slice-1-local.md."
ask GMAIL_CLIENT_SECRET "Google OAuth client secret"
ask PUBLIC_BASE_URL "Public base URL for confirm links" \
    "The hostname your confirm links point at — a Cloudflare tunnel, typically. Links already sent BREAK if this changes later."
ask SETUP_HOST_DIR "Directory holding tone-samples.md and facts.md" \
    "Your own writing: how the Front Desk should sound, and the facts it may state."

if [ "$ANTHROPIC_API_KEY" = "$ENGINE_ANTHROPIC_API_KEY" ]; then
    die "stage 2: the two Anthropic keys are identical. SEC-10 requires the engine to hold its own, so the two can be revoked and billed separately. Create a second key."
fi
ok "the two Anthropic keys are distinct, as SEC-10 requires"

case "$MAIL_FROM" in
    *@*.*) ok "MAIL_FROM looks like an address" ;;
    *) die "stage 2: MAIL_FROM ('$MAIL_FROM') is not an email address." ;;
esac
case "$PUBLIC_BASE_URL" in
    http://*|https://*) ok "PUBLIC_BASE_URL has a scheme" ;;
    *) die "stage 2: PUBLIC_BASE_URL ('$PUBLIC_BASE_URL') must start with http:// or https://." ;;
esac

# frontdesk reads BOTH files at boot and refuses to start if either is missing OR EMPTY:
#   tone-samples.md is missing or empty in SETUP_DIR
# An empty directory satisfies the bind mount and not the program, which is the exact
# failure this check exists to pre-empt.
[ -d "$SETUP_HOST_DIR" ] || die "stage 2: SETUP_HOST_DIR '$SETUP_HOST_DIR' is not a directory."
for f in tone-samples.md facts.md; do
    [ -s "$SETUP_HOST_DIR/$f" ] || die "stage 2: '$SETUP_HOST_DIR/$f' is missing or empty. The Front Desk reads both files at boot and will not start without them. They are your own writing — see docs/runbooks/slice-1-local.md."
done
ok "tone-samples.md and facts.md are present and non-empty"

# ---------------------------------------------------------------------------
say "3/8  Writing $env_file"

umask 077
{
    printf '# Generated by template/install.sh on %s.\n' "$(date -u '+%Y-%m-%dT%H:%M:%SZ')"
    printf '# THIS FILE HOLDS LIVE CREDENTIALS. It is git-ignored (.gitignore: .env, .env.*)\n'
    printf '# and must never be committed, pasted into a ticket, or copied to another instance.\n'
    printf 'POSTGRES_PASSWORD=%s\n'         "$POSTGRES_PASSWORD"
    printf 'ORBIT_DB_PASSWORD=%s\n'         "$ORBIT_DB_PASSWORD"
    printf 'PAPERCLIP_DB_PASSWORD=%s\n'     "$PAPERCLIP_DB_PASSWORD"
    printf 'RESEND_API_KEY=%s\n'            "$RESEND_API_KEY"
    printf 'GMAIL_CLIENT_ID=%s\n'           "$GMAIL_CLIENT_ID"
    printf 'GMAIL_CLIENT_SECRET=%s\n'       "$GMAIL_CLIENT_SECRET"
    printf 'TOKEN_ENCRYPTION_KEY=%s\n'      "$TOKEN_ENCRYPTION_KEY"
    printf 'ANTHROPIC_API_KEY=%s\n'         "$ANTHROPIC_API_KEY"
    printf 'PAPERCLIP_REF=%s\n'             "$PAPERCLIP_REF"
    printf 'HERMES_REF=%s\n'                "$HERMES_REF"
    printf 'PAPERCLIP_PUBLIC_URL=%s\n'      "$PAPERCLIP_PUBLIC_URL"
    printf 'PAPERCLIP_AUTH_SECRET=%s\n'     "$PAPERCLIP_AUTH_SECRET"
    printf 'PAPERCLIP_SIGNING_SECRET=%s\n'  "$PAPERCLIP_SIGNING_SECRET"
    printf 'ENGINE_ANTHROPIC_API_KEY=%s\n'  "$ENGINE_ANTHROPIC_API_KEY"
    printf 'APPROVAL_LINK_SECRET=%s\n'      "$APPROVAL_LINK_SECRET"
    printf 'PUBLIC_BASE_URL=%s\n'           "$PUBLIC_BASE_URL"
    printf 'MAIL_FROM=%s\n'                 "$MAIL_FROM"
    printf 'SETUP_HOST_DIR=%s\n'            "$SETUP_HOST_DIR"
} > "$env_file"

chmod 0600 "$env_file" 2>/dev/null || true
# Read the mode back rather than assuming chmod took. On a Windows drive mounted into WSL
# (drvfs) it is routinely a no-op, and calling a credentials file protected when it is
# world-readable is worse than saying nothing at all.
mode="$(stat -c '%a' "$env_file" 2>/dev/null || stat -f '%Lp' "$env_file" 2>/dev/null || echo '?')"
if [ "$mode" = "600" ]; then
    ok "written, mode 600"
else
    warn "written, but the mode is $mode and not 600."
    printf '          This filesystem does not honour chmod; a Windows drive under WSL does not.\n'
    printf '          %s holds live credentials and may be readable by other users here.\n' "$env_file"
    printf '          Install on a Linux filesystem if that matters to you.\n'
fi

# Every variable the compose file requires with ${VAR:?} must be present even for services
# this installer does not start, because compose interpolates the WHOLE file while parsing
# it. A missing one fails at interpolation before a single container starts.
missing=""
for v in POSTGRES_PASSWORD ORBIT_DB_PASSWORD PAPERCLIP_DB_PASSWORD RESEND_API_KEY \
         GMAIL_CLIENT_ID GMAIL_CLIENT_SECRET TOKEN_ENCRYPTION_KEY ANTHROPIC_API_KEY \
         PAPERCLIP_REF HERMES_REF PAPERCLIP_PUBLIC_URL PAPERCLIP_AUTH_SECRET \
         PAPERCLIP_SIGNING_SECRET ENGINE_ANTHROPIC_API_KEY APPROVAL_LINK_SECRET \
         PUBLIC_BASE_URL MAIL_FROM SETUP_HOST_DIR; do
    grep -q "^$v=." "$env_file" || missing="$missing $v"
done
[ -z "$missing" ] || die "stage 3: these came out empty:$missing. Compose would fail at interpolation before starting anything."
ok "all 18 required variables are present and non-empty"

# ---------------------------------------------------------------------------
say "4/8  Data services"
"${DC[@]}" up -d --wait postgres redis \
    || die "stage 4: postgres and redis did not become healthy. 'docker compose -f $compose_file logs postgres redis' will say why."
ok "postgres and redis are healthy"

# ---------------------------------------------------------------------------
say "5/8  Both databases, each login reaching only its own (DEP-1)"
# The same assertion compose-smoke makes. It matters here because the init script runs ONCE,
# on an empty data directory: if it did not run, or ran against a volume that already
# existed, every later stage fails in a way that points at the wrong thing.
dbs="$("${DC[@]}" exec -T postgres psql -U postgres -tAc \
    "select datname from pg_database where datname in ('orbit','paperclip') order by 1" \
    2>/dev/null | tr -d '\r' | sed '/^[[:space:]]*$/d' | tr '\n' ' ' | sed 's/[[:space:]]*$//')"
[ "$dbs" = "orbit paperclip" ] \
    || die "stage 5: expected the databases 'orbit' and 'paperclip', found '$dbs'. If this volume predates the install, 'docker compose -f $compose_file down -v' discards it — WHICH DELETES EVERY ROW IN IT."
ok "both databases exist"

check_login() { # check_login role password database
    local got
    got="$("${DC[@]}" exec -T -e PGPASSWORD="$2" postgres \
        psql -h 127.0.0.1 -U "$1" -d "$3" -tAc "select current_database()" \
        2>/dev/null | tr -d '\r\n ')"
    [ "$got" = "$3" ] || die "stage 5: the '$1' login could not reach '$3' (got '$got')."
    ok "$1 reaches $3"
}
check_login orbit_app "$ORBIT_DB_PASSWORD" orbit
check_login paperclip_app "$PAPERCLIP_DB_PASSWORD" paperclip

# ---------------------------------------------------------------------------
say "6/8  Migrations — the instance applies its own"
# `docker compose wait`, NOT `up --wait`. Measured on Compose v5.6.1: `up -d --wait` on a
# one-shot with no healthcheck treats a RUNNING container as ready and returned 0 after 3s
# on an 8s command, so a check reading its exit code read 0 from a container that had not
# finished. `wait` blocks until it exits and returns the real code.
"${DC[@]}" up -d migrate || die "stage 6: could not start the migrate service."
if ! "${DC[@]}" wait migrate; then
    printf '\n--- migrate log ---\n' >&2
    "${DC[@]}" logs migrate >&2 || true
    die "stage 6: the migrations did not apply; the log is above. Nothing downstream works until this succeeds — api, worker and frontdesk all gate on it with service_completed_successfully."
fi
ok "migrations applied"

# ---------------------------------------------------------------------------
if [ "$SKIP_ENGINE" -eq 1 ]; then
    say "7/8  Engine — SKIPPED (--skip-engine)"
    warn "the Orchestrator was not built, so nothing has verified it on this machine"
else
    say "7/8  Engine — building and starting it (the slow part)"
    info "about 8.82 GB when built; a first build can take 20 minutes or more"
    "${DC[@]}" build paperclip || die "stage 7: the engine image did not build. The output above names the failing step."
    ok "engine image built"
    "${DC[@]}" up -d paperclip || die "stage 7: the engine container did not start."

    # Up to 10 minutes: a first boot applies 278 upstream migrations, which is why the
    # compose healthcheck allows 30 retries. A probe that gives up early reads exactly like
    # a broken engine, so this waits as long as compose itself would.
    info "waiting for the Orchestrator to answer (a first boot applies 278 migrations)"
    # Overridable so the self-test can reach the timeout branch without waiting ten
    # minutes for it. Not test-only: an operator on slow storage may legitimately need
    # longer, and a value here is better than editing the script.
    deadline=$(( $(date +%s) + ${ORBIT_INSTALL_ENGINE_WAIT:-600} ))
    healthy=0
    while [ "$(date +%s)" -lt "$deadline" ]; do
        state="$("${DC[@]}" ps --format '{{.Service}} {{.Health}}' 2>/dev/null | awk '$1=="paperclip"{print $2}')"
        if [ "$state" = "healthy" ]; then healthy=1; break; fi
        if ! "${DC[@]}" ps --services --filter status=running 2>/dev/null | grep -qx paperclip; then
            printf '\n--- engine log ---\n' >&2
            "${DC[@]}" logs --tail=60 paperclip >&2 || true
            die "stage 7: the engine container stopped while starting; the log is above."
        fi
        sleep 10
    done
    if [ "$healthy" -ne 1 ]; then
        printf '\n--- engine log ---\n' >&2
        "${DC[@]}" logs --tail=60 paperclip >&2 || true
        die "stage 7: the engine did not become healthy within 10 minutes. That is NOT a pass — the log is above."
    fi
    ok "the Orchestrator is healthy"
fi

# ---------------------------------------------------------------------------
say "8/8  What is installed, and what is not"
printf '
    STAGE 1 OF 2 COMPLETE. THIS INSTANCE IS NOT USABLE YET.

    Running and verified:
      * Postgres, with both databases and both logins proven separate
      * Redis
      * The ORBIT migrations, applied by the instance itself
      * The Orchestrator engine (unless --skip-engine was given)

    NOT running, deliberately, because neither step can be automated yet:

      1. CONNECT A MAILBOX. The api and the Front Desk both refuse to boot unless there
         is exactly one GmailConnection row:
             expected exactly one GmailConnection row, found 0
         The refresh token behind that row can only come from the mailbox owner
         completing Google consent. Follow docs/runbooks/slice-1-local.md, steps 1 to 3.

      2. SUPPLY THE FOUR PER-INSTANCE VALUES. Write template/.env.frontdesk with
         PAPERCLIP_API_KEY, PAPERCLIP_COMPANY_ID, PAPERCLIP_SCOUT_AGENT_ID and
         PAPERCLIP_ORBI_AGENT_ID. None of them exist until the instance is provisioned in
         the Orchestrator, and there is no product mechanism for that yet.

    Then start the rest:
        docker compose -f template/compose.yml up -d --wait api worker frontdesk web

    Do not read this exit as a failure, and do not read it as done. It is the honest end
    of what installs without a person. The exit code is 2, so a wrapper script cannot
    mistake it for success.

'
exit 2
