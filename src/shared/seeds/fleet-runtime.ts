import type { Agent } from '@/shared/schemas';
import type { AgentRuntime } from '@/shared/schemas/fleet';

/**
 * Operator-visible runtime names. IMPORTED BY THE FLEET ENTRY ONLY.
 *
 * PRD 15.3 exempts the fleet console and bans upstream names from the customer surfaces,
 * and Prompt 5's acceptance test greps the user and org-admin bundles for "Paperclip",
 * "Hermes" and "adapter". Isolating the schema was not enough on its own: MockApiClient
 * generated these values at provision time, and the mock ships in all three bundles, so
 * `hermes_gateway` and the key name `adapterKey` were both landing in a shared chunk --
 * measured in dist, not assumed (docs/plan.md 4-F3, leak 2).
 *
 * So the mock now stores only an opaque `runtimeRef` and this module composes the rest.
 * If anything here is ever imported from src/apps/user or src/apps/org-admin, the bundle
 * check in Prompt 6 fails, which is the point.
 *
 * NOTE for whoever owns this field: the prototype's value is `hermes_gateway`, but the
 * infra repo documents the real adapter registry key as `hermes_local` and records it
 * appearing 35 times in the running build. `hermes_gateway` looks like invented display
 * text rather than the key, which would mean the console shows an adapter that does not
 * exist. The prototype's value is carried unchanged because changing it is not Prompt 1's
 * call; raised in docs/plan.md 4-F3.
 */
export const ADAPTER_KEY = 'hermes_gateway';

/** `null` before launch, which is what the Office screen shows as "not created". */
export function runtimeOf(officeName: string, agent: Agent): AgentRuntime | null {
  if (!agent.runtimeRef) return null;
  const prefix = officeName.split(' ')[0]?.toLowerCase() ?? 'office';
  return {
    runtimeAgentId: agent.runtimeRef,
    runtimeProfile: `${prefix}-${agent.name.toLowerCase().replace(/\s+/g, '-')}`,
    adapterKey: ADAPTER_KEY,
  };
}
