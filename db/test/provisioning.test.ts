import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';

import { createPrisma, type PrismaClient } from '../src/client.ts';
import { withIdentity } from '../src/identity.ts';
import { dropProbeRole, makeProbeRole, probeUrl, testPrisma } from './helpers.ts';

/**
 * Operator provisioning. FD-38 stage S4.
 *
 * THESE TESTS RUN AGAINST AN EMPTY ORG MODEL, which is the only state provisioning is about.
 * Both functions refuse to act on an instance that already has profiles or an office, so the
 * fixture has to start from nothing and put it back afterwards. `fileParallelism: false` on
 * the db project is what makes that safe.
 */

const PROBE = 'prov_probe';
const PROBE_PW = 'prov_probe_pw';

let admin: PrismaClient;
let app: PrismaClient;

const OPERATOR = randomUUID();
const OFFICE_ADMIN = randomUUID();

/** Everything the org model holds, cleared, so each case starts from a known empty state. */
async function emptyTheModel(): Promise<void> {
  // ORDER MATTERS, and getting it wrong fails in a way that looks like a product bug.
  // Deleting `profile_authorities` first removes an office's last leader while the office
  // still exists, and `authorities_keep_leader` refuses it:
  //     an office must keep at least one Leader
  // Deleting the OFFICE first takes its profiles and their authorities with it by cascade,
  // and the trigger stands aside because the office it would be protecting is gone too.
  // audit_log goes first only because its org_id FK has no cascade, by design.
  await admin.$executeRawUnsafe(`delete from orbitcrew.audit_log`);
  await admin.$executeRawUnsafe(`delete from orbitcrew.orgs`);
  await admin.$executeRawUnsafe(`delete from orbitcrew.profile_authorities`);
  await admin.$executeRawUnsafe(`delete from orbitcrew.profiles`);
}

/** As the OWNER, with no identity: the operator's own invocation path. */
const asOwner = (sql: string, ...args: unknown[]) => admin.$executeRawUnsafe(sql, ...args);

beforeAll(async () => {
  admin = testPrisma();
  await makeProbeRole(admin, PROBE, PROBE_PW);
  await admin.$executeRawUnsafe(`grant usage on schema orbitcrew to ${PROBE}`);
  await admin.$executeRawUnsafe(
    `grant select, insert, update, delete on all tables in schema orbitcrew to ${PROBE}`);
  // NOTE: deliberately NOT `grant execute on all functions`. That is what every other fixture
  // here does, and it would hand the probe role bootstrap_operator -- hiding the one
  // privilege assertion this file exists to make.
  await admin.$executeRawUnsafe(
    `grant execute on function orbitcrew.provision_office(text, text, uuid, text, text) to ${PROBE}`);
  await admin.$executeRawUnsafe(`grant execute on function orbitcrew.current_user_id() to ${PROBE}`);
  await admin.$executeRawUnsafe(`grant execute on function orbitcrew.current_access() to ${PROBE}`);
  await admin.$executeRawUnsafe(`grant execute on function orbitcrew.current_org() to ${PROBE}`);
  app = createPrisma(probeUrl(PROBE, PROBE_PW));
  await emptyTheModel();
}, 60_000);

afterAll(async () => {
  await app?.$disconnect();
  await emptyTheModel();
  await dropProbeRole(admin, PROBE);
  await admin.$disconnect();
});

describe('bootstrap_operator — breaking the chicken and egg, once', () => {
  test('creates the first profile, a super with no office', async () => {
    await asOwner(`select orbitcrew.bootstrap_operator($1, $2, $3)`,
      OPERATOR, 'operator@provision.invalid', 'The Operator');
    const rows = (await admin.$queryRawUnsafe(
      `select access::text as access, org_id from orbitcrew.profiles where id = $1`,
      OPERATOR)) as { access: string; org_id: string | null }[];
    expect(rows).toHaveLength(1);
    expect(rows[0]!.access).toBe('super');
    expect(rows[0]!.org_id).toBeNull();
  });

  test('and REFUSES a second time, so it cannot be useful on a running instance', async () => {
    // This is the property that lets a function like this exist at all: on any instance that
    // has ever been set up, the worst it can do is fail.
    await expect(
      asOwner(`select orbitcrew.bootstrap_operator($1, $2, $3)`,
        randomUUID(), 'second@provision.invalid', 'Second'),
    ).rejects.toThrow(/bootstrap runs once/);
  });

  test('the RUNTIME role cannot execute it at all', async () => {
    // Postgres grants EXECUTE to PUBLIC on every new function. Without the explicit REVOKE in
    // the migration, "owner only" would be a comment, and orbit_app -- the role a compromised
    // web process holds -- could mint itself an operator on any un-bootstrapped instance.
    const rows = (await admin.$queryRawUnsafe(
      `select has_function_privilege('orbit_app',
         'orbitcrew.bootstrap_operator(uuid, text, text)', 'EXECUTE') as can`,
    )) as { can: boolean }[];
    expect(rows[0]!.can, 'orbit_app can execute bootstrap_operator').toBe(false);
  });

  test('and neither can PUBLIC', async () => {
    const rows = (await admin.$queryRawUnsafe(
      `select has_function_privilege('public',
         'orbitcrew.bootstrap_operator(uuid, text, text)', 'EXECUTE') as can`,
    )) as { can: boolean }[];
    expect(rows[0]!.can, 'PUBLIC can execute bootstrap_operator').toBe(false);
  });
});

