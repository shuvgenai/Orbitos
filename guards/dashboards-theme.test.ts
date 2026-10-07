import { expect, test } from 'vitest';
import { REPO_ROOT, type RootedPath, readFileIn, readRepoFile, walkFilesIn } from './lib/walk.ts';
// The theme is imported, not read as text, so the nesting test below asks the
// object and not the file's character offsets. Note the coupling this creates:
// an imported file joins the root tsconfig's program, so tailwind.config.ts is
// now typechecked by the root project as well as the dashboards one. It passes
// under both today because it holds no DOM and no JSX. A config that reaches for
// `document` would fail under the root project, which is Node-only.
import themeConfig from '../dashboards/tailwind.config.ts';

// The dashboards root is unscanned by S-43, and the Tailwind theme is the worst
// file to leave there: it can put a literal colour into every screen at once.
//
// guards/design-naming.test.ts only walks dashboards/src/apps/user,
// dashboards/src/apps/org-admin and dashboards/src/shared. Nothing sitting at
// the dashboards root is inside any of the three, so a hex written in
// tailwind.config.ts or in any config beside it would reach every class the
// theme generates and no existing guard would see it. That gap is what this
// file closes.
//
// What it covers now:
//   - the six colours of section 15.1, each a var() reference and not a value
//   - the theme carrying no hex, no colour function and no CSS named colour,
//     on any key, including a seventh one nobody has pinned
//   - the palette replacing Tailwind's defaults rather than extending them
//   - every other config at the dashboards root, swept for the same colours,
//     with the sweep itself pinned so it cannot pass on an empty list
//   - the screen-state classes: every class ScreenState.tsx uses is styled in
//     theme.css or is a recorded hook, and every recorded hook is really used
//   - the one stylesheet: app.css loads the frozen values before the theme,
//     states no value of its own, and is imported once by each entry
//
// It says nothing about whether a screen looks right, and it cannot: the
// screens are shells.

const THEME = 'dashboards/tailwind.config.ts';
const STYLES = 'dashboards/src/shared/styles/theme.css';
const COMPONENT = 'dashboards/src/shared/states/ScreenState.tsx';
const APP_CSS = 'dashboards/src/shared/styles/app.css';
const FROZEN = 'design/tokens.css';

/** The three app entries. Written out, because a role added here is deliberate. */
const ENTRIES = [
  'dashboards/src/apps/user/main.tsx',
  'dashboards/src/apps/org-admin/main.tsx',
  'dashboards/src/apps/fleet/main.tsx',
] as const;

/** A hex, or a colour function call. Named colours are a separate rule below. */
const LITERAL_COLOUR = /#[0-9a-f]{3,8}\b|\b(?:rgba?|hsla?|color-mix|oklch|lab)\(/i;

const S43 = 'guards/design-naming.test.ts';

/**
 * The CSS named colours, read out of the S-43 guard as text.
 *
 * Importing its `NAMED_COLOURS` export would be shorter and is wrong here: that
 * file calls `test()` at module scope, so importing it registers all 37 of its
 * tests a second time inside this file. Measured on 2026-10-07: `pnpm test:unit`
 * went from 341 tests to 378 and S-43 ran twice per build.
 *
 * Parsing keeps one source of truth without executing the module, and without
 * editing a guard that is final at round 3. The parse is pinned by the test
 * below, so a change to how S-43 declares the list fails loudly here instead of
 * quietly producing an empty list and a guard that matches nothing.
 */
function namedColours(): string[] {
  const src = readRepoFile(S43);
  const declaration = /NAMED_COLOURS = \(([\s\S]*?)\)\s*\.split\(' '\)/.exec(src);
  if (declaration === null) return [];
  // The literal is several quoted chunks joined by +. Take the quoted text only.
  const chunks = [...(declaration[1] as string).matchAll(/'([^']*)'/g)].map((m) => m[1] as string);
  return chunks.join('').split(' ').filter(Boolean);
}

/**
 * A quoted string whose whole contents are a CSS named colour, so `accent: 'red'`
 * is caught.
 *
 * It has to be the whole quoted value, not any occurrence of the word. The theme
 * mentions `bg-red-500` in a comment to explain what replacing the palette
 * prevents, and a bare /red/ would fire on that and teach the next reader that
 * the guard cries wolf. `transparent` and `currentColor` are absent from the
 * list, which section 15.1 allows, and `'none'` and `'0'` are not colours.
 */
const NAMED_COLOUR_VALUE = new RegExp(`'(?:${namedColours().join('|')})'`, 'i');

test('the named-colour list really parsed, so the rule above cannot match nothing', () => {
  const list = namedColours();
  // Written out by hand, not sampled from the list itself.
  expect(list.length, 'the S-43 list should hold well over a hundred colours').toBeGreaterThan(100);
  expect(list).toContain('red');
  expect(list).toContain('rebeccapurple');
  expect(list).toContain('yellowgreen');
  // The two section 15.1 keeps legal must NOT be in it, or the theme fails on itself.
  expect(list).not.toContain('transparent');
  expect(list).not.toContain('currentColor');
});

