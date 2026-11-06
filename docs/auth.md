# Auth and the three sign-in portals

**Built:** 2026-11-05, extended 2026-11-06 · **Prompt:** 1.5, items 4 to 7 only (FD-26) ·
**Backend:** none yet

> **Corrected 2026-11-06.** This document was written before FD-30 renamed the entries, and
> named `/admin/login`, `dashboards/fleet/` and `dashboards/org-admin/`. The entries are now
> `dashboards/superadmin/` and `dashboards/orgadmin/`, signed in at `/superadmin/login`;
> `/admin/login` still redirects. The **matrix rows below are corrected**. Prose further down
> that quotes an old path inside a historical sentence -- what a module used to carry, what a
> test used to check -- is left as written, because rewriting it would make the history wrong.

Prompt 1.5 asks for this document. It covers what exists. The RLS half — every policy and
the rule it enforces — belongs with items 1 to 3, which are **not built**; FD-26 records
that as owed, and the section at the end lists what the database must enforce so the
difference between "the client checks this" and "this is enforced" stays visible.

---

## The three paths, and the matrix

| Public path | Entry file | Admits | Refuses | `<title>` |
|---|---|---|---|---|
| `/login` | `dashboards/user/index.html` | `user`, `admin` | everyone else | OrbitCrew |
| `/org/login` | `dashboards/orgadmin/index.html` | `admin` | `user`, and everyone else | OrbitCrew |
| `/superadmin/login` | `dashboards/superadmin/index.html` | `super` | `user`, `admin` | ORBIT-OS |

The User entry admits `admin` because PRD §7.1 says an Org Admin reaches everything a User
reaches. The Org Admin entry does **not** admit `user`: that asymmetry is the one thing in
the matrix worth reading twice.

Each login path is a deploy-time rewrite onto its entry's HTML, not a separate build —
routing is hash-based, so a path needs no server logic. The mapping lives in exactly one
place, `vite.config.ts`, which is also the dev server's. **There is still no production
rewrite config** (no `_redirects`, no Coolify rule), so in a deployed build today the six
public paths would 404; the entries are at `dist/dashboards/<entry>/`.

## Refuse, never redirect — and the two different refusals

Prompt 1.5: "a silent redirect teaches people the other portals exist and turns a URL into a
role probe." So nothing here ever bounces anyone to another entry, and the refusal screen
contains **no link at all** — a link to another portal is the redirect by another name, and
a test asserts the refusal renders zero anchors.

There are two distinct paths, and conflating them is the mistake to avoid:

**1. Signing in at the wrong portal → the generic failure.** The allow list is checked
*inside* `signIn`, before any session is established. A correct password at the wrong portal
produces the same message as a wrong password and as an unknown address:

> Those details don't match an account for this sign-in.

One exported constant, `SIGN_IN_FAILURE`. Signing someone in and *then* refusing them would
confirm the account exists, which is the role oracle the prompt is about. A test asserts the
three causes produce byte-identical text and that **no session is created** for any of them.

**2. Already signed in, arriving at the wrong entry → the refusal screen.** The three
entries share one origin and one session in development, so an Org Admin who signed in at
`/login` and then opens `/admin/login` has a valid session the fleet entry must not honour.
`RequireAccess` shows PRD §15.4's "not yours" state with a **sign-out button** and nothing
else. Sign-out clears the session and returns to **that entry's own** login path.

## How `super` reaches the fleet entry without reaching the customer bundles

The question that had to be answered before building. Three parts:

**1. `Access` stays `user | admin`, and that is correct, not a compromise.** It is what a
person *in an office* can be. A super admin has no office row at all — no `org_id`, per
migration `0010`'s `super_has_no_org` — so they are never a row in an office's people list.
`AccessRole` matches the full `orbitcrew.access_role` enum (`user`, `admin`, `super`) for
the places that need the database's shape.

**2. The allow list is data, not a type.** `Portal.allow` is `readonly string[]`, supplied
by each entry from its own `src/apps/<entry>/portal.ts`. The shared auth code compares
strings and never names them. `'super'` is written in exactly one file,
`src/apps/fleet/portal.ts`, along with the operator's account, `ORBIT-OS`, `Super Admin`,
`Operator sign-in` and `/admin/login`.

**3. The customer entries authenticate only office people.** The operator account is passed
into `SessionProvider` by the fleet entry alone (`accounts={OPERATOR_ACCOUNTS}`). The
customer entries pass none, so an operator address appears nowhere in their bundles — and
nothing observable changes, because an operator at `/login` gets the same generic failure
whether the entry has never heard of the address or knows it and declines.

### What this required removing, measured in `dist` rather than assumed

Prompt 1 had shared three modules that enumerated all three roles, and the result was worse
than the original question:

