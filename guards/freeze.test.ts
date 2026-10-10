import { parseSync } from '@babel/core';
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

// The next four declarations are the last of the text scanner, and they are
// kept for ONE reader: `literalEachCases` below, which counts the cases in an
// `each` table by reading the text and is not allowed to change in this task.
// The two rules that look for a weakened test no longer read the text at all.
// If `literalEachCases` is ever parsed instead, these four go with it.

/**
 * Characters after which a slash opens a regex literal and is not a division.
 *
 * Every one of these cannot end a value, so a slash next to it has nothing to
 * divide. The arithmetic and comparison operators are here for a measured
 * reason: without `+` the text `1 + /'"/.source` read as a division, the quote
 * opened a string, and the whole file after it was declared unreadable. Without
 * `>` the same happened to every arrow function returning a regex.
 */
const REGEX_AFTER = new Set([
  '',
  '(',
  ',',
  '=',
  ':',
  '[',
  '!',
  '&',
  '|',
  '?',
  '{',
  '}',
  ';',
  '+',
  '-',
  '*',
  '%',
  '<',
  '>',
  '^',
  '~',
]);

/**
 * Keywords after which a slash opens a regex literal.
 *
 * A character is not enough to tell the two slashes apart. In
 * `return /'/.test(s)` the character before the slash is `n`, which ends a
 * value everywhere else, so the single-character test says division and the
 * quote then opens a string that never closes. The word has to be read.
 */
const REGEX_AFTER_KEYWORD: ReadonlySet<string> = new Set([
  'return',
  'typeof',
  'case',
  'in',
  'of',
  'new',
  'delete',
  'void',
  'yield',
  'await',
  'do',
  'else',
]);

/**
 * The word that ends just before `at`, or '' when nothing there is a word.
 *
 * Takes a string or an array of characters, so both scanners can use it. The
 * scanner above passes its already blanked buffer, which means a keyword
 * written inside a comment reads as blank and is not mistaken for code.
 */
function wordBefore(chars: { readonly [index: number]: string | undefined }, at: number): string {
  let k = at - 1;
  while (k >= 0 && /\s/.test(chars[k] ?? '')) k -= 1;
  const end = k + 1;
  while (k >= 0 && /[\w$]/.test(chars[k] ?? '')) k -= 1;
  let word = '';
  for (let m = k + 1; m < end; m += 1) word += chars[m] ?? '';
  return word;
}

/** Whether a slash at `at` opens a regex literal rather than dividing. */
function startsRegex(chars: { readonly [index: number]: string | undefined }, prev: string, at: number): boolean {
  return REGEX_AFTER.has(prev) || REGEX_AFTER_KEYWORD.has(wordBefore(chars, at));
}

/**
 * Names that disable or invert a test, on ANY root.
 *
 * `const T = test.extend({})` then `T.skip(...)` is the same weakening under a
 * different name, and a rule that only knew `test`, `it` and `describe` would
 * not see it. In a frozen test file these names on anything are a finding. That
 * reports more than strictly needed, which is the right side to err on.
 */
const DISABLING_NAMES: ReadonlySet<string> = new Set(['skip', 'only', 'skipIf', 'runIf', 'todo', 'fails']);

/** The roots that vitest gives its modifiers to. Their chains use the allow list. */
const VITEST_ROOTS: ReadonlySet<string> = new Set(['test', 'it', 'describe']);

/** The roots whose callback body the empty-body rule reads. */
const TEST_ROOTS: ReadonlySet<string> = new Set(['test', 'it']);

/** What a file's unreadable text is called in a report. */
const unreadable = (file: string, why: string) => `${file}: cannot be scanned, it holds ${why}`;

// THE PARSER, and why these two rules now use one.
//
// Five rounds of this guard read the text with a regex and blanked what it
// thought was a comment, a string, a template or a regex. That cannot tell
// `a.in / 2` from the start of a regex literal, or `if (a) /x/` from a
// division, without being a tokenizer, and each round traded one hole for
// another: the round before this one condemned eight valid files to keep eight
// disabled tests from hiding. The founder ended it on 2026-10-10. These rules
// parse the file and walk the tree.
//
// WHICH parser, and the one place this deviates from the direction it was given.
// The direction named `ts.createSourceFile`. The pinned `typescript` 7.0.2 is
// the native port: the only JavaScript its package exports is a version string,
// there is no parser anywhere in it, and its one route to a tree is a protocol
// spoken to a server binary that this release does not ship. So the parser here
// is Babel's, reached through `@babel/core`, which is already a root
// devDependency and already the parser eslint reads this repository with. No
// dependency was added and no lockfile was touched. Node names below are
// Babel's: a computed MemberExpression is what TypeScript calls an
// ElementAccessExpression, and an uncomputed one is its
// PropertyAccessExpression.
//
// FAILS CLOSED, and harder than before. A file with ANY syntax error does not
// parse, and a file that does not parse is reported, never skipped. The text
// scanner only noticed the four open spans it knew how to run off the end of;
// `function f( {` passed it silently.

