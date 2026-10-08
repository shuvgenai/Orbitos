// Every dependency version is exact.
//
// Spec section 8's lockfile row asks for two things: no drift, which
// `pnpm install --frozen-lockfile` gates in CI, and "versions pinned exact, no
// `^`". Nothing checked the second until this file. Every one of the nine
// workspace manifests already holds only exact versions, so this guard passes
// the day it is written; what it adds is that the next `pnpm add` without
// `--save-exact` fails here instead of landing quietly.
//
// Why exact, in one line, because a guard whose reason is elsewhere gets
// deleted by the next person who finds it inconvenient: this project pins two
// engine images by digest and runs a lockfile gate in CI, and a `^` range
// undoes both by letting a transitive minor change the bytes that ship between
// two runs of the same commit.
//
// A guard, not a grep in the workflow. It runs in `pnpm test:unit` as well as
// in CI, and it names the manifest and the dependency rather than printing a
// matching line.
import { expect, test } from 'vitest';
import { readRepoFile, trackedFiles } from './lib/walk.ts';

/**
 * The dependency maps a manifest can carry. `peerDependencies` is deliberately
 * absent: a peer range is a statement about what a consumer may bring, and a
 * library that pinned its peers exactly would be unusable.
 */
const FIELDS = ['dependencies', 'devDependencies', 'optionalDependencies'] as const;

/**
 * Ranges that are not a single version. `*` and `x` are in the list because
 * they are the widest ranges there are, not because anyone would write one on
 * purpose.
 */
const RANGE = /^[\^~>=<]|\s-\s|\|\||^\*$|^x$/;

/**
 * A `workspace:` or `catalog:` specifier is a protocol, not a range. pnpm
 * resolves `workspace:*` to the version in this repo, so it is exact by
 * construction and cannot drift.
 */
const PROTOCOL = /^(workspace|catalog|link|file|npm|jsr):/;

/**
 * Manifests git tracks, which is every workspace package plus the root.
 *
 * `trackedFiles` rather than a walk, so an untracked manifest in a scratch
 * directory cannot fail this guard locally while CI passes. The reverse of the
 * choice `guards/paths.test.ts` makes, for the opposite reason: a second copy
 * of the prototype is the thing that guard hunts, and an unpinned version in a
 * file nobody committed cannot reach anyone.
 */
const manifests = () =>
  trackedFiles().filter((f) => f === 'package.json' || (f.endsWith('/package.json') && !f.includes('node_modules/')));

test('every tracked package.json names its dependencies at an exact version', () => {
  const loose: string[] = [];

  for (const manifest of manifests()) {
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(readRepoFile(manifest)) as Record<string, unknown>;
    } catch (err) {
      // A manifest git tracks but that will not parse is a failure here rather
      // than a skip. Swallowing it would let a broken file read as compliant.
      throw new Error(`${manifest} is not valid JSON: ${(err as Error).message}`);
    }

    for (const field of FIELDS) {
      const deps = parsed[field];
      if (deps === undefined) continue;
      for (const [name, spec] of Object.entries(deps as Record<string, string>)) {
        if (PROTOCOL.test(spec)) continue;
        if (RANGE.test(spec)) loose.push(`${manifest} ${field}.${name} = ${spec}`);
      }
    }
  }

  expect(loose).toEqual([]);
});

test('the guard is looking at every workspace, not at an empty list', () => {
  // The rule above passes vacuously if the filter stops matching, which a
  // rename of a workspace directory could do quietly. pnpm-workspace.yaml names
  // eight packages and there is one root manifest, so nine is the floor.
  expect(manifests().length).toBeGreaterThanOrEqual(9);
});
