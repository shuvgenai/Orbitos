import { randomUUID } from 'node:crypto';
import { createPrisma, type PrismaClient } from '../src/client.ts';

export function testPrisma(): PrismaClient {
  return createPrisma(process.env.DATABASE_URL!);
}

export function newWorkspace(prisma: PrismaClient) {
  return prisma.workspace.create({ data: { name: `ws-${randomUUID()}` } });
}

export async function newLead(prisma: PrismaClient, workspaceId: string) {
  return prisma.lead.create({
    data: {
      workspaceId,
      messageId: `<${randomUUID()}@mail.example.com>`,
      gmailMessageId: randomUUID(),
      gmailThreadId: randomUUID(),
      fromEmail: 'maya@example.com',
      subject: 'Audit quote',
      receivedAt: new Date(),
    },
  });
}

export async function newApproval(
  prisma: PrismaClient,
  workspaceId: string,
  state: 'issued' | 'sending' | 'sent' | 'failed' | 'void' = 'issued',
) {
  const lead = await newLead(prisma, workspaceId);
  return prisma.approval.create({
    data: {
      workspaceId,
      leadId: lead.id,
      category: 'routine',
      state,
      draftText: 'Hi Maya, thanks for reaching out.',
      reason: 'Routine intro request.',
      expiresAt: new Date(Date.now() + 72 * 3600_000),
    },
  });
}

export function withConnection(prisma: PrismaClient, workspaceId: string, opts: { historyId: string }) {
  return prisma.gmailConnection.create({
    data: {
      workspaceId,
      emailAddress: 'owner@example.com',
      refreshTokenCipher: 'test',
      historyId: opts.historyId,
    },
  });
}

export function withOwner(prisma: PrismaClient, workspaceId: string, email: string) {
  return prisma.user.create({
    data: {
      workspaceId,
      email,
      authorities: { create: [{ authority: 'approve_routine' }, { authority: 'approve_decline_refer' }] },
    },
  });
}

/**
 * A plain, non-superuser login for testing row-level security.
 *
 * THE SUITE'S OWN CONNECTION CANNOT TEST RLS. `DATABASE_URL` connects as `postgres`, and a
 * superuser is never restrained by a policy -- FORCE or not. A test that used it would pass
 * while proving nothing, which is the failure mode this repo keeps finding. Every RLS test
 * from FD-38 S2 onward needs a role like this, so it lives here rather than being
 * rediscovered per file.
 *
 * The role owns nothing, which is the second half: a table's OWNER also bypasses its policies
 * unless the table is FORCEd, and the access-immutability trigger compares `current_user`
 * against the schema owner. A test role that happened to own something would quietly
 * reproduce the FD-12 hole instead of catching it.
 */
export async function makeProbeRole(
  admin: PrismaClient,
  name: string,
  password: string,
): Promise<void> {
  // DROP OWNED BY first: a plain `drop role` fails while any grant still references it, and
  // a role left behind makes the next run's `create role` fail.
  await admin.$executeRawUnsafe(`drop owned by ${name}`).catch(() => undefined);
  await admin.$executeRawUnsafe(`drop role if exists ${name}`).catch(() => undefined);
  await admin.$executeRawUnsafe(`create role ${name} login password '${password}'`);
  await admin.$executeRawUnsafe(`grant usage on schema public to ${name}`);
}

export async function dropProbeRole(admin: PrismaClient, name: string): Promise<void> {
  await admin.$executeRawUnsafe(`drop owned by ${name}`).catch(() => undefined);
  await admin.$executeRawUnsafe(`drop role if exists ${name}`).catch(() => undefined);
}

/** The same connection string as the suite, re-pointed at `name` and pinned to one connection. */
export function probeUrl(name: string, password: string): string {
  const u = new URL(process.env.DATABASE_URL!);
  u.username = name;
  u.password = password;
  u.searchParams.set('connection_limit', '1');
  return u.toString();
}
