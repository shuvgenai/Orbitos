import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterAll, expect, test } from 'vitest';
import { existsExact, readFileIn, readRepoFile, walkFiles, walkFilesIn } from './lib/walk.ts';

// The lead-reply freeze, turned into a check instead of a promise.
//
// The slice that replies to a sales lead is frozen: no new features, no
// deletions, and every test it has keeps running and passing for the life of
// the project. A promise like that decays quietly. A test skipped to get a
// build green looks identical to a test that passes, and a deleted test file
// looks like nothing at all.
//
// Five checks, because there are five ways to weaken a suite: disable a test,
// invert it, empty its body, delete its file, or stop collecting the file.
//
// This was finding M7 of the 2026-10-08 review and was graded H3 by the
// 2026-10-09 one, because the first version matched three modifier names and
// `test.skipIf` is not one of them. That form was already used three times in
// this branch, so it was the idiom a future session would reach for.
const FROZEN = ['frontdesk', 'api', 'db', 'shared', 'template', 'ops', 'design'];

/**
 * Chained modifiers that do not weaken a test.
 *
 * An allow list, not a ban list. A ban list of names cannot catch a name
 * nobody thought of, and that is exactly how `skipIf` got through: the first
 * rule banned `skip`, `only` and `todo`, and vitest has more modifiers than
 * three. Anything not named here fails, so a modifier vitest adds next has to
 * be added deliberately rather than passing on arrival.
 */
const HARMLESS_MODIFIERS: ReadonlySet<string> = new Set([
  'each',
  'for',
  'concurrent',
  'sequential',
  'extend',
  'scoped',
  'shuffle',
]);

const probeRoots: string[] = [];
afterAll(() => {
  for (const root of probeRoots) rmSync(root, { force: true, recursive: true });
});

/**
 * A throwaway tree OUTSIDE the repository, holding one file.
 *
 * Outside on purpose, twice over. guards/lib/walk.ts:173-177 says a probe
 * written inside the repository races the other guards, because vitest runs
 * test files in parallel and another guard can walk the probe and then read it
 * after it is deleted. And this guard's only real surface is the seven frozen
 * directories, which must never be written to, so a tree is the only way to
 * see it red against a frozen-looking path.
 */
function probeTree(relative: string, contents: string): string {
  const root = mkdtempSync(join(tmpdir(), 'orbit-freeze-'));
  probeRoots.push(root);
  mkdirSync(join(root, dirname(relative)), { recursive: true });
  writeFileSync(join(root, relative), contents, 'utf8');
  return root;
}

/**
 * A call on `test`, `it` or `describe` with one or more chained modifiers.
 *
 * Group 1 is the function, group 2 the whole chain. The chain is split and
 * every segment checked, so `test.concurrent.skip` is caught by its second
 * segment and `test.concurrent` alone is not caught at all.
 *
 * The leading boundary is `[^.\w]` rather than `\b`, so a property access like
 * `helpers.test.skip` does not read as a vitest call.
 */
