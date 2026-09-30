import { expect, test } from 'vitest';
import { APPROVAL_STATES, canTransition, type ApprovalState } from './approvals.ts';

const ALLOWED: Array<[ApprovalState, ApprovalState]> = [
  ['issued', 'sending'],
  ['issued', 'void'],
  ['sending', 'sent'],
  ['sending', 'failed'],
  ['failed', 'sending'], // the owner's "Resend" button (FD-5)
  ['failed', 'void'],
];

test('exactly the allowed transitions pass', () => {
  for (const from of APPROVAL_STATES) {
    for (const to of APPROVAL_STATES) {
      const expected = ALLOWED.some(([f, t]) => f === from && t === to);
      expect(canTransition(from, to), `${from} -> ${to}`).toBe(expected);
    }
  }
});

test('the transitions FD-5 names as invalid are rejected', () => {
  expect(canTransition('sent', 'sending')).toBe(false);
  expect(canTransition('void', 'sending')).toBe(false);
});

test('sent and void are terminal', () => {
  for (const to of APPROVAL_STATES) {
    expect(canTransition('sent', to)).toBe(false);
    expect(canTransition('void', to)).toBe(false);
  }
});

test('an unknown from state is rejected instead of throwing', () => {
  const untrusted = ['', 'ISSUED', 'queued', ' issued', 'issued '] as unknown as ApprovalState[];
  for (const from of untrusted) {
    expect(canTransition(from, 'sending'), `${JSON.stringify(from)} -> sending`).toBe(false);
  }
});

test('prototype keys as from are rejected, not resolved through Object.prototype', () => {
  const keys = ['constructor', 'toString', '__proto__', 'hasOwnProperty', 'valueOf'] as unknown as ApprovalState[];
  for (const from of keys) {
    for (const to of APPROVAL_STATES) {
      expect(canTransition(from, to), `${from} -> ${to}`).toBe(false);
    }
  }
});

test('an unknown to state is rejected for every known from', () => {
  const tos = ['nope', '', 'constructor', '__proto__', 'length'] as unknown as ApprovalState[];
  for (const from of APPROVAL_STATES) {
    for (const to of tos) {
      expect(canTransition(from, to), `${from} -> ${to}`).toBe(false);
    }
  }
});

test('non-string values are rejected', () => {
  const junk = [undefined, null, 0, {}, []] as unknown as ApprovalState[];
  for (const from of junk) expect(canTransition(from, 'sending')).toBe(false);
});
