// The one row api refuses to start without, as SQL on stdout.
//
// api/src/main.ts reads gmailConnection.findMany({ take: 2 }) before it listens
// and calls fail() unless it finds exactly one row. template/postgres/init
// creates two roles and two empty databases, so the compose-smoke job had a
// database with no schema and no rows, and api crash-looped on it. Env was never
// the whole problem.
//
// SQL on stdout rather than a database connection, because the postgres service
// publishes no host port. The workflow pipes this into psql inside the
// container, which is how the DEP-1 check already reaches the database.
//
// The cipher is generated here rather than hardcoded: encryptToken uses a random
// IV, so there is no fixed string to paste, and a hand-written one would fail to
// decrypt the first time anybody exercised that path.
import { encryptToken } from '../shared/src/token-crypto.ts';

const key = process.env['TOKEN_ENCRYPTION_KEY'];
if (key === undefined || key.trim() === '') throw new Error('TOKEN_ENCRYPTION_KEY is required');

// Not a real refresh token and not shaped like one. It cannot be used even by
// accident: PUBLIC_BASE_URL is an unresolvable .invalid host and MAIL_FROM is a
// reserved domain, so nothing in this stack can reach Google or a mailbox.
const cipher = encryptToken('ci-smoke-not-a-real-refresh-token', key.trim());

// One workspace, one connection, in one transaction, so a failure leaves nothing
// half-seeded for the next step to misread.
//
// \gset captures the generated workspace id. That id is a database default
// (gen_random_uuid), so it cannot be written here and has to be read back.
//
// email_address is on a reserved domain, which is what
// guards/standing-rules.test.ts requires of any address in tracked
// configuration. This file is not configuration, and the rule is worth
// following anyway: a real-looking address in a seed is a real address to
// whoever reads the row.
process.stdout.write(`BEGIN;
INSERT INTO workspaces (name) VALUES ('CI smoke') RETURNING id AS ws_id \\gset
INSERT INTO gmail_connections (workspace_id, email_address, refresh_token_cipher, history_id)
VALUES (:'ws_id', 'smoke@example.com', '${cipher}', '1');
COMMIT;
`);
