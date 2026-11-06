import { useEffect } from 'react';
import { useOffice, usePeople, useRequests } from '@/shared/api/hooks';
import type { AccessRole } from '@/shared/schemas';
import { useMe } from '@/shared/api/hooks';
import { DevTools } from './DevTools';
import { ENTRIES, documentTitle } from './entries';
import { defaultRoute, navFor } from './nav';
import { href } from './router';

/**
 * One shell for all three entries. Sidebar above 860px, a horizontal bar below it, which is
 * the breakpoint Prompt 1 item 8 names.
 */
export function AppShell({
  accessRole,
  route,
  screenTitle,
  children,
}: {
  accessRole: AccessRole;
  route: string;
  screenTitle: string;
  children: React.ReactNode;
}) {
  const { data: office } = useOffice();
  const { data: requests = [] } = useRequests();
  const { data: people = [] } = usePeople();
  const me = useMe();
  const items = navFor(accessRole, { office, requests, me });

  useEffect(() => {
    document.title = documentTitle(accessRole, screenTitle);
  }, [accessRole, screenTitle]);

  const scopeName = accessRole === 'super' ? 'All offices' : (office?.name ?? '');
  const scopeSub = accessRole === 'super' ? 'Operator console' : (office?.domain ?? '');

  return (
    <div className="min-h-screen bg-canvas text-ink lg:flex">
      <aside
        aria-label={`${ENTRIES[accessRole].label} navigation`}
        className="border-b border-line bg-paper lg:min-h-screen lg:w-60 lg:shrink-0 lg:border-b-0 lg:border-r"
      >
        <div className="border-b border-line px-4 py-4">
          <p className="text-base font-semibold">{ENTRIES[accessRole].title}</p>
          <p className="text-base text-muted">by OrbitumAI</p>
        </div>
        <div className="border-b border-line px-4 py-3">
          <p className="text-base font-medium">{scopeName}</p>
          <p className="text-base text-muted">{scopeSub}</p>
        </div>
        <nav className="flex flex-wrap gap-1 p-2 lg:flex-col">
          {items.map((item) =>
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
        {me && accessRole !== 'super' ? (
          <div className="border-t border-line px-4 py-3">
            <p className="text-base font-medium">{me.name}</p>
            <p className="text-base text-muted">{ENTRIES[accessRole].label}</p>
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
        {import.meta.env.DEV ? <DevTools accessRole={accessRole} people={people} /> : null}
      </div>
    </div>
  );
}

export { defaultRoute };
