import { describe, expect, it } from 'vitest';
import type { AgentDraft, StoreState } from '@/shared/schemas';
import { DEFAULT_BUDGET } from '@/shared/seeds/roles';
import { demo, fresh } from '@/shared/seeds/office';
import {
  attentionCause,
  canRemoveAgent,
  canRemoveDepartment,
  canRemovePerson,
  coordinatorInvariant,
  emailOk,
  needsAttention,
  pickOwner,
  requiredTools,
  validateAgentDraft,
  validateAgentsStep,
  validateAssign,
  validateConnections,
  validateOrg,
} from './validate';

const draft = (over: Partial<AgentDraft> = {}): AgentDraft => ({
  id: null,
  type: 'specialist',
  roleId: null,
  name: 'Helper',
  job: 'Helps with things',
  deptId: null,
  managerId: null,
  prompt: 'x'.repeat(40),
  tools: [],
  budget: { ...DEFAULT_BUDGET },
  ...over,
});

const withOrbi = (s: StoreState) => s.agents.find((a) => a.type === 'coordinator')!;

describe('validateOrg', () => {
  it('names every missing thing on a fresh office', () => {
    const s = fresh();
    const e = validateOrg(s);
    expect(e).toContain('Add at least one department.');
    expect(e).toContain(
      'Mark at least one person as a Leader (the board that approves big decisions).',
    );
    expect(e.some((x) => x.includes('needs a department'))).toBe(true);
  });

  it('passes on the demo office', () => {
    expect(validateOrg(demo())).toEqual([]);
  });

  it('refuses a duplicate email and reports it once', () => {
    const s = demo();
    s.people[1]!.email = s.people[0]!.email;
    const e = validateOrg(s);
    expect(e.filter((x) => x.startsWith('Email used twice'))).toHaveLength(1);
  });

  it('requires an Org Admin', () => {
    const s = demo();
    for (const p of s.people) p.access = 'user';
    expect(validateOrg(s)).toContain('Keep at least one Org Admin.');
  });

  it.each([
    ['maria@brightpath.co', true],
    ['no-at-sign', false],
    ['two@@at.co', false],
    ['missing@domain', false],
    ['', false],
  ])('emailOk(%s) is %s', (value, want) => {
    expect(emailOk(value)).toBe(want);
  });
});

describe('the agents step gate — FD-18', () => {
  it('a fresh office already has Orbi, so only a specialist is missing', () => {
    const s = fresh();
    expect(withOrbi(s).name).toBe('Orbi');
    expect(validateAgentsStep(s)).toEqual([
      'Hire at least one teammate. Orbi coordinates them; it cannot do the work alone.',
    ]);
  });

  it('passes once one specialist exists', () => {
    const s = demo();
    expect(validateAgentsStep(s)).toEqual([]);
  });

  it('holds the one-Coordinator invariant on both seeds', () => {
    expect(coordinatorInvariant(fresh())).toEqual([]);
    expect(coordinatorInvariant(demo())).toEqual([]);
  });
});

describe('validateAgentDraft', () => {
  it('refuses a second Coordinator', () => {
    const s = fresh();
    expect(validateAgentDraft(draft({ type: 'coordinator' }), s)).toContain(
      'Only one Coordinator is allowed, and Orbi already has the job.',
    );
  });

  it('requires a name, a job, 20 characters of instructions and a manager', () => {
    const s = fresh();
    const e = validateAgentDraft(draft({ name: '', job: '', prompt: 'short' }), s);
    expect(e).toContain('Give the agent a name.');
    expect(e).toContain('Describe its job in one line.');
    expect(e).toContain('Write at least 20 characters of instructions.');
    expect(e).toContain('Choose who it reports to.');
  });

  it('refuses a duplicate name case-insensitively', () => {
    const s = demo();
    expect(
      validateAgentDraft(draft({ name: 'orbi', managerId: withOrbi(s).id }), s),
    ).toContain('Another agent already has that name.');
  });

  it('refuses each budget number at or below zero — A.5 has three', () => {
    const s = demo();
    const m = withOrbi(s).id;
    expect(
      validateAgentDraft(draft({ managerId: m, budget: { ...DEFAULT_BUDGET, monthlyUsd: 0 } }), s),
    ).toContain('Set a monthly budget above $0.');
    expect(
      validateAgentDraft(
        draft({ managerId: m, budget: { ...DEFAULT_BUDGET, dailyCheapCheckUsd: 0 } }),
        s,
      ),
    ).toContain('Set a daily cap for cheap checks above $0.');
    expect(
      validateAgentDraft(draft({ managerId: m, budget: { ...DEFAULT_BUDGET, turnLimit: 0 } }), s),
    ).toContain('Set a turn limit above 0.');
  });

  it('refuses a connector Appendix A.2 marks unavailable', () => {
    const s = demo();
    expect(
      validateAgentDraft(draft({ managerId: withOrbi(s).id, tools: ['whatsapp'] }), s),
    ).toContain('WhatsApp cannot be used by a teammate yet.');
  });

  it('accepts a valid specialist', () => {
    const s = demo();
    expect(validateAgentDraft(draft({ managerId: withOrbi(s).id }), s)).toEqual([]);
  });

  it('refuses a self-manager on edit — DEFECT 1', () => {
    const s = demo();
    const a = s.agents.find((x) => x.type === 'specialist')!;
    expect(
      validateAgentDraft(draft({ id: a.id, name: a.name, managerId: a.id }), s),
    ).toContain('That would create a loop in the org chart.');
  });

  it('refuses a fourth level — FD-23', () => {
    const s = demo();
    const orbi = withOrbi(s);
    const lvl2 = s.agents.find((x) => x.managerId === orbi.id)!;
    // Build a third level, then try a fourth.
    const lvl3 = { ...lvl2, id: 'lvl3', name: 'Level Three', managerId: lvl2.id };
    s.agents.push(lvl3);
    expect(validateAgentDraft(draft({ managerId: lvl2.id }), s)).toEqual([]);
    expect(validateAgentDraft(draft({ managerId: lvl3.id }), s)).toContain(
      'No teammate may be more than 3 levels deep. Pick a manager closer to Orbi.',
    );
  });
});

