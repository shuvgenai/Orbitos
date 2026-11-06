import type { Agent, AgentPerf, AgentStatus, StoreState } from '@/shared/schemas';
import {
  BASE_GUARDRAILS,
  DEFAULT_CONNECTION_LIMITS,
  STORE_VERSION,
} from './config';
import { mintRuntimeRef } from '@/shared/api/mock/runtime-ref';
import { DEMO_PEOPLE, FRESH_ADMIN } from './people';
import { ALL_ROLES, DEFAULT_BUDGET, ORBI, type TeammateRole } from './roles';

/** Deterministic ids so tests and two-tab demos agree. PROVENANCE: org.js used Store.uid. */
let n = 0;
export const uid = (p: string): string => `${p}${(++n).toString(36)}${Date.now().toString(36)}`;
export const resetUid = (): void => {
  n = 0;
};

const H = 3_600_000;

const emptyPerf = (): AgentPerf => ({
  daily: [0, 0, 0, 0, 0, 0, 0],
  success: 100,
  avgSec: 0,
  edited: 0,
  cost7: 0,
});

const base = (): StoreState => ({
  v: STORE_VERSION,
  org: {
    name: 'BrightPath Advisors',
    domain: 'brightpath.co',
    template: null,
    step: 1,
    launched: false,
    connectLater: false,
    guardrails: [...BASE_GUARDRAILS],
    job: null,
  },
  departments: [],
  people: [],
  agents: [],
  requests: [],
  connections: {},
  activity: [],
  audit: [],
  session: { userId: null },
});

/**
 * Build a teammate row from an Appendix A.1 role.
 *
 * Appendix A.1: Orbi is "always present, exactly one, never removable, not hired", so a
 * fresh office is seeded WITH it -- which is why the step-2 gate is specialist-only
 * (errata E-3, E-12).
 */
export function agentFromRole(
  role: TeammateRole,
  deptId: string | null,
  managerId: string | null,
  now = Date.now(),
): Agent {
  return {
    id: uid('a_'),
    roleId: role.id,
    name: role.name,
    job: role.job,
    type: role.type,
    deptId,
    managerId,
    ownerId: null,
    status: 'draft',
    pausedBy: null,
    doing: 'Not started',
    prompt: role.prompt,
    version: 1,
    versions: [{ v: 1, prompt: role.prompt, at: now, by: 'Org Admin' }],
    guardrails: [...BASE_GUARDRAILS],
    tools: [...role.tools],
    budget: { ...DEFAULT_BUDGET },
    runsToday: 0,
    costToday: 0,
    lastActive: now,
    provisioned: false,
    runtimeRef: null,
    blockedBy: [],
    perf: emptyPerf(),
  };
}

/**
 * An office document with nothing in it.
 *
 * What an office-facing read returns when there is no office to read: nothing is bound yet,
 * or the caller is the operator surface, which holds no policy on any content table
 * (Prompt 1.5 rule 3). It is a legitimate state rather than an error, so the shape is real
 * and every list in it is empty.
 */
export function blank(): StoreState {
  const s = base();
  s.org.name = '';
  s.org.domain = '';
  return s;
}

/** A brand-new office: the Org Admin, and Orbi. PROVENANCE: org.js `Seeds.fresh`. */
export function fresh(): StoreState {
  resetUid();
  const s = base();
  const now = Date.now();
  s.people.push({
    id: FRESH_ADMIN.id,
    name: FRESH_ADMIN.name,
    email: FRESH_ADMIN.email,
    title: FRESH_ADMIN.title,
    deptId: null,
    access: 'admin',
    authorities: [],
  });
  s.agents.push(agentFromRole(ORBI, null, null, now));
  s.audit.push({ at: now, who: 'System', what: `Office created for ${s.org.name}` });
  return s;
}

