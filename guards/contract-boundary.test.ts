import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterAll, expect, test } from 'vitest';
import { REPO_ROOT, readFileIn, walkFilesIn } from './lib/walk.ts';

// The contract has two layers: a stable v1 the screens depend on, and an
// experimental engine layer the engine stream will churn. Splitting them is only
// worth anything if the churn is contained, and containment means one folder of
// hooks reaches the engine layer and nothing else does.
//
// Every lesser rule in this repo had a guard. This one, the reason the split
// exists at all, had none: a screen importing the engine layer directly
// typechecks fine, and then an engine change lands in thirty screens instead of
// one folder.
//
// This is a text grep, so it needs nothing from contract/ and can run before
// that package exists. It is vacuous while dashboards/ holds no source, which
// is true today. The tripwire below stops that lasting forever.

const ENGINE_HOOKS = 'dashboards/src/features/engine/';

// Every JavaScript and TypeScript flavour. Scanning only .ts and .tsx let a .js,
// .jsx, .mts or .mjs file import the engine layer unseen.
const SOURCE = ['.ts', '.tsx', '.js', '.jsx', '.mts', '.mjs', '.cts', '.cjs'];

// Build output is generated from the sources and would only double-report.
const GENERATED = ['dist', 'build', '.next', '.turbo', 'coverage'];

// Matches the package specifier (@orbit/contract/experimental) AND a relative
// path into the package (../../../contract/src/experimental/tasks.ts). Both
// typecheck in a monorepo, so matching only the first left a way around.
const EXPERIMENTAL = /contract\/(?:src\/)?experimental/;

// A tool config at the top of dashboards/ is not application source. Anything
// else outside src/ is.
const ROOT_CONFIG = /^[^/]+\.config\.[cm]?[jt]s$/;

const sourcesUnder = (root: string) =>
  walkFilesIn(root, 'dashboards', { extensions: SOURCE, skipAnywhere: GENERATED });

/** Files that reach the experimental layer from outside the engine hooks folder. */
export function boundaryBreaches(root: string): string[] {
  return sourcesUnder(root)
    .filter((f) => !f.startsWith(ENGINE_HOOKS))
    .filter((f) => EXPERIMENTAL.test(readFileIn(root, f)));
}

/** Source files outside dashboards/src that this guard was not written for. */
export function strayDashboardSources(root: string): string[] {
  return sourcesUnder(root).filter((f) => !f.startsWith('dashboards/src/') && !ROOT_CONFIG.test(f.slice('dashboards/'.length)));
}

test('only the engine hooks folder imports the experimental layer', () => {
  expect(boundaryBreaches(REPO_ROOT)).toEqual([]);
});

test('dashboards holds no source outside src, so this guard cannot sit vacant', () => {
  // Without this, Stream A could put code in dashboards/app or dashboards/lib
  // and the guard above would go on passing over an empty list. The boundary
  // scan does read these files now, but a new top-level folder is a decision
  // someone should make on purpose, so it fails here until this list is updated.
  expect(strayDashboardSources(REPO_ROOT)).toEqual([]);
});

// The real tree has no dashboards source yet, so the two tests above prove
// nothing about the rules themselves. These run the same functions against a
// throwaway tree outside the repo, with a file that must be caught.
const PROBE = mkdtempSync(join(tmpdir(), 'orbit-boundary-'));
afterAll(() => rmSync(PROBE, { recursive: true, force: true }));

const put = (rel: string, body: string) => {
  const abs = join(PROBE, rel);
  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(abs, body);
};

put('dashboards/src/features/engine/useTasks.ts', "import { x } from '@orbit/contract/experimental';");
put('dashboards/src/screens/Ok.tsx', "import { y } from '@orbit/contract/v1';");
put('dashboards/src/screens/ViaPackage.tsx', "import { x } from '@orbit/contract/experimental';");
put('dashboards/src/screens/ViaPath.ts', "import { x } from '../../../contract/src/experimental/tasks.ts';");
put('dashboards/src/screens/Plain.mjs', "import { x } from '@orbit/contract/experimental';");
put('dashboards/src/screens/Jsx.jsx', "import { x } from '@orbit/contract/experimental';");
put('dashboards/dist/built.js', "import { x } from '@orbit/contract/experimental';");
put('dashboards/vite.config.ts', 'export default {};');
put('dashboards/lib/helper.ts', 'export {};');

test('the boundary rule catches a package import, a relative path, and every script extension', () => {
  expect(boundaryBreaches(PROBE).sort()).toEqual([
    'dashboards/src/screens/Jsx.jsx',
    'dashboards/src/screens/Plain.mjs',
    'dashboards/src/screens/ViaPackage.tsx',
    'dashboards/src/screens/ViaPath.ts',
  ]);
});

test('the boundary rule allows the engine folder, the stable layer, and ignores build output', () => {
  const breaches = boundaryBreaches(PROBE);
  expect(breaches).not.toContain('dashboards/src/features/engine/useTasks.ts');
  expect(breaches).not.toContain('dashboards/src/screens/Ok.tsx');
  expect(breaches).not.toContain('dashboards/dist/built.js');
});

test('the tripwire flags source outside src and lets a root config through', () => {
  expect(strayDashboardSources(PROBE)).toEqual(['dashboards/lib/helper.ts']);
});
