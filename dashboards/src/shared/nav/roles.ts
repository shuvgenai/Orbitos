// The three role lists, built from the one list of 52. Data only.
//
// Section 15.6 opens with "The Org Admin reaches every User screen plus these",
// so the Org Admin list is the User list followed by its own, and is never
// retyped. Retyping it would be a second place a screen could go missing.
// The extension is explicit here, unlike the rest of this folder.
// e2e/routes.spec.ts reads the three lists below to run axe on every route, and
// that file sits in the root tsconfig project, which is nodenext and rejects an
// extensionless relative import with TS2835. Naming the extension satisfies
// both projects, and dashboards/tsconfig.json allows it because noEmit is on.
import { FLEET_SCREENS, ORG_ADMIN_SCREENS, type ScreenRow, USER_SCREENS } from './screens.ts';

// Re-exported so a consumer of a role list gets the row type from the same
// module, rather than reaching past it into the data file.
export type { ScreenRow };

/** Section 15.5. 14 screens. */
export const USER_NAV: readonly ScreenRow[] = USER_SCREENS;

/** Section 15.5 plus 15.6, in that order. 35 screens. */
export const ORG_ADMIN_NAV: readonly ScreenRow[] = [...USER_SCREENS, ...ORG_ADMIN_SCREENS];

/** Section 15.7. 17 screens. */
export const FLEET_NAV: readonly ScreenRow[] = FLEET_SCREENS;

/** Which flagged screens are switched on. Standing Authority defaults to off. */
export type NavFlags = { readonly standingAuthority?: boolean };

/**
 * The screens that are links in the nav list, for one role.
 *
 * A screen marked 'flag' is routed either way and linked only when its flag is
 * on, which is how section 15.6 asks for Standing Authority. The default is off,
 * so the default answer leaves it out: a link to a screen that says it is not
 * available yet is a dead link in all but name.
 */
export function sidebarOf(nav: readonly ScreenRow[], flags: NavFlags = {}): readonly ScreenRow[] {
  return nav.filter((row) => (row.inSidebar === 'flag' ? flags.standingAuthority === true : row.inSidebar === true));
}
