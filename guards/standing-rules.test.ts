// The founder's two standing rules, each with a check so it cannot quietly
// lapse.
//
// Rule one: this project's own env file, and no other. Keys stay scoped to
// ORBIT-OS and are never read from a shared or cross-project env file, because
// a key read from outside this repository cannot be rotated by anybody reading
// this repository.
//
// Rule two: no real data until the gate opens. No live inbox, real mailbox or
// real customer data in any environment until the four conditions in the
// 2026-10-06 entry of docs/decisions.md are all in place and tested, and the
// founder has said so.
//
// HOW THE REAL-DATA GATE OPENS, and the only way it opens: a founder-approved
// edit to this file, made together with docs/gates/anthropic-terms.md. Both, in
// one change, reviewed. The attestation without the guard edit leaves the gate
// shut; the guard edit without the attestation is the gate being switched off
// while the condition it guards is still unmet.
//
// THIS GUARD IS NEVER LOOSENED TO GET A GREEN RUN. If it fails, the rule it
// names was broken, and the fix is in the thing it is pointing at. A red result
// here is the guard working. Relaxing an assertion, widening an allowlist or
// skipping a case to clear CI defeats the only enforcement these two rules
// have, and nothing else in this repository would notice.
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from 'vitest';
import { REPO_ROOT, readRepoFile, trackedFiles } from './lib/walk.ts';

/** The attestation for condition 4. Deliberately absent: sub-project 0 does not create it. */
const ATTESTATION = 'docs/gates/anthropic-terms.md';

const LOG = 'docs/decisions.md';

/**
 * Source and configuration git tracks. Markdown is excluded: a document that
 * quotes a path is describing it, not reading it.
 *
 * Tracked files rather than a walk, for the reason
 * guards/version-pinning.test.ts gives: an untracked scratch file must not fail
 * a guard locally while CI passes.
 */
const SCANNED = /\.(ts|tsx|mjs|cjs|js|json|ya?ml)$/;

/** Not ours, or not source. Mirrors NOT_OURS in eslint.config.js. */
const NOT_OURS = ['reference/', 'landing/', 'archive/', 'node_modules/', 'dist/', 'generated/'];

/**
 * This file, excluded from the env scan below.
 *
 * It cannot scan itself: the patterns it hunts are written out here as
 * documentation, so this comment would be a finding. Nothing else in guards/ is
 * exempt.
 */
const SELF = 'guards/standing-rules.test.ts';

const scannable = () =>
  trackedFiles().filter((file) => SCANNED.test(file) && !NOT_OURS.some((skip) => file.includes(skip)));

/**
 * Env-file references that climb a directory, and why each one is still inside
 * this repository.
 *
 * A static guard cannot resolve these. Both depend on `process.cwd()` at run
 * time, which is the package directory in both cases, so the climb reaches the
 * repo root and not the machine. That reasoning is not checkable here, so it is
 * recorded here instead, and a third climbing reference fails this guard until
 * somebody writes the same sentence for it.
 *
 * The recorded snippet is checked too. Without it an entry would exempt a whole
 * file, and the next edit to that file could point the same line somewhere else
 * and stay green.
 */
const ENV_CLIMB_ALLOWED: Readonly<Record<string, string>> = {
  // Prisma runs with cwd db/, so this reaches the repo root .env.local.
  'db/prisma.config.ts': "resolve(process.cwd(), '..', '.env.local')",
  // pnpm --filter @orbit/ops runs with cwd ops/. The same repo root file.
  'package.json': '--env-file=../.env.local',
};

/**
 * Addresses allowed to appear in tracked configuration. Empty, and that is the
 * correct current state: no test mailbox has been chosen yet.
 *
 * An explicit list, not a substring rule (founder decision, 2026-10-08). A
 * substring rule that accepts anything containing "test" accepts
 * ceo@bigtestcorp.com, which is a real company's real mailbox. Adding this
 * project's test mailbox here is a deliberate, reviewable line in a diff, which
 * is the point of the list.
 */
const ALLOWED_TEST_ADDRESSES: readonly string[] = [];

/**
 * Domains allowed to appear in tracked configuration. Reserved by RFC 2606 and
 * RFC 6761, so none of them can be delivered to and none of them can belong to
 * a real company.
 */
const ALLOWED_TEST_DOMAINS: readonly string[] = [
  'example.com',
  'example.net',
  'example.org',
  'example',
  'test',
  'invalid',
  'localhost',
];

