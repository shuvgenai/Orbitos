import { afterAll, expect, test, vi } from 'vitest';
import { verifyApprovalLink } from '@orbit/shared/approval-link';
import { sendNotice } from '../../frontdesk/src/notice.ts';
import { newApproval, newWorkspace, testPrisma, withOwner } from './helpers.ts';

const prisma = testPrisma();
afterAll(() => prisma.$disconnect());

const BASE = 'https://orbit.example';

test('the notice names no lead detail and carries the link (NTC-1)', async () => {
  const ws = await newWorkspace(prisma);
  await withOwner(prisma, ws.id, 'owner@example.com');
  const approval = await newApproval(prisma, ws.id);
  const mailer = { send: vi.fn().mockResolvedValue(undefined) };

  await sendNotice({ prisma, mailer, baseUrl: BASE, secret: 's' }, approval.id);

  const sent = mailer.send.mock.calls[0]![0];
  expect(sent.to).toBe('owner@example.com');
  expect(`${sent.subject} ${sent.text}`).not.toContain('maya@example.com');
  expect(`${sent.subject} ${sent.text}`).not.toContain('Hi Maya');
  expect(sent.text).toContain('https://orbit.example/c/');
});

test('nothing about the lead or the draft reaches the subject or body, whatever their values', async () => {
  const ws = await newWorkspace(prisma);
  await withOwner(prisma, ws.id, 'owner2@example.com');
  const approval = await newApproval(prisma, ws.id);
  const lead = await prisma.lead.update({
    where: { id: approval.leadId },
    data: {
      fromName: 'Zephyrine Quillfeather',
      fromEmail: 'zq-distinct@lead-co.example',
      subject: 'Glorbnax retainer enquiry',
    },
  });
  await prisma.approval.update({
    where: { id: approval.id },
    data: { draftText: 'Zorblax pricing is 4417 dollars', reason: 'Wants the Zorblax quote' },
  });
  const mailer = { send: vi.fn().mockResolvedValue(undefined) };

  await sendNotice({ prisma, mailer, baseUrl: BASE, secret: 's' }, approval.id);

  const sent = mailer.send.mock.calls[0]![0];
  const everything = `${sent.to}\n${sent.subject}\n${sent.text}`;
  const forbidden = [
    'Zephyrine',
    'Quillfeather',
    'zq-distinct',
    'lead-co',
    'Glorbnax',
    'Zorblax',
    '4417',
    lead.id,
  ];
  for (const piece of forbidden) expect(everything).not.toContain(piece);
});

test('the link verifies to this approval and expires when the approval does', async () => {
  const ws = await newWorkspace(prisma);
  await withOwner(prisma, ws.id, 'owner3@example.com');
  const approval = await newApproval(prisma, ws.id);
  const mailer = { send: vi.fn().mockResolvedValue(undefined) };

  await sendNotice({ prisma, mailer, baseUrl: BASE, secret: 's' }, approval.id);

  const token = mailer.send.mock.calls[0]![0].text.match(/\/c\/(\S+)/)![1] as string;
  expect(verifyApprovalLink(token, 's', new Date())).toEqual({ ok: true, approvalId: approval.id });
  expect(verifyApprovalLink(token, 's', new Date(approval.expiresAt.getTime() + 1))).toEqual({
    ok: false,
    reason: 'expired',
  });
});

test('no notice is sent for an approval that is no longer waiting', async () => {
  const ws = await newWorkspace(prisma);
  await withOwner(prisma, ws.id, 'owner4@example.com');
  const approval = await newApproval(prisma, ws.id, 'void');
  const mailer = { send: vi.fn().mockResolvedValue(undefined) };

  await sendNotice({ prisma, mailer, baseUrl: BASE, secret: 's' }, approval.id);

  expect(mailer.send).not.toHaveBeenCalled();
});
