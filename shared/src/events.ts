// DAT-1 event types. Receipts, audit views, rollups and exports are projections of these.
export const EVENT_TYPES = [
  'email_received',
  'ack_sent',
  'issue_created',
  'draft_delivered',
  'orbi_verdict',
  'decision_recorded',
  'message_sent',
  'auto_ack_switched_off',
  'budget_warning',
  'upgrade_applied',
] as const;
export type EventType = (typeof EVENT_TYPES)[number];
