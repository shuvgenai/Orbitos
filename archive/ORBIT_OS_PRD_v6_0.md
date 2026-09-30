# PRODUCT REQUIREMENTS DOCUMENT
Orbitcrew (internal name: ORBIT-OS): Owner-First Lead Replies for Small Businesses
Dedicated Instance per Customer, Run by OrbitumAI
Product Version: 1.0 MVP (launch)
Document Version: 6.0 (supersedes v5.1). This document is the single source of truth for the build.
Date: September 30, 2026
Prepared by: OrbitumAI | Product Owner: Shuv Chowdhury

**Sources consolidated (no new review was run):**
- PRD v5.1 (Sept 28, 2026)
- CEO plan review, 2026-09-30 (`ORBIT_OS_CEO_Review_2026-09-30.md`): MODE, R1–R7, C1–C9, tasks T1–T11
- Eng review v1, 2026-09-30 (`ORBIT_OS_Eng_Review_2026-09-30.md`): E1–E6, tasks E-T1–E-T8
- Owner-first design doc, office hours, 2026-09-30, status APPROVED (`~/.gstack/projects/OrbitOS/subha-unknown-design-20260930-114022.md`)
- Eng review v2, 2026-09-30 (`ORBIT_OS_Eng_Review_v2_2026-09-30.md`): D1–D11, tasks E2-T1–E2-T10, test plan `subha-unknown-eng-review-test-plan-20260930-121941.md`
- Design review, 2026-09-30 (`ORBIT_OS_Design_Review_2026-09-30.md`): 1A–14A, tasks DR-T1–DR-T6, wireframe v2 `~/.gstack/projects/OrbitOS/designs/approval-confirm-20260930/wireframe.html`

**Precedence rules used:** a review decision overrides v5.1. Where reviews conflict, the later one wins. The order is CEO, then Eng v1, then the design doc, then Eng v2, then the resumed Design review. Every applied decision is listed in Appendix B. Anything the sources leave ambiguous or contradictory is listed in §22 "Needs owner answer" and was not decided here.

## Table of Contents
1. Executive Summary
2. What Changed from v5.1
3. Goals, Non-Goals and Success Metrics
4. Users, Roles and Authorities
5. Deployment Model: One Instance per Customer
6. System Architecture Overview
7. Technology Stack
8. Feature Requirements — Customer App (launch screens)
8A. Feature Requirements — Front Desk (inbox to sent reply)
9. Fleet Operations (scripts and registry file)
10. Requirements — Provisioning, Upgrade, Backup, Decommission
11. Requirements — Connections
12. Requirements — Approvals and Human Authority (single source)
13. Requirements — Cost and Pricing
14. Requirements — Learning and Evaluation
14A. Requirements — Data Architecture and Retention
15. UX, Design System and Accessibility
16. Security and Compliance
17. Non-Functional Requirements
18. Rollout Plan
19. Open Decisions
20. Appendix A — Operator Settings Panel (moved to Phase 2)
21. Phase 2 / Not in Scope
22. Needs Owner Answer
23. Build Tasks
Appendix B — Decision Log

## 1. Executive Summary
Orbitcrew answers a small firm's inbound leads fast, without taking the reply out of the owner's hands. When a lead emails, it gets an instant, fixed-template acknowledgment. A researched, on-brand full reply then waits on the owner's phone. One tap sends it in the original thread, and every message has a receipt with what was sent, why, who approved it, when and at what cost.

The first buyer is an owner-operator of a 10–50 person professional-services firm. This person answers leads "when free", sets up the office, approves every reply and pays. At launch, one person holds every role.

Each customer runs on a dedicated instance: one ORBIT program and one Postgres server on its own small server under the customer's domain. OrbitumAI sets up and operates each instance (managed setup). There is no shared platform, no public self-signup and no cross-customer data path.

Customer-facing name: **Orbitcrew**. ORBIT-OS is the internal name only.

