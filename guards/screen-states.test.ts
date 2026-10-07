import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterAll, expect, test } from 'vitest';
import { REPO_ROOT, type RootedPath, readFileIn, walkFilesIn } from './lib/walk.ts';

// The six states of PRD section 15.4 are ONE component, and this is the test
// that keeps them that way.
//
// dashboards/src/shared/states/ScreenState.tsx owns the markup and the copy.
// A screen that writes its own empty state passes every other guard: the copy
// is plain, the colours are classes, the words are allowed. It is still a
// defect, because the six then drift apart across 52 screens and fixing one
// fixes one. So the rule is ownership, not correctness.
//
// Scope is dashboards/src/apps. shared/ is where the states are allowed to
// live, and shared/layout/Screen.tsx is the frame that hands the work to the
// one component.

const APPS = 'dashboards/src/apps';

/** Script and markup. A state hand-rolled in a stylesheet is caught by its class. */
const CODE = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.mts', '.cts', '.css'];

// Tests and stories may build a state on purpose to assert against it.
const NOT_SCREEN_DIRS = ['__tests__', '__fixtures__'];
const NOT_SCREEN_FILE = /\.(?:test|spec|stories|story)\.[^./]+$/i;

/** Any class the shared stylesheet defines for the six states. */
const STATE_CLASS = /\bscreen-state[\w-]*/;

/**
 * The copy ScreenState.tsx owns, word for word.
 *
 * A screen repeating one of these has written its own version of that state,
 * whatever it called the element. Taken from the component by hand rather than
 * imported: importing it would make the guard pass the moment someone changed
 * the component's wording, which is exactly when it should be read again.
 */
const STATE_COPY = [
  'Something went wrong at our end.',
  'This office is paused.',
  'Actions are off for now.',
  'This belongs to',
  'To see it, ask',
  'This expired.',
  'This was already decided.',
  'Try again',
];

const isScreenFile = (file: string) => !NOT_SCREEN_FILE.test(file);

/** Files under src/apps that write a state the shared component owns. */
export function handRolledStates(root: string): string[] {
  const found: string[] = [];
  for (const file of walkFilesIn(root, APPS, { extensions: CODE, skipAnywhere: NOT_SCREEN_DIRS })) {
    if (!isScreenFile(file)) continue;
    const src = readFileIn(root, file as RootedPath);
    if (STATE_CLASS.test(src)) found.push(`${file}: a screen-state class`);
    for (const copy of STATE_COPY) if (src.includes(copy)) found.push(`${file}: the copy "${copy}"`);
  }
  return found.sort();
}

test('no screen under src/apps writes a state the shared component owns', () => {
  expect(handRolledStates(REPO_ROOT), 'use ScreenState, or Screen, which calls it').toEqual([]);
});

// ---- Probes. A throwaway tree outside the repo, never inside it. ----

const roots: string[] = [];
afterAll(() => roots.forEach((r) => rmSync(r, { recursive: true, force: true })));

function makeRoot(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), 'orbit-states-'));
  roots.push(root);
  for (const [rel, body] of Object.entries(files)) {
    const full = join(root, rel);
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, body, 'utf8');
  }
  return root;
}

test('a hand-rolled empty state under src/apps fails, by class and by copy', () => {
  const root = makeRoot({
    [`${APPS}/user/Receipts.tsx`]: 'export const R = () => <div className="screen-state-empty">Nothing yet</div>;',
    [`${APPS}/org-admin/Jobs.tsx`]: 'export const J = () => <p>Something went wrong at our end.</p>;',
  });
  expect(handRolledStates(root)).toEqual([
    'dashboards/src/apps/org-admin/Jobs.tsx: the copy "Something went wrong at our end."',
    'dashboards/src/apps/user/Receipts.tsx: a screen-state class',
  ]);
});

test('each of the six is caught, one probe file per state', () => {
  // One file per state, written out by hand. A loop over the six would shrink
  // with the list it is meant to pin.
  const root = makeRoot({
    [`${APPS}/user/Empty.tsx`]: 'export const A = () => <div className="screen-state screen-state-empty" />;',
    [`${APPS}/user/Loading.tsx`]: 'export const B = () => <div className="screen-state-loading" />;',
    [`${APPS}/user/Error.tsx`]: 'export const C = () => <p>Something went wrong at our end.</p>;',
    [`${APPS}/user/Paused.tsx`]: 'export const D = () => <p>This office is paused.</p>;',
    [`${APPS}/user/NotYours.tsx`]: 'export const E = () => <p>This belongs to Ada.</p>;',
    [`${APPS}/user/Closed.tsx`]: 'export const F = () => <p>This expired.</p>;',
  });
  const hit = (file: string) => handRolledStates(root).some((f) => f.startsWith(`${APPS}/user/${file}:`));
  expect(hit('Empty.tsx'), 'empty').toBe(true);
  expect(hit('Loading.tsx'), 'loading').toBe(true);
  expect(hit('Error.tsx'), 'error').toBe(true);
  expect(hit('Paused.tsx'), 'paused').toBe(true);
  expect(hit('NotYours.tsx'), 'not yours').toBe(true);
  expect(hit('Closed.tsx'), 'closed').toBe(true);
});

test('a screen that uses the shared component is not a finding', () => {
  const root = makeRoot({
    [`${APPS}/user/Receipts.tsx`]: [
      "import { Screen } from '../../shared/layout/Screen';",
      'export const R = ({ row }) => <Screen row={row} state={{ kind: "empty", appears: "a", fills: "b" }} />;',
    ].join('\n'),
    [`${APPS}/user/main.tsx`]: "import { RoleRoutes } from '../../shared/layout/RoleRoutes';",
  });
  expect(handRolledStates(root)).toEqual([]);
});

test('a test file may build a state on purpose', () => {
  const root = makeRoot({
    [`${APPS}/user/Receipts.test.tsx`]: 'render(<div className="screen-state-empty">This office is paused.</div>);',
    [`${APPS}/user/__tests__/helper.ts`]: "export const copy = 'This office is paused.';",
  });
  expect(handRolledStates(root)).toEqual([]);
});

test('the probe tree is read at all, so a passing run is not an empty walk', () => {
  const root = makeRoot({ [`${APPS}/user/Plain.tsx`]: 'export const P = () => <p>Receipts</p>;' });
  expect(walkFilesIn(root, APPS, { extensions: CODE }).length).toBe(1);
  expect(handRolledStates(root)).toEqual([]);
});
