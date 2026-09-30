import { afterEach, expect, test } from 'vitest';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { startHealthServer } from './health.ts';

let server: Server | undefined;
afterEach(() => new Promise<void>((done) => (server ? server.close(() => done()) : done())));

async function listen(name: string): Promise<string> {
  server = startHealthServer({ name, port: 0 });
  await new Promise<void>((resolve) => server!.once('listening', () => resolve()));
  const { port } = server.address() as AddressInfo;
  return `http://127.0.0.1:${port}`;
}

test('GET /healthz returns ok with the program name', async () => {
  const base = await listen('api');
  const res = await fetch(`${base}/healthz`);
  expect(res.status).toBe(200);
  expect(await res.json()).toEqual({ status: 'ok', program: 'api' });
});

test('any other path returns 404', async () => {
  const base = await listen('api');
  const res = await fetch(`${base}/`);
  expect(res.status).toBe(404);
});
