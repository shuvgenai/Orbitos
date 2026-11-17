import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';

import { createPrisma, type PrismaClient } from '../src/client.ts';
import { withIdentity } from '../src/identity.ts';
import { dropProbeRole, makeProbeRole, probeUrl, testPrisma } from './helpers.ts';

/**
 * `set_access()` and its five ordered guards. FD-38 stage S3.
 *
 * WHAT IS BEING TESTED HERE, AND WHAT IS NOT. The guards are plpgsql logic -- they read
 * current_access(), compare offices, count admins -- and that logic behaves identically
 * whoever owns the schema. So these cases run against the real schema through a plain probe
 * role, which is faithful for what they assert.
 *
 * What they do NOT prove is the OWNERSHIP mechanism: that a client cannot write `access`
 * directly while the SECURITY DEFINER function can. In this suite the schema is owned by
 * `postgres`, so the definer runs as a superuser and would succeed for the wrong reason --
 * see FD-38 addendum 2. That property is proven elsewhere, deliberately, by tests that build
 * the production arrangement instead of borrowing this one:
 *   - org-model.test.ts, "a client cannot write `access` directly"
 *   - org-model.test.ts, the FORCE regression block, which builds a plain non-superuser owner
 *   - the ownership spike in orbitos-infra docs/superpowers/spikes/
 *
 * THE ORDER IS THE POINT. The guards run 1, 3, 4, 2, 5. Several cases below assert WHICH
 * guard refused, not merely that something did: a reordering that catches the right thing on
 * the wrong guard is a failure here, because the refusal wording is what stops this function
 * being a directory lookup.
 */

const PROBE = 'access_probe';
const PROBE_PW = 'access_probe_pw';

const ORG_A = randomUUID();
const ORG_B = randomUUID();
const ADMIN_A = randomUUID();      // the caller in most cases
const ADMIN_A2 = randomUUID();     // a second admin, so A is not the last one
const USER_A = randomUUID();
const ADMIN_B = randomUUID();      // another office
const USER_B = randomUUID();
const SUPER = randomUUID();        // operator: no org
const SOLO_ORG = randomUUID();
const SOLO_ADMIN = randomUUID();   // the only admin of their office

let admin: PrismaClient;
let app: PrismaClient;

/** Call set_access as `caller`; resolve with the error message, or null on success. */
async function setAccess(caller: string, target: string, want: string): Promise<string | null> {
  try {
    await withIdentity(app, { profileId: caller }, (tx) =>
      tx.$executeRawUnsafe(`select orbitcrew.set_access($1, $2)`, target, want));
    return null;
  } catch (e) {
    return String(e);
  }
}

const accessOf = async (id: string): Promise<string> => {
  const rows = (await admin.$queryRawUnsafe(
    `select access::text as a from orbitcrew.profiles where id = $1`, id)) as { a: string }[];
  return rows[0]!.a;
};

beforeAll(async () => {
  admin = testPrisma();
  await makeProbeRole(admin, PROBE, PROBE_PW);
  await admin.$executeRawUnsafe(`grant usage on schema orbitcrew to ${PROBE}`);
  await admin.$executeRawUnsafe(
    `grant select, insert, update, delete on all tables in schema orbitcrew to ${PROBE}`);
  await admin.$executeRawUnsafe(`grant execute on all functions in schema orbitcrew to ${PROBE}`);

  await admin.$executeRawUnsafe(
    `insert into orbitcrew.orgs (id, name, domain) values
      ($1,'Office A','a.set-access.invalid'),
      ($2,'Office B','b.set-access.invalid'),
      ($3,'Solo','solo.set-access.invalid')`, ORG_A, ORG_B, SOLO_ORG);

  await admin.$executeRawUnsafe(
    `insert into orbitcrew.profiles (id, org_id, email, name, access) values
      ($1,$2,'admin-a@set-access.invalid','Admin A','admin'),
      ($3,$2,'admin-a2@set-access.invalid','Admin A2','admin'),
      ($4,$2,'user-a@set-access.invalid','User A','user'),
      ($5,$6,'admin-b@set-access.invalid','Admin B','admin'),
      ($7,$6,'user-b@set-access.invalid','User B','user'),
      ($8,$9,'solo@set-access.invalid','Solo Admin','admin')`,
    ADMIN_A, ORG_A, ADMIN_A2, USER_A, ADMIN_B, ORG_B, USER_B, SOLO_ADMIN, SOLO_ORG);

  // The operator carries no org at all -- `super_has_no_org`.
  await admin.$executeRawUnsafe(
    `insert into orbitcrew.profiles (id, org_id, email, name, access)
     values ($1, null, 'super@set-access.invalid', 'Operator', 'super')`, SUPER);

  // EVERY OFFICE MUST HOLD AT LEAST ONE LEADER, and without this the fixture cannot even
  // commit. `org_keeps_admin_and_leader` is a DEFERRED constraint trigger, so it fires at
  // COMMIT rather than at the statement -- which is why the first run of this file failed on
  // a later, unrelated-looking case with
  //     an office must keep at least one Leader
  // rather than here. S4 must grant this authority when it creates the first org admin, or
  // provisioning will fail at the end of the transaction with no obvious culprit.
  await admin.$executeRawUnsafe(
    `insert into orbitcrew.profile_authorities (profile_id, authority) values
      ($1,'leader'),($2,'leader'),($3,'leader')`, ADMIN_A, ADMIN_B, SOLO_ADMIN);

  app = createPrisma(probeUrl(PROBE, PROBE_PW));
}, 60_000);

