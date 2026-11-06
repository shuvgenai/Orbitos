import { z } from 'zod';

/**
 * Types are inferred from these schemas; nothing re-declares them by hand.
 *
 * Where this differs from the Build Prompts' shared spec, the difference is a founder
 * decision and is listed in docs/spec-errata.md:
 *   - Authority has four members, matching orbitcrew.authority  (FD-22, errata E-1)
 *   - AccessRole has three, matching orbitcrew.access_role      (FD-22)
 *   - budget is Appendix A.5's three numbers, not one           (FD-18/FD-25, errata E-2)
 *   - Connection carries per-connector limits (C-11)            (errata E-20)
 *   - Receipt / AuditEntry / FleetOffice exist at all           (docs/plan.md 4-C1)
 *   - the runtime block lives in ./fleet, not here              (docs/plan.md 4-F3)
 */

/* ------------------------------------------------------------------ people and offices */

/** Matches `orbitcrew.access_role` in migration 0002: ('user','admin','super'). */
export const accessRoleSchema = z.enum(['user', 'admin', 'super']);

/**
 * A person inside an office is only ever `user` or `admin`. A super admin has no org_id
 * (migration 0010, `super_has_no_org`), so they are never a row in an office's people list.
 */
export const officeAccessSchema = z.enum(['user', 'admin']);

/** Matches `orbitcrew.authority` in migration 0002. FD-22; `backup` is "Backup approver". */
export const authoritySchema = z.enum(['leader', 'approver', 'backup', 'budget']);

export const AUTHORITY_LABELS: Record<Authority, string> = {
  leader: 'Leader',
  approver: 'Approver',
  backup: 'Backup approver',
  budget: 'Budget holder',
};

export const departmentSchema = z.object({
  id: z.string(),
  name: z.string(),
});

export const personSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  title: z.string(),
  deptId: z.string().nullable(),
  access: officeAccessSchema,
  authorities: z.array(authoritySchema),
  invited: z.boolean().optional(),
});

/* ------------------------------------------------------------------------ AI teammates */

export const agentTypeSchema = z.enum(['coordinator', 'specialist']);

export const agentStatusSchema = z.enum([
  'draft',
  'running',
  'waiting',
  'idle',
  'paused',
  'blocked',
]);

/**
 * Why an agent is paused, as data rather than as display text.
 *
 * The prototype stored the reason only inside the `doing` sentence and sniffed it with
 * /to be connected/, so a tool disconnect-then-reconnect silently discarded a pause a
 * person had applied -- reproduced at runtime, docs/plan.md 4-B3. `null` means not paused.
 */
export const pausedBySchema = z.enum(['user', 'tool', 'budget']).nullable();

/** PRD Appendix A.5: three numbers per teammate. FD-18, FD-25. */
export const budgetSchema = z.object({
  monthlyUsd: z.number().positive(),
  dailyCheapCheckUsd: z.number().positive(),
  turnLimit: z.number().int().positive(),
});

export const agentVersionSchema = z.object({
  v: z.number().int(),
  prompt: z.string(),
  at: z.number(),
  by: z.string(),
});

export const agentPerfSchema = z.object({
  daily: z.array(z.number()).length(7),
  success: z.number(),
  avgSec: z.number(),
  edited: z.number(),
  cost7: z.number(),
});

export const agentSchema = z.object({
  id: z.string(),
  roleId: z.string().nullable(),
  name: z.string(),
  job: z.string(),
  type: agentTypeSchema,
  deptId: z.string().nullable(),
  managerId: z.string().nullable(),
  ownerId: z.string().nullable(),
  status: agentStatusSchema,
  pausedBy: pausedBySchema,
  doing: z.string(),
  prompt: z.string(),
  version: z.number().int(),
  versions: z.array(agentVersionSchema),
  guardrails: z.array(z.string()),
  tools: z.array(z.string()),
  budget: budgetSchema,
  runsToday: z.number(),
  costToday: z.number(),
  lastActive: z.number(),
  provisioned: z.boolean(),
  /**
   * An opaque reference minted at provision time, or null before launch.
   *
   * The operator-visible profile and adapter names are composed from it in
   * src/shared/seeds/fleet-runtime.ts, which only the fleet entry imports. Storing the
   * composed names here would put `hermes_gateway` and the key name `adapterKey` in every
   * bundle, because the mock mints them and the mock is shared -- docs/plan.md 4-F3.
   */
  runtimeRef: z.string().nullable(),
  blockedBy: z.array(z.string()).optional(),
  perf: agentPerfSchema,
});

