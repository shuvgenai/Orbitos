import { afterAll, expect, test } from 'vitest';
import { APPROVAL_STATES, canTransition, type ApprovalState } from '@orbit/shared/approvals';
import { transitionApproval } from '../src/approvals.ts';
import { newApproval, newWorkspace, testPrisma } from './helpers.ts';

const prisma = testPrisma();
afterAll(() => prisma.$disconnect());

test('the database trigger agrees with the shared transition table', async () => {
  const ws = await newWorkspace(prisma);
  for (const from of APPROVAL_STATES) {
    for (const to of APPROVAL_STATES) {
      if (from === to) continue;
      const a = await newApproval(prisma, ws.id, from);
      const attempt = prisma.$executeRaw`UPDATE approvals SET state = ${to}::approval_state WHERE id = ${a.id}::uuid`;
      if (canTransition(from, to)) {
        await expect(attempt, `${from} -> ${to}`).resolves.toBe(1);
      } else {
        await expect(attempt, `${from} -> ${to}`).rejects.toThrow(/invalid approval transition/);
      }
    }
  }
});

test('transitionApproval moves the row and stamps sending_at', async () => {
  const ws = await newWorkspace(prisma);
  const a = await newApproval(prisma, ws.id);
  expect(await transitionApproval(prisma, a.id, 'issued', 'sending')).toBe(true);
  const row = await prisma.approval.findUniqueOrThrow({ where: { id: a.id } });
  expect(row.state).toBe('sending');
  expect(row.sendingAt).toBeInstanceOf(Date);
});

test('transitionApproval returns false when the row is no longer in the from-state', async () => {
  const ws = await newWorkspace(prisma);
  const a = await newApproval(prisma, ws.id, 'void');
  expect(await transitionApproval(prisma, a.id, 'issued', 'sending')).toBe(false);
});

test('transitionApproval throws on a forbidden transition', async () => {
  const ws = await newWorkspace(prisma);
  const a = await newApproval(prisma, ws.id, 'sent');
  await expect(transitionApproval(prisma, a.id, 'sent', 'sending')).rejects.toThrow(/sent -> sending/);
});

test('transitionApproval fails clearly on an unknown from-state instead of a TypeError', async () => {
  const ws = await newWorkspace(prisma);
  const a = await newApproval(prisma, ws.id);
  const bogus = 'archived' as ApprovalState;
  const err = await transitionApproval(prisma, a.id, bogus, 'sending').catch((e: unknown) => e);
  expect(err).toBeInstanceOf(Error);
  expect(err).not.toBeInstanceOf(TypeError);
  expect((err as Error).message).toMatch(/unknown approval state "archived"/i);
});

test('concurrent issued→sending: exactly one wins', async () => {
  const ws = await newWorkspace(prisma);
  const a = await newApproval(prisma, ws.id);
  const results = await Promise.all(
    Array.from({ length: 5 }, () => transitionApproval(prisma, a.id, 'issued', 'sending')),
  );
  expect(results.filter(Boolean)).toHaveLength(1);
});
