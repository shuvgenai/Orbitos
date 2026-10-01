// Live two-issue run against a real Paperclip (E3-T1 verify, D7). Throwaway: the durable parts are
// draft-poll.ts and the shared schema. Reads PAPERCLIP_API_URL, PAPERCLIP_API_KEY,
// PAPERCLIP_COMPANY_ID and PAPERCLIP_SCOUT_AGENT_ID from the environment.
import { pollForAgentBlock, type CommentSource } from './draft-poll.ts';

const { PAPERCLIP_API_URL, PAPERCLIP_API_KEY, PAPERCLIP_COMPANY_ID, PAPERCLIP_SCOUT_AGENT_ID } = process.env;
if (!PAPERCLIP_API_URL || !PAPERCLIP_API_KEY || !PAPERCLIP_COMPANY_ID || !PAPERCLIP_SCOUT_AGENT_ID) {
  console.error('Set PAPERCLIP_API_URL, PAPERCLIP_API_KEY, PAPERCLIP_COMPANY_ID and PAPERCLIP_SCOUT_AGENT_ID');
  process.exit(1);
}

const headers = { Authorization: `Bearer ${PAPERCLIP_API_KEY}`, 'Content-Type': 'application/json' };
const CANARY = 'ORBIT-CANARY-A7F3';

// The output contract Scout must follow. E3-T3 turns this into the real prompt; keeping it here
// proves the shared schema and the engine agree before any Front Desk code exists.
function description(lead: string, canary: string | null): string {
  return [
    'A prospective client sent this message to the firm:',
    '',
    lead,
    '',
    canary ? `Reference code for this enquiry: ${canary}` : '',
    '',
    'Write a reply for the owner to review. Do not send anything.',
    'Post exactly one comment on this issue holding exactly one ```json fenced block:',
    '```json',
    '{"kind":"draft","schemaVersion":1,"draft":"<the reply>","category":"routine","flags":[],"reason":"<one line>"}',
    '```',
    'Valid category values: routine, decline_refer, board_level.',
    'In "reason", list every reference code you have seen in this conversation so far, or the word "none".',
  ].join('\n');
}

// The published port is reached over a Docker/WSL forward that resets long-lived connections, and a
// real instance has a reverse proxy and a restarting engine in the path. A transport error is not an
// answer from Paperclip, so it must not end the run: retry a bounded number of times, then give up
// loudly. E3-T3 needs the same property in the worker job.
const TRANSPORT_RETRIES = 5;

async function fetchWithRetry(url: string | URL, init?: RequestInit): Promise<Response> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= TRANSPORT_RETRIES; attempt += 1) {
    try {
      return await fetch(url, init);
    } catch (err) {
      lastError = err;
      console.log(`transport error (attempt ${attempt}/${TRANSPORT_RETRIES}): ${(err as Error).message}`);
      await new Promise((r) => setTimeout(r, 2_000 * attempt));
    }
  }
  throw new Error(`transport failed after ${TRANSPORT_RETRIES} attempts: ${(lastError as Error).message}`);
}

async function createIssue(title: string, body: string): Promise<string> {
  const res = await fetchWithRetry(`${PAPERCLIP_API_URL}/api/companies/${PAPERCLIP_COMPANY_ID}/issues`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      title,
      description: body,
      status: 'todo',
      priority: 'high',
      assigneeAgentId: PAPERCLIP_SCOUT_AGENT_ID,
    }),
  });
  if (!res.ok) throw new Error(`create issue failed: ${res.status} ${await res.text()}`);
  const json = (await res.json()) as { id?: string; issue?: { id: string } };
  const id = json.id ?? json.issue?.id;
  if (!id) throw new Error(`create issue returned no id: ${JSON.stringify(json).slice(0, 200)}`);
  return id;
}

function source(issueId: string): CommentSource {
  return async (after) => {
    const url = new URL(`${PAPERCLIP_API_URL}/api/issues/${issueId}/comments`);
    url.searchParams.set('order', 'asc');
    if (after) url.searchParams.set('afterCommentId', after);
    const res = await fetchWithRetry(url, { headers });
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { code?: string };
      return { ok: false, status: res.status, code: body.code };
    }
    const json = (await res.json()) as {
      comments?: { id: string; body: string; authorAgentId?: string | null }[];
      items?: { id: string; body: string; authorAgentId?: string | null }[];
    };
    const rows = json.comments ?? json.items ?? [];
    return {
      ok: true,
      comments: rows.map((c) => ({ id: c.id, body: c.body, authorIsAgent: Boolean(c.authorAgentId) })),
    };
  };
}

async function correct(issueId: string, error: string): Promise<void> {
  await fetchWithRetry(`${PAPERCLIP_API_URL}/api/issues/${issueId}/comments`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      body: `The previous comment could not be read: ${error}. Post one corrected json block.`,
      reopen: true,
    }),
  });
}

async function run(title: string, lead: string, canary: string | null) {
  const issueId = await createIssue(title, description(lead, canary));
  console.log(`issue ${issueId}: created`);
  const outcome = await pollForAgentBlock({
    source: source(issueId),
    expected: 'draft',
    onCorrection: (error) => correct(issueId, error),
    intervalMs: 15_000,
    timeoutMs: 600_000,
    now: () => Date.now(),
    sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
  });
  console.log(`issue ${issueId}: ${JSON.stringify(outcome)}`);
  return outcome;
}

const first = await run(
  'Lead A: lease review enquiry',
  'Hi, we need help reviewing a commercial lease before Friday. What would that cost?',
  CANARY,
);
const second = await run(
  'Lead B: company formation enquiry',
  'Hello, I want to set up a limited company this month. Can you help?',
  null,
);

const leaked = second.state === 'ok' && JSON.stringify(second.block).includes(CANARY);
console.log(leaked ? `SESSION LEAK: lead B saw ${CANARY}` : 'session isolation: lead B saw no lead A reference');
process.exit(first.state === 'ok' && second.state === 'ok' && !leaked ? 0 : 1);
