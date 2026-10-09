// Every action a workflow runs is pinned to a commit, never to a tag.
//
// Written because of finding H3 of the 2026-10-08 security review. The workflow
// already argued the case in a comment beside the one action that was pinned
// properly: a tag is mutable, whoever can push to that repository can move it
// onto different code, and the step runs with this repository's token. Four
// actions were still on tags, one of them third party, in the same file.
//
// A tag is the whole problem, so this guard does not try to tell a safe tag from
// an unsafe one. Forty hex characters, or it fails.
//
// The tag each SHA came from stays in a trailing comment, because a bare SHA is
// unreadable and the next person needs to know which release they are on before
// they can decide whether to move. The comment is documentation; this guard
// reads the ref.
import { expect, test } from 'vitest';
import { readRepoFile, trackedFiles } from './lib/walk.ts';

/**
 * A `uses:` step, split into what it runs and the ref it runs at.
 *
 * Group 1 is the action, group 2 the ref. A quoted value is handled because
 * YAML allows it and a reader would not notice the difference.
 */
const USES = /^\s*(?:-\s*)?uses:\s*["']?([^"'\s@]+)@([^"'\s#]+)["']?/;

/** Forty hex characters. A short SHA is not enough: git resolves a prefix, and a prefix can collide. */
const FULL_SHA = /^[0-9a-f]{40}$/;

/**
 * A local action, referenced by path rather than by `owner/repo`. It lives in
 * this repository, so there is no upstream tag to move and nothing to pin.
 * None exists today; the rule is here so that adding one is not a failure.
 */
const isLocal = (action: string) => action.startsWith('./') || action.startsWith('.\\');

/** A docker action, pinned by digest rather than by commit. */
const isDocker = (action: string) => action.startsWith('docker://');

const workflows = () =>
  trackedFiles().filter((file) => file.startsWith('.github/workflows/') && /\.ya?ml$/.test(file));

type Step = { readonly file: string; readonly line: number; readonly action: string; readonly ref: string };

function steps(): readonly Step[] {
  const out: Step[] = [];
  for (const file of workflows()) {
    for (const [index, line] of readRepoFile(file).split('\n').entries()) {
      const match = line.match(USES);
      if (match === null) continue;
      const [, action = '', ref = ''] = match;
      out.push({ file, line: index + 1, action, ref });
    }
  }
  return out;
}

test('every action in every workflow is pinned to a full commit SHA', () => {
  const loose = steps()
    .filter((step) => !isLocal(step.action) && !isDocker(step.action))
    .filter((step) => !FULL_SHA.test(step.ref))
    // The ref, not just the name. A failure that says `@v4` tells the reader
    // what to resolve; one that says "not pinned" does not.
    .map((step) => `${step.file}:${step.line} ${step.action}@${step.ref}`);

  expect(loose, 'resolve the tag to its commit and keep the tag in a trailing comment').toEqual([]);
});

test('the guard is reading workflow steps, not an empty list', () => {
  // Every assertion above passes vacuously over zero steps, which a rename of
  // the workflow directory or a change to the uses pattern would cause. There
  // were ten steps across one workflow when this was written.
  expect(steps().length).toBeGreaterThanOrEqual(8);
});

test('each pinned SHA carries the tag it was resolved from', () => {
  // Not a security rule, a readability one, and it is a test rather than a
  // comment because a bare SHA with no provenance is what makes a dependency
  // update get skipped. docs/decisions.md holds the API calls that resolved
  // each one.
  const bare: string[] = [];

  for (const file of workflows()) {
    for (const [index, line] of readRepoFile(file).split('\n').entries()) {
      const match = line.match(USES);
      if (match === null) continue;
      const [, action = '', ref = ''] = match;
      if (!FULL_SHA.test(ref)) continue;
      if (isLocal(action) || isDocker(action)) continue;
      if (/#\s*\S/.test(line)) continue;
      bare.push(`${file}:${index + 1} ${action}`);
    }
  }

  expect(bare, 'add a trailing comment naming the tag this SHA came from').toEqual([]);
});
