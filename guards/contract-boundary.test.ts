import { expect, test } from 'vitest';
import { readRepoFile, walkFiles } from './lib/walk.ts';

// The contract has two layers: a stable v1 the screens depend on, and an
// experimental engine layer the engine stream will churn. Splitting them is only
// worth anything if the churn is contained, and containment means one folder of
// hooks reaches the engine layer and nothing else does.
//
// Every lesser rule in this repo had a guard. This one, the reason the split
// exists at all, had none: a screen importing the engine layer directly
// typechecks fine, and then an engine change lands in thirty screens instead of
// one folder.

const ENGINE_HOOKS = 'dashboards/src/features/engine/';
const SOURCE = ['.ts', '.tsx'];

const dashboardSources = () => walkFiles('dashboards/src', { extensions: SOURCE });

test('only the engine hooks folder imports the experimental layer', () => {
  const offenders = dashboardSources()
    .filter((f) => !f.startsWith(ENGINE_HOOKS))
    .filter((f) => /@orbit\/contract\/experimental/.test(readRepoFile(f)));
  expect(offenders).toEqual([]);
});

test('the stable layer stays reachable from anywhere in the dashboards', () => {
  // This is the other half of the rule, and it matters: the boundary is on ONE
  // layer, not a blanket ban on the contract. If this ever has to be relaxed,
  // the two-layer split has failed and the spec should change rather than the
  // guard. Vacuous until Stream A exists, like the test above.
  const files = dashboardSources();
  if (files.length === 0) {
    console.warn('[contract boundary] dashboards/src does not exist yet; both checks are armed and vacuous.');
    return;
  }
  expect(files.some((f) => /@orbit\/contract\/v1/.test(readRepoFile(f)))).toBe(true);
});
