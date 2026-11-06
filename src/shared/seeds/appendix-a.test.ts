import { describe, expect, it } from 'vitest';
import { needsAttention } from '@/shared/lib/validate';
import { demo, fresh } from './office';
import { DEMO_PEOPLE } from './people';
import { ALL_ROLES, HIREABLE_ROLES, ORBI } from './roles';
import { TOOLS } from './tools';
import { BASE_GUARDRAILS, SUGGESTED_GUARDRAILS } from './config';
import { PROVISION_STEPS, SAMPLE_OFFICES } from '@/apps/fleet/registry';

/**
 * One test per fixed list in PRD Appendix A, which fails if the list changes without a
 * matching PRD section reference. That is Appendix C instruction 5, and FD-18 adopts it.
 *
 * Appendix A: "These lists may not be restated anywhere else. Any document, contract,
 * schema, seed file or screen that needs one references this appendix. Changing a list here
 * is a PRD change with a version bump." So each expectation below names its section, and a
 * seed drifting from the appendix fails here rather than reaching a screen.
 */

describe('Appendix A.1 — AI teammate roles', () => {
  it('is Orbi plus exactly five hireable roles', () => {
    expect(ORBI.name).toBe('Orbi');
    expect(ORBI.type).toBe('coordinator');
    expect(HIREABLE_ROLES).toHaveLength(5);
    expect(HIREABLE_ROLES.map((r) => r.name)).toEqual([
      'Sales Analyst',
      'Support Triager',
      'Operations Reporter',
      'Finance Clerk',
      'HR Coordinator',
    ]);
  });

  it('pairs each role with the department A.1 gives it', () => {
    const byName = Object.fromEntries(HIREABLE_ROLES.map((r) => [r.name, r.deptName]));
    expect(byName).toEqual({
      'Finance Clerk': 'Finance',
      'Sales Analyst': 'Sales',
      'Support Triager': 'Support',
      'HR Coordinator': 'HR',
      'Operations Reporter': 'Operations',
    });
  });

  it('keeps Orbi out of the hire list — A.1 says "not hired"', () => {
    expect(ORBI.hireable).toBe(false);
    expect(HIREABLE_ROLES.every((r) => r.hireable)).toBe(true);
  });

  it('seeds none of the prototype nine', () => {
    const retired = [
      'Atlas',
      'Scout',
      'Echo',
      'Ledger',
      'Compass',
      'Beacon',
      'Pulse',
      'Quill',
      'Relay',
    ];
    for (const name of retired) expect(ALL_ROLES.map((r) => r.name)).not.toContain(name);
  });

  it('declares a provenance for every role, and marks the two with no source PROPOSED', () => {
    for (const r of ALL_ROLES) expect(r.provenance, r.name).toBeTruthy();
    const proposed = ALL_ROLES.filter((r) => r.provenance === 'PROPOSED').map((r) => r.name);
    expect(proposed).toEqual(['Finance Clerk', 'HR Coordinator']);
  });

  it('uses only connectors that are in Appendix A.2 and assignable', () => {
    const assignable = new Set(TOOLS.filter((t) => t.tier === 'available').map((t) => t.key));
    for (const r of ALL_ROLES)
      for (const t of r.tools) expect(assignable, `${r.name} -> ${t}`).toContain(t);
  });
});

describe('Appendix A.2 — first connector catalog', () => {
  it('is exactly the eight A.2 names', () => {
    expect(TOOLS.map((t) => t.name)).toEqual([
      'Email',
      'Calendar',
      'Drive',
      'Slack',
      'HubSpot',
      'Stripe',
      'Notion',
      'WhatsApp',
    ]);
  });

  it('excludes the three A.2 names as not carried over', () => {
    const names = TOOLS.map((t) => t.name);
    for (const gone of ['QuickBooks Online', 'QuickBooks', 'Intercom', 'Salesforce'])
      expect(names).not.toContain(gone);
  });

  it('makes every first permission read-only', () => {
    for (const t of TOOLS) expect(t.firstPermission, t.name).toBe('read');
  });

  it('marks WhatsApp unavailable and nothing else', () => {
    expect(TOOLS.filter((t) => t.tier === 'unavailable').map((t) => t.name)).toEqual(['WhatsApp']);
  });

  it('encodes CD-5 safe default: every change-capable connector needs Leader approval', () => {
    for (const t of TOOLS) expect(t.changeCapable, t.name).toBe(true);
  });
});

