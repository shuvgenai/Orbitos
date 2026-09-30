import { afterAll, expect, test } from 'vitest';
import { newApproval, newLead, newWorkspace, testPrisma } from './helpers.ts';

const prisma = testPrisma();
afterAll(() => prisma.$disconnect());

test('a duplicate Message-ID in one workspace is rejected (FD-1 dedupe)', async () => {
  const ws = await newWorkspace(prisma);
  const lead = await newLead(prisma, ws.id);
  await expect(
    prisma.lead.create({
      data: {
        workspaceId: ws.id,
        messageId: lead.messageId,
        gmailMessageId: 'other',
        gmailThreadId: 'other',
        fromEmail: 'maya@example.com',
        subject: 'Audit quote',
        receivedAt: new Date(),
      },
    }),
  ).rejects.toMatchObject({ code: 'P2002' });
});

test('uppercase addresses are rejected', async () => {
  const ws = await newWorkspace(prisma);
  await expect(
    prisma.contact.create({
      data: { workspaceId: ws.id, email: 'Maya@Example.com', firstSeenAt: new Date(), lastSeenAt: new Date() },
    }),
  ).rejects.toThrow(/contacts_email_lowercase/);
});

test('a second decision on the same approval is rejected (AUTH-10)', async () => {
  const ws = await newWorkspace(prisma);
  const user = await prisma.user.create({ data: { workspaceId: ws.id, email: 'owner@firm.example' } });
  const approval = await newApproval(prisma, ws.id);
  const decide = () =>
    prisma.decision.create({
      data: { approvalId: approval.id, userId: user.id, authorityUsed: 'approve_routine', action: 'send' },
    });
  await decide();
  await expect(decide()).rejects.toMatchObject({ code: 'P2002' });
});

test('retention defaults are seeded (DAT-3)', async () => {
  const rows = await prisma.retentionPolicy.findMany({ orderBy: { dataClass: 'asc' } });
  expect(rows.map((r) => [r.dataClass, r.keepDays, r.method])).toEqual([
    ['backups', 30, 'file_delete'],
    ['hermes_sessions', 90, 'file_delete'],
    ['ledger_events', 730, 'partition_drop'],
    ['raw_email_bodies', 90, 'purge'],
    ['receipts', null, 'keep'],
  ]);
});
