// The one shell. Header, nav, optional paused banner, main.
//
// It holds no list of screens. The caller hands it one of the role lists from
// nav/roles.ts, so adding a screen is a change to the data and to the PRD, never
// a change here.
//
// Flex only. guards/design-naming.test.ts fails the build on a CSS column
// class or property, because PRD section 15.2 asks for plain lists and columns
// are how a list turns into a wall of cards. Every colour, radius, font size
// and divider below is a class the Tailwind theme points at design/tokens.css:
// nothing here states a value.
//
// Nothing transitions or animates. A person who asks for reduced motion gets it
// because there is no motion to reduce, which is cheaper than honouring the
// setting in six places.
import { type ReactNode, useState } from 'react';
import { type NavFlags, type ScreenRow, sidebarOf } from '../nav/roles';
import { ScreenState } from '../states/ScreenState';

type AppShellProps = {
  /** The app's name, matching the entry title: Orbitcrew, or the fleet console. */
  readonly appName: string;
  /** One of the role lists. The shell renders the links it says are links. */
  readonly nav: readonly ScreenRow[];
  /** The route showing now, so one link can say it is the current page. */
  readonly activeRoute: string;
  /** Section 15.4: a paused office says so on every screen, and the shell owns that. */
  readonly paused?: boolean;
  /** Which flagged screens are on. Standing Authority defaults to off. */
  readonly flags?: NavFlags;
  readonly children: ReactNode;
};

/** HashRouter reads the fragment, so a link to a route is a link to its hash. */
const hrefOf = (route: string) => `#${route}`;

const FOCUS_RING =
  'focus-visible:outline focus-visible:outline-focus focus-visible:outline-offset-focus focus-visible:outline-ink';

export function AppShell({ appName, nav, activeRoute, paused = false, flags, children }: AppShellProps) {
  const [open, setOpen] = useState(false);
  const links = sidebarOf(nav, flags);

  return (
    <div className="flex min-h-screen flex-col bg-canvas text-ink">
      {/* First in the document, so one Tab from the address bar reaches it. Out
          of sight until it has focus, which is the only time it is useful. */}
      <a className={`sr-only focus-visible:not-sr-only focus-visible:bg-paper focus-visible:px-4 ${FOCUS_RING}`} href="#main">
        Skip to content
      </a>

      <header className="flex items-center justify-between border-b-divider border-line px-4 py-3">
        <h1 className="text-body font-medium">{appName}</h1>
        {/* One control, 44 px, and gone from 768 px up where the nav is always
            there. aria-expanded carries the whole state: no icon to rotate, no
            label that flips to Close, nothing for a screen reader to disagree
            with. */}
        <button
          aria-controls="nav"
          aria-expanded={open}
          className={`inline-flex min-h-target min-w-target items-center justify-center rounded-button border-divider border-line px-4 text-body md:hidden ${FOCUS_RING}`}
          onClick={() => setOpen((was) => !was)}
          type="button"
        >
          Menu
        </button>
      </header>

      {/* Above main and outside it, so it is read before the screen's content
          and shows on a detail route as readily as on a list. */}
      {paused ? <ScreenState state={{ kind: 'paused' }} /> : null}

      <div className="flex flex-1 flex-col md:flex-row" data-shell-row>
        <nav
          aria-label="Screens"
          className={`${open ? 'block' : 'hidden'} border-b-divider border-line md:block md:w-64 md:border-b-0 md:border-r-divider`}
          id="nav"
        >
          {/* A plain list. One row per screen, no card, no number beside it. */}
          <ul>
            {links.map((row) => (
              <li key={row.route}>
                <a
                  aria-current={row.route === activeRoute ? 'page' : undefined}
                  className={`flex min-h-target items-center px-4 text-body text-muted aria-[current=page]:font-medium aria-[current=page]:text-ink ${FOCUS_RING}`}
                  href={hrefOf(row.route)}
                >
                  {row.screen}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        {/* tabindex="-1" so the skip link can put focus here. flex-1 takes the
            rest of the row from 768 px; xl:max-w-3xl keeps a line of text
            readable at 1280 px instead of letting it run the full width. */}
        <main className="flex-1 px-4 py-6 xl:max-w-3xl" id="main" tabIndex={-1}>
          {children}
        </main>
      </div>
    </div>
  );
}
