import { randomUUID } from 'node:crypto';
import { afterAll, beforeEach, expect, test } from 'vitest';
import { cancelTimer, fireDueTimers, scheduleTimer } from '../src/timers.ts';
import { newWorkspace, testPrisma } from './helpers.ts';

const prisma = testPrisma();
afterAll(() => prisma.$disconnect());
beforeEach(() => prisma.timer.deleteMany());

const past = () => new Date(Date.now() - 1000);

test('schedule is idempotent on the dedupe key', async () => {
  const ws = await newWorkspace(prisma);
  const dedupeKey = `reminder:${randomUUID()}`;
  const a = await scheduleTimer(prisma, { workspaceId: ws.id, kind: 'reminder_2h', fireAt: past(), dedupeKey });
  const b = await scheduleTimer(prisma, { workspaceId: ws.id, kind: 'reminder_2h', fireAt: past(), dedupeKey });
  expect(b).toEqual({ id: a.id, created: false });
});

test('due timers fire once; future and cancelled timers do not', async () => {
  const ws = await newWorkspace(prisma);
  const due = await scheduleTimer(prisma, { workspaceId: ws.id, kind: 'void_72h', fireAt: past(), dedupeKey: randomUUID() });
  await scheduleTimer(prisma, { workspaceId: ws.id, kind: 'void_72h', fireAt: new Date(Date.now() + 60_000), dedupeKey: randomUUID() });
  const cancelledKey = randomUUID();
  await scheduleTimer(prisma, { workspaceId: ws.id, kind: 'void_72h', fireAt: past(), dedupeKey: cancelledKey });
  expect(await cancelTimer(prisma, cancelledKey)).toBe(true);

  const seen: string[] = [];
  const fired = await fireDueTimers(prisma, 10, async (_tx, timers) => {
    seen.push(...timers.map((t) => t.id));
  });
  expect(fired).toBe(1);
  expect(seen).toEqual([due.id]);
  expect(await fireDueTimers(prisma, 10, async () => {})).toBe(0);
});

test('an overdue timer fires after a restart (FD-4)', async () => {
  const ws = await newWorkspace(prisma);
  await scheduleTimer(prisma, { workspaceId: ws.id, kind: 'reminder_2h', fireAt: past(), dedupeKey: randomUUID() });
  await prisma.$disconnect();
  const restarted = testPrisma();
  expect(await fireDueTimers(restarted, 10, async () => {})).toBe(1);
  await restarted.$disconnect();
});

test('if the handler throws, the timers stay due', async () => {
  const ws = await newWorkspace(prisma);
  await scheduleTimer(prisma, { workspaceId: ws.id, kind: 'digest_daily', fireAt: past(), dedupeKey: randomUUID() });
  await expect(
    fireDueTimers(prisma, 10, async () => {
      throw new Error('boom');
    }),
  ).rejects.toThrow('boom');
  expect(await fireDueTimers(prisma, 10, async () => {})).toBe(1);
});
