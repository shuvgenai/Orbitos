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
// The directory is matched as one exact path segment, never as a substring.
// docs/reference/ is a live distinction that guards/lib/walk.ts:65 exists to
// keep, and a substring rule would fail on it.
//
// Everything is read from a structured position: copy argument lists, parsed
// YAML values, the scripts object, imported config values. Never a whole-file
// grep. These files carry 30-line comment blocks, a grep would fire on them,
// and a guard that fires on a comment gets switched off and takes its real
// rules with it.
import { execFileSync } from 'node:child_process';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { expect, test } from 'vitest';
import { parse } from 'yaml';
import { REPO_ROOT, readRepoFile, trackedFiles } from './lib/walk.ts';

/** The directory this guard protects. One segment, compared exactly. */
const PROTECTED = 'reference';

/**
 * Whether a path token names the top-level reference/ directory.
 *
 * The first segment has to be the whole word, so docs/reference/deep.md,
 * references/ and my-reference/ are all false. Surrounding quotes, a leading
 * ./ and a leading ! are stripped, because the surfaces that carry them write
 * the same path three different ways. Backslashes fold to forward slashes: a
 * Dockerfile is POSIX only, but a package.json script written on Windows is
 * not.
 *
 * The token is cut at its first colon, because a compose volume in short
 * syntax is `./reference:/site:ro` and the host path is the field before the
 * first colon. Without the cut the first segment reads `reference:` and the
 * one surface that mounts a directory by name is the one surface this misses.
 * A Windows drive letter is cut the same way and yields `C`, which is not this
 * directory, so the cut cannot create a false positive.
 */
