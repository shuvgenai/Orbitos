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

import { JobKind, JobState, TimerKind } from '../src/generated/prisma/enums.ts';
import { JOB_KINDS, JOB_STATES, TIMER_KINDS } from '@orbit/shared/jobs';

test('job and timer enums match the shared contract', () => {
  expect(Object.values(JobKind)).toEqual([...JOB_KINDS]);
  expect(Object.values(JobState)).toEqual([...JOB_STATES]);
  expect(Object.values(TimerKind)).toEqual([...TIMER_KINDS]);
});
