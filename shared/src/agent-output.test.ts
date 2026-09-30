import { expect, test } from 'vitest';
import { MAX_COMMENT_CHARS, parseAgentComment } from './agent-output.ts';

const fence = (json: unknown) => '```json\n' + JSON.stringify(json, null, 2) + '\n```';

const draft = {
  kind: 'draft',
  schemaVersion: 1,
  draft: 'Hi Maya, thanks for reaching out about the audit.',
  category: 'routine',
  flags: [],
  reason: 'Routine intro request; no pricing mentioned.',
};
const verdict = { kind: 'verdict', schemaVersion: 1, verdict: 'lead', reason: 'Asks for a quote.' };

test('parses a valid draft wrapped in prose', () => {
  const r = parseAgentComment(`Here is my draft.\n\n${fence(draft)}\n\nDone.`, 'draft');
  expect(r).toEqual({ ok: true, block: draft });
});

test('parses a valid verdict', () => {
  expect(parseAgentComment(fence(verdict), 'verdict')).toEqual({ ok: true, block: verdict });
});

test('rejects a comment with no JSON block', () => {
  const r = parseAgentComment('I could not draft this.', 'draft');
  expect(r).toEqual({ ok: false, error: 'no JSON block found' });
});

test('rejects more than one JSON block', () => {
  const r = parseAgentComment(`${fence(draft)}\n${fence(draft)}`, 'draft');
  expect(r).toEqual({ ok: false, error: 'more than one JSON block found' });
});

test('rejects invalid JSON', () => {
  const r = parseAgentComment('```json\n{ "kind": "draft", \n```', 'draft');
  expect(r.ok).toBe(false);
  if (!r.ok) expect(r.error).toMatch(/^invalid JSON/);
});

test('rejects unknown keys (strict schema)', () => {
  const r = parseAgentComment(fence({ ...draft, sendNow: true }), 'draft');
  expect(r.ok).toBe(false);
});

test('rejects a multi-line reason', () => {
  expect(parseAgentComment(fence({ ...draft, reason: 'line one\nline two' }), 'draft').ok).toBe(false);
  // U+2028 LINE SEPARATOR
  expect(parseAgentComment(fence({ ...draft, reason: 'line one\u2028line two' }), 'draft').ok).toBe(false);
});

test('rejects an empty draft and an unknown category', () => {
  expect(parseAgentComment(fence({ ...draft, draft: '   ' }), 'draft').ok).toBe(false);
  expect(parseAgentComment(fence({ ...draft, category: 'urgent' }), 'draft').ok).toBe(false);
});

test('rejects a verdict where a draft was expected', () => {
  const r = parseAgentComment(fence(verdict), 'draft');
  expect(r).toEqual({ ok: false, error: 'expected a draft block, got verdict' });
});

test('rejects an oversized comment before parsing', () => {
  const r = parseAgentComment('x'.repeat(MAX_COMMENT_CHARS + 1), 'draft');
  expect(r).toEqual({ ok: false, error: `comment longer than ${MAX_COMMENT_CHARS} characters` });
});

test.each([0x0a, 0x0d, 0x0b, 0x0c, 0x09, 0x85, 0x2028, 0x2029, 0x202e, 0x200b])(
  "rejects a reason containing control/separator U+%s",
  (cp) => {
    const reason = "line one" + String.fromCodePoint(cp) + "line two";
    expect(parseAgentComment(fence({ ...draft, reason }), "draft").ok).toBe(false);
    expect(parseAgentComment(fence({ ...verdict, reason }), "verdict").ok).toBe(false);
  },
);

test("a multi-line draft body is still accepted", () => {
  const r = parseAgentComment(fence({ ...draft, draft: ["Hi Maya,", "", "Thanks.", "", "Best"].join(String.fromCharCode(10)) }), "draft");
  expect(r.ok).toBe(true);
});
