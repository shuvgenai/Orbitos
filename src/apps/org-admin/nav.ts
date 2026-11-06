import type { AgentRequest, Office } from '@/shared/schemas';
import { navHeading, navItem, type NavItem } from '@/shared/layout/nav';

/**
 * The Org Admin entry's own nav.
 *
 * FD-19: there is no Agent map entry. What it showed belongs in the Team tab of Agents.
 * "Set up your office" disappears once the office is launched, which is the prototype's
 * rule.
 */
export const orgAdminNav = (office: Office | undefined, requests: AgentRequest[]): NavItem[] => [
  navItem('dashboard', 'Home'),
  ...(office?.launched ? [] : [navItem('onboarding', 'Set up your office')]),
  navItem('requests', 'Requests', requests.filter((r) => r.status === 'pending').length),
  navItem('performance', 'Performance'),
  navHeading('Office'),
  navItem('structure', 'Org structure'),
  navItem('agents', 'Agents'),
  navItem('connections', 'Connections'),
];
