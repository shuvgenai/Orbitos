import { z } from 'zod';
import { APPROVAL_CATEGORIES } from './approvals.ts';

// Frozen contract (PRD §18, FD-3, FD-3b): the JSON block Scout and Orbi post as a Paperclip comment.
// Agent output is untrusted (FD-2a): strict objects, bounded sizes, one block only.

export const MAX_COMMENT_CHARS = 20_000;

const oneLine = z
  .string()
  .trim()
  .min(1)
  .max(200)
  // One line only: rejects all control chars (Cc: CR, LF, tab, VT, FF, NEL), line/paragraph separators
  // (Zl, Zp) and format chars (Cf: bidi overrides such as U+202E, zero-width) that could spoof what the owner reads.
  .regex(/^[^\p{Cc}\p{Zl}\p{Zp}\p{Cf}]+$/u, 'must be a single line');

export const DRAFT_FLAGS = [
  'price',
  'fee',
  'discount',
  'contract_terms',
  'payment',
  'multiple_recipients',
  'commitment',
  'decline_or_refer',
] as const;

export const DraftBlock = z.strictObject({
  kind: z.literal('draft'),
  schemaVersion: z.literal(1),
  draft: z.string().trim().min(1).max(8_000),
  category: z.enum(APPROVAL_CATEGORIES),
  flags: z.array(z.enum(DRAFT_FLAGS)).max(DRAFT_FLAGS.length),
  reason: oneLine,
});
export type Draft = z.infer<typeof DraftBlock>;

export const VerdictBlock = z.strictObject({
  kind: z.literal('verdict'),
  schemaVersion: z.literal(1),
  verdict: z.enum(['lead', 'not_lead']),
  reason: oneLine,
});
export type Verdict = z.infer<typeof VerdictBlock>;

const AgentBlock = z.discriminatedUnion('kind', [DraftBlock, VerdictBlock]);

export type ParseResult = { ok: true; block: Draft | Verdict } | { ok: false; error: string };

const FENCE = /```json[ \t]*\r?\n([\s\S]*?)\r?\n```/g;

export function parseAgentComment(comment: string, expected: 'draft' | 'verdict'): ParseResult {
  if (comment.length > MAX_COMMENT_CHARS) {
    return { ok: false, error: `comment longer than ${MAX_COMMENT_CHARS} characters` };
  }
  const blocks = [...comment.matchAll(FENCE)].map((m) => m[1] ?? '');
  if (blocks.length === 0) return { ok: false, error: 'no JSON block found' };
  if (blocks.length > 1) return { ok: false, error: 'more than one JSON block found' };

  let raw: unknown;
  try {
    raw = JSON.parse(blocks[0]!);
  } catch (err) {
    return { ok: false, error: `invalid JSON: ${(err as Error).message}` };
  }

  const parsed = AgentBlock.safeParse(raw);
  if (!parsed.success) return { ok: false, error: z.prettifyError(parsed.error) };
  if (parsed.data.kind !== expected) {
    return { ok: false, error: `expected a ${expected} block, got ${parsed.data.kind}` };
  }
  return { ok: true, block: parsed.data };
}
