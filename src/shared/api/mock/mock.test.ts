import { beforeEach, describe, expect, it, vi } from 'vitest';
import { STORE_KEY } from '@/shared/seeds/config';
import { MockApiClient } from './index';

const make = async (kind: 'fresh' | 'demo' = 'demo') => {
  localStorage.clear();
  const api = new MockApiClient({ simulate: false });
  if (kind === 'demo') await api.loadDemo();
  else await api.resetFresh();
  return api;
};

const byName = async (api: MockApiClient, name: string) =>
  (await api.listAgents()).find((a) => a.name === name)!;

beforeEach(() => {
  localStorage.clear();
  vi.useRealTimers();
});

describe('persistence', () => {
  it('writes the one key and nothing else', async () => {
    const api = await make();
    expect(Object.keys(localStorage)).toEqual([STORE_KEY]);
    api.dispose();
  });

  it('a second client reads what the first wrote', async () => {
    const a = await make();
    await a.addDepartment('Logistics');
    const b = new MockApiClient({ simulate: false });
    expect((await b.listDepartments()).map((d) => d.name)).toContain('Logistics');
    a.dispose();
    b.dispose();
  });
});

describe('updateAgent is a patch — DEFECT 2 (docs/plan.md 4-B2)', () => {
  it('leaves every field the caller did not send alone', async () => {
    const api = await make();
    const before = await byName(api, 'Sales Analyst');

    const r = await api.updateAgent(before.id, { job: 'Qualifies and scores inbound leads' });
    expect(r.ok).toBe(true);

    const after = (await api.listAgents()).find((a) => a.id === before.id)!;
    expect(after.job).toBe('Qualifies and scores inbound leads');
    // The fields the prototype's full-record assign would have nulled:
    expect(after.roleId).toBe(before.roleId);
    expect(after.deptId).toBe(before.deptId);
    expect(after.tools).toEqual(before.tools);
    expect(after.managerId).toBe(before.managerId);
    expect(after.budget).toEqual(before.budget);
    // And the fields that are not in AgentPatch at all, so cannot be reached from here:
    expect(after.ownerId).toBe(before.ownerId);
    expect(after.perf).toEqual(before.perf);
    expect(after.guardrails).toEqual(before.guardrails);
    api.dispose();
  });

  it('discriminates: the prototype full-record assign nulls the omitted fields', async () => {
    const api = await make();
    const before = await byName(api, 'Sales Analyst');

    // The prototype's own shape: a body built with `field: spec.field || null` and
    // Object.assign'd over the row. Reproduced here so the regression has a name.
    const caller: { job: string; deptId?: string | null; roleId?: string | null } = {
      job: 'Qualifies and scores inbound leads',
    };
    const prototypeBody = {
      name: before.name,
      job: caller.job,
      type: before.type,
      managerId: before.managerId,
      prompt: before.prompt,
      tools: before.tools,
      budget: before.budget,
      // The two the prototype wrote as `spec.field || null`, with the caller sending neither.
      deptId: caller.deptId ?? null,
      roleId: caller.roleId ?? null,
    };
    const clobbered = { ...before, ...prototypeBody };
    expect(clobbered.roleId).toBeNull(); // the defect, reproduced
    expect(clobbered.deptId).toBeNull();

    await api.updateAgent(before.id, { job: 'Qualifies and scores inbound leads' });
    const after = (await api.listAgents()).find((a) => a.id === before.id)!;
    expect(after.roleId).not.toBeNull(); // the fix
    expect(after.deptId).not.toBeNull();
    api.dispose();
  });

  it('keeps the receipts working, which is what losing roleId broke', async () => {
    const api = await make();
    const a = await byName(api, 'Sales Analyst');
    await api.updateAgent(a.id, { job: 'Still qualifying leads' });
    const after = (await api.listAgents()).find((x) => x.id === a.id)!;
    // roleId is the key the "Right now" lines and the receipt titles are looked up by.
    expect(after.roleId).toBe('sales-analyst');
    api.dispose();
  });

  it('bumps the version only when the instructions actually change', async () => {
    const api = await make();
    const a = await byName(api, 'Sales Analyst');
    await api.updateAgent(a.id, { job: 'Unchanged instructions' });
    expect((await byName(api, 'Sales Analyst')).version).toBe(a.version);
    await api.updateAgent(a.id, { prompt: `${a.prompt} And flag existing customers.` });
    expect((await byName(api, 'Sales Analyst')).version).toBe(a.version + 1);
    api.dispose();
  });

  it('refuses a patch that would break a rule, and changes nothing', async () => {
    const api = await make();
    const a = await byName(api, 'Sales Analyst');
    const r = await api.updateAgent(a.id, { managerId: a.id });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.problems).toContain('That would create a loop in the org chart.');
    expect((await byName(api, 'Sales Analyst')).managerId).toBe(a.managerId);
    api.dispose();
  });
});

