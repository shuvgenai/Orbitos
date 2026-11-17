import { randomUUID } from 'node:crypto';
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
      // FORCE is what subjects the table's OWNER to its own policies. Without it the owner --
      // a real login here, which runs migrations and will run SECURITY DEFINER functions --
      // reads every row while the policies sit there looking like security.
      expect(r.relforcerowsecurity, `${r.relname} is not FORCEd`).toBe(true);
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
