#!/usr/bin/env bash
# Proof that template/install.sh FAILS when it should.
#
#   bash template/install.test.sh
#
# WHY THIS EXISTS. `install.sh` is the first thing a paying customer runs, and the one
# program in this repo that CI cannot exercise end to end — `compose-smoke` deliberately
# leaves the engine out, because 8.82 GB does not fit a hosted runner. So every failure
# path here is proven against a STUBBED docker rather than a real one, and the stub is
# what lets a test assert "the installer refused" without a 20-minute build.
#
# The rule this file enforces is the repo's own: a check that cannot reach its target must
# FAIL, never report clean. An installer that exits 0 on a half-installed instance is the
# same defect as a nightly job that goes green because the stack was down.
#
# HOW THE STUB WORKS. Each case gets a scratch directory with a `docker` executable on
# PATH ahead of the real one. The stub reads $STUB_MODE and answers the handful of
# subcommands the installer calls. A case that needs docker to be absent gets a PATH with
# no docker at all.
set -uo pipefail

here="$(cd "$(dirname "$0")" && pwd)"
root="$(cd "$here/.." && pwd)"

# COUNTERS LIVE IN FILES, NOT VARIABLES. Each case runs in a ( subshell ) so its exports
# cannot leak into the next one — which means a `pass=$((pass+1))` inside one is lost when
# it exits. The first version of this file did exactly that and printed
#   FAIL  an engine that dies on boot ...
#   install.test: PASS — 1 assertion(s)
# A test that reports PASS while printing a failure is the same defect it exists to catch,
# so the counts are appended to files in the parent's scratch directory instead.
counts="$(mktemp -d)"
: > "$counts/pass"
: > "$counts/fail"
trap 'rm -rf "$counts"' EXIT
scored_pass() { printf 'x' >> "$counts/pass"; }
scored_fail() { printf 'x' >> "$counts/fail"; }
n_pass() { wc -c < "$counts/pass" | tr -d ' '; }
n_fail() { wc -c < "$counts/fail" | tr -d ' '; }

# ---------------------------------------------------------------------------
# A scratch copy of template/ so no case can touch the real compose file or .env.
mkrepo() { # mkrepo -> echoes a directory holding template/{compose.yml,engine/pinned-versions.json}
    local d
    d="$(mktemp -d)"
    mkdir -p "$d/template/engine"
    cp "$here/compose.yml" "$d/template/compose.yml"
    cp "$here/engine/pinned-versions.json" "$d/template/engine/pinned-versions.json"
    cp "$here/install.sh" "$d/template/install.sh"
    printf '%s' "$d"
}

# The stub. Modes: ok | nodaemon | migratefail | enginestops | engineneverhealthy
mkstub() { # mkstub <dir> <mode>
    local bin="$1/bin"
    mkdir -p "$bin"
    cat > "$bin/docker" <<'STUB'
#!/usr/bin/env bash
# Stub docker. Answers only what install.sh asks.
mode="${STUB_MODE:-ok}"
[ "$mode" = "nodaemon" ] && [ "$1" = "version" ] && exit 1
case "$1 $2" in
  "version "*|"compose version"*) exit 0 ;;
esac
# Everything below is `docker compose -f <file> <cmd> ...`
cmd=""
for a in "$@"; do
  case "$a" in
    docker|compose|-f) continue ;;
    *.yml|*.yaml) continue ;;
    *) cmd="$a"; break ;;
  esac
done
case "$cmd" in
  up)    exit 0 ;;
  build) exit 0 ;;
  logs)  echo "[stub log line]"; exit 0 ;;
  wait)  [ "$mode" = "migratefail" ] && exit 7; exit 0 ;;
  ps)
      # --services --filter status=running
      case "$*" in
        *--services*)
            [ "$mode" = "enginestops" ] && exit 0   # prints nothing: not running
            echo paperclip; exit 0 ;;
        *)
            # enginestops must NOT report healthy here. The first version did, so the
            # health check broke out of the loop before the not-running branch could
            # fire, and the case reported exit 2 instead of 1. install.sh was right and
            # the stub was lying — which is the stub's whole risk as a test double.
            case "$mode" in
              engineneverhealthy|enginestops) echo "paperclip starting" ;;
              *)                              echo "paperclip healthy" ;;
            esac
            exit 0 ;;
      esac ;;
  exec)
      # The two psql calls: the database list, then each login.
      case "$*" in
        *pg_database*) printf 'orbit\npaperclip\n'; exit 0 ;;
        *orbit_app*)   echo orbit; exit 0 ;;
        *paperclip_app*) echo paperclip; exit 0 ;;
      esac
      exit 0 ;;
