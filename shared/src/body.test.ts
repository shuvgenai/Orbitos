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
