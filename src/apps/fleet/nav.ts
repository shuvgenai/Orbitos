import { navItem, type NavItem } from '@/shared/layout/nav';

/** The operator console's own nav. PRD 15.3 exempts this surface. */
export const fleetNav = (): NavItem[] => [
  navItem('fleet', 'Offices'),
  navItem('provision', 'New office'),
];
