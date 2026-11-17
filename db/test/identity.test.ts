import { randomUUID } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';

import { createPrisma, type PrismaClient } from '../src/client.ts';
import { withIdentity } from '../src/identity.ts';
import { testPrisma } from './helpers.ts';

/**
 * The session-to-claim bridge, proven against a real policy. FD-38 stage S1.
 *
 * This was a spike before it was a test; FD-38 records its results and says it becomes a test
 * when S1 ships. This is that. Every assertion below ran as a spike first, which is why the
 * numbers in FD-38 can be checked rather than believed.
 *
 * WHY IT BUILDS ITS OWN TABLE AND ITS OWN ROLE
 *
 * Two reasons, and the second is the whole point of the file:
 *
 *   1. No product table carries RLS yet. S2 adopts `orgs`/`profiles` and their policies; this
 *      stage proves the MECHANISM that S2 will depend on, so it needs a policy of its own.
 *   2. `DATABASE_URL` for this suite connects as `postgres`, a SUPERUSER — and RLS is never
 *      applied to a superuser, FORCE or not. A test that used the suite's own connection
 *      would pass while proving nothing at all. So it creates a plain login role, gives it a
 *      table, and connects as that.
 *
 * `connection_limit=1` is deliberate: it forces every request onto one physical connection,
 * which is the pessimal case for claim leakage and the only honest way to test it.
 */

const APP_ROLE = 'rls_probe';
const APP_PW = 'rls_probe_pw';
const TABLE = 'identity_probe';

const USER_A = randomUUID();
const USER_B = randomUUID();

let admin: PrismaClient;
let app: PrismaClient;

const appUrl = () => {
  const u = new URL(process.env.DATABASE_URL!);
  u.username = APP_ROLE;
  u.password = APP_PW;
  u.searchParams.set('connection_limit', '1');
  return u.toString();
};

const rows = (tx: { $queryRawUnsafe: (q: string) => Promise<unknown> }) =>
  tx.$queryRawUnsafe(`select owner_id, body from ${TABLE}`) as Promise<
    { owner_id: string; body: string }[]
  >;

beforeAll(async () => {
  admin = testPrisma();
  await admin.$executeRawUnsafe(`drop table if exists ${TABLE}`);
  await admin.$executeRawUnsafe(`drop role if exists ${APP_ROLE}`);
  await admin.$executeRawUnsafe(`create role ${APP_ROLE} login password '${APP_PW}'`);
  // `global-setup.ts` does `DROP SCHEMA public CASCADE; CREATE SCHEMA public`, and a schema
  // recreated that way carries NO grants for anybody but its owner. Without this the probe
  // role cannot see into `public` at all, and Postgres reports that as
  //   relation "identity_probe" does not exist
  // rather than as a permission error — which reads like a missing table and sends you
  // looking in the wrong place entirely. S2 will meet the same thing when `orbit_app` is
  // given tables in a freshly built test database.
  await admin.$executeRawUnsafe(`grant usage on schema public to ${APP_ROLE}`);

  // Identity read exactly as `orbitcrew` migration 0005 does it: the claim, then `sub`, then
  // uuid — and NULL on anything malformed, because a claim nobody can parse is nobody.
  await admin.$executeRawUnsafe(`
    create or replace function identity_probe_user_id() returns uuid
    language plpgsql stable as $fn$
    DECLARE claims text; sub text;
    BEGIN
      claims := current_setting('request.jwt.claims', true);
      IF claims IS NULL OR claims = '' THEN RETURN NULL; END IF;
      sub := (claims::jsonb) ->> 'sub';
      IF sub IS NULL OR sub = '' THEN RETURN NULL; END IF;
      RETURN sub::uuid;
    EXCEPTION WHEN others THEN RETURN NULL;
    END $fn$;`);

  await admin.$executeRawUnsafe(
    `create table ${TABLE} (id uuid primary key default gen_random_uuid(),
                            owner_id uuid not null, body text not null)`);
  await admin.$executeRawUnsafe(
    `insert into ${TABLE} (owner_id, body) values ($1,'A note'),($2,'B note')`, USER_A, USER_B);

  // Owned by the app role, exactly as the real tables are owned by `orbit_app`.
  await admin.$executeRawUnsafe(`alter table ${TABLE} owner to ${APP_ROLE}`);
  await admin.$executeRawUnsafe(`alter table ${TABLE} enable row level security`);
  await admin.$executeRawUnsafe(
    `create policy own_rows on ${TABLE} for select using (owner_id = identity_probe_user_id())`);
  await admin.$executeRawUnsafe(`grant select on ${TABLE} to ${APP_ROLE}`);

  app = createPrisma(appUrl());
}, 60_000);

