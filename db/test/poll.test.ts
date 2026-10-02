// db/test/poll.test.ts
import { afterAll, expect, test } from 'vitest';
import { GmailApiError } from '@orbit/shared/gmail/client';
import type { GmailMessage, GmailPort } from '@orbit/shared/gmail/port';
import { FakeGmail, syntheticLead } from '@orbit/shared/gmail/fake';
import { pollOnce } from '../../frontdesk/src/poll.ts';
import { newWorkspace, testPrisma, withConnection } from './helpers.ts';

const prisma = testPrisma();

// A port whose list calls are scripted; the send side is never touched by a poll.
function stubGmail(list: Pick<GmailPort, 'listSince' | 'listByDate'>): GmailPort {
  const unused = async (): Promise<never> => { throw new Error('not used by a poll'); };
  return { ...list, sendInThread: unused, findSentByTag: unused };
}
afterAll(() => prisma.$disconnect());

test('a new lead becomes one row, and a repeat is a no-op', async () => {
  const ws = await newWorkspace(prisma);
  await withConnection(prisma, ws.id, { historyId: '100' });
  const gmail = new FakeGmail({ historyId: '100' });
  const msg = syntheticLead({ messageId: '<a@mail.example>' });
  gmail.queue(msg);

  const first = await pollOnce({ prisma, gmail, workspaceId: ws.id, ownerAddress: 'owner@example.com' });
  expect(first.created).toBe(1);

  gmail.queue({ ...msg, gmailThreadId: 'a-different-thread' }); // only the unique key can block this
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
  expect(await prisma.emailBody.count({ where: { leadId: lead.id } })).toBe(0);
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
  const conn = await prisma.gmailConnection.findUniqueOrThrow({ where: { workspaceId: ws.id } });
  expect(conn.historyId).toBe('501'); // the fake's id after its one queued message
});

const transient: [string, () => unknown][] = [
  ['503', () => new GmailApiError(503, 'unavailable')],
  ['429', () => new GmailApiError(429, 'slow down')],
  ['403 rateLimitExceeded', () => new GmailApiError(403, 'rate', 'rateLimitExceeded')],
  ['403 userRateLimitExceeded', () => new GmailApiError(403, 'rate', 'userRateLimitExceeded')],
  ['403 quotaExceeded', () => new GmailApiError(403, 'quota', 'quotaExceeded')],
  ['403 dailyLimitExceeded', () => new GmailApiError(403, 'daily quota', 'dailyLimitExceeded')],
  ['a network TypeError', () => new TypeError('fetch failed')],
  ['a GmailApiError with no status', () => new GmailApiError(undefined as unknown as number, 'no status')],
];

test.each(transient)('%s propagates and leaves the connection, watermark and jobs alone', async (_name, makeError) => {
  const ws = await newWorkspace(prisma);
  await withConnection(prisma, ws.id, { historyId: '100' });
  const gmail = stubGmail({
    listSince: async () => { throw makeError(); },
    listByDate: async () => { throw makeError(); },
  });
  await expect(
    pollOnce({ prisma, gmail, workspaceId: ws.id, ownerAddress: 'owner@example.com' }),
  ).rejects.toBeDefined();

  const conn = await prisma.gmailConnection.findUniqueOrThrow({ where: { workspaceId: ws.id } });
  expect(conn.state).toBe('connected');
  expect(conn.historyId).toBe('100');
  expect(await prisma.job.count({ where: { workspaceId: ws.id, kind: 'notice' } })).toBe(0);
});