// The six of PRD section 15.1, one assertion each, written out by hand.
//
// An earlier version looped an array of the six names. That read as tidier and
// was weaker: deleting an entry from the array deleted its assertion with it, and
// the test passed on five. guards/design-naming.test.ts states the rule and this
// file now obeys it. Never loop the list you are pinning.
test('each of the six colours is a reference into the frozen values, not a value', () => {
  const src = readRepoFile(THEME);
  // Exact strings, not patterns: each has to read this and nothing like it.
  expect(src, 'ink must read var(--color-ink)').toContain("ink: 'var(--color-ink)',");
  expect(src, 'paper must read var(--color-paper)').toContain("paper: 'var(--color-paper)',");
  expect(src, 'canvas must read var(--color-canvas)').toContain("canvas: 'var(--color-canvas)',");
  expect(src, 'muted must read var(--color-muted)').toContain("muted: 'var(--color-muted)',");
  expect(src, 'line must read var(--color-line)').toContain("line: 'var(--color-line)',");
  expect(src, 'danger must read var(--color-danger)').toContain("danger: 'var(--color-danger)',");
});

test('the theme writes no hex and no colour function, including in its comments', () => {
  expect(readRepoFile(THEME)).not.toMatch(LITERAL_COLOUR);
});

// The gap this closes: the six are pinned one by one above, so a named colour on
// one of them fails there. A SEVENTH key is what slipped through. `accent: 'red'`
// was caught by nothing: not by the assertions above, which name only the six,
// and not by S-43, which never walks the dashboards root.
test('the theme writes no named colour, on any key, including a new one', () => {
  expect(readRepoFile(THEME)).not.toMatch(NAMED_COLOUR_VALUE);
});

// Asked of the object, not the file's text.
//
// This used to compare `indexOf('colors: {')` against `indexOf('extend: {')`,
// which only proved one string appeared earlier in the file than the other. It
// passed on a `colors` written inside a comment, and it never showed that
// `colors` was a direct child of `theme`. The object answers both outright.
test('the palette is replaced, not extended, so no seventh colour has a class', () => {
  const theme = themeConfig.theme;
  const colours = theme?.colors;
  expect(colours, 'theme.colors must be set directly, not under extend').toBeDefined();

  // Exactly the six, plus the two keywords section 15.1 allows. Written out, and
  // compared as a whole, so an added or dropped key fails here.
  //
  // Object.keys takes `colours` with no cast, and that is deliberate.
  // tailwind.config.ts ends in `satisfies Config`, so theme.colors keeps its own
  // literal type and the eight keys are known here. Annotate the config
  // `: Config` instead and theme.colors widens to Tailwind's ResolvableTo
  // union, which Object.keys refuses, and the typecheck says so. A
  // `as Record<string, unknown>` would silence exactly that warning: a theme
  // written as a function has no keys, Object.keys returns [], and the failure
  // arrives as a puzzling empty-array mismatch instead.
  expect(Object.keys(colours).sort()).toEqual([
    'canvas',
    'current',
    'danger',
    'ink',
    'line',
    'muted',
    'paper',
    'transparent',
  ]);

  // The real defect being guarded: with colours under extend, Tailwind keeps its
  // own palette and bg-red-500 stays reachable on every screen.
  //
  // This Record cast is load-bearing, unlike the absent one above. The literal
  // type of theme.extend today is { minHeight, minWidth }, so `extend.colors`
  // is a property TypeScript knows is not there, and reading it is an error
  // rather than `undefined`. The cast is what lets the test ask about a key that
  // must stay absent. `| undefined` is kept for the day extend is deleted
  // outright, which the assertion on the next line is here to catch.
  const extend = theme?.extend as Record<string, unknown> | undefined;
  expect(extend, 'extend must still exist, it carries the 44 px target').toBeDefined();
  expect(extend?.['colors'], 'colours must never sit under theme.extend').toBeUndefined();
});

/**
 * Classes that mark a state in the markup and carry no rule of their own yet.
 * Each is a hook a later screen can style.
 *
 * At module scope so the two tests below read the same four. While this sat
 * inside the first test, the second test re-listed them by hand in a scope that
 * could not see it, and a fifth hook would have been added to one list and gone
 * unchecked by the other.
 */
const HOOKS = ['screen-state-empty', 'screen-state-loading', 'screen-state-not-yours', 'screen-state-closed'];

const classesIn = (file: string) => new Set([...readRepoFile(file).matchAll(/\bscreen-state[\w-]*/g)].map((m) => m[0]));

