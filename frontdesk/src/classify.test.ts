import { afterEach, expect, test, vi } from 'vitest';
import { CLASSIFIER_MODEL, classifyLead } from './classify.ts';

afterEach(() => vi.useRealTimers());

const lead = { id: 'l1', workspaceId: 'w1', cleanBody: 'Can you quote for an audit?' };

function makePrisma() {
  return { decisionCall: { create: vi.fn().mockResolvedValue({}) }, lead: { update: vi.fn() } };
}
const asPrisma = (p: ReturnType<typeof makePrisma>) => p as never;

function classifier(impl: unknown) {
  return { ask: vi.fn(impl as never) };
}

test('one question, one call, verdict returned', async () => {
  const prisma = makePrisma();
  const c = classifier(async () => ({ verdict: 'lead', confidence: 0.92, inputTokens: 800, outputTokens: 9, costUsd: 0.0008 }));
  const out = await classifyLead({ prisma: asPrisma(prisma), classifier: c, now: () => 0 }, lead);
  expect(out).toBe('lead');
  expect(c.ask).toHaveBeenCalledTimes(1);
});

test('a timeout is retried exactly once', async () => {
  const prisma = makePrisma();
  let calls = 0;
  const c = classifier(async () => {
    calls += 1;
    if (calls === 1) {
      throw Object.assign(new Error('aborted'), { name: 'AbortError' });
    }
    return { verdict: 'not_lead', confidence: 0.77, inputTokens: 700, outputTokens: 7, costUsd: 0.0007 };
  });
  const out = await classifyLead({ prisma: asPrisma(prisma), classifier: c, now: () => 0 }, lead);
  expect(out).toBe('not_lead');
  expect(c.ask).toHaveBeenCalledTimes(2);
});

test('two failures yield failed, never a guess', async () => {
  const prisma = makePrisma();
  const c = classifier(async () => {
    throw new Error('503 upstream');
  });
  const out = await classifyLead({ prisma: asPrisma(prisma), classifier: c, now: () => 0 }, lead);
  expect(out).toBe('failed');
  expect(c.ask).toHaveBeenCalledTimes(2);
});

test('every attempt is logged, including the failures', async () => {
  const prisma = makePrisma();
  const c = classifier(async () => {
    throw new Error('503 upstream');
  });
  await classifyLead({ prisma: asPrisma(prisma), classifier: c, now: () => 0 }, lead);
  expect(prisma.decisionCall.create).toHaveBeenCalledTimes(2);
  for (const [arg] of prisma.decisionCall.create.mock.calls as [{ data: Record<string, unknown> }][]) {
    expect(arg.data).toMatchObject({ outcome: 'failed', confidence: null, model: CLASSIFIER_MODEL, leadId: 'l1', workspaceId: 'w1' });
  }
});

test('a success logs its verdict, tokens, cost and fake-clock latency', async () => {
  const prisma = makePrisma();
  let t = 1000;
  const c = classifier(async () => {
    t += 640;
    return { verdict: 'unsure', confidence: 0.4, inputTokens: 800, outputTokens: 9, costUsd: 0.0008 };
  });
  await classifyLead({ prisma: asPrisma(prisma), classifier: c, now: () => t }, lead);
  const [arg] = prisma.decisionCall.create.mock.calls[0] as [{ data: Record<string, unknown> }];
  expect(arg.data).toMatchObject({ outcome: 'unsure', confidence: 0.4, inputTokens: 800, outputTokens: 9, costUsd: 0.0008, latencyMs: 640 });
  expect(CLASSIFIER_MODEL).toBe('claude-haiku-4-5');
});

test('the timeout aborts the signal, and a call that ignores it is still cut off', async () => {
  vi.useFakeTimers();
  const prisma = makePrisma();
  const abortedAtCall: boolean[] = [];
  const c = classifier(async (_b: string, signal: AbortSignal) => {
    abortedAtCall.push(signal.aborted); // read now: finally aborts every controller afterwards
    return new Promise(() => {}); // never settles, ignores the signal
  });
  const pending = classifyLead({ prisma: asPrisma(prisma), classifier: c, now: () => Date.now(), timeoutMs: 15_000 }, lead);
  await vi.advanceTimersByTimeAsync(15_000);
  await vi.advanceTimersByTimeAsync(15_000);
  expect(await pending).toBe('failed');
  expect(c.ask).toHaveBeenCalledTimes(2);
  // A reused controller would already be aborted when attempt 2 starts.
  expect(abortedAtCall).toEqual([false, false]);
  expect(prisma.decisionCall.create).toHaveBeenCalledTimes(2);
});

test('a failed attempt logs its fake-clock latency', async () => {
  const prisma = makePrisma();
  let t = 5000;
  const c = classifier(async () => {
    t += 250;
    throw new Error('503 upstream');
  });
  await classifyLead({ prisma: asPrisma(prisma), classifier: c, now: () => t }, lead);
  for (const [arg] of prisma.decisionCall.create.mock.calls as [{ data: Record<string, unknown> }][]) {
    expect(arg.data).toMatchObject({ outcome: 'failed', latencyMs: 250 });
  }
});

test('if logging the first failure throws, classifyLead propagates and does not retry', async () => {
  const prisma = makePrisma();
  prisma.decisionCall.create.mockRejectedValueOnce(new Error('db down'));
  const c = classifier(async () => {
    throw new Error('503 upstream');
  });
  await expect(classifyLead({ prisma: asPrisma(prisma), classifier: c, now: () => 0 }, lead)).rejects.toThrow('db down');
  expect(c.ask).toHaveBeenCalledTimes(1);
  expect(prisma.decisionCall.create).toHaveBeenCalledTimes(1);
});
