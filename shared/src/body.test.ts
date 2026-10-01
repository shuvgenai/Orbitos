import { expect, test } from 'vitest';
import { cleanBody, MAX_MODEL_BODY_CHARS, stripQuotedAndSignature } from './body.ts';

test('the plain text part wins over HTML', () => {
  const parts = [
    { mimeType: 'text/html', text: '<p>markup</p>' },
    { mimeType: 'text/plain', text: 'plain words' },
  ];
  expect(cleanBody(parts)).toBe('plain words');
});

test('an HTML-only message yields text, not markup', () => {
  const parts = [{ mimeType: 'text/html', text: '<p>Hello <b>there</b></p>' }];
  expect(cleanBody(parts)).toBe('Hello there');
});

test('a message with no text part at all yields an empty string', () => {
  expect(cleanBody([{ mimeType: 'application/pdf', text: '' }])).toBe('');
  expect(cleanBody([])).toBe('');
});

test('quoted history and a signature are removed', () => {
  const text = [
    'Can you quote for an audit?',
    '',
    '-- ',
    'Maya Okafor, Okafor Ltd',
    '',
    'On Tue, 30 Sep 2026 at 09:12, Owner <owner@example.com> wrote:',
    '> earlier message',
  ].join('\n');
  expect(stripQuotedAndSignature(text)).toBe('Can you quote for an audit?');
});

test('the body is truncated at the one shared limit', () => {
  const long = 'x'.repeat(MAX_MODEL_BODY_CHARS + 500);
  expect(cleanBody([{ mimeType: 'text/plain', text: long }])).toHaveLength(MAX_MODEL_BODY_CHARS);
});

// Regression tests for the six defects

test('Finding 1: undefined text does not throw', () => {
  const parts = [{ mimeType: 'text/plain', text: undefined }];
  expect(() => cleanBody(parts)).not.toThrow();
  expect(cleanBody(parts)).toBe('');
});

test('Finding 1: empty text/plain falls through to populated HTML', () => {
  const parts = [
    { mimeType: 'text/plain', text: '' },
    { mimeType: 'text/html', text: '<p>HTML content</p>' },
  ];
  expect(cleanBody(parts)).toBe('HTML content');
});

test('Finding 6: MIME type matching is normalized (charset parameter)', () => {
  const parts = [{ mimeType: 'text/plain; charset=utf-8', text: 'hello' }];
  expect(cleanBody(parts)).toBe('hello');
});

test('Finding 6: MIME type matching is case-insensitive', () => {
  const parts = [{ mimeType: 'Text/Plain', text: 'hello' }];
  expect(cleanBody(parts)).toBe('hello');
});

test('Finding 3: script block contents do not survive', () => {
  const parts = [
    {
      mimeType: 'text/html',
      text: '<p>Good</p><script>alert("xss")</script><p>Also good</p>',
    },
  ];
  const result = cleanBody(parts);
  expect(result).toContain('Good');
  expect(result).toContain('Also good');
  expect(result).not.toContain('xss');
});

test('Finding 3: style block contents do not survive', () => {
  const parts = [
    {
      mimeType: 'text/html',
      text: '<p>Text</p><style>body { display: none; }</style>',
    },
  ];
  expect(cleanBody(parts)).toBe('Text');
  expect(cleanBody(parts)).not.toContain('display');
});

test('Finding 4: entity decoding order - &amp;lt; becomes &lt;', () => {
  const parts = [{ mimeType: 'text/html', text: 'Code: &amp;lt;tag&amp;gt;' }];
  expect(cleanBody(parts)).toBe('Code: &lt;tag&gt;');
});

test('Fix Round 2-A: 200k character < input in HTML finishes promptly (not superlinear)', () => {
  const parts = [{ mimeType: 'text/html', text: '<'.repeat(200_000) }];
  const start = Date.now();
  const result = cleanBody(parts);
  const elapsed = Date.now() - start;
  expect(elapsed).toBeLessThan(500); // Should finish in under 500ms
  expect(result).toHaveLength(MAX_MODEL_BODY_CHARS);
});

