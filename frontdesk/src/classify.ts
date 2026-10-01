import type { PrismaClient } from '@orbit/db/client';
import { logDecisionCall } from '@orbit/db/decision-calls';

// Anthropic ids are complete as written: no date suffix.
export const CLASSIFIER_MODEL = 'claude-haiku-4-5';
const TIMEOUT_MS = 15_000;
const ATTEMPTS = 2; // the first try plus exactly one retry

export type Verdict = 'lead' | 'not_lead' | 'unsure';

export interface ClassifierPort {
  ask(
    body: string,
    signal: AbortSignal,
  ): Promise<{
    verdict: Verdict;
    confidence: number | null;
    inputTokens: number;
    outputTokens: number;
    costUsd: number;
  }>;
}

export type ClassifyDeps = {
  prisma: PrismaClient;
  classifier: ClassifierPort;
  now: () => number;
  timeoutMs?: number;
};
export type LeadForClassify = { id: string; workspaceId: string; cleanBody: string };

type Answer = Awaited<ReturnType<ClassifierPort['ask']>>;

// Rejects when the signal fires, so a classifier that ignores the signal still cannot hang the poller.
function whenAborted(signal: AbortSignal): Promise<never> {
  return new Promise((_, reject) => {
    const fail = () => reject(Object.assign(new Error('classifier timed out'), { name: 'AbortError' }));
    if (signal.aborted) fail();
    else signal.addEventListener('abort', fail, { once: true });
  });
}

export async function classifyLead(deps: ClassifyDeps, lead: LeadForClassify): Promise<Verdict | 'failed'> {
  for (let attempt = 1; attempt <= ATTEMPTS; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), deps.timeoutMs ?? TIMEOUT_MS);
    const started = deps.now();
    let answer: Answer | undefined;
    try {
      answer = await Promise.race([deps.classifier.ask(lead.cleanBody, controller.signal), whenAborted(controller.signal)]);
    } catch {
      // Falls through to the failed log below. The error itself carries nothing we store.
    } finally {
      clearTimeout(timer);
      controller.abort(); // release anything still listening, e.g. an in-flight request
    }
    if (answer) {
      await logDecisionCall(deps.prisma, {
        workspaceId: lead.workspaceId,
        leadId: lead.id,
        model: CLASSIFIER_MODEL,
        outcome: answer.verdict,
        confidence: answer.confidence,
        inputTokens: answer.inputTokens,
        outputTokens: answer.outputTokens,
        costUsd: answer.costUsd,
        latencyMs: deps.now() - started,
      });
      return answer.verdict;
    }
    await logDecisionCall(deps.prisma, {
      workspaceId: lead.workspaceId,
      leadId: lead.id,
      model: CLASSIFIER_MODEL,
      outcome: 'failed',
      confidence: null,
      inputTokens: 0,
      outputTokens: 0,
      costUsd: 0,
      latencyMs: deps.now() - started,
    });
  }
  // FD-2: two failures mean no ack and no guess. The lead waits for Orbi, who arrives in
  // sub-project B; until then it rests at awaiting_verdict and the owner is alerted.
  return 'failed';
}
