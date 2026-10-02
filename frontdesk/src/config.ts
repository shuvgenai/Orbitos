import { hex32Check, readEnv, secretCheck, urlCheck } from '@orbit/shared/config';

const NAMES = [
  'DATABASE_URL',
  'GMAIL_CLIENT_ID',
  'GMAIL_CLIENT_SECRET',
  'TOKEN_ENCRYPTION_KEY',
  'ANTHROPIC_API_KEY',
  'PAPERCLIP_API_URL',
  'PAPERCLIP_API_KEY',
  'PAPERCLIP_COMPANY_ID',
  'PAPERCLIP_SCOUT_AGENT_ID',
  'PAPERCLIP_ORBI_AGENT_ID',
  'APPROVAL_LINK_SECRET',
  'PUBLIC_BASE_URL',
  'SETUP_DIR',
  'RESEND_API_KEY',
  'MAIL_FROM',
] as const;

export type FrontdeskConfig = ReturnType<typeof loadFrontdeskConfig>;

/** Throws ConfigError naming every missing or malformed variable; main turns that into a non-zero exit. */
export function loadFrontdeskConfig(env: Record<string, string | undefined>) {
  return readEnv(env, NAMES, {
    TOKEN_ENCRYPTION_KEY: hex32Check,
    APPROVAL_LINK_SECRET: secretCheck,
    PAPERCLIP_API_URL: urlCheck,
    PUBLIC_BASE_URL: urlCheck,
  });
}
