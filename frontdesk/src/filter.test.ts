import { expect, test } from 'vitest';
import { shouldDrop } from './filter.ts';

const OWNER = 'owner@example.com';
const base = { fromEmail: 'maya@okafor.example', headers: {}, subject: 'Audit quote' };

test('a real lead is kept', () => {
  expect(shouldDrop(base, OWNER)).toBe(false);
});

test('our own system mail is dropped by its header', () => {
  expect(shouldDrop({ ...base, headers: { 'x-orbitcrew': '1' } }, OWNER)).toBe('system_mail');
});

test('mail from the owner is dropped', () => {
  expect(shouldDrop({ ...base, fromEmail: OWNER }, OWNER)).toBe('self_sent');
  expect(shouldDrop({ ...base, fromEmail: 'OWNER@Example.com' }, OWNER)).toBe('self_sent');
});

test('bulk mail is dropped by List-Unsubscribe', () => {
  expect(shouldDrop({ ...base, listUnsubscribe: '<mailto:x@y.z>' }, OWNER)).toBe('bulk');
});

test('bulk mail is dropped by a List-Unsubscribe header with no field set', () => {
  const headers = { 'List-Unsubscribe': '<mailto:x@y.z>' };
  expect(shouldDrop({ ...base, headers }, OWNER)).toBe('bulk');
});

test('automated senders are dropped by address', () => {
  for (const from of ['no-reply@stripe.com', 'noreply@github.com', 'mailer-daemon@example.net']) {
    expect(shouldDrop({ ...base, fromEmail: from }, OWNER)).toBe('automated');
  }
});

test('calendar invitations are dropped by content type', () => {
  const headers = { 'content-type': 'text/calendar; method=REQUEST' };
  expect(shouldDrop({ ...base, headers }, OWNER)).toBe('calendar');
});

test('a lead whose subject merely mentions a receipt is kept', () => {
  expect(shouldDrop({ ...base, subject: 'Receipt for your quote?' }, OWNER)).toBe(false);
});
