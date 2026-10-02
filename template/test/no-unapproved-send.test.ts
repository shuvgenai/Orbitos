import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from 'vitest';

const SOURCE = /\.(ts|mts|cts|tsx|js|mjs|cjs|jsx)$/;
const TEST_FILE = /\.(test|spec)\.[a-z]+$/;
const SKIPPED_DIRS = new Set(['node_modules', 'generated', 'dist', '.git']);

// Walks by hand so node_modules and build output are never entered (a recursive readdir from the repo root would).
function sourceFiles(dir: string): string[] {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch (err) {
    // Tolerate missing directories (e.g., worker/src may not exist yet)
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw err;
  }
  return entries.flatMap((e) => {
    if (e.isDirectory()) return SKIPPED_DIRS.has(e.name) ? [] : sourceFiles(join(dir, e.name));
    return e.isFile() && SOURCE.test(e.name) && !TEST_FILE.test(e.name) ? [join(dir, e.name)] : [];
  });
}
// A comment that merely mentions the send must not fail the suite: that false positive is what invites someone
// to loosen SEND_SURFACE. Comments are removed with a scanner that knows about string and template literals, so
// a "//" inside "https://..." or inside a string never hides the code after it.
export function stripComments(src: string): string {
  let out = '';
  let i = 0;
  while (i < src.length) {
    const c = src[i]!;
    const next = src[i + 1];
    if (c === '/' && next === '/') {
      while (i < src.length && src[i] !== '\n') i++;
    } else if (c === '/' && next === '*') {
      const end = src.indexOf('*/', i + 2);
      i = end === -1 ? src.length : end + 2;
      out += ' ';
    } else if (c === "'" || c === '"' || c === '`') {
      let j = i + 1;
      while (j < src.length && src[j] !== c) j += src[j] === '\\' ? 2 : 1;
      out += src.slice(i, j + 1);
      i = j + 1;
    } else {
      out += c;
      i++;
    }
  }
  return out;
}

// Everything in the repo that is not a dependency, build output or a test. Not a hand-written list of packages:
// a new package, app or script directory is in scope the moment it exists. A missing directory is tolerated.
// shared/ and db/ are included on purpose: a helper there that wraps the send and is called from anywhere
// would otherwise keep this test green.
const SCAN_ROOTS = ['.'];

// Anything that can put text in front of a customer: the port method, the raw Gmail endpoint, the MIME builder.
// Property access, destructuring, aliasing, optional chaining and bracket access all contain one of these names.
const SEND_SURFACE = /sendInThread|messages\/send|buildRaw/;

// FD-2b: the send path is reachable from exactly one module, and that module is the one that holds an approval
// row. The Gmail client defines the send, the fake mirrors it and the port declares it; nothing else may name it.
const DEFINITIONS = ['shared/src/gmail/client.ts', 'shared/src/gmail/fake.ts', 'shared/src/gmail/port.ts'];
const THE_CALLER = 'api/src/confirm.ts';

test('the send surface is named by api/src/confirm.ts and the Gmail definitions, and nowhere else', () => {
  const files = SCAN_ROOTS.flatMap(sourceFiles).map((f) => f.replaceAll('\\', '/'));
  expect(files).toContain(THE_CALLER); // the scan can see the real caller, so a path change cannot blind it
  expect(files).toContain('shared/src/gmail/client.ts');
  const namesIt = files.filter((file) => SEND_SURFACE.test(stripComments(readFileSync(file, 'utf8'))));
  expect(namesIt.sort()).toEqual([THE_CALLER, ...DEFINITIONS].sort());
});

test('the guard pattern catches the ways of calling the send that a plain call regex misses', () => {
  for (const sneaky of [
    'gmail?.sendInThread(args)',
    'const { sendInThread } = gmail;',
    'const f = gmail.sendInThread; f(args);',
    "gmail['sendInThread'](args)",
    "fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send')",
    'const raw = buildRaw(args);',
  ]) {
    expect(SEND_SURFACE.test(sneaky), sneaky).toBe(true);
  }
});

test('confirm.ts reads the approval before it sends, and sends from one place', () => {
  const source = readFileSync(THE_CALLER, 'utf8');
  const readAt = source.indexOf('approval.findUnique');
  const sendAt = source.indexOf('sendInThread(');
  expect(readAt).toBeGreaterThan(-1);
  expect(readAt).toBeLessThan(sendAt);
  expect(source.split('sendInThread(').length - 1).toBe(1);
});

test('N5: comments that mention the send are ignored, code that calls it is not', () => {
  const surface = (src: string) => SEND_SURFACE.test(stripComments(src));
  expect(surface('// never call sendInThread here')).toBe(false);
  expect(surface('/* sendInThread\n   and messages/send */ const x = 1;')).toBe(false);
  expect(surface('const x = 1; // buildRaw lives elsewhere')).toBe(false);
  expect(surface("const u = 'https://example.com'; gmail.sendInThread(a);")).toBe(true);
  expect(surface("fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send')")).toBe(true);
  expect(surface("const s = '// not a comment'; buildRaw(a);")).toBe(true);
  expect(surface('const t = `/* ${sendInThread} */`;')).toBe(true);
  expect(surface('/* c */ gmail.sendInThread(a);')).toBe(true);
});

test('N5: the scan reaches the directories the old hand-written list missed', () => {
  const files = SCAN_ROOTS.flatMap(sourceFiles).map((f) => f.replaceAll('\\', '/'));
  expect(files.some((f) => f.startsWith('landing/src/'))).toBe(true);
  expect(files.some((f) => f.startsWith('scripts/'))).toBe(true);
});
