# PROMPT 1.5 — Auth and the three sign-in portals

**Date and time:** 2026-11-05, 9:30 AM CST (America/Chicago) — revision 4
**Objective:** Give Claude Code everything it needs to build the auth layer and three role-gated sign-in entries (`/login`, `/org/login`, `/admin/login`) for OrbitCrew, without touching any screen already specified in `ORBIT-OS_Claude_Code_Build_Prompts.md`.
**For:** Shuv Chowdhury (Ai), OrbitumAI
**Repo:** `shuvgenai/Orbitos`
**Prototype:** https://claude.ai/artifact/WCpjQBVBhViU8p3yyzKZFG

---

## ⚠️ Revision 4 — two defects found during migration work

**1. Revision 3's rule 1 was wrong, and it deadlocked role changes.** It said only a super admin may change `profiles.access`, while rule 3 gives a super admin no policy inside a customer office. A super admin has no `org_id`, so they cannot even see the profile row. Net effect as written: **nobody can promote or demote anyone**, and the Org Admin portal ships unable to manage its own people. PRD §7.1 puts "invite, access role, authorities" squarely on the Org Admin's People screen, so rule 1 contradicted the PRD too. Fixed by **D5** below; rule 1 is restated in the RLS section.

**2. `agents` was an ambiguous name.** Migration 0001 already shipped `orbitcrew.agent_definitions`, and an unqualified `agents` resolves to Paperclip's `public.agents`, which exists. Fixed by **D6** below.

---

## ⚠️ Revision 3 — the repo was found

A repo session located the web project: **`shuvgenai/Orbitos` on GitHub**, last commit 2026-10-02. Revision 2's claim that no web project exists was wrong. What is actually there, on all three branches:

| Present | Absent |
|---|---|
| `design/tokens.css`, `design/tokens.test.ts` | `vite.config.ts` |
| Eng Review v3 | `dashboards/` entries |
| | `ApiClient` / `MockApiClient` |
| | **PRD v9.0 — HEAD carries v6.2** |

Two consequences:

1. **The design package already lives there, so that repo is the home.** Do not scaffold a second repo beside it. Revision 2's `orbit-os-web` instruction is withdrawn.
2. **🔴 PRD v9.0 is not in the repo.** Every section of this document cites PRD v9.0 §7 and §15, and a build agent reading HEAD gets v6.2 instead. PRD v9.0 §15 exists precisely because v8.0's vagueness nearly caused thirty screens to be built wrong — running Prompt 0 against v6.2 reopens exactly that. **Commit PRD v9.0 before Prompt 0 runs.**

---

## ⚠️ Revision 2 — corrections carried forward

| # | Revision 1 said | Correction |
|---|---|---|
| 1 | "Slots in between Prompt 1 and Prompt 2" | **The Vite foundation does not exist.** Prompt 1.5 has nothing to sit in front of. See *Prerequisite*. |
| 2 | Brand written as "Orbitcrew" | **`OrbitCrew`** — capital O, capital C. `CLAUDE.md` names it the only accepted casing and the PRD v1.1 mockup audit counts the lowercase form as a defect. Only PRD v9.0's prose disagrees, and prose is not a naming rule. Prototype corrected. |
| 3 | "Supabase Auth + Postgres + RLS" without placement | **Self-hosted, one per customer instance.** `CLAUDE.md` requires customer data to stay on customer infrastructure. See D2 for the full placement rulings. |
| 4 | D3 framed as "confirm: no saffron" | **Wrongly framed.** Revision 1 read PRD v9.0 §15.2 and did not know `CLAUDE.md`, PRD v1.1 §15 and the seeded `orbitcrew.brand_config` all specify dark with `#FF9933`. Not a confirmation — a live contradiction. See D3. |

---

## Executive summary

The three dashboards were never an open design question. PRD v9.0 §7.1 names the three access roles; §15.3 names three separate entry files. What is missing is **auth**: the frontend spec takes identity from "the session" and, in development, from a Dev tools "Sign in as" select. There is no login screen anywhere in Prompts 0–7, and Prompt 7 says *"Do not add a backend, a database or Supabase."*

