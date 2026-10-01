// The comment poll from Eng v3 D5: every 15 s until a valid agent block arrives, one corrective
// comment on a malformed block, and a 10-minute ceiling. Clock and sleep are injected so tests run
// instantly and E3-T3 can drive it from a worker job.
import { parseAgentComment, type Draft, type Verdict } from '../../../shared/src/agent-output.ts';

export type Comment = { id: string; body: string; authorIsAgent: boolean };
export type CommentSource = (
  afterCommentId: string | undefined,
) => Promise<{ ok: true; comments: Comment[] } | { ok: false; status: number; code?: string }>;

export type PollOutcome =
  | { state: 'ok'; block: Draft | Verdict }
  | { state: 'invalid'; error: string; corrected: boolean }
  | { state: 'timeout' }
  | { state: 'error'; status: number; code?: string };

export async function pollForAgentBlock(opts: {
  source: CommentSource;
  expected: 'draft' | 'verdict';
  onCorrection: (error: string) => Promise<void>;
  intervalMs: number;
  timeoutMs: number;
  now: () => number;
  sleep: (ms: number) => Promise<void>;
}): Promise<PollOutcome> {
  const deadline = opts.now() + opts.timeoutMs;
  let after: string | undefined;
  let corrected = false;

  while (opts.now() < deadline) {
    const page = await opts.source(after);
    // An API refusal is a broken setup, not a slow agent: surface it instead of waiting out the
    // timeout, which would hide the real cause behind a generic hand-off to Orbi.
    if (!page.ok) return { state: 'error', status: page.status, code: page.code };

    for (const comment of page.comments) {
      after = comment.id;
      if (!comment.authorIsAgent) continue;

      const parsed = parseAgentComment(comment.body, opts.expected);
      if (parsed.ok) return { state: 'ok', block: parsed.block };

      if (corrected) return { state: 'invalid', error: parsed.error, corrected: true };
      corrected = true;
      await opts.onCorrection(parsed.error);
    }

    await opts.sleep(opts.intervalMs);
  }

  return { state: 'timeout' };
}
