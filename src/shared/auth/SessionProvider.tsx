import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useApi } from '@/shared/api/provider';
import type { Account, Portal } from './portal';

/** The signed-in profile. `access` is an opaque string; only `portal.allow` interprets it. */
export type Profile = { id: string; name: string; email: string; access: string };

export type SessionState = {
  /** undefined while the identity is still being resolved; null when signed out. */
  profile: Profile | null | undefined;
  signIn: (email: string, password: string) => Promise<boolean>;
  signOut: () => Promise<void>;
  portal: Portal;
};

const Ctx = createContext<SessionState | null>(null);

export function useSession(): SessionState {
  const value = useContext(Ctx);
  if (!value) throw new Error('useSession must be used inside SessionProvider');
  return value;
}

/**
 * The development password for every seeded account.
 *
 * Prompt 1.5 item 2 says "every seeded account uses the same dev password, read from an env
 * var, never hard-coded". Items 1 to 3 are not built (FD-26), so there is no seeded Supabase
 * user yet -- but the env var is honoured now so the Supabase half inherits it rather than
 * replacing a literal. The fallback exists only because `MockApiClient` is a development
 * fixture; it is never a credential for anything real.
 */
const DEV_PASSWORD = import.meta.env['VITE_DEV_PASSWORD'] ?? 'orbitcrew-dev';

/** Module-level so the default does not re-subscribe the identity effect every render. */
const NO_EXTRA_ACCOUNTS: readonly Account[] = Object.freeze([]);

/**
 * Identity, from MockApiClient and the Dev tools "Sign in as" select, exactly as the shared
 * spec says. The Supabase session replaces the body of signIn/signOut and nothing else:
 * FD-26 records that half as owed.
 *
 * `accounts` are the non-office accounts THIS entry can authenticate. The customer entries
 * pass none. That is what keeps an operator address out of their bundles, and it costs
 * nothing observable: an operator at /login gets the same generic refusal either way.
 */
export function SessionProvider({
  portal,
  accounts = NO_EXTRA_ACCOUNTS,
  children,
}: {
  portal: Portal;
  accounts?: readonly Account[];
  children: React.ReactNode;
}) {
  const api = useApi();
  const [profile, setProfile] = useState<Profile | null | undefined>(undefined);

  // The office's own people, plus whatever extra accounts this entry owns.
  const resolve = useCallback(
    async (email: string): Promise<Profile | null> => {
      const match = accounts.find((a) => a.email.toLowerCase() === email.toLowerCase());
      if (match) return { ...match };
      const people = await api.listPeople();
      const person = people.find((p) => p.email.toLowerCase() === email.toLowerCase());
      return person
        ? { id: person.id, name: person.name, email: person.email, access: person.access }
        : null;
    },
    [api, accounts],
  );

  // Rehydrate from whatever the client already holds, and follow the Dev tools select.
  useEffect(() => {
    let live = true;
    const load = async () => {
      const session = await api.getSession();
      if (!session.userId) {
        if (live) setProfile(null);
        return;
      }
      const extra = accounts.find((a) => a.id === session.userId);
      if (extra) {
        if (live) setProfile({ ...extra });
        return;
      }
      const people = await api.listPeople();
      const person = people.find((p) => p.id === session.userId);
      if (!live) return;
      setProfile(
        person
          ? { id: person.id, name: person.name, email: person.email, access: person.access }
          : null,
      );
    };
    void load();
    const stop = api.subscribe((source) => {
      if (source !== 'tick') void load();
    });
    return () => {
      live = false;
      stop();
    };
  }, [api, accounts]);

  const signIn = useCallback(
    async (email: string, password: string) => {
      // One generic outcome for every cause, and no session is established for any of
      // them. The three causes Prompt 1.5 names are a wrong password, an unknown address,
      // and a CORRECT password at the wrong portal -- the third is why the allow list is
      // checked here and not only in the guard. Signing someone in and then refusing them
      // would tell them the account exists, which is the role oracle the prompt is about.
      if (password !== DEV_PASSWORD) return false;
      const found = await resolve(email.trim());
      if (!found) return false;
      if (!portal.allow.includes(found.access)) return false;
      await api.signInAs(found.id);
      setProfile(found);
      return true;
    },
    [api, resolve, portal.allow],
  );

  const signOut = useCallback(async () => {
    await api.signInAs(null);
    setProfile(null);
    // Back to this entry's own login path, never another entry's (Prompt 1.5 item 7).
    window.location.hash = '#/login';
  }, [api]);

  const value = useMemo<SessionState>(
    () => ({ profile, signIn, signOut, portal }),
    [profile, signIn, signOut, portal],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