/** The prototype's own resume condition, verbatim in shape: match the sentence. */
const prototypeWouldResume = (doing: string) => /to be connected/.test(doing);

describe('a person pause survives a tool round-trip — DEFECT 3 (plan 4-B3)', () => {
  it('does not resume an agent a person paused', async () => {
    const api = await make();
    const triager = await byName(api, 'Support Triager'); // tools: email, slack

    await api.togglePause(triager.id, 'Marcus Reed');
    let now = (await api.listAgents()).find((a) => a.id === triager.id)!;
    expect(now.status).toBe('paused');
    expect(now.pausedBy).toBe('user');
    expect(now.doing).toBe('Paused by Marcus Reed');

    await api.disconnect('slack');
    now = (await api.listAgents()).find((a) => a.id === triager.id)!;
    expect(now.pausedBy).toBe('user'); // the tool did not take the pause over
    expect(now.doing).toBe('Paused by Marcus Reed'); // the reason is still the person's
    expect(now.blockedBy).toContain('slack'); // but the missing tool is recorded

    await api.connect('slack', 'act');
    now = (await api.listAgents()).find((a) => a.id === triager.id)!;
    expect(now.status).toBe('paused'); // THE DEFECT: the prototype returned 'idle' here
    expect(now.pausedBy).toBe('user');
    expect(now.doing).toBe('Paused by Marcus Reed');
    api.dispose();
  });

  it('still resumes an agent the tool paused', async () => {
    const api = await make();
    const reporter = await byName(api, 'Operations Reporter'); // seeded paused by a person
    await api.togglePause(reporter.id, 'Jordan Lee'); // resume it first
    const analyst = await byName(api, 'Sales Analyst'); // tools: email, hubspot

    await api.disconnect('hubspot');
    let now = (await api.listAgents()).find((a) => a.id === analyst.id)!;
    expect(now.status).toBe('paused');
    expect(now.pausedBy).toBe('tool');

    await api.connect('hubspot', 'draft');
    now = (await api.listAgents()).find((a) => a.id === analyst.id)!;
    expect(now.status).toBe('idle');
    expect(now.pausedBy).toBeNull();
    expect(now.blockedBy).toEqual([]);
    api.dispose();
  });

  it('discriminates: the prototype resumed on a display-string match', async () => {
    // disconnect() overwrote `doing` first, so by the time connect() ran, a person's pause
    // and a tool's pause were indistinguishable -- both read "Waiting for X to be connected".
    expect(prototypeWouldResume('Waiting for Slack to be connected')).toBe(true);
    expect(prototypeWouldResume('Paused by Marcus Reed')).toBe(false);
    // Which is only safe if disconnect leaves the person's sentence intact. It did not.
    const api = await make();
    const t = await byName(api, 'Support Triager');
    await api.togglePause(t.id, 'Marcus Reed');
    await api.disconnect('slack');
    const after = (await api.listAgents()).find((a) => a.id === t.id)!;
    expect(prototypeWouldResume(after.doing)).toBe(false); // the fix keeps it distinguishable
    api.dispose();
  });
});

