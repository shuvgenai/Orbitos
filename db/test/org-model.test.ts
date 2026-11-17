import { randomUUID } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';

import { createPrisma, type PrismaClient } from '../src/client.ts';
import { withIdentity } from '../src/identity.ts';
import { dropProbeRole, makeProbeRole, probeUrl, testPrisma } from './helpers.ts';

/**
 * The org model, after the port. FD-38 stage S2b.
 *
 * Two kinds of assertion here, and the split is deliberate:
 *
 *   1. STRUCTURE — read out of `pg_class` and `pg_policies` rather than out of a comment.
 *      A table that loses FORCE, or a policy that disappears from the migration, is a build
 *      failure. These are the guards FD-38's S2 row asks for.
 *   2. BEHAVIOUR — a real non-superuser login, through the real `withIdentity` bridge,
 *      against the real policies. Structure can be right while the rules do nothing.
 */

const PROBE = 'org_probe';
const PROBE_PW = 'org_probe_pw';
const TABLES = ['orgs', 'departments', 'profiles', 'profile_authorities'] as const;

let admin: PrismaClient;
let app: PrismaClient;

// Two offices and a person in each, so "sees their own" can be told apart from "sees all".
const ORG_A = randomUUID();
const ORG_B = randomUUID();
const USER_A = randomUUID();
const USER_B = randomUUID();

beforeAll(async () => {
  admin = testPrisma();
  await makeProbeRole(admin, PROBE, PROBE_PW);
  await admin.$executeRawUnsafe(`grant usage on schema orbitcrew to ${PROBE}`);
  await admin.$executeRawUnsafe(
    `grant select, insert, update, delete on all tables in schema orbitcrew to ${PROBE}`);
  await admin.$executeRawUnsafe(`grant execute on all functions in schema orbitcrew to ${PROBE}`);

  await admin.$executeRawUnsafe(
    `insert into orbitcrew.orgs (id, name, domain) values ($1,'Office A','a.example.invalid'),($2,'Office B','b.example.invalid')`,
    ORG_A, ORG_B);
  await admin.$executeRawUnsafe(
    `insert into orbitcrew.profiles (id, org_id, email, name, access)
     values ($1,$2,'a@example.invalid','Ann','admin'),($3,$4,'b@example.invalid','Bo','user')`,
    USER_A, ORG_A, USER_B, ORG_B);

  app = createPrisma(probeUrl(PROBE, PROBE_PW));
}, 60_000);

afterAll(async () => {
  await app?.$disconnect();
  // Delete the OFFICES and let the cascade take the profiles with them. Deleting profiles
  // directly trips the ported deferred trigger --
  //   an office must keep at least one Org Admin
  // -- which is the guard doing its job: removing the last admin from a surviving office is
  // exactly what it refuses. The office going too is the case it permits.
  await admin.$executeRawUnsafe(`delete from orbitcrew.orgs where id in ($1,$2)`, ORG_A, ORG_B);
  await dropProbeRole(admin, PROBE);
  await admin.$disconnect();
});

