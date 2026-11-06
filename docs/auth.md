# Auth and the three sign-in portals

**Built:** 2026-11-05 · **Prompt:** 1.5, items 4 to 7 only (FD-26) · **Backend:** none yet

Prompt 1.5 asks for this document. It covers what exists. The RLS half — every policy and
the rule it enforces — belongs with items 1 to 3, which are **not built**; FD-26 records
that as owed, and the section at the end lists what the database must enforce so the
difference between "the client checks this" and "this is enforced" stays visible.

---

## The three paths, and the matrix

| Public path | Entry file | Admits | Refuses | `<title>` |
|---|---|---|---|---|
| `/login` | `dashboards/user/index.html` | `user`, `admin` | everyone else | OrbitCrew |
| `/org/login` | `dashboards/org-admin/index.html` | `admin` | `user`, and everyone else | OrbitCrew |
| `/admin/login` | `dashboards/fleet/index.html` | `super` | `user`, `admin` | ORBIT-OS |

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