describe('the ticker writes receipts — FD-24', () => {
  it('appends a receipt when it moves a teammate to running', async () => {
    const api = await make();
    const before = (await api.listReceipts()).length;
    const rand = vi.spyOn(Math, 'random').mockReturnValue(0.1); // act, and choose `running`
    api.tick();
    rand.mockRestore();

    const after = await api.listReceipts();
    expect(after.length).toBeGreaterThan(before);
    const newest = after[0]!;
    expect(newest.why).toContain('passed every guardrail');
    expect(newest.cost).toBeGreaterThan(0);
    expect(newest.dur).toBeGreaterThan(0);
    const running = (await api.listAgents()).filter((a) => a.status === 'running');
    expect(running.map((a) => a.id)).toContain(newest.agentId);
    api.dispose();
  });

  it('discriminates: a run count that climbs with a frozen Activity screen is the defect', async () => {
    const api = await make();
    const runsBefore = (await api.listAgents()).reduce((t, a) => t + a.runsToday, 0);
    const receiptsBefore = (await api.listReceipts()).length;
    const rand = vi.spyOn(Math, 'random').mockReturnValue(0.1);
    api.tick();
    rand.mockRestore();
    const runsAfter = (await api.listAgents()).reduce((t, a) => t + a.runsToday, 0);
    const receiptsAfter = (await api.listReceipts()).length;
    expect(runsAfter).toBeGreaterThan(runsBefore);
    // The prototype's ticker bumped the first number and never the second.
    expect(receiptsAfter - receiptsBefore).toBeGreaterThan(0);
    api.dispose();
  });

  it('does nothing before the office is launched', async () => {
    const api = await make('fresh');
    const before = await api.listReceipts();
    api.tick();
    expect(await api.listReceipts()).toEqual(before);
    api.dispose();
  });

  it('never wakes an agent a person paused', async () => {
    const api = await make();
    const t = await byName(api, 'Support Triager');
    await api.togglePause(t.id, 'Priya Nair');
    const rand = vi.spyOn(Math, 'random').mockReturnValue(0.1);
    for (let i = 0; i < 5; i += 1) api.tick();
    rand.mockRestore();
    expect((await api.listAgents()).find((a) => a.id === t.id)!.status).toBe('paused');
    api.dispose();
  });
});

describe('launch', () => {
  it('runs the seven steps in order and provisions everything', async () => {
    const api = await make('fresh');
    await api.addDepartment('Sales');
    const depts = await api.listDepartments();
    await api.updatePerson((await api.listPeople())[0]!.id, { deptId: depts[0]!.id });
    await api.addPerson({
      name: 'David Park',
      email: 'david@brightpath.co',
      deptId: depts[0]!.id,
      authorities: ['leader'],
    });
    const orbi = (await api.listAgents())[0]!;
    await api.createAgent({
      id: null,
      type: 'specialist',
      roleId: 'sales-analyst',
      name: 'Sales Analyst',
      job: 'Qualifies new inbound leads',
      deptId: depts[0]!.id,
      managerId: orbi.id,
      prompt: 'x'.repeat(40),
      tools: ['email'],
      budget: { monthlyUsd: 25, dailyCheapCheckUsd: 2, turnLimit: 12 },
    });
    await api.connect('email', 'draft');
    await api.autoAssign();

    await api.startLaunch(false);
    await vi.waitFor(async () => expect((await api.getLaunchStatus())?.done).toBe(true), {
      timeout: 15_000,
    });

    const job = (await api.getLaunchStatus())!;
    expect(job.steps.map((s) => s.k)).toEqual([
      'company',
      'chart',
      'agents',
      'profiles',
      'budgets',
      'tools',
      'invites',
    ]);
    expect(job.steps.every((s) => s.status === 'done')).toBe(true);
    expect((await api.getOffice()).launched).toBe(true);
    expect((await api.listAgents()).every((a) => a.provisioned)).toBe(true);
    expect((await api.listPeople()).find((p) => p.name === 'David Park')!.invited).toBe(true);
    api.dispose();
  }, 30_000);

  it('fails the workspace step once, then Retry resumes from it and finishes', async () => {
    const api = await make('fresh');
    await api.startLaunch(true);
    await vi.waitFor(async () => expect((await api.getLaunchStatus())?.error).not.toBe(''), {
      timeout: 15_000,
    });

    const failed = (await api.getLaunchStatus())!;
    const failing = failed.steps.find((s) => s.status === 'fail')!;
    expect(failing.k).toBe('profiles');
    expect(failing.label).toBe('Give each agent its own workspace');
    expect(failed.error).toContain('Nothing was lost');
    // The three before it stay done: Retry resumes, it does not restart.
    expect(failed.steps.slice(0, 3).every((s) => s.status === 'done')).toBe(true);

    await api.retryLaunch();
    await vi.waitFor(async () => expect((await api.getLaunchStatus())?.done).toBe(true), {
      timeout: 15_000,
    });
    expect((await api.getOffice()).launched).toBe(true);
    api.dispose();
  }, 30_000);

  it('launches an agent with a missing tool paused, and names the tool', async () => {
    const api = await make('fresh');
    const orbi = (await api.listAgents())[0]!;
    await api.createAgent({
      id: null,
      type: 'specialist',
      roleId: 'support-triager',
      name: 'Support Triager',
      job: 'Routes support email',
      deptId: null,
      managerId: orbi.id,
      prompt: 'x'.repeat(40),
      tools: ['slack'],
      budget: { monthlyUsd: 25, dailyCheapCheckUsd: 2, turnLimit: 12 },
    });
    await api.saveOffice({ connectLater: true });
    await api.startLaunch(false);
    await vi.waitFor(async () => expect((await api.getLaunchStatus())?.done).toBe(true), {
      timeout: 15_000,
    });

    const t = (await api.listAgents()).find((a) => a.name === 'Support Triager')!;
    expect(t.status).toBe('paused');
    expect(t.pausedBy).toBe('tool');
    expect(t.blockedBy).toEqual(['slack']);
    expect(t.doing).toBe('Waiting for Slack to be connected');
    api.dispose();
  }, 30_000);
});

