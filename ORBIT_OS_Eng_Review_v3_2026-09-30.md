# Orbitcrew: Engineering Review v3 (backend with Paperclip + Hermes restored)

- **Skill:** /gstack-plan-eng-review (third run today)
- **Date:** 2026-09-30
- **Target (fixed):** `ORBIT_OS_PRD_v6_0.md`, backend architecture only, with Paperclip + Hermes RESTORED in every customer instance from launch (founder decision 2026-09-30; reverses the office-hours Approach C deferral and Eng v2 D1; Vision decision #14 stands). All other approved decisions (owner-first, auto-ack, magic link, design review) stay unless they conflict with the engines.
- **Report file:** this file (user choice at startup). PRD v6.0 is not edited. Output feeds PRD v6.1.
- **Prior reviews:** `ORBIT_OS_CEO_Review_2026-09-30.md`, `ORBIT_OS_Eng_Review_2026-09-30.md` (v1), `ORBIT_OS_Eng_Review_v2_2026-09-30.md` (v2), `ORBIT_OS_Design_Review_2026-09-30.md`.

## Original plan (unchanged copy of ORBIT_OS_PRD_v6_0.md)

<details><summary>Expand PRD v6.0 text</summary>

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

</details>

## Scope record

feature answers: D1 (2026-09-30) = "Include Orbi + Scout": the launch team is Orbi (Coordinator) plus Scout (Specialist); Orbi handles unclear leads, stuck drafts and a Friday weekly routine; Scout drafts; two Hermes profiles and two budgets; structure: A) Original arrangement (D2, 2026-09-30); accepted scope: PRD v6.0 with Paperclip + Hermes restored in every customer instance; per instance 4 ORBIT programs (web, API, worker, Front Desk service) + Redis/Bull + Paperclip + Hermes + 1 Postgres server holding the orbit and paperclip databases (E6); timers stay Postgres rows (E4); team Orbi + Scout; all other approved decisions unchanged. Supersedes Eng v2 D1 (one program, no Redis) and restores Eng v1 D2; pending remedies: S1, S2, S3, S4, S5

## Scope Challenge

**A. Assessment.** No product code exists (only `landing/`, which is excluded). Per instance the accepted scope is now 7 processes: web, API, worker, Front Desk service, Redis, Paperclip, Hermes, plus 1 Postgres server. Search (host WebSearch; Aside not installed) established these facts:
- Paperclip needs Node.js 24.11+ (matches E1). It uses embedded Postgres by default and can point at an external Postgres, so E6 (one server, two databases) is feasible. Its deployment modes are "trusted local loopback" (default) and "authenticated/private", bindable to `tailnet`. Agents wake on assigned work; timer heartbeats are optional. Budgets have warning thresholds and hard stops. Source: github.com/paperclipai/paperclip README.
- Paperclip ships two Hermes adapters: `hermes_local` spawns `hermes chat` per heartbeat on the same host; `hermes_gateway` calls a running Hermes API server over HTTP/SSE (`apiBaseUrl`, `apiKey`, `sessionKeyStrategy` default `"issue"`, `timeoutSec` 600). Source: docs.paperclip.ing/reference/adapters/hermes-gateway.
- **`hermes_gateway` cannot currently be saved or run:** paperclipai/paperclip issue #14426 is OPEN ("`hermes_gateway` is missing from the AI-connection compatibility table"); fix PR #14526 is unreleased.
- The Hermes API server is enabled with `API_SERVER_ENABLED=true` and binds `127.0.0.1:8642`. Profiles are multiplexed under `/p/<profile>/`, each with its own `API_SERVER_KEY` (fails closed without one). Toolsets are set per platform (`gateway.platforms.api_server`). **Profiles "do not provide filesystem sandboxing"**; the default terminal backend has full user-account filesystem access. Sources: hermes-agent.nousresearch.com docs (api-server, profiles).
- Paperclip agent mutations require the `X-Paperclip-Run-Id` header. Source: docs.paperclip.ing/reference/api/issues.

**B.** Complexity gate tripped (2+ new services). Resolved by D1 and D2; see the Scope record above.

**C. Findings**
1. **S1 [P1] (confidence 9/10)** PRD v5.1 §6 (restored by the scope record): "connected through Paperclip's `hermes_gateway` adapter on loopback". Upstream issue #14426 (open) means this adapter cannot be saved or run today.
2. **S2 [P1] (confidence 8/10)** PRD v5.1 FLT-7: "Hermes toolsets within allowed lists (no terminal, browser, file-write or delegation on tenant profiles)". Hermes profiles give no filesystem sandbox, and Scout reads hostile lead email (PRD v6.0 FD-2a "email bodies are treated as adversarial"). A toolset allowlist alone leaves a mistake one config line away from the Gmail token on the same host.
3. **S3 [P1] (confidence 8/10)** PRD v5.1 FD-3: "watch the task for the Specialist's structured comment; validate the format, allow one retry, then mark blocked for the Coordinator". There is no watch mechanism specified (poll or push), no draft schema, and no retry mechanism.
4. **S4 [P2] (confidence 7/10)** PRD v6.0 DAT-3: "Raw email bodies: 90 days". Hermes keeps its own memory, sessions and skills per profile (docs: "config, sessions, memory, skills, databases… scoped to each profile's directory"). Lead content copied there escapes the retention job and DEC-2 deletion.
5. **S5 [P2] (confidence 7/10)** Paperclip adapter `sessionKeyStrategy`: `"agent"` "maintains memory across all runs". If Scout's session spans leads, one client's email can leak into another client's draft. There is no per-lead isolation rule in the plan.
6. **S6 [P2] (confidence 8/10)** D1 gives Orbi "unclear leads", but PRD v6.0's classifier table (OH-RULES) sends "unsure" to the digest. What Orbi returns for an unclear lead, and what happens next, is undefined.

Records (no question: exact prior approval, or a necessary consequence):
- E6 (Eng v1, approved) is back in scope: one Postgres server, `orbit` and `paperclip` databases, separate logins.
- DEP-5 (v5.1): Paperclip and Hermes UIs reachable only over the tailnet; Paperclip runs in authenticated/private mode bound to `tailnet`.
- Heartbeats are OFF for both agents; the only schedule is Orbi's Friday routine (D1). COST-2 returns to the v5.1 wording "zero model calls except the weekly routine".
- The Friday routine brings back the weekly review (answers PRD v6.0 N-11: yes, it exists; delivery channel follows NTC-1 content-free email plus in-app).
- N-2 (broken draft) now follows v5.1 FD-3: one retry, then blocked for Orbi (D1 "stuck drafts"), and the item still appears in the digest.
- AUTH-8 is back: Paperclip board actions (hire confirmations, budget changes) run through ORBIT's service account only after the owner's recorded decision. Hiring happens in the provisioning script (managed setup).
- BKP-1 includes the Paperclip database and Hermes profile volumes again.