describe('Appendix A.5 — three numbers per teammate', () => {
  it('gives every seeded teammate all three, each above zero', () => {
    for (const a of demo().agents) {
      expect(Object.keys(a.budget).toSorted()).toEqual([
        'dailyCheapCheckUsd',
        'monthlyUsd',
        'turnLimit',
      ]);
      expect(a.budget.monthlyUsd).toBeGreaterThan(0);
      expect(a.budget.dailyCheapCheckUsd).toBeGreaterThan(0);
      expect(a.budget.turnLimit).toBeGreaterThan(0);
    }
  });

  it('keeps the per-connector limits on the connection, not the teammate — C-11, CD-3', () => {
    const s = demo();
    for (const c of Object.values(s.connections)) {
      expect(c.limits.dailyCalls).toBeGreaterThan(0);
      expect(c.limits.dailyCostUsd).toBeGreaterThan(0);
    }
    for (const a of s.agents) expect(a.budget).not.toHaveProperty('dailyCalls');
  });
});

describe('the prototype lists that are still the source', () => {
  it('has config.js three default guardrails and five suggestions', () => {
    expect(BASE_GUARDRAILS).toHaveLength(3);
    expect(SUGGESTED_GUARDRAILS).toHaveLength(5);
  });

  it('has fleet.js three sample offices and four provisioning steps', () => {
    expect(SAMPLE_OFFICES).toHaveLength(3);
    expect(PROVISION_STEPS).toHaveLength(4);
  });

  it('has people.js five people — FD-21, not org.js', () => {
    expect(DEMO_PEOPLE.map((p) => p.name)).toEqual([
      'Maria Santos',
      'David Park',
      'Jordan Lee',
      'Priya Nair',
      'Marcus Reed',
    ]);
    expect(DEMO_PEOPLE.filter((p) => p.access === 'admin')).toHaveLength(1);
    expect(DEMO_PEOPLE.filter((p) => p.authorities.includes('leader'))).toHaveLength(1);
  });
});

describe('the seeded offices', () => {
  it('a fresh office holds the Org Admin and Orbi, and nothing else', () => {
    const s = fresh();
    expect(s.people).toHaveLength(1);
    expect(s.agents).toHaveLength(1);
    expect(s.agents[0]!.name).toBe('Orbi');
    expect(s.org.launched).toBe(false);
    expect(s.departments).toHaveLength(0);
  });

  it('the demo office is six teammates, five people, five departments, two requests', () => {
    const s = demo();
    expect(s.agents).toHaveLength(6);
    expect(s.people).toHaveLength(5);
    expect(s.departments.map((d) => d.name)).toEqual([
      'Sales',
      'Operations',
      'Finance',
      'Support',
      'HR',
    ]);
    expect(s.requests.filter((r) => r.status === 'pending')).toHaveLength(2);
    expect(s.org.launched).toBe(true);
  });

  it('reports every teammate to Orbi, and Orbi to the board', () => {
    const s = demo();
    const orbi = s.agents.find((a) => a.type === 'coordinator')!;
    expect(orbi.managerId).toBeNull();
    for (const a of s.agents.filter((x) => x.type === 'specialist'))
      expect(a.managerId).toBe(orbi.id);
  });

  it('connects every connector the teammates need', () => {
    const s = demo();
    const needed = new Set(s.agents.flatMap((a) => a.tools));
    for (const t of needed) expect(s.connections[t]?.on, t).toBe(true);
  });

  /**
   * Errata E-14. The Build Prompts said "Relay and Quill are flagged", which was wrong even
   * before the reseed -- the rule flagged three of the prototype's nine. This asserts the
   * EXACT set for the new seed, computed by running the rule rather than reasoned by hand,
   * and it deliberately keeps one teammate per cause so the Performance screen still
   * demonstrates both halves of `success < 90 || edited >= 40`.
   */
  it('flags exactly the Operations Reporter and the HR Coordinator', () => {
    const s = demo();
    const flagged = s.agents.filter((a) => needsAttention(a, 'performance'));
    expect(flagged.map((a) => a.name).toSorted()).toEqual(['HR Coordinator', 'Operations Reporter']);

    const reporter = flagged.find((a) => a.name === 'Operations Reporter')!;
    const hr = flagged.find((a) => a.name === 'HR Coordinator')!;
    expect(reporter.perf.success).toBe(88); // the low-success cause
    expect(hr.perf.edited).toBe(44); // the heavy-editing cause
    expect(hr.perf.success).toBeGreaterThanOrEqual(90); // flagged for editing alone
  });
});
