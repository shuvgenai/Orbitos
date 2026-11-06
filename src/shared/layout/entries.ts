import type { AccessRole } from '@/shared/schemas';
import { APP_NAME_CUSTOMER, APP_NAME_OPERATOR } from '@/shared/seeds/config';

/**
 * The only module that knows a public path.
 *
 * Two path schemes have to coexist: the Build Prompts deploy /user/, /org-admin/ and
 * /fleet/, and Prompt 1.5 fixes the login paths at /login, /org/login and /admin/login.
 * The founder's item 4 keeps both, on one domain. Each login path is a deploy-time rewrite
 * onto the same built file as its entry, so nothing here needs a second build.
 *
 * Keeping every cross-dashboard link in this one file is what makes the subdomain move the
 * founder asked about cost one file plus a Vite `base` per entry -- no screen changes.
 * See docs/plan.md 4-E1 and 4-E2, including the one thing that genuinely breaks on a move:
 * MockApiClient's localStorage is origin-scoped.
 */
export type Entry = {
  role: AccessRole;
  label: string;
  /** Where the built entry is served. */
  base: string;
  /** Prompt 1.5's sign-in path, a rewrite onto the same file. */
  loginPath: string;
  /** PRD 15.3: the customer entries say OrbitCrew; the fleet console keeps ORBIT-OS. */
  title: string;
};

export const ENTRIES: Record<AccessRole, Entry> = {
  user: {
    role: 'user',
    label: 'User',
    base: '/user/',
    loginPath: '/login',
    title: APP_NAME_CUSTOMER,
  },
  admin: {
    role: 'admin',
    label: 'Org Admin',
    base: '/org-admin/',
    loginPath: '/org/login',
    title: APP_NAME_CUSTOMER,
  },
  super: {
    role: 'super',
    label: 'Super Admin',
    base: '/fleet/',
    loginPath: '/admin/login',
    title: APP_NAME_OPERATOR,
  },
};

export const otherEntries = (role: AccessRole): Entry[] =>
  Object.values(ENTRIES).filter((e) => e.role !== role);

/** `<screen> . OrbitCrew` on the customer entries, `. ORBIT-OS` on fleet. PRD 15.3. */
export const documentTitle = (role: AccessRole, screen: string): string =>
  `${screen} · ${ENTRIES[role].title}`;