## Decision ledger

### S1: Hermes adapter while `hermes_gateway` is broken upstream
Finding: #1, P1, 9/10, PRD v5.1 §6 (restored), native review + web evidence
Plan baseline: v5.1 "`hermes_gateway` adapter on loopback", multiplexed gateway, one profile per agent under `/p/<profile>/`
Runtime evidence: paperclipai/paperclip issue #14426 OPEN; PR #14526 unreleased; `hermes_local` documented as working
Comparison grid:
| Choice | Current | A | B | C |
|---|---|---|---|---|
| Adapter at launch | `hermes_gateway` (broken upstream) | `hermes_local` until a pinned Paperclip release contains the fix and passes staging; then switch to `hermes_gateway` | wait for the upstream fix; customer zero blocked until then | fork Paperclip, apply PR #14526 and pin the fork |
| Hermes process model | separate gateway process | spawned by Paperclip per run, same container (see S2) | separate gateway | separate gateway |
| Upgrade burden | pinned upstream | pinned upstream | pinned upstream | fork to rebase every upgrade day |
Question D3:
D3 — Which Paperclip-to-Hermes adapter runs at launch, given `hermes_gateway` is broken upstream?
Project/branch/task: Orbitcrew on main; backend with Paperclip + Hermes restored (team Orbi + Scout, 4 ORBIT programs).
ELI10: Paperclip needs a connector to hand work to Hermes. Your plan picked the "gateway" connector, where Hermes runs as its own always-on service. That connector has an open bug (#14426): Paperclip refuses to save or run it. The other built-in connector, "local", has Paperclip start Hermes itself for each job on the same server, and it works today.
Stakes if we pick wrong: waiting for the fix could stall customer zero for weeks; forking Paperclip adds a rebase chore to every upgrade day; "local" puts Hermes inside Paperclip's container, which matters for sandboxing (next question).
Recommendation: A) hermes_local now, switch later because it unblocks customer zero today and the switch is a config change once a pinned release passes staging.
Note: options differ in kind, not coverage — no completeness score.
Pros / cons:
A) Local now, gateway later (recommended)
  ✅ Works on today's Paperclip release, so customer zero is not blocked by an upstream bug
  ✅ Moving to the gateway later is an adapter config change, not new ORBIT code
  ❌ Hermes runs inside Paperclip's container per run, so it shares that container's files and env
B) Wait for upstream fix
  ✅ Exactly the architecture in your original plan, with Hermes as its own service
  ✅ No temporary setup to replace later
  ❌ Customer zero cannot start until an unscheduled upstream release ships the fix
C) Fork and patch
  ✅ Gateway architecture works now, with Hermes kept as its own service
  ✅ The patch is small and already written upstream (PR #14526)
  ❌ Every monthly upgrade day adds a fork rebase and retest, run by you alone
Net: start now on the working connector versus keep the planned connector and either wait or maintain a fork.
Header: Hermes adapter
Options:
A) Local now, gateway later (recommended)
Use `hermes_local` (Paperclip starts Hermes per run on the same server). Switch to `hermes_gateway` when a pinned Paperclip release includes the #14426 fix and passes the staging golden thread. (human: ~2h / CC: ~10 min to switch later)
B) Wait for upstream fix
Keep `hermes_gateway`. Customer zero waits until Paperclip releases the fix; no local fallback.
C) Fork and patch
Fork Paperclip, apply PR #14526, pin the fork. Works now, but every upgrade day needs a rebase and retest. (human: ~1 day / CC: ~30 min, plus monthly upkeep)

State: approved
Actual answer: A) Local now, gateway later (recommended), D3, 2026-09-30
Accepted scope: Launch uses Paperclip's `hermes_local` adapter (Paperclip starts Hermes per run on the same server/container). Switch to `hermes_gateway` when a pinned Paperclip release contains the #14426 fix and passes the staging golden thread; the switch is adapter config only.
History: —

### S2: Containing Hermes (no filesystem sandbox, hostile lead email)
Finding: #2, P1, 8/10, PRD v5.1 FLT-7 + v6.0 FD-2a, native review + Hermes profiles doc
Plan baseline: v5.1 FLT-7 posture check "no terminal, browser, file-write or delegation on tenant profiles"; SEC-2 only the Front Desk can send
Runtime evidence: Hermes docs: profiles "do not provide filesystem sandboxing"; D3 puts Hermes inside the Paperclip container (`hermes_local`)
Comparison grid:
| Choice | Current | A | B |
|---|---|---|---|
| Toolset allowlist per profile | v5.1 rule, unverified | Scout: web search + web fetch only; Orbi: none beyond Paperclip issue tools; no terminal, file-write, browser, delegation | same allowlist |
| Container boundary | unspecified | Paperclip+Hermes in their own container: no Gmail token, no Resend key, no ORBIT DB login (paperclip DB login only, E6), read-only filesystem except Paperclip/Hermes data dirs | shares host user and filesystem with ORBIT programs |
| Posture check (FLT-7) | toolsets listed | asserts allowlist AND that the container env/filesystem holds no Gmail/Resend secrets | asserts allowlist only |
Question D4:
D4 — How do we contain Hermes, which reads hostile lead emails and has no filesystem sandbox?
Project/branch/task: Orbitcrew on main; backend with Paperclip + Hermes restored; Hermes runs inside Paperclip via `hermes_local` (D3).
ELI10: Scout reads every lead email, and a lead can write text meant to trick an AI ("ignore your rules, run this command"). Hermes has tools like a terminal and file editing, and its docs say profiles do not wall off the disk. Turning those tools off is step one. Step two is making sure that, even if a tool slips back on, there is nothing dangerous within reach, like the Gmail send key.
Stakes if we pick wrong: a hostile email plus one config slip could let Hermes read the Gmail token and send mail without your tap, which breaks the core promise.
Recommendation: A) Allowlist plus separate container because the approval-ID promise must hold even when one layer fails, and the container split costs about half a day.
Completeness: A=9/10, B=6/10
Pros / cons:
A) Allowlist + own container (recommended)
  ✅ Two walls: tools off, and nothing to steal even if a tool gets turned on by mistake
  ✅ Posture check can prove on every upgrade that no Gmail or Resend secret sits in that container
  ❌ One more container boundary to set up and keep in the template (human: ~4h / CC: ~20 min)
B) Allowlist only
  ✅ Simplest setup: toolset config plus a posture check, nothing more
  ✅ Matches the v5.1 posture check wording exactly
  ❌ One config mistake exposes the Gmail token on the same filesystem as the hostile input