So the auth layer is additive. Self-hosted Supabase inside the existing instance database, one `profiles` table carrying `access`, three Vite entries, and a route guard per entry that **refuses** the wrong role instead of redirecting it. Refusing is the point: a link handed to a customer's staff should never open the operator console, even for an operator who happens to be signed in.

---

## 🔴 Prerequisite — the foundation has to be built first

The work goes in **`shuvgenai/Orbitos`**, which already holds `design/`. Order:

1. **Commit PRD v9.0** to the repo. HEAD is v6.2; every citation here assumes v9.0.
2. Unzip `orbit-os-frontend.zip` into `reference/`. Copy `CLAUDE.md` and `ORBIT-OS_Claude_Code_Build_Prompts.md` to the root if not already there.
3. Run **Prompt 0** (audit and plan) and **Prompt 1** (Vite three entries, `ApiClient` + `MockApiClient`, `AppShell`, `design/` wired in — the token package exists, so Prompt 1 wires it rather than authoring it).
4. *Then* paste Prompt 1.5, below. Prompts 2–5 screens can stay unbuilt: the three logins and the role guards work against `MockApiClient`.

**Blocker to check:** `orbit-os-frontend.zip` is the behaviour, copy and screen-flow spec for Prompts 2–5. If it is lost, Prompt 0 has nothing to read and those screens must be rebuilt from PRD §15.5–15.7 first. The auth layer does not depend on it; Prompts 2–5 do.

---

## 🔴 Decisions

### D1 — Tenancy (OD-3) · approved

`org_id` on every table with RLS keyed on it, deployed **one instance per customer** (one org row per instance). No workspace switching, no public self-signup, no shared database.

This takes both sides. The Eng Review §3 lists "a shared multi-tenant platform" as an explicit non-goal, and the Sept 16 decision — restated in `claude/2026-10-30-opencode-as-agent-runtime.md` — is dedicated-instance-per-client. Instance-per-org honours both. The `org_id` column costs nothing now and owes no migration if you consolidate later.

### D2 — Supabase, self-hosted · approved, with three placement rulings

Supabase Auth + Postgres + RLS behind the existing `ApiClient` interface, **self-hosted in each customer instance** on the Hostinger KVM4 + Coolify stack. Not hosted Supabase — `CLAUDE.md` requires customer data to stay on customer infrastructure, and hosted would also undercut D1.

Three follow-on questions surfaced once that was settled. All three are decided:

**D2a — Supabase uses the existing Postgres.** `auth`, `storage` and `_realtime` join `public` and `orbitcrew` in the **`paperclip`** database. This keeps `CLAUDE.md`'s one-database model and the dashboard's direct read of `public`. `profiles.id` keeps its real foreign key to `auth.users`.

*Rejected:* a separate Supabase Postgres — it breaks the one-database model and forces the dashboard's read of `public` through the Orchestrator API or a foreign data wrapper, a large change to buy separation nobody asked for. *Also rejected:* dropping the `auth.users` FK and holding a bare uuid — a trigger can check existence on insert but cannot cascade a delete, so the first deleted operator leaves an orphaned profile and the role gate reads from a dangling row. Referential integrity is exactly what you want load-bearing under a permission check.

Accepted cost: `backup.sh` and both restore tests widen to cover the new schemas. Do that in the same PR as the first migration, not later.

**D2b — no Realtime service for now.** Realtime is the only component requiring `wal_level=logical` on upstream's pinned Postgres, and **nothing in the auth path needs it**. Leave it out; the mock ticker stays, and polling covers live agent status until someone decides Realtime is worth the config change and restart. This removes the riskiest item in D2a's cost list.

**D2c — drop the `vector` service.** Supabase's stock self-host compose ships `timberio/vector`, which is MPL-2.0, against `CLAUDE.md`'s permissive-only dependency rule. Vector feeds only Studio's log viewer; Auth, PostgREST, Realtime and Storage do not need it. Remove it from the compose file.

