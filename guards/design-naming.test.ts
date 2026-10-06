import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterAll, expect, test } from 'vitest';
import { REPO_ROOT, existsExact, readFileIn, readRepoFile, walkFilesIn } from './lib/walk.ts';

// S-43. Customer screens use the frozen design tokens, name no internal system,
// and show lists where PRD section 15.2 asks for lists.
//
// dashboards/src does not exist yet, so every scan of the real tree passes over
// an empty list today. That is by design: the guard is armed before the first
// screen. A scan that cannot fail proves nothing, so each rule is a function
// that is also run against a throwaway tree outside the repo, with a probe file
// for every list entry that only that entry can catch.

/** Customer surfaces only. reference/ is read-only history. The fleet app is
 *  exempt under PRD section 15.3: it is an operator surface, and ORBIT-OS,
 *  Paperclip, Hermes, runtime ids and adapter names are correct there.
 *  Fleet-only components live in dashboards/src/apps/fleet, which is why that
 *  path is absent from this list (decision of 2026-10-06). */
const CUSTOMER_DIRS = ['dashboards/src/apps/user', 'dashboards/src/apps/org-admin', 'dashboards/src/shared'];
const CODE = ['.ts', '.tsx', '.css', '.html'] as const;
const BANNED = [/ORBIT-OS/, /Paperclip/i, /Hermes/i, /OpenClaw/i, /\bMCP\b/, /\btoken\b/i, /adapter/i];
const DEAD_PALETTE = ['#6316f9', '#e94bb5', '#f3f2f8', '#1a1a24', '#6b6b7b', '#e2e0eb'];
const CARD_GRID = [/grid-template-columns/, /\bgrid-cols-\d/, /\bKpiTile\b/, /className="[^"]*\bkpi\b/];
const COLOUR = /#[0-9a-fA-F]{3,8}\b|rgba?\(/g;

const customerFiles = (root: string) =>
  CUSTOMER_DIRS.flatMap((d) => [...walkFilesIn(root, d, { extensions: CODE })]);

/** Each finding is "file: rule", so a failure names both. */
function scan(root: string, rules: readonly RegExp[]): string[] {
  const out: string[] = [];
  for (const file of customerFiles(root)) {
    const text = readFileIn(root, file);
    for (const rule of rules) {
      rule.lastIndex = 0;
      if (rule.test(text)) out.push(`${file}: ${String(rule)}`);
    }
  }
  return out;
}

/** Internal system names on a customer screen. */
export const bannedWords = (root: string) => scan(root, BANNED);

/** Card-grid patterns where section 15.2 requires a plain list. */
export const cardGrids = (root: string) => scan(root, CARD_GRID);

/** Every literal colour. The tokens are the whole palette, so any literal is a leak. */
export function colourLiterals(root: string): string[] {
  const out: string[] = [];
  for (const file of customerFiles(root)) {
    for (const m of readFileIn(root, file).matchAll(COLOUR)) out.push(`${file}: ${m[0]}`);
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

const ENTRIES = [
  ['dashboards/user/index.html', /<title>[^<]*Orbitcrew/],
  ['dashboards/org-admin/index.html', /<title>[^<]*Orbitcrew/],
  ['dashboards/fleet/index.html', /<title>[^<]*ORBIT-OS/],
] as const;

/**
 * Title problems for the three entry files. `read` returns a file's text, or
 * undefined when it does not exist. Taking a function lets the probe tests below
 * run the rule without touching the repo.
 *
 * Before Stream A writes a screen there is nothing to require. After, every
 * entry file must exist.
 */
export function entryProblems(hasScreens: boolean, read: (file: string) => string | undefined): string[] {
  const out: string[] = [];
  for (const [file, want] of ENTRIES) {
    const text = read(file);
    if (text === undefined) {
      if (hasScreens) out.push(`${file}: missing`);
    } else if (!want.test(text)) {
      out.push(`${file}: wrong title`);
    }
  }
  return out;
}

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
  const hasScreens = walkFilesIn(REPO_ROOT, 'dashboards/src', { extensions: ['.tsx'] }).length > 0;
  expect(entryProblems(hasScreens, readEntry), 'Stream A has screens but entry files are wrong or missing').toEqual([]);
});

test.skipIf(!existsExact('dashboards/fleet/index.html'))(
  'the fleet console is exempt, and the exemption is on its title',
  () => {
    // Scoped to the title rather than "some fleet file mentions ORBIT-OS", which
    // a stray comment would satisfy.
    expect(readRepoFile('dashboards/fleet/index.html')).toMatch(/<title>[^<]*ORBIT-OS/);
  },
);