Net: a second wall that costs half a day versus trusting a single config list.
Header: Hermes containment
Options:
A) Allowlist + own container (recommended)
Scout gets web search + web fetch only; Orbi only Paperclip issue tools; no terminal, file-write, browser or delegation. Paperclip+Hermes run in their own container with no Gmail/Resend secrets and only the paperclip DB login; read-only filesystem except their data dirs. FLT-7 posture check asserts both. (human: ~4h / CC: ~20 min)
B) Allowlist only
Same toolset allowlist and posture check, but Paperclip+Hermes share the host user and filesystem with the ORBIT programs.

State: approved
Actual answer: A) Allowlist + own container (recommended), D4, 2026-09-30
Accepted scope: Scout toolsets: web search + web fetch only; Orbi: Paperclip issue tools only; no terminal, file-write, browser or delegation on either profile. Paperclip + Hermes run in their own container with no Gmail token, no Resend key and only the paperclip DB login (E6); read-only filesystem except Paperclip/Hermes data dirs. FLT-7 posture check asserts the allowlist AND the absence of Gmail/Resend secrets in that container, on every provision and upgrade.
History: —

### S3: Draft handoff from Scout back to ORBIT
Finding: #3, P1, 8/10, PRD v5.1 FD-3 (restored), native review
Plan baseline: v5.1 FD-3 "watch the task for the Specialist's structured comment; validate the format, allow one retry, then mark blocked for the Coordinator"
Runtime evidence: Paperclip agent mutations require `X-Paperclip-Run-Id`; Paperclip documents inbound routine triggers (cron, webhook, API); outbound comment webhooks to ORBIT are unverified (unknown)
Comparison grid:
| Choice | Current | A | B |
|---|---|---|---|
| How ORBIT learns a draft is ready | "watch", unspecified | Front Desk polls the Paperclip issue every 15 s (worker repeat job) until a Scout comment arrives or 10 min pass | Paperclip pushes to an ORBIT API endpoint on new comment (outbound webhook, existence unverified) |
| Draft format | "structured comment", unspecified | fixed JSON block in the comment: draft text, category flags, one-line reason; ORBIT validates with a schema | same schema |
| Retry | "one retry" | ORBIT posts one comment asking for a corrected draft (re-wakes Scout); second failure or 10-min timeout marks the issue blocked and assigns Orbi; the lead also appears in the digest | same retry |
Question D5:
D5 — How does ORBIT pick up Scout's finished draft from Paperclip?
Project/branch/task: Orbitcrew on main; backend with Paperclip + Hermes restored (Orbi + Scout, hermes_local, own container).
ELI10: ORBIT hands a lead to Scout by opening a Paperclip task. Scout writes the draft as a comment on that task. ORBIT then has to notice the comment, check it is in the right shape, and turn it into your confirm-page draft. Checking every 15 seconds is simple and uses only features Paperclip is known to have. Having Paperclip ping ORBIT is faster, but we could not confirm Paperclip can send that ping.
Stakes if we pick wrong: a push design that Paperclip cannot do stalls the build; a poll that is too slow eats into the 15-minute draft target.
Recommendation: A) Poll every 15 s because it relies only on documented Paperclip features and 15 s is small against the 15-minute draft target.
Note: options differ in kind, not coverage — no completeness score.
Pros / cons:
A) Poll every 15 s (recommended)
  ✅ Uses only documented Paperclip APIs; no inbound endpoint exposed on ORBIT for Paperclip
  ✅ Timeout, retry and hand-off to Orbi all live in one ORBIT worker job that is easy to test
  ❌ Up to 15 s extra delay per draft, plus a small steady load of API calls while drafts are open
B) Paperclip pushes
  ✅ ORBIT learns about the draft within a second of Scout finishing
  ✅ No polling load while waiting
  ❌ Paperclip outbound comment webhooks are unverified; if missing, this blocks the build
Net: proven and simple with a 15-second lag versus faster but resting on an unconfirmed Paperclip feature.
Header: Draft handoff
Options:
A) Poll every 15 s (recommended)
Front Desk worker polls the Paperclip issue every 15 s for Scout's comment. The comment holds a fixed JSON block (draft, flags, reason) checked against a schema. One corrective comment re-wakes Scout; a second failure or a 10-minute timeout marks the issue blocked, assigns Orbi, and lists the lead in the digest. (human: ~4h / CC: ~20 min)
B) Paperclip pushes
Same schema and retry, but ORBIT waits for Paperclip to call an ORBIT endpoint on each new comment. Requires confirming Paperclip outbound webhooks first.

State: approved
Actual answer: A) Poll every 15 s (recommended), D5, 2026-09-30
Accepted scope: Front Desk worker (Bull repeat job) polls the Paperclip issue every 15 s for Scout's comment. The comment carries a fixed JSON block (draft text, category flags, one-line reason) validated against a schema. On an invalid draft ORBIT posts one corrective comment that re-wakes Scout; a second failure or a 10-minute timeout marks the issue blocked, assigns Orbi, and lists the lead in the digest.
History: —

### S4: Lead content inside Hermes memory, sessions and skills
Finding: #4, P2, 7/10, PRD v6.0 DAT-3 + DEC-2, native review + Hermes profiles doc
Plan baseline: DAT-3 "Raw email bodies: 90 days"; DEC-2 "data deleted after 30 days"; CEO R7 "Hermes self-made skills OFF on customer instances" (approved)
Runtime evidence: Hermes scopes "config, sessions, memory, skills, databases" per profile directory; no ORBIT job touches them (unknown retention)
Comparison grid:
| Choice | Current | A | B |
|---|---|---|---|
| Persistent memory on Scout and Orbi | Hermes default (on) | off | on |
| Self-made skills | off (R7, approved) | off (R7) | off (R7) |
| Hermes sessions/transcripts retention | none | nightly job deletes Hermes session files older than 90 days (same policy row as raw email in `retention_policies`) | same nightly job, plus memory files purged at 90 days |
| DEC-2 decommission deletion | ORBIT + Paperclip data | also wipes Hermes profile volumes | also wipes Hermes profile volumes |
Question D6:
D6 — How do we keep lead emails from piling up inside Hermes beyond your retention rules?
Project/branch/task: Orbitcrew on main; backend with Paperclip + Hermes restored (Orbi + Scout, own container, 15 s draft poll).
ELI10: Your rules say raw client emails are deleted after 90 days. Hermes keeps its own notes: chat sessions and a long-term "memory" per teammate. Anything Scout reads could end up there and never get deleted, so your privacy promise would quietly stop being true. We can turn Hermes' long-term memory off and clean its sessions on the same 90-day clock, or keep memory on and clean both.
Stakes if we pick wrong: client emails live on disk past 90 days and after a customer leaves, which a law or accounting firm would treat as a broken promise.
Recommendation: A) Memory off, sessions purged at 90 days because each lead is drafted from its own email, tone samples and facts file, so cross-lead memory adds privacy risk without a clear drafting gain.
Completeness: A=9/10, B=7/10
Pros / cons:
A) Memory off + 90-day purge (recommended)
  ✅ Nothing about one client carries into another client's draft through Hermes memory
  ✅ One retention rule covers ORBIT, Paperclip and Hermes, so the 90-day promise stays literally true
  ❌ Scout cannot "learn" from past leads through memory; learning stays in ORBIT's edit records
