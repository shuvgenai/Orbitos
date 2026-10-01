import type { PrismaClient } from './client.ts';

export function readConnection(prisma: PrismaClient, workspaceId: string) {
  return prisma.gmailConnection.findUniqueOrThrow({ where: { workspaceId } });
}

// Only call this once every message up to historyId has been persisted.
export function advanceWatermark(prisma: PrismaClient, workspaceId: string, historyId: string) {
  return prisma.gmailConnection.update({
    where: { workspaceId },
    data: { historyId, lastCheckedAt: new Date() },
  });
}

// CN-8: the token is gone. The watermark is deliberately left where it was.
export function markRevoked(prisma: PrismaClient, workspaceId: string) {
  return prisma.gmailConnection.update({
    where: { workspaceId },
    data: { state: 'revoked', revokedAt: new Date() },
  });
}
