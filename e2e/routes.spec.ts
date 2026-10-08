// axe on every route of all three dashboards.
//
// Spec section 8's accessibility row asks for zero serious and zero critical
// findings per route, run in each phase rather than once at the end. This is
// the Playwright half of that row; the unit-suite half, axe per screen, is a
// separate piece of work.
//
// The route list comes from the same module the apps mount, so a screen added
// to the PRD and then to screens.ts is tested here without anyone remembering
// to add it. A list retyped in this file would be a second place a screen could
// go missing, which is the one thing screens.ts exists to prevent.
import { expect, test } from '@playwright/test';
import { FLEET_NAV, ORG_ADMIN_NAV, USER_NAV } from '../dashboards/src/shared/nav/roles.ts';
import { expectNoSeriousViolations } from './axe.ts';

/** The three entries of dashboards/vite.config.ts, each with the list it mounts. */
const APPS = [
  { entry: 'user', nav: USER_NAV },
  { entry: 'org-admin', nav: ORG_ADMIN_NAV },
  { entry: 'fleet', nav: FLEET_NAV },
] as const;

/**
 * Seven routes carry an id, such as /tasks/:id. Any value renders the same
 * shell, because a shell has no data yet, so one placeholder serves all of
 * them. It is a word rather than a number so a route that starts validating its
 * id fails here loudly instead of passing on a plausible-looking 1.
 */
const PROBE_ID = 'probe-id';

/**
 * The address of one screen.
 *
 * index.html is named rather than left to a directory index: the Vite project
 * has three HTML entries and no root index, so /user/ is not a page the dev
 * server serves. The hash is not decoration either, it is the router. The
 * dashboards use HashRouter, because three static pages cannot ask a server to
 * rewrite every address to index.html.
 */
const address = (entry: string, route: string) =>
  `/${entry}/index.html#${route.replace(/:[A-Za-z]+/g, PROBE_ID)}`;

for (const { entry, nav } of APPS) {
  for (const row of nav) {
    test(`${entry} ${row.route} has no serious or critical accessibility finding`, async ({ page }) => {
      await page.goto(address(entry, row.route));

      // The route resolved to its own screen, and not to the not-found shell.
      // Without this the axe run would be reporting on "Page not found", and
      // every broken route in the map would pass quietly.
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(row.screen);

      await expectNoSeriousViolations(page);
    });
  }
}

/**
 * The one address every app serves that is not a screen.
 *
 * `RoleScreens` ends its route list with `path="*"`, which renders the
 * not-found shell. It carries no screen name, so it is in no role list and
 * cannot come from the loop above. It is still a page a person reaches, with a
 * heading and a link out of it, so it is still a page axe should read.
 *
 * It is not a PRD screen and must never become one: guards/screen-inventory.test.ts
 * asserts 52, and this file asserting 69 cases over those 52 screens plus three
 * mounts of one shared shell is the whole reason the two counts differ.
 *
 * The address is deliberately not a near-miss of a real route. A typo of an
 * existing screen could start matching it the day that screen takes a
 * parameter, and the case would then pass while testing the wrong page.
 */
const NO_SUCH_ADDRESS = '/not-a-screen';

for (const { entry } of APPS) {
  test(`${entry} ${NO_SUCH_ADDRESS} has no serious or critical accessibility finding`, async ({ page }) => {
    await page.goto(address(entry, NO_SUCH_ADDRESS));

    // The not-found shell, and not a screen that quietly matched the address.
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Page not found');

    await expectNoSeriousViolations(page);
  });
}