/**
 * The parser plugins a file's extension asks for, which is this parser's
 * version of a ScriptKind. A `.tsx` file needs both, because its generics and
 * its elements are told apart by the pair.
 */
type ParserPlugin = 'typescript' | 'jsx';
function parserPlugins(file: string): readonly ParserPlugin[] {
  if (file.endsWith('.tsx')) return ['typescript', 'jsx'];
  if (/\.[cm]?ts$/.test(file)) return ['typescript'];
  if (file.endsWith('.jsx')) return ['jsx'];
  return [];
}

/**
 * A node, as much of one as these rules read.
 *
 * Structural on purpose. `@babel/types` is not resolvable at the repository
 * root, only `@babel/core` is, so the node type is described here rather than
 * imported. Every field is read through the helpers below, which narrow from
 * `unknown`, so a field that is not there reads as absent instead of throwing.
 */
type AstNode = { readonly type: string; readonly [field: string]: unknown };

function isAstNode(value: unknown): value is AstNode {
  return typeof value === 'object' && value !== null && typeof (value as { readonly type?: unknown }).type === 'string';
}

/** One child node, or null when that field holds something else. */
function childOf(node: AstNode, field: string): AstNode | null {
  const value: unknown = node[field];
  return isAstNode(value) ? value : null;
}

/** The nodes in a field that holds a list, and nothing else in it. */
function childrenOf(node: AstNode, field: string): readonly AstNode[] {
  const value: unknown = node[field];
  if (!Array.isArray(value)) return [];
  const out: AstNode[] = [];
  for (const entry of value as readonly unknown[]) if (isAstNode(entry)) out.push(entry);
  return out;
}

/** A string field, or null. */
function textOf(node: AstNode, field: string): string | null {
  const value: unknown = node[field];
  return typeof value === 'string' ? value : null;
}

/**
 * Comments hang off the node they sit beside and carry a `type` of their own,
 * so a plain walk would descend into them. A commented-out test is not a test,
 * which is the whole reason the old scanner blanked comments, so these three
 * fields are not walked.
 */
const COMMENT_FIELDS: ReadonlySet<string> = new Set(['leadingComments', 'trailingComments', 'innerComments']);

/**
 * Every node under `node`, parents before children and in source order, with
 * each node's parent handed to the visitor.
 *
 * The parent is what the direction asked `setParentNodes` for. It is passed
 * down rather than stored on the node, because `skipIf` and `runIf` put the
 * test declaration in a SECOND call and the rule has to look up one level to
 * find it.
 */
function walk(node: AstNode, parent: AstNode | null, visit: (node: AstNode, parent: AstNode | null) => void): void {
  visit(node, parent);
  for (const [field, value] of Object.entries(node)) {
    if (COMMENT_FIELDS.has(field)) continue;
    if (isAstNode(value)) {
      walk(value, node, visit);
      continue;
    }
    if (!Array.isArray(value)) continue;
    for (const entry of value as readonly unknown[]) if (isAstNode(entry)) walk(entry, node, visit);
  }
}

type Parsed = { readonly root: AstNode | null; readonly problem: string | null };

/** Where a thrown parse error says the problem is. */
function syntaxPlace(error: unknown): string {
  if (typeof error !== 'object' || error === null) return 'on an unknown line';
  const loc: unknown = (error as { readonly loc?: unknown }).loc;
  if (typeof loc !== 'object' || loc === null) return 'on an unknown line';
  const line: unknown = (loc as { readonly line?: unknown }).line;
  return typeof line === 'number' ? `on line ${line}` : 'on an unknown line';
}

/**
 * The file as a tree, or the reason it is not one.
 *
 * `errorRecovery` stays off deliberately. A recovered tree is a guess about
 * what the author meant, and a guess is what this guard spent five rounds
 * failing to make safely. A file that does not parse is reported.
 */
