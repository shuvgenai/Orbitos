-- FD-38 stage S4: operator provisioning. The founder creates the office and its first admin;
-- from there the org admin builds the structure without him.
--
-- NEW CODE, NOT A PORT. S2b and S3 adopted objects that orbitos-infra has had applied and
-- tested since 2026-11-05. There is no provisioning function there to copy -- TODOS.md calls
-- it "PROPOSAL, nothing built" -- so this is the first part of FD-38 written rather than
-- carried across, and it gets the scrutiny that deserves.
--
-- THE DATABASE DOES NOT ENFORCE A COMPLETE OFFICE, WHICH I ASSUMED IT DID AND IT DOES NOT.
-- `profiles_keep_admin_and_leader` and `authorities_keep_leader` are both
-- `AFTER DELETE OR UPDATE`. Nothing fires on INSERT. Measured: an office inserted with zero
-- profiles commits cleanly. The triggers stop you REMOVING the last admin or leader; they do
-- nothing about never creating one. So completeness is this function's job, and
-- `set-access.test.ts` checks the OUTCOME -- one admin, holding `leader` -- rather than
-- trusting a trigger to have refused.
--
-- WHY TWO FUNCTIONS. There is a chicken and egg: `provision_office` requires a `super`
-- caller, and on a brand new instance no profile exists at all, so nobody can be super yet.
-- `bootstrap_operator` exists only to break that, once, and is built so it cannot be useful
-- a second time.

-- ---------------------------------------------------------------- bootstrap_operator
-- Creates the FIRST profile, the operator, who belongs to no office (`super_has_no_org`).
--
-- IT REFUSES IF ANY PROFILE EXISTS, which makes it self-limiting: on a running instance it
-- is inert, so the worst it can do is fail. That is the property that lets it exist at all.
CREATE OR REPLACE FUNCTION orbitcrew.bootstrap_operator(
    p_id uuid, p_email text, p_name text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'orbitcrew', 'pg_temp'
AS $function$
BEGIN
    -- Serialised, because "is the table empty?" is not a safe question to ask concurrently:
    -- two callers can both read zero and both insert. The lock is transaction-scoped and
    -- released at commit or rollback.
    PERFORM pg_advisory_xact_lock(hashtext('orbitcrew.bootstrap_operator'));

    IF EXISTS (SELECT 1 FROM orbitcrew.profiles) THEN
        RAISE EXCEPTION 'this instance already has profiles; bootstrap runs once'
            USING ERRCODE = 'integrity_constraint_violation';
    END IF;

    INSERT INTO orbitcrew.profiles (id, org_id, email, name, access, invited)
    VALUES (p_id, NULL, p_email, p_name, 'super', false);

    INSERT INTO orbitcrew.audit_log (org_id, actor, action, entity_type, entity_id, fields, detail)
    VALUES (NULL, 'bootstrap', 'operator.created', 'profile', p_id::text,
            ARRAY['access'], jsonb_build_object('to', 'super'));
END
$function$;

-- POSTGRES GRANTS EXECUTE TO PUBLIC ON EVERY NEW FUNCTION. Without this revoke, "owner only"
-- would be a comment rather than a fact, and `orbit_app` -- the role a compromised web
-- process holds -- could mint itself an operator on any instance that had not been
-- bootstrapped. No GRANT follows, deliberately: the owner can execute it because the owner
-- owns it, and nobody else is given a way in. `provisioning.test.ts` asserts this rather than
-- trusting it, because the fixtures elsewhere run `grant execute on all functions` and would
-- otherwise paper over exactly this.
REVOKE EXECUTE ON FUNCTION orbitcrew.bootstrap_operator(uuid, text, text) FROM PUBLIC;

-- ---------------------------------------------------------------- provision_office
-- The operator creates an office and its first Org Admin, in one statement, because an
-- office without an admin is a dead end and nothing in the schema would stop one existing.
CREATE OR REPLACE FUNCTION orbitcrew.provision_office(
    p_org_name text, p_domain text,
    p_admin_id uuid, p_admin_email text, p_admin_name text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'orbitcrew', 'pg_temp'
AS $function$
DECLARE
    caller  uuid := orbitcrew.current_user_id();
    new_org uuid;
BEGIN
    -- GUARD A — only the operator provisions. The founder's decision, 2026-11-17: nobody
    -- reaches a cloud instance without going through him. An Org Admin cannot create a
    -- second office, and a plain user certainly cannot.
    IF orbitcrew.current_access() IS DISTINCT FROM 'super' THEN
        RAISE EXCEPTION 'only the operator can provision an office'
            USING ERRCODE = 'insufficient_privilege';
    END IF;

    PERFORM pg_advisory_xact_lock(hashtext('orbitcrew.provision_office'));

    -- GUARD B — FD-1: one instance per customer, `orgs` holds exactly one row. Enforced
    -- here rather than trusted, so nothing can quietly create a second office. If the fleet
    -- is ever consolidated this is one migration to relax, and FD-1 would be amended first.
    IF EXISTS (SELECT 1 FROM orbitcrew.orgs) THEN
        RAISE EXCEPTION 'this instance already has an office (FD-1: one office per instance)'
            USING ERRCODE = 'integrity_constraint_violation';
    END IF;

    INSERT INTO orbitcrew.orgs (name, domain) VALUES (p_org_name, p_domain)
    RETURNING id INTO new_org;

    INSERT INTO orbitcrew.profiles (id, org_id, email, name, access)
    VALUES (p_admin_id, new_org, p_admin_email, p_admin_name, 'admin');

    -- THE LEADER GRANT IS NOT OPTIONAL. `org_keeps_admin_and_leader` refuses, at COMMIT, any
    -- office left without one -- so an office provisioned without it is an office whose first
    -- profile change fails with `an office must keep at least one Leader`, pointing at
    -- nothing in particular. Discovered the hard way while writing S3's fixtures.
    INSERT INTO orbitcrew.profile_authorities (profile_id, authority, granted_by)
    VALUES (p_admin_id, 'leader', caller);

    INSERT INTO orbitcrew.audit_log (org_id, actor, action, entity_type, entity_id, fields, detail)
    VALUES (new_org, COALESCE(caller::text, 'unknown'), 'office.provisioned', 'org',
            new_org::text, ARRAY['name', 'domain'],
            jsonb_build_object('admin', p_admin_id::text, 'domain', p_domain));

    RETURN new_org;
END
$function$;

-- Same reasoning as above: revoke the implicit PUBLIC grant, then give it back only to the
-- runtime, which still has to arrive carrying a `super` identity to get past guard A.
REVOKE EXECUTE ON FUNCTION orbitcrew.provision_office(text, text, uuid, text, text) FROM PUBLIC;

DO $grant$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'orbit_app') THEN
        EXECUTE 'GRANT EXECUTE ON FUNCTION orbitcrew.provision_office(text, text, uuid, text, text) TO orbit_app';
    END IF;
END
$grant$;
