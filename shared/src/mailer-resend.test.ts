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