afterAll(async () => {
  await app?.$disconnect();
  await admin.$executeRawUnsafe(`drop table if exists ${TABLE}`);
  await admin.$executeRawUnsafe(`drop function if exists identity_probe_user_id()`);
  // `drop role` alone fails with
  //   role "rls_probe" cannot be dropped because some objects depend on it
  // because the schema grant above still references it. DROP OWNED BY removes the role's
  // objects AND the privileges granted to it, which is what makes the drop possible. Left
  // behind, the role would survive into the next run and `create role` would fail.
  await admin.$executeRawUnsafe(`drop owned by ${APP_ROLE}`);
  await admin.$executeRawUnsafe(`drop role if exists ${APP_ROLE}`);
  await admin.$disconnect();
});

describe('the two ways RLS is silently inert — both fail OPEN, both live today', () => {
  test('a table OWNER bypasses its own policy until FORCE is applied', async () => {
    // No FORCE yet. The app role owns the table, so the policy does not apply to it.
    const seen = await withIdentity(app, { profileId: USER_A }, rows);
    expect(seen).toHaveLength(2);
    // Now make it real for the rest of the file.
    await admin.$executeRawUnsafe(`alter table ${TABLE} force row level security`);
  });

  test('a SUPERUSER is not restrained even with FORCE', async () => {
    const seen = await withIdentity(admin, { profileId: USER_A }, rows);
    expect(seen).toHaveLength(2);
  });
});

describe('the bridge', () => {
  test('GREEN: the owning user reads their own row', async () => {
    const seen = await withIdentity(app, { profileId: USER_A }, rows);
    expect(seen).toHaveLength(1);
    expect(seen[0]!.owner_id).toBe(USER_A);
  });

  test('RED: a different user gets ZERO ROWS — filtered, not refused', async () => {
    // An ERROR here would mean the policy is not doing the work. Absence is the assertion.
    const seen = await withIdentity(app, { profileId: USER_B }, rows);
    expect(seen.filter((r) => r.owner_id === USER_A)).toHaveLength(0);
    expect(seen).toHaveLength(1);
    expect(seen[0]!.owner_id).toBe(USER_B);
  });

  test('RED: no identity sees nothing, so forgetting the wrapper exposes no data', async () => {
    expect(await withIdentity(app, null, rows)).toHaveLength(0);
  });

  test('a malformed profile id is refused loudly, not read as NULL', async () => {
    // Left to the database this would parse as NULL and return zero rows, which looks exactly
    // like "this user owns nothing" and gets debugged for an hour.
    await expect(withIdentity(app, { profileId: 'not-a-uuid' }, rows)).rejects.toThrow(/uuid/i);
  });
});