export function namesReference(token: string): boolean {
  const bare = token
    .trim()
    .replace(/^["'`]+/, '')
    .replace(/["'`]+$/, '')
    .replace(/^!/, '')
    .split(':')[0] ?? '';
  const segments = bare.split(/[\\/]+/).filter((part) => part !== '' && part !== '.');
  return segments[0] === PROTECTED;
}
/**
 * Every whitespace-delimited token of a value that is a path or a command.
 *
 * Loose on purpose. These values are never prose, so `cp -r reference dist`
 * has to be a finding.
 */
export function commandOffenders(value: string): readonly string[] {
  return value.split(/\s+/).filter((token) => token !== '' && namesReference(token));
}

/**
 * Offenders in a free-form string, without firing on prose.
 *
 * A token counts only when it carries a separator, or when the whole trimmed
 * value is the path itself. Without that rule a workflow step named "Run
 * reference checks" is a finding, and a guard that fires on correct prose gets
 * switched off.
 *
 * The cost is a known miss: a slash-free token in the middle of a
 * sentence-shaped value is not reported. Command-bearing keys do not come
 * through here, so the miss needs a command hidden under a key that is not one
 * of them. The probes below pin both halves of this.
 */
export function proseSafeOffenders(value: string): readonly string[] {
  const whole = value.trim();
  if (!/\s/.test(whole)) return namesReference(whole) ? [whole] : [];
  return whole.split(/\s+/).filter((token) => /[\\/]/.test(token) && namesReference(token));
}

test('the matcher takes the prototype and leaves docs/reference alone', () => {
  for (const token of [
    'reference',
    'reference/',
    './reference',
    'reference/orbit-os-frontend',
    'reference/orbit-os-frontend/assets/data/people.js',
    '"reference"',
    '!reference',
    'reference\\orbit-os-frontend',
    // A compose volume in short syntax. The host path is the field before the
    // first colon, and this is the one surface that mounts a directory by name.
    './reference:/site:ro',
    'reference/orbit-os-frontend:/site',
  ]) {
    expect(namesReference(token), `${token} names the prototype`).toBe(true);
  }

  for (const token of [
    'docs/reference',
    'docs/reference/deep.md',
    'references',
    'references/',
    'my-reference',
    'dashboards/reference',
    'shared',
    '',
    '.',
    '../reference',
    'C:/reference',
    'docs/reference:/site:ro',
  ]) {
    expect(namesReference(token), `${token} does not name the prototype`).toBe(false);
  }
});

test('a command value is scanned loosely and a prose value is not', () => {
  expect(commandOffenders('cp -r reference dist')).toEqual(['reference']);
  expect(commandOffenders('npx http-server reference/orbit-os-frontend -p 8080')).toEqual([
    'reference/orbit-os-frontend',
  ]);
  expect(commandOffenders('cp -r docs/reference dist')).toEqual([]);

  expect(proseSafeOffenders('reference')).toEqual(['reference']);
  expect(proseSafeOffenders('upload reference/orbit-os-frontend as static files')).toEqual([
    'reference/orbit-os-frontend',
  ]);
  // The documented miss. A slash-free token inside a sentence is left alone, so
  // that a step named after the prototype is not a finding.
  expect(proseSafeOffenders('Run reference checks')).toEqual([]);
  expect(proseSafeOffenders('check the docs/reference notes')).toEqual([]);
});

/** A COPY or ADD instruction and its argument list. Docker instructions are case insensitive. */
const COPY_LINE = /^(?:COPY|ADD)\s+(.+)$/gim;

/**
 * Offending copy arguments in one Dockerfile's text.
 *
 * Line continuations are joined first, so a source written on the second line
 * of a wrapped instruction is seen. Flags are dropped. A --from source names a
 * build stage rather than the context, so it cannot be this directory in
 * practice; it is checked anyway, because over-reporting here costs nothing and
 * a quiet skip is how a guard goes green while checking less than it says.
 *
 * The destination is checked too. A copy writing into a path called reference
 * inside an image is not finding H1, but it is close enough that a person
 * should look.
 */
export function dockerfileOffenders(text: string): readonly string[] {
  const joined = text.replace(/\\\r?\n/g, ' ');
  return [...joined.matchAll(COPY_LINE)].flatMap((match) =>
    (match[1] ?? '')
      .split(/\s+/)
      .filter((argument) => argument !== '' && !argument.startsWith('--'))
      .filter((argument) => namesReference(argument)),
  );
}

/**
 * What is wrong with one .dockerignore's text, as a list of complaints.
 *
 * Two rules. The file has to exclude this directory, because
 * template/compose.yml builds with `context: ..` and the whole repository goes
 * to the daemon on every stack:up; without the entry a later whole-context copy
 * ships the prototype and nothing says a word. And no line may re-include it
 * with a negation, because the last matching pattern in a Docker ignore file
 * wins.
 *
 * Only a pattern whose first segment is the directory counts as excluding it. A
 * glob form would work in Docker and does NOT satisfy this rule. That is
 * deliberate: accepting more forms means reasoning about Docker's pattern
 * precedence, which this guard does not do, and the plain form is the one the
 * file already uses for landing, archive and docs.
 */
export function dockerignoreComplaints(text: string): readonly string[] {
  const lines = text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '' && !line.startsWith('#'));

  const complaints: string[] = [];
  if (!lines.some((line) => !line.startsWith('!') && namesReference(line))) {
    complaints.push(`no line excludes ${PROTECTED}/`);
  }
  for (const line of lines) {
    if (line.startsWith('!') && namesReference(line)) complaints.push(`${line} re-includes ${PROTECTED}/`);
  }
  return complaints;
}

test('a copy naming the prototype is reported, and a comment is not', () => {
  expect(dockerfileOffenders('COPY reference reference\n')).toEqual(['reference', 'reference']);
  expect(dockerfileOffenders('ADD reference/orbit-os-frontend /site\n')).toEqual([
    'reference/orbit-os-frontend',
  ]);
  // A wrapped copy. The source is on the second line, and a line-by-line scan
  // would miss it.
  expect(dockerfileOffenders('COPY \\\n  reference /site\n')).toEqual(['reference']);
  // A flag is not a path.
  expect(dockerfileOffenders('COPY --from=build reference /site\n')).toEqual(['reference']);

  expect(dockerfileOffenders('# COPY reference /site\n')).toEqual([]);
  expect(dockerfileOffenders('COPY docs/reference /site\n')).toEqual([]);
  expect(dockerfileOffenders('COPY shared shared\nCOPY db/package.json db/\n')).toEqual([]);
});

test('a docker ignore file that drops the prototype, or takes it back, is reported', () => {
  expect(dockerignoreComplaints('landing\narchive\nreference\n')).toEqual([]);
  expect(dockerignoreComplaints('# reference is handled elsewhere\nlanding\n')).toEqual([
    'no line excludes reference/',
  ]);
  expect(dockerignoreComplaints('reference\n!reference/orbit-os-frontend\n')).toEqual([
    '!reference/orbit-os-frontend re-includes reference/',
  ]);
  // Review Focus 4. A glob form would work in Docker and does not satisfy this
  // rule, because the rule does not reason about pattern precedence. The plain
  // form is the one the file already uses.
  expect(dockerignoreComplaints('landing\n**/reference\n')).toEqual(['no line excludes reference/']);
  // docs/reference/ is not this directory, so it proves nothing either way.
  expect(dockerignoreComplaints('docs/reference\n')).toEqual(['no line excludes reference/']);
});

/**
 * Keys whose values are paths or commands, so their tokens get the loose scan.
 *
 * Everything not listed here is scanned prose-safely. A key added to this list
 * widens what is reported, never narrows it.
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
]);

/**
 * Offenders anywhere in one parsed YAML document.
 *
 * `key` is the mapping key the current value sits under, and it chooses the
 * scan. An array inherits its parent's key, so each entry of a volumes list is
 * treated as a path.
 *
 * Comments are already gone: parse() returns values only. That is deliberate
 * and recorded in the probes. A comment ships nothing.
 */
export function yamlOffenders(node: unknown, key?: string): readonly string[] {
  if (typeof node === 'string') {
    const found = key !== undefined && PATH_KEYS.has(key) ? commandOffenders(node) : proseSafeOffenders(node);
    return found.map((token) => (key === undefined ? token : `${key}: ${token}`));
  }
  if (Array.isArray(node)) return node.flatMap((child) => yamlOffenders(child, key));
  if (node !== null && typeof node === 'object') {
    return Object.entries(node).flatMap(([childKey, child]) => yamlOffenders(child, childKey));
  }
  return [];
}

/**
 * Offenders in one package.json's scripts.
 *
 * A script value is a command, never prose, so the loose scan is right here. A
 * scripts field that is present but not an object throws rather than being
 * skipped: this guard cannot reason about it, and going quiet is how a guard
 * reports green while checking nothing.
 */
export function scriptOffenders(json: string): readonly string[] {
  const parsed: unknown = JSON.parse(json);
  const scripts = (parsed as { scripts?: unknown }).scripts;
  if (scripts === undefined) return [];
  if (scripts === null || typeof scripts !== 'object' || Array.isArray(scripts)) {
    throw new Error('scripts is present but is not an object');
  }
  return Object.entries(scripts).flatMap(([name, value]) =>
    typeof value === 'string' ? commandOffenders(value).map((token) => `${name}: ${token}`) : [],
  );
}

/**
 * The classes of tracked file this guard reads, and the pattern that finds each.
 *
 * Discovery is through trackedFiles(), so an untracked local override is
 * invisible here. That is the same choice guards/lib/walk.ts:46 makes, for the
 * same reason: an untracked scratch file must not fail a guard locally while
 * CI passes. It is Review Focus 3 of the plan, and it is stated in the
 * decisions entry.
 *
 * Each floor is the count in this repository on 2026-10-09. It is a floor and
 * not an equality, so adding a surface is not a failure and losing one is.
 */
const SURFACES = [
  { name: 'dockerfile', pattern: /(^|\/)Dockerfile$/, floor: 2 },
  { name: 'dockerignore', pattern: /(^|\/)\.dockerignore$/, floor: 1 },
  { name: 'compose', pattern: /(^|\/)[^/]*compose[^/]*\.ya?ml$/, floor: 2 },
  { name: 'workflow', pattern: /^\.github\/workflows\/[^/]+\.ya?ml$/, floor: 1 },
  { name: 'manifest', pattern: /(^|\/)package\.json$/, floor: 9 },
  { name: 'vite', pattern: /(^|\/)vite\.config\.[cm]?[jt]s$/, floor: 1 },
  { name: 'playwright', pattern: /(^|\/)playwright\.config\.[cm]?[jt]s$/, floor: 1 },
] as const;

/** Tracked files of one class. node_modules is excluded: those manifests are not ours. */
const filesOf = (pattern: RegExp): readonly string[] =>
  trackedFiles().filter((file) => pattern.test(file) && !file.includes('node_modules/'));

/**
 * A tracked file's text, falling back to the index when it is gone from disk.
 *
 * git lists a file it still tracks after an unstaged delete, and reading the
 * disk then throws. Without the fallback this guard crashes on somebody's
 * half-finished delete while CI, which has a clean checkout, passes. That is
 * the failure guards/lib/walk.ts:46 exists to avoid, and
 * guards/paths.test.ts:43 already solves it this way. The fallback is not a
 * silent skip: the committed content is still checked, which is what this
 * guard is about. Any error other than a missing file propagates.
 */
function readTracked(rel: string): string {
  try {
    return readRepoFile(rel);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
    return execFileSync('git', ['show', `:${rel}`], { cwd: REPO_ROOT, encoding: 'utf8' });
  }
}

test('a YAML artifact path, served root or volume naming the prototype is reported', () => {
  expect(yamlOffenders(parse('jobs:\n  e2e:\n    steps:\n      - with:\n          path: reference\n'))).toEqual([
    'path: reference',
  ]);
  expect(
    yamlOffenders(
      parse('jobs:\n  e2e:\n    steps:\n      - with:\n          path: |\n            reference/orbit-os-frontend\n'),
    ),
  ).toEqual(['path: reference/orbit-os-frontend']);
  expect(yamlOffenders(parse('jobs:\n  e2e:\n    steps:\n      - run: npx http-server reference -p 8080\n'))).toEqual([
    'run: reference',
  ]);
  expect(yamlOffenders(parse('services:\n  web:\n    volumes:\n      - ./reference:/site:ro\n'))).toEqual([
    'volumes: ./reference:/site:ro',
  ]);

  // A comment is not a finding. parse() drops comments, so this is structural
  // rather than a rule, and the probe records it.
  expect(
    yamlOffenders(parse('jobs:\n  e2e:\n    # deploy reference/orbit-os-frontend one day\n    steps: []\n')),
  ).toEqual([]);
  // Prose under a key that is not a path key is left alone.
  expect(yamlOffenders(parse('jobs:\n  e2e:\n    steps:\n      - name: Run reference checks\n'))).toEqual([]);
  // Review Focus 2. The documented miss: a command under a key that is not a
  // path key, with no separator on the token.
  expect(yamlOffenders(parse('jobs:\n  e2e:\n    steps:\n      - shell: cp -r reference dist\n'))).toEqual([]);
  // The same command under a path key IS reported.
  expect(yamlOffenders(parse('jobs:\n  e2e:\n    steps:\n      - run: cp -r reference dist\n'))).toEqual([
    'run: reference',
  ]);

  expect(yamlOffenders(parse('jobs:\n  e2e:\n    steps:\n      - with:\n          path: docs/reference\n'))).toEqual([]);
});

test('a package script naming the prototype is reported', () => {
  expect(scriptOffenders('{"scripts":{"preview":"npx http-server reference -p 8080"}}')).toEqual([
    'preview: reference',
  ]);
  expect(scriptOffenders('{"scripts":{"build":"cp -r reference/orbit-os-frontend dist"}}')).toEqual([
    'build: reference/orbit-os-frontend',
  ]);
  expect(scriptOffenders('{"scripts":{"lint":"eslint ."}}')).toEqual([]);
  expect(scriptOffenders('{"scripts":{"docs":"cp -r docs/reference out"}}')).toEqual([]);
  expect(scriptOffenders('{"name":"x"}')).toEqual([]);
});
