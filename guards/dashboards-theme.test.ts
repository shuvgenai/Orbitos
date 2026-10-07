import { expect, test } from 'vitest';
import { readRepoFile } from './lib/walk.ts';

// The Tailwind theme is the one file that can put a literal colour into every
// screen at once, and S-43 does not scan it.
//
// guards/design-naming.test.ts only walks dashboards/src/apps/user,
// dashboards/src/apps/org-admin and dashboards/src/shared. tailwind.config.ts
// sits at the dashboards root, outside all three, so a hex written there would
// reach every class the theme generates and no existing guard would see it.
// That gap is what this file closes.
//
// It pins the theme and the state stylesheet only. It says nothing about whether
// a screen looks right, and it cannot: no screen exists yet.

const THEME = 'dashboards/tailwind.config.ts';
const STYLES = 'dashboards/src/shared/styles/theme.css';
const COMPONENT = 'dashboards/src/shared/states/ScreenState.tsx';

/** The six of PRD section 15.1, written out so dropping one fails here. */
const SIX = ['ink', 'paper', 'canvas', 'muted', 'line', 'danger'];

/** A hex, an rgb()/hsl() call, or a three-or-more letter colour word in a value. */
const LITERAL_COLOUR = /#[0-9a-f]{3,8}\b|\b(?:rgba?|hsla?|color-mix|oklch|lab)\(/i;

test('each of the six colours is a reference into the frozen values, not a value', () => {
  const src = readRepoFile(THEME);
  for (const name of SIX) {
    // An exact string, not a pattern: it has to read this and nothing like it.
    expect(src, `${name} must read var(--color-${name})`).toContain(`${name}: 'var(--color-${name})',`);
  }
});

test('the theme states no literal colour anywhere, including its comments', () => {
  expect(readRepoFile(THEME)).not.toMatch(LITERAL_COLOUR);
});

test('the theme replaces the default palette instead of extending it', () => {
  const src = readRepoFile(THEME);
  // With `extend`, bg-red-500 stays reachable and the six stop being the whole
  // palette. The colours must sit directly under theme, not under theme.extend.
  const colours = src.indexOf('colors: {');
  const extend = src.indexOf('extend: {');
  expect(colours, 'colors must be present').toBeGreaterThan(-1);
  expect(extend, 'extend must be present').toBeGreaterThan(-1);
  expect(colours, 'colors must sit outside extend').toBeLessThan(extend);
});

test('no screen-state class is used by the component but left unstyled', () => {
  const used = new Set([...readRepoFile(COMPONENT).matchAll(/\bscreen-state[\w-]*/g)].map((m) => m[0]));
  const styled = new Set([...readRepoFile(STYLES).matchAll(/\.(screen-state[\w-]*)/g)].map((m) => m[1] as string));

  // Written out by hand. These four mark a state in the markup and carry no rule
  // of their own yet. Each is a hook a later screen can style; listing them here
  // means adding a fifth is a decision, not an accident.
  const hooks = ['screen-state-empty', 'screen-state-loading', 'screen-state-not-yours', 'screen-state-closed'];

  const unstyled = [...used].filter((c) => !styled.has(c) && !hooks.includes(c)).sort();
  expect(unstyled, 'a class in ScreenState.tsx with no rule and no recorded reason').toEqual([]);
});

test('every hook listed above is really used, so the list cannot rot', () => {
  const used = new Set([...readRepoFile(COMPONENT).matchAll(/\bscreen-state[\w-]*/g)].map((m) => m[0]));
  expect(used.has('screen-state-empty')).toBe(true);
  expect(used.has('screen-state-loading')).toBe(true);
  expect(used.has('screen-state-not-yours')).toBe(true);
  expect(used.has('screen-state-closed')).toBe(true);
});