esac
exit 0
STUB
    chmod +x "$bin/docker"
    printf '%s' "$bin"
}

# A SETUP_HOST_DIR that satisfies the frontdesk file rule.
mksetup() {
    local d="$1/setup"
    mkdir -p "$d"
    printf 'tone filler\n' > "$d/tone-samples.md"
    printf 'facts filler\n' > "$d/facts.md"
    printf '%s' "$d"
}

# Values good enough to get past stage 2 in --non-interactive mode.
good_env() {
    export ANTHROPIC_API_KEY=key-frontdesk
    export ENGINE_ANTHROPIC_API_KEY=key-engine
    export RESEND_API_KEY=key-resend
    export MAIL_FROM=owner@example.invalid
    export GMAIL_CLIENT_ID=cid
    export GMAIL_CLIENT_SECRET=csecret
    export PUBLIC_BASE_URL=https://example.invalid
    export SETUP_HOST_DIR="$1"
}

# want <expected exit> <name> <dir> <substring that must appear>
want() {
    local expect="$1" name="$2" dir="$3" needle="$4"
    local out status
    out="$(cd "$dir" && bash template/install.sh --non-interactive 2>&1)"
    status=$?
    if [ "$status" -ne "$expect" ]; then
        printf '  FAIL  %s\n        expected exit %s, got %s\n' "$name" "$expect" "$status"
        printf '        ---\n%s\n        ---\n' "$(printf '%s' "$out" | tail -6)"
        scored_fail
        return
    fi
    if ! printf '%s' "$out" | grep -qF "$needle"; then
        printf '  FAIL  %s\n        exit %s was right, but the message never said "%s"\n' "$name" "$status" "$needle"
        printf '        ---\n%s\n        ---\n' "$(printf '%s' "$out" | tail -6)"
        scored_fail
        return
    fi
    printf '  ok    %s\n' "$name"
    scored_pass
}

printf 'install.test: proving install.sh fails when it should\n\n'

# ---------------------------------------------------------------------------
# 1. docker absent entirely. A PATH with the bare minimum and no docker.
d="$(mkrepo)"; s="$(mksetup "$d")"
( good_env "$s"; export PATH="/usr/bin:/bin"; export STUB_MODE=ok
  command -v docker >/dev/null 2>&1 && { printf '  SKIP  docker is on the minimal PATH; cannot test its absence\n'; exit 0; }
  want 3 "docker missing is exit 3, not a silent continue" "$d" "docker is not on PATH" )
rm -rf "$d"

# 2. docker present, daemon dead.
d="$(mkrepo)"; s="$(mksetup "$d")"; b="$(mkstub "$d" nodaemon)"
( good_env "$s"; export PATH="$b:$PATH"; export STUB_MODE=nodaemon
  want 3 "a dead daemon is exit 3 and says so" "$d" "daemon is not answering" )
rm -rf "$d"

# 3. The compose file is missing: the installer must not improvise.
d="$(mkrepo)"; s="$(mksetup "$d")"; b="$(mkstub "$d" ok)"
rm -f "$d/template/compose.yml"
( good_env "$s"; export PATH="$b:$PATH"; export STUB_MODE=ok
  want 3 "a missing compose file is exit 3" "$d" "cannot read" )
rm -rf "$d"

# 4. The pins file is missing: refs must never be invented.
d="$(mkrepo)"; s="$(mksetup "$d")"; b="$(mkstub "$d" ok)"
rm -f "$d/template/engine/pinned-versions.json"
( good_env "$s"; export PATH="$b:$PATH"; export STUB_MODE=ok
  want 3 "a missing pins file is exit 3, not a guessed digest" "$d" "engine pins are part of the checkout" )
rm -rf "$d"

# 5. An existing .env is never silently overwritten.
d="$(mkrepo)"; s="$(mksetup "$d")"; b="$(mkstub "$d" ok)"
printf 'POSTGRES_PASSWORD=already-here\n' > "$d/template/.env"
( good_env "$s"; export PATH="$b:$PATH"; export STUB_MODE=ok
  want 3 "an existing .env stops the run instead of being clobbered" "$d" "already exists" )
rm -rf "$d"

