import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

// The Gmail refresh token is the one secret at rest that would let an attacker read the
// owner's mail, so it is encrypted with TOKEN_ENCRYPTION_KEY rather than stored raw (SEC-2a).
function key(keyHex: string): Buffer {
  const k = Buffer.from(keyHex, 'hex');
  if (k.length !== 32) throw new Error('TOKEN_ENCRYPTION_KEY must be 32 bytes of hex');
  return k;
}

export function encryptToken(plain: string, keyHex: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key(keyHex), iv);
  const data = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return ['v1', iv.toString('base64'), cipher.getAuthTag().toString('base64'), data.toString('base64')].join('.');
}

export function decryptToken(cipherText: string, keyHex: string): string {
  const [version, iv, tag, data] = cipherText.split('.');
  if (version !== 'v1' || !iv || !tag || !data) throw new Error('unrecognized token cipher format');
  const decipher = createDecipheriv('aes-256-gcm', key(keyHex), Buffer.from(iv, 'base64'));
  decipher.setAuthTag(Buffer.from(tag, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(data, 'base64')), decipher.final()]).toString('utf8');
}
