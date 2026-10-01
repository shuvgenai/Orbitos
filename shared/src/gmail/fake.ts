import { buildRaw, GmailApiError } from './client.ts';
import type { GmailMessage, GmailPort, HistoryPage, SendArgs } from './port.ts';

type Queued = { seq: number; message: GmailMessage };

export class FakeGmail implements GmailPort {
  readonly sent: { orbitcrewId: string; gmailMessageId: string; raw: string }[] = [];
  private readonly startHistoryId: number;
  private counter: number;
  private readonly queued: Queued[] = [];
  private sendFailsAfterAccepting = false;
  private listFailure: { status: number } | null = null;

  constructor(opts: { historyId: string }) {
    this.startHistoryId = Number(opts.historyId);
    this.counter = this.startHistoryId;
  }

  /** Delivers a message to the inbox; each one advances the history id by one. */
  queue(message: GmailMessage): void {
    this.counter += 1;
    this.queued.push({ seq: this.counter, message });
  }

  failNextSendAfterAccepting(): void {
    this.sendFailsAfterAccepting = true;
  }

  failNextListWith(opts: { status: number }): void {
    this.listFailure = opts;
  }

  async listSince(historyId: string): Promise<HistoryPage | { expired: true }> {
    if (this.listFailure) {
      const { status } = this.listFailure;
      this.listFailure = null;
      throw new GmailApiError(status, `Gmail history.list failed with status ${status}`);
    }
    const from = Number(historyId);
    if (!Number.isInteger(from) || from < this.startHistoryId) return { expired: true };
    return {
      messages: this.queued.filter((q) => q.seq > from).map((q) => q.message),
      historyId: String(this.counter),
    };
  }

  async listByDate(since: Date): Promise<HistoryPage> {
    return {
      messages: this.queued.map((q) => q.message).filter((m) => m.receivedAt >= since),
      historyId: String(this.counter),
    };
  }

  async sendInThread(args: SendArgs): Promise<{ gmailMessageId: string }> {
    const gmailMessageId = `sent-${this.sent.length + 1}`;
    this.sent.push({ orbitcrewId: args.orbitcrewId, gmailMessageId, raw: buildRaw(args) });
    if (this.sendFailsAfterAccepting) {
      this.sendFailsAfterAccepting = false;
      throw new Error('connection reset after Gmail accepted the message');
    }
    return { gmailMessageId };
  }

  async findSentByTag(orbitcrewId: string): Promise<{ gmailMessageId: string } | null> {
    const hit = this.sent.find((s) => s.orbitcrewId === orbitcrewId);
    return hit ? { gmailMessageId: hit.gmailMessageId } : null;
  }
}

let leadCounter = 0;

/** A written, synthetic lead. Never a real email. */
export function syntheticLead(overrides: Partial<GmailMessage> = {}): GmailMessage {
  leadCounter += 1;
  const n = leadCounter;
  return {
    gmailMessageId: `g-${n}`,
    gmailThreadId: `t-${n}`,
    messageId: `<lead-${n}@mail.example>`,
    fromEmail: 'maya@okafor.example',
    fromName: 'Maya Okafor',
    subject: 'Audit quote',
    receivedAt: new Date('2026-06-01T09:00:00Z'),
    headers: {},
    parts: [{ mimeType: 'text/plain', text: 'Hi, could you quote an audit of our books?' }],
    ...overrides,
  };
}
