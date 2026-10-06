import { expect, test } from 'vitest';
import { existsExact, readRepoFile, walkFiles } from './lib/walk.ts';

// Project directories this guard ignores wholesale. node_modules and .git are
// skipped at every depth by default, which pnpm needs.
const SKIP_AT_ROOT = ['reference', 'landing', 'archive', '.vitest'];
const TEXT = ['.ts', '.tsx', '.js', '.json', '.md', '.yml', '.yaml'];

test('the prototype exists at exactly one path, and the husk holds no files', () => {
  expect(existsExact('reference/orbit-os-frontend/README.md')).toBe(true);
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
const isHistory = (rel: string) => HISTORY_FILES.includes(rel) || HISTORY_DIRS.some((d) => rel.startsWith(d));

test('nothing an executor follows still points at the old nested location', () => {
  const offenders = walkFiles('.', { skipAtRoot: SKIP_AT_ROOT, extensions: TEXT })
    .filter((rel) => rel !== 'guards/paths.test.ts')
    .filter((rel) => !isHistory(rel))
    .filter((rel) => readRepoFile(rel).includes('Prompts_Frontend_docs'));
  expect(offenders).toEqual([]);
});

test('every reference path named by the build prompts and the dashboards rules resolves on disk', () => {
  const docs = ['ORBIT-OS_Claude_Code_Build_Prompts.md', 'dashboards/CLAUDE.md'];
  const missing: string[] = [];

  for (const doc of docs) {
    for (const match of readRepoFile(doc).matchAll(/reference\/orbit-os-frontend\/[A-Za-z0-9_./-]+/g)) {
      const path = match[0].replace(/[.,)]+$/, '');
      if (path.endsWith('/') || path.includes('*')) continue;
      // existsExact, not existsSync: existsSync ignores case on Windows and
      // respects it on Linux, so a doc citing .../Assets/... would pass here and
      // fail in CI. That was Task 1 review minor 1.
      if (!existsExact(path)) missing.push(`${doc}: ${path}`);
    }
  }

  expect(missing).toEqual([]);
});