MPL-2.0 is weak, file-level copyleft, and an unmodified, separately distributed container image very likely triggers no obligation — but that is a legal judgement, and what it buys is a log viewer. The project already plans Loki or ELK for logs. Not worth a recorded deviation, and not worth blocking Supabase over either: dropping one service is a one-line change.

Schema placement: OrbitCrew tables in schema `orbitcrew`, never `public`. Migrations in `orbitcrew/db/migrations`.

### D3 — `#FF9933` and the theme · **founder decision, still open**

Two document sets contradict each other, and neither is obviously stale:

| | Says |
|---|---|
| `CLAUDE.md` · PRD v1.1 §15 · `orbitcrew.brand_config` | Dark theme, accent `#FF9933`. Already seeded. |
| PRD v9.0 §15.1–15.2 · `design/tokens.test.ts` | Black and white, one red for errors only, "**no second accent colour**", light and dark following the phone. CI fails on an off-token colour. |

PRD v9.0 §15 exists specifically to stop this class of drift — its own text says v8.0's vagueness nearly caused thirty screens to be built wrong. Not a document to overrule casually. But `#FF9933` is already seeded in the database and enforced by `CLAUDE.md`, which is what a build agent actually obeys.

**One fact worth having before choosing:** `#FF9933` on white is about 2.3:1, failing the 4.5:1 floor in UX-7. On near-black it is about 9:1 and passes comfortably. So the accent is only viable in a dark-only product. The two document sets imply different *theme models*, not just different palettes — PRD v9.0's "theme follows the phone" cannot coexist with a saffron accent without a second palette.

**The narrowest resolution,** if you want the accent: keep PRD v9.0 §15 entire — Inter, 16px body, plain lists, no card grids, no KPI tiles, 44/48px targets, the contrast floor — and amend only §15.1 and §15.2 to add `--color-accent` and make the product dark-only. Accent for focus rings, the active nav underline and the running-status dot. Never body text, never a second status colour. Then update `design/tokens.test.ts` and PRD v9.0's change log so the next audit does not reopen it.

Until decided: build on the existing `design/tokens.css`. A token swap is one file; a layout rebuild is not.

### D4 — Phase 0 gate · approved

Founder sign-off on `governing/phase-0-discovery.md`, which the PRD requires before any later phase formally opens.

### D5 — Who may change a person's access level · decided

**The Org Admin, through a security-definer RPC. Never through a direct UPDATE, by anyone.**

Revision 3 got this wrong (see revision 4 note). The intent behind the old rule was to stop a user PATCHing themselves to `admin`. That intent is right; the rule was too wide. The correct constraint is narrower, and PRD §7.1 already assigns access-role management to the Org Admin's People screen.

```sql
create or replace function orbitcrew.set_access(
  target uuid, new_access orbitcrew.access_role
) returns void
language plpgsql security definer set search_path = orbitcrew as $$
declare caller_access orbitcrew.access_role; caller_org uuid;
        target_org uuid; target_access orbitcrew.access_role;
begin
  select access, org_id into caller_access, caller_org
    from orbitcrew.profiles where id = auth.uid();
  select access, org_id into target_access, target_org
    from orbitcrew.profiles where id = target;

  if caller_access <> 'admin' then
    raise exception 'only an Org Admin may change access';
  end if;
  if target is null or target_org is distinct from caller_org then
    raise exception 'that person is not in your office';
  end if;
  if target = auth.uid() then
    raise exception 'you cannot change your own access';
  end if;
  if new_access = 'super' or target_access = 'super' then
    raise exception 'operator access is not granted from an office';
  end if;
  if target_access = 'admin' and new_access <> 'admin'
     and (select count(*) from orbitcrew.profiles
          where org_id = caller_org and access = 'admin') <= 1 then
    raise exception 'an office keeps at least one Org Admin';
  end if;

  update orbitcrew.profiles set access = new_access where id = target;
  insert into orbitcrew.audit_log (org_id, actor, action, resource_type,
                                   resource_id, old_value, new_value)
    values (caller_org, auth.uid(), 'set_access', 'profile',
            target, target_access::text, new_access::text);
end $$;
```

