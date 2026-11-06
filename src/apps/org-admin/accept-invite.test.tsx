import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { ApiProvider } from '@/shared/api/provider';
import { MockApiClient } from '@/shared/api/mock';
import { ToastProvider } from '@/shared/ui/Toast';
import { INVITE_MESSAGE, INVITE_TTL_MS } from '@/shared/lib/invite';
import { AcceptInvite } from './AcceptInvite';

/**
 * The invitation screen, as the invitee meets it. PRD A-04.
 *
 * It renders OUTSIDE `RequireAccess` -- an invitee has no account yet -- so these mount it
 * directly, which is exactly how `App.tsx` reaches it.
 */

const AT = Date.parse('2026-11-06T14:55:00.000Z');
const PASSWORD = 'a-good-enough-password';

const ACME = {
  name: 'Acme Ltd',
  domain: 'office.acme.com',
  email: 'ada@acme.com',
  adminName: 'Ada Okonkwo',
};

/** Provision Acme through the operator surface, and hand back its token. */
async function issueInvite(): Promise<string> {
  const fleet = new MockApiClient({
    simulate: false,
    fleetSide: true,
    provisionSteps: [],
    instanceVersion: '1.4.2',
    now: () => AT,
  });
  const made = await fleet.provisionOffice(ACME, 'Shuv Chowdhury');
  fleet.dispose();
  if (!made.ok) throw new Error('could not issue');
  return made.value.token;
}

function mount(token: string, now = () => AT) {
  const client = new MockApiClient({ simulate: false, instanceVersion: '1.4.2', now });
  render(
    <ApiProvider client={client}>
      <ToastProvider>
        <AcceptInvite token={token} />
      </ToastProvider>
    </ApiProvider>,
  );
  return client;
}

beforeEach(() => localStorage.clear());

describe('a valid invitation', () => {
  it('addresses the invitee by name and names the office they are joining', async () => {
    const token = await issueInvite();
    const client = mount(token);
    expect(await screen.findByText(/Ada Okonkwo/)).toBeInTheDocument();
    expect(screen.getByText(/Acme Ltd/)).toBeInTheDocument();
    client.dispose();
  });

  it('sets a password and signs the Org Admin into their own office', async () => {
    const token = await issueInvite();
    const client = mount(token);
    await screen.findByLabelText(/Choose a password/);

    await userEvent.type(screen.getByLabelText(/Choose a password/), PASSWORD);
    await userEvent.click(screen.getByRole('button', { name: /Set password and continue/ }));

    await waitFor(async () => {
      expect((await client.getOffice()).name).toBe('Acme Ltd');
    });
    const session = await client.getSession();
    const me = (await client.listPeople()).find((p) => p.id === session.userId);
    expect(me?.email).toBe('ada@acme.com');
    expect(me?.access).toBe('admin');
    client.dispose();
  });

  it('says plainly that the password is not enforcement', async () => {
    // FD-26 and FD-32. The reader of the screen is the person who needs to know, so the
    // statement is on the screen and not only in docs/auth.md.
    const token = await issueInvite();
    const client = mount(token);
    expect(await screen.findByText(/discarded/)).toBeInTheDocument();
    client.dispose();
  });

  it('refuses a short password in plain words, and keeps the invitation open', async () => {
    const token = await issueInvite();
    const client = mount(token);
    await screen.findByLabelText(/Choose a password/);
    await userEvent.type(screen.getByLabelText(/Choose a password/), 'short');
    await userEvent.click(screen.getByRole('button', { name: /Set password and continue/ }));

    // The banner specifically, not the field's own help text, which says the same thing.
    expect(await screen.findByRole('alert')).toHaveTextContent(/at least 8 characters/i);
    // No status code anywhere on a customer screen (PRD 15.4).
    expect(document.body.textContent).not.toMatch(/\b[45]\d\d\b/);
    expect((await client.getInvite(token)).ok).toBe(true);
    client.dispose();
  });
});

describe('an invitation that cannot be used', () => {
  it('says it has already been used, on a second open', async () => {
    const token = await issueInvite();
    const first = new MockApiClient({ simulate: false, now: () => AT });
    await first.acceptInvite(token, PASSWORD);
    first.dispose();

    const client = mount(token);
    expect(
      await screen.findByText('This invitation has already been used.'),
    ).toBeInTheDocument();
    // No password field: there is nothing to do here.
    expect(screen.queryByLabelText(/Choose a password/)).toBeNull();
    client.dispose();
  });

  it('says it has expired, after seven days', async () => {
    const token = await issueInvite();
    const client = mount(token, () => AT + INVITE_TTL_MS + 1);
    expect(await screen.findByText('This invitation has expired.')).toBeInTheDocument();
    expect(screen.queryByLabelText(/Choose a password/)).toBeNull();
    client.dispose();
  });

  /**
   * One message for an unknown token and for a tampered one, so the URL is not a token
   * oracle.
   *
   * Asserted as two cases against ONE SHARED CONSTANT rather than by mounting the screen
   * twice inside a single test and comparing the two strings. The comparing version was
   * flaky: two renders plus a provision in one test exceeded the default timeout under
   * parallel load, and it only ever failed when the machine was busy. Pinning both to
   * `INVITE_MESSAGE.unknown` is also the stronger assertion -- it fixes the sentence, where
   * comparing two renders would have passed if both had changed together.
   */
  it.each([
    ['an unknown token', '0'.repeat(64)],
    ['a tampered token', `${'a'.repeat(63)}f`],
  ])('shows the generic refusal for %s', async (_label, token) => {
    const client = mount(token);
    expect(await screen.findByRole('alert')).toHaveTextContent(INVITE_MESSAGE.unknown);
    // It does not say whether the invitation ever existed.
    expect(document.body.textContent).not.toMatch(/exist|not found|unknown token/i);
    client.dispose();
  });

  it('a tampered real token is refused, not accepted', async () => {
    // The pair above uses synthetic tokens; this one proves a REAL token with one character
    // changed does not open the door.
    const token = await issueInvite();
    const client = mount(`${token.slice(0, -1)}${token.endsWith('f') ? '0' : 'f'}`);
    expect(await screen.findByRole('alert')).toHaveTextContent(INVITE_MESSAGE.unknown);
    client.dispose();
  });

  it('names no other sign-in and offers no link away (Prompt 1.5: refuse, never redirect)', async () => {
    const client = mount('0'.repeat(64));
    await screen.findByRole('alert');
    expect(document.querySelectorAll('a')).toHaveLength(0);
    for (const word of ['ORBIT-OS', 'Super Admin', '/superadmin', '/org/login']) {
      expect(document.body.textContent).not.toContain(word);
    }
    client.dispose();
  });
});
