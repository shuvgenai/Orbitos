import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axe from 'axe-core';
import { beforeEach, describe, expect, it } from 'vitest';
import { ApiProvider } from '@/shared/api/provider';
import { MockApiClient } from '@/shared/api/mock';
import { PORTAL as FLEET_PORTAL, OPERATOR_ACCOUNTS } from '@/apps/fleet/portal';
import { PORTAL as ORG_PORTAL } from '@/apps/org-admin/portal';
import { PORTAL as USER_PORTAL } from '@/apps/user/portal';
import { ToastProvider } from '@/shared/ui/Toast';
import { SIGN_IN_FAILURE } from './Login';
import { RequireAccess } from './RequireAccess';
import { SessionProvider } from './SessionProvider';
import type { Account, Portal } from './portal';

const DEV_PASSWORD = 'orbitcrew-dev';

/** The demo office's own people. FD-21: people.js is the source. */
const USER_EMAIL = 'david@brightpath.co'; // access: user
const ADMIN_EMAIL = 'maria@brightpath.co'; // access: admin
const OPERATOR_EMAIL = 'shuv@orbitumai.com'; // access: super, fleet entry only

async function mount(portal: Portal, accounts: readonly Account[] = []) {
  localStorage.clear();
  const api = new MockApiClient({ simulate: false });
  await api.loadDemo();
  const view = render(
    <ApiProvider client={api}>
      <SessionProvider portal={portal} accounts={accounts}>
        <ToastProvider>
          <RequireAccess>
            <p>CONSOLE CONTENT</p>
          </RequireAccess>
        </ToastProvider>
      </SessionProvider>
    </ApiProvider>,
  );
  // The guard resolves identity asynchronously; wait for it to settle on the login.
  await screen.findByLabelText('Email address');
  return { api, view };
}

const signIn = async (email: string, password = DEV_PASSWORD) => {
  await userEvent.type(screen.getByLabelText('Email address'), email);
  await userEvent.type(screen.getByLabelText('Password'), password);
  await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
};

const reachedConsole = () => screen.queryByText('CONSOLE CONTENT') !== null;

beforeEach(() => {
  localStorage.clear();
});

/* ---------------------------------------------------------------- the role matrix */

describe('the role matrix (Prompt 1.5 "The three entries")', () => {
  it('a user signing in at /login succeeds', async () => {
    await mount(USER_PORTAL);
    await signIn(USER_EMAIL);
    await waitFor(() => expect(reachedConsole()).toBe(true));
  });

  it('a user signing in at /org/login is refused', async () => {
    await mount(ORG_PORTAL);
    await signIn(USER_EMAIL);
    expect(await screen.findByText(SIGN_IN_FAILURE)).toBeInTheDocument();
    expect(reachedConsole()).toBe(false);
  });

  it('an Org Admin signing in at /login succeeds — PRD 7.1', async () => {
    await mount(USER_PORTAL);
    await signIn(ADMIN_EMAIL);
    await waitFor(() => expect(reachedConsole()).toBe(true));
  });

  it('an Org Admin signing in at /org/login succeeds', async () => {
    await mount(ORG_PORTAL);
    await signIn(ADMIN_EMAIL);
    await waitFor(() => expect(reachedConsole()).toBe(true));
  });

  it('an Org Admin signing in at /admin/login is refused', async () => {
    await mount(FLEET_PORTAL, OPERATOR_ACCOUNTS);
    await signIn(ADMIN_EMAIL);
    expect(await screen.findByText(SIGN_IN_FAILURE)).toBeInTheDocument();
    expect(reachedConsole()).toBe(false);
  });

  it('a super admin signing in at /admin/login succeeds', async () => {
    await mount(FLEET_PORTAL, OPERATOR_ACCOUNTS);
    await signIn(OPERATOR_EMAIL);
    await waitFor(() => expect(reachedConsole()).toBe(true));
  });

  it('a super admin signing in at /login is refused', async () => {
    await mount(USER_PORTAL);
    await signIn(OPERATOR_EMAIL);
    expect(await screen.findByText(SIGN_IN_FAILURE)).toBeInTheDocument();
    expect(reachedConsole()).toBe(false);
  });

  it('a super admin signing in at /org/login is refused', async () => {
    await mount(ORG_PORTAL);
    await signIn(OPERATOR_EMAIL);
    expect(await screen.findByText(SIGN_IN_FAILURE)).toBeInTheDocument();
    expect(reachedConsole()).toBe(false);
  });
});

/* ------------------------------------------------------------- the generic message */