Launch target: customer zero (OrbitumAI's founder inbox) in October 2026, capped at 4 weeks. Then the named firm on its own server, then five to ten managed pilots in November–December 2026.

## 2. What Changed from v5.1
- **Launch shape:** the Approach C prototype becomes the Front Desk: one ORBIT program plus Postgres per customer. Paperclip, Hermes, Redis, the worker program and the separate web, API and Front Desk programs are removed from launch.
- **Owner-first:** one person holds every role. Backups, escalation chains, delegation, member management and the multi-person personas move to Phase 2.
- **Speed:** a template auto-acknowledgment is sent under a standing approval. The full reply still needs the owner's tap.
- **Approval channel:** Telegram is removed. Content-free email notices via Resend link to a confirm page. Actions need a signed-in owner session (magic link).
- **Decision model:** Haiku only, behind `DecisionProvider`. Jev moves to Phase 2.
- **Screens:** five launch screens plus a resolve page, with a written design system (black and white plus one danger red) and numbered accessibility rules.
- **Hosting:** one small VPS per instance only. Node 24. Git and CI before the build.
- **Data promise:** AI model providers are named as a third data path, under no-training and zero-retention terms.
- **Metrics:** time to sent reply and an hours-given-back estimate are added. The customer-zero success criteria and a 4-week cap are added.
- **Deferred:** fleet console UI, rules loop, eval gate, golden sets, training pipeline, org-chart editor, second starter team, skills queue, fleet cost analytics and support view.
- **Housekeeping:** the footer version, the §2 heading and the stale palette decision are fixed. Approval rules now live only in §12.

## 3. Goals, Non-Goals and Success Metrics
Goals
- An inbound lead receives a template acknowledgment within 2 minutes, for at least 95% of labeled real leads.
- The lead receives a researched, on-brand draft reply that reaches the owner as a notice within 15 minutes, 90% of the time.
- No full reply is ever sent without a per-message approval record from the owner. The only message sent without one is the template acknowledgment, which is sent under the standing template approval (§12).
- Time from lead arrival to sent reply is measured and shown.
- An idle instance makes zero model calls. Cost per lead is measured and shown.
- Draft quality is measured: the share of drafts sent without edits.
- Provisioning, upgrade, backup and restore are scripted. Nothing is fixed by hand on one instance.

Non-Goals (launch)
- Public self-signup, a shared multi-tenant platform, workspace switching
- Drag-and-drop workflow canvas, template marketplace, public API, SDK, white-label
- WhatsApp, Slack delivery, Discord, voice, iMessage, browser automation (Phase 3 as Front Desk adapters)
- Client-hosted instances (Enterprise tier, later, with a contract)
- Billing self-service (Phase 2)
- Everything listed in §21

Counting "real leads": during customer zero, the founder labels every inbound email weekly (lead / not lead). Lead metrics use that labeled set, so leads the classifier missed still count.

Success metrics
| Stage | Metric | Target |
|---|---|---|
| Customer zero | Labeled real leads acknowledged within 2 minutes | ≥ 95% |
| Customer zero | Median time from lead arrival to owner tap | Under 30 minutes |
| Customer zero | Drafts sent (not discarded) | ≥ 80% |
| Customer zero | Drafts sent without edits | ≥ 50% |
| Customer zero | Full replies sent without a tap | 0 |
| Customer zero | Acks sent to non-leads, known contacts or auto-senders | 0 |
| Named firm, 4 weeks | Runs on its own server at an agreed price | Yes |
| Named firm, 4 weeks | Drafts sent | ≥ 80% |
| Named firm, 4 weeks | Owner says they would be upset to lose it | Yes |
| Pilots | Provisioning time | Under 15 min, no manual steps |
| Pilots | Owners completing a live run within 24 h | 50% |
| Pilots | Sends without an approval record | 0 |
| Pilots | Edit rate trend | Falling over 4 weeks |
| Pilots | NPS | Above 40 |
| Pilots | Time to sent reply; hours given back | Measured nightly (DAT-4) |
| Fleet | Upgrade-day rollbacks | 0 unplanned |

Customer-zero sample size and cap
- Each live criterion needs at least **10 labeled real leads**. If fewer arrive in 2 weeks, customer zero is extended, up to a **cap of 4 weeks**.
- At the cap, go to the named firm if all of these hold: zero breaches, the replay set passes (§14), and at least 5 live leads met the targets. The firm's first 2 weeks count as extended evidence, once the no-retention terms are signed (§16).
- The replay set measures the classifier's false-positive rate and the unedited-draft rate. The founder reviews replayed drafts as if approving. Tap time, ack time and the drafts-sent rate come from live leads only.

If customer zero misses
- Median tap time over 30 minutes: the full reply needs a faster path (push notification, or a shorter confirm flow) before pilots.
- Under 50% unedited: drafting (tone samples, facts file) is fixed before the named firm goes live.
- Ack rate under 95% within 2 minutes: polling and latency are fixed before pilots.
- Drafts sent under 80%: review why drafts were discarded, and fix drafting or the classifier before pilots.
- Any zero-tolerance breach (an ack to a non-lead, known contact or auto-sender, or a full reply sent without a tap) switches off auto-ack, or sending, immediately. It stays off until the cause is fixed and the replay set passes again (FD-9).

## 4. Users, Roles and Authorities
At launch, **one person, the owner, holds every role and authority**: Org Admin access, Leader, Approver and Budget holder. The owner sets up the office with OrbitumAI, approves every reply and is the buyer.

Role definitions kept for the data model (AUTH-1 records the authority used on every decision):
- Org Admin: sets up and runs the office.
- Leader: approves board-level drafts.
- Approver: approves routine and decline drafts.
- Budget holder: approves budget increases.
- Super Admin (OrbitumAI, operator only): provisions, upgrades, restores and pauses instances through scripts. Never holds authority inside a customer instance.

Personas at launch
- The owner-operator: sells, delivers and answers leads; replies "when free".
- Shuv: Super Admin for the fleet; owner of customer zero.

Separate Users, backup approvers, delegation and the Maria / David / Jordan personas are Phase 2 (§21).

## 5. Deployment Model: One Instance per Customer
- DEP-1 Every customer runs a complete, separate instance: **one ORBIT program and one Postgres server** on its own small VPS. No process, database, key or host is shared between customers.
- DEP-2 Each instance serves one workspace on one domain (`assistant.<customer-domain>`) via a customer-added CNAME. TLS is automatic.
- DEP-3 Instances are rendered from one versioned template in Git. The only per-instance differences are environment values and secrets.
- DEP-4 OrbitumAI operates every instance. Customers never access hosts or containers.
- DEP-6 The schema keeps `workspace_id` with a single workspace per instance. No row-level security or tenant filtering is implemented.
- DEP-7 Client-hosted instances use the same template and are offered only as an Enterprise tier with a contract (not at launch).
- DEP-5 (engine UIs over the tailnet) moves to Phase 2 with Paperclip and Hermes.

## 6. System Architecture Overview
Per instance (one ORBIT program, Node 24)
```
  Gmail --history poll 30s--> [ORBIT program] ------------------------> Resend (content-free system email)
                               | dedupe Message-ID, rule filters,          notices / reminders / digest /
                               | known-contact index (headers only)        alerts / magic links
                               | Haiku classify (<=15s, 1 retry) -> ack guard -> auto-ack (Gmail API, in thread)
                               | Claude draft -> approval row (issued)
                               | confirm page (signed link + owner session)
                               | sender: sending -> Sent check by X-Orbitcrew-Id -> sent / failed
                               v
                            Postgres: events, approvals, jobs, timers, sessions, contacts index
```
- Inbox polling, classification, auto-acknowledgment, drafting, the confirm page, sign-in, sending, notices and the digest all run in the one program. Jobs and timers are Postgres rows, not Redis.
- **Decision Layer** (ORBIT code, `src/decisions`): the provider-agnostic `DecisionProvider` interface is kept. At launch it has one provider, Claude Haiku 4.5, answering the lead question. Decision output is a signal only. It never authorizes a send.
- **Model calls** come only from ORBIT server code: the lead classifier and the drafter. The approval ID (or, for acks only, the standing template approval) is the sole authority to send.
- **Sending:** the ack and the full reply always go through the Gmail API from the owner's address, in the lead's thread. Resend is used only for Orbitcrew's own system email, never for lead-facing mail.
- **Send key:** the Gmail send capability is restricted to the sender module. A static test enforces this.

Fleet (OrbitumAI)
- Provisioning, upgrade, backup and restore scripts plus a registry file (§9). The fleet console UI is Phase 2.
- An external uptime check and alert emails to the founder (§9).
- A staging instance on the next pinned versions.

Paperclip and Hermes are added only when drafts need multi-step research or a second teammate (Phase 2).

## 7. Technology Stack
| Layer | Choice |
|---|---|
| Runtime | Node 24 LTS |
| Web app | React 18, TypeScript, Vite, Tailwind, shadcn/ui, Inter, React Router, TanStack Query (`@xyflow/react` dropped) |
| Server | Express, TypeScript, Prisma, Zod, helmet, rate limiting; magic-link sessions (§16) |
| Jobs and timers | Postgres rows, polled every minute (no Redis, no Bull) |
| Data | PostgreSQL 16 with pgvector; one Postgres server per instance |
| Inbox and send | Gmail API: `history.list` from the last `historyId` every 30 s; send in thread |
| System email | Resend, from a verified Orbitcrew sending domain (SPF/DKIM) |
| Decision model | Claude Haiku 4.5 behind `DecisionProvider` (Jev in Phase 2) |
| Models | Claude Sonnet 5 (drafting), Claude Haiku 4.5 (lead classification), Claude Opus 5 (offline evaluation only). OpenRouter fallback: see §22 N-1 |
| Hosting | Coolify on Hostinger; one small VPS per instance (see §22 N-13) |
| Fleet tooling | Provisioning script, registry file, upgrade runbook, nightly backups to off-host storage, Tailscale, external uptime check, alert emails |
| Tests and CI | Vitest + Testing Library; GitHub Actions on every push; automated a11y check (axe) in CI |
| Observability | pino logs, health endpoints, decision ledger |

## 8. Feature Requirements — Customer App (launch screens)
8.1 Access
- APP-1 The first account is created only by accepting OrbitumAI's invitation (7-day, single use). Public signup returns 404.
- SIGN-1 Sign-in is a one-time magic link sent via Resend. It expires in 15 minutes, is single use and is sent to the owner's address only.
- SIGN-2 A session lasts 30 days. Board-level actions need a fresh link if the session is older than 24 hours.
- SIGN-3 Send, Edit and Discard on the confirm page, and every choice on the resolve page, require the owner's signed-in session. Opening a link on a new device emails a sign-in link first, then shows the draft.
- APP-3 After sign-in, the owner lands on the page the link pointed to, otherwise Home.

8.2 Screens (six in total; no navigation bar)
- SCR-1 **Top bar:** the firm name in bold, with a muted "by Orbitcrew" under it. The top bar links Home and Settings.
- SCR-2 **Home**, in this order:
  1. Waiting for you, oldest first, with a countdown (see §22 N-12).
  2. Today in one line, including time to sent reply.
  3. Recent receipts.
  - Day-1 empty state: "Watching inbox@…, last checked …".
- SCR-3 **Confirm page** (per wireframe v2):
  - It shows the lead, the draft, the category tag and a one-line reason.
  - Opening the page never acts. Actions run only on a button press (POST).
  - Phones: a sticky bottom bar holds Edit and Send (48 px), respecting the safe area. Discard is a text link. Desktop: the buttons sit under the draft.
  - Edit in place: the draft becomes a full-width text box, and the bar becomes "Cancel edits" / "Send edited reply". The receipt stores both texts.
  - After Discard, optional reason chips: "Not a real lead" / "I'll reply myself" / "Draft was wrong" / Skip. The reason is stored (see §22 N-14).
  - Cost line in muted text above the bar, for example "Drafted by Scout · $0.04". The full cost is on the receipt.
  - Six designed edge states, each with a single action: expired, already decided, updated draft ("This thread changed"), sending/failed, office paused, not yours.
- SCR-4 **Sign-in page** (SIGN-1).
- SCR-5 **Receipt detail** (RCPT-1).
- SCR-6 **Settings:** ack template (versioned; any change needs owner re-approval), facts file, pause auto-ack.
- SCR-7 **Resolve page** for "Acknowledged, no reply yet" items: Reply now / Replied elsewhere / No reply needed (FD-10).

8.3 States
- STATE-1 Home, Receipt, Settings, Sign-in and the resolve page each have designed loading, empty, error and partial states.

8.4 Receipts
- RCPT-1 One receipt per sent message (acks and full replies). Each receipt holds: recipient; draft and final text side by side; reason; category; approver and authority used; the arrival, draft, tap and send timestamps; cost. CSV export (see §22 N-10).
- RCPT-2 An ack receipt names the template version it used and the standing approval.
- WAIT-3 Every decision is recorded with the authority used. The first valid decision wins. The send path refuses text without a valid approval ID.

8.5 Notices (system email via Resend)
- NTC-1 Every Orbitcrew system email is content-free: no lead name, company, address or draft text. Details are shown only after sign-in.
- NTC-2 Notices come from "Orbitcrew for <Firm>". They cover: a reply waiting, a reminder after 2 hours, a failed send, the ack cap reached, a classifier failure, a kill-switch trip, and the daily digest.

## 8A. Feature Requirements — Front Desk (inbox to sent reply)
Inbox
- FD-1 **Inbox adapter:**
  - Poll Gmail every 30 seconds with `history.list` from the last `historyId`.
  - Dedupe by Message-ID: a seen Message-ID does nothing.
  - Strip signatures and quoted history.
  - Before any model call, drop receipts, newsletters, calendar notifications, 2FA codes, password resets, banking notices and configured senders by rule.
  - Exclude system-sent mail: every system email carries a hidden `X-Orbitcrew` header and the `Orbitcrew` Gmail label, and both are excluded from polling.
- FD-1a **Known-contact index:** built at setup from message headers only (From/To addresses), refreshed on each poll. A known contact has emailed the owner or been emailed by the owner.
- FD-1b **Thread scope:** the launch handles only the first inbound message of a lead thread. Later messages in that thread are left to the owner in Gmail. They are never classified, drafted or acked.

Classification
- FD-2 **Lead classifier (Decision Layer):**
  - Exactly one Haiku question per candidate email (`lead | not_lead | unsure`), with a confidence value.
  - 15 s timeout and one retry. If the call fails twice: no ack, the email is marked "unsure", and the owner gets an alert.
  - Every call is logged to `decision_calls` and the ledger.
  - A per-instance daily spend cap applies (see §22 N-7).
- FD-2a **Hostile input:** email bodies are treated as adversarial. The classifier never replaces the deterministic rules and checks (FD-1 filters before; category checks after). Bodies are stripped and truncated before any model call (see §22 N-15).
- FD-2b **Decision gates:** a model may raise an approval category, never lower it, and never bypass an approval. Static tests assert that no decision output reaches the sender.

Classifier output and action
| Case | Ack | Draft + confirm link | Digest |
|---|---|---|---|
| "lead", confidence ≥ 0.8, unknown sender, first message in a new thread | yes | yes | — |
| "lead", confidence < 0.8 | no | yes | "lead, not acked (low confidence)" |
| "lead" from a known contact, or not the first message in its thread | no | yes | "lead, not acked (known contact / existing thread)" |
| "unsure", or the classifier failed | no | no | "unsure" |
| "not a lead" | no | no | "not a lead" |

Acknowledgment (auto-ack)
- ACK-1 **When an ack may go out.** All of these must hold: the email is classified "lead" with confidence ≥ 0.8, the sender is not a known contact, and the message is the first in a new thread.
- ACK-2 **Never ack** when any of these apply: an `Auto-Submitted`, `Precedence: bulk/list` or `List-*` header; a `no-reply`/`noreply` sender; mail sent by the system itself.
- ACK-3 **Rate limits:** at most one ack per sender per 30 days, and at most 10 acks per hour.
  - Reaching the hourly cap pauses auto-ack and emails the owner.
  - Auto-ack resumes automatically when the rolling hour has fewer than 10 acks.
  - Leads that arrive during the pause get no late ack. They still get a draft and a confirm link, and the digest lists them as "not acked (cap)".
- ACK-4 **Template:** fixed text with exactly two merge fields, `{lead_first_name}` and `{owner_calendar_link}`. No other variable content, and no model output ever goes into the ack. Two owner-approved, versioned variants:
  - With a name: "Thanks, {lead_first_name}. We received your message. If it's easier, you can book a time here: {owner_calendar_link}."
  - Without a name: "Thanks for your message. We received it, and if it's easier, you can book a time here: {owner_calendar_link}."
- ACK-5 **Name rule:** `{lead_first_name}` is the first word of the From display name. It is used only if it is letters only, 2–20 characters, and not a generic word ("accounts", "info", "admin", "sales", "team", "office"). Otherwise the variant without a name is used.
- ACK-6 **Content rules:** no advice, no pricing, no commitments (including no promise of a reply), no claim of a client relationship.
- ACK-7 **Versioning:** the template is a versioned record. Any wording change needs owner re-approval. For the named firm, the owner's written sign-off on the wording is a go-live requirement.
- ACK-8 **Switch-on gate:** auto-ack stays off until the replay-set calibration passes (§14, LRN-7).

Drafting
- FD-3 **Drafter:** Claude drafts the full reply from the lead email, the firm website, 20 sent emails the owner selects at setup (client-matter emails excluded; no bulk mailbox import) and a "facts we can state" file. The draft becomes an approval row in state `issued`. For handling a malformed or failed draft, see §22 N-2.

Approval and sending (rules in §12)
- FD-4 **Approval courier:**
  - Compute the category (§12 AUTH-3).
  - Create the approval row and send the owner a content-free notice with a signed link to the confirm page.
  - Send a reminder after 2 hours if untouched.
  - Void the draft after 72 hours.
  - Record the decision with the authority used.
  - Timers are Postgres rows checked every minute, so they survive a restart or restore.
- FD-4a **Stale thread:** before any send, the thread is re-checked. If the owner replied directly or the lead wrote again, the confirm page shows "This thread changed" with the new message. The owner must confirm again or re-draft.
- FD-5 **Sender:**
  - Send exactly the approved text, or the ack template, as a reply in the lead's original thread: `threadId` plus `In-Reply-To`/`References` headers, from the owner's Gmail address.
  - Approval ID states: `issued → sending → sent / failed / void`, with a database lock. Invalid transitions are `sent → sending` and `void → sending`.
  - Every system-sent email carries `X-Orbitcrew-Id: <approval ID>`, or `<ack receipt ID + template version>` for acks.
  - A failed send retries at most twice. Before each retry, and on any unclear result such as a timeout after accept, the Sent folder is searched for that specific ID, and a match counts as `sent`.
  - After two retries the state becomes `failed`, and the owner gets a notice with a "Resend" button (re-send the reply; not the Resend email service).
  - On success, write the receipt event.
- FD-6 No code path runs from message content to exec, file or browser operations. An automated test asserts that no text reaches the sender without a per-message approval ID, except the ack template under the standing template approval.
- FD-7 Channels are adapters: adding Slack or WhatsApp later means a new inbound adapter and a new courier target, not a new runtime.

Safety, digest and data gate
- FD-9 **Kill switch:**
  - After each ack, the rules are re-checked automatically. A hit on a known contact or auto-sender switches auto-ack off instantly and alerts the owner.
  - The digest lists every ack with a "Wrong, not a lead" button, which switches auto-ack off immediately.
  - A full reply sent without a tap switches sending off.
  - Re-enabling is manual, after the replay set passes.
- FD-10 **Daily digest:** lists "not a lead" and "unsure" emails, leads that were not acked and why, every ack (with the FD-9 button), and void unacked drafts as "unanswered". An acked lead whose draft is discarded or void is labeled **"Acknowledged, no reply yet"**. It repeats in every daily digest until the owner picks Reply now / Replied elsewhere / No reply needed on the signed-in resolve page. The subject line flags it after 3 days.
- FD-11 **Firm data gate:** until the no-retention terms are signed (§16 SEC-11), the named firm's forwarded emails are stored but never sent to any AI provider. Testing and calibration use the founder's inbox until then.

Latency budget (p95; sums to 90 s, under the 2-minute ack target)
- Up to 30 s waiting for the poll
- 10 s fetch plus known-contact lookup
- 15 s classifier timeout, plus one 15 s retry
- 20 s to send the ack

## 9. Fleet Operations (scripts and registry file)
Until about 10 instances, the fleet runs on scripts and a registry file. The console UI is Phase 2.
- FLT-1 **Registry file:** customer, domain, host, plan, pinned versions, last backup, health, connections, incidents, waiting approvals older than 24 h, month-to-date spend. Counts and status only; never customer content.
- FLT-2 **Scripts:** provision (10.1), upgrade (10.2), restore (10.3), decommission (10.4), pause instance, pause all.
- FLT-7 **Posture report** per instance after every provision and upgrade: no public database or admin ports, the Front Desk static checks pass (send key restricted, no approval bypass), and versions match the template.
- FLT-10 **Operator access:** OrbitumAI only, over Tailscale. Every operator action is audited on the affected instance.
- FLT-11 **Alerts:** an external uptime check emails the founder when a host is down. The instance emails the founder on a missed nightly backup or a failed send.
- FLT-12 **Ops capacity trigger:** at 25 instances, add ops help or revisit the hosting model.

## 10. Requirements — Provisioning, Upgrade, Backup, Decommission
10.1 Provisioning
- PRV-1 Inputs: customer name, domain, plan. Output: a running instance on its own VPS, registered in the registry file, posture check passed, owner invitation sent. Target: under 15 minutes, zero manual steps.
- PRV-2 Steps: render the template with generated secrets and pinned versions → create the instance's VPS (see §22 N-13) → start the stack on private networks → health checks → seed the schema (single workspace) → wait for the CNAME and issue TLS → posture check → register → invite.
- PRV-3 Any step failure stops the job, shows the step and allows a retry. A partial instance can be torn down in one action.
- PRV-4 Managed setup includes a Gmail internal OAuth app in the customer's own Google Workspace (CN-4).

10.2 Upgrade
- UPG-1 Version changes are pull requests to the template. The staging instance runs them and must pass the golden thread (lead in → ack → draft → notice → sign-in → Send → reply in thread → receipt).
- UPG-2 Upgrades run instance by instance: maintenance notice to the owner → backup → apply → posture check → golden thread → done, or roll back within 10 minutes. The result is recorded in the registry file and the instance audit log.
- UPG-3 One upgrade day per month. New instances per month are capped to what one upgrade day can absorb.

10.3 Backup and restore
- BKP-1 Nightly per instance: the ORBIT Postgres database, including the event-log partitions, jobs and timers. Stored off-host with 30-day retention. A missed backup alerts the founder (FLT-11).
- BKP-2 Restore to the same or a new host. The restore check compares the last event and the last receipt. Recovery target: 4 hours. Overdue timers fire on the first tick after restore.
- BKP-3 Monthly restore drill on one instance, recorded.

10.4 Decommission
- DEC-1 Requires the customer's written request and the owner's in-app confirmation. The export is delivered first.
- DEC-2 The instance is stopped, DNS and OAuth apps are revoked, and data is deleted after 30 days. The registry keeps only the fact and date of deletion.

## 11. Requirements — Connections
- CN-1 Connections belong to the business, not to the person who connected them.
- CN-2 Launch connectors: Gmail (trigger and send) and Resend (system email only). HubSpot is Phase 2.
- CN-3 ORBIT is the OAuth client. Tokens are encrypted with a per-instance key and never reach prompts or logs.
- CN-4 Where the customer is on Google Workspace, an internal OAuth app is created in the customer's Google Cloud project during managed setup, avoiding Google verification. A customer not on Workspace waits for an IMAP path or a verified app (open decision 3).
- CN-7 Not supported: iMessage. WhatsApp needs an ORBIT-built Front Desk adapter plus Meta approval, and is Phase 3.
- CN-8 Reconnecting a revoked or expired Gmail token pauses the Front Desk and shows "Reconnect your inbox" (see §22 N-9).

## 12. Requirements — Approvals and Human Authority (single source)
This section is the only statement of the approval rules. Other sections reference it.

Approval types
- AUTH-0 There are two approval types:
  - **Per-message approval ID**, issued by ORBIT for every full reply.
  - **Standing template approval**, given by the owner once at setup for the acknowledgment template only, and renewed on every wording change. No other text may be sent under it.

Categories and rules
- AUTH-1 Roles and authorities are stored separately. Authority is checked at the moment of decision, and every decision records the authority used.
- AUTH-2 Categories:
  - Routine.
  - Decline or refer.
  - Board-level: price, fee, discount, contract terms, payment, more than one recipient, any commitment.
- AUTH-3 The category is the most sensitive of the drafter's flags and the deterministic checks (amounts, pricing and contract words, recipient count). A model may raise a category, never lower it.
- AUTH-4 At launch, every category goes to the owner. The lead is never sent a full reply by default:
  - A reminder is sent after 2 hours.
  - The draft is voided after 72 hours.
  - The item then appears in the digest (FD-10).
- AUTH-9 The confirm link is signed, single use and bound to one approval ID, and it expires with the draft. Opening it never acts; actions are POST only. Every action needs the owner's session, and board-level actions need a session fresh within 24 hours (SIGN-2).
- AUTH-10 The first valid decision wins. A second attempt sees "already decided".

Backups, escalation chains, delegation, authority-change requests and office-change approvals are Phase 2 (§21).

## 13. Requirements — Cost and Pricing
- COST-2 There are no scheduled model calls. An idle instance makes zero model calls.
- COST-3 Drafter research is capped at 3 searches.
- COST-4 Stable prompt prefixes and one model per session keep prompt caching effective.
- COST-5 The decision ledger records every model call with tier, tokens, cached tokens, cost, latency and verdict. Receipts and cost figures read from it.
- COST-6 **Pricing:** the launch office is priced as one unit. Before pilot 1 is quoted, the unit-economics sheet must show a positive margin per tier, using the measured server and model cost. The price and the managed setup fee remain open (decision 1). The v5.1 "per AI teammate" tiers are withdrawn.

## 14. Requirements — Learning and Evaluation
- LRN-1 Edits and discards are recorded with diffs and reasons (discard reason chips, SCR-3).
- LRN-7 **Replay set:**
  - Count the real past leads in the founder's inbox, then top up to about 50 with labeled, written test leads, plus about 50 non-leads. Replace test leads as real ones arrive.
  - False-positive checks use the full set. The unedited rate uses real leads only.
- LRN-8 **Threshold tuning:**
  - On any false positive, raise the ack threshold by 0.05, up to 0.95, and rerun the full replay set each time.
  - If the threshold is already at 0.95, add a deny rule.
  - Never lower the threshold without a full rerun.
  - Zero false positives in about 50 non-leads is a minimum bar, backed by the live kill switch (FD-9).
- LRN-9 Before any prompt change during pilots, re-run a fixed sample of customer-zero leads.

## 14A. Requirements — Data Architecture and Retention
- DAT-1 Every meaningful action inside an instance appends a row to an append-only `events` table (for example: email received, ack sent, draft delivered, decision recorded, message sent, auto-ack switched off, upgrade applied). Receipts, audit views, rollups and exports are projections of events, never separate sources of truth.
- DAT-2 `events`, `llm_calls` and `decision_calls` are partitioned by month.
- DAT-3 Retention is configuration in `retention_policies`, enforced by a nightly job:
  - Raw email bodies: 90 days.
  - Redacted ledger and events: 24 months.
  - Receipts: for the life of the customer.
  - Backups: 30 days.
  - Expired data is removed by partition drop or purge. No retention is hard-coded elsewhere.
- DAT-4 **Nightly rollup:** each instance computes the day's numbers: emails, leads, acks, drafts, sent, edited, discarded, time to sent reply, hours given back (estimate; see §22 N-4), cost, cached-input share, idle model calls, versions, backup and health status. The rollup holds numbers only, never customer text (destination: see §22 N-3).
- DAT-6 **Data paths:** data leaves an instance only through:
  1. the DAT-4 rollup (numbers only);
  2. calls to AI model providers, under no-training / zero-retention terms (SEC-11).

  Customer exports (DATA-1) are delivered to the customer, not retained by OrbitumAI. The consented training export (DAT-5) is Phase 2.
- DAT-7 Volumes and sizing: thousands of ledger rows per instance per month; one Postgres per instance is sufficient. A data lake or warehouse is out of scope until analytics span several hundred instances, a dedicated data role queries raw data, or an enterprise customer needs event export.
- DAT-8 Backups include the event-log partitions. Restore verification compares the last event and the last receipt.
- DAT-9 `decision_calls` records each Decision Layer call: caller, provider (`haiku` at launch), question type, redacted state, question, answer with confidence, latency, cost, and later `human_verdict` (agreed or overridden, from the founder's weekly labels).
- DATA-1 Export receipts as a ZIP of CSV files. Deletion requires the owner's confirmation and completes within 30 days (10.4). Where export runs: see §22 N-10.

## 15. UX, Design System and Accessibility
- UX-1 **DESIGN.md** is the single design system, written from the landing tokens:
  - Colors: ink `#000`, paper `#fff`, canvas `#f4f4f5`, muted `#52525b`, line `#e4e4e7`, plus dark variants.
  - Type: Inter, body ≥ 16 px.
  - Shapes: 10 px button radius, 1 px dividers, no shadows.
  - One `--color-danger` (AA red), used only for errors and failed sends.
  - The app and notice emails use only DESIGN.md tokens.
- UX-2 **Theme** follows the phone (`prefers-color-scheme`). There is no manual switch.
- UX-3 **Layout:** plain lists, no card grids. No bottom navigation; the top bar links Home and Settings (SCR-1).
- UX-4 **Banners:** "Office paused", "Auto-ack is off", "Reconnect your inbox", "Maintenance scheduled".
- UX-5 Empty states give direction. Errors appear inline.
- UX-6 Customer-facing copy uses the name Orbitcrew. It never mentions ORBIT-OS, Paperclip, Hermes, adapters, heartbeats or tokens.
- UX-7 **Accessibility:**
  - Targets ≥ 44 px (Send 48 px), with Send and Discard at least 16 px apart.
  - Contrast ≥ 4.5:1, body ≥ 16 px, 3 px focus ring.
  - Every button has a text label.
  - Status changes are announced (`aria-live`).
  - Works at 200% zoom and respects reduced motion.
  - Keyboard navigation works throughout.
- UX-8 Landing page claims are limited to lead response; no sales, finance, logistics or HR claims.

## 16. Security and Compliance
- SEC-1 No database or admin port is reachable from the public internet. Operator access is over Tailscale only.
- SEC-2 Only the sender module can send through Gmail. A static test enforces this.
- SEC-3 Approval is enforced outside the model. The send path validates a per-message approval ID issued by ORBIT, or the standing template approval for the ack only (§12).
- SEC-4 Inbound filters drop 2FA codes, password resets and banking notices before any model call.
- SEC-5 Secrets are stored as encrypted connection tokens and per-instance keys. They never appear in prompts, logs or client code. A rotation runbook exists.
- SEC-6 A posture check runs after every provision and upgrade. Drift blocks the instance from being marked healthy.
- SEC-7 **Audit:** every operator action, decision, auto-ack switch change and template approval is logged on the affected instance. The owner can read it.
- SEC-8 Data export and deletion work per instance as in §10.4.
- SEC-10 Model provider keys are encrypted per-instance secrets. Calls go only from the server. Classifier output is a signal and is always paired with deterministic checks.
- SEC-11 **Data promise:**
  - The customer-facing promise names AI model providers as a data path, processed under no-training / zero-retention terms (wording: see §22 N-5).
  - Anthropic's no-training / zero-retention terms must be confirmed in writing before the named firm goes live.
  - Until then, only the founder's own inbox (customer zero) is processed by AI (FD-11).
- SEC-12 **Magic links and sessions:** SIGN-1 to SIGN-3. Resend emails are content-free (NTC-1).

## 17. Non-Functional Requirements
| Attribute | Requirement |
|---|---|
| Ack speed | Ack within 2 minutes for ≥ 95% of labeled real leads; p95 pipeline budget 90 s (§8A) |
| Draft speed | Draft notice within 15 minutes of email arrival, 90% of the time |
| Polling | Gmail history poll every 30 s |
| Cost at rest | Zero model calls on an idle instance |
| Provisioning | Under 15 minutes, no manual steps |
| Availability | Per instance; host failure affects one customer; 4-hour recovery target; uptime alert to the founder |
| Footprint | Measured on customer zero before pilots; host sizing decided then (v5.1's 2–4 GB estimate assumed Paperclip and Hermes) |
| Upgrades | Monthly; staging first; automatic rollback within 10 minutes on golden-thread failure |
| Backups | Nightly, 30-day retention, monthly restore drill, missed-backup alert |
| Isolation | No shared process, database, key or host between customers; one VPS per instance |
| Data egress | Nightly numeric rollups, plus model-provider calls under no-training / zero-retention terms |
| Retention | Enforced nightly from configuration; expired partitions dropped |
| Accessibility | UX-7; axe shows 0 serious issues in CI |

## 18. Rollout Plan
| Stage | Deliverable | Exit criterion |
|---|---|---|
| 0. Foundations | Git repo, private GitHub repo and CI; Node 24; verified Resend sending domain; DESIGN.md; Postgres schema (events, approvals, jobs, timers, sessions, contacts index) with the approvals schema frozen first | CI red on a failing test; `.env.local` ignored; test email passes SPF/DKIM |
| 1. Customer zero (founder inbox, October 2026) | Poller, classifier, ack guard, kill switch; confirm page, magic-link sign-in, sessions; sender, idempotency, notices, digest; replay harness | Replay set passes before auto-ack is on; success criteria in §3 on ≥ 10 labeled real leads, **capped at 4 weeks** |
| Go / no-go (at the latest, the 4-week cap) | Review against §3 | Zero breaches, replay set passes, ≥ 5 live leads met targets |
| Assignment (before building past customer zero) | Call the firm that asked: signed one-page pilot agreement with a monthly price; 20 forwarded lead emails (stored, not sent to AI until terms are signed); confirm Google Workspace and that its admin can create an internal OAuth app | Firm named, pilot committed, price agreed |
| 2. Named firm (own VPS) | Same code, own Postgres, own domain; internal OAuth app in the firm's Workspace; written ack-wording sign-off; Anthropic terms signed | Pilot live on its own domain; 4-week targets in §3 |
| 3. Pilots (5–10, November–December 2026) | Provisioning script and registry file; nightly rollup and retention jobs; alerts; upgrade rehearsal across staging and two instances; restore drill; footprint measurement; unit-economics check before quoting | Second instance provisioned in under 15 minutes; zero unplanned rollbacks; host sizing decided; positive margin per tier |

Build lanes after Stage 0: lane B (poller, classifier, ack guard, kill switch, then the replay harness), lane C (confirm page, sign-in, sessions) and lane D (sender, idempotency, notices, digest) run in parallel. They merge before the golden-thread E2E.

## 19. Open Decisions
1. Price and the managed setup fee (the office is priced as one unit; §13 COST-6).
2. ~~Landing page palette~~ **Closed:** black and white, plus one danger red (UX-1).
3. Google OAuth path for customers not on Google Workspace, and the cost of verifying a shared app.
4. ~~Fleet console app or mode~~ Moved to Phase 2 with the console.
5. ~~Escalation timings~~ Moved to Phase 2 with escalation.
6. ~~Interim Leader rule~~ Moved to Phase 2 (a single owner holds every role at launch).
7. The 30-day idle window before an unused instance is decommissioned.
8. Retention periods (90 days raw email, 24 months redacted ledger), to confirm against customer expectations and the privacy policy.
9. ~~Jev provider~~ Moved to Phase 2 with Jev. Before Jev returns, rename the `TYPESAFE_API_KEY` variable in `.env.local`: it holds an OpenRouter key, which is the credential mixing the provider rule warns against.
10. ~~Approval channel~~ **Closed:** content-free email notice → signed confirm page → magic-link session (§8, §12). Telegram is removed.
11. Agent runtime: **changed.** Paperclip and Hermes are added only when drafts need multi-step research or a second teammate. The launch is one ORBIT program.

## 20. Appendix A — Operator Settings Panel (moved to Phase 2)
The v5.1 Appendix A panel lives inside the fleet console's instance detail and tests Paperclip, Hermes and Telegram connections. With the console deferred and the engines out of launch, the whole appendix moves to Phase 2 (§21). The v3.0 `system-settings-dashboard.tsx` stays the planned basis for it.

## 21. Phase 2 / Not in Scope
Deferred with approval (returns in Phase 2 or after customer zero):
- **Paperclip + Hermes** (the Coordinator, Specialists as agents, Paperclip tasks, the Hermes gateway, the `hermes_gateway` adapter, per-teammate budgets, watchdogs, the weekly routine). They are added when drafts need multi-step research or a second teammate. The second database on the Postgres server (orbit and paperclip, separate logins) returns with them. Removed from launch: v5.1 DEP-5, FD-3 task bridge, HIR-1, HIR-2, COST-1, AUTH-8, LRN-4, SEC-5 Paperclip secret references, and the BKP-1 Paperclip database and Hermes volumes.
- **Multi-person offices:** separate Users, backup approvers, escalation chains (AUTH-4 routing 2 h / 2 h / 24 h), delegation (AUTH-7), authority-change requests (AUTH-5), the pending-Leader rule (AUTH-6), member management (MEM-1), "Ask the leader", the Maria / David / Jordan personas, David's first screen, and the "David hasn't joined yet" banner.
- **Jev** as the decision model (TypeSafe or AI/ML API), `score()` / `noul()` use, model routing to stronger tiers.
- **Fleet console UI** (FLT-1 as an app, FLT-3 overrides, FLT-4 starter-team templates, open decision 4) and Appendix A.
- **Learning machinery:** rule proposals (LRN-2, LRN-3, RULE-1), the eval gate and golden sets (LRN-5, FLT-9).
- **Training corpus:** consent flow, redaction and export (LRN-6, DAT-5, the DAT-6 training path, SEC-8 model-improvement consent). `decision_calls` logging is kept.
- **Onboarding and org chart in the app:** ONB-1 to ONB-7, the drag-and-drop org-chart editor, and the fixed-team editor. Setup is managed by OrbitumAI at launch.
- **Second starter team.**
- **Skills review queue** (FLT-5), **fleet cost analytics** (FLT-6), **support view** (FLT-8) and the "Viewing as support" banner. Hermes self-made skills stay OFF on customer instances.
- **Screens:** Team (TEAM-1, as a plain row list when it returns; `@xyflow/react` dropped), Tasks (TASK-1, NOTE-1), Reviews (REV-1 screen) and Rules; the old HOME-1 counts and teammate strip; bottom navigation; the old Waiting-for-you routing views (WAIT-1 multi-approver parts).
- **Connectors:** HubSpot, hosted MCPs behind the ORBIT policy gateway (CN-5, CN-6), Slack, Calendar, Drive, Stripe and Notion.
- **Password accounts and TOTP** (APP-2, SEC-9). Sign-in is a magic link at launch.
- **Office-changes approval category** (rules, cost-raising hires, budget increases).
- **Gmail push via Pub/Sub** (polling at launch).
- **Push notifications:** only if the customer-zero tap-time target is missed (§3).

Not in scope (declined):
- The four-program arrangement per instance, and Redis.
- Resend for any lead-facing mail (Gmail API only).
- Google sign-in and passkeys (magic link chosen).
- A manual theme switch; a full-screen editor on phones.
- Telegram, anywhere.
- A shared Coolify project across customers.

## 22. Needs Owner Answer
The sources leave these open or contradict each other. They were not decided in this document.

| # | Question | Conflict / gap |
|---|---|---|
| N-1 | Is there an OpenRouter fallback for Claude at launch? | v5.1 §7 and the CEO error registry say to back off, then use OpenRouter, else "unsure". The design doc says two failed calls mean "unsure" plus an owner alert, and does not mention OpenRouter. |
| N-2 | What happens when the drafter returns a malformed or failed draft? | v5.1 FD-3 said "one retry, then blocked for the Coordinator". There is no Coordinator at launch, and no source restates the rule. |
| N-3 | Where do the nightly rollup numbers go? | v5.1 DAT-4 pushed them to a fleet metrics database behind the console. The console is deferred (R2), and the registry file (FLT-1) holds only status. |
| N-4 | How is "hours given back" estimated? | C4 approved adding the estimate, but no formula is given. |
| N-5 | What is the exact customer-facing data-promise wording, and does it name Resend? | C1 approved rewording the promise to name AI providers, but gave no wording. Resend receives content-free system email (owner address, counts). |
| N-6 | Is there a "Pause office" control at launch, beside "Pause auto-ack"? | The design review adds an "office paused" confirm-page state (2A) and v5.1 PAUSE-1 exists, but the launch Settings screen (6A) lists only "pause auto-ack". |
| N-7 | Are budgets and the daily spend cap in launch, and where does the owner see them? | v5.1 BUD-1 and COST-1 were Paperclip budgets (deferred). FD-2 keeps a per-instance daily spend cap. No launch screen shows budgets. |
| N-8 | Where does the owner give the setup inputs: the 20 tone emails, the calendar link, the firm website and the standing ack approval? | The design doc says "selected at setup". The launch screens (6A) have no setup flow, and Settings holds only the template, facts file and pause. |
| N-9 | Who performs "Reconnect your inbox", and on which screen? | The CEO registry keeps the CONN-1 banner, but no launch screen offers a reconnect flow. |
| N-10 | Where do the receipt CSV export (RCPT-1) and the data export (DATA-1, needed by DEC-1) run? | Neither is on a launch screen. |
| N-11 | Is the Friday weekly review email kept at launch? | C4 / T6 put the new metrics in the weekly review. 6A moves the Reviews screen to Phase 2, and the weekly routine depended on Paperclip. |
| N-12 | What does the countdown on Home count down to? | 1A says "escalation countdown", but escalation is Phase 2. Candidates are the 2 h reminder and the 72 h void. |
| N-13 | Does Coolify still run on each per-customer VPS? | C3 removed the shared "Coolify project" option. PRV-2 said "create Coolify project", and the §7 hosting row still says "Coolify on Hostinger". |
| N-14 | Does a discarded draft get a receipt? | RCPT-1 says "one receipt per sent message". Design 12A says discard reasons are "stored on the receipt". |
| N-15 | What is the body truncation limit before model calls? | The v5.1 limit (32K) was Jev's context size. Jev is deferred. |
| N-16 | How is the owner account created: by invitation acceptance (APP-1, PRV-1) or by an owner address configured at provisioning? | Magic-link sign-in is "owner address only" (D7). The invitation flow was designed for multi-member onboarding. |
| N-17 | Do OrbitumAI operators need 2FA at launch? | v5.1 SEC-9 and FLT-10 required TOTP for operators through the console. With no console, operator access is scripts over Tailscale. |

## 23. Build Tasks
Merged from CEO (T1–T11), Eng v1 (E-T1–E-T8), Eng v2 (E2-T1–E2-T10) and Design (DR-T1–DR-T6). Where tasks overlap, the later review's wording wins and the merged IDs are shown. The tasks are listed in priority order; within a priority, build dependencies come first. Tasks whose PRD part this v6.0 completes are listed at the end.

**P1**
1. **E-T1 / E2 (repo)** — Set up git init, a private GitHub repo and GitHub Actions running Vitest on every push; keep `.env.local` out of Git.
   - Verify: a failing test turns CI red; `git check-ignore .env.local` confirms it is ignored.
2. **E2-T3 (setup)** — Verified Resend sending domain (SPF/DKIM) before customer zero.
   - Verify: a test email passes SPF/DKIM.
3. **DR-T1 (design)** — Write DESIGN.md from the landing tokens plus `--color-danger` (7A).
   - Verify: the app and notice emails use only DESIGN.md tokens.
4. **E-T5 (sender)** — Approval ID states `issued / sending / sent / failed / void` with a DB lock, the `X-Orbitcrew-Id` tag, and a Sent-folder check on unclear results.
   - Verify: a forced-timeout test sends exactly one email; a concurrent-send test sends once.
5. **E-T3 + E2-T1 (auth + approvals)** — Confirm-page approval links (POST action, signed, single use, expiring) plus magic-link sign-in via Resend with a 30-day session. Board-level actions need 24 h freshness, and all confirm-page actions require a session (D6, D7).
   - Verify: an E2E test shows that a GET on the link sends nothing and a POST sends exactly once; a forwarded link cannot act; the sign-in link expires at 15 min and is single use.
6. **E2-T4 (ack)** — Two versioned ack variants plus the name sanitizer (D5).
   - Verify: unit tests for each name case select the correct variant.
7. **E2-T5 (safety)** — Post-ack rule re-check, instant kill switch, and the digest "Wrong, not a lead" button (D9).
   - Verify: a forced known-contact ack switches auto-ack off and alerts.
8. **E2-T6 (data)** — The firm's forwarded emails are stored but blocked from the AI until the terms flag is set (D2).
   - Verify: a test proves no AI call is made for firm data while the flag is off.
9. **E2-T2 (notify)** — Content-free Resend notices, reminders, digest and alerts (D8).
   - Verify: a unit test asserts the payload has no lead name, company, address or draft text.
10. **DR-T2 (web)** — Build the launch screens per wireframe v2 with the sticky bar and edit in place (6A, 8A, 11A, 13A, 14A).
    - Verify: an E2E test on a 390 px viewport shows Send without scrolling.
11. **DR-T3 (web)** — The 6 confirm-page edge-state screens (2A).
    - Verify: each state is reachable in a test and has a single action.
12. **T2 (legal + landing, C1)** — Get Anthropic's zero-retention / no-training terms confirmed in writing; reword the promise in the Vision doc and landing copy (wording: N-5).
    - Verify: the promise names AI providers; DAT-6 lists the model-provider path; the terms are confirmed in writing.
13. **T1 / T3 (Vision doc)** — Remove Telegram from Vision §5, §7 and §11 #15; apply the R1–R7 deferrals to the Vision roadmap; update the two stale Vision diagrams (§5 first ten minutes, §7 architecture). Record the decision #14 change (Paperclip + Hermes "added when needed") in the Vision §11 table for founder sign-off.
    - Verify: no "Telegram" left except in the change log; the diagrams match §6 of this PRD.

**P2**
14. **E-T4 (timers)** — Store timers (2 h reminder, 72 h void, digest, cap window) as Postgres rows polled every minute.
    - Verify: a fake-clock test, plus a restart test in which an overdue timer fires after restart.
15. **E2-T7 (eval)** — Replay harness: real plus written test leads, labeled; threshold step rule (D3, D4).
    - Verify: the harness reports the false-positive rate and the unedited rate per run.
16. **E2-T8 (digest)** — "Acknowledged, no reply yet" resolve page and daily repeat (D10).
    - Verify: an unresolved item appears in 3 consecutive digests; the subject is flagged on day 3.
17. **E-T7 (tests)** — Implement the test plan (Eng v2 plan `…-121941.md`, plus the Eng v1 rows still in scope: dedupe, stale thread, send timeout, timer after restart, hostile email yields a board-level draft and nothing is sent, forced backup-failure alert).
    - Verify: every row in the test plan has a passing test in CI.
18. **DR-T4 (a11y)** — Apply the 9A rules plus an automated a11y check in CI.
    - Verify: axe has 0 serious issues; the target-size check passes.
19. **DR-T5 (web)** — Discard reason chips stored on the receipt (12A; see N-14).
    - Verify: the receipt shows the chosen reason.
20. **DR-T6 (web)** — Loading / empty / error table for Home, Receipt, Settings, Sign-in and the resolve page (3A extended).
    - Verify: each screen has a designed empty and error state.
21. **T9 (ops, C7)** — Uptime check plus backup-failure and send-failure alert emails.
    - Verify: a forced failure on staging produces an email to the founder.
22. **T7 (pricing, C5)** — Build the unit-economics sheet from customer-zero costs; price the office as one unit.
    - Verify: the margin per tier is positive with the measured server and model cost before pilot 1 is quoted.
23. **T8 (landing, C8)** — Orbitcrew as the customer-facing name, ORBIT-OS internal; narrow landing claims to lead response (`orbitcrew-landing-page-content.md`, `landing/src`, Vision doc).
    - Verify: no "logistics / HR / finance" claims; the docs state the customer-facing name.
24. **E-T6 (template)** — One Postgres server per instance. The second database (paperclip) and its separate login return in Phase 2.
    - Verify: the posture check confirms one Postgres process per instance.

**P3**
25. **T10 (Vision doc, C6)** — Add the 25-instance ops trigger to Vision §12.
    - Verify: the risk row exists.
26. **T11 (hygiene)** — Fix the Vision doc hygiene ("What v1.3 settles", decisions table order, change-log order). Rename `TYPESAFE_API_KEY` in `.env.local` before Jev returns.
    - Verify: versions and dates are consistent; the key name matches its provider.

**Completed in PRD v6.0 (PRD part only)**
- T1: Telegram removed from the PRD.
- T3: rollout and deferrals applied (§18, §21).
- T4: hosting is one VPS per instance only (§7, DEP-1).
- T5: the C9 rules are now FD-1, FD-4a and FD-5, with tests in item 17.
- T6: time to sent reply and hours given back are in DAT-4 and §3.
- T11: PRD hygiene (footer, §2 heading).
- E-T2: Node 24 in §7. Its old Verify ("the week-2 spike runs Paperclip and Hermes on Node 24") moves to Phase 2.
- E-T8: §12 is now the single source of approval rules.
- E2-T9: the 4-week cap and the go/no-go rule are in §3 and §18.
- E2-T10: §6 and §7 now describe one program, no Redis, and Resend for system email.

## Appendix B — Decision Log
| ID | Source | Decision |
|---|---|---|
| CEO-MODE | CEO review | Review run in SCOPE REDUCTION mode. |
| CEO-R1 | CEO review | Jev deferred; customer zero uses Haiku only behind `DecisionProvider`. |
| CEO-R2 | CEO review | Fleet console UI deferred; scripts plus a registry file until about 10 instances. |
| CEO-R3 | CEO review | Rule proposals, eval gate and golden sets deferred; LRN-1 (record edits) kept. |
| CEO-R4 | CEO review | Training consent, redaction and export deferred; `decision_calls` logging kept. |
| CEO-R5 | CEO review | Drag-and-drop org-chart editor deferred; fixed launch team. (Later superseded by OH-AC: no in-app team at launch.) |
| CEO-R6 | CEO review | Second starter team deferred to Phase 2. |
| CEO-R7 | CEO review | Skills queue, fleet cost analytics and support view deferred; Hermes self-made skills OFF. |
| CEO-C1 | CEO review | Data promise reworded to name model providers as a third path; sign no-training / zero-retention terms. |
| CEO-C2 | CEO review | Telegram replaced by a web app plus signed email links. The "push" part is superseded by OH-AC / ENG2-D1: email notices at launch, push only if the tap-time target is missed. |
| CEO-C3 | CEO review | One small VPS per instance only. |
| CEO-C4 | CEO review | Time to sent reply and an hours-given-back estimate added to the nightly rollup. |
| CEO-C5 | CEO review | Price the launch office as one unit; confirm the margin before pilot 1. |
| CEO-C6 | CEO review | Ops trigger: at 25 instances, add ops help or revisit hosting. |
| CEO-C7 | CEO review | External uptime check plus alert emails for a down host, a missed backup and a failed send. |
| CEO-C8 | CEO review | Orbitcrew is the one customer-facing name; landing claims limited to lead response. |
| CEO-C9 | CEO review | Front Desk rules: dedupe by Message-ID, stale-thread re-draft, approval ID valid until Gmail confirms the send. |
| ENG1-E1 | Eng review v1 | Node 24 LTS. |
| ENG1-E2 | Eng review v1 | Git, a private GitHub repo and CI before the build; `.env.local` excluded. |
| ENG1-E3 | Eng review v1 | An approval link opens a confirm page; the action runs only on a button press (POST). |
| ENG1-E4 | Eng review v1 | Timers are Postgres rows polled every minute. |
| ENG1-E5 | Eng review v1 | Approval ID states `issued → sending → sent / failed`, a hidden tag and a Sent-folder check before retry. |
| ENG1-E6 | Eng review v1 | One Postgres server per instance. (The two-database part moves to Phase 2 with Paperclip.) |
| ENG1-D2 | Eng review v1 | Kept four ORBIT programs plus engines. **Superseded by ENG2-D1.** |
| OH-P1 | Design doc | Wedge: inbound lead replies, with a human approving the full reply. |
| OH-P2 | Design doc | Owner-first: one person holds every role; multi-role approvals, backups, escalation and delegation move to Phase 2. |
| OH-P3 | Design doc | Before building past customer zero, the requesting firm is named, commits to a pilot and agrees a price. |
| OH-P4 | Design doc | Instant fixed-template acknowledgment under a standing approval; the full reply still needs a tap. |
| OH-P5 | Design doc | Dedicated instance per customer with managed setup stays. |
| OH-AC | Design doc | Approach C: a prototype that becomes the Front Desk; Paperclip + Hermes deferred until needed; fleet console deferred. |
| OH-RULES | Design doc | Launch behavior rules: ack conditions and caps, the classifier-to-action table, thread scope, the template, in-thread sending, the confirm-page actions and timeouts, 30 s polling, the latency budget, idempotency, owner-selected tone samples, the success criteria. |
| OH-SPEC | Design doc | FD-6 amended for the standing template approval; decision #14 changed to "added when needed"; AUTH-4 escalation and backups moved to Phase 2. |
| ENG2-D1 | Eng review v2 | One ORBIT program plus Postgres per customer, no Redis; jobs and timers as Postgres rows; the send key restricted by a static test. |
| ENG2-D2 (R3-1) | Eng review v2 | The firm's forwarded emails are stored but never sent to AI until the terms are signed. |
| ENG2-D3 (R3-2) | Eng review v2 | Replay set: real past leads, topped up to 50 with labeled, written test leads. |
| ENG2-D4 (R3-3) | Eng review v2 | On a false positive: +0.05 up to 0.95 with a full rerun, then a deny rule; never lowered without a rerun. |
| ENG2-D5 (R3-4) | Eng review v2 | Two owner-approved ack variants (with and without a name). |
| ENG2-D6 (R3-5) | Eng review v2 | Send, Edit and Discard all require the owner's signed-in session. |
| ENG2-D7 (R3-6) | Eng review v2 | Magic link via Resend (15 min, owner address only), 30-day session, 24 h freshness for board-level. |
| ENG2-D8 | Eng review v2 | Resend emails are content-free; details are shown only after sign-in. |
| ENG2-D9 (R3-7) | Eng review v2 | Automatic post-ack rule check with an instant switch-off; digest "Wrong, not a lead" button; manual re-enable after the replay set passes. |
| ENG2-D10 (R3-8) | Eng review v2 | One label, "Acknowledged, no reply yet"; it repeats daily until resolved on a signed-in page; the subject is flagged after 3 days. |
| ENG2-D11 (R3-9) | Eng review v2 | Customer zero capped at 4 weeks; the go/no-go rule. |
| DR-D2/D3 | Design review | The HTML wireframe is approved as the visual reference. |
| DR-1A | Design review | Home order: Waiting for you (oldest first, countdown), the today line with time to sent reply, then the feed / recent receipts. |
| DR-2A | Design review | Six designed confirm-page edge states. |
| DR-3A | Design review | A loading / empty / error / partial state table, extended to Sign-in and the resolve page. |
| DR-4A | Design review | Day-1 empty Home kept; "David's first screen" dropped under the owner-first plan. |
| DR-5A | Design review | Team is a plain row list and `@xyflow/react` is dropped; the Team screen itself is Phase 2 (6A). |
| DR-6A | Design review | Five launch screens and no nav bar; Team, Tasks, Reviews and Rules move to Phase 2. |
| DR-7A | Design review | DESIGN.md: black and white plus one danger red; closes palette decision #2. |
| DR-8A | Design review | Sticky bottom bar with Edit and Send (48 px) on phones; Discard as a text link. |
| DR-9A | Design review | Numbered accessibility rules (targets, spacing, contrast, focus, labels, `aria-live`, zoom, motion). |
| DR-10A | Design review | Theme follows the phone; no switch. |
| DR-11A | Design review | Edit in place on phones. |
| DR-12A | Design review | Optional discard reason chips, stored. |
| DR-13A | Design review | Top bar: the firm name first, then "by Orbitcrew"; notices from "Orbitcrew for <Firm>". |
| DR-14A | Design review | A small cost line below the draft; the full cost is on the receipt. |
| DR-D10 | Design review | Wireframe v2 (main path plus 6 edge states) is the visual reference. |

END OF DOCUMENT
Version 6.0 | September 30, 2026 | OrbitumAI
