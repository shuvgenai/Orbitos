import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { parse } from 'yaml';

const pinned = JSON.parse(readFileSync(new URL('../engine/pinned-versions.json', import.meta.url), 'utf8')) as {
  recordedOn: string;
  paperclip: { image: string; tag: string; digest: string };
  hermes: { image: string; tag: string; digest: string };
};

test('both engine images are pinned by digest (FLT-1, SEC-6)', () => {
  for (const name of ['paperclip', 'hermes'] as const) {
    expect(pinned[name].digest, name).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(pinned[name].image, name).not.toContain('@');
    expect(pinned[name].image, name).not.toContain(':');
  }
});

test('the pinned images are the expected upstream repositories', () => {
  expect(pinned.paperclip.image).toBe('ghcr.io/paperclipai/paperclip');
  expect(pinned.hermes.image).toBe('nousresearch/hermes-agent');
});

// A moving tag would let two instances built from the same template run different code (FLT-1).
test('neither tag is a moving tag', () => {
  for (const name of ['paperclip', 'hermes'] as const) {
    expect(['latest', 'stable', 'main', 'nightly', 'beta', 'canary'], name).not.toContain(pinned[name].tag);
  }
});

test('the pinning date is recorded', () => {
  expect(pinned.recordedOn).toMatch(/^\d{4}-\d{2}-\d{2}$/);
});

const dockerfile = readFileSync(new URL('../engine/Dockerfile', import.meta.url), 'utf8');
const entrypoint = readFileSync(new URL('../engine/entrypoint.sh', import.meta.url), 'utf8');

test('the Dockerfile takes both image refs as build args and pins nothing itself', () => {
  expect(dockerfile).toMatch(/^ARG PAPERCLIP_REF$/m);
  expect(dockerfile).toMatch(/^ARG HERMES_REF$/m);
  expect(dockerfile).not.toMatch(/FROM\s+(ghcr\.io\/paperclipai|nousresearch)/);
});

test('the Dockerfile bakes no secrets and no model key', () => {
  for (const name of ['ANTHROPIC_API_KEY', 'GMAIL_', 'RESEND_', 'TOKEN_ENCRYPTION_KEY', 'BETTER_AUTH_SECRET']) {
    expect(dockerfile, name).not.toContain(name);
  }
});

// The Paperclip image sets no USER: it starts as root and drops to USER_UID in its own entrypoint
// (spike log section 6). Asserting a non-root USER would fail a correct build, so the rule is that
// this Dockerfile must not take over the base image's privilege handling.
test('the Dockerfile does not pin a USER, leaving the base image to drop privileges (SEC-2a)', () => {
  expect(dockerfile).not.toMatch(/^USER\s/m);
});

test('the engine entrypoint hands off to the base image chain as PID 1', () => {
  expect(entrypoint).toMatch(/^exec \/usr\/bin\/tini -- \/usr\/local\/bin\/docker-entrypoint\.sh/m);
  expect(dockerfile).toMatch(/^CMD \["node", "--import"/m);
});

test('the entrypoint restores both profile configs on every start (Review Focus 3)', () => {
  // The entrypoint loops over the profile names, so the paths are shell-expanded, not literal.
  expect(entrypoint).toMatch(/^for profile in orbi scout; do$/m);
  expect(entrypoint).toContain('/engine/config/${profile}.config.yaml');
  expect(entrypoint).toContain('${HERMES_DATA}/profiles/${profile}');
  expect(entrypoint).toContain('cp "$src" "$dir/config.yaml"');
});

// Paperclip's hermes_local adapter selects a Hermes profile with `-p <name>`; HERMES_PROFILE is
// ignored (spike log section 4). Both profile names must therefore exist as baked configs.
test('both agent profiles are baked into the image', () => {
  for (const profile of ['orbi', 'scout']) {
    expect(dockerfile).toContain(`hermes/${profile}.config.yaml /engine/config/${profile}.config.yaml`);
  }
});

// Hermes creates cron/, memories/, sessions/ and logs/ under HERMES_HOME on first run. Without a
// writable HERMES_HOME the CLI dies with "Cannot initialize Hermes directory /opt/data/cron".
test('the entrypoint makes HERMES_HOME writable by the adapter uid', () => {
  expect(entrypoint).toMatch(/chown "\$\{ENGINE_UID\}:\$\{ENGINE_GID\}" "\$\{HERMES_DATA\}"/);
});

test('the entrypoint fails fast rather than starting with missing config', () => {
  expect(entrypoint).toMatch(/^set -euo pipefail$/m);
});

type HermesConfig = {
  memory?: { memory_enabled?: boolean; user_profile_enabled?: boolean };
  skills?: { write_approval?: boolean; auto_load?: string[] };
  agent?: { disabled_toolsets?: string[] };
  cron?: { enabled?: boolean };
};

const ALL_TOOLSETS = [
  'terminal',
  'file',
  'web',
  'browser',
  'code_execution',
  'vision',
  'mcp',
  'creative',
  'productivity',
  'memory',
] as const;

const profiles = {
  orbi: parse(readFileSync(new URL('../engine/hermes/orbi.config.yaml', import.meta.url), 'utf8')) as HermesConfig,
  scout: parse(readFileSync(new URL('../engine/hermes/scout.config.yaml', import.meta.url), 'utf8')) as HermesConfig,
};

test.each(['orbi', 'scout'] as const)('%s has persistent memory off (S4/D6)', (name) => {
  expect(profiles[name].memory?.memory_enabled).toBe(false);
  expect(profiles[name].memory?.user_profile_enabled).toBe(false);
});

test.each(['orbi', 'scout'] as const)('%s cannot write its own skills (CEO R7)', (name) => {
  expect(profiles[name].skills?.write_approval).toBe(true);
  expect(profiles[name].skills?.auto_load).toEqual([]);
});

test('scout may use web and nothing else (SEC-2a)', () => {
  const disabled = profiles.scout.agent?.disabled_toolsets ?? [];
  expect([...disabled].sort()).toEqual(ALL_TOOLSETS.filter((t) => t !== 'web').sort());
});

test('orbi may use no Hermes toolset; its issue tools come from Paperclip (SEC-2a)', () => {
  const disabled = profiles.orbi.agent?.disabled_toolsets ?? [];
  expect([...disabled].sort()).toEqual([...ALL_TOOLSETS].sort());
});

test.each(['orbi', 'scout'] as const)('%s runs no schedule of its own (COST-2, FLT-7)', (name) => {
  expect(profiles[name].cron?.enabled).toBe(false);
});
