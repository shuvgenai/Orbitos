# PRODUCT REQUIREMENTS DOCUMENT
ORBIT-OS: The AI Office for Small Businesses
Dedicated Instance per Customer, Run by OrbitumAI
Product Version: 1.0 MVP
Document Version: 5.1 (supersedes v5.0; adds the Decision Layer with Jev as primary decision model, confirms Paperclip + Hermes + Postgres + Anthropic, see §6, §7, §8A, §14A)
Date: September 28, 2026
Prepared by: OrbitumAI | Product Owner: Shuv Chowdhury
Companions: Architecture Document v2.0 (Decision Layer addendum pending) · User and System Stories v2.0 · Vision v2.1 · Architecture Review: Quality and LLM Cost v2

## Table of Contents
1. Executive Summary
2. What Changed from v3.0
3. Goals, Non-Goals and Success Metrics
4. Users, Roles and Authorities
5. Deployment Model: One Instance per Customer
6. System Architecture Overview
7. Technology Stack
8. Feature Requirements — Customer App
8A. Feature Requirements — Front Desk Service
9. Feature Requirements — Fleet Console (OrbitumAI)
10. Requirements — Provisioning, Upgrade, Backup, Decommission
11. Requirements — Connections
12. Requirements — Approvals and Human Authority
13. Requirements — Budgets and Cost
14. Requirements — Learning Loop
14A. Requirements — Data Architecture and Retention
15. UX and Layout Requirements
16. Security and Compliance
17. Non-Functional Requirements
18. Rollout Plan
19. Open Decisions
20. Appendix A — Super Admin System Settings (from v3.0), reduced scope

## 1. Executive Summary
ORBIT-OS gives a small business an AI office: a Coordinator, one or more Specialists and a Front Desk, arranged in an org chart, led by the business's human Leader. The Org Admin sets it up in ten minutes. Approvers sign off outbound work from their phones. Every action has a receipt with what, why, who approved and cost. The office learns from approved rules.

Each customer runs on a dedicated ORBIT-OS instance — its own app, database, Front Desk service, Paperclip and Hermes gateway — on its own host under the customer's domain, provisioned and operated by OrbitumAI from a fleet console. There is no shared platform, no public self-signup and no cross-customer data path.

Launch target: customer zero (OrbitumAI) in October 2026; five to ten managed pilot instances by December 2026.

## 2. What Changed from v3.0
Change in v5.1 (Sept 28, 2026): adds the Decision Layer (Jev primary, Haiku fallback), `decision_calls` table, hostile-input and gate rules (FD-2, FD-2a, FD-2b, DAT-9, SEC-10) and open decisions 9 to 11. Nothing else in v5.0 was changed.

| v3.0 | v4.0 |
|---|---|
| Scope: the Super Admin System Settings Dashboard | Scope: the whole product, customer app plus fleet console; the settings dashboard becomes Appendix A |
| Three-tier "Workflow Engine / Knowledge Core / Action Module" | AI office: Coordinator, Specialist, Front Desk; Paperclip and Hermes internal only; the Front Desk is ORBIT code and OpenClaw is not used |
| Single shared platform with roles Basic / Power / Workspace Admin / Super Admin | One instance per customer; roles User and Org Admin inside the instance; Super Admin only on the fleet console |
| Workflow builder, 7 templates, drag-and-drop canvas | Org-chart-first onboarding, starter teams, no canvas |
| Approvals by a single owner | Approvals routed by category to members with authority (Leader, Approver, Backup, Budget holder) |
| Jarvis assistant | Teammates named per office (working names Orbi, Scout, Relay) |
| 100+ integrations, Slack/Telegram/Discord/WhatsApp channels | Gmail, Telegram approvals, HubSpot; other channels per instance on demand |

## 3. Goals, Non-Goals and Success Metrics
Goals
- A qualified inbound lead receives a researched, on-brand draft delivered to the right approver within 15 minutes.
- A new customer goes from provisioning to a hired team with a connected inbox in under 25 minutes of OrbitumAI and customer time combined.
- No outbound message is ever sent without an approval record from a member holding authority for its category.
- An idle instance makes zero model calls; cost per lead is measured and shown.
- Draft quality improves measurably: share of drafts sent without edits rises week over week.
- Provisioning, upgrade, backup and restore are scripted; nothing is fixed by hand on one instance.

