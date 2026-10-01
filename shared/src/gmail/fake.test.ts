import { expect, test } from 'vitest';
import { FakeGmail, syntheticLead } from './fake.ts';

test('the fake returns queued messages and advances the history id', async () => {
  const gmail = new FakeGmail({ historyId: '100' });
  gmail.queue(syntheticLead({ messageId: '<a@mail.example>' }));
  const page = await gmail.listSince('100');
  expect(page).not.toHaveProperty('expired');
  if ('expired' in page) throw new Error('unreachable');
  expect(page.messages).toHaveLength(1);
  expect(page.historyId).toBe('101');
});

test('a second poll from the returned history id yields nothing new', async () => {
  const gmail = new FakeGmail({ historyId: '100' });
  gmail.queue(syntheticLead({ messageId: '<a@mail.example>' }));
  const first = await gmail.listSince('100');
  if ('expired' in first) throw new Error('unreachable');
  const second = await gmail.listSince(first.historyId);
  if ('expired' in second) throw new Error('unreachable');
  expect(second.messages).toHaveLength(0);
  expect(second.historyId).toBe('101');
});

test('an unknown history id reports expired rather than throwing', async () => {
  const gmail = new FakeGmail({ historyId: '100' });
  expect(await gmail.listSince('3')).toEqual({ expired: true });
});

test('a send is recorded with its tag and is findable', async () => {
  const gmail = new FakeGmail({ historyId: '1' });
  const { gmailMessageId } = await gmail.sendInThread({
    gmailThreadId: 't1',
    toEmail: 'maya@okafor.example',
    subject: 'Re: Audit quote',
    body: 'Thanks for reaching out.',
    orbitcrewId: 'appr-1',
  });
  expect(gmail.sent).toHaveLength(1);
  expect(await gmail.findSentByTag('appr-1')).toEqual({ gmailMessageId });
  expect(await gmail.findSentByTag('appr-2')).toBeNull();
});

test('the fake can fail a send after accepting it, leaving the message sent', async () => {
  const gmail = new FakeGmail({ historyId: '1' });
  gmail.failNextSendAfterAccepting();
  await expect(
    gmail.sendInThread({
      gmailThreadId: 't1',
      toEmail: 'maya@okafor.example',
      subject: 'Re: Audit quote',
      body: 'Thanks.',
      orbitcrewId: 'appr-9',
    }),
  ).rejects.toThrow(/connection reset/);
  expect(gmail.sent).toHaveLength(1);
  expect(await gmail.findSentByTag('appr-9')).not.toBeNull();
});

test('the failure flag applies to one send only', async () => {
  const gmail = new FakeGmail({ historyId: '1' });
  gmail.failNextSendAfterAccepting();
  const args = {
    gmailThreadId: 't1',
    toEmail: 'maya@okafor.example',
    subject: 'Re: x',
    body: 'b',
  };
  await expect(gmail.sendInThread({ ...args, orbitcrewId: 'a' })).rejects.toThrow();
  await expect(gmail.sendInThread({ ...args, orbitcrewId: 'b' })).resolves.toBeDefined();
});

test('failNextListWith makes the next listSince throw an error carrying the status, once', async () => {
  const gmail = new FakeGmail({ historyId: '100' });
  gmail.failNextListWith({ status: 401 });
  await expect(gmail.listSince('100')).rejects.toMatchObject({ status: 401 });
  expect(await gmail.listSince('100')).toMatchObject({ historyId: '100' });
});

test('syntheticLead gives a bare lowercase fromEmail and keeps every MIME type in parts', () => {
  const lead = syntheticLead({
    parts: [
      { mimeType: 'text/plain', text: 'Hello' },
      { mimeType: 'text/calendar', text: 'BEGIN:VCALENDAR' },
      { mimeType: 'application/pdf' },
    ],
  });
  expect(lead.fromEmail).toMatch(/^[^<>\s@]+@[^<>\s@]+$/);
  expect(lead.fromEmail).toBe(lead.fromEmail.toLowerCase());
  expect(lead.parts.map((p) => p.mimeType)).toEqual(['text/plain', 'text/calendar', 'application/pdf']);
});

