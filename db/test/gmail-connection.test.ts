import { afterAll, expect, test } from 'vitest';
import { newWorkspace, testPrisma } from './helpers.ts';

const prisma = testPrisma();
afterAll(() => prisma.$disconnect());

test('a workspace holds exactly one Gmail connection', async () => {
  const ws = await newWorkspace(prisma);
  await prisma.gmailConnection.create({
    data: {
      workspaceId: ws.id,
      emailAddress: 'owner@example.com',
      refreshTokenCipher: 'ciphertext',
      historyId: '12345',
    },
  });
  const again = prisma.gmailConnection.create({
    data: {
      workspaceId: ws.id,
      emailAddress: 'other@example.com',
      refreshTokenCipher: 'ciphertext',
      historyId: '1',
    },
  });
  await expect(again).rejects.toMatchObject({ code: 'P2002' });
});

test('a connection starts connected and records no check yet', async () => {
  const ws = await newWorkspace(prisma);
  const c = await prisma.gmailConnection.create({
    data: {
      workspaceId: ws.id,
      emailAddress: 'owner@example.com',
      refreshTokenCipher: 'ciphertext',
      historyId: '7',
    },
  });
  expect(c.state).toBe('connected');
  expect(c.lastCheckedAt).toBeNull();
});

test('a decision call records its cost and outcome', async () => {
  const ws = await newWorkspace(prisma);
  const call = await prisma.decisionCall.create({
    data: {
      workspaceId: ws.id,
      model: 'claude-haiku-4-5-20251001',
      outcome: 'lead',
      confidence: 0.91,
      inputTokens: 820,
      outputTokens: 12,
      costUsd: 0.0009,
      latencyMs: 640,
    },
  });
  expect(call.outcome).toBe('lead');
  expect(Number(call.costUsd)).toBeCloseTo(0.0009);
});
