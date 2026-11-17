-- Remove FORCE ROW LEVEL SECURITY from the org model. It breaks the policies in production
-- and cannot break them in the test database, which is why it shipped.
--
-- A NEW MIGRATION RATHER THAN AN EDIT. 20261117000100 is applied and checksummed; the rule
-- is that a defective applied migration is fixed by a new one, never by re-applying or
-- editing the old number.
--
-- WHAT WENT WRONG. Every policy here reads `... = orbitcrew.current_org()`, and
-- `current_org()` is a SECURITY DEFINER function that SELECTs from `orbitcrew.profiles` --
-- which is itself one of the guarded tables. FORCE subjects a table's OWNER to its own
-- policies. So inside the function the SELECT fires the policy, the policy calls the
-- function, the function SELECTs again:
--
--     54001 stack depth limit exceeded
--
-- MEASURED, one variable at a time:
--
--     FORCE off, owner is a plain role   (what infra runs)          -> OK, returns rows
--     FORCE on,  owner is a plain role   (what PRODUCTION would be) -> 54001 stack depth
--     FORCE on,  owner is a SUPERUSER    (what the test db has)     -> OK, returns rows
--
-- That third line is why the S2b tests passed. `DATABASE_URL` for the suite connects as
-- `postgres`, so the migration ran as a superuser and the schema is owned by one -- and a
-- SECURITY DEFINER function owned by a superuser bypasses RLS, so the cycle never forms. The
-- test environment hid a production-only failure. `db/test/org-model.test.ts` now builds the
-- production arrangement explicitly rather than trusting the suite's own ownership.
--
-- WHY DROPPING IT IS SAFE, AND NOT A RETREAT. FORCE was added to stop a table's owner reading
-- past its own policies. The FD-38 addendum had already solved that a different way: the
-- runtime role `orbit_app` does not own these objects, so RLS applies to it with or without
-- FORCE. FORCE only ever constrained `orbit_owner` -- which exists to run migrations and
-- SECURITY DEFINER functions, and is exactly what FORCE breaks. It was redundant with the
-- ownership split and harmful on its own. Infra has run force=false since 2026-11-05 for the
-- same reason, and its 28 cases pass against a purpose-made non-owner role.
--
-- WHAT STILL GUARDS THE OWNER, so this is not simply a hole:
--   * `orbit_owner` has no interactive use; the application never connects as it.
--   * `template/install.sh` stage 5 refuses an instance whose schema is owned by the runtime.
--   * `template/test/postgres-logins.test.ts` asserts the runtime is not the owner, and that
--     neither role is superuser or BYPASSRLS.

ALTER TABLE orbitcrew.orgs                NO FORCE ROW LEVEL SECURITY;
ALTER TABLE orbitcrew.departments         NO FORCE ROW LEVEL SECURITY;
ALTER TABLE orbitcrew.profiles            NO FORCE ROW LEVEL SECURITY;
ALTER TABLE orbitcrew.profile_authorities NO FORCE ROW LEVEL SECURITY;
