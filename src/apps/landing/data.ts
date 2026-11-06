/**
 * The ten departments, verbatim from orbitcrew-landing-page-content.md sections 3 and 3's
 * tables. Approved content: every string here is the spec's, not mine.
 *
 * The spec's own note applies: "All names, amounts and costs above are placeholders. Replace
 * them with real pilot data when you have it."
 *
 * Section 6 of that document is an OPEN DECISION the spec asks the founder to make before
 * promotion -- keep all ten tabs, tag nine of them "Coming soon", or show fewer. All ten are
 * built because all ten are what the copy tables specify; no "Coming soon" tag is added,
 * because adding one changes what the page claims. See FD-29.
 */
export type Department = {
  id: string;
  tab: string;
  office: string;
  coordinator: string;
  specialist: string;
  frontDesk: string;
  question: string;
  approveLabel: string;
  approved: string;
  held: string;
  tasks: string;
  cost: string;
};

export const DEPARTMENTS: readonly Department[] = [
  {
    id: 'sales',
    tab: 'Sales',
    office: 'Sales office',
    coordinator: 'Sorted 12 new leads',
    specialist: 'Flagged a $4,800 quote request',
    frontDesk: 'Drafted a reply to Dana Whitfield',
    question: 'Reply to Dana Whitfield includes a price. Send it?',
    approveLabel: 'Approve and send',
    approved: 'Reply to Dana Whitfield sent. Logged with the approver and time.',
    held: 'Reply to Dana Whitfield is held. Nothing was sent.',
    tasks: 'Today: 38 tasks',
    cost: '$1.12',
  },
  {
    id: 'marketing',
    tab: 'Marketing',
    office: 'Marketing office',
    coordinator: "Reviewed this week's 4 scheduled posts",
    specialist: 'Rewrote one to match your brand voice',
    frontDesk: 'Drafted a LinkedIn post about your spring offer',
    question: 'The LinkedIn post about your spring offer is ready. Publish it?',
    approveLabel: 'Approve and post',
    approved: 'Post approved and published. Logged with the approver and time.',
    held: 'Post is held. Nothing was published.',
    tasks: 'Today: 15 tasks',
    cost: '$0.42',
  },
  {
    id: 'support',
    tab: 'Support',
    office: 'Customer support office',
    coordinator: 'Sorted 9 customer emails',
    specialist: 'Matched a question to your delivery policy',
    frontDesk: 'Drafted a reply to Priya Nair',
    question: 'Reply to Priya Nair explains your delivery policy. Send it?',
    approveLabel: 'Approve and send',
    approved: 'Reply to Priya Nair sent. Logged with the approver and time.',
    held: 'Reply to Priya Nair is held. Nothing was sent.',
    tasks: 'Today: 26 tasks',
    cost: '$0.83',
  },
  {
    id: 'finance',
    tab: 'Finance',
    office: 'Finance office',
    coordinator: 'Read 14 receipts and 6 invoices',
    specialist: 'Matched 19 to your budget rules',
    frontDesk: 'Flagged a $1,240 software renewal',
    question: 'A $1,240 software renewal is over your $500 limit. Approve it?',
    approveLabel: 'Approve',
    approved: 'Renewal approved. Receipt saved with the reason and time.',
    held: 'Renewal is held. Nothing was paid.',
    tasks: 'Today: 17 tasks',
    cost: '$0.51',
  },
  {
    id: 'procurement',
    tab: 'Procurement',
    office: 'Procurement office',
    coordinator: 'Collected 3 quotes for office chairs',
    specialist: 'Compared price, delivery and terms',
    frontDesk: 'Drafted a purchase order to Northline Supply',
    question: 'A $6,200 purchase order to Northline Supply is ready. Approve it?',
    approveLabel: 'Approve',
    approved: 'Purchase order approved. Saved with the quotes and the reason.',
    held: 'Purchase order is held. Nothing was ordered.',
    tasks: 'Today: 24 tasks',
    cost: '$0.78',
  },
  {
    id: 'operations',
    tab: 'Operations',
    office: 'Operations office',
    coordinator: 'Checked 5 open jobs against the schedule',
    specialist: 'Found a delivery that will miss Friday',
    frontDesk: 'Drafted a delay notice to Carlos Ortiz',
    question: "A delay notice moves Carlos Ortiz's delivery to Monday. Send it?",
    approveLabel: 'Approve and send',
    approved: 'Delay notice sent to Carlos Ortiz. Logged with the approver and time.',
    held: 'Delay notice is held. Nothing was sent.',
    tasks: 'Today: 19 tasks',
    cost: '$0.58',
  },
  {
    id: 'logistics',
    tab: 'Logistics',
    office: 'Logistics office',
    coordinator: 'Tracked 23 open shipments',
    specialist: 'Compared 3 carrier rates for a pallet to Denver',
    frontDesk: 'Drafted a booking with Lone Star Freight',
    question: 'A $1,850 freight booking with Lone Star Freight is ready. Approve it?',
    approveLabel: 'Approve',
    approved: 'Freight booking approved. Saved with the rate comparison and time.',
    held: 'Freight booking is held. Nothing was booked.',
    tasks: 'Today: 28 tasks',
    cost: '$0.86',
  },
  {
    id: 'hr',
    tab: 'HR',
    office: 'HR office',
    coordinator: 'Screened 18 applications for the office coordinator role',
    specialist: 'Shortlisted 4 who meet your requirements',
    frontDesk: 'Drafted an interview invitation to Sofia Alvarez',
    question: 'An interview invitation to Sofia Alvarez is ready. Send it?',
    approveLabel: 'Approve and send',
    approved: 'Invitation sent to Sofia Alvarez. Logged with the approver and time.',
    held: 'Invitation is held. Nothing was sent.',
    tasks: 'Today: 22 tasks',
    cost: '$0.69',
  },
  {
    id: 'legal',
    tab: 'Legal',
    office: 'Legal office',
    coordinator: 'Checked 6 contracts for renewal dates',
    specialist: 'Found an auto-renewal clause in a vendor contract',
    frontDesk: 'Drafted a non-renewal notice to Brightline Software',
    question:
      'A non-renewal notice to Brightline Software ends the contract in 60 days. Send it?',
    approveLabel: 'Approve and send',
    approved: 'Notice sent to Brightline Software. Logged with the approver and time.',
    held: 'Notice is held. Nothing was sent.',
    tasks: 'Today: 14 tasks',
    cost: '$0.47',
  },
  {
    id: 'it',
    tab: 'IT',
    office: 'IT office',
    coordinator: 'Reviewed 11 open help requests',
    specialist: 'Matched 8 to known fixes',
    frontDesk: 'Drafted account reset steps for Ellen Park',
    question: 'Reply to Ellen Park with her account reset steps is ready. Send it?',
    approveLabel: 'Approve and send',
    approved: 'Reply to Ellen Park sent. Logged with the approver and time.',
    held: 'Reply to Ellen Park is held. Nothing was sent.',
    tasks: 'Today: 31 tasks',
    cost: '$0.72',
  },
];

/** Section 2, verbatim. The brand is spelled OrbitCrew per FD-5; see the errata. */
export const COPY = {
  brand: 'OrbitCrew',
  requestCta: 'Request your office',
  mailto:
    'mailto:shuv@orbitumai.com?subject=OrbitCrew%20office%20request',
  headline: 'The first hire that never needs onboarding.',
  subhead:
    'OrbitCrew gives your firm a small AI office. It runs the everyday work across your business, from sales and finance to logistics and HR. It asks you before anything goes out.',
  buttonNote: 'Your own instance, your own domain, run for you.',
  trust: [
    'You approve every message',
    'Your own private instance',
    'Every action and cost on record',
  ],
  footerLine: 'OrbitumAI · McKinney, Texas',
  footerEmail: 'shuv@orbitumai.com',
  timestamp: 'Today, 9:41 AM',
  needsApproval: 'Needs your approval',
  approvedTag: 'Approved',
  heldTag: 'On hold',
  hold: 'Hold',
  undo: 'Undo',
  signIn: 'Sign in',
  orgAdminSignIn: 'Org Admin sign in',
  teammates: { coordinator: 'Coordinator (C)', specialist: 'Specialist (S)', frontDesk: 'Front Desk (F)' },
} as const;
