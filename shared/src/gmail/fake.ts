import { buildRaw, GmailApiError } from './client.ts';
import type { GmailMessage, GmailPort, HistoryPage, SendArgs } from './port.ts';

type Queued = { seq: number; message: GmailMessage };

export class FakeGmail implements GmailPort {
  readonly sent: { gmailThreadId: string; orbitcrewId: string; gmailMessageId: string; raw: string }[] = [];
  private readonly startHistoryId: number;
  private counter: number;
  private readonly queued: Queued[] = [];
  private sendFailsAfterAccepting = false;
  private afterAcceptingStatus: number | null = null;
  private sendFailure: { status: number } | null = null;
  private findFailure: { status: number } | null = null;
  private listFailure: { status: number; reason?: string } | null = null;

  constructor(opts: { historyId: string }) {
    this.startHistoryId = Number(opts.historyId);
    this.counter = this.startHistoryId;
  }

  /** Delivers a message to the inbox; each one advances the history id by one. */
  queue(message: GmailMessage): void {
    this.counter += 1;
    this.queued.push({ seq: this.counter, message });
  }

  /** The send is recorded, then the call fails. With a status it throws a status-bearing error (an ambiguous 5xx). */
  failNextSendAfterAccepting(opts?: { status: number }): void {
    this.sendFailsAfterAccepting = true;
    this.afterAcceptingStatus = opts?.status ?? null;
  }

  /** The send is rejected: nothing is recorded and the error carries the status. */
  failNextSendWith(opts: { status: number }): void {
    this.sendFailure = opts;
  }

  /** The next findSentByTag throws a status-bearing error (e.g. 404 or 500). */
  failNextFindWith(opts: { status: number }): void {
    this.findFailure = opts;
  }

  /** The next list call (either method) throws; `reason` mimics Gmail's error.errors[0].reason. */
  failNextListWith(opts: { status: number; reason?: string }): void {
    this.listFailure = opts;
  }

  private throwListFailure(): void {
    if (!this.listFailure) return;
    const { status, reason } = this.listFailure;
    this.listFailure = null;
    throw new GmailApiError(status, `Gmail list failed with status ${status}`, reason);
  }

  async listSince(historyId: string): Promise<HistoryPage | { expired: true }> {
    this.throwListFailure();
    const from = Number(historyId);
    // Fake-only convenience: real Gmail answers a malformed id with 400, not 404.
    if (!Number.isInteger(from) || from < this.startHistoryId) return { expired: true };
    return {
      messages: this.queued.filter((q) => q.seq > from).map((q) => q.message),
      historyId: String(this.counter),
    };
  }

  async listByDate(since: Date): Promise<HistoryPage> {
    this.throwListFailure();
    return {
      messages: this.queued.map((q) => q.message).filter((m) => m.receivedAt >= since),
      historyId: String(this.counter),
    };
  }

  async sendInThread(args: SendArgs): Promise<{ gmailMessageId: string }> {
    const raw = buildRaw(args); // validates exactly as the real client does
    if (this.sendFailure) {
      const { status } = this.sendFailure;
      this.sendFailure = null;
      throw new GmailApiError(status, `Gmail messages.send failed with status ${status}`);
    }
    const gmailMessageId = `sent-${this.sent.length + 1}`;
    this.sent.push({ gmailThreadId: args.gmailThreadId, orbitcrewId: args.orbitcrewId, gmailMessageId, raw });
    if (this.sendFailsAfterAccepting) {
      const status = this.afterAcceptingStatus;
      this.sendFailsAfterAccepting = false;
      this.afterAcceptingStatus = null;
      if (status !== null) throw new GmailApiError(status, `Gmail messages.send failed with status ${status}`);
      throw new Error('connection reset after Gmail accepted the message');
    }
    return { gmailMessageId };
  }

  async findSentByTag(
    orbitcrewId: string,
    opts?: { gmailThreadId?: string },
  ): Promise<{ gmailMessageId: string } | null> {
    if (this.findFailure) {
      const { status } = this.findFailure;
      this.findFailure = null;
      throw new GmailApiError(status, `Gmail find failed with status ${status}`);
    }
    const threadId = opts?.gmailThreadId;
    const hit = this.sent.find(
      (s) => s.orbitcrewId === orbitcrewId && (threadId === undefined || s.gmailThreadId === threadId),
    );
    return hit ? { gmailMessageId: hit.gmailMessageId } : null;
  }
}

let leadCounter = 0;

/** A written, synthetic lead. Never a real email. */
export function syntheticLead(overrides: Partial<GmailMessage> = {}): GmailMessage {
  leadCounter += 1;
  const n = leadCounter;
  const base = {
    gmailMessageId: `g-${n}`,
    gmailThreadId: `t-${n}`,
    messageId: `<lead-${n}@mail.example>`,
    fromEmail: 'maya@okafor.example',
    fromName: 'Maya Okafor' as string | undefined,
    subject: 'Audit quote',
    receivedAt: new Date('2026-06-01T09:00:00Z'),
    parts: [{ mimeType: 'text/plain', text: 'Hi, could you quote an audit of our books?' }],
    ...overrides,
  };
  // Same shape and original header casing the real client produces, derived from the fields above.
  const headers = overrides.headers ?? {
    From: base.fromName ? `"${base.fromName}" <${base.fromEmail}>` : base.fromEmail,
    Subject: base.subject,
    'Message-ID': base.messageId,
    Date: base.receivedAt.toUTCString(),
  };
  const { fromName, ...rest } = base;
  return { ...rest, ...(fromName === undefined ? {} : { fromName }), headers };
}
