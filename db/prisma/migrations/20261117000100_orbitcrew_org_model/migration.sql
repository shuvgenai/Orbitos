-- FD-38 stage S2b: the org model, ported from orbitos-infra into the product.
--
-- WHAT THIS IS. Four tables, two enums, seven functions, four triggers and nine policies,
-- adopted from the `orbitcrew` schema that orbitos-infra has had applied and tested since
-- 2026-11-05. It is ADDITIVE: `Workspace` and `User` in `public` are untouched, and nothing
-- reads these tables yet. S3 adds `set_access()` and its five ordered guards; S4 adds
-- provisioning; the routes move later.
--
-- PORTED FROM THE APPLIED STATE, NOT FROM THE MIGRATION FILES. Infra reached this shape
-- through 0002 and then 0003, 0005, 0006, 0007, 0008, 0009 and 0010, several of which exist
-- to fix defects in the ones before -- 0006 closes a privilege escalation 0004 introduced,
-- 0009 closes a role oracle 0008 opened. Replaying that sequence into a new database would
-- reintroduce each defect and then fix it. So the function, trigger and policy bodies below
-- were taken verbatim out of the running database with pg_get_functiondef,
-- pg_get_triggerdef and pg_policies, and `db/test/org-model.test.ts` diffs what this
-- migration produces back against infra to prove they match.
--
-- A SEPARATE SCHEMA, DELIBERATELY. These objects go in `orbitcrew`, not `public`, for a
-- reason that would otherwise bite immediately: the product already has an `authority` enum
-- in `public` -- `approve_routine`, `approve_decline_refer`, `approve_board_level` -- and
-- infra has a DIFFERENT `authority` enum -- `leader`, `approver`, `backup`, `budget`. FD-38
-- rules that both are kept because they are orthogonal axes: what someone IS in the org
-- versus what they MAY APPROVE. Two enums of the same name cannot share a schema, so the
-- ruling needs the separation to be true at all.
--
-- OWNERSHIP. This runs as `orbit_owner` (see the FD-38 addendum). `orbit_app` is the runtime
-- and is granted row access only: it must never own these objects, because the trigger that
-- closed FD-12 admits a change to `access` only when `current_user` is the schema owner. If
-- the runtime owned them that test would hold on every request -- measured, a plain UPDATE
-- promoted a row to admin with the guard never firing.
--
-- FORCE ROW LEVEL SECURITY IS SET HERE AND IS NOT SET IN INFRA. Infra runs force=false on
-- all four and relies on its tests using a purpose-made non-owner role. The product cannot
-- rely on that, so the owner is subjected to its own policies too. The two mechanisms are
-- independent: FORCE governs row visibility, the trigger compares current_user to the owner,
-- and neither substitutes for the other.

CREATE SCHEMA IF NOT EXISTS orbitcrew;

-- The runtime is a guest here, exactly as it is in `public`. Without USAGE it cannot see the
-- schema at all, and Postgres reports that as `relation ... does not exist` rather than as a
-- permission error -- which reads like a missing table and sends you looking elsewhere.
-- Guarded, because a bare database with no orbit_app (a developer's own Postgres) should not
-- fail the migration.
DO $grant$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'orbit_app') THEN
        EXECUTE 'GRANT USAGE ON SCHEMA orbitcrew TO orbit_app';
    END IF;
END
$grant$;

-- ---------------------------------------------------------------- enums
-- CREATE TYPE has no IF NOT EXISTS, so each is guarded by name.
DO $t$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
                    WHERE n.nspname = 'orbitcrew' AND t.typname = 'access_role') THEN
        CREATE TYPE orbitcrew.access_role AS ENUM ('user', 'admin', 'super');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
                    WHERE n.nspname = 'orbitcrew' AND t.typname = 'authority') THEN
        CREATE TYPE orbitcrew.authority AS ENUM ('leader', 'approver', 'backup', 'budget');
    END IF;
END
$t$;

-- ---------------------------------------------------------------- tables
CREATE TABLE IF NOT EXISTS orbitcrew.orgs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    domain text NOT NULL,
    launched boolean DEFAULT false NOT NULL,
    step integer DEFAULT 1 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT orgs_name_check CHECK ((char_length(name) >= 2)),
    CONSTRAINT orgs_step_check CHECK (((step >= 1) AND (step <= 5))),
    CONSTRAINT orgs_pkey PRIMARY KEY (id),
    CONSTRAINT orgs_domain_key UNIQUE (domain)
);

