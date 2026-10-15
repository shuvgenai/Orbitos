# ORBIT-OS: rules for Claude Code

Rules that are true everywhere in this repository. A rule that belongs to one
area only does not belong in this file. Section 3 says where those live.

`guards/rules.test.ts` and `guards/standing-rules.test.ts` check this file and
the documents it points at. A rule with no guard is a rule that lapses quietly,
so each one below names its guard where it has one.

## 1. What this repo is

Orbitcrew is an AI office. A customer describes work in plain words, and a team
of AI teammates does it under named authority, with every action approved,
logged and priced. The product is the office, not a chat window.

ORBIT-OS is the internal name and appears in paths, packages and this
repository. Orbitcrew is the name a customer sees. Never show a customer the
internal one.

The source of truth is `docs/prd/ORBIT_OS_PRD_v9_0.md`. `v8_0` and `v7_0` sit
beside it for history and are superseded. Where this file and the PRD disagree,
the PRD wins and the disagreement goes in `docs/decisions.md`.

## 2. Ask first

Any decision that affects security, money, customer data or the product
definition goes to the founder before it is made, not after it is built.

Quality and security come before speed. A task delivered on time with a gap in
it is not delivered.

If a request is ambiguous and the readings lead to different work, ask. If they
lead to the same work, pick one and say which.

## 3. Scoped rules live elsewhere

| Area | File |
| --- | --- |
| The web app in `dashboards/` | `dashboards/CLAUDE.md` |
| The engine, the Action Gateway, the connectors and the worker | `docs/rules/engine.md` |

The rule that confines `dashboards/` to the browser belongs in
`dashboards/CLAUDE.md` and must never be copied into this file. Written here it
reads as repository-wide, and it would stop the engine stream on its first
command. The symptom is a refusal that looks unrelated to its cause, which is
why `guards/rules.test.ts` checks this file for those phrases in one direction
and the dashboards file in the other.

## 4. The freeze

Seven directories are frozen: `frontdesk/`, `api/`, `db/`, `shared/`,
`template/`, `ops/`, `design/`.

In a frozen directory: no new features, no deletions, no refactors. Every test
that runs today keeps running and keeps passing. A lint finding inside one is
reported, never fixed, because a fix in frozen code is a change to frozen code.

`guards/freeze.test.ts` enforces the test list. `pnpm lint:frozen` reports the
findings and `pnpm lint:frozen:danger` fails on the one rule that is not allowed
to stay a report.

Reading a frozen directory is always fine. Guards do it.

## 5. Naming

A customer never sees Paperclip, Hermes, OpenClaw or MCP. Say agents,
teammates, tools and office.

Runtime ids and adapter names appear in the Super Admin Office view and nowhere
else in the product.

`guards/design-naming.test.ts` checks the screens for internal names.

## 6. Secrets

This project's own `.env.local`, never committed. `.env.example` is committed
and carries names with no values.

**Never read from or write to a shared or cross-project env file.** A key read
from outside this repository cannot be rotated by anybody reading this
repository.

Keys are scoped to this project and are rotatable. Never log a secret and never
store one outside the env file.

The inventory is `docs/security/keys.md`, which lists names and never values.

Enforced by `guards/standing-rules.test.ts`, which also records the two
references that climb a directory and the reason each one stays inside this
repository.

## 6a. No real data until the gate opens

No live inbox, no real mailbox and no real customer data in **any** environment
until four conditions are all in place and tested:

1. the Action Gateway,
2. the audit log,
3. budget pausing,
4. Anthropic no-training and zero-retention terms confirmed in writing.

Until then, a dedicated test mailbox and test accounts only.

**The founder decides when that condition is met, not the code.** The status is
recorded in the 2026-10-06 entry of `docs/decisions.md`, and it currently reads
open-pending.

**What checks this, exactly.** `guards/standing-rules.test.ts` checks the record
and the committed configuration, not the running system. It asserts that the
2026-10-06 entry still names all four conditions and still reads open-pending,
so the gate cannot be closed by a code change alone; that
`docs/gates/anthropic-terms.md` is absent, or, if present, names who confirmed
the terms, when, and where the signed document lives; that no tracked
configuration names an email address outside an explicit list of reserved test
domains; and that no mail variable in a tracked `.env.example` or workflow file
holds anything but an empty value or one of those placeholders.

**What nothing checks.** Live values live in `.env.local` and in
`template/.env`, which are never committed, so no guard in this repository can
see them. Pointing `MAIL_FROM` and the Gmail credentials at a real mailbox would
leave every assertion above green. The gate is a rule the founder and this
repository's authors keep, and the guard protects the record of that rule from
being edited away. It is not a control that blocks real data, and this section
does not claim one. Finding H2 of the 2026-10-08 security review is the reason
this paragraph exists.

## 7. Done

A change is done when these pass:

```
pnpm install --frozen-lockfile
pnpm audit --audit-level=high
pnpm typecheck
pnpm lint
pnpm lint:frozen:danger
pnpm check:screens
pnpm test
pnpm e2e
```

`pnpm test` needs the database up: `pnpm db:up`, then `pnpm db:generate`. CI
runs the same list, plus the secret scan and the compose smoke check, in
`.github/workflows/ci.yml`.

Every code diff also gets a security review in a fresh session that reads only
the diff, and the result is recorded in `docs/decisions.md`. Docs-only commits
are exempt from that review and not from the rest.

## 8. Branches and review

Code goes on a branch, opens as a pull request and is merged by the founder
after the Done checks pass. Branch names are `stream-a/<sub-project>` and
`stream-b/<sub-project>`.

The two streams never share a working tree. A half-finished engine change in the
same tree as a dashboard build makes both diffs unreviewable, which is exactly
when a review stops catching anything.

Docs-only commits may go straight to `main`.

## 9. Decisions

Every decision is appended to `docs/decisions.md` with its reason and its cost
if wrong. Heading format `## <ISO date> - <decision>`, then the body.

An entry opens its explanation with `**Reason`, `**Why`, `**Result` or
`**Superseded`. A superseded entry names the date of the entry that replaces it.
`guards/decisions-log.test.ts` checks that shape and nothing else, because no
guard can tell a reason from a sentence that looks like one.

Record the decision, not a summary of the conversation. The next reader needs
the cost of being wrong more than the list of alternatives considered.

## 10. Plain language

Short sentences. No jargon. No em dashes and no exclamation marks.

An empty state says what will appear there and the one action or condition that
fills it.

Say what a thing does, not that it is powerful, seamless or robust.

## 11. When to use multiple agents and gstack-review

Founder decision, 2026-10-10, recorded in `docs/decisions.md`. Follow this
section without asking, except where it says to ask.

### 11a. Multiple writing agents

One thread, no writing subagents, for:

- guard hardening,
- the contract seam, which is `contract/v1`, the experimental surface, routing,
  `ApiClient` and the mock API client,
- the task engine core,
- the Action Gateway, authority enforcement and the audit log,
- any task where two agents would edit the same file.

Fan out to writing agents only when all six of these hold:

1. `contract/v1` is merged, and its interface is frozen for the batch.
2. The mock API client and the demo office exist.
3. The six-state component and the `design/` tokens are in place.
4. S-43, the screen-inventory guard, the mock-boundary guard and axe are armed.
5. The founder approved a plan with one task and acceptance criteria per screen
   or unit.
6. No two agents touch the same file. The main thread alone edits
   `dashboards/src/shared/nav/screens.ts`, `shared/layout` and `shared/states`.

Permission to fan out:

- Stage 1b and 1c screen batches: granted once. Before each batch, post one line
  naming the screens and confirming all six conditions. Five writing agents at
  most.
- Stream B channel adapters: ask the founder before fanning out.
- Read-only agents, which are audits, investigations and reviews: allowed at any
  time, because they write nothing.

Each batch is its own diff, with its own fresh-session security review under
section 7, and its own pull request for the founder to merge.

Stop rule. If a batch produces a file conflict, a request to change the
interface, or a review finding that traces back to the contract, stop fanning
out. Fix it in a single thread, tell the founder, and resume only after the fix
merges.

### 11b. gstack-review

`/gstack-review` is the phase-gate review. It never replaces the per-diff
security review in section 7. Both run. Run it at exactly these points:

1. Guard-hardening branch complete, before it merges.
2. Contract seam complete, before any screen is built on it. Highest priority.
   Focus: the contract matches PRD v9.0 Appendix A and sections 15.5 to 15.7,
   nothing the 28 Fill-now screens need is missing, and the Standing Authority
   surface is read-only.
3. End of stage 1b, on the 15 screens together. Focus: consistency across
   screens, contract usage, the six states in section 15.4, naming against
   section 15.3.
4. End of stage 1c, before Stream A merges to `main`.
5. End of the Stream B channel adapters.
6. Before Checkpoint A and before Checkpoint B.
7. Every diff that touches the Action Gateway, authority enforcement or the
   audit log, in addition to section 7. These are the paths that act in
   someone's name.
8. Before Checkpoint C, on staging, before any pilot.

How to run it, every time:

- Only on a clean tree, with no implementer or fix round running.
- Scope it to the commits since the previous gate, never the whole history.
- Exclude the seven frozen directories and `reference/`.
- Report only. Fix nothing. Rank each finding Critical, Important or Minor, with
  file and line evidence or a concrete input that proves it.
- Bring the findings to the founder. Critical and Important go into a fix round
  with the five-round circuit breaker. Minor findings go to `TODOS.md` with a
  one-line ruling.
- A phase is not done, and does not merge, while a Critical is open.

### 11c. Reporting

At each gate, add a line to the gate status block at the top of
`docs/decisions.md`: the gate that passed, the `/gstack-review` result, and the
number of findings fixed and parked.
