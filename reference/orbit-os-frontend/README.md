# ORBIT-OS frontend (3 dashboards, shared assets)

Frontend only. All data is mocked in `assets/api.js` + localStorage, so the screens work today and the backend can be swapped in later.

## Run it
```
cd orbit-os-frontend
python3 -m http.server 8080
```
Open `http://localhost:8080/org-admin/`, `/user/` or `/fleet/`. (Use a local server, not double-click: the three dashboards share data through the browser's storage for one address.)
Deploy: upload the whole folder as static files (Coolify static site, Netlify, Cloudflare Pages).
Single-file demo of all roles: `python3 build-preview.py` -> `dist/preview.html`.

## Folder map
```
assets/   tokens.css base.css components.css   design system (Inter)
          config.js store.js ui.js router.js    core
          api.js                                 mock API  <- the only file to replace with real calls
          shell.js                               sidebar, top bar, dev tools
          data/  people jobs tasks mcps org fleet   seed + catalogs
user/       index.html app.js screens/ home new activity
org-admin/  index.html app.js screens/ setup onboarding requests dashboard map performance
fleet/      index.html app.js screens/ fleet office provision      (Super Admin)
```
Each role has its own `index.html` that loads only its screens. `window.ORBIT_ROLE` in each file fixes the role.

## Org Admin onboarding (the order matters)
1. **Org structure**: departments, people, access (User / Org Admin), authority (Leader / Approver / Budget holder). Needs >= 1 department, >= 1 Leader (the board), >= 1 Org Admin.
2. **Agents**: exactly one Coordinator at the top, specialists below. Strict tree: one manager each, no loops. Hire from templates or create custom (instructions, tools, monthly budget). Front Desk is built in and is not an agent.
3. **Assign**: every agent gets one owner (auto-assign by department available).
4. **Connect tools (MCP)**: required tools are derived from the agents' tools. Connect each, or "connect later" (those agents start paused and resume when connected).
5. **Launch**: a resumable hiring job (7 steps). A failed step shows Retry and resumes from that step.

## Backbone mapping (operator-visible only; customers never see these names)
| Customer sees | ORBIT stores | Runtime |
|---|---|---|
| Office | workspace + org record | one Paperclip company per workspace |
| Org chart, board | departments, people, authorities | agents form a tree, one manager each; Leaders are the board |
| Agent | agent row (prompt, tools, budget, owner, versions) | Paperclip agent + one Hermes profile through the `hermes_gateway` adapter |
| Owner | `ownerId` (ORBIT only) | not in the runtime |
| Instructions + guardrails | versioned in ORBIT; guardrails outrank instructions | rendered into the profile's stable prompt tier |
| Monthly budget | budget | Paperclip budget (auto-pause) |
| Tools | connection + mode, tokens held by ORBIT | per-agent allowlist at the policy gateway |
| Request -> approve | request row + decision + audit | creates the agent on approval |

## API contract (what `api.js` mocks)
| Function | Endpoint |
|---|---|
| saveOrg / people / departments | `POST/PUT /api/org/structure` |
| createAgent / removeAgent | `POST /api/agents`, `DELETE /api/agents/:id` |
| assign | `PUT /api/agents/:id/owner` |
| connect / disconnect | `POST /api/connections`, `DELETE /api/connections/:tool` |
| startLaunch / retryJob | `POST /api/org/launch`, `POST /api/org/launch/retry`, `GET /api/org/launch/status` |
| submitRequest / decide | `POST /api/requests`, `POST /api/requests/:id/decision` |
| savePrompt / togglePause | `PUT /api/agents/:id` |
| tick (live status) | websocket or SSE `agents.status` |

## Test script (5 minutes)
1. Open `/org-admin/`. Pick the Services template, add a Leader, continue.
2. Hire Atlas (Coordinator), Scout, Ledger. Try adding a second Coordinator: blocked.
3. Auto-assign, connect the required tools, tick "simulate a failure", launch, then Retry.
4. Open `/user/` (dev tools: sign in as a user). See "x of y running", edit instructions, request an agent.
5. Back in `/org-admin/`: Requests -> review, add a guardrail, approve. Check Agent map and Performance.
6. Open `/fleet/`: see the office, its runtime mapping, and provision a new office.
Dev tools (bottom of every page) load a full demo office or restart onboarding.

## Assumptions to confirm
- User edits to instructions apply immediately inside guardrails (with history and restore).
- "Success" = run finished with no error or rejected result; "edited by people" = share of drafts changed before approval.
- Tools shown as "Coming soon" cannot be assigned to agents.
