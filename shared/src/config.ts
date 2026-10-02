/**
 * Startup configuration: a program refuses to start rather than fail on its first lead.
 * Every problem is collected and reported together, by variable NAME only (values are secrets).
 */
export class ConfigError extends Error {
  readonly problems: string[];
  constructor(problems: string[]) {
    super(`invalid configuration: ${problems.join('; ')}`);
    this.name = 'ConfigError';
    this.problems = problems;
  }
}

export const MIN_SECRET_LENGTH = 32;

type Env = Record<string, string | undefined>;

/** Reads each named variable, trimmed. Missing or blank ones are reported; `checks` adds per-variable rules. */
export function readEnv<K extends string>(
  env: Env,
  names: readonly K[],
  checks: Partial<Record<K, (value: string) => string | null>> = {},
): Record<K, string> {
  const problems: string[] = [];
  const out = {} as Record<K, string>;
  for (const name of names) {
    const value = env[name]?.trim() ?? '';
    if (value === '') {
      problems.push(`${name} is required`);
      continue;
    }
    const problem = checks[name]?.(value);
    if (problem) problems.push(`${name} ${problem}`);
    out[name] = value;
  }
  if (problems.length > 0) throw new ConfigError(problems);
  return out;
}

/** An HMAC key: an empty or short one is accepted by crypto and trivially forgeable, so refuse it here. */
export const secretCheck = (value: string): string | null =>
  value.length >= MIN_SECRET_LENGTH ? null : `must be at least ${MIN_SECRET_LENGTH} characters`;

export const urlCheck = (value: string): string | null => {
  try {
    const u = new URL(value);
    return u.protocol === 'http:' || u.protocol === 'https:' ? null : 'must be an http(s) URL';
  } catch {
    return 'must be a URL';
  }
};

export const hex32Check = (value: string): string | null =>
  /^[0-9a-fA-F]{64}$/.test(value) ? null : 'must be 32 bytes as 64 hex characters';
