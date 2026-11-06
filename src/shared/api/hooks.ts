import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useApi } from './provider';

export { useApi, useHoldTickerWhile, useTickerGate } from './provider';
import type { Result } from './client';

/** Query keys in one place, so an invalidation never guesses a string. */
export const keys = {
  state: ['state'] as const,
  office: ['office'] as const,
  departments: ['departments'] as const,
  people: ['people'] as const,
  agents: ['agents'] as const,
  connections: ['connections'] as const,
  launch: ['launch'] as const,
  requests: ['requests'] as const,
  receipts: ['receipts'] as const,
  audit: ['audit'] as const,
  offices: ['offices'] as const,
  session: ['session'] as const,
};

export function useOffice() {
  const api = useApi();
  return useQuery({ queryKey: keys.office, queryFn: () => api.getOffice() });
}

export function useDepartments() {
  const api = useApi();
  return useQuery({ queryKey: keys.departments, queryFn: () => api.listDepartments() });
}

export function usePeople() {
  const api = useApi();
  return useQuery({ queryKey: keys.people, queryFn: () => api.listPeople() });
}

export function useAgents() {
  const api = useApi();
  return useQuery({ queryKey: keys.agents, queryFn: () => api.listAgents() });
}

export function useConnections() {
  const api = useApi();
  return useQuery({ queryKey: keys.connections, queryFn: () => api.listConnections() });
}

export function useLaunchStatus() {
  const api = useApi();
  return useQuery({ queryKey: keys.launch, queryFn: () => api.getLaunchStatus() });
}

export function useRequests() {
  const api = useApi();
  return useQuery({ queryKey: keys.requests, queryFn: () => api.listRequests() });
}

export function useReceipts() {
  const api = useApi();
  return useQuery({ queryKey: keys.receipts, queryFn: () => api.listReceipts() });
}

export function useAudit() {
  const api = useApi();
  return useQuery({ queryKey: keys.audit, queryFn: () => api.listAudit() });
}

export function useFleetOffices() {
  const api = useApi();
  return useQuery({ queryKey: keys.offices, queryFn: () => api.listOffices() });
}

export function useSession() {
  const api = useApi();
  return useQuery({ queryKey: keys.session, queryFn: () => api.getSession() });
}

/**
 * Every write goes through here, so a refused rule reaches a screen as `problems: string[]`
 * and never as a thrown error a boundary would turn into a status code. PRD 15.4: never an
 * error code on a customer screen.
 */
export function useWrite<TArgs>(fn: (args: TArgs) => Promise<Result<unknown>>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSettled: () => queryClient.invalidateQueries(),
  });
}

/** The signed-in person. In development the Dev tools "Sign in as" select changes it. */
export function useMe() {
  const { data: people } = usePeople();
  const { data: session } = useSession();
  if (!people?.length) return undefined;
  return (
    people.find((p) => p.id === session?.userId) ??
    people.find((p) => p.access === 'user') ??
    people[0]
  );
}
