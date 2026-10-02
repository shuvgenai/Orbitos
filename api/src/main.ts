import { createServer } from 'node:http';
import { pino } from 'pino';
import { createPrisma } from '@orbit/db/client';
import { ConfigError } from '@orbit/shared/config';
import { createAccessTokenProvider } from '@orbit/shared/gmail/access-token';
import { createGmailClient } from '@orbit/shared/gmail/client';
import { createResendMailer } from '@orbit/shared/mailer-resend';
import { decryptToken } from '@orbit/shared/token-crypto';
import { loadApiConfig } from './config.ts';
import { createRateLimiter } from './rate-limit.ts';
import { createRoutes } from './routes.ts';

const PROGRAM = 'api';
const log = pino({ name: PROGRAM });
const MAX_BODY_BYTES = 64 * 1024;

function fail(message: string): never {
  log.fatal(message);
  process.exit(1);
}

let config;
try {
  config = loadApiConfig(process.env);
} catch (err) {
  if (err instanceof ConfigError) fail(err.message);
  throw err;
}

const prisma = createPrisma(config.DATABASE_URL);
const connections = await prisma.gmailConnection.findMany({ take: 2 });
if (connections.length !== 1) fail(`expected exactly one GmailConnection row, found ${connections.length}; see the runbook`);
const workspaceId = connections[0]!.workspaceId;

const gmail = createGmailClient({
  accessToken: createAccessTokenProvider({
    clientId: config.GMAIL_CLIENT_ID,
    clientSecret: config.GMAIL_CLIENT_SECRET,
    getRefreshToken: async () =>
      decryptToken((await prisma.gmailConnection.findUniqueOrThrow({ where: { workspaceId } })).refreshTokenCipher, config.TOKEN_ENCRYPTION_KEY),
  }),
});

const route = createRoutes({
  prisma,
  gmail,
  mailer: createResendMailer({ apiKey: config.RESEND_API_KEY, from: config.MAIL_FROM }),
  baseUrl: config.PUBLIC_BASE_URL,
  secret: config.APPROVAL_LINK_SECRET,
  workspaceId,
  // 5 sign-in requests per 15 minutes per address. In memory: a restart clears it.
  signInLimiter: createRateLimiter({ max: 5, windowMs: 15 * 60_000 }),
});

// The api is reached only through the host's tunnel on 127.0.0.1, so the forwarded header is the client address.
const clientIp = (h: Record<string, string | string[] | undefined>, socketIp: string | undefined): string => {
  const raw = h['cf-connecting-ip'] ?? h['x-forwarded-for'];
  const first = (Array.isArray(raw) ? raw[0] : raw)?.split(',')[0]?.trim();
  return first || socketIp || 'unknown';
};

const port = Number(process.env.PORT ?? 8080);
createServer((req, res) => {
  const chunks: Buffer[] = [];
  let size = 0;
  req.on('data', (c: Buffer) => {
    size += c.length;
    if (size <= MAX_BODY_BYTES) chunks.push(c);
  });
  req.on('end', () => {
    void (async () => {
      try {
        const path = new URL(req.url ?? '/', 'http://x').pathname;
        if (req.method === 'GET' && path === '/healthz') {
          res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify({ status: 'ok', program: PROGRAM }));
          return;
        }
        if (size > MAX_BODY_BYTES) {
          res.writeHead(413).end();
          return;
        }
        const headers: Record<string, string | undefined> = {};
        for (const [k, v] of Object.entries(req.headers)) headers[k] = Array.isArray(v) ? v.join(', ') : v;
        const out = await route({
          method: req.method ?? 'GET',
          path,
          headers,
          body: Buffer.concat(chunks).toString('utf8'),
          ip: clientIp(req.headers, req.socket.remoteAddress),
        });
        res.writeHead(out.status, out.headers).end(out.body);
      } catch (err) {
        log.error({ errName: err instanceof Error ? err.name : typeof err }, 'request failed');
        if (!res.headersSent) res.writeHead(500, { 'content-type': 'text/plain' });
        res.end('Something went wrong.');
      }
    })();
  });
}).listen(port, () => log.info({ port, workspaceId }, 'listening'));
