import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { parse } from 'yaml';

type Service = {
  ports?: string[];
  networks?: string[];
  environment?: Record<string, string>;
  healthcheck?: unknown;
  read_only?: boolean;
  volumes?: string[];
  tmpfs?: string[];
};
const compose = parse(readFileSync(new URL('../compose.yml', import.meta.url), 'utf8'), { merge: true }) as {
  services: Record<string, Service>;
  networks: Record<string, { internal?: boolean } | null>;
};
const services = compose.services;
const PROGRAMS = ['web', 'api', 'worker', 'frontdesk'];

test('the stack defines the four programs, Postgres, Redis and the engine', () => {
  expect(Object.keys(services).sort()).toEqual([
    'api',
    'frontdesk',
    'paperclip',
    'postgres',
    'redis',
    'web',
    'worker',
  ]);
});

test('postgres, redis, worker and frontdesk publish no ports (SEC-1)', () => {
  for (const name of ['postgres', 'redis', 'worker', 'frontdesk']) {
    expect(services[name]!.ports, name).toBeUndefined();
  }
});

test('published ports bind to 127.0.0.1 only (SEC-1)', () => {
  for (const [name, svc] of Object.entries(services)) {
    for (const port of svc.ports ?? []) expect(port, name).toMatch(/^127\.0\.0\.1:/);
  }
});

test('the data network has no internet route, and holds Postgres and Redis alone', () => {
  expect(compose.networks.data?.internal).toBe(true);
  expect(services.postgres!.networks).toEqual(['data']);
  expect(services.redis!.networks).toEqual(['data']);
});

// Slice 1 deviation, recorded in docs/runbooks/slice-1-local.md: the api's confirm route sends the reply, so it
// holds the Gmail credentials too. Nothing else may.
test('only frontdesk and api receive Gmail credentials and the token key (SEC-2)', () => {
  for (const [name, svc] of Object.entries(services)) {
    const keys = Object.keys(svc.environment ?? {});
    const secret = keys.filter((k) => k.startsWith('GMAIL_') || k === 'TOKEN_ENCRYPTION_KEY');
    if (name === 'frontdesk' || name === 'api') {
      expect(secret.sort()).toEqual(['GMAIL_CLIENT_ID', 'GMAIL_CLIENT_SECRET', 'TOKEN_ENCRYPTION_KEY']);
    } else {
      expect(secret, name).toEqual([]);
    }
  }
});

// SEC-10: the engine gets its own model key, so a compromised engine cannot spend or speak as the
// Front Desk. Same variable name inside each container, different value on the host.
test('the engine and the Front Desk hold separate model keys (SEC-10)', () => {
  expect(services.frontdesk!.environment!.ANTHROPIC_API_KEY).toBe('${ANTHROPIC_API_KEY:?}');
  expect(services.paperclip!.environment!.ANTHROPIC_API_KEY).toBe('${ENGINE_ANTHROPIC_API_KEY:?}');
});

// Slice 1 deviation: the Front Desk runs the job loop, which mails the notice.
test('no service but api, worker and frontdesk holds the Resend key (SEC-2a)', () => {
  for (const [name, svc] of Object.entries(services)) {
    if (name === 'api' || name === 'worker' || name === 'frontdesk') continue;
    expect(Object.keys(svc.environment ?? {}), name).not.toContain('RESEND_API_KEY');
  }
});

test('the engine uses the paperclip database login only (SEC-2a)', () => {
  const url = services.paperclip!.environment!.DATABASE_URL!;
  expect(url).toContain('paperclip_app');
  expect(url).toContain('/paperclip');
  expect(url).not.toContain('orbit_app');
});

// Both upstream images keep their own data roots: /paperclip is Paperclip's HOME and
// PAPERCLIP_HOME, /opt/data is Hermes' HERMES_HOME. Without a volume on each, a read-only root
// filesystem stops the container on first boot (Review Focus 2).
test('the engine root filesystem is read-only, with a volume for every writable path', () => {
  const engine = services.paperclip!;
  expect(engine.read_only).toBe(true);
  const targets = (engine.volumes ?? []).map((v) => v.split(':')[1]);
  expect(targets).toEqual(expect.arrayContaining(['/paperclip', '/opt/data']));
  expect(engine.tmpfs).toEqual(['/tmp']);
});

test('the engine runs in private authenticated mode (DEP-5)', () => {
  expect(services.paperclip!.environment!.PAPERCLIP_DEPLOYMENT_MODE).toBe('authenticated');
  expect(services.paperclip!.environment!.PAPERCLIP_DEPLOYMENT_EXPOSURE).toBe('private');
});

test('the Front Desk reaches the engine over the internal network, with no key in the template', () => {
  expect(services.frontdesk!.environment!.PAPERCLIP_API_URL).toBe('http://paperclip:3100');
  expect(Object.keys(services.frontdesk!.environment ?? {})).not.toContain('PAPERCLIP_API_KEY');
});

test('the web program holds no secrets and no database access', () => {
  expect(Object.keys(services.web!.environment ?? {})).toEqual(['PORT']);
  expect(services.web!.networks).toEqual(['edge']);
});

test('every program has a healthcheck', () => {
  for (const name of PROGRAMS) expect(services[name]!.healthcheck, name).toBeDefined();
});
