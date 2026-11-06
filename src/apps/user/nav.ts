import { navItem, type NavItem } from '@/shared/layout/nav';
import type { AgentRequest } from '@/shared/schemas';

/** The User entry's own nav. No other entry's labels or paths appear here. */
export const userNav = (requests: AgentRequest[], meId: string | undefined): NavItem[] => [
  navItem('home', 'My agents'),
  navItem(
    'new',
    'Request an agent',
    requests.filter((r) => r.by === meId && r.status === 'changes').length,
  ),
  navItem('activity', 'Activity'),
];
