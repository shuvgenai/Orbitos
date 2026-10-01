import { expect, test, vi } from 'vitest';
import { createGmailClient } from './client.ts';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const b64 = (s: string) => Buffer.from(s, 'utf8').toString('base64url');

test('a 404 from history.list reports expired, so the caller can resync', async () => {
  const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 404 }));
  const gmail = createGmailClient({ accessToken: async () => 'token', fetch: fetchMock });
  expect(await gmail.listSince('5')).toEqual({ expired: true });
  expect(String(fetchMock.mock.calls[0]![0])).toContain('startHistoryId=5');
});

test('a 429 throws so the job retries instead of advancing the watermark', async () => {
  const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 429 }));
  const gmail = createGmailClient({ accessToken: async () => 'token', fetch: fetchMock });
  await expect(gmail.listSince('5')).rejects.toThrow(/429/);
  await expect(gmail.listSince('5')).rejects.toMatchObject({ status: 429 });
});

test('401, 403 and 503 carry their status on the thrown error', async () => {
  for (const status of [401, 403, 503]) {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status }));
    const gmail = createGmailClient({ accessToken: async () => 'token', fetch: fetchMock });
    await expect(gmail.listSince('5')).rejects.toMatchObject({ status });
  }
});

test('the outbound message carries the X-Orbitcrew-Id header', async () => {
  const fetchMock = vi.fn().mockResolvedValue(
    new Response(JSON.stringify({ id: 'm1' }), { status: 200, headers: { 'content-type': 'application/json' } }),
  );
  const gmail = createGmailClient({ accessToken: async () => 'token', fetch: fetchMock });
  await gmail.sendInThread({
    gmailThreadId: 't1',
    toEmail: 'maya@okafor.example',
    subject: 'Re: Audit quote',
    body: 'Thanks.',
    orbitcrewId: 'appr-1',
  });
  const body = JSON.parse(String(fetchMock.mock.calls[0]![1]!.body));
  const raw = Buffer.from(body.raw, 'base64url').toString('utf8');
  expect(raw).toContain('X-Orbitcrew-Id: appr-1');
  expect(body.threadId).toBe('t1');
});

test('a message is parsed into a bare lowercase fromEmail, a fromName, and every MIME part', async () => {
  const fetchMock = vi
    .fn()
    .mockResolvedValueOnce(
      json({
        historyId: '210',
        history: [{ messagesAdded: [{ message: { id: 'g1', threadId: 'th1' } }] }],
      }),
    )
    .mockResolvedValueOnce(
      json({
        id: 'g1',
        threadId: 'th1',
        internalDate: '1780000000000',
        payload: {
          mimeType: 'multipart/mixed',
          headers: [
            { name: 'From', value: '"Maya Okafor" <Maya@Okafor.Example>' },
            { name: 'Subject', value: 'Audit quote' },
            { name: 'Message-ID', value: '<abc@mail.example>' },
          ],
          parts: [
            { mimeType: 'text/plain', body: { data: b64('Hello there') } },
            { mimeType: 'text/calendar', body: { data: b64('BEGIN:VCALENDAR') } },
            { mimeType: 'application/pdf', body: { attachmentId: 'att1' } },
          ],
        },
      }),
    );
  const gmail = createGmailClient({ accessToken: async () => 'token', fetch: fetchMock });
  const page = await gmail.listSince('200');
  if ('expired' in page) throw new Error('unreachable');
  expect(page.historyId).toBe('210');
  const m = page.messages[0]!;
  expect(m.fromEmail).toBe('maya@okafor.example');
  expect(m.fromName).toBe('Maya Okafor');
  expect(m.gmailMessageId).toBe('g1');
  expect(m.gmailThreadId).toBe('th1');
  expect(m.messageId).toBe('<abc@mail.example>');
  expect(m.subject).toBe('Audit quote');
  expect(m.receivedAt).toEqual(new Date(1780000000000));
  expect(m.headers['Message-ID']).toBe('<abc@mail.example>');
  expect(m.parts.map((p) => p.mimeType)).toEqual(['text/plain', 'text/calendar', 'application/pdf']);
  expect(m.parts[0]!.text).toBe('Hello there');
});

test('a bare From header has no fromName', async () => {
  const fetchMock = vi
    .fn()
    .mockResolvedValueOnce(
      json({ historyId: '2', history: [{ messagesAdded: [{ message: { id: 'g', threadId: 't' } }] }] }),
    )
    .mockResolvedValueOnce(
      json({
        id: 'g',
        threadId: 't',
        internalDate: '1',
        payload: {
          mimeType: 'text/plain',
          headers: [{ name: 'From', value: 'Lee@Example.COM' }],
          body: { data: b64('hi') },
        },
      }),
    );
  const gmail = createGmailClient({ accessToken: async () => 'token', fetch: fetchMock });
  const page = await gmail.listSince('1');
  if ('expired' in page) throw new Error('unreachable');
  expect(page.messages[0]!.fromEmail).toBe('lee@example.com');
  expect(page.messages[0]!.fromName).toBeUndefined();
});