/**
 * A patch. The prototype had one `createAgent(spec)` doing create-and-update with a full
 * Object.assign, so any field the caller omitted was reset to its default -- jobId and
 * deptId both observed going null at runtime (docs/plan.md 4-B2). Prompt 1 item 5 lists
 * `create` and `update` separately, and this is why that split matters.
 */
export const agentPatchSchema = agentSchema
  .pick({
    name: true,
    job: true,
    deptId: true,
    managerId: true,
    prompt: true,
    tools: true,
    budget: true,
  })
  .partial();

/** What the agent drawer holds while being filled in. */
export const agentDraftSchema = z.object({
  id: z.string().nullable(),
  type: agentTypeSchema,
  roleId: z.string().nullable(),
  name: z.string(),
  job: z.string(),
  deptId: z.string().nullable(),
  managerId: z.string().nullable(),
  prompt: z.string(),
  tools: z.array(z.string()),
  budget: budgetSchema,
});

/* ----------------------------------------------------------------------- connectors */

/** Appendix A.2's first permission is read-only for every connector. */
export const toolModeSchema = z.enum(['read', 'draft', 'act']);

export const TOOL_MODE_LABELS: Record<ToolMode, string> = {
  read: 'Read only',
  draft: 'Read and prepare drafts',
  act: 'Read and act, with approval',
};

/** `unavailable` is Appendix A.2's WhatsApp row: behind a switch until Meta approves. */
export const toolTierSchema = z.enum(['available', 'unavailable']);

export const toolSchema = z.object({
  key: z.string(),
  name: z.string(),
  initials: z.string(),
  firstPermission: toolModeSchema,
  tier: toolTierSchema,
  auth: z.string(),
  desc: z.string(),
  can: z.array(z.string()),
  ask: z.array(z.string()),
  never: z.array(z.string()),
  /** CD-5's safe default: every change-capable connector needs a Leader approval. */
  changeCapable: z.boolean(),
});

/** C-11 / CD-3 safe default: a connector has its own budget, so the limits live here. */
export const connectionLimitsSchema = z.object({
  dailyCalls: z.number().int().positive(),
  dailyCostUsd: z.number().positive(),
});

export const connectionSchema = z.object({
  on: z.boolean(),
  mode: toolModeSchema,
  at: z.number(),
  by: z.string(),
  limits: connectionLimitsSchema,
});

/* ------------------------------------------------------------------------- requests */

export const requestStatusSchema = z.enum(['pending', 'approved', 'changes', 'rejected']);

export const agentRequestSchema = z.object({
  id: z.string(),
  by: z.string(),
  name: z.string(),
  purpose: z.string(),
  prompt: z.string(),
  tools: z.array(z.string()),
  reason: z.string(),
  status: requestStatusSchema,
  adminNote: z.string(),
  at: z.number(),
});

export const requestFormSchema = z.object({
  name: z.string().min(2, 'Give the agent a name.'),
  purpose: z.string().min(1, 'Describe its job in one line.'),
  prompt: z.string().min(20, 'Write at least 20 characters of instructions.'),
  tools: z.array(z.string()),
  reason: z.string().min(1, 'Tell your admin why this helps.'),
});

export const decisionSchema = z.object({
  prompt: z.string(),
  guards: z.array(z.string()),
  note: z.string(),
});

/* --------------------------------------------------------------------------- launch */

export const launchStepStatusSchema = z.enum(['pending', 'run', 'done', 'fail']);

export const launchStepSchema = z.object({
  k: z.string(),
  label: z.string(),
  status: launchStepStatusSchema,
});

