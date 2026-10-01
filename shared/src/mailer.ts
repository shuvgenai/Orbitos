/**
 * Outbound system email (notices, magic-link sign-in). Callers own the content rule: NTC-1 keeps
 * system email free of lead name, company, address and draft text.
 *
 * System mail should carry `X-Orbitcrew` in `headers`: the poller watches the owner's inbox and drops
 * anything with that header (FD-1), so our own mail is never classified as a lead.
 */
export interface MailerPort {
  send(args: { to: string; subject: string; text: string; headers?: Record<string, string> }): Promise<void>;
}
