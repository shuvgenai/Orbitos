import { expect, test, vi } from 'vitest';
import { buildRaw, createGmailClient, parseFrom } from './client.ts';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const b64 = (s: string) => Buffer.from(s, 'utf8').toString('base64url');

test('a 404 from history.list reports expired, so the caller can resync', async () => {
  const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 404 }));
  const gmail = createGmailClient({ accessToken: async () => 'token', fetch: fetchMock });
  expect(await gmail.listSince('5')).toEqual({ expired: true });
  const url = String(fetchMock.mock.calls[0]![0]);
  expect(url).toContain('startHistoryId=5');
  expect(url).toContain('historyTypes=messageAdded');
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
  expect(String(fetchMock.mock.calls[0]![0])).toBe('https://gmail.googleapis.com/gmail/v1/users/me/messages/send');
  const init = fetchMock.mock.calls[0]![1]!;
  expect(init.method).toBe('POST');
  expect(init.headers.authorization).toBe('Bearer token');
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

const tagged = (id: string, tag?: string) => ({
  id,
  payload: { headers: tag ? [{ name: 'X-Orbitcrew-Id', value: tag }] : [] },
});

test('findSentByTag with a thread id returns the thread message carrying the tag', async () => {
  const fetchMock = vi.fn().mockResolvedValue(json({ messages: [tagged('m1'), tagged('m2', 'appr-1')] }));
  const gmail = createGmailClient({ accessToken: async () => 'token', fetch: fetchMock });
  expect(await gmail.findSentByTag('appr-1', { gmailThreadId: 't1' })).toEqual({ gmailMessageId: 'm2' });
  expect(String(fetchMock.mock.calls[0]![0])).toContain('/threads/t1');
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

test('findSentByTag with a thread id returns null when no message carries the tag', async () => {
  const fetchMock = vi.fn().mockResolvedValue(json({ messages: [tagged('m1'), tagged('m2', 'appr-other')] }));
  const gmail = createGmailClient({ accessToken: async () => 'token', fetch: fetchMock });
  expect(await gmail.findSentByTag('appr-1', { gmailThreadId: 't1' })).toBeNull();
});

test('findSentByTag with a thread id propagates a server error instead of answering null', async () => {
  const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 500 }));
  const gmail = createGmailClient({ accessToken: async () => 'token', fetch: fetchMock });
  await expect(gmail.findSentByTag('appr-1', { gmailThreadId: 't1' })).rejects.toMatchObject({ status: 500 });
});

test('findSentByTag without a thread id falls back to scanning SENT', async () => {
  const fetchMock = vi
    .fn()
    .mockResolvedValueOnce(json({ messages: [{ id: 'm1' }, { id: 'm2' }] }))
    .mockResolvedValueOnce(json(tagged('m1')))
    .mockResolvedValueOnce(json(tagged('m2', 'appr-1')));
  const gmail = createGmailClient({ accessToken: async () => 'token', fetch: fetchMock });
  expect(await gmail.findSentByTag('appr-1')).toEqual({ gmailMessageId: 'm2' });
  expect(String(fetchMock.mock.calls[0]![0])).toContain('labelIds=SENT');
});

test('listByDate sends an after: term and takes historyId from the profile', async () => {
  const fetchMock = vi
    .fn()
    .mockResolvedValueOnce(json({ historyId: '999' })) // profile
    .mockResolvedValueOnce(json({ messages: [{ id: 'g1' }] }))
    .mockResolvedValueOnce(
      json({
        id: 'g1',
        threadId: 't',
        internalDate: '5',
        payload: { mimeType: 'text/plain', headers: [{ name: 'From', value: 'a@b.example' }], body: { data: b64('x') } },
      }),
    );
  const gmail = createGmailClient({ accessToken: async () => 'token', fetch: fetchMock });
  const since = new Date('2026-03-01T00:00:00Z');
  const page = await gmail.listByDate(since);
  // The profile is read BEFORE listing, so a lead arriving mid-listing is not lost behind the watermark.
  const urls = fetchMock.mock.calls.map((c) => String(c[0]));
  expect(urls[0]).toContain('/profile');
  expect(urls[1]).toContain('/messages?');
  expect(urls[2]).toContain('/messages/g1');
  const q = new URL(urls[1]!).searchParams.get('q');
  expect(q).toContain(`after:${since.getTime() / 1000}`);
  expect(page.historyId).toBe('999');
  expect(page.messages).toHaveLength(1);
});

const base = { gmailThreadId: 't1', toEmail: 'a@b.example', subject: 'Re: x', body: 'b', orbitcrewId: 'appr-1' };
const decode = (raw: string) => Buffer.from(raw, 'base64url').toString('utf8');

