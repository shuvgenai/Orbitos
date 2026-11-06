import { useEffect } from 'react';
import { useSession } from '@/shared/auth/SessionProvider';
import { DevTools, type DevLink } from './DevTools';
import type { NavItem } from './nav';
import { href } from './router';

const NO_LINKS: readonly DevLink[] = Object.freeze([]);

/**
 * One shell for all three entries. Sidebar above 1024px, a horizontal bar below it.
 *
 * It takes the Portal rather than a role, and the nav rather than building it: that is what
 * keeps every entry's own strings in its own bundle. The shell knows it is rendering "a"
 * portal and never which one.
 */
export function AppShell({
  route,
  screenTitle,
  nav,
  scopeName,
  scopeSub,
  devLinks = NO_LINKS,
  children,
}: {
  route: string;
  screenTitle: string;
  nav: NavItem[];
  scopeName: string;
  scopeSub: string;
  devLinks?: readonly DevLink[];
  children: React.ReactNode;
}) {
  const { portal, profile, signOut } = useSession();

  useEffect(() => {
    // PRD 15.3: `<screen> . OrbitCrew` on the customer entries, `. ORBIT-OS` on fleet.
    document.title = `${screenTitle} · ${portal.title}`;
  }, [portal.title, screenTitle]);

  return (
    <div className="min-h-screen bg-canvas text-ink lg:flex">
      <aside
        aria-label={`${portal.label} navigation`}
        className="border-b border-line bg-paper lg:min-h-screen lg:w-60 lg:shrink-0 lg:border-b-0 lg:border-r"
      >
        <div className="border-b border-line px-4 py-4">
          <p className="text-base font-semibold">{portal.title}</p>
          <p className="text-base text-muted">by OrbitumAI</p>
        </div>
        <div className="border-b border-line px-4 py-3">
          <p className="text-base font-medium">{scopeName}</p>
          <p className="text-base text-muted">{scopeSub}</p>
        </div>
        <nav className="flex flex-wrap gap-1 p-2 lg:flex-col">
          {nav.map((item) =>
            item.heading ? (
              <p key={item.name} className="px-3 pt-3 text-base text-muted lg:pt-4">
                {item.label}
              </p>
            ) : (
              <a
                key={item.name}
                href={href(item.name)}
                aria-current={item.name === route ? 'page' : undefined}
                className={`flex min-h-touch items-center justify-between gap-2 rounded-button px-3 text-base ${
                  item.name === route ? 'bg-canvas font-medium' : 'hover:bg-canvas'
                }`}
              >
                <span>{item.label}</span>
                {item.count ? (
                  <span className="rounded-button border border-ink px-1.5 text-base tabular-nums">
                    {item.count}
                  </span>
                ) : null}
              </a>
            ),
          )}
        </nav>
        {profile ? (
          <div className="border-t border-line px-4 py-3">
            <p className="text-base font-medium">{profile.name}</p>
            <p className="text-base text-muted">{portal.label}</p>
            <button
              type="button"
              onClick={() => void signOut()}
              className="mt-2 flex min-h-touch items-center rounded-button border border-line px-3 text-base hover:bg-canvas"
            >
              Sign out
            </button>
          </div>
        ) : null}
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="border-b border-line bg-paper px-4 py-4 lg:px-8">
          <h1 className="text-base font-semibold">{screenTitle}</h1>
        </header>
        <main id="main" className="min-w-0 flex-1 px-4 py-6 lg:px-8">
          {children}
        </main>
        {import.meta.env.DEV ? <DevTools links={devLinks} /> : null}
      </div>
    </div>
  );
}
