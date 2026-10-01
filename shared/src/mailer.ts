/**
 * Outbound system email (notices, magic-link sign-in). Callers own the content rule: NTC-1 keeps
 * system email free of lead name, company, address and draft text.
 */
export interface MailerPort {
  send(args: { to: string; subject: string; text: string }): Promise<void>;
}
