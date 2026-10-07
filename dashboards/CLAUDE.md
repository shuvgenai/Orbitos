# ORBIT-OS dashboards: rules for Claude Code

## What this folder is
ORBIT-OS gives each small business an AI office: a Coordinator plus specialist
teammates in a strict org chart, with people as the board. This folder is the
**frontend only** for three dashboards.

| Dashboard | Who | Entry file | Title |
|---|---|---|---|
| User | staff who own teammates | `dashboards/user/index.html` | must contain `Orbitcrew` |
| Org Admin | sets up and runs the office | `dashboards/org-admin/index.html` | must contain `Orbitcrew` |
| Fleet (Super Admin) | the OrbitumAI operator | `dashboards/fleet/index.html` | must contain `ORBIT-OS` |

The three titles are not a preference. `guards/design-naming.test.ts` fails CI on a
wrong one, because PRD section 15.3 says a customer never sees the words ORBIT-OS
and the fleet console is the only screen exempt.

## The authority order
Read these in this order, and when two disagree the earlier one wins.

1. `docs/prd/ORBIT_OS_PRD_v9_0.md` — the product. Sections 15.1 to 15.8 own the
   screens, the states, the words and the design rules. Appendix A owns every
   fixed list: roles, connectors, task states, authorities, budgets.
2. `DESIGN.md` and `design/tokens.css` — the design system.
3. `docs/superpowers/plans/2026-10-05-v8-seam-and-contract.md` and its addenda —
   how the work is ordered, and what was decided while building.
4. `ORBIT-OS_Claude_Code_Build_Prompts.md` — the phase-by-phase build order.
5. `reference/orbit-os-frontend/` — the prototype. **Behaviour and copy only.**

## The prototype is a behaviour spec, not a visual one
`reference/orbit-os-frontend/` is a working vanilla-JS prototype. Take its flows,
its copy and its screen behaviour. Take nothing else. PRD v9.0 overrides it on
every point below, and an implementer who copies how it looks reintroduces the
exact collision section 15.2 exists to prevent.

| The prototype has | v9.0 requires |
|---|---|
| its own token file, a brand purple and a pink accent | the frozen `design/` package only, six colours |
| KPI tiles, agent cards, a template gallery | plain lists. No card grid, no KPI tile, no gallery |
| nine teammate roles | the five in Appendix A.1, Orbi the only Coordinator |
| ten connectors | Appendix A.2, subject to open decision CD-4 |
| six task states, including `declined` | the seven in Appendix A.3. Declining ends a task Cancelled, with a receipt |
| fourteen screens | 52, from sections 15.5 to 15.7 |

To run it: `python3 -m http.server 8090` inside `reference/orbit-os-frontend/`.
Port 8080 is taken by the local instance stack.

## Stack
React 19, TypeScript (strict), Vite with one HTML entry per dashboard, Tailwind
CSS 3, shadcn/ui on Radix, React Router 6 (`HashRouter`), TanStack Query 5, React
Hook Form with Zod, Vitest and Testing Library, Playwright for end to end. Inter
only, with a system sans-serif fallback.

The repo runs on Node 24 and **pnpm**, never npm. `dashboards` is a workspace
package, so add a dependency with `pnpm --filter @orbit/dashboards add <pkg>`.

## Design rules, all enforced in CI
1. **Tokens only.** Every colour, radius, font size and divider comes from
   `design/tokens.css`: `--color-ink`, `--color-paper`, `--color-canvas`,
   `--color-muted`, `--color-line`, `--color-danger`. **Never write a literal
   colour** — not a hex, not `rgb(`, not a CSS colour name. Point the Tailwind
   theme at the CSS variables; do not restate their values.
2. **No shadows, no gradients, no card grids, no KPI tiles** (section 15.2 and
   DESIGN.md). Plain lists. Where an older document says "tiles", build a list.
3. **The six states are one component**, built once and used by all 52 screens
   (section 15.4): empty, loading, error, office paused, not yours, and expired or
   already decided. A screen that hand-rolls one of these is a defect.
4. **An empty state says what will appear here and the one action or condition
   that fills it.** Never an illustration.
5. **No internal system names in anything a customer reads** (section 15.3):
   never Paperclip, Hermes, OpenClaw, MCP, ORBIT-OS, adapter, heartbeat or token.
   Say teammates, tools, office. Runtime ids and adapter names appear on the fleet
   Office view only.
