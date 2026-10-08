import { ESLint } from 'eslint';
import { beforeAll, expect, test } from 'vitest';
import { REPO_ROOT, readRepoFile } from './lib/walk.ts';

// A guard on the linter's own configuration.
//
// A linter that passes by ignoring the code it was added to check is worse than
// no linter: spec section 8 shows a green lint row for work nobody examined.
// `pnpm lint` reports zero errors today, and this file is what stops that zero
// from being bought by widening the ignore list or switching a rule off.
//
// It asks ESLint rather than reading the config array, because what matters is
// the resolved answer for a file. Flat config merges blocks, and a block added
// later can turn a rule off without any line in the earlier block changing.
const eslint = new ESLint({ cwd: REPO_ROOT });

/**
 * Load the config once, before the clock on any individual test starts.
 *
 * The first call that needs the config loads eslint.config.js, and that pulls
 * in eslint-plugin-react, @babel/eslint-parser and the two Babel presets. It
 * takes seconds on a cold run, which is longer than the 5 s default and has
 * nothing to do with the assertion that happens to pay for it.
 */
beforeAll(async () => {
  await eslint.isPathIgnored('eslint.config.js');
}, 60_000);

/**
 * The severity ESLint reports for a rule, for a file at this path.
 *
 * A resolved config states severity as a number, so 0, 1 and 2 are named here:
 * a failure message reading "expected 0 to be 'off'" says less than it looks
 * like it does.
 */
const NAMES = ['off', 'warn', 'error'] as const;

async function severity(path: string, rule: string) {
  const config = await eslint.calculateConfigForFile(path);
  const entry = config.rules?.[rule];
  if (entry === undefined) return 'unconfigured';
  const level = Array.isArray(entry) ? entry[0] : entry;
  return typeof level === 'number' ? (NAMES[level] ?? String(level)) : level;
}

test('the code the Done checklist depends on is linted', async () => {
  // contract/ does not exist yet. The assertion is on the config, not on the
  // directory, so it holds now and still holds the day the package lands.
  for (const path of [
    'dashboards/src/shared/layout/Screen.tsx',
    'dashboards/src/shared/nav/screens.ts',
    'guards/lint-config.test.ts',
    'e2e/harness.spec.ts',
    'playwright.config.ts',
    'contract/src/index.ts',
    'scripts/dev-db.mjs',
    'web/src/main.ts',
    'worker/src/main.ts',
    'eslint.config.js',
  ]) {
    expect(await eslint.isPathIgnored(path), `${path} is ignored, so the lint row would be green without reading it`).toBe(false);
  }
});

test('the prototype and the vendored trees are not linted', async () => {
  for (const path of [
    // Behaviour and copy spec, read-only, PRD section 15.3.
    'reference/src/App.tsx',
    // Its own repository, and gitignored here.
    'landing/src/main.ts',
    'archive/old.ts',
    'node_modules/pkg/index.js',
    'db/src/generated/prisma/index.js',
    'dashboards/dist/assets/main.js',
  ]) {
    expect(await eslint.isPathIgnored(path), `${path} is linted, and it is not ours to lint`).toBe(true);
  }
});

test('the seven frozen directories are not linted, and the reason is written down', async () => {
  // Deliberate, not an oversight: findings there are reported and never fixed,
  // so a gate that included them could not go green and would be switched off.
  // The counts are in docs/decisions.md. This pins both halves together, so the
  // ignore cannot be widened to an eighth directory without an entry appearing.
  for (const path of [
    'frontdesk/src/index.ts',
    'api/src/auth.ts',
    'db/src/client.ts',
    'shared/src/health.ts',
    'template/test/compose.test.ts',
    'ops/src/posture-check.ts',
    'design/tokens.test.ts',
  ]) {
    expect(await eslint.isPathIgnored(path), `${path} is linted, and frozen findings are reported rather than fixed`).toBe(true);
  }

  const decisions = readRepoFile('docs/decisions.md');
  expect(decisions).toContain('Lint findings in the frozen packages are recorded, not fixed');
});

test('react/no-danger is an error on every file that can render markup', async () => {
  for (const path of [
    'dashboards/src/shared/layout/Screen.tsx',
    'dashboards/src/shared/nav/screens.ts',
    'guards/lint-config.test.ts',
    'eslint.config.js',
  ]) {
    expect(await severity(path, 'react/no-danger'), path).toBe('error');
  }
});

test('no-undef and no-unused-vars are off for TypeScript and on for JavaScript', async () => {
  // The trade recorded in docs/decisions.md. @babel/eslint-parser strips the
  // types, so both rules read correct TypeScript as broken: a type name becomes
  // an undeclared global and an `import type` becomes dead code. tsc owns them
  // instead, which the next test pins. Neither rule is off for JavaScript,
  // where the parser is not in the way.
  for (const rule of ['no-undef', 'no-unused-vars']) {
    for (const path of ['guards/lib/walk.ts', 'dashboards/src/shared/layout/Screen.tsx']) {
      expect(await severity(path, rule), `${rule} on ${path}`).toBe('off');
    }
    for (const path of ['scripts/dev-db.mjs', 'eslint.config.js']) {
      expect(await severity(path, rule), `${rule} on ${path}`).toBe('error');
    }
  }
});

test('tsc carries what the two rules stopped carrying', async () => {
  // Switching the rules off above is only honest while this holds. If someone
  // removes these flags, unused code stops being reported anywhere at all.
  for (const project of ['tsconfig.json', 'dashboards/tsconfig.json']) {
    const options = (JSON.parse(readRepoFile(project)) as Record<string, any>)['compilerOptions'];
    expect(options['noUnusedLocals'], `${project} noUnusedLocals`).toBe(true);
    expect(options['noUnusedParameters'], `${project} noUnusedParameters`).toBe(true);
  }
});

test('pnpm lint reads the whole repository', async () => {
  // `eslint .` and nothing narrower. A path argument here would be a second,
  // invisible ignore list.
  const script = (JSON.parse(readRepoFile('package.json')) as Record<string, any>)['scripts']['lint'];
  expect(script).toBe('eslint .');
});