B) Memory on + purge both
  ✅ Scout may pick up patterns across leads, like recurring questions
  ✅ Still honors the 90-day rule by purging memory files too
  ❌ Memory mixes clients until purged, and a purge that misses a file leaves data behind silently
Net: a clean privacy boundary versus possible drafting gains from shared memory.
Header: Hermes memory
Options:
A) Memory off + 90-day purge (recommended)
Persistent memory off on Scout and Orbi; self-made skills stay off (R7). A nightly job deletes Hermes session files older than 90 days using the raw-email row in `retention_policies`. Decommission (DEC-2) also wipes Hermes profile volumes. (human: ~3h / CC: ~15 min)
B) Memory on + purge both
Persistent memory stays on; the same nightly job purges both session and memory files older than 90 days; DEC-2 wipes the volumes.

State: approved
Actual answer: A) Memory off + 90-day purge (recommended), D6, 2026-09-30
Accepted scope: Persistent memory OFF on Scout and Orbi; self-made skills stay OFF (R7). A nightly job deletes Hermes session files older than 90 days, driven by the raw-email row in retention_policies (DAT-3). Decommission (DEC-2) also wipes the Hermes profile volumes.
History: —

### S5: One Hermes session per lead
Finding: #5, P2, 7/10, Paperclip adapter `sessionKeyStrategy` doc, native review
Plan baseline: no rule; adapter default `"issue"` (per Paperclip issue); `"agent"` shares a session across all runs
Runtime evidence: `sessionKeyStrategy` documented for `hermes_gateway`; the equivalent setting for `hermes_local` (D3) is unknown and must be verified in the week-2 spike
Comparison grid:
| Choice | Current | A | B |
|---|---|---|---|
| Session scope for Scout and Orbi | unspecified (default per issue) | one session per Paperclip issue (one lead); never shared across issues | a fresh session for every run |
| Retry context (S3 corrective comment) | — | the retry sees the first draft and the correction | the retry starts cold; the corrective comment must restate everything |
| Proof | none | integration test: two leads run back to back; the second run's prompt/context holds nothing from the first | same test |
Question D7:
D7 — How long does one Hermes conversation last: per lead, or per single run?
Project/branch/task: Orbitcrew on main; backend with Paperclip + Hermes restored (memory off, 90-day purge per D6).
ELI10: Even with long-term memory off, Hermes keeps a running conversation (a "session"). If one session covered many leads, client A's email could still sit in the conversation while Scout writes to client B. Tying one session to one lead keeps clients apart and lets a retry see the first draft. A fresh session every run is even stricter but makes retries start from zero.
Stakes if we pick wrong: a shared session can leak one client's details into another client's reply, sent under the owner's name.
Recommendation: A) One session per lead because it keeps clients apart and still lets Scout fix its own draft on retry.
Completeness: A=9/10, B=8/10
Pros / cons:
A) One session per lead (recommended)
  ✅ Clients never share a conversation, so no cross-client leak through the session
  ✅ A retry sees the first draft and the correction, so fixes are cheaper and better
  ❌ The hermes_local setting must be verified in the week-2 spike; if missing, needs a workaround
B) Fresh session per run
  ✅ Strictest isolation: every run starts empty
  ✅ No dependence on session-key settings at all
  ❌ Retries start cold, costing more tokens and giving Scout less to go on
Net: per-lead isolation with smarter retries versus maximum isolation with dumber retries.
Header: Hermes sessions
Options:
A) One session per lead (recommended)
Scout and Orbi use one session per Paperclip issue (one lead), never shared across issues. Verify the hermes_local setting in the week-2 spike. Integration test: two leads back to back; the second run holds nothing from the first. (human: ~2h / CC: ~10 min)
B) Fresh session per run
Every run starts a new session; the corrective comment restates the full context. Same two-lead integration test.

State: approved
Actual answer: A) One session per lead (recommended), D7, 2026-09-30
Accepted scope: Scout and Orbi use one Hermes session per Paperclip issue (one lead), never shared across issues. Verify the hermes_local session setting in the week-2 spike. Integration test: two leads run back to back; the second run's context holds nothing from the first.
History: —

### S6: What Orbi does with an unclear lead
Finding: #6, P2, 8/10, D1 answer ("Orbi handles unclear leads") vs PRD v6.0 classifier table ("unsure" → digest, OH-RULES)
Plan baseline: D1 (approved): Orbi handles unclear leads, stuck drafts and a Friday routine. OH-RULES (approved): "unsure" or classifier failed → no ack, no draft, digest "unsure"; ack only for "lead" ≥ 0.8, unknown sender, first message
Runtime evidence: none (not built)
Comparison grid:
| Choice | Current | A | B |
|---|---|---|---|
| Unclear lead ("unsure" or classifier failed twice) | digest only | Paperclip issue assigned to Orbi; Orbi returns a JSON verdict `lead` / `not_lead` with a one-line reason | Paperclip issue assigned to Orbi; Orbi adds a one-line opinion that is shown in the digest entry; the owner decides |
| If Orbi says `lead` | — | assign to Scout → draft → confirm link; still NO ack (ack rules unchanged) | nothing automatic; the owner can press "Draft a reply" from the digest |
| If Orbi says `not_lead` | — | digest "not a lead (Orbi)" | digest shows Orbi's opinion |
| Digest visibility | "unsure" listed | every Orbi verdict listed in the digest | listed with opinion |
| Ack rules | OH-RULES | unchanged | unchanged |
Question D8:
D8 — When the lead classifier is unsure, what exactly does Orbi do?
Project/branch/task: Orbitcrew on main; backend with Paperclip + Hermes restored (Orbi + Scout per D1).
ELI10: Some emails are unclear: maybe a lead, maybe not. You chose to give those to Orbi, the AI manager. Orbi can either decide ("yes, lead") and send it straight to Scout for a draft, or just write its opinion into your daily digest so you decide. In both cases no instant acknowledgment goes out, because the ack rules stay strict.
Stakes if we pick wrong: letting Orbi decide means some real leads get a draft the same day instead of waiting for your digest; letting Orbi only advise keeps you in control but slows unclear leads by up to a day.
Recommendation: A) Orbi decides because the full reply still needs your tap, so an Orbi mistake costs you one discarded draft, while a missed lead costs a deal.
Note: options differ in kind, not coverage — no completeness score.
Pros / cons:
A) Orbi decides (recommended)
  ✅ Unclear real leads get a draft and a confirm link within minutes, not the next day
  ✅ Nothing is sent without your tap, and every Orbi verdict still shows in the digest
  ❌ Some non-leads will produce drafts you discard, adding model cost and noise