export const launchJobSchema = z.object({
  steps: z.array(launchStepSchema),
  simFail: z.boolean(),
  failedOnce: z.boolean(),
  error: z.string(),
  done: z.boolean(),
});

/* ------------------------------------------------------------- receipts and the audit */

/**
 * An activity receipt. The shared spec's type list omits it even though the whole User
 * Activity screen renders it -- docs/plan.md 4-C1. Shape from assets/data/tasks.js.
 */
export const receiptSchema = z.object({
  id: z.string(),
  t: z.number(),
  agentId: z.string(),
  title: z.string(),
  status: z.enum(['waiting', 'done']),
  why: z.string(),
  cost: z.number(),
  dur: z.number(),
});

/** The Org Admin "Recent changes" list. Also omitted by the shared spec. */
export const auditEntrySchema = z.object({
  at: z.number(),
  who: z.string(),
  what: z.string(),
});

/* --------------------------------------------------------------------------- office */

export const officeSchema = z.object({
  name: z.string(),
  domain: z.string(),
  template: z.string().nullable(),
  step: z.number().int().min(1).max(5),
  launched: z.boolean(),
  connectLater: z.boolean(),
  guardrails: z.array(z.string()),
  job: launchJobSchema.nullable(),
});

export const orgTemplateSchema = z.object({
  id: z.string(),
  name: z.string(),
  depts: z.array(z.string()),
});

export const sessionSchema = z.object({
  userId: z.string().nullable(),
});

/* ------------------------------------------------------------------ the whole document */

export const storeStateSchema = z.object({
  v: z.number().int(),
  org: officeSchema,
  departments: z.array(departmentSchema),
  people: z.array(personSchema),
  agents: z.array(agentSchema),
  requests: z.array(agentRequestSchema),
  connections: z.record(z.string(), connectionSchema),
  activity: z.array(receiptSchema),
  audit: z.array(auditEntrySchema),
  session: sessionSchema,
  fleet: z.array(z.unknown()).optional(),
});

/* ---------------------------------------------------------------------------- types */

export type AccessRole = z.infer<typeof accessRoleSchema>;
export type OfficeAccess = z.infer<typeof officeAccessSchema>;
export type Authority = z.infer<typeof authoritySchema>;
export type Department = z.infer<typeof departmentSchema>;
export type Person = z.infer<typeof personSchema>;
export type AgentType = z.infer<typeof agentTypeSchema>;
export type AgentStatus = z.infer<typeof agentStatusSchema>;
export type PausedBy = z.infer<typeof pausedBySchema>;
export type Budget = z.infer<typeof budgetSchema>;
export type AgentVersion = z.infer<typeof agentVersionSchema>;
export type AgentPerf = z.infer<typeof agentPerfSchema>;
export type Agent = z.infer<typeof agentSchema>;
export type AgentPatch = z.infer<typeof agentPatchSchema>;
export type AgentDraft = z.infer<typeof agentDraftSchema>;
export type ToolMode = z.infer<typeof toolModeSchema>;
export type ToolTier = z.infer<typeof toolTierSchema>;
export type Tool = z.infer<typeof toolSchema>;
export type ConnectionLimits = z.infer<typeof connectionLimitsSchema>;
export type Connection = z.infer<typeof connectionSchema>;
export type RequestStatus = z.infer<typeof requestStatusSchema>;
export type AgentRequest = z.infer<typeof agentRequestSchema>;
export type RequestForm = z.infer<typeof requestFormSchema>;
export type Decision = z.infer<typeof decisionSchema>;
export type LaunchStepStatus = z.infer<typeof launchStepStatusSchema>;
export type LaunchStep = z.infer<typeof launchStepSchema>;
export type LaunchJob = z.infer<typeof launchJobSchema>;
export type Receipt = z.infer<typeof receiptSchema>;
export type AuditEntry = z.infer<typeof auditEntrySchema>;
export type Office = z.infer<typeof officeSchema>;
export type OrgTemplate = z.infer<typeof orgTemplateSchema>;
export type Session = z.infer<typeof sessionSchema>;
export type StoreState = z.infer<typeof storeStateSchema>;
