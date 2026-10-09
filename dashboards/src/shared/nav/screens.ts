// The 52 screens of PRD v9.0, sections 15.5 to 15.7.
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
// flag that defaults to off, so it is linked only when the flag is on.
//
// The route is gated too, as of 2026-10-08. The 2026-10-07 decision was that a
// flagged screen is routed either way and only its link is hidden. Finding M17
// of that day's security review pointed out that this makes the flag not an off
// switch: `/authority` was reachable by typing it. The founder superseded the
// earlier decision the same day. With the flag off the route now renders the
// flagged-off state, which lives in layout/RoleRoutes.tsx.
//
// `appears` and `fills` are the section 15.4 empty state: what will appear here,
// and the one action or condition that fills it. `appears` is the PRD's "What it
// holds" column, shortened to a phrase read in one go. `fills` follows section
// 15.8: for the 24 Fill-later screens it is that screen's "Unblocked by", said
// in the words a customer would use, because section 15.3 keeps stream names,
// decision numbers and internal ids off every customer screen. The fleet
// console is exempt from that rule and still gets plain operator language: a
// decision number is not an answer to "what fills this".

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
  /** What will appear on this screen, in one phrase. */
  readonly appears: string;
  /** The one action or condition that fills it, in one sentence. */
  readonly fills: string;
};

/** Section 15.5, the User app. 14 screens. */
const USER_SCREENS: readonly ScreenRow[] = [
  {
    screen: 'Sign in',
    route: '/signin',
    section: '15.5',
    inSidebar: false,
    appears: 'A way into your office',
    fills: 'Enter your work email and we send you a link.',
  },
  {
    screen: 'Home',
    route: '/',
    section: '15.5',
    inSidebar: true,
    appears: 'What is waiting for you, today’s work, and your recent receipts',
    fills: 'Ask for your first task and this fills in.',
  },
  {
    screen: 'Ask or describe',
    route: '/new',
    section: '15.5',
    inSidebar: true,
    appears: 'One box for asking for a task, or describing a job that runs again and again',
    fills: 'Type what you need in plain English, or speak it.',
  },
  {
    screen: 'Job summary check',
    route: '/new/summary',
    section: '15.5',
    inSidebar: false,
    appears: 'The seven lines Orbi wrote from your words, and any question it still has',
    fills: 'Describe a job on the Ask or describe screen and its summary comes here.',
  },
  {
    screen: 'Practice run',
    route: '/new/practice',
    section: '15.5',
    inSidebar: false,
    appears: 'What your job would have done on three real examples',
    fills: 'Approve a job summary and its practice run comes here.',
  },
  {
    screen: 'Task board',
    route: '/tasks',
    section: '15.5',
    inSidebar: true,
    appears: 'Three lists: waiting for me, assigned to me, and the ones I asked for',
    fills: 'Ask for your first task and it joins one of these lists.',
  },
  {
    screen: 'Task page',
    route: '/tasks/:id',
    section: '15.5',
    inSidebar: false,
    appears: 'What the task is, who has it, what it did, and its receipt',
    fills: 'Open a task from your task board to read it here.',
  },
  {
    screen: 'Waiting for you',
    route: '/waiting',
    section: '15.5',
    inSidebar: true,
    appears: 'Everything waiting on your answer, oldest first',
    fills: 'This fills when a teammate needs you to approve something.',
  },
  {
    screen: 'Approval page',
    route: '/waiting/:id',
    section: '15.5',
    inSidebar: false,
    appears: 'The request, what it is based on, and exactly what happens if you approve',
    fills: 'Open an item from Waiting for you to decide it here.',
  },
  {
    screen: 'Receipts',
    route: '/receipts',
    section: '15.5',
    inSidebar: true,
    appears: 'One receipt for every action your office took',
    fills: 'Your first finished task writes the first receipt.',
  },
  {
    screen: 'Weekly reviews',
    route: '/reviews',
    section: '15.5',
    inSidebar: true,
    appears: 'Every Friday review, newest first',
    fills: 'The first review arrives once your office has worked a full week.',
  },
  {
    screen: 'Chat with Orbi',
    route: '/chat',
    section: '15.5',
    inSidebar: true,
    appears: 'Plain answers from Orbi about the work you are allowed to see',
    fills: 'Orbi can answer here once your office is running its own work.',
  },
  {
    screen: 'Request a teammate',
    route: '/teammates/request',
    section: '15.5',
    inSidebar: true,
    appears: 'The teammates you have asked for, and who is deciding',
    fills: 'Ask for a teammate and your request comes here.',
  },
  {
    screen: 'Profile and alerts',
    route: '/me',
    section: '15.5',
    inSidebar: true,
    appears: 'How you hear about work, your away setting, and who covers for you',
    fills: 'Choose how you want to be told about work and your choices show here.',
  },
];