describe('one failure message, byte-identical for every cause', () => {
  it('is the same string for a wrong password, an unknown address, and the wrong portal', async () => {
    // Each case gets its own mount and is torn down, so the document holds exactly one
    // banner at a time and the comparison is between the three causes, not three renders.
    const causes: ReadonlyArray<readonly [string, Portal, string, string]> = [
      ['wrong password', USER_PORTAL, USER_EMAIL, 'not-the-password'],
      ['unknown address', USER_PORTAL, 'nobody@brightpath.co', DEV_PASSWORD],
      ['right password, wrong portal', ORG_PORTAL, USER_EMAIL, DEV_PASSWORD],
    ];

    const seen: string[] = [];
    for (const [cause, portal, email, password] of causes) {
      const { view } = await mount(portal);
      await signIn(email, password);
      const banner = await screen.findByText(SIGN_IN_FAILURE);
      expect(banner.textContent, cause).toBe(SIGN_IN_FAILURE);
      seen.push(banner.textContent ?? '');
      view.unmount();
    }

    expect(new Set(seen).size, 'the three causes produced different text').toBe(1);
  });

  it('never establishes a session for any of those causes', async () => {
    const { api } = await mount(ORG_PORTAL);
    await signIn(USER_EMAIL); // right password, wrong portal
    await screen.findByText(SIGN_IN_FAILURE);
    expect((await api.getSession()).userId).toBeNull();
  });

  it('names no other portal and offers no link to one', async () => {
    await mount(ORG_PORTAL);
    await signIn(USER_EMAIL);
    const banner = await screen.findByText(SIGN_IN_FAILURE);
    expect(banner.textContent).not.toMatch(/\/login|\/admin|other|instead|try/i);
  });

  it('is one exported constant, so the three entries cannot drift', () => {
    expect(SIGN_IN_FAILURE).toBe("Those details don't match an account for this sign-in.");
  });
});

/* ------------------------------------------------------- an existing wrong session */

