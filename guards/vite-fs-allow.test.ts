// No Vite dev server serves anything outside its own package.
//
// Written because of finding H1 of the 2026-10-08 security review. The shipped
// dashboards/vite.config.ts names two explicit directories, and its comment
// says why. Two committed plan documents told an implementer to name the parent
// instead, and nothing checked which of the two a future session would follow.
// `allow: ['..']` from dashboards/ reaches the repository root, which holds
// .env.local and db/, so the dev server would serve a credential file to
// anything that can reach the port.
//
// This guard resolves the list rather than grepping it. A text scan would pass
// on `allow: [join(ROOT, '..')]` and on an identifier defined three lines
// higher, which is exactly the shape this config already uses. Importing the
// config and reading what its entries resolve to is the only check that cannot
// be satisfied by renaming a variable.
//
// It deliberately does NOT require fs.allow to be present. A config that leaves
// it unset gets Vite's own behaviour, which confines the server to its root.
// Setting the list is what turns that off, so the rule is about what a set list
// may contain.
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { expect, test } from 'vitest';
import { REPO_ROOT, trackedFiles } from './lib/walk.ts';

const VITE_CONFIG = /(^|\/)vite\.config\.[cm]?[jt]s$/;

/** Tracked Vite configs. One today; the guard is written for however many there are. */
const configs = () => trackedFiles().filter((file) => VITE_CONFIG.test(file) && !file.includes('node_modules/'));

/**
 * Whether `target` is strictly inside the repository.
 *
 * Strictly: the repository root itself is false. Serving the root is the
 * finding this guard exists for, and `relative()` returns '' for it, which a
 * `startsWith('..')` check alone would read as inside.
 */
function strictlyInsideRepo(target: string): boolean {
  const rel = relative(REPO_ROOT, target);
  return rel !== '' && !rel.startsWith('..') && !isAbsolute(rel);
}

/**
 * The resolved fs.allow list for one config, or undefined when it sets none.
 *
 * A relative entry resolves against the directory holding the config, which is
 * what Vite does with its default root. A config that moved `root` elsewhere
 * would make this resolution wrong in the safe direction: it would compare
 * against a shallower directory and so reject more, never less.
 */
async function allowList(config: string): Promise<readonly string[] | undefined> {
  const absolute = join(REPO_ROOT, config);
  const loaded: unknown = await import(pathToFileURL(absolute).href);
  const exported = (loaded as { default?: unknown }).default;

  // defineConfig passes its argument through, but the type it returns also
  // covers a function and a promise, and a config may legitimately be either.
  const settled =
    typeof exported === 'function'
      ? await (exported as (env: { command: string; mode: string }) => unknown)({
          command: 'serve',
          mode: 'development',
        })
      : await exported;

  const allow = (settled as { server?: { fs?: { allow?: unknown } } } | undefined)?.server?.fs?.allow;
  if (allow === undefined) return undefined;

  // A non-array, or an entry that is not a string, throws rather than skipping:
  // this guard cannot reason about it, and going quiet is how a guard reports
  // green while checking nothing.
  if (!Array.isArray(allow)) throw new Error(`${config}: server.fs.allow is not an array`);

  return allow.map((entry: unknown) => {
    if (typeof entry !== 'string') throw new Error(`${config}: server.fs.allow holds a non-string entry`);
    return isAbsolute(entry) ? entry : resolve(dirname(absolute), entry);
  });
}

test('no vite config lets its dev server reach the repository root or anything outside it', async () => {
  const offenders: string[] = [];
  let checked = 0;

  for (const config of configs()) {
    const allow = await allowList(config);
    if (allow === undefined) continue;

    for (const entry of allow) {
      checked += 1;
      if (strictlyInsideRepo(entry)) continue;
      // The resolved path, not the source text. The source may read '..' or an
      // identifier; the resolved path is what the server would serve.
      offenders.push(`${config}: ${relative(REPO_ROOT, entry) || '<the repository root>'}`);
    }
  }

  expect(offenders, 'name the directories the dev server needs, never the parent').toEqual([]);

  // Every assertion above passes vacuously over zero entries, which a rename of
  // the config or a move of the allow list would cause. The one config in this
  // repository sets two entries.
  expect(checked, 'no fs.allow entry was examined, so this guard checked nothing').toBeGreaterThanOrEqual(2);
});

test('the guard is looking at a config, not an empty list', () => {
  expect(configs().length).toBeGreaterThanOrEqual(1);
});
