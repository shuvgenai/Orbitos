// Every screen in a role's list has a route that renders it. That is the whole
// point of this file: a link in the nav that leads nowhere is broken software,
// and there are 52 chances to get it wrong.
//
// The loop names the route it is checking, so a missing Route fails with the
// route in the message rather than a count that is one short.
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, expect, test } from 'vitest';
import { FLEET_NAV, type NavFlags, ORG_ADMIN_NAV, type ScreenRow, USER_NAV } from '../nav/roles';
import { RoleRoutes, RoleScreens } from './RoleRoutes';

/** A route with a parameter needs a value before it can be visited. */
const concrete = (route: string) => route.replace(/:[^/]+/g, '7');

const at = (path: string, nav: readonly ScreenRow[], appName = 'Orbitcrew') =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <RoleScreens appName={appName} nav={nav} />
    </MemoryRouter>,
  );

/** The same, with the flags a role's shell would be given. */
const atWithFlags = (path: string, nav: readonly ScreenRow[], flags: NavFlags) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <RoleScreens appName="Orbitcrew" flags={flags} nav={nav} />
    </MemoryRouter>,
  );

/** The one flagged screen, found by its flag rather than by its address. */
const FLAGGED = ORG_ADMIN_NAV.find((row) => row.inSidebar === 'flag');

const heading = () => screen.getByRole('heading', { level: 1 }).textContent;

afterEach(() => {
  window.location.hash = '';
});

test('every User screen has a route that renders it, all 14', () => {
  expect(USER_NAV).toHaveLength(14);
  for (const row of USER_NAV) {
    const view = at(concrete(row.route), USER_NAV);
    expect(heading(), `${row.route} renders no screen`).toBe(row.screen);
    view.unmount();
  }
});

test('every Org Admin screen has a route that renders it, all 35', () => {
  expect(ORG_ADMIN_NAV).toHaveLength(35);
  for (const row of ORG_ADMIN_NAV) {
    const view = at(concrete(row.route), ORG_ADMIN_NAV);
    expect(heading(), `${row.route} renders no screen`).toBe(row.screen);
    view.unmount();
  }
});

test('every fleet screen has a route that renders it, all 17', () => {
  expect(FLEET_NAV).toHaveLength(17);
  for (const row of FLEET_NAV) {
    const view = at(concrete(row.route), FLEET_NAV, 'ORBIT-OS fleet console');
    expect(heading(), `${row.route} renders no screen`).toBe(row.screen);
    view.unmount();
  }
});

// Section 15.5 puts sign-in before anyone is signed in, so there is no office
// to show a nav for and no link on it that could be followed.
test('sign in renders outside the shell: no nav, no menu, no banner', () => {
  const { container } = at('/signin', USER_NAV);
  expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Sign in');
  expect(screen.queryByRole('navigation')).toBeNull();
  expect(screen.queryByRole('button', { name: 'Menu' })).toBeNull();
  expect(screen.queryAllByRole('link')).toEqual([]);
  expect(container.querySelector('.screen-state-paused')).toBeNull();
  // The app name belongs to the shell, so it is not here either.
  expect(screen.queryByText('Orbitcrew')).toBeNull();
});

test('sign in is still a screen, with its title and its empty state', () => {
  at('/signin', USER_NAV);
  expect(screen.getByText('A way into your office')).toBeVisible();
  expect(screen.getByText('Enter your work email and we send you a link.')).toBeVisible();
});

test('sign in keeps a main landmark, so the first page a person meets has one', () => {
  const { container } = at('/signin', USER_NAV);
  const main = container.querySelector('main');
  expect(main?.id).toBe('main');
  expect(container.querySelectorAll('main')).toHaveLength(1);
});

test('the Org Admin app treats sign in the same way, since it reaches every User screen', () => {
  at('/signin', ORG_ADMIN_NAV);
  expect(screen.queryByRole('navigation')).toBeNull();
  expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Sign in');
});

test('every other screen still has the shell, so only sign in is outside it', () => {
  const view = at('/receipts', USER_NAV);
  expect(screen.getByRole('navigation')).toBeVisible();
  view.unmount();
  at('/tasks/7', USER_NAV);
  expect(screen.getByRole('navigation')).toBeVisible();
});