test.each([
  ['401', 401, undefined],
  ['403 with no reason', 403, undefined],
  ['403 insufficientPermissions', 403, 'insufficientPermissions'],
] as const)('%s revokes the connection', async (_name, status, reason) => {
  const ws = await newWorkspace(prisma);
  await withConnection(prisma, ws.id, { historyId: '100' });
  const gmail = new FakeGmail({ historyId: '100' });
  gmail.failNextListWith(reason ? { status, reason } : { status });
  const result = await pollOnce({ prisma, gmail, workspaceId: ws.id, ownerAddress: 'owner@example.com' });
  expect(result).toEqual({ created: 0, dropped: 0, resynced: false });
  const conn = await prisma.gmailConnection.findUniqueOrThrow({ where: { workspaceId: ws.id } });
  expect(conn.state).toBe('revoked');
  expect(conn.historyId).toBe('100');
  expect(await prisma.job.count({ where: { workspaceId: ws.id, kind: 'notice' } })).toBe(1);
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

test('the watermark stays put when a write fails mid-batch, and a retry completes the batch', async () => {
  const ws = await newWorkspace(prisma);
  await withConnection(prisma, ws.id, { historyId: '100' });
  const good = syntheticLead({ messageId: '<w1@mail.example>' });
  const poison = syntheticLead({ messageId: '<w2@mail.example>', subject: 'bad\u0000subject' }); // Postgres rejects NUL in text
  let batch: GmailMessage[] = [good, poison];
  const gmail = stubGmail({
    listSince: async () => ({ messages: batch, historyId: '102' }),
    listByDate: async () => ({ messages: batch, historyId: '102' }),
  });
  const deps = { prisma, gmail, workspaceId: ws.id, ownerAddress: 'owner@example.com' };

  await expect(pollOnce(deps)).rejects.toBeDefined();
  let conn = await prisma.gmailConnection.findUniqueOrThrow({ where: { workspaceId: ws.id } });
  expect(conn.historyId).toBe('100');
  expect(await prisma.lead.count({ where: { workspaceId: ws.id, messageId: '<w1@mail.example>' } })).toBe(1);

  batch = [good, { ...poison, subject: 'fixed' }];
  const retry = await pollOnce(deps);
  expect(retry.created).toBe(1); // the first is already there, the second lands now
  expect(await prisma.lead.count({ where: { workspaceId: ws.id } })).toBe(2);
  conn = await prisma.gmailConnection.findUniqueOrThrow({ where: { workspaceId: ws.id } });
  expect(conn.historyId).toBe('102');
});

test('two messages of one new thread in a batch make one lead', async () => {
  const ws = await newWorkspace(prisma);
  await withConnection(prisma, ws.id, { historyId: '100' });
  const gmail = new FakeGmail({ historyId: '100' });
  gmail.queue(syntheticLead({ messageId: '<t1@mail.example>', gmailThreadId: 'same' }));
  gmail.queue(syntheticLead({ messageId: '<t2@mail.example>', gmailThreadId: 'same' }));
  const result = await pollOnce({ prisma, gmail, workspaceId: ws.id, ownerAddress: 'owner@example.com' });
  expect(result.created).toBe(1);
  expect(await prisma.lead.count({ where: { workspaceId: ws.id } })).toBe(1);
});

test('a created lead keeps its raw text and its cleaned body', async () => {
  const ws = await newWorkspace(prisma);
  await withConnection(prisma, ws.id, { historyId: '100' });
  const gmail = new FakeGmail({ historyId: '100' });
  gmail.queue(
    syntheticLead({
      messageId: '<body@mail.example>',
      parts: [{ mimeType: 'text/plain', text: 'Please quote an audit.\n\nOn Mon, Maya wrote:\n> older text' }],
    }),
  );
  await pollOnce({ prisma, gmail, workspaceId: ws.id, ownerAddress: 'owner@example.com' });
  const lead = await prisma.lead.findFirstOrThrow({ where: { workspaceId: ws.id }, include: { body: true } });
  expect(lead.body?.rawBody).toContain('older text');
  expect(lead.body?.cleanBody).toContain('Please quote an audit.');
  expect(lead.body?.cleanBody).not.toContain('older text');
});

test('an inner text/calendar part is dropped as calendar (partMimeTypes reaches the filter)', async () => {
  const ws = await newWorkspace(prisma);
  await withConnection(prisma, ws.id, { historyId: '100' });
  const gmail = new FakeGmail({ historyId: '100' });
  gmail.queue(
    syntheticLead({
      messageId: '<cal@mail.example>',
      parts: [
        { mimeType: 'text/plain', text: 'Invitation' },
        { mimeType: 'text/calendar', text: 'BEGIN:VCALENDAR' },
      ],
    }),
  );
  const result = await pollOnce({ prisma, gmail, workspaceId: ws.id, ownerAddress: 'owner@example.com' });
  expect(result).toMatchObject({ created: 0, dropped: 1 });
});

test('I7: a message that fails to store is logged by error name and message id, never the error object', async () => {
  const ws = await newWorkspace(prisma);
  await withConnection(prisma, ws.id, { historyId: '100' });
  const gmail = new FakeGmail({ historyId: '100' });
  gmail.queue(syntheticLead({ messageId: '<w3@mail.example>', subject: 'bad\u0000subject' })); // Postgres rejects NUL in text
  const logged: Array<Record<string, unknown>> = [];
  const log = { error: (o: Record<string, unknown>) => void logged.push(o), warn: () => undefined };
  await expect(pollOnce({ prisma, gmail, workspaceId: ws.id, ownerAddress: 'owner@example.com', log })).rejects.toBeDefined();
  expect(logged).toHaveLength(1);
  expect(Object.keys(logged[0]!).sort()).toEqual(['errName', 'gmailMessageId']);
});