describe('a signed-in profile at the wrong entry sees a refusal, never a redirect', () => {
  it('refuses, keeps the URL, and offers sign-out', async () => {
    // Signed in elsewhere: the three entries share one origin and one session in dev.
    localStorage.clear();
    const api = new MockApiClient({ simulate: false });
    await api.loadDemo();
    const people = await api.listPeople();
    await api.signInAs(people.find((p) => p.email === USER_EMAIL)!.id);

    render(
      <ApiProvider client={api}>
        <SessionProvider portal={ORG_PORTAL}>
          <ToastProvider>
            <RequireAccess>
              <p>CONSOLE CONTENT</p>
            </RequireAccess>
          </ToastProvider>
        </SessionProvider>
      </ApiProvider>,
    );

    expect(await screen.findByText(/don't have access to this sign-in/)).toBeInTheDocument();
    expect(reachedConsole()).toBe(false);
    expect(screen.getByRole('button', { name: 'Sign out' })).toBeInTheDocument();
    // No link anywhere: a link to another portal is the redirect by another name.
    expect(document.querySelectorAll('a')).toHaveLength(0);
  });

  it('sign-out clears the session and returns to this entry own login', async () => {
    localStorage.clear();
    const api = new MockApiClient({ simulate: false });
    await api.loadDemo();
    const people = await api.listPeople();
    await api.signInAs(people.find((p) => p.email === USER_EMAIL)!.id);

    render(
      <ApiProvider client={api}>
        <SessionProvider portal={ORG_PORTAL}>
          <ToastProvider>
            <RequireAccess>
              <p>CONSOLE CONTENT</p>
            </RequireAccess>
          </ToastProvider>
        </SessionProvider>
      </ApiProvider>,
    );
    await screen.findByRole('button', { name: 'Sign out' });
    await userEvent.click(screen.getByRole('button', { name: 'Sign out' }));

    await waitFor(() => expect(screen.queryByLabelText('Email address')).toBeInTheDocument());
    expect((await api.getSession()).userId).toBeNull();
    expect(window.location.hash).toBe('#/login');
  });
});

/* --------------------------------------------------------- unauthenticated access */

describe('an unauthenticated visit to a protected route renders the login', () => {
  it.each([
    ['the user entry', USER_PORTAL],
    ['the org-admin entry', ORG_PORTAL],
    ['the fleet entry', FLEET_PORTAL],
  ])('%s shows its login, not its console', async (_name, portal) => {
    window.location.hash = '#/fleet';
    await mount(portal, portal === FLEET_PORTAL ? OPERATOR_ACCOUNTS : []);
    expect(screen.getByLabelText('Email address')).toBeInTheDocument();
    expect(reachedConsole()).toBe(false);
  });
});

/* ----------------------------------------------------------- the shared component */

describe('one Login component, shared by all three entries', () => {
  it('renders the same form on every entry, differing only in the portal copy', async () => {
    const shapes: string[] = [];
    for (const [portal, accounts] of [
      [USER_PORTAL, []],
      [ORG_PORTAL, []],
      [FLEET_PORTAL, OPERATOR_ACCOUNTS],
    ] as const) {
      const { view } = await mount(portal, accounts);
      const form = view.container.querySelector('form')!;
      // React's useId is unique per root, so the generated ids differ between mounts even
      // though the markup is the same component. Normalising them is what makes this a
      // test of the markup rather than of useId's counter.
      shapes.push(form.outerHTML.replaceAll(/_r_[0-9a-z]+_/g, 'GENERATED_ID'));
      view.unmount();
    }
    // The form markup -- fields, labels, aria wiring, the 48px button -- is identical.
    expect(new Set(shapes).size).toBe(1);
  });

  it('gives the primary button the 48px Approve height (PRD 15.2)', async () => {
    await mount(USER_PORTAL);
    expect(screen.getByRole('button', { name: 'Sign in' })).toHaveClass('min-h-approve');
  });

  it('puts the failure in an aria-live region', async () => {
    await mount(USER_PORTAL);
    await signIn(USER_EMAIL, 'wrong');
    const banner = await screen.findByText(SIGN_IN_FAILURE);
    expect(banner.closest('[aria-live]')).not.toBeNull();
  });

  it('validates both fields inline before attempting to sign in', async () => {
    await mount(USER_PORTAL);
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByText('Enter your email address.')).toBeInTheDocument();
    expect(screen.getByText('Enter your password.')).toBeInTheDocument();
    expect(screen.queryByText(SIGN_IN_FAILURE)).not.toBeInTheDocument();
  });

  it('rejects a malformed address without calling the API', async () => {
    await mount(USER_PORTAL);
    await signIn('not-an-address');
    expect(await screen.findByText('Enter a valid email address.')).toBeInTheDocument();
    expect(screen.queryByText(SIGN_IN_FAILURE)).not.toBeInTheDocument();
  });
});

/* ------------------------------------------------------------------- keyboard only */

describe('keyboard-only sign-in', () => {
  it('reaches both fields and submits with Enter, on every entry', async () => {
    for (const [portal, accounts, email] of [
      [USER_PORTAL, [], USER_EMAIL],
      [ORG_PORTAL, [], ADMIN_EMAIL],
      [FLEET_PORTAL, OPERATOR_ACCOUNTS, OPERATOR_EMAIL],
    ] as const) {
      const { view } = await mount(portal, accounts);
      await userEvent.tab();
      expect(screen.getByLabelText('Email address')).toHaveFocus();
      await userEvent.keyboard(email);
      await userEvent.tab();
      expect(screen.getByLabelText('Password')).toHaveFocus();
      await userEvent.keyboard(`${DEV_PASSWORD}{Enter}`);
      await waitFor(() => expect(reachedConsole()).toBe(true));
      view.unmount();
    }
  });
});

/* ------------------------------------------------------------------------- axe */

/**
 * axe over the three login screens.
 *
 * What this DOES check: roles, names, labels, landmark and heading structure, form
 * wiring -- every structural rule, on markup that is identical in both themes because the
 * theme is CSS variables and nothing else.
 *
 * What it does NOT check: colour contrast. jsdom computes no colours, so axe's
 * `color-contrast` rule cannot run here and reports nothing rather than passing. Contrast
 * in both themes is covered where it can actually be measured -- `design/tokens.test.ts`
 * asserts every text token reaches 4.5:1 on paper and canvas in light and dark -- and the
 * real-browser pass is recorded in docs/auth.md.
 */
describe('axe on the three login screens', () => {
  it.each([
    ['user', USER_PORTAL, []],
    ['org-admin', ORG_PORTAL, []],
    ['fleet', FLEET_PORTAL, OPERATOR_ACCOUNTS],
  ] as const)('%s login has no serious or critical violations', async (_name, portal, accounts) => {
    const { view } = await mount(portal, accounts);
    const results = await axe.run(view.container, {
      resultTypes: ['violations'],
      rules: { 'color-contrast': { enabled: false } },
    });
    const bad = results.violations.filter(
      (v) => v.impact === 'serious' || v.impact === 'critical',
    );
    expect(bad.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
    view.unmount();
  }, 20_000);

  it('the refusal screen is clean too', async () => {
    localStorage.clear();
    const api = new MockApiClient({ simulate: false });
    await api.loadDemo();
    const people = await api.listPeople();
    await api.signInAs(people.find((p) => p.email === USER_EMAIL)!.id);
    const view = render(
      <ApiProvider client={api}>
        <SessionProvider portal={ORG_PORTAL}>
          <ToastProvider>
            <RequireAccess>
              <p>CONSOLE CONTENT</p>
            </RequireAccess>
          </ToastProvider>
        </SessionProvider>
      </ApiProvider>,
    );
    await screen.findByRole('button', { name: 'Sign out' });
    const results = await axe.run(view.container, {
      resultTypes: ['violations'],
      rules: { 'color-contrast': { enabled: false } },
    });
    const bad = results.violations.filter(
      (v) => v.impact === 'serious' || v.impact === 'critical',
    );
    expect(bad.map((v) => v.id)).toEqual([]);
  }, 20_000);
});