# 6. --non-interactive with a value absent must fail, not default to empty. An empty
#    value reaches compose as ${VAR:?} and dies at interpolation with a worse message.
d="$(mkrepo)"; s="$(mksetup "$d")"; b="$(mkstub "$d" ok)"
( good_env "$s"; unset RESEND_API_KEY; export PATH="$b:$PATH"; export STUB_MODE=ok
  want 1 "a missing value in --non-interactive fails, naming the variable" "$d" "RESEND_API_KEY is not set" )
rm -rf "$d"

# 7. SEC-10: one Anthropic key used for both is refused.
d="$(mkrepo)"; s="$(mksetup "$d")"; b="$(mkstub "$d" ok)"
( good_env "$s"; export ENGINE_ANTHROPIC_API_KEY="$ANTHROPIC_API_KEY"
  export PATH="$b:$PATH"; export STUB_MODE=ok
  want 1 "reusing one Anthropic key for both is refused (SEC-10)" "$d" "SEC-10" )
rm -rf "$d"

# 8. A MAIL_FROM that is not an address.
d="$(mkrepo)"; s="$(mksetup "$d")"; b="$(mkstub "$d" ok)"
( good_env "$s"; export MAIL_FROM="not-an-address"
  export PATH="$b:$PATH"; export STUB_MODE=ok
  want 1 "a MAIL_FROM with no domain is refused" "$d" "is not an email address" )
rm -rf "$d"

# 9. A PUBLIC_BASE_URL with no scheme — confirm links would be unusable.
d="$(mkrepo)"; s="$(mksetup "$d")"; b="$(mkstub "$d" ok)"
( good_env "$s"; export PUBLIC_BASE_URL="example.invalid"
  export PATH="$b:$PATH"; export STUB_MODE=ok
  want 1 "a PUBLIC_BASE_URL with no scheme is refused" "$d" "must start with http" )
rm -rf "$d"

# 10. SETUP_HOST_DIR exists but tone-samples.md is EMPTY. This is the case an empty
#     directory would pass: the bind mount succeeds and frontdesk then refuses to boot.
d="$(mkrepo)"; s="$(mksetup "$d")"; b="$(mkstub "$d" ok)"
: > "$s/tone-samples.md"
( good_env "$s"; export PATH="$b:$PATH"; export STUB_MODE=ok
  want 1 "an EMPTY tone-samples.md is caught, not just a missing one" "$d" "missing or empty" )
rm -rf "$d"

# 11. SETUP_HOST_DIR is not a directory at all.
d="$(mkrepo)"; s="$(mksetup "$d")"; b="$(mkstub "$d" ok)"
( good_env "$s"; export SETUP_HOST_DIR="$d/template/compose.yml"
  export PATH="$b:$PATH"; export STUB_MODE=ok
  want 1 "a SETUP_HOST_DIR that is a file is refused" "$d" "is not a directory" )
rm -rf "$d"

# 12. The migrations fail. The stub's `wait` returns 7, which is what `docker compose wait`
#     does on a one-shot that exits 7 — the exact behaviour `up --wait` does NOT have.
d="$(mkrepo)"; s="$(mksetup "$d")"; b="$(mkstub "$d" migratefail)"
( good_env "$s"; export PATH="$b:$PATH"; export STUB_MODE=migratefail
  want 1 "a failing migration stops the install and dumps the log" "$d" "migrations did not apply" )
rm -rf "$d"

# 13. The engine container stops while starting.
d="$(mkrepo)"; s="$(mksetup "$d")"; b="$(mkstub "$d" enginestops)"
( good_env "$s"; export PATH="$b:$PATH"; export STUB_MODE=enginestops
  want 1 "an engine that dies on boot fails the install" "$d" "stopped while starting" )
rm -rf "$d"

# 14. The engine never reports healthy. THE IMPORTANT ONE: an unreachable engine must not
#     read as installed. ORBIT_INSTALL_ENGINE_WAIT shortens the ten-minute wait.
d="$(mkrepo)"; s="$(mksetup "$d")"; b="$(mkstub "$d" engineneverhealthy)"
( good_env "$s"; export PATH="$b:$PATH"; export STUB_MODE=engineneverhealthy
  export ORBIT_INSTALL_ENGINE_WAIT=1
  want 1 "an engine that never answers is NOT a pass" "$d" "NOT a pass" )
rm -rf "$d"

