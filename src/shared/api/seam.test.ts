import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { SAMPLE_OFFICES } from '@/apps/fleet/registry';
import { MockApiClient } from './mock';

/**
 * THE SEAM STAYS HONEST — FD-31 constraint 1.
 *
 * The mock holds every office in one localStorage document. Production does not: each office
 * is its own deployment with its own database (FD-1, PRD 14.1), and the fleet console sees it
 * only through the nightly numbers rollup (S-38). So an office-facing operation that took an
 * `officeId` would work beautifully here and be unbuildable there — the mock would have
 * taught this frontend something production cannot do.
 *
 * Hence: every office-facing operation acts on THE CURRENT OFFICE and takes no office
 * identifier. Only the surfaces named below may span offices, and this test fails if that set
 * grows — which is the point. Widening it is allowed; widening it *quietly* is not.
 */

const SOURCE = readFileSync(join(process.cwd(), 'src/shared/api/client.ts'), 'utf8');

/**
 * Every office-facing operation: it acts on THE CURRENT OFFICE and takes no office
 * identifier. This list and `MAY_SPAN` below must together account for the whole interface.
 */
const OFFICE_FACING = [
  'getState', 'subscribe',
  'getOffice', 'saveOffice', 'applyTemplate',
  'listDepartments', 'addDepartment', 'renameDepartment', 'removeDepartment',
  'listPeople', 'addPerson', 'updatePerson', 'removePerson', 'toggleAuthority', 'setAccess',
  'listAgents', 'createAgent', 'updateAgent', 'removeAgent', 'assign', 'autoAssign',
  'savePrompt', 'togglePause',
  'listConnections', 'connect', 'disconnect',
  'startLaunch', 'retryLaunch', 'getLaunchStatus',
  'listRequests', 'submitRequest', 'cancelRequest', 'decide',
  'listReceipts', 'listAudit',
  'getSession', 'signInAs',
  'loadDemo', 'resetFresh', 'setSimulation',
];

/**
 * The ONLY operations that may span offices. Every entry is here for a stated reason.
 *
 * `bindOffice` is the uncomfortable one and is listed rather than hidden: it is dev-only, it
 * exists so one browser can walk between the offices it has provisioned, and
 * `SupabaseApiClient` will refuse it. An exemption written down is a decision; an exemption
 * nobody wrote down is a hole.
 */
const MAY_SPAN = [
  // Fleet: the operator console's own reads, counts and status only.
  'listOffices',
  'getFleetOffice',
  'provisionOffice',
  // Invitations: keyed by TOKEN, not by office id. In production the link is served by that
  // office's own deployment, so the token is what routes.
  'getInvite',
  'acceptInvite',
  'listInvites',
  // Dev only, and not a production operation at all.
  'bindOffice',
];

/** Method declarations in the `ApiClient` interface, with comments stripped. */
function methods(): Array<{ name: string; params: string }> {
  const body = SOURCE.slice(SOURCE.indexOf('export interface ApiClient'));
  const clean = body.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
  return [...clean.matchAll(/^\s{2}(\w+)\(([\s\S]*?)\)\s*:/gm)].map((m) => ({
    name: m[1]!,
    params: m[2]!.replace(/\s+/g, ' ').trim(),
  }));
}

describe('the ApiClient seam', () => {
  it('is parsed at all, so this file cannot pass by reading nothing', () => {
    const found = methods().map((m) => m.name);
    // A guard on the guard. If the interface is reformatted past this regex, the assertions
    // below would all vacuously pass.
    expect(found.length).toBeGreaterThan(30);
    expect(found).toContain('getOffice');
    expect(found).toContain('listAgents');
    expect(found).toContain('provisionOffice');
  });
});

/**
 * Parameter NAMES, not the whole signature.
 *
 * The first version of this check tested the raw parameter text for the literal `officeId`,
 * and `listAgents(orgId: string)` sailed straight through -- which is the MORE likely name of
 * the two, because FD-1 is org-scoped and every table carries `org_id`. Verified by injecting
 * it and watching the test pass when it should have failed.
 *
 * Reading names only also keeps `saveOffice(patch: Partial<Pick<Office, ...>>)` from tripping
 * it: `Office` is the current office's own type and is not a scope selector.
 */
const SCOPE_NAME = /office|org|tenant|instance|workspace/i;

/** `a: string, b?: number` -> ['a', 'b']. Destructured parameters have no name to read. */
function paramNames(params: string): string[] {
  if (!params.trim()) return [];
  return params
    .split(',')
    .map((p) => p.split(':')[0]?.trim().replace(/[?.]/g, '') ?? '')
    .filter((n) => n && /^[A-Za-z_$][\w$]*$/.test(n));
}

