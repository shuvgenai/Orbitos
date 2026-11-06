import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ApiClient } from './client';
import { MockApiClient } from './mock';

const ApiContext = createContext<ApiClient | null>(null);

export function useApi(): ApiClient {
  const api = useContext(ApiContext);
  if (!api) throw new Error('useApi must be used inside ApiProvider');
  return api;
}

/**
 * Chooses the client. VITE_API_MODE=mock|supabase per Prompt 1.5 and the founder's
 * confirmation; Prompt 7's `http` mode is superseded (errata E-20). Only the mock exists in
 * Prompt 1, as instructed, and `supabase` falls back to it with a console note rather than
 * crashing a dashboard.
 */
function createClient(): ApiClient {
  const mode = import.meta.env['VITE_API_MODE'] ?? 'mock';
  if (mode !== 'mock') {
    // eslint-disable-next-line no-console
    console.warn(`VITE_API_MODE=${mode} is not built yet (Prompt 1.5). Using MockApiClient.`);
  }
  return new MockApiClient();
}

/* ------------------------------------------------------------------ the ticker gate */

type GateContext = {
  /** True while a panel is open or a field has focus. */
  held: boolean;
  hold: () => void;
  release: () => void;
};
const Gate = createContext<GateContext>({ held: false, hold: () => {}, release: () => {} });

export const useTickerGate = () => useContext(Gate);

/**
 * Why this exists.
 *
 * The prototype dropped any 'tick' update while a panel was open or a field had focus. In
 * React a render guard is the wrong instrument -- reconciliation happens anyway -- so the
 * gate suspends CACHE WRITES instead: a tick that arrives while the gate is held is
 * discarded, and the next real change refreshes everything. Combined with uncontrolled
 * inputs and commit-on-blur, a stray re-render cannot discard a half-typed value
 * (docs/plan.md 5-R1).
 */
function GateProvider({ children }: { children: React.ReactNode }) {
  const [holds, setHolds] = useState(0);
  const [typing, setTyping] = useState(false);

  useEffect(() => {
    const check = () => {
      const el = document.activeElement;
      setTyping(Boolean(el && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)));
    };
    document.addEventListener('focusin', check);
    document.addEventListener('focusout', check);
    return () => {
      document.removeEventListener('focusin', check);
      document.removeEventListener('focusout', check);
    };
  }, []);

  const value = useMemo<GateContext>(
    () => ({
      held: holds > 0 || typing,
      hold: () => setHolds((n) => n + 1),
      release: () => setHolds((n) => Math.max(0, n - 1)),
    }),
    [holds, typing],
  );

  return <Gate.Provider value={value}>{children}</Gate.Provider>;
}

/** Any component that opens a panel holds the gate while it is open. */
export function useHoldTickerWhile(open: boolean): void {
  const { hold, release } = useTickerGate();
  useEffect(() => {
    if (!open) return;
    hold();
    return () => release();
  }, [open, hold, release]);
}

/* ------------------------------------------------------------------------- provider */

export function ApiProvider({
  children,
  client,
}: {
  children: React.ReactNode;
  client?: ApiClient;
}) {
  const api = useMemo(() => client ?? createClient(), [client]);
  const queryClient = useMemo(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 0, refetchOnWindowFocus: false, retry: false },
        },
      }),
    [],
  );

  return (
    <QueryClientProvider client={queryClient}>
      <ApiContext.Provider value={api}>
        <GateProvider>
          <StoreBridge>{children}</StoreBridge>
        </GateProvider>
      </ApiContext.Provider>
    </QueryClientProvider>
  );
}

/**
 * Turns the client's change notifications into cache invalidations -- the one place the two
 * halves meet, so no screen subscribes to the store directly.
 */
function StoreBridge({ children }: { children: React.ReactNode }) {
  const api = useApi();
  const queryClient = useQueryClient();
  const { held } = useTickerGate();
  const heldRef = useRef(held);
  // Written in an effect, never during render: a ref is not render state.
  useEffect(() => {
    heldRef.current = held;
  }, [held]);

  useEffect(() => {
    return api.subscribe((source) => {
      // A tick that arrives while a panel is open or a field has focus is DISCARDED, not
      // queued: the next real change refreshes everything anyway, and a queued tick would
      // land the moment the panel closed and move the ground under the user.
      if (source === 'tick' && heldRef.current) return;
      void queryClient.invalidateQueries();
    });
  }, [api, queryClient]);

  return <>{children}</>;
}
