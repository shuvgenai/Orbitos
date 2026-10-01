import type { MailerPort } from './mailer.ts';

const ENDPOINT = 'https://api.resend.com/emails';

/**
 * Thrown for any non-2xx Resend answer. Callers branch on `status` (429 and 5xx are retryable, 401
 * and 403 are a bad key or sender). The message carries the status only, never Resend's response
 * body, which can echo the recipient address.
 */
export class MailerError extends Error {
  readonly status: number;
  constructor(status: number) {
    super(`Resend send failed with status ${status}`);
    this.name = 'MailerError';
    this.status = status;
  }
}

export function createResendMailer(deps: { apiKey: string; from: string; fetch?: typeof fetch }): MailerPort {
  const doFetch = deps.fetch ?? fetch;
  return {
    async send({ to, subject, text }) {
      const res = await doFetch(ENDPOINT, {
        method: 'POST',
        headers: { authorization: `Bearer ${deps.apiKey}`, 'content-type': 'application/json' },
        body: JSON.stringify({ from: deps.from, to: [to], subject, text }),
      });
      if (!res.ok) throw new MailerError(res.status);
    },
  };
}