afterAll(async () => {
  await app?.$disconnect();
  await admin.$executeRawUnsafe(`delete from orbitcrew.profiles where id = $1`, SUPER);
  // AUDIT ROWS FIRST. `audit_log_org_id_fkey` has NO cascade, deliberately -- the record of
  // what happened is not meant to vanish because the office did. So an office with history
  // cannot simply be deleted, and this teardown has to say so explicitly rather than trip
  //   23503 update or delete on table "orgs" violates foreign key constraint
  // That is not only a test concern: deleting an office in production will hit the same wall,
  // and whoever builds that will need a decision about where the history goes.
  await admin.$executeRawUnsafe(`delete from orbitcrew.audit_log where org_id in ($1,$2,$3)`,
    ORG_A, ORG_B, SOLO_ORG);
  await admin.$executeRawUnsafe(`delete from orbitcrew.orgs where id in ($1,$2,$3)`,
    ORG_A, ORG_B, SOLO_ORG);
  await dropProbeRole(admin, PROBE);
  await admin.$disconnect();
});

describe('each guard refuses with its own words', () => {
  test('GUARD 1 — a caller who is not an Org Admin', async () => {
    const err = await setAccess(USER_A, ADMIN_A2, 'user');
    expect(err).toMatch(/that change is not available to you/);
    expect(await accessOf(ADMIN_A2)).toBe('admin');
  });

  test('GUARD 3 — nobody changes their own access', async () => {
    const err = await setAccess(ADMIN_A, ADMIN_A, 'user');
    expect(err).toMatch(/you cannot change your own access/);
  });

  test('GUARD 4 — `super` is not granted from inside an office', async () => {
    const err = await setAccess(ADMIN_A, USER_A, 'super');
    expect(err).toMatch(/operator access is not granted from an office/);
    expect(await accessOf(USER_A)).toBe('user');
  });

  test('GUARD 4 — nor is a `super` target touched from one', async () => {
    const err = await setAccess(ADMIN_A, SUPER, 'user');
    expect(err).toMatch(/operator access is not granted from an office/);
    expect(await accessOf(SUPER)).toBe('super');
  });

  test('GUARD 2 — a target in another office', async () => {
    const err = await setAccess(ADMIN_A, USER_B, 'admin');
    expect(err).toMatch(/that change is not available to you/);
    expect(await accessOf(USER_B)).toBe('user');
  });

  test('GUARD 2 — and a target that does not exist says the SAME thing', async () => {
    // One sentence for every reason: no such person, another office, not your place to ask.
    // A function that answered differently would be a directory lookup -- a caller could
    // enumerate who exists by watching which refusal came back.
    const err = await setAccess(ADMIN_A, randomUUID(), 'admin');
    expect(err).toMatch(/that change is not available to you/);
  });
});

describe('the ORDER of the guards, which is what stops this leaking', () => {
  test('GUARD 1 runs before GUARD 4: a non-admin granting super hears guard 1', async () => {
    // If guard 4 ran first, a plain user would learn that `super` is a thing the system has
    // opinions about. They hear the generic sentence instead.
    const err = await setAccess(USER_A, USER_B, 'super');
    expect(err).toMatch(/that change is not available to you/);
    expect(err).not.toMatch(/operator access/);
  });

  test('GUARD 4 runs before GUARD 2: a super target in no office hears guard 4', async () => {
    // THE REASON THE ORDER IS NOT 1..5. A super admin carries no org_id, so the office check
    // would refuse them first and guard 4 would never execute. Infra's 0008 header records
    // this; the assertion is here so a reordering cannot pass quietly.
    const err = await setAccess(ADMIN_A, SUPER, 'admin');
    expect(err).toMatch(/operator access is not granted from an office/);
    expect(err).not.toMatch(/that change is not available to you/);
  });

  test('GUARD 3 runs before GUARD 5: the only admin demoting herself hears guard 3', async () => {
    // This is the invariant D5 wanted -- an office cannot lose its last Org Admin -- and it
    // is PINNED TO GUARD 3's message on purpose. Guard 5 is unreachable while this order
    // stands: guard 1 requires an admin caller and guard 3 refuses self-change, so either the
    // target is the caller or another admin exists and guard 5's count is at least 1.
    // Deleting guard 3 and letting guard 5 catch this instead is a FAILURE here, not a pass:
    // which lock is load-bearing must not change silently.
    const err = await setAccess(SOLO_ADMIN, SOLO_ADMIN, 'user');
    expect(err).toMatch(/you cannot change your own access/);
    expect(err).not.toMatch(/at least one Org Admin/);
    expect(await accessOf(SOLO_ADMIN)).toBe('admin');
  });
});

