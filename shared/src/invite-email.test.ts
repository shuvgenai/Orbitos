import { describe, expect, it } from 'vitest';
import { inviteEmail } from './invite-email.ts';
import type { MailerPort } from './mailer.ts';

const INPUT = {
  adminName: 'Ada Okonkwo',
  officeName: 'Acme Ltd',
  inviteUrl: 'http://localhost:5173/orgadmin#/invite/abc123',
  expiresAt: new Date('2026-11-13T08:55:00.000Z'),
};

describe('the Org Admin invitation email', () => {
  it('is exactly what MailerPort.send takes, so wiring it up needs no adapter', () => {
    const email = inviteEmail('ada@acme.com', INPUT);
    // Structural, not nominal: this is the assertion that catches the template and the port
    // drifting apart, which is the whole reason the template lives in this package.
    const port: MailerPort = { send: async () => {} };
    expect(port.send(email)).toBeInstanceOf(Promise);
    expect(Object.keys(email).sort()).toEqual(['headers', 'subject', 'text', 'to']);
  });

  it('carries the link, the office and the expiry date', () => {
    const { subject, text } = inviteEmail('ada@acme.com', INPUT);
    expect(subject).toContain('Acme Ltd');
    expect(text).toContain(INPUT.inviteUrl);
    expect(text).toContain('Ada Okonkwo');
    // A-04's seven days, as a date the reader can act on rather than a duration.
    expect(text).toContain('2026-11-13');
    expect(text).toContain('works once');
  });

  it('cannot address one person and send to another', () => {
    // `to` is a separate argument precisely so this is impossible to get wrong by forgetting
    // to update one of two fields.
    expect(inviteEmail('ops@acme.com', INPUT).to).toBe('ops@acme.com');
  });

  it('obeys PRD 15.3 on a customer surface: no operator or upstream word anywhere', () => {
    const { subject, text } = inviteEmail('ada@acme.com', INPUT);
    const body = `${subject}\n${text}`;
    for (const banned of [
      'ORBIT-OS',
      'Paperclip',
      'Hermes',
      'OpenClaw',
      'MCP',
      'adapter',
      'Super Admin',
      'token',
    ]) {
      expect(body, `A-04 email must not say ${banned}`).not.toContain(banned);
    }
  });

  it('writes the brand with FD-5 casing, and never the lowercase defect', () => {
    const { subject, text } = inviteEmail('ada@acme.com', INPUT);
    const body = `${subject}\n${text}`;
    expect(body).toContain('OrbitCrew');
    // `resend-check.ts` in this same folder writes "Orbitcrew" in its SUBJECT. That is the
    // FD-5 defect, and this asserts it was not copied into the display copy here. The
    // `X-Orbitcrew` header is a wire identifier and is not display copy, so the check is
    // against the subject and body only -- which is what this test reads.
    expect(body).not.toContain('Orbitcrew');
  });
});