B) Orbi advises only
  ✅ You stay the only one deciding whether an unclear email is a lead
  ✅ No extra drafts for emails that turn out not to be leads
  ❌ Unclear real leads wait for your daily digest before any draft exists
Net: faster drafts for unclear leads versus tighter owner control at the cost of up to a day's delay.
Header: Orbi on unclear
Options:
A) Orbi decides (recommended)
Unclear leads (unsure, or classifier failed twice) become a Paperclip issue for Orbi. Orbi returns lead / not_lead with a reason. Lead goes to Scout for a draft and confirm link, with no ack. Not_lead goes to the digest as "not a lead (Orbi)". Every Orbi verdict appears in the digest. (human: ~3h / CC: ~15 min)
B) Orbi advises only
Unclear leads become a Paperclip issue for Orbi, which writes a one-line opinion shown in the digest entry. You decide; a "Draft a reply" action on the digest item starts Scout.

State: approved
Actual answer: A) Orbi decides (recommended), D8, 2026-09-30
Accepted scope: Unclear leads (classifier unsure, or failed twice) become a Paperclip issue assigned to Orbi. Orbi returns a JSON verdict lead / not_lead with a one-line reason. lead: assigned to Scout for a draft and confirm link, with NO ack (ack rules unchanged). not_lead: digest entry 'not a lead (Orbi)'. Every Orbi verdict appears in the digest.
History: —

**Scope Challenge result:** scope accepted as-is (restored engines per the founder; D1 kept Orbi; D2 kept the original 4-program arrangement). S1–S6 approved (D3–D8).

## Review Sections

### 1. Architecture

```
  Per customer VPS (D2 original arrangement, D3 hermes_local, D4 container split)

  +------------------------------ ORBIT container(s) ------------------------------+
  | Gmail --history poll 30s--> [FRONT DESK svc] dedupe, rules, contacts index      |
  |                               | Haiku classify (Decision Layer)                 |
  |                               |-- lead >=0.8 + guards --> ack (Gmail, in thread) |
  |                               |-- lead ------------> create Paperclip issue -> Scout
  |                               |-- unsure/failed ---> create Paperclip issue -> Orbi (S6)
  |                               |<-- poll issue 15s for JSON draft/verdict (S3) --+
  |                               | approval row (issued) --> [WORKER] Resend notice |
  |   [WEB] confirm page, sign-in, Home, Settings   [API] sessions, POST decisions    |
  |                               | owner taps Send (API writes decision)            |
  |   [FRONT DESK sender] sending -> Gmail -> Sent check -> sent/failed (E5)         |
  |   [WORKER] timers as Postgres rows (E4), digest, rollup, retention, Hermes purge |
  |   [REDIS] Bull queues                                                             |
  +----------------------------------------------------------------------------------+
  +------------- Paperclip + Hermes container (D4: no Gmail/Resend secrets) ----------+
  | [PAPERCLIP] company, issues, budgets, Friday routine (Orbi), tailnet-only UI      |
  |    `hermes_local` --> spawns Hermes per run: profiles scout, orbi                |
  |    toolsets: scout = web search/fetch; orbi = issue tools; memory OFF (D6)      |
  |    session = one per issue (D7)                                                  |
  +----------------------------------------------------------------------------------+
  [POSTGRES server] databases: orbit (ORBIT logins) | paperclip (paperclip login) (E6)
```

Findings:
1. **A1 [P1] (confidence 8/10)** Scope record (D2): "4 ORBIT programs … + Redis/Bull". Eng v1 finding (approved E4): "BKP-1 backs up … not Redis. After a restore or Redis loss, every pending escalation silently disappears". E4 moved timers only. The S3 draft-poll jobs, notice sends and digest runs are Bull jobs. If Redis is lost, a lead whose draft poll vanished stays stuck with no draft and no digest entry. → decision A1 below.
2. Record (consequence of SEC-2 + D2): only the Front Desk service holds the Gmail send scope. When the owner taps Send, the API writes the decision; the Front Desk sender executes it. The web and API programs never hold Gmail credentials. The v2 static test now asserts this across the four programs.
3. Record (v5.1 HIR-1 + AUTH-8 restored, D1): the provisioning script creates the Paperclip company, hires Orbi and Scout through ORBIT's service account, sets both budgets, turns heartbeats off and adds Orbi's Friday routine. In-app hiring (onboarding) stays Phase 2.
4. Record (COST-1 restored): the 80% warning and the 100% pause come from Paperclip budgets per teammate. If Scout is paused, the S3 10-minute timeout routes the lead to Orbi. If Orbi is also paused, the lead goes to the digest. Where the owner sees budgets remains PRD v6.0 N-7.
5. Record: the Anthropic key used by Hermes lives in the Paperclip/Hermes container (allowed by D4). The Haiku key for the Decision Layer lives in the ORBIT containers. Both are per-instance secrets (SEC-5, SEC-10).
6. Record (unknown, week-2 spike): `hermes_local` profile selection and session setting (D7) at the pinned Paperclip version.

### A1: Durable work when Redis is lost
Finding: Section 1 #1, P1, 8/10, scope record D2 + Eng v1 E4 finding, native review
Plan baseline: D2 approved Redis/Bull; E4 approved "Escalation timers stored as due-time rows in Postgres"; BKP-1 covers Postgres, the Paperclip DB and Hermes volumes, not Redis
Runtime evidence: none (not built)
Comparison grid:
| Choice | Current | A | B |
|---|---|---|---|
| Source of truth for pending work | Bull jobs in Redis | Postgres rows (lead state, approval state, notice/digest due rows); Bull only runs the work | Bull jobs in Redis |
| Recovery after Redis loss or restore | none | a reconciler runs at worker start and every minute, re-queuing any Postgres row whose work is due or stuck | Redis AOF persistence on, Redis data included in the nightly backup |
| Proof | none | restart test: flush Redis mid-draft; the lead still reaches the confirm page | restore test with a Redis snapshot |
Question D9:
D9 — What keeps pending work alive if Redis loses its queue?
Project/branch/task: Orbitcrew on main; backend with Paperclip + Hermes restored; 4 ORBIT programs + Redis (D2).
ELI10: You chose the original layout, which uses Redis as a to-do list for background jobs, like "check whether Scout's draft is ready". Redis keeps that list in memory and it is not in the nightly backup. If Redis restarts badly or a server is restored, those to-dos vanish and a lead can sit with no draft and no mention in your digest. We can make Postgres the real to-do list with Redis just doing the work, or back up Redis too.
Stakes if we pick wrong: a lead silently stalls after a restart or restore, the exact "leads never stall" promise E4 was meant to protect.
Recommendation: A) Postgres is the record, plus a reconciler because it extends the E4 fix you already approved to every job and adds nothing new to back up.
Completeness: A=9/10, B=7/10
Pros / cons:
A) Postgres record + reconciler (recommended)
  ✅ Nothing is lost on a Redis flush or a restore, because every pending step is a Postgres row
  ✅ Same pattern as the approved E4 timers, so one rule for all background work
  ❌ A small reconciler job to write and test (human: ~4h / CC: ~20 min)
