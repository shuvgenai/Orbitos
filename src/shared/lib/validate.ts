import type { Agent, AgentDraft, Person, StoreState } from '@/shared/schemas';
import { MAX_TREE_DEPTH, MIN_PROMPT_CHARS } from '@/shared/seeds/config';
import { isAssignable, toolName } from '@/shared/seeds/tools';
import { wouldCycle, wouldExceedDepth } from './tree';

export const emailOk = (e: string): boolean => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e ?? '');

const unique = (xs: string[]): string[] => [...new Set(xs)];

/* ----------------------------------------------------------------- 1. org structure */

/** PROVENANCE: api.js `validateOrg`, messages verbatim. */
export function validateOrg(s: StoreState): string[] {
  const e: string[] = [];
  if (s.departments.length === 0) e.push('Add at least one department.');
  if (!s.people.some((p) => p.authorities.includes('leader')))
    e.push('Mark at least one person as a Leader (the board that approves big decisions).');
  if (!s.people.some((p) => p.access === 'admin')) e.push('Keep at least one Org Admin.');

  const seen = new Set<string>();
  for (const p of s.people) {
    if (!p.name.trim()) e.push('Every person needs a name.');
    if (!emailOk(p.email)) e.push(`${p.name || 'A person'} needs a valid email.`);
    else if (seen.has(p.email.toLowerCase())) e.push(`Email used twice: ${p.email}`);
    seen.add((p.email ?? '').toLowerCase());
    if (!p.deptId) e.push(`${p.name || 'A person'} needs a department.`);
  }
  return unique(e);
}

/* --------------------------------------------------------------------- 2. teammates */

/**
 * The STEP GATE. Deliberately not the same thing as validating one draft: a half-filled
 * drawer must not block the wizard (docs/plan.md 4-C4, errata E-3).
 *
 * FD-18: Orbi is seeded with the office and cannot be created or removed, so the
 * "exactly one coordinator" half is an invariant of the seed, not a rule the gate checks.
 * The gate is specialist-only.
 */
export function validateAgentsStep(s: StoreState): string[] {
  const e: string[] = [];
  if (!s.agents.some((a) => a.type === 'specialist'))
    e.push('Hire at least one teammate. Orbi coordinates them; it cannot do the work alone.');
  return e;
}

/** The invariant the seed guarantees. A failure here is a bug, not user error. */
export function coordinatorInvariant(s: StoreState): string[] {
  const coords = s.agents.filter((a) => a.type === 'coordinator');
  if (coords.length === 1) return [];
  return coords.length === 0
    ? ['This office has no Coordinator. Orbi should always be present.']
    : ['This office has more than one Coordinator. Only Orbi may coordinate.'];
}

/** Validating one draft, as the drawer saves it. PROVENANCE: api.js `createAgent` checks. */
export function validateAgentDraft(draft: AgentDraft, s: StoreState): string[] {
  const e: string[] = [];
  const name = draft.name.trim();

  if (!name) e.push('Give the agent a name.');
  else if (
    s.agents.some((a) => a.name.toLowerCase() === name.toLowerCase() && a.id !== draft.id)
  )
    e.push('Another agent already has that name.');

  if (!draft.job.trim()) e.push('Describe its job in one line.');
  if (draft.prompt.trim().length < MIN_PROMPT_CHARS)
    e.push(`Write at least ${MIN_PROMPT_CHARS} characters of instructions.`);

  // FD-18: no screen offers a Coordinator, and the validator refuses one anyway.
  if (draft.type === 'coordinator' && s.agents.some((a) => a.type === 'coordinator' && a.id !== draft.id))
    e.push('Only one Coordinator is allowed, and Orbi already has the job.');

  if (draft.type !== 'coordinator') {
    if (!draft.managerId) e.push('Choose who it reports to.');
    else {
      // DEFECT FIX 4-B1: the self-manager case. `wouldCycle` covers id === managerId,
      // which the prototype's descendants-only check let through. It is checked on CREATE
      // as well as on edit; the prototype only ran it when editing.
      if (draft.id && wouldCycle(s.agents, draft.id, draft.managerId))
        e.push('That would create a loop in the org chart.');
      // FD-23
      if (wouldExceedDepth(s.agents, draft.id, draft.managerId))
        e.push(
          `No teammate may be more than ${MAX_TREE_DEPTH} levels deep. Pick a manager closer to Orbi.`,
        );
    }
  }

  // FD-18 / A.5: three numbers, each above zero.
  if (!(draft.budget.monthlyUsd > 0)) e.push('Set a monthly budget above $0.');
  if (!(draft.budget.dailyCheapCheckUsd > 0)) e.push('Set a daily cap for cheap checks above $0.');
  if (!(draft.budget.turnLimit > 0)) e.push('Set a turn limit above 0.');

  // Appendix A.2: WhatsApp is not available and cannot be assigned.
  const unavailable = draft.tools.filter((t) => !isAssignable(t));
  if (unavailable.length)
    e.push(`${unavailable.map(toolName).join(', ')} cannot be used by a teammate yet.`);

  return unique(e);
}

