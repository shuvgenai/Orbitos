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
 * A screen with no data yet: its name, and nothing it cannot back up.
 *
 * Task 4 replaces this with the Screen frame, which adds the six section 15.4
 * states and the empty-state copy. Until then a route renders its title, which
 * is what makes a nav link honest today rather than sometime later.
 */
function ScreenTitle({ name }: { name: string }) {
  return <h1 className="text-body font-medium">{name}</h1>;
}

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

  return (
    <AppShell activeRoute={pathname} appName={appName} flags={flags} nav={nav} paused={paused}>
      <Routes>
        {/* Every row, linked or not. A screen reached by id has no nav entry
            and still needs a route, or the link from its list leads nowhere. */}
        {nav.map((row) => (
          <Route element={<ScreenTitle name={row.screen} />} key={row.route} path={row.route} />
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
