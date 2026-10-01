# Stage 1, slice 1: one lead end to end

**Date:** 2026-10-01
**Spec for:** ORBIT_OS_PRD_v6_2.md §18 stage 1, §23 P1 tasks 6, 8 and 9 (part)
**Status:** design approved in conversation; awaiting written-spec review

## Why this slice exists

Stage 1 is capped at four weeks and the go/no-go needs at least ten labeled real
leads with zero breaches. What we learn first therefore matters more than what
finishes first. This slice threads a single real lead through every layer — inbox
to sent reply — so the riskiest integration, Gmail plus the Paperclip and Hermes
engine, is proven in week one while there is still time to react.

Auto-ack stays off. Nothing reaches a lead without the owner pressing Send, which
is what makes a thin slice safe to run against a real inbox.

## Decisions taken before the design

The founder settled four questions on 2026-10-01:

1. **Shape:** one lead end to end, not foundation-first and not replay-first.
2. **Inbox:** the founder's Google Workspace address, reached through an internal
   OAuth app in the founder's own Google Cloud project (CN-4). Open decision 3,
   the consumer-Gmail path, stays out of stage 1.
3. **Hosting:** the template compose stack on the founder's machine, with a named
   Cloudflare tunnel giving confirm links a stable HTTPS hostname. No VPS and no
   Coolify, so §22 N-13 stays deferred to the pilot stage.
4. **Draft inputs:** a hand-written `tone-samples.md` (five to ten past replies)
   and `facts.md` (services, pricing posture, availability, what is never promised
   in writing). Automatic selection from sent mail (N-8) comes with sub-project A.

## Stage 1 decomposition

Stage 1 is too large for one spec. Tasks 1 to 5 of §23 P1 are complete (stage 0
and 0b). What remains divides into six sub-projects, each getting its own spec,
plan and implementation cycle:

| Sub-project | Covers | P1 tasks |
|---|---|---|
| A. Inbound, classify, ack | Setup pass, ack variants, ack guard, caps, kill switch, data gate | 10, 11, 12 |
| B. Engine bridge, full | Orbi verdict route, corrective comments, verdict timeout | 8 |
| C. Approvals and sender, full | Remaining approval states, receipts surface | 6 |
| D. Web and API, full | Six screens, resolve page, six edge states, Settings blocks | 14, 15 |
| E. Worker | Job loop in its own program, reconciler, timers, notices, digest | 7, 13 |
| F. Replay harness | The labeled corpus and the gate before auto-ack | §18 exit criterion |

This slice takes the thinnest viable path through A, B, C and D. It completes
none of them.

## Scope

**In:** Gmail polling and in-thread send, FD-1 rule filters, the Haiku classifier,
the Paperclip issue and draft poll, approval creation, the signed confirm link,
magic-link sign-in with a 30-day session, the confirm page's send and edit paths,
and the decision record.

**Out, with the sub-project that owns it:** the acknowledgment with its caps and
kill switch (A); the Orbi route for unsure leads (B); the receipts list and
Settings screens (D); timers, reminders, the void job and the digest (E); the
replay corpus (F).

**Magic-link sign-in is in scope for a security reason, not a product one.** The
tunnel hostname is public. A POST endpoint that sends email in the owner's name,
reachable from the internet without a session, is a live exposure: anything that
discovers the URL could fire drafts at real leads. AUTH-9 and ENG2-D6 already
require an owner session for every confirm-page action, so sign-in belongs in the
first slice that has a send button.

## Components and boundaries

The existing foundation is consumed, not reinvented. `db/src/jobs.ts` already
claims jobs with a lease and `FOR UPDATE SKIP LOCKED`, and decides retry against
dead in one conditional UPDATE. `db/src/approvals.ts` does compare-and-set state
transitions backed by a database trigger. `shared/src/agent-output.ts` already
parses Scout's draft block as hostile input.

| Unit | Home | Does | Depends on |
|---|---|---|---|
| `gmail/client` | `frontdesk/` | Token refresh, `history.list`, thread fetch, in-thread send | Gmail API, `GmailConnection` |
| `gmail/filter` | `frontdesk/` | FD-1 rule drops: receipts, newsletters, 2FA, calendar, self-sent | nothing |
| `classify` | `frontdesk/` | One Haiku question, 15 s timeout, one retry, logs the call | Anthropic |
| `engine/bridge` | `frontdesk/` | Create the Paperclip issue, poll every 15 s, parse the draft | Paperclip, `shared/agent-output` |
| `approval/link` | `shared/` | Sign, verify, bind to one approval ID, expire | nothing |
| `confirm` route | `api/` | GET renders, POST sends; session required | `db/approvals`, `gmail/client` |
| `auth` routes | `api/` | Magic link issue and redeem, 30-day session | Resend, `SignInLink`, `Session` |