Six guards, each one a test: caller is an Org Admin; target is in the caller's own office; **nobody changes their own access**; `super` is neither granted nor touched from inside an office; the last Org Admin cannot be demoted; every change writes an audit row.

**Rule 3 is untouched** — a super admin still reaches no office content. The RPC runs as definer on behalf of an Org Admin who is already inside the office, so nothing crosses the operator boundary.

**Access is not authority.** This RPC covers the access role only. Per PRD §7.2, granting Leader or Budget holder, or reducing a Leader, creates a *request* an existing Leader confirms — an Org Admin's attempt makes a request, not a change. Do not let `set_access` touch `profile_authorities`; that is a separate function with a different rule.

### D6 — `agents` means `orbitcrew.agent_definitions` · decided

Migration 0001 shipped `orbitcrew.agent_definitions`, "the agent as the user described it." That is exactly what Prompt 1.5's `agents` table describes: name, job, instructions and versions, guardrails, owner, budget. One concept, so one table. **Extend `agent_definitions` by additive ALTER** — add `org_id` and `owner_id`, then hang the ownership and guardrail policies there.

Do it in one migration: add both columns nullable, backfill `org_id` from the single org row and `owner_id` from the seed, then `set not null`. Additive ALTER on a shipped table is ordinary migration work, and 0002 is already applied — 0003 is simply next.

*Rejected:* a second `orbitcrew.agents` table — two tables for one idea, with no answer to which is authoritative and a standing job to keep them in step. *Also rejected, and the worst option:* renaming in the frontend only. `public` is on the search path and Paperclip's `public.agents` exists, so an unqualified `agents` in any later policy, view or migration resolves silently to Paperclip's table. That is not a readability problem, it is a live footgun pointed at the wrong schema.

**Therefore, everywhere:** schema-qualify every table reference in SQL. Add a CI check that fails any file under `orbitcrew/db/migrations` containing an unqualified `agents`. In the sections below, read `orbitcrew.agents` as `orbitcrew.agent_definitions`.

---

## Schema

Tables in schema `orbitcrew`, in the `paperclip` database. Migrations in `orbitcrew/db/migrations`.

```sql
-- ─── orgs ────────────────────────────────────────────────────────────
-- One row per office. Exactly one row in an instance-per-org deployment.
create table orbitcrew.orgs (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(name) >= 2),
  domain      text not null unique,
  launched    bool not null default false,
  step        int  not null default 1 check (step between 1 and 5),
  created_at  timestamptz not null default now()
);

-- ─── access roles (PRD §7.1) ─────────────────────────────────────────
create type orbitcrew.access_role as enum ('user','admin','super');

-- ─── profiles ────────────────────────────────────────────────────────
-- 1:1 with auth.users, which lives in the same database per D2a.
-- `access` is the sign-in level and is NEVER writable from the client.
create table orbitcrew.profiles (
  id          uuid primary key references auth.users on delete cascade,
  org_id      uuid references orbitcrew.orgs on delete cascade,
  email       citext not null unique,
  name        text not null,
  title       text,
  dept_id     uuid references orbitcrew.departments on delete set null,
  access      orbitcrew.access_role not null default 'user',
  invited     bool not null default true,
  created_at  timestamptz not null default now(),
  -- a super admin is an OrbitumAI operator and belongs to no office
  constraint super_has_no_org check (
    (access = 'super' and org_id is null) or
    (access <> 'super' and org_id is not null)
  )
);

-- ─── authorities (PRD §7.2) — separate from access, many per person ──
create type orbitcrew.authority as enum ('leader','approver','backup','budget');

create table orbitcrew.profile_authorities (
  profile_id  uuid references orbitcrew.profiles on delete cascade,
  authority   orbitcrew.authority not null,
  granted_by  uuid references orbitcrew.profiles,
  granted_at  timestamptz not null default now(),
  primary key (profile_id, authority)
);

-- Every office keeps at least one Org Admin and one Leader (PRD §7.2).
-- Deferred constraint trigger, not a client check.

-- ─── helpers used by every policy ────────────────────────────────────
create or replace function orbitcrew.current_access()
  returns orbitcrew.access_role
  language sql stable security definer set search_path = orbitcrew as $$
  select access from orbitcrew.profiles where id = auth.uid()
$$;

create or replace function orbitcrew.current_org() returns uuid
  language sql stable security definer set search_path = orbitcrew as $$
  select org_id from orbitcrew.profiles where id = auth.uid()
$$;
```

