import { expect, test } from 'vitest';
import { signApprovalLink, verifyApprovalLink } from './approval-link.ts';

const SECRET = 'test-secret';
const NOW = new Date('2026-10-01T09:00:00Z');
const LATER = new Date('2026-10-04T09:00:01Z');

test('a fresh token verifies to its approval', () => {
  const token = signApprovalLink({ approvalId: 'appr-1', expiresAt: LATER, secret: SECRET });
  expect(verifyApprovalLink(token, SECRET, NOW)).toEqual({ ok: true, approvalId: 'appr-1' });
});

test('a token signed with another secret is refused', () => {
  const token = signApprovalLink({ approvalId: 'appr-1', expiresAt: LATER, secret: 'other' });
  expect(verifyApprovalLink(token, SECRET, NOW)).toEqual({ ok: false, reason: 'bad_signature' });
});

test('an edited approval id is refused rather than trusted', () => {
  const token = signApprovalLink({ approvalId: 'appr-1', expiresAt: LATER, secret: SECRET });
  const tampered = token.replace('appr-1', 'appr-2');
  expect(tampered).not.toBe(token); // the edit must really change the token, or this test proves nothing
  expect(verifyApprovalLink(tampered, SECRET, NOW)).toEqual({ ok: false, reason: 'bad_signature' });
});

test('an expired token is refused', () => {
  const token = signApprovalLink({ approvalId: 'appr-1', expiresAt: NOW, secret: SECRET });
  expect(verifyApprovalLink(token, SECRET, LATER)).toEqual({ ok: false, reason: 'expired' });
});

test('garbage is malformed, not a crash', () => {
  expect(verifyApprovalLink('nonsense', SECRET, NOW)).toEqual({ ok: false, reason: 'malformed' });
});

test('an edited expiry cannot extend a token: the signature is checked before the expiry is read', () => {
  const token = signApprovalLink({ approvalId: 'appr-1', expiresAt: NOW, secret: SECRET });
  const [id, , sig] = token.split('.');
  const forged = `${id}.${LATER.getTime() + 999_999_999}.${sig}`;
  expect(verifyApprovalLink(forged, SECRET, LATER)).toEqual({ ok: false, reason: 'bad_signature' });
});

test('a truncated or empty signature is refused, not a crash', () => {
  const token = signApprovalLink({ approvalId: 'appr-1', expiresAt: LATER, secret: SECRET });
  expect(verifyApprovalLink(token.slice(0, -4), SECRET, NOW).ok).toBe(false);
  expect(verifyApprovalLink('appr-1.123.', SECRET, NOW).ok).toBe(false);
});

test('an approval id that would break the token format is refused at signing', () => {
  expect(() => signApprovalLink({ approvalId: 'a.b', expiresAt: LATER, secret: SECRET })).toThrow();
});
