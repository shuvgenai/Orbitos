import type { Budget } from '@/shared/schemas';

/**
 * AI teammate roles — PRD Appendix A.1.
 *
 * FD-18: Appendix A is the single source of truth and "may not be restated anywhere else",
 * so the ROLE LIST here is the appendix's, not the prototype's. The prototype's nine are
 * parked in docs/backlog.md (B-1) by reference to reference/.../assets/data/jobs.js.
 *
 * Appendix A.1 gives a role and a department and nothing else. The one-line job, the
 * instructions and the sample activity come from the prototype's nearest counterpart with
 * the PRD's name substituted and nothing else in the sentence changed, which is Appendix C
 * instruction 2 verbatim. Every entry below carries a PROVENANCE comment naming the file and
 * key it came from, or PROPOSED where no counterpart exists.
 *
 * Two roles have NO counterpart and their copy is PROPOSED, awaiting the founder (FD-18):
 *   - Finance Clerk: both Finance templates (`ledger`, `compass`) are QuickBooks jobs, and
 *     Appendix A.2 excludes QuickBooks.
 *   - HR Coordinator: the prototype has no HR role at all.
 * The repo rule is report the gap, never fill it. These are labelled proposals, not values
 * entering the tree as though they had a source.
 */

/** FD-25 — PROPOSED defaults, awaiting confirmation. Appendix A.5's three numbers. */
export const DEFAULT_BUDGET: Budget = {
  monthlyUsd: 25,
  dailyCheapCheckUsd: 2,
  turnLimit: 12,
};

/** C-11 / CD-3 safe default: a connector has its own budget. FD-25 — PROPOSED. */
export const DEFAULT_CONNECTION_LIMITS = {
  dailyCalls: 200,
  dailyCostUsd: 5,
} as const;

export type Provenance = { file: string; key: string } | 'PROPOSED';

export type TeammateRole = {
  id: string;
  /** Appendix A.1's role name. */
  name: string;
  type: 'coordinator' | 'specialist';
  /** Appendix A.1's "department it usually serves". `null` for Orbi: always present. */
  deptName: string | null;
  job: string;
  tools: string[];
  prompt: string;
  /** The "Right now" lines and receipt titles. Not in the shared spec — plan 4-C3. */
  sample: string[];
  /** Appendix A.1: Orbi is "not hired", so it never appears in the hire list. */
  hireable: boolean;
  provenance: Provenance;
};

/**
 * Orbi, the Coordinator. Appendix A.1: "Always present, exactly one, never removable, not
 * hired." The seed creates it; no screen offers it and the validator refuses a second.
 */
export const ORBI: TeammateRole = {
  id: 'orbi',
  name: 'Orbi',
  type: 'coordinator',
  deptName: null,
  job: 'Organizes the office and hands work to the right teammate',
  tools: ['email', 'calendar'],
  prompt:
    'You are Orbi, the Coordinator of this office. Read every new task, decide which teammate should handle it, and assign it with a one-line reason. If no teammate fits, ask the Org Admin. Never do specialist work yourself.',
  sample: [
    'Routing 3 new tasks to teammates',
    'Checking the team queue for blocked work',
    "Planning next week's schedule",
  ],
  hireable: false,
  // PROVENANCE: jobs.js key `coordinator` (Atlas). Name substituted per Appendix C
  // instruction 2; tools mapped to Appendix A.2 names (gmail -> email, googlecal ->
  // calendar). Nothing else in any sentence changed.
  provenance: { file: 'reference/orbit-os-frontend/assets/data/jobs.js', key: 'coordinator' },
};

