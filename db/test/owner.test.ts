import { afterAll, expect, test } from 'vitest';
import { createOwner } from '../src/owner.ts';
import { newWorkspace, testPrisma } from './helpers.ts';

const prisma = testPrisma();
afterAll(() => prisma.$disconnect());

test('the owner holds every authority (AUTH-4)', async () => {
  const ws = await newWorkspace(prisma);
  const owner = await createOwner(prisma, { workspaceId: ws.id, email: 'owner@example.com' });
  const rows = await prisma.userAuthority.findMany({ where: { userId: owner.id } });
  expect(rows.map((r) => r.authority).sort()).toEqual([
    'approve_board_level',
    'approve_decline_refer',
    'approve_routine',
  ]);
  expect(owner).toMatchObject({ workspaceId: ws.id, email: 'owner@example.com' });
});

test('creating the same owner twice does not duplicate or fail', async () => {
  const ws = await newWorkspace(prisma);
  const a = await createOwner(prisma, { workspaceId: ws.id, email: 'owner@example.com' });
  const b = await createOwner(prisma, { workspaceId: ws.id, email: 'owner@example.com' });
  expect(b.id).toBe(a.id);
  expect(await prisma.userAuthority.count({ where: { userId: a.id } })).toBe(3);
});

test('the address is stored lowercased and trimmed, and a differently cased repeat is the same owner', async () => {
  const ws = await newWorkspace(prisma);
  const a = await createOwner(prisma, { workspaceId: ws.id, email: ' Owner@Firm.com' });
  const b = await createOwner(prisma, { workspaceId: ws.id, email: 'OWNER@firm.com ' });
  expect(a.email).toBe('owner@firm.com');
  expect(b.id).toBe(a.id);
});