describe('requests', () => {
  it('approving creates the teammate the spec describes', async () => {
    const api = await make();
    const r = (await api.listRequests()).find((x) => x.name === 'Meeting Summarizer')!;
    const office = await api.getOffice();
    const guards = [...office.guardrails, 'Never email customers directly.'];

    const res = await api.decide(r.id, 'approved', { prompt: r.prompt, guards, note: '' });
    expect(res.ok).toBe(true);

    const a = (await api.listAgents()).find((x) => x.name === 'Meeting Summarizer')!;
    const people = await api.listPeople();
    expect(people.find((p) => p.id === a.ownerId)!.name).toBe('Priya Nair');
    expect(a.guardrails).toHaveLength(4);
    const orbi = (await api.listAgents()).find((x) => x.type === 'coordinator')!;
    expect(a.managerId).toBe(orbi.id);
    expect(a.status).toBe('idle');
    expect(a.provisioned).toBe(true);
    expect(a.budget).toEqual({ monthlyUsd: 25, dailyCheapCheckUsd: 2, turnLimit: 12 });
    api.dispose();
  });

  it('refuses Request changes and Decline without a note', async () => {
    const api = await make();
    const r = (await api.listRequests())[0]!;
    const changes = await api.decide(r.id, 'changes', { prompt: r.prompt, guards: [], note: '  ' });
    expect(changes.ok).toBe(false);
    if (!changes.ok) expect(changes.problems[0]).toBe('Say what to change so they can fix it.');
    const declined = await api.decide(r.id, 'rejected', { prompt: r.prompt, guards: [], note: '' });
    expect(declined.ok).toBe(false);
    expect((await api.listRequests()).find((x) => x.id === r.id)!.status).toBe('pending');
    api.dispose();
  });

  it('a revision replaces the same request rather than making a second', async () => {
    const api = await make();
    const before = (await api.listRequests()).length;
    const r = (await api.listRequests())[0]!;
    await api.submitRequest(
      r.by,
      { name: r.name, purpose: r.purpose, prompt: r.prompt, tools: r.tools, reason: 'Revised.' },
      r.id,
    );
    expect(await api.listRequests()).toHaveLength(before);
    expect((await api.listRequests()).find((x) => x.id === r.id)!.reason).toBe('Revised.');
    api.dispose();
  });
});

describe('Orbi cannot be removed — FD-18', () => {
  it('refuses, with the reason', async () => {
    const api = await make('fresh');
    const orbi = (await api.listAgents())[0]!;
    const r = await api.removeAgent(orbi.id);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.problems[0]).toBe('Orbi coordinates this office and cannot be removed.');
    expect(await api.listAgents()).toHaveLength(1);
    api.dispose();
  });
});

describe('the audit', () => {
  it('writes an entry for every change, newest first, capped at 40', async () => {
    const api = await make();
    await api.addDepartment('Logistics');
    const a = await byName(api, 'Sales Analyst');
    await api.updateAgent(a.id, { job: 'Changed' });
    const audit = await api.listAudit();
    expect(audit[0]!.what).toContain('updated Sales Analyst');
    for (let i = 0; i < 45; i += 1) await api.assign(a.id, 'p_jordan');
    expect((await api.listAudit()).length).toBeLessThanOrEqual(40);
    api.dispose();
  });
});
