import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from 'vitest';

const ROOT = new URL('../', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (['node_modules', '.git', 'reference', 'landing', 'archive', '.vitest'].includes(entry)) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

function filesUnder(dir: string): string[] {
  try {
    return walk(join(ROOT, dir));
  } catch {
    return []; // absent is fine: a fresh clone has no husk
  }
}

test('the prototype exists at exactly one path, and the husk holds no files', () => {
  expect(existsSync(join(ROOT, 'reference/orbit-os-frontend/README.md'))).toBe(true);
  // NOT `existsSync(...) === false`. A process on the founder's machine held an
  // open handle on the old directory, so its seven children moved and two empty
  // directories were left behind. Git does not track empty directories, so the
  // absent-directory form passes in CI and fails on that machine, which is
  // backwards for a guard. What matters is that no FILE lives there.
  expect(filesUnder('Prompts_Frontend_docs')).toEqual([]);
});

// These documents record the move, so they have to name the old path. Each is
// listed by name on purpose: adding another is then a visible decision in a diff.
// The reason this list exists is that ORBIT-OS_Claude_Code_Build_Prompts.md and
// dashboards/CLAUDE.md are what an executor follows. They stay in scope, and if
// either ever names the old path this test must fail.
const HISTORY_DOCS = [
  '.superpowers/',
  'docs/superpowers/plans/',
  'docs/superpowers/specs/',
  'docs/decisions.md',
  'docs/backlog.md',
];

test('nothing outside reference/ still points at the old nested location', () => {
  const offenders = walk(ROOT)
    .map((f) => f.slice(ROOT.length).replace(/\\/g, '/'))
    .filter((rel) => rel !== 'guards/paths.test.ts')
    .filter((rel) => !HISTORY_DOCS.some((h) => rel.startsWith(h)))
    .filter((rel) => /\.(ts|tsx|js|json|md|yml|yaml)$/.test(rel))
    .filter((rel) => readFileSync(join(ROOT, rel), 'utf8').includes('Prompts_Frontend_docs'));
  expect(offenders).toEqual([]);
});

test('every reference path named by the build prompts and the dashboards rules resolves on disk', () => {
  const docs = ['ORBIT-OS_Claude_Code_Build_Prompts.md', 'dashboards/CLAUDE.md'];
  const missing: string[] = [];
  for (const doc of docs) {
    const text = readFileSync(join(ROOT, doc), 'utf8');
    for (const match of text.matchAll(/reference\/orbit-os-frontend\/[A-Za-z0-9_./-]+/g)) {
      const path = match[0].replace(/[.,)]+$/, '');
      if (path.endsWith('/') || path.includes('*')) continue;
      if (!existsSync(join(ROOT, path))) missing.push(`${doc}: ${path}`);
    }
  }
  expect(missing).toEqual([]);
});
