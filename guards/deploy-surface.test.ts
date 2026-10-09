// No build or deploy surface names the prototype.
//
// Written because of finding H1 of the 2026-10-09 security review.
// reference/orbit-os-frontend/ holds the founder's mailbox, the founder's name
// and office.orbitumai.com labelled customer zero, and its README line 11 says
// to upload the whole folder as static files. The read-only investigation of
// 2026-10-09 found no path from this repository to that outcome: CI runs no
// deploy step, the Dockerfile has no whole-context copy, Vite's root is
// dashboards/ and its fs.allow names dashboards/ and design/ only. This guard
// is what keeps that true.
//
// It removes no identifier and does not claim to. The folder is read-only by
// the ruling at docs/prd/ORBIT_OS_PRD_v9_0.md:731, so the addresses stay where
// they are, and anybody who serves the folder by hand still publishes them.
// What this guard stops is the machine doing it.
//
// The directory is matched as one exact path segment, never as a substring.
// docs/reference/ is a live distinction that guards/lib/walk.ts:65 exists to
// keep, and a substring rule would fail on it.
//
// Everything is read from a structured position: copy argument lists, parsed
// YAML values, the scripts object, imported config values. Never a whole-file
// grep. These files carry 30-line comment blocks, a grep would fire on them,
// and a guard that fires on a comment gets switched off and takes its real
// rules with it.
import { execFileSync } from 'node:child_process';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { expect, test } from 'vitest';
import { parse } from 'yaml';
import { REPO_ROOT, readRepoFile, trackedFiles } from './lib/walk.ts';

/** The directory this guard protects. One segment, compared exactly. */
const PROTECTED = 'reference';

/**
 * Whether a path token names the top-level reference/ directory.
 *
 * The first segment has to be the whole word, so docs/reference/deep.md,
 * references/ and my-reference/ are all false. Surrounding quotes, a leading
 * ./ and a leading ! are stripped, because the surfaces that carry them write
 * the same path three different ways. Backslashes fold to forward slashes: a
 * Dockerfile is POSIX only, but a package.json script written on Windows is
 * not.
 *
 * The token is cut at its first colon, because a compose volume in short
 * syntax is `./reference:/site:ro` and the host path is the field before the
 * first colon. Without the cut the first segment reads `reference:` and the
 * one surface that mounts a directory by name is the one surface this misses.
 * A Windows drive letter is cut the same way and yields `C`, which is not this
 * directory, so the cut cannot create a false positive.
 */
export function namesReference(token: string): boolean {
  const bare = token
    .trim()
    .replace(/^["'`]+/, '')
    .replace(/["'`]+$/, '')
    .replace(/^!/, '')
    .split(':')[0] ?? '';
  const segments = bare.split(/[\\/]+/).filter((part) => part !== '' && part !== '.');
  return segments[0] === PROTECTED;
}
/**
 * Every whitespace-delimited token of a value that is a path or a command.
 *
 * Loose on purpose. These values are never prose, so `cp -r reference dist`
 * has to be a finding.
 */
export function commandOffenders(value: string): readonly string[] {
  return value.split(/\s+/).filter((token) => token !== '' && namesReference(token));
}

/**
 * Offenders in a free-form string, without firing on prose.
 *
 * A token counts only when it carries a separator, or when the whole trimmed
 * value is the path itself. Without that rule a workflow step named "Run
 * reference checks" is a finding, and a guard that fires on correct prose gets
 * switched off.
 *
 * The cost is a known miss: a slash-free token in the middle of a
 * sentence-shaped value is not reported. Command-bearing keys do not come
 * through here, so the miss needs a command hidden under a key that is not one
 * of them. The probes below pin both halves of this.
 */
export function proseSafeOffenders(value: string): readonly string[] {
  const whole = value.trim();
  if (!/\s/.test(whole)) return namesReference(whole) ? [whole] : [];
  return whole.split(/\s+/).filter((token) => /[\\/]/.test(token) && namesReference(token));
}

test('the matcher takes the prototype and leaves docs/reference alone', () => {
  for (const token of [
    'reference',
    'reference/',
    './reference',
    'reference/orbit-os-frontend',
    'reference/orbit-os-frontend/assets/data/people.js',
    '"reference"',
    '!reference',
    'reference\\orbit-os-frontend',
    // A compose volume in short syntax. The host path is the field before the
    // first colon, and this is the one surface that mounts a directory by name.
    './reference:/site:ro',
    'reference/orbit-os-frontend:/site',
  ]) {
    expect(namesReference(token), `${token} names the prototype`).toBe(true);
  }

  for (const token of [
    'docs/reference',
    'docs/reference/deep.md',
    'references',
    'references/',
    'my-reference',
    'dashboards/reference',
    'shared',
    '',
    '.',
    '../reference',
    'C:/reference',
    'docs/reference:/site:ro',
  ]) {
    expect(namesReference(token), `${token} does not name the prototype`).toBe(false);
  }
});

test('a command value is scanned loosely and a prose value is not', () => {
  expect(commandOffenders('cp -r reference dist')).toEqual(['reference']);
  expect(commandOffenders('npx http-server reference/orbit-os-frontend -p 8080')).toEqual([
    'reference/orbit-os-frontend',
  ]);
  expect(commandOffenders('cp -r docs/reference dist')).toEqual([]);

  expect(proseSafeOffenders('reference')).toEqual(['reference']);
  expect(proseSafeOffenders('upload reference/orbit-os-frontend as static files')).toEqual([
    'reference/orbit-os-frontend',
  ]);
  // The documented miss. A slash-free token inside a sentence is left alone, so
  // that a step named after the prototype is not a finding.
  expect(proseSafeOffenders('Run reference checks')).toEqual([]);
  expect(proseSafeOffenders('check the docs/reference notes')).toEqual([]);
});