test('no screen-state class is used by the component but left unstyled', () => {
  const used = classesIn(COMPONENT);
  const styled = new Set([...readRepoFile(STYLES).matchAll(/\.(screen-state[\w-]*)/g)].map((m) => m[1] as string));
  const unstyled = [...used].filter((c) => !styled.has(c) && !HOOKS.includes(c)).sort();
  expect(unstyled, 'a class in ScreenState.tsx with no rule and no recorded reason').toEqual([]);
});

// Each hook asserted by hand against HOOKS, not by looping it. A loop here would
// shrink with the list and let a stale entry survive, which is the same mistake
// the six colours above used to make.
test('every hook is really used by the component, so the list cannot rot', () => {
  const used = classesIn(COMPONENT);
  expect(HOOKS, 'HOOKS must hold exactly these four').toEqual([
    'screen-state-empty',
    'screen-state-loading',
    'screen-state-not-yours',
    'screen-state-closed',
  ]);
  expect(used.has('screen-state-empty'), 'screen-state-empty is unused').toBe(true);
  expect(used.has('screen-state-loading'), 'screen-state-loading is unused').toBe(true);
  expect(used.has('screen-state-not-yours'), 'screen-state-not-yours is unused').toBe(true);
  expect(used.has('screen-state-closed'), 'screen-state-closed is unused').toBe(true);
});

/**
 * Every config file directly at the dashboards root.
 *
 * Naming tailwind.config.ts alone left the gap half closed. S-43 walks only
 * dashboards/src/apps/user, dashboards/src/apps/org-admin and
 * dashboards/src/shared, so EVERY file at that root is unscanned, not just the
 * one this guard happened to name. postcss.config.js was already sitting there.
 *
 * Depth one only. A config nested under src is inside S-43's reach, and
 * guards/contract-boundary.test.ts already allows nothing but *.config.* up here.
 */
function rootConfigs(): readonly RootedPath[] {
  return walkFilesIn(REPO_ROOT, 'dashboards', { extensions: ['.ts', '.js', '.mjs', '.cjs', '.mts', '.cts'] })
    .filter((f) => f.slice('dashboards/'.length).includes('/') === false)
    .filter((f) => /\.config\.[cm]?[jt]s$/.test(f));
}

test('the sweep finds the dashboards root configs, so it cannot pass on an empty list', () => {
  const found = rootConfigs();
  // Written out by hand. A new root config is added here deliberately.
  expect([...found].sort()).toEqual([
    'dashboards/postcss.config.js',
    'dashboards/tailwind.config.ts',
    'dashboards/vite.config.ts',
  ]);
});

test('no config at the dashboards root writes a literal colour', () => {
  const offenders = rootConfigs()
    .filter((f) => {
      const src = readFileIn(REPO_ROOT, f);
      return LITERAL_COLOUR.test(src) || NAMED_COLOUR_VALUE.test(src);
    })
    .sort();
  expect(offenders, 'a colour here reaches every generated class, unseen by S-43').toEqual([]);
});

// The order inside app.css is a rule, not a preference. Every colour in
// theme.css arrives through @apply on a class whose value is var(--color-x).
// Declare those properties after the rules that read them and they resolve to
// nothing, which paints an unstyled page rather than failing anything.
test('app.css loads the frozen values first, then the theme, and states no value', () => {
  const src = readRepoFile(APP_CSS);
  const frozenAt = src.indexOf(FROZEN);
  const themeAt = src.indexOf('./theme.css');
  expect(frozenAt, 'app.css must import design/tokens.css').toBeGreaterThan(-1);
  expect(themeAt, 'app.css must import theme.css').toBeGreaterThan(-1);
  expect(frozenAt, 'the frozen values must come first or the theme reads nothing').toBeLessThan(themeAt);
  expect(src, 'app.css restates a value instead of referencing one').not.toMatch(LITERAL_COLOUR);
  expect(src).not.toMatch(NAMED_COLOUR_VALUE);
});

// One stylesheet per entry, so the import order lives in one file. An entry
// that reaches past app.css for theme.css gets the theme without the values.
test('each entry imports the one stylesheet, exactly once, and never the theme directly', () => {
  for (const entry of ENTRIES) {
    const src = readRepoFile(entry);
    const hits = [...src.matchAll(/shared\/styles\/app\.css/g)];
    expect(hits.length, `${entry} must import app.css exactly once`).toBe(1);
    expect(src, `${entry} must not import theme.css directly`).not.toContain('styles/theme.css');
    expect(src, `${entry} must not import design/tokens.css directly`).not.toContain(FROZEN);
  }
});

test('the entry list is the three apps, so a fourth cannot be added unnoticed', () => {
  // Written out by hand, never read from the list being pinned.
  expect([...ENTRIES]).toEqual([
    'dashboards/src/apps/user/main.tsx',
    'dashboards/src/apps/org-admin/main.tsx',
    'dashboards/src/apps/fleet/main.tsx',
  ]);
});
