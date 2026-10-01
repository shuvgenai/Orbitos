import { afterAll, expect, test, vi } from 'vitest';
import { FakeGmail } from '@orbit/shared/gmail/fake';
import { signApprovalLink } from '@orbit/shared/approval-link';
import { handleConfirmGet, handleConfirmPost } from '../../api/src/confirm.ts';
import { newApproval, newWorkspace, testPrisma, withOwner } from './helpers.ts';

const prisma = testPrisma();
afterAll(() => prisma.$disconnect());
const SECRET = 's';

async function fixture(overrides: { expiresAt?: Date; subject?: string } = {}) {
  const ws = await newWorkspace(prisma);
  const owner = await withOwner(prisma, ws.id, 'owner@example.com');
  const approval = await newApproval(prisma, ws.id);
  if (overrides.expiresAt) {
    await prisma.approval.update({ where: { id: approval.id }, data: { expiresAt: overrides.expiresAt } });
  }
  const token = signApprovalLink({ approvalId: approval.id, expiresAt: new Date(Date.now() + 3600_000), secret: SECRET });
  const gmail = new FakeGmail({ historyId: '1' });
  const deps = { prisma, gmail, secret: SECRET, requireSession: async () => ({ userId: owner.id, freshAt: new Date() }) };
  return { ws, owner, approval, token, gmail, deps };
}

// FakeGmail records the raw message base64url-encoded, as it goes on the wire.
const decode = (raw: string) => Buffer.from(raw, 'base64url').toString('utf8');

test('a GET renders the draft and sends nothing', async () => {
  const { token, deps, gmail } = await fixture();
  const out = await handleConfirmGet(deps, token, {} as never);
  expect(out.view).toBe('draft');
  expect(gmail.sent).toHaveLength(0);
});

test('without a session the page asks for sign-in and sends nothing', async () => {
  const { token, deps, gmail } = await fixture();
  const out = await handleConfirmPost({ ...deps, requireSession: async () => null }, token, {} as never, 'send');
  expect(out.view).toBe('needs_sign_in');
  expect(gmail.sent).toHaveLength(0);
});

test('a POST sends in thread, records the decision and marks the approval sent', async () => {
  const { token, deps, gmail, approval, owner } = await fixture();
  const out = await handleConfirmPost(deps, token, {} as never, 'send');
  expect(out.view).toBe('sent');
  expect(gmail.sent).toHaveLength(1);
  const after = await prisma.approval.findUniqueOrThrow({ where: { id: approval.id } });
  expect(after.state).toBe('sent');
  expect(after.gmailMessageId).toBe(gmail.sent[0]!.gmailMessageId);
  const decision = await prisma.decision.findUniqueOrThrow({ where: { approvalId: approval.id } });
  expect(decision.userId).toBe(owner.id);
  expect(decision.action).toBe('send');
});

test('the second press sees already decided and sends once (AUTH-10)', async () => {
  const { token, deps, gmail } = await fixture();
  await handleConfirmPost(deps, token, {} as never, 'send');
  const second = await handleConfirmPost(deps, token, {} as never, 'send');
  expect(second.view).toBe('already_decided');
  expect(gmail.sent).toHaveLength(1);
});

test('an edit stores both texts and sends the edited one', async () => {
  const { token, deps, gmail, approval } = await fixture();
  await handleConfirmPost(deps, token, {} as never, 'send_edited', 'My own words.');
  const decision = await prisma.decision.findUniqueOrThrow({ where: { approvalId: approval.id } });
  const stored = await prisma.approval.findUniqueOrThrow({ where: { id: approval.id } });
  expect(decision.finalText).toBe('My own words.');
  expect(stored.draftText).not.toBe('My own words.');
  expect(decode(gmail.sent[0]!.raw)).toContain('My own words.');
});

test('an approval that expired since the page rendered refuses to send', async () => {
  const { token, deps, gmail } = await fixture({ expiresAt: new Date(Date.now() - 1000) });
  const out = await handleConfirmPost(deps, token, {} as never, 'send');
  expect(out.view).toBe('expired');
  expect(gmail.sent).toHaveLength(0);
});

