/**
 * The Org Admin invitation email — PRD A-04.
 *
 * **NOTHING SENDS THIS YET, AND NOTHING HERE PRETENDS OTHERWISE.** FD-32 records the send as
 * owed. It lives beside `mailer.ts` rather than in the web app because this is where the
 * sender will be: it returns exactly `MailerPort.send`'s argument shape, so wiring it up is
 *
 *     await mailer.send(inviteEmail({ ... }))
 *
 * and no adapter in between. `createResendMailer` in `mailer-resend.ts` is the implementation
 * that exists; the PRD names no mail provider at all (checked: PRD v9.0, PRD v1.1 and the
 * founder decision register mention none).
 *
 * This is a CUSTOMER-FACING surface, so PRD 15.3's naming rule applies in full: OrbitCrew,
 * capital O and capital C (FD-5), and not one word of ORBIT-OS, Paperclip, Hermes, adapter,
 * token or an office identifier. `resend-check.ts` next door writes the brand lowercase —
 * that is the FD-5 defect and must not be copied.
 *
 * Plain text only, deliberately. The one action is a link; HTML would add a rendering
 * surface and a tracking question to a message that needs neither.
 */

export type InviteEmailInput = {
  /** The Org Admin's name, as the operator typed it on the provision form. */
  adminName: string;
  /** The business the office was created for. */
  officeName: string;
  /** The redemption link, from `inviteUrl` in the web app's `src/shared/lib/invite.ts`. */
  inviteUrl: string;
  /** When the invitation stops working. A-04: seven days after it was issued. */
  expiresAt: Date;
};

export type InviteEmail = {
  to: string;
  subject: string;
  text: string;
  headers: Record<string, string>;
};

/** `2026-11-13` — unambiguous in every locale, which a transactional email has to be. */
const day = (d: Date): string => d.toISOString().slice(0, 10);

/**
 * Builds the invitation. Pure: no clock, no network, no environment.
 *
 * `to` is a parameter rather than part of the input object so a caller cannot send the
 * message to one address while addressing it to another.
 */
export function inviteEmail(to: string, input: InviteEmailInput): InviteEmail {
  const expires = day(input.expiresAt);
  return {
    to,
    subject: `Set up your OrbitCrew office for ${input.officeName}`,
    text: [
      `Hello ${input.adminName},`,
      '',
      `An OrbitCrew office has been created for ${input.officeName}, and you have been named its Org Admin.`,
      '',
      'Open this link to choose a password and start setting up the office:',
      '',
      input.inviteUrl,
      '',
      `The link works once and stops working on ${expires}. If it has already been used or has expired, ask whoever set the office up for a new one.`,
      '',
      'Nobody from OrbitCrew can see the work your office does — only whether it is running.',
      '',
      '— OrbitCrew',
    ].join('\n'),
    // The owner's inbox poller drops anything carrying this header, so our own mail is never
    // read back as a customer's incoming work. Same spelling as `resend-check.ts` on purpose:
    // this is a WIRE IDENTIFIER, and identifiers do not change for a branding rule. FD-5
    // governs display copy, which is the subject and body above.
    headers: { 'X-Orbitcrew': 'system' },
  };
}
