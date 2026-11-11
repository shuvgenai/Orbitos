// Provision a fresh ORBIT instance: one workspace, one owner, one Gmail connection.
//
//   node --import tsx ops/seed-instance.mjs
//
// WHY THIS FILE EXISTS. `api/src/main.ts` and `frontdesk/src/main.ts` both refuse to start
// unless there is EXACTLY ONE GmailConnection row. Until now the only way to create it was a
// multi-line snippet pasted out of `docs/runbooks/slice-1-local.md`, which meant it could not
// be run by CI, could not be run twice safely, and could not be tested at all. The compose
// smoke job found this the hard way: with migrations applied, the api got one step further and
// died on `expected exactly one GmailConnection row, found 0`.
//
// IMPORTS ARE ABSOLUTE, which looks wrong and is deliberate. This runs inside the `dbgen`
// build stage, where pnpm has linked `@orbit/*` into each PACKAGE's node_modules rather than
// at the root, so a bare `@orbit/db/client` resolves or not depending on the working
// directory. Absolute paths resolve the same from anywhere.
//
// WHAT IT DOES NOT DO, unlike the runbook snippet: it never calls Gmail. The runbook reads the
// mailbox address and current history id from the live API so polling starts from now and does
// not classify old mail. Here both are inputs. That is right for CI and for a restore drill,
// and WRONG for a real first install — a real install wants the live history id, or the Front
// Desk starts polling from a point that is not now.
//
// Required: DATABASE_URL, TOKEN_ENCRYPTION_KEY, OWNER_EMAIL, GMAIL_REFRESH_TOKEN,
//           GMAIL_EMAIL_ADDRESS, GMAIL_HISTORY_ID
import { createPrisma } from '/app/db/src/client.ts';
import { createOwner } from '/app/db/src/owner.ts';
import { encryptToken } from '/app/shared/src/token-crypto.ts';

const need = [
  'DATABASE_URL',
  'TOKEN_ENCRYPTION_KEY',
  'OWNER_EMAIL',
  'GMAIL_REFRESH_TOKEN',
  'GMAIL_EMAIL_ADDRESS',
  'GMAIL_HISTORY_ID',
];
const missing = need.filter((n) => !process.env[n]);
if (missing.length > 0) {
  console.error(`seed-instance: missing ${missing.join(', ')}`);
  process.exit(2);
}

const prisma = createPrisma(process.env.DATABASE_URL);
try {
  // Idempotent on purpose: "exactly one" is the rule both programs enforce, so a second run
  // must not create a second row and must not fail a re-run of the job.
  const existing = await prisma.gmailConnection.findMany();
  if (existing.length === 1) {
    console.log(`seed-instance: already provisioned (${existing[0].emailAddress}) — nothing to do`);
    process.exit(0);
  }
  if (existing.length > 1) {
    console.error(`seed-instance: found ${existing.length} GmailConnection rows; both programs`
      + ' refuse to start unless there is exactly one. Resolve by hand.');
    process.exit(1);
  }

  const ws = await prisma.workspace.create({ data: { name: 'owner' } });
  await createOwner(prisma, { workspaceId: ws.id, email: process.env.OWNER_EMAIL });
  await prisma.gmailConnection.create({
    data: {
      workspaceId: ws.id,
      emailAddress: process.env.GMAIL_EMAIL_ADDRESS,
      refreshTokenCipher: encryptToken(
        process.env.GMAIL_REFRESH_TOKEN,
        process.env.TOKEN_ENCRYPTION_KEY,
      ),
      historyId: process.env.GMAIL_HISTORY_ID,
    },
  });
  console.log(`seed-instance: workspace ${ws.id}, owner ${process.env.OWNER_EMAIL},`
    + ` connection ${process.env.GMAIL_EMAIL_ADDRESS}`);
} finally {
  await prisma.$disconnect();
}