B) Persist and back up Redis
  ✅ No new reconciler code; Redis keeps its own list on disk
  ✅ Standard Redis feature (AOF persistence)
  ❌ One more data store in every backup and restore drill, and jobs between snapshots can still be lost
Net: one durable record in Postgres versus keeping two stores in sync through backups.
Header: Redis durability
Options:
A) Postgres record + reconciler (recommended)
Postgres rows are the source of truth for every pending step (draft poll, notices, digest, sends); Bull only executes. A reconciler at worker start and every minute re-queues due or stuck rows. Test: flush Redis mid-draft; the lead still reaches the confirm page. (human: ~4h / CC: ~20 min)
B) Persist and back up Redis
Turn on Redis AOF persistence and add Redis data to the nightly backup and the restore drill. Test: restore from a Redis snapshot.

State: approved
Actual answer: A) Postgres record + reconciler (recommended), D9, 2026-09-30
Accepted scope: Postgres rows are the source of truth for every pending step (draft poll, Orbi verdict poll, notices, digest, sends); Bull only executes. A reconciler runs at worker start and every minute and re-queues due or stuck rows. Test: flush Redis mid-draft; the lead still reaches the confirm page.
History: —

### 2. Code quality

1. Record: one shared schema module (Zod) defines the Scout draft block and the Orbi verdict block. The Front Desk validator and the tests both use it (S3, S6). No other shared-code opportunity exists: there is no product code yet, and proposed callers only.
2. Record: the draft and verdict parsers are pure functions (JSON block → typed result or error), the same as the ack guard and the name sanitizer. They are easy to unit-test.
3. Record (error handling): every Paperclip API call from the Front Desk carries a timeout. A Paperclip outage is handled like the S3 timeout: no draft, and the lead goes to the digest as "draft failed (office unavailable)". The ack path does not depend on Paperclip, so acks keep flowing during a Paperclip outage.

No new decisions.

### 3. Tests

Framework: none in the product yet. `landing/` uses Vitest + Testing Library; the product reuses Vitest (carried from Eng v1).

```
CODE PATHS                                                USER FLOWS
[+] Front Desk -> Paperclip bridge                        [+] Lead -> sent reply (golden thread, with engines)
  ├── [GAP] create issue for Scout (lead) / Orbi (unsure)   ├── [GAP] [→E2E] email -> ack -> Scout draft via Paperclip
  ├── [GAP] 15 s poll finds valid JSON draft (S3)          │         -> notice -> sign-in -> Send -> receipt
  ├── [GAP] invalid draft -> 1 corrective comment -> ok     └── [GAP] [→E2E] unsure email -> Orbi "lead" -> Scout draft,
  ├── [GAP] 2nd failure / 10-min timeout -> Orbi + digest              no ack sent (S6)
  └── [GAP] Paperclip down -> digest "office unavailable"  [+] Isolation and privacy
[+] Orbi verdict (S6)                                       ├── [GAP] [→E2E] two leads back to back share no session (S5)
  ├── [GAP] lead -> Scout, no ack                           ├── [GAP] Hermes memory off on both profiles (S4)
  └── [GAP] not_lead -> digest "not a lead (Orbi)"          └── [GAP] 90-day purge deletes old Hermes sessions (S4)
[+] Reconciler (A1)                                       [+] Posture (S2)
  └── [GAP] Redis flushed mid-draft -> lead still reaches   ├── [GAP] container has no Gmail/Resend secret
            confirm page                                    └── [GAP] toolsets = allowlist only; memory off
[+] Send path across 4 programs                           [+] Budgets
  └── [GAP] static test: only Front Desk holds Gmail send   └── [GAP] Scout paused at 100% -> S3 timeout -> Orbi/digest
[+] Adapter (S1)                                          LLM: [→EVAL] replay set through Scout-on-Hermes (E2-T7),
  └── [GAP] hermes_local runs Scout profile at pinned            re-run before any prompt or profile change (LRN-9)
            version (week-2 spike)
Carried from Eng v2 test plan (unchanged): ack guard, name variants, kill switch, magic link, Resend payload, sender idempotency, data gate, digest repeats.

COVERAGE (planned): 0/17 new paths (no code yet) | GAPS: 17 (3 E2E, 1 eval)
```

Every gap is required proof of an approved behavior (D3–D9, E6, SEC-2, COST-1), so no test question is needed. The test plan artifact is written to `~/.gstack/projects/OrbitOS/subha-main-eng-review-test-plan-<datetime>.md`. No tests are retired (no code exists).

### 4. Performance

1. Record: memory per VPS is now 4 ORBIT Node processes, Redis, Paperclip (Node), Hermes (spawned per run), and Postgres. The v5.1 "2–4 GB" estimate applies again. The approved footprint measurement on customer zero decides the host size. C5 (the margin check before pilot 1) must use that measured size.
2. Record: `hermes_local` starts a Hermes process per run. The cold start adds seconds per draft, which is inside the 15-minute draft target and off the ack path (the 90 s ack budget is unchanged because the ack never touches Paperclip or Hermes).
3. Record: the S3 poll is 4 calls/min per open draft against a local Paperclip, which is negligible at pilot volume.

No new decisions.

## Outside Voice

Codex CLI is not installed. The native fallback needs TaskOutput and TaskStop, which this session does not declare. **Outside voice unavailable.** Missing coverage is recorded, not counted as clean.

## TODOS.md

`TODOS.md` does not exist yet. One candidate from this review:

