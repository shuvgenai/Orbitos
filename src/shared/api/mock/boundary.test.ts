import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SAMPLE_OFFICES } from '@/apps/fleet/registry';
import { MockApiClient } from './index';

/**
 * THE BOUNDARY THAT MUST NOT MOVE: the operator sees counts and status, never customer
 * content. PRD 7.1 and 10's preamble, Prompt 1.5 rule 3, FD-31 constraint 6.
 *
 * Holding every office in ONE localStorage document makes that boundary a discipline rather
 * than a wall, so this test matters more here than it would against a real database, not
 * less. It is written in the style of the infra repo's `db-guards-test.sh`, and for the same
 * two reasons spelled out there:
 *
 *   - **Counts are asserted BEFORE absences.** A method that returned nothing at all would
 *     pass an isolation check for entirely the wrong reason. Every block below first proves
 *     the operator path still sees what it is supposed to see.
 *   - **The content is sentinel content.** Distinctive strings seeded into an office, then
 *     searched for in the stringified result of every operator call, so a leak through a
 *     field nobody thought of is still caught.
 */

const OPERATOR = 'Shuv Chowdhury';
const AT = Date.parse('2026-11-06T14:55:00.000Z');

/**
 * Strings that exist ONLY inside an office. If any appears in anything the operator path
 * returns, content has crossed the boundary.
 */
const SENTINELS = {
  personName: 'Zendaya Quintrell-Vasquez',
  personEmail: 'zendaya.quintrell@sentinel.example',
  agentName: 'Sentinel Ledger Reconciler',
  agentPrompt: 'SENTINEL-PROMPT-do-not-leak-this-instruction',
  requestPurpose: 'SENTINEL-REQUEST-purpose-string',
  receiptTitle: 'SENTINEL-RECEIPT-title-string',
  guardrail: 'SENTINEL-GUARDRAIL-never-wire-money',
  job: 'SENTINEL-JOB-approve-expenses-under-500',
};

const customer = () => new MockApiClient({ simulate: false, instanceVersion: '1.4.2', now: () => AT });
const operator = () =>
  new MockApiClient({
    simulate: false,
    fleetSide: true,
    sampleOffices: SAMPLE_OFFICES,
    provisionSteps: [],
    instanceVersion: '1.4.2',
    now: () => AT,
  });

/**
 * Every case in this file seeds a LAUNCHED office, and the launch job runs on real timers, so
 * each one gets an explicit budget. The 5s default is enough when this file runs alone and is
 * not when the suite runs in parallel -- which made it look like a flaky boundary rather than
 * a slow fixture.
 */
const BUDGET = 30_000;

/** An office with a full load of distinctive content in it, reached as its own Org Admin. */
async function seedOfficeWithContent(): Promise<string> {
  const fleet = operator();
  const made = await fleet.provisionOffice(
    {
      name: 'Sentinel Holdings',
      domain: 'office.sentinel.example',
      email: SENTINELS.personEmail,
      adminName: SENTINELS.personName,
    },
    OPERATOR,
  );
  if (!made.ok) throw new Error('could not seed');
  const { officeId, token } = made.value;
  fleet.dispose();

  const app = customer();
  await app.acceptInvite(token, 'a-good-enough-password');
  await app.saveOffice({ name: 'Sentinel Holdings' });
  await app.addDepartment('Finance');

  const orbi = (await app.listAgents()).find((a) => a.type === 'coordinator');
  const created = await app.createAgent({
    id: null,
    type: 'specialist',
    roleId: 'finance_clerk',
    name: SENTINELS.agentName,
    job: SENTINELS.job,
    deptId: null,
    managerId: orbi?.id ?? null,
    prompt: SENTINELS.agentPrompt,
    tools: [],
    budget: { monthlyUsd: 25, dailyCheapCheckUsd: 2, turnLimit: 12 },
  });
  if (!created.ok) throw new Error(`seed agent refused: ${created.problems.join(' ')}`);
  // Guardrails go through savePrompt, not updateAgent: they are not a field a patch may
  // touch (Prompt 1.5 rule 2, migration 0004's immutability trigger).
  await app.savePrompt(created.value.id, SENTINELS.agentPrompt, SENTINELS.personName, [
    SENTINELS.guardrail,
  ]);

  const people = await app.listPeople();
  await app.submitRequest(people[0]?.name ?? 'Ada', {
    name: 'Sentinel Request',
    purpose: SENTINELS.requestPurpose,
    prompt: 'SENTINEL-REQUEST-prompt-string-that-is-long-enough-to-pass-validation',
    tools: [],
    reason: 'SENTINEL-REQUEST-reason',
  });

  // Launched, and WAITED FOR: the launch job runs in the background, so asserting before it
  // finishes would compare two moving snapshots and fail for a reason that is not the
  // boundary.
  await app.startLaunch();
  await vi.waitFor(async () => expect((await app.getLaunchStatus())?.done).toBe(true), {
    timeout: 15_000,
  });
  app.dispose();
  return officeId;
}

