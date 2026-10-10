import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterAll, expect, test } from 'vitest';
import { REPO_ROOT, existsExact, readFileIn, readRepoFile, walkFiles, walkFilesIn } from './lib/walk.ts';

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
 * The text with every comment and every string body blanked to spaces.
 *
 * Offsets and line breaks are kept, so a match in the result points at the same
 * place in the original. String quotes are kept and only what is between them
 * is blanked, so a test title is still recognisable as a string.
 *
 * Not a full tokenizer. It knows `//` and block comments, single, double and
 * template strings, code inside a template's `${ }` (which is kept and scanned,
 * and may hold strings and templates of its own), and regex literals after a
 * character that cannot end a value. This is why the modifier rule scans this
 * and not raw lines: a line that merely starts with a comment can still hold a
 * disabled test after it.
 *
 * FAILS CLOSED. If the end of the file is reached inside a string, a template,
 * a template hole or a block comment, the scanner does not know where code
 * resumes, and blanking the rest of the file would hide every test after that
 * point. It reports a problem instead, and the rules turn that into an
 * offender. A file this guard cannot read must fail, never pass.
 */
const REGEX_AFTER = new Set(['', '(', ',', '=', ':', '[', '!', '&', '|', '?', '{', '}', ';']);

type Scanned = { readonly text: string; readonly problem: string | null };

function scanText(text: string): Scanned {
  const out = text.split('');
  let problem: string | null = null;
  const fail = (why: string) => {
    problem ??= why;
  };
  const blank = (from: number, to: number) => {
    for (let k = from; k < to; k += 1) if (out[k] !== '\n') out[k] = ' ';
  };

  // Scans code from `start`. Stops at the end of the text, or, inside a template
  // hole, at the `}` that closes it, and returns that index.
  const code = (start: number, inHole: boolean): number => {
    let i = start;
    let prev = '';
    let braces = 0;
    while (i < text.length) {
      const c = text[i] ?? '';
      const n = text[i + 1] ?? '';
      if (c === '/' && n === '/') {
        const end = text.indexOf('\n', i);
        const stop = end < 0 ? text.length : end;
        blank(i, stop);
        i = stop;
        continue;
      }
      if (c === '/' && n === '*') {
        const end = text.indexOf('*/', i + 2);
        if (end < 0) {
          fail('an unterminated block comment');
          blank(i, text.length);
          return text.length;
        }
        blank(i, end + 2);
        i = end + 2;
        continue;
      }
      if (c === "'" || c === '"') {
        let j = i + 1;
        while (j < text.length && text[j] !== c && text[j] !== '\n') {
          if (text[j] === '\\') j += 1;
          j += 1;
        }
        if (j >= text.length) {
          fail('an unterminated string');
          blank(i + 1, text.length);
          return text.length;
        }
        if (text[j] === '\n') {
          // A quote that is not closed on its line is not a string. It is most
          // likely the quote inside a regex literal the scanner took for a
          // division, as in `(s) => /'/.test(s)`. Blank nothing and move on. A
          // string that is really unterminated still runs to the end of the
          // file, and that is where it fails.
          i += 1;
          continue;
        }
        blank(i + 1, j);
        i = j + 1;
        prev = c;
        continue;
      }
      if (c === '`') {
        let j = i + 1;
        let closed = false;
        while (j < text.length) {
          const t = text[j] ?? '';
          if (t === '\\') {
            blank(j, j + 2);
            j += 2;
            continue;
          }
          if (t === '`') {
            closed = true;
            break;
          }
          if (t === '$' && text[j + 1] === '{') {
            blank(j, j + 2);
            j = code(j + 2, true);
            if (j >= text.length) break;
            blank(j, j + 1);
            j += 1;
            continue;
          }
          blank(j, j + 1);
          j += 1;
        }
        if (!closed) {
          fail('an unterminated template');
          return text.length;
        }
        i = j + 1;
        prev = c;
        continue;
      }
      if (c === '/' && REGEX_AFTER.has(prev)) {
        let j = i + 1;
        let inClass = false;
        let closed = false;
        while (j < text.length && text[j] !== '\n') {
          const ch = text[j];
          if (ch === '\\') j += 1;
          else if (ch === '[') inClass = true;
          else if (ch === ']') inClass = false;
          else if (ch === '/' && !inClass) {
            closed = true;
            break;
          }
          j += 1;
        }
        if (closed) {
          blank(i + 1, j);
          i = j + 1;
          prev = 'x';
          continue;
        }
      }
      if (inHole && c === '{') braces += 1;
      if (inHole && c === '}') {
        if (braces === 0) return i;
        braces -= 1;
      }
      if (!/\s/.test(c)) prev = c;
      i += 1;
    }
    if (inHole) fail('an unterminated template hole');
    return i;
  };

  code(0, false);
  return { text: out.join(''), problem };
}

