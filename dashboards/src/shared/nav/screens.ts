// The 52 screens of PRD v9.0, sections 15.5 to 15.7. Data only: no copy, no
// component, no route wired.
//
// Every name and route here is the PRD's own, and guards/screen-inventory.test.ts
// parses those three tables out of the document and fails when this file drifts.
// So this list is not a second source of truth; it is the PRD in a shape code
// can read. To add a screen, change the PRD first.
//
// `inSidebar` is the one column the PRD does not state. Ten screens are routes
// and not links, because a route with an id has nothing to link to, a step
// inside another screen is reached from that screen, and sign-in sits outside
// the shell. `/authority` is 'flag': section 15.6 makes it read-only behind a
// flag that defaults to off, so it is routed always and linked only when the
// flag is on (founder decision, 2026-10-07).

export type ScreenSection = '15.5' | '15.6' | '15.7';

export type ScreenRow = {
  /** The screen's name, exactly as the PRD table names it. */
  readonly screen: string;
  /** Its route, exactly as the PRD table gives it. */
  readonly route: string;
  /** Which inventory it came from. 15.7 is the fleet console, exempt under 15.3. */
  readonly section: ScreenSection;
  /** A link in the nav list, or routed only. 'flag' means linked when its flag is on. */
  readonly inSidebar: boolean | 'flag';
};

/** Section 15.5, the User app. 14 screens. */
const USER_SCREENS: readonly ScreenRow[] = [
  { screen: 'Sign in', route: '/signin', section: '15.5', inSidebar: false },
  { screen: 'Home', route: '/', section: '15.5', inSidebar: true },
  { screen: 'Ask or describe', route: '/new', section: '15.5', inSidebar: true },
  { screen: 'Job summary check', route: '/new/summary', section: '15.5', inSidebar: false },
  { screen: 'Practice run', route: '/new/practice', section: '15.5', inSidebar: false },
  { screen: 'Task board', route: '/tasks', section: '15.5', inSidebar: true },
  { screen: 'Task page', route: '/tasks/:id', section: '15.5', inSidebar: false },
  { screen: 'Waiting for you', route: '/waiting', section: '15.5', inSidebar: true },
  { screen: 'Approval page', route: '/waiting/:id', section: '15.5', inSidebar: false },
  { screen: 'Receipts', route: '/receipts', section: '15.5', inSidebar: true },
  { screen: 'Weekly reviews', route: '/reviews', section: '15.5', inSidebar: true },
  { screen: 'Chat with Orbi', route: '/chat', section: '15.5', inSidebar: true },
  { screen: 'Request a teammate', route: '/teammates/request', section: '15.5', inSidebar: true },
  { screen: 'Profile and alerts', route: '/me', section: '15.5', inSidebar: true },
];

/** Section 15.6, the Org Admin app. 21 screens, on top of every User screen. */
const ORG_ADMIN_SCREENS: readonly ScreenRow[] = [
  { screen: 'Guided setup', route: '/setup', section: '15.6', inSidebar: true },
  { screen: 'Departments and teams', route: '/org/departments', section: '15.6', inSidebar: true },
  { screen: 'Org chart', route: '/org/chart', section: '15.6', inSidebar: true },
  { screen: 'People', route: '/org/people', section: '15.6', inSidebar: true },
  { screen: 'AI teammates', route: '/teammates', section: '15.6', inSidebar: true },
  { screen: 'Teammate profile', route: '/teammates/:id', section: '15.6', inSidebar: false },
  { screen: 'Requests', route: '/requests', section: '15.6', inSidebar: true },
  { screen: 'Jobs library', route: '/jobs', section: '15.6', inSidebar: true },
  { screen: 'Job detail', route: '/jobs/:id', section: '15.6', inSidebar: false },
  { screen: 'Standing Authority', route: '/authority', section: '15.6', inSidebar: 'flag' },
  { screen: 'Rules and safety', route: '/rules', section: '15.6', inSidebar: true },
  { screen: 'Data boundaries', route: '/rules/data', section: '15.6', inSidebar: true },
  { screen: 'Activity log', route: '/activity', section: '15.6', inSidebar: true },
  { screen: 'Spending', route: '/spending', section: '15.6', inSidebar: true },
  { screen: 'Plan and invoices', route: '/spending/plan', section: '15.6', inSidebar: true },
  { screen: 'Connections', route: '/connections', section: '15.6', inSidebar: true },
  { screen: 'Intake channels', route: '/connections/intake', section: '15.6', inSidebar: true },
  { screen: 'Results', route: '/results', section: '15.6', inSidebar: true },
  { screen: 'Privacy', route: '/privacy', section: '15.6', inSidebar: true },
  { screen: 'Data', route: '/data', section: '15.6', inSidebar: true },
  { screen: 'Office controls', route: '/settings/office', section: '15.6', inSidebar: true },
];

/** Section 15.7, the fleet console. 17 screens, internal operator surface. */
const FLEET_SCREENS: readonly ScreenRow[] = [
  { screen: 'Fleet table', route: '/fleet', section: '15.7', inSidebar: true },
  { screen: 'Office view', route: '/fleet/:id', section: '15.7', inSidebar: false },
  { screen: 'Provision', route: '/provision', section: '15.7', inSidebar: true },
  { screen: 'Upgrades', route: '/upgrades', section: '15.7', inSidebar: true },
  { screen: 'Backups', route: '/backups', section: '15.7', inSidebar: true },
  { screen: 'Shutdown', route: '/fleet/:id/shutdown', section: '15.7', inSidebar: false },
  { screen: 'Security', route: '/security', section: '15.7', inSidebar: true },
  { screen: 'Alerts and incidents', route: '/incidents', section: '15.7', inSidebar: true },
  { screen: 'View as customer', route: '/fleet/:id/view', section: '15.7', inSidebar: false },
  { screen: 'Money', route: '/money', section: '15.7', inSidebar: true },
  { screen: 'Quality', route: '/quality', section: '15.7', inSidebar: true },
  { screen: 'Role library', route: '/library', section: '15.7', inSidebar: true },
  { screen: 'Skills review', route: '/skills', section: '15.7', inSidebar: true },
  { screen: 'Connector catalog', route: '/connectors', section: '15.7', inSidebar: true },
  { screen: 'Custom connector queue', route: '/connectors/review', section: '15.7', inSidebar: true },
  { screen: 'Nightly numbers', route: '/numbers', section: '15.7', inSidebar: true },
  { screen: 'Build checks', route: '/checks', section: '15.7', inSidebar: true },
];

/** All 52, in the PRD's order, section by section. */
export const SCREENS: readonly ScreenRow[] = [...USER_SCREENS, ...ORG_ADMIN_SCREENS, ...FLEET_SCREENS];

export { FLEET_SCREENS, ORG_ADMIN_SCREENS, USER_SCREENS };
