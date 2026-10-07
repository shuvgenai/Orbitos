import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, extname, join } from 'node:path';
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
// The opposite failure matters just as much. A guard that fires on correct code
// gets switched off by whoever it blocks, and takes the other rules with it. So
// the probes also include code that looks like real Stream A code, and the tests
// assert it produces no findings at all.
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
// *.spec.*, *.stories.* or *.story.*. The same rule decides what arms the
// entry-file tripwire. Nothing else is skipped.
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

// The CSS named colours (Color Level 4), minus transparent and currentColor,
// which stay allowed. A property followed by anything not in this list, such as
// a token name or a type, is not a colour literal.
export const NAMED_COLOURS = (
  'aliceblue antiquewhite aqua aquamarine azure beige bisque black blanchedalmond blue blueviolet brown burlywood ' +
  'cadetblue chartreuse chocolate coral cornflowerblue cornsilk crimson cyan darkblue darkcyan darkgoldenrod ' +
  'darkgray darkgreen darkgrey darkkhaki darkmagenta darkolivegreen darkorange darkorchid darkred darksalmon ' +
  'darkseagreen darkslateblue darkslategray darkslategrey darkturquoise darkviolet deeppink deepskyblue dimgray ' +
  'dimgrey dodgerblue firebrick floralwhite forestgreen fuchsia gainsboro ghostwhite gold goldenrod gray green ' +
  'greenyellow grey honeydew hotpink indianred indigo ivory khaki lavender lavenderblush lawngreen lemonchiffon ' +
  'lightblue lightcoral lightcyan lightgoldenrodyellow lightgray lightgreen lightgrey lightpink lightsalmon ' +
  'lightseagreen lightskyblue lightslategray lightslategrey lightsteelblue lightyellow lime limegreen linen ' +
  'magenta maroon mediumaquamarine mediumblue mediumorchid mediumpurple mediumseagreen mediumslateblue ' +
  'mediumspringgreen mediumturquoise mediumvioletred midnightblue mintcream mistyrose moccasin navajowhite navy ' +
  'oldlace olive olivedrab orange orangered orchid palegoldenrod palegreen paleturquoise palevioletred papayawhip ' +
  'peachpuff peru pink plum powderblue purple rebeccapurple red rosybrown royalblue saddlebrown salmon sandybrown ' +
  'seagreen seashell sienna silver skyblue slateblue slategray slategrey snow springgreen steelblue tan teal ' +
  'thistle tomato turquoise violet wheat white whitesmoke yellow yellowgreen'
).split(' ');

const NAME = `(?:${NAMED_COLOURS.join('|')})`;

