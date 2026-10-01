# Orbitcrew (ORBIT-OS)

Owner-first lead replies, one dedicated instance per customer. The build is specified in
`ORBIT_OS_PRD_v6_2.md`, which is the single source of truth; `TODOS.md` holds deferred work and
`DESIGN.md` the visual tokens.

## Running the db tests on Windows + WSL2 Docker

Docker runs inside WSL2 on this machine, and `docker` is not on the Windows PATH. Node, pnpm and
Git run in PowerShell. The split is this:

- **Docker commands run in WSL.** `pnpm db:up` and `pnpm db:down` handle that for you: they call
  `scripts/dev-db.mjs`, which invokes `wsl.exe` on Windows and plain `docker` elsewhere, so the
  same command works here and in CI.
- **pnpm commands run in PowerShell**, from the repo root.

One-time setup: copy `.env.example` to `.env.local` and fill in the keys. Keep
`ORBIT_DB_HOST_PORT=5433`, because the native Windows PostgreSQL 18 service already owns 5432, and
keep `DATABASE_URL` on the same port. Both `pnpm db:up` and the tests read that one setting —
db:up through `scripts/dev-db.mjs`, the tests through `vitest.config.ts`.

From PowerShell:

```powershell
pnpm install --frozen-lockfile
pnpm db:generate     # Prisma client
pnpm db:up           # starts orbit-dev-postgres-1 on 127.0.0.1:5433 and redis on 6379
pnpm test            # unit + db projects
pnpm db:down         # stops the stack and removes its volumes
```

`pnpm db:up` waits for the health checks, so the tests can run as soon as it returns. The db
project rebuilds its schema on every run: `db/test/global-setup.ts` drops the `public` and `ledger`
schemas, recreates `public`, then runs `prisma migrate deploy`. It refuses to touch a database whose
name does not end in `_test`.

The equivalent straight from a WSL shell, if you prefer working there:

```bash
ORBIT_DB_HOST_PORT=5433 docker compose -f compose.dev.yml up -d --wait
```

### When the db tests fail to connect

- `ECONNREFUSED 127.0.0.1:5433` — the stack is not running. Check with
  `wsl docker compose -f compose.dev.yml ps`, then `pnpm db:up`.
- `P1001: Can't reach database server at localhost:5433` — use `127.0.0.1` in `DATABASE_URL`, not
  `localhost`. The containers publish on `127.0.0.1` only (SEC-1), `localhost` resolves to `::1`
  first on Windows, and Prisma does not fall back to IPv4 the way the `pg` driver does. The symptom
  misleads: the `pg`-based login tests pass while every Prisma test fails.
- `ECONNREFUSED 127.0.0.1:5433` a minute after a successful `pnpm db:up` — the WSL2 engine shuts
  down when no WSL session is open, which exits the containers with status 0. They carry
  `restart: unless-stopped`, so they return with the engine. For a long run, hold a session open in
  another window with `wsl bash -c "sleep 900"`.
- `password authentication failed for user "orbit_app"` (28P01) — the container's data directory
  predates `template/postgres/init/01-databases.sh`, which runs only on an empty volume. Recreate
  it with `pnpm db:down` followed by `pnpm db:up`.
- Tests hit 5432 instead of 5433 — `ORBIT_DB_HOST_PORT` is missing from `.env.local`.

## Other commands

```powershell
pnpm test:unit       # no database needed
pnpm test:db         # database only
pnpm typecheck
pnpm posture:check   # engine containment report (FLT-7, SEC-6)
pnpm stack:up        # the full instance stack from template/compose.yml
pnpm stack:down
```
