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

test('list-id alone marks bulk', () => {
  expect(shouldDrop({ ...base, headers: { 'List-Id': '<news.example.com>' } }, OWNER)).toBe('bulk');
});

test('precedence bulk, list and junk mark bulk in any case', () => {
  for (const v of ['bulk', 'Bulk', ' LIST ', 'junk']) {
    expect(shouldDrop({ ...base, headers: { Precedence: v } }, OWNER)).toBe('bulk');
  }
  expect(shouldDrop({ ...base, headers: { precedence: 'first-class' } }, OWNER)).toBe(false);
});

test('every automated prefix is dropped', () => {
  for (const from of ['do-not-reply@x.com', 'donotreply@x.com', 'postmaster@x.com', 'bounces@x.com', 'bounce@x.com']) {
    expect(shouldDrop({ ...base, fromEmail: from }, OWNER)).toBe('automated');
  }
});

test('lookalike human senders are kept', () => {
  for (const from of ['norepublic@x.com', 'bounces-dept@x.com', 'donotreplyinc@x.com']) {
    expect(shouldDrop({ ...base, fromEmail: from }, OWNER)).toBe(false);
  }
});

test('x-orbitcrew counts by presence, even empty or mixed-case', () => {
  expect(shouldDrop({ ...base, headers: { 'x-orbitcrew': '' } }, OWNER)).toBe('system_mail');
  expect(shouldDrop({ ...base, headers: { 'X-OrbitCrew': '1' } }, OWNER)).toBe('system_mail');
  expect(shouldDrop({ ...base, headers: { ' x-orbitcrew ': '1' } }, OWNER)).toBe('system_mail');
});

test('owner is recognised as a plus-address or with a display name', () => {
  expect(shouldDrop({ ...base, fromEmail: 'owner+crm@example.com' }, OWNER)).toBe('self_sent');
  expect(shouldDrop({ ...base, fromEmail: '"Owner" <Owner@Example.com>' }, OWNER)).toBe('self_sent');
  expect(shouldDrop({ ...base, fromEmail: 'owner@example.com' }, 'Owner <owner+x@example.com>')).toBe('self_sent');
  expect(shouldDrop({ ...base, fromEmail: 'maya+q@okafor.example' }, OWNER)).toBe(false);
});

test('a display-name automated sender is dropped', () => {
  expect(shouldDrop({ ...base, fromEmail: 'Stripe <no-reply@stripe.com>' }, OWNER)).toBe('automated');
});

test('calendar: content-type is case-insensitive', () => {
  expect(shouldDrop({ ...base, headers: { 'Content-Type': 'Text/Calendar; method=REQUEST' } }, OWNER)).toBe('calendar');
});

test('calendar: a multipart invite is caught by its inner part', () => {
  const headers = { 'content-type': 'multipart/mixed; boundary=x' };
  expect(shouldDrop({ ...base, headers, partMimeTypes: ['text/plain', 'Text/Calendar'] }, OWNER)).toBe('calendar');
  expect(shouldDrop({ ...base, headers, partMimeTypes: ['application/ics'] }, OWNER)).toBe('calendar');
  expect(shouldDrop({ ...base, headers, partMimeTypes: ['text/plain', 'text/html'] }, OWNER)).toBe(false);
});

test('precedence: bulk mail from a noreply sender reports bulk', () => {
  expect(shouldDrop({ ...base, fromEmail: 'noreply@x.com', listUnsubscribe: '<mailto:a@b.c>' }, OWNER)).toBe('bulk');
});
