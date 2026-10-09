import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, expect, test } from 'vitest';
import { REPO_ROOT, existsExact, readFileIn, readRepoFile, trackedFiles, walkFiles, walkFilesIn } from './walk.ts';

// Every guard in this repo now depends on this helper, so it is tested rather
// than trusted. Each case below is one of the defects it exists to fix.

// The throwaway tree lives OUTSIDE the repo. Building it inside raced the other
// guards: vitest runs test files in parallel, so paths.test.ts walked this probe
// and then read a file that afterAll had already deleted.
const PROBE = mkdtempSync(join(tmpdir(), 'orbit-walk-'));

afterAll(() => rmSync(PROBE, { recursive: true, force: true }));

const put = (rel: string, body = 'probe') => {
  const abs = join(PROBE, rel);
  mkdirSync(join(abs, '..'), { recursive: true });
  writeFileSync(abs, body);
};

// Files used by more than one case. Each case below uses its own directory, so
// the cache cannot make one case pass on another's result.
put('reference/prototype.md');
put('docs/reference/deep.md');
put('pkg/node_modules/dep.ts');
put('pkg/own.ts');
put('pkg/extra/dist/built.ts');
put('keys/a.a');
put('keys/b.b');
put('keys/c.c');
put('a,b/inside.md');
put('a/inside.md');
put('b/inside.md');

test('the repo root resolves to a real directory', () => {
  // If REPO_ROOT pointed at a wrong or percent-encoded directory, package.json
  // would not be found there.
  expect(existsExact('package.json')).toBe(true);
});

test('skipAtRoot skips at the top of the walk and nowhere deeper', () => {
  // Both halves in one case, because the whole point is the difference.
  // top-level reference/ is the prototype and is skipped. docs/reference/ is a
  // different directory that happens to share the name. Matching the name at
  // any depth skipped it too, which would have let a stale path live there
  // unreported. That was Task 1 review minor 2.
  const found = walkFilesIn(PROBE, '.', { skipAtRoot: ['reference'], extensions: ['.md'] });
  expect(found).not.toContain('reference/prototype.md');
  expect(found).toContain('docs/reference/deep.md');
});

test('node_modules is skipped at depth by default, which pnpm needs', () => {
  // pnpm puts a node_modules inside every workspace package, so a root-only
  // rule would walk all of them. The default covers it without the caller
  // having to remember.
  const found = walkFilesIn(PROBE, 'pkg', { extensions: ['.ts'] });
  expect(found).toContain('pkg/own.ts');
  expect(found).not.toContain('pkg/node_modules/dep.ts');
});

test('skipAnywhere adds to the defaults rather than replacing them', () => {
  const found = walkFilesIn(PROBE, 'pkg', { skipAnywhere: ['dist'], extensions: ['.ts'] });
  expect(found).toContain('pkg/own.ts');
  expect(found).not.toContain('pkg/extra/dist/built.ts');
  // Replacing the defaults would have walked node_modules again.
  expect(found).not.toContain('pkg/node_modules/dep.ts');
});

test('a missing directory is tolerated, so a guard can be armed before its code', () => {
  expect(walkFiles('guards/lib/does-not-exist-at-all')).toEqual([]);
});

test('an error that is not ENOENT propagates, so a guard cannot go quiet', () => {
  // A file where a directory was expected raises ENOTDIR. Swallowing it would
  // be a guard that stopped checking and still reported green.
  expect(() => walkFilesIn(PROBE, 'pkg/own.ts')).toThrow(/ENOTDIR/);
  expect(() => walkFiles('package.json')).toThrow(/ENOTDIR/);
});

test('existsExact rethrows an error that is not ENOENT', () => {
  // package.json is a file, so listing it as a directory raises ENOTDIR.
  expect(() => existsExact('package.json/inside')).toThrow(/ENOTDIR/);
});

test('existsExact is case-sensitive, unlike existsSync on Windows', () => {
  // docs/decisions.md is not version-numbered, so this does not break on a bump.
  expect(existsExact('package.json')).toBe(true);
  expect(existsExact('Package.json')).toBe(false);
  expect(existsExact('PACKAGE.JSON')).toBe(false);
  expect(existsExact('docs/decisions.md')).toBe(true);
  expect(existsExact('docs/Decisions.md')).toBe(false);
  expect(existsExact('Docs/decisions.md')).toBe(false);
});

test('existsExact refuses an empty path', () => {
  expect(existsExact('')).toBe(false);
});