describe('structure — read from the catalogue, not from a comment', () => {
  test('every adopted table has RLS ENABLED and FORCED', async () => {
    const rows = (await admin.$queryRawUnsafe(
      `select c.relname, c.relrowsecurity, c.relforcerowsecurity
         from pg_class c join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'orbitcrew' and c.relkind = 'r' order by 1`,
    )) as { relname: string; relrowsecurity: boolean; relforcerowsecurity: boolean }[];

    // A guard with nothing to read is not a guard that passed: if the schema were empty, or
    // renamed, every assertion below would be vacuously true.
    expect(rows.length, 'no tables found in the orbitcrew schema').toBeGreaterThan(0);
    expect(rows.map((r) => r.relname).sort()).toEqual([...TABLES].sort());

    for (const r of rows) {
      expect(r.relrowsecurity, `${r.relname} does not have RLS enabled`).toBe(true);
      // FORCE MUST NOT BE SET, and this assertion is the inverse of the one that shipped in
      // S2b. FORCE subjects a table's OWNER to its own policies -- and every policy here
      // calls orbitcrew.current_org(), a SECURITY DEFINER function that SELECTs from
      // `profiles`, one of the guarded tables. Under FORCE that SELECT fires the policy, the
      // policy calls the function, and Postgres gives up:
      //     54001 stack depth limit exceeded
      // Measured with one variable changed at a time: FORCE off + plain owner works, FORCE on
      // + plain owner recurses, FORCE on + SUPERUSER owner works -- and the third is what
      // this suite has, which is why S2b passed while production would have failed.
      // Removed by migration 20261117000200. What replaces it is the ownership split: the
      // runtime does not own these tables, so RLS binds it either way.
      expect(r.relforcerowsecurity, `${r.relname} is FORCEd, which recurses in production`).toBe(false);
    }
  });

  test('the nine policies are all present', async () => {
    const rows = (await admin.$queryRawUnsafe(
      `select tablename, policyname from pg_policies where schemaname = 'orbitcrew' order by 1,2`,
    )) as { tablename: string; policyname: string }[];
    expect(rows).toHaveLength(9);
    expect(rows.map((r) => `${r.tablename}.${r.policyname}`)).toEqual([
      'departments.departments_admin_write',
      'departments.departments_member_select',
      'orgs.orgs_admin_update',
      'orgs.orgs_member_select',
      'profile_authorities.authorities_admin_write',
      'profile_authorities.authorities_member_select',
      'profiles.profiles_admin_update',
      'profiles.profiles_member_select',
      'profiles.profiles_self_update',
    ]);
  });

  test('the identity functions and the access trigger exist', async () => {
    const fns = (await admin.$queryRawUnsafe(
      `select proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'orbitcrew' order by 1`,
    )) as { proname: string }[];
    for (const needed of ['current_user_id', 'current_access', 'current_org', 'profiles_guard_access']) {
      expect(fns.map((f) => f.proname)).toContain(needed);
    }
    const trg = (await admin.$queryRawUnsafe(
      `select t.tgname from pg_trigger t join pg_class c on c.oid = t.tgrelid
         join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'orbitcrew' and not t.tgisinternal order by 1`,
    )) as { tgname: string }[];
    expect(trg.map((t) => t.tgname)).toContain('profiles_guard_access');
  });
});

describe('behaviour — a real non-superuser login through the real bridge', () => {
  const orgsSeen = (tx: { $queryRawUnsafe: (q: string) => Promise<unknown> }) =>
    tx.$queryRawUnsafe(`select id, name from orbitcrew.orgs`) as Promise<{ id: string }[]>;

  test('a member sees their own office', async () => {
    const seen = await withIdentity(app, { profileId: USER_A }, orgsSeen);
    expect(seen).toHaveLength(1);
    expect(seen[0]!.id).toBe(ORG_A);
  });

  test("and sees ZERO rows of the other office — filtered, not refused", async () => {
    const seen = await withIdentity(app, { profileId: USER_B }, orgsSeen);
    expect(seen.filter((o) => o.id === ORG_A)).toHaveLength(0);
    expect(seen).toHaveLength(1);
    expect(seen[0]!.id).toBe(ORG_B);
  });

  test('an unauthenticated request sees nothing at all', async () => {
    expect(await withIdentity(app, null, orgsSeen)).toHaveLength(0);
  });

  test('profiles are scoped the same way', async () => {
    const seen = (await withIdentity(app, { profileId: USER_A }, (tx) =>
      tx.$queryRawUnsafe(`select id from orbitcrew.profiles`))) as { id: string }[];
    expect(seen.map((p) => p.id)).toEqual([USER_A]);
  });
});

