// The one shell every screen sits in, pinned rule by rule.
//
// jsdom applies no CSS, so these tests pin two things: the behaviour a keyboard
// user depends on, and the class contract that carries the three widths. They
// do not prove the rendered layout at 360, 768 or 1280 px. That needs a real
// browser, and `pnpm e2e` does not exist yet.
//
// Clicks go through fireEvent, not element.click(). ScreenState.test.tsx uses
// the raw click because its button only calls a spy; this one changes React
// state, and a raw click is not wrapped in act, so the state never flushes and
// the assertion reads the old markup. @testing-library/user-event would be
// closer to a real keyboard but is not a dependency of this package.
import { fireEvent, render, screen } from '@testing-library/react';
import { expect, test } from 'vitest';
import { FLEET_NAV, ORG_ADMIN_NAV, USER_NAV } from '../nav/roles';
import { AppShell } from './AppShell';

/** Anything a Tab can reach. main carries tabindex="-1" and is not one. */
const TABBABLE = 'a[href], button, [tabindex]:not([tabindex="-1"])';

const user = (extra: Partial<Parameters<typeof AppShell>[0]> = {}) => (
  <AppShell activeRoute="/tasks" appName="Orbitcrew" nav={USER_NAV} {...extra}>
    <p>the screen</p>
  </AppShell>
);

/** The nav links only, never the skip link. */
const navLinks = () => screen.getAllByRole('link').filter((a) => a.getAttribute('href')?.startsWith('#/'));

test('the skip link is the first thing a Tab reaches, and it points at main', () => {
  const { container } = render(user());
  const first = container.querySelectorAll(TABBABLE)[0] as HTMLAnchorElement;
  expect(first.getAttribute('href')).toBe('#main');
  expect(container.querySelector('main')?.id).toBe('main');
});

test('the menu is one button that says whether the nav is open', () => {
  render(user());
  const button = screen.getByRole('button', { name: 'Menu' });
  expect(button.getAttribute('aria-expanded')).toBe('false');
  expect(button.getAttribute('aria-controls')).toBe('nav');
  fireEvent.click(button);
  expect(button.getAttribute('aria-expanded')).toBe('true');
});

test('the menu button is a 44 px target, and is the only control in the header', () => {
  const { container } = render(user());
  const button = screen.getByRole('button', { name: 'Menu' });
  expect(button.className).toContain('min-h-target');
  expect(button.className).toContain('min-w-target');
  expect(container.querySelectorAll('header button')).toHaveLength(1);
});

test('the closed nav is hidden at 360 px and shown from 768 px', () => {
  render(user());
  const nav = screen.getByRole('navigation');
  expect(nav.className).toContain('hidden');
  expect(nav.className).toContain('md:block');
});

test('opening the menu shows the nav and puts its links next in reading order', () => {
  const { container } = render(user());
  const button = screen.getByRole('button', { name: 'Menu' });
  fireEvent.click(button);
  expect(screen.getByRole('navigation').className).not.toContain('hidden');
  // Focus is not moved by script. The nav follows the button in the document,
  // so the next Tab lands on the first link without anything stealing focus.
  const order = [...container.querySelectorAll(TABBABLE)];
  const atButton = order.indexOf(button);
  expect((order[atButton + 1] as HTMLAnchorElement).getAttribute('href')).toBe('#/');
});

test('the nav is the role list it was handed, and the shell keeps no list of its own', () => {
  const plain = render(user());
  expect(navLinks()).toHaveLength(9);
  plain.unmount();

  // 27 with Standing Authority off, which is its default, and 28 with it on.
  const admin = render(user({ nav: ORG_ADMIN_NAV }));
  expect(navLinks()).toHaveLength(27);
  admin.unmount();

  const flagged = render(user({ flags: { standingAuthority: true }, nav: ORG_ADMIN_NAV }));
  expect(navLinks()).toHaveLength(28);
  expect(screen.getByRole('link', { name: 'Standing Authority' })).toBeVisible();
  flagged.unmount();

  render(user({ appName: 'ORBIT-OS fleet console', nav: FLEET_NAV }));
  expect(navLinks()).toHaveLength(14);
});

test('no link carries a route parameter, because there would be no id to link to', () => {
  render(user({ nav: ORG_ADMIN_NAV }));
  for (const link of screen.getAllByRole('link')) expect(link.getAttribute('href')).not.toContain(':');
});

test('every nav link is a 44 px target', () => {
  render(user());
  for (const link of navLinks()) expect(link.className, `${link.textContent} is under 44 px`).toContain('min-h-target');
});

test('the active route is the only link marked as the current page', () => {
  render(user());
  const current = navLinks().filter((a) => a.getAttribute('aria-current') === 'page');
  expect(current).toHaveLength(1);
  expect(current[0]?.textContent).toBe('Task board');
});

test('a detail route marks nothing current, and still renders the shell', () => {
  render(user({ activeRoute: '/tasks/7' }));
  expect(navLinks().filter((a) => a.getAttribute('aria-current') === 'page')).toHaveLength(0);
  expect(screen.getByText('the screen')).toBeVisible();
});

test('a paused office shows the one banner above main, on any route', () => {
  const { container } = render(user({ activeRoute: '/tasks/7', paused: true }));
  const banner = screen.getByText('This office is paused.');
  expect(banner).toBeVisible();
  // The shared component, not markup rewritten here.
  expect(container.querySelectorAll('.screen-state-paused')).toHaveLength(1);
  const main = container.querySelector('main') as HTMLElement;
  expect(banner.compareDocumentPosition(main) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
});

test('an office that is not paused shows no banner', () => {
  const { container } = render(user());
  expect(container.querySelector('.screen-state-paused')).toBeNull();
});

test('the layout is flex at every width, never a grid, and never a tile', () => {
  const { container } = render(user({ nav: ORG_ADMIN_NAV, paused: true }));
  const markup = container.innerHTML;
  expect(markup).not.toMatch(/grid-cols-|grid-template-columns|\bgrid\b/);
  expect(markup.toLowerCase()).not.toContain('kpi');
  expect(markup).toContain('flex');
});

test('nothing animates, so a reduced-motion setting has nothing to turn off', () => {
  const { container } = render(user({ paused: true }));
  expect(container.innerHTML).not.toMatch(/\btransition\b|\banimate-|\bduration-/);
});

test('the width contract: one column, then a persistent nav, then a narrower main', () => {
  const { container } = render(user());
  const row = container.querySelector('[data-shell-row]') as HTMLElement;
  expect(row.className).toContain('flex-col');
  expect(row.className).toContain('md:flex-row');
  expect(screen.getByRole('navigation').className).toContain('md:w-64');
  expect(screen.getByRole('button', { name: 'Menu' }).className).toContain('md:hidden');
  expect((container.querySelector('main') as HTMLElement).className).toContain('xl:max-w-3xl');
});

test('the app name is the title the entry gives, and the shell claims no heading', () => {
  const { container } = render(user({ appName: 'ORBIT-OS fleet console', nav: FLEET_NAV }));
  expect(screen.getByText('ORBIT-OS fleet console')).toBeVisible();
  // The screen owns the one h1, so the shell must not take it. Two h1 elements
  // give a screen reader two answers to "what is this page".
  expect(container.querySelector('h1')).toBeNull();
  expect(screen.queryAllByRole('heading')).toHaveLength(0);
});
