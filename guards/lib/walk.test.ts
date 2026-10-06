import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, expect, test } from 'vitest';
import { REPO_ROOT, existsExact, trackedFiles, walkFiles } from './walk.ts';

// Every guard in this repo now depends on this helper, so it is tested rather
// than trusted. Each case below is one of the defects it exists to fix.

// The throwaway tree lives OUTSIDE the repo. Building it inside raced the other
// guards: vitest runs test files in parallel, so paths.test.ts walked this probe
// and then read a file that afterAll had already deleted.
const PROBE = mkdtempSync(join(tmpdir(), 'orbit-walk-'));

afterAll(() => rmSync(PROBE, { recursive: true, force: true }));

test('the repo root resolves to a real directory with no percent-encoding', () => {
  expect(REPO_ROOT).not.toMatch(/%[0-9A-Fa-f]{2}/);
  expect(existsExact('package.json')).toBe(true);
});

test('skipAtRoot skips at the top of the walk and nowhere deeper', () => {
  // Both halves in one case, because the whole point is the difference.
  // top-level reference/ is the prototype and is skipped.
  mkdirSync(join(PROBE, 'reference'), { recursive: true });
  writeFileSync(join(PROBE, 'reference/prototype.md'), 'probe');
  // docs/reference/ is a different directory that happens to share the name.
  // Matching the name at any depth skipped it too, which would have let a stale
  // path live there unreported. That was Task 1 review minor 2.
  mkdirSync(join(PROBE, 'docs/reference'), { recursive: true });
  writeFileSync(join(PROBE, 'docs/reference/deep.md'), 'probe');

  const found = walkFiles('.', { root: PROBE, skipAtRoot: ['reference'], extensions: ['.md'] });
  expect(found).not.toContain('reference/prototype.md');
  expect(found).toContain('docs/reference/deep.md');
});

test('skipAnywhere skips at depth, which node_modules needs', () => {
  mkdirSync(join(PROBE, 'pkg/node_modules'), { recursive: true });
  writeFileSync(join(PROBE, 'pkg/node_modules/dep.ts'), 'probe');
  writeFileSync(join(PROBE, 'pkg/own.ts'), 'probe');

  // pnpm puts a node_modules inside every workspace package, so a root-only
  // rule would walk all of them. The default covers it without the caller
  // having to remember.
  const found = walkFiles('pkg', { root: PROBE, extensions: ['.ts'] });
  expect(found).toContain('pkg/own.ts');
  expect(found).not.toContain('pkg/node_modules/dep.ts');
});

test('a missing directory is tolerated, so a guard can be armed before its code', () => {
  expect(walkFiles('guards/lib/does-not-exist-at-all')).toEqual([]);
});

test('existsExact is case-sensitive, unlike existsSync on Windows', () => {
  expect(existsExact('package.json')).toBe(true);
  expect(existsExact('Package.json')).toBe(false);
  expect(existsExact('PACKAGE.JSON')).toBe(false);
  expect(existsExact('docs/prd/ORBIT_OS_PRD_v9_0.md')).toBe(true);
  expect(existsExact('docs/PRD/ORBIT_OS_PRD_v9_0.md')).toBe(false);
});

test('existsExact refuses an empty path', () => {
  expect(existsExact('')).toBe(false);
});

test('trackedFiles comes from git, not the working tree', () => {
  const files = trackedFiles();
  expect(files).toContain('package.json');
  expect(files.some((f) => f.startsWith('reference/orbit-os-frontend/'))).toBe(true);
  // landing/ is git-ignored, so it is never tracked. This is the difference
  // that matters: a working-tree walk would report it locally and not in CI.
  expect(files.some((f) => f.startsWith('landing/'))).toBe(false);
});

test('a walk is memoized, so repeated identical calls return the same array', () => {
  expect(walkFiles('guards', { extensions: ['.ts'] })).toBe(walkFiles('guards', { extensions: ['.ts'] }));
});

test('different options are cached separately', () => {
  const all = walkFiles('docs', { extensions: ['.md'] });
  const none = walkFiles('docs', { extensions: ['.nothing'] });
  expect(all.length).toBeGreaterThan(0);
  expect(none).toEqual([]);
});
