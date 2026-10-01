import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { parse } from 'yaml';
import { ALL_TOOLSETS, checkEnginePosture, type PostureInput } from './posture.ts';

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

// The registry this list mirrors lives inside the pinned image, so no static test can see upstream
// adding a toolset. This assertion exists to make an engine version bump stop and look: if the count
// changes, re-read CONFIGURABLE_TOOLSETS in /opt/hermes/hermes_cli/tools_config.py. The real
// upstream-drift guard is the runtime posture check in E3-T7, which diffs this list against the
// running image.
test('the toolset catalog matches the pinned Hermes image (28 keys at v2026.9.24)', () => {
  expect(ALL_TOOLSETS).toHaveLength(28);
  for (const critical of ['delegation', 'cronjob', 'computer_use', 'connections', 'skills']) {
    expect(ALL_TOOLSETS, `${critical} must be governed`).toContain(critical);
  }
});

test('delegation is disabled on both agents, which SEC-2a names explicitly', () => {
  for (const agent of ['orbi', 'scout'] as const) {
    const disabled = (real.profiles[agent] as { agent: { disabled_toolsets: string[] } }).agent.disabled_toolsets;
    expect(disabled, agent).toContain('delegation');
  }
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

// CEO v2 D10 (founder 2026-10-01) took `web` off Scout too, so the toolset is allowed on neither
// agent: the image bundles web_search with web_extract, and a search query exfiltrates as well as
// a fetch URL. Both directions are asserted so a later upgrade cannot quietly hand it back.
test.each(['orbi', 'scout'] as const)('web on %s fails the check (SEC-2a, CEO v2 D10)', (agent) => {
  const input = clone();
  const profile = input.profiles[agent] as { agent: { disabled_toolsets: string[] } };
  profile.agent.disabled_toolsets = profile.agent.disabled_toolsets.filter((t) => t !== 'web');
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
