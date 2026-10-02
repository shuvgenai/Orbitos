import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from 'vitest';

const SOURCE = /\.(ts|mts|cts|tsx|js|mjs|cjs|jsx)$/;
const TEST_FILE = /\.(test|spec)\.[a-z]+$/;
const SKIPPED_DIRS = new Set(['node_modules', 'generated', 'dist']);

function sourceFiles(dir: string): string[] {
  try {
    return readdirSync(dir, { withFileTypes: true, recursive: true })
      .filter((e) => e.isFile() && SOURCE.test(e.name) && !TEST_FILE.test(e.name))
      .map((e) => join(e.parentPath, e.name))
      .filter((file) => !file.split(/[\\/]/).some((part) => SKIPPED_DIRS.has(part)));
  } catch (err) {
    // Tolerate missing directories (e.g., worker/src may not exist yet)
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw err;
  }
}

// Every program's production source. shared/src and db/src are scanned too: a helper there that wraps the
// send and is called from anywhere would otherwise keep this test green.
const PROGRAM_SOURCE_DIRS = ['api', 'frontdesk', 'worker', 'shared', 'db', 'ops', 'web', 'design'].map((d) => `${d}/src`);

// Anything that can put text in front of a customer: the port method, the raw Gmail endpoint, the MIME builder.
// Property access, destructuring, aliasing, optional chaining and bracket access all contain one of these names.
const SEND_SURFACE = /sendInThread|messages\/send|buildRaw/;

// FD-2b: the send path is reachable from exactly one module, and that module is the one that holds an approval
// row. The Gmail client defines the send, the fake mirrors it and the port declares it; nothing else may name it.
const DEFINITIONS = ['shared/src/gmail/client.ts', 'shared/src/gmail/fake.ts', 'shared/src/gmail/port.ts'];
const THE_CALLER = 'api/src/confirm.ts';

test('the send surface is named by api/src/confirm.ts and the Gmail definitions, and nowhere else', () => {
  const files = PROGRAM_SOURCE_DIRS.flatMap(sourceFiles).map((f) => f.replaceAll('\\', '/'));
  expect(files).toContain(THE_CALLER); // the scan can see the real caller, so a path change cannot blind it
  expect(files).toContain('shared/src/gmail/client.ts');
  const namesIt = files.filter((file) => SEND_SURFACE.test(readFileSync(file, 'utf8')));
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
