// The MockApiClient import boundary.
//
// The dashboards are finished against a mock while the engine is still being
// built, so a mock holding a demo office, five invented people and nine
// invented agents sits in this repo for the whole project. Shipping it is a
// real risk: a customer who sees BrightPath Advisors inside their own office
// would reasonably conclude their data had been mixed with someone else's.
//
// The rule: the name `MockApiClient`, and the demo office seed, are reachable
// only from `dashboards/src/dev/**` or from a test file. This guard is written
// before `MockApiClient` exists, so the first import from anywhere else fails
// on the commit that adds it, which is the only moment the fix is cheap.
//
// What this guard CANNOT see, stated here because a tripwire described as a
// guard is worse than no tripwire:
//
//  1. It reads file text, not the import graph. A screen file whose comment
//     says "swap MockApiClient for HttpApiClient later" fails this guard. That
//     is the deliberate trade: a text scan cannot be routed around by a
//     dynamic `import()`, a re-export, a string built from two halves, or a
//     name reached through an index barrel, and an import-graph check can be.
//     If this guard names your file over a comment, reword the comment. Do not
//     widen the rule.
//  2. It reads `.ts`, `.tsx` and, for the seed sentinels, `.json`. Demo data in
//     a `.mjs` script, a `.csv`, a fixture under another extension, or a
//     base64 blob is invisible to it.
//  3. It does not scan `guards/` or `e2e/`, which is why this file may name the
//     sentinels in full. That omission is deliberate, not an oversight.
//  4. It is not the bundle scan. A mock kept out of every source path can still
//     reach a bundle through a build config. The bundle scan needs a production
//     build, which does not exist yet; decision 6 moves it to sub-project 1.
import { expect, test } from 'vitest';
import { existsExact, readRepoFile, walkFiles } from './lib/walk.ts';

/**
 * The code trees a mock could be imported from. `guards` and `e2e` are absent
 * on purpose, per note 3 above. A directory that does not exist yet is walked
 * as empty rather than failing, which is what lets this guard ship first.
 */
const SEARCHED = ['dashboards', 'contract', 'web', 'worker', 'api', 'frontdesk', 'shared'];

/** Where the mock and its data may be reached from. Nothing else. */
const ALLOWED = [/^dashboards\/src\/dev\//, /\.test\.tsx?$/];

/**
 * Where the demo office seed is expected to live.
 *
 * NOT dashboards/src/shared/seeds, which the dashboards/CLAUDE.md layout names.
 * That line lists five things under one heading: jobs, connectors, org
 * templates, the demo office and the fleet registry. Four of them are product
 * data from PRD Appendix A and are meant to ship. The demo office is not, and a
 * rule that lets the mock be reached only from dev code cannot also allow its
 * data to sit in a shipped shared package. So the demo office splits off here,
 * under dev, and the other four stay where the layout puts them.
 *
 * Its existence, and not a sentinel match, is what decides whether the seed has
 * landed. The two must be independent, or the pin below could never fail: a
 * skip condition that reads the same scan as the assertion is a skip that lasts
 * forever.
 */
const SEED_PACKAGE = 'dashboards/src/dev/seeds';

/**
 * Strings that only the demo office contains. Three, not one: a single office
 * name can be renamed in one commit, and the rename would leave a guard that
 * passes while watching a string nothing produces. Each is distinctive enough
 * that a real customer office would not hold it by accident.
 *
 * Case-insensitive where the prototype itself varies the case: the office name
 * appears as a title and the domain appears as `Maria@BrightPath.example`.
 */
const SENTINELS = [/BrightPath Advisors/i, /Maria Santos/, /brightpath\.example/i] as const;

/** `.ts` and `.tsx` for the mock's name; seed data can also arrive as `.json`. */
const CODE = ['.ts', '.tsx'] as const;
const CODE_AND_DATA = ['.ts', '.tsx', '.json'] as const;

const sourcesIn = (dirs: readonly string[], extensions: readonly string[]) =>
  dirs.flatMap((dir) => walkFiles(dir, { extensions, skipAnywhere: ['dist', 'generated'] }));

/** Files holding the pattern that are not allowed to hold it. */
function offenders(pattern: RegExp, extensions: readonly string[] = CODE): string[] {
  return sourcesIn(SEARCHED, extensions)
    .filter((file) => pattern.test(readRepoFile(file)))
    .filter((file) => !ALLOWED.some((ok) => ok.test(file)));
}

/** Every file under dashboards holding the pattern, allowed path or not. */
const holders = (pattern: RegExp) =>
  sourcesIn(['dashboards'], CODE_AND_DATA).filter((file) => pattern.test(readRepoFile(file)));

test('MockApiClient is named only by dev-only code and tests', () => {
  expect(offenders(/MockApiClient/)).toEqual([]);
});

test('the demo office seed is not reachable from a non-dev path', () => {
  for (const sentinel of SENTINELS) {
    expect(offenders(sentinel, CODE_AND_DATA), `${sentinel.source} is reachable from a real path`).toEqual([]);
  }
});

// Skipped until the seed package exists, and the tripwire below is what keeps
// the skip honest. Without the pin, the test above would go on passing after
// the demo office is renamed, because it would be scanning for a string nothing
// writes any more.
test.skipIf(!existsExact(SEED_PACKAGE))('every sentinel still names real demo data', () => {
  for (const sentinel of SENTINELS) {
    expect(holders(sentinel), `${sentinel.source} matches nothing under dashboards: rename or replace it`).not.toEqual(
      [],
    );
  }
});

test(`no demo data exists outside ${SEED_PACKAGE} while the pin is skipped`, () => {
  if (existsExact(SEED_PACKAGE)) return; // The pin above runs, so it holds the rule.

  // The seed package is absent, so the pin is skipped. Demo data anywhere under
  // dashboards therefore means the seed landed somewhere else, and the pin
  // would stay skipped over data it is supposed to be watching. Either move the
  // seed into the package above, or change SEED_PACKAGE to where it now lives.
  for (const sentinel of SENTINELS) {
    expect(holders(sentinel), `${sentinel.source} exists but ${SEED_PACKAGE} does not, so the pin cannot run`).toEqual(
      [],
    );
  }
});
