import type { PrismaClient } from './client.ts';

/**
 * The session-to-claim bridge. FD-38 stage S1.
 *
 * Row-level security in this product reads the signed-in identity from a connection setting,
 * `request.jwt.claims`, exactly as `orbitcrew` migration 0005 does: parse the JSON, take
 * `sub`, cast to uuid, and return NULL on anything malformed. A policy keyed on that setting
 * can only see what the request puts there, so SOMETHING has to put it there, once, per
 * request, on the connection the query will actually use.
 *
 * That is this function, and it is meant to be the only one.
 *
 * WHY A TRANSACTION, AND WHY `true`
 *
 * `set_config(name, value, is_local)` with **is_local = true** scopes the value to the
 * current transaction; Postgres discards it at COMMIT or ROLLBACK. With `false` it is scoped
 * to the SESSION, which under a connection pool means the next request handed that same
 * connection inherits the previous user's identity.
 *
 * This is not theory. Measured 2026-11-17 against the dev database at `connection_limit=1`
 * (the spike is kept at `orbitos-infra/docs/superpowers/spikes/2026-11-17-session-claim-bridge.ts`):
 *
 *   is_local = true  -> the claim did NOT survive into the next request on that connection,
 *                       and 200 interleaved concurrent requests each saw only their own rows.
 *   is_local = false -> the claim DID leak into the next request.
 *
 * So the `true` below is load-bearing. Changing it is a data-disclosure bug, not a tuning
 * decision, and `identity.test.ts` fails if it moves.
 *
 * WHAT THE CLAIM CARRIES, AND WHAT IT DELIBERATELY DOES NOT
 *
 * Only `sub`, the profile id. `current_access()` and `current_org()` do not read the claim —
 * they look the row up in `profiles` using `current_user_id()`. So authority comes from the
 * database, never from the token, and a forged claim still cannot grant itself a role. Do not
 * "optimise" that by putting the role in the claim.
 *
 * NO IDENTITY MEANS NO ROWS, NOT ALL ROWS
 *
 * Passing `null` sets no claim at all, so `current_user_id()` returns NULL and every policy
 * keyed on it matches nothing. That is the correct behaviour for an unauthenticated request
 * and it is the direction this fails in: forgetting to call this function does not expose
 * data, it returns none. Proven in `identity.test.ts`.
 *
 * TWO WAYS THIS IS SILENTLY USELESS, BOTH OF WHICH FAIL OPEN
 *
 * Neither is fixable here, and both are S2's problem — recorded so nobody reads this file and
 * concludes the job is done:
 *
 *   1. A table's OWNER bypasses its own policies unless the table carries
 *      `FORCE ROW LEVEL SECURITY`. This application connects as `orbit_app`, which owns the
 *      `orbit` database, so FORCE is mandatory on every table, not optional.
 *   2. A SUPERUSER is never restrained by RLS at all, FORCE or not. `.env.example` connects
 *      as `postgres`, so a developer machine or a test run using it has no row-level security
 *      whatsoever and will happily pass tests that production would fail.
 *
 * Both were proven in the spike, not reasoned about.
 */

/** The signed-in identity. Only the profile id; authority is read from the database. */
export type Identity = {
  /** `profiles.id` — becomes the `sub` claim. */
  profileId: string;
};

/** The transaction-scoped client handed to the callback. */
export type IdentityClient = Parameters<Parameters<PrismaClient['$transaction']>[0]>[0];

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Run `fn` in a transaction that carries `identity`, so RLS policies can see who is asking.
 *
 * Pass `null` for an unauthenticated request: no claim is set and policies match nothing.
 *
 * @throws if `identity.profileId` is not a uuid. A malformed claim would be read as NULL by
 *   `current_user_id()` and silently return zero rows, which looks identical to "this user
 *   owns nothing" — so it is refused here, loudly, rather than debugged later.
 */
export async function withIdentity<T>(
  prisma: PrismaClient,
  identity: Identity | null,
  fn: (tx: IdentityClient) => Promise<T>,
): Promise<T> {
  if (identity !== null && !UUID.test(identity.profileId)) {
    throw new Error('withIdentity: profileId is not a uuid; refusing to set an unreadable claim');
  }
  return prisma.$transaction(async (tx) => {
    if (identity !== null) {
      const claims = JSON.stringify({ sub: identity.profileId });
      // `claims` is a bind parameter, never interpolated. `true` is written literally because
      // it is the is_local flag described above and must not become a parameter.
      await tx.$executeRaw`select set_config('request.jwt.claims', ${claims}, true)`;
    }
    return fn(tx);
  });
}
