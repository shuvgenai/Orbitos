import type { AccessRole, AgentRequest, Office, Person } from '@/shared/schemas';

export type NavItem = {
  name: string;
  label: string;
  /** A badge count, or undefined for none. */
  count?: number;
  /** A plain group heading rather than a link. */
  heading?: true;
};

export type NavInput = {
  office: Office | undefined;
  requests: AgentRequest[];
  me: Person | undefined;
};

/**
 * The nav per role.
 *
 * FD-19: there is no Agent map entry. What it showed lives in the Team tab of Agents.
 * The "Set up your office" entry disappears after launch, which is the prototype's rule.
 */
export function navFor(role: AccessRole, { office, requests, me }: NavInput): NavItem[] {
  if (role === 'user') {
    const changes = requests.filter((r) => r.by === me?.id && r.status === 'changes').length;
    return [
      { name: 'home', label: 'My agents' },
      { name: 'new', label: 'Request an agent', count: changes || undefined },
      { name: 'activity', label: 'Activity' },
    ];
  }

  if (role === 'super') {
    return [
      { name: 'fleet', label: 'Offices' },
      { name: 'provision', label: 'New office' },
    ];
  }

  const pending = requests.filter((r) => r.status === 'pending').length;
  return [
    { name: 'dashboard', label: 'Home' },
    ...(office?.launched ? [] : [{ name: 'onboarding', label: 'Set up your office' }]),
    { name: 'requests', label: 'Requests', count: pending || undefined },
    { name: 'performance', label: 'Performance' },
    { name: 'office-group', label: 'Office', heading: true as const },
    { name: 'structure', label: 'Org structure' },
    { name: 'agents', label: 'Agents' },
    { name: 'connections', label: 'Connections' },
  ];
}

/** Org Admin lands on onboarding until the office is launched; then on the dashboard. */
export const defaultRoute = (role: AccessRole, office: Office | undefined): string => {
  if (role === 'user') return 'home';
  if (role === 'super') return 'fleet';
  return office?.launched ? 'dashboard' : 'onboarding';
};
