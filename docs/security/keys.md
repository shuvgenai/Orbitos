# Key inventory

Every key this project uses, what it actually is, which program holds it, and
who rotates it.

**Names only. No values, ever.** `guards/rules.test.ts` checks this file against
a list of credential shapes and fails if one appears. That check reports the line
number and the name of the shape it matched, never the matched text, so a
failure cannot copy a secret into a CI log.

Values live in `.env.local`, which is never committed. `.env.example` carries the
same names with nothing after the equals sign. The compose stack reads
`template/.env` and `template/.env.frontdesk`, which are also never committed.

"Who rotates it" names the person who can issue a new value and the console they
do it in. Where that is the founder, it is the founder because no other account
exists yet, not because it has to stay that way.

## The correction this file exists to carry

`TYPESAFE_API_KEY` in `.env.local` holds an **OpenRouter** key, routed through
Jev Router. It is not a TypeSafe console key, and there is no TypeSafe console
account behind it. Anybody rotating it by its name would go to the wrong vendor,
find nothing, and conclude the key had already been revoked.

The name is kept because code reads it. Renaming it changes a frozen package's
configuration and belongs to the founder.

## Application keys

Read from `.env.local` when a program runs directly, and from `template/.env`
when the compose stack runs.

| Key | What it actually is | Which program holds it | Who rotates it |
| --- | --- | --- | --- |
| `ANTHROPIC_API_KEY` | Anthropic API key for the front desk and for Paperclip | `frontdesk`, `paperclip` | founder, Anthropic console |
| `ENGINE_ANTHROPIC_API_KEY` | a second Anthropic key, scoped to the engine so engine spend stays separable from product spend | the engine, through `template/.env` | founder, Anthropic console |
| `TYPESAFE_API_KEY` | an OpenRouter key routed through Jev Router. See the correction above. | `ops` | founder, OpenRouter dashboard |
| `RESEND_API_KEY` | Resend transactional sending key | `api`, `worker`, `frontdesk` | founder, Resend dashboard |
| `PAPERCLIP_API_KEY` | API key for the local Paperclip service | `frontdesk` | founder, regenerated in Paperclip |

## Google and mail

| Key | What it actually is | Which program holds it | Who rotates it |
| --- | --- | --- | --- |
| `GMAIL_CLIENT_ID` | Google OAuth client id. Not a secret on its own, and useless without the secret below. | `api`, `frontdesk` | founder, Google Cloud console |
| `GMAIL_CLIENT_SECRET` | Google OAuth client secret | `api`, `frontdesk` | founder, Google Cloud console |
| `MAIL_FROM` | the address outbound mail is sent from. Not a secret. Empty in `.env.example`, and it stays a test mailbox until the real-data gate opens. | `api`, `frontdesk` | founder |

## Encryption and signing

| Key | What it actually is | Which program holds it | Who rotates it |
| --- | --- | --- | --- |
| `TOKEN_ENCRYPTION_KEY` | 32 bytes as hex, generated with `openssl rand -hex 32`. Encrypts stored Gmail tokens at rest. | `api`, `frontdesk` | founder. Rotating it makes every stored token unreadable, so it needs a re-encryption step, which does not exist yet. |
| `APPROVAL_LINK_SECRET` | HMAC key for confirm links. An empty or short value stops the program starting, which is deliberate. | `api`, `frontdesk` | founder. Rotating it invalidates every outstanding confirm link. |
| `PAPERCLIP_AUTH_SECRET` | Paperclip session signing secret. Reaches the container as `BETTER_AUTH_SECRET`, renamed at `template/compose.yml:60`. | `paperclip` | founder |
| `PAPERCLIP_SIGNING_SECRET` | Paperclip tool-action signing secret. Reaches the container as `PAPERCLIP_TOOL_ACTION_SIGNING_SECRET`, renamed at `template/compose.yml:61`. | `paperclip` | founder |

Both Paperclip secrets are named one thing in `template/.env.example` and
another inside the container. Anybody grepping for the container name finds
nothing in the env file. The indirection is recorded here rather than removed,
because `template/` is frozen.

## Database

| Key | What it actually is | Which program holds it | Who rotates it |
| --- | --- | --- | --- |
| `DATABASE_URL` | a Postgres connection string, which contains a password | `db`, `api`, `worker`, `frontdesk`, `paperclip` | founder. The local dev value is a throwaway against a container and is not a credential for anything reachable. |
| `POSTGRES_PASSWORD` | the Postgres superuser password in the compose stack | the `postgres` service | founder |
| `ORBIT_DB_PASSWORD` | the password for the ORBIT-OS database role | the `postgres` service | founder |
| `PAPERCLIP_DB_PASSWORD` | the password for Paperclip's database role | the `postgres` service | founder |
| `ORBIT_DB_HOST_PORT` | the host port the local dev Postgres binds. Not a credential. 5433 here, because a native Windows Postgres owns 5432 on the founder's machine. | `scripts/dev-db.mjs`, `vitest.config.ts` | nobody |

## Not credentials

Listed because they sit in the same files and get mistaken for secrets.

| Key | What it actually is |
| --- | --- |
| `PUBLIC_BASE_URL` | the named Cloudflare tunnel hostname. Confirm links embed it, so changing it breaks every outstanding link. |
| `PAPERCLIP_API_URL` | the local Paperclip base URL |
| `PAPERCLIP_PUBLIC_URL` | Paperclip's public URL inside the compose stack |
| `PAPERCLIP_COMPANY_ID` | a Paperclip identifier |
| `PAPERCLIP_SCOUT_AGENT_ID` | a Paperclip agent identifier |
| `PAPERCLIP_ORBI_AGENT_ID` | a Paperclip agent identifier |
| `SETUP_DIR` | the folder holding `tone-samples.md` and `facts.md` |
| `SETUP_HOST_DIR` | the host side of the same folder, mounted by compose |
| `HERMES_REF`, `PAPERCLIP_REF` | container image references, pinned by digest |
| `REDIS_URL` | a Redis connection string, set in compose with no password |
| `TRUST_CF_CONNECTING_IP` | a flag, set true because the api is reached only through the Cloudflare tunnel |
| `PAPERCLIP_DEPLOYMENT_MODE`, `PAPERCLIP_DEPLOYMENT_EXPOSURE` | Paperclip deployment settings |

## The two credential deviations in the repository today

Both are recorded because both are wrong in the same way: a program holds a
sending credential it should not need.

1. **`api` holds the Gmail send credentials**, because the confirm route sends
   the message itself rather than queueing it.
2. **`frontdesk` holds the Resend key**, because it runs the notice job.

Both close when the worker takes the queue and the send path, which is the same
change that gives the Action Gateway its one route out. Until then two extra
programs can send, which is exactly the shape of threat 3 in
`docs/security/threat-model-gateway.md`.

## Two gaps found while writing this

1. `RESEND_FROM` and `RESEND_CHECK_TO` are read at
   `ops/src/send-resend-check.ts:4` and are not in `.env.example`. A fresh clone
   runs `pnpm resend:check` and gets that script's error message rather than a
   missing-key list. `ops/` is frozen, so the fix belongs in `.env.example`, and
   it needs the founder's word on which address `RESEND_CHECK_TO` should name,
   because it is a mailbox and the real-data gate is shut.
2. No key here has a rotation owner other than the founder, and none has a
   recorded rotation date. That is accurate rather than acceptable. It is a
   single point of failure, and it is the condition both threat models name as
   closing their secret-leakage failure part.
