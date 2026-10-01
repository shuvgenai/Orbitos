import type { BodyPart } from '../body.ts';
import type { GmailMessage, GmailPort, HistoryPage, SendArgs } from './port.ts';

const API = 'https://gmail.googleapis.com/gmail/v1/users/me';

/** Thrown for any non-2xx Gmail response. Callers branch on `status`: 401/403 mean a revoked token, 429/5xx are retryable. */
export class GmailApiError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = 'GmailApiError';
    this.status = status;
  }
}

export function buildRaw(args: SendArgs): string {
  const headers = [
    `To: ${args.toEmail}`,
    `Subject: ${args.subject}`,
    `X-Orbitcrew-Id: ${args.orbitcrewId}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=utf-8',
  ];
  return Buffer.from(`${headers.join('\r\n')}\r\n\r\n${args.body}`, 'utf8').toString('base64url');
}

/** Splits a From header into a bare lowercase address and an optional display name. */
export function parseFrom(header: string): { fromEmail: string; fromName?: string } {
  const angle = /<([^<>]*)>\s*$/.exec(header);
  const address = (angle ? angle[1]! : header).trim().toLowerCase();
  const name = angle
    ? header
        .slice(0, angle.index)
        .trim()
        .replace(/^"(.*)"$/, '$1')
        .trim()
    : '';
  return name ? { fromEmail: address, fromName: name } : { fromEmail: address };
}

type ApiPart = {
  mimeType?: string;
  headers?: { name: string; value: string }[];
  body?: { data?: string; attachmentId?: string };
  parts?: ApiPart[];
};
type ApiMessage = {
  id: string;
  threadId: string;
  internalDate?: string;
  payload?: ApiPart;
};

function collectParts(part: ApiPart, out: BodyPart[]): void {
  const mimeType = part.mimeType ?? 'application/octet-stream';
  if (part.parts?.length) {
    for (const child of part.parts) collectParts(child, out);
    return;
  }
  const data = part.body?.data;
  out.push(data === undefined ? { mimeType } : { mimeType, text: Buffer.from(data, 'base64url').toString('utf8') });
}

function toMessage(m: ApiMessage): GmailMessage {
  const headers: Record<string, string> = {};
  for (const h of m.payload?.headers ?? []) headers[h.name] = h.value;
  const lookup = (name: string): string =>
    Object.entries(headers).find(([k]) => k.toLowerCase() === name)?.[1] ?? '';
  const parts: BodyPart[] = [];
  if (m.payload) collectParts(m.payload, parts);
  return {
    gmailMessageId: m.id,
    gmailThreadId: m.threadId,
    messageId: lookup('message-id'),
    ...parseFrom(lookup('from')),
    subject: lookup('subject'),
    receivedAt: new Date(Number(m.internalDate ?? 0)),
    headers,
    parts,
  };
}

export function createGmailClient(deps: {
  accessToken: () => Promise<string>;
  fetch?: typeof fetch;
}): GmailPort {
  const doFetch = deps.fetch ?? fetch;

  async function call(path: string, init?: RequestInit): Promise<Response> {
    const res = await doFetch(`${API}${path}`, {
      ...init,
      headers: { ...init?.headers, authorization: `Bearer ${await deps.accessToken()}` },
    });
    return res;
  }

  async function ok(res: Response, what: string): Promise<unknown> {
    if (!res.ok) throw new GmailApiError(res.status, `Gmail ${what} failed with status ${res.status}`);
    return res.json();
  }

  async function getMessage(id: string): Promise<GmailMessage | null> {
    const res = await call(`/messages/${encodeURIComponent(id)}?format=full`);
    if (res.status === 404) return null; // deleted between listing and fetching
    return toMessage((await ok(res, 'messages.get')) as ApiMessage);
  }

  async function fetchAll(ids: string[]): Promise<GmailMessage[]> {
    const messages: GmailMessage[] = [];
    for (const id of ids) {
      const m = await getMessage(id);
      if (m) messages.push(m);
    }
    return messages;
  }

  return {
    async listSince(historyId) {
      const ids = new Set<string>();
      let latest = historyId;
      let pageToken: string | undefined;
      do {
        const qs = new URLSearchParams({ startHistoryId: historyId, historyTypes: 'messageAdded' });
        if (pageToken) qs.set('pageToken', pageToken);
        const res = await call(`/history?${qs}`);
        if (res.status === 404) return { expired: true };
        const data = (await ok(res, 'history.list')) as {
          history?: { messagesAdded?: { message: { id: string } }[] }[];
          historyId?: string;
          nextPageToken?: string;
        };
        for (const h of data.history ?? []) for (const a of h.messagesAdded ?? []) ids.add(a.message.id);
        latest = data.historyId ?? latest;
        pageToken = data.nextPageToken;
      } while (pageToken);
      return { messages: await fetchAll([...ids]), historyId: latest };
    },

    async listByDate(since): Promise<HistoryPage> {
      const ids: string[] = [];
      let pageToken: string | undefined;
      do {
        const qs = new URLSearchParams({ q: `after:${Math.floor(since.getTime() / 1000)} in:inbox` });
        if (pageToken) qs.set('pageToken', pageToken);
        const data = (await ok(await call(`/messages?${qs}`), 'messages.list')) as {
          messages?: { id: string }[];
          nextPageToken?: string;
        };
        for (const m of data.messages ?? []) ids.push(m.id);
        pageToken = data.nextPageToken;
      } while (pageToken);
      const profile = (await ok(await call('/profile'), 'getProfile')) as { historyId: string };
      return { messages: await fetchAll(ids), historyId: profile.historyId };
    },

    async sendInThread(args) {
      const res = await call('/messages/send', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ raw: buildRaw(args), threadId: args.gmailThreadId }),
      });
      const data = (await ok(res, 'messages.send')) as { id: string };
      return { gmailMessageId: data.id };
    },

    async findSentByTag(orbitcrewId, opts) {
      const hasTag = (m: ApiMessage): boolean =>
        m.payload?.headers?.some((h) => h.name.toLowerCase() === 'x-orbitcrew-id' && h.value === orbitcrewId) ?? false;
      const metaQs = new URLSearchParams({ format: 'metadata', metadataHeaders: 'X-Orbitcrew-Id' });

      // Preferred: a reply we sent always lives in the lead's thread, so this is bounded and complete.
      if (opts?.gmailThreadId) {
        const res = await call(`/threads/${encodeURIComponent(opts.gmailThreadId)}?${metaQs}`);
        if (res.status === 404) return null;
        const thread = (await ok(res, 'threads.get')) as { messages?: ApiMessage[] };
        const hit = (thread.messages ?? []).find(hasTag);
        return hit ? { gmailMessageId: hit.id } : null;
      }

      // Fallback: Gmail search cannot match custom headers, so scan recent sent mail. Best-effort only:
      // bounded by the scan size (50), so a tag older than that is missed. Pass gmailThreadId when known.
      const list = (await ok(
        await call(`/messages?${new URLSearchParams({ labelIds: 'SENT', maxResults: '50' })}`),
        'messages.list',
      )) as { messages?: { id: string }[] };
      for (const { id } of list.messages ?? []) {
        const res = await call(`/messages/${encodeURIComponent(id)}?${metaQs}`);
        if (res.status === 404) continue;
        const m = (await ok(res, 'messages.get')) as ApiMessage;
        if (hasTag(m)) return { gmailMessageId: m.id };
      }
      return null;
    },
  };
}
