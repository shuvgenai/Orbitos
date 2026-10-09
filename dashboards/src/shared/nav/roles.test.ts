import { describe, expect, test } from 'vitest';
import { FLEET_NAV, ORG_ADMIN_NAV, sidebarOf, USER_NAV } from './roles';
import { SCREENS } from './screens';

// Counts are written out one by one, never read from the list being pinned.
// guards/screen-inventory.test.ts holds the lists to the PRD; this file holds
// the role split, which the PRD states in one sentence rather than a table.

describe('the role lists', () => {
  test('the User list is section 15.5, all 14 of it', () => {
    expect(USER_NAV.length).toBe(14);
    expect(USER_NAV.every((row) => row.section === '15.5')).toBe(true);
  });

  test('the Org Admin list is every User screen plus its own 21, so 35', () => {
    expect(ORG_ADMIN_NAV.length).toBe(35);
    // The User screens come first and in their own order, because an Org Admin
    // reaching Home expects Home, not a different Home.
    expect(ORG_ADMIN_NAV.slice(0, 14)).toEqual([...USER_NAV]);
    expect(ORG_ADMIN_NAV.slice(14).every((row) => row.section === '15.6')).toBe(true);
  });

  test('the fleet list is section 15.7, all 17 of it', () => {
    expect(FLEET_NAV.length).toBe(17);
    expect(FLEET_NAV.every((row) => row.section === '15.7')).toBe(true);
  });

  test('the fleet console shares no screen with the customer apps', () => {
    const customer = new Set(ORG_ADMIN_NAV.map((row) => row.route));
    expect(FLEET_NAV.filter((row) => customer.has(row.route))).toEqual([]);
  });
});

describe('which screens are links', () => {
  test('the User app links 9 of its 14', () => {
    expect(sidebarOf(USER_NAV).length).toBe(9);
  });

  test('the Org Admin app links 27 with the flag off, and 28 with it on', () => {
    expect(sidebarOf(ORG_ADMIN_NAV).length).toBe(27);
    expect(sidebarOf(ORG_ADMIN_NAV, { standingAuthority: true }).length).toBe(28);
  });

  test('the fleet console links 14 of its 17', () => {
    expect(sidebarOf(FLEET_NAV).length).toBe(14);
  });

  test('Standing Authority is the one flagged screen, routed always, linked only when on', () => {
    const flagged = SCREENS.filter((row) => row.inSidebar === 'flag');
    expect(flagged.map((row) => row.route)).toEqual(['/authority']);
    expect(sidebarOf(ORG_ADMIN_NAV).some((row) => row.route === '/authority')).toBe(false);
    expect(sidebarOf(ORG_ADMIN_NAV, { standingAuthority: true }).some((row) => row.route === '/authority')).toBe(true);
    // Routed either way: the row is in the list the router walks.
    expect(ORG_ADMIN_NAV.some((row) => row.route === '/authority')).toBe(true);
  });

  test('the ten screens that are routes and not links are these ten', () => {
    // Written out by hand. A screen quietly dropped from a sidebar fails here.
    expect(SCREENS.filter((row) => row.inSidebar === false).map((row) => row.route)).toEqual([
      '/signin',
      '/new/summary',
      '/new/practice',
      '/tasks/:id',
      '/waiting/:id',
      '/teammates/:id',
      '/jobs/:id',
      '/fleet/:id',
      '/fleet/:id/shutdown',
      '/fleet/:id/view',
    ]);
  });

  test('no link has a route parameter, because there would be no id to link to', () => {
    for (const row of [...sidebarOf(USER_NAV), ...sidebarOf(ORG_ADMIN_NAV), ...sidebarOf(FLEET_NAV)]) {
      expect(row.route, `${row.screen} is a link with a parameter`).not.toMatch(/:/);
    }
  });
});
