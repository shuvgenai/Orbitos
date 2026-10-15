// The PRD set stays in docs/prd/, under the exact names CLAUDE.md section 1 gives it.
//
// Written on 2026-10-14, after two of these three files left docs/prd/ and
// reappeared untracked at the repository root. All 46 suites stayed green
// through it, because no guard read those paths. The authority document and its
// two superseded versions are the one set in this repository whose location is
// load-bearing: guards/appendix-a.test.ts:16 and
// guards/screen-inventory.test.ts:19 hold the v9.0 path as a constant, and nine
// places in the repository cite that file by line number.
//
// Shape, never content. Appendix A is checked by guards/appendix-a.test.ts and
// the screen inventory by guards/screen-inventory.test.ts. What this file
// prevents is those two guards reading a path that is no longer there, and the
// silence that preceded it.
//
// It asks git as well as the disk. A move leaves the tracked path deleted and
// an untracked copy somewhere else, so the disk alone can look almost right:
// the bytes exist, in the wrong place, in a state CI would never see. That is
// the exact shape of what happened, which is why the tracked check is here and
// is not decoration.
import { expect, test } from 'vitest';
import { existsExact, readRepoFile, trackedFiles } from './lib/walk.ts';

const PRD_DIR = 'docs/prd';

/**
 * The three files CLAUDE.md section 1 names, in the order it names them: the
 * authority document first, then the two it supersedes.
 *
 * A fourth PRD version added later belongs here on the day it is added, and the
 * cross-check below is what makes that true: the rule and this list cannot
 * drift apart without one of them going red.
 */
const PRD_SET = [
  'ORBIT_OS_PRD_v9_0.md',
  'ORBIT_OS_PRD_v8_0.md',
  'ORBIT_OS_PRD_v7_0.md',
] as const;

/** `docs/prd/<name>`, POSIX-separated, which is how git lists a path. */
const at = (name: string) => `${PRD_DIR}/${name}`;

/**
 * Every path whose last segment is one of the PRD names, excluding the three
 * correct ones.
 *
 * Exported so the negative control can drive it with synthetic input rather
 * than by moving a file. Two copies of an authority document is a worse failure
 * than one missing copy, because both read as current and only one is cited.
 */
export function strayCopies(paths: readonly string[]): readonly string[] {
  const correct = new Set<string>(PRD_SET.map(at));
  const names = new Set<string>(PRD_SET);

  return paths.filter((path) => {
    const name = path.slice(path.lastIndexOf('/') + 1);
    return names.has(name) && !correct.has(path);
  });
}

test('each PRD file exists at its exact path in docs/prd', () => {
  // existsExact, not existsSync: this repository is developed on Windows, where
  // a case-only rename passes a case-insensitive check and then fails the
  // case-sensitive CI checkout. The failure names the file, because the fix
  // depends on which one it is.
  const missing = PRD_SET.filter((name) => !existsExact(at(name)));

  expect(missing, `these belong in ${PRD_DIR}/, under exactly these names`).toEqual([]);
});

test('each PRD file is tracked by git, so a copy left outside does not satisfy it', () => {
  const tracked = new Set(trackedFiles());
  const untracked = PRD_SET.filter((name) => !tracked.has(at(name)));

  expect(untracked, 'a moved file leaves the tracked path deleted, and CI never sees the copy').toEqual([]);
});

test('no second copy of a PRD file exists anywhere else in the tree', () => {
  expect(strayCopies(trackedFiles()), 'one home per document').toEqual([]);
});

test('CLAUDE.md section 1 still names this exact set', () => {
  const root = readRepoFile('CLAUDE.md');

  // The rule and the list above have to say the same thing. Checked in both
  // directions for the reason guards/rules.test.ts gives about the browser-only
  // rule: a guard pinning a set nobody promised would be pinning its own
  // opinion.
  expect(root, 'section 1 names the authority document by path').toContain(at('ORBIT_OS_PRD_v9_0.md'));
  expect(root, 'section 1 names the two superseded versions').toMatch(/`v8_0` and `v7_0` sit/);
});

test('the existence check is exact, not a loose match', () => {
  // A negative control, kept in the suite for the reason
  // guards/appendix-a.test.ts:66 keeps one: without it every assertion above
  // could pass against a check that returns true for anything.
  expect(existsExact(at('ORBIT_OS_PRD_v99_0.md'))).toBe(false);
  expect(existsExact(at('orbit_os_prd_v9_0.md'))).toBe(false);
  expect(strayCopies(['ORBIT_OS_PRD_v8_0.md', at('ORBIT_OS_PRD_v8_0.md')])).toEqual(['ORBIT_OS_PRD_v8_0.md']);
});
