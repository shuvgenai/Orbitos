export type CheckEmail = { from: string; to: string; subject: string; text: string; headers: Record<string, string> };

// A content-free message used only to prove SPF and DKIM pass for the sending domain (E2-T3).
export function buildCheckEmail(from: string, to: string): CheckEmail {
  return {
    from,
    to,
    subject: 'Orbitcrew sending check',
    text: 'This message checks that Orbitcrew email is signed correctly. No action is needed.',
    headers: { 'X-Orbitcrew': 'system' },
  };
}