describe('the change itself, and the record of it', () => {
  test('an Org Admin may demote another admin in their own office', async () => {
    expect(await setAccess(ADMIN_A, ADMIN_A2, 'user')).toBeNull();
    expect(await accessOf(ADMIN_A2)).toBe('user');
  });

  test('GUARD 6 — the change wrote an audit row naming the before and after', async () => {
    const rows = (await admin.$queryRawUnsafe(
      `select actor, action, entity_type, entity_id, fields, detail
         from orbitcrew.audit_log
        where entity_id = $1 and action = 'access.changed'
        order by occurred_at desc limit 1`, ADMIN_A2)) as {
      actor: string; action: string; entity_type: string;
      entity_id: string; fields: string[]; detail: { from: string; to: string };
    }[];
    expect(rows).toHaveLength(1);
    expect(rows[0]!.actor).toBe(ADMIN_A);
    expect(rows[0]!.entity_type).toBe('profile');
    expect(rows[0]!.fields).toEqual(['access']);
    expect(rows[0]!.detail.from).toBe('admin');
    expect(rows[0]!.detail.to).toBe('user');
  });

  test('a no-op change succeeds and writes NO audit row', async () => {
    const before = (await admin.$queryRawUnsafe(
      `select count(*)::int as n from orbitcrew.audit_log where entity_id = $1`,
      USER_A)) as { n: number }[];
    expect(await setAccess(ADMIN_A, USER_A, 'user')).toBeNull();
    const after = (await admin.$queryRawUnsafe(
      `select count(*)::int as n from orbitcrew.audit_log where entity_id = $1`,
      USER_A)) as { n: number }[];
    // An audit log that records non-events is one nobody reads.
    expect(after[0]!.n).toBe(before[0]!.n);
  });

  test('and promoting a user back to admin works, so the guards are not simply refusing all', async () => {
    // Without this, every assertion above would be satisfied by a function that always threw.
    expect(await setAccess(ADMIN_A, ADMIN_A2, 'admin')).toBeNull();
    expect(await accessOf(ADMIN_A2)).toBe('admin');
  });
});

describe('the office invariants that sit underneath set_access', () => {
  test('an office must keep at least one Leader, enforced at COMMIT not at the statement', async () => {
    // This cost a confusing failure when the fixture above was first written: the trigger is
    // DEFERRED, so removing the last leader succeeds statement-by-statement and the
    // transaction dies at the end, pointing at nothing in particular.
    //
    // S4 MUST GRANT THIS when it creates an office's first admin. Provisioning that creates
    // an org and an admin and no leader will fail on commit.
    await expect(
      admin.$transaction(async (tx) => {
        await tx.$executeRawUnsafe(
          `delete from orbitcrew.profile_authorities where profile_id = $1 and authority = 'leader'`,
          ADMIN_A);
      }),
    ).rejects.toThrow(/at least one Leader/);

    // Still there: the refusal rolled the whole transaction back, not just the statement.
    const rows = (await admin.$queryRawUnsafe(
      `select count(*)::int as n from orbitcrew.profile_authorities
        where profile_id = $1 and authority = 'leader'`, ADMIN_A)) as { n: number }[];
    expect(rows[0]!.n).toBe(1);
  });

  test('and an office must keep at least one Org Admin, by the same trigger', async () => {
    // Guard 5 inside set_access() is unreachable (see the ordering block above), so THIS is
    // what actually holds the invariant. Demoting the only admin of an office directly --
    // which only the schema owner can do -- is refused at commit.
    await expect(
      admin.$transaction(async (tx) => {
        await tx.$executeRawUnsafe(
          `update orbitcrew.profiles set access = 'user' where id = $1`, SOLO_ADMIN);
      }),
    ).rejects.toThrow(/at least one Org Admin|not writable/);
  });
});
