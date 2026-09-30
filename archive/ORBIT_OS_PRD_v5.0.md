
## Anexure

### A1. Clarification: Approved outbound communication (MVP)
For avoidance of ambiguity in implementation:
- “No outbound message without approval” in this PRD is interpreted as:
  - no outbound **customer communication** is sent unless approved by a member holding authority for that message category at decision time.
- System and operational messages (for example internal health notices) are out of this scope unless they are customer-facing business communications.

### A2. Approval ID semantics (implementation guardrail)
The existing “approval ID” requirement is retained. This annexure clarifies expected behavior:
- Approval ID should be treated as:
  - single-use,
  - time-bounded (expiry),
  - bound to context (workspace, task/issue, channel/thread, recipient set, approved final text).
- Any edited final text should require a new approval decision and a new approval ID.
- Sender should mark approval ID usage atomically with send-attempt recording to prevent replay sends.

### A3. Idempotency and duplicate protection (recommended)
To preserve trust and prevent duplicates, implement idempotency keys for:
- inbound email ingestion,
- Paperclip task creation,
- approval request creation,
- Telegram decision callback handling,
- outbound send execution,
- ledger sync ingestion.

Recommended behavior:
- retries must be safe,
- duplicate events must not produce duplicate sends,
- unknown send states must be reconciled before re-send.

### A4. Reconciliation loop (recommended)
Add background reconciliation jobs:
- ORBIT ↔ Paperclip task/approval state reconciliation,
- outbound provider delivery reconciliation,
- policy-rules render version reconciliation (DB version vs rendered profile context).

Any irreconcilable state should:
- raise operator incident visibility in fleet console,
- preserve auditability,
- avoid silent auto-send behavior.

### A5. MCP catalog and connection policy (additive, no conflict)
Current PRD already defines connections and MCP direction. This annexure makes it explicit:
- ORBIT maintains a curated MCP catalog per product policy.
- Customer instances activate from approved catalog entries (MVP).
- Tool exposure is role/profile scoped (least privilege), never global.
- Write-capable MCP actions require explicit policy and audit.
- Front Desk remains deterministic; adding MCPs must not bypass approval path.

### A6. Runtime adapter consistency note
PRD sections already position Hermes gateway architecture. This annexure clarifies:
- Customer-instance production path standard is `hermes_gateway` for Coordinator/Specialist.
- Any local adapter use is development-only and not a customer runtime contract.

### A7. Canonical truth mapping (operational clarity)
To reduce future ambiguity:
- ORBIT Postgres is canonical for:
  - authority decisions,
  - approvals,
  - receipts,
  - customer-visible audit record.
- Paperclip is canonical for:
  - live orchestration/task runtime state.
- Hermes profile memory is operational working state (cache-like), not business audit truth.
- Provider metadata + ORBIT receipt together form outbound delivery evidence.

### A8. Annexure status
This Anexure is additive guidance aligned with v5.0 intent and does not replace or invalidate any existing requirement text.