Non-Goals (MVP)
- Public self-signup; shared multi-tenant platform; workspace switching
- Drag-and-drop workflow canvas; template marketplace; public API; SDK; white-label
- WhatsApp, Slack delivery, Discord, voice, iMessage, browser automation (Phase 3 as Front Desk adapters; no third agent runtime is planned)
- Client-hosted instances (Enterprise tier, later, with a contract)
- Billing self-service (Phase 2)

Success metrics
| Stage | Metric | Target |
|---|---|---|
| Customer zero | Real lead to approved reply | Under 15 min, daily, two weeks |
| Pilots | Provisioning time | Under 15 min, no manual steps |
| Pilots | Org Admins completing a live run within 24 h | 50% |
| Pilots | Sends without approval record | 0 |
| Pilots | Edit rate trend | Falling over 4 weeks |
| Pilots | NPS | Above 40 |
| Fleet | Upgrade day rollbacks | 0 unplanned |

## 4. Users, Roles and Authorities
Access roles (per instance)
- User: sees Office home, tasks, receipts, team; adds internal notes; approves only if given authority.
- Org Admin: sets up and runs the office; hires the team; connects tools; manages members and routine approval plans; lowers or moves budgets; requests increases.
- Super Admin (OrbitumAI, fleet console only): provisions, upgrades, restores, pauses, overrides with a reason; support view with consent; never holds authority inside a customer instance.

Authorities (any member, independent of access role)
- Leader: the board; approves board-level drafts, rules, cost-raising hires, authority changes; receives the weekly review.
- Approver: approves routine and decline drafts in assigned categories.
- Backup approver: receives drafts after the escalation interval.
- Budget holder: approves budget increases; defaults to the Leader.

