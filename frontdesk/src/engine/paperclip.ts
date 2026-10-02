import type { EnginePort } from './port.ts';

/**
 * Thrown for any non-2xx Paperclip answer, and for a 2xx that lacks what we need. Callers branch on `status`.
 * The message carries the status only, never the response body, which can echo the lead's text.
 */
export class PaperclipError extends Error {
  readonly status: number;
  constructor(status: number, what: string) {
    super(`Paperclip ${what} failed with status ${status}`);
    this.name = 'PaperclipError';
    this.status = status;
  }
}

export type PaperclipConfig = {
  baseUrl: string;
  apiKey: string;
  companyId: string;
  agentIds: { scout: string; orbi: string };
  fetch?: typeof fetch;
  /** Per request, so a hung socket fails the job attempt instead of wedging the loop. Default 20 s. */
  timeoutMs?: number;
};

type ApiComment = { id: string; body: string; createdAt?: string };

const MAX_COMMENT_PAGES = 20;

export function createPaperclipEngine(cfg: PaperclipConfig): EnginePort {
  const doFetch = cfg.fetch ?? fetch;
  const base = cfg.baseUrl.replace(/\/+$/, '');

  async function call(path: string, init: { method?: string; body?: unknown } = {}): Promise<Response> {
    return doFetch(`${base}${path}`, {
      method: init.method ?? 'GET',
      headers: { authorization: `Bearer ${cfg.apiKey}`, 'content-type': 'application/json' },
      ...(init.body === undefined ? {} : { body: JSON.stringify(init.body) }),
      signal: AbortSignal.timeout(cfg.timeoutMs ?? 20_000),
    });
  }

  return {
    async createIssue({ assignee, title, body }) {
      const res = await call(`/api/companies/${encodeURIComponent(cfg.companyId)}/issues`, {
        method: 'POST',
        body: { title, description: body, status: 'todo', priority: 'high', assigneeAgentId: cfg.agentIds[assignee] },
      });
      if (!res.ok) throw new PaperclipError(res.status, 'create issue');
      const json = (await res.json().catch(() => ({}))) as { id?: unknown; issue?: { id?: unknown } };
      const id = json.id ?? json.issue?.id;
      if (typeof id !== 'string' || id === '') throw new PaperclipError(res.status, 'create issue (no id returned)');
      return { issueId: id };
    },

    // EnginePort contract: oldest first. Ask for it, follow the cursor, and re-sort by time if the
    // server ignored `order`, because the draft poll picks the newest valid draft from this order.
    async comments(issueId) {
      const seen = new Set<string>();
      const all: ApiComment[] = [];
      let after: string | undefined;
      for (let page = 0; page < MAX_COMMENT_PAGES; page += 1) {
        const qs = new URLSearchParams({ order: 'asc' });
        if (after) qs.set('afterCommentId', after);
        const res = await call(`/api/issues/${encodeURIComponent(issueId)}/comments?${qs}`);
        if (!res.ok) throw new PaperclipError(res.status, 'list comments');
        const json = (await res.json()) as { comments?: ApiComment[]; items?: ApiComment[] };
        const fresh = (json.comments ?? json.items ?? []).filter((c) => !seen.has(c.id));
        if (fresh.length === 0) break; // empty page, or a server that ignores the cursor
        for (const c of fresh) {
          seen.add(c.id);
          all.push(c);
        }
        after = fresh[fresh.length - 1]!.id;
      }
      // Never guess the order: the draft poll picks the newest valid draft from it. Without a usable timestamp on every
      // comment we cannot verify the server honoured `order`, so fail loudly rather than hand back a possibly reversed list.
      const times = all.map((c) => (typeof c.createdAt === 'string' ? Date.parse(c.createdAt) : Number.NaN));
      if (times.some(Number.isNaN)) throw new PaperclipError(502, 'list comments (missing or unreadable createdAt)');
      return all
        .map((c, i) => ({ body: c.body, t: times[i]!, i }))
        .sort((a, b) => a.t - b.t || a.i - b.i) // stable on ties
        .map((c) => c.body);
    },

    // reopen: the issue sits blocked after Scout's draft; a comment alone would not wake the agent.
    async comment(issueId, text) {
      const res = await call(`/api/issues/${encodeURIComponent(issueId)}/comments`, {
        method: 'POST',
        body: { body: text, reopen: true },
      });
      if (!res.ok) throw new PaperclipError(res.status, 'post comment');
    },
  };
}
