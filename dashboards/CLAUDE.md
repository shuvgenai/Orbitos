# ORBIT-OS web: rules for Claude Code

## What this repo is
ORBIT-OS gives each small business an AI office: a Coordinator plus specialist agents in a strict org chart, with people as the board. This repo is the **frontend only** for three dashboards:

| Dashboard | Who | Entry file | Hash routes |
|---|---|---|---|
| User | Staff who own agents | `user/index.html` | `#/home` `#/new` `#/activity` |
| Org Admin | Sets up and runs the office | `org-admin/index.html` | `#/dashboard` `#/onboarding` `#/requests` `#/map` `#/performance` `#/structure` `#/agents` `#/connections` |
| Super Admin (fleet) | OrbitumAI operator | `fleet/index.html` | `#/fleet` `#/office/:id` `#/provision` |

## Reference implementation (read first)
`/reference/orbit-os-frontend/` is a working vanilla-JS prototype. It is the **behavior and copy spec**. Open `reference/orbit-os-frontend/README.md`, then run it (`python3 -m http.server 8080` inside that folder). Rebuild its behavior in React. Do not copy its vanilla patterns (string templates, global `window` objects).

## Stack (fixed)
React 18, TypeScript (strict), Vite (multi-page: one HTML entry per dashboard), Tailwind CSS 3, shadcn/ui + Radix, React Router 6 (`HashRouter`), TanStack Query 5, React Hook Form + Zod, Vitest + Testing Library, Playwright for end-to-end. Font: **Inter** only.

## Hard rules
1. **Frontend only.** No backend, no database, no Supabase, no Express. All data goes through one typed `ApiClient` interface. Ship a `MockApiClient` (localStorage) now. A later `HttpApiClient` must be a one-file swap.
2. **Screens never touch storage or `fetch`.** They use hooks that call the `ApiClient` through TanStack Query.
3. **Validate with Zod** at every form and at the ApiClient boundary. Schemas live in `src/shared/schemas`, types are inferred from them.
4. **No internal product names in customer-facing UI** (never show "Paperclip", "Hermes", "OpenClaw", "MCP"). Say "agents", "tools", "office". Runtime ids and adapter names appear only in the Super Admin Office view.
5. **Guardrails always outrank instructions.** Users can read guardrails but never edit them.
6. **The org chart is a strict tree.** Exactly one Coordinator, every other agent has exactly one manager, no loops. The Leaders are the board above the Coordinator. Front Desk is built in and is not an agent.
7. **Access and authority are separate.** Access = User or Org Admin (what you can configure). Authority = Leader, Approver, Budget holder (what you can approve).
8. **Accessibility is not optional:** keyboard reachable, visible focus, labelled controls, `aria-live` for toasts and errors, respects `prefers-reduced-motion`, usable at 360px width.
9. **Plain language.** Short sentences, no jargon, no em dashes, no exclamation marks. Empty states say what to do next.
10. **No dead buttons, no lorem ipsum, no `any`.** Every action either works against the mock or is not rendered.
11. Never log or store secrets. Mock connection "tokens" are never created in the frontend.

## Working agreement
- Work in the phases in `ORBIT-OS_Claude_Code_Build_Prompts.md`. Finish a phase, run `npm run typecheck && npm run lint && npm test`, summarize what changed, then **stop and wait**.
- If a requirement is ambiguous or conflicts with the reference, **ask**; do not guess.
- Prefer small components (under 150 lines), colocated tests, and named exports.
- Commit after each phase with message `phase N: <summary>`.

## Folder layout
```
src/
  shared/            # used by all three dashboards
    api/             # ApiClient interface, MockApiClient, queryKeys, hooks
    schemas/         # Zod schemas + inferred types
    seeds/           # jobs, mcps, org templates, demo office, fleet registry
    ui/              # design-system components (Button, Card, Pill, Drawer, ...)
    layout/          # AppShell, Sidebar, TopBar, DevTools
    lib/             # formatters, validators (org/agents/assign/connections)
  apps/
    user/            # main.tsx, routes, screens/
    org-admin/       # main.tsx, routes, screens/ (onboarding/, ...)
    fleet/           # main.tsx, routes, screens/
user/index.html  org-admin/index.html  fleet/index.html   # three Vite entries
reference/orbit-os-frontend/                              # prototype (read-only)
```

## Commands
`npm run dev` (all three at /user/, /org-admin/, /fleet/) · `npm run build` · `npm run typecheck` · `npm run lint` · `npm test` · `npm run e2e`

## Definition of done (every phase)
Typecheck, lint and tests pass. Keyboard-only walkthrough works. No console errors. Matches reference behavior. Copy follows rule 4 and 9.