function parseFile(file: string, text: string): Parsed {
  try {
    const result: unknown = parseSync(text, {
      babelrc: false,
      configFile: false,
      cwd: REPO_ROOT,
      filename: file,
      sourceType: 'module',
      parserOpts: { errorRecovery: false, plugins: [...parserPlugins(file)] },
    });
    if (!isAstNode(result)) return { root: null, problem: 'nothing the parser would call a file' };
    return { root: result, problem: null };
  } catch (error: unknown) {
    return { root: null, problem: `a syntax error ${syntaxPlace(error)}` };
  }
}

/** The root of a callee that cannot be named, such as the call in `test.extend({}).skip(...)`. */
const UNNAMED_ROOT = '(...)';

/** One member in a chain: its name, or null when the key is computed from something unreadable. */
type Segment = { readonly name: string | null };

/** A callee read as a root and the chain of members between it and the call. */
type Callee = { readonly root: string; readonly segments: readonly Segment[] };

/**
 * The name a member access reads, or null.
 *
 * Null twice over, for two different reasons that both end in the same answer.
 * A computed key that is a string literal, `test["skip"]`, is read: it is the
 * same call as `test.skip` written differently. A computed key that is anything
 * else, `test[name]` or `test['sk' + 'ip']`, cannot be read from the file at
 * all, and the caller turns that into a finding rather than a pass.
 */
function memberSegment(member: AstNode): Segment {
  const property = childOf(member, 'property');
  if (property === null) return { name: null };
  if (member['computed'] !== true) {
    return { name: property.type === 'Identifier' ? textOf(property, 'name') : null };
  }
  return { name: property.type === 'StringLiteral' ? textOf(property, 'value') : null };
}

/** A call's callee as a root and a member chain, or null when it has no chain. */
function readCallee(call: AstNode): Callee | null {
  const segments: Segment[] = [];
  let node = childOf(call, 'callee');
  while (node !== null && (node.type === 'MemberExpression' || node.type === 'OptionalMemberExpression')) {
    segments.unshift(memberSegment(node));
    node = childOf(node, 'object');
  }
  if (segments.length === 0) return null;
  const name = node !== null && node.type === 'Identifier' ? textOf(node, 'name') : null;
  return { root: name ?? UNNAMED_ROOT, segments };
}

/**
 * Whether an argument list looks like a test declaration: a string or template
 * title first, OR a function second.
 *
 * Either is enough, and this disjunction is the one the founder signed off. A
 * title alone covers `T.todo('a')`, which has no callback. A function second
 * covers `T.skip(title, () => {})`, where the title is a variable. Neither is
 * true of `cursor.skip(10)`, `qb.skip(20).take(10)`, `scheduler.fails(3)`,
 * `page.skip(1)` or `reader.skip(4)`, which are pagination and must stay clean,
 * and neither is true of a logging call that takes no callback.
 */
function looksLikeArguments(call: AstNode): boolean {
  const args = childrenOf(call, 'arguments');
  const title = args[0];
  if (title !== undefined && (title.type === 'StringLiteral' || title.type === 'TemplateLiteral')) return true;
  const callback = args[1];
  return callback !== undefined && (callback.type === 'ArrowFunctionExpression' || callback.type === 'FunctionExpression');
}

/**
 * Whether a call on a root other than test, it or describe looks like a test
 * declaration.
 *
 * `skipIf(cond)` and `runIf(cond)` take the condition first and the declaration
 * in a second call, so for those the enclosing call's arguments are the ones
 * read. With no enclosing call it is reported, which is the conservative answer.
 */
function looksLikeDeclaration(call: AstNode, parent: AstNode | null, segment: string): boolean {
  if (segment !== 'skipIf' && segment !== 'runIf') return looksLikeArguments(call);
  if (parent === null) return true;
  if (parent.type !== 'CallExpression' && parent.type !== 'OptionalCallExpression') return true;
  if (childOf(parent, 'callee') !== call) return true;
  return looksLikeArguments(parent);
}