describe('the FD-12 guard, which is the reason for the owner split', () => {
  test('a client cannot write `access` directly, whatever its own role says', async () => {
    // USER_A is an admin of their own office and still cannot do this: changing access is not
    // a matter of being an admin, it is a matter of going through set_access() (S3). The
    // trigger admits the change only when current_user is the SCHEMA OWNER, and the probe
    // role is not -- which is exactly what the FD-38 addendum made true in production.
    await expect(
      withIdentity(app, { profileId: USER_A }, (tx) =>
        tx.$executeRawUnsafe(
          `update orbitcrew.profiles set access = 'super' where id = '${USER_A}'`)),
    ).rejects.toThrow(/not writable/i);
  });

  test('the probe role is not the schema owner, which is what makes that guard bite', async () => {
    const [row] = (await withIdentity(app, { profileId: USER_A }, (tx) =>
      tx.$queryRawUnsafe(
        `select current_user = pg_get_userbyid(nspowner) as is_owner
           from pg_namespace where nspname = 'orbitcrew'`))) as { is_owner: boolean }[];
    expect(row!.is_owner).toBe(false);
  });

  test('and it is neither a superuser nor BYPASSRLS, or none of the above would mean anything', async () => {
    const [row] = (await admin.$queryRawUnsafe(
      `select rolsuper, rolbypassrls from pg_roles where rolname = '${PROBE}'`,
    )) as { rolsuper: boolean; rolbypassrls: boolean }[];
    expect(row!.rolsuper).toBe(false);
    expect(row!.rolbypassrls).toBe(false);
  });
});

/**
 * THE ROUTE GUARD. FD-38 stage S2c, and the piece S1 deliberately deferred.
 *
 * At S1 this could not be written: no product table carried RLS, so a guard would have had to
 * allowlist every existing Prisma caller -- a list that reads as a rule while asserting
 * almost nothing. Now the org model exists and NOTHING references it yet, so the rule can be
 * absolute from the start. That is the cheapest a guard like this will ever be: there is
 * nothing to grandfather in, and the first file that gets it wrong is caught on the commit
 * that writes it.
 *
 * THE RULE. A file that names one of the adopted tables must reach it through
 * `withIdentity`. Querying them on a bare client is not a style mistake: the policies are
 * keyed on `request.jwt.claims`, so a query outside the wrapper carries no identity, matches
 * nothing, and returns an empty result that looks exactly like "this office has no data".
 * The failure is silent in the worst direction -- it reads as absence, not as a refusal.
 */
