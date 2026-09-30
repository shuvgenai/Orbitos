import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { parse } from 'yaml';

type Service = {
  ports?: string[];
  networks?: string[];
  environment?: Record<string, string>;
  healthcheck?: unknown;
};
const compose = parse(readFileSync(new URL('../compose.yml', import.meta.url), 'utf8'), { merge: true }) as {
  services: Record<string, Service>;
  networks: Record<string, { internal?: boolean } | null>;
};
const services = compose.services;
const PROGRAMS = ['web', 'api', 'worker', 'frontdesk'];

test('the stack defines the four programs, Postgres and Redis', () => {
  expect(Object.keys(services).sort()).toEqual(['api', 'frontdesk', 'postgres', 'redis', 'web', 'worker']);
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

test('only frontdesk receives Gmail credentials and the model key (SEC-2, SEC-10)', () => {
  for (const [name, svc] of Object.entries(services)) {
    const keys = Object.keys(svc.environment ?? {});
    const secret = keys.filter((k) => k.startsWith('GMAIL_') || k === 'ANTHROPIC_API_KEY' || k === 'TOKEN_ENCRYPTION_KEY');
    if (name === 'frontdesk') expect(secret.length).toBe(4);
    else expect(secret, name).toEqual([]);
  }
});

test('the web program holds no secrets and no database access', () => {
  expect(Object.keys(services.web!.environment ?? {})).toEqual(['PORT']);
  expect(services.web!.networks).toEqual(['edge']);
});

test('every program has a healthcheck', () => {
  for (const name of PROGRAMS) expect(services[name]!.healthcheck, name).toBeDefined();
});
