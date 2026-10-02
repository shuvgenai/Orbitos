import { expect, test, vi } from 'vitest';
import { createPaperclipEngine, PaperclipError } from './paperclip.ts';

const cfg = {
  baseUrl: 'http://paperclip:3100/',
  apiKey: 'key-1',
  companyId: 'co-1',
  agentIds: { scout: 'agent-scout', orbi: 'agent-orbi' },
};
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status });

test('createIssue posts to the company, assigns the named agent and returns the id', async () => {
  const fetch = vi.fn().mockResolvedValue(json(201, { id: 'iss-1' }));
  const engine = createPaperclipEngine({ ...cfg, fetch });
  expect(await engine.createIssue({ assignee: 'scout', title: 'Lead: x', body: 'hello' })).toEqual({ issueId: 'iss-1' });
  const [url, init] = fetch.mock.calls[0]!;
  expect(url).toBe('http://paperclip:3100/api/companies/co-1/issues');
  expect(init.method).toBe('POST');
  expect(init.headers.authorization).toBe('Bearer key-1');
  expect(JSON.parse(init.body)).toMatchObject({
    title: 'Lead: x', description: 'hello', status: 'todo', assigneeAgentId: 'agent-scout',
  });
});

test('createIssue accepts the id nested under issue, and routes orbi to its own agent', async () => {
  const fetch = vi.fn().mockResolvedValue(json(200, { issue: { id: 'iss-2' } }));
  const engine = createPaperclipEngine({ ...cfg, fetch });
  expect(await engine.createIssue({ assignee: 'orbi', title: 't', body: 'b' })).toEqual({ issueId: 'iss-2' });
  expect(JSON.parse(fetch.mock.calls[0]![1].body).assigneeAgentId).toBe('agent-orbi');
});

test('a non-2xx answer throws an error carrying the status and none of the response body', async () => {
  const fetch = vi.fn().mockResolvedValue(json(503, { error: 'secret lead text' }));
  const engine = createPaperclipEngine({ ...cfg, fetch });
  const err = await engine.createIssue({ assignee: 'scout', title: 't', body: 'b' }).catch((e: unknown) => e);
  expect(err).toBeInstanceOf(PaperclipError);
  expect((err as PaperclipError).status).toBe(503);
  expect((err as Error).message).not.toContain('secret lead text');
});

test('a 2xx answer with no issue id is an error, not an undefined id', async () => {
  const engine = createPaperclipEngine({ ...cfg, fetch: vi.fn().mockResolvedValue(json(200, {})) });
  await expect(engine.createIssue({ assignee: 'scout', title: 't', body: 'b' })).rejects.toBeInstanceOf(PaperclipError);
});

test('comments asks for ascending order and returns bodies oldest first', async () => {
  const fetch = vi.fn()
    .mockResolvedValueOnce(json(200, { comments: [{ id: 'c1', body: 'first' }, { id: 'c2', body: 'second' }] }))
    .mockResolvedValueOnce(json(200, { comments: [] }));
  const engine = createPaperclipEngine({ ...cfg, fetch });
  expect(await engine.comments('iss-1')).toEqual(['first', 'second']);
  const url = new URL(fetch.mock.calls[0]![0]);
  expect(url.pathname).toBe('/api/issues/iss-1/comments');
  expect(url.searchParams.get('order')).toBe('asc');
});

test('comments re-sorts by createdAt when the server ignores the order parameter', async () => {
  const fetch = vi.fn()
    .mockResolvedValueOnce(json(200, { items: [
      { id: 'c2', body: 'new', createdAt: '2026-10-01T10:05:00Z' },
      { id: 'c1', body: 'old', createdAt: '2026-10-01T10:00:00Z' },
    ] }))
    .mockResolvedValueOnce(json(200, { items: [] }));
  const engine = createPaperclipEngine({ ...cfg, fetch });
  expect(await engine.comments('iss-1')).toEqual(['old', 'new']);
});

test('comments follows pages with afterCommentId and stops when a page adds nothing new', async () => {
  const fetch = vi.fn()
    .mockResolvedValueOnce(json(200, { comments: [{ id: 'c1', body: 'a' }] }))
    .mockResolvedValueOnce(json(200, { comments: [{ id: 'c2', body: 'b' }] }))
    .mockResolvedValueOnce(json(200, { comments: [{ id: 'c2', body: 'b' }] })); // server ignores the cursor
  const engine = createPaperclipEngine({ ...cfg, fetch });
  expect(await engine.comments('iss-1')).toEqual(['a', 'b']);
  expect(new URL(fetch.mock.calls[1]![0]).searchParams.get('afterCommentId')).toBe('c1');
  expect(fetch).toHaveBeenCalledTimes(3);
});

test('comments carries the status on a failure', async () => {
  const engine = createPaperclipEngine({ ...cfg, fetch: vi.fn().mockResolvedValue(json(404, {})) });
  await expect(engine.comments('nope')).rejects.toMatchObject({ name: 'PaperclipError', status: 404 });
});

test('comment posts the text and reopens the issue so the agent is woken', async () => {
  const fetch = vi.fn().mockResolvedValue(json(201, {}));
  await createPaperclipEngine({ ...cfg, fetch }).comment('iss-1', 'please fix');
  const [url, init] = fetch.mock.calls[0]!;
  expect(url).toBe('http://paperclip:3100/api/issues/iss-1/comments');
  expect(JSON.parse(init.body)).toEqual({ body: 'please fix', reopen: true });
});

test('the issue id is encoded into the path', async () => {
  const fetch = vi.fn().mockResolvedValue(json(201, {}));
  await createPaperclipEngine({ ...cfg, fetch }).comment('a/b', 'x');
  expect(fetch.mock.calls[0]![0]).toBe('http://paperclip:3100/api/issues/a%2Fb/comments');
});
