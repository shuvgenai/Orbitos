import { expect, test, vi } from 'vitest';
import { createResendMailer, MailerError } from './mailer-resend.ts';

const ARGS = { to: 'owner@example.com', subject: 'S', text: 'T' };

test('posts the message to Resend with the key and the sender', async () => {
  const fetchMock = vi.fn().mockResolvedValue(new Response('{"id":"x"}', { status: 200 }));
  const mailer = createResendMailer({ apiKey: 'k', from: 'Orbit <noreply@orbit.example>', fetch: fetchMock });
  await mailer.send(ARGS);
  const [url, init] = fetchMock.mock.calls[0]!;
  expect(url).toBe('https://api.resend.com/emails');
  expect(init.method).toBe('POST');
  expect(init.headers.authorization).toBe('Bearer k');
  expect(JSON.parse(init.body)).toEqual({
    from: 'Orbit <noreply@orbit.example>',
    to: ['owner@example.com'],
    subject: 'S',
    text: 'T',
  });
});

test('a non-2xx answer throws an error carrying the status, never the body', async () => {
  const fetchMock = vi.fn().mockResolvedValue(new Response('owner@example.com is invalid', { status: 429 }));
  const mailer = createResendMailer({ apiKey: 'k', from: 'f', fetch: fetchMock });
  const err = await mailer.send(ARGS).catch((e: unknown) => e);
  expect(err).toBeInstanceOf(MailerError);
  expect((err as MailerError).status).toBe(429);
  expect((err as MailerError).message).not.toContain('owner@example.com');
});

test('headers are passed through in the request body', async () => {
  const fetchMock = vi.fn().mockResolvedValue(new Response('{"id":"x"}', { status: 200 }));
  const mailer = createResendMailer({ apiKey: 'k', from: 'f', fetch: fetchMock });
  await mailer.send({ ...ARGS, headers: { 'X-Orbitcrew': '1' } });
  expect(JSON.parse(fetchMock.mock.calls[0]![1].body).headers).toEqual({ 'X-Orbitcrew': '1' });
});

test('T10: the request carries a timeout signal, so a hung socket cannot hold a job forever', async () => {
  const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));
  await createResendMailer({ apiKey: 'k', from: 'f', fetch: fetchMock }).send(ARGS);
  expect(fetchMock.mock.calls[0]![1].signal).toBeInstanceOf(AbortSignal);

  // And it really aborts: a fetch that never answers is cut off at the deadline.
  const hung = vi.fn((_url: string, init: { signal: AbortSignal }) =>
    new Promise<Response>((_resolve, reject) => init.signal.addEventListener('abort', () => reject(init.signal.reason))));
  await expect(createResendMailer({ apiKey: 'k', from: 'f', fetch: hung as unknown as typeof fetch, timeoutMs: 20 }).send(ARGS)).rejects.toBeDefined();
});
