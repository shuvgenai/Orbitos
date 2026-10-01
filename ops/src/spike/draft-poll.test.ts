import { expect, test, vi } from 'vitest';
import { pollForAgentBlock, type CommentSource } from './draft-poll.ts';

const VALID_DRAFT = [
  'Here is the draft.',
  '```json',
  JSON.stringify({
    kind: 'draft',
    schemaVersion: 1,
    draft: 'Thanks for reaching out. Happy to help with the lease review.',
    category: 'routine',
    flags: [],
    reason: 'standard enquiry, no commercial terms',
  }),
  '```',
].join('\n');

function harness(source: CommentSource, onCorrection = vi.fn(async () => {})) {
  let clock = 0;
  return {
    onCorrection,
    run: () =>
      pollForAgentBlock({
        source,
        expected: 'draft',
        onCorrection,
        intervalMs: 15_000,
        timeoutMs: 600_000,
        now: () => clock,
        sleep: async (ms: number) => {
          clock += ms;
        },
      }),
  };
}

test('an empty comment list reads as pending, not as a failure (Review Focus 5)', async () => {
  let calls = 0;
  const source: CommentSource = async () => {
    calls += 1;
    return calls < 3
      ? { ok: true, comments: [] }
      : { ok: true, comments: [{ id: 'c1', body: VALID_DRAFT, authorIsAgent: true }] };
  };
  const h = harness(source);
  await expect(h.run()).resolves.toMatchObject({ state: 'ok' });
  expect(h.onCorrection).not.toHaveBeenCalled();
});

test('a valid draft returns the parsed block', async () => {
  const source: CommentSource = async () => ({
    ok: true,
    comments: [{ id: 'c1', body: VALID_DRAFT, authorIsAgent: true }],
  });
  const result = await harness(source).run();
  expect(result).toMatchObject({ state: 'ok' });
  if (result.state === 'ok' && result.block.kind === 'draft') expect(result.block.category).toBe('routine');
});

test('a malformed draft is corrected exactly once, then gives up (D5)', async () => {
  let calls = 0;
  const source: CommentSource = async () => {
    calls += 1;
    return { ok: true, comments: [{ id: `c${calls}`, body: 'no json here', authorIsAgent: true }] };
  };
  const h = harness(source);
  const result = await h.run();
  expect(h.onCorrection).toHaveBeenCalledTimes(1);
  expect(result).toMatchObject({ state: 'invalid', corrected: true });
});

test('comments from the board, not the agent, are ignored', async () => {
  let calls = 0;
  const source: CommentSource = async () => {
    calls += 1;
    return calls === 1
      ? { ok: true, comments: [{ id: 'c1', body: 'owner note', authorIsAgent: false }] }
      : { ok: true, comments: [{ id: 'c2', body: VALID_DRAFT, authorIsAgent: true }] };
  };
  const h = harness(source);
  await expect(h.run()).resolves.toMatchObject({ state: 'ok' });
  expect(h.onCorrection).not.toHaveBeenCalled();
});

test('a 403 cross_issue_influence_run_context_required surfaces at once (Review Focus 4)', async () => {
  const source: CommentSource = async () => ({
    ok: false,
    status: 403,
    code: 'cross_issue_influence_run_context_required',
  });
  const h = harness(source);
  const result = await h.run();
  expect(result).toEqual({ state: 'error', status: 403, code: 'cross_issue_influence_run_context_required' });
  expect(h.onCorrection).not.toHaveBeenCalled();
});

test('silence past the timeout reads as timeout (D5)', async () => {
  const source: CommentSource = async () => ({ ok: true, comments: [] });
  await expect(harness(source).run()).resolves.toEqual({ state: 'timeout' });
});
