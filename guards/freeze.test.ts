import { expect, test } from 'vitest';
import { existsExact, readRepoFile, walkFiles } from './lib/walk.ts';

// The lead-reply freeze, turned into a check instead of a promise.
//
// The slice that replies to a sales lead is frozen: no new features, no
// deletions, and every test it has keeps running and passing for the life of
// the project. A promise like that decays quietly. A test skipped to get a
// build green looks identical to a test that passes, and a deleted test file
// looks like nothing at all.
//
// Three checks, because there are three ways to weaken a suite: skip it,
// delete it, or stop collecting it. Each test below closes one of them, and
// only the second catches deletion.
const FROZEN = ['frontdesk', 'api', 'db', 'shared', 'template', 'ops', 'design'];

/**
 * The recorded state of the frozen suites, written when the guard was added.
 *
 * `unitTestCount` is what `npx vitest list --project unit` reported that day,
 * which is a smaller number than a run reports because `list` does not expand
 * a `test.each`. It is kept as a record of the measurement, not compared here:
 * the file list below is what actually catches a loss.
 */
const baseline = JSON.parse(readRepoFile('guards/freeze-baseline.json')) as {
  recordedAt: string;
  testFiles: string[];
  unitTestCount: number;
};

const frozenTestFiles = () => FROZEN.flatMap((dir) => walkFiles(dir, { extensions: ['.test.ts'] }));

test('no frozen test is skipped, isolated or turned into a todo', () => {
  const offenders: string[] = [];
  for (const file of frozenTestFiles()) {
    const text = readRepoFile(file);
    for (const bad of [
      /\b(test|it|describe)\.skip\b/,
      /\b(test|it|describe)\.only\b/,
      /\b(test|it)\.todo\b/,
    ]) {
      if (bad.test(text)) offenders.push(`${file}: ${String(bad)}`);
    }
  }
  expect(offenders).toEqual([]);
});

test('no frozen test file has been deleted since the freeze', () => {
  // The only one of the three that catches deletion. A deleted file does not
  // fail, does not warn and does not appear in a diff anybody reads closely.
  const present = new Set(frozenTestFiles());
  const missing = baseline.testFiles.filter((file) => !present.has(file));
  expect(missing).toEqual([]);
});

test('the single route to Gmail is still proven by a collected test', () => {
  // Removing this file from vitest.config.ts's include list would disarm it
  // while leaving it in place, so existence alone is not enough to check.
  const guard = 'template/test/no-unapproved-send.test.ts';
  expect(existsExact(guard), `${guard} is gone`).toBe(true);
  expect(readRepoFile('vitest.config.ts'), `${guard} is no longer collected`).toContain(guard);
});