// ---- Probes. A throwaway tree outside the repo, never inside it. ----

const PROBE = mkdtempSync(join(tmpdir(), 'orbit-design-'));
afterAll(() => rmSync(PROBE, { recursive: true, force: true }));

const put = (rel: string, body: string) => {
  const abs = join(PROBE, rel);
  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(abs, body);
};

const USER = 'dashboards/src/apps/user';

// One probe per BANNED entry, written out by hand and keyed by the rule's text.
// Each body trips its own rule and no other. Do not generate these from BANNED:
// a probe derived from the list would follow the list when an entry is dropped.
const WORD_PROBES: Record<string, string> = {
  '/ORBIT-OS/': 'Welcome to ORBIT-OS',
  '/Paperclip/i': 'powered by PAPERCLIP',
  '/Hermes/i': 'ask hermes',
  '/OpenClaw/i': 'an openclaw agent',
  '/\\bMCP\\b/': 'connect an MCP server',
  '/\\btoken\\b/i': 'paste your Token here',
  '/adapter/i': 'pick an Adapter',
};
Object.keys(WORD_PROBES).forEach((rule, i) => put(`${USER}/words/w${i}.tsx`, WORD_PROBES[rule] as string));

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
Object.keys(PALETTE_PROBES).forEach((hex, i) => put(`${USER}/palette/p${i}.css`, PALETTE_PROBES[hex] as string));

// One probe per CARD_GRID entry.
const GRID_PROBES: Record<string, string> = {
  '/grid-template-columns/': '.row { grid-template-columns: 1fr 1fr; }',
  '/\\bgrid-cols-\\d/': 'export const A = () => <div className="grid grid-cols-3" />;',
  '/\\bKpiTile\\b/': 'export const B = () => <KpiTile />;',
  '/className="[^"]*\\bkpi\\b/': 'export const C = () => <div className="card kpi" />;',
};
Object.keys(GRID_PROBES).forEach((rule, i) => put(`${USER}/grids/g${i}.tsx`, GRID_PROBES[rule] as string));

// One probe per colour form. The pattern is one regex, not a list, so these pin
// each of its branches: 3 digits, 6 digits, 8 digits, rgb( and rgba(.
put(`${USER}/colours/hex3.css`, 'a { color: #fff }');
put(`${USER}/colours/hex6.css`, 'a { color: #123456 }');
put(`${USER}/colours/hex8.css`, 'a { color: #00000080 }');
put(`${USER}/colours/rgb.css`, 'a { color: rgb(0, 0, 0) }');
put(`${USER}/colours/rgba.css`, 'a { color: rgba(0, 0, 0, 0.5) }');

// One probe per CODE extension, one per customer directory, and the exemptions.
put('dashboards/src/apps/org-admin/ext/a.ts', 'Hermes');
put('dashboards/src/apps/org-admin/ext/b.tsx', 'Hermes');
put('dashboards/src/apps/org-admin/ext/c.css', 'Hermes');
put('dashboards/src/apps/org-admin/ext/d.html', 'Hermes');
put('dashboards/src/shared/Leak.tsx', 'Hermes');
put('dashboards/src/apps/org-admin/notes.md', 'Hermes #6316f9 grid-cols-3');
put('dashboards/src/apps/fleet/Console.tsx', 'ORBIT-OS Paperclip Hermes OpenClaw MCP token adapter #6316f9 grid-cols-3 KpiTile');
put('dashboards/src/apps/fleet/console.css', '.x { grid-template-columns: 1fr 1fr; color: rgb(0,0,0); }');

// Files every rule must leave alone.
put(
  `${USER}/clean/Ok.tsx`,
  'export const Ok = () => <p style={{ color: "var(--color-ink)" }}>Your Orbitcrew office. Jump to <a href="#main">main</a>. McpX tokens.</p>;',
);

const sorted = (xs: string[]) => [...xs].sort();
const wordFile = (i: number) => `${USER}/words/w${i}.tsx`;

test('the banned-word rule catches each word with its own probe, and only that word', () => {
  const rules = Object.keys(WORD_PROBES);
  const expected = rules.map((rule, i) => `${wordFile(i)}: ${rule}`);
  const found = bannedWords(PROBE).filter((f) => f.startsWith(`${USER}/words/`));
  expect(sorted(found)).toEqual(sorted(expected));
});

