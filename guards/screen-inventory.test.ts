import { expect, test } from 'vitest';
import { SCREENS } from '../dashboards/src/shared/nav/screens.ts';
import { readRepoFile } from './lib/walk.ts';

// The 52 screens are PRD sections 15.5 to 15.7, and the PRD is the source.
//
// This parses those three tables out of the document and compares them to the
// data file, so a screen cannot be added, dropped, renamed or re-routed in code
// without the PRD saying so first. A second list written by hand here would
// drift from the document exactly as the data file could, which is why nothing
// below restates a screen name.
//
// Note the coupling the import creates, the same one the Tailwind theme has in
// guards/dashboards-theme.test.ts: screens.ts now joins the root tsconfig's
// program as well as the dashboards one. It passes under both because it is
// data with no DOM and no JSX. A nav file that reached for `document` would
// fail under the root project, which is Node-only.

const PRD = 'docs/prd/ORBIT_OS_PRD_v9_0.md';

type Section = '15.5' | '15.6' | '15.7';
type Row = { screen: string; route: string };

/**
 * The numbered rows of one inventory table.
 *
 * The slice runs from the section heading to the next `### ` heading, so a
 * table row elsewhere in the document cannot be read as a screen. The row
 * shape is "| <n> | <screen> | `<route>` |": a numbered first cell and a
 * backticked third, which the summary tables in section 15.8 do not have.
 * `**` is stripped because the PRD bolds a feature id on some rows.
 */
function prdScreens(section: Section): Row[] {
  const src = readRepoFile(PRD);
  const start = src.indexOf(`### ${section} Screen inventory`);
  if (start < 0) throw new Error(`${PRD} has no "### ${section} Screen inventory" heading`);
  const next = src.indexOf('\n### ', start + 1);
  const body = src.slice(start, next < 0 ? undefined : next);
  return [...body.matchAll(/^\|\s*\d+\s*\|\s*([^|]+?)\s*\|\s*`([^`]+)`\s*\|/gm)].map((m) => ({
    screen: (m[1] as string).replace(/\*\*/g, '').trim(),
    route: m[2] as string,
  }));
}

// Written out by hand, one assertion each, never a loop over a list of counts.
// A parse that silently found nothing would otherwise make every comparison
// below pass over an empty list.
test('the parse finds all three inventory tables, so nothing compares an empty list', () => {
  expect(prdScreens('15.5').length, 'section 15.5 holds 14 User screens').toBe(14);
  expect(prdScreens('15.6').length, 'section 15.6 holds 21 Org Admin screens').toBe(21);
  expect(prdScreens('15.7').length, 'section 15.7 holds 17 fleet screens').toBe(17);
});

test('the parse reads real rows, not just the right number of them', () => {
  // Three anchors, one per table, read from the document and written here by
  // hand. A regex that matched the wrong column would still count 14.
  expect(prdScreens('15.5')[0]).toEqual({ screen: 'Sign in', route: '/signin' });
  expect(prdScreens('15.6')[2]).toEqual({ screen: 'Org chart', route: '/org/chart' });
  expect(prdScreens('15.7')[16]).toEqual({ screen: 'Build checks', route: '/checks' });
});

test('the data file is the PRD, section by section, in the PRD order', () => {
  for (const section of ['15.5', '15.6', '15.7'] as const) {
    const want = prdScreens(section);
    const got = SCREENS.filter((s) => s.section === section).map((s) => ({ screen: s.screen, route: s.route }));
    expect(got, `section ${section} does not match the PRD table`).toEqual(want);
  }
});

test('the three sections are the whole of it: 52 screens, every route distinct', () => {
  expect(SCREENS.length, 'the PRD names 52 screens').toBe(52);
  expect(new Set(SCREENS.map((s) => s.route)).size, 'two screens share a route').toBe(52);
  expect(new Set(SCREENS.map((s) => s.screen)).size, 'two screens share a name').toBe(52);
});

test('every screen says which section it came from, and no fourth section exists', () => {
  const sections = [...new Set(SCREENS.map((s) => s.section))].sort();
  expect(sections).toEqual(['15.5', '15.6', '15.7']);
});
