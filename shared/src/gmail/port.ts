import type { BodyPart } from '../body.ts';

export type GmailMessage = {
  gmailMessageId: string;
  gmailThreadId: string;
  messageId: string; // the RFC Message-ID header
  /** Bare, lowercase address: no display name, no angle brackets. */
  fromEmail: string;
  fromName?: string;
  subject: string;
  receivedAt: Date;
  headers: Record<string, string>;
  /** Every MIME part, including non-text ones (text/calendar, application/pdf). */
  parts: BodyPart[];
};

export type HistoryPage = { messages: GmailMessage[]; historyId: string };

export type SendArgs = {
  gmailThreadId: string;
  toEmail: string;
  subject: string;
  body: string;
  orbitcrewId: string;
  /** The lead's original RFC Message-ID; sets In-Reply-To and References so other clients keep the reply in the thread. */
  inReplyToMessageId?: string;
};

export interface GmailPort {
  listSince(historyId: string): Promise<HistoryPage | { expired: true }>;
  listByDate(since: Date): Promise<HistoryPage>;
  sendInThread(args: SendArgs): Promise<{ gmailMessageId: string }>;
  findSentByTag(
    orbitcrewId: string,
    opts?: { gmailThreadId?: string },
  ): Promise<{ gmailMessageId: string } | null>;
}
