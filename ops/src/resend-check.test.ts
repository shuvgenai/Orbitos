import { expect, test } from 'vitest';
import { buildCheckEmail } from './resend-check.ts';

const email = buildCheckEmail('Orbitcrew <notify@mail.example.com>', 'founder@example.com');

test('carries the X-Orbitcrew header so the poller skips it (FD-1)', () => {
  expect(email.headers['X-Orbitcrew']).toBe('system');
});

test('uses only customer-facing words (UX-6)', () => {
  const text = `${email.subject} ${email.text}`;
  expect(text).toContain('Orbitcrew');
  expect(text).not.toMatch(/ORBIT-OS|Paperclip|Hermes/i);
});
