// axe on every one of the 52 screens, in jsdom.
//
// This is the unit-suite half of spec section 8's accessibility row: zero
// serious and zero critical findings per screen, run in each phase rather than
// once at the end. e2e/routes.spec.ts is the Playwright half. Both exist on
// purpose, and they are not the same check.
//
// What this half cannot see, which is why the Playwright half is not redundant:
// jsdom computes no layout. Every element has zero width, zero height and no
// resolved color, so every rule that needs geometry or painted pixels is
// unable to run here. color-contrast is the one that matters most; axe returns
// it as incomplete rather than as a violation, and this file reads violations
// only, so it would pass a screen whose text is grey on grey. target-size and
// the scroll and overflow rules are blind here for the same reason. Only a real
// browser answers those, which e2e/routes.spec.ts does.
//
// What this half sees that the other does not: it runs per screen in
// milliseconds with no server and no browser, so it fails in the same `pnpm
// test:unit` a person already runs before committing, rather than waiting for a
// Playwright job.
//
// The list is the 52 screens, each in its own role's app, and not the 66 mounts
// the Playwright half walks. The second mount of the 14 User screens under
// org-admin, and the not-found shell, differ from these only in the shell around
// them, and the shell is exactly the part jsdom renders without layout. Those
// belong to the browser half; duplicating them here would cost 17 more axe runs
// to read the same markup with less of it resolved.
import { render } from '@testing-library/react';
import axe from 'axe-core';
import { MemoryRouter } from 'react-router-dom';
import { expect, test } from 'vitest';
import { FLEET_NAV, ORG_ADMIN_NAV, type ScreenRow, USER_NAV } from '../nav/roles';
import { FLEET_SCREENS, ORG_ADMIN_SCREENS, USER_SCREENS } from '../nav/screens';
import { RoleScreens } from './RoleRoutes';

/**
 * Each inventory with the role list and app name it is reached through, so a
 * 15.6 screen is read inside the Org Admin shell and a 15.7 screen inside the
 * fleet console. The app name is the §15.3 title: the fleet console keeps
 * ORBIT-OS, the two customer apps are Orbitcrew.
 */
const INVENTORIES = [
  { screens: USER_SCREENS, nav: USER_NAV, appName: 'Orbitcrew' },
  { screens: ORG_ADMIN_SCREENS, nav: ORG_ADMIN_NAV, appName: 'Orbitcrew' },
  { screens: FLEET_SCREENS, nav: FLEET_NAV, appName: 'ORBIT-OS' },
] as const;

/** A route with a parameter needs a value before it can be visited. */
const concrete = (route: string) => route.replace(/:[^/]+/g, '7');

/**
 * The serious and critical findings in one container.
 *
 * Mirrors e2e/axe.ts: the same two impacts, and a failure reporting the rule
 * and the node count rather than a number that is not zero. Inline rather than
 * a shared helper because this is its only caller; the Playwright half needs a
 * `Page` and cannot use it.
 *
 * resultTypes narrows what axe assembles to the one list this reads. It does
 * not change which rules run, and it does not hide anything: passes and
 * incompletes are still counted, they are just not expanded into node detail.
 */
async function seriousFindings(container: HTMLElement) {
  const { violations } = await axe.run(container, {
    resultTypes: ['violations'],
    // Turned off rather than left to return incomplete. jsdom paints nothing,
    // so axe reaches for a canvas to sample pixels, fails, and prints
    // "Not implemented: HTMLCanvasElement's getContext()" once per screen.
    // Fifty-two lines of that in the log is noise a reader learns to scroll
    // past, and the rule could not have produced a finding either way. Naming
    // it here makes the gap a declaration instead of a comment: contrast is
    // e2e/routes.spec.ts's to catch, in a browser that has pixels.
    rules: { 'color-contrast': { enabled: false } },
  });
  return violations
    .filter((v) => v.impact === 'serious' || v.impact === 'critical')
    .map((v) => `${v.id}: ${v.nodes.length} node(s)`);
}

for (const { screens, nav, appName } of INVENTORIES) {
  for (const row of screens as readonly ScreenRow[]) {
    test(`${row.section} ${row.route} has no serious or critical accessibility finding`, async () => {
      const { container, getByRole } = render(
        <MemoryRouter initialEntries={[concrete(row.route)]}>
          <RoleScreens appName={appName} nav={nav} />
        </MemoryRouter>,
      );

      // The route resolved to its own screen, not to the not-found shell.
      // Without this, axe would be reading "Page not found" and every broken
      // route in the map would pass quietly. Same guard as the Playwright half.
      expect(getByRole('heading', { level: 1 })).toHaveTextContent(row.screen);

      expect(await seriousFindings(container)).toEqual([]);
    });
  }
}
