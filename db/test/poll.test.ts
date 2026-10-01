// db/test/poll.test.ts
import { afterAll, expect, test } from 'vitest';
import { FakeGmail, syntheticLead } from '@orbit/shared/gmail/fake';
import { pollOnce } from '../../frontdesk/src/poll.ts';
import { newWorkspace, testPrisma, withConnection } from './helpers.ts';

const prisma = testPrisma();
afterAll(() => prisma.$disconnect());

test('a new lead becomes one row, and a repeat is a no-op', async () => {
  const ws = await newWorkspace(prisma);
  await withConnection(prisma, ws.id, { historyId: '100' });
  const gmail = new FakeGmail({ historyId: '100' });
  const msg = syntheticLead({ messageId: '<a@mail.example>' });
  gmail.queue(msg);

  const first = await pollOnce({ prisma, gmail, workspaceId: ws.id, ownerAddress: 'owner@example.com' });
  expect(first.created).toBe(1);

  gmail.queue(msg);
  const second = await pollOnce({ prisma, gmail, workspaceId: ws.id, ownerAddress: 'owner@example.com' });
  expect(second.created).toBe(0);
  expect(await prisma.lead.count({ where: { workspaceId: ws.id } })).toBe(1);
});

test('a later message in a known thread is skipped (FD-1b)', async () => {
  const ws = await newWorkspace(prisma);
  await withConnection(prisma, ws.id, { historyId: '100' });
  const gmail = new FakeGmail({ historyId: '100' });
  gmail.queue(syntheticLead({ messageId: '<a@mail.example>', gmailThreadId: 't1' }));
  await pollOnce({ prisma, gmail, workspaceId: ws.id, ownerAddress: 'owner@example.com' });
  gmail.queue(syntheticLead({ messageId: '<b@mail.example>', gmailThreadId: 't1' }));
  const second = await pollOnce({ prisma, gmail, workspaceId: ws.id, ownerAddress: 'owner@example.com' });
  expect(second.created).toBe(0);
});

test('a filtered message is stored as filtered, with no body sent onward', async () => {
  const ws = await newWorkspace(prisma);
  await withConnection(prisma, ws.id, { historyId: '100' });
  const gmail = new FakeGmail({ historyId: '100' });
  gmail.queue(syntheticLead({ messageId: '<c@mail.example>', fromEmail: 'no-reply@stripe.com' }));
  const result = await pollOnce({ prisma, gmail, workspaceId: ws.id, ownerAddress: 'owner@example.com' });
  expect(result.dropped).toBe(1);
  const lead = await prisma.lead.findFirstOrThrow({ where: { workspaceId: ws.id } });
  expect(lead.state).toBe('filtered');
});

test('the watermark only advances after the batch persists', async () => {
  const ws = await newWorkspace(prisma);
  await withConnection(prisma, ws.id, { historyId: '100' });
  const gmail = new FakeGmail({ historyId: '100' });
  gmail.queue(syntheticLead({ messageId: '<d@mail.example>' }));
  await pollOnce({ prisma, gmail, workspaceId: ws.id, ownerAddress: 'owner@example.com' });
  const conn = await prisma.gmailConnection.findUniqueOrThrow({ where: { workspaceId: ws.id } });
  expect(conn.historyId).toBe('101');
  expect(conn.lastCheckedAt).not.toBeNull();
});

test('a revoked token stops the poller, records the revocation and queues the alerts (CN-8, CEO2-D8)', async () => {
  const ws = await newWorkspace(prisma);
  await withConnection(prisma, ws.id, { historyId: '100' });
  const gmail = new FakeGmail({ historyId: '100' });
  gmail.failNextListWith({ status: 401 });
  gmail.queue(syntheticLead({ messageId: '<f@mail.example>' }));

  const result = await pollOnce({ prisma, gmail, workspaceId: ws.id, ownerAddress: 'owner@example.com' });

  expect(result.created).toBe(0);
  const conn = await prisma.gmailConnection.findUniqueOrThrow({ where: { workspaceId: ws.id } });
  expect(conn.state).toBe('revoked');
  expect(conn.revokedAt).not.toBeNull();
  expect(conn.historyId).toBe('100');                 // the watermark did not move
  expect(await prisma.job.count({ where: { workspaceId: ws.id, kind: 'notice' } })).toBe(1);
});

test('a revoked connection is not polled again until it is reconnected', async () => {
  const ws = await newWorkspace(prisma);
  await withConnection(prisma, ws.id, { historyId: '100' });
  await prisma.gmailConnection.update({ where: { workspaceId: ws.id }, data: { state: 'revoked' } });
  const gmail = new FakeGmail({ historyId: '100' });
  gmail.queue(syntheticLead({ messageId: '<g@mail.example>' }));
  const result = await pollOnce({ prisma, gmail, workspaceId: ws.id, ownerAddress: 'owner@example.com' });
  expect(result).toEqual({ created: 0, dropped: 0, resynced: false });
});

test('an expired history id resyncs by date instead of skipping', async () => {
  const ws = await newWorkspace(prisma);
  await withConnection(prisma, ws.id, { historyId: '1' });
  const gmail = new FakeGmail({ historyId: '500' });
  gmail.queue(syntheticLead({ messageId: '<e@mail.example>', receivedAt: new Date() })); // inside the 7-day window
  const result = await pollOnce({ prisma, gmail, workspaceId: ws.id, ownerAddress: 'owner@example.com' });
  expect(result.resynced).toBe(true);
  expect(result.created).toBe(1);
});

test('a non-auth error propagates and leaves the connection and watermark alone', async () => {
  const ws = await newWorkspace(prisma);
  await withConnection(prisma, ws.id, { historyId: '100' });
  const gmail = new FakeGmail({ historyId: '100' });
  gmail.failNextListWith({ status: 503 });
  await expect(
    pollOnce({ prisma, gmail, workspaceId: ws.id, ownerAddress: 'owner@example.com' }),
  ).rejects.toMatchObject({ status: 503 });

  const networkDown = {
    listSince: async () => { throw new TypeError('fetch failed'); },
    listByDate: async () => { throw new TypeError('fetch failed'); },
  } as unknown as FakeGmail;
  await expect(
    pollOnce({ prisma, gmail: networkDown, workspaceId: ws.id, ownerAddress: 'owner@example.com' }),
  ).rejects.toThrow('fetch failed');

  const conn = await prisma.gmailConnection.findUniqueOrThrow({ where: { workspaceId: ws.id } });
  expect(conn.state).toBe('connected');
  expect(conn.historyId).toBe('100');
  expect(await prisma.job.count({ where: { workspaceId: ws.id, kind: 'notice' } })).toBe(0);
});

test('a second revocation after a reconnect gets its own notice', async () => {
  const ws = await newWorkspace(prisma);
  await withConnection(prisma, ws.id, { historyId: '100' });
  const gmail = new FakeGmail({ historyId: '100' });
  const tick = () => pollOnce({ prisma, gmail, workspaceId: ws.id, ownerAddress: 'owner@example.com' });

  gmail.failNextListWith({ status: 401 });
  await tick();
  await prisma.gmailConnection.update({ where: { workspaceId: ws.id }, data: { state: 'connected', revokedAt: null } });
  gmail.failNextListWith({ status: 403 });
  await tick();

  const conn = await prisma.gmailConnection.findUniqueOrThrow({ where: { workspaceId: ws.id } });
  expect(conn.state).toBe('revoked');
  expect(conn.historyId).toBe('100');
  expect(await prisma.job.count({ where: { workspaceId: ws.id, kind: 'notice' } })).toBe(2);
});
