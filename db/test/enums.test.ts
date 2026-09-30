import { expect, test } from 'vitest';
import { ApprovalCategory, ApprovalState } from '../src/generated/prisma/enums.ts';
import { APPROVAL_CATEGORIES, APPROVAL_STATES } from '@orbit/shared/approvals';

// The shared contract and the database enums must never drift apart.
test('approval states match the shared contract', () => {
  expect(Object.values(ApprovalState)).toEqual([...APPROVAL_STATES]);
});

test('approval categories match the shared contract', () => {
  expect(Object.values(ApprovalCategory)).toEqual([...APPROVAL_CATEGORIES]);
});
