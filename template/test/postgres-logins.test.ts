import { expect, test } from 'vitest';
import pg from 'pg';

// Dev passwords from compose.dev.yml; production values come from the instance's secrets.
const orbitPw = process.env.ORBIT_DB_PASSWORD ?? 'orbit_dev';
const paperclipPw = process.env.PAPERCLIP_DB_PASSWORD ?? 'paperclip_dev';

const port = Number(process.env.ORBIT_DB_HOST_PORT ?? 5432);

async function connect(user: string, password: string, database: string) {
  const client = new pg.Client({ host: '127.0.0.1', port, user, password, database });
  await client.connect();
  return client;
}

test('orbit_app can use the orbit database', async () => {
  const c = await connect('orbit_app', orbitPw, 'orbit');
  await c.query('CREATE TABLE IF NOT EXISTS login_probe (id int)');
  await c.query('DROP TABLE login_probe');
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