| Was shared | Carried into both customer bundles | Now |
|---|---|---|
| `layout/entries.ts` (the three-entry map) | `ORBIT-OS`, `Operator`, `/admin/login` | deleted; each entry owns its `portal.ts` |
| `layout/nav.ts` (`navFor(role)`) | the operator console's nav labels | shape only; each entry owns its nav |
| `seeds/config.ts` (`APP_NAME_OPERATOR`) | `ORBIT-OS` | moved into the fleet portal |
| `seeds/fleet-registry.ts` (sample offices) | `orbitumai.com`, Northwind, Harbor & Co | moved to `apps/fleet/registry.ts`; the mock takes them as an option |

The last one was not a §15.3 matter — those strings are not on its ban list — but FD-1 is
instance-per-org, and **one customer's bundle carrying another customer's name is wrong
whether or not a rule lists it.**

One more thing the measurement caught: rolldown's automatic chunking had placed fleet-only
modules into a chunk all three entries load. Chunking is therefore explicit in
`vite.config.ts`, and that is a correctness requirement here, not a performance tweak.

### Why the bundle guard does not test for the word `super`

It tests `ORBIT-OS`, `Super Admin`, `/admin/login`, `All offices`, `Operator sign-in`,
`orbitumai.com`, `op_shuv` and `Orbitcrew` (lowercase c, banned by Prompt 1.5) —
case-sensitively, because `OrbitCrew` and `OrbitumAI` are both correct on a customer screen.

It does **not** test the bare word `super`, and that is deliberate. `super()` is a
JavaScript keyword: it appears 13 times in the vendor chunk inside transpiled classes from
TanStack Query and Radix. A test for it could never pass, and an unpassable test teaches the
next person to delete the guard. Every string that would actually *identify* the operator
console is covered instead.

## Accessibility

axe-core 4.14.0, zero violations of any impact on all three login screens in **both
themes**, run in a real browser so the colour-contrast rule actually executes:

| Screen | Light | Dark |
|---|---|---|
| `/login` | 0 violations | 0 violations |
| `/org/login` | 0 violations | 0 violations |
| `/admin/login` | 0 violations | 0 violations |

The same screens are also checked in the jsdom suite, where `color-contrast` is explicitly
disabled rather than left to report a false pass — jsdom computes no colours. Contrast in
both themes is separately guaranteed by `design/tokens.test.ts`, which asserts every text
token reaches 4.5:1 on paper and canvas in light and dark.

Keyboard-only sign-in is tested on all three entries: Tab to email, Tab to password, Enter
to submit. The primary button is 48px (PRD §15.2's Approve height — signing in is the
heaviest commit on the screen). The failure banner is an `aria-live` region, so it is
announced without moving focus.

**A licence question this raised.** `axe-core` is **MPL-2.0**, and CLAUDE.md says
"Permissive only … no copyleft". FD-8 dropped `vector` for exactly that licence. The
difference: `vector` was a runtime service in the shipped compose file, whereas `axe-core`
is a **devDependency used only in tests and never bundled**. Recorded as **FD-28, open** —
it needs a one-line ruling, and if the answer is no, the structural assertions can be
hand-written at the cost of losing the contrast check.

## What the client checks only for convenience

Everything below is a screen-level check today. **None of it is enforced**, because items 1
to 3 of Prompt 1.5 — Supabase, the schema, the RLS policies — are not built (FD-26). The
database is the real gate and it is not yet in the path.

| The client does | The database must enforce | Where it lives today |
|---|---|---|
| hides the console unless `access` is in `portal.allow` | RLS per table, keyed on `org_id`; a super admin has no policy inside a customer office | migrations `0002`–`0010`, applied in the infra repo but not reachable from this app |
| filters agents to `ownerId === profile.id` on the User home | a user selecting another user's agent gets zero rows | RLS, migration `0004` |
| shows guardrails read-only to a user | a user updating `guardrails` is rejected and the column is unchanged | the guardrails immutability trigger, migration `0004` |
| checks the password against `VITE_DEV_PASSWORD` | Supabase Auth, with the seeded password from an env var | not built |
| refuses a second Coordinator, a self-manager, a fourth level | the same rules in `contract/v1` | not built |
| leaves `profiles.access` unwritable from any screen | `set_access` only, guarded five ways; a direct UPDATE is rejected for every role including Org Admin | migrations `0006`–`0009`, FD-12, FD-14 |

**The sign-in check is the sharpest example.** `SessionProvider` compares a password to an
environment variable in the browser. That is a development fixture and nothing else. It is
not a credential check, it keeps no secret, and it must not survive contact with a real
account — which is precisely what item 3 replaces.

---

# The invitation path (PRD A-04) — added 2026-11-06

A fourth way into the product, beside the three sign-ins: an **invitation link**, which is
how an Org Admin reaches an office that has just been provisioned for them and in which they
do not yet have an account.

| Public path | Entry file | Who opens it | What it does |
|---|---|---|---|
| `/orgadmin#/invite/<token>` | `dashboards/orgadmin/index.html` | the invited Org Admin, signed out | sets a password, signs them in, lands on onboarding |

## It renders OUTSIDE `RequireAccess`, deliberately

