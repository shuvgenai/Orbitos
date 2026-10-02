import { hex32Check, readEnv, secretCheck, urlCheck } from '@orbit/shared/config';

const NAMES = [
  'DATABASE_URL',
  'GMAIL_CLIENT_ID',
  'GMAIL_CLIENT_SECRET',
  'TOKEN_ENCRYPTION_KEY',
  'APPROVAL_LINK_SECRET',
  'PUBLIC_BASE_URL',
  'RESEND_API_KEY',
  'MAIL_FROM',
] as const;

export type ApiConfig = ReturnType<typeof loadApiConfig>;

/** Throws ConfigError naming every missing or malformed variable; main turns that into a non-zero exit. */
export function loadApiConfig(env: Record<string, string | undefined>) {
  return readEnv(env, NAMES, {
    TOKEN_ENCRYPTION_KEY: hex32Check,
    APPROVAL_LINK_SECRET: secretCheck,
    PUBLIC_BASE_URL: urlCheck,
  });
}
