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

## The prototype's Agent map and Performance screens

**Open, not parked. Awaiting the founder.** Two prototype screens have no feature
ID in PRD v9.0 section 15.6:

- **Agent map** (#/map): a person picker with one node per teammate and curved SVG
  connectors coloured by status. Nearest PRD screen is /org/chart (A-03), which is
  a reporting-lines editor rather than a per-person activity map.
- **Performance** (#/performance): a sortable table with 7-day sparklines, a
  success and edited-by-people percentage, and a needs-attention rule. Nearest PRD
  screens are /results (A-52) and the Super Admin /quality (S-33), neither of
  which is a per-teammate performance table on the Org Admin side.

They are either dropped, folded into /org/chart and /results, or added to the
inventory as new features. Reported rather than resolved, per PRD Appendix C
item 9.