Every other route in the Org Admin entry is behind the guard. This one is checked in
`App.tsx` **before** the guard runs, because an invitee is signed out *by definition* — they
have no account until they accept — so a guard in front of this screen would hand them a
sign-in form for the office they are being invited to.

It is not a hole in the guard. The token is the only thing that opens it, it is good once and
for seven days, and nothing else in the entry moved.

## Keyed by token, never by office id

`getInvite(token)` and `acceptInvite(token, password)` take a token. In production the link
is served by **that office's own deployment** (FD-1: instance-per-org), so the token is what
routes — there is no office identifier to pass, and that is why these two do not breach
FD-31's rule that office-facing operations carry none.

## The three refusals, and why two of them read the same

| Cause | What the screen says |
|---|---|
| already accepted | This invitation has already been used. |
| older than 7 days | This invitation has expired. |
| unknown **or** tampered token | This invitation link is not valid. |

The last row is the point: a separate message for "no such invitation" would turn the URL
into a **token oracle**, the same mistake `RequireAccess` refuses to make with roles. A test
asserts an unknown token and a token with one character changed produce byte-identical text,
and that the refusal screen renders **zero anchors** — a link to another sign-in is the
redirect by another name.

"Used" is reported ahead of "expired" when an invitation is both. Telling someone who already
has an office that their invitation ran out would send them asking for a link they do not
need.

## NOTHING HERE IS ENFORCEMENT — and the password is not even kept

This is the sharpest example in this document, sharper than the sign-in check above it.

**The password the invitee chooses is validated for shape — at least 8 characters — and then
discarded.** Not stored in plaintext. Not hashed either.

- There is **no credential store in the browser.** A plaintext password in localStorage would
  be worse than none at all.
- A hash would be worse still in a different way: it would make this screen *look* like the
  gate it is not, and the next person would believe it.
- Sign-in continues to compare against `VITE_DEV_PASSWORD` (FD-26). The accepted invitation
  establishes the session; the password establishes nothing.

A test asserts the chosen string appears nowhere in storage. The screen tells its reader the
same thing, in plain words, because the person who needs to know is the one typing it.

**The token is not signed either.** It is 32 bytes from `crypto.getRandomValues` — opaque,
unguessable, and proving nothing about who issued it. `shared/src/approval-link.ts` already
holds the right shape for the real thing (an HMAC over id and expiry, checked *before*
either is trusted), but it needs `node:crypto` and a secret, and a secret shipped in a
browser bundle is both meaningless and forbidden by CLAUDE.md.

**Prompt 1.5 items 1 to 3 — Supabase, the schema and RLS, `SupabaseApiClient` — replace all
of it.** Until they land, this is a development fixture.

| The client does | The database and the service must enforce |
|---|---|
| marks the invitation `usedAt` in the same write that creates the person | a single-use token row, spent transactionally |
| compares `now` to a stored `expiresAt` | the same, server-side, on a clock the client cannot set |
| checks the password is 8 characters and discards it | Supabase Auth, holding a real credential |
| mints an opaque random token in the browser | a signed token issued server-side and verified there |
| refuses an unknown token with a generic sentence | the same, and a rate limit, which does not exist |

## No email is sent, and nothing claims one was

There is no mail service in the path, so the link is surfaced instead of delivered: **"Copy
invite link"** on the provision result screen, and the full list in the fleet entry's **Dev
tools**. The result screen says *"Nothing has been emailed"* in those words, and a test
asserts it never says "email sent".

The subject and body exist, at **`shared/src/invite-email.ts`**, returning exactly
`MailerPort.send`'s argument shape so the send is one line when a provider is chosen. The
PRD names no mail provider; a **Resend** implementation is already in the tree at
`shared/src/mailer-resend.ts`. See FD-32 for what that leaves owed.

## What the operator cannot see

The fleet console reaches **zero rows** of any office's agents, requests, receipts, people,
departments, audit or connections — Prompt 1.5 rule 3, enforced at the seam by `fleetSide`
and asserted in `src/shared/api/mock/boundary.test.ts` against sentinel content.

The one thing an operator does see about a person is the Org Admin's email address on the
fleet row, and it is there because **the operator typed it** on the provision form. It is
read from the operator's own metadata, never from a live read of the office's people — a test
changes the person's address inside the office and asserts the fleet row does not follow.

## Accepting an invitation rebinds every open tab

Worth knowing before it surprises someone. The mock holds all offices in one document with a
single `boundOfficeId` (FD-31), and accepting an invitation sets it to the invitee's office.
That binding is shared by every tab on the origin, so:

- a second tab signed in as another office's Org Admin is now looking at the **new** office;
- sign-in resolves people only in the bound office, so the previous office's Org Admin gets
  the generic failure at `/login` until the binding moves back.

There is nothing to fix in production: each office is its own deployment, and "which office"
is settled by the URL you opened (FD-1). In development the way back is the **"Customer
entries read"** select in the operator console's Dev tools, which calls the dev-only
`bindOffice`. Without that control the second office provisioned would be a one-way door,
with clearing localStorage the only exit.