Every other table (`departments`, `agent_definitions`, `agent_versions`, `connections`, `requests`, `audit_log`, `spend`) carries `org_id uuid not null references orbitcrew.orgs` and the same two policies.

**Naming, per D6:** the table the sections below call `orbitcrew.agents` is the existing **`orbitcrew.agent_definitions`** from migration 0001, extended by additive ALTER. Always schema-qualify: an unqualified `agents` resolves to Paperclip's `public.agents`.

---

## RLS — the part that actually enforces the three portals

The route guard in the browser is a courtesy. **The database is the gate.**

```sql
alter table orbitcrew.agents enable row level security;

-- A user reaches rows in their own office, and only rows they own.
create policy agents_user_select on orbitcrew.agents for select
  using (
    org_id = orbitcrew.current_org()
    and (orbitcrew.current_access() = 'admin' or owner_id = auth.uid())
  );

-- A user may change instructions on an agent they own. Nothing else.
create policy agents_user_update on orbitcrew.agents for update
  using  (org_id = orbitcrew.current_org() and owner_id = auth.uid()
          and orbitcrew.current_access() in ('user','admin'))
  with check (org_id = orbitcrew.current_org() and owner_id = auth.uid());

-- Only an Org Admin creates or removes agents.
create policy agents_admin_write on orbitcrew.agents for all
  using (org_id = orbitcrew.current_org()
         and orbitcrew.current_access() = 'admin');
```

Four rules that are not negotiable, each with a test:

1. **`profiles.access` never changes through a direct UPDATE.** A `before update` trigger raises whenever `access` changed and the statement did not come from `orbitcrew.set_access()` (gate it on a `set_config`/`current_setting` flag the function sets). Without this, any user promotes themselves to Org Admin with one PATCH and all three portals become decoration. Legitimate role changes go through the D5 RPC, which carries its own six guards.
2. **Guardrails outrank instructions.** `guardrails` lives on `agents` with an admin-only update policy, and the user's instruction policy has a `with check` leaving it untouched. PRD: *"Users cannot edit guardrails (no control exists)"* — the absent button is UX; this is the enforcement.
3. **Super Admin sees counts and status, never content.** Super Admin gets **no** policy on `agents`, `requests` or any content table. The fleet console reads one view:
   ```sql
   create view orbitcrew.fleet_offices with (security_invoker = off) as
     select o.id, o.name, o.domain, o.launched,
            count(a.id) as agents,
            coalesce(sum(s.usd),0) as spend_7d
     from orbitcrew.orgs o
     left join orbitcrew.agents a on a.org_id = o.id
     left join orbitcrew.spend  s on s.org_id = o.id
                                 and s.at > now() - interval '7 days'
     group by o.id;
   -- grant select to super only
   ```
   PRD §7.2: *"The Super Admin never holds an authority inside a customer office."* Support access is a separate, logged `view_as` session the owner allowed — build the audit row, not a bypass policy.
4. **Authority is checked at the moment of decision and recorded with it.** Approving a request writes `decided_by`, `decided_with_authority`, `decided_at`. A Postgres function checks the authority; the client never decides.

---

## The three entries

| Entry | Login path | Accepts | Refuses | `<title>` |
|---|---|---|---|---|
| `dashboards/user/index.html` | `/login` | `user`, `admin` | `super` | OrbitCrew |
| `dashboards/org-admin/index.html` | `/org/login` | `admin` | `user`, `super` | OrbitCrew |
| `dashboards/fleet/index.html` | `/admin/login` | `super` | `user`, `admin` | ORBIT-OS |