### TODO-1: Switch Scout and Orbi to `hermes_gateway` after the upstream fix
Finding: S1 follow-up, P2, 9/10, paperclipai/paperclip issue #14426
Plan baseline: D3 approved `hermes_local` now, gateway "when a pinned Paperclip release contains the #14426 fix and passes the staging golden thread"
Runtime evidence: issue #14426 open; PR #14526 unreleased
- **What:** change both agents' adapter to `hermes_gateway` (Hermes as its own API server, profiles under `/p/<profile>/`, per-profile `API_SERVER_KEY`), in its own container.
- **Why:** it restores the original gateway design and moves Hermes out of Paperclip's container.
- **Pros:** cleaner isolation; a long-running Hermes means no per-run cold start.
- **Cons:** one more container per VPS; needs a staging golden-thread run.
- **Context:** blocked on the upstream release. Where to start: watch #14426, pin the release, flip the adapter config on staging, rerun the posture check and the S5 two-lead test.
- **Depends on / blocked by:** a Paperclip release with PR #14526.
Comparison grid:
| Choice | Current | A | B | C |
|---|---|---|---|---|
| TODO-1 tracking | none | add to TODOS.md | not tracked | build now (not possible: upstream fix unreleased) |
Question D10:
D10 — Track the later switch to Hermes' gateway connector in a TODOS.md file?
Project/branch/task: Orbitcrew on main; D3 chose the local connector until Paperclip fixes bug #14426.
ELI10: We are using the working "local" connector for now. When Paperclip ships the fix, you want to switch to the "gateway" connector from your original plan. Writing that down in a TODO file means it won't be forgotten on some future upgrade day.
Stakes if we pick wrong: without a note, the temporary setup quietly becomes permanent.
Recommendation: A) Add to TODOS.md because it is a real follow-up with a clear trigger and costs one file entry.
Note: options differ in kind, not coverage — no completeness score.
Pros / cons:
A) Add to TODOS.md (recommended)
  ✅ The switch has a written trigger (upstream release) and a start point, so it survives months
  ✅ Creates the project's TODOS.md, which later reviews and /retro can read
  ❌ One more file in the repo to keep current
B) Skip
  ✅ No new file; D3's accepted scope already names the trigger in this review
  ✅ Less to maintain
  ❌ The trigger lives only inside a long review file that nobody rereads on upgrade day
C) Build it now
  ✅ Would finish the original gateway design immediately
  ✅ No follow-up needed afterwards
  ❌ Not possible today: the fix is not in any Paperclip release yet
Net: one file entry that keeps the switch visible versus relying on this review document.
Header: Gateway TODO
Options:
A) Add to TODOS.md (recommended)
Create TODOS.md with TODO-1 (What/Why/Pros/Cons/Context/Depends on) as written above.
B) Skip
Do not track it outside this review; D3's trigger stays recorded here only.
C) Build it now
Switch to hermes_gateway now. Not possible until Paperclip releases the #14426 fix.

State: approved
Actual answer: A) Add to TODOS.md (recommended), D10, 2026-09-30
Accepted scope: Create TODOS.md with TODO-1 (What/Why/Pros/Cons/Context/Depends on) as written in this record.
History: —

Approval readiness: PASS. Checked scope D1 and D2, S1 (D3), S2 (D4), S3 (D5), S4 (D6), S5 (D7), S6 (D8), A1 (D9) and TODO-1 (D10). Each was approved by its own answer on 2026-09-30. Carried forward without re-asking: Eng v1 E1–E6, the CEO decisions, Eng v2 D2–D11 (all except D1, which D2 here supersedes) and the Design review decisions.

## NOT in scope
- The smaller one-program arrangement (declined at D2) and the Scout-only team (declined at D1).
- `hermes_gateway` at launch: blocked upstream; tracked in TODOS.md (D3, D10).
- A Paperclip fork (declined at D3).
- Hermes persistent memory (off per D6).
- Push-style Paperclip webhooks to ORBIT (declined at D5; unverified upstream).
- Redis persistence and backup (declined at D9; Postgres is the record).
- In-app onboarding and hiring (still Phase 2; hiring runs in the provisioning script).

## What already exists
- Paperclip (upstream, MIT): company, issues, budgets with warning and hard stop, routines, `hermes_local` adapter, external-Postgres support. Reused, not rebuilt.
- Hermes Agent (upstream): profiles, toolsets per platform, API server for the later gateway switch. Reused.
- Carried decisions: Eng v1 E1–E6, Eng v2 D2–D11 (auth, notices, ack, kill switch, data gate, replay, digest), the CEO decisions and the Design review decisions.
- `landing/` Vitest setup: the test stack is reused.

## Failure modes

| Path | Realistic failure | Handling / test | User sees | Critical gap? |
|---|---|---|---|---|
| Paperclip down | Container crash | Ack path unaffected; S3 timeout → digest "draft failed (office unavailable)"; uptime alert (C7) | Ack still sent; lead listed in digest | No |
| Scout bad output | Malformed JSON draft | Schema check, 1 corrective comment, then Orbi + digest (S3) | Draft arrives late or via digest | No |
| Prompt injection | Lead email tells Scout to run commands | Toolset allowlist + container with no Gmail/Resend secrets + posture check (S2) | Nothing sent without tap | No |
| Session bleed | Two leads share a session | One session per issue + two-lead test (S5) | Nothing | No |
| Redis loss | Queue flushed or server restored | Postgres record + reconciler (A1) | Draft up to about 1 min late | No |
| Budget pause | Scout hits 100% | S3 timeout → Orbi → digest | Lead in digest; 80% warning earlier | No |
| Retention | Hermes sessions outlive 90 days | Nightly purge + test (S4) | Nothing | No |
| Upstream adapter | `hermes_local` behaves differently at pinned version | Week-2 spike; staging golden thread before pilots | Build blocked, not users | No (tracked unknown) |

Critical gaps: **0**.

## Worktree parallelization strategy

| Step | Modules touched | Depends on |
|---|---|---|
| S1 Repo, CI, template compose (4 ORBIT programs, Redis, Paperclip+Hermes container, Postgres with 2 DBs) | root, template/, .github/ | — |
| S2 ORBIT schema: events, approvals, lead state, job rows, timers, sessions, contacts | db/ | S1 |
| S3 Week-2 spike: Paperclip company + Orbi/Scout via `hermes_local`, toolsets, memory off, per-issue session | template/paperclip, template/hermes | S1 |
| S4 Front Desk: poller, classifier, ack guard, kill switch, Paperclip bridge (issues, 15 s poll, schema, retry, Orbi route), sender | frontdesk/, shared/schemas | S2, S3 |
| S5 Web + API: confirm page, magic link, sessions, Home, Settings, resolve page | web/, api/ | S2 |
| S6 Worker: reconciler, timers, notices, digest, rollup, retention incl. Hermes purge | worker/ | S2 |
| S7 Posture check + provisioning script (hire Orbi/Scout, budgets, Friday routine) | ops/ | S3 |

