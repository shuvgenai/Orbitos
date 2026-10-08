# Engine and gateway rules

This file governs `contract/src/experimental/`, the engine, the Action Gateway,
the connectors and the worker.

The rule in `dashboards/CLAUDE.md` that confines that package to the browser
does not apply here, and it must never be used to block work in these areas. It
is a rule about one package, not a statement about this repository. Root rules
are in `CLAUDE.md` and apply here as well as everywhere else.

`guards/rules.test.ts` checks that this file still carries the threat-model
requirement below.

## A threat model comes before any code

A threat model is written and reviewed **before any code** in the area it
covers. Not alongside, and not after the first spike.

| Area | Threat model |
| --- | --- |
| The engine, the agents and the connectors | `docs/security/threat-model-engine.md` |
| The Action Gateway | `docs/security/threat-model-gateway.md` |

Each threat in those documents carries four parts: the attack, the control, the
test that proves the control, and what happens when the control fails. A threat
with an attack and no control is a worry. A threat with a control and no test is
a claim.

The models exist now as skeletons, with every threat named and every part owned.
The sub-project that builds an area fills in that area's parts before writing
its code, and a part that is owned rather than done says who owns it and which
condition completes it.

## The Action Gateway

Its tests are written **before** its code. That includes the repository-wide
scan that proves there is exactly one route out: one place in the codebase that
can send, and no second path around it.

Authorization is enforced on the server on every action. A client-side check is
a convenience for the person using the screen and is never the control. Assume
every request can arrive without the screen.

Every action is audit-logged: what was done, why, by whom, approved by whom,
when, and at what cost. An action that cannot be logged does not run.

## Budgets

A budget that runs out pauses the agent that spent it. Nothing else stops. A
budget that halts the office is an outage, and an outage caused by a spending
limit gets removed by the next person who hits it at a bad moment.

The pause is visible in the product, and it says which budget stopped and who
can raise it.

## Data boundaries

One office can never read another office's data. That is enforced in the query,
not by a filter applied after the rows come back.

A connector reaches only the accounts the office granted it, and the grant is
recorded where the audit log can cite it.

## Standing Authority

Enforcement is blocked pending the founder's decision. Do not design it and do
not build it. The screens are feature-flagged off and are user interface only,
and the contract surface stays read-only.

## Real data

The first real job runs against a dedicated test mailbox and test accounts.

No live inbox and no real customer data until the Action Gateway, the audit log,
budget pausing and the Anthropic no-training and zero-retention terms are all in
place and tested, and the founder has said so. Section 6a of `CLAUDE.md` holds
the same rule, the 2026-10-06 entry of `docs/decisions.md` holds its status, and
`guards/standing-rules.test.ts` fails closed on it.
