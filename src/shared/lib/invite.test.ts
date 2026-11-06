import { describe, expect, it } from 'vitest';
import type { Invite } from '@/shared/schemas/invite';
import {
  INVITE_MESSAGE,
  INVITE_TTL_MS,
  inviteState,
  inviteUrl,
  newInviteToken,
} from './invite';

const AT = Date.parse('2026-11-06T14:55:00.000Z');

const invite = (patch: Partial<Invite> = {}): Invite => ({
  token: 'tok',
  officeId: 'ws_acme',
  email: 'ada@acme.com',
  name: 'Ada Okonkwo',
  issuedBy: 'Shuv Chowdhury',
  issuedAt: AT,
  expiresAt: AT + INVITE_TTL_MS,
  usedAt: null,
  ...patch,
});

describe('the invitation rules (PRD A-04)', () => {
  it('expires in seven days, to the millisecond', () => {
    expect(INVITE_TTL_MS).toBe(7 * 24 * 60 * 60 * 1000);
    const i = invite();
    expect(inviteState(i, i.expiresAt - 1)).toBe('valid');
    // The boundary is inclusive: at the stated instant it is gone, not still good.
    expect(inviteState(i, i.expiresAt)).toBe('expired');
  });

  it('works once', () => {
    expect(inviteState(invite(), AT)).toBe('valid');
    expect(inviteState(invite({ usedAt: AT }), AT)).toBe('used');
  });

  it('reports an invitation that was used AND has since aged out as used, not expired', () => {
    // The order of the two checks is a product decision, not an accident. Telling someone who
    // already has an office that their invitation "expired" sends them to ask for a second
    // link they do not need.
    const old = invite({ usedAt: AT, expiresAt: AT + 1 });
    expect(inviteState(old, AT + 10_000)).toBe('used');
  });

  it('treats an unknown token as unknown rather than throwing', () => {
    expect(inviteState(undefined, AT)).toBe('unknown');
  });

  it('gives every refusal words a screen can show, and no status code', () => {
    for (const message of Object.values(INVITE_MESSAGE)) {
      expect(message).toMatch(/^[A-Z].*\.$/);
      expect(message).not.toMatch(/\b[45]\d\d\b/);
    }
    // The exact sentence the prompt asked for.
    expect(INVITE_MESSAGE.used).toBe('This invitation has already been used.');
  });

  it('says the same thing for an unknown token as for a tampered one', () => {
    // There is only one message for both, which is what stops the URL becoming a token
    // oracle -- the same reasoning `RequireAccess` applies to roles.
    expect(inviteState(undefined, AT)).toBe('unknown');
    expect(INVITE_MESSAGE.unknown).not.toContain('exist');
  });
});

describe('the token', () => {
  it('is 32 bytes of randomness, hex-encoded', () => {
    const t = newInviteToken();
    expect(t).toMatch(/^[0-9a-f]{64}$/);
  });

  it('does not repeat', () => {
    const many = new Set(Array.from({ length: 200 }, newInviteToken));
    expect(many.size).toBe(200);
  });
});

describe('the redemption link', () => {
  it('points at the Org Admin entry, which is where the invitee belongs (FD-30)', () => {
    expect(inviteUrl('http://localhost:5173', 'abc')).toBe(
      'http://localhost:5173/orgadmin#/invite/abc',
    );
  });

  it('never points at the operator entry', () => {
    // `/superadmin` in a customer-reachable string would also fail the bundle guard in
    // customer-surface.test.ts, but the reason it is wrong is that it is the wrong door.
    const url = inviteUrl('http://localhost:5173', 'abc');
    expect(url).not.toContain('/superadmin');
    expect(url).not.toContain('/admin/login');
  });

  it('does not double the slash when the origin carries one', () => {
    expect(inviteUrl('http://localhost:5173/', 'abc')).toBe(
      'http://localhost:5173/orgadmin#/invite/abc',
    );
  });
});