CREATE TABLE IF NOT EXISTS orbitcrew.departments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    name text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT departments_name_check CHECK ((char_length(name) >= 2)),
    CONSTRAINT departments_pkey PRIMARY KEY (id),
    CONSTRAINT departments_org_id_name_key UNIQUE (org_id, name),
    CONSTRAINT departments_org_id_fkey FOREIGN KEY (org_id)
        REFERENCES orbitcrew.orgs(id) ON DELETE CASCADE
);

-- `id` carries no DEFAULT on purpose: it is the auth service's user id, supplied by whoever
-- creates the profile. `super_has_no_org` is what makes a super admin orgless and everyone
-- else placed -- see FD-15. `org_id` therefore stays nullable.
CREATE TABLE IF NOT EXISTS orbitcrew.profiles (
    id uuid NOT NULL,
    org_id uuid,
    email text NOT NULL,
    name text NOT NULL,
    title text,
    dept_id uuid,
    access orbitcrew.access_role DEFAULT 'user'::orbitcrew.access_role NOT NULL,
    invited boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT profiles_name_check CHECK ((char_length(name) >= 1)),
    CONSTRAINT super_has_no_org CHECK (
        (((access = 'super'::orbitcrew.access_role) AND (org_id IS NULL))
      OR ((access <> 'super'::orbitcrew.access_role) AND (org_id IS NOT NULL)))),
    CONSTRAINT profiles_pkey PRIMARY KEY (id),
    CONSTRAINT profiles_org_id_fkey FOREIGN KEY (org_id)
        REFERENCES orbitcrew.orgs(id) ON DELETE CASCADE,
    CONSTRAINT profiles_dept_id_fkey FOREIGN KEY (dept_id)
        REFERENCES orbitcrew.departments(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS orbitcrew.profile_authorities (
    profile_id uuid NOT NULL,
    authority orbitcrew.authority NOT NULL,
    granted_by uuid,
    granted_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT profile_authorities_pkey PRIMARY KEY (profile_id, authority),
    CONSTRAINT profile_authorities_profile_id_fkey FOREIGN KEY (profile_id)
        REFERENCES orbitcrew.profiles(id) ON DELETE CASCADE,
    CONSTRAINT profile_authorities_granted_by_fkey FOREIGN KEY (granted_by)
        REFERENCES orbitcrew.profiles(id)
);

-- Email is unique case-insensitively, which a plain UNIQUE would not give.
CREATE UNIQUE INDEX IF NOT EXISTS profiles_email_lower_key
    ON orbitcrew.profiles (lower(email));
CREATE INDEX IF NOT EXISTS profiles_org_id_idx  ON orbitcrew.profiles (org_id);
CREATE INDEX IF NOT EXISTS profiles_dept_id_idx ON orbitcrew.profiles (dept_id);

-- ---------------------------------------------------------------- functions
-- Verbatim from the running infra database via pg_get_functiondef.

CREATE OR REPLACE FUNCTION orbitcrew.authorities_keep_leader()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'orbitcrew', 'pg_temp'
AS $function$
DECLARE
    target  uuid;
    leaders integer;
BEGIN
    SELECT p.org_id INTO target
      FROM orbitcrew.profiles p
     WHERE p.id = COALESCE(NEW.profile_id, OLD.profile_id);

    -- No office means the profile itself is gone, or this is a super admin, who holds
    -- no authority inside a customer office. 0002's trigger covers the profile case.
    IF target IS NULL THEN
        RETURN NULL;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM orbitcrew.orgs o WHERE o.id = target) THEN
        RETURN NULL;
    END IF;

    SELECT count(*) INTO leaders
      FROM orbitcrew.profiles p
      JOIN orbitcrew.profile_authorities a ON a.profile_id = p.id
     WHERE p.org_id = target AND a.authority = 'leader';

    IF leaders < 1 THEN
        RAISE EXCEPTION
            'an office must keep at least one Leader'
            USING ERRCODE = 'integrity_constraint_violation';
    END IF;

    RETURN NULL;
END
$function$
;
CREATE OR REPLACE FUNCTION orbitcrew.current_access()
 RETURNS orbitcrew.access_role
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'orbitcrew', 'pg_temp'
AS $function$
DECLARE result orbitcrew.access_role;
BEGIN
    SELECT p.access INTO result
      FROM orbitcrew.profiles p
     WHERE p.id = orbitcrew.current_user_id();
    RETURN result;
END
$function$
;
CREATE OR REPLACE FUNCTION orbitcrew.current_org()
 RETURNS uuid
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'orbitcrew', 'pg_temp'
AS $function$
DECLARE result uuid;
BEGIN
    SELECT p.org_id INTO result
      FROM orbitcrew.profiles p
     WHERE p.id = orbitcrew.current_user_id();
    RETURN result;
END
$function$
;
CREATE OR REPLACE FUNCTION orbitcrew.current_user_id()
 RETURNS uuid
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'orbitcrew', 'pg_temp'
AS $function$
DECLARE
    claims text;
    sub    text;
BEGIN
    claims := current_setting('request.jwt.claims', true);
    IF claims IS NULL OR claims = '' THEN
        RETURN NULL;
    END IF;

    sub := (claims::jsonb) ->> 'sub';
    IF sub IS NULL OR sub = '' THEN
        RETURN NULL;
    END IF;

    RETURN sub::uuid;
EXCEPTION WHEN others THEN
    -- A malformed or unparseable claim is nobody, never somebody. Failing open here
    -- would hand an attacker a session by sending rubbish.
    RETURN NULL;
END
$function$
;
CREATE OR REPLACE FUNCTION orbitcrew.org_keeps_admin_and_leader()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'orbitcrew', 'pg_temp'
AS $function$
DECLARE
    target  uuid := COALESCE(NEW.org_id, OLD.org_id);
    admins  integer;
    leaders integer;
BEGIN
    IF target IS NULL THEN
        RETURN NULL;
    END IF;

    -- An office row that is itself gone is being removed wholesale; nothing to keep.
    IF NOT EXISTS (SELECT 1 FROM orbitcrew.orgs o WHERE o.id = target) THEN
        RETURN NULL;
    END IF;

    SELECT count(*) INTO admins
      FROM orbitcrew.profiles p
     WHERE p.org_id = target AND p.access = 'admin';

    SELECT count(*) INTO leaders
      FROM orbitcrew.profiles p
      JOIN orbitcrew.profile_authorities a ON a.profile_id = p.id
     WHERE p.org_id = target AND a.authority = 'leader';

    IF admins < 1 THEN
        RAISE EXCEPTION
            'an office must keep at least one Org Admin'
            USING ERRCODE = 'integrity_constraint_violation';
    END IF;

    IF leaders < 1 THEN
        RAISE EXCEPTION
            'an office must keep at least one Leader'
            USING ERRCODE = 'integrity_constraint_violation';
    END IF;

    RETURN NULL;
END
$function$
;
CREATE OR REPLACE FUNCTION orbitcrew.profile_names_real_account()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'orbitcrew', 'pg_temp'
AS $function$
DECLARE
    found boolean;
BEGIN
    -- Inert until the auth service exists. Checking for the table by catalogue rather
    -- than catching an error keeps the failure mode honest: absent means not yet
    -- installed, present means the row must match.
    IF NOT EXISTS (
        SELECT 1 FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'auth' AND c.relname = 'users'
    ) THEN
        RETURN NULL;
    END IF;

    EXECUTE 'SELECT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = $1)'
       INTO found USING NEW.id;

    IF NOT found THEN
        RAISE EXCEPTION
            'profile % does not name a real account', NEW.id
            USING ERRCODE = 'integrity_constraint_violation';
    END IF;

    RETURN NULL;
END
$function$
;
CREATE OR REPLACE FUNCTION orbitcrew.profiles_guard_access()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'orbitcrew', 'pg_temp'
AS $function$
DECLARE
    owner name;
BEGIN
    IF NEW.access IS NOT DISTINCT FROM OLD.access THEN
        RETURN NEW;
    END IF;

    SELECT pg_catalog.pg_get_userbyid(n.nspowner) INTO owner
      FROM pg_catalog.pg_namespace n
     WHERE n.nspname = 'orbitcrew';

    -- Inside set_access() the effective user is the owner, because that function is
    -- SECURITY DEFINER. A client role is never the owner, whatever it sets on its
    -- connection.
    IF current_user IS DISTINCT FROM owner THEN
        RAISE EXCEPTION
            'access is not writable here'
            USING ERRCODE = 'insufficient_privilege',
                  HINT    = 'change it with orbitcrew.set_access()';
    END IF;

    RETURN NEW;
END
$function$
;

-- ---------------------------------------------------------------- triggers
CREATE CONSTRAINT TRIGGER authorities_keep_leader AFTER DELETE OR UPDATE ON orbitcrew.profile_authorities DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION orbitcrew.authorities_keep_leader();
CREATE CONSTRAINT TRIGGER profile_names_real_account AFTER INSERT OR UPDATE OF id ON orbitcrew.profiles DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION orbitcrew.profile_names_real_account();
CREATE TRIGGER profiles_guard_access BEFORE UPDATE ON orbitcrew.profiles FOR EACH ROW EXECUTE FUNCTION orbitcrew.profiles_guard_access();
CREATE CONSTRAINT TRIGGER profiles_keep_admin_and_leader AFTER DELETE OR UPDATE ON orbitcrew.profiles DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION orbitcrew.org_keeps_admin_and_leader();

-- ---------------------------------------------------------------- row level security
ALTER TABLE orbitcrew.orgs                ENABLE ROW LEVEL SECURITY;
ALTER TABLE orbitcrew.departments         ENABLE ROW LEVEL SECURITY;
ALTER TABLE orbitcrew.profiles            ENABLE ROW LEVEL SECURITY;
ALTER TABLE orbitcrew.profile_authorities ENABLE ROW LEVEL SECURITY;

-- FORCE, which infra does not set. Without it the OWNER of each table bypasses its own
-- policies, and in this product the owner is a real login that runs migrations and will later
-- run SECURITY DEFINER functions. Proven: with RLS enabled but not forced, the owner read
-- every row.
ALTER TABLE orbitcrew.orgs                FORCE ROW LEVEL SECURITY;
ALTER TABLE orbitcrew.departments         FORCE ROW LEVEL SECURITY;
ALTER TABLE orbitcrew.profiles            FORCE ROW LEVEL SECURITY;
ALTER TABLE orbitcrew.profile_authorities FORCE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------- policies
-- Verbatim from pg_policies on the running infra database.

CREATE POLICY departments_admin_write ON orbitcrew.departments FOR ALL TO public USING (((org_id = orbitcrew.current_org()) AND (orbitcrew.current_access() = 'admin'::orbitcrew.access_role))) WITH CHECK (((org_id = orbitcrew.current_org()) AND (orbitcrew.current_access() = 'admin'::orbitcrew.access_role)));
CREATE POLICY departments_member_select ON orbitcrew.departments FOR SELECT TO public USING ((org_id = orbitcrew.current_org()));
CREATE POLICY orgs_admin_update ON orbitcrew.orgs FOR UPDATE TO public USING (((id = orbitcrew.current_org()) AND (orbitcrew.current_access() = 'admin'::orbitcrew.access_role))) WITH CHECK ((id = orbitcrew.current_org()));
CREATE POLICY orgs_member_select ON orbitcrew.orgs FOR SELECT TO public USING ((id = orbitcrew.current_org()));
CREATE POLICY authorities_admin_write ON orbitcrew.profile_authorities FOR ALL TO public USING (((EXISTS ( SELECT 1
   FROM orbitcrew.profiles p
  WHERE ((p.id = profile_authorities.profile_id) AND (p.org_id = orbitcrew.current_org())))) AND (orbitcrew.current_access() = 'admin'::orbitcrew.access_role))) WITH CHECK (((EXISTS ( SELECT 1
   FROM orbitcrew.profiles p
  WHERE ((p.id = profile_authorities.profile_id) AND (p.org_id = orbitcrew.current_org())))) AND (orbitcrew.current_access() = 'admin'::orbitcrew.access_role)));
CREATE POLICY authorities_member_select ON orbitcrew.profile_authorities FOR SELECT TO public USING ((EXISTS ( SELECT 1
   FROM orbitcrew.profiles p
  WHERE ((p.id = profile_authorities.profile_id) AND (p.org_id = orbitcrew.current_org())))));
CREATE POLICY profiles_admin_update ON orbitcrew.profiles FOR UPDATE TO public USING (((org_id = orbitcrew.current_org()) AND (orbitcrew.current_access() = 'admin'::orbitcrew.access_role))) WITH CHECK ((org_id = orbitcrew.current_org()));
CREATE POLICY profiles_member_select ON orbitcrew.profiles FOR SELECT TO public USING ((org_id = orbitcrew.current_org()));
CREATE POLICY profiles_self_update ON orbitcrew.profiles FOR UPDATE TO public USING ((id = orbitcrew.current_user_id())) WITH CHECK (((id = orbitcrew.current_user_id()) AND (org_id = orbitcrew.current_org())));

-- ---------------------------------------------------------------- grants
-- Row access for the runtime, and nothing more: no CREATE, no ownership. RLS then decides
-- WHICH rows, which is the whole arrangement -- a grant says "may touch this table", a policy
-- says "may touch these rows", and the runtime needs the first before the second can matter.
DO $grant2$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'orbit_app') THEN
        EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA orbitcrew TO orbit_app';
        EXECUTE 'GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA orbitcrew TO orbit_app';
    END IF;
END
$grant2$;
