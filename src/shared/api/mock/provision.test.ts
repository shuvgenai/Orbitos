import { beforeEach, describe, expect, it } from 'vitest';
import { INVITE_TTL_MS } from '@/shared/lib/invite';
import { PROVISION_STEPS, SAMPLE_OFFICES } from '@/apps/fleet/registry';
import { MockApiClient } from './index';

/**
 * Provisioning an office and redeeming its invitation, end to end against the mock.
 *
 * S-23 comes FIRST, as FD-31 constraint 3 asks: an operator action writing its audit row
 * into the affected office's own audit is the whole reason the multi-instance shape exists,
 * so it is the first thing covered rather than the last.
 */

const OPERATOR = 'Shuv Chowdhury';
const AT = Date.parse('2026-11-06T14:55:00.000Z');

const ACME = {
  name: 'Acme Ltd',
  domain: 'office.acme.com',
  email: 'ada@acme.com',
  adminName: 'Ada Okonkwo',
};

/** The operator's console: fleet fixtures, and no reach into any office's content. */
const operator = (now = () => AT) =>
  new MockApiClient({
    simulate: false,
    fleetSide: true,
    sampleOffices: SAMPLE_OFFICES,
    provisionSteps: [],
    instanceVersion: '1.4.2',
    now,
  });

/** A customer entry over the same localStorage: the invitee's browser. */
const customer = (now = () => AT) =>
  new MockApiClient({ simulate: false, instanceVersion: '1.4.2', now });

beforeEach(() => localStorage.clear());

describe('S-23 — an operator action is logged inside the office it affected', () => {
  it('writes the creation and the invitation into the NEW office own audit', async () => {
    const fleet = operator();
    const made = await fleet.provisionOffice(ACME, OPERATOR);
    expect(made.ok).toBe(true);

    // Read it as the office's own Org Admin would, through the customer entry.
    const admin = customer();
    await admin.bindOffice((made as { value: { officeId: string } }).value.officeId);
    const audit = await admin.listAudit();

    const what = audit.map((a) => a.what);
    expect(what).toContain('Office created for Acme Ltd');
    expect(what.some((w) => w.includes('Invitation issued to ada@acme.com'))).toBe(true);
    // Named actor on every row, which is what makes it an audit rather than a log.
    expect(audit.every((a) => a.who === OPERATOR)).toBe(true);
    fleet.dispose();
    admin.dispose();
  });

  it('does not write it into any OTHER office audit', async () => {
    const fleet = operator();
    const before = (await customer().listAudit()).length;
    await fleet.provisionOffice(ACME, OPERATOR);
    // The office that was already bound is untouched: an operator action lands in one office.
    expect((await customer().listAudit()).length).toBe(before);
    fleet.dispose();
  });

  it('records who issued the invitation and when (A-04 plus S-23)', async () => {
    const fleet = operator();
    await fleet.provisionOffice(ACME, OPERATOR);
    const [invite] = await fleet.listInvites();
    expect(invite?.issuedBy).toBe(OPERATOR);
    expect(invite?.issuedAt).toBe(AT);
    expect(invite?.expiresAt).toBe(AT + INVITE_TTL_MS);
    fleet.dispose();
  });
});

