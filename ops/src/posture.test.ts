import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { parse } from 'yaml';
import { checkEnginePosture, type PostureInput } from './posture.ts';

const compose = parse(readFileSync(new URL('../../template/compose.yml', import.meta.url), 'utf8'), {
  merge: true,
}) as {
  services: Record<string, { environment: Record<string, string>; read_only: boolean; volumes: string[]; ports: string[] }>;
};
const engine = compose.services.paperclip!;
const profile = (name: string) =>
  parse(readFileSync(new URL(`../../template/engine/hermes/${name}.config.yaml`, import.meta.url), 'utf8'));

// The shipped template is the fixture: a test that passed against a hand-written copy would not
// notice the template drifting away from it.
const real: PostureInput = {
  engine: {
    environment: engine.environment,
    readOnlyRootFs: engine.read_only,
    volumeTargets: engine.volumes.map((v) => v.split(':')[1]!),
    ports: engine.ports,
  },
  profiles: { orbi: profile('orbi'), scout: profile('scout') },
  adapters: JSON.parse(readFileSync(new URL('../../template/engine/paperclip-adapters.json', import.meta.url), 'utf8')),
};

const clone = (): PostureInput => structuredClone(real);
const codes = (input: PostureInput) => checkEnginePosture(input).map((f) => f.code);

test('the shipped template passes', () => {
  expect(checkEnginePosture(real)).toEqual([]);
});

test('a Gmail secret in the engine container fails the check (E3-T2 verify)', () => {
  const input = clone();
  input.engine.environment.GMAIL_CLIENT_SECRET = '${GMAIL_CLIENT_SECRET:?}';
  expect(codes(input)).toContain('engine_holds_forbidden_secret');
});

test('a Resend key in the engine container fails the check', () => {
  const input = clone();
  input.engine.environment.RESEND_API_KEY = '${RESEND_API_KEY:?}';
  expect(codes(input)).toContain('engine_holds_forbidden_secret');
});

test('the ORBIT database login in the engine container fails the check (SEC-2a)', () => {
  const input = clone();
  input.engine.environment.DATABASE_URL = 'postgresql://orbit_app:pw@postgres:5432/orbit';
  expect(codes(input)).toContain('engine_wrong_db_login');
});

test('a terminal toolset on Scout fails the check (E3-T2 verify)', () => {
  const input = clone();
  const scout = input.profiles.scout as { agent: { disabled_toolsets: string[] } };
  scout.agent.disabled_toolsets = scout.agent.disabled_toolsets.filter((t) => t !== 'terminal');
  expect(codes(input)).toContain('toolset_not_allowed');
});

test('web on Orbi fails the check: only Scout researches (SEC-2a)', () => {
  const input = clone();
  const orbi = input.profiles.orbi as { agent: { disabled_toolsets: string[] } };
  orbi.agent.disabled_toolsets = orbi.agent.disabled_toolsets.filter((t) => t !== 'web');
  expect(codes(input)).toContain('toolset_not_allowed');
});

test('an omitted memory key fails the check, because Hermes defaults it on (Review Focus 1)', () => {
  const input = clone();
  delete (input.profiles.orbi as { memory?: unknown }).memory;
  expect(codes(input)).toContain('memory_not_disabled');
});

test('allowing skill writes fails the check (Review Focus 3, CEO R7)', () => {
  const input = clone();
  (input.profiles.scout as { skills: { write_approval: boolean } }).skills.write_approval = false;
  expect(codes(input)).toContain('skill_writes_allowed');
});

test('a writable root filesystem fails the check', () => {
  const input = clone();
  input.engine.readOnlyRootFs = false;
  expect(codes(input)).toContain('engine_root_fs_writable');
});

test('a missing data volume fails the check (Review Focus 2)', () => {
  const input = clone();
  input.engine.volumeTargets = input.engine.volumeTargets.filter((t) => t !== '/opt/data');
  expect(codes(input)).toContain('engine_missing_data_volume');
});

test('a publicly bound engine port fails the check (SEC-1, DEP-5)', () => {
  const input = clone();
  input.engine.ports = ['0.0.0.0:3100:3100'];
  expect(codes(input)).toContain('engine_port_public');
});

test('switching an agent off hermes_local fails the check until TODOS says otherwise (D3)', () => {
  const input = clone();
  (input.adapters.scout as { adapter: string }).adapter = 'hermes_gateway';
  expect(codes(input)).toContain('adapter_not_pinned');
});

// Dropping -p is the quiet way to lose every per-agent rule above: both agents fall back to
// /opt/data/config.yaml and no allowlist applies, while every other check still passes.
test('an agent that does not select its profile fails the check (D4)', () => {
  const input = clone();
  (input.adapters.scout as { extraArgs: string[] }).extraArgs = [];
  expect(codes(input)).toContain('profile_not_selected');
});

test('selecting the wrong profile fails the check', () => {
  const input = clone();
  (input.adapters.scout as { extraArgs: string[] }).extraArgs = ['-p', 'orbi'];
  expect(codes(input)).toContain('profile_not_selected');
});

test('a turn cap above COST-3 fails the check', () => {
  const input = clone();
  (input.adapters.scout as { maxTurnsPerRun: number }).maxTurnsPerRun = 500;
  expect(codes(input)).toContain('turn_cap_too_high');
});

test('every finding carries a detail a human can act on', () => {
  const input = clone();
  input.engine.environment.GMAIL_CLIENT_SECRET = 'x';
  for (const finding of checkEnginePosture(input)) expect(finding.detail.length).toBeGreaterThan(10);
});