/** Every disabling or inverting modifier in one file. */
export function modifierOffenders(file: string, text: string): readonly string[] {
  const { root, problem } = parseFile(file, text);
  if (root === null) return [unreadable(file, problem ?? 'nothing the parser would call a file')];

  const out: string[] = [];
  walk(root, null, (node, parent) => {
    if (node.type !== 'CallExpression' && node.type !== 'OptionalCallExpression') return;
    const callee = readCallee(node);
    if (callee === null) return;
    const vitest = VITEST_ROOTS.has(callee.root);
    for (const segment of callee.segments) {
      if (segment.name === null) {
        // A key computed at run time on a test root. Nothing in the file says
        // which modifier this is, so it fails closed: `test[name]('a', fn)`
        // could be `test.skip` and this guard must not call it clean.
        if (vitest) out.push(`${file}: ${callee.root}[...] cannot be verified`);
        continue;
      }
      const bad = vitest
        ? !HARMLESS_MODIFIERS.has(segment.name)
        : DISABLING_NAMES.has(segment.name) && looksLikeDeclaration(node, parent, segment.name);
      if (bad) out.push(`${file}: ${callee.root}.${segment.name}`);
    }
  });
  return out;
}

/**
 * The identifier a callee finally rests on, through members and through calls.
 *
 * Through calls as well, so that `test.each(table)('%s', fn)` and
 * `test.skipIf(cond)('a', fn)` are still rooted at `test`.
 */
function calleeRoot(call: AstNode): string | null {
  let node = childOf(call, 'callee');
  while (node !== null) {
    if (node.type === 'Identifier') return textOf(node, 'name');
    if (node.type === 'MemberExpression' || node.type === 'OptionalMemberExpression') {
      node = childOf(node, 'object');
      continue;
    }
    if (node.type === 'CallExpression' || node.type === 'OptionalCallExpression') {
      node = childOf(node, 'callee');
      continue;
    }
    return null;
  }
  return null;
}

/** Whether a statement is `void 0;`, the no-op a body gets emptied to. */
function isVoidZero(statement: AstNode): boolean {
  if (statement.type !== 'ExpressionStatement') return false;
  const expression = childOf(statement, 'expression');
  if (expression === null || expression.type !== 'UnaryExpression' || expression['operator'] !== 'void') return false;
  const argument = childOf(expression, 'argument');
  return argument !== null && argument.type === 'NumericLiteral' && argument['value'] === 0;
}

/**
 * Whether a callback body runs nothing.
 *
 * Three shapes, not one. An empty block is the obvious one. A block of nothing
 * but `;` and a block of nothing but `void 0;` are the two the text rule could
 * not see, and they were a recorded open gap for four rounds: an emptied body
 * passes the assertion floor too, because an `expect(` left behind in a comment
 * still counts there. A body holding only a comment is an empty block to a
 * parser, so that is caught as well.
 */
function isDoingNothing(body: AstNode): boolean {
  if (body.type !== 'BlockStatement') return false;
  return childrenOf(body, 'body').every(
    (statement) => statement.type === 'EmptyStatement' || isVoidZero(statement),
  );
}

