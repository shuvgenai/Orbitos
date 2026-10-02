import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pino } from 'pino';
import { createPrisma } from '@orbit/db/client';
import { ConfigError } from '@orbit/shared/config';
import { createAccessTokenProvider } from '@orbit/shared/gmail/access-token';
import { createGmailClient } from '@orbit/shared/gmail/client';
import { startHealthServer } from '@orbit/shared/health';
import { createResendMailer } from '@orbit/shared/mailer-resend';
import { decryptToken } from '@orbit/shared/token-crypto';
import { createAnthropicClassifier } from './classifier-anthropic.ts';
import { loadFrontdeskConfig } from './config.ts';
import { createPaperclipEngine } from './engine/paperclip.ts';
import { runJobLoop } from './loop.ts';
import { advanceLeads } from './pipeline.ts';
import { pollOnce } from './poll.ts';

const PROGRAM = 'frontdesk';
const log = pino({ name: PROGRAM });
const POLL_EVERY_MS = 30_000;
const LOOP_EVERY_MS = 1_000;

function fail(message: string, detail?: unknown): never {
  log.fatal(detail === undefined ? {} : { detail }, message);
  process.exit(1);
}

/** The owner writes these two files once (runbook step 6); an absent or empty one stops the start. */
function readSetupFile(dir: string, name: string): string {
  try {
    const text = readFileSync(join(dir, name), 'utf8').trim();
    if (text === '') throw new Error('empty');
    return text;
  } catch {
    return fail(`${name} is missing or empty in SETUP_DIR`);
  }
}

// One timer, never overlapping itself: a slow tick is skipped, not stacked.
function every(ms: number, name: string, work: () => Promise<unknown>): void {
  let running = false;
  setInterval(() => {
    if (running) return;
    running = true;
    work()
      .catch((err: unknown) => log.error({ tick: name, errName: err instanceof Error ? err.name : typeof err }, 'tick failed'))
      .finally(() => {
        running = false;
      });
  }, ms);
}

let config;
try {
  config = loadFrontdeskConfig(process.env);
} catch (err) {
  if (err instanceof ConfigError) fail(err.message);
  throw err;
}

const setup = {
  toneSamples: readSetupFile(config.SETUP_DIR, 'tone-samples.md'),
  facts: readSetupFile(config.SETUP_DIR, 'facts.md'),
};

const prisma = createPrisma(config.DATABASE_URL);
// Slice 1 is one owner, one inbox: the single Gmail connection names the workspace and the owner's address.
// The error name only: a driver message carries the host and user from DATABASE_URL.
const connections = await prisma.gmailConnection.findMany({ take: 2 }).catch((err: unknown) =>
  fail(`could not read the database (${err instanceof Error ? err.name : typeof err})`));
if (connections.length !== 1) {
  fail(`expected exactly one GmailConnection row, found ${connections.length}; see the runbook`);
}
const connection = connections[0]!;
const workspaceId = connection.workspaceId;
const owner = await prisma.user.findFirst({ where: { workspaceId } });
if (!owner) fail('the workspace has no owner user; see the runbook');

const gmail = createGmailClient({
  accessToken: createAccessTokenProvider({
    clientId: config.GMAIL_CLIENT_ID,
    clientSecret: config.GMAIL_CLIENT_SECRET,
    getRefreshToken: async () =>
      decryptToken((await prisma.gmailConnection.findUniqueOrThrow({ where: { workspaceId } })).refreshTokenCipher, config.TOKEN_ENCRYPTION_KEY),
  }),
});
const engine = createPaperclipEngine({
  baseUrl: config.PAPERCLIP_API_URL,
  apiKey: config.PAPERCLIP_API_KEY,
  companyId: config.PAPERCLIP_COMPANY_ID,
  agentIds: { scout: config.PAPERCLIP_SCOUT_AGENT_ID, orbi: config.PAPERCLIP_ORBI_AGENT_ID },
});
const mailer = createResendMailer({ apiKey: config.RESEND_API_KEY, from: config.MAIL_FROM });
const classifier = createAnthropicClassifier({ apiKey: config.ANTHROPIC_API_KEY });

const port = Number(process.env.PORT ?? 8080);
if (!Number.isInteger(port) || port < 1 || port > 65535) fail('PORT must be an integer from 1 to 65535');
startHealthServer({ name: PROGRAM, port }).on('listening', () => log.info({ port, workspaceId }, 'listening'));

every(POLL_EVERY_MS, 'poll', async () => {
  const result = await pollOnce({ prisma, gmail, workspaceId, ownerAddress: connection.emailAddress });
  if (result.created > 0) log.info(result, 'poll: new leads');
  await advanceLeads({ prisma, classifier, engine, setup, workspaceId });
});

// The loop is here because worker/ is a later sub-project. claimDueJobs is the seam: moving the loop is a deployment change.
every(LOOP_EVERY_MS, 'loop', () =>
  runJobLoop(
    { prisma, engine, mailer, baseUrl: config.PUBLIC_BASE_URL, secret: config.APPROVAL_LINK_SECRET, now: () => new Date() },
    { workerId: `${PROGRAM}-${process.pid}`, limit: 10 },
  ),
);
