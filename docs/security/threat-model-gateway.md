# Threat model: the Action Gateway

This covers the Action Gateway: the one place an action leaves this system. The
engine, the agents and the connectors have their own model in
`docs/security/threat-model-engine.md`.

The same five threats, read from the gateway's side. The engine's model asks how
an agent is tricked. This one asks what reached the outside world, and whether
the gateway was in the path when it did.

Each threat carries four parts: the attack, the control, the test that proves the
control, and what happens when the control fails. Every part names the
sub-project that completes it and the condition that closes it. No part says TBD.

`docs/rules/engine.md` requires this document before any gateway code, and it
requires the gateway's tests before the gateway's code.
`guards/rules.test.ts` checks that all five threats and all four part names are
still here.

## 1. Prompt injection from an inbound message

**The attack.** Injected text does not have to produce a tool call to do damage.
It only has to produce an action request ordinary enough to be approved: a
plausible recipient, a plausible subject, a reason that reads like the job. The
gateway is where that request becomes real.

**The control.** The gateway shows an approver what will actually happen, not
what the agent says will happen: the real recipient, the real content, the real
cost. The approval is bound to that exact payload, so a payload that changes
after approval is a new request.

**The test that proves the control.** A test that approves one payload, mutates
it, and asserts the send is refused. Owned by the gateway sub-project, and it
closes when the binding is a hash of the payload rather than an id beside it.

**When the control fails.** An approver agreed to something other than what was
sent. The audit row holds the approved payload and the sent payload, so the two
can be compared afterwards. Owned by the gateway sub-project, and it closes when
the audit row stores both rather than only the outcome.

## 2. An agent uses a tool it was not granted

**The attack.** The agent's grant was checked in the engine and the gateway
trusts that check. A request arriving by another route, or a request whose
claimed agent is read from the request itself, skips the grant entirely.

**The control.** The gateway re-checks authority on every action. It does not
trust the caller's claim about which agent is acting, and it does not treat an
engine-side check as sufficient. Two checks is the intent, not duplication to be
tidied away later.

**The test that proves the control.** A test that calls the gateway directly,
without the engine, claiming an agent that has no grant, and asserts a refusal.
Owned by the gateway sub-project, and it closes when the gateway's authority
check has a test that does not route through the engine at all.

**When the control fails.** An action runs under an authority nobody gave, and
the engine's log says it was authorized. Owned by the gateway sub-project, and
it closes when the audit row records which check passed and where, so the two
logs can be told apart.

## 3. A send that bypasses the Action Gateway

**The attack.** The threat this document exists for. A second send path: a
direct mail call, an HTTP request, a connector used without the gateway, a
script run by hand against production. Almost always added in a hurry by
somebody who needed one message out.

**The control.** Exactly one route out, enforced by a repository-wide scan
rather than by convention. One module can send. Every other module calls it. The
approval check, the audit write and the budget check live inside that module, so
a path around it skips all three at once.

**The test that proves the control.** The scan itself, written before the
gateway's code, asserting the set of modules that can send is exactly one. Owned
by the gateway sub-project, and it closes when the scan fails the build on a
second path rather than reporting it.

**When the control fails.** Something left the system unapproved, unlogged and
unpriced. There is no record to find it with, which is the whole problem: a
missing audit row is not an alert. Owned by the gateway sub-project, and it
closes when outbound volume is reconciled against audit rows, so a send with no
row shows up as a difference between two counts.

## 4. Secret leakage

**The attack.** The gateway holds the credentials that actually send. A failure
there tends to produce an error containing the request, and a request containing
an authorization header. The leak is in the error path, not the success path,
which is why it survives testing.

**The control.** The gateway logs the shape of a request and never its
credentials. Errors are rewritten before they are logged or returned: a vendor
error reaches the log without its headers and reaches a customer as a message
with no vendor detail at all. Credentials are read from the env file at the point
of use and are never stored on the request object.

**The test that proves the control.** A test that forces a vendor error carrying
a credential in its payload, captures everything the gateway logs and returns,
and asserts no key-shaped string appears in either. Owned by the gateway
sub-project, and it closes when that test runs against the real error path rather
than a stub of it.

**When the control fails.** Rotate first, record second, in that order. The
2026-10-08 entries in `docs/decisions.md` show what the record looks like. Owned
by sub-project 0, and it closes when every key the gateway holds has a named
rotation owner in `docs/security/keys.md`, which it now does.

## 5. One office reads another office's data

**The attack.** An approval for one office approves an action for another. The
gateway reads the office from the request, or takes an approval id without
checking which office it belongs to, and sends on behalf of the wrong customer.

**The control.** Every request names its office, and the gateway checks that the
approval, the agent, the budget and the connector all belong to that same
office. A mismatch is a refusal, not a warning.

**The test that proves the control.** A test that presents a valid approval from
one office against an action for another and asserts a refusal, and a second
test that asserts the refusal is logged. Owned by the gateway sub-project, and it
closes when each of those four checks has its own case rather than one test
covering the happy path.

**When the control fails.** One customer's message is sent from another
customer's account. The recipient sees it immediately and this system sees it
only through the audit row. Owned by the gateway sub-project, and it closes when
the audit row records all four office values rather than one, so a mismatch is
readable in the log.
