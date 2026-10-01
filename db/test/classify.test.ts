import { afterAll, expect, test } from 'vitest';
import { logDecisionCall } from '../src/decision-calls.ts';
import { newWorkspace, testPrisma } from './helpers.ts';

const prisma = testPrisma();
afterAll(() => prisma.$disconnect());

test('a logged call is readable with its cost and latency', async () => {
  const ws = await newWorkspace(prisma);
  await logDecisionCall(prisma, {
    workspaceId: ws.id,
    model: 'claude-haiku-4-5',
    outcome: 'unsure',
    confidence: 0.41,
    inputTokens: 900,
    outputTokens: 10,
    costUsd: 0.001,
    latencyMs: 1200,
  });
  const row = await prisma.decisionCall.findFirstOrThrow({ where: { workspaceId: ws.id } });
  expect(row.outcome).toBe('unsure');
  expect(row.latencyMs).toBe(1200);
  expect(Number(row.costUsd)).toBeCloseTo(0.001);
});

test('a failed call logs no confidence', async () => {
  const ws = await newWorkspace(prisma);
  await logDecisionCall(prisma, {
    workspaceId: ws.id,
    model: 'claude-haiku-4-5',
    outcome: 'failed',
    confidence: null,
    inputTokens: 0,
    outputTokens: 0,
    costUsd: 0,
    latencyMs: 15000,
  });
  const row = await prisma.decisionCall.findFirstOrThrow({ where: { workspaceId: ws.id } });
  expect(row.outcome).toBe('failed');
  expect(row.confidence).toBeNull();
});
