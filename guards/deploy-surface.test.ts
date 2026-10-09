// No build or deploy surface names the prototype.
//
// Written because of finding H1 of the 2026-10-09 security review.
// reference/orbit-os-frontend/ holds the founder's mailbox, the founder's name
// and office.orbitumai.com labelled customer zero, and its README line 11 says
// to upload the whole folder as static files. The read-only investigation of
// 2026-10-09 found no path from this repository to that outcome: CI runs no
// deploy step, the Dockerfile has no whole-context copy, Vite's root is
// dashboards/ and its fs.allow names dashboards/ and design/ only. This guard
// is what keeps that true.
//
// It removes no identifier and does not claim to. The folder is read-only by
// the ruling at docs/prd/ORBIT_OS_PRD_v9_0.md:731, so the addresses stay where
// they are, and anybody who serves the folder by hand still publishes them.
// What this guard stops is the machine doing it.
//
// A token is RESOLVED, never matched on its first path segment. The first
// version of this file compared the first segment, which made `../reference`
// from template/compose.yml or from any of the eight workspace manifests
// return false: a bind mount or a serve script one directory down published
// the prototype and this guard reported green. Finding F1 of the whole-branch
// review of 2026-10-09. Resolution also makes the rule more precise, not only
// wider: a bare `reference` inside dashboards/ is dashboards/reference and is
// correctly not a finding.
//
// The directory each token resolves against depends on the class, because the
// tools disagree. A workflow step runs in the workspace root, so its paths are
// repo-root relative however deep the file sits. A compose volume, a package
// script and a Dockerfile copy are relative to their own file's directory.
// Getting this wrong in either direction is a hole, so baseFor() states it
// once and a test pins it.
//
// Everything is read from a structured position: instruction argument lists,
// parsed YAML values, the scripts object, imported config values. Never a
// whole-file grep. These files carry 30-line comment blocks, a grep would fire
// on them, and a guard that fires on a comment gets switched off and takes its
// real rules with it.
import { execFileSync } from 'node:child_process';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { expect, test } from 'vitest';
import { parseAllDocuments } from 'yaml';
import { REPO_ROOT, readRepoFile, trackedFiles } from './lib/walk.ts';

/** The directory this guard protects, relative to the repository root. */
const PROTECTED = 'reference';

/**
 * One extracted token reduced to the bare path it names, or '' when it names
 * none.
 *
 * Four normalisations, each for a form found in this repository's own files or
 * in the review that prompted them:
 *
 * - A flag that carries its value, `--directory=reference` or
 *   `source=reference`. Everything up to the last `=` goes. Without this the
 *   `--directory=` spelling of `python3 -m http.server`, which is the exact
 *   habit the 2026-10-09 log entry records as a habit to change, passed the
 *   guard. Finding F2.
 * - JSON-array and shell punctuation: `["reference",` and `reference;` and
 *   `reference,`. Docker's array copy form and the `;` command separator both
 *   produced tokens that no rule matched. Findings F8 and F10.
 * - A volume or mount in short syntax, `./reference:/site:ro`, whose host path
 *   is the field before the first colon. The cut starts at index 2 so a
 *   Windows drive letter survives as `C:`, which names no directory here.
 * - Backslashes fold to forward slashes. A Dockerfile is POSIX only, but a
 *   package script written on Windows is not.
 */
