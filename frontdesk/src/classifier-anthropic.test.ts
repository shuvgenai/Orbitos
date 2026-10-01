import { expect, test, vi } from 'vitest';
import { createAnthropicClassifier, HAIKU_INPUT_USD_PER_MTOK, HAIKU_OUTPUT_USD_PER_MTOK } from './classifier-anthropic.ts';

function reply(text: string, usage = { input_tokens: 1000, output_tokens: 20 }, status = 200) {
  const body =
    status === 200
      ? { id: 'msg_1', type: 'message', role: 'assistant', model: 'claude-haiku-4-5', content: [{ type: 'text', text }], stop_reason: 'end_turn', stop_sequence: null, usage }
      : { type: 'error', error: { type: 'api_error', message: 'boom' } };
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}
const make = (fetchMock: unknown) => createAnthropicClassifier({ apiKey: 'test-key', fetch: fetchMock as typeof fetch });

test('sends the pinned model, a json_schema format, and no thinking or effort', async () => {
  const fetchMock = vi.fn().mockResolvedValue(reply('{"verdict":"lead","confidence":0.9}'));
  await make(fetchMock).ask('quote me please', new AbortController().signal);
  const body = JSON.parse(String((fetchMock.mock.calls[0]![1] as RequestInit).body));
  expect(body.model).toBe('claude-haiku-4-5');
  expect(body.max_tokens).toBe(256);
  expect(body.thinking).toBeUndefined();
  expect(body.output_config.effort).toBeUndefined();
  expect(body.output_config.format.type).toBe('json_schema');
  expect(JSON.stringify(body.messages)).toContain('quote me please');
});

test('returns the verdict with tokens and cost from the usage block', async () => {
  const fetchMock = vi.fn().mockResolvedValue(reply('{"verdict":"not_lead","confidence":0.8}', { input_tokens: 2000, output_tokens: 10 }));
  const out = await make(fetchMock).ask('x', new AbortController().signal);
  expect(out).toMatchObject({ verdict: 'not_lead', confidence: 0.8, inputTokens: 2000, outputTokens: 10 });
  // 2000 in at $1/MTok + 10 out at $5/MTok = 2050 / 1e6. The default 2-digit tolerance would pass for 0.
  expect(out.costUsd).toBeCloseTo(0.00205, 8);
  expect(HAIKU_INPUT_USD_PER_MTOK).toBe(1);
  expect(HAIKU_OUTPUT_USD_PER_MTOK).toBe(5);
});

test.each([
  ['not json', 'I think this is a lead'],
  ['unknown verdict', '{"verdict":"maybe","confidence":0.5}'],
  ['confidence out of range', '{"verdict":"lead","confidence":7}'],
  ['missing confidence', '{"verdict":"lead"}'],
])('untrusted output is rejected: %s', async (_name, text) => {
  const fetchMock = vi.fn().mockResolvedValue(reply(text));
  await expect(make(fetchMock).ask('x', new AbortController().signal)).rejects.toThrow();
});

test('an upstream error throws and the SDK does not retry on its own', async () => {
  const fetchMock = vi.fn().mockImplementation(async () => reply('', undefined, 500));
  await expect(make(fetchMock).ask('x', new AbortController().signal)).rejects.toThrow();
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

test('an aborted signal cancels the request', async () => {
  let seen: AbortSignal | undefined;
  const fetchMock = vi.fn().mockImplementation(
    (_u: unknown, init: RequestInit) =>
      new Promise((_res, rej) => {
        seen = init.signal ?? undefined;
        init.signal?.addEventListener('abort', () => rej(Object.assign(new Error('aborted'), { name: 'AbortError' })));
      }),
  );
  const ac = new AbortController();
  const p = make(fetchMock).ask('x', ac.signal);
  await new Promise((r) => setTimeout(r, 10));
  ac.abort();
  await expect(p).rejects.toThrow();
  expect(seen?.aborted).toBe(true);
});
