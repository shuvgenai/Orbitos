import { execFileSync } from 'node:child_process';
import { expect, test } from 'vitest';
import { REPO_ROOT, existsExact, readRepoFile, trackedFiles, walkFiles } from './lib/walk.ts';

// Project directories this guard ignores wholesale. node_modules and .git are
// skipped at every depth by default, which pnpm needs.
const SKIP_AT_ROOT = ['reference', 'landing', 'archive', '.vitest'];
const TEXT = ['.ts', '.tsx', '.js', '.json', '.md', '.yml', '.yaml'];

test('the prototype exists at exactly one path, and the husk holds no files', () => {
  expect(existsExact('reference/orbit-os-frontend/README.md')).toBe(true);
  // This test walks the WORKING TREE on purpose, and must keep doing so. An
  // untracked second copy of the prototype is exactly what it exists to catch,
  // and trackedFiles() would be blind to it. The next test uses git instead, for
  // the opposite reason. Do not "fix" this one to match that one.
  //
  // Not an absent-directory assertion. A process on the founder's machine held
  // an open handle on the old directory, so its seven children moved and two
  // empty directories were left behind. Git does not track empty directories,
  // so the absent form would pass in CI and fail on that one machine, which is
  // backwards for a guard. What matters is that no FILE lives there.
  expect(walkFiles('Prompts_Frontend_docs')).toEqual([]);
});

// These documents record the move, so they have to name the old path. Each is
// listed on purpose: adding a sixth is then a visible decision in a diff rather
// than a silent widening of the exemption.
//
// The reason this list exists at all is that ORBIT-OS_Claude_Code_Build_Prompts.md
// and dashboards/CLAUDE.md are the documents an executor follows. They stay in
// scope, and if either ever names the old path this test must fail.
const HISTORY_DIRS = ['.superpowers/', 'docs/superpowers/plans/', 'docs/superpowers/specs/'];
const HISTORY_FILES = ['docs/decisions.md', 'docs/backlog.md'];

// Exact-match the files and prefix-match the directories. A single startsWith
// over both would also exempt docs/decisions.md.bak, which nothing intends.
/**
 * A tracked file's text. Reads the disk, and falls back to the index when git
 * lists the file but it is gone from disk, which is an unstaged delete. The
 * fallback is not a silent skip: the committed content is still checked, which
 * is what this test is about. Any error other than a missing file propagates.
 */
function readTracked(rel: string): string {
  try {
    return readRepoFile(rel);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
    return execFileSync('git', ['show', `:${rel}`], { cwd: REPO_ROOT, encoding: 'utf8' });
  }
}

const isHistory = (rel: string) => HISTORY_FILES.includes(rel) || HISTORY_DIRS.some((d) => rel.startsWith(d));

test('nothing an executor follows still points at the old nested location', () => {
  // This one asks git, not the disk. A stale path only matters in a committed
  // file, and a working-tree walk would fail locally on an untracked scratch
  // note while passing in CI (Task 1 review minor 7).
  const candidates = trackedFiles()
    .filter((rel) => !SKIP_AT_ROOT.includes(rel.split('/')[0]!))
    .filter((rel) => TEXT.some((e) => rel.toLowerCase().endsWith(e)))
    .filter((rel) => rel !== 'guards/paths.test.ts')
    .filter((rel) => !isHistory(rel));

  const offenders = candidates.filter((rel) => readTracked(rel).includes('Prompts_Frontend_docs'));
  // Guards against the filters above emptying the list and passing on nothing.
  expect(candidates.length).toBeGreaterThan(0);
  expect(offenders).toEqual([]);
});

test('every reference path named by the build prompts and the dashboards rules resolves on disk', () => {
  const docs = ['ORBIT-OS_Claude_Code_Build_Prompts.md', 'dashboards/CLAUDE.md'];
  const missing: string[] = [];
  let checked = 0;

  for (const doc of docs) {
    for (const match of readRepoFile(doc).matchAll(/reference\/orbit-os-frontend\/[A-Za-z0-9_./-]+/g)) {
      const path = match[0].replace(/[.,)]+$/, '');
      if (path.endsWith('/') || path.includes('*')) continue;
      // existsExact, not existsSync: existsSync ignores case on Windows and
      // respects it on Linux, so a doc citing .../Assets/... would pass here and
      // fail in CI. That was Task 1 review minor 1.
      checked++;
      if (!existsExact(path)) missing.push(`${doc}: ${path}`);
    }
  }

  // Without this the test passes with zero matches: if both documents stopped
  // citing any reference/ path, or were emptied, there would be nothing to fail.
  expect(checked).toBeGreaterThan(0);
  expect(missing).toEqual([]);
});