export const HIREABLE_ROLES: TeammateRole[] = [
  {
    id: 'sales-analyst',
    name: 'Sales Analyst',
    type: 'specialist',
    deptName: 'Sales',
    job: 'Qualifies new inbound leads',
    tools: ['email', 'hubspot'],
    prompt:
      'You are the Sales Analyst. For each new inbound lead email, extract company, role and need. Score 1-5 on fit using our ideal customer notes. Write a two-line reason. Hand anything scoring 4 or 5 to the owner for a call.',
    sample: [
      'Scoring a lead from Northwind Logistics',
      'Enriching a new HubSpot contact',
      'Scoring a lead from Harbor & Co',
    ],
    hireable: true,
    // PROVENANCE: jobs.js key `scout`. Name substituted per Appendix C instruction 2
    // ("You are Scout" -> "You are the Sales Analyst"); gmail -> email per A.2.
    provenance: { file: 'reference/orbit-os-frontend/assets/data/jobs.js', key: 'scout' },
  },
  {
    id: 'support-triager',
    name: 'Support Triager',
    type: 'specialist',
    deptName: 'Support',
    job: 'Routes support emails to the right team',
    tools: ['email', 'slack'],
    prompt:
      'You are the Support Triager. Read each support email, tag it billing, technical or sales, and post it in the right Slack channel with a one-line summary.',
    sample: [
      'Routing a billing question to Finance',
      'Tagging a technical issue and alerting Support',
    ],
    hireable: true,
    // PROVENANCE: jobs.js key `beacon`. Name substituted per Appendix C instruction 2.
    provenance: { file: 'reference/orbit-os-frontend/assets/data/jobs.js', key: 'beacon' },
  },
  {
    id: 'operations-reporter',
    name: 'Operations Reporter',
    type: 'specialist',
    deptName: 'Operations',
    job: 'Writes the weekly performance digest',
    tools: ['drive', 'slack'],
    prompt:
      'You are the Operations Reporter. Compile a Friday digest of leads received, replies sent and meetings booked. Keep it under 150 words and post it in Slack.',
    sample: ["Compiling this week's digest", 'Reading the shared KPI sheet'],
    hireable: true,
    // PROVENANCE: jobs.js key `pulse`. Name substituted per Appendix C instruction 2;
    // gdrive -> drive per A.2.
    provenance: { file: 'reference/orbit-os-frontend/assets/data/jobs.js', key: 'pulse' },
  },
  {
    id: 'finance-clerk',
    name: 'Finance Clerk',
    type: 'specialist',
    deptName: 'Finance',
    job: 'Chases overdue invoices',
    tools: ['stripe', 'email'],
    prompt:
      'You are the Finance Clerk. Each morning list payments more than 30 days overdue and draft a polite reminder for each. Escalate anything over $5,000 to the owner.',
    sample: [
      'Checking 3 payments more than 30 days overdue',
      'Drafting a reminder for an overdue invoice',
    ],
    hireable: true,
    // PROVENANCE: PROPOSED. FD-18.
    // `ledger` and `compass` are the only Finance roles in the prototype and both are
    // QuickBooks jobs, which Appendix A.2 excludes -- the founder directed that such a
    // template is "reworked, not kept". So there is no sentence to substitute into.
    // Proposed: keep `ledger`'s SHAPE (a morning sweep for overdue money, a drafted
    // reminder, the $5,000 escalation, which is also one of config.js's five suggested
    // guardrails) and move the source from QuickBooks to Stripe, which IS in A.2 and is its
    // payments connector. A.2 makes Stripe read-only first and notes "change-capable
    // actions need Leader approval", which suits a clerk that reads and drafts.
    provenance: 'PROPOSED',
  },
  {
    id: 'hr-coordinator',
    name: 'HR Coordinator',
    type: 'specialist',
    deptName: 'HR',
    job: 'Drafts and keeps the team handbook current',
    tools: ['notion', 'drive'],
    prompt:
      'You are the HR Coordinator. Keep the team handbook current: draft updates when a policy changes, flag anything out of date for more than a quarter, and answer handbook questions from the pages only. Drafts only.',
    sample: ['Drafting a handbook update', 'Flagging two policies as out of date'],
    hireable: true,
    // PROVENANCE: PROPOSED. FD-18.
    // The prototype has no HR role of any kind, so nothing can be substituted. Proposed:
    // `quill`'s shape -- a drafts-only writer reading from Notion and Drive, which are both
    // in A.2 -- pointed at the handbook, because that is the HR document A.1's "HR
    // Coordinator" plausibly coordinates and it needs no connector outside the catalog.
    // "Drafts only." is lifted from config.js's suggested guardrails.
    provenance: 'PROPOSED',
  },
];

export const ALL_ROLES: TeammateRole[] = [ORBI, ...HIREABLE_ROLES];

export const roleById = (id: string): TeammateRole | undefined =>
  ALL_ROLES.find((r) => r.id === id);