export function barePath(token: string): string {
  let bare = token.trim();
  if (bare.includes('=')) bare = bare.slice(bare.lastIndexOf('=') + 1);
  bare = bare.replace(/^[[({'"`!]+/, '').replace(/[\])},;:'"`]+$/, '');
  bare = bare.split('\\').join('/');
  const colon = bare.indexOf(':');
  if (colon > 1) bare = bare.slice(0, colon);
  return bare.trim();
}

/**
 * Whether a token, read from a surface whose paths are relative to `baseDir`,
 * resolves to the protected directory or to anything inside it.
 *
 * `baseDir` is repo-relative, and '' is the repository root. See baseFor().
 *
 * The comparison is case insensitive on both sides, deliberately and on every
 * platform. A case-only variant such as `Reference` is a different directory
 * on a Linux CI checkout and the same one on a Windows checkout, and the
 * machine that matters for the unbound-server habit is the second. Comparing
 * case insensitively can only report more, never less.
 */
export function resolvesIntoProtected(baseDir: string, token: string): boolean {
  const bare = barePath(token);
  if (bare === '') return false;

  const target = isAbsolute(bare) ? bare : resolve(join(REPO_ROOT, baseDir), bare);
  const rel = relative(join(REPO_ROOT, PROTECTED).toLowerCase(), target.toLowerCase());
  return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel));
}

/**
 * Every whitespace-delimited token of a value that is a path or a command,
 * each reduced by barePath.
 *
 * Loose on purpose. These values are never prose, so `cp -r reference dist`
 * has to be a finding.
 */
export function commandTokens(value: string): readonly string[] {
  return value
    .split(/\s+/)
    .map((token) => barePath(token))
    .filter((token) => token !== '');
}

/**
 * Tokens from a free-form string, without firing on prose.
 *
 * A token counts only when it carries a separator, or when the whole trimmed
 * value is the path itself. Without that rule a workflow step named "Run
 * reference checks" is a finding, and a guard that fires on correct prose gets
 * switched off.
 *
 * The cost is the recorded miss: a separator-free token in the middle of a
 * sentence-shaped value is not reported. Command-bearing keys do not come
 * through here, so the miss needs a command hidden under a key that is not one
 * of them. The probes below pin both halves of this.
 */
export function proseSafeTokens(value: string): readonly string[] {
  const whole = value.trim();
  if (!/\s/.test(whole)) {
    const bare = barePath(whole);
    return bare === '' ? [] : [bare];
  }
  return value
    .split(/\s+/)
    .filter((token) => /[\\/]/.test(token))
    .map((token) => barePath(token))
    .filter((token) => token !== '');
}

/** A COPY, ADD or RUN instruction and its argument list. Docker allows leading whitespace. */
const INSTRUCTION = /^[ \t]*(COPY|ADD|RUN)\b(.*)$/i;

/** A BuildKit mount, whose source field reads the build context. */
const MOUNT = /--mount=(\S+)/g;

/**
 * Every path a Dockerfile's text names as something it reads from the build
 * context.
 *
 * Comments are dropped BEFORE continuations are joined. Docker does not
 * continue a comment, so joining first turned
 *
 *     # keep in sync \
 *     COPY reference /site
 *
 * into one commented line and hid a copy that Docker executes. Finding F8, and
 * the cheapest deliberate bypass in that review.
 *
 * RUN is read for one reason only: `--mount=type=bind,source=...` reads the
 * context with no copy instruction at all. Its other arguments are not context
 * paths and are not collected, so a RUN that merely mentions a word is not a
 * finding.
 *
 * A copy's destination is collected along with its sources. A copy writing
 * into a path called reference inside an image is not finding H1, but it is
 * close enough that a person should look.
 */
export function dockerfileTokens(text: string): readonly string[] {
  const uncommented = text
    .split('\n')
    .filter((line) => !/^[ \t]*#/.test(line))
    .join('\n');
  const joined = uncommented.replace(/\\\r?\n/g, ' ');

  const out: string[] = [];
  for (const line of joined.split('\n')) {
    const match = INSTRUCTION.exec(line);
    if (match === null) continue;
    const verb = (match[1] ?? '').toUpperCase();
    const args = match[2] ?? '';

    if (verb === 'RUN') {
      for (const mount of args.matchAll(MOUNT)) {
        for (const field of (mount[1] ?? '').split(',')) {
          const [name, value] = field.split('=');
          if ((name === 'source' || name === 'src' || name === 'from') && value !== undefined) {
            const bare = barePath(value);
            if (bare !== '') out.push(bare);
          }
        }
      }
      continue;
    }

    out.push(...commandTokens(args));
  }
  return out;
}

/**
 * Whether a glob segment matches a literal name the way Docker's matcher
 * would. `*` stops at a separator, `?` is one character, everything else is
 * literal. Case insensitive, for the reason given on resolvesIntoProtected.
 */
function globSegmentMatches(glob: string, name: string): boolean {
  const source = [...glob]
    .map((char) => (char === '*' ? '[^/]*' : char === '?' ? '[^/]' : char.replace(/[.+^${}()|[\]\\]/, '\\$&')))
    .join('');
  return new RegExp(`^${source}$`, 'i').test(name);
}

/**
 * Whether a Docker ignore pattern could reach the protected directory.
 *
 * Used for negations, where the question is not "is this the directory" but
 * "could Docker apply this to the directory", because the last matching
 * pattern wins. A negation spelled `!reference*`, `!ref*`, or with a leading
 * globstar segment, all put the folder back into every build context while a
 * strict spelling check reported nothing. Finding F3.
 */
export function patternCouldMatch(pattern: string): boolean {
  const segments = pattern
    .replace(/^!/, '')
    .trim()
    .split('\\')
    .join('/')
    .replace(/\/+$/, '')
    .split('/')
    .filter((part) => part !== '' && part !== '.');

  if (segments.length === 0) return false;
  // A leading globstar matches at any depth, so the question moves to the next
  // segment. A pattern that is nothing but a globstar matches everything.
  const first = segments[0] === '**' ? segments[1] : segments[0];
  if (first === undefined) return true;
  return globSegmentMatches(first, PROTECTED);
}

/** Whether a non-negated ignore pattern names the protected directory outright. */
function excludesProtected(pattern: string): boolean {
  const segments = pattern
    .split('\\')
    .join('/')
    .replace(/\/+$/, '')
    .split('/')
    .filter((part) => part !== '' && part !== '.');
  return segments[0]?.toLowerCase() === PROTECTED;
}

/**
 * What is wrong with one Docker ignore file's text, as a list of complaints.
 *
 * Two rules. The file has to exclude this directory, because
 * template/compose.yml builds with `context: ..` and the whole repository goes
 * to the daemon on every stack:up; without the entry a later whole-context
 * copy ships the prototype and nothing says a word. And no line may re-include
 * it, by any pattern Docker would honour.
 *
 * Rule one stays strict on purpose: only a pattern whose first segment is the
 * directory counts as excluding it, so a glob form does NOT satisfy it even
 * though Docker would honour one. Accepting more forms there means reasoning
 * about precedence in the direction where being wrong fails open, and the
 * plain form is the one this repository already uses for landing and archive.
 * Rule two is the opposite case and so is glob aware: being wrong there also
 * fails open, and the cost of over-reporting is one reviewable line.
 */
export function dockerignoreComplaints(text: string): readonly string[] {
  const lines = text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '' && !line.startsWith('#'));

  const complaints: string[] = [];
  if (!lines.some((line) => !line.startsWith('!') && excludesProtected(line))) {
    complaints.push(`no line excludes ${PROTECTED}/`);
  }
  for (const line of lines) {
    if (line.startsWith('!') && patternCouldMatch(line)) complaints.push(`${line} re-includes ${PROTECTED}/`);
  }
  return complaints;
}

/**
 * Keys whose values are paths or commands, so their tokens get the loose scan.
 *
 * Everything not listed here is scanned prose-safely. A key added here widens
 * what is reported, never narrows it.
 */
const PATH_KEYS: ReadonlySet<string> = new Set([
  'run',
  'command',
  'entrypoint',
  'args',
  'path',
  'paths',
  'working-directory',
  'cwd',
  'context',
  'dockerfile',
  'volumes',
  'env_file',
  'publish',
]);

/** Offenders anywhere in one already-parsed YAML value. */
function walkYaml(baseDir: string, node: unknown, key: string | undefined): readonly string[] {
  if (typeof node === 'string') {
    const tokens = key !== undefined && PATH_KEYS.has(key) ? commandTokens(node) : proseSafeTokens(node);
    return tokens
      .filter((token) => resolvesIntoProtected(baseDir, token))
      .map((token) => (key === undefined ? token : `${key}: ${token}`));
  }
  if (Array.isArray(node)) return node.flatMap((child) => walkYaml(baseDir, child, key));
  if (node !== null && typeof node === 'object') {
    return Object.entries(node).flatMap(([childKey, child]) => walkYaml(baseDir, child, childKey));
  }
  return [];
}

/**
 * Offenders in one YAML file's text, across every document in it.
 *
 * parseAllDocuments, not parse. parse() returns the FIRST document and only
 * pushes a warning for the rest, so everything after a separator went
 * unchecked, and the hand-rolled separator detector that stood in for this
 * missed a separator carrying a trailing comment and fired falsely on a
 * separator inside a block scalar. Finding F7.
 *
 * A parse error throws rather than being skipped. A file this cannot read is a
 * file it cannot judge, and going quiet is how a guard reports green while
 * checking nothing.
 *
 * Comments are gone either way: a document's JS form holds values only. That
 * is deliberate and the probes record it. A comment ships nothing.
 */
export function yamlOffenders(baseDir: string, text: string): readonly string[] {
  const out: string[] = [];
  for (const document of parseAllDocuments(text)) {
    const failure = document.errors[0];
    if (failure !== undefined) throw new Error(`YAML did not parse: ${failure.message}`);
    out.push(...walkYaml(baseDir, document.toJS(), undefined));
  }
  return out;
}

/**
 * Offenders in one package.json's scripts.
 *
 * A script value is a command, never prose, so the loose scan is right here. A
 * scripts field that is present but not an object throws rather than being
 * skipped, for the reason yamlOffenders throws.
 */
export function scriptOffenders(baseDir: string, json: string): readonly string[] {
  const parsed: unknown = JSON.parse(json);
  const scripts = (parsed as { scripts?: unknown }).scripts;
  if (scripts === undefined) return [];
  if (scripts === null || typeof scripts !== 'object' || Array.isArray(scripts)) {
    throw new Error('scripts is present but is not an object');
  }
  return Object.entries(scripts).flatMap(([name, value]) =>
    typeof value === 'string'
      ? commandTokens(value)
          .filter((token) => resolvesIntoProtected(baseDir, token))
          .map((token) => `${name}: ${token}`)
      : [],
  );
}

/** Offending context paths in one Dockerfile. */
export function dockerfileOffenders(baseDir: string, text: string): readonly string[] {
  return dockerfileTokens(text).filter((token) => resolvesIntoProtected(baseDir, token));
}

/**
 * The classes of tracked file this guard reads, the pattern that finds each,
 * and whether its paths are relative to the repository root or to the file.
 *
 * Discovery is through trackedFiles(), so an untracked local override is
 * invisible here. That is the same choice guards/lib/walk.ts:46 makes, for the
 * same reason: an untracked scratch file must not fail a guard locally while
 * CI passes. It is stated in the 2026-10-09 decisions entry.
 *
 * Each floor is the count in this repository on 2026-10-09. It is a floor and
 * not an equality, so adding a surface is not a failure and losing one is.
 *
 * The name patterns are wider than the files that exist today, on purpose.
 * `Dockerfile.prod`, `prod.Dockerfile` and `Containerfile` are Dockerfiles;
 * `Dockerfile.dockerignore` is the per-Dockerfile ignore file that BuildKit
 * prefers over `.dockerignore`, so one that omits the folder restores it to
 * the context; and a composite action under `.github/actions/` is the workflow
 * class one directory over. Findings F4, F8 and F11.
 */
const SURFACES = [
  {
    name: 'dockerfile',
    pattern:
      /(^|\/)(?:Dockerfile|Containerfile)(?:\.(?!dockerignore$)[^/]*)?$|(^|\/)[^/]*\.(?:Dockerfile|Containerfile)$/,
    base: 'file',
    floor: 2,
  },
  { name: 'dockerignore', pattern: /(^|\/)[^/]*\.dockerignore$/, base: 'file', floor: 1 },
  { name: 'compose', pattern: /(^|\/)[^/]*compose[^/]*\.ya?ml$/, base: 'file', floor: 2 },
  { name: 'workflow', pattern: /^\.github\/(?:workflows\/[^/]+|actions\/.+\/action)\.ya?ml$/, base: 'root', floor: 1 },
  { name: 'manifest', pattern: /(^|\/)package\.json$/, base: 'file', floor: 9 },
  { name: 'vite', pattern: /(^|\/)vite\.config\.[cm]?[jt]s$/, base: 'file', floor: 1 },
  { name: 'playwright', pattern: /(^|\/)playwright\.config\.[cm]?[jt]s$/, base: 'file', floor: 1 },
] as const;

/**
 * The directory one surface's paths are relative to, repo-relative.
 *
 * A workflow step runs in the workspace root and an artifact path is taken
 * from there, so a workflow's paths are root relative however deep the file
 * sits. A compose volume, a package script, a Dockerfile copy and a bundler
 * config are relative to their own file. Resolving a workflow against its own
 * directory would put `path: reference` at .github/workflows/reference and
 * miss it, which is the mirror image of finding F1.
 */
export function baseFor(surface: (typeof SURFACES)[number], file: string): string {
  if (surface.base === 'root') return '';
  const dir = dirname(file);
  return dir === '.' ? '' : dir;
}

/** Tracked files of one class. node_modules is excluded: those manifests are not ours. */
const filesOf = (pattern: RegExp): readonly string[] =>
  trackedFiles().filter((file) => pattern.test(file) && !file.includes('node_modules/'));

const surfaceNamed = (name: string): (typeof SURFACES)[number] => {
  const found = SURFACES.find((surface) => surface.name === name);
  if (found === undefined) throw new Error(`no surface class named ${name}`);
  return found;
};

/**
 * A tracked file's text, falling back to the index when it is gone from disk.
 *
 * git lists a file it still tracks after an unstaged delete, and reading the
 * disk then throws. Without the fallback this guard crashes on somebody's
 * half-finished delete while CI, which has a clean checkout, passes. That is
 * the failure guards/lib/walk.ts:46 exists to avoid, and
 * guards/paths.test.ts:43 already solves it this way. readRepoFile calls
 * readFileSync directly, so its error is a native one carrying .code.
 */
function readTracked(rel: string): string {
  try {
    return readRepoFile(rel);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
    return execFileSync('git', ['show', `:${rel}`], { cwd: REPO_ROOT, encoding: 'utf8' });
  }
}

// ---------------------------------------------------------------------------
// Probes on synthetic input. These are what make this guard fail on demand
// rather than only once by hand. Each names the finding or the form it pins.
// ---------------------------------------------------------------------------

test('a token is judged against the surface it was read from, so ../reference is caught', () => {
  // Finding F1, the bypass this guard exists to prevent. template/ and the
  // eight workspace manifests are not at the repository root, so a token there
  // that climbs one directory names the prototype. The first version compared
  // the first path segment and returned false for every one of these.
  expect(resolvesIntoProtected('template', '../reference')).toBe(true);
  expect(resolvesIntoProtected('template', '../reference:/site:ro')).toBe(true);
  expect(resolvesIntoProtected('dashboards', '../reference/orbit-os-frontend')).toBe(true);
  expect(resolvesIntoProtected('template/engine', '../../reference')).toBe(true);
  expect(resolvesIntoProtected('dashboards', '../reference/orbit-os-frontend/fleet/index.html')).toBe(true);

  // The same spelling read from the root IS the prototype.
  expect(resolvesIntoProtected('', 'reference')).toBe(true);
  expect(resolvesIntoProtected('', './reference')).toBe(true);
  expect(resolvesIntoProtected('', 'reference/orbit-os-frontend/assets/data/people.js')).toBe(true);
  expect(resolvesIntoProtected('', '"reference"')).toBe(true);
  expect(resolvesIntoProtected('', 'reference\\orbit-os-frontend')).toBe(true);

  // A bare name read from a subdirectory is that subdirectory's own path, which
  // is a precision the first version did not have.
  expect(resolvesIntoProtected('dashboards', 'reference')).toBe(false);
  expect(resolvesIntoProtected('template', 'reference')).toBe(false);

  // Neighbours that must stay out of it.
  expect(resolvesIntoProtected('', 'docs/reference')).toBe(false);
  expect(resolvesIntoProtected('', 'docs/reference/deep.md')).toBe(false);
  expect(resolvesIntoProtected('', 'reference-old')).toBe(false);
  expect(resolvesIntoProtected('', 'references')).toBe(false);
  expect(resolvesIntoProtected('', 'shared')).toBe(false);
  expect(resolvesIntoProtected('', '')).toBe(false);
  expect(resolvesIntoProtected('', '.')).toBe(false);
  // Outside the repository altogether.
  expect(resolvesIntoProtected('', '../reference')).toBe(false);
});

test('a workflow resolves from the repository root and a compose file from its own directory', () => {
  // The mirror image of F1. An artifact path and a run step are taken from the
  // workspace root however deep the workflow sits, so resolving a workflow
  // against its own directory would miss `path: reference` entirely.
  const workflow = surfaceNamed('workflow');
  const compose = surfaceNamed('compose');

  expect(baseFor(workflow, '.github/workflows/ci.yml')).toBe('');
  expect(baseFor(workflow, '.github/actions/deploy/action.yml')).toBe('');
  expect(resolvesIntoProtected(baseFor(workflow, '.github/workflows/ci.yml'), 'reference')).toBe(true);

  expect(baseFor(compose, 'compose.dev.yml')).toBe('');
  expect(baseFor(compose, 'template/compose.yml')).toBe('template');
  expect(resolvesIntoProtected(baseFor(compose, 'template/compose.yml'), '../reference')).toBe(true);
  expect(resolvesIntoProtected(baseFor(compose, 'template/compose.yml'), 'reference')).toBe(false);
});

test('a path behind an = flag, or carrying shell punctuation, or in odd case, is found', () => {
  // Findings F2 and F10. --directory= is the natural spelling of the very
  // habit the 2026-10-09 log entry records as a habit to change.
  expect(commandTokens('python3 -m http.server 8080 --directory=reference')).toContain('reference');
  expect(commandTokens('npx wrangler pages deploy --directory=reference')).toContain('reference');
  expect(commandTokens('npx netlify deploy --prod --dir=reference/orbit-os-frontend')).toContain(
    'reference/orbit-os-frontend',
  );
  expect(commandTokens('docker run --volume=./reference:/site nginx')).toContain('./reference');
  // Trailing shell punctuation. The && spelling was caught and this was not.
  expect(commandTokens('(cd reference; python3 -m http.server)')).toContain('reference');
  expect(commandTokens('cp -r reference, dist')).toContain('reference');
  // A case-insensitive checkout is where the unbound server habit happens.
  expect(resolvesIntoProtected('', 'Reference')).toBe(true);
  expect(resolvesIntoProtected('', 'REFERENCE/orbit-os-frontend')).toBe(true);
});

test('a command value is scanned loosely and a prose value is not', () => {
  expect(commandTokens('cp -r reference dist')).toContain('reference');
  expect(commandTokens('npx http-server reference/orbit-os-frontend -p 8080')).toContain(
    'reference/orbit-os-frontend',
  );
  expect(commandTokens('cp -r docs/reference dist').filter((t) => resolvesIntoProtected('', t))).toEqual([]);

  expect(proseSafeTokens('reference')).toEqual(['reference']);
  expect(proseSafeTokens('upload reference/orbit-os-frontend as static files')).toEqual([
    'reference/orbit-os-frontend',
  ]);
  // The recorded miss. A separator-free token inside a sentence is left alone,
  // so that a step named after the prototype is not a finding.
  expect(proseSafeTokens('Run reference checks')).toEqual([]);
  expect(proseSafeTokens('check the docs/reference notes').filter((t) => resolvesIntoProtected('', t))).toEqual([]);
});

test('every copy form a real Dockerfile can use is read', () => {
  // Finding F8.
  expect(dockerfileOffenders('', 'COPY reference reference\n')).toEqual(['reference', 'reference']);
  expect(dockerfileOffenders('', 'ADD reference/orbit-os-frontend /site\n')).toEqual(['reference/orbit-os-frontend']);
  // Documented JSON-array form, required when a path carries a space.
  expect(dockerfileOffenders('', 'COPY ["reference", "/site"]\n')).toEqual(['reference']);
  // A BuildKit bind mount reads the build context with no copy instruction.
  expect(dockerfileOffenders('', 'RUN --mount=type=bind,source=reference,target=/site cp -r /site /app\n')).toEqual([
    'reference',
  ]);
  // Docker allows leading whitespace before an instruction.
  expect(dockerfileOffenders('', '  COPY reference /site\n')).toEqual(['reference']);
  // A wrapped copy, whose source is on the second line.
  expect(dockerfileOffenders('', 'COPY \\\n  reference /site\n')).toEqual(['reference']);
  // A comment ending in a backslash does NOT continue in Docker, so the copy
  // below it runs. Joining continuations before dropping comments hid it.
  expect(dockerfileOffenders('', '# keep in sync \\\nCOPY reference /site\n')).toEqual(['reference']);
  // A flag is not a path, and a stage name is not this directory.
  expect(dockerfileOffenders('', 'COPY --from=build reference /site\n')).toEqual(['reference']);

  // Not findings.
  expect(dockerfileOffenders('', '# COPY reference /site\n')).toEqual([]);
  expect(dockerfileOffenders('', 'COPY docs/reference /site\n')).toEqual([]);
  expect(dockerfileOffenders('', 'COPY shared shared\nCOPY db/package.json db/\n')).toEqual([]);
  // A RUN that merely mentions the word reads no context path.
  expect(dockerfileOffenders('', 'RUN echo reference\n')).toEqual([]);
  // A copy in template/engine/ names that directory, not the repository root.
  expect(dockerfileOffenders('template/engine', 'COPY reference /site\n')).toEqual([]);
  expect(dockerfileOffenders('template/engine', 'COPY ../../reference /site\n')).toEqual(['../../reference']);
});

test('a docker ignore file that drops the prototype, or takes it back by any pattern, is reported', () => {
  expect(dockerignoreComplaints('landing\narchive\nreference\n')).toEqual([]);
  expect(dockerignoreComplaints('# reference is handled elsewhere\nlanding\n')).toEqual([
    'no line excludes reference/',
  ]);
  expect(dockerignoreComplaints('reference\n!reference/orbit-os-frontend\n')).toEqual([
    '!reference/orbit-os-frontend re-includes reference/',
  ]);
  // Finding F3. A glob negation Docker would honour.
  expect(dockerignoreComplaints('reference\n!reference*\n')).toEqual(['!reference* re-includes reference/']);
  expect(dockerignoreComplaints('reference\n!**/reference\n')).toEqual(['!**/reference re-includes reference/']);
  expect(dockerignoreComplaints('reference\n!ref*\n')).toEqual(['!ref* re-includes reference/']);
  expect(dockerignoreComplaints('reference\n!referenc?\n')).toEqual(['!referenc? re-includes reference/']);
  // A negation that cannot reach the folder is not a complaint.
  expect(dockerignoreComplaints('reference\n!docs/reference\n')).toEqual([]);
  expect(dockerignoreComplaints('reference\n!**/.env.example\n')).toEqual([]);
  expect(dockerignoreComplaints('reference\n!landing\n')).toEqual([]);
  // Rule one stays strict: a glob does not prove exclusion, by design.
  expect(dockerignoreComplaints('landing\n**/reference\n')).toEqual(['no line excludes reference/']);
  expect(dockerignoreComplaints('docs/reference\n')).toEqual(['no line excludes reference/']);
});

test('the surface patterns cover the files that actually carry these rules', () => {
  // Findings F4, F8 and F11. None of these files exists in this repository
  // today, which is why the patterns and not the floors have to carry it.
  const matches = (name: string, file: string): boolean => surfaceNamed(name).pattern.test(file);

  // BuildKit prefers <dockerfile>.dockerignore over .dockerignore, so one that
  // omits the folder puts it back into the context.
  expect(matches('dockerignore', '.dockerignore')).toBe(true);
  expect(matches('dockerignore', 'Dockerfile.dockerignore')).toBe(true);
  expect(matches('dockerignore', 'template/engine/Dockerfile.dockerignore')).toBe(true);

  // A differently named Dockerfile is still a Dockerfile.
  expect(matches('dockerfile', 'Dockerfile')).toBe(true);
  expect(matches('dockerfile', 'Dockerfile.prod')).toBe(true);
  expect(matches('dockerfile', 'prod.Dockerfile')).toBe(true);
  expect(matches('dockerfile', 'Containerfile')).toBe(true);
  expect(matches('dockerfile', 'template/engine/Dockerfile')).toBe(true);
  // The ignore file is not itself a Dockerfile, or both classes would read it
  // and the ignore file's patterns would be judged as copy paths.
  expect(matches('dockerfile', 'Dockerfile.dockerignore')).toBe(false);
  expect(matches('dockerfile', 'dockerfiles/README.md')).toBe(false);

  // A local composite action is the covered kind, one directory over.
  expect(matches('workflow', '.github/workflows/ci.yml')).toBe(true);
  expect(matches('workflow', '.github/actions/deploy/action.yml')).toBe(true);
  expect(matches('workflow', '.github/actions/deploy/action.yaml')).toBe(true);
  expect(matches('workflow', 'docs/workflows/notes.yml')).toBe(false);

  // Compose, in its spellings and at depth.
  expect(matches('compose', 'compose.dev.yml')).toBe(true);
  expect(matches('compose', 'docker-compose.yaml')).toBe(true);
  expect(matches('compose', 'template/compose.yml')).toBe(true);
});

test('a YAML artifact path, served root or volume naming the prototype is reported', () => {
  expect(yamlOffenders('', 'jobs:\n  e2e:\n    steps:\n      - with:\n          path: reference\n')).toEqual([
    'path: reference',
  ]);
  expect(
    yamlOffenders(
      '',
      'jobs:\n  e2e:\n    steps:\n      - with:\n          path: |\n            reference/orbit-os-frontend\n',
    ),
  ).toEqual(['path: reference/orbit-os-frontend']);
  expect(yamlOffenders('', 'jobs:\n  e2e:\n    steps:\n      - run: npx http-server reference -p 8080\n')).toEqual([
    'run: reference',
  ]);
  expect(yamlOffenders('', 'services:\n  web:\n    volumes:\n      - ./reference:/site:ro\n')).toEqual([
    'volumes: ./reference',
  ]);
  // Finding F1 through the compose path: one directory down, climbing one up.
  expect(yamlOffenders('template', 'services:\n  web:\n    volumes:\n      - ../reference:/site:ro\n')).toEqual([
    'volumes: ../reference',
  ]);
  // Long syntax, under a key that is not a path key, caught by the whole-value
  // branch of the prose-safe scan.
  expect(
    yamlOffenders('template', 'services:\n  web:\n    volumes:\n      - type: bind\n        source: ../reference\n'),
  ).toEqual(['source: ../reference']);

  // A comment is not a finding. A document's JS form holds values only, so
  // this is structural rather than a rule, and the probe records it.
  expect(yamlOffenders('', 'jobs:\n  e2e:\n    # deploy reference/orbit-os-frontend one day\n    steps: []\n')).toEqual(
    [],
  );
  // Prose under a key that is not a path key is left alone.
  expect(yamlOffenders('', 'jobs:\n  e2e:\n    steps:\n      - name: Run reference checks\n')).toEqual([]);
  // The recorded miss: a command under a key that is not a path key, with no
  // separator on the token.
  expect(yamlOffenders('', 'jobs:\n  e2e:\n    steps:\n      - shell: cp -r reference dist\n')).toEqual([]);
  // The same command under a path key IS reported.
  expect(yamlOffenders('', 'jobs:\n  e2e:\n    steps:\n      - run: cp -r reference dist\n')).toEqual([
    'run: reference',
  ]);
  expect(yamlOffenders('', 'jobs:\n  e2e:\n    steps:\n      - with:\n          path: docs/reference\n')).toEqual([]);
});

test('every document of a multi-document YAML file is read', () => {
  // Finding F7. parse() returned the FIRST document and only warned, so
  // everything after a separator went unchecked, and the hand-rolled detector
  // that stood in for this missed a separator carrying a trailing comment.
  const twoDocs = 'name: one\n--- # second\njobs:\n  d:\n    steps:\n      - run: cp -r reference dist\n';
  expect(yamlOffenders('', twoDocs)).toEqual(['run: reference']);
  // A separator inside a block scalar is not a second document, and must not
  // make the guard throw on a valid file.
  const blockScalar = 'jobs:\n  d:\n    steps:\n      - run: |\n          echo ---\n          echo ok\n';
  expect(yamlOffenders('', blockScalar)).toEqual([]);
  // A file this cannot parse throws rather than passing on nothing.
  expect(() => yamlOffenders('', 'a: [\n')).toThrow(/YAML did not parse/);
});

test('a package script naming the prototype is reported', () => {
  expect(scriptOffenders('', '{"scripts":{"preview":"npx http-server reference -p 8080"}}')).toEqual([
    'preview: reference',
  ]);
  expect(scriptOffenders('', '{"scripts":{"build":"cp -r reference/orbit-os-frontend dist"}}')).toEqual([
    'build: reference/orbit-os-frontend',
  ]);
  // Finding F1 through the manifest path: pnpm runs a workspace script with
  // that workspace as the working directory.
  expect(
    scriptOffenders('dashboards', '{"scripts":{"proto":"npx http-server ../reference/orbit-os-frontend"}}'),
  ).toEqual(['proto: ../reference/orbit-os-frontend']);
  expect(scriptOffenders('dashboards', '{"scripts":{"proto":"npx http-server reference"}}')).toEqual([]);
  expect(scriptOffenders('', '{"scripts":{"lint":"eslint ."}}')).toEqual([]);
  expect(scriptOffenders('', '{"scripts":{"docs":"cp -r docs/reference out"}}')).toEqual([]);
  expect(scriptOffenders('', '{"name":"x"}')).toEqual([]);
  expect(() => scriptOffenders('', '{"scripts":"nope"}')).toThrow(/not an object/);
});

// ---------------------------------------------------------------------------
// The real surfaces.
// ---------------------------------------------------------------------------

test('no tracked Dockerfile copies the prototype', () => {
  const surface = surfaceNamed('dockerfile');
  const offenders = filesOf(surface.pattern).flatMap((file) =>
    dockerfileOffenders(baseFor(surface, file), readTracked(file)).map((token) => `${file}: ${token}`),
  );

  expect(offenders, 'the image must not carry the prototype').toEqual([]);
});

test('every docker ignore file keeps the prototype out of its build context', () => {
  const surface = surfaceNamed('dockerignore');
  const complaints = filesOf(surface.pattern).flatMap((file) =>
    dockerignoreComplaints(readTracked(file)).map((complaint) => `${file}: ${complaint}`),
  );

  expect(
    complaints,
    'template/compose.yml builds with context: .., so the whole repository goes to the daemon',
  ).toEqual([]);
});

test('no tracked compose file or workflow names the prototype', () => {
  const classes = [surfaceNamed('compose'), surfaceNamed('workflow')];
  const offenders = classes.flatMap((surface) =>
    filesOf(surface.pattern).flatMap((file) =>
      yamlOffenders(baseFor(surface, file), readTracked(file)).map((token) => `${file}: ${token}`),
    ),
  );

  expect(offenders, 'no served root, volume or artifact path may be the prototype').toEqual([]);
});

test('no package script names the prototype', () => {
  const surface = surfaceNamed('manifest');
  const offenders = filesOf(surface.pattern).flatMap((file) =>
    scriptOffenders(baseFor(surface, file), readTracked(file)).map((token) => `${file}: ${token}`),
  );

  expect(offenders, 'no script may serve or copy the prototype').toEqual([]);
});

/**
 * Every directory one settled bundler config would read from or write to.
 *
 * The first version read `build.rollupOptions.input` and `server.fs.allow` and
 * nothing else, which left three ways to publish the folder unseen.
 * `publicDir` is copied verbatim into the output on every build, which is
 * literally the whole folder as static files. `root` changes what every
 * relative input resolves against, so reading inputs without reading root
 * judged a path the build never uses. `build.outDir` is where output lands.
 * Finding F6.
 *
 * A shape this cannot read throws rather than being skipped.
 */
export function viteDirectories(settled: unknown): readonly string[] {
  const config = (settled ?? {}) as {
    root?: unknown;
    publicDir?: unknown;
    build?: { outDir?: unknown; rollupOptions?: { input?: unknown } };
    server?: { fs?: { allow?: unknown } };
  };
  const out: string[] = [];
  const take = (value: unknown): void => {
    if (typeof value === 'string' && value !== '') out.push(value);
  };

  take(config.root);
  take(config.publicDir);
  take(config.build?.outDir);

  const input = config.build?.rollupOptions?.input;
  if (input !== undefined) {
    if (typeof input === 'string') take(input);
    else if (Array.isArray(input)) for (const entry of input) take(entry);
    else if (input !== null && typeof input === 'object') for (const entry of Object.values(input)) take(entry);
    else throw new Error('build.rollupOptions.input is neither a string, an array nor an object');
  }

  const allow = config.server?.fs?.allow;
  if (allow !== undefined) {
    if (!Array.isArray(allow)) throw new Error('server.fs.allow is not an array');
    for (const entry of allow) {
      if (typeof entry !== 'string') throw new Error('server.fs.allow holds a non-string entry');
      take(entry);
    }
  }

  return out;
}

test('a vite config publishes through more than its build inputs', () => {
  // Finding F6. Each of these is a real publish path the first version did not
  // read at all.
  expect(viteDirectories({ publicDir: '../reference/orbit-os-frontend' })).toContain('../reference/orbit-os-frontend');
  expect(viteDirectories({ root: '../reference/orbit-os-frontend' })).toContain('../reference/orbit-os-frontend');
  expect(viteDirectories({ build: { outDir: '../reference/out' } })).toContain('../reference/out');
  expect(viteDirectories({ build: { rollupOptions: { input: { a: 'user/index.html' } } } })).toContain(
    'user/index.html',
  );
  expect(viteDirectories({ build: { rollupOptions: { input: 'one.html' } } })).toContain('one.html');
  expect(viteDirectories({ build: { rollupOptions: { input: ['a.html', 'b.html'] } } })).toEqual(['a.html', 'b.html']);
  expect(viteDirectories({ server: { fs: { allow: ['/abs/x'] } } })).toContain('/abs/x');
  expect(viteDirectories({})).toEqual([]);
  expect(() => viteDirectories({ server: { fs: { allow: 'nope' } } })).toThrow(/not an array/);
});

/**
 * One config's default export, settled, for one command.
 *
 * Both commands are evaluated by the caller. A config shaped
 * `({ command }) => command === 'serve' ? ... : ...` would otherwise have one
 * branch never read, and the dev server is the branch that serves files.
 * Finding F6.
 */
async function settledConfig(config: string, command: 'build' | 'serve'): Promise<unknown> {
  const absolute = join(REPO_ROOT, config);
  const loaded: unknown = await import(pathToFileURL(absolute).href);
  const exported = (loaded as { default?: unknown }).default;
  return typeof exported === 'function'
    ? await (exported as (env: { command: string; mode: string }) => unknown)({
        command,
        mode: command === 'build' ? 'production' : 'development',
      })
    : await exported;
}

test('no vite config builds from the prototype, serves it, or copies it into an output', async () => {
  const surface = surfaceNamed('vite');
  const offenders: string[] = [];
  let checked = 0;

  for (const config of filesOf(surface.pattern)) {
    const base = baseFor(surface, config);
    for (const command of ['build', 'serve'] as const) {
      for (const entry of viteDirectories(await settledConfig(config, command))) {
        checked += 1;
        if (resolvesIntoProtected(base, entry)) offenders.push(`${config}: ${command} ${entry}`);
      }
    }
  }

  expect(offenders, 'the prototype is not a build input, a served directory or an output').toEqual([]);
  // Three inputs and two allow entries, read once per command, in the one
  // config this repository has today.
  expect(checked, 'no vite directory was examined').toBeGreaterThanOrEqual(10);
});

test('no playwright config serves the prototype', async () => {
  const surface = surfaceNamed('playwright');
  const offenders: string[] = [];
  let checked = 0;

  for (const config of filesOf(surface.pattern)) {
    const base = baseFor(surface, config);
    const typed = (await settledConfig(config, 'build')) as {
      testDir?: unknown;
      outputDir?: unknown;
      webServer?: readonly { command?: unknown; cwd?: unknown }[] | { command?: unknown; cwd?: unknown };
    };

    const servers = typed.webServer === undefined || typed.webServer === null ? [] : [typed.webServer].flat();
    const values: readonly unknown[] = [
      typed.testDir,
      typed.outputDir,
      ...servers.flatMap((server) => [server.command, server.cwd]),
    ];

    for (const value of values) {
      if (typeof value !== 'string') continue;
      checked += 1;
      for (const token of commandTokens(value)) {
        if (resolvesIntoProtected(base, token)) offenders.push(`${config}: ${token}`);
      }
    }
  }

  expect(offenders, 'no end-to-end server may serve the prototype').toEqual([]);
  // testDir plus two webServer commands in playwright.config.ts today.
  expect(checked, 'no playwright server command was examined').toBeGreaterThanOrEqual(3);
});

test('this guard examined every surface class, and enough of each', () => {
  // Every assertion above passes vacuously over zero files. A rename, a move or
  // a pattern that stopped matching would cause exactly that, and the guard
  // would stay green while checking nothing.
  const short = SURFACES.filter((surface) => filesOf(surface.pattern).length < surface.floor).map(
    (surface) => `${surface.name}: ${filesOf(surface.pattern).length} found, ${surface.floor} expected`,
  );

  expect(short, 'a surface class stopped matching, so this guard checks less than it says').toEqual([]);
});

test('the surface list is the seven classes that were reviewed, and no fewer', () => {
  // A deploy config of a kind nobody has modelled is invisible to this guard,
  // and the prototype README names Coolify, Netlify and Cloudflare Pages. This
  // assertion fires when an entry is REMOVED or RENAMED. It cannot see a new
  // file of an unmodelled kind appearing, and the 2026-10-09 decisions entry
  // says so rather than claiming a tripwire this does not provide. Written out
  // by hand, never looped from SURFACES, because a loop would shrink with the
  // list it is meant to pin.
  expect(SURFACES.map((surface) => surface.name)).toEqual([
    'dockerfile',
    'dockerignore',
    'compose',
    'workflow',
    'manifest',
    'vite',
    'playwright',
  ]);

  // The base each class resolves against is part of the rule, not an
  // implementation detail: a workflow read from its own directory misses
  // `path: reference`, and a compose file read from the root misses
  // `../reference`.
  expect(SURFACES.map((surface) => `${surface.name}:${surface.base}`)).toEqual([
    'dockerfile:file',
    'dockerignore:file',
    'compose:file',
    'workflow:root',
    'manifest:file',
    'vite:file',
    'playwright:file',
  ]);
});