Lane A: S1 → S2. Lane B: S3 (in parallel with S2). Then launch S4 (after S2 and S3), S5 and S6 in parallel, and S7 after S3. Merge, then run the golden-thread E2E. Conflict flags: S4 and S6 both write job rows (freeze the job-row schema in S2); S4 and S7 both depend on the Paperclip issue contract (freeze the draft/verdict schema in `shared/schemas` first).

## Implementation Tasks

Synthesized from this review's findings. Each task derives from a specific finding above. Run with Claude Code or Codex; checkbox as you ship.

- [ ] **E3-T1 (P1, human: ~1d / CC: ~30min)** — spike — Week-2 spike: run Orbi and Scout through Paperclip `hermes_local` at pinned versions; confirm profile selection, toolset allowlist, memory off, and a per-issue session setting
  - Surfaced by: S1 (D3), S5 (D7), Section 1 record 6
  - Files: template/paperclip, template/hermes (to be determined)
  - Verify: a Scout run posts a JSON draft comment on a Paperclip issue; a second issue starts an empty session
- [ ] **E3-T2 (P1, human: ~4h / CC: ~20min)** — template — Separate Paperclip+Hermes container with no Gmail/Resend secrets, paperclip DB login only, read-only FS except data dirs; toolsets Scout = web search/fetch, Orbi = issue tools
  - Surfaced by: S2 (D4)
  - Files: template compose, ops/posture (to be determined)
  - Verify: the posture check fails when a Gmail secret or a terminal toolset is added to that container
- [ ] **E3-T3 (P1, human: ~4h / CC: ~20min)** — frontdesk — Paperclip bridge: create issues (Scout for leads, Orbi for unclear), 15 s poll, shared Zod schemas, one corrective comment, 10-min timeout → Orbi + digest
  - Surfaced by: S3 (D5), S6 (D8)
  - Files: frontdesk/, shared/schemas (to be determined)
  - Verify: malformed-draft, timeout and Orbi-verdict tests pass; an unsure lead gets a draft and no ack
- [ ] **E3-T4 (P1, human: ~4h / CC: ~20min)** — worker — Postgres job rows as the source of truth plus a reconciler at start and every minute
  - Surfaced by: A1 (D9)
  - Files: worker/, db/ (to be determined)
  - Verify: flush Redis mid-draft; the lead still reaches the confirm page
- [ ] **E3-T5 (P2, human: ~3h / CC: ~15min)** — worker — Nightly purge of Hermes session files older than 90 days (retention_policies raw-email row); DEC-2 wipes Hermes volumes
  - Surfaced by: S4 (D6)
  - Files: worker/retention, ops/decommission (to be determined)
  - Verify: a 91-day-old session file is deleted; a 1-day-old one stays
- [ ] **E3-T6 (P2, human: ~2h / CC: ~10min)** — tests — Static test across the 4 ORBIT programs: only the Front Desk service holds Gmail send scope; the API only writes decisions
  - Surfaced by: Section 1 record 2 (SEC-2 + D2)
  - Files: tests/static (to be determined)
  - Verify: adding a Gmail send import to web/ or api/ fails CI
- [ ] **E3-T7 (P2, human: ~2h / CC: ~15min)** — ops — Provisioning script creates the Paperclip company, hires Orbi and Scout via the service account (AUTH-8), sets budgets, heartbeats off, Friday routine
  - Surfaced by: Section 1 record 3
  - Files: ops/provision (to be determined)
  - Verify: a fresh instance shows two agents, no timer heartbeats, one routine
- [ ] **E3-T8 (P2, human: ~1h / CC: ~10min)** — docs — Write PRD v6.1: restore Paperclip + Hermes (v5.1 §6/§7 with the D3 adapter), 4 programs + Redis, Orbi + Scout, the S2–S6 and A1 rules; move the restored items out of v6.0 §21; resolve N-2 and N-11; update Appendix B
  - Surfaced by: target statement ("output feeds PRD v6.1")
  - Files: ORBIT_OS_PRD_v6_1.md
  - Verify: no "deferred until needed" for Paperclip/Hermes remains; the §22 list drops N-2 and N-11
- [ ] **E3-T9 (P3, human: ~2h / CC: ~10min)** — infra — Switch to `hermes_gateway` after the upstream fix (TODOS.md)
  - Surfaced by: TODO-1 (D10)
  - Files: TODOS.md, template (to be determined)
  - Verify: the staging golden thread passes on the gateway adapter

_No new tasks from Code Quality or Performance._

## Unresolved decisions
None.

## Completion summary
- Step 0: Scope Challenge — scope accepted as-is (6 findings, S1–S6, all approved)
- Architecture Review: 1 issue found (A1, approved) plus 5 records
- Code Quality Review: 0 issues found
- Test Review: diagram produced, 17 gaps identified (all required proof of approved behavior)
- Performance Review: 0 issues found (3 records)
- NOT in scope: written
- What already exists: written
- TODOS.md updates: 1 item proposed to user (added)
- Failure modes: 0 critical gaps flagged
- Unresolved decisions: 0 in this review
- Outside voice: codex, unavailable (not installed; native fallback tools not declared)
- Parallelization: 7 steps in 2 initial lanes, then 3 parallel lanes
- Lake Score: 5/5 = 10/10 choices / answered coverage choices (D4, D6, D7, D9 and D10 took the complete option)

## Suppressed findings (appendix)
None below confidence 5.

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|--------|---------|-----|------|--------|----------|
| CEO Review | `/plan-ceo-review` | Scope & strategy | 1 | CLEAR (logged pre-git, branch unknown) | mode: SCOPE_REDUCTION, 0 critical gaps |
| Outside Review | `codex` (auto) | Independent 2nd opinion | 4 | unavailable | Codex not installed; no completed external review |
| Eng Review | `/plan-eng-review` | Architecture & tests (required) | 3 | ISSUES OPEN | 18 issues, 0 critical gaps (all approved or mapped to tasks) |
| Design Review | `/plan-design-review` | UI/UX gaps | 1 | CLEAR (logged pre-git, branch unknown) | score: 4/10 → 8.5/10, 14 decisions |
| DX Review | `/plan-devex-review` | Developer experience gaps | 0 | — | — |

- **OUTSIDE COVERAGE:** codex, plan-review phase, unavailable in this run (CLI not installed; native fallback not available); 0 outside findings.
- **VERDICT:** CEO + DESIGN CLEARED. Eng review v3 is complete with 0 unresolved decisions and 0 critical gaps. It shows ISSUES OPEN because its findings became build tasks (E3-T1 to E3-T9); eng review required.

NO UNRESOLVED DECISIONS