test('a subject carrying CRLF is refused, not passed to Gmail', async () => {
  const { token, deps, gmail, approval } = await fixture();
  await prisma.lead.update({
    where: { id: approval.leadId },
    data: { subject: 'Audit quote\r\nBcc: attacker@evil.example' },
  });
  const out = await handleConfirmPost(deps, token, {} as never, 'send');
  expect(out.view).toBe('rejected_header');
  expect(gmail.sent).toHaveLength(0);
});

test('an ambiguous send is never sent twice', async () => {
  const { token, deps, gmail, approval } = await fixture();
  gmail.failNextSendAfterAccepting();
  const first = await handleConfirmPost(deps, token, {} as never, 'send');
  expect(first.view).toBe('send_failed');
  const mid = await prisma.approval.findUniqueOrThrow({ where: { id: approval.id } });
  expect(mid.state).toBe('sending');

  const retry = await handleConfirmPost(deps, token, {} as never, 'send');
  expect(retry.view).toBe('sent');
  expect(gmail.sent).toHaveLength(1); // the Sent-folder check found it (E-T5)
});

// ---- beyond the brief: the decisions the caller made ----

test('a bad signature is a bare 404 and touches nothing', async () => {
  const { approval, deps, gmail } = await fixture();
  const forged = signApprovalLink({ approvalId: approval.id, expiresAt: new Date(Date.now() + 3600_000), secret: 'other' });
  const out = await handleConfirmPost(deps, forged, {} as never, 'send');
  expect(out.status).toBe(404);
  expect(gmail.sent).toHaveLength(0);
  expect((await handleConfirmGet(deps, 'junk', {} as never)).status).toBe(404);
});

test('a link for an approval that is void or failed is already decided', async () => {
  for (const state of ['void', 'failed'] as const) {
    const { token, deps, gmail, approval } = await fixture();
    // The database trigger only allows legal moves, so walk the approval there.
    if (state === 'failed') await prisma.approval.update({ where: { id: approval.id }, data: { state: 'sending' } });
    await prisma.approval.update({ where: { id: approval.id }, data: { state } });
    expect((await handleConfirmGet(deps, token, {} as never)).view).toBe('already_decided');
    expect((await handleConfirmPost(deps, token, {} as never, 'send')).view).toBe('already_decided');
    expect(gmail.sent).toHaveLength(0);
  }
});

test('three presses at once send exactly once', async () => {
  const { token, deps, gmail } = await fixture();
  const results = await Promise.all([
    handleConfirmPost(deps, token, {} as never, 'send'),
    handleConfirmPost(deps, token, {} as never, 'send'),
    handleConfirmPost(deps, token, {} as never, 'send_edited', 'Other words.'),
  ]);
  expect(gmail.sent).toHaveLength(1);
  expect(results.filter((r) => r.view === 'sent')).toHaveLength(1);
  expect(results.filter((r) => r.view === 'already_decided')).toHaveLength(2);
});

test('a retry looks in the Sent folder by thread, and sends nothing when it finds nothing', async () => {
  const { token, deps, gmail, approval } = await fixture();
  const lead = await prisma.lead.findUniqueOrThrow({ where: { id: approval.leadId } });
  gmail.failNextSendWith({ status: 503 }); // rejected, nothing recorded
  expect((await handleConfirmPost(deps, token, {} as never, 'send')).view).toBe('send_failed');
  const spy = vi.spyOn(gmail, 'findSentByTag');
  const retry = await handleConfirmPost(deps, token, {} as never, 'send');
  expect(retry.view).toBe('send_failed'); // cannot prove it was not sent, so it does not send again
  expect(spy).toHaveBeenCalledWith(approval.id, { gmailThreadId: lead.gmailThreadId });
  expect(gmail.sent).toHaveLength(0);
});

test('a retry whose Sent-folder lookup throws sends nothing', async () => {
  const { token, deps, gmail } = await fixture();
  gmail.failNextSendAfterAccepting();
  await handleConfirmPost(deps, token, {} as never, 'send');
  gmail.failNextFindWith({ status: 500 });
  expect((await handleConfirmPost(deps, token, {} as never, 'send')).view).toBe('send_failed');
  expect(gmail.sent).toHaveLength(1);
});

