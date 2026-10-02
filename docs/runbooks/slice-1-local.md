# Slice 1: run it locally against a real inbox

This takes one real lead from your Gmail inbox to a sent reply, confirmed from your phone. Nothing here is
production: one owner, one inbox, one machine.

## What runs

- `frontdesk` polls Gmail every 30 s, classifies new mail, hands leads to Scout (Paperclip), polls for the
  draft, and mails you a notice. It also runs the job loop (1 s tick) because `worker/` is a later sub-project.
- `api` serves the confirm page (`GET` and `POST /c/:token`) and sign-in (`POST /signin`, `GET /s/:token`).
  The confirm page is the only thing that can send a reply.
- Paperclip with Scout and Orbi, Postgres and Redis come from `template/compose.yml`.

## Before you start

You need: Docker (in WSL2 on this machine, so prefix with `wsl`), a Resend account with a verified sender,
an Anthropic key, a Google account for the inbox, a Cloudflare account and `cloudflared`.

## 1. Create the internal OAuth app

In Google Cloud Console, create a project, enable the Gmail API, and create an OAuth client of type
"Web application" with the OAuth consent screen set to Internal (Workspace accounts only). If the inbox is a
plain `@gmail.com` address, Internal is not offered: use External in Testing and add yourself as a test user,
and note that a Testing refresh token expires after 7 days (see Failure modes).

Scopes: `gmail.readonly` and `gmail.send`. Add `https://developers.google.com/oauthplayground` as a redirect
URI if you use the OAuth Playground in the next step.

Put the client id and secret in `template/.env` as `GMAIL_CLIENT_ID` and `GMAIL_CLIENT_SECRET`.

## 2. Obtain the refresh token, once

Use the OAuth Playground with "Use your own OAuth credentials" and the two scopes, authorise as the inbox
owner, and exchange the code. Copy the **refresh token** (not the access token). It is a secret as strong as
the mailbox: never paste it into a chat, a ticket or a commit.

## 3. Write it, encrypted, into `GmailConnection`

Generate the key and the link secret, and keep them in `template/.env`:

```
openssl rand -hex 32     # TOKEN_ENCRYPTION_KEY
openssl rand -hex 32     # APPROVAL_LINK_SECRET (64 characters; the program refuses fewer than 32)
```

Start only Postgres (`pnpm db:up` for the dev database, or the compose `postgres` service), apply
migrations (`pnpm db:migrate`), then create the workspace, the owner and the connection once. Run this from
the repo root with `DATABASE_URL`, `TOKEN_ENCRYPTION_KEY`, `OWNER_EMAIL` and `GMAIL_REFRESH_TOKEN` in the
environment:

```
node --import tsx -e "
import { createPrisma } from '@orbit/db/client';
import { createOwner } from '@orbit/db/owner';
import { encryptToken } from '@orbit/shared/token-crypto';
const prisma = createPrisma(process.env.DATABASE_URL);
const ws = await prisma.workspace.create({ data: { name: 'owner' } });
await createOwner(prisma, { workspaceId: ws.id, email: process.env.OWNER_EMAIL });
const profile = await (await fetch('https://gmail.googleapis.com/gmail/v1/users/me/profile', {
  headers: { authorization: 'Bearer ' + process.env.ACCESS_TOKEN } })).json();
await prisma.gmailConnection.create({ data: { workspaceId: ws.id, emailAddress: profile.emailAddress,
  refreshTokenCipher: encryptToken(process.env.GMAIL_REFRESH_TOKEN, process.env.TOKEN_ENCRYPTION_KEY),
  historyId: profile.historyId } });
await prisma.\$disconnect();
"
```

`ACCESS_TOKEN` is the short-lived access token from the Playground; it is used once to read the mailbox
address and its current history id, so polling starts from now and does not classify your old mail.
There must be exactly one `GmailConnection` row: both programs refuse to start otherwise.

## 4. Create the named Cloudflare tunnel

```
cloudflared tunnel login
cloudflared tunnel create orbit
cloudflared tunnel route dns orbit orbit.<your-domain>
```

Route the tunnel to `http://127.0.0.1:8081` (the `api` port). Use a **named** tunnel. Then set
`PUBLIC_BASE_URL=https://orbit.<your-domain>` in `template/.env`.

## 5. Paperclip keys

Bring the stack up once (step 7), create the company with Orbi and Scout in Paperclip, then write
`template/.env.frontdesk` (git-ignored) with `PAPERCLIP_API_KEY`, `PAPERCLIP_COMPANY_ID`,
`PAPERCLIP_SCOUT_AGENT_ID`, `PAPERCLIP_ORBI_AGENT_ID`. These are per instance, so they are not in the template.
Also set `MAIL_FROM` (a sender Resend has verified) and `SETUP_HOST_DIR` in `template/.env`.

## 6. Write the setup files

In the folder named by `SETUP_HOST_DIR` (mounted read-only as `SETUP_DIR` in the containers):

- `tone-samples.md`: a few real replies of yours, so Scout matches your voice.
- `facts.md`: what the firm does and does not say in writing.

An absent or empty file stops `frontdesk` from starting.

## 7. Start

```
pnpm db:up        # dev Postgres only, if you are running programs by hand
pnpm stack:up     # the full compose stack
```

A program with missing or malformed configuration exits non-zero at once and names the variables (never the
values). `APPROVAL_LINK_SECRET` must be present and at least 32 characters.

## 8. Send yourself a lead

From another address, email the inbox with something that looks like an enquiry. Within a minute you get the
notice ("A reply is waiting"). Open the link on your phone, sign in by email link if asked, read the draft,
press Send. The reply arrives in the sender's inbox in the same thread.

## Failure modes, named

- **A quick tunnel (`trycloudflare.com`) changes hostname on every start.** Every confirm link already sent
  then points nowhere. Use the named tunnel and never change `PUBLIC_BASE_URL` while approvals are open.
- **A sleeping machine stops the poller.** Nothing polls while the laptop sleeps, so leads wait in Gmail until
  it wakes (the watermark means nothing is lost, only late). Keep the machine awake for a live test. If it
  sleeps for over a week, Gmail's history expires and the poller resyncs by date.
- **The sign-in rate limiter does not survive a restart.** It is in memory in one process: 5 requests per 15
  minutes per caller and address, and 20 per 15 minutes per caller, with a hard cap on tracked callers. A restart
  clears it. The sign-in path keeps a small timing difference between known and unknown addresses by design, and
  this limiter is the real defence against probing it. The caller is identified by `cf-connecting-ip` only when
  `TRUST_CF_CONNECTING_IP=true` (set in compose, because the api is reachable solely through the tunnel on
  127.0.0.1); run the api by hand without it and every request shares the socket address, one stricter bucket.
- **An External OAuth app in Testing expires its refresh token after 7 days.** The poller then sees a 401,
  marks the connection revoked, and stops. Re-do step 2 and 3, or use an Internal app.
- **A revoked connection raises an alert job that this slice does not mail.** It is marked dead in the `jobs`
  table with a clear error. Watch `frontdesk` logs.
- **A lead that is not draftable (already finished) is never retried.** Retrying would create another
  Paperclip issue, so another Scout run and another charge. Such a job is marked dead on the first attempt.

## Known deviations from the SEC-2 posture in this slice

- The `api` holds the Gmail credentials and token key, because the confirm route sends the reply.
- `frontdesk` holds the Resend key, because it runs the job loop that mails the notice.

Both end when `worker/` takes the loop and the send path in a later sub-project. The compose test records the
exception, and the engine container still holds neither.