/**
 * The launched demo office.
 *
 * PROVENANCE: org.js `Seeds.demo` for the structure, statuses, owners and perf rows;
 * people.js for the five people (FD-21). Six teammates rather than nine, because Appendix
 * A.1 has six roles (errata E-7). Five departments -- PRD 7.3's example set -- because the
 * HR Coordinator needs one.
 *
 * The perf rows are carried from each role's prototype counterpart. They are not
 * tool-specific, so the two PROPOSED roles reuse their shape-counterpart's row:
 * Finance Clerk takes `ledger`'s and HR Coordinator takes `quill`'s. That is deliberate:
 * `quill`'s 44% edited is what keeps ONE agent per cause in the needs-attention rule
 * (success < 90 OR edited >= 40), so the Performance screen still demonstrates both halves.
 * The resulting flagged set is asserted in office.test.ts rather than reasoned about.
 */
export function demo(): StoreState {
  resetUid();
  const s = base();
  const now = Date.now();
  s.org.template = 'services';
  s.org.step = 5;
  s.org.launched = true;

  const deptIds: Record<string, string> = {};
  for (const name of ['Sales', 'Operations', 'Finance', 'Support', 'HR']) {
    const d = { id: uid('d_'), name };
    deptIds[name] = d.id;
    s.departments.push(d);
  }

  for (const p of DEMO_PEOPLE) {
    s.people.push({
      id: p.id,
      name: p.name,
      email: p.email,
      title: p.title,
      deptId: deptIds[p.deptName] ?? null,
      access: p.access,
      authorities: [...p.authorities],
    });
  }

  // PROVENANCE: org.js `perf`, by counterpart. [daily, success, avgSec, edited, cost7]
  const perf: Record<string, [number[], number, number, number, number]> = {
    orbi: [[3, 4, 4, 5, 4, 5, 4], 100, 3.1, 0, 1.9], // <- coordinator
    'sales-analyst': [[11, 13, 12, 15, 14, 16, 14], 97, 6.2, 8, 7.9], // <- scout
    'support-triager': [[18, 20, 22, 19, 24, 21, 23], 95, 4.1, 6, 6.4], // <- beacon
    'operations-reporter': [[1, 1, 1, 1, 1, 0, 0], 88, 8.1, 12, 0.3], // <- pulse
    'finance-clerk': [[5, 5, 6, 6, 5, 7, 6], 99, 9.8, 4, 2.9], // <- ledger (PROPOSED role)
    'hr-coordinator': [[4, 5, 3, 6, 5, 4, 5], 90, 18.6, 44, 4.1], // <- quill (PROPOSED role)
  };

  // PROVENANCE: org.js `owners`, by counterpart.
  const owners: Record<string, string> = {
    orbi: 'p_david',
    'sales-analyst': 'p_jordan',
    'support-triager': 'p_priya',
    'operations-reporter': 'p_jordan',
    'finance-clerk': 'p_marcus',
    'hr-coordinator': 'p_priya',
  };

  // PROVENANCE: org.js `stat`, by counterpart.
  const stat: Record<string, [AgentStatus, string]> = {
    orbi: ['running', 'Routing 3 new tasks to teammates'],
    'sales-analyst': ['running', 'Scoring a lead from Northwind Logistics'],
    'support-triager': ['running', 'Routing a billing question to Finance'],
    'operations-reporter': ['paused', 'Paused by Jordan Lee'],
    'finance-clerk': ['running', 'Checking 3 payments more than 30 days overdue'],
    'hr-coordinator': ['waiting', 'Handbook update ready for Priya to approve'],
  };

  const ids: Record<string, string> = {};
  for (const role of ALL_ROLES) {
    const p = perf[role.id]!;
    const a = agentFromRole(
      role,
      role.deptName ? (deptIds[role.deptName] ?? null) : (deptIds['Operations'] ?? null),
      null,
      now,
    );
    ids[role.id] = a.id;
    a.ownerId = owners[role.id] ?? null;
    a.status = stat[role.id]![0];
    a.doing = stat[role.id]![1];
    a.pausedBy = a.status === 'paused' ? 'user' : null;
    a.runsToday = p[0][6]!;
    a.costToday = Number((p[4] / 7).toFixed(2));
    a.lastActive = now - (2 + role.id.length * 3) * 60_000;
    a.provisioned = true;
    a.runtimeRef = mintRuntimeRef();
    a.perf = { daily: p[0], success: p[1], avgSec: p[2], edited: p[3], cost7: p[4] };
    a.versions = [{ v: 1, prompt: role.prompt, at: now - H * 144, by: 'Maria Santos (Org Admin)' }];
    s.agents.push(a);
  }
  for (const a of s.agents) if (a.type !== 'coordinator') a.managerId = ids['orbi']!;

  // Every connector the six roles need, plus the rest of the assignable catalog.
  // PROVENANCE: org.js seeded 7 of its 10; this seeds 7 of A.2's 8 (WhatsApp is not available).
  for (const k of ['email', 'calendar', 'slack', 'hubspot', 'drive', 'notion', 'stripe']) {
    s.connections[k] = {
      on: true,
      mode: k === 'slack' ? 'act' : 'draft',
      at: now - H * 140,
      by: 'Maria Santos',
      limits: { ...DEFAULT_CONNECTION_LIMITS },
    };
  }

  // PROVENANCE: org.js `s.requests` — both pending requests, verbatim, with tool keys
  // mapped to Appendix A.2 names.
  s.requests.push(
    {
      id: uid('rq'),
      by: 'p_jordan',
      name: 'Proposal Chaser',
      purpose: 'Follow up on proposals that go quiet for 3 days.',
      prompt:
        'Check HubSpot for proposals sent more than 3 days ago with no reply and draft a friendly nudge.',
      tools: ['email', 'hubspot'],
      reason: 'We lose about two deals a month to silence.',
      status: 'pending',
      adminNote: '',
      at: now - H * 5,
    },
    {
      id: uid('rq'),
      by: 'p_priya',
      name: 'Meeting Summarizer',
      purpose: 'Summarize client calls and share notes.',
      prompt:
        'After each client call, write a summary with decisions and action items, then email it to every attendee and post it in Slack.',
      tools: ['drive', 'slack', 'email'],
      reason: 'Notes are inconsistent and follow-ups slip.',
      status: 'pending',
      adminNote: '',
      at: now - H * 2,
    },
  );

  s.activity = receiptFeed(s.agents, now);
  s.audit.push({ at: now - H * 30, who: 'Maria Santos', what: 'Launched the office' });
  return s;
}