describe('connection reuse — the failure that passes a naive test', () => {
  test('a claim does NOT survive into the next request on the same connection', async () => {
    await withIdentity(app, { profileId: USER_A }, rows);
    expect(await withIdentity(app, null, rows)).toHaveLength(0);
  });

  test('200 interleaved concurrent requests each see only their own row', async () => {
    const jobs = Array.from({ length: 200 }, (_, i) => {
      const who = i % 2 === 0 ? USER_A : USER_B;
      return withIdentity(app, { profileId: who }, rows).then((r) => ({ who, r }));
    });
    const bad = (await Promise.all(jobs)).filter(
      ({ who, r }) => r.length !== 1 || r[0]!.owner_id !== who);
    expect(bad).toHaveLength(0);
  });

  test('COUNTEREXAMPLE: is_local=false DOES leak, so the `true` is load-bearing', async () => {
    // Not a reimplementation of the wrapper — the opposite of it, on purpose. Without this,
    // the no-leak test above could be passing because each request got a fresh connection
    // rather than because the flag works, and nobody would know which.
    await app.$transaction(async (tx) => {
      const claims = JSON.stringify({ sub: USER_A });
      await tx.$executeRaw`select set_config('request.jwt.claims', ${claims}, false)`;
      return rows(tx);
    });
    const after = await withIdentity(app, null, rows);
    expect(after.length).toBeGreaterThan(0);
    await app.$executeRawUnsafe(`select set_config('request.jwt.claims','',false)`);
  });
});

/**
 * The guard half of S1.
 *
 * The bridge is only worth anything if it is the ONLY thing that sets the claim. A second
 * call site — especially one that passes `false` — reintroduces exactly the leak the
 * counterexample above demonstrates, and it would do so in a build where every other test
 * still passes. So the call site is pinned.
 *
 * FD-38's S1 row also asks for a guard that fails when a ROUTE reaches Prisma without the
 * wrapper. That one is deliberately NOT here: no product table carries RLS until S2, so such
 * a guard would enforce nothing today and would have to allowlist every existing caller —
 * a list that reads as a rule while asserting almost nothing. It belongs with S2, where
 * removing entries from it is the measure of progress. Saying so here rather than shipping
 * a hollow version of it.
 */
describe('the claim is set in exactly one place', () => {
  const ROOTS = ['db/src', 'api/src', 'frontdesk/src', 'worker/src', 'ops/src', 'shared/src', 'src'];
  const SETTER = "set_config('request.jwt.claims'";
  const SEP = String.fromCharCode(92); // a backslash, written this way so no escape can be mangled

  // The wrapper, and this file's own counterexample and its reset.
  const ALLOWED = new Set(['db/src/identity.ts', 'db/test/identity.test.ts']);

  const walk = (dir: string): string[] => {
    let out: string[] = [];
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return out; // a root that does not exist in this checkout is not a finding
    }
    for (const e of entries) {
      const p = join(dir, e.name);
      if (e.isDirectory()) {
        if (e.name === 'node_modules' || e.name === 'generated') continue;
        out = out.concat(walk(p));
      } else if (/\.(ts|tsx|mts|mjs|js)$/.test(e.name)) {
        out.push(p);
      }
    }
    return out;
  };

  const sources = ROOTS.flatMap(walk).concat(['db/test/identity.test.ts']);

  test('the walk actually read something', () => {
    // Without this, a renamed directory turns the two assertions below into vacuous passes.
    expect(sources.length).toBeGreaterThan(50);
  });

  test('only the wrapper sets request.jwt.claims', () => {
    const offenders = sources.filter((f) => {
      const norm = f.split(SEP).join('/');
      return !ALLOWED.has(norm) && readFileSync(f, 'utf8').includes(SETTER);
    });
    expect(offenders).toEqual([]);
  });

  test('nothing outside this test sets the claim with is_local=false', () => {
    // `false` makes the value session-scoped, so under a pool the next request inherits the
    // previous user's identity. Proven above. There is no legitimate product use for it.
    const offenders = sources.filter((f) => {
      const norm = f.split(SEP).join('/');
      if (norm === 'db/test/identity.test.ts') return false;
      const body = readFileSync(f, 'utf8');
      return /set_config\(\s*'request\.jwt\.claims'[^)]*,\s*false\s*\)/.test(body);
    });
    expect(offenders).toEqual([]);
  });
});