The user entry accepts `admin` because PRD §7.1 says an Org Admin reaches everything a User reaches. The org entry does **not** accept `user`.

**Refuse, do not redirect.** If a signed-in User opens `/admin/login`, show "You don't have access to this sign-in" and a sign-out button. Do not bounce them to `/login` — a silent redirect teaches people the other portals exist and turns a URL into a role probe.

**One generic failure message**, for every cause — wrong password, no such account, right password at the wrong portal: *"Those details don't match an account for this sign-in."* A portal that says "this is an Org Admin account, use the other link" hands an attacker a role oracle over an email list.

**Deliberately not in the MVP:** magic links (Eng Review ENG2 uses them for the approval confirm page — a different flow, keep them separate), SSO, 2FA. Password plus email confirmation only. Note in `docs/plan.md` that Enterprise will need SAML.

---

## Paste this into the repo session — *after* Prompt 1

```
Role: Staff full-stack engineer on the ORBIT-OS web project. Follow CLAUDE.md strictly.

Read first, in this order:
1. CLAUDE.md
2. ORBIT-OS_Claude_Code_Build_Prompts.md — the shared spec section
3. ORBIT_OS_PRD_v9_0.md §7 (access roles and authorities) and §15 (design, naming, screens)
4. docs/auth-three-portals-build-prompt.md — this document, schema and RLS sections included

Stop and ask me before starting if any of these are missing: PRD v9.0 committed to the
repo (HEAD was v6.2 on 2026-11-05), the three Vite entries, the ApiClient interface with
MockApiClient, and the design/ token package with its passing tokens.test.ts. This prompt
sits in front of them and cannot run without them.

Task: Build the auth layer and the three role-gated sign-in entries. Do not change any
screen built in Prompts 1-5. This sits in front of them.

1. Self-hosted Supabase for this instance, sharing the existing paperclip database: auth
   and storage join public and orbitcrew there (D2a). Do not stand up a second Postgres.
   Remove the vector service from the compose file (D2c) and do not add the realtime
   service (D2b). Widen backup.sh and both restore tests to cover the new schemas in the
   same PR as the first migration.
   OrbitCrew tables in schema orbitcrew, never public. Migrations in
   orbitcrew/db/migrations, one file per concern: orgs, the access_role enum, profiles,
   authorities, the access-immutability trigger, the set_access RPC (D5), the
   at-least-one-admin-and-leader constraint trigger, the additive ALTER extending
   orbitcrew.agent_definitions with org_id and owner_id (D6), RLS policies per table,
   the fleet_offices view and its grant.
   Copy the schema and policies from this document verbatim; do not improvise names.
   Where this document says orbitcrew.agents, the table is the existing
   orbitcrew.agent_definitions from migration 0001 — extend it, do not create a second
   table. Schema-qualify every table reference; add a CI check that fails any migration
   file containing an unqualified `agents`, which would resolve to Paperclip's
   public.agents.

2. Seed the BrightPath Advisors demo office from src/shared/seeds, plus one super admin
   (shuv@orbitumai.com). Every seeded account uses the same dev password, read from an
   env var, never hard-coded. No service-role key in any client bundle.

3. SupabaseApiClient implementing the existing ApiClient interface from Prompt 1.
   Zod-parse every response. MockApiClient stays the default; selection is
   VITE_API_MODE=mock|supabase. Keep the mock ticker; do NOT add Supabase Realtime
   (per D2b it would force wal_level=logical on upstream's pinned Postgres). Do not
   change the interface.

4. src/shared/auth: a SessionProvider (Supabase session plus the signed-in profile,
   joined once and cached), useSession, and a RequireAccess guard taking an allow list
   of access roles.

5. One Login screen component shared by all three entries, taking portal props (brand,
   heading, sub, path, allow list). Build it from the design tokens only. Email and
   password, inline Zod validation, one generic failure message for every cause, 48px
   primary button, aria-live on the error banner.

6. Wire each entry per the table in this document. An authenticated profile whose access
   is not in that entry's allow list sees a refusal screen with a sign-out button — never
   a redirect to another portal. An unauthenticated visit to any protected route renders
   that entry's login.

7. Sign-out clears the Supabase session and returns to that entry's own login path.

Constraints: no direct supabase client calls outside SupabaseApiClient. Every component
under 150 lines. Tokens only, never a literal colour. The brand is spelled OrbitCrew,
capital O and capital C, everywhere including the <title>. Customer surfaces (user,
org-admin) must not contain the words Paperclip, Hermes, OpenClaw, MCP, adapter or
ORBIT-OS, including in the <title>.

Acceptance — Vitest for units, Playwright for the flows:
- A user signing in at /org/login is refused. A user signing in at /login succeeds.
- An Org Admin signing in at /login succeeds (they reach every User screen).
- An Org Admin signing in at /admin/login is refused.
- A super admin signing in at /login and at /org/login is refused.
- The refusal message is byte-identical for a wrong password, an unknown address, and a
  correct password at the wrong portal.
- A signed-in user PATCHing their own profiles.access to 'admin' is rejected by the
  database, not the client. Assert the Postgres error.
- A signed-in user selecting another user's agent gets zero rows.
- A signed-in user updating an agent's guardrails is rejected; the column is unchanged.
- A super admin selecting from agents, requests or any content table gets zero rows or a
  permission error. fleet_offices returns every office.
- Removing the last Org Admin, or the last Leader, is rejected by the constraint trigger.
- set_access: an Org Admin promotes a user in their own office and an audit row is written.
- set_access refuses: a caller who is not an Org Admin; a target in another office; the
  caller targeting themselves; new_access='super'; a target whose access is 'super'; and
  demoting the last Org Admin. Six separate tests, each asserting the Postgres error.
- A direct UPDATE on profiles.access outside set_access is rejected for every role,
  Org Admin included.
- No file under orbitcrew/db/migrations contains an unqualified reference to `agents`.
- Approving a request writes decided_by, decided_with_authority and decided_at.
- Deleting a row from auth.users cascades the matching orbitcrew.profiles row.
- A restore from backup.sh restores auth, storage, public and orbitcrew, and a user can
  still sign in afterwards.
- Grepping the built user and org-admin bundles for Paperclip, Hermes, OpenClaw, MCP and
  adapter finds nothing, and for 'Orbitcrew' (lowercase c) finds nothing.
- The compose file contains no vector service and no realtime service.
- axe reports zero serious or critical issues on all three login screens, both themes.
- Keyboard-only sign-in works on all three.

Write docs/auth.md: the three paths, the role matrix, every RLS policy and the rule it
enforces, and every place the client checks something only for convenience while the
database is the real gate.

Finish with a summary and wait. Do not start Prompt 2.
```

---

## What this unblocks, and what it does not

**Unblocked.** D1 settles OD-3, which was blocking Org Admin. Super Admin's sign-in and read-only fleet view need only the `fleet_offices` view, so that is unblocked too.

**Still blocked.** `control-api` gates Super Admin **actions** — provisioning an office, restarting an instance, demoting the founder account (S2d). Those live only in Paperclip's API today. Build the fleet console read path now; keep `orbitcrew/ci/role-integrity.sh` on WARN-ONLY under the dated exception in `governing/role-integrity-exception.md` until `control-api` can perform admin actions, and do not demote the founder account before then. Routine admin through `orbitcrew/db/BREAK-GLASS.md` is worse than the exception.

**Not started.** Prompts 0–1 in `shuvgenai/Orbitos` — the Vite three-entry setup, `ApiClient` + `MockApiClient`, and `AppShell`. That is the real critical path to a dashboard anyone can log into, and it is larger than this prompt. The `design/` package is already there, so Prompt 1 wires it rather than authoring it.

**Do first.** Commit PRD v9.0 to the repo. Everything here cites it, and HEAD carries v6.2.

---

*Shuv Chowdhury, Founder, Orbitumai*