test('a static route wins over the dynamic one beside it', () => {
  // /teammates/request is a User screen, /teammates/:id an Org Admin one. Both
  // live in the Org Admin list, so the ranking has to settle it.
  at('/teammates/request', ORG_ADMIN_NAV);
  expect(heading()).toBe('Request a teammate');
});

test('the dynamic route still answers for a real id', () => {
  at('/teammates/42', ORG_ADMIN_NAV);
  expect(heading()).toBe('Teammate profile');
});

test('a nested detail route is not swallowed by its parent', () => {
  at('/fleet/42/shutdown', FLEET_NAV, 'ORBIT-OS fleet console');
  expect(heading()).toBe('Shutdown');
});

test('an unknown address says so and offers the way back', () => {
  at('/nope', USER_NAV);
  expect(heading()).toBe('Page not found');
  expect(screen.getByText('This address does not match a screen.')).toBeVisible();
  // The way back is the first link of this role's own nav, so the fleet console
  // never offers a customer screen.
  expect(screen.getByRole('link', { name: 'Go to Home' }).getAttribute('href')).toBe('#/');
});

test('the fleet console offers its own first screen, not a customer one', () => {
  at('/nope', FLEET_NAV, 'ORBIT-OS fleet console');
  expect(screen.getByRole('link', { name: 'Go to Fleet table' }).getAttribute('href')).toBe('#/fleet');
});

test('a screen is the only h1 on the page, so the shell claims no heading', () => {
  at('/tasks', USER_NAV);
  expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
  expect(screen.getByText('Orbitcrew')).toBeVisible();
});

test('the shell marks the showing route as the current page', () => {
  at('/receipts', USER_NAV);
  const current = screen.getAllByRole('link').filter((a) => a.getAttribute('aria-current') === 'page');
  expect(current).toHaveLength(1);
  expect(current[0]?.textContent).toBe('Receipts');
});

test('the app mounts a HashRouter, so the fragment picks the screen', () => {
  window.location.hash = '#/waiting';
  render(<RoleRoutes appName="Orbitcrew" nav={USER_NAV} />);
  expect(heading()).toBe('Waiting for you');
});

// Finding M17 of the 2026-10-08 security review. The flag used to filter the nav
// list only, so the link disappeared and the address still worked. These three
// tests are the difference between a hidden link and an off switch.

test('there is exactly one flagged screen, and it is Standing Authority', () => {
  // The tests below are about a flag, not about an address, so they find the row
  // by its flag. If a second flagged screen is added they should cover it, and
  // this assertion is what makes that a decision rather than an oversight.
  const flagged = ORG_ADMIN_NAV.filter((row) => row.inSidebar === 'flag');
  expect(flagged.map((row) => row.route)).toEqual(['/authority']);
});

test('with the flag off the flagged route renders the flagged-off state, not the screen', () => {
  expect(FLAGGED).toBeDefined();
  const row = FLAGGED!;
  const view = atWithFlags(row.route, ORG_ADMIN_NAV, {});

  // Still a real page with the screen's own heading, because the screen exists
  // and the office may switch it on. A 404 here would be false.
  expect(heading()).toBe(row.screen);
  expect(screen.getByText('Standing approvals are not switched on for this office')).toBeInTheDocument();
  // And not the shell's own line, which is what it rendered before the gate.
  expect(screen.queryByText(row.appears)).toBeNull();
  view.unmount();
});

test('with the flag on the flagged route renders the screen as any other', () => {
  expect(FLAGGED).toBeDefined();
  const row = FLAGGED!;
  const view = atWithFlags(row.route, ORG_ADMIN_NAV, { standingAuthority: true });

  expect(heading()).toBe(row.screen);
  expect(screen.getByText(row.appears)).toBeInTheDocument();
  expect(screen.queryByText('Standing approvals are not switched on for this office')).toBeNull();
  view.unmount();
});

test('the default flags gate it, so a shell mounted without flags is gated too', () => {
  // `at` passes no flags at all, which is how every app mounts today.
  expect(FLAGGED).toBeDefined();
  const row = FLAGGED!;
  const view = at(row.route, ORG_ADMIN_NAV);

  expect(screen.getByText('Standing approvals are not switched on for this office')).toBeInTheDocument();
  view.unmount();
});
