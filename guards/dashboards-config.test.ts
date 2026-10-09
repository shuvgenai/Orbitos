import { expect, test } from 'vitest';
import { existsExact, readRepoFile, walkFiles } from './lib/walk.ts';

// The dashboards are browser code and the rest of the repo is Node code, so one
// tsconfig cannot serve both. The root project is Node-only (lib es2024, types
// node, no jsx) and its include is **/*.ts, which does not even cover a .tsx
// file. Before this guard, nothing typechecked the dashboards at all and nothing
// would have noticed.
//
// This file pins the wiring, not the dashboard code: two projects, each owning
// its own files, both reached by one `pnpm typecheck`. The code it protects does
// not exist yet, so read a green run here as "the wiring is in place", never as
// "the dashboards typecheck".

const DASHBOARDS_TSCONFIG = 'dashboards/tsconfig.json';
const ROOT_TSCONFIG = 'tsconfig.json';

/** Both config files are plain JSON, with no comments, so JSON.parse is enough. */
const json = (path: string) => JSON.parse(readRepoFile(path)) as Record<string, any>;

test('the dashboards project is browser TypeScript with JSX', () => {
  const config = json(DASHBOARDS_TSCONFIG);
  const options = config['compilerOptions'];

  // DOM, because a dashboard touches document, window and fetch.
  expect(options['lib']).toContain('dom');
  // JSX, because every screen is a .tsx file.
  expect(options['jsx']).toBe('react-jsx');
  // The same strictness as the root project. A looser dashboards project would
  // be a hole in the typecheck rather than an extension of it.
  expect(options['strict']).toBe(true);
  expect(options['noUncheckedIndexedAccess']).toBe(true);
  expect(options['noEmit']).toBe(true);
  // Node types are deliberately absent: a dashboard reaching for process or fs
  // must fail here, not at runtime in a browser.
  expect(options['types']).toEqual([]);
  // .tsx has to be included by name. include is not a glob over every extension.
  expect(config['include']).toContain('src/**/*.tsx');
});

test('the root project does not also own the dashboards', () => {
  // Without this exclude, the root project would pull dashboards/**/*.ts in with
  // lib es2024 and no jsx, so one file would be checked twice under two sets of
  // rules and the DOM half would fail for the wrong reason.
  expect(json(ROOT_TSCONFIG)['exclude']).toContain('dashboards');
});

test('pnpm typecheck runs both projects', () => {
  const script = json('package.json')['scripts']['typecheck'] as string;
  expect(script).toContain('-p tsconfig.json');
  expect(script).toContain(`-p ${DASHBOARDS_TSCONFIG}`);
});

test('the dashboards project has at least one input file', () => {
  // tsc exits non-zero with TS18003 ("No inputs were found") on a project whose
  // include matches nothing, which would turn `pnpm typecheck` red the moment
  // the last dashboards source file was deleted. dashboards/src/assets.d.ts is
  // that input today.
  const inputs = walkFiles('dashboards/src', { extensions: ['.ts', '.tsx'] });
  expect(inputs.length, 'dashboards/src has no .ts or .tsx file').toBeGreaterThan(0);
});

// The Dockerfile's two contract lines. CI builds this image
// (.github/workflows/ci.yml, compose-smoke), and COPY fails on a path that does
// not exist, so the lines cannot be added before contract/ does. Written out
// here so whoever creates the package does not have to reconstruct them, and so
// the pair is owned by a test rather than by a task number.
const DUE_WHEN_CONTRACT_EXISTS = [
  'COPY contract/package.json contract/ in the deps stage, beside the other package.json copies',
  'COPY contract contract in the runtime stage, beside COPY shared shared',
  'contract added to packages in pnpm-workspace.yaml, or pnpm install ignores it',
] as const;

test('once the contract package exists, the Dockerfile must copy it', () => {
  // A tripwire on a precondition. Quiet while contract/ is absent, and it fires
  // on the commit that creates the package, which is the only moment anyone
  // would otherwise forget the image.
  if (!existsExact('contract/package.json')) return;

  const dockerfile = readRepoFile('Dockerfile');
  const missing = [
    ['COPY contract/package.json contract/', /^COPY contract\/package\.json contract\/$/m],
    ['COPY contract contract', /^COPY contract contract$/m],
  ].filter(([, re]) => !(re as RegExp).test(dockerfile));
  if (missing.length === 0) return;

  throw new Error(
    [
      'contract/package.json now exists, so the image must carry the package.',
      'Add these, then delete this test:',
      ...DUE_WHEN_CONTRACT_EXISTS.map((line, i) => `  ${i + 1}. ${line}`),
    ].join('\n'),
  );
});