6. **Accessibility is not optional.** Keyboard reachable, visible focus, labelled
   controls, `aria-live` for toasts and errors, respects `prefers-reduced-motion`,
   usable at 360 px, text contrast at least 4.5:1, targets at least 44 px.
7. **Plain language.** Short sentences, no jargon, no em dashes, no exclamation
   marks.

## Product rules
1. **Frontend only.** No backend, no database, no Express. All data goes through
   one typed `ApiClient`. Ship a `MockApiClient` on localStorage now; a later
   `HttpApiClient` must be a one-file swap.
2. **Screens never touch storage or `fetch`.** They use hooks that call the
   `ApiClient` through TanStack Query.
3. **Validate with Zod** at every form and at the `ApiClient` boundary. Schemas
   live in `src/shared/schemas` and types are inferred from them.
4. **Guardrails outrank instructions.** A user can read a guardrail, never edit one.
5. **The org chart is a strict tree.** Exactly one Coordinator, every other
   teammate has exactly one manager, no loops. Leaders are the board above the
   Coordinator. Front Desk is built in and is not a teammate.
6. **Access and authority are separate.** Access is User or Org Admin, what you
   can configure. Authority is Leader, Approver, Backup approver or Budget holder,
   what you can approve. An AI never approves.
7. **Standing Authority is flagged off and read-only** until open decision 2 is
   answered. `/authority` ships as a shell.
8. **No dead buttons, no lorem ipsum, no `any`.** Every action works against the
   mock, or it is not rendered.
9. Never log or store a secret. The frontend never creates a connection credential.

## Folder layout
```
dashboards/
  tsconfig.json                 # the browser project: DOM and JSX, no Node types
  user/index.html  org-admin/index.html  fleet/index.html   # three Vite entries
  src/
    assets.d.ts                 # asset-import declarations
    shared/
      api/                      # ApiClient interface, MockApiClient, queryKeys, hooks
      schemas/                  # Zod schemas and inferred types
      seeds/                    # jobs, connectors, org templates, demo office, fleet registry
      ui/                       # Button, Pill, Chip, Field, Select, Textarea, Table,
                                # Drawer, Modal, Toast, Tabs, Stepper, ProgressBar,
                                # OrgTree, EmptyState, Banner
      states/                   # the six section 15.4 states, ONE component
      layout/                   # AppShell, Sidebar, TopBar, DevTools
      lib/                      # formatters and validators
    apps/
      user/                     # main.tsx, routes, screens/
      org-admin/                # main.tsx, routes, screens/
      fleet/                    # main.tsx, routes, screens/
```

`src/apps` is what arms the S-43 entry-file tripwire: the first real screen there
requires all three entry files to exist with the right titles. A `*.test.tsx`,
`*.spec.tsx` or `*.stories.tsx` file does not arm it and is not scanned for banned
words, so writing the test first is safe.

Keep dashboard source under `src`. A source file outside it trips
`guards/contract-boundary.test.ts`.

## Commands
| Command | State |
|---|---|
| `pnpm --filter @orbit/dashboards dev` | the dev server on port 5199, strict port |
| `pnpm typecheck` | runs the root project and the dashboards project |
| `pnpm test` | the whole suite |
| `pnpm test:unit` | the unit project only, which is where the guards live |
| `pnpm check:screens` | the S-43 and Appendix A guards on their own |
| `pnpm lint` | **does not exist yet.** Task 3 of the plan adds it |
| `pnpm e2e` | **does not exist yet.** Task 4 of the plan adds it |

Do not invent a script. Where the table says a command does not exist, say so
rather than working around it.

The dev server serves one page per dashboard, so there are three addresses:
`http://localhost:5199/user/index.html`, `/org-admin/index.html` and
`/fleet/index.html`. The port is strict so a second instance fails loudly
instead of moving to another port and serving a stale build at the address you
had open.

## Working agreement
- Work in the order the plan gives. Finish one piece, run `pnpm typecheck` and
  `pnpm test`, say what changed, then **stop and wait**.
- If a requirement is ambiguous, or the prototype and the PRD disagree in a way
  the table above does not settle, **ask**. Do not guess.
- Components under 150 lines, colocated tests, named exports.
- 52 screens ship as shells first, then 28 get logic. A shell is a route, a nav
  entry, the right title, the six states, and an empty state that says what fills it.

## Definition of done
Typecheck and tests pass, `pnpm check:screens` is green, a keyboard-only
walkthrough works, no console errors, the behaviour matches the prototype, and the
copy obeys the design and product rules above.