/** Section 15.6, the Org Admin app. 21 screens, on top of every User screen. */
const ORG_ADMIN_SCREENS: readonly ScreenRow[] = [
  {
    screen: 'Guided setup',
    route: '/setup',
    section: '15.6',
    inSidebar: true,
    appears: 'Six steps that take your office from empty to working',
    fills: 'Start with the first step and your progress shows here.',
  },
  {
    screen: 'Departments and teams',
    route: '/org/departments',
    section: '15.6',
    inSidebar: true,
    appears: 'Your departments and teams, each with an approver and a path upward',
    fills: 'Add your first department and it comes here.',
  },
  {
    screen: 'Org chart',
    route: '/org/chart',
    section: '15.6',
    inSidebar: true,
    appears: 'Who reports to whom, people and teammates on one indented list',
    fills: 'Add a person or hire a teammate and the chart comes here.',
  },
  {
    screen: 'People',
    route: '/org/people',
    section: '15.6',
    inSidebar: true,
    appears: 'Everyone in your office, what they can reach, and what they may approve',
    fills: 'Invite your first person and they come here.',
  },
  {
    screen: 'AI teammates',
    route: '/teammates',
    section: '15.6',
    inSidebar: true,
    appears: 'The teammates you have hired, what each is doing now, and what each costs today',
    fills: 'Hire your first teammate from the role list and it comes here.',
  },
  {
    screen: 'Teammate profile',
    route: '/teammates/:id',
    section: '15.6',
    inSidebar: false,
    appears: 'One teammate: its role, its guardrails, the tools it may use, and its limits',
    fills: 'Open a teammate from the list to read it here.',
  },
  {
    screen: 'Requests',
    route: '/requests',
    section: '15.6',
    inSidebar: true,
    appears: 'One queue for teammate requests, job approvals, and requests to act for someone',
    fills: 'This fills when someone asks for a teammate, a job or a role.',
  },
  {
    screen: 'Jobs library',
    route: '/jobs',
    section: '15.6',
    inSidebar: true,
    appears: 'Every standing job in plain English, with its owner, its last run and its cost',
    fills: 'Describe your first job and it comes here.',
  },
  {
    screen: 'Job detail',
    route: '/jobs/:id',
    section: '15.6',
    inSidebar: false,
    appears: 'One job: its seven lines, its limits, its history, and every version of it',
    fills: 'Open a job from the library to read it here.',
  },
  {
    screen: 'Standing Authority',
    route: '/authority',
    section: '15.6',
    inSidebar: 'flag',
    appears: 'The standing approvals your office has granted, and what each one covers',
    fills: 'This screen stays read only until your office turns standing approvals on.',
  },
  {
    screen: 'Rules and safety',
    route: '/rules',
    section: '15.6',
    inSidebar: true,
    appears: 'Your rules, your quiet hours, and the people and things never to touch',
    fills: 'A rule is suggested here once your office has changed the same decision more than once.',
  },
  {
    screen: 'Data boundaries',
    route: '/rules/data',
    section: '15.6',
    inSidebar: true,
    appears: 'Which department’s work each teammate may see',
    fills: 'Every teammate starts able to see nothing, so a boundary shows here once you open one.',
  },
  {
    screen: 'Activity log',
    route: '/activity',
    section: '15.6',
    inSidebar: true,
    appears: 'Who approved what, and what let them approve it',
    fills: 'The first approval in your office writes the first line here.',
  },
  {
    screen: 'Spending',
    route: '/spending',
    section: '15.6',
    inSidebar: true,
    appears: 'What your office, its teammates and its jobs cost against the limits you set',
    fills: 'Spending shows here once a teammate does work that costs money.',
  },
  {
    screen: 'Plan and invoices',
    route: '/spending/plan',
    section: '15.6',
    inSidebar: true,
    appears: 'Your plan, and every invoice your office has had',
    fills: 'Your first invoice arrives here after your first full month.',
  },
  {
    screen: 'Connections',
    route: '/connections',
    section: '15.6',
    inSidebar: true,
    appears: 'Every tool your office is connected to, and what each one may do',
    fills: 'Connect your first tool and it comes here.',
  },
  {
    screen: 'Intake channels',
    route: '/connections/intake',
    section: '15.6',
    inSidebar: true,
    appears: 'Which inboxes, chats, forms and timetables may start work',
    fills: 'Allow an inbox or a form to start work and it comes here.',
  },
  {
    screen: 'Results',
    route: '/results',
    section: '15.6',
    inSidebar: true,
    appears: 'Two views: how the office did, and how each teammate did',
    fills: 'Results arrive here once your office has finished a full week of work.',
  },
  {
    screen: 'Privacy',
    route: '/privacy',
    section: '15.6',
    inSidebar: true,
    appears: 'What your teammates saw, and where it went',
    fills: 'This fills once the list of outside tools your office may use is settled.',
  },
  {
    screen: 'Data',
    route: '/data',
    section: '15.6',
    inSidebar: true,
    appears: 'A copy of your office to take away, and the choice to delete it',
    fills: 'Ask for a copy of your office and it comes here.',
  },
  {
    screen: 'Office controls',
    route: '/settings/office',
    section: '15.6',
    inSidebar: true,
    appears: 'The switch that pauses the whole office, and who owns its connections',
    fills: 'Pause your office here whenever the work needs to stop.',
  },
];

