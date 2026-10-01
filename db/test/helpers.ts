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