// Colour literals. The tokens are the whole palette, so any literal is a leak.
// Three rules, each global so every match is reported.
//  HEX: 3 to 8 digits. Not after href=" or url(, which are anchors and gradient
//       ids such as #add. Not after & (an entity such as &#169;). Not inside a
//       querySelector-style call, whose argument is a selector. Not excluded
//       after a bare =", because fill="#fff" on an SVG is the leak this is for.
//       Comments are removed before this runs, so "issue #123" is quiet. A match
//       inside copy is skipped (see below), so "Order #1042" is quiet too.
//  FUNC: colour functions.
//  NAMED: a colour property set to a CSS named colour, bare or quoted.
const HEX = /(?<!href=["']|url\(|&|(?:querySelector(?:All)?|closest|matches)\(\s*["'])#[0-9a-fA-F]{3,8}\b/g;
const COLOUR = [
  HEX,
  /\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch)\(/g,
  new RegExp(
    `\\b(?:color|background(?:-color)?|border(?:-(?:top|right|bottom|left))?-color|outline-color)\\s*:\\s*["']?${NAME}\\b(?![-\\w(])` +
      `|\\b(?:fill|stroke)\\s*[:=]\\s*["']?${NAME}\\b(?![-\\w(])`,
    'gi',
  ),
];

// ---- Where a customer can read text, and where style lives. ----
//
// PRD section 15.3 bans those words in what a customer reads, not in the code
// behind it. The file says one thing in two halves.
//
//  Banned words live in COPY: string literals and JSX text in scripts, text
//  nodes and readable attributes in markup, content strings in CSS, string
//  values in JSON. Identifiers, types, imports, keys and comments are code and
//  are not scanned for words.
//
//  Colours live in STYLE: declarations, style objects, fill and stroke, class
//  and style attributes, stylesheets. The hex rule therefore skips a match that
//  sits inside copy, so "Order #1042" in JSX text or a text node is not a
//  colour. A bare string such as '#1042' is style and still fires. In CSS
//  content and JSON values a string that is wholly one hex still fires too.
//
// KNOWN LIMITS. This is a heuristic scanner, not a parser. Every gap below is
// known, accepted and deliberately NOT fixed: round 3 is final for this file.
// Do not assume coverage this file does not have, and do not read a gap as a
// promise that the opposite case is covered.
//
// Where copy ends.
//  - Only these are copy: JSX text, an HTML or SVG text node, a readable
//    attribute, a CSS content value, a JSON string value. A string or template
//    in a script is style, so a message string such as
//    const m = 'Order #1042 shipped' is reported as a colour. So is
//    placeholder={'Order #1042'}, because the braces make it an expression
//    rather than attribute text. The same words inside JSON are quiet. Shared
//    message strings are where this will be met.
//  - A JSON or CSS content value counts as style only when it is wholly one hex,
//    so {"border": "1px solid #fff"} and {"c": "linear-gradient(#fff, #000)"}
//    are NOT reported. In a script the same strings are reported.
//  - In markup a <style> or <script> block is blanked with its own delimiters, so
//    a text node can span it. A colour inside such a block is not reported when
//    text follows the block directly: <p>x</p><style>a{color:#fff}</style>Hi<p>y</p>
//    is quiet. Round 2 reported it. The cost is bounded by the entry files being
//    thin shells and by stylesheets living in .css, which is scanned separately.
//
// Where the scanner mis-reads text.
//  - A regex literal containing a quote, or a lone apostrophe in JSX text, can
//    make the scanner mis-read the rest of that line. A lone backtick is worse:
//    a template read is not newline-bounded, so it swallows the rest of the file.
//  - JSX text that starts with a parenthesis, has unbalanced parentheses, or
//    contains ; or = or an operator pair is code and is not scanned for words.
//    This cuts both ways: <p>(Order #1042)</p> is reported as a colour, and a
//    parenthesised suffix after an inline element, <p>Name <b>x</b> (Hermes)</p>,
//    is never scanned for banned words.
//  - A semicolon-free function body between a > and the next < can be read as JSX
//    text, which masks a hex inside it.
//
// Where a path is guessed.
//  - PATH_SHAPED knows six shapes. A bare shared/x with no extension, a Windows
//    path, a data: URI, ~/x and mailto: are all scanned as copy. In the other
//    direction, /^\// accepts any string with a leading slash as a path.
//
// Where a colour is missed outright.
//  - Named colours are checked only in the properties the NAMED rule lists, so
//    border: 1px solid red, a named colour in a gradient and color-mix( are not
//    caught. A HEX in a border shorthand or a gradient IS caught, in every file
//    type except where a copy rule above hides it.
//  - Entry files (dashboards/*/index.html) are checked for their title only. Their
//    other text and any colours in them are not scanned.
//  - Only the file types in CODE are read. Anything else in a customer folder is
//    invisible to every rule here.

/** Attributes whose value a customer reads. Other attributes (className, id, data-*) are code. */
const READABLE_ATTRS = ['placeholder', 'aria-label', 'alt', 'title', 'label'];

// A string right after from, import, import( or require( is a module specifier.
const MODULE_SPECIFIER = /(?:\bfrom|\bimport\s*\(?|\brequire\s*\()\s*$/;

// Strings shaped like a path or a URL are code, not prose. Prose that merely
// contains a slash ("Hermes/Paperclip", "and/or") is still copy.
const PATH_SHAPED = [
  /^\.\//, // ./adapter-chip
  /^\.\.\//, // ../adapter-chip
  /^@[\w-]*\//, // @scope/pkg and @/shared/x
  /^\//, // /api/x
  /^[a-z][a-z0-9+.-]*:\/\//i, // https://x
  /^\S+\/\S*\.[A-Za-z0-9]{1,5}$/, // design/tokens.css: no spaces, ends in an extension
];
const isPathShaped = (text: string) => PATH_SHAPED.some((r) => r.test(text));

/** A stretch of the file that is copy. `value` ranges still count as style when they are wholly one hex. */
type Mask = { start: number; end: number; value: boolean };
type Scan = { copy: string[]; plain: string; masks: Mask[] };

// Same length as the input, so an index into the result is an index into the source.
const blank = (s: string) => s.replace(/[^\n]/g, ' ');

const hasLetter = (s: string) => /[A-Za-z]/.test(s);
const WHOLE_COLOUR = /^\s*#[0-9a-fA-F]{3,8}\s*$/;

/** True when `at` sits inside copy, where a hex is a number or a reference and not a colour. */
function inCopy(s: Scan, at: number): boolean {
  const mask = s.masks.find((k) => at >= k.start && at < k.end);
  if (!mask) return false;
  return !(mask.value && WHOLE_COLOUR.test(s.plain.slice(mask.start, mask.end)));
}

export { PATH_SHAPED, isPathShaped };
const parensBalanced = (t: string) => (t.match(/\(/g) ?? []).length === (t.match(/\)/g) ?? []).length;

function scanScript(src: string, jsx: boolean): Scan {
  const n = src.length;
  const copy: string[] = [];
  const masks: Mask[] = [];
  const comments: [number, number][] = [];
  const stack: number[] = []; // brace depth at which a template literal resumes
  let depth = 0;
  // The source with comments and string bodies blanked, same length as src.
  let code = '';
  let i = 0;

  const emit = (text: string, before: string, start: number) => {
    if (!hasLetter(text) || isPathShaped(text) || MODULE_SPECIFIER.test(before)) return;
    // A JSX attribute (no spaces around =) is copy only when a customer reads it.
    const attr = /(?:^|\s)([\w:-]+)=$/.exec(before);
    if (attr) {
      if (!READABLE_ATTRS.includes((attr[1] as string).toLowerCase())) return;
      masks.push({ start, end: start + text.length, value: false });
    }
    copy.push(text);
  };

  // Reads template text from `start`. Returns the index to resume code at.
  const readTemplate = (start: number): number => {
    let text = '';
    for (let j = start; j < n; j++) {
      const c = src[j];
      if (c === '\\') {
        text += src.slice(j, j + 2);
        j++;
      } else if (c === '`') {
        emit(text, code, start);
        code += ' '.repeat(j - start) + '`';
        return j + 1;
      } else if (c === '$' && src[j + 1] === '{') {
        emit(text, code, start);
        code += ' '.repeat(j - start) + '${';
        stack.push(depth);
        depth++;
        return j + 2;
      } else {
        text += c;
      }
    }
    emit(text, code, start);
    code += ' '.repeat(n - start);
    return n;
  };

  while (i < n) {
    const c = src[i] as string;
    const d = src[i + 1];
    if (c === '/' && d === '/') {
      const e = src.indexOf('\n', i);
      const end = e < 0 ? n : e;
      comments.push([i, end]);
      code += ' '.repeat(end - i);
      i = end;
    } else if (c === '/' && d === '*') {
      const e = src.indexOf('*/', i + 2);
      const end = e < 0 ? n : e + 2;
      comments.push([i, end]);
      code += blank(src.slice(i, end));
      i = end;
    } else if (c === '"' || c === "'") {
      let j = i + 1;
      let text = '';
      while (j < n && src[j] !== c && src[j] !== '\n') {
        if (src[j] === '\\') {
          text += src.slice(j, j + 2);
          j += 2;
        } else text += src[j++];
      }
      emit(text, code, i + 1);
      const closed = src[j] === c;
      code += c + ' '.repeat(j - i - 1) + (closed ? c : '');
      i = closed ? j + 1 : j;
    } else if (c === '`') {
      code += '`';
      i = readTemplate(i + 1);
    } else {
      if (c === '{') depth++;
      if (c === '}') {
        depth--;
        if (stack.length > 0 && stack[stack.length - 1] === depth) {
          stack.pop();
          code += '}';
          i = readTemplate(i + 1);
          continue;
        }
      }
      code += c;
      i++;
    }
  }

  if (jsx) {
    // Text between a closing > (not =>) or } and the next <, or before a {.
    // Text that reads like an operator expression, has unbalanced parentheses or
    // starts with one is code (a comparison, a generic, a call) and is skipped.
    // Balanced parentheses inside the text are copy: "Adapter (optional)".
    for (const re of [/(?:(?<!=)>|\})([^<>{}]+)</g, /(?<!=)>([^<>{}]+)\{/g]) {
      for (const m of code.matchAll(re)) {
        const text = m[1] as string;
        if (!hasLetter(text) || /[;=]|&&|\|\||\s[?:]\s/.test(text)) continue;
        if (!parensBalanced(text) || /^\s*\(/.test(text)) continue;
        copy.push(text);
        const start = (m.index as number) + 1;
        masks.push({ start, end: start + text.length, value: false });
      }
    }
  }
  return { copy, plain: blankRanges(src, comments), masks };
}

const blankRanges = (src: string, ranges: [number, number][]) => {
  let out = '';
  let at = 0;
  for (const [s, e] of ranges) {
    out += src.slice(at, s) + blank(src.slice(s, e));
    at = e;
  }
  return out + src.slice(at);
};

function scanMarkup(src: string): Scan {
  const plain = src.replace(/<!--[\s\S]*?-->/g, blank);
  const body = plain.replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, blank);
  const copy: string[] = [];
  const masks: Mask[] = [];
  for (const m of body.matchAll(/>([^<]+)</g)) {
    const text = m[1] as string;
    if (!hasLetter(text)) continue;
    copy.push(text);
    const start = (m.index as number) + 1;
    masks.push({ start, end: start + text.length, value: false });
  }
  const attrs = new RegExp(`\\b(?:${READABLE_ATTRS.join('|')})\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, 'gi');
  for (const m of body.matchAll(attrs)) {
    const text = (m[1] ?? m[2]) as string;
    copy.push(text);
    const start = (m.index as number) + m[0].length - 1 - text.length;
    masks.push({ start, end: start + text.length, value: false });
  }
  return { copy, plain, masks };
}

function scanCss(src: string): Scan {
  const plain = src.replace(/\/\*[\s\S]*?\*\//g, blank);
  const copy: string[] = [];
  const masks: Mask[] = [];
  for (const m of plain.matchAll(/\bcontent\s*:\s*(["'])((?:(?!\1).)*)\1/g)) {
    const text = m[2] as string;
    copy.push(text);
    const start = (m.index as number) + m[0].length - 1 - text.length;
    masks.push({ start, end: start + text.length, value: true });
  }
  return { copy, plain, masks };
}

function scanJson(src: string): Scan {
  // String values only. A key is code.
  const copy: string[] = [];
  const masks: Mask[] = [];
  for (const m of src.matchAll(/"((?:[^"\\]|\\.)*)"(\s*:)?/g)) {
    if (m[2]) continue;
    const text = m[1] as string;
    if (!hasLetter(text) || isPathShaped(text)) continue;
    copy.push(text);
    const start = (m.index as number) + 1;
    masks.push({ start, end: start + text.length, value: true });
  }
  return { copy, plain: src, masks };
}

function scanFile(file: string, src: string): Scan {
  const ext = extname(file).toLowerCase();
  if (ext === '.css') return scanCss(src);
  if (ext === '.html' || ext === '.svg') return scanMarkup(src);
  if (ext === '.json') return scanJson(src);
  return scanScript(src, ext === '.tsx' || ext === '.jsx');
}

const isScreenFile = (file: string) => !NOT_SCREEN_FILE.test(basename(file));

const customerFiles = (root: string) =>
  CUSTOMER_DIRS.flatMap((d) =>
    [...walkFilesIn(root, d, { extensions: CODE, skipAnywhere: NOT_SCREEN_DIRS })].filter(isScreenFile),
  );

/** Each finding is "file: rule", so a failure names both. */
function scan(root: string, rules: readonly RegExp[], pick: (s: Scan) => string[]): string[] {
  const out: string[] = [];
  for (const file of customerFiles(root)) {
    const texts = pick(scanFile(file, readFileIn(root, file)));
    for (const rule of rules) if (texts.some((t) => rule.test(t))) out.push(`${file}: ${String(rule)}`);
  }
  return out;
}

/** Internal system names in text a customer can read. */
export const bannedWords = (root: string) => scan(root, BANNED, (s) => s.copy);

/** Card-grid patterns where section 15.2 requires a plain list. Comments are ignored. */
export const cardGrids = (root: string) => scan(root, CARD_GRID, (s) => [s.plain]);

/** Every literal colour, reported as "file: matched text". Comments are ignored. */
export function colourLiterals(root: string): string[] {
  const out: string[] = [];
  for (const file of customerFiles(root)) {
    const s = scanFile(file, readFileIn(root, file));
    for (const rule of COLOUR) {
      for (const m of s.plain.matchAll(rule)) {
        // Only the hex rule skips copy. A colour function or named colour needs a
        // property or a call around it, which prose does not have.
        if (rule === HEX && inCopy(s, m.index as number)) continue;
        out.push(`${file}: ${m[0]}`);
      }
    }
  }
  return out;
}

/** The old prototype palette, matched case-insensitively anywhere in the file. */
export function deadPalette(root: string): string[] {
  const out: string[] = [];
  for (const file of customerFiles(root)) {
    const text = readFileIn(root, file).toLowerCase();
    for (const hex of DEAD_PALETTE) if (text.includes(hex)) out.push(`${file}: ${hex}`);
  }
  return out;
}

/** Every finding from every rule, for the quiet-on-correct-code checks. */
const everyFinding = (root: string) => [
  ...bannedWords(root),
  ...cardGrids(root),
  ...colourLiterals(root),
  ...deadPalette(root),
];

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
 * file sits under dashboards/src/apps. Shared components do not count. Test and
 * story files never count, wherever they sit, so a test-first
 * apps/user/Home.test.tsx does not demand entry files before they exist
 * (founder decision of 2026-10-06).
 */
export const screensExist = (root: string) =>
  walkFilesIn(root, 'dashboards/src/apps', { extensions: ['.tsx'], skipAnywhere: NOT_SCREEN_DIRS }).filter(isScreenFile)
    .length > 0;

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
const sorted = (xs: string[]) => [...xs].sort();

// One probe per BANNED entry, written out by hand and keyed by the rule's text.
// Each body is JSX text, which is copy, and trips its own rule and no other. Do
// not generate these from BANNED: a probe derived from the list would follow the
// list when an entry is dropped. The token rule has two probes, one singular and
// one plural, so narrowing it to either form fails.
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
Object.values(WORD_PROBES).forEach((bodies, i) =>
  bodies.forEach((b, j) => put(wordFile(i, j), `export const A = () => <p>${b}</p>;`)),
);

// Every position where a customer can read text, each with one word. Each of
// these must be reported, and only for that word.
const COPY_PROBES: [string, string][] = [
  ['jsx-text.tsx', 'export const A = () => <p>Your Hermes expired</p>;'],
  ['jsx-after-expr.tsx', 'export const A = ({ n }: { n: number }) => <p>{n} Hermes left</p>;'],
  ['jsx-before-expr.tsx', 'export const A = ({ n }: { n: number }) => <p>Hermes {n}</p>;'],
  ['string-single.ts', "export const msg = 'Your Hermes expired';"],
  ['string-double.ts', 'export const msg = "Your Hermes expired";'],
  ['template.ts', 'export const msg = (n: number) => `${n} Hermes left`;'],
  ['template-before.ts', 'export const msg = (n: number) => `Hermes ${n}`;'],
  ['object-value.ts', "export const copy = { title: 'Hermes' };"],
  ['html-text.html', '<p>Hermes</p>'],
  ['html-title.html', '<title>Hermes</title>'],
  ['svg-text.svg', '<svg><text>Hermes</text></svg>'],
  ['css-double.css', 'a::after { content: "Hermes"; }'],
  ['css-single.css', "a::after { content: 'Hermes'; }"],
  ['json-value.json', '{"msg": "Hermes"}'],
];
COPY_PROBES.forEach(([f, b]) => put(`${USER}/copy/${f}`, b));

// One probe per readable attribute, in script and in markup.
const ATTR_PROBES: Record<string, [string, string]> = {
  placeholder: ['<input placeholder="Hermes" />', '<input placeholder="Hermes">'],
  'aria-label': ['<button aria-label="Hermes" />', '<button aria-label="Hermes">x</button>'],
  alt: ['<img alt="Hermes" />', '<img alt="Hermes">'],
  title: ['<a title="Hermes">x</a>', '<a title="Hermes">x</a>'],
  label: ['<Field label="Hermes" />', '<option label="Hermes">x</option>'],
};
Object.entries(ATTR_PROBES).forEach(([name, [tsx, html]]) => {
  put(`${USER}/attrs/${name}.tsx`, `export const A = () => ${tsx};`);
  put(`${USER}/attrs/${name}.html`, html);
});
// A real leak: two internal words in one sentence a customer reads.
put(`${USER}/leak/Expired.tsx`, 'export const A = () => <p>Your MCP token expired</p>;');

// Prose that contains parentheses or a slash is still copy. These used to escape.
put(`${USER}/prose/Parens.tsx`, 'export const A = () => <p>Adapter (optional)</p>;');
put(`${USER}/prose/Slash.tsx`, 'export const A = () => <p>Hermes/Paperclip</p>;');
put(`${USER}/prose/slash-string.ts`, "export const m = 'Hermes/Paperclip';");
put(`${USER}/prose/spaced-slash.ts`, "export const m = 'and/or tokens';");
put(`${USER}/prose/slash.json`, '{"m": "Hermes/Paperclip"}');

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
  ['named-uppercase.css', 'a { COLOR: Red }', 'COLOR: Red'],
  ['named-background.css', 'a { background: navy }', 'background: navy'],
  ['named-background-color.css', 'a { background-color: navy }', 'background-color: navy'],
  ['named-border-color.css', 'a { border-color: teal }', 'border-color: teal'],
  ['named-border-top-color.css', 'a { border-top-color: teal }', 'border-top-color: teal'],
  ['named-outline-color.css', 'a { outline-color: teal }', 'outline-color: teal'],
  ['named-fill.svg', '<rect fill="red" />', 'fill="red'],
  ['named-stroke.svg', '<rect stroke="blue" />', 'stroke="blue'],
  ['named-quoted.tsx', "export const s = { color: 'red' };", "color: 'red"],
  // A hex is style unless it sits in copy. These are style, so they still fire.
  ['hex-string.tsx', "export const s = { color: '#1042' };", '#1042'],
  ['hex-long-string.ts', "export const b = { border: '1px solid #fff' };", '#fff'],
  ['hex-json.json', '{"color": "#abcd"}', '#abcd'],
  ['hex-content.css', 'a::after { content: "#abcd"; }', '#abcd'],
];
COLOUR_PROBES.forEach(([f, b]) => put(`${USER}/colours/${f}`, b));

// The named-colour list, written out a second time. The list in the guard must
// match this copy in both directions, and the probe below is built from this
// copy, not from the guard, so dropping a colour fails twice.
const EXPECTED_NAMED = (
  'aliceblue antiquewhite aqua aquamarine azure beige bisque black blanchedalmond blue blueviolet brown burlywood ' +
  'cadetblue chartreuse chocolate coral cornflowerblue cornsilk crimson cyan darkblue darkcyan darkgoldenrod ' +
  'darkgray darkgreen darkgrey darkkhaki darkmagenta darkolivegreen darkorange darkorchid darkred darksalmon ' +
  'darkseagreen darkslateblue darkslategray darkslategrey darkturquoise darkviolet deeppink deepskyblue dimgray ' +
  'dimgrey dodgerblue firebrick floralwhite forestgreen fuchsia gainsboro ghostwhite gold goldenrod gray green ' +
  'greenyellow grey honeydew hotpink indianred indigo ivory khaki lavender lavenderblush lawngreen lemonchiffon ' +
  'lightblue lightcoral lightcyan lightgoldenrodyellow lightgray lightgreen lightgrey lightpink lightsalmon ' +
  'lightseagreen lightskyblue lightslategray lightslategrey lightsteelblue lightyellow lime limegreen linen ' +
  'magenta maroon mediumaquamarine mediumblue mediumorchid mediumpurple mediumseagreen mediumslateblue ' +
  'mediumspringgreen mediumturquoise mediumvioletred midnightblue mintcream mistyrose moccasin navajowhite navy ' +
  'oldlace olive olivedrab orange orangered orchid palegoldenrod palegreen paleturquoise palevioletred papayawhip ' +
  'peachpuff peru pink plum powderblue purple rebeccapurple red rosybrown royalblue saddlebrown salmon sandybrown ' +
  'seagreen seashell sienna silver skyblue slateblue slategray slategrey snow springgreen steelblue tan teal ' +
  'thistle tomato turquoise violet wheat white whitesmoke yellow yellowgreen'
).split(' ');
put(`${USER}/named/all.css`, EXPECTED_NAMED.map((c) => `a { color: ${c} }`).join('\n'));

// Allowed forms. Together they pin what must stay quiet: removing an exclusion
// flags this file.
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

// Real Stream A shapes that must produce NO findings from any rule. Each has a
// NAIVE pattern, the cruder rule it would have tripped, so the first test below
// proves the probe is a real near miss and not quiet by accident.
const QUIET_PROBES: [string, string, RegExp][] = [
  [
    'tokens-module.ts',
    [
      "import { tokens, type Token } from './tokens';",
      "import { colorInk } from '../../../../design/tokens.ts';",
      "import adapterDefault from 'adapter';",
      "import tokensDefault from 'tokens';",
      'export const adapter = tokens; // the token adapter, kept for tokens',
      'export type TokenName = keyof typeof tokens;',
      'export const load = () => import("tokens");',
    ].join('\n'),
    /\btokens?\b|adapter/i,
  ],
  [
    'Chip.tsx',
    [
      "type Tone = 'ink' | 'muted';",
      'type ChipProps = { color: Tone; label: string };',
      "export const Chip = ({ color }: { color: 'ink' | 'muted' }) => <span style={{ color: 'ink' }}>{color}</span>;",
      'export const Typed = ({ color }: { color: Tone }) => <i>{color}</i>;',
    ].join('\n'),
    /\bcolor\s*:\s*["']?[a-z]+/i,
  ],
  [
    'Props.ts',
    ['export type Props = { color: string; stroke: string };', 'const accent = 1;', 'const stroke = accent;'].join('\n'),
    /\b(?:color|stroke)\s*[:=]\s*["']?[a-z]+/i,
  ],
  [
    'Icon.tsx',
    'export const Icon = () => <svg><path fill="currentColor" /><path fill="var(--color-ink)" stroke="currentColor" /></svg>;',
    /\b(?:fill|stroke)\s*=\s*["']?[a-z]+/i,
  ],
  [
    'Selectors.ts',
    [
      '// fixes issue #123 and #add',
      "const el = document.querySelector('#add');",
      "const all = document.querySelectorAll('#bed');",
      "const near = el?.closest('#cafe');",
      "export const copyright = '&#169;';",
    ].join('\n'),
    /#[0-9a-fA-F]{3,8}\b/,
  ],
  [
    'page.html',
    '<!-- Hermes adapter token #123 --><p>&#169; Orbitcrew</p><a href="#add" class="token">Jump</a><script>const tokens = 1;</script><style>.adapter { color: var(--color-ink); }</style>',
    /\btokens?\b|adapter|Hermes/i,
  ],
  [
    'comments.ts',
    ['// ask the Hermes adapter about the MCP token', '/* ORBIT-OS Paperclip OpenClaw */', "/*\n * don't mention the Hermes adapter\n */", 'export const ok = 1;'].join('\n'),
    /Hermes|ORBIT-OS|MCP|Paperclip|OpenClaw|\btoken\b|adapter/,
  ],
  [
    'Keys.ts',
    "export const adapterConfig = { tokenName: 'ink', adapter: 'x', tokens: [1] };",
    /adapter|\btokens?\b/i,
  ],
  [
    'Attrs.tsx',
    'export const A = () => <div className="token-chip adapter-row" id="tokens" data-source="adapter" />;',
    /adapter|\btokens?\b/i,
  ],
  [
    'Paths.ts',
    [
      // One line per path shape in PATH_SHAPED, so dropping a shape fails here.
      "export const a = './adapter-chip';",
      "export const a2 = '../adapter-chip';",
      "export const b = '@/shared/token-chip';",
      "export const b2 = '@scope/adapter';",
      "export const b3 = '/api/adapter';",
      "export const b4 = 'https://adapter.example';",
      "export const b5 = 'design/adapter.css';",
      'export const c = (x: string) => `/api/${x}/tokens`;',
    ].join('\n'),
    /adapter|\btokens?\b/i,
  ],
  [
    'Compare.tsx',
    [
      'export const f = (a: number, tokens: number) => (a > tokens ? <b>x</b> : null);',
      'export function g<T>(tokens: T) { return tokens; }',
      'export function k(a: number, tokens: number) { if (a > tokens) { return 1; } return 0; }',
      'export const h = (a: number, adapter: number) => a > adapter && <b>y</b>;',
    ].join('\n'),
    /\btokens?\b|adapter/i,
  ],
  [
    'Operators.tsx',
    [
      'export const e = a > tokens === b < 2;',
      'export const o = a > tokens || b < 2;',
      'function s() { a > tokens; b < c; }',
      'export const arrow = (n: number) => tokens < n;',
      'export const pick = (a: string) => tokens[a] ?? {};',
    ].join('\n'),
    /\btokens?\b/i,
  ],
  [
    'Scale.ts',
    "export const scale = { color: 'red-500', background: 'tannery', fill: 'blue-500', stroke: 'whitesmoke2' };",
    /\b(?:color|background|fill|stroke)\s*:\s*["']?(?:red|tan|blue|whitesmoke)/i,
  ],
  ['theme.css', '/* token adapter */ .chip { color: var(--color-ink); --tokens: 1; --adapter: 2; }', /\btokens?\b|adapter/i],
  ['theme.json', '{"token": "ink", "adapter": {"tokens": 1}, "src": "./adapter-chip.css"}', /\btokens?\b|adapter/i],
  ['Kpi.ts', '// KpiTile and grid-cols-3 were removed\nexport const ok = 1;', /KpiTile|grid-cols-3/],
  // Order numbers, invoice numbers and issue references read as hex colours but
  // sit in copy, where a hex is not a colour.
  [
    'Order.tsx',
    // The lines before the JSX hold a line comment, a block comment, strings and
    // a template, so a skeleton that changes length would point the copy ranges
    // at the wrong text.
    [
      '// a fairly long line comment about orders',
      '/* a longer block comment',
      '   spanning two lines */',
      "export const label = 'a string with several words in it';",
      'export const tpl = (n: number) => `before ${n} after ${n} and a long closing tail of the template`;',
      'export const A = ({ name }: { name: string }) => <p>Order #1042 for {name}. Issue #123 and #beef.</p>;',
      'export const B = ({ name }: { name: string }) => <p>{name}: invoice #20231</p>;',
    ].join('\n'),
    /#[0-9a-fA-F]{3,8}\b/,
  ],
  ['Placeholder.tsx', 'export const A = () => <input placeholder="Order #1042" />;', /#[0-9a-fA-F]{3,8}\b/],
  [
    'order.html',
    '<!-- a comment of some length --><style>.a { margin: 0 auto; }</style><script>const n = 1;</script><p>Order #1042</p><input placeholder="Order #1042"><svg><text>Ticket #123</text></svg><a title="Ref #beef">x</a>',
    /#[0-9a-fA-F]{3,8}\b/,
  ],
  ['order.css', '/* a comment of some length */ a::after { content: "Order #1042"; }', /#[0-9a-fA-F]{3,8}\b/],
  ['order.json', '{"msg": "Order #1042 shipped"}', /#[0-9a-fA-F]{3,8}\b/],
];
QUIET_PROBES.forEach(([f, b]) => put(`${USER}/quiet/${f}`, b));

// One probe per CODE extension, written out. Each body is copy in that
// language and names an internal system, so a dropped extension leaves that file
// unreported. '.mts' also ends with '.ts', so each extension has its own name.
const EXT_PROBES: Record<string, string> = {
  '.ts': "export const m = 'Hermes';",
  '.tsx': 'export const m = <p>Hermes</p>;',
  '.js': "export const m = 'Hermes';",
  '.jsx': 'export const m = <p>Hermes</p>;',
  '.mjs': "export const m = 'Hermes';",
  '.cjs': "module.exports = 'Hermes';",
  '.mts': "export const m = 'Hermes';",
  '.cts': "export const m = 'Hermes';",
  '.css': 'a::after { content: "Hermes"; }',
  '.html': '<p>Hermes</p>',
  '.svg': '<svg><text>Hermes</text></svg>',
  '.json': '{"m": "Hermes"}',
};
Object.entries(EXT_PROBES).forEach(([ext, body]) => put(`dashboards/src/apps/org-admin/ext/probe${ext}`, body));

// One probe per customer directory.
put(`${USER}/Contest.tsx`, 'export const m = <p>Hermes</p>;');
put('dashboards/src/apps/org-admin/Leak.tsx', 'export const m = <p>Hermes</p>;');
put('dashboards/src/shared/Leak.tsx', 'export const m = <p>Hermes</p>;');

// Left alone: other file types, the fleet app, and test fixtures. Contest.tsx
// above ends in "test" but is not a *.test.* file, so it is still scanned.
const LEAK = "export const m = <p>Hermes</p>; export const c = '#6316f9';";
put('dashboards/src/apps/org-admin/notes.md', 'Hermes #6316f9 grid-cols-3');
put('dashboards/src/apps/fleet/Console.tsx', LEAK + ' export const g = <KpiTile />;');
put('dashboards/src/apps/fleet/console.css', '.x { grid-template-columns: 1fr 1fr; color: rgb(0,0,0); content: "Hermes"; }');
put(`${USER}/__tests__/Leak.tsx`, LEAK);
put(`${USER}/__fixtures__/leak.json`, '{"a":"Hermes"}');
put(`${USER}/Screen.test.tsx`, LEAK);
put(`${USER}/Screen.spec.ts`, LEAK);
put('dashboards/src/shared/Button.stories.tsx', LEAK);
put('dashboards/src/shared/Button.story.tsx', LEAK);

const PROBE = makeRoot(files);
const wordsIn = (dir: string, findings: string[]) => findings.filter((f) => f.startsWith(`${dir}/`));

test('the banned-word rule catches each word with its own probe, and only that word', () => {
  const expected = Object.keys(WORD_PROBES).flatMap((rule, i) =>
    (WORD_PROBES[rule] as string[]).map((_, j) => `${wordFile(i, j)}: ${rule}`),
  );
  expect(sorted(wordsIn(`${USER}/words`, bannedWords(PROBE)))).toEqual(sorted(expected));
});

test('every BANNED word has a probe, so dropping or adding one cannot pass unnoticed', () => {
  // Guards the test above. The probes are keyed by the rule's own text.
  expect(sorted(BANNED.map(String))).toEqual(sorted(Object.keys(WORD_PROBES)));
});

test('the banned-word rule reads copy in every position a customer can see text', () => {
  const expected = [
    ...COPY_PROBES.map(([f]) => `${USER}/copy/${f}: /Hermes/i`),
    ...Object.keys(ATTR_PROBES).flatMap((a) => [`${USER}/attrs/${a}.tsx: /Hermes/i`, `${USER}/attrs/${a}.html: /Hermes/i`]),
  ];
  const found = [...wordsIn(`${USER}/copy`, bannedWords(PROBE)), ...wordsIn(`${USER}/attrs`, bannedWords(PROBE))];
  expect(sorted(found)).toEqual(sorted(expected));
});

test('the readable attributes are exactly placeholder, aria-label, alt, title and label', () => {
  expect(sorted(READABLE_ATTRS)).toEqual(['alt', 'aria-label', 'label', 'placeholder', 'title']);
  expect(sorted(Object.keys(ATTR_PROBES))).toEqual(['alt', 'aria-label', 'label', 'placeholder', 'title']);
});

test('a sentence naming the MCP and a token is reported for both words', () => {
  expect(sorted(wordsIn(`${USER}/leak`, bannedWords(PROBE)))).toEqual([
    `${USER}/leak/Expired.tsx: /\\bMCP\\b/`,
    `${USER}/leak/Expired.tsx: /\\btokens?\\b/i`,
  ]);
});

test('the dead-palette rule catches each hex with its own probe, and only that hex', () => {
  const expected = Object.keys(PALETTE_PROBES).map((hex, i) => `${USER}/palette/p${i}.css: ${hex}`);
  expect(sorted(wordsIn(`${USER}/palette`, deadPalette(PROBE)))).toEqual(sorted(expected));
});

test('every DEAD_PALETTE hex has a probe', () => {
  expect(sorted(DEAD_PALETTE)).toEqual(sorted(Object.keys(PALETTE_PROBES)));
});

test('the card-grid rule catches each pattern with its own probe, and only that pattern', () => {
  const expected = Object.keys(GRID_PROBES).flatMap((rule, i) =>
    (GRID_PROBES[rule] as string[]).map((_, j) => `${gridFile(i, j)}: ${rule}`),
  );
  expect(sorted(wordsIn(`${USER}/grids`, cardGrids(PROBE)))).toEqual(sorted(expected));
});

test('every CARD_GRID pattern has a probe', () => {
  expect(sorted(CARD_GRID.map(String))).toEqual(sorted(Object.keys(GRID_PROBES)));
});

test('the colour rule catches each hex length, colour function, named colour and SVG fill', () => {
  const found = wordsIn(`${USER}/colours`, colourLiterals(PROBE));
  expect(sorted(found)).toEqual(sorted(COLOUR_PROBES.map(([f, , hit]) => `${USER}/colours/${f}: ${hit}`)));
});

test('the colour rule allows var(), transparent, currentColor, keywords, anchors and gradient ids', () => {
  expect(colourLiterals(PROBE).filter((f) => f.includes('/clean/'))).toEqual([]);
});

test('the named-colour list is exactly the CSS named colours, and each one is caught', () => {
  expect(sorted(NAMED_COLOURS)).toEqual(sorted(EXPECTED_NAMED));
  const found = wordsIn(`${USER}/named`, colourLiterals(PROBE));
  expect(sorted(found)).toEqual(sorted(EXPECTED_NAMED.map((c) => `${USER}/named/all.css: color: ${c}`)));
});

test('real Stream A shapes are near misses: each trips a cruder rule, so quiet is not an accident', () => {
  for (const [file, body, naive] of QUIET_PROBES) {
    expect(naive.test(body), `${file} would not have tripped the cruder rule, so it proves nothing`).toBe(true);
  }
});

test('real Stream A shapes produce no findings from any rule', () => {
  const all = everyFinding(PROBE);
  for (const [file] of QUIET_PROBES) {
    expect(
      all.filter((f) => f.startsWith(`${USER}/quiet/${file}:`)),
      `${file} is correct code and must stay quiet`,
    ).toEqual([]);
  }
});

test('every quiet probe is in the quiet directory and was scanned', () => {
  // A probe in a skipped place would be quiet for the wrong reason.
  const scanned = customerFiles(PROBE).filter((f) => f.startsWith(`${USER}/quiet/`));
  expect(sorted(scanned)).toEqual(
    sorted([
      'tokens-module.ts', 'Chip.tsx', 'Props.ts', 'Icon.tsx', 'Selectors.ts', 'page.html', 'comments.ts', 'Keys.ts',
      'Attrs.tsx', 'Paths.ts', 'Compare.tsx', 'Operators.tsx', 'Scale.ts', 'theme.css', 'theme.json', 'Kpi.ts',
      'Order.tsx', 'Placeholder.tsx', 'order.html', 'order.css', 'order.json',
    ].map((f) => `${USER}/quiet/${f}`)),
  );
});

test('every code extension is scanned', () => {
  const hits = bannedWords(PROBE);
  for (const ext of ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.mts', '.cts', '.css', '.html', '.svg', '.json']) {
    expect(
      hits.some((h) => h.startsWith(`dashboards/src/apps/org-admin/ext/probe${ext}:`)),
      `${ext} files are not scanned`,
    ).toBe(true);
  }
});

test('every CODE extension has a probe, so adding one cannot pass unnoticed', () => {
  expect(sorted(CODE)).toEqual(sorted(Object.keys(EXT_PROBES)));
});

test('every customer directory is scanned', () => {
  const hits = bannedWords(PROBE);
  const hit = (file: string) => hits.some((h) => h.startsWith(`${file}:`));
  expect(hit(`${USER}/Contest.tsx`), 'dashboards/src/apps/user is not scanned').toBe(true);
  expect(hit('dashboards/src/apps/org-admin/Leak.tsx'), 'dashboards/src/apps/org-admin is not scanned').toBe(true);
  expect(hit('dashboards/src/shared/Leak.tsx'), 'dashboards/src/shared is not scanned').toBe(true);
});

test('the fleet app, other file types, test fixtures and clean files are left alone', () => {
  const everything = everyFinding(PROBE);
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
  expect(screensExist(makeRoot({ 'dashboards/src/apps/user/Contest.tsx': 'x' }))).toBe(true);
  expect(screensExist(makeRoot({ 'dashboards/src/apps/org-admin/deep/er/Page.tsx': 'x' }))).toBe(true);
  expect(screensExist(makeRoot({ 'dashboards/src/apps/fleet/Table.tsx': 'x' }))).toBe(true);
  // Foundation code is not a screen.
  expect(screensExist(makeRoot({ 'dashboards/src/shared/Button.tsx': 'x' }))).toBe(false);
  expect(screensExist(makeRoot({ 'dashboards/src/apps/user/helper.ts': 'x' }))).toBe(false);
  expect(screensExist(makeRoot({ 'dashboards/src/other/Home.tsx': 'x' }))).toBe(false);
});

test('test and story files never arm the tripwire, even inside apps', () => {
  // Written out, one root each, so each exclusion is pinned on its own.
  const notScreens = [
    'dashboards/src/apps/user/Home.test.tsx',
    'dashboards/src/apps/user/Home.spec.tsx',
    'dashboards/src/apps/user/Home.stories.tsx',
    'dashboards/src/apps/user/Home.story.tsx',
    'dashboards/src/apps/user/__tests__/Home.tsx',
    'dashboards/src/apps/user/__fixtures__/Home.tsx',
  ];
  for (const f of notScreens) expect(screensExist(makeRoot({ [f]: 'x' })), f).toBe(false);
  // And a real screen beside a test file still arms it.
  expect(
    screensExist(makeRoot({ 'dashboards/src/apps/user/Home.test.tsx': 'x', 'dashboards/src/apps/user/Home.tsx': 'x' })),
  ).toBe(true);
});

test('the tripwire wires the gate to the rule, so the real-tree test can fail once screens exist', () => {
  // The real tree has no screens yet, so only a probe can show the gate and the
  // rule are connected.
  const withScreen = makeRoot({ 'dashboards/src/apps/user/Home.tsx': 'x' });
  const withoutScreen = makeRoot({ 'dashboards/src/shared/Button.tsx': 'x' });
  const onlyTest = makeRoot({ 'dashboards/src/apps/user/Home.test.tsx': 'x' });
  const none = () => undefined;
  expect(tripwireProblems(withScreen, none)).toEqual([
    'dashboards/user/index.html: missing',
    'dashboards/org-admin/index.html: missing',
    'dashboards/fleet/index.html: missing',
  ]);
  expect(tripwireProblems(withoutScreen, none)).toEqual([]);
  expect(tripwireProblems(onlyTest, none)).toEqual([]);
  expect(tripwireProblems(withScreen, goodTitle)).toEqual([]);
});

test('prose with parentheses or a slash is still copy', () => {
  expect(sorted(wordsIn(`${USER}/prose`, bannedWords(PROBE)))).toEqual([
    `${USER}/prose/Parens.tsx: /adapter/i`,
    `${USER}/prose/Slash.tsx: /Hermes/i`,
    `${USER}/prose/Slash.tsx: /Paperclip/i`,
    `${USER}/prose/slash-string.ts: /Hermes/i`,
    `${USER}/prose/slash-string.ts: /Paperclip/i`,
    `${USER}/prose/slash.json: /Hermes/i`,
    `${USER}/prose/slash.json: /Paperclip/i`,
    `${USER}/prose/spaced-slash.ts: /\\btokens?\\b/i`,
  ]);
});

// The path shapes, written out. Each sample matches exactly one rule, and the
// rule list must match this copy in both directions.
const PATH_SAMPLES: [string, string][] = [
  ['./adapter-chip', '/^\\.\\//'],
  ['../adapter-chip', '/^\\.\\.\\//'],
  ['@scope/adapter', '/^@[\\w-]*\\//'],
  ['/api/adapter', '/^\\//'],
  ['https://adapter.example', '/^[a-z][a-z0-9+.-]*:\\/\\//i'],
  ['design/adapter.css', '/^\\S+\\/\\S*\\.[A-Za-z0-9]{1,5}$/'],
];

test('the path shapes are exactly these six, each matching on its own', () => {
  expect(sorted(PATH_SHAPED.map(String))).toEqual(sorted(PATH_SAMPLES.map(([, rule]) => rule)));
  for (const [sample, rule] of PATH_SAMPLES) {
    expect(PATH_SHAPED.filter((r) => r.test(sample)).map(String), sample).toEqual([rule]);
    expect(isPathShaped(sample), sample).toBe(true);
  }
});

test('prose is not path-shaped', () => {
  for (const prose of ['Hermes/Paperclip', 'and/or tokens', 'Adapter / token', 'Yes/No']) {
    expect(isPathShaped(prose), prose).toBe(false);
  }
});
