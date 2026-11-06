import type { OrgTemplate } from '@/shared/schemas';

/** The one persisted key. Only MockApiClient touches it. */
export const STORE_KEY = 'orbitcrew.v1';
export const STORE_VERSION = 1;

/**
 * PRD 15.3 / FD-5: OrbitCrew, capital O, capital C, one word.
 *
 * The operator console's name is NOT here. It lives in src/apps/fleet/portal.ts, because
 * this module is in every bundle and 15.3 bans that word from the customer surfaces --
 * including, as measured, from a string table they never render.
 */
export const APP_NAME_CUSTOMER = 'OrbitCrew';

/** PROVENANCE: assets/config.js `BASE_GUARDS` — three defaults, verbatim. */
export const BASE_GUARDRAILS: string[] = [
  'Never send a message to a customer without human approval.',
  'Never share pricing, discounts or contract terms.',
  'Stop and ask if a request involves spending money.',
];

/** PROVENANCE: assets/config.js `SUGGEST_GUARDS` — five suggestions, verbatim. */
export const SUGGESTED_GUARDRAILS: string[] = [
  'Drafts only. Cannot send.',
  'Never contact customers directly.',
  'Spend no more than $5 per run.',
  'Escalate anything over $5,000 to the owner.',
  'Only use the tools listed for this agent.',
];

/** PROVENANCE: assets/data/org.js `OrgTemplates` — verbatim. */
export const ORG_TEMPLATES: OrgTemplate[] = [
  { id: 'services', name: 'Professional services', depts: ['Sales', 'Operations', 'Finance'] },
  { id: 'agency', name: 'Agency', depts: ['Clients', 'Creative', 'Finance'] },
  { id: 'retail', name: 'Retail and e-commerce', depts: ['Sales', 'Support', 'Operations'] },
  { id: 'blank', name: 'Start blank', depts: [] },
];

/**
 * The seven launch steps, in the order the shared spec fixes. PROVENANCE: api.js `JOB`.
 * The dev failure option fails `profiles` once -- "Give each agent its own workspace".
 */
export const LAUNCH_STEPS: ReadonlyArray<readonly [string, string]> = [
  ['company', 'Set up your office'],
  ['chart', 'Build the org chart'],
  ['agents', 'Hire your agents'],
  ['profiles', 'Give each agent its own workspace'],
  ['budgets', 'Set budgets'],
  ['tools', 'Apply tool permissions'],
  ['invites', 'Invite your people'],
] as const;

export const LAUNCH_STEP_MS = 600;
export const TICKER_MS = 7000;
export const CONNECT_SIM_MS = 700;
export const PROVISION_STEP_MS = 650;

/** FD-23: Orbi is level 1; a fourth level of reporting is refused. */
export const MAX_TREE_DEPTH = 3;

/** The minimum length of a set of instructions, everywhere it is checked. */
export const MIN_PROMPT_CHARS = 20;

/**
 * The budget a request-approved teammate starts on. The prototype hardcoded a single $15
 * (docs/plan.md 4-C6); under FD-18 a budget is three numbers, so this is DEFAULT_BUDGET.
 */
export { DEFAULT_BUDGET, DEFAULT_CONNECTION_LIMITS } from './roles';