export function stripNonCode(text: string): string {
  return scanText(text).text;
}

/** What a file's unreadable text is called in a report. */
const unreadable = (file: string, why: string) => `${file}: cannot be scanned, it holds ${why}`;

/**
 * A call with a dotted chain on any identifier.
 *
 * Group 1 is the root, group 2 the whole chain. The leading boundary is
 * `[^.\w$]` rather than `\b`, so a property access like `helpers.test.skip`
 * does not read as a vitest call on `test`.
 */
const CHAIN_CALL = /(?:^|[^.\w$])([A-Za-z_$][\w$]*)((?:\.[A-Za-z_$][\w$]*)+)\s*\(/g;

/** The roots that vitest gives its modifiers to. Their chains use the allow list. */
const VITEST_ROOTS: ReadonlySet<string> = new Set(['test', 'it', 'describe']);

/**
 * Names that disable or invert a test, on ANY root.
 *
 * `const T = test.extend({})` then `T.skip(...)` is the same weakening under a
 * different name, and a rule that only knew `test`, `it` and `describe` would
 * not see it. In a frozen test file these names on anything are a finding. That
 * reports more than strictly needed, which is the right side to err on.
 */
const DISABLING_NAMES: ReadonlySet<string> = new Set(['skip', 'only', 'skipIf', 'runIf', 'todo', 'fails']);

/**
 * Whether the argument list that starts at `from` looks like a test
 * declaration: a string or template title first, OR a function second.
 *
 * Either is enough. A title alone covers `T.todo('a')`, which has no callback.
 * A function second covers `T.skip(title, () => {})`, where the title is a
 * variable. Neither is true of `cursor.skip(10)` or `qb.skip(20).take(10)`,
 * which are pagination and must stay clean. The text is the stripped text,
 * where quotes are kept and brackets inside strings are blank, so counting
 * brackets here is safe.
 */
function looksLikeArguments(code: string, from: number): boolean {
  if (/^\s*['"`]/.test(code.slice(from))) return true;

  let depth = 0;
  let i = from;
  for (; i < code.length; i += 1) {
    const ch = code[i];
    if (ch === '(' || ch === '[' || ch === '{') depth += 1;
    else if (ch === ')' || ch === ']' || ch === '}') {
      if (depth === 0) return false;
      depth -= 1;
    } else if (ch === ',' && depth === 0) break;
  }
  if (i >= code.length) return false;
  return /^\s*(?:async\s+)?(?:function\b|(?:\((?:[^()]|\([^()]*\))*\)|[\w$]+)\s*=>)/.test(code.slice(i + 1));
}

/**
 * Whether a non-vitest root's call looks like a test declaration.
 *
 * `skipIf(cond)` and `runIf(cond)` take the condition first and the declaration
 * in a second call, so for those the second call's arguments are checked. With
 * no second call it is reported, which is conservative.
 */
function looksLikeDeclaration(code: string, open: number, segment: string): boolean {
  if (segment !== 'skipIf' && segment !== 'runIf') return looksLikeArguments(code, open);

  let depth = 1;
  let i = open;
  while (i < code.length && depth > 0) {
    if (code[i] === '(') depth += 1;
    if (code[i] === ')') depth -= 1;
    i += 1;
  }
  if (depth !== 0) return true;
  const next = /^\s*\(/.exec(code.slice(i));
  return next === null ? true : looksLikeArguments(code, i + next[0].length);
}

/** Every disabling or inverting modifier in one file's text. */
export function modifierOffenders(file: string, text: string): readonly string[] {
  const { text: code, problem } = scanText(text);
  if (problem !== null) return [unreadable(file, problem)];

  const out: string[] = [];
  for (const match of code.matchAll(CHAIN_CALL)) {
    const root = match[1] ?? '';
    const chain = (match[2] ?? '').split('.').filter((part) => part !== '');
    const open = match.index + match[0].length;
    for (const segment of chain) {
      const bad = VITEST_ROOTS.has(root)
        ? !HARMLESS_MODIFIERS.has(segment)
        : DISABLING_NAMES.has(segment) && looksLikeDeclaration(code, open, segment);
      if (bad) out.push(`${file}: ${root}.${segment}`);
    }
  }
  return out;
}

/**
 * A test whose callback body is empty.
 *
 * Only an empty block, with any parameter list, an arrow or a `function`,
 * async or not. It reads the text with comments and string bodies blanked, so a
 * test quoted in a comment or a string is not a test, and a body that holds
 * only a comment IS an empty block. A body emptied to a no-op statement, such
 * as `void 0;`, is NOT matched, and nothing else catches it either. The
 * assertion floor does not: an `expect(` left inside a comment still counts,
 * which the note on `countTests` says. That is an open gap, recorded here
 * rather than hidden. Closing it needs a real parser, and that is a decision
 * for the founder.
 */
const EMPTY_BODY =
  /(?:^|[^.\w])(?:test|it)(?:\.[A-Za-z][A-Za-z0-9]*)*\s*\(\s*(['"`])(?:\\.|(?!\1)[^\\])*\1\s*,\s*(?:async\s*)?(?:function\s*[\w$]*\s*\([^)]*\)|\([^)]*\)\s*=>|[\w$]+\s*=>)\s*\{\s*\}\s*\)/g;

export function emptyBodyOffenders(file: string, text: string): readonly string[] {
  const { text: code, problem } = scanText(text);
  if (problem !== null) return [unreadable(file, problem)];
  return [...code.matchAll(EMPTY_BODY)].map(() => `${file}: a test with an empty body`);
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
  // The last character that was neither blank nor inside a comment. It decides
  // whether a slash opens a regex literal or is a division.
  let prev = '';

  for (; i < text.length; i += 1) {
    const char = text[i] ?? '';
    const next = text[i + 1] ?? '';

    // Comments hold no elements and no brackets that count.
    if (char === '/' && next === '/') {
      const end = text.indexOf('\n', i);
      if (end < 0) return null;
      i = end;
      continue;
    }
    if (char === '/' && next === '*') {
      const end = text.indexOf('*/', i + 2);
      if (end < 0) return null;
      i = end + 1;
      continue;
    }

    // A string is one piece of content. A bracket or a comma inside it is not
    // structure. A template with `${` inside cannot be classified, so it is
    // opaque. So is any string that is not closed on its line.
    if (char === "'" || char === '"' || char === '`') {
      let j = i + 1;
      while (j < text.length && text[j] !== char) {
        if (text[j] === '\\') j += 1;
        else if (char === '`' && text[j] === '$' && text[j + 1] === '{') return null;
        else if (char !== '`' && text[j] === '\n') return null;
        j += 1;
      }
      if (j >= text.length) return null;
      i = j;
      sawContent = true;
      prev = char;
      continue;
    }

    // A regex literal, when a slash follows something that cannot end a value.
    // Inside a table that is a comma, an open bracket, a colon or an operator.
    if (char === '/' && REGEX_AFTER.has(prev)) {
      let j = i + 1;
      let inClass = false;
      let closed = false;
      while (j < text.length && text[j] !== '\n') {
        const ch = text[j];
        if (ch === '\\') j += 1;
        else if (ch === '[') inClass = true;
        else if (ch === ']') inClass = false;
        else if (ch === '/' && !inClass) {
          closed = true;
          break;
        }
        j += 1;
      }
      if (!closed) return null;
      i = j;
      sawContent = true;
      prev = 'x';
      continue;
    }

    if (char === '[' || char === '(' || char === '{') {
      depth += 1;
      if (depth > 1) sawContent = true;
      prev = char;
      continue;
    }

    if (char === ']' || char === ')' || char === '}') {
      depth -= 1;
      if (depth === 0) return sawContent ? elements + 1 : elements;
      prev = char;
      continue;
    }

    // A spread at the top level makes the size unknowable from the text.
    if (depth === 1 && char === '.' && text.startsWith('...', i)) return null;

    if (depth === 1 && char === ',') {
      if (sawContent) elements += 1;
      sawContent = false;
      prev = char;
      continue;
    }

    if (!/\s/.test(char)) {
      sawContent = true;
      prev = char;
    }
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
 * secondary rather than primary: it does not expand a `test.each`. The
 * ten-case `test.each` in shared/src/agent-output.test.ts shows as ONE listed
 * entry, with its placeholder unresolved.
 *
 * It is RECORDED in the baseline and NOT checked by this guard. A guard that
 * shelled out to vitest would be a test that runs the test runner, and no CI
 * step re-derives it either. `floorComplaints` can compare it when a caller
 * passes a measured value, which the probes do. The real-surface check does
 * not, because the only value it has is the recorded one, and a number
 * compared with itself cannot fail. To re-measure it, run
 * `pnpm exec vitest list --project unit --json` and the same for `db`, and
 * count the entries whose file is a frozen baseline file.
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
  /** Omitted when no measured value exists. Then the listed counts are not compared. */
  readonly listed?: ListedCounts;
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
  if (actual.listed !== undefined) {
    below('frozen listed tests (unit)', actual.listed.unit, recorded.frozenListedTestCount.unit);
    below('frozen listed tests (db)', actual.listed.db, recorded.frozenListedTestCount.db);
  }

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
const GLOB_ANY = '\u0002';
export function globToRegExp(glob: string): RegExp {
  // A `**` with no slash after it, as in `api/**` or a bare `**`, matches
  // anything below. Without that, an exclude of `api/**` would match nothing
  // and the exclude check would fail open.
  const source = glob
    .split('**/')
    .join(GLOB_SENTINEL)
    .replace(/[.+^${}()|[\]\\]/g, (char) => `\\${char}`)
    .split('**')
    .join(GLOB_ANY)
    .split('*')
    .join('[^/]*')
    .split(GLOB_SENTINEL)
    .join('(?:.*/)?')
    .split(GLOB_ANY)
    .join('.*');
  return new RegExp(`^${source}$`);
}

/** Baseline files that no glob collects. */
export function uncollected(files: readonly string[], globs: readonly string[]): readonly string[] {
  const patterns = globs.map((glob) => globToRegExp(glob));
  return files.filter((file) => !patterns.some((pattern) => pattern.test(file)));
}

/** One vitest project, reduced to what decides which files it runs. */
export type ProjectScope = {
  readonly name: string;
  readonly include: readonly string[];
  readonly exclude: readonly string[];
};

/**
 * Only these projects run the frozen suites. The browser project is jsdom, so
 * a frozen glob moved there would still be "included" and run in the wrong
 * environment. Naming the allowed projects closes that.
 */
const FROZEN_PROJECTS: ReadonlySet<string> = new Set(['unit', 'db']);

/**
 * Baseline files that no plain project collects.
 *
 * A file is collected when some unit or db project includes it AND that same
 * project does not exclude it. An exclude list is read as an exclude list, not
 * as one more glob that happens to be quoted in the config.
 */
export function uncollectedByProjects(
  files: readonly string[],
  projects: readonly ProjectScope[],
): readonly string[] {
  return files.filter((file) => {
    const collected = projects.some(
      (project) =>
        FROZEN_PROJECTS.has(project.name) &&
        project.include.some((glob) => globToRegExp(glob).test(file)) &&
        !project.exclude.some((glob) => globToRegExp(glob).test(file)),
    );
    return !collected;
  });
}

/**
 * The projects of vitest.config.ts, read from the imported config.
 *
 * Imported the way guards/vite-fs-allow.test.ts imports a Vite config, and for
 * the same reason: a text scan cannot tell an include from an exclude. A shape
 * this function does not understand throws, because going quiet is how a guard
 * reports green while checking nothing.
 */
async function configProjects(): Promise<readonly ProjectScope[]> {
  const loaded: unknown = await import(pathToFileURL(join(REPO_ROOT, 'vitest.config.ts')).href);
  const exported = (loaded as { default?: unknown }).default;
  const settled: unknown =
    typeof exported === 'function' ? await (exported as (env: object) => unknown)({}) : await exported;

  const test = (settled as { test?: { projects?: unknown; exclude?: unknown } } | undefined)?.test;
  if (!Array.isArray(test?.projects)) throw new Error('vitest.config.ts: test.projects is not an array');

  const strings = (value: unknown, where: string): readonly string[] => {
    if (value === undefined) return [];
    if (!Array.isArray(value) || value.some((entry) => typeof entry !== 'string')) {
      throw new Error(`vitest.config.ts: ${where} is not a list of strings`);
    }
    return value as string[];
  };
  const topExclude = strings(test?.exclude, 'test.exclude');

  return (test.projects as unknown[]).map((entry, index) => {
    const inner = (entry as { test?: { name?: unknown; include?: unknown; exclude?: unknown } } | null)?.test;
    if (inner === undefined || inner === null || typeof inner !== 'object') {
      throw new Error(`vitest.config.ts: project ${index} is not an inline object with a test key`);
    }
    const include = inner.include === undefined ? ['**/*.test.ts'] : strings(inner.include, `project ${index} include`);
    return {
      name: typeof inner.name === 'string' ? inner.name : '',
      include,
      exclude: [...topExclude, ...strings(inner.exclude, `project ${index} exclude`)],
    };
  });
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
    // A line that only STARTS with a comment can still hold a disabled test.
    ['skip after a closed block comment', "/* paused */ test.skip('a', () => { expect(1).toBe(1); });"],
    ['skip after a star line', "* note */ test.skip('a', () => { expect(1).toBe(1); });"],
    // The same weakening under another name, through test.extend.
    ['alias skip', "const T = test.extend({});\nT.skip('a', () => { expect(1).toBe(1); });"],
    ['alias skipIf', "const T = test.extend({});\nT.skipIf(true)('a', () => { expect(1).toBe(1); });"],
    ['alias only', "const T = test.extend({});\nT.only('a', () => { expect(1).toBe(1); });"],
    ['alias concurrent skip', "const T = test.extend({});\nT.concurrent.skip('a', () => { expect(1).toBe(1); });"],
    ['alias todo', "const T = test.extend({});\nT.todo('a');"],
    // A computed title: the function is the second argument.
    ['alias skip, computed title', "const T = test.extend({});\nT.skip(title, () => { expect(1).toBe(1); });"],
    ['alias only, function expression', "const T = test.extend({});\nT.only(name, function () { expect(1).toBe(1); });"],
    ['alias skipIf, computed title', "const T = test.extend({});\nT.skipIf(cond)(name, async () => { expect(1).toBe(1); });"],
  ];

  // Three inputs the scanner cannot read to the end. Each is reported as
  // unscannable and never passes, because blanking the rest of the file would
  // hide every test after the open span.
  const unscannable: readonly (readonly [string, string])[] = [
    ['unterminated template', "const s = `open\ntest.skip('a', () => { expect(1).toBe(1); });"],
    ['unterminated string at end of file', "test('a', () => { expect(1).toBe(1); });\nconst s = 'open"],
    ['unterminated block comment', "/* open\ntest.skip('a', () => { expect(1).toBe(1); });"],
  ];
  for (const [label, source] of unscannable) {
    const found = modifierOffenders('api/probe.test.ts', source);
    expect(found, `${label} must be reported`).toHaveLength(1);
    expect(found[0], `${label} must say it cannot be scanned`).toContain('cannot be scanned');
  }

  // The fourth is NOT unscannable. A backtick inside a template hole is read by
  // the hole recursion, so the file scans to the end and the skipped test after
  // it is found. Exact on purpose: if the recursion regressed, this would turn
  // into an unscannable report and a loose check would still pass.
  expect(
    modifierOffenders(
      'api/probe.test.ts',
      "const md = `a ${ \"x`y\" }\n  tail`;\ntest.skip('frozen', () => { expect(1).toBe(1); });",
    ),
    'a backtick inside a template hole',
  ).toEqual(['api/probe.test.ts: test.skip']);

  // Valid code that holds a quote inside a regex literal reads as code, not as
  // an unterminated string, wherever the regex sits. Each is a whole file, so it
  // ends with a newline.
  for (const line of [
    "const f = (s) => /'/.test(s);",
    "function f(s) { return /'/.test(s); }",
    "const n = 1 + /'/.source.length;",
    'const t = typeof /"/;',
  ]) {
    const source = `${line}\n`;
    expect(modifierOffenders('api/probe.test.ts', source), `must scan clean: ${line}`).toEqual([]);
    expect(emptyBodyOffenders('api/probe.test.ts', source), `must scan clean: ${line}`).toEqual([]);
  }

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
    'expect(1).toBe(1); // test.skip later',
    "const label = 'test.only is a string';",
    'const label = "test.skip is a string";',
    "const x = 1; /* test.skip('a', () => {}) */ expect(x).toBe(1);",
    "/* test.skip\n('a') */ test('a', () => { expect(1).toBe(1); });",
    "/* test.skip in a comment */ test('a', () => { expect(1).toBe(1); });",
    'const q = `test.only ${1}`; expect(q).toBeTruthy();',
    // The real pre-fix false positives, which have a parenthesis.
    "expect(1).toBe(1); // test.skip('a', () => {})",
    "const label = 'test.skip(' + x;",
    // Pagination and other calls that are not test declarations.
    'const page = cursor.skip(10);',
    'const rows = qb.skip(20).take(10);',
    'scheduler.fails(3);',
    'const next = page.skip(1);',
    'reader.skip(4);',
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

  // Any parameter list, and the function keyword.
  expect(emptyBodyOffenders('api/probe.test.ts', "test('a', (ctx) => {});")).not.toEqual([]);
  expect(emptyBodyOffenders('api/probe.test.ts', "test('a', async ({ task }) => {});")).not.toEqual([]);
  expect(emptyBodyOffenders('api/probe.test.ts', "test('a', function () {});")).not.toEqual([]);
  expect(emptyBodyOffenders('api/probe.test.ts', "test('a', async function named(ctx) {});")).not.toEqual([]);
  expect(emptyBodyOffenders('api/probe.test.ts', "test('a', ctx => {});")).not.toEqual([]);
  expect(emptyBodyOffenders('api/probe.test.ts', "test('a', (ctx) => { expect(ctx).toBeTruthy(); });")).toEqual([]);

  // The limit, recorded rather than hidden. It is an open gap: a body emptied to
  // a no-op statement is not an empty block, and the assertion floor does not
  // cover it either, because an expect( left in a comment still counts. The
  // same family: a body of only `;` or `void 0;`, which no rule here matches.
  expect(countAssertions("test('a', () => { void 0; // expect(1).toBe(1);\n});")).toBe(1);
  expect(emptyBodyOffenders('api/probe.test.ts', "test('a', () => { void 0; // expect(1).toBe(1);\n});")).toEqual([]);
  // A body that holds only a comment is an empty block once comments are blanked.
  expect(emptyBodyOffenders('api/probe.test.ts', "test('a', () => { /* later */ });")).not.toEqual([]);

  // A test quoted in a comment or a string is not a test.
  // A doc-comment line is only a comment inside its comment, so it is probed whole.
  expect(emptyBodyOffenders('api/probe.test.ts', "/**\n * test('a', function () {});\n */")).toEqual([]);
  expect(emptyBodyOffenders('api/probe.test.ts', "/* historical: test('a', async ({ task }) => {}); */")).toEqual([]);
  expect(emptyBodyOffenders('api/probe.test.ts', 'const doc = "test(\'a\', (ctx) => {});";')).toEqual([]);

  // A file the scanner cannot read fails instead of passing.
  expect(emptyBodyOffenders('api/probe.test.ts', "const s = `open\ntest('a', () => {});")).not.toEqual([]);
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

  // With no measured listed counts the listed pair is skipped, not compared with
  // itself. This is what the real-surface check passes.
  expect(floorComplaints({ expanded: 440, calls: 411, assertions: 955 }, RECORDED)).toEqual([]);
  expect(floorComplaints({ expanded: 439, calls: 411, assertions: 955 }, RECORDED)).toEqual([
    'frozen expanded tests: 439, recorded 440',
  ]);

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

  // A bracket inside a string or a regex is not structure. These used to return
  // a confidently wrong small number, which is worse than saying opaque.
  expect(at("test.each([['a]'], ['b']])('x', () => {});"), 'a bracket in a nested string').toBe(2);
  expect(at("test.each([[/a]/], [2]])('x', () => {});"), 'a bracket in a regex').toBe(2);
  expect(at("test.each(['a', 'b]c', 'd'])('x', () => {});"), 'a bracket in a flat string').toBe(3);
  expect(at("test.each(['a,b', 'c'])('x', () => {});"), 'a comma in a string').toBe(2);
  expect(at('test.each(["a\\"]", "b"])(\'x\', () => {});'), 'an escaped quote').toBe(2);
  expect(at("test.each([1, // one, two ]\n 2])('x', () => {});"), 'a comment in the table').toBe(2);
  expect(at("test.each([1, /* ] , */ 2])('x', () => {});"), 'a block comment in the table').toBe(2);
  // What cannot be classified is opaque, never a guess.
  expect(at('test.each([`a${1}`, \'b\'])(\'x\', () => {});'), 'a template with a substitution').toBeNull();
  expect(at("test.each(['a, 'b'])\n('x', () => {});"), 'an unclosed string').toBeNull();
  expect(at("test.each([/a, 2])('x', () => {});"), 'an unclosed regex').toBeNull();
  expect(at("test.each([1, /* never closed 2])('x', () => {});"), 'an unclosed comment').toBeNull();

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

  // A bare or trailing globstar crosses directories, so an exclude of api/** is
  // not read as matching nothing.
  expect(globToRegExp('api/**').test('api/src/a.test.ts')).toBe(true);
  expect(globToRegExp('**').test('api/src/a.test.ts')).toBe(true);
});

test('an exclude list, or a move to another project, takes a baseline file out of collection', () => {
  const gmail = 'template/test/no-unapproved-send.test.ts';
  const unit = (include: readonly string[], exclude: readonly string[] = []): ProjectScope => ({
    name: 'unit',
    include,
    exclude,
  });

  // The healthy shape.
  expect(uncollectedByProjects(['api/a.test.ts', gmail], [unit(['api/**/*.test.ts', gmail])])).toEqual([]);

  // The evasion: the same globs are all still quoted in the config, but now they
  // are an exclude list. A text scan for quoted globs passes this and runs nothing.
  expect(
    uncollectedByProjects(['api/a.test.ts', gmail], [unit(['shared/**/*.test.ts'], ['api/**/*.test.ts', gmail])]),
  ).toEqual(['api/a.test.ts', gmail]);
  expect(uncollectedByProjects(['api/a.test.ts'], [unit(['api/**/*.test.ts'], ['api/**'])])).toEqual([
    'api/a.test.ts',
  ]);

  // A frozen glob moved from the unit project into the jsdom project.
  const dashboards: ProjectScope = { name: 'dashboards', include: ['api/**/*.test.ts'], exclude: [] };
  expect(uncollectedByProjects(['api/a.test.ts'], [unit(['shared/**/*.test.ts']), dashboards])).toEqual([
    'api/a.test.ts',
  ]);

  // An exclude in one project does not hide a file another plain project runs.
  const db: ProjectScope = { name: 'db', include: ['db/**/*.test.ts'], exclude: [] };
  expect(uncollectedByProjects(['db/a.test.ts'], [unit(['db/**/*.test.ts'], ['db/**']), db])).toEqual([]);
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
  // The listed counts are not compared here. The only value available at this
  // surface is the recorded one, and comparing it with itself cannot fail.
  // Computing it means shelling out to vitest, and a test that runs the test
  // runner is not a test. The three counts below are measured from the files.
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
    floorComplaints({ expanded, calls, assertions }, baseline),
  ).toEqual([]);

  // The ceiling, checked here and not inside floorComplaints, because it fails
  // in the other direction. If this rises, the expanded count above has gone
  // blind to a set of cases it used to read.
  expect(opaqueComplaints(opaque, baseline)).toEqual([]);
});

test('the baseline records the listed counts and keeps expanded at or above call sites', () => {
  // This asserts the recorded numbers only. It does NOT run vitest, and nothing
  // in CI re-derives the listed counts, so they are a record kept by hand and
  // not a check. The command to re-measure them is on ListedCounts above.
  // Whether a dropped include pattern is caught is the job of the next test,
  // which reads the config structurally.
  expect(baseline.frozenListedTestCount.unit).toBeGreaterThanOrEqual(239);
  expect(baseline.frozenListedTestCount.db).toBeGreaterThanOrEqual(170);
  expect(baseline.frozenExpandedTestCount).toBeGreaterThanOrEqual(baseline.frozenTestCallCount);
});

test('every frozen baseline file is still collected by vitest', async () => {
  // Removing a file from an include list, or adding it to an exclude list,
  // disarms it while leaving it in place, so existence alone is not enough. The
  // config is imported and read structurally, so an exclude entry is not
  // mistaken for an include entry.
  const projects = await configProjects();

  expect(projects.length, 'no project was found in vitest.config.ts').toBeGreaterThanOrEqual(2);
  expect(uncollectedByProjects(baseline.testFiles, projects)).toEqual([]);

  // The single route to Gmail, named on purpose as well as covered above: it is
  // the one file whose loss would be hardest to notice from a diff.
  const gmail = 'template/test/no-unapproved-send.test.ts';
  expect(existsExact(gmail), `${gmail} is gone`).toBe(true);
  expect(uncollectedByProjects([gmail], projects), `${gmail} is no longer collected`).toEqual([]);
});

test('this guard is reading the frozen suites, not an empty list', () => {
  expect(frozenTestFiles().length).toBeGreaterThanOrEqual(46);
  expect(baseline.testFiles.length).toBeGreaterThanOrEqual(46);
});