# 15. THE HAPPY PATH ENDS IN EXIT 2, NOT 0. This is the assertion that keeps the installer
#     honest: everything worked, and the instance still is not usable, so a wrapper script
#     cannot read the result as done.
d="$(mkrepo)"; s="$(mksetup "$d")"; b="$(mkstub "$d" ok)"
( good_env "$s"; export PATH="$b:$PATH"; export STUB_MODE=ok
  want 2 "a fully successful run exits 2 and says NOT USABLE YET" "$d" "NOT USABLE YET" )
rm -rf "$d"

# 16. ...and it names both remaining steps rather than just claiming incompleteness.
d="$(mkrepo)"; s="$(mksetup "$d")"; b="$(mkstub "$d" ok)"
( good_env "$s"; export PATH="$b:$PATH"; export STUB_MODE=ok
  want 2 "the end names the mailbox connection as step 1" "$d" "CONNECT A MAILBOX" )
rm -rf "$d"

d="$(mkrepo)"; s="$(mksetup "$d")"; b="$(mkstub "$d" ok)"
( good_env "$s"; export PATH="$b:$PATH"; export STUB_MODE=ok
  want 2 "the end names the four per-instance values as step 2" "$d" "PAPERCLIP_COMPANY_ID" )
rm -rf "$d"

# 19. Docker's disk could not be measured -- it must SAY SO, not imply it checked. The stub
#     answers nothing for `docker info`, which is exactly the macOS/Windows case: Docker keeps
#     its images in a VM and no host path reflects them.
d="$(mkrepo)"; s="$(mksetup "$d")"; b="$(mkstub "$d" ok)"
( good_env "$s"; export PATH="$b:$PATH"; export STUB_MODE=ok
  want 2 "an unmeasurable Docker disk is reported, not silently passed" "$d" "could not measure Docker" )
rm -rf "$d"

# 20. ...and it states the actual requirement rather than just admitting ignorance, because a
#     warning the reader cannot act on is noise.
d="$(mkrepo)"; s="$(mksetup "$d")"; b="$(mkstub "$d" ok)"
( good_env "$s"; export PATH="$b:$PATH"; export STUB_MODE=ok
  want 2 "the disk warning names the 25 GB requirement" "$d" "ABOUT 25 GB" )
rm -rf "$d"

# 18. The written .env carries all 18 variables, and the engine refs are the pinned
#     digests rather than anything typed.
d="$(mkrepo)"; s="$(mksetup "$d")"; b="$(mkstub "$d" ok)"
(
  good_env "$s"; export PATH="$b:$PATH"; export STUB_MODE=ok
  cd "$d" && bash template/install.sh --non-interactive >/dev/null 2>&1
  n="$(grep -cE '^[A-Z_]+=.' template/.env || true)"
  if [ "$n" -ne 18 ]; then
      printf '  FAIL  the rendered .env has %s variables, not 18\n' "$n"; exit 1
  fi
  if ! grep -q '^PAPERCLIP_REF=.*@sha256:' template/.env; then
      printf '  FAIL  PAPERCLIP_REF in .env is not a digest pin\n'; exit 1
  fi
  if ! grep -q '^TOKEN_ENCRYPTION_KEY=[0-9a-f]\{64\}$' template/.env; then
      printf '  FAIL  TOKEN_ENCRYPTION_KEY is not 64 hex characters, which the api requires\n'; exit 1
  fi
  if grep -q '^PAPERCLIP_PUBLIC_URL=http://localhost' template/.env; then
      printf '  FAIL  PAPERCLIP_PUBLIC_URL is localhost; the container healthcheck probes 127.0.0.1 and the Host header must match\n'; exit 1
  fi
  printf '  ok    the rendered .env has 18 variables, digest-pinned refs and a 64-hex key\n'
) && scored_pass || scored_fail
rm -rf "$d"

# ---------------------------------------------------------------------------
printf '\n'
p="$(n_pass)"; f="$(n_fail)"
if [ "$f" -eq 0 ]; then
    # A run that asserted nothing is not a pass either. Without this, deleting every
    # case above would report success -- the same shape as a guard that passes by not
    # looking, which is the defect this whole repo is organised around.
    if [ "$p" -lt 20 ]; then
        printf 'install.test: FAILED -- only %s assertion(s) ran; at least 20 are expected.\n' "$p"
        exit 1
    fi
    printf 'install.test: PASS -- %s assertion(s); install.sh fails on every path tested.\n' "$p"
    exit 0
fi
printf 'install.test: FAILED %s of %s assertion(s).\n' "$f" "$((p + f))"
exit 1
