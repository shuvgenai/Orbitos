# Standing Authority: the decision pack

**Answered on 2026-10-14: option C, with two amendments.** The ruling is the
2026-10-14 entry in `docs/decisions.md`, and that entry governs. This pack is
kept as the record of what was asked and what the three choices were. Every
present-tense sentence below describes the position before the ruling, including
the quotation from `docs/rules/engine.md`, which the same commit rewrote.

Open decision 2. Open since 2026-10-05 and marked blocking in
`docs/prd/ORBIT_OS_PRD_v9_0.md` section 18.3. This pack asks one question and
gives three answers to choose from. Two pages.

## 1. The question in one sentence

May an AI teammate say yes to an action on its own, inside limits a human
Leader set in advance, or must a human say yes to every action forever?

## 2. What changed

PRD v6.2 said an AI may never approve. That rule still stands today and is
recorded as standing at `docs/decisions.md:51`. PRD v9.0 section 12 asks to
reverse it in one narrow way: a Leader grants a named teammate the right to
decide inside a numeric limit, in one category, until an end date, with fixed
code doing the checking rather than the AI.

**What reversing it buys.** The product stops being a permission slip machine.
Today every action waits on a person, so an office with 200 small decisions a
day needs a person 200 times. Standing Authority is also one third of the only
thing competitors do not have. The other two parts are the Action Gateway and
the audit log.

**What reversing it costs.** It is the newest risk in the product and the
hardest to take back. Once an office has granted authority and seen it work,
withdrawing it reads as the product getting worse. It also widens what a single
mistake can do. A misunderstood job today produces a draft a person reads.
Under Standing Authority it could produce a sent action nobody read.

**One thing to know before reading the options.** `docs/rules/engine.md:65-69`
says enforcement is blocked and "Do not design it and do not build it".
Whichever letter you pick, that file and the 2026-10-05 entry at
`docs/decisions.md:46` both need editing, because as written they forbid the
design work options B and C require.

## 3. Three options

### A. No AI approval, ever

Standing Authority becomes delegation between people only. A Leader hands
approving power to a named person for a period.

- **For a customer:** every action still waits on a human. The office drafts,
  researches and prepares, and a person taps yes. Honest and simple to explain.
- **What code must enforce:** nothing new. The frozen path already does it.
  `shared/src/approvals.ts` holds the five states and the allowed moves,
  `api/src/confirm.ts:102` refuses anything not in `issued`, and
  `shared/src/approval-link.ts` makes each link signed, single use and expiring.
- **What it blocks:** nothing in the build. It is the cheapest option today.
- **What breaks if you reverse it later:** Appendix A.6 fixes three approval
  bases and says every receipt names exactly one, with no nullable and no other
  case. Choosing A means shipping a two-value basis, which is a change to
  Appendix A and so a PRD version bump, then a second change to the contract,
  the receipt shape and the audit log when you reverse. Receipts already written
  would carry a basis set that no longer matches.

### B. AI may approve inside hard limits, from day one

Section 12 as written. A Leader grants it. The grant names the teammate, the
category, a numeric limit and an end date. Fixed code enforces the limit. Every
use is recorded with the grant it relied on. A breach switches it off at once.
Appendix A.7 is never covered.

- **For a customer:** small routine decisions happen without them. They see
  every one afterwards in receipts, each naming the grant it relied on.
- **What code must enforce:** the full list in section 5 below.
- **What it blocks:** nothing, but it puts the authority check on the critical
  path of the Action Gateway, which is the piece that must not be rushed.
- **What breaks if you reverse it later:** grants exist in customer offices.
  Reversing means switching off something people rely on and explaining why.
  This is the worst of the three to undo.

### C. Option B, switched on only after Checkpoint B

Identical code to B, with one extra condition. No grant can be created until the
job-understanding test set passes at 90% or better. PRD section 17 already
defines that as Checkpoint B and already states it as the point before Standing
Authority may be switched on.

- **For a customer:** the same product as B, arriving later. Before the gate the
  screen stays read-only, which is what it already does today.
- **What code must enforce:** everything in B, plus one gate check that reads an
  attestation file, in the same shape the real-data gate already uses at
  `guards/standing-rules.test.ts:233`.
- **What it blocks:** nothing in the build. It blocks only the switch-on.
- **What breaks if you reverse it later:** nothing structural. Opening the gate
  early is one file edit you approve. Closing it again after grants exist costs
  the same as reversing B.

## 4. Recommendation

**C.**

**The strongest reason.** It is the only option where the shape is written once.
The contract keeps three approval bases, so Appendix A.6 never changes and no
receipt is ever rewritten. The grant reference exists in `contract/v1` from the
start, which matters because authority checks cannot be retrofitted, exactly as
finding H4 says at `docs/decisions.md:2637`. And no grant can exist until
something has measured whether the office understands jobs at all. Granting
authority to a system whose comprehension has never been measured is the real
risk, not the authority itself.

**The strongest counter-argument.** C costs the same to build as B and delivers
later. The code is identical, so you pay the full build now and get the
difference after Checkpoint B, which lands after the first pilots, which is when
it would win the deals. If you expect the gate to slip, C is B with a delay you
chose.

## 5. The enforcement contract, for C only

Each line is written so it can become a test. The guard column says where each
would live. None of these may be enforced by prompt text or by model output.

| # | Invariant | Guard |
| --- | --- | --- |
| 1 | Every receipt names exactly one of the three bases in Appendix A.6. No null, no other case. | `guards/appendix-a.test.ts` |
| 2 | No grant can be created while `docs/gates/checkpoint-b.md` is absent or names a score below 90%. The guard fails closed on a file it cannot read. | `guards/standing-rules.test.ts` |
| 3 | A grant is a closed record: teammate, category, numeric limit, end date, granting Leader. No free-text scope field exists in the type. | new `guards/authority.test.ts` |
| 4 | The never-covers list is the fixed Appendix A.7 list in code, not text written per grant. | `guards/appendix-a.test.ts` |
| 5 | The limit is checked by the gateway. No authority decision reads a value produced by an AI call. | the Action Gateway tests, written before its code per `docs/rules/engine.md:36` |
| 6 | Every use records the grant id and the granting person. An action that cannot write that record does not run. | the gateway tests and the audit log tests |
| 7 | One breach, or one use a person marks wrong, moves the grant to suspended. There is no automatic edge back to active. | new `guards/authority.test.ts`, modelled on `canTransition` in `shared/src/approvals.ts` |
| 8 | An AI caller can never create, widen or extend a grant. The attempt becomes a request for a human. | new `guards/authority.test.ts` |
| 9 | Identity and role arrive from the server on every operation, never from which HTML file the browser loaded. This is H4 and it goes in `contract/v1`. | `guards/contract-boundary.test.ts` and the contract tests |
| 10 | `/authority` stays read-only, and its flag stays an off switch on the route element, until grant creation ships. | the four existing tests recorded at `docs/decisions.md:1916` |

Invariant 5 carries the whole option. The AI proposes and the gateway decides.

## 6. What stays open after today

None of these has to be decided now.

- The default numbers: the amount cap, the count per day, and whether both are
  required or either alone is enough.
- Which categories are eligible. `shared/src/approvals.ts` has three today:
  `routine`, `decline_refer` and `board_level`. `board_level` is plainly out.
  Whether `decline_refer` is in is a later question.
- Whether Standing Authority covers connector calls, or only actions leaving the
  organization through the Action Gateway.
- The granting screen itself. It is Fill later and waits on this decision.
- The composition of the Checkpoint B test set, and whether 90% is the right
  number.
- Open decision 3, the role library, which is separate and unaffected.
