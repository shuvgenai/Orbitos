import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { MockApiClient } from '@/shared/api/mock';
import { ApiProvider } from '@/shared/api/provider';
import { SessionProvider } from '@/shared/auth/SessionProvider';
import { ToastProvider } from '@/shared/ui/Toast';
import { OPERATOR_ACCOUNTS, PORTAL } from './portal';
import { ProvisionScreen } from './ProvisionScreen';

/** S-01 and A-04 from the operator's side of the glass. */

const AT = Date.parse('2026-11-06T14:55:00.000Z');

/**
 * Signed in as the operator, because `RequireAccess` guarantees that in the real entry and
 * the issuer recorded on the invitation comes from the session.
 */
async function mount() {
  const client = new MockApiClient({
    simulate: false,
    fleetSide: true,
    provisionSteps: [],
    instanceVersion: '1.4.2',
    now: () => AT,
  });
  await client.signInAs(OPERATOR_ACCOUNTS[0]!.id);
  render(
    <ApiProvider client={client}>
      <SessionProvider portal={PORTAL} accounts={OPERATOR_ACCOUNTS}>
        <ToastProvider>
          <ProvisionScreen />
        </ToastProvider>
      </SessionProvider>
    </ApiProvider>,
  );
  return client;
}

async function fillAcme() {
  await userEvent.type(screen.getByLabelText(/Business name/), 'Acme Ltd');
  await userEvent.type(screen.getByLabelText(/Office domain/), 'office.acme.com');
  await userEvent.type(screen.getByLabelText(/Org Admin name/), 'Ada Okonkwo');
  await userEvent.type(screen.getByLabelText(/Org Admin email/), 'ada@acme.com');
}

const submit = () =>
  userEvent.click(screen.getByRole('button', { name: /Create office and invite/ }));

beforeEach(() => localStorage.clear());

describe('the provision form', () => {
  it('asks for the four facts the invitation needs', async () => {
    const client = await mount();
    for (const label of [
      /Business name/,
      /Office domain/,
      /Org Admin name/,
      /Org Admin email/,
    ]) {
      expect(screen.getByLabelText(label)).toBeInTheDocument();
    }
    client.dispose();
  });

  it('refuses bad input in plain words, and creates nothing', async () => {
    const client = await mount();
    await userEvent.type(screen.getByLabelText(/Business name/), 'x');
    await userEvent.type(screen.getByLabelText(/Office domain/), 'not a domain');
    await submit();

    const banner = await screen.findByRole('alert');
    expect(banner).toHaveTextContent(/domain like/i);
    // No status code on any screen (PRD 15.4), operator console included.
    expect(document.body.textContent).not.toMatch(/\b[45]\d\d\b/);
    // Zod ran in the screen, so no office was attempted.
    expect(await client.listOffices()).toHaveLength(1);
    client.dispose();
  });

  it('creates the office, then shows the invitation link and says no email was sent', async () => {
    const client = await mount();
    await fillAcme();
    await submit();

    expect(await screen.findByText(/awaiting onboarding/i)).toBeInTheDocument();

    // The link itself, on screen, because nothing can mail it (FD-32).
    const [invite] = await client.listInvites();
    expect(invite).toBeDefined();
    expect(screen.getByText(invite!.url)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Copy invite link' })).toBeInTheDocument();

    // THE ASSERTION THAT MATTERS MOST ON THIS SCREEN: it must not claim a send.
    const text = document.body.textContent ?? '';
    expect(text).toMatch(/Nothing has been emailed/);
    expect(text).not.toMatch(/email sent|sent an email|invitation sent/i);
    client.dispose();
  });

  it('records the operator as the issuer, from the session rather than a literal', async () => {
    const client = await mount();
    await fillAcme();
    await submit();
    await screen.findByText(/awaiting onboarding/i);
    // `provisionOffice` takes the actor as data; nothing in the shared client names an
    // operator, which is what keeps those words out of the customer bundles.
    await waitFor(async () => {
      expect((await client.listInvites())[0]?.issuedBy).toBe(OPERATOR_ACCOUNTS[0]!.name);
    });
    client.dispose();
  });

  it('puts the office in the fleet list as awaiting, with its own domain', async () => {
    const client = await mount();
    await fillAcme();
    await submit();
    await screen.findByText(/awaiting onboarding/i);
    const row = (await client.listOffices()).find((o) => o.domain === 'office.acme.com');
    expect(row?.name).toBe('Acme Ltd');
    expect(row?.status).toBe('awaiting');
    client.dispose();
  });

  it('refuses a second office on the same domain, through the client this time', async () => {
    const client = await mount();
    await fillAcme();
    await submit();
    await screen.findByText(/awaiting onboarding/i);
    await userEvent.click(screen.getByRole('button', { name: 'Provision another' }));

    await fillAcme();
    await submit();
    const banner = await screen.findByRole('alert');
    expect(banner).toHaveTextContent('office.acme.com');
    expect((await client.listOffices()).filter((o) => o.domain === 'office.acme.com')).toHaveLength(1);
    client.dispose();
  });
});
