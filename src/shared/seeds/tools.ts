import type { Tool } from '@/shared/schemas';

/**
 * Connector catalog — PRD Appendix A.2.
 *
 * FD-18: Appendix A.2 is the catalog and "may not be restated anywhere else", so WHICH
 * connectors exist and their first permission come from the appendix. QuickBooks, Intercom
 * and Salesforce are excluded by name there and are not carried over; the prototype's
 * ten-tool catalog is superseded.
 *
 * Appendix A.2 makes every first permission read-only. PRD 13.1 requires the SAFE-DEFAULT
 * column, not the suggestion column, until CD-1 to CD-5 are answered:
 *   CD-1 custom connectors disabled               -> no "add your own" path exists
 *   CD-3 own budget per connector                 -> limits live on Connection (C-11)
 *   CD-4 Appendix A.2 as written                  -> this list
 *   CD-5 every change-capable connector needs a Leader approval -> `changeCapable`
 *
 * The can / ask first / never SHAPE AND COPY is the prototype's, with connector names
 * substituted per Appendix C instruction 2. Each entry names its source key.
 * No `tile` colour is carried over: PRD 15.2 allows no second accent and DESIGN.md forbids
 * literal colours, so the initials render on paper with a 1px line.
 */
export const TOOLS: Tool[] = [
  {
    key: 'email',
    name: 'Email',
    initials: 'E',
    firstPermission: 'read',
    tier: 'available',
    auth: 'Google sign-in',
    desc: 'Read new messages and prepare drafts from your own address.',
    can: ['Read new messages', 'Create drafts', 'Apply labels'],
    ask: ['Sending to more than one person'],
    never: ['Deleting email'],
    changeCapable: true,
    // PROVENANCE: mcps.js key `gmail`. A.2 names the connector "Email"; it is also an
    // intake channel there. Lists unchanged.
  },
  {
    key: 'calendar',
    name: 'Calendar',
    initials: 'C',
    firstPermission: 'read',
    tier: 'available',
    auth: 'Google sign-in',
    desc: 'See availability and propose or book meetings.',
    can: ['Read availability', 'Propose meeting times'],
    ask: ['Cancelling a meeting with a customer'],
    never: ['Deleting calendars'],
    changeCapable: true,
    // PROVENANCE: mcps.js key `googlecal`.
  },
  {
    key: 'drive',
    name: 'Drive',
    initials: 'D',
    firstPermission: 'read',
    tier: 'available',
    auth: 'Google sign-in',
    desc: 'Find and read files; save generated reports.',
    can: ['Search and read files', 'Save generated reports'],
    ask: ['Sharing a file outside your company'],
    never: ['Deleting files'],
    changeCapable: true,
    // PROVENANCE: mcps.js key `gdrive`.
  },
  {
    key: 'slack',
    name: 'Slack',
    initials: 'S',
    firstPermission: 'read',
    tier: 'available',
    auth: 'Slack sign-in',
    desc: 'Post summaries and send approval requests where your team talks.',
    can: ['Post messages', 'Send approvals as direct messages'],
    ask: ['Posting in a public channel'],
    never: ['Reading channels it was not added to'],
    changeCapable: true,
    // PROVENANCE: mcps.js key `slack`. Also an intake channel per A.2.
  },
  {
    key: 'hubspot',
    name: 'HubSpot',
    initials: 'H',
    firstPermission: 'read',
    tier: 'available',
    auth: 'HubSpot sign-in',
    desc: 'Create and update contacts, deals and notes in your CRM.',
    can: ['Create and update contacts', 'Update deal stages', 'Add notes'],
    ask: ['Marking a deal as lost'],
    never: ['Deleting records'],
    changeCapable: true,
    // PROVENANCE: mcps.js key `hubspot`.
  },
  {
    key: 'stripe',
    name: 'Stripe',
    initials: 'St',
    firstPermission: 'read',
    tier: 'available',
    auth: 'Stripe sign-in',
    desc: 'Payments, customers and subscriptions.',
    can: ['Look up payments and customers', 'Check subscription status'],
    ask: ['Issuing a refund'],
    never: ['Sending payouts'],
    changeCapable: true,
    // PROVENANCE: mcps.js key `stripe`. A.2 adds: "Change-capable actions need Leader
    // approval", which is CD-5's default for every connector in any case.
  },
  {
    key: 'notion',
    name: 'Notion',
    initials: 'N',
    firstPermission: 'read',
    tier: 'available',
    auth: 'Notion sign-in',
    desc: 'Read pages and add database entries.',
    can: ['Search pages', 'Add database entries'],
    ask: ['Editing a page someone else owns'],
    never: ['Deleting pages'],
    changeCapable: true,
    // PROVENANCE: mcps.js key `notion`.
  },
  {
    key: 'whatsapp',
    name: 'WhatsApp',
    initials: 'W',
    firstPermission: 'read',
    tier: 'unavailable',
    auth: 'WhatsApp Business sign-in',
    desc: 'Customer conversations over WhatsApp.',
    can: ['Read conversations'],
    ask: ['Replying to a customer'],
    never: ['Messaging a number that did not message first'],
    changeCapable: true,
    // PROVENANCE: PROPOSED copy, Appendix A.2 row. A.2 lists WhatsApp as "Not available --
    // Behind a switch until Meta approves" and gives no permission lists; the prototype has
    // no WhatsApp entry. The `unavailable` tier is what the screens key off, so the lists
    // are never reachable -- it renders disabled and cannot be assigned, exactly as
    // Intercom and Salesforce did. Shape borrowed from mcps.js key `intercom`.
  },
];

export const toolByKey = (key: string): Tool | undefined => TOOLS.find((t) => t.key === key);

export const toolName = (key: string): string => toolByKey(key)?.name ?? key;

/** Appendix A.2's WhatsApp row cannot be assigned to a teammate. */
export const isAssignable = (key: string): boolean => toolByKey(key)?.tier === 'available';
