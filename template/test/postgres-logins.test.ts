import { expect, test } from 'vitest';
import pg from 'pg';

// Dev passwords from compose.dev.yml; production values come from the instance's secrets.
const orbitPw = process.env.ORBIT_DB_PASSWORD ?? 'orbit_dev';
const ownerPw = process.env.ORBIT_OWNER_PASSWORD ?? 'owner_dev';
const paperclipPw = process.env.PAPERCLIP_DB_PASSWORD ?? 'paperclip_dev';

const port = Number(process.env.ORBIT_DB_HOST_PORT ?? 5432);

async function connect(user: string, password: string, database: string) {
  const client = new pg.Client({ host: '127.0.0.1', port, user, password, database });
  await client.connect();
  return client;
}

/**
 * THE OWNERSHIP SPLIT, CHECKED AGAINST A REAL DATABASE. FD-38 addendum, 2026-11-17.
 *
 * This file used to assert that `orbit_app` could CREATE TABLE. That is no longer true, and
 * it must not be: `orbit_owner` owns the schema and `orbit_app` is a guest in it, because the
 * trigger that closed FD-12 admits a change only when `current_user` is the schema owner. If
 * the runtime owned what it queries, that comparison would hold on every request and the
 * guard would admit everything -- measured, a plain UPDATE promoted a row to admin with the
 * guard never firing.
 *
 * So the old assertion is inverted on purpose: the runtime must be REFUSED create. It is the
 * test that caught the incomplete rollout, by failing in CI on a fresh volume while passing
 * locally against one created before the change.
 */

test('orbit_owner owns the orbit schema and can create in it', async () => {
  const c = await connect('orbit_owner', ownerPw, 'orbit');
  const { rows } = await c.query(
    "select pg_get_userbyid(nspowner) as owner from pg_namespace where nspname = 'public'");
  expect(rows[0].owner).toBe('orbit_owner');
  await c.query('CREATE TABLE IF NOT EXISTS login_probe (id int)');
  await c.end();
});

test('orbit_app can read and write the ROWS of a table it does not own', async () => {
  // The default privileges granted in postgres/init/01-databases.sh are what make this work.
  // Without them the runtime cannot touch a table the owner created, and Postgres reports
  // that as `relation ... does not exist` rather than as a permission error.
  const c = await connect('orbit_app', orbitPw, 'orbit');
  await c.query('INSERT INTO login_probe (id) VALUES (1)');
  const { rows } = await c.query('SELECT id FROM login_probe WHERE id = 1');
  expect(rows).toHaveLength(1);
  await c.query('DELETE FROM login_probe WHERE id = 1');
  await c.end();
});

test('orbit_app CANNOT create a table -- it is the runtime, not the owner', async () => {
  const c = await connect('orbit_app', orbitPw, 'orbit');
  await expect(c.query('CREATE TABLE nope_probe (id int)')).rejects.toMatchObject({
    code: '42501', // insufficient_privilege
  });
  await c.end();
});

test('the runtime is not the schema owner, which is what keeps the access guard meaningful', async () => {
  const c = await connect('orbit_app', orbitPw, 'orbit');
  const { rows } = await c.query(
    "select current_user = pg_get_userbyid(nspowner) as is_owner from pg_namespace where nspname = 'public'");
  expect(rows[0].is_owner).toBe(false);
  await c.end();
});

test('neither orbit role is a superuser or carries BYPASSRLS', async () => {
  // A superuser is never restrained by RLS, FORCE or not, so either flag would make every
  // policy S2b adds inert while the build still looked secure.
  const c = await connect('orbit_owner', ownerPw, 'orbit');
  const { rows } = await c.query(
    "select rolname, rolsuper, rolbypassrls from pg_roles where rolname in ('orbit_app','orbit_owner') order by rolname");
  expect(rows).toHaveLength(2);
  for (const r of rows) {
    expect(r.rolsuper, `${r.rolname} is a superuser`).toBe(false);
    expect(r.rolbypassrls, `${r.rolname} has BYPASSRLS`).toBe(false);
  }
  await c.query('DROP TABLE IF EXISTS login_probe');
  await c.end();
});

test('paperclip_app can use the paperclip database', async () => {
  const c = await connect('paperclip_app', paperclipPw, 'paperclip');
  await c.query('CREATE TABLE IF NOT EXISTS login_probe (id int)');
  await c.query('DROP TABLE login_probe');
  await c.end();
});

test('paperclip_app cannot connect to the orbit database (E3-T2)', async () => {
  await expect(connect('paperclip_app', paperclipPw, 'orbit')).rejects.toMatchObject({ code: '42501' });
});

test('orbit_app cannot connect to the paperclip database', async () => {
  await expect(connect('orbit_app', orbitPw, 'paperclip')).rejects.toMatchObject({ code: '42501' });
});

test('orbit_owner cannot connect to the paperclip database either', async () => {
  // The owner is more privileged inside `orbit`, and must be no more privileged outside it.
  await expect(connect('orbit_owner', ownerPw, 'paperclip')).rejects.toMatchObject({ code: '42501' });
});