describe('the office appears, persists and survives a reload and a second tab', () => {
  it('appears in the fleet table as Awaiting onboarding', async () => {
    const fleet = operator();
    await fleet.provisionOffice(ACME, OPERATOR);
    const row = (await fleet.listOffices()).find((o) => o.domain === 'office.acme.com');
    expect(row?.name).toBe('Acme Ltd');
    expect(row?.status).toBe('awaiting');
    expect(row?.agents).toBe(1); // Orbi, who is always present and never hired (Appendix A.1).
    expect(row?.version).toBe('1.4.2');
    expect(row?.admin).toBe('ada@acme.com');
    fleet.dispose();
  });

  it('is still there in a second client over the same storage', async () => {
    const fleet = operator();
    await fleet.provisionOffice(ACME, OPERATOR);
    // A fresh client reading the same localStorage is a reload, and is also a second tab.
    const reloaded = operator();
    expect((await reloaded.listOffices()).some((o) => o.name === 'Acme Ltd')).toBe(true);
    fleet.dispose();
    reloaded.dispose();
  });

  it('survives Dev tools "Load demo office", which used to delete it', async () => {
    const fleet = operator();
    await fleet.provisionOffice(ACME, OPERATOR);
    await customer().loadDemo();
    expect((await operator().listOffices()).some((o) => o.name === 'Acme Ltd')).toBe(true);
    fleet.dispose();
  });

  it('is complete the moment it is recorded, so an interrupted run loses nothing', async () => {
    // The office and the invitation are written BEFORE the progress steps run, which is why
    // there is no window in which a reload leaves a half-made office.
    const fleet = operator();
    const made = await fleet.provisionOffice(ACME, OPERATOR);
    const { officeId, token } = (made as { value: { officeId: string; token: string } }).value;
    const reloaded = operator();
    expect((await reloaded.listInvites()).some((i) => i.token === token)).toBe(true);
    expect(await reloaded.getFleetOffice(officeId)).toBeDefined();
    fleet.dispose();
    reloaded.dispose();
  });
});

describe('the provision form refuses bad input instead of making an office', () => {
  it('refuses every field at once, in words a screen can show', async () => {
    const fleet = operator();
    const before = (await fleet.listOffices()).length;
    const r = await fleet.provisionOffice(
      { name: 'x', domain: 'not a domain', email: 'nope', adminName: '' },
      OPERATOR,
    );
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error('unreachable');
    expect(r.problems.length).toBe(4);
    for (const p of r.problems) expect(p).toMatch(/^[A-Z].*\.$/);
    // Nothing was created. The v1 version accepted exactly this input and returned ok.
    expect((await fleet.listOffices()).length).toBe(before);
    fleet.dispose();
  });

  it('refuses a second office on the same domain', async () => {
    const fleet = operator();
    expect((await fleet.provisionOffice(ACME, OPERATOR)).ok).toBe(true);
    const again = await fleet.provisionOffice(ACME, OPERATOR);
    expect(again.ok).toBe(false);
    if (!again.ok) expect(again.problems[0]).toContain('office.acme.com');
    expect((await fleet.listOffices()).filter((o) => o.domain === 'office.acme.com')).toHaveLength(1);
    fleet.dispose();
  });

  it('refuses a domain a sample office already holds', async () => {
    const fleet = operator();
    const taken = SAMPLE_OFFICES[0]!.domain;
    const r = await fleet.provisionOffice({ ...ACME, domain: taken }, OPERATOR);
    expect(r.ok).toBe(false);
    fleet.dispose();
  });

  it('runs its four progress steps when the entry supplies them', async () => {
    const fleet = new MockApiClient({
      simulate: false,
      fleetSide: true,
      provisionSteps: PROVISION_STEPS,
      now: () => AT,
    });
    await fleet.provisionOffice(ACME, OPERATOR);
    expect(fleet.provisionProgress()).toEqual({ i: PROVISION_STEPS.length, done: true });
    fleet.dispose();
  });
});

/** Provision Acme and hand back its invitation. Used by every case below. */
const issue = async () => {
  const fleet = operator();
  const made = await fleet.provisionOffice(ACME, OPERATOR);
  const value = (made as { value: { officeId: string; token: string; url: string } }).value;
  fleet.dispose();
  return value;
};

