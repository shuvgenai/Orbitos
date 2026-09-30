import { afterAll, expect, test } from 'vitest';
import { appendEvent, ensureMonthPartitions } from '../src/ledger.ts';
import { newWorkspace, testPrisma } from './helpers.ts';

const prisma = testPrisma();
afterAll(() => prisma.$disconnect());

async function partitionOf(workspaceId: string): Promise<string> {
  const rows = await prisma.$queryRaw<{ part: string }[]>`
    SELECT tableoid::regclass::text AS part FROM ledger.events WHERE workspace_id = ${workspaceId}::uuid`;
  return rows[0]!.part;
}

test('an event lands in its month partition', async () => {
  const ws = await newWorkspace(prisma);
  await appendEvent(prisma, {
    workspaceId: ws.id,
    type: 'email_received',
    actor: 'system',
    occurredAt: new Date('2026-10-15T12:00:00Z'),
    data: { source: 'gmail' },
  });
  expect(await partitionOf(ws.id)).toBe('ledger.events_2026_10');
});

test('events cannot be updated or deleted (DAT-1)', async () => {
  const ws = await newWorkspace(prisma);
  await appendEvent(prisma, {
    workspaceId: ws.id,
    type: 'ack_sent',
    actor: 'system',
    occurredAt: new Date('2026-10-15T00:00:00Z'),
  });
  await expect(
    prisma.$executeRaw`UPDATE ledger.events SET actor = 'x' WHERE workspace_id = ${ws.id}::uuid`,
  ).rejects.toThrow(/append-only/);
  await expect(
    prisma.$executeRaw`DELETE FROM ledger.events WHERE workspace_id = ${ws.id}::uuid`,
  ).rejects.toThrow(/append-only/);
  await expect(prisma.$executeRaw`TRUNCATE ledger.events`).rejects.toThrow(/append-only/);
});

test('an event in a month without a partition fails loudly', async () => {
  const ws = await newWorkspace(prisma);
  await expect(
    appendEvent(prisma, { workspaceId: ws.id, type: 'ack_sent', actor: 'system', occurredAt: new Date('2031-01-10T00:00:00Z') }),
  ).rejects.toThrow(/no partition/);
});

test('ensureMonthPartitions creates missing months and is idempotent', async () => {
  const ws = await newWorkspace(prisma);
  const from = new Date('2031-01-01T00:00:00Z');
  expect(await ensureMonthPartitions(prisma, from, 1)).toBe(3);
  expect(await ensureMonthPartitions(prisma, from, 1)).toBe(0);
  await appendEvent(prisma, { workspaceId: ws.id, type: 'ack_sent', actor: 'system', occurredAt: new Date('2031-01-10T00:00:00Z') });
  expect(await partitionOf(ws.id)).toBe('ledger.events_2031_01');
});

test('concurrent ensureMonthPartitions calls both succeed and create each partition once', async () => {
  const other = testPrisma();
  try {
    const from = new Date('2040-01-01T00:00:00Z');
    const [a, b] = await Promise.all([
      ensureMonthPartitions(prisma, from, 24),
      ensureMonthPartitions(other, from, 24),
    ]);
    expect(a + b).toBe(72);
    const rows = await prisma.$queryRaw<{ n: bigint }[]>`
      SELECT count(*) AS n FROM pg_class c JOIN pg_namespace ns ON ns.oid = c.relnamespace
      WHERE ns.nspname = 'ledger' AND c.relkind = 'r' AND c.relname ~ '_(2040|2041)_[0-9]{2}$'`;
    expect(Number(rows[0]!.n)).toBe(72);
  } finally {
    await other.$disconnect();
  }
});

test('the migration created twelve months for each ledger table', async () => {
  const rows = await prisma.$queryRaw<{ n: bigint }[]>`
    SELECT count(*) AS n FROM pg_inherits i
    JOIN pg_class c ON c.oid = i.inhrelid
    JOIN pg_namespace ns ON ns.oid = c.relnamespace
    WHERE ns.nspname = 'ledger' AND c.relname ~ '_20(26_(09|1[0-2])|27_0[1-8])$'`;
  expect(Number(rows[0]!.n)).toBe(36);
});
