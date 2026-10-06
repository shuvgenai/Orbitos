import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join } from 'node:path';
import { afterAll, expect, test } from 'vitest';
import { REPO_ROOT, existsExact, readFileIn, readRepoFile, walkFilesIn } from './lib/walk.ts';

// S-43. Customer screens use the frozen design tokens, name no internal system,
// and show lists where PRD section 15.2 asks for lists.
//
// dashboards/src does not exist yet, so every scan of the real tree passes over
// an empty list. That is by design: the guard is armed before the first
// screen. A scan that cannot fail proves nothing, so each rule is a function
// that is also run against a throwaway tree outside the repo, with a probe file
// for every list entry that only that entry can catch.
//
// A test must never loop over the list it is pinning, because deleting an entry
// then shrinks the test with it. Expected values here are written out by hand.

/** Customer surfaces only. reference/ is read-only history. The fleet app is
 *  exempt under PRD section 15.3: it is an operator surface, and ORBIT-OS,
 *  Paperclip, Hermes, runtime ids and adapter names are correct there.
 *  Fleet-only components live in dashboards/src/apps/fleet, which is why that
 *  path is absent from this list (decision of 2026-10-06). */
const CUSTOMER_DIRS = ['dashboards/src/apps/user', 'dashboards/src/apps/org-admin', 'dashboards/src/shared'];

// Every script flavour, plus markup, styles, SVG and JSON copy. SVG carries hex
// fills directly and JSON carries copy, so leaving them out hid real leaks.
const CODE = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.mts', '.cts', '.css', '.html', '.svg', '.json'];

// Test fixtures may name an internal system on purpose, so they are not screens.
// Skipped: any __tests__ or __fixtures__ directory, and files named *.test.*,
// *.spec.*, *.stories.* or *.story.*. Nothing else is skipped.
const NOT_SCREEN_DIRS = ['__tests__', '__fixtures__'];
const NOT_SCREEN_FILE = /\.(?:test|spec|stories|story)\.[^./]+$/i;