export function emptyBodyOffenders(file: string, text: string): readonly string[] {
  const { root, problem } = parseFile(file, text);
  if (root === null) return [unreadable(file, problem ?? 'nothing the parser would call a file')];

  const out: string[] = [];
  walk(root, null, (node) => {
    if (node.type !== 'CallExpression' && node.type !== 'OptionalCallExpression') return;
    const name = calleeRoot(node);
    if (name === null || !TEST_ROOTS.has(name)) return;
    for (const argument of childrenOf(node, 'arguments')) {
      if (argument.type !== 'ArrowFunctionExpression' && argument.type !== 'FunctionExpression') continue;
      const body = childOf(argument, 'body');
      if (body !== null && isDoingNothing(body)) out.push(`${file}: a test with an empty body`);
    }
  });
  return out;
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
    if (char === '/' && startsRegex(text, prev, i)) {
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
  // EVERY assertion in this test is an exact array.
  //
  // Not one of them is a check for "not empty". A disabled test that is found
  // by name and a whole file that is condemned as unreadable are different
  // answers, and `.not.toEqual([])` passes for both. Three times in this task a
  // real finding hid behind that, which is why the rule here is exactness even
  // where it reads as fussy.
  const cases: readonly (readonly [string, string, readonly string[]])[] = [
    ['test.skip', "test.skip('a', () => { expect(1).toBe(1); });", ['api/probe.test.ts: test.skip']],
    ['test.skipIf', "test.skipIf(true)('a', () => { expect(1).toBe(1); });", ['api/probe.test.ts: test.skipIf']],
    ['test.runIf', "test.runIf(false)('a', () => { expect(1).toBe(1); });", ['api/probe.test.ts: test.runIf']],
    ['test.only', "test.only('a', () => { expect(1).toBe(1); });", ['api/probe.test.ts: test.only']],
    ['test.todo', "test.todo('a');", ['api/probe.test.ts: test.todo']],
    ['test.fails', "test.fails('a', () => { expect(1).toBe(2); });", ['api/probe.test.ts: test.fails']],
    ['it.skip', "it.skip('a', () => { expect(1).toBe(1); });", ['api/probe.test.ts: it.skip']],
    ['it.fails', "it.fails('a', () => { expect(1).toBe(2); });", ['api/probe.test.ts: it.fails']],
    [
      'describe.skip',
      "describe.skip('a', () => { test('b', () => { expect(1).toBe(1); }); });",
      ['api/probe.test.ts: describe.skip'],
    ],
    [
      'describe.only',
      "describe.only('a', () => { test('b', () => { expect(1).toBe(1); }); });",
      ['api/probe.test.ts: describe.only'],
    ],
    [
      'test.concurrent.skip',
      "test.concurrent.skip('a', () => { expect(1).toBe(1); });",
      ['api/probe.test.ts: test.skip'],
    ],
    [
      'describe.concurrent.only',
      "describe.concurrent.only('a', () => { test('b', () => { expect(1).toBe(1); }); });",
      ['api/probe.test.ts: describe.only'],
    ],
    // A line that only STARTS with a comment can still hold a disabled test.
    [
      'skip after a closed block comment',
      "/* paused */ test.skip('a', () => { expect(1).toBe(1); });",
      ['api/probe.test.ts: test.skip'],
    ],
    // The same weakening under another name, through test.extend.
    [
      'alias skip',
      "const T = test.extend({});\nT.skip('a', () => { expect(1).toBe(1); });",
      ['api/probe.test.ts: T.skip'],
    ],
    [
      'alias skipIf',
      "const T = test.extend({});\nT.skipIf(true)('a', () => { expect(1).toBe(1); });",
      ['api/probe.test.ts: T.skipIf'],
    ],
    [
      'alias only',
      "const T = test.extend({});\nT.only('a', () => { expect(1).toBe(1); });",
      ['api/probe.test.ts: T.only'],
    ],
    [
      'alias concurrent skip',
      "const T = test.extend({});\nT.concurrent.skip('a', () => { expect(1).toBe(1); });",
      ['api/probe.test.ts: T.skip'],
    ],
    ['alias todo', "const T = test.extend({});\nT.todo('a');", ['api/probe.test.ts: T.todo']],
    // A computed title: the function is the second argument.
    [
      'alias skip, computed title',
      "const T = test.extend({});\nT.skip(title, () => { expect(1).toBe(1); });",
      ['api/probe.test.ts: T.skip'],
    ],
    [
      'alias only, function expression',
      "const T = test.extend({});\nT.only(name, function () { expect(1).toBe(1); });",
      ['api/probe.test.ts: T.only'],
    ],
    [
      'alias skipIf, computed title',
      "const T = test.extend({});\nT.skipIf(cond)(name, async () => { expect(1).toBe(1); });",
      ['api/probe.test.ts: T.skipIf'],
    ],
    // A root with no name of its own. The text rule could not see this one at
    // all: it needed an identifier to the left of the first dot, and here there
    // is a call there. Measured against 77768e8, where it returned [].
    [
      'a chain on a call',
      "test.extend({}).skip('a', () => { expect(1).toBe(1); });",
      ['api/probe.test.ts: (...).skip'],
    ],
    // Whitespace around the dot, which the text rule's regex forbade. All three
    // of these returned [] against 77768e8: three silent misses in the shape a
    // formatter produces on a long chain.
    ['a line break before the dot', "test\n.skip('a', () => { expect(1).toBe(1); });", ['api/probe.test.ts: test.skip']],
    ['a space before the dot', "test .skip('a', () => { expect(1).toBe(1); });", ['api/probe.test.ts: test.skip']],
    ['a space after the dot', "test. skip('a', () => { expect(1).toBe(1); });", ['api/probe.test.ts: test.skip']],
    // The same call written as an element access. Also [] against 77768e8.
    ['a string key', 'test["skip"](\'a\', () => { expect(1).toBe(1); });', ['api/probe.test.ts: test.skip']],
    // A key built at run time names no modifier that can be read from the file,
    // so it fails closed rather than passing. [] against 77768e8.
    [
      'a computed key',
      "test['sk'+'ip']('a', () => { expect(1).toBe(1); });",
      ['api/probe.test.ts: test[...] cannot be verified'],
    ],
    ['a chain after a disabling name', "test.skip.each([1])('a %i', (n) => { expect(n).toBe(1); });", ['api/probe.test.ts: test.skip']],
  ];
  for (const [label, source, expected] of cases) {
    expect(modifierOffenders('api/probe.test.ts', source), `${label} must be reported`).toEqual(expected);
  }

  // THE EIGHT FILES THE TEXT SCANNER COULD ONLY CONDEMN, now named.
  //
  // Each one is valid JavaScript holding one disabled test. Three families, one
  // per way of misreading a slash: after `)` or `]` a slash reads as a division
  // and a backtick after it opens a template that closes lines below; after a
  // property named `in`, `return` or `of` the keyword check called the slash a
  // regex; after `++` or `--` the single-character check did the same. Five
  // rounds chased those through the character before the slash. The round
  // before this one stopped chasing and refused to blank any span holding a
  // disabling name, which turned all eight into
  // `cannot be scanned, it holds a disabled test in text that reads as a
  // template` or `... as a regex`: the test no longer hid, but the file was
  // condemned and the offender was never named.
  //
  // A parser classifies the slash because it knows the grammar, so all eight
  // now name the offender. Each is checked with and without a final newline.
  const disabled = "test.skip('hidden', () => { expect(1).toBe(1); });";
  const named = ['api/probe.test.ts: test.skip'];
  const slashes: readonly (readonly [string, string])[] = [
    ['A a backtick regex after a close parenthesis', 'if (a) /`/.test(s);\n' + disabled + '\nif (b) /`/.test(s);\n'],
    ['B a backtick regex after a while condition', 'while (a) /`/.test(s);\n' + disabled + '\nwhile (b) /`/.test(s);\n'],
    ['C a backtick regex after a close bracket', 'if (a[0]) /`/.test(s);\n' + disabled + '\nif (b[0]) /`/.test(s);\n'],
    ['D a property named in', 'const q = a.in / 2; ' + disabled + ' const z = y / 2;\n'],
    ['E a property named return', 'const q = obj.return / 2; ' + disabled + ' const z = y / 2;\n'],
    ['F a property named of', 'const q = x.of / 2; ' + disabled + ' const z = y / 2;\n'],
    ['G a post-increment before a division', 'let i = 1; i++ / 2; ' + disabled + ' const z = y / 2;\n'],
    ['H a post-decrement before a division', 'let a = 1; a-- / 2; ' + disabled + ' const z = y / 2;\n'],
    // F1 and F2 are two more of the same family, and both of them returned []
    // against 77768e8: the disabled test was invisible, not condemned. F1 ends
    // in a comment holding an apostrophe, which the old quote rule read as the
    // start of a string. F2 puts two slashes inside a character class, which
    // the old regex reader took for the end of the literal.
    ['F1 a quote regex, a double-quoted title and an apostrophe in a comment', 'if (a) /\'/.test(s); test.skip("hidden", () => { expect(1).toBe(1); }); // isn\'t'],
    ['F2 a character class holding two slashes', "if (a) /[//]/.test(s); " + disabled],
  ];
  for (const [label, source] of slashes) {
    for (const [shape, body] of [
      ['as written', source],
      ['without its final newline', source.endsWith('\n') ? source.slice(0, -1) : source],
    ] as const) {
      expect(modifierOffenders('api/probe.test.ts', body), `${label} ${shape}`).toEqual(named);
      expect(emptyBodyOffenders('api/probe.test.ts', body), `${label} ${shape}, empty-body rule`).toEqual([]);
    }
  }

  // Three files that the relaxed quote rule of round 3 hid completely, kept
  // because the shape is a real one: a frozen file that checks quote escaping
  // has a regex character class holding a quote and a backtick.
  const hidden: readonly (readonly [string, string, readonly string[]])[] = [
    [
      'two tests after a quote and backtick class',
      "function h(s) { return /['`]/.test(s); }\n" +
        "test('kept', () => { expect(1).toBe(1); });\n" +
        "test.skip('hidden', () => { expect(1).toBe(1); });\n" +
        "test.only('also hidden', () => { expect(1).toBe(1); });\n" +
        'function g(s) { return /[`]/.test(s); }\n' +
        "test('tail', () => { expect(1).toBe(1); });\n",
      ['api/probe.test.ts: test.skip', 'api/probe.test.ts: test.only'],
    ],
    [
      'one test between two regex classes',
      "function h(s) { return /['`]/.test(s); }\n" +
        "test.skip('hidden', () => { expect(1).toBe(1); });\n" +
        'function g(s) { return /[`]/.test(s); }\n',
      ['api/probe.test.ts: test.skip'],
    ],
    [
      'a quote and a double quote in a regex on the same line as the test',
      'const n = 1 + /\'"/.source; test.skip("a", () => { expect(1).toBe(1); });\n',
      ['api/probe.test.ts: test.skip'],
    ],
    // A backtick inside a template hole. The old scanner needed a recursion to
    // read this; a parser needs nothing.
    [
      'a backtick inside a template hole',
      'const md = `a ${ "x`y" }\n  tail`;\ntest.skip(\'frozen\', () => { expect(1).toBe(1); });',
      ['api/probe.test.ts: test.skip'],
    ],
  ];
  for (const [label, source, expected] of hidden) {
    expect(modifierOffenders('api/probe.test.ts', source), label).toEqual(expected);
    expect(emptyBodyOffenders('api/probe.test.ts', source), `${label}, no empty body`).toEqual([]);
  }

  // FAILS CLOSED, on anything that is not a file.
  //
  // The text scanner knew four ways to run off the end of a span and reported
  // those four. Everything else that was not valid code it read anyway, and
  // `function f( {` passed it silently. A parser answers one question instead
  // of four: does this file parse. The line number is in the message because
  // the first thing a reader of a red guard needs is where to look.
  //
  // Each input is checked as written and with a final newline. All 46 real
  // frozen files end with one, so a fail-closed path that only fires on a file
  // without it guards no file this rule will ever read.
  const unparseable: readonly (readonly [string, string, number])[] = [
    ['an unterminated template', "const s = `open\ntest.skip('a', () => { expect(1).toBe(1); });", 1],
    ['an unterminated string', "test('a', () => { expect(1).toBe(1); });\nconst s = 'open", 2],
    ['an unterminated block comment', "/* open\ntest.skip('a', () => { expect(1).toBe(1); });", 1],
    ['an unterminated template hole', 'const s = `a ${ b\n' + "test.skip('a', () => { expect(1).toBe(1); });", 2],
    // This input used to be reported as `test.skip`, because the scanner read
    // `* note */` as the tail of a block comment and blanked it. It is not
    // valid code, so it is now condemned rather than named. That is the right
    // answer: a frozen test file that does not parse is a broken frozen test
    // file, and vitest would not run it either.
    ['a line that is not code at all', "* note */ test.skip('a', () => { expect(1).toBe(1); });", 1],
  ];
  for (const [label, source, line] of unparseable) {
    const expected = [`api/probe.test.ts: cannot be scanned, it holds a syntax error on line ${line}`];
    for (const [shape, body] of [
      ['as written', source],
      ['ending with a newline', `${source}\n`],
    ] as const) {
      expect(modifierOffenders('api/probe.test.ts', body), `${label} ${shape} must be reported`).toEqual(expected);
      expect(emptyBodyOffenders('api/probe.test.ts', body), `${label} ${shape}, empty-body rule`).toEqual(expected);
    }
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
    "expect(1).toBe(1); // test.skip('a', () => {})",
    "const label = 'test.skip(' + x;",
    // BOTH ACCEPTED FALSE REDS ARE GONE, and their notes went with them.
    //
    // A real template string whose text happens to hold `test.only` was
    // reported by round 5, which could not tell it from the bogus template a
    // misread backtick opens. A valid regex holding a quote after a close
    // parenthesis was reported from round 4 on, as an unterminated string. Both
    // were recorded as accepted costs of a text scanner and both were measured
    // red against 77768e8. A parser reads each one correctly, so neither is a
    // cost any more and neither needs a note explaining itself.
    'const q = `test.only ${1}`; expect(q).toBeTruthy();',
    "if (a) /'/.test(s);",
    // Pagination and other calls that are not test declarations. The
    // disjunction that keeps them clean is unchanged: a string or template
    // title, or a function second.
    'const page = cursor.skip(10);',
    'const rows = qb.skip(20).take(10);',
    'scheduler.fails(3);',
    'const next = page.skip(1);',
    'reader.skip(4);',
    'logger.info("done");',
  ];
  for (const source of fine) {
    expect(modifierOffenders('api/probe.test.ts', source), `must NOT be reported: ${source}`).toEqual([]);
    expect(emptyBodyOffenders('api/probe.test.ts', source), `must NOT be reported: ${source}`).toEqual([]);
  }

  // The limit of the disjunction, named rather than hidden. A call on a root
  // that is not test, it or describe, with a string first argument, reads as a
  // declaration whatever it really is. `logger.only('x')` is reported. The
  // founder ruled on 2026-10-09 that this is the right side to err on, and the
  // four valid regex inputs above cost nothing for it.
  expect(modifierOffenders('api/probe.test.ts', "logger.only('x');"), 'a logging call with a string').toEqual([
    'api/probe.test.ts: logger.only',
  ]);

  // Valid code holding a quote inside a regex literal, which was the shape that
  // cost rounds 3 and 4. Each is checked with a final newline and without one,
  // because the two used to take different paths through the quote rule.
  for (const line of [
    "const f = (s) => /'/.test(s);",
    "function f(s) { return /'/.test(s); }",
    "const n = 1 + /'/.source.length;",
    'const t = typeof /"/;',
  ]) {
    for (const source of [`${line}\n`, line]) {
      expect(modifierOffenders('api/probe.test.ts', source), `must scan clean: ${line}`).toEqual([]);
      expect(emptyBodyOffenders('api/probe.test.ts', source), `must scan clean: ${line}`).toEqual([]);
    }
  }
});