test('Fix Round 2-A: repeated <script> tags finish promptly', () => {
  const html = '<script>'.repeat(5000);
  const parts = [{ mimeType: 'text/html', text: html }];
  const start = Date.now();
  const result = cleanBody(parts);
  const elapsed = Date.now() - start;
  expect(elapsed).toBeLessThan(500); // Should finish promptly
  expect(result).toBe('');
});

test('Fix Round 2-A: repeated <!-- comment --> finishes promptly', () => {
  const html = '<!-- comment -->'.repeat(100) + '<p>Real text</p>';
  const parts = [{ mimeType: 'text/html', text: html }];
  const start = Date.now();
  const result = cleanBody(parts);
  const elapsed = Date.now() - start;
  expect(elapsed).toBeLessThan(500); // Should finish promptly
  expect(result).toBe('Real text');
});

test('Finding 5: uncorroborated "On Friday you wrote:" keeps text after it', () => {
  const text = [
    'On Friday you wrote:',
    'But I think we should do this instead.',
    'Let me know if you can help.',
  ].join('\n');
  expect(stripQuotedAndSignature(text)).toBe(text);
});

test('Finding 5: corroborated quote marker cuts the text', () => {
  const text = [
    'Can you revise this?',
    'On Monday at 10am, Bob <bob@example.com> wrote:',
    '> Here is the original',
    '> More original',
  ].join('\n');
  expect(stripQuotedAndSignature(text)).toBe('Can you revise this?');
});

test('Finding 5: interior > lines (not at the end) survive', () => {
  const text = [
    '> $5k budget',
    'And the deadline is soon',
    'More details here',
    '>',
    '> Original message here',
  ].join('\n');
  const result = stripQuotedAndSignature(text);
  expect(result).toContain('> $5k budget');
  expect(result).toContain('deadline');
  expect(result).not.toContain('Original message');
});

test('Finding 5: trailing contiguous quoted block is dropped', () => {
  const text = [
    'Please confirm receipt.',
    '',
    '> On Thu, someone wrote:',
    '> > Original message',
    '> > More original',
  ].join('\n');
  expect(stripQuotedAndSignature(text)).toBe('Please confirm receipt.');
});

test('Finding 5: CRLF signature is stripped', () => {
  const text = 'Hello\r\n-- \r\nMy Name';
  expect(stripQuotedAndSignature(text)).toBe('Hello');
});

test('Finding 4: numeric entities are decoded', () => {
  const parts = [{ mimeType: 'text/html', text: '&#65; &#x42;' }];
  expect(cleanBody(parts)).toBe('A B');
});

test('Finding 4: &quot; and &#39; are decoded', () => {
  const parts = [{ mimeType: 'text/html', text: '&quot;hello&quot; &#39;world&#39;' }];
  expect(cleanBody(parts)).toBe('"hello" \'world\'');
});

test('Fix Round 2: whitespace-only text/plain falls through to HTML', () => {
  const parts = [
    { mimeType: 'text/plain', text: '   \n  \t  ' },
    { mimeType: 'text/html', text: '<p>HTML content</p>' },
  ];
  expect(cleanBody(parts)).toBe('HTML content');
});

test('Fix Round 2-B: numeric entity out of range left as literal', () => {
  const parts = [{ mimeType: 'text/html', text: '&#1114112; is out of range' }];
  const result = cleanBody(parts);
  expect(result).toContain('&#1114112;');
});

test('Fix Round 2-C: reply with trailing quoted block and blank line', () => {
  const text = [
    'reply',
    '> quoted',
    '',
  ].join('\n');
  expect(stripQuotedAndSignature(text)).toBe('reply');
});

test('Fix Round 2-C: reply with signature after quoted block', () => {
  const text = [
    'reply',
    '> q',
    '',
    '-- ',
    'sig',
  ].join('\n');
  expect(stripQuotedAndSignature(text)).toBe('reply');
});