**Boundary:** `frontdesk/` never renders HTML, and `api/` touches Gmail only to
send. The send path is the single place that holds both an approval row and a
Gmail call, which is what makes FD-5's lock meaningful.

## Schema additions

The current schema covers leads, bodies, approvals, decisions, sessions, sign-in
links, contacts, jobs and timers. Two models are missing, and this slice adds
them in one migration:

- **`GmailConnection`** — workspace, email address, refresh token encrypted with
  `TOKEN_ENCRYPTION_KEY`, the `historyId` watermark, connection state for CN-8,
  and `lastCheckedAt` for the Home empty state.
- **`DecisionCall`** — the classifier call log that FD-2 calls `decision_calls`:
  model, prompt and completion tokens, cost, latency, outcome. The existing
  `Decision` model records the owner's decisions and is a different thing. This
  table also feeds N-7's spend line later.

## Data flow

**Inbound, every 30 s in `frontdesk/`:**

1. Refresh the access token from `GmailConnection`, call `history.list` from the
   stored `historyId`, and advance the watermark only after the batch persists.
2. Insert the `Lead` row. The `@@unique([workspaceId, messageId])` key makes a
   re-seen Message-ID a no-op, so FD-1's dedupe is enforced by the database. Per
   FD-1b only the first inbound message of a thread gets a row; a known
   `gmailThreadId` is skipped.
3. Apply the rule filter. Newsletters, receipts, 2FA codes, calendar notices and
   our own `X-Orbitcrew` mail land as `state = filtered` rather than vanishing, so
   the digest can count them in sub-project E.
4. Write `EmailBody`: `rawBody` as received, `cleanBody` with signature and quoted
   history stripped, truncated before any model call.
5. Classify: `state = classifying`, one Haiku question, 15 s timeout, one retry,
   the attempt logged to `DecisionCall`. The result writes `classification` and
   `confidence`.

**Engine, on `lead`:**

6. Create the Paperclip issue for Scout carrying `cleanBody`, `tone-samples.md`
   and `facts.md`. Store `paperclipIssueId`. Enqueue a `draft_poll` job keyed on
   the lead id.
7. The job polls the issue every 15 s and runs
   `parseAgentComment(comment, 'draft')`. On a valid block: create the `Approval`
   with the block's category and reason and `expiresAt` = received + 72 h, set
   `state = awaiting_owner`, and enqueue the `notice` job.
8. The notice is content-free (NTC-1) and carries the signed, single-use confirm
   link bound to that one approval ID (AUTH-9).

**Decision, in `api/`:**

9. GET verifies the link's signature and expiry, then requires a session. No
   session sends a magic link to the owner address first, then lands on the path
   the link pointed at (APP-3). Opening never acts.
10. POST inserts the `Decision` row first. Its unique `approvalId` is what makes
    AUTH-10's "first valid decision wins" true without bespoke locking. Then
    `transitionApproval(issued -> sending)`, the Gmail in-thread send carrying the
    `X-Orbitcrew-Id` header, then `sending -> sent` with `gmailMessageId`. A
    failure goes `sending -> failed` and the page shows the failed state.
11. An edit keeps both texts: `Approval.draftText` stands and `Decision.finalText`
    holds what went out.

**Two deliberate holes,** both honest states in the existing enum rather than
workarounds. An `unsure` or `failed` classification stops at `awaiting_verdict`
with no Orbi route (sub-project B). Nothing voids an expired approval on a timer;
the confirm page checks `expiresAt` at request time instead (sub-project E).

**Where the job loop lives.** This slice runs `claimDueJobs` inside `frontdesk/`
because `worker/` is sub-project E. The claim function is already shared and
lease-based, so moving the loop later is a deployment change, not a rewrite.

## Error handling

**Gmail.** A revoked or expired token sets `GmailConnection.state = revoked`,
stops the poller, raises the "Reconnect your inbox" banner, sends a content-free
owner notice and raises a founder alert (CN-8 as amended by CEO2-D8). Rate limits
and 5xx back off without advancing the watermark, so nothing is skipped. A
`historyId` too old for Gmail to serve triggers a bounded resync by date rather
than leaving a silent gap.

