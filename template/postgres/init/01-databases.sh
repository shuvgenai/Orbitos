#!/usr/bin/env bash
# Creates the instance's two databases with separate logins (PRD DEP-1, SEC-2a).
# Runs once, on an empty data directory, from docker-entrypoint-initdb.d.
set -euo pipefail
: "${ORBIT_DB_PASSWORD:?ORBIT_DB_PASSWORD is required}"
: "${PAPERCLIP_DB_PASSWORD:?PAPERCLIP_DB_PASSWORD is required}"

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname postgres \
  -v orbit_pw="$ORBIT_DB_PASSWORD" -v paperclip_pw="$PAPERCLIP_DB_PASSWORD" <<'SQL'
CREATE ROLE orbit_app LOGIN PASSWORD :'orbit_pw';
CREATE ROLE paperclip_app LOGIN PASSWORD :'paperclip_pw';
CREATE DATABASE orbit OWNER orbit_app;
CREATE DATABASE paperclip OWNER paperclip_app;
REVOKE ALL ON DATABASE orbit FROM PUBLIC;
REVOKE ALL ON DATABASE paperclip FROM PUBLIC;
\connect orbit
CREATE EXTENSION IF NOT EXISTS vector;
SQL