/** Configuration a mailbox could reach a program through. */
const isConfig = (file: string) =>
  file === '.env.example' || file.endsWith('/.env.example') || /\.ya?ml$/.test(file);

const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;

/** Read a tracked file, skipping one deleted without the deletion staged. walk.ts documents that case. */
function readTracked(file: string): string | undefined {
  try {
    return readRepoFile(file);
  } catch {
    return undefined;
  }
}

// Rule one: this project's own env file, and no other.

test('no .env file is tracked by git', () => {
  const leaked = trackedFiles().filter(
    (file) => /(^|\/)\.env($|\.)/.test(file) && !file.endsWith('.env.example'),
  );

  expect(leaked, 'an env file in the index is a key in the history').toEqual([]);
});

test('.env.example is tracked, so a fresh clone knows which keys it needs', () => {
  expect(existsSync(join(REPO_ROOT, '.env.example'))).toBe(true);
  expect(trackedFiles()).toContain('.env.example');
});

test('every env-file reference that climbs a directory is one of the recorded ones', () => {
  const climbing = new Set<string>();

  for (const file of scannable()) {
    if (file === SELF) continue;
    const text = readTracked(file);
    if (text === undefined) continue;

    for (const line of text.split('\n')) {
      // process.env is the environment, not a file on disk.
      const path = line.replaceAll('process.env', '');
      if (/\.env\b/.test(path) && path.includes('..')) {
        climbing.add(file);
        break;
      }
    }
  }

  expect([...climbing].sort()).toEqual(Object.keys(ENV_CLIMB_ALLOWED).sort());

  for (const [file, snippet] of Object.entries(ENV_CLIMB_ALLOWED)) {
    expect(
      readRepoFile(file),
      `${file} no longer holds the reference this allowlist entry describes`,
    ).toContain(snippet);
  }
});

test('the env scan read the repository, not an empty list', () => {
  // Every assertion above passes vacuously over zero files, which an edit to
  // SCANNED or to NOT_OURS could cause without anybody noticing. There were
  // well over a hundred scannable files when this was written.
  expect(scannable().length).toBeGreaterThanOrEqual(50);
});

// Rule two: no real data until the gate opens.

test('the real-data gate is recorded with all four conditions, and recorded as not yet met', () => {
  const log = readRepoFile(LOG);

  expect(log).toMatch(/real-data gate/i);
  expect(log).toMatch(/dedicated test mailbox/i);
  expect(log).toMatch(/the founder decides/i);
  expect(log).toMatch(/open-pending/i);

  // Four, per PRD v9.0 section 14.3. Three is the v8.0 count and is wrong.
  const conditions = [/Action Gateway/i, /audit log/i, /budget pausing/i, /no-training/i];
  const missing = conditions.filter((condition) => !condition.test(log)).map(String);

  expect(missing, 'a condition dropped out of the log is a condition nobody is waiting for').toEqual([]);
});

test('the gate fails closed: the attestation is absent, or it says who, when and where', () => {
  if (!existsSync(join(REPO_ROOT, ATTESTATION))) {
    // Absent is the expected state and the gate holds. Asserted rather than
    // returned, so this branch still checks something: the log must record the
    // gate as unmet, because an absent attestation beside an opened gate is the
    // contradiction this pair exists to catch.
    expect(readRepoFile(LOG)).toMatch(/open-pending/i);
    return;
  }

  // Present means somebody is asserting the terms are signed. Then it names who
  // confirmed it, when, and where the signed document lives, or it is not an
  // attestation and the gate does not open on it.
  const text = readRepoFile(ATTESTATION);
  const vague = [/confirmed by/i, /date/i, /signed document/i].filter((part) => !part.test(text)).map(String);

  expect(vague, `${ATTESTATION} exists but does not attest anything`).toEqual([]);
});

test('no tracked configuration names a mailbox that is not an allowed test mailbox', () => {
  const offenders: string[] = [];

  for (const file of trackedFiles().filter(isConfig)) {
    const text = readTracked(file);
    if (text === undefined) continue;

    for (const match of text.matchAll(EMAIL)) {
      const address = match[0].toLowerCase();
      const domain = address.slice(address.indexOf('@') + 1);
      if (ALLOWED_TEST_ADDRESSES.includes(address)) continue;
      if (ALLOWED_TEST_DOMAINS.includes(domain)) continue;
      offenders.push(`${file}: ${address}`);
    }
  }

  expect(
    offenders,
    'add the address to ALLOWED_TEST_ADDRESSES above, or take it out of configuration',
  ).toEqual([]);
});
