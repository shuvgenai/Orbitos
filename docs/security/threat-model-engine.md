# Threat model: the engine, the agents and the connectors

This covers the engine that runs an agent, the agents themselves, and the
connectors they reach accounts through. The Action Gateway has its own model in
`docs/security/threat-model-gateway.md`.

Five threats. Each one carries four parts: the attack, the control, the test
that proves the control, and what happens when the control fails. Every part
names the sub-project that completes it and the condition that closes it. No
part says TBD, because an owner and a condition are information and TBD is not.

`docs/rules/engine.md` requires this document to be written and reviewed before
any code in the area it covers. `guards/rules.test.ts` checks that all five
threats and all four part names are still here.

## 1. Prompt injection from an inbound message

**The attack.** An inbound email, file or form field carries text written to be
read as an instruction. The sender needs no account. They need the agent to read
their message, which is the agent's job.

**The control.** Inbound content is data and never instruction. The engine keeps
the two in separate channels: a message reaches the model as content with its
own boundary, never concatenated into the system prompt. A plan derived from
inbound text needs an approval before any action.

**The test that proves the control.** A fixture corpus of injection attempts,
run against the engine, asserting no tool call is produced and no approval is
auto-granted. Owned by the engine sub-project, and it closes when that corpus
runs in the unit suite rather than by hand.

**When the control fails.** The agent proposes an action nobody asked for. The
approval step is the backstop, so the failure is visible before it is expensive:
the proposed action reaches a person, who sees a request that does not match the
job. Owned by the engine sub-project, and it closes when the audit log records
the inbound message that produced the proposal, so a proposal can be traced back
to its source.

## 2. An agent uses a tool it was not granted

**The attack.** An agent reaches a tool outside its grant, either because the
grant is checked somewhere the agent can influence or because the tool list is
assembled from something the agent can write to.

**The control.** The grant is server-side and is read from the office's
configuration, never from the conversation. The engine resolves the tool list
before the model runs and refuses a call for anything not on it. Authority and
access stay separate: being able to see a tool is not being allowed to use it.

**The test that proves the control.** A test that hands the engine a model
response calling an ungranted tool and asserts the call is refused and logged,
not silently dropped. Owned by the engine sub-project, and it closes when the
refusal path has its own test rather than being covered incidentally.

**When the control fails.** An action runs under an authority nobody gave. The
audit log names the agent, the tool and the grant it was checked against, which
is what makes the gap findable. Owned by the engine sub-project, and it closes
when the log records the grant it used and not only the call it made.

## 3. A send that bypasses the Action Gateway

**The attack.** Code sends directly, through a mail client, an HTTP call or a
connector, without passing the gateway. Usually not malice. Usually a second
code path added in a hurry, which is why this threat appears in both models.

**The control.** Exactly one route out. One module can send and every other
module calls it. The gateway holds the approval check, the audit write and the
budget check, so a path around it skips all three.

**The test that proves the control.** A repository-wide scan that proves there is
one send surface and no second path, written before the gateway's code. Owned by
the gateway sub-project, and it closes when the scan runs on every commit rather
than on request.

**When the control fails.** Something is sent with no approval, no audit row and
no cost recorded, and nobody knows until a customer asks. Owned by the gateway
sub-project, and it closes when the scan fails the build, because a report
nobody reads is not a control.

## 4. Secret leakage

**The attack.** A key reaches somewhere that is not the env file: a log line, an
error message, a prompt, a committed file, or a reply to a customer. The usual
route is diagnostic output written while something was being debugged.

**The control.** Keys live in this project's own env file and nowhere else.
Nothing logs a secret and nothing stores one outside that file. The inventory in
`docs/security/keys.md` lists names only. The secret scan in
`.github/workflows/ci.yml` reads the full history, not the working tree.

**The test that proves the control.** `guards/standing-rules.test.ts` for the env
rules, the inventory check in `guards/rules.test.ts` for the file that describes
them, and the gitleaks job for the history. Owned by sub-project 0; those three
exist now, and it closes when the engine's own log output is covered by a test
asserting no key-shaped string reaches it.

**When the control fails.** The key is rotated first and the cause is recorded
second. The 2026-10-08 entries in `docs/decisions.md` are the worked example:
probe output pasted verbatim into a document put a key-shaped string into
history, the scan caught it, and the commit was rewritten. Owned by sub-project
0, and it closes when rotation for every key has a named owner in
`docs/security/keys.md`, which it now does.

## 5. One office reads another office's data

**The attack.** A query returns rows belonging to a different office, through a
missing filter, a shared cache, or an id guessed in a request the screen would
never have sent.

**The control.** The office boundary is enforced in the query, not applied to
the result. Every row carries its office and every read states it. A cache key
includes the office. An id arriving from outside is checked against the caller's
office before it is used.

**The test that proves the control.** A test that asks for another office's
record by id, with valid credentials for the first office, and asserts a refusal
rather than an empty result. An empty result and a refusal are different, and
only one of them is the control working. Owned by the engine sub-project, and it
closes when every read path has that test and not only the paths added with it.

**When the control fails.** One customer sees another customer's work. This is
the most expensive failure in this document and the hardest to see from inside,
because every component reports success. Owned by the engine sub-project, and it
closes when the audit log records the office each read was scoped to, so a
cross-office read shows up in the log rather than only in a complaint.