describe('assignment', () => {
  it('names every unowned agent', () => {
    const s = demo();
    for (const a of s.agents) a.ownerId = null;
    expect(validateAssign(s)[0]).toContain('still need an owner.');
  });

  it('passes on the demo office', () => {
    expect(validateAssign(demo())).toEqual([]);
  });

  it('treats an owner who no longer exists as unowned', () => {
    const s = demo();
    s.agents[0]!.ownerId = 'p_ghost';
    expect(validateAssign(s)).toHaveLength(1);
  });

  // docs/plan.md 4-C5, verified at runtime: without the last two fallback levels an office
  // with an empty department cannot satisfy its own gate.
  it('falls back past an empty department to any user in the office', () => {
    const s = fresh();
    s.departments.push({ id: 'd_fin', name: 'Finance' });
    s.people.push({
      id: 'p_only',
      name: 'Only User',
      email: 'only@x.co',
      title: '',
      deptId: 'd_sales',
      access: 'user',
      authorities: [],
    });
    const a = { ...s.agents[0]!, type: 'specialist' as const, deptId: 'd_fin' };
    expect(pickOwner(s, a)?.id).toBe('p_only');
  });

  it('gives the Coordinator to a Leader', () => {
    const s = demo();
    expect(pickOwner(s, withOrbi(s))?.name).toBe('David Park');
  });
});

describe('connections', () => {
  it('names the missing connectors', () => {
    const s = demo();
    delete s.connections['slack'];
    expect(validateConnections(s)[0]).toBe('Connect Slack, or choose to connect later.');
  });

  it('passes with connect later on', () => {
    const s = demo();
    delete s.connections['slack'];
    s.org.connectLater = true;
    expect(validateConnections(s)).toEqual([]);
  });

  it('derives required connectors from the teammates', () => {
    const required = Object.keys(requiredTools(demo())).toSorted();
    expect(required).toEqual(['calendar', 'drive', 'email', 'hubspot', 'notion', 'slack', 'stripe']);
  });
});

describe('removal rules', () => {
  it('refuses a department that still has people or agents', () => {
    const s = demo();
    expect(canRemoveDepartment(s, s.departments[0]!.id)).toBe('Move its people and agents first.');
  });

  it('allows an empty department', () => {
    const s = demo();
    s.departments.push({ id: 'd_empty', name: 'Empty' });
    expect(canRemoveDepartment(s, 'd_empty')).toBe('');
  });

  it('refuses a person who owns agents', () => {
    const s = demo();
    expect(canRemovePerson(s, 'p_david')).toBe('Reassign their agents first.');
  });

  it('refuses removing the last Org Admin', () => {
    const s = demo();
    expect(canRemovePerson(s, 'p_maria')).toBe('Every office keeps at least one Org Admin.');
  });

  it('refuses an agent others report to', () => {
    const s = demo();
    const orbi = withOrbi(s);
    const lvl2 = s.agents.find((a) => a.managerId === orbi.id)!;
    s.agents.push({ ...lvl2, id: 'child', name: 'Child', managerId: lvl2.id });
    expect(canRemoveAgent(s, lvl2.id)).toContain('report to');
  });

  // FD-18 / Appendix A.1, errata E-4: "never removable" is absolute, where the prototype
  // only refused while other agents existed.
  it('refuses removing Orbi, even from an office with nothing else in it', () => {
    const s = fresh();
    expect(s.agents).toHaveLength(1);
    expect(canRemoveAgent(s, withOrbi(s).id)).toBe(
      'Orbi coordinates this office and cannot be removed.',
    );
  });
});

describe('needs attention — one rule, two reasons (plan 4-B4)', () => {
  it('flags low success on either screen', () => {
    const a = { perf: { success: 88, edited: 0 }, blockedBy: [] } as never;
    expect(needsAttention(a, 'performance')).toBe(true);
    expect(needsAttention(a, 'readiness')).toBe(true);
  });

  it('flags heavy editing only on Performance', () => {
    const a = { perf: { success: 99, edited: 44 }, blockedBy: [] } as never;
    expect(needsAttention(a, 'performance')).toBe(true);
    expect(needsAttention(a, 'readiness')).toBe(false);
  });

  it('flags a missing connector only on the dashboard', () => {
    const a = { perf: { success: 99, edited: 0 }, blockedBy: ['slack'] } as never;
    expect(needsAttention(a, 'performance')).toBe(false);
    expect(needsAttention(a, 'readiness')).toBe(true);
    expect(attentionCause(a, 'readiness')).toBe('needs Slack');
  });
});
