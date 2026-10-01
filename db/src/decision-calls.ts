import type { PrismaClient } from './client.ts';

export type DecisionCallInput = {
  workspaceId: string;
  leadId?: string;
  model: string;
  outcome: 'lead' | 'not_lead' | 'unsure' | 'failed';
  // A failed call has no confidence.
  confidence?: number | null;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  latencyMs: number;
};

export function logDecisionCall(prisma: PrismaClient, call: DecisionCallInput) {
  return prisma.decisionCall.create({
    data: {
      workspaceId: call.workspaceId,
      leadId: call.leadId ?? null,
      model: call.model,
      outcome: call.outcome,
      confidence: call.confidence ?? null,
      inputTokens: call.inputTokens,
      outputTokens: call.outputTokens,
      costUsd: call.costUsd,
      latencyMs: call.latencyMs,
    },
  });
}