/* ---------------------------------------------------------------------- 3. assignment */

/** PROVENANCE: api.js `validateAssign`, message verbatim. */
export function validateAssign(s: StoreState): string[] {
  const orphans = s.agents.filter(
    (a) => !a.ownerId || !s.people.some((p) => p.id === a.ownerId),
  );
  return orphans.length ? [`${orphans.map((a) => a.name).join(', ')} still need an owner.`] : [];
}

/* --------------------------------------------------------------------- 4. connections */

export function requiredTools(s: StoreState): Record<string, string[]> {
  const m: Record<string, string[]> = {};
  for (const a of s.agents) for (const t of a.tools) (m[t] ??= []).push(a.id);
  return m;
}

export const isOn = (s: StoreState, key: string): boolean => s.connections[key]?.on === true;

/** PROVENANCE: api.js `validateConnections`, message verbatim. */
export function validateConnections(s: StoreState): string[] {
  if (s.org.connectLater) return [];
  const missing = Object.keys(requiredTools(s)).filter((k) => !isOn(s, k));
  return missing.length
    ? [`Connect ${missing.map(toolName).join(', ')}, or choose to connect later.`]
    : [];
}

/* ------------------------------------------------------------------- removal rules */

export function canRemoveDepartment(s: StoreState, id: string): string {
  const inUse =
    s.people.filter((p) => p.deptId === id).length + s.agents.filter((a) => a.deptId === id).length;
  return inUse ? 'Move its people and agents first.' : '';
}

export function canRemovePerson(s: StoreState, id: string): string {
  if (s.agents.some((a) => a.ownerId === id)) return 'Reassign their agents first.';
  const p = s.people.find((x) => x.id === id);
  if (p?.access === 'admin' && s.people.filter((x) => x.access === 'admin').length === 1)
    return 'Every office keeps at least one Org Admin.';
  if (
    p?.authorities.includes('leader') &&
    s.people.filter((x) => x.authorities.includes('leader')).length === 1
  )
    return 'Every office keeps at least one Leader.';
  return '';
}

/**
 * FD-18 / Appendix A.1: Orbi is "never removable" — absolutely, not merely while other
 * teammates exist, which is what the prototype enforced (errata E-4).
 */
export function canRemoveAgent(s: StoreState, id: string): string {
  const a = s.agents.find((x) => x.id === id);
  if (!a) return '';
  if (a.type === 'coordinator') return 'Orbi coordinates this office and cannot be removed.';
  if (s.agents.some((x) => x.managerId === id))
    return `Other agents report to ${a.name}. Move them first.`;
  return '';
}

/* ------------------------------------------------------------------ needs attention */

/**
 * One rule, two reasons, so the difference between the two screens is visible instead of
 * duplicated (docs/plan.md 4-B4). The prototype had `success < 90 || edited >= 40` on
 * Performance and `success < 90 || blockedBy.length` on the dashboard.
 */
export type AttentionReason = 'performance' | 'readiness';

export function needsAttention(a: Agent, reason: AttentionReason): boolean {
  if (reason === 'performance') return a.perf.success < 90 || a.perf.edited >= 40;
  return a.perf.success < 90 || (a.blockedBy?.length ?? 0) > 0;
}

export function attentionCause(a: Agent, reason: AttentionReason): string {
  if (reason === 'readiness' && a.blockedBy?.length)
    return `needs ${a.blockedBy.map(toolName).join(', ')}`;
  if (a.perf.success < 90) return `${a.perf.success}% success`;
  return `${a.perf.edited}% of drafts edited`;
}

/* ------------------------------------------------------------------------ auto-assign */

/**
 * PROVENANCE: api.js `autoAssign`. All FOUR fallback levels, not the two Prompt 2
 * describes: an office with an empty department cannot satisfy its own gate without the
 * last two, verified at runtime (docs/plan.md 4-C5, errata noted there).
 */
export function pickOwner(s: StoreState, a: Agent): Person | undefined {
  if (a.type === 'coordinator')
    return (
      s.people.find((p) => p.authorities.includes('leader')) ??
      s.people.find((p) => p.access === 'admin')
    );
  const inDept = s.people.filter((p) => p.deptId === a.deptId);
  return (
    inDept.find((p) => p.authorities.includes('approver')) ??
    inDept[0] ??
    s.people.find((p) => p.access === 'user') ??
    s.people[0]
  );
}