test('the reply threads: In-Reply-To and References carry the lead message id', async () => {
  const { token, deps, gmail, approval } = await fixture();
  const lead = await prisma.lead.findUniqueOrThrow({ where: { id: approval.leadId } });
  await handleConfirmPost(deps, token, {} as never, 'send');
  const raw = decode(gmail.sent[0]!.raw);
  expect(raw).toContain(`In-Reply-To: ${lead.messageId}`);
  expect(raw).toContain(`References: ${lead.messageId}`);
});

test('CRLF in the recipient or the message id is refused before anything is recorded', async () => {
  for (const data of [{ fromEmail: 'a@b.example\r\nbcc: x@y.example' }, { messageId: '<a@b>\nBcc: x@y.example' }]) {
    const { token, deps, gmail, approval } = await fixture();
    await prisma.lead.update({ where: { id: approval.leadId }, data });
    expect((await handleConfirmPost(deps, token, {} as never, 'send')).view).toBe('rejected_header');
    expect(gmail.sent).toHaveLength(0);
    expect(await prisma.decision.count({ where: { approvalId: approval.id } })).toBe(0);
    expect((await prisma.approval.findUniqueOrThrow({ where: { id: approval.id } })).state).toBe('issued');
  }
});

test('board_level needs a session fresh within 24 hours', async () => {
  const { token, deps, gmail, approval, owner } = await fixture();
  await prisma.userAuthority.create({ data: { userId: owner.id, authority: 'approve_board_level' } });
  await prisma.approval.update({ where: { id: approval.id }, data: { category: 'board_level' } });
  const stale = { ...deps, requireSession: async () => ({ userId: owner.id, freshAt: new Date(Date.now() - 25 * 3600_000) }) };
  expect((await handleConfirmPost(stale, token, {} as never, 'send')).view).toBe('needs_sign_in');
  expect(gmail.sent).toHaveLength(0);
  expect((await handleConfirmPost(deps, token, {} as never, 'send')).view).toBe('sent');
});

test('a signed-in user without the authority, or from another workspace, cannot send', async () => {
  const { token, deps, gmail, approval } = await fixture();
  await prisma.approval.update({ where: { id: approval.id }, data: { category: 'board_level' } });
  expect((await handleConfirmPost(deps, token, {} as never, 'send')).view).toBe('needs_sign_in'); // owner lacks approve_board_level
  const otherWs = await newWorkspace(prisma);
  const stranger = await withOwner(prisma, otherWs.id, 'stranger@example.com');
  await prisma.approval.update({ where: { id: approval.id }, data: { category: 'routine' } });
  const asStranger = { ...deps, requireSession: async () => ({ userId: stranger.id, freshAt: new Date() }) };
  expect((await handleConfirmPost(asStranger, token, {} as never, 'send')).view).toBe('needs_sign_in');
  expect(gmail.sent).toHaveLength(0);
});

test('discard records the decision, voids the approval and sends nothing', async () => {
  const { token, deps, gmail, approval } = await fixture();
  const out = await handleConfirmPost(deps, token, {} as never, 'discard');
  expect(out.view).toBe('already_decided');
  expect(gmail.sent).toHaveLength(0);
  expect((await prisma.approval.findUniqueOrThrow({ where: { id: approval.id } })).state).toBe('void');
  expect((await prisma.decision.findUniqueOrThrow({ where: { approvalId: approval.id } })).action).toBe('discard');
});

test('send_edited with no text is refused before anything is recorded', async () => {
  const { token, deps, gmail, approval } = await fixture();
  const out = await handleConfirmPost(deps, token, {} as never, 'send_edited', '   ');
  expect(out.view).toBe('draft');
  expect(out.status).toBe(422);
  expect(gmail.sent).toHaveLength(0);
  expect(await prisma.decision.count({ where: { approvalId: approval.id } })).toBe(0);
});