test('trackedFiles comes from git, not the working tree', () => {
  const files = trackedFiles();
  expect(files).toContain('package.json');
  expect(files.some((f) => f.startsWith('reference/orbit-os-frontend/'))).toBe(true);
  // orbit-os-frontend.zip is in .gitignore and is never tracked in any
  // checkout, so it is a durable ignored artifact. When it is on disk, as it is
  // on the founder's machine, a working-tree walk would list it and git does
  // not. That difference is the reason trackedFiles exists.
  expect(files).not.toContain('orbit-os-frontend.zip');
});

test('a walk is memoized within one test file', () => {
  expect(walkFiles('guards', { extensions: ['.ts'] })).toBe(walkFiles('guards', { extensions: ['.ts'] }));
});

test('different options are cached separately', () => {
  const all = walkFilesIn(PROBE, 'keys', { extensions: ['.a'] });
  const none = walkFilesIn(PROBE, 'keys', { extensions: ['.nothing'] });
  expect(all).toEqual(['keys/a.a']);
  expect(none).toEqual([]);
});

test('no extensions means every file and an empty list means none', () => {
  // These used to join to the same cache key, so whichever ran first answered both.
  const every = walkFilesIn(PROBE, 'keys', { extensions: undefined });
  const nothing = walkFilesIn(PROBE, 'keys', { extensions: [] });
  expect(every).toHaveLength(3);
  expect(nothing).toEqual([]);
});

test('option lists that join to the same string do not share a cache entry', () => {
  expect(walkFilesIn(PROBE, 'keys', { extensions: ['.a,.b'] })).toEqual([]);
  expect(walkFilesIn(PROBE, 'keys', { extensions: ['.a', '.b'] })).toEqual(['keys/a.a', 'keys/b.b']);
  // A directory name holding a comma is one name, not two.
  const joined = walkFilesIn(PROBE, '.', { skipAtRoot: ['a,b'], extensions: ['.md'] });
  const split = walkFilesIn(PROBE, '.', { skipAtRoot: ['a', 'b'], extensions: ['.md'] });
  expect(joined).not.toContain('a,b/inside.md');
  expect(joined).toContain('a/inside.md');
  expect(split).toContain('a,b/inside.md');
  expect(split).not.toContain('a/inside.md');
});

test('a returned array cannot be mutated, because it is shared', () => {
  const found = walkFilesIn(PROBE, 'keys', { extensions: ['.c'] });
  // @ts-expect-error readonly: push does not exist on the type
  expect(() => found.push('keys/x')).toThrow(TypeError);
  expect(walkFilesIn(PROBE, 'keys', { extensions: ['.c'] })).toEqual(['keys/c.c']);
  expect(() => (trackedFiles() as string[]).push('x')).toThrow(TypeError);
});

test('dir is normalised, so a trailing slash or leading ./ gives the same answer', () => {
  const plain = walkFilesIn(PROBE, 'pkg', { extensions: ['.ts'] });
  expect(walkFilesIn(PROBE, 'pkg/', { extensions: ['.ts'] })).toEqual(plain);
  expect(walkFilesIn(PROBE, './pkg', { extensions: ['.ts'] })).toEqual(plain);
  expect(plain.every((p) => p.startsWith('pkg/') && !p.includes('//'))).toBe(true);
  expect(plain).toContain('pkg/own.ts');
});

test('an absolute dir under the root works, and one outside it throws', () => {
  const rel = walkFilesIn(PROBE, 'pkg', { extensions: ['.ts'] });
  expect(walkFilesIn(PROBE, join(PROBE, 'pkg'), { extensions: ['.ts'] })).toEqual(rel);
  // Returning [] here would let a guard pass while checking nothing.
  expect(() => walkFilesIn(PROBE, REPO_ROOT)).toThrow(/is not under/);
  expect(() => walkFilesIn(PROBE, '../elsewhere')).toThrow(/is not under/);
});

test('a path from a rooted walk reads from that root, and cannot go to the repo reader', () => {
  const [first] = walkFilesIn(PROBE, 'pkg', { extensions: ['.ts'] });
  expect(first).toBeDefined();
  expect(readFileIn(PROBE, first!)).toBe('probe');
  // @ts-expect-error a RootedPath is not a repo-relative path
  expect(() => readRepoFile(first!)).toThrow(/ENOENT/);
  // Plain strings and walkFiles results are still accepted.
  expect(readRepoFile('package.json')).toContain('orbit-os');
});