beforeEach(() => localStorage.clear());

describe('first: the operator path really does see the offices (so an absence means something)', () => {
  it('sees every office, its counts and its status', async () => {
    const officeId = await seedOfficeWithContent();
    const fleet = operator();
    const rows = await fleet.listOffices();

    // Two instances -- the seeded local one and Sentinel Holdings -- plus three fixtures.
    expect(rows.length).toBe(2 + SAMPLE_OFFICES.length);
    const row = rows.find((o) => o.id === officeId);
    expect(row).toBeDefined();
    expect(row?.name).toBe('Sentinel Holdings');
    expect(row?.domain).toBe('office.sentinel.example');
    // Counts, which is exactly what the operator is entitled to.
    expect(row?.agents).toBeGreaterThan(0);
    expect(row?.status).toBe('live');
    expect(row?.version).toBe('1.4.2');
    fleet.dispose();
  }, BUDGET);
});

describe('then: no customer content reaches the operator path', () => {
  it('leaks no sentinel through listOffices or getFleetOffice', async () => {
    const officeId = await seedOfficeWithContent();
    const fleet = operator();
    const seen = JSON.stringify([await fleet.listOffices(), await fleet.getFleetOffice(officeId)]);

    for (const [field, value] of Object.entries(SENTINELS)) {
      // The Org Admin's email is the one exception and is asserted separately below: the
      // OPERATOR typed it on the provision form, so it is operator metadata, not content.
      if (field === 'personEmail') continue;
      expect(seen, `${field} crossed the boundary`).not.toContain(value);
    }
    fleet.dispose();
  }, BUDGET);

  it('reaches zero rows of agents, requests, receipts, people and departments', async () => {
    await seedOfficeWithContent();
    const fleet = operator();

    // The mock's stand-in for "Super Admin gets no policy on any content table". Each of
    // these returns a real, non-empty list through a customer entry over the same storage,
    // which is what makes the zero here a boundary rather than an empty database.
    expect(await fleet.listAgents()).toEqual([]);
    expect(await fleet.listRequests()).toEqual([]);
    expect(await fleet.listReceipts()).toEqual([]);
    expect(await fleet.listPeople()).toEqual([]);
    expect(await fleet.listDepartments()).toEqual([]);
    expect(await fleet.listAudit()).toEqual([]);
    expect(await fleet.listConnections()).toEqual({});
    fleet.dispose();
  }, BUDGET);

  it('and a customer entry over the SAME storage does see all of it', async () => {
    // The control. Without this the test above would pass against an empty document.
    const officeId = await seedOfficeWithContent();
    const app = customer();
    await app.bindOffice(officeId);
    expect((await app.listAgents()).length).toBeGreaterThan(0);
    expect((await app.listPeople()).length).toBeGreaterThan(0);
    expect((await app.listRequests()).length).toBeGreaterThan(0);
    expect((await app.listAudit()).length).toBeGreaterThan(0);
    expect(JSON.stringify(await app.listAgents())).toContain(SENTINELS.agentPrompt);
    app.dispose();
  }, BUDGET);

  it('leaks no sentinel through getState, getOffice or the whole operator surface', async () => {
    const officeId = await seedOfficeWithContent();
    const fleet = operator();
    const everything = JSON.stringify([
      await fleet.getState(),
      await fleet.getOffice(),
      await fleet.listOffices(),
      await fleet.getFleetOffice(officeId),
      await fleet.listInvites(),
      await fleet.listAgents(),
      await fleet.listPeople(),
      await fleet.listRequests(),
      await fleet.listReceipts(),
      await fleet.listAudit(),
      await fleet.getLaunchStatus(),
      await fleet.getSession(),
    ]);

    for (const [field, value] of Object.entries(SENTINELS)) {
      // The invitation carries the Org Admin's name and address, both typed by the operator
      // on the provision form. Asserted below rather than skipped silently.
      if (field === 'personEmail' || field === 'personName') continue;
      expect(everything, `${field} crossed the boundary`).not.toContain(value);
    }
    fleet.dispose();
  }, BUDGET);

  it('the operator own session never lands inside an office', async () => {
    const officeId = await seedOfficeWithContent();
    const fleet = operator();
    await fleet.signInAs('op_shuv');
    // It persists for the operator...
    expect((await operator().getSession()).userId).toBe('op_shuv');
    // ...and it did not touch the office's own session, which belongs to its Org Admin.
    const app = customer();
    await app.bindOffice(officeId);
    expect((await app.getSession()).userId).not.toBe('op_shuv');
    fleet.dispose();
    app.dispose();
  }, BUDGET);

  it('the operator writes nothing into an office through the office-facing surface', async () => {
    const officeId = await seedOfficeWithContent();
    const app = customer();
    await app.bindOffice(officeId);
    const before = JSON.stringify(await app.getState());

    const fleet = operator();
    // Every one of these is a write an operator must not be able to make into an office.
    await fleet.saveOffice({ name: 'Renamed By The Operator' });
    await fleet.addDepartment('Operator Department');
    await fleet.addPerson({ name: 'Operator Person' });
    await fleet.removeAgent('a_1');
    await fleet.connect('gmail', 'read');
    // The two Dev tools buttons. They reach `store.reset` directly rather than through the
    // office-facing write path, so blocking that path did NOT block them: one click on "Load
    // demo office" in the operator console replaced a customer's whole office with the demo
    // seed, under that customer's own id. Found by review, reproduced by this line.
    await fleet.loadDemo();
    await fleet.resetFresh();
    // signInAs is deliberately NOT in this list: the operator's session is their own, lives
    // at the document level, and is not a write into an office. Covered by the case above.
    fleet.dispose();

    const after = customer();
    await after.bindOffice(officeId);
    expect(JSON.stringify(await after.getState())).toBe(before);
    app.dispose();
    after.dispose();
  }, BUDGET);

  it('what the operator MAY know about a person is only what the operator typed', async () => {
    // The admin contact address is on the fleet row by design -- the three prototype fixtures
    // all carry one. It is defensible precisely because it never came out of the office: it
    // is read from the operator's own metadata, written at provision time from the provision
    // form. This asserts that provenance rather than waving the field through.
    const officeId = await seedOfficeWithContent();
    const fleet = operator();
    const row = await fleet.getFleetOffice(officeId);
    expect(row?.admin).toBe(SENTINELS.personEmail);

    // And it does not become a live window into the office's people: renaming the person
    // inside the office changes nothing on the operator's row.
    const app = customer();
    await app.bindOffice(officeId);
    const people = await app.listPeople();
    await app.updatePerson(people[0]!.id, { email: 'changed@sentinel.example' });
    expect((await operator().getFleetOffice(officeId))?.admin).toBe(SENTINELS.personEmail);
    fleet.dispose();
    app.dispose();
  }, BUDGET);
});
