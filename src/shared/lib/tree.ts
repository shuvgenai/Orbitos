import { MAX_TREE_DEPTH } from '@/shared/seeds/config';
import type { Agent } from '@/shared/schemas';

/** Every agent below `id`, not including `id` itself. */
export function descendants(agents: Agent[], id: string): string[] {
  const out: string[] = [];
  const walk = (parent: string) => {
    for (const a of agents) {
      if (a.managerId === parent) {
        out.push(a.id);
        walk(a.id);
      }
    }
  };
  walk(id);
  return out;
}

/**
 * Would making `managerId` the manager of `agentId` create a cycle?
 *
 * DEFECT FIX (docs/plan.md 4-B1, verified at runtime). The prototype asked only
 * `descendants(id).includes(managerId)`, and `descendants` does not include `id`, so an
 * agent could be made its OWN manager: `createAgent` returned no errors, the row kept every
 * other field, and the teammate then disappeared from the org chart -- the tree walks down
 * from the Coordinator and a self-parented node is unreachable. It was still in the store.
 *
 * The guard existed only in the drawer's manager dropdown, i.e. in the view. The shared
 * spec is correct and stricter: "a manager cannot be the agent itself or one of its
 * descendants".
 */
export function wouldCycle(agents: Agent[], agentId: string, managerId: string): boolean {
  if (agentId === managerId) return true;
  return descendants(agents, agentId).includes(managerId);
}

/** How many teammates deep `managerId` sits, counting itself. The Coordinator is 1. */
export function depthOf(agents: Agent[], managerId: string | null): number {
  let depth = 0;
  let cursor = managerId;
  const seen = new Set<string>();
  while (cursor) {
    if (seen.has(cursor)) return Number.POSITIVE_INFINITY; // a pre-existing cycle
    seen.add(cursor);
    depth += 1;
    cursor = agents.find((a) => a.id === cursor)?.managerId ?? null;
  }
  return depth;
}

/**
 * FD-23: maximum depth three (PRD 15.6, 15.8).
 *
 * The PRD does not define what counts as a level, so the convention is FD-23's and is
 * PROPOSED: depth counts AI teammates only. Orbi is level 1, a teammate reporting to Orbi
 * is level 2, one reporting to that is level 3, and a fourth is refused. The board is people,
 * not teammates, and does not count a level.
 */
export function wouldExceedDepth(
  agents: Agent[],
  agentId: string | null,
  managerId: string | null,
): boolean {
  const own = depthOf(agents, managerId) + 1;
  // Moving a teammate carries its reports with it, so the subtree's own height counts too.
  const height = agentId ? subtreeHeight(agents, agentId) : 1;
  return own + height - 1 > MAX_TREE_DEPTH;
}

/** Levels in the subtree rooted at `id`, including `id`. A leaf is 1. */
export function subtreeHeight(agents: Agent[], id: string, seen = new Set<string>()): number {
  if (seen.has(id)) return 1; // a pre-existing cycle; depthOf reports it separately
  seen.add(id);
  const kids = childrenOf(agents, id);
  if (kids.length === 0) return 1;
  return 1 + Math.max(...kids.map((k) => subtreeHeight(agents, k.id, seen)));
}

/** Agents whose manager is `parentId`, for rendering an indented list. */
export const childrenOf = (agents: Agent[], parentId: string | null): Agent[] =>
  agents.filter((a) => a.managerId === parentId);