test('listByDate returns only messages received at or after the date', async () => {
  const gmail = new FakeGmail({ historyId: '1' });
  gmail.queue(syntheticLead({ messageId: '<old@x>', receivedAt: new Date('2026-01-01T00:00:00Z') }));
  gmail.queue(syntheticLead({ messageId: '<new@x>', receivedAt: new Date('2026-06-01T00:00:00Z') }));
  const page = await gmail.listByDate(new Date('2026-03-01T00:00:00Z'));
  expect(page.messages.map((m) => m.messageId)).toEqual(['<new@x>']);
});

test('a send is findable by tag with its thread id, and not under a different thread', async () => {
  const gmail = new FakeGmail({ historyId: '1' });
  const { gmailMessageId } = await gmail.sendInThread({
    gmailThreadId: 't1',
    toEmail: 'maya@okafor.example',
    subject: 'Re: x',
    body: 'b',
    orbitcrewId: 'appr-1',
  });
  expect(await gmail.findSentByTag('appr-1', { gmailThreadId: 't1' })).toEqual({ gmailMessageId });
  expect(await gmail.findSentByTag('appr-1', { gmailThreadId: 't2' })).toBeNull();
});

const sendArgs = {
  gmailThreadId: 't1',
  toEmail: 'maya@okafor.example',
  subject: 'Re: x',
  body: 'b',
  orbitcrewId: 'appr-1',
};

test('failNextListWith also fails listByDate, once', async () => {
  const gmail = new FakeGmail({ historyId: '1' });
  gmail.failNextListWith({ status: 401 });
  await expect(gmail.listByDate(new Date(0))).rejects.toMatchObject({ status: 401 });
  expect(await gmail.listByDate(new Date(0))).toMatchObject({ historyId: '1' });
});

test('failNextSendWith throws a status-bearing error and records nothing, once', async () => {
  const gmail = new FakeGmail({ historyId: '1' });
  gmail.failNextSendWith({ status: 503 });
  await expect(gmail.sendInThread(sendArgs)).rejects.toMatchObject({ status: 503 });
  expect(gmail.sent).toHaveLength(0);
  await expect(gmail.sendInThread(sendArgs)).resolves.toBeDefined();
});

test('failNextSendAfterAccepting with a status records the send and throws that status', async () => {
  const gmail = new FakeGmail({ historyId: '1' });
  gmail.failNextSendAfterAccepting({ status: 502 });
  await expect(gmail.sendInThread(sendArgs)).rejects.toMatchObject({ status: 502 });
  expect(gmail.sent).toHaveLength(1);
});

test('failNextFindWith makes the next findSentByTag throw its status, once', async () => {
  const gmail = new FakeGmail({ historyId: '1' });
  gmail.failNextFindWith({ status: 500 });
  await expect(gmail.findSentByTag('appr-1')).rejects.toMatchObject({ status: 500 });
  expect(await gmail.findSentByTag('appr-1')).toBeNull();
});

test('the fake rejects header injection exactly as the client does, without recording', async () => {
  const gmail = new FakeGmail({ historyId: '1' });
  await expect(gmail.sendInThread({ ...sendArgs, subject: 'a\r\nBcc: x@y.example' })).rejects.toThrow(/subject/);
  expect(gmail.sent).toHaveLength(0);
});

test('syntheticLead populates headers in the real client shape and original casing', () => {
  const lead = syntheticLead({ messageId: '<m@x>', subject: 'Hello' });
  expect(lead.headers).toEqual({
    From: '"Maya Okafor" <maya@okafor.example>',
    Subject: 'Hello',
    'Message-ID': '<m@x>',
    Date: lead.receivedAt.toUTCString(),
  });
});
