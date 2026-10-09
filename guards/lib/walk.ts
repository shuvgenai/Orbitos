import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { isAbsolute, join, posix, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * The repo root.
 *
 * fileURLToPath rather than URL.pathname, because pathname leaves a path with
 * spaces or non-ASCII characters percent-encoded and every later join then
 * points at a directory that does not exist.
 */
export const REPO_ROOT = fileURLToPath(new URL('../../', import.meta.url));

const toPosix = (p: string) => p.split(sep).join('/');

const isErrno = (err: unknown, code: string) => (err as NodeJS.ErrnoException).code === code;

declare const rootedBrand: unique symbol;

/**
 * A path relative to some other root, as returned by walkFilesIn. It is a
 * distinct type so that handing one to readRepoFile does not typecheck.
 *
 * Without this, a path relative to a temp directory could be passed to the
 * repo-rooted reader and silently read a different file, or fail with ENOENT.
 */
export type RootedPath = string & { readonly [rootedBrand]: true };

/** Any string that is not a RootedPath. Plain strings and walkFiles results qualify. */
export type RepoRelative = string & { readonly [rootedBrand]?: never };

/** Read a repo-relative file as text. Takes the output of walkFiles, never walkFilesIn. */
export const readRepoFile = (rel: RepoRelative) => readFileSync(join(REPO_ROOT, rel), 'utf8');

/** Read a file named by a walkFilesIn result, from the same root that walk used. */
export const readFileIn = (root: string, rel: RootedPath) => readFileSync(join(root, rel), 'utf8');

let tracked: readonly string[] | undefined;

/**
 * Paths git tracks, POSIX-separated and relative to the repo root. Memoized
 * within one test file. Read-only: the array is shared by every caller.
 *
 * Asking git rather than walking the working tree means an untracked local file
 * cannot fail a guard here while the same guard passes in CI.
 *
 * A path listed here can still be missing on disk, when it was deleted but the
 * deletion is not staged. Callers that read these paths must expect ENOENT.
 */
export function trackedFiles(): readonly string[] {
  tracked ??= Object.freeze(
    execFileSync('git', ['ls-files', '-z'], { cwd: REPO_ROOT, encoding: 'utf8' })
      .split('\0')
      .filter(Boolean),
  );
  return tracked;
}

export type WalkOptions = {
  /**
   * Directory names skipped only at the top of this walk. Use this for project
   * directories a guard should ignore wholesale, such as reference or archive.
   * A nested directory of the same name is still scanned, which is the point:
   * docs/reference/ is not the prototype and must not be silently exempt.
   */
  skipAtRoot?: readonly string[];
  /**
   * Directory names skipped at every depth, ADDED to node_modules and .git,
   * which are always skipped. Those two have to match at depth because pnpm
   * creates a node_modules inside every workspace package, so a root-only rule
   * would walk all of them. Passing a list can only skip more, never less.
   */
  skipAnywhere?: readonly string[];
  /** Lowercase extensions including the dot. Omit to take every file. An empty list takes none. */
  extensions?: readonly string[];
};

const ALWAYS_SKIPPED = ['node_modules', '.git'] as const;

// Vitest isolates modules per test file, so each guard file gets its own copy
// of this map. The cache dedupes repeated calls inside ONE test file. It does
// not share work between guard files, and nothing here should claim it does.
const walkCache = new Map<string, readonly string[]>();

/**
 * Turn a caller's `dir` into a clean POSIX path relative to `base`, or '' for
 * the base itself. Accepts './guards', 'guards/', and an absolute path under
 * base. Throws on a path that leaves base, because that is never intended and a
 * silent [] would let a guard pass while checking nothing.
 */
function normaliseDir(base: string, dir: string): string {
  const rel = isAbsolute(dir) ? relative(base, dir) : dir;
  // relative() returns an absolute path when the two are on different drives.
  if (isAbsolute(rel)) throw new Error(`walk: "${dir}" is not under ${base}`);
  const clean = posix.normalize(toPosix(rel)).replace(/\/+$/, '');
  if (clean === '..' || clean.startsWith('../')) throw new Error(`walk: "${dir}" is not under ${base}`);
  return clean === '.' ? '' : clean;
}

function walk(base: string, dir: string, options: WalkOptions): readonly string[] {
  const start = normaliseDir(base, dir);
  const atRoot = options.skipAtRoot ?? [];
  const anywhere = [...ALWAYS_SKIPPED, ...(options.skipAnywhere ?? [])];

  // JSON, not a joined string. Joining made [] and undefined share a key, and
  // ['.a,.b'] collide with ['.a', '.b'], so one caller got another's answer.
  // undefined means every file and [] means none, so they stay distinct as null
  // and [].
  const key = JSON.stringify([base, start, atRoot, anywhere, options.extensions ?? null]);
  const hit = walkCache.get(key);
  if (hit) return hit;

  const atRootSet = new Set(atRoot);
  const anywhereSet = new Set(anywhere);
  const out: string[] = [];

  const recurse = (rel: string, depth: number): void => {
    let entries;
    try {
      entries = readdirSync(join(base, rel), { withFileTypes: true });
    } catch (err) {
      // A missing directory is tolerated, because a guard armed before its code
      // exists has to pass. Anything else throws: a swallowed EACCES or ENOTDIR
      // is a guard that quietly stopped checking and still reports green.
      if (isErrno(err, 'ENOENT')) return;
      throw err;
    }

    for (const entry of entries) {
      const child = rel ? `${rel}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        if (anywhereSet.has(entry.name)) continue;
        if (depth === 0 && atRootSet.has(entry.name)) continue;
        recurse(child, depth + 1);
      } else if (entry.isFile()) {
        const name = entry.name.toLowerCase();
        if (!options.extensions || options.extensions.some((e) => name.endsWith(e))) out.push(child);
      }
      // Anything else is skipped without a word. That covers sockets, and it
      // also covers symlinks: withFileTypes reports a symlink as neither a file
      // nor a directory, whether it points at a file, a directory or nothing.
      // So a broken link does NOT throw, and a symlinked file is invisible to
      // every guard. Not following links is deliberate for directories, because
      // it means a link loop cannot hang the walk. This limitation is untested:
      // creating a symlink needs elevation on Windows, and a test that needs it
      // would make the suite depend on the machine it runs on.
    }
  };

  recurse(start, 0);
  const result = Object.freeze(out);
  walkCache.set(key, result);
  return result;
}

/**
 * Every file under `dir`, POSIX-separated and relative to the repo root.
 *
 * `dir` may be '.', './x', 'x/' or an absolute path under the repo. The result
 * is read-only and shared: it is memoized, so a caller that mutated it would
 * corrupt every later call in the same test file. The memoization is per test
 * file, not per test run, because vitest isolates modules per file.
 *
 * Known limitation: symlinks are not followed and symlinked files are not
 * reported. See the comment inside the walk.
 */
export function walkFiles(dir: string, options: WalkOptions = {}): readonly string[] {
  return walk(REPO_ROOT, dir, options);
}

/**
 * The same walk from another root. Exists so this helper's own tests can build
 * a throwaway tree OUTSIDE the repo. Writing one inside it raced the other
 * guards: vitest runs test files in parallel, so another guard walked the probe
 * and then read it after the probe was deleted.
 *
 * Returns RootedPath, not string. These paths are relative to `root`, so they
 * go to readFileIn(root, ...) and cannot be passed to readRepoFile.
 */
export function walkFilesIn(root: string, dir: string, options: WalkOptions = {}): readonly RootedPath[] {
  return walk(root, dir, options) as readonly RootedPath[];
}

/**
 * Case-sensitive existence check for a repo-relative path.
 *
 * existsSync ignores case on Windows and respects it on Linux, so a document
 * citing reference/orbit-os-frontend/Assets/... passes on one machine and fails
 * in CI. Comparing each segment against its directory listing makes both
 * platforms agree with each other.
 *
 * What it checks is the case ON DISK. It does not check the case git has
 * indexed. With core.ignorecase on (the default on Windows and macOS), a
 * case-only rename can leave git holding the old casing while the disk shows
 * the new one. This passes on that machine and a case-sensitive CI checkout,
 * which has the old casing, would fail.
 *
 * Only a missing entry means "does not exist". Any other error rethrows, for
 * the same reason the walk does: a guard that treats EACCES as "absent" goes
 * quiet and stays green. That includes ENOTDIR, so 'package.json/x' throws
 * rather than returning false.
 */
export function existsExact(rel: string): boolean {
  const parts = toPosix(rel).split('/').filter(Boolean);
  if (parts.length === 0) return false;

  let cursor = '';
  for (const part of parts) {
    let entries: string[];
    try {
      entries = readdirSync(join(REPO_ROOT, cursor));
    } catch (err) {
      if (isErrno(err, 'ENOENT')) return false;
      throw err;
    }
    if (!entries.includes(part)) return false;
    cursor = cursor ? `${cursor}/${part}` : part;
  }
  return true;
}
