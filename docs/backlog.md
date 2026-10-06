# Backlog

Parked on purpose, with the reason, so none of it comes back by accident or is
lost by accident.

## The prototype's nine AI teammate roles

**Parked 2026-10-06.** PRD v9.0 Appendix A.1 ships five hireable roles plus Orbi
as the only Coordinator. The prototype at reference/orbit-os-frontend/ seeds nine
roles instead, and they are not carried over.

| Prototype role | Note |
|---|---|
| Atlas | the prototype's Coordinator. Replaced by Orbi, which is the PRD name |
| Scout | sales research and drafting. Nearest shipping role: Sales Analyst |
| Echo | nearest shipping role: Support Triager |
| Ledger | nearest shipping role: Finance Clerk |
| Compass | no counterpart in Appendix A.1 |
| Beacon | no counterpart in Appendix A.1 |
| Pulse | no counterpart in Appendix A.1 |
| Quill | no counterpart in Appendix A.1 |
| Relay | no counterpart in Appendix A.1 |

**Why parked rather than deleted:** their names, one-line jobs, tool lists,
budgets and prompts are a real piece of product thinking, and open decision 3,
whether customers may describe their own roles, is still open. If it is answered
yes, this list is a starting point.

**Where the detail lives:** reference/orbit-os-frontend/assets/data/jobs.js,
which is read-only reference material and stays in the repo.

**What would bring them back:** a change to Appendix A.1, which is a PRD version
bump. Nothing else.

## The prototype's extra connectors

**Parked 2026-10-06.** Appendix A.2 is the catalog. Not carried over from the
prototype's seed data: QuickBooks Online, Intercom and Salesforce. Also named in
v8.0 prose but absent from A.2: Ramp, Xero, ADP and LinkedIn.

Anything outside A.2 goes through the custom-connector route (C-07) once CD-1 is
answered. CD-4 may change the catalog itself.

## The prototype's Agent map and Performance screens - RESOLVED 2026-10-06

Both are settled. Neither is parked.

- **Agent map** (#/map) is **folded into /teammates** as columns: status, what each
  teammate is doing right now, who it reports to, owner, cost today, and a filter
  by person. No new screen and no new feature ID, because it was a second view of
  data that list already holds. The curved SVG connectors are not carried over:
  section 15.2 requires plain lists.
- **Performance** (#/performance) becomes **A-45**, a per-teammate tab on
  /results, marked Fill later in section 15.8. It keeps the substance: runs over 7
  days with a trend, success rate, average time, how often people edited the work,
  cost over 7 days and cost per run, sortable, with a needs-attention mark below
  90% success or at or above 40% edited.

The feature register moves to Org Admin 45 and 111 in total. The screen count
stays at 52, because A-45 is a tab rather than a screen.

## The prototype's org-chart visuals: connectors and drag-and-drop

**Parked 2026-10-06.** Two interactions from the prototype's org views do not
survive PRD section 15.2, which requires plain lists and bans card grids.

- **Curved SVG connectors.** The prototype drew reporting lines as curved
  connectors coloured by status, with a dashed variant for idle, paused and draft.
- **Drag-and-drop canvas.** A-03 in the prototype let you drag people and
  teammates into place to set who reports to whom.

`/org/chart` instead renders an **indented list at every width** with a side panel
that sets the selected node's manager. Section 15.6 already specified the indented
list below 768 px; it now applies at every width.

**What carries over is the behaviour, not the interaction:** exactly one
Coordinator, one manager each, no loops, maximum depth three, and a refused change
saying which rule it broke. That validation is the valuable part and it lives in
`contract/v1`.

**What would bring either back:** a section 15.2 change, which is a PRD version
bump.