/** Section 15.7, the fleet console. 17 screens, internal operator surface. */
const FLEET_SCREENS: readonly ScreenRow[] = [
  {
    screen: 'Fleet table',
    route: '/fleet',
    section: '15.7',
    inSidebar: true,
    appears: 'Every office, with health, version, backup, team, connections, incidents and spend',
    fills: 'Provision the first office and it appears here.',
  },
  {
    screen: 'Office view',
    route: '/fleet/:id',
    section: '15.7',
    inSidebar: false,
    appears: 'One office: its status, its overrides, its settings, and the operator audit',
    fills: 'Open an office from the fleet table to see it here.',
  },
  {
    screen: 'Provision',
    route: '/provision',
    section: '15.7',
    inSidebar: true,
    appears: 'Six facts in, and a tracker showing where each new customer is stuck',
    fills: 'Start a provision and its tracker appears here.',
  },
  {
    screen: 'Upgrades',
    route: '/upgrades',
    section: '15.7',
    inSidebar: true,
    appears: 'The upgrade calendar, staging first, with a rollback inside ten minutes',
    fills: 'The calendar fills once a second office exists to stage an upgrade against.',
  },
  {
    screen: 'Backups',
    route: '/backups',
    section: '15.7',
    inSidebar: true,
    appears: 'Nightly backup status, restores, and the monthly practice restore',
    fills: 'Nightly status appears here as soon as an office runs its first backup.',
  },
  {
    screen: 'Shutdown',
    route: '/fleet/:id/shutdown',
    section: '15.7',
    inSidebar: false,
    appears: 'The written request, the owner confirmation, the export, and the 30 day deletion',
    fills: 'Open an office and ask for a shutdown to see it here.',
  },
  {
    screen: 'Security',
    route: '/security',
    section: '15.7',
    inSidebar: true,
    appears: 'Posture check results, operator two step, and the evidence pack',
    fills: 'Run the posture check and its results appear here.',
  },
  {
    screen: 'Alerts and incidents',
    route: '/incidents',
    section: '15.7',
    inSidebar: true,
    appears: 'Server, backup, outside action and provider incidents, with the log',
    fills: 'An incident appears here the first time a check fails in a live office.',
  },
  {
    screen: 'View as customer',
    route: '/fleet/:id/view',
    section: '15.7',
    inSidebar: false,
    appears: 'A support view an owner has consented to, with a visible banner and a log',
    fills: 'Ask an office owner for consent and the view opens here.',
  },
  {
    screen: 'Money',
    route: '/money',
    section: '15.7',
    inSidebar: true,
    appears: 'Operator time, cost analytics, and profit per customer',
    fills: 'These numbers appear once live offices have reported a full month of cost.',
  },
  {
    screen: 'Quality',
    route: '/quality',
    section: '15.7',
    inSidebar: true,
    appears: 'The job quality scoreboard, the job understanding test set, and model routing',
    fills: 'Scores appear here once the job understanding test set runs against a live office.',
  },
  {
    screen: 'Role library',
    route: '/library',
    section: '15.7',
    inSidebar: true,
    appears: 'Ready made teammate roles, and starter phrases for each department',
    fills: 'The library fills once roles can be managed rather than fixed for a release.',
  },
  {
    screen: 'Skills review',
    route: '/skills',
    section: '15.7',
    inSidebar: true,
    appears: 'New skills a teammate has proposed, waiting to be read before anyone uses them',
    fills: 'A skill appears here the first time a teammate proposes one.',
  },
  {
    screen: 'Connector catalog',
    route: '/connectors',
    section: '15.7',
    inSidebar: true,
    appears: 'Every connector, its pinned version, its health, and its per office switches',
    fills: 'The catalog fills once the open connector decisions are answered.',
  },
  {
    screen: 'Custom connector queue',
    route: '/connectors/review',
    section: '15.7',
    inSidebar: true,
    appears: 'The review checklist and the decision for each custom connector',
    fills: 'This queue stays empty while custom connectors are switched off by default.',
  },
  {
    screen: 'Nightly numbers',
    route: '/numbers',
    section: '15.7',
    inSidebar: true,
    appears: 'What each office sends every night, and when it last sent',
    fills: 'An office appears here after its first nightly report.',
  },
  {
    screen: 'Build checks',
    route: '/checks',
    section: '15.7',
    inSidebar: true,
    appears: 'Design and naming check results, screen by screen',
    fills: 'The checks already run on every build, so results appear here once this view reads them.',
  },
];

/** All 52, in the PRD's order, section by section. */
export const SCREENS: readonly ScreenRow[] = [...USER_SCREENS, ...ORG_ADMIN_SCREENS, ...FLEET_SCREENS];

export { FLEET_SCREENS, ORG_ADMIN_SCREENS, USER_SCREENS };
