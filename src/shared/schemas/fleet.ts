import { z } from 'zod';

/**
 * Fleet-only schemas.
 *
 * `provisionInputSchema` USED TO LIVE HERE AND MUST NOT COME BACK. The mock validates it, the
 * mock ships in all three bundles, and importing a runtime Zod value out of this file drags
 * `adapterKey` -- a real key name, kept at runtime -- into a chunk the customer entries load.
 * That is not hypothetical: it happened, and `customer-surface.test.ts` failed on
 * `nav-*.js: adapter`. It now lives in ./provision.ts, which carries no such word.
 *
 * Fleet-only schemas. Imported by src/apps/fleet and by the fleet half of the mock, and by
 * nothing the customer apps import.
 *
 * That isolation is the point. PRD 15.3 exempts the fleet console and bans upstream names
 * from the customer surfaces, and Prompt 5's acceptance test greps the user and org-admin
 * bundles for "Paperclip", "Hermes" and "adapter". A Zod object keeps its key names at
 * runtime, so a runtime block declared in schemas/index.ts would put those literals in all
 * three bundles and tree-shaking could not remove them -- docs/plan.md 4-F3.
 *
 * The field NAMES here are ours, so they avoid upstream words: the infra CLAUDE.md rule is
 * "OrbitCrew code never uses an upstream name as an identifier -- write OrchestratorClient,
 * never PaperclipClient". The VALUES are upstream's and are never rewritten.
 */

export const agentRuntimeSchema = z.object({
  /** Upstream's own agent id. The value is upstream's; the field name is ours. */
  runtimeAgentId: z.string(),
  /** The isolated runtime profile this teammate is reached through. */
  runtimeProfile: z.string(),
  /** The adapter registry key. See the note in src/shared/seeds/fleet-runtime.ts. */
  adapterKey: z.string(),
});

export const fleetStatusSchema = z.enum(['live', 'onboarding', 'awaiting']);

export const FLEET_STATUS_LABELS: Record<FleetStatus, string> = {
  live: 'Live',
  onboarding: 'Org Admin onboarding',
  awaiting: 'Awaiting onboarding',
};

export const healthSchema = z.enum(['ok', 'warn']);

/**
 * A row in the operator registry. This is NOT the `Office` in schemas/index.ts -- that one
 * is a customer's own office. The shared spec's type list has neither -- docs/plan.md 4-C1.
 */
export const fleetOfficeSchema = z.object({
  id: z.string(),
  name: z.string(),
  domain: z.string(),
  status: fleetStatusSchema,
  agents: z.number().int(),
  cost: z.number(),
  version: z.string(),
  health: healthSchema,
  admin: z.string(),
});


export const provisionJobSchema = z.object({
  i: z.number().int(),
  name: z.string(),
  domain: z.string(),
  email: z.string(),
  done: z.boolean(),
});

export type AgentRuntime = z.infer<typeof agentRuntimeSchema>;
export type FleetStatus = z.infer<typeof fleetStatusSchema>;
export type Health = z.infer<typeof healthSchema>;
export type FleetOffice = z.infer<typeof fleetOfficeSchema>;
export type ProvisionJob = z.infer<typeof provisionJobSchema>;
