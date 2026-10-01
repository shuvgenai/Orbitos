import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from 'vitest';

function sourceFiles(dir: string): string[] {
  try {
    return readdirSync(dir, { withFileTypes: true, recursive: true })
      .filter((e) => e.isFile() && e.name.endsWith('.ts') && !e.name.endsWith('.test.ts'))
      .map((e) => join(e.parentPath, e.name));
  } catch (err) {
    // Tolerate missing directories (e.g., worker/src may not exist yet)
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw err;
  }
}

// FD-2b: the send path is reachable from exactly one module, and that module is the one
// that holds an approval row. A new caller anywhere else fails this test on purpose.
test('sendInThread is called from api/src/confirm.ts and nowhere else', () => {
  const callers = [...sourceFiles('api/src'), ...sourceFiles('frontdesk/src'), ...sourceFiles('worker/src')]
    .filter((file) => /\bsendInThread\s*\(/.test(readFileSync(file, 'utf8')))
    .map((file) => file.replaceAll('\\', '/'));
  expect(callers).toEqual(['api/src/confirm.ts']);
});

test('confirm.ts reads the approval before it sends', () => {
  const source = readFileSync('api/src/confirm.ts', 'utf8');
  const readAt = source.indexOf('approval.findUnique');
  const sendAt = source.indexOf('sendInThread(');
  expect(readAt).toBeGreaterThan(-1);
  expect(readAt).toBeLessThan(sendAt);
});