describe('nothing reaches the org model except through withIdentity', () => {
  const SEP = String.fromCharCode(92); // a backslash, written so no escape can be mangled
  const ROOTS = ['db/src', 'api/src', 'frontdesk/src', 'worker/src', 'ops/src', 'shared/src', 'src'];
  const MODELS = /orbitcrew\.(orgs|departments|profiles|profile_authorities)\b/;

  // The test that exercises the policies directly, and nothing else. The migration is not
  // under any source root, so it needs no exemption.
  const ALLOWED = new Set(['db/test/org-model.test.ts']);

  const walk = (dir: string): string[] => {
    let out: string[] = [];
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return out;
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

  const sources = ROOTS.flatMap(walk).concat(['db/test/org-model.test.ts']);

  test('the walk read something, so the two rules below are not vacuous', () => {
    expect(sources.length).toBeGreaterThan(50);
  });

  test('every file naming an adopted table also uses withIdentity', () => {
    const offenders = sources.filter((f) => {
      const norm = f.split(SEP).join('/');
      if (ALLOWED.has(norm)) return false;
      const body = readFileSync(f, 'utf8');
      return MODELS.test(body) && !body.includes('withIdentity');
    });
    expect(offenders).toEqual([]);
  });

  test('and the guard itself can see a violation when there is one', () => {
    // A guard that has never matched anything is a guard nobody has tested. This proves the
    // detector works on a known-bad string without needing a file planted on disk.
    const bad = "await prisma.$queryRaw`select * from orbitcrew.profiles`";
    expect(MODELS.test(bad) && !bad.includes('withIdentity')).toBe(true);
    const good = "await withIdentity(prisma, id, (tx) => tx.$queryRaw`select * from orbitcrew.profiles`)";
    expect(MODELS.test(good) && !good.includes('withIdentity')).toBe(false);
  });
});

/**
 * THE REGRESSION GUARD FOR THE DEFECT S2b SHIPPED.
 *
 * S2b put FORCE on every table, every test passed, and production would have failed on the
 * first query with `54001 stack depth limit exceeded`. The suite could not see it because
 * `DATABASE_URL` connects as `postgres`: the migration ran as a superuser, so the schema is
 * owned by one, and a SECURITY DEFINER function owned by a superuser bypasses RLS -- the
 * recursion never forms.
 *
 * So the environment hid the bug, and no assertion about the real schema could have caught
 * it while the real schema is owned by a superuser. This block therefore BUILDS THE
 * PRODUCTION ARRANGEMENT -- a plain, non-superuser owner -- and proves the pattern both ways
 * round. It is the only test here that can fail for this reason, and it is the reason it
 * exists.
 */
describe('a policy that calls a SECURITY DEFINER helper reading the guarded table', () => {
  const S = 'force_regress';
  const OWNER = 'force_regress_owner';
  const CLIENT = 'force_regress_client';
  const ORG = '11111111-1111-1111-1111-111111111111';
  const ME = '22222222-2222-2222-2222-222222222222';

  /** Build the arrangement with FORCE on or off, query it as a plain client, return the error. */
  async function trial(force: boolean): Promise<string | null> {
    await admin.$executeRawUnsafe(`drop schema if exists ${S} cascade`);
    for (const r of [OWNER, CLIENT]) {
      await admin.$executeRawUnsafe(`drop owned by ${r}`).catch(() => undefined);
      await admin.$executeRawUnsafe(`drop role if exists ${r}`).catch(() => undefined);
      await admin.$executeRawUnsafe(`create role ${r} login password '${r}_pw'`);
    }
    await admin.$executeRawUnsafe(`create schema ${S} authorization ${OWNER}`);
    await admin.$executeRawUnsafe(`grant usage on schema ${S} to ${CLIENT}`);
    await admin.$executeRawUnsafe(
      `create table ${S}.profiles (id uuid primary key, org_id uuid)`);
    await admin.$executeRawUnsafe(`alter table ${S}.profiles owner to ${OWNER}`);
    await admin.$executeRawUnsafe(
      `create function ${S}.current_org() returns uuid language sql stable
       security definer set search_path to '${S}','pg_temp' as
       $f$ select p.org_id from ${S}.profiles p
            where p.id = nullif(current_setting('app.uid', true), '')::uuid $f$`);
    await admin.$executeRawUnsafe(`alter function ${S}.current_org() owner to ${OWNER}`);
    await admin.$executeRawUnsafe(`alter table ${S}.profiles enable row level security`);
    if (force) await admin.$executeRawUnsafe(`alter table ${S}.profiles force row level security`);
    await admin.$executeRawUnsafe(
      `create policy member_select on ${S}.profiles for select using (org_id = ${S}.current_org())`);
    await admin.$executeRawUnsafe(`grant select on ${S}.profiles to ${CLIENT}`);
    await admin.$executeRawUnsafe(`grant execute on all functions in schema ${S} to ${CLIENT}`);
    await admin.$executeRawUnsafe(`insert into ${S}.profiles values ($1,$2)`, ME, ORG);

    const u = new URL(process.env.DATABASE_URL!);
    u.username = CLIENT;
    u.password = `${CLIENT}_pw`;
    const c = createPrisma(u.toString());
    let err: string | null = null;
    try {
      await c.$transaction(async (tx) => {
        await tx.$executeRawUnsafe(`select set_config('app.uid', '${ME}', true)`);
        await tx.$queryRawUnsafe(`select id from ${S}.profiles`);
      });
    } catch (e) {
      err = String(e);
    }
    await c.$disconnect();
    await admin.$executeRawUnsafe(`drop schema if exists ${S} cascade`);
    for (const r of [OWNER, CLIENT]) {
      await admin.$executeRawUnsafe(`drop owned by ${r}`).catch(() => undefined);
      await admin.$executeRawUnsafe(`drop role if exists ${r}`).catch(() => undefined);
    }
    return err;
  }

  test('works when the owner is a plain role and FORCE is OFF — the shipped arrangement', async () => {
    expect(await trial(false)).toBeNull();
  }, 60_000);

  test('RECURSES when FORCE is ON, which is the defect S2b shipped and this suite hid', async () => {
    const err = await trial(true);
    expect(err, 'FORCE no longer recurses -- re-read migration 20261117000200 before relying on it').not.toBeNull();
    expect(err).toMatch(/stack depth|recursion/i);
  }, 60_000);
});
