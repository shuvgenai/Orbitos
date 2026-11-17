#!/usr/bin/env bash
# Creates the instance's two databases with separate logins (PRD DEP-1, SEC-2a).
# Runs once, on an empty data directory, from docker-entrypoint-initdb.d.
#
# THREE ROLES, NOT TWO, AND THE THIRD IS A SECURITY BOUNDARY — see the FD-38 addendum in
# orbitos-infra, decided 2026-11-17.
#
# `orbit_owner` owns the `orbit` database and everything in it, and runs the migrations.
# `orbit_app` is the RUNTIME and owns nothing at all.
#
# WHY THEY MUST DIFFER. The access-immutability trigger that closed FD-12 admits a change only
# when `current_user` is the schema owner, because `set_access()` is SECURITY DEFINER and, in
# its own words, "a client role is never the owner". If the runtime role owned the objects,
# that sentence stops being true and the guard admits every request. MEASURED, 5 of 5, in
# `docs/superpowers/spikes/2026-11-17-ownership-topology.mjs`:
#
#   runtime IS the owner         -> a plain UPDATE promoted a row to admin. Guard never fired.
#   separate owner, plain client -> REFUSED, and set_access() still succeeded.
#
# `FORCE ROW LEVEL SECURITY` does NOT substitute for this. With FORCE on, the owner still
# promoted itself: FORCE governs row VISIBILITY, the trigger compares `current_user` to the
# owner. Two mechanisms, neither covering the other. Both are needed.
#
# WHAT IT COSTS, KNOWINGLY: the `migrate` service used to reuse `orbit_app` precisely so that
# no new secret appeared in the template. It now needs the owner's credential, so the instance
# carries one more. Recorded in the FD-38 addendum rather than discovered here.
set -euo pipefail
: "${ORBIT_DB_PASSWORD:?ORBIT_DB_PASSWORD is required}"
: "${ORBIT_OWNER_PASSWORD:?ORBIT_OWNER_PASSWORD is required}"
: "${PAPERCLIP_DB_PASSWORD:?PAPERCLIP_DB_PASSWORD is required}"

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname postgres \
  -v orbit_pw="$ORBIT_DB_PASSWORD" \
  -v owner_pw="$ORBIT_OWNER_PASSWORD" \
  -v paperclip_pw="$PAPERCLIP_DB_PASSWORD" <<'SQL'
CREATE ROLE orbit_owner   LOGIN PASSWORD :'owner_pw';
CREATE ROLE orbit_app     LOGIN PASSWORD :'orbit_pw';
CREATE ROLE paperclip_app LOGIN PASSWORD :'paperclip_pw';

-- The owner owns the database. orbit_app is a guest in it.
CREATE DATABASE orbit OWNER orbit_owner;
CREATE DATABASE paperclip OWNER paperclip_app;
REVOKE ALL ON DATABASE orbit FROM PUBLIC;
REVOKE ALL ON DATABASE paperclip FROM PUBLIC;
GRANT CONNECT ON DATABASE orbit TO orbit_app;

\connect orbit
CREATE EXTENSION IF NOT EXISTS vector;

-- Everything in `orbit` is created by orbit_owner from here on, so hand the schema over and
-- let the runtime in as a guest. Without the USAGE grant orbit_app cannot see the schema at
-- all, and Postgres reports that as `relation "..." does not exist` rather than a permission
-- error -- which reads like a missing table and sends you looking somewhere else entirely.
-- Found the hard way while building the S1 test.
ALTER SCHEMA public OWNER TO orbit_owner;
GRANT USAGE ON SCHEMA public TO orbit_app;

-- The runtime reads and writes ROWS. It does not create, alter or drop anything, which is
-- what keeps it a non-owner and keeps the FD-12 trigger meaningful. DEFAULT PRIVILEGES apply
-- to tables orbit_owner creates LATER, which is every table, because the migrations have not
-- run yet when this script executes.
ALTER DEFAULT PRIVILEGES FOR ROLE orbit_owner IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO orbit_app;
ALTER DEFAULT PRIVILEGES FOR ROLE orbit_owner IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO orbit_app;
ALTER DEFAULT PRIVILEGES FOR ROLE orbit_owner IN SCHEMA public
  GRANT EXECUTE ON FUNCTIONS TO orbit_app;
SQL
