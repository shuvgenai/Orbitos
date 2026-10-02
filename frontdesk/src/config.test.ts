import { expect, test } from 'vitest';
import { loadFrontdeskConfig } from './config.ts';

const good = {
  DATABASE_URL: 'postgresql://x',
  GMAIL_CLIENT_ID: 'id',
  GMAIL_CLIENT_SECRET: 'secret',
  TOKEN_ENCRYPTION_KEY: 'a'.repeat(64),
  ANTHROPIC_API_KEY: 'k',
  PAPERCLIP_API_URL: 'http://paperclip:3100',
  PAPERCLIP_API_KEY: 'pk',
  PAPERCLIP_COMPANY_ID: 'co',
  PAPERCLIP_SCOUT_AGENT_ID: 'scout',
  PAPERCLIP_ORBI_AGENT_ID: 'orbi',
  APPROVAL_LINK_SECRET: 's'.repeat(32),
  PUBLIC_BASE_URL: 'https://orbit.example',
  SETUP_DIR: '/setup',
  RESEND_API_KEY: 're',
  MAIL_FROM: 'Orbit <orbit@example.com>',
};

test('a complete environment loads', () => {
  expect(loadFrontdeskConfig(good).PUBLIC_BASE_URL).toBe('https://orbit.example');
});

test('each variable is required, so the program refuses to start without it', () => {
  for (const name of Object.keys(good)) {
    const env: Record<string, string | undefined> = { ...good };
    delete env[name];
    expect(() => loadFrontdeskConfig(env), name).toThrow(new RegExp(`${name} is required`));
  }
});

test('an empty APPROVAL_LINK_SECRET is refused, and so is a short one', () => {
  expect(() => loadFrontdeskConfig({ ...good, APPROVAL_LINK_SECRET: '' })).toThrow(/APPROVAL_LINK_SECRET/);
  expect(() => loadFrontdeskConfig({ ...good, APPROVAL_LINK_SECRET: 'x'.repeat(31) })).toThrow(/at least 32/);
});

test('a malformed key or URL is refused', () => {
  expect(() => loadFrontdeskConfig({ ...good, TOKEN_ENCRYPTION_KEY: 'abc' })).toThrow(/TOKEN_ENCRYPTION_KEY/);
  expect(() => loadFrontdeskConfig({ ...good, PUBLIC_BASE_URL: 'orbit.example' })).toThrow(/PUBLIC_BASE_URL/);
});
