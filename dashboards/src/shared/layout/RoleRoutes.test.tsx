// Every screen in a role's list has a route that renders it. That is the whole
// point of this file: a link in the nav that leads nowhere is broken software,
// and there are 52 chances to get it wrong.
//
// The loop names the route it is checking, so a missing Route fails with the
// route in the message rather than a count that is one short.
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, expect, test } from 'vitest';
import { FLEET_NAV, ORG_ADMIN_NAV, type ScreenRow, USER_NAV } from '../nav/roles';
import { RoleRoutes, RoleScreens } from './RoleRoutes';

/** A route with a parameter needs a value before it can be visited. */
const concrete = (route: string) => route.replace(/:[^/]+/g, '7');

const at = (path: string, nav: readonly ScreenRow[], appName = 'Orbitcrew') =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <RoleScreens appName={appName} nav={nav} />
    </MemoryRouter>,
  );

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