describe('provision_office — the operator creates an office and its first admin', () => {
  test('GUARD A — a caller who is not the operator is refused', async () => {
    // The probe role holds the grant; what it lacks is a `super` identity. Nothing about
    // holding the EXECUTE privilege gets you past the guard.
    await expect(
      withIdentity(app, { profileId: randomUUID() }, (tx) =>
        tx.$executeRawUnsafe(`select orbitcrew.provision_office($1,$2,$3,$4,$5)`,
          'Nope', 'nope.invalid', randomUUID(), 'a@nope.invalid', 'A')),
    ).rejects.toThrow(/only the operator can provision an office/);
    const rows = (await admin.$queryRawUnsafe(
      `select count(*)::int as n from orbitcrew.orgs`)) as { n: number }[];
    expect(rows[0]!.n).toBe(0);
  });

  test('the operator provisions an office, its admin, and the leader grant together', async () => {
    await withIdentity(app, { profileId: OPERATOR }, (tx) =>
      tx.$executeRawUnsafe(`select orbitcrew.provision_office($1,$2,$3,$4,$5)`,
        'Acme Audit', 'acme.provision.invalid', OFFICE_ADMIN, 'admin@acme.invalid', 'Acme Admin'));

    const office = (await admin.$queryRawUnsafe(
      `select id, name, domain from orbitcrew.orgs`)) as { id: string; name: string; domain: string }[];
    expect(office).toHaveLength(1);
    expect(office[0]!.name).toBe('Acme Audit');

    // THE OUTCOME IS ASSERTED, NOT INFERRED FROM A TRIGGER. Both office triggers fire on
    // DELETE and UPDATE only -- measured -- so an office created with no admin, or with no
    // leader, commits perfectly happily. Nothing in the schema would catch it. Only this.
    const admins = (await admin.$queryRawUnsafe(
      `select id from orbitcrew.profiles where org_id = $1 and access = 'admin'`,
      office[0]!.id)) as { id: string }[];
    expect(admins).toHaveLength(1);
    expect(admins[0]!.id).toBe(OFFICE_ADMIN);

    const leaders = (await admin.$queryRawUnsafe(
      `select profile_id from orbitcrew.profile_authorities
        where profile_id = $1 and authority = 'leader'`, OFFICE_ADMIN)) as { profile_id: string }[];
    expect(leaders, 'the first admin was not granted `leader`').toHaveLength(1);
  });

  test('GUARD B — FD-1: a second office is refused', async () => {
    await expect(
      withIdentity(app, { profileId: OPERATOR }, (tx) =>
        tx.$executeRawUnsafe(`select orbitcrew.provision_office($1,$2,$3,$4,$5)`,
          'Second Office', 'second.invalid', randomUUID(), 'b@second.invalid', 'B')),
    ).rejects.toThrow(/one office per instance/);
    const rows = (await admin.$queryRawUnsafe(
      `select count(*)::int as n from orbitcrew.orgs`)) as { n: number }[];
    expect(rows[0]!.n).toBe(1);
  });

  test('the provisioning is on the record', async () => {
    const rows = (await admin.$queryRawUnsafe(
      `select actor, action, entity_type, detail from orbitcrew.audit_log
        where action = 'office.provisioned'`)) as {
      actor: string; action: string; entity_type: string; detail: { admin: string };
    }[];
    expect(rows).toHaveLength(1);
    expect(rows[0]!.actor).toBe(OPERATOR);
    expect(rows[0]!.entity_type).toBe('org');
    expect(rows[0]!.detail.admin).toBe(OFFICE_ADMIN);
  });

  test('and the new admin can immediately act as one — the office is usable', async () => {
    // The point of provisioning is that the org admin carries on without the operator. If
    // the admin could not use set_access, S4 would have produced an office that looks right
    // and does nothing.
    const colleague = randomUUID();
    const office = (await admin.$queryRawUnsafe(
      `select id from orbitcrew.orgs`)) as { id: string }[];
    await admin.$executeRawUnsafe(
      `insert into orbitcrew.profiles (id, org_id, email, name, access)
       values ($1, $2, 'colleague@acme.invalid', 'Colleague', 'user')`,
      colleague, office[0]!.id);

    await withIdentity(app, { profileId: OFFICE_ADMIN }, (tx) =>
      tx.$executeRawUnsafe(`select orbitcrew.set_access($1, 'admin')`, colleague));

    const rows = (await admin.$queryRawUnsafe(
      `select access::text as a from orbitcrew.profiles where id = $1`, colleague)) as { a: string }[];
    expect(rows[0]!.a).toBe('admin');
  });
});
