import { useEffect, useState } from 'react';

export type Route = { name: string; arg: string | null };

/**
 * Hash routing, per the founder's confirmed item 1 and Prompt 1's "HashRouter".
 *
 * Each entry is its own app, so the hash carries only the screen: #/home, #/office/:id.
 * That is also what lets one built file be served at two paths -- /user/ and /login -- with
 * no SPA fallback and no server logic (docs/plan.md 4-E1).
 */
export function parseHash(hash: string): Route {
  const parts = hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  return { name: parts[0] ?? '', arg: parts[1] ?? null };
}

export const href = (name: string, arg?: string | null): string =>
  `#/${name}${arg ? `/${arg}` : ''}`;

export function navigate(name: string, arg?: string | null): void {
  window.location.hash = href(name, arg);
}

export function useRoute(fallback: string): Route {
  const [route, setRoute] = useState<Route>(() => parseHash(window.location.hash));

  useEffect(() => {
    const onChange = () => setRoute(parseHash(window.location.hash));
    window.addEventListener('hashchange', onChange);
    if (!window.location.hash || window.location.hash === '#') navigate(fallback);
    return () => window.removeEventListener('hashchange', onChange);
  }, [fallback]);

  return route.name ? route : { name: fallback, arg: null };
}
