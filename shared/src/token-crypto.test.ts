import { expect, test } from 'vitest';
import { decryptToken, encryptToken } from './token-crypto.ts';

const KEY = '0'.repeat(64); // 32 bytes, hex

test('a token survives a round trip', () => {
  expect(decryptToken(encryptToken('1//refresh', KEY), KEY)).toBe('1//refresh');
});

test('two encryptions of the same token differ', () => {
  expect(encryptToken('same', KEY)).not.toBe(encryptToken('same', KEY));
});

test('a tampered ciphertext throws rather than returning plaintext', () => {
  const cipher = encryptToken('1//refresh', KEY);
  const parts = cipher.split('.');
  parts[3] = Buffer.from('tampered').toString('base64');
  expect(() => decryptToken(parts.join('.'), KEY)).toThrow();
});

test('a key of the wrong length is refused', () => {
  expect(() => encryptToken('x', 'abcd')).toThrow(/32 bytes/);
});
