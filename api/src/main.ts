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
// The error name only: a driver message carries the host and user from DATABASE_URL.
const connections = await prisma.gmailConnection.findMany({ take: 2 }).catch((err: unknown) =>
  fail(`could not read the database (${err instanceof Error ? err.name : typeof err})`));
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

const signInLimiter = createRateLimiter({ max: 5, windowMs: 15 * 60_000 });
const signInCallerLimiter = createRateLimiter({ max: 20, windowMs: 15 * 60_000 });
setInterval(() => {
  signInLimiter.sweep();
  signInCallerLimiter.sweep();
}, 60_000).unref();

const route = createRoutes({
  prisma,
  gmail,
  mailer: createResendMailer({ apiKey: config.RESEND_API_KEY, from: config.MAIL_FROM }),
  baseUrl: config.PUBLIC_BASE_URL,
  secret: config.APPROVAL_LINK_SECRET,
  workspaceId,
  // In memory: a restart clears them. Per caller-and-address, tight; per caller, looser.
  signInLimiter,
  signInCallerLimiter,
});

// Any client can send a header, so the caller's address is taken from one only when the operator says every request
// comes through Cloudflare, which overwrites cf-connecting-ip (TRUST_CF_CONNECTING_IP=true). Otherwise it is the socket
// address, which behind the tunnel is one shared bucket: stricter, never spoofable.
const trustCf = process.env.TRUST_CF_CONNECTING_IP === 'true';
const clientIp = (h: Record<string, string | string[] | undefined>, socketIp: string | undefined): string => {
  const cf = h['cf-connecting-ip'];
  const fromHeader = trustCf ? (Array.isArray(cf) ? cf[0] : cf)?.trim() : undefined;
  return fromHeader || socketIp || 'unknown';
};

const port = Number(process.env.PORT ?? 8080);
if (!Number.isInteger(port) || port < 1 || port > 65535) fail('PORT must be an integer from 1 to 65535');
createServer((req, res) => {
  const chunks: Buffer[] = [];
  let size = 0;
  req.on('data', (c: Buffer) => {
    size += c.length;
    if (size > MAX_BODY_BYTES) {
      // Stop reading: answer 413 and drop the connection instead of buffering the rest.
      if (!res.headersSent) res.writeHead(413, { connection: 'close' }).end();
      req.destroy();
      return;
    }
    chunks.push(c);
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
