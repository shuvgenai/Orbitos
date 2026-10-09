// One route per screen, for whichever role list it is handed.
//
// Why one component and not three copies: the route map is the thing that must
// not lose a screen, and three copies is three places to lose one. Each app
// still mounts its own router, with its own list and its own name.
//
// HashRouter, per dashboards/CLAUDE.md. The three dashboards are static pages,
// so a path route would need a server rewriting every address to index.html.
// The fragment needs nothing, which is also why a nav link is href="#/tasks".
import { HashRouter, Route, Routes, useLocation } from 'react-router-dom';
import { type NavFlags, type ScreenRow, sidebarOf } from '../nav/roles';
import { AppShell } from './AppShell';
import { Screen } from './Screen';

type RoleRoutesProps = {
  /** The app's name, matching the entry title: Orbitcrew, or the fleet console. */
  readonly appName: string;
  /** The role's list: every screen it reaches, linked or not. */
  readonly nav: readonly ScreenRow[];
  /** Which flagged screens are on. Standing Authority defaults to off. */
  readonly flags?: NavFlags;
  /** Section 15.4: the shell shows the paused banner on every screen. */
  readonly paused?: boolean;
};

/**
 * A screen with no data yet, which is what section 15.8 calls a shell: its
 * route, its nav entry, its title, and the section 15.4 empty state saying what
 * will appear and what fills it. Not a placeholder, a finished screen with no
 * data.
 *
 * The state is built here rather than in the row, so a screen that grows real
 * content passes its own state to Screen and this stops applying to it.
 */
const shellState = (row: ScreenRow) => ({ kind: 'empty', appears: row.appears, fills: row.fills }) as const;

/**
 * Whether a flagged screen's flag is off.
 *
 * Only a row marked 'flag' can be gated. Every other row is reached by being in
 * the role's list, which is the thing the list means.
 */
const isFlaggedOff = (row: ScreenRow, flags: NavFlags | undefined) =>
  row.inSidebar === 'flag' && flags?.standingAuthority !== true;

/**
 * What a flagged screen shows while its flag is off.
 *
 * The route stays mounted and renders this instead of the screen. Finding M17
 * of the 2026-10-08 security review: the flag used to filter the nav list only,
 * so `sidebarOf` dropped the link and `/authority` stayed reachable by typing
 * it. That was harmless while the screen was an empty shell and would stop
 * being harmless the moment it had content, because the natural reading of a
 * flag is that it is an off switch. This makes it one. It supersedes the
 * 2026-10-07 decision recorded in nav/screens.ts, which said a flagged screen is
 * routed either way.
 *
 * Not a seventh state. PRD section 15.4 names six and
 * guards/screen-states.test.ts keeps them to one component, so this reuses the
 * empty state with its own words. The row's own `fills` line already says the
 * screen stays read only until the office turns standing approvals on, which is
 * the sentence a person needs, so it is reused rather than rewritten.
 *
 * Not a 404 either. The screen exists and the office may switch it on, so
 * saying the address does not match a screen would be false.
 */
const flaggedOffState = (row: ScreenRow) =>
  ({
    kind: 'empty',
    appears: 'Standing approvals are not switched on for this office',
    fills: row.fills,
  }) as const;

/**
 * Screens that render without the shell.
 *
 * Sign in is the only one. Section 15.5 puts it before anyone is signed in, so
 * there is no office to show a nav for, nothing to mark as the current page and
 * nobody whose paused office could need a banner. A nav rendered here would
 * also be a set of links that cannot be followed yet.
 *
 * A set, not a field on the row, because this is a fact about one screen rather
 * than a column the PRD states. If a second screen ever belongs here it is
 * added here, on purpose.
 */
const OUTSIDE_THE_SHELL: ReadonlySet<string> = new Set(['/signin']);

/** An address that matches no screen. Says which, and offers one way out. */
function NotFound({ back }: { back: ScreenRow | undefined }) {
  return (
    <>
      <h1 className="text-body font-medium">Page not found</h1>
      <p className="text-body text-muted">This address does not match a screen.</p>
      {back === undefined ? null : (
        <a
          className="flex min-h-target items-center text-body text-ink focus-visible:outline focus-visible:outline-focus focus-visible:outline-offset-focus focus-visible:outline-ink"
          href={`#${back.route}`}
        >
          Go to {back.screen}
        </a>
      )}
    </>
  );
}

/**
 * The shell and the routes, with no router of its own.
 *
 * Separate from RoleRoutes so a test can put it under a MemoryRouter and start
 * at any address. Mount this only inside a router.
 */
export function RoleScreens({ appName, nav, flags, paused }: RoleRoutesProps) {
  const { pathname } = useLocation();
  // The way back out of a dead address is this role's own first link, so the
  // fleet console never points an operator at a customer screen.
  const [back] = sidebarOf(nav, flags);

  // Checked against the address rather than routed, because every screen that
  // belongs here has a fixed path with no parameter in it. The shell renders
  // the rest, and no screen is in both halves.
  const bare = nav.find((row) => row.route === pathname && OUTSIDE_THE_SHELL.has(row.route));
  if (bare !== undefined) {
    // Its own main landmark, so the page a person meets first is still one a
    // screen reader can navigate. No nav, no menu, no banner.
    return (
      <main className="min-h-screen bg-canvas px-4 py-6 text-ink" id="main">
        <Screen row={bare} state={shellState(bare)} />
      </main>
    );
  }

  return (
    <AppShell activeRoute={pathname} appName={appName} flags={flags} nav={nav} paused={paused}>
      <Routes>
        {/* Every row the shell owns, linked or not. A screen reached by id has
            no nav entry and still needs a route, or the link from its list
            leads nowhere. */}
        {nav
          .filter((row) => !OUTSIDE_THE_SHELL.has(row.route))
          .map((row) => (
            <Route
              // The gate is here, on the element, so a flagged screen that
              // grows real content cannot render it without passing this line.
              element={
                <Screen row={row} state={isFlaggedOff(row, flags) ? flaggedOffState(row) : shellState(row)} />
              }
              key={row.route}
              path={row.route}
            />
          ))}
        <Route element={<NotFound back={back} />} path="*" />
      </Routes>
    </AppShell>
  );
}

/** One app: its own HashRouter, its own list, its own name. */
export function RoleRoutes(props: RoleRoutesProps) {
  return (
    <HashRouter>
      <RoleScreens {...props} />
    </HashRouter>
  );
}