const BANNED = [/ORBIT-OS/, /Paperclip/i, /Hermes/i, /OpenClaw/i, /\bMCP\b/, /\btokens?\b/i, /adapter/i];
const DEAD_PALETTE = ['#6316f9', '#e94bb5', '#f3f2f8', '#1a1a24', '#6b6b7b', '#e2e0eb'];
const CARD_GRID = [
  /grid-template-columns/,
  /\bgrid-cols-(?:\d|\[)/,
  /\bKpiTile\b/,
  // The class name "kpi" inside any string literal: double, single or template
  // quotes, cn(...) arguments, class="kpi" in html.
  /['"`][^'"`\n]*\bkpi\b/,
  // A .kpi selector in a stylesheet. Needs a separator before the dot so that a
  // property access like summary.kpi is not flagged.
  /(?:^|[\s,>+~}])\.kpi\b/m,
];

// Colour literals. The tokens are the whole palette, so any literal is a leak.
// Three rules, each global so every match is reported.
//  HEX: 3 to 8 digits. Not after href=" or url(, which are anchors and gradient
//       ids such as #add, not colours. Not excluded after a bare =", because
//       fill="#fff" on an SVG is exactly the leak this rule is for.
//  FUNC: colour functions.
//  NAMED: a colour property set to a bare word such as red. transparent,
//       currentColor and the CSS-wide keywords stay allowed. var(...) is not a
//       bare word, so it never matches.
const COLOUR = [
  /(?<!href=["']|url\()#[0-9a-fA-F]{3,8}\b/g,
  /\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch)\(/g,
  /\b(?:color|background(?:-color)?|border(?:-(?:top|right|bottom|left))?-color|outline-color)\s*:\s*["']?(?!(?:transparent|currentcolor|inherit|initial|unset|revert|none)\b)[a-z]+(?=["';}\s]|$)|\b(?:fill|stroke)\s*[:=]\s*["']?(?!(?:transparent|currentcolor|inherit|initial|unset|revert|none)\b)[a-z]+(?=["';}\s]|$)/gi,
];

const customerFiles = (root: string) =>
  CUSTOMER_DIRS.flatMap((d) =>
    [...walkFilesIn(root, d, { extensions: CODE, skipAnywhere: NOT_SCREEN_DIRS })].filter(
      (f) => !NOT_SCREEN_FILE.test(basename(f)),
    ),
  );

/** Each finding is "file: rule", so a failure names both. */
function scan(root: string, rules: readonly RegExp[]): string[] {
  const out: string[] = [];
  for (const file of customerFiles(root)) {
    const text = readFileIn(root, file);
    for (const rule of rules) if (rule.test(text)) out.push(`${file}: ${String(rule)}`);
  }
  return out;
}

/** Internal system names on a customer screen. */
export const bannedWords = (root: string) => scan(root, BANNED);

/** Card-grid patterns where section 15.2 requires a plain list. */
export const cardGrids = (root: string) => scan(root, CARD_GRID);

/** Every literal colour, reported as "file: matched text". */
export function colourLiterals(root: string): string[] {
  const out: string[] = [];
  for (const file of customerFiles(root)) {
    const text = readFileIn(root, file);
    for (const rule of COLOUR) for (const m of text.matchAll(rule)) out.push(`${file}: ${m[0]}`);
  }
  return out;
}

/** The old prototype palette, matched case-insensitively. */
export function deadPalette(root: string): string[] {
  const out: string[] = [];
  for (const file of customerFiles(root)) {
    const text = readFileIn(root, file).toLowerCase();
    for (const hex of DEAD_PALETTE) if (text.includes(hex)) out.push(`${file}: ${hex}`);
  }
  return out;
}

test('no customer screen names an internal system', () => {
  expect(bannedWords(REPO_ROOT)).toEqual([]);
});

test('no customer screen introduces a colour outside the token set', () => {
  expect(colourLiterals(REPO_ROOT)).toEqual([]);
});

test('the prototype palette never reappears', () => {
  expect(deadPalette(REPO_ROOT)).toEqual([]);
});

test('no customer screen builds a card grid where section 15.2 requires a list', () => {
  expect(cardGrids(REPO_ROOT)).toEqual([]);
});

// PRD section 15.3. Customer titles say Orbitcrew and NEVER ORBIT-OS. The fleet
// title keeps ORBIT-OS. The entry files sit outside CUSTOMER_DIRS, so the
// banned-word scan never reads them: the title rule below is the only thing
// that keeps the internal name out of a customer title.
const INTERNAL_NAME_IN_TITLE = /<title>[^<]*orbit[-\s]?os/i;
const ENTRIES = [
  ['dashboards/user/index.html', /<title>[^<]*Orbitcrew/, INTERNAL_NAME_IN_TITLE],
  ['dashboards/org-admin/index.html', /<title>[^<]*Orbitcrew/, INTERNAL_NAME_IN_TITLE],
  ['dashboards/fleet/index.html', /<title>[^<]*ORBIT-OS/, undefined],
] as const;

/**
 * Title problems for the three entry files. `read` returns a file's text, or
 * undefined when it does not exist. Taking a function lets the probe tests below
 * run the rule without touching the repo.
 *
 * Before Stream A writes a screen there is nothing to require. After, every
 * entry file must exist.
 */
export function entryProblems(screensExist: boolean, read: (file: string) => string | undefined): string[] {
  const out: string[] = [];
  for (const [file, want, forbid] of ENTRIES) {
    const text = read(file);
    if (text === undefined) {
      if (screensExist) out.push(`${file}: missing`);
    } else if (!want.test(text)) {
      out.push(`${file}: wrong title`);
    } else if (forbid?.test(text)) {
      out.push(`${file}: internal name in title`);
    }
  }
  return out;
}

/**
 * The only thing that arms the entry-file tripwire. A screen exists when a .tsx
 * file sits under dashboards/src/apps. Shared components, stories and tests do
 * not count, so the first foundation component does not demand entry files that
 * may legitimately arrive later in the phase. Founder may change this.
 */
export const screensExist = (root: string) =>
  walkFilesIn(root, 'dashboards/src/apps', { extensions: ['.tsx'] }).length > 0;

/** The tripwire: entry files are required once a screen exists under root. */
export const tripwireProblems = (root: string, read: (file: string) => string | undefined) =>
  entryProblems(screensExist(root), read);

const readEntry = (file: string) => (existsExact(file) ? readRepoFile(file) : undefined);
const entriesPresent = () => ENTRIES.filter(([f]) => existsExact(f));

// How the skip is made visible. `console.warn` does NOT work: vitest 5 swallows
// console output from a passing test, verified by probe on 2026-10-06, so a
// warn-based skip is the silent forever-green test it was meant to prevent.
// `skipIf` works because vitest prints a skipped count in the run summary, so
// every run says so and keeps saying so. The tripwire test further down is the
// other half: skipIf gives visibility, the tripwire gives the guarantee.
test.skipIf(entriesPresent().length === 0)(
  'the User and Org Admin titles say Orbitcrew, and the fleet title keeps ORBIT-OS',
  () => {
    expect(entryProblems(false, readEntry)).toEqual([]);
  },
);

test('a dashboard entry file cannot go missing once Stream A has screens', () => {
  // Always runs, so the skip above can never become permanent.
  expect(tripwireProblems(REPO_ROOT, readEntry), 'Stream A has screens but entry files are wrong or missing').toEqual([]);
});

test.skipIf(!existsExact('dashboards/fleet/index.html'))(
  'the fleet console is exempt, and the exemption is on its title',
  () => {
    // Scoped to the title rather than "some fleet file mentions ORBIT-OS", which
    // a stray comment would satisfy. Kept although the entry test covers it: it
    // names the exemption in one place.
    expect(readRepoFile('dashboards/fleet/index.html')).toMatch(/<title>[^<]*ORBIT-OS/);
  },
);

// ---- Probes. A throwaway tree outside the repo, never inside it. ----

const roots: string[] = [];
afterAll(() => roots.forEach((r) => rmSync(r, { recursive: true, force: true })));

/** A temp tree built from { relative path: body }. */
function makeRoot(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), 'orbit-design-'));
  roots.push(root);
  for (const [rel, body] of Object.entries(files)) {
    const abs = join(root, rel);
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, body);
  }
  return root;
}

const USER = 'dashboards/src/apps/user';
const files: Record<string, string> = {};
const put = (rel: string, body: string) => {
  files[rel] = body;
};

// One probe per BANNED entry, written out by hand and keyed by the rule's text.
// Each body trips its own rule and no other. Do not generate these from BANNED:
// a probe derived from the list would follow the list when an entry is dropped.
// The token rule has two probes, one singular and one plural, so narrowing it to
// either form fails.
const WORD_PROBES: Record<string, string[]> = {
  '/ORBIT-OS/': ['Welcome to ORBIT-OS'],
  '/Paperclip/i': ['powered by PAPERCLIP'],
  '/Hermes/i': ['ask hermes'],
  '/OpenClaw/i': ['an openclaw agent'],
  '/\\bMCP\\b/': ['connect an MCP server'],
  '/\\btokens?\\b/i': ['paste your Token here', 'your API tokens'],
  '/adapter/i': ['pick an Adapter'],
};
const wordFile = (i: number, j: number) => `${USER}/words/w${i}_${j}.tsx`;
Object.values(WORD_PROBES).forEach((bodies, i) => bodies.forEach((b, j) => put(wordFile(i, j), b)));

// One probe per DEAD_PALETTE entry. The first is upper case to prove the match
// ignores case.
const PALETTE_PROBES: Record<string, string> = {
  '#6316f9': 'a { color: #6316F9 }',
  '#e94bb5': 'a { color: #e94bb5 }',
  '#f3f2f8': 'a { color: #f3f2f8 }',
  '#1a1a24': 'a { color: #1a1a24 }',
  '#6b6b7b': 'a { color: #6b6b7b }',
  '#e2e0eb': 'a { color: #e2e0eb }',
};
Object.values(PALETTE_PROBES).forEach((b, i) => put(`${USER}/palette/p${i}.css`, b));

// One or more probes per CARD_GRID entry. The kpi string rule has one probe per
// way of writing a class: double, single, template, cn(...) and html class=.
const GRID_PROBES: Record<string, string[]> = {
  '/grid-template-columns/': ['.row { grid-template-columns: 1fr 1fr; }'],
  '/\\bgrid-cols-(?:\\d|\\[)/': [
    'export const A = () => <div className="grid grid-cols-3" />;',
    'export const A = () => <div className="grid grid-cols-[repeat(3,1fr)]" />;',
  ],
  '/\\bKpiTile\\b/': ['export const B = () => <KpiTile />;'],
  "/['\"`][^'\"`\\n]*\\bkpi\\b/": [
    'export const C = () => <div className="card kpi" />;',
    "export const C = () => <div className='kpi' />;",
    'export const C = (x: string) => `tile ${x} kpi`;',
    "export const C = () => cn('card', 'kpi');",
    '<div class="kpi"></div>',
  ],
  '/(?:^|[\\s,>+~}])\\.kpi\\b/m': ['.kpi { padding: 0 }', '.row > .kpi { padding: 0 }'],
};
const gridFile = (i: number, j: number) => `${USER}/grids/g${i}_${j}.tsx`;
Object.values(GRID_PROBES).forEach((bodies, i) => bodies.forEach((b, j) => put(gridFile(i, j), b)));

// Colour probes: [file, body, exactly what must be reported]. One per hex length
// from 3 to 8, one per colour function, and one per property form of a named
// colour. Written out, not generated.
const COLOUR_PROBES: [string, string, string][] = [
  ['hex3.css', 'a { color: #fff }', '#fff'],
  ['hex4.css', 'a { color: #abcd }', '#abcd'],
  ['hex5.css', 'a { color: #abcde }', '#abcde'],
  ['hex6.css', 'a { color: #123456 }', '#123456'],
  ['hex7.css', 'a { color: #abcdef0 }', '#abcdef0'],
  ['hex8.css', 'a { color: #00000080 }', '#00000080'],
  ['svg-fill.svg', '<rect fill="#fff" />', '#fff'],
  ['rgb.css', 'a { color: rgb(0, 0, 0) }', 'rgb('],
  ['rgba.css', 'a { color: rgba(0, 0, 0, 0.5) }', 'rgba('],
  ['hsl.css', 'a { color: hsl(0 0% 0%) }', 'hsl('],
  ['hsla.css', 'a { color: hsla(0 0% 0% / 0.5) }', 'hsla('],
  ['hwb.css', 'a { color: hwb(0 0% 0%) }', 'hwb('],
  ['lab.css', 'a { color: lab(50% 0 0) }', 'lab('],
  ['lch.css', 'a { color: lch(50% 0 0) }', 'lch('],
  ['oklab.css', 'a { color: oklab(50% 0 0) }', 'oklab('],
  ['oklch.css', 'a { color: oklch(50% 0 0) }', 'oklch('],
  ['named-color.css', 'a { color: red }', 'color: red'],
  ['named-background.css', 'a { background: navy }', 'background: navy'],
  ['named-background-color.css', 'a { background-color: navy }', 'background-color: navy'],
  ['named-border-color.css', 'a { border-color: teal }', 'border-color: teal'],
  ['named-border-top-color.css', 'a { border-top-color: teal }', 'border-top-color: teal'],
  ['named-outline-color.css', 'a { outline-color: teal }', 'outline-color: teal'],
  ['named-uppercase.css', 'a { COLOR: Red }', 'COLOR: Red'],
  ['named-fill.svg', '<rect fill="red" />', 'fill="red'],
  ['named-stroke.svg', '<rect stroke="blue" />', 'stroke="blue'],
];
COLOUR_PROBES.forEach(([f, b]) => put(`${USER}/colours/${f}`, b));

// Allowed forms. Together they pin the allow-list: removing any keyword, or
// excluding too little around an anchor, flags this file. Anchors and gradient
// ids look like hex (#add, #bed) and are not colours.
put(
  `${USER}/clean/Allowed.css`,
  [
    'a { color: var(--color-ink); background: transparent; border-color: currentColor; }',
    'a { color: inherit; background: initial; outline-color: unset; border-top-color: revert; background: none; }',
    'a { background-color: var(--color-canvas); }',
  ].join('\n'),
);
put(
  `${USER}/clean/Allowed.tsx`,
  'export const Ok = () => <><a href="#add">add</a><a href=\'#bed\'>bed</a><rect fill="url(#bed)" stroke="none" /><rect fill="none" /><p>Your Orbitcrew office. McpX.</p></>;',
);

// One probe per CODE extension, written out. Each body trips the banned-word
// rule, so a dropped extension leaves that file unreported. Note that '.mts'
// also ends with '.ts', so each extension is probed by its own file name.
const EXT_PROBES = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.mts', '.cts', '.css', '.html', '.svg', '.json'];
EXT_PROBES.forEach((ext) => put(`dashboards/src/apps/org-admin/ext/probe${ext}`, 'Hermes'));

// One probe per customer directory.
put(`${USER}/Contest.tsx`, 'Hermes');
put('dashboards/src/apps/org-admin/Leak.tsx', 'Hermes');
put('dashboards/src/shared/Leak.tsx', 'Hermes');

// Left alone: other file types, the fleet app, and test fixtures. Contest.tsx
// above ends in "test" but is not a *.test.* file, so it is still scanned.
put('dashboards/src/apps/org-admin/notes.md', 'Hermes #6316f9 grid-cols-3');
put('dashboards/src/apps/fleet/Console.tsx', 'ORBIT-OS Paperclip Hermes OpenClaw MCP token adapter #6316f9 grid-cols-3 KpiTile');
put('dashboards/src/apps/fleet/console.css', '.x { grid-template-columns: 1fr 1fr; color: rgb(0,0,0); }');
put(`${USER}/__tests__/Leak.tsx`, 'Hermes');
put(`${USER}/__fixtures__/leak.json`, '{"a":"Hermes"}');
put(`${USER}/Screen.test.tsx`, 'Hermes');
put(`${USER}/Screen.spec.ts`, 'Hermes');
put('dashboards/src/shared/Button.stories.tsx', 'Hermes #6316f9');
put('dashboards/src/shared/Button.story.tsx', 'Hermes');

const PROBE = makeRoot(files);
const sorted = (xs: string[]) => [...xs].sort();

test('the banned-word rule catches each word with its own probe, and only that word', () => {
  const expected = Object.keys(WORD_PROBES).flatMap((rule, i) =>
    (WORD_PROBES[rule] as string[]).map((_, j) => `${wordFile(i, j)}: ${rule}`),
  );
  const found = bannedWords(PROBE).filter((f) => f.startsWith(`${USER}/words/`));
  expect(sorted(found)).toEqual(sorted(expected));
});

test('every BANNED word has a probe, so dropping or adding one cannot pass unnoticed', () => {
  // Guards the test above. The probes are keyed by the rule's own text.
  expect(sorted(BANNED.map(String))).toEqual(sorted(Object.keys(WORD_PROBES)));
});

test('the dead-palette rule catches each hex with its own probe, and only that hex', () => {
  const expected = Object.keys(PALETTE_PROBES).map((hex, i) => `${USER}/palette/p${i}.css: ${hex}`);
  const found = deadPalette(PROBE).filter((f) => f.startsWith(`${USER}/palette/`));
  expect(sorted(found)).toEqual(sorted(expected));
});

test('every DEAD_PALETTE hex has a probe', () => {
  expect(sorted(DEAD_PALETTE)).toEqual(sorted(Object.keys(PALETTE_PROBES)));
});

test('the card-grid rule catches each pattern with its own probe, and only that pattern', () => {
  const expected = Object.keys(GRID_PROBES).flatMap((rule, i) =>
    (GRID_PROBES[rule] as string[]).map((_, j) => `${gridFile(i, j)}: ${rule}`),
  );
  expect(sorted(cardGrids(PROBE).filter((f) => f.startsWith(`${USER}/grids/`)))).toEqual(sorted(expected));
});

test('every CARD_GRID pattern has a probe', () => {
  expect(sorted(CARD_GRID.map(String))).toEqual(sorted(Object.keys(GRID_PROBES)));
});

test('the colour rule catches each hex length, colour function, named colour and SVG fill', () => {
  const found = colourLiterals(PROBE).filter((f) => f.startsWith(`${USER}/colours/`));
  expect(sorted(found)).toEqual(sorted(COLOUR_PROBES.map(([f, , hit]) => `${USER}/colours/${f}: ${hit}`)));
});

test('the colour rule allows var(), transparent, currentColor, keywords, anchors and gradient ids', () => {
  expect(colourLiterals(PROBE).filter((f) => f.includes('/clean/'))).toEqual([]);
});

test('every code extension is scanned', () => {
  const hits = bannedWords(PROBE);
  for (const ext of EXT_PROBES) {
    expect(
      hits.some((h) => h.startsWith(`dashboards/src/apps/org-admin/ext/probe${ext}:`)),
      `${ext} files are not scanned`,
    ).toBe(true);
  }
});

test('every CODE extension has a probe, so adding one cannot pass unnoticed', () => {
  expect(sorted(CODE)).toEqual(sorted(EXT_PROBES));
});

test('every customer directory is scanned', () => {
  const hits = bannedWords(PROBE);
  const hit = (file: string) => hits.some((h) => h.startsWith(`${file}:`));
  expect(hit(`${USER}/Contest.tsx`), 'dashboards/src/apps/user is not scanned').toBe(true);
  expect(hit('dashboards/src/apps/org-admin/Leak.tsx'), 'dashboards/src/apps/org-admin is not scanned').toBe(true);
  expect(hit('dashboards/src/shared/Leak.tsx'), 'dashboards/src/shared is not scanned').toBe(true);
});

test('the fleet app, other file types, test fixtures and clean files are left alone', () => {
  const everything = [...bannedWords(PROBE), ...cardGrids(PROBE), ...colourLiterals(PROBE), ...deadPalette(PROBE)];
  expect(everything.filter((f) => f.includes('/apps/fleet/'))).toEqual([]);
  expect(everything.filter((f) => f.includes('notes.md'))).toEqual([]);
  expect(everything.filter((f) => f.includes('/__tests__/') || f.includes('/__fixtures__/'))).toEqual([]);
  expect(everything.filter((f) => /\.(?:test|spec|stories|story)\./.test(f))).toEqual([]);
  expect(everything.filter((f) => f.includes('/clean/'))).toEqual([]);
});

const CUSTOMER_ENTRIES = ['dashboards/user/index.html', 'dashboards/org-admin/index.html'];
const FLEET_ENTRY = 'dashboards/fleet/index.html';
const goodTitle = (file: string) =>
  file === FLEET_ENTRY ? '<title>ORBIT-OS fleet</title>' : '<title>Orbitcrew</title>';

test('the entry list names exactly the three PRD section 15.3 files', () => {
  // Written out and compared both ways. The tests below take their paths from
  // here, never from ENTRIES, so a deleted row fails this test and theirs.
  expect(ENTRIES.map(([f]) => f)).toEqual([...CUSTOMER_ENTRIES, FLEET_ENTRY]);
});

test('the entry-title rule flags a wrong title on each entry, and only that entry', () => {
  expect(entryProblems(true, goodTitle)).toEqual([]);
  for (const bad of [...CUSTOMER_ENTRIES, FLEET_ENTRY]) {
    const wrong = (file: string) => (file === bad ? '<title>Something else</title>' : goodTitle(file));
    expect(entryProblems(true, wrong), bad).toEqual([`${bad}: wrong title`]);
  }
});

test('a customer title may never carry the internal name, even beside Orbitcrew', () => {
  for (const customer of CUSTOMER_ENTRIES) {
    for (const title of ['Orbitcrew by ORBIT-OS', 'Orbitcrew | Orbit OS', 'Orbitcrew orbit-os']) {
      const leaked = (file: string) => (file === customer ? `<title>${title}</title>` : goodTitle(file));
      expect(entryProblems(true, leaked), `${customer}: ${title}`).toEqual([`${customer}: internal name in title`]);
    }
  }
  // The fleet title is the opposite: it must keep the name.
  const fleetLoses = (file: string) => (file === FLEET_ENTRY ? '<title>Fleet</title>' : goodTitle(file));
  expect(entryProblems(true, fleetLoses)).toEqual([`${FLEET_ENTRY}: wrong title`]);
});

test('the entry tripwire fails on a missing file only once screens exist', () => {
  const none = () => undefined;
  expect(entryProblems(false, none)).toEqual([]);
  expect(entryProblems(true, none)).toEqual([
    'dashboards/user/index.html: missing',
    'dashboards/org-admin/index.html: missing',
    'dashboards/fleet/index.html: missing',
  ]);
});

test('the tripwire gate is armed by a screen under apps, and by nothing else', () => {
  // The gate is the only thing that arms the tripwire. A typo in its path or an
  // emptied extension list would disarm it silently, so it is probed both ways.
  expect(screensExist(makeRoot({}))).toBe(false);
  expect(screensExist(makeRoot({ 'dashboards/src/apps/user/Home.tsx': 'x' }))).toBe(true);
  expect(screensExist(makeRoot({ 'dashboards/src/apps/org-admin/deep/er/Page.tsx': 'x' }))).toBe(true);
  expect(screensExist(makeRoot({ 'dashboards/src/apps/fleet/Table.tsx': 'x' }))).toBe(true);
  // Foundation code is not a screen.
  expect(screensExist(makeRoot({ 'dashboards/src/shared/Button.tsx': 'x' }))).toBe(false);
  expect(screensExist(makeRoot({ 'dashboards/src/apps/user/helper.ts': 'x' }))).toBe(false);
  expect(screensExist(makeRoot({ 'dashboards/src/other/Home.tsx': 'x' }))).toBe(false);
});

test('the tripwire wires the gate to the rule, so the real-tree test can fail once screens exist', () => {
  // The real tree has no screens yet, so only a probe can show the gate and the
  // rule are connected.
  const withScreen = makeRoot({ 'dashboards/src/apps/user/Home.tsx': 'x' });
  const withoutScreen = makeRoot({ 'dashboards/src/shared/Button.tsx': 'x' });
  const none = () => undefined;
  expect(tripwireProblems(withScreen, none)).toEqual([
    'dashboards/user/index.html: missing',
    'dashboards/org-admin/index.html: missing',
    'dashboards/fleet/index.html: missing',
  ]);
  expect(tripwireProblems(withoutScreen, none)).toEqual([]);
  expect(tripwireProblems(withScreen, goodTitle)).toEqual([]);
});