**Classifier.** 15 s timeout, one retry. Two failures write
`classification = failed`, send no ack, and alert the owner; the lead stops at
`awaiting_verdict`. Every attempt writes a `DecisionCall` row with its cost.

**Engine.** Paperclip unreachable fails the `draft_poll` job, and `failJob`
decides retry against dead from the row's own attempts. An invalid draft block
gets exactly one corrective comment; a second failure or the 10-minute timeout
sets `draft_failed` and alerts. Scout's output is data, never instruction:
`parseAgentComment` rejects multiple JSON blocks, oversized comments and control
characters, because Scout reads attacker-controlled email.

**The send path.** An ambiguous Gmail result, where the request left but no
response arrived, must never become a second send. The approval stays in
`sending`, and the next attempt first checks the Sent folder for the
`X-Orbitcrew-Id` tag; a hit transitions to `sent` instead of resending. This is
what E-T5 exists for.

A double press, a forwarded link or two devices all collide on the unique
`Decision.approvalId`, so the second sees "already decided". An expired approval
is caught at request time. A missing session redirects to sign-in, and a
`board_level` category also requires `Session.freshAt` within 24 h.

**One invariant with a test rather than a promise:** no text reaches Gmail
without a valid approval ID (FD-2b).

**One operational constraint.** A `trycloudflare.com` quick-tunnel hostname
changes on every restart, which would break confirm links already sitting in the
owner's mailbox. This slice requires a *named* tunnel with a stable hostname, and
the public base URL read from configuration rather than inferred from the request.

## Testing

Every network edge sits behind a narrow port with a fake: a fake Gmail serving a
canned `history.list` and recording sends, a fake classifier returning a fixed
verdict and confidence, a fake Paperclip posting a chosen comment. CI holds no
Gmail or Anthropic credentials and should not gain any, so the slice must be
fully testable without a live call.

Tests land in the two vitest projects that already exist:

- **`unit`** — pure logic: the FD-1 filter rules, confirm-link signing and expiry,
  the deterministic category raise (price, contract words, recipient count), body
  stripping and truncation, and `parseAgentComment` against hostile comments. This
  project runs in about two seconds today and must stay that fast.
- **`db`** — state machines against real Postgres: lead dedupe on a repeated
  Message-ID, `Decision` uniqueness under two simultaneous presses, approval
  transitions including the illegal ones the trigger must refuse, and job
  claim-lease-retry-dead.

Four tests exist because of specific failure modes rather than for coverage:

1. **No double send.** The fake Gmail accepts the request then throws before
   responding. The retry must find the `X-Orbitcrew-Id` tag in Sent, transition to
   `sent`, and leave exactly one recorded message.
2. **Fake-clock timeouts.** The 10-minute draft timeout and the 15 s classifier
   timeout, driven by injected time rather than real waiting (CEO2-D7).
3. **No approval, no send.** A static test asserting the Gmail send module is
   unreachable from any path lacking an approval ID (FD-2b).
4. **Golden thread.** One scripted lead walks poll, filter, classify, issue,
   draft, notice, sign-in, confirm and send against fakes and real Postgres,
   asserting the final `Lead.state`, `Approval.state`, the `Decision` row and the
   recorded outbound message.

Test-driven throughout: each unit's test precedes its implementation.

**Data rule.** Classifier fixtures in the repository are written, synthetic leads.
Real lead emails stay out of Git: DAT-3 and the customer data promise both make
committing customer text a breach. The labeled replay corpus belongs to
sub-project F, stored outside the repository.

## Exit criteria

1. The golden thread test is green in CI.
2. `pnpm posture:check` still passes.
3. The ambiguous-response test proves no double send.
4. One real lead from the founder's inbox has gone the whole way: the
   content-free notice arrives, the link opens on a phone, Send lands the reply in
   the original thread, and the `Decision` row names the founder.

## Open items carried into the plan

- **Body truncation limit.** §22 N-15 is unanswered: the v5.1 limit of 32K was
  Jev's context size, and Jev is deferred. The slice uses one named constant in
  one place so the answer is a one-line change. The plan must not bury a magic
  number in the classifier.
- **Tunnel hostname.** A named Cloudflare tunnel has to exist before the first
  notice is sent, or the links in that mailbox die on the next restart.
- **Setup inputs.** `tone-samples.md` and `facts.md` are written by the founder
  before the first draft, and the slice reads them from configuration rather than
  from a screen.