Personas: Maria (office manager, Org Admin, routine Approver); David (CEO, User with Leader and Budget holder authority); Jordan (staff, User); Shuv (Super Admin on the fleet; every role inside OrbitumAI's own instance).

## 5. Deployment Model: One Instance per Customer
Requirements
- DEP-1 Every customer runs a complete, separate instance: web app, API, worker, Front Desk service, Postgres, Redis, Paperclip (with its own database) and Hermes gateway. No process, database, key or host is shared between customers.
- DEP-2 Each instance serves one workspace on one domain (`assistant.<customer-domain>`) via a customer-added CNAME; TLS is automatic.
- DEP-3 Instances are rendered from one versioned template in Git; the only per-instance differences are environment values and secrets.
- DEP-4 OrbitumAI operates every instance; customers never access hosts, containers or engine UIs.
- DEP-5 Engine UIs (Paperclip, Hermes) are reachable only over OrbitumAI's tailnet.
- DEP-6 The schema keeps `workspace_id` with a single workspace per instance; no row-level security or tenant filtering is implemented.
- DEP-7 Client-hosted instances use the same template and are offered only as an Enterprise tier with a contract.

## 6. System Architecture Overview
Per instance
- ORBIT app (customer-facing) and API: org chart, authorities, approvals, receipts, rules, connections, operator endpoints.
- Worker: hiring jobs, ledger sync from Paperclip, weekly review data, evaluations, connection refresh, escalation timers.
- Front Desk service (ORBIT code): inbox trigger (IMAP polling or Gmail push), lead filter (rules first, one Decision Layer call second), task creation in Paperclip, Telegram approval bot with inline buttons per approver, send-with-approval-ID. It is not an agent and has no exec, file or browser code paths. New channels are adapters to this service (§8A).
- Paperclip: one company per instance; teammates as agents; tasks; budgets with 80% warning and 100% pause; interactions with human-only confirmation; routines (weekly review only); watchdogs; cost ledger; activity log.
- Hermes gateway: one multiplexed gateway; one profile per Coordinator and Specialist under `/p/<profile>/` with its own key; connected through Paperclip's `hermes_gateway` adapter on loopback; toolsets and turn caps per agent; cron disabled.

Fleet (OrbitumAI, deployed once)
- Fleet console: instance registry, provisioning, upgrade orchestration, health, backups, posture checks, support view with consent, audit of operator actions.
- Staging instance on next pinned versions.

- Decision Layer (ORBIT code, `src/decisions`): a provider-agnostic interface (`DecisionProvider` with `choice()`, `score()`, `noul()`) used by the Front Desk and the model router. Primary provider is Jev (TypeSafe AI's typed-decision model: returns a Choice, Score or Noul answer with calibrated probabilities instead of text); fallback provider is Claude Haiku 4.5 with a JSON schema. Jev never drafts text, never converses and never authorizes a send.

Communication: Paperclip wakes teammates on assignment, mention, unblock and approval; ORBIT's Front Desk service creates tasks and delivers drafts; ORBIT issues approval IDs; the send path validates the ID. Model calls never come from ORBIT app code except Decision Layer calls (Front Desk lead filter, approval-category gate, model routing) and offline evaluation. Decision Layer output is a signal only: the approval ID remains the sole authority to send.

## 7. Technology Stack
| Layer | Choice |
|---|---|
| Web app | React 18, TypeScript, Vite, Tailwind, shadcn/ui, Inter, React Router, TanStack Query, @xyflow/react |
| API | Node 20 LTS, Express, TypeScript, Prisma, Zod, session auth with TOTP 2FA, helmet, rate limiting |
| Worker | Bull on Redis |
| Data | PostgreSQL 16 with pgvector; Redis 7 |
| Office manager | Paperclip, pinned release, own Postgres |
| Thinkers | Hermes Agent, pinned release, multiplexed gateway, `hermes_gateway` adapter |
| Front Desk | ORBIT service (Node); IMAP or Gmail push; Gmail API for send; Telegram Bot API |
| Decision model | Jev (TypeSafe AI, typed Choice/Score/Noul decisions with probabilities) behind the `DecisionProvider` interface; one provider account per instance (TypeSafe direct or AI/ML API, decision 9 in §19); Claude Haiku 4.5 as fallback |
| Models | Claude Sonnet 5 (Coordinator, Specialists), Claude Haiku 4.5 (Decision Layer fallback and simple-task routing), Claude Opus 5 (offline evaluation only); OpenRouter fallback |
| Connections | Official hosted MCPs (Gmail, Calendar, Drive, HubSpot, Slack, Stripe, Notion) behind an ORBIT policy gateway; OAuth per provider |
| Hosting | Coolify on Hostinger; one Coolify project or small VPS per instance |
| Fleet tooling | Provisioning script, registry, upgrade runbook, nightly backups to off-host storage, Tailscale |
| Observability | pino logs, health endpoints, Coolify metrics, decision ledger |

## 8. Feature Requirements — Customer App
8.1 Access
- APP-1 First account created only by accepting OrbitumAI's invitation (7-day, single use). Public signup returns 404.
- APP-2 Login, password reset (1-hour single-use link), invitation acceptance, sessions with 12-hour idle timeout, "Sign out everywhere", optional TOTP 2FA (mandatory for Org Admins before general availability).
- APP-3 Routing after login: User → Office home; Org Admin → onboarding until the team is hired and the inbox is connected, then Office home.

8.2 Onboarding (Org Admin)
- ONB-1 Step 1: business name, what you sell, ideal customer (each under 200 characters); "Your role"; "Who leads the business?" with "Me" or name and email of the Leader (invitation sent immediately).
- ONB-2 Step 2: starter team picker with "Lead response office" preselected; job descriptions filled with business details.
- ONB-3 Step 3: org chart editor — rename, drag to change reporting line, add or remove teammates, edit can/cannot lists, budget slider; indented list below 768 px.
- ONB-4 Step 4: review roles, total budget against plan, default approval plan, validation errors; "Hire my team" enabled only when valid.
- ONB-5 Step 5: connect Gmail; each approver links their own Telegram; "Send a test lead" (routine or pricing) routes to the approver the plan names and sends only to that approver's address.
- ONB-6 Drafts touch only the instance database; no engine or model calls before hiring.
- ONB-7 Validation: exactly one Coordinator at the top; every other teammate has one manager; no loops; max depth 3; at least one Front Desk; Front Desk cannot-list always includes "send without approval"; budgets within company budget and plan limit; unique names.

8.3 Hiring
- HIR-1 Bull job: create Paperclip company with budget and goal; hire Coordinator, then Specialists (Hermes profiles created), then Front Desk; set budgets; no scheduled heartbeats except the Friday routine; save IDs.
- HIR-2 Progress screen per teammate; failure shows a plain message and retries from the failed teammate; idempotent steps.

8.4 Office home, tasks, receipts, team
- HOME-1 Counts for received, sent, waiting, skipped; activity feed newest first; teammate status strip; refresh within 1 minute.
- TASK-1 Task list with filters (status, teammate, date) and search (sender, company, email); task story in plain language with timeline, draft, final text, approver; no engine names or raw transcripts.
- RCPT-1 One receipt per sent message: recipient, draft and final text side by side, reason, category, approver, time, cost; CSV export.
- TEAM-1 Read-only org chart for Users; edit for Org Admins; each card shows title, job, can and cannot lists, status.
- NOTE-1 Internal notes on tasks, visible to members only.

8.5 Waiting for you and approvals
- WAIT-1 Approvers see items in their categories and escalations to them; Org Admins see everything waiting and for whom, acting only on their own categories; first valid decision wins; items past escalation time highlighted.
- WAIT-2 Telegram message per draft: lead, fit, one-line reason, category label, draft, buttons Send / Edit / Skip; Edit accepts replacement text; Skip takes an optional reason; "Ask the leader" on routine drafts.
- WAIT-3 Every decision recorded with the authority used; the send path refuses text without a valid approval ID.

8.6 Reviews, rules, budgets, members, settings
- REV-1 Weekly review delivered Friday in-app and by email to Leaders and Org Admins; one recommendation as a request routed to the member with the needed authority.
- RULE-1 Proposed rules show examples; Org Admin may edit wording; a Leader approves or retires; rules apply from the next task; eval gate runs before activation.
- BUD-1 Company and per-teammate budgets with spend to date; 80% warning; 100% pause; Org Admin lowers or moves budget within the total; increases go to the Budget holder, approvable from Telegram.
- PAUSE-1 "Pause office" for Org Admins and Leaders; no teammate runs and nothing is sent until resumed; waiting items stay waiting.
- MEM-1 Invite as User or Org Admin with optional authorities and dates; resend or revoke; removal ends sessions and moves pending approvals to backups; at least one Org Admin and one Leader must remain.
- CONN-1 Connections screen: inbox and Telegram status per approver, reconnect, disconnect (pauses the Front Desk with a banner).
- DATA-1 Export receipts, tasks and rules as a ZIP of CSV files; deletion requires a Leader's confirmation and completes within 30 days (see 10.4).

## 8A. Feature Requirements — Front Desk Service
- FD-1 Inbox adapter: fetch new mail; strip signatures and quoted history; drop receipts, newsletters, calendar notifications, 2FA codes, password resets and configured senders by rule before any model call.
- FD-2 Lead filter (Decision Layer): exactly one Jev Choice question per candidate email (`lead | not_lead | unsure`) with probabilities; below the confidence threshold (default 0.7) or on `unsure` the email becomes a task for the Coordinator, never for a Specialist; on Jev error, timeout, 429 or 529 after bounded backoff the Haiku fallback answers the same question; every call is logged to `decision_calls` and the ledger; a per-instance daily spend cap applies.
- FD-2a Hostile input: email bodies are treated as adversarial; Jev can be moved by text written to steer its answer, so it never replaces the deterministic rules and checks (FD-1 filters before, FD-4 category checks after). Bodies are stripped and truncated to fit Jev's 32K text-only context.
- FD-2b Decision gates: Jev may raise an approval category or route a task to a stronger model tier, never lower a category and never bypass an approval. Static tests assert no decision output reaches the sender.
- FD-3 Task bridge: create the Paperclip task assigned to the Specialist with sender, subject, cleaned body and the company goal; watch the task for the Specialist's structured comment; validate the format, allow one retry, then mark blocked for the Coordinator.
- FD-4 Approval courier: compute the category from the Specialist's flags and deterministic checks (a model may raise, never lower); route to the members named by the approval plan; deliver Telegram messages with inline Send / Edit / Skip; accept edit text; run escalation timers; record the decision with the authority used; issue a single-use approval ID.
- FD-5 Sender: send exactly the approved text in the original thread via the Gmail API only when presented with a valid unused approval ID; post the final text to the task; close the task; write the receipt event.
- FD-6 No code path from message content to exec, file or browser operations; an automated test asserts no path reaches the sender without an approval ID.
- FD-7 Channels are adapters: adding Slack or WhatsApp later means a new inbound adapter and a new courier target, not a new runtime.

## 9. Feature Requirements — Fleet Console (OrbitumAI)
- FLT-1 Registry table: customer, domain, host, plan, pinned versions, last backup, health, team status, connections, incidents, waiting approvals older than 24 h, month-to-date spend. Counts and status only; never customer content.
- FLT-2 Provision (see 10.1), upgrade (10.2), restore (10.3), decommission (10.4), pause instance, pause all.
- FLT-3 Retry failed hires; override a teammate's model, turn cap or budget with a reason shown to the Org Admin as "Changed by OrbitumAI support".
- FLT-4 Starter teams and role templates: create, version, retire; usage counts.
- FLT-5 Skills review queue: new or changed Hermes skills with source tasks and diff; approve or reject.
- FLT-6 Cost analytics across instances: cost per task by teammate, cached-input share, idle spend alerts, top instances by spend, 7 and 30 day views.
- FLT-7 Security posture report per instance after every provision and upgrade: no public engine ports, Hermes toolsets within allowed lists (no terminal, browser, file-write or delegation on tenant profiles), cron off on tenant profiles, Front Desk static check passes, versions match template.
- FLT-8 Support view: read-only view of an instance, only with an Org Admin's or Leader's recorded consent or an open support request; banner shown; every page view logged on that instance.
- FLT-9 Evaluation gate management: golden sets, on-demand runs, block instruction or model changes that regress more than 2 points.
- FLT-10 Access: OrbitumAI accounts only, TOTP 2FA, reachable only over Tailscale; every action audited on the affected instance.

## 10. Requirements — Provisioning, Upgrade, Backup, Decommission
10.1 Provisioning
- PRV-1 Inputs: customer name, domain, plan. Output: a running instance registered in the fleet, posture check passed, first Org Admin invitation sent. Target under 15 minutes, zero manual steps.
- PRV-2 Steps: render template with generated secrets and pinned versions → create Coolify project → start stack on private networks → health checks → seed schema (single workspace, starter org chart) → wait for CNAME, issue TLS → posture check → register → invite.
- PRV-3 Any step failure stops the job, shows the step, and allows retry; partial instances can be torn down in one action.

10.2 Upgrade
- UPG-1 Version changes are pull requests to the template; staging instance runs them and must pass the golden thread.
- UPG-2 Upgrade runs instance by instance: maintenance notice to Org Admins → backup → apply → posture check → golden thread → done, or rollback within 10 minutes → result recorded in registry and instance audit log.
- UPG-3 One upgrade day per month; new instances per month capped to what one upgrade day can absorb.

10.3 Backup and restore
- BKP-1 Nightly per instance: ORBIT Postgres, Paperclip database, Hermes profile volumes; off-host storage; 30-day retention.
- BKP-2 Restore to the same or a new host; console verifies the last receipt and task match the backup; recovery target 4 hours.
- BKP-3 Monthly restore drill on one instance, recorded.

10.4 Decommission
- DEC-1 Requires the customer's written request and a Leader's in-app confirmation; export delivered first.
- DEC-2 Instance stopped; DNS and OAuth apps revoked; data deleted after 30 days; registry keeps only the fact and date of deletion.

## 11. Requirements — Connections
- CN-1 Connections belong to the business, not the person who connected them; connected accounts survive member removal.
- CN-2 MVP connectors: Gmail (trigger and send), Telegram (approvals, one pairing per approver), HubSpot (Phase 2 target; lead and reply logged on send).
- CN-3 ORBIT is the OAuth client; tokens are encrypted with a per-instance key and never reach agents, prompts or logs.
- CN-4 Where the customer is on Google Workspace, an internal OAuth app is created in the customer's Google Cloud project during managed setup, avoiding Google's verification and security assessment; otherwise IMAP with an app password is the trigger path until a shared app is verified.
- CN-5 Agents reach connectors only through an ORBIT policy gateway that injects tokens, enforces "must ask" and "never" rules, logs every call, and exposes only the tools each lane needs.
- CN-6 Official hosted MCPs are used where they exist; ORBIT builds its own small MCP servers only where none exists or an inbound trigger is required; community MCPs are not used for customer data.
- CN-7 Not supported: iMessage. WhatsApp requires an ORBIT-built Front Desk adapter plus Meta approval and is Phase 3.

## 12. Requirements — Approvals and Human Authority
- AUTH-1 Access roles and authorities stored separately; authority checked at the moment of decision; every decision records the authority used.
- AUTH-2 Categories: routine; decline or refer; board-level (price, fee, discount, contract terms, payment, more than one recipient, any commitment); office changes (rules, cost-raising hires, budget increases).
- AUTH-3 Category is the most sensitive of the Specialist's flags and deterministic checks (amounts, pricing and contract words, recipient count). A model may raise a category, never lower it.
- AUTH-4 Routing: routine and decline → primary approvers → backups after 2 hours → Leaders after 2 more; board-level → Leaders or active delegate only; after 24 hours unsent, Leaders and Org Admins reminded; the lead is never answered by default.
- AUTH-5 Granting Leader, Budget holder or board-level approval, or reducing a Leader's authority, creates a request that an existing Leader must confirm; an Org Admin's attempt creates a request, not a change.
- AUTH-6 Every instance keeps at least one Leader and one Org Admin; a pending Leader invitee counts, but board-level drafts are held until they accept.
- AUTH-7 Delegations have start and end; expiry and member removal move waiting items to backups.
- AUTH-8 Paperclip's board actions (hire confirmations, budget changes) are performed by ORBIT's service account only after the corresponding authorized decision is recorded in ORBIT; ORBIT's audit log names the human.

## 13. Requirements — Budgets and Cost
- COST-1 Plan limits map to Paperclip company and per-teammate budgets; 80% warning and 100% pause per teammate; pause affects only that teammate.
- COST-2 No scheduled heartbeats except the Coordinator's weekly routine; teammates wake on assignment, mention, unblock and approval.
- COST-3 Tool allowlists per lane; Specialist research capped (3 searches); turn caps (Coordinator 20, Specialist 30).
- COST-4 Stable prompt prefixes and one model per session to keep prompt caching effective; model switch only on provider failover.
- COST-5 Decision ledger records every model call with tier, tokens, cached tokens, cost, latency, verdict; receipts and cost analytics read from it.
- COST-6 Pricing: per AI teammate plus included AI budget, unlimited human viewers; Basic $99 (1 teammate), Professional $199 (3 teammates, $50 AI budget), Enterprise $499 (more teammates, client-hosted option); managed setup fee for early customers (open decision).

## 14. Requirements — Learning Loop
- LRN-1 Approver edits and skips are recorded with diffs and reasons.
- LRN-2 A weekly job proposes at most three rules per Specialist, each backed by at least three examples; Org Admin may edit wording; a Leader approves.
- LRN-3 Approved rules are rendered deterministically into the Specialist's context file and versioned; every later run records the rules version.
- LRN-4 Hermes-created skills are copied out for review; only approved skills stay on tenant profiles.
- LRN-5 Golden sets grow from real tasks; the evaluation gate runs on every instruction, rule-set or model change.
- LRN-6 Consent: per-customer opt-in before redacted ledger data is used to train OrbitumAI's own models; excluded on request.

## 14A. Requirements — Data Architecture and Retention
Three tiers, no data lake.
- DAT-1 Every meaningful action inside an instance appends a row to an append-only `events` table (task created, draft delivered, decision recorded, message sent, rule proposed or activated, budget changed, authority changed, hire completed, upgrade applied). Receipts, audit views, rollups and exports are projections of events, never separate sources of truth.
- DAT-2 `events`, `llm_calls` and `decision_calls` are partitioned by month.
- DAT-3 Retention is configuration in `retention_policies` and enforced by a nightly job: raw email bodies 90 days; redacted ledger and events 24 months; receipts and rules for the life of the customer; backups 30 days. Expired data is removed by partition drop or purge; no retention is hard-coded elsewhere.
- DAT-4 Fleet metrics: a nightly job in each instance computes the day's rollup (tasks, drafts, sent, edited, skipped, escalations, cost, cached-input share, idle model calls, versions, backup and health status) and pushes numbers only to a separate fleet metrics database behind the console. The console never stores drafts, emails, receipts or any customer text.
- DAT-5 Training corpus: only with the customer's recorded consent (with a consent version); redaction of names, emails, amounts and identifiers happens inside the instance before export; records carry instance id and consent version so a customer's contribution can be deleted on request; every export writes an audit entry on the instance.
- DAT-6 Data leaves an instance through exactly two paths: the DAT-4 rollup and the DAT-5 export. Customer exports (DATA-1) are delivered to the customer, not retained by OrbitumAI.
- DAT-7 Volumes and sizing: thousands of ledger rows per instance per month are expected; Postgres per instance is sufficient. A data lake or warehouse is out of scope until one of the following: analytics across several hundred instances, a dedicated data role querying raw data, or an enterprise customer requiring event export to their own warehouse. The event log is the feed for that future, so no rework is expected.
- DAT-9 `decision_calls` records each Decision Layer call: caller, provider (`typesafe-jev` or `haiku-fallback`), question type, redacted state, question, answer with probabilities, confidence, latency, cost, later `human_verdict` (agreed or overridden) and consent version. Human verdicts beside Jev's probabilities feed calibration checks and the consented SLM training corpus (DAT-5).
- DAT-8 Backups (§10.3) include the event log partitions; restore verification compares the last event and the last receipt.

## 15. UX and Layout Requirements
- Font Inter; primary color per the landing-page palette decision (§19); dark and light themes.
- Navigation: Users see Home, Tasks, Receipts, Team, Reviews, Profile, plus Waiting for you and Requests when they hold authority; Org Admins add Rules and Settings (Budget, Approvals, Connections, Members, Data).
- Mobile: bottom navigation under 768 px; Waiting for you reachable in one tap; org chart becomes an indented list.
- Banners: "Office paused", "Reconnect your inbox", "David hasn't joined yet", "Maintenance scheduled", "Viewing as support (read-only)".
- Empty states give direction; validation errors appear inline on the offending card as red badges.
- Customer-facing copy never mentions Paperclip, Hermes, adapters, heartbeats or tokens.
- Accessibility: visible focus, keyboard navigation, reduced motion respected.

## 16. Security and Compliance
- SEC-1 No engine reachable from the public internet on any instance; Paperclip and the Hermes gateway on loopback or private networks; operator access over Tailscale only.
- SEC-2 Lanes enforced by configuration: only the Front Desk service can send, and it is code; Specialists have no outbound channels, terminal, browser or delegation.
- SEC-3 Approval enforced outside the model: the send path validates an approval ID issued by ORBIT.
- SEC-4 Inbound filters drop 2FA codes, password resets and banking notices before any model call.
- SEC-5 Secrets in Paperclip secret references and encrypted connection tokens; never in prompts, logs or agent files; per-instance keys; rotation runbook.
- SEC-6 Posture check after every provision and upgrade; drift blocks the instance from being marked healthy.
- SEC-7 Audit: every operator action, authority change, decision and rule change is logged on the affected instance; Org Admins and Leaders can read it.
- SEC-8 Data export and deletion per instance as in §10.4; privacy policy and terms cover model-improvement consent.
- SEC-10 Decision Layer provider keys are encrypted per-instance connection secrets, never in logs, prompts or client code; calls go only from the server; Jev is treated as a signal and is always paired with deterministic checks.
- SEC-9 Passwords bcrypt cost 12, minimum 12 characters; login rate limit 5 per 15 minutes; TOTP 2FA available to all, required for OrbitumAI operators.

## 17. Non-Functional Requirements
| Attribute | Requirement |
|---|---|
| Responsiveness | Draft on Telegram within 15 minutes of email arrival, 90% of the time |
| Cost at rest | Zero model calls on an idle instance except the weekly routine |
| Provisioning | Under 15 minutes, no manual steps |
| Availability | Per instance; host failure affects one customer; 4-hour recovery target |
| Footprint | Roughly 2–4 GB RAM per instance; measured on customer zero before pilots |
| Upgrades | Monthly; staging first; automatic rollback within 10 minutes on golden-thread failure |
| Backups | Nightly, 30-day retention, monthly restore drill |
| Isolation | No shared process, database, key or host between customers |
| Data egress | Only nightly numeric rollups and consented redacted training exports leave an instance |
| Retention | Enforced nightly from configuration; expired partitions dropped |

## 18. Rollout Plan
| Week | Deliverable | Exit criterion |
|---|---|---|
| 1 | Private networking, key rotation, pinned versions, runbooks; ICP, brand voice, golden set v0 | No engine reachable publicly; posture check passes |
| 2 | Customer zero office: Paperclip company, Orbi and Scout on the Hermes gateway, Front Desk service (inbox trigger, Telegram approval, send with approval ID) | Day 14: one real lead from inbox to approved reply |
| 3 | Event log and monthly partitions; authorities, approval plans, routing, approval IDs; ledger sync; receipts as projections | Measured cost per lead; keep-or-replace decision on any blocking component |
| 4 | Template export; provisioning script; fleet registry; org chart model and onboarding drafts | Second instance provisioned in under 15 minutes |
| 5 | Hiring job; OrbitumAI office re-created through the app on a fresh instance; per-approver Telegram | Hiring retries from a failed step |
| 6 | Rules loop, weekly review, evaluation gate; budgets and pause | First approved rule changes drafts; regression blocks a bad change |
| 7 | First pilot instance with different Org Admin and Leader; second starter team; watchdog tuning | Pilot live on its own domain |
| 8 | Nightly rollup and retention jobs; fleet upgrade rehearsal across staging and two instances; restore drill; footprint measurement | Zero unplanned rollbacks; host sizing decided |
| 9–12 | Five to ten managed pilots with weekly calls | 50% complete a live run within 24 h; NPS > 40 |

## 19. Open Decisions
1. Pricing and the managed setup fee.
2. Landing page palette (built orange vs violet/fuchsia spec).
3. Google OAuth path for customers not on Google Workspace, and the cost of verifying a shared app.
4. Whether the fleet console is its own small app or a mode of the ORBIT codebase deployed once.
5. Escalation timings configurable per business, or fixed at 2 hours and 2 hours.
6. Interim Leader rule when the named Leader never joins.
7. The 30-day idle window before an unused instance is decommissioned.
8. Retention periods (90 days raw email, 24 months redacted ledger) to confirm against customer expectations and the privacy policy.
9. Jev provider: TypeSafe directly or AI/ML API (model `typesafe/jev`); note the separate Jev AI website says it is independently operated and not affiliated with TypeSafe, so credentials, endpoints and terms must not be mixed. Jev launched in early access on Sept 15, 2026, so the Haiku fallback stays until decision quality and uptime are measured on customer zero.
10. Approval channel: Telegram is specified throughout this document (§8, §11, §8A FD-4, §18), but the founder stated on Sept 17, 2026 that Telegram is not wanted in ORBIT-OS. Choose the replacement (in-app approvals, email links or both) before Front Desk session 2; Telegram references are left unchanged until then.
11. Agent runtime: Paperclip + Hermes confirmed on Sept 28, 2026 after weighing Mastra. Mitigation: pinned versions, adapters only, ORBIT-owned Postgres record; revisit at the first forced upstream break.

## 20. Appendix A — Super Admin System Settings (from v3.0), reduced scope
The v3.0 dashboard specified four tabs of engine configuration (gateway, workflow engine, knowledge core, action module). In v4.0 that configuration is generated per instance from the template and is not edited by hand. What remains as an operator screen inside the fleet console's instance detail:
- Read-only view of the instance's rendered configuration (engine endpoints on the private network, pinned versions, model per teammate, turn caps, toolsets, budgets) with secrets masked.
- "Test connection" for Paperclip, the Hermes gateway and the Front Desk service (inbox and Telegram), performing real health checks.
- Override panel for model, turn cap and budget per teammate, each requiring a reason and written to the instance audit log.
- Live JSON export of the rendered configuration, secrets redacted, for support tickets.
The v3.0 component (`system-settings-dashboard.tsx`) can be reused for this panel with the four tabs collapsed into one read-only section plus the override panel. Validation, masking and toast behavior from v3.0 §10–§11 still apply.

END OF DOCUMENT
Version 5.0 | September 16, 2026 | OrbitumAI
