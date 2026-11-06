import { describe, expect, it } from 'vitest';
import { MAX_TREE_DEPTH } from '@/shared/seeds/config';
import type { Agent } from '@/shared/schemas';
import { depthOf, descendants, subtreeHeight, wouldCycle, wouldExceedDepth } from './tree';

const agent = (id: string, managerId: string | null, type: Agent['type'] = 'specialist'): Agent =>
  ({ id, managerId, type, name: id }) as Agent;

/** Orbi -> a -> b, plus a sibling s under Orbi. */
const tree = (): Agent[] => [
  agent('orbi', null, 'coordinator'),
  agent('a', 'orbi'),
  agent('b', 'a'),
  agent('s', 'orbi'),
];

describe('descendants', () => {
  it('lists everything below a node and not the node itself', () => {
    expect(descendants(tree(), 'orbi').toSorted()).toEqual(['a', 'b', 's']);
    expect(descendants(tree(), 'a')).toEqual(['b']);
    expect(descendants(tree(), 'b')).toEqual([]);
  });
});

/** The prototype's own check, reproduced so the regression has a name. */
const prototypeCheck = (agents: Agent[], id: string, managerId: string) =>
  descendants(agents, id).includes(managerId);

describe('wouldCycle — DEFECT 1 (docs/plan.md 4-B1)', () => {
  it('refuses an agent as its own manager', () => {
    expect(wouldCycle(tree(), 'a', 'a')).toBe(true);
  });

  it('refuses a manager that is one of the agent descendants', () => {
    expect(wouldCycle(tree(), 'a', 'b')).toBe(true);
  });

  it('allows an unrelated manager', () => {
    expect(wouldCycle(tree(), 'b', 's')).toBe(false);
    expect(wouldCycle(tree(), 'a', 'orbi')).toBe(false);
  });

  // This is the test "failing against the described behaviour", kept permanently rather
  // than run once: it reproduces the prototype's own check and asserts that it lets the
  // self-manager case through. If someone reinstates that logic, the first expect below
  // starts failing and names exactly what regressed.
  it('discriminates: the prototype check misses the self-manager case', () => {
    expect(prototypeCheck(tree(), 'a', 'a')).toBe(false); // the defect, reproduced
    expect(wouldCycle(tree(), 'a', 'a')).toBe(true); // the fix

    // And the consequence that made it more than cosmetic: a self-parented node is
    // unreachable from a walk down the tree, so it vanishes from the chart while staying
    // in the store. Observed at runtime on the demo office.
    const broken = tree().map((a) => (a.id === 'a' ? agent('a', 'a') : a));
    expect(broken.some((a) => a.id === 'a')).toBe(true); // still in the store
    expect(descendants(broken, 'orbi')).not.toContain('a'); // gone from the chart
  });
});

describe('subtreeHeight', () => {
  it('counts levels including the root, a leaf being 1', () => {
    expect(subtreeHeight(tree(), 'b')).toBe(1);
    expect(subtreeHeight(tree(), 'a')).toBe(2);
    expect(subtreeHeight(tree(), 'orbi')).toBe(3);
  });
});

describe('depthOf', () => {
  it('counts Orbi as level 1 (FD-23)', () => {
    expect(depthOf(tree(), 'orbi')).toBe(1);
    expect(depthOf(tree(), 'a')).toBe(2);
    expect(depthOf(tree(), 'b')).toBe(3);
  });

  it('treats the board as no level at all', () => {
    expect(depthOf(tree(), null)).toBe(0);
  });
});

describe('wouldExceedDepth — FD-23, both sides of the boundary', () => {
  it(`accepts a teammate at level ${MAX_TREE_DEPTH}`, () => {
    // new leaf under 'a' (level 2) lands at level 3
    expect(wouldExceedDepth(tree(), null, 'a')).toBe(false);
  });

  it(`refuses a teammate at level ${MAX_TREE_DEPTH + 1}`, () => {
    // new leaf under 'b' (level 3) would land at level 4
    expect(wouldExceedDepth(tree(), null, 'b')).toBe(true);
  });

  it('counts the reports an existing teammate would bring with it', () => {
    // moving 'a' (height 2) under 's' (level 2) would put 'b' at level 4
    expect(wouldExceedDepth(tree(), 'a', 's')).toBe(true);
    // moving the leaf 'b' under 's' is fine: it lands at level 3 alone
    expect(wouldExceedDepth(tree(), 'b', 's')).toBe(false);
  });

  it('allows a direct report to Orbi', () => {
    expect(wouldExceedDepth(tree(), null, 'orbi')).toBe(false);
  });
});