test('a frozen test with an empty body is reported', () => {
  const emptied = ['api/probe.test.ts: a test with an empty body'];
  const reported: readonly (readonly [string, string])[] = [
    ['an empty block', "test('a', () => {});"],
    ['an async empty block', "test('a', async () => {});"],
    ['a block holding only a line break', "it('a', () => {\n});"],
    ['a parameter list', "test('a', (ctx) => {});"],
    ['a destructured context', "test('a', async ({ task }) => {});"],
    ['a function expression', "test('a', function () {});"],
    ['a named async function', "test('a', async function named(ctx) {});"],
    ['one bare parameter', "test('a', ctx => {});"],
    ['a body holding only a comment', "test('a', () => { /* later */ });"],
    // THE GAP THAT WAS PARKED FOR FOUR ROUNDS, CLOSED.
    //
    // A body emptied to a no-op statement is not an empty block in the text, so
    // the old regex could not match it, and the assertion floor never covered
    // it either: an `expect(` left behind in a comment still counts there, which
    // the note on countTests says. A parser sees the statements, so a block of
    // nothing but `;` or `void 0;` is now a body that runs nothing. Both
    // returned [] against 77768e8.
    ['a body of only a semicolon', "test('a', () => { ; });"],
    ['a body of only void 0', "test('a', () => { void 0; });"],
    ['a body of void 0 and a commented-out assertion', "test('a', () => { void 0; // expect(1).toBe(1);\n});"],
    // A title that is not a literal no longer hides an empty body either. The
    // old regex needed a quoted title to match at all. [] against 77768e8.
    ['a computed title', 'test(title, () => {});'],
  ];
  for (const [label, source] of reported) {
    expect(emptyBodyOffenders('api/probe.test.ts', source), `${label} must be reported`).toEqual(emptied);
  }

  // Why the assertion floor could never have been the instrument for the case
  // above: the commented-out assertion still counts as one.
  expect(countAssertions("test('a', () => { void 0; // expect(1).toBe(1);\n});")).toBe(1);

  const fine: readonly (readonly [string, string])[] = [
    ['a body with an assertion', "test('a', () => { expect(1).toBe(1); });"],
    ['a context parameter and an assertion', "test('a', (ctx) => { expect(ctx).toBeTruthy(); });"],
    // A test quoted in a comment or a string is not a test.
    ['a test inside a doc comment', "/**\n * test('a', function () {});\n */"],
    ['a test inside a block comment', "/* historical: test('a', async ({ task }) => {}); */"],
    ['a test inside a string', 'const doc = "test(\'a\', (ctx) => {});";'],
    // An empty callback that is not a test callback.
    ['an empty callback on another root', "onReady(() => {});"],
    ['an empty assertion callback inside a real body', "test('a', () => { expect(() => {}).not.toThrow(); });"],
  ];
  for (const [label, source] of fine) {
    expect(emptyBodyOffenders('api/probe.test.ts', source), `${label} must NOT be reported`).toEqual([]);
  }

  // A file the parser cannot read fails instead of passing.
  expect(emptyBodyOffenders('api/probe.test.ts', "const s = `open\ntest('a', () => {});")).toEqual([
    'api/probe.test.ts: cannot be scanned, it holds a syntax error on line 1',
  ]);
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