describe('the office identifier', () => {
  it('appears in no office-facing operation, under any of its likely names', () => {
    const offenders = methods()
      .filter((m) => !MAY_SPAN.includes(m.name))
      .filter(
        (m) =>
          paramNames(m.params).some((n) => SCOPE_NAME.test(n)) ||
          /\bFleetOffice\b/.test(m.params),
      )
      .map((m) => `${m.name}(${m.params})`);
    expect(offenders).toEqual([]);
  });

  it('the name check really does read names, and really does catch each spelling', () => {
    // Without this the check above could pass by parsing nothing, which is how the version
    // it replaces managed to look green.
    expect(paramNames('officeId: string')).toEqual(['officeId']);
    expect(paramNames('id: string, byName: string')).toEqual(['id', 'byName']);
    expect(paramNames('patch: Partial<Pick<Office, \'name\'>>')).toEqual(['patch']);
    expect(paramNames('')).toEqual([]);
    for (const spelling of ['officeId', 'orgId', 'tenantId', 'instanceId', 'workspaceId', 'office']) {
      expect(SCOPE_NAME.test(spelling), spelling).toBe(true);
    }
    // And it does not flag the parameter names the interface legitimately uses.
    for (const fine of ['id', 'byName', 'patch', 'draft', 'token', 'password', 'key', 'mode']) {
      expect(SCOPE_NAME.test(fine), fine).toBe(false);
    }
  });
});

describe('the ApiClient seam, continued', () => {

  it('EVERY operation is classified, so a new one cannot slip in unclassified', () => {
    // The assertion that does the real work, and the first version of this test got it
    // wrong: it filtered the parsed names BY the allow list before comparing, so it could
    // only ever notice a method being REMOVED. A new `pauseOffice(id: string)` passed
    // silently -- which is precisely what section 3 of this work will add.
    //
    // Now the parsed set must equal the UNION of the two lists. Add a method to `ApiClient`
    // and this fails until a person puts it in one list or the other, which is the decision
    // FD-31 constraint 1 exists to force.
    const parsed = methods().map((m) => m.name);
    const classified = [...OFFICE_FACING, ...MAY_SPAN];
    expect(parsed.filter((n) => !classified.includes(n))).toEqual([]);
    expect(classified.filter((n) => !parsed.includes(n))).toEqual([]);
  });

  it('the two lists do not overlap', () => {
    // An operation in both would be classified and unclassified at once, and the union check
    // above would still pass.
    expect(OFFICE_FACING.filter((n) => MAY_SPAN.includes(n))).toEqual([]);
  });

  it('records in the interface itself why the rule exists', () => {
    // A later session reading only client.ts must find the reason there, not here.
    expect(SOURCE).toContain('FD-31 constraint 1');
    expect(SOURCE).toContain('S-38');
  });
});

/**
 * The runtime half. The source scan proves no office identifier is in the signatures; this
 * proves the current office is really what those signatures read.
 */
const operator = () =>
  new MockApiClient({
    simulate: false,
    fleetSide: true,
    sampleOffices: SAMPLE_OFFICES,
    provisionSteps: [],
    instanceVersion: '1.4.2',
  });

describe('an office-facing read follows the binding, and reaches exactly one office', () => {
  beforeEach(() => localStorage.clear());

  it('two clients bound to different offices see different offices', async () => {
    const fleet = operator();
    const a = await fleet.provisionOffice(
      { name: 'Acme Ltd', domain: 'office.acme.com', email: 'ada@acme.com', adminName: 'Ada Okonkwo' },
      'Operator',
    );
    const b = await fleet.provisionOffice(
      { name: 'Borealis BV', domain: 'office.borealis.com', email: 'bo@borealis.com', adminName: 'Bo Jensen' },
      'Operator',
    );
    if (!a.ok || !b.ok) throw new Error('could not provision');
    fleet.dispose();

    const one = new MockApiClient({ simulate: false });
    await one.bindOffice(a.value.officeId);
    expect((await one.getOffice()).name).toBe('Acme Ltd');

    const two = new MockApiClient({ simulate: false });
    await two.bindOffice(b.value.officeId);
    expect((await two.getOffice()).name).toBe('Borealis BV');

    // And a write through the office-facing surface lands in one office only.
    await two.saveOffice({ name: 'Borealis Renamed' });
    const after = new MockApiClient({ simulate: false });
    await after.bindOffice(a.value.officeId);
    expect((await after.getOffice()).name).toBe('Acme Ltd');

    one.dispose();
    two.dispose();
    after.dispose();
  });

  it('refuses to bind an office that does not exist, rather than binding nothing', async () => {
    const api = new MockApiClient({ simulate: false });
    const r = await api.bindOffice('ws_does_not_exist');
    expect(r.ok).toBe(false);
    // Still pointed at a real office, so the entry does not go blank.
    expect((await api.getOffice()).name).toBeTruthy();
    api.dispose();
  });
});