describe('the invitation (PRD A-04)', () => {
  it('opens on the Org Admin entry, showing the office and who it is for', async () => {
    const { token, url } = await issue();
    expect(url).toContain(`/orgadmin#/invite/${token}`);
    const seen = await customer().getInvite(token);
    expect(seen.ok).toBe(true);
    if (!seen.ok) throw new Error('unreachable');
    expect(seen.value).toMatchObject({
      officeName: 'Acme Ltd',
      name: 'Ada Okonkwo',
      email: 'ada@acme.com',
    });
  });

  it('sets a password, signs the Org Admin in, and lands them in their OWN office', async () => {
    const { token, officeId } = await issue();
    const app = customer();
    const r = await app.acceptInvite(token, 'a-good-enough-password');
    expect(r.ok).toBe(true);

    const office = await app.getOffice();
    expect(office.name).toBe('Acme Ltd');
    // Their own office, not the one that happened to be bound before.
    expect(office.name).not.toBe('BrightPath Advisors');
    const session = await app.getSession();
    const people = await app.listPeople();
    const me = people.find((p) => p.id === session.userId);
    expect(me?.email).toBe('ada@acme.com');
    expect(me?.access).toBe('admin');
    expect((r as { value: { officeId: string } }).value.officeId).toBe(officeId);
    app.dispose();
  });

  it('moves the fleet row to Org Admin onboarding, with no field having been set', async () => {
    const { token, officeId } = await issue();
    expect((await operator().getFleetOffice(officeId))?.status).toBe('awaiting');
    await customer().acceptInvite(token, 'a-good-enough-password');
    expect((await operator().getFleetOffice(officeId))?.status).toBe('onboarding');
  });

  it('works ONCE: a second open says it has already been used', async () => {
    const { token } = await issue();
    expect((await customer().acceptInvite(token, 'a-good-enough-password')).ok).toBe(true);

    const second = await customer().getInvite(token);
    expect(second.ok).toBe(false);
    if (!second.ok) expect(second.problems).toEqual(['This invitation has already been used.']);

    const retry = await customer().acceptInvite(token, 'another-password');
    expect(retry.ok).toBe(false);
    if (!retry.ok) expect(retry.problems).toEqual(['This invitation has already been used.']);
  });

  it('does not create a second Org Admin when a used link is opened again', async () => {
    const { token, officeId } = await issue();
    await customer().acceptInvite(token, 'a-good-enough-password');
    await customer().acceptInvite(token, 'a-good-enough-password');
    const app = customer();
    await app.bindOffice(officeId);
    expect(await app.listPeople()).toHaveLength(1);
    app.dispose();
  });

  it('expires after seven days, with its own message', async () => {
    const { token } = await issue();
    // The injectable clock is why this needs no timer mocking.
    const later = customer(() => AT + INVITE_TTL_MS + 1);
    const seen = await later.getInvite(token);
    expect(seen.ok).toBe(false);
    if (!seen.ok) expect(seen.problems).toEqual(['This invitation has expired.']);

    const taken = await later.acceptInvite(token, 'a-good-enough-password');
    expect(taken.ok).toBe(false);
    if (!taken.ok) expect(taken.problems).toEqual(['This invitation has expired.']);
    later.dispose();
  });

  it('is still valid one millisecond before it expires', async () => {
    const { token } = await issue();
    const edge = customer(() => AT + INVITE_TTL_MS - 1);
    expect((await edge.getInvite(token)).ok).toBe(true);
    edge.dispose();
  });

  it('says the same thing for an unknown token as for a tampered one', async () => {
    const { token } = await issue();
    const unknown = await customer().getInvite('0'.repeat(64));
    const tampered = await customer().getInvite(`${token.slice(0, -1)}f`);
    expect(unknown.ok).toBe(false);
    expect(tampered.ok).toBe(false);
    if (!unknown.ok && !tampered.ok) expect(unknown.problems).toEqual(tampered.problems);
  });

  it('refuses a password that is too short, and creates nobody', async () => {
    const { token, officeId } = await issue();
    const app = customer();
    const r = await app.acceptInvite(token, 'short');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.problems[0]).toContain('8 characters');
    // The invitation is still unspent, so a bad password costs nothing.
    expect((await app.getInvite(token)).ok).toBe(true);
    expect((await operator().getFleetOffice(officeId))?.status).toBe('awaiting');
    app.dispose();
  });

  it('never persists the chosen password anywhere (FD-32: it is discarded)', async () => {
    const { token } = await issue();
    const secret = 'correct-horse-battery-staple';
    await customer().acceptInvite(token, secret);
    // There is no credential store in the browser, so the honest thing is to keep nothing.
    expect(localStorage.getItem('orbitcrew.v1')).not.toContain(secret);
    expect(JSON.stringify(await customer().listInvites())).not.toContain(secret);
  });
});