/**
 * Activity receipts. PROVENANCE: assets/data/tasks.js `Tasks.feed`, with the role lookup
 * moved from `jobId` to `roleId`.
 */
export function receiptFeed(agents: Agent[], now = Date.now()) {
  const out = [];
  for (const [i, a] of agents.entries()) {
    const role = ALL_ROLES.find((r) => r.id === a.roleId);
    const samples = role?.sample ?? [];
    for (const [k, title] of samples.slice(0, 2).entries()) {
      out.push({
        id: `r_${a.id}${k}`,
        t: now - (i * 37 + k * 95 + 8) * 60_000,
        agentId: a.id,
        title,
        status:
          k === 0 && a.type === 'specialist' && i % 3 === 1 ? ('waiting' as const) : ('done' as const),
        why: `Matched the instructions for ${a.name} and passed every guardrail.`,
        cost: Number((0.03 + ((i * 7 + k * 3) % 9) / 100).toFixed(2)),
        dur: Number((1.4 + ((i * 5 + k) % 30) / 10).toFixed(1)),
      });
    }
  }
  return out.toSorted((x, y) => y.t - x.t);
}

/** PROVENANCE: assets/data/tasks.js `Tasks.make`. */
export function sampleDoing(a: Agent): string {
  const role = ALL_ROLES.find((r) => r.id === a.roleId);
  const s = role?.sample ?? ['Working on a task'];
  return s[Math.floor(Math.random() * s.length)]!;
}
