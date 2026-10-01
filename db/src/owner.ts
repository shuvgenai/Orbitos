import type { PrismaClient } from './client.ts';

/** AUTH-4: at launch every approval category goes to the owner, so the owner holds every authority. */
const OWNER_AUTHORITIES = ['approve_routine', 'approve_decline_refer', 'approve_board_level'] as const;

/** Creates the workspace owner with every authority. Safe to call twice: it returns the same user. */
export async function createOwner(prisma: PrismaClient, args: { workspaceId: string; email: string }) {
  return prisma.$transaction(async (tx) => {
    const user = await tx.user.upsert({
      where: { workspaceId_email: { workspaceId: args.workspaceId, email: args.email } },
      create: { workspaceId: args.workspaceId, email: args.email },
      update: {},
    });
    await tx.userAuthority.createMany({
      data: OWNER_AUTHORITIES.map((authority) => ({ userId: user.id, authority })),
      skipDuplicates: true,
    });
    return user;
  });
}
