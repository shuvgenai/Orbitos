import { expect, test } from 'vitest';
import { ConfigError, hex32Check, readEnv, secretCheck, urlCheck } from './config.ts';

test('every missing or blank variable is reported together, by name', () => {
  const err = (() => {
    try {
      readEnv({ A: 'x', B: '   ' }, ['A', 'B', 'C']);
    } catch (e) {
      return e as ConfigError;
    }
  })();
  expect(err).toBeInstanceOf(ConfigError);
  expect(err!.problems).toEqual(['B is required', 'C is required']);
});

test('values are trimmed and returned', () => {
  expect(readEnv({ A: ' x ' }, ['A'])).toEqual({ A: 'x' });
});

test('an error never contains a value', () => {
  expect(() => readEnv({ S: 'short-secret' }, ['S'], { S: secretCheck })).toThrow(/S must be at least 32/);
  try {
    readEnv({ S: 'short-secret' }, ['S'], { S: secretCheck });
  } catch (e) {
    expect((e as Error).message).not.toContain('short-secret');
  }
});

test('secretCheck refuses empty-ish and short keys, accepts 32 characters', () => {
  expect(secretCheck('')).not.toBeNull();
  expect(secretCheck('a'.repeat(31))).not.toBeNull();
  expect(secretCheck('a'.repeat(32))).toBeNull();
});

test('urlCheck and hex32Check', () => {
  expect(urlCheck('https://orbit.example')).toBeNull();
  expect(urlCheck('ftp://x')).not.toBeNull();
  expect(urlCheck('nope')).not.toBeNull();
  expect(hex32Check('a'.repeat(64))).toBeNull();
  expect(hex32Check('a'.repeat(48))).not.toBeNull();
});