test('every BANNED word has a probe, so dropping or adding one cannot pass unnoticed', () => {
  // Guards the test above. The probes are keyed by the rule's own text.
  expect(sorted(BANNED.map(String))).toEqual(sorted(Object.keys(WORD_PROBES)));
});

test('the dead-palette rule catches each hex with its own probe, and only that hex', () => {
  const hexes = Object.keys(PALETTE_PROBES);
  const expected = hexes.map((hex, i) => `${USER}/palette/p${i}.css: ${hex}`);
  const found = deadPalette(PROBE).filter((f) => f.startsWith(`${USER}/palette/`));
  expect(sorted(found)).toEqual(sorted(expected));
});

test('every DEAD_PALETTE hex has a probe', () => {
  expect(sorted(DEAD_PALETTE)).toEqual(sorted(Object.keys(PALETTE_PROBES)));
});

test('the card-grid rule catches each pattern with its own probe, and only that pattern', () => {
  const rules = Object.keys(GRID_PROBES);
  const expected = rules.map((rule, i) => `${USER}/grids/g${i}.tsx: ${rule}`);
  expect(sorted(cardGrids(PROBE))).toEqual(sorted(expected));
});

test('every CARD_GRID pattern has a probe', () => {
  expect(sorted(CARD_GRID.map(String))).toEqual(sorted(Object.keys(GRID_PROBES)));
});

test('the colour rule catches hex of three, six and eight digits, rgb( and rgba(', () => {
  const found = colourLiterals(PROBE).filter((f) => f.startsWith(`${USER}/colours/`));
  expect(sorted(found)).toEqual([
    `${USER}/colours/hex3.css: #fff`,
    `${USER}/colours/hex6.css: #123456`,
    `${USER}/colours/hex8.css: #00000080`,
    `${USER}/colours/rgb.css: rgb(`,
    `${USER}/colours/rgba.css: rgba(`,
  ]);
});

test('every code extension, and every customer directory, is scanned', () => {
  const hits = bannedWords(PROBE);
  const hit = (file: string) => hits.some((h) => h.startsWith(`${file}:`));
  // Written out, not read from CODE: a loop over CODE would shrink with it.
  for (const probe of ['a.ts', 'b.tsx', 'c.css', 'd.html']) {
    expect(hit(`dashboards/src/apps/org-admin/ext/${probe}`), `${probe} is not scanned`).toBe(true);
  }
  expect(hit('dashboards/src/shared/Leak.tsx'), 'dashboards/src/shared is not scanned').toBe(true);
  expect(hits.some((h) => h.startsWith(`${USER}/`)), 'dashboards/src/apps/user is not scanned').toBe(true);
  expect(hits.some((h) => h.startsWith('dashboards/src/apps/org-admin/')), 'org-admin is not scanned').toBe(true);
});

test('the fleet console, other file types and clean files are left alone', () => {
  const everything = [
    ...bannedWords(PROBE),
    ...cardGrids(PROBE),
    ...colourLiterals(PROBE),
    ...deadPalette(PROBE),
  ];
  expect(everything.filter((f) => f.includes('/apps/fleet/'))).toEqual([]);
  expect(everything.filter((f) => f.includes('notes.md'))).toEqual([]);
  expect(everything.filter((f) => f.includes('/clean/'))).toEqual([]);
});

test('the entry-title rule flags a wrong title on each entry, and only that entry', () => {
  const good = (file: string) =>
    file.includes('fleet') ? '<title>ORBIT-OS fleet</title>' : '<title>Orbitcrew</title>';
  expect(entryProblems(true, good)).toEqual([]);
  for (const [bad] of ENTRIES) {
    const wrong = (file: string) => (file === bad ? '<title>Something else</title>' : good(file));
    expect(entryProblems(true, wrong)).toEqual([`${bad}: wrong title`]);
  }
  // The customer apps must not carry the internal name in the title.
  const leaked = (file: string) => (file.includes('user') ? '<title>ORBIT-OS</title>' : good(file));
  expect(entryProblems(true, leaked)).toEqual(['dashboards/user/index.html: wrong title']);
});

test('the entry tripwire fails on a missing file only once screens exist', () => {
  const none = () => undefined;
  expect(entryProblems(false, none)).toEqual([]);
  expect(entryProblems(true, none)).toEqual(ENTRIES.map(([f]) => `${f}: missing`));
});
