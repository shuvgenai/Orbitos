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
  restart?: string;
  command?: string[];
  depends_on?: Record<string, { condition?: string }>;
};
const compose = parse(readFileSync(new URL('../compose.yml', import.meta.url), 'utf8'), { merge: true }) as {
  services: Record<string, Service>;
  networks: Record<string, { internal?: boolean } | null>;
};
const services = compose.services;
const PROGRAMS = ['web', 'api', 'worker', 'frontdesk'];

test('the stack defines the four programs, Postgres, Redis, the engine and the migrator', () => {
  expect(Object.keys(services).sort()).toEqual([
    'api',
    'frontdesk',
    'migrate',
    'paperclip',
    'postgres',
    'redis',
    'web',
    'worker',
  ]);
});

/**
 * The instance migrates itself, and these are the properties that make that true rather than
 * decorative. Before the `migrate` service, a deploy that skipped the runbook's
 * `pnpm db:migrate` brought up an api that connected and then failed every healthcheck with
 * `could not read the database` — forever, because nothing ever applied the migrations.
 *
 * Asserted here and not only in the compose smoke job, because the smoke job catches this
 * only when somebody reads it, and it was red and unread for four days.
 */
test('every program given a DATABASE_URL waits for the migrator to finish', () => {
  // `web` is deliberately absent: compose gives it no DATABASE_URL at all.
  //
  // `worker` IS gated although its source reads nothing from the database today — measured
  // 2026-11-16: zero `@orbit/db` imports and no use of `DATABASE_URL`. Compose hands it one
  // anyway, so the day it starts reading, the gate is already there rather than being the next
  // thing someone forgets.
  for (const name of ['api', 'worker', 'frontdesk']) {
    expect(services[name]!.depends_on?.migrate, name).toEqual({
      condition: 'service_completed_successfully',
    });
  }
  expect(services.web!.depends_on?.migrate).toBeUndefined();
});

test('the migrator is one-shot: it must not be restarted after it succeeds', () => {
  // `restart: unless-stopped` comes from the *program anchor and would restart this container
  // after every successful exit, which is why `migrate` does not use that anchor. The anchor
  // would also attach a /healthz healthcheck to a container that serves nothing.
  expect(services.migrate!.restart).toBe('no');
  expect(services.migrate!.healthcheck).toBeUndefined();
  expect(services.migrate!.ports).toBeUndefined();
});

test('the migrator applies migrations and nothing else, on the data network only', () => {
  // `migrate deploy` is the non-interactive, additive-only command. `migrate dev` or
  // `migrate reset` here would be a destructive operation inside a customer's deploy.
  expect(services.migrate!.command).toEqual([
    'pnpm',
    '--filter',
    '@orbit/db',
    'exec',
    'prisma',
    'migrate',
    'deploy',
  ]);
  expect(services.migrate!.networks).toEqual(['data']);
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