test('buildRaw rejects CR or LF in every field that becomes a header line', () => {
  expect(() => buildRaw({ ...base, toEmail: 'a@b.example\r\nBcc: x@y.example' })).toThrow(/toEmail/);
  expect(() => buildRaw({ ...base, subject: 'hi\nBcc: x@y.example' })).toThrow(/subject/);
  expect(() => buildRaw({ ...base, orbitcrewId: 'a\rb' })).toThrow(/orbitcrewId/);
  expect(() => buildRaw({ ...base, inReplyToMessageId: '<a@b>\r\nBcc: x' })).toThrow(/inReplyToMessageId/);
});

test('buildRaw leaves an ASCII subject readable and RFC 2047-encodes a non-ASCII one', () => {
  expect(decode(buildRaw(base))).toContain('Subject: Re: x\r\n');
  const subject = 'Re: Café audit — quote';
  const raw = decode(buildRaw({ ...base, subject }));
  const encoded = Buffer.from(subject, 'utf8').toString('base64');
  expect(raw).toContain(`Subject: =?UTF-8?B?${encoded}?=\r\n`);
  expect(raw).not.toContain('Café');
});

test('buildRaw keeps a non-ASCII body as UTF-8 and declares 8bit', () => {
  const raw = decode(buildRaw({ ...base, body: 'Grüße, 你好' }));
  expect(raw).toContain('Content-Type: text/plain; charset=utf-8\r\n');
  expect(raw).toContain('Content-Transfer-Encoding: 8bit\r\n');
  expect(raw.split('\r\n\r\n')[1]).toBe('Grüße, 你好');
});

test('buildRaw sets In-Reply-To and References only when the lead Message-ID is given', () => {
  const withId = decode(buildRaw({ ...base, inReplyToMessageId: '<lead@mail.example>' }));
  expect(withId).toContain('In-Reply-To: <lead@mail.example>\r\n');
  expect(withId).toContain('References: <lead@mail.example>\r\n');
  const without = decode(buildRaw(base));
  expect(without).not.toContain('In-Reply-To');
  expect(without).not.toContain('References');
});

test('parseFrom handles a trailing comment and an empty header', () => {
  expect(parseFrom('A@B.example (Maya)')).toEqual({ fromEmail: 'a@b.example', fromName: 'Maya' });
  expect(parseFrom('')).toEqual({ fromEmail: '' });
});

test('findSentByTag compares the tag exactly, not as a substring', async () => {
  const fetchMock = vi.fn().mockResolvedValue(json({ messages: [tagged('m1', 'appr-10')] }));
  const gmail = createGmailClient({ accessToken: async () => 'token', fetch: fetchMock });
  expect(await gmail.findSentByTag('appr-1', { gmailThreadId: 't1' })).toBeNull();
});

test('findSentByTag on an empty thread returns null', async () => {
  const fetchMock = vi.fn().mockResolvedValue(json({ messages: [] }));
  const gmail = createGmailClient({ accessToken: async () => 'token', fetch: fetchMock });
  expect(await gmail.findSentByTag('appr-1', { gmailThreadId: 't1' })).toBeNull();
});

test('the error reason is parsed from the Gmail body, else error.status, else undefined', async () => {
  const cases: [Response, string | undefined][] = [
    [json({ error: { errors: [{ reason: 'rateLimitExceeded' }], status: 'PERMISSION_DENIED' } }, 403), 'rateLimitExceeded'],
    [json({ error: { status: 'UNAUTHENTICATED' } }, 401), 'UNAUTHENTICATED'],
    [new Response('not json', { status: 403 }), undefined],
  ];
  for (const [res, reason] of cases) {
    const gmail = createGmailClient({ accessToken: async () => 'token', fetch: vi.fn().mockResolvedValue(res) });
    await expect(gmail.listSince('5')).rejects.toMatchObject({ status: res.status, reason });
  }
});

test('the send request carries an abort signal: 60 s by default, the caller timeoutMs when given', async () => {
  const seen: AbortSignal[] = [];
  const fetchMock = vi.fn().mockImplementation(async (_url: string, init: RequestInit) => {
    seen.push(init.signal!);
    return json({ id: 'm1' });
  });
  const gmail = createGmailClient({ accessToken: async () => 'token', fetch: fetchMock });
  const args = { gmailThreadId: 't1', toEmail: 'maya@okafor.example', subject: 'Re: x', body: 'b', orbitcrewId: 'a1' };
  await gmail.sendInThread(args);
  await gmail.sendInThread({ ...args, timeoutMs: 5 });
  expect(seen[0]).toBeInstanceOf(AbortSignal);
  expect(seen[0]!.aborted).toBe(false);
  await new Promise((r) => setTimeout(r, 30));
  expect(seen[1]!.aborted).toBe(true); // the short one fired, the default one did not
  expect(seen[0]!.aborted).toBe(false);
});