const MODIFIER_CALL = /(?:^|[^.\w])(test|it|describe)((?:\.[A-Za-z][A-Za-z0-9]*)+)\s*\(/g;

/** A line that is a comment, which cannot disable anything. */
const isComment = (line: string) => /^\s*(?:\/\/|\*|\/\*)/.test(line);

/** Every disabling or inverting modifier in one file's text. */
export function modifierOffenders(file: string, text: string): readonly string[] {
  const out: string[] = [];
  for (const line of text.split('\n')) {
    if (isComment(line)) continue;
    for (const match of line.matchAll(MODIFIER_CALL)) {
      const fn = match[1] ?? '';
      const chain = (match[2] ?? '').split('.').filter((part) => part !== '');
      for (const segment of chain) {
        if (!HARMLESS_MODIFIERS.has(segment)) out.push(`${file}: ${fn}.${segment}`);
      }
    }
  }
  return out;
}

/**
 * A test whose callback body is empty.
 *
 * Only the literal empty block. A body emptied to a comment or a no-op is not
 * matched, and the assertion floor is the instrument for that, because every
 * form of emptying removes the body's expect() calls. Two rules for one gap,
 * said out loud rather than left for a reader to discover.
 */
const EMPTY_BODY =
  /(?:^|[^.\w])(?:test|it)(?:\.[A-Za-z][A-Za-z0-9]*)*\s*\(\s*(['"`])(?:\\.|(?!\1)[^\\])*\1\s*,\s*(?:async\s*)?\(\s*\)\s*=>\s*\{\s*\}\s*\)/g;

export function emptyBodyOffenders(file: string, text: string): readonly string[] {
  return [...text.matchAll(EMPTY_BODY)].map(() => `${file}: a test with an empty body`);
}

// THREE counts, not one, because no single instrument catches every way a
// frozen suite can shrink. Each is recorded in freeze-baseline.json and each is
// a floor. The founder asked on approval for the primary check to catch what
// the regex overcounts, and for the counting rule and its blind spots to be
// written down. This is that, with one correction measured on 2026-10-09 and
// recorded in the log entry: `vitest list --json` does NOT expand a
// `test.each`, so it cannot be the instrument that catches a removed case.
//
//   | Instrument            | Frozen count | Catches a removed each case |
//   | --------------------- | ------------ | --------------------------- |
//   | each-aware, primary   | 437          | yes                         |
//   | vitest list, secondary| unit 239, db 170 | no                      |
//   | regex call sites      | 411          | no                          |

/**
 * A `test` or `it` call site, with its dotted modifier chain in group 1.
 *
 * Not an AST walk. A `test` or `it` identifier, not preceded by a dot or a word
 * character, then any dotted modifiers, then an open parenthesis.
 */
const TEST_CALL = /(?:^|[^.\w])(?:test|it)((?:\.[A-Za-z][A-Za-z0-9]*)*)\s*\(/g;
const ASSERTION_CALL = /(?:^|[^.\w])expect\s*\(/g;

/**
 * How many cases a `.each(` table holds, when and only when the table is a
 * literal array this function can count with certainty.
 *
 * `from` is the index just after the opening parenthesis. Returns the element
 * count, or **null meaning opaque**. Null is not an error and not a zero: it is
 * the answer "this table's size cannot be read from the text", and the caller
 * is required to record it rather than guess. That is the founder's tightening
 * of 2026-10-09: an unparseable table must be counted as opaque and reported,
 * never silently counted as zero or one.
 *
 * It returns null, deliberately, for every one of these:
 *
 * - A table that is not an array literal at all: `test.each(transient)` in
 *   db/test/poll.test.ts, or a template-literal table.
 * - An array holding a spread, `[...cases, ['x']]`, whose size depends on a
 *   value this function cannot see.
 * - An array whose closing bracket is never found, which means the text is not
 *   what this parser assumed and any number it returned would be invented.
 *
 * It returns 0 for an empty literal `[]`, which is a real count and not a
 * failure to parse. Counting that as 1 would be the exact silent-one the
 * tightening forbids.
 *
 * Elements are counted as elements, not as commas plus one, so a trailing comma
 * in `[['a'], ['b'],]` gives 2 and not 3. Bracket depth is tracked so a nested
 * array or object inside one case does not miscount.
 *
 * This is what makes the primary count catch a case deleted from an `each`
 * table. Neither the regex call-site count nor `vitest list --json` can: both
 * count the declaration once, measured on 2026-10-09 against
 * shared/src/agent-output.test.ts, which has a ten-case `test.each` and shows
 * as ONE entry in `vitest list --json`, named with its `%s` unresolved.
 */
export function literalEachCases(text: string, from: number): number | null {
  let i = from;
  while (i < text.length && /\s/.test(text[i] ?? '')) i += 1;
  if (text[i] !== '[') return null;

  let depth = 0;
  let elements = 0;
  let sawContent = false;

  for (; i < text.length; i += 1) {
    const char = text[i];

    if (char === '[' || char === '(' || char === '{') {
      depth += 1;
      if (depth > 1) sawContent = true;
      continue;
    }

    if (char === ']' || char === ')' || char === '}') {
      depth -= 1;
      if (depth === 0) return sawContent ? elements + 1 : elements;
      continue;
    }

    // A spread at the top level makes the size unknowable from the text.
    if (depth === 1 && char === '.' && text.startsWith('...', i)) return null;

    if (depth === 1 && char === ',') {
      if (sawContent) elements += 1;
      sawContent = false;
      continue;
    }

    if (!/\s/.test(char ?? '')) sawContent = true;
  }

  // The closing bracket was never found, so this is not the shape assumed.
  return null;
}

/**
 * The TERTIARY count: call sites, one per declaration.
 *
 * Four blind spots, all of which make it HIGHER than the number of tests that
 * run, so it is weaker than it looks and never stricter:
 *
 * - A `test.each` counts once however many cases it expands to. This is the one
 *   the primary count exists to cover.
 * - A `test(` or `expect(` inside a comment or a string counts, so commenting a
 *   test out does not move it. Deliberate: a count that changed when a comment
 *   was reflowed would be useless as a floor. Measured cost of this on
 *   2026-10-09: 411 here against 409 that vitest collects, a difference of two.
 * - An assertion inside a helper counts once where the helper is written, not
 *   once per call.
 * - `assert(` instead of `expect(` counts as nothing.
 */
export function countTests(text: string): number {
  return [...text.matchAll(TEST_CALL)].length;
}

export function countAssertions(text: string): number {
  return [...text.matchAll(ASSERTION_CALL)].length;
}

/**
 * The PRIMARY count: declarations, with every literal `each` table expanded.
 *
 * This is the only one of the three that falls when a case is deleted from an
 * `each` table, which is why it is primary. An `each` whose table is not a
 * literal contributes one and is counted separately by `opaqueEachCount` below,
 * so the number of places this count is blind is itself recorded rather than
 * assumed to be zero.
 */
export function countExpandedTests(text: string): number {
  let total = 0;
  for (const match of text.matchAll(TEST_CALL)) {
    const chain = (match[1] ?? '').split('.').filter((part) => part !== '');
    if (!chain.includes('each')) {
      total += 1;
      continue;
    }
    const cases = literalEachCases(text, match.index + match[0].length);
    total += cases ?? 1;
  }
  return total;
}

/**
 * How many `each` tables this file's text cannot expand.
 *
 * The other half of failing closed. `countExpandedTests` has to return a
 * number, so an opaque table contributes one, which UNDERcounts its real cases.
 * That is safe for a floor but it is also invisible, and a literal table
 * rewritten into an expression would drop the expanded count while looking like
 * an ordinary edit. So the opaque tables are counted here and compared as a
 * CEILING: if the number rises, the expanded count has gone blind somewhere new
 * and that has to be a decision rather than a side effect.
 */
export function opaqueEachCount(text: string): number {
  let opaque = 0;
  for (const match of text.matchAll(TEST_CALL)) {
    const chain = (match[1] ?? '').split('.').filter((part) => part !== '');
    if (chain.includes('each') && literalEachCases(text, match.index + match[0].length) === null) opaque += 1;
  }
  return opaque;
}

/**
 * Whether the number of `each` tables the expanded count cannot read has risen.
 *
 * A ceiling, not a floor, which is why it is its own function. Every other
 * recorded number here fails when it DROPS. This one fails when it CLIMBS,
 * because each new opaque table is a set of cases the primary instrument stops
 * being able to see. Putting a ceiling inside a function named for floors would
 * make the next reader assume the direction.
 *
 * Lowering the recorded number by turning an expression back into a literal is
 * an improvement and does not fail. Raising it is a founder decision, the same
 * as raising any floor here.
 */
export function opaqueComplaints(
  actual: number,
  recorded: { readonly frozenOpaqueEachCount: number },
): readonly string[] {
  return actual > recorded.frozenOpaqueEachCount
    ? [`frozen opaque each tables: ${actual}, recorded ${recorded.frozenOpaqueEachCount}`]
    : [];
}

/**
 * The SECONDARY count: what vitest itself collects, per project.
 *
 * Read from `pnpm exec vitest list --project <name> --json`, counting only
 * entries whose file is a frozen baseline file. Two things it gives that the
 * regex cannot: a file dropped from the include list contributes zero, and a
 * `test(` written inside a comment or a string contributes nothing.
 *
 * One thing it does NOT give, measured on 2026-10-09 and the reason it is
 * secondary rather than primary: it does not expand a `test.each`. The unit
 * project lists 420 entries while a run reports 437, and the ten-case
 * `test.each` in shared/src/agent-output.test.ts is one listed entry.
 *
 * It is recorded and compared, not computed inside the guard. A guard that
 * shelled out to vitest would be a test that runs the test runner.
 */
export type ListedCounts = { readonly unit: number; readonly db: number };

/**
 * Whether the frozen suites still hold at least what was recorded.
 *
 * A floor scoped to the frozen directories, which was the founder's decision
 * of 2026-10-09. `unitTestCount` in the baseline stays what it has always
 * been, a record of one measurement, because a floor over the whole unit
 * project goes red when somebody legitimately deletes a test in guards/ or
 * dashboards/, and a gate that fails on correct work is a gate somebody edits
 * rather than obeys.
 *
 * Scoped this way, red is always correct: a frozen test or a frozen assertion
 * disappearing IS the freeze violation this file exists to catch, and this is
 * the only check here that catches a test removed from a file that still
 * exists.
 *
 * A LOWER count fails and nothing here raises the recorded number to match it.
 * That is the founder's instruction on approval and it is the whole value of a
 * floor: a check that rewrote its own baseline on failure would record the loss
 * instead of reporting it. The recorded number in freeze-baseline.json may be
 * raised only in a commit the founder approves, and raising it is how a
 * genuinely larger frozen suite gets recognised.
 */
export type FrozenCounts = {
  readonly expanded: number;
  readonly calls: number;
  readonly assertions: number;
  readonly listed: ListedCounts;
};

export type FrozenBaseline = {
  readonly frozenExpandedTestCount: number;
  readonly frozenTestCallCount: number;
  readonly frozenAssertionCount: number;
  readonly frozenListedTestCount: ListedCounts;
};

export function floorComplaints(actual: FrozenCounts, recorded: FrozenBaseline): readonly string[] {
  const out: string[] = [];
  const below = (name: string, now: number, then: number) => {
    if (now < then) out.push(`${name}: ${now}, recorded ${then}`);
  };

  below('frozen expanded tests', actual.expanded, recorded.frozenExpandedTestCount);
  below('frozen test call sites', actual.calls, recorded.frozenTestCallCount);
  below('frozen assertions', actual.assertions, recorded.frozenAssertionCount);
  below('frozen listed tests (unit)', actual.listed.unit, recorded.frozenListedTestCount.unit);
  below('frozen listed tests (db)', actual.listed.db, recorded.frozenListedTestCount.db);

  return out;
}

/**
 * A vitest include glob as a regular expression.
 *
 * A globstar segment crosses directories and a single star does not, which is
 * the one distinction that matters for deciding whether a baseline file is
 * collected.
 */
const GLOB_SENTINEL = '\u0001';
export function globToRegExp(glob: string): RegExp {
  const source = glob
    .split('**/')
    .join(GLOB_SENTINEL)
    .replace(/[.+^${}()|[\]\\]/g, (char) => `\\${char}`)
    .split('*')
    .join('[^/]*')
    .split(GLOB_SENTINEL)
    .join('(?:.*/)?');
  return new RegExp(`^${source}$`);
}

/** Baseline files that no glob collects. */
export function uncollected(files: readonly string[], globs: readonly string[]): readonly string[] {
  const patterns = globs.map((glob) => globToRegExp(glob));
  return files.filter((file) => !patterns.some((pattern) => pattern.test(file)));
}

test('every modifier that disables or inverts a frozen test is reported', () => {
  const cases: readonly (readonly [string, string])[] = [
    ['test.skip', "test.skip('a', () => { expect(1).toBe(1); });"],
    ['test.skipIf', "test.skipIf(true)('a', () => { expect(1).toBe(1); });"],
    ['test.runIf', "test.runIf(false)('a', () => { expect(1).toBe(1); });"],
    ['test.only', "test.only('a', () => { expect(1).toBe(1); });"],
    ['test.todo', "test.todo('a');"],
    ['test.fails', "test.fails('a', () => { expect(1).toBe(2); });"],
    ['it.skip', "it.skip('a', () => { expect(1).toBe(1); });"],
    ['it.fails', "it.fails('a', () => { expect(1).toBe(2); });"],
    ['describe.skip', "describe.skip('a', () => { test('b', () => { expect(1).toBe(1); }); });"],
    ['describe.only', "describe.only('a', () => { test('b', () => { expect(1).toBe(1); }); });"],
    ['test.concurrent.skip', "test.concurrent.skip('a', () => { expect(1).toBe(1); });"],
    ['describe.concurrent.only', "describe.concurrent.only('a', () => { test('b', () => { expect(1).toBe(1); }); });"],
  ];

  for (const [label, source] of cases) {
    expect(modifierOffenders('api/probe.test.ts', source), `${label} must be reported`).not.toEqual([]);
  }

  // The other half, which matters just as much. A guard that fires on correct
  // code gets switched off and takes its real rules with it.
  const fine: readonly string[] = [
    "test('a', () => { expect(1).toBe(1); });",
    "it('a', () => { expect(1).toBe(1); });",
    "describe('a', () => { test('b', () => { expect(1).toBe(1); }); });",
    "test.each([1, 2])('a %i', (n) => { expect(n).toBeGreaterThan(0); });",
    "test.concurrent('a', () => { expect(1).toBe(1); });",
    "test.for([1])('a', (n) => { expect(n).toBe(1); });",
    'const skipped = 0; expect(skipped).toBe(0);',
    '// test.skip is named in this comment and is not code',
  ];
  for (const source of fine) {
    expect(modifierOffenders('api/probe.test.ts', source), `must NOT be reported: ${source}`).toEqual([]);
  }
});

test('a frozen test with an empty body is reported', () => {
  expect(emptyBodyOffenders('api/probe.test.ts', "test('a', () => {});")).not.toEqual([]);
  expect(emptyBodyOffenders('api/probe.test.ts', "test('a', async () => {});")).not.toEqual([]);
  expect(emptyBodyOffenders('api/probe.test.ts', "it('a', () => {\n});")).not.toEqual([]);
  expect(emptyBodyOffenders('api/probe.test.ts', "test('a', () => { expect(1).toBe(1); });")).toEqual([]);

  // The limit, recorded rather than hidden: a body emptied to something that is
  // not literally an empty block defeats this regex. The assertion floor below
  // is the second instrument for the same gap, because every way of emptying a
  // body removes its expect() calls whatever is left behind.
  expect(emptyBodyOffenders('api/probe.test.ts', "test('a', () => { /* later */ });")).toEqual([]);
});

test('the rule reads a tree the way it reads the repository', () => {
  // End to end through walk and read, against a frozen-looking path, without
  // writing one byte into a frozen directory.
  const root = probeTree('api/src/weakened.test.ts', "test.skipIf(true)('a', () => { expect(1).toBe(1); });\n");
  const found = walkFilesIn(root, 'api', { extensions: ['.test.ts'] }).flatMap((file) =>
    modifierOffenders(file, readFileIn(root, file)),
  );

  expect(found).toEqual(['api/src/weakened.test.ts: test.skipIf']);
});

test('a frozen suite that loses tests or assertions is reported', () => {
  expect(countTests("test('a', () => {});\nit('b', () => {});")).toBe(2);
  expect(countTests("test.each([1])('a', () => {});")).toBe(1);
  expect(countAssertions('expect(1).toBe(1); expect(2).toBe(2);')).toBe(2);

  const RECORDED = {
    frozenExpandedTestCount: 440,
    frozenTestCallCount: 411,
    frozenAssertionCount: 955,
    frozenListedTestCount: { unit: 239, db: 170 },
  } as const;
  const AT = { expanded: 440, calls: 411, assertions: 955, listed: { unit: 239, db: 170 } } as const;

  // A floor is only a floor if going under it fails, and only useful if going
  // over it does not.
  expect(floorComplaints(AT, RECORDED)).toEqual([]);
  expect(floorComplaints({ ...AT, expanded: 441, assertions: 960 }, RECORDED)).toEqual([]);

  // Each count fails on its own, and the message names which one.
  expect(floorComplaints({ ...AT, expanded: 439 }, RECORDED)).toEqual(['frozen expanded tests: 439, recorded 440']);
  expect(floorComplaints({ ...AT, calls: 410 }, RECORDED)).toEqual(['frozen test call sites: 410, recorded 411']);
  expect(floorComplaints({ ...AT, assertions: 954 }, RECORDED)).toEqual(['frozen assertions: 954, recorded 955']);
  expect(floorComplaints({ ...AT, listed: { unit: 238, db: 170 } }, RECORDED)).toEqual([
    'frozen listed tests (unit): 238, recorded 239',
  ]);
  expect(floorComplaints({ ...AT, listed: { unit: 239, db: 169 } }, RECORDED)).toEqual([
    'frozen listed tests (db): 169, recorded 170',
  ]);
});

test('removing a case from an each table is caught by the expanded count and by nothing else', () => {
  // The founder's change on approval, and the measurement that corrected it.
  // A literal each table with four cases, and the same table with three.
  const four = "test.each([['a'], ['b'], ['c'], ['d']])('case %s', (s) => { expect(s).toBeTruthy(); });\n";
  const three = "test.each([['a'], ['b'], ['c']])('case %s', (s) => { expect(s).toBeTruthy(); });\n";

  // The primary count falls. This is the whole point of expanding the table.
  expect(countExpandedTests(four)).toBe(4);
  expect(countExpandedTests(three)).toBe(3);

  // The call-site count does not move, because the declaration is still one
  // declaration. `vitest list --json` does not move either, measured on
  // 2026-10-09: it reports one entry per declaration with the placeholder
  // unresolved, which is why it is the secondary check and not the primary one.
  expect(countTests(four)).toBe(1);
  expect(countTests(three)).toBe(1);

  // So the floor catches it only through the expanded count.
  const recorded = {
    frozenExpandedTestCount: 4,
    frozenTestCallCount: 1,
    frozenAssertionCount: 1,
    frozenListedTestCount: { unit: 1, db: 0 },
  } as const;
  expect(
    floorComplaints(
      { expanded: countExpandedTests(three), calls: 1, assertions: 1, listed: { unit: 1, db: 0 } },
      recorded,
    ),
  ).toEqual(['frozen expanded tests: 3, recorded 4']);

  // A table that is not a literal cannot be expanded, and the blind spot is
  // counted rather than assumed away. db/test/poll.test.ts has one.
  expect(countExpandedTests("test.each(transient)('%s', () => { expect(1).toBe(1); });")).toBe(1);
  expect(opaqueEachCount("test.each(transient)('%s', () => {});")).toBe(1);
  expect(opaqueEachCount(four)).toBe(0);

  // Nesting inside one case must not miscount the table.
  expect(countExpandedTests("test.each([[1, [2, 3]], [4, { a: 5 }]])('n', () => {});")).toBe(2);
});

test('an each table the parser cannot read is counted as opaque, never as zero or one', () => {
  // The founder's tightening of 2026-10-09. The parser has to answer "I cannot
  // read this" distinctly from "this holds one case", because the two differ by
  // however many cases the table really holds.
  const at = (source: string) => literalEachCases(source, source.indexOf('.each(') + '.each('.length);

  // Readable, and read exactly.
  expect(at("test.each([['a'], ['b'], ['c'], ['d']])('x', () => {});")).toBe(4);
  // A trailing comma is not a fifth element.
  expect(at("test.each([['a'], ['b'],])('x', () => {});")).toBe(2);
  // An empty literal is zero cases, which is a real count, not a parse failure.
  expect(at("test.each([])('x', () => {});")).toBe(0);
  // Nesting inside a case.
  expect(at("test.each([[1, [2, 3]], [4, { a: 5 }]])('x', () => {});")).toBe(2);

  // Unreadable, and said so. Each of these returns null, and null is what the
  // caller counts as opaque.
  expect(at("test.each(transient)('x', () => {});"), 'an identifier table').toBeNull();
  expect(at('test.each(buildCases())(\'x\', () => {});'), 'a call table').toBeNull();
  expect(at("test.each([...cases, ['x']])('x', () => {});"), 'a spread table').toBeNull();
  expect(at("test.each([...cases])('x', () => {});"), 'a spread-only table').toBeNull();
  expect(at("test.each([['a'], ['b']\n"), 'an unterminated table').toBeNull();

  // A gap, named rather than faked. The tagged-template table form,
  // test.each`a | b` with no parenthesis, is not matched by TEST_CALL at all,
  // so it is counted as neither a test nor an opaque each. Asserting it through
  // `at` above would pass for the wrong reason, because `at` looks for
  // `.each(` and there is none. No frozen baseline file uses that form today,
  // checked on 2026-10-09, and the modifier rule would not see one either.
  // Closing it means matching a backtick after the chain, which is a change to
  // TEST_CALL and to every count that uses it, so it is recorded here and not
  // done inside this task.
  expect(countTests('test.each`\n  a | b\n  1 | 2\n`;'), 'the template form is invisible to TEST_CALL').toBe(0);
  expect(opaqueEachCount('test.each`\n  a | b\n  1 | 2\n`;')).toBe(0);

  // And the ceiling fails when the number of unreadable tables rises.
  expect(opaqueComplaints(1, { frozenOpaqueEachCount: 1 })).toEqual([]);
  expect(opaqueComplaints(0, { frozenOpaqueEachCount: 1 }), 'turning one back into a literal is an improvement').toEqual(
    [],
  );
  expect(opaqueComplaints(2, { frozenOpaqueEachCount: 1 })).toEqual([
    'frozen opaque each tables: 2, recorded 1',
  ]);
});

test('rewriting a literal each table into an expression raises the opaque count by exactly one', () => {
  // The probe the founder asked for, on a real frozen file, in memory, with no
  // frozen file written. shared/src/agent-output.test.ts holds one literal
  // ten-case table and no opaque one.
  const real = readRepoFile('shared/src/agent-output.test.ts');
  expect(opaqueEachCount(real), 'this file starts with no opaque table').toBe(0);
  const expandedBefore = countExpandedTests(real);

  // Turn that literal table into an identifier, which is the shape of an
  // ordinary refactor and the shape that used to go unseen.
  const rewritten = real.replace(
    'test.each([0x0a, 0x0d, 0x0b, 0x0c, 0x09, 0x85, 0x2028, 0x2029, 0x202e, 0x200b])',
    'test.each(CONTROL_AND_SEPARATOR_CODE_POINTS)',
  );
  expect(rewritten, 'the replacement must have matched').not.toBe(real);

  // The opaque count rises by exactly one.
  expect(opaqueEachCount(rewritten) - opaqueEachCount(real)).toBe(1);

  // And the damage the ceiling exists to catch: nine cases vanish from the
  // primary count, while the call-site count does not move at all.
  expect(expandedBefore - countExpandedTests(rewritten)).toBe(9);
  expect(countTests(rewritten)).toBe(countTests(real));

  // So the ceiling reports it even if the expanded floor were satisfied by
  // tests added elsewhere in the same change.
  expect(opaqueComplaints(opaqueEachCount(rewritten), { frozenOpaqueEachCount: 0 })).toEqual([
    'frozen opaque each tables: 1, recorded 0',
  ]);
});

test('the each-aware count catches a removed case in a throwaway copy of a real frozen file', () => {
  // The probe the founder asked for, on real text rather than a fixture, and in
  // a tree outside the repository so no frozen file is written.
  const real = readRepoFile('shared/src/agent-output.test.ts');
  const before = countExpandedTests(real);

  // Remove the last case of the ten-value control-character table. The table is
  // written as `test.each([0x0a, 0x0d, ..., 0x200b])`, so dropping `, 0x200b`
  // removes exactly one case and changes nothing else.
  const after = countExpandedTests(real.replace(', 0x200b]', ']'));

  expect(before - after, 'removing one each case must drop the expanded count by one').toBe(1);
  // And the two counts that cannot see it.
  expect(countTests(real.replace(', 0x200b]', ']'))).toBe(countTests(real));
});

test('a baseline file that no vitest pattern collects is reported', () => {
  expect(globToRegExp('api/**/*.test.ts').test('api/src/a.test.ts')).toBe(true);
  expect(globToRegExp('api/**/*.test.ts').test('api/a.test.ts')).toBe(true);
  expect(globToRegExp('api/**/*.test.ts').test('db/a.test.ts')).toBe(false);
  expect(globToRegExp('template/test/compose.test.ts').test('template/test/compose.test.ts')).toBe(true);

  expect(uncollected(['api/a.test.ts'], ['api/**/*.test.ts'])).toEqual([]);
  expect(uncollected(['api/a.test.ts', 'ops/b.test.ts'], ['api/**/*.test.ts'])).toEqual(['ops/b.test.ts']);
});

const baseline = JSON.parse(readRepoFile('guards/freeze-baseline.json')) as {
  recordedAt: string;
  testFiles: string[];
  unitTestCount: number;
  frozenExpandedTestCount: number;
  frozenTestCallCount: number;
  frozenAssertionCount: number;
  frozenListedTestCount: ListedCounts;
  frozenOpaqueEachCount: number;
};

const frozenTestFiles = () => FROZEN.flatMap((dir) => walkFiles(dir, { extensions: ['.test.ts'] }));

test('no frozen test is disabled, inverted, made exclusive or turned into a todo', () => {
  const offenders = frozenTestFiles().flatMap((file) => modifierOffenders(file, readRepoFile(file)));
  expect(offenders).toEqual([]);
});

test('no frozen test has had its body emptied', () => {
  const offenders = frozenTestFiles().flatMap((file) => emptyBodyOffenders(file, readRepoFile(file)));
  expect(offenders).toEqual([]);
});

test('no frozen test file has been deleted since the freeze', () => {
  // One of the two checks that catches removal. A deleted file does not fail,
  // does not warn and does not appear in a diff anybody reads closely.
  const present = new Set(frozenTestFiles());
  const missing = baseline.testFiles.filter((file) => !present.has(file));
  expect(missing).toEqual([]);
});

test('the frozen suites still hold every test and assertion that was recorded', () => {
  // The other check that catches removal, and the only one here that catches a
  // test removed from a file that still exists.
  //
  // The listed counts are read from the baseline rather than computed, because
  // computing them means shelling out to vitest and a test that runs the test
  // runner is not a test. They are compared, so a drop still fails; what the
  // guard cannot do is notice the drop by itself. The log entry records the
  // command that produces them.
  let expanded = 0;
  let calls = 0;
  let assertions = 0;
  let opaque = 0;
  for (const file of baseline.testFiles) {
    if (!FROZEN.includes(file.split('/')[0] ?? '')) continue;
    if (!existsExact(file)) continue;
    const text = readRepoFile(file);
    expanded += countExpandedTests(text);
    calls += countTests(text);
    assertions += countAssertions(text);
    opaque += opaqueEachCount(text);
  }

  expect(
    floorComplaints({ expanded, calls, assertions, listed: baseline.frozenListedTestCount }, baseline),
  ).toEqual([]);

  // The ceiling, checked here and not inside floorComplaints, because it fails
  // in the other direction. If this rises, the expanded count above has gone
  // blind to a set of cases it used to read.
  expect(opaqueComplaints(opaque, baseline)).toEqual([]);
});

test('the recorded listed counts still match what vitest collects', () => {
  // The secondary check, run as its own step rather than inside the guard. A
  // guard cannot shell out to vitest, so this test pins the number and the
  // COMMAND that produces it, and CI re-derives it in the compose-smoke job.
  //
  // If this is the only thing standing between a dropped include pattern and a
  // green run, note that `every frozen baseline file is still collected by
  // vitest` above catches that case directly, from the config, with no
  // subprocess. These two overlap on purpose.
  expect(baseline.frozenListedTestCount.unit).toBeGreaterThanOrEqual(239);
  expect(baseline.frozenListedTestCount.db).toBeGreaterThanOrEqual(170);
  expect(baseline.frozenExpandedTestCount).toBeGreaterThanOrEqual(baseline.frozenTestCallCount);
});

test('every frozen baseline file is still collected by vitest', () => {
  // Removing a file from vitest.config.ts's include list disarms it while
  // leaving it in place, so existence alone is not enough to check. The first
  // version of this guard checked one file of the 46.
  const config = readRepoFile('vitest.config.ts');
  const globs = [...config.matchAll(/'([^']*\.test\.ts)'/g)].map((match) => match[1] ?? '');

  expect(globs.length, 'no test glob was found in vitest.config.ts').toBeGreaterThanOrEqual(10);
  expect(uncollected(baseline.testFiles, globs)).toEqual([]);

  // The single route to Gmail, named on purpose as well as covered above: it is
  // the one file whose loss would be hardest to notice from a diff.
  const gmail = 'template/test/no-unapproved-send.test.ts';
  expect(existsExact(gmail), `${gmail} is gone`).toBe(true);
  expect(config, `${gmail} is no longer collected`).toContain(gmail);
});

test('this guard is reading the frozen suites, not an empty list', () => {
  expect(frozenTestFiles().length).toBeGreaterThanOrEqual(46);
  expect(baseline.testFiles.length).toBeGreaterThanOrEqual(46);
});
