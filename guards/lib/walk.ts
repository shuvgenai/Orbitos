import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { join, sep } from 'node:path';
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

/** Read a repo-relative file as text. */
export const readRepoFile = (rel: string) => readFileSync(join(REPO_ROOT, rel), 'utf8');

let tracked: string[] | undefined;

/**
 * Paths git tracks, POSIX-separated and relative to the repo root. Memoized.
 *
 * Asking git rather than walking the working tree means an untracked local file
 * cannot fail a guard here while the same guard passes in CI.
 */
export function trackedFiles(): string[] {
  tracked ??= execFileSync('git', ['ls-files', '-z'], { cwd: REPO_ROOT, encoding: 'utf8' })
    .split('\0')
    .filter(Boolean);
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
   * Directory names skipped at every depth. Defaults to node_modules and .git.
   * These have to match at depth because pnpm creates a node_modules inside
   * every workspace package, so a root-only rule would walk all of them.
   */
  skipAnywhere?: readonly string[];
  /** Lowercase extensions including the dot. Omit to take every file. */
  extensions?: readonly string[];
  /**
   * Absolute directory to walk from, and the base the returned paths are
   * relative to. Defaults to the repo root.
   *
   * This exists so this helper's own tests can build a throwaway tree outside
   * the repo. Writing one inside it raced the other guards: vitest runs test
   * files in parallel, so another guard walked the probe and then read it after
   * the probe was deleted.
   */
  root?: string;
};

const DEFAULT_SKIP_ANYWHERE = ['node_modules', '.git'] as const;

const walkCache = new Map<string, string[]>();

/**
 * Every file under `dir`, POSIX-separated and relative to the repo root.
 *
 * Memoized per distinct call, so several guards in one test run do not each
 * re-walk the tree. Symlinked directories are not followed: withFileTypes
 * reports them as neither a file nor a directory, which also means a symlink
 * loop cannot hang the walk.
 */
export function walkFiles(dir: string, options: WalkOptions = {}): string[] {
  const skipAnywhere = options.skipAnywhere ?? DEFAULT_SKIP_ANYWHERE;
  const base = options.root ?? REPO_ROOT;
  const key = [
    base,
    dir,
    (options.skipAtRoot ?? []).join(','),
    skipAnywhere.join(','),
    (options.extensions ?? []).join(','),
  ].join('\u0000');

  const hit = walkCache.get(key);
  if (hit) return hit;

  const atRoot = new Set(options.skipAtRoot ?? []);
  const anywhere = new Set(skipAnywhere);
  const out: string[] = [];

  const recurse = (rel: string, depth: number): void => {
    let entries;
    try {
      entries = readdirSync(join(base, rel), { withFileTypes: true });
    } catch (err) {
      // A missing directory is tolerated, because a guard armed before its code
      // exists has to pass. Anything else throws: a swallowed EACCES or broken
      // link is a guard that quietly stopped checking and still reports green.
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') return;
      throw err;
    }

    for (const entry of entries) {
      const child = rel ? `${rel}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        if (anywhere.has(entry.name)) continue;
        if (depth === 0 && atRoot.has(entry.name)) continue;
        recurse(child, depth + 1);
      } else if (entry.isFile()) {
        const name = entry.name.toLowerCase();
        if (!options.extensions || options.extensions.some((e) => name.endsWith(e))) out.push(child);
      }
    }
  };

  const start = toPosix(dir);
  recurse(start === '.' ? '' : start, 0);
  walkCache.set(key, out);
  return out;
}

/**
 * Case-sensitive existence check for a repo-relative path.
 *
 * existsSync ignores case on Windows and respects it on Linux, so a document
 * citing reference/orbit-os-frontend/Assets/... passes on one machine and fails
 * in CI. Comparing each segment against its directory listing behaves the same
 * on both, which is what a guard needs.
 */
export function existsExact(rel: string): boolean {
  const parts = toPosix(rel).split('/').filter(Boolean);
  if (parts.length === 0) return false;

  let cursor = '';
  for (const part of parts) {
    let entries: string[];
    try {
      entries = readdirSync(join(REPO_ROOT, cursor));
    } catch {
      return false;
    }
    if (!entries.includes(part)) return false;
    cursor = cursor ? `${cursor}/${part}` : part;
  }
  return true;
}
