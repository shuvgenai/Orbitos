# AppShell and per-role nav Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build one AppShell and one per-role nav configuration that carry all 52 screens of PRD v9.0 sections 15.5 to 15.7, so every later screen is a route plus a nav entry plus a title plus the six shared states.

**Architecture:** One data file holds the 52 screens exactly as the PRD tables name them, and a guard parses those tables out of the PRD and fails when the data file drifts. Three role lists are built from that one file, with the Org Admin list being the User list plus its own, as section 15.6 requires. One `AppShell` renders the nav as a plain list in a flex layout, and one `Screen` wrapper puts the title and the existing `ScreenState` on every route, so no screen hand-rolls a state.

**Tech Stack:** React 19, TypeScript strict, Vite 8.3.1 with `@vitejs/plugin-react` 6.1.2 (both pinned exact), Tailwind CSS 3.4.19 pointed at `design/tokens.css`, `react-router-dom` 6.30.6 with `HashRouter` (pinned exact; 6.30.6 is the registry's `version-6` dist-tag, confirmed 2026-10-07, while `latest` is 7.18.4 and the wrong major), Vitest with Testing Library in the `dashboards` project.

**Spec:** `docs/prd/ORBIT_OS_PRD_v9_0.md`, sections 15.2, 15.3, 15.4, 15.5, 15.6, 15.7, 15.8, and `dashboards/CLAUDE.md`.

## Global Constraints

- Six colours only, from `design/tokens.css`: `--color-ink`, `--color-paper`, `--color-canvas`, `--color-muted`, `--color-line`, `--color-danger`. Never a hex, `rgb(`, or a CSS colour name. (§15.1, `dashboards/CLAUDE.md` design rule 1)
- No shadows, no gradients, **no card grids, no KPI tiles**. Plain lists. (§15.2) `guards/design-naming.test.ts` fails on `grid-template-columns`, `grid-cols-<n>`, `KpiTile`, and `kpi` inside any string. **So the AppShell uses flex, never grid.**
- Banned in customer copy under `dashboards/src/apps/user`, `dashboards/src/apps/org-admin` and `dashboards/src/shared`: `ORBIT-OS`, `Paperclip`, `Hermes`, `OpenClaw`, `MCP`, `token`/`tokens`, `adapter`. Comments and module specifiers are blanked before that scan, so `import '../../../../design/tokens.css'` is safe; a visible string saying "token" is not.
- Titles: `Orbitcrew` for User and Org Admin, `ORBIT-OS` for fleet. (§15.3)
- The six states are ONE component, already built: `dashboards/src/shared/states/ScreenState.tsx`. A screen that hand-rolls one is a defect. (§15.4, design rule 3)
- Inter only. Body text at least 16 px. Buttons at least 44 px, Approve at least 48 px. Contrast at least 4.5:1. Works at 200% zoom and at 360 px. Keyboard reachable everywhere, visible focus, `aria-live` for toasts and errors, respects `prefers-reduced-motion`. (§15.2, design rule 6)
- Plain language. Short sentences, no jargon, no em dashes, no exclamation marks. (design rule 7)
- Components under 150 lines, colocated tests, named exports. No `any`. No dead buttons. (`dashboards/CLAUDE.md`)
- pnpm only, never npm. Node 24. `pnpm --filter @orbit/dashboards add <pkg>`. Every dependency pinned exact, no `^` or `~`.
- Keep dashboard source under `src`. `guards/contract-boundary.test.ts` allows only `*.config.*` at the dashboards root.
- `pnpm lint` and `pnpm e2e` do not exist. Do not invent a script.
- Never touch `reference/orbit-os-frontend/` or `design/`. Both are frozen.

## Review Focus

1. **A nav link whose route renders nothing.** Every one of the 52 routes must be registered, or a link in the sidebar leads to a blank page and reads as broken software. Pinned in Task 5.
2. **Keyboard-only at 360 px.** The nav disclosure button must be reachable, must report `aria-expanded`, and focus must land in the nav when it opens. Pinned in Task 3.
3. **Office paused on a detail route.** §15.4 says the banner is on every screen. A banner rendered per screen will be missed on `/tasks/:id`. The AppShell owns it. Pinned in Task 3.
4. **`prefers-reduced-motion`.** The disclosure must not animate for a person who asked for no motion. Pinned in Task 3.
5. **An unknown hash route.** `HashRouter` with a typo in the URL must land somewhere honest, not a blank shell. Pinned in Task 5.

---

## File Structure

| File | Responsibility |
| --- | --- |
| `dashboards/src/shared/nav/screens.ts` | The 52 screens, one row each, named and routed exactly as §15.5 to §15.7 name them. No logic. |
| `dashboards/src/shared/nav/roles.ts` | Three role lists built from `screens.ts`: `USER_NAV`, `ORG_ADMIN_NAV` (User plus its own, §15.6 preamble), `FLEET_NAV`. |
| `guards/screen-inventory.test.ts` | Parses the three PRD tables and fails when `screens.ts` adds, drops or renames a screen or changes a route. |
| `dashboards/src/shared/styles/app.css` | The one stylesheet each entry imports: `design/tokens.css` first, then `theme.css`. Restates no value. |
| `dashboards/src/shared/layout/AppShell.tsx` | Header, nav as a plain list, paused banner, skip link, `<main>`. Flex, never grid. |
| `dashboards/src/shared/layout/AppShell.test.tsx` | Colocated. Keyboard, `aria-expanded`, `aria-current`, paused banner, class contract at each width. |
| `dashboards/src/shared/layout/Screen.tsx` | One route's frame: the `<h1>` title and `ScreenState`. Does not re-implement a state. |
| `dashboards/src/shared/layout/Screen.test.tsx` | Colocated. All six states render through it; content shows only when `state` is null. |
| `dashboards/src/apps/<role>/routes.tsx` | Per app: `HashRouter`, one `<Route>` per row of that role's list, each rendering `Screen`. |
| `dashboards/src/apps/<role>/main.tsx` | Modified: imports `app.css`, renders `routes.tsx`. |
| `dashboards/vite.config.ts` | Modified: `server.fs.allow` widened so the dev server may read `design/tokens.css`, which sits outside the Vite root. |
| `dashboards/src/shared/styles/theme.css` | Modified: its header comment says the entry HTML loads `design/tokens.css`. After Task 1 `app.css` does. Comment only. |

---

## 1. Nav config per role

Taken from the PRD tables, verbatim. 14 + 21 + 17 = 52. Nothing added, dropped or renamed.

`inSidebar` is the only column the PRD does not state. It marks whether a screen is a link in the nav list. A route with a `:id`, a step inside another screen, and the pre-auth sign-in page cannot be a sidebar link, because there is no id to link to and no shell to sit in. Every such screen is still a registered route and still a screen. The ten that are not sidebar links are listed under "Differences" below.

### §15.5 User — 14 screens, 9 sidebar links

| # | Screen | Route | Sidebar | Cite |
| --- | --- | --- | --- | --- |
| 1 | Sign in | `/signin` | no | §15.5 |
| 2 | Home | `/` | yes | §15.5 |
| 3 | Ask or describe | `/new` | yes | §15.5 |
| 4 | Job summary check | `/new/summary` | no | §15.5 |
| 5 | Practice run | `/new/practice` | no | §15.5 |
| 6 | Task board | `/tasks` | yes | §15.5 |
| 7 | Task page | `/tasks/:id` | no | §15.5 |
| 8 | Waiting for you | `/waiting` | yes | §15.5 |
| 9 | Approval page | `/waiting/:id` | no | §15.5 |
| 10 | Receipts | `/receipts` | yes | §15.5 |
| 11 | Weekly reviews | `/reviews` | yes | §15.5 |
| 12 | Chat with Orbi | `/chat` | yes | §15.5 |
| 13 | Request a teammate | `/teammates/request` | yes | §15.5 |
| 14 | Profile and alerts | `/me` | yes | §15.5 |

### §15.6 Org Admin — 21 screens, 19 sidebar links, on top of the User list

§15.6 preamble: "The Org Admin reaches every User screen plus these." So the Org Admin app registers 35 routes and shows 28 sidebar links.

| # | Screen | Route | Sidebar | Cite |
| --- | --- | --- | --- | --- |
| 1 | Guided setup | `/setup` | yes | §15.6 |
| 2 | Departments and teams | `/org/departments` | yes | §15.6 |
| 3 | Org chart | `/org/chart` | yes | §15.6 |
| 4 | People | `/org/people` | yes | §15.6 |
| 5 | AI teammates | `/teammates` | yes | §15.6 |
| 6 | Teammate profile | `/teammates/:id` | no | §15.6 |
| 7 | Requests | `/requests` | yes | §15.6 |
| 8 | Jobs library | `/jobs` | yes | §15.6 |
| 9 | Job detail | `/jobs/:id` | no | §15.6 |
| 10 | Standing Authority | `/authority` | flag | §15.6, "behind a flag that defaults to off" |
| 11 | Rules and safety | `/rules` | yes | §15.6 |
| 12 | Data boundaries | `/rules/data` | yes | §15.6 |
| 13 | Activity log | `/activity` | yes | §15.6 |
| 14 | Spending | `/spending` | yes | §15.6 |
| 15 | Plan and invoices | `/spending/plan` | yes | §15.6 |
| 16 | Connections | `/connections` | yes | §15.6 |
| 17 | Intake channels | `/connections/intake` | yes | §15.6 |
| 18 | Results | `/results` | yes | §15.6 |
| 19 | Privacy | `/privacy` | yes | §15.6 |
| 20 | Data | `/data` | yes | §15.6 |
| 21 | Office controls | `/settings/office` | yes | §15.6 |

Route ordering note: `/teammates/request` (User 13) is static and `/teammates/:id` (Org Admin 6) is dynamic. React Router 6 ranks the static segment higher, so the two coexist with no manual ordering. Task 5 pins that with a test rather than trusting it.

### §15.7 Super Admin fleet console — 17 screens, 14 sidebar links

| # | Screen | Route | Sidebar | Cite |
| --- | --- | --- | --- | --- |
| 1 | Fleet table | `/fleet` | yes | §15.7 |
| 2 | Office view | `/fleet/:id` | no | §15.7 |
| 3 | Provision | `/provision` | yes | §15.7 |
| 4 | Upgrades | `/upgrades` | yes | §15.7 |
| 5 | Backups | `/backups` | yes | §15.7 |
| 6 | Shutdown | `/fleet/:id/shutdown` | no | §15.7 |
| 7 | Security | `/security` | yes | §15.7 |
| 8 | Alerts and incidents | `/incidents` | yes | §15.7 |
| 9 | View as customer | `/fleet/:id/view` | no | §15.7 |
| 10 | Money | `/money` | yes | §15.7 |
| 11 | Quality | `/quality` | yes | §15.7 |
| 12 | Role library | `/library` | yes | §15.7 |
| 13 | Skills review | `/skills` | yes | §15.7 |
| 14 | Connector catalog | `/connectors` | yes | §15.7 |
| 15 | Custom connector queue | `/connectors/review` | yes | §15.7 |
| 16 | Nightly numbers | `/numbers` | yes | §15.7 |
| 17 | Build checks | `/checks` | yes | §15.7 |

### Differences from the PRD tables

No screen is added, dropped or renamed, and no route is changed. These are the decisions the tables do not state:

1. **Ten screens are routes but not sidebar links**, because they need an id, are a step inside another screen, or sit outside the shell. Customer: `/signin`, `/new/summary`, `/new/practice`, `/tasks/:id`, `/waiting/:id`, `/teammates/:id`, `/jobs/:id`. Fleet: `/fleet/:id`, `/fleet/:id/shutdown`, `/fleet/:id/view`.
2. **Standing Authority `/authority` is a route always and a sidebar link only when its flag is on.** §15.6 says the screen is read-only behind a flag that defaults to off, and `dashboards/CLAUDE.md` product rule 7 says it ships as a shell. Answered by the founder 2026-10-07: route always, sidebar link only when the flag is on.
3. **The Org Admin app serves 35 routes**, its own 21 plus the User 14, from the §15.6 preamble. That is a reading of one sentence, not a table row.
4. **`document.title` stays the app title** from the entry HTML, and the screen name is the `<h1>`. Per-screen document titles would be new customer-facing copy the PRD does not specify. Answered by the founder 2026-10-07: one `document.title` per app.

---

## 2. Token wiring

One stylesheet per entry, imported once, restating nothing.

- `design/tokens.css` holds the twelve custom properties and the dark-mode block. It is frozen, and `design/tokens.test.ts` proves it matches `DESIGN.md`.
- `dashboards/tailwind.config.ts` already names each one as `var(--color-ink)` and so on, and restates no value.
- `dashboards/src/shared/styles/theme.css` already holds the `@tailwind` layers and the screen-state rules, all through `@apply`, and states no value.
- **New:** `dashboards/src/shared/styles/app.css` imports the frozen file first and the theme second, so the custom properties exist before any rule reads them.
- Each `main.tsx` imports `app.css` and nothing else. One line per entry, three in all, and one place that fixes the order.

`design/tokens.css` sits outside the Vite root, which is `dashboards/`. The production build resolves the relative path without help. The dev server will not serve a file outside its root unless told, so `vite.config.ts` gains `server: { fs: { allow: ['..'] } }` with a comment saying why.

`theme.css`'s header comment currently says the entry HTML loads `design/tokens.css`. After this task `app.css` does, so the comment is corrected in the same commit. Comment only; no rule changes.

---

## 3. AppShell structure at 360, 768 and 1280 px

Tailwind's default breakpoints survive, because `tailwind.config.ts` replaces only the keys it names and `screens` is not one of them. So `md:` is 768 px and `xl:` is 1280 px.

One `<div>` column holds a `<header>`, an optional paused banner, and a flex row holding `<nav>` and `<main>`. Flex only, never grid: `guards/design-naming.test.ts` fails on `grid-cols-<n>` and `grid-template-columns`, and §15.2 wants lists.

**360 px, the base case.** Single column. The header carries the app name as the `<h1>` and one disclosure button reading "Menu", at `min-h-target min-w-target` which is the 44 px from `theme.extend`. The nav is hidden until the button is pressed, and opens as a plain `<ul>` of links below the header, full width, one row per link, divided by `border-b-divider border-line`. No overlay, no drawer, no transform, so nothing to animate and nothing to trap focus in. Content follows the nav in the document, which is also its reading order. Horizontal padding is `px-4`, so a 360 px screen has no sideways scroll.

**768 px, `md:`.** The flex row turns on with `md:flex-row`. The nav becomes a persistent left column at `md:w-64`, always visible, and the disclosure button is `md:hidden`. `<main>` takes the rest with `flex-1`. The nav keeps the same plain-list markup at every width; only its visibility and its place in the row change.

**1280 px, `xl:`.** The same two columns. `<main>` gains `xl:max-w-3xl` so a line of text does not run the full width, and the column stays left-aligned beside the nav. No third column and no dashboard of tiles: a third column is what invites the KPI row §15.2 forbids.

**Everywhere.** A skip link is the first focusable element, `href="#main"`, visually hidden until focused. Each nav link gets `aria-current="page"` when it is the active route. Focus is visible through `outline outline-focus outline-offset-focus outline-ink` on `:focus-visible`, from the frozen values. Nothing has a transition, so `prefers-reduced-motion` is satisfied by construction, and Task 3 asserts there is no `transition` or `animate-` class rather than trusting that to stay true. The paused banner renders above `<main>` on every route when the office is paused, which is why the AppShell owns it and no screen does.

Honest limit: jsdom applies no CSS, so the colocated tests pin the class contract and the accessibility behaviour, not the rendered layout. A real 360 / 768 / 1280 check needs Playwright, and `pnpm e2e` does not exist yet. Task 4 of `docs/superpowers/plans/2026-10-05-v8-seam-and-contract.md` adds it; the three widths belong there as a journey when it lands.

---

## 4. The six states on every route

`ScreenState` already exists and is not rebuilt. `Screen` is the thin frame that puts it on every route:

- `Screen` takes the screen's row from `screens.ts`, a `ScreenStateValue | null`, and optional children.
- It renders the `<h1>` from the row's name, then `<ScreenState state={state}>{children}</ScreenState>`.
- When `state` is null the children show. When it is one of the six, `ScreenState` renders that state and the children do not show, which is what makes "not yours" preview nothing.
- A shell has no data yet, so its state is `{ kind: 'empty', appears, fills }`. `appears` is the row's "what it holds" line from the PRD table. `fills` is the one action or condition §15.4 requires, which the PRD states only for the 24 Fill-later screens, under §15.8 "Unblocked by". Answered by the founder 2026-10-07: all 52 lines are drafted in one copy-only commit for review, Task 4b, with the 24 Fill-later lines taken from §15.8 "Unblocked by" and no banned word on a customer screen.
- Office paused is the one state the AppShell renders instead, because §15.4 makes it a banner on every screen.

So a shell is: a route in `screens.ts`, a sidebar entry where `inSidebar` is true, the `<h1>` title, the six states reachable through one component, and S-43 green. That matches §15.8's definition.

A guard keeps it honest: no file under `dashboards/src/apps` may contain the markup or the copy of a state, because `shared/states` owns both. A hand-rolled empty state fails rather than quietly shipping.

---

## Tasks

### Task 1: Token wiring

**Files:**
- Create: `dashboards/src/shared/styles/app.css`
- Modify: `dashboards/src/shared/styles/theme.css` (header comment only)
- Modify: `dashboards/vite.config.ts` (add `server.fs.allow`)
- Modify: `dashboards/src/apps/user/main.tsx`, `dashboards/src/apps/org-admin/main.tsx`, `dashboards/src/apps/fleet/main.tsx` (one import each)
- Test: `guards/dashboards-theme.test.ts` (extend)

**Interfaces:**
- Consumes: `design/tokens.css` (frozen), `dashboards/src/shared/styles/theme.css`.
- Produces: `dashboards/src/shared/styles/app.css`, the single stylesheet every entry imports.

- [ ] **Step 1: Write the failing test** in `guards/dashboards-theme.test.ts`

```ts
const APP_CSS = 'dashboards/src/shared/styles/app.css';

// The order is the rule, not a preference: an @apply in theme.css that reads a
// custom property declared later resolves to nothing.
test('app.css loads the frozen values first, then the theme, and states no value', () => {
  const src = readRepoFile(APP_CSS);
  const frozenAt = src.indexOf('design/tokens.css');
  const themeAt = src.indexOf('./theme.css');
  expect(frozenAt, 'app.css must import the frozen file').toBeGreaterThan(-1);
  expect(themeAt, 'app.css must import the theme').toBeGreaterThan(-1);
  expect(frozenAt).toBeLessThan(themeAt);
  expect(src).not.toMatch(LITERAL_COLOUR);
  expect(src).not.toMatch(NAMED_COLOUR_VALUE);
});

test('each entry imports the one stylesheet, and imports it once', () => {
  for (const role of ['user', 'org-admin', 'fleet']) {
    const src = readRepoFile(`dashboards/src/apps/${role}/main.tsx`);
    const hits = [...src.matchAll(/shared\/styles\/app\.css/g)];
    expect(hits.length, `${role} must import app.css exactly once`).toBe(1);
    expect(src, `${role} must not import theme.css directly`).not.toContain('styles/theme.css');
  }
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run --project unit guards/dashboards-theme.test.ts`
Expected: FAIL, `ENOENT` on `dashboards/src/shared/styles/app.css`.

- [ ] **Step 3: Write `app.css`**

```css
/* The one stylesheet every dashboard entry imports.
   The frozen file comes first: it declares the custom properties that every
   @apply in theme.css reads, and a rule that reads one before it is declared
   resolves to nothing. Neither import restates a value. */
@import '../../../../design/tokens.css';
@import './theme.css';
```

- [ ] **Step 4: Add the import to each entry, and widen the dev server's reach**

In each `main.tsx`, directly under the React imports: `import '../../shared/styles/app.css';`
In `vite.config.ts`, with a comment: `server: { fs: { allow: ['..'] } }`, because `design/` is outside the Vite root and the dev server refuses to serve it otherwise.

- [ ] **Step 5: Correct the `theme.css` header comment**

It says `design/tokens.css` "is loaded by each dashboard's entry HTML". Replace that clause: loaded by `app.css`, ahead of this file.

- [ ] **Step 6: Run the gates**

Run: `npx vitest run --project unit guards/dashboards-theme.test.ts` → PASS
Run: `npx tsc -p dashboards/tsconfig.json` → no errors
Run: `cd dashboards && npx vite build --outDir <scratch> --emptyOutDir` → three entries, and each built CSS asset declares `--color-ink`

- [ ] **Step 7: Probe that the wiring is real, then revert**

Comment out the `@import` of the frozen file in `app.css`, rebuild, confirm the built CSS no longer declares `--color-ink`. Revert.

- [ ] **Step 8: Commit**

```bash
git add dashboards/src/shared/styles/app.css dashboards/src/shared/styles/theme.css dashboards/vite.config.ts dashboards/src/apps guards/dashboards-theme.test.ts
git commit -m "feat(dashboards): import the frozen values once per entry"
```

### Task 2: The 52 screens, and a guard that holds them to the PRD

**Files:**
- Create: `dashboards/src/shared/nav/screens.ts`, `dashboards/src/shared/nav/roles.ts`
- Create: `guards/screen-inventory.test.ts`
- Test: `dashboards/src/shared/nav/roles.test.ts`

**Interfaces:**
- Produces:
  - `type ScreenRow = { readonly screen: string; readonly route: string; readonly section: '15.5' | '15.6' | '15.7'; readonly inSidebar: boolean | 'flag'; readonly appears: string }`
  - `const SCREENS: readonly ScreenRow[]` — 52 rows
  - `const USER_NAV: readonly ScreenRow[]` — 14
  - `const ORG_ADMIN_NAV: readonly ScreenRow[]` — 35, the User 14 then the Org Admin 21
  - `const FLEET_NAV: readonly ScreenRow[]` — 17

- [ ] **Step 1: Write the failing guard** in `guards/screen-inventory.test.ts`

```ts
/**
 * The PRD is the source. This parses the three inventory tables out of
 * docs/prd/ORBIT_OS_PRD_v9_0.md and compares them to the data file, so a
 * screen cannot be added, dropped or renamed in code without the PRD saying so.
 *
 * Parsing, not a second hand-written list: an expectation copied by hand here
 * would drift from the PRD exactly as the data file could.
 */
function prdScreens(section: '15.5' | '15.6' | '15.7'): { screen: string; route: string }[] {
  const src = readRepoFile('docs/prd/ORBIT_OS_PRD_v9_0.md');
  const start = src.indexOf(`### ${section} Screen inventory`);
  const end = src.indexOf('\n### ', start + 1);
  const body = src.slice(start, end < 0 ? undefined : end);
  return [...body.matchAll(/^\|\s*\d+\s*\|\s*([^|]+?)\s*\|\s*`([^`]+)`\s*\|/gm)].map((m) => ({
    screen: (m[1] as string).replace(/\*\*/g, ''),
    route: m[2] as string,
  }));
}

test('the parse found all three tables, so the comparison cannot pass on nothing', () => {
  expect(prdScreens('15.5').length, 'section 15.5 holds 14 screens').toBe(14);
  expect(prdScreens('15.6').length, 'section 15.6 holds 21 screens').toBe(21);
  expect(prdScreens('15.7').length, 'section 15.7 holds 17 screens').toBe(17);
});

test('every screen in the data file is a screen in the PRD, with the same route', () => {
  for (const section of ['15.5', '15.6', '15.7'] as const) {
    const want = prdScreens(section);
    const got = SCREENS.filter((s) => s.section === section).map((s) => ({ screen: s.screen, route: s.route }));
    expect(got, `section ${section}`).toEqual(want);
  }
});

test('the three sections are the whole of it, 52 screens and no duplicate route', () => {
  expect(SCREENS.length).toBe(52);
  expect(new Set(SCREENS.map((s) => s.route)).size).toBe(52);
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run --project unit guards/screen-inventory.test.ts`
Expected: FAIL, cannot resolve `dashboards/src/shared/nav/screens.ts`.

- [ ] **Step 3: Write `screens.ts`** — the 52 rows of the three tables above, in the PRD's order, each with its `section`, its `inSidebar` value from the tables in section 1 of this plan, and `appears` taken from the PRD's "What it holds" column.

- [ ] **Step 4: Write `roles.ts`**

```ts
// Section 15.6: "The Org Admin reaches every User screen plus these." So the
// Org Admin list is the User list and its own, in that order, and is never
// retyped.
export const USER_NAV = SCREENS.filter((s) => s.section === '15.5');
export const ORG_ADMIN_NAV = [...USER_NAV, ...SCREENS.filter((s) => s.section === '15.6')];
export const FLEET_NAV = SCREENS.filter((s) => s.section === '15.7');
```

- [ ] **Step 5: Write the role test** in `dashboards/src/shared/nav/roles.test.ts`, with the counts written out by hand and never read from the lists being pinned: 14, 35, 17, and the sidebar counts 9, 28, 14.

- [ ] **Step 6: Run the gates**

Run: `npx vitest run --project unit guards/screen-inventory.test.ts` → PASS
Run: `npx vitest run --project dashboards` → PASS
Run: `npx vitest run --project unit guards/design-naming.test.ts` → PASS, because the `appears` copy names no banned word

- [ ] **Step 7: Probe that the guard bites, three ways, reverting each**

Rename one screen in `screens.ts` → the parity test fails naming it. Change one route → the same. Delete a row → the count test fails. Revert all three.

- [ ] **Step 8: Commit**

```bash
git add dashboards/src/shared/nav guards/screen-inventory.test.ts
git commit -m "feat(dashboards): carry the 52 screens, held to the PRD by a guard"
```

### Task 3: AppShell

**Files:**
- Create: `dashboards/src/shared/layout/AppShell.tsx`, `dashboards/src/shared/layout/AppShell.test.tsx`

**Interfaces:**
- Consumes: `ScreenRow` and the three role lists from Task 2; `ScreenState` from `dashboards/src/shared/states/ScreenState.tsx`.
- Produces: `function AppShell(props: { appName: string; nav: readonly ScreenRow[]; activeRoute: string; paused?: boolean; children: ReactNode })`

- [ ] **Step 1: Write the failing tests** in `AppShell.test.tsx`

```tsx
test('the skip link is the first focusable thing and points at main', () => {
  // one userEvent.tab() from the document body
});
test('at 360 px the nav sits behind one 44 px button that reports its state', () => {
  // aria-expanded false, click, aria-expanded true, every link then reachable by keyboard
});
test('the active route is the only link marked aria-current', () => {
  // exactly one, and it is the one whose route matches
});
test('a paused office shows the banner above main, on any route', () => {
  // role=status and the section 15.4 copy, with a :id route as the active one
});
test('nothing animates, so prefers-reduced-motion is satisfied by construction', () => {
  expect(markup).not.toMatch(/\btransition\b|\banimate-/);
});
test('the layout is flex at every width, never a grid', () => {
  expect(markup).not.toMatch(/grid-cols-|grid-template-columns/);
});
test('the width contract holds: persistent nav from md, narrower main from xl', () => {
  // md:flex-row on the row, md:w-64 on the nav, md:hidden on the button, xl:max-w-3xl on main
});
```

- [ ] **Step 2: Run them and watch them fail**

Run: `npx vitest run --project dashboards dashboards/src/shared/layout/AppShell.test.tsx`
Expected: FAIL, cannot resolve `AppShell.tsx`.

- [ ] **Step 3: Write `AppShell.tsx`** to the structure in section 3 above. Under 150 lines, named export, no `any`. The nav is `<nav><ul><li><a>`. The paused banner is `<ScreenState state={{ kind: 'paused' }} />`, so that copy lives in one place.

- [ ] **Step 4: Run the tests** → PASS

- [ ] **Step 5: Run the gates**

`npx tsc -p dashboards/tsconfig.json`, `npx vitest run --project dashboards`, `npx vitest run --project unit guards/design-naming.test.ts`, `npx vitest run --project unit guards/dashboards-theme.test.ts`.

- [ ] **Step 6: Probe the design rules, reverting each**

Add `grid-cols-3` to the nav → S-43 fails naming the file. Add `className="kpi"` → S-43 fails. Write `color: #000` in the markup → S-43 fails. Revert all three.

- [ ] **Step 7: Commit**

```bash
git add dashboards/src/shared/layout
git commit -m "feat(dashboards): one AppShell, plain lists, 44 px targets, keyboard first"
```

### Task 4: The `Screen` frame, so the six states reach every route

**Files:**
- Create: `dashboards/src/shared/layout/Screen.tsx`, `dashboards/src/shared/layout/Screen.test.tsx`
- Create: `guards/screen-states.test.ts`

**Interfaces:**
- Consumes: `ScreenRow` from Task 2, `ScreenState` and `ScreenStateValue` from `shared/states`.
- Produces: `function Screen(props: { row: ScreenRow; state: ScreenStateValue | null; children?: ReactNode })`

- [ ] **Step 1: Write the failing tests**

```tsx
test('the title is the screen name the PRD gives', () => {
  // <h1> reads row.screen
});
test('each of the six states renders through the one component', () => {
  // six cases written out by hand, never a loop over the union
});
test('content shows only when there is no state, so "not yours" previews nothing', () => {
  // children present with state null, absent with notYours
});
```

And in `guards/screen-states.test.ts`: no file under `dashboards/src/apps` writes a `screen-state` class or the copy of a state, because `shared/states` owns both. The rule is also run against a throwaway tree with a probe file per state, as `guards/design-naming.test.ts` does, so it cannot pass on an empty list.

- [ ] **Step 2: Run them and watch them fail**

Run: `npx vitest run --project dashboards dashboards/src/shared/layout/Screen.test.tsx` → FAIL, unresolved import.

- [ ] **Step 3: Write `Screen.tsx`** — the `<h1>` and `ScreenState`, nothing else. It must not re-implement a state.

- [ ] **Step 4: Run the tests** → PASS

- [ ] **Step 5: Probe the ownership guard, then revert**

Put `<div className="screen-state-empty">` in `dashboards/src/apps/user/main.tsx` → `guards/screen-states.test.ts` fails naming it. Revert.

- [ ] **Step 6: Commit**

```bash
git add dashboards/src/shared/layout/Screen.tsx dashboards/src/shared/layout/Screen.test.tsx guards/screen-states.test.ts
git commit -m "feat(dashboards): one frame puts the title and the six states on a route"
```

### Task 4b: The 52 "what fills this" lines (copy only)

Approved by the founder 2026-10-07 as its own commit, for review in one place.

**Files:**
- Modify: `dashboards/src/shared/nav/screens.ts` (adds `fills` to every row; no other field changes)
- Test: `dashboards/src/shared/nav/fills.test.ts`

**Interfaces:**
- Consumes: `ScreenRow` from Task 2.
- Produces: `fills: string` as a required field on every row, so a new screen cannot ship without the line §15.4 requires.

- [ ] **Step 1: Write the failing test**

```ts
test('every screen says what fills it, in one sentence, with no banned word', () => {
  const BANNED = [/Paperclip/i, /Hermes/i, /OpenClaw/i, /\bMCP\b/, /\btokens?\b/i, /adapter/i, /ORBIT-OS/];
  for (const row of SCREENS) {
    expect(row.fills.length, `${row.route} must say what fills it`).toBeGreaterThan(0);
    expect(row.fills, `${row.route} must be one sentence`).not.toMatch(/[.!?].+[A-Za-z]/);
    expect(row.fills, `${row.route} must carry no exclamation mark or em dash`).not.toMatch(/[!—]/);
    // The fleet console is exempt from the naming rule, customer screens are not.
    if (row.section !== '15.7') for (const word of BANNED) expect(row.fills, `${row.route}`).not.toMatch(word);
  }
});

test('the 24 Fill-later lines come from section 15.8, not from invention', () => {
  // Each of the 24 routes section 15.8 lists is asserted by hand against the
  // "Unblocked by" wording for that route. Never a loop over the list itself.
});
```

- [ ] **Step 2: Run it and watch it fail** → FAIL, `fills` is undefined on every row.

- [ ] **Step 3: Draft the 52 lines.** The 24 Fill-later lines restate §15.8's "Unblocked by" in the §15.4 pattern. The 28 Fill-now lines name the one action that produces the first row, taken from that screen's own PRD description, never invented.

- [ ] **Step 4: Run the gates** → the new test passes, and `guards/design-naming.test.ts` stays green because the copy names no banned word.

- [ ] **Step 5: Commit**

```bash
git add dashboards/src/shared/nav
git commit -m "feat(dashboards): say what fills each of the 52 screens"
```

### Task 5: Mount the three routers

`react-router-dom` 6.30.6, approved by the founder 2026-10-07. Pin exact.

**Files:**
- Create: `dashboards/src/apps/user/routes.tsx`, `dashboards/src/apps/org-admin/routes.tsx`, `dashboards/src/apps/fleet/routes.tsx`
- Create: one colocated `routes.test.tsx` per app
- Modify: the three `main.tsx`
- Modify: `dashboards/package.json` (one exact pin)

**Interfaces:**
- Consumes: `AppShell`, `Screen`, the three role lists.
- Produces: `function UserRoutes()`, `function OrgAdminRoutes()`, `function FleetRoutes()`.

- [ ] **Step 1: Write the failing tests**, one per app

```tsx
test('every route in this role list renders its screen, so no nav link is dead', () => {
  // walk the role list, render at each route, assert the h1 is that screen's name
});
test('a static route wins over the dynamic one beside it', () => {
  // /teammates/request is Request a teammate, never Teammate profile
});
test('an unknown hash route lands on something honest, not a blank shell', () => {});
```

- [ ] **Step 2: Run them and watch them fail** → FAIL, unresolved `react-router-dom`.

- [ ] **Step 3: Install the router**

`pnpm --filter @orbit/dashboards add -E react-router-dom@6.30.6` — exact, no caret. 6.30.6 is the registry's `version-6` dist-tag, which is the React Router 6 line `dashboards/CLAUDE.md` names. `latest` is 7.18.4 and is the wrong major. Show the `pnpm-lock.yaml` diff before committing.

- [ ] **Step 4: Write the three `routes.tsx`** — `HashRouter`, `AppShell` with that role's list and app name, one `<Route>` per row rendering `Screen` with the empty state.

- [ ] **Step 5: Run the tests** → PASS

- [ ] **Step 6: Run every gate**

`npx tsc -p tsconfig.json`, `npx tsc -p dashboards/tsconfig.json`, `npx vitest run`, `npx vitest run --project unit`, `npx vitest run --project dashboards`, `npx vitest run --project unit guards/design-naming.test.ts guards/appendix-a.test.ts`, and `vite build` for all three entries.

- [ ] **Step 7: Probe, then revert**

Remove one `<Route>` → that app's "no nav link is dead" test fails naming the route. Revert.

- [ ] **Step 8: Commit**

```bash
git add dashboards/src/apps dashboards/package.json pnpm-lock.yaml
git commit -m "feat(dashboards): mount every route per role, so no nav link is dead"
```

---

## 5. Commit split, and what proves each one

| # | Commit | Proved by |
| --- | --- | --- |
| 1 | Token wiring: `app.css`, one import per entry, `server.fs.allow` | Two new cases in `guards/dashboards-theme.test.ts` (import order, no value restated, one import per entry); `vite build` emits CSS declaring `--color-ink` for all three entries; probe: drop the frozen import and the property disappears from the built CSS |
| 2 | The 52 screens and the three role lists | New `guards/screen-inventory.test.ts` parses §15.5 to §15.7 and compares; counts 14 / 21 / 17 / 52 written by hand; `roles.test.ts` pins 14 / 35 / 17 and 9 / 28 / 14; probes: rename, re-route, delete a row, each fails |
| 3 | AppShell | Colocated tests: skip link first, `aria-expanded`, one `aria-current`, paused banner on a `:id` route, no `transition` or `animate-`, no `grid-cols-`, the md and xl class contract; probes: `grid-cols-3`, `kpi`, a literal colour, each fails S-43 |
| 4 | `Screen` frame and state ownership | Colocated tests: the title, each of the six states written out by hand, children hidden when a state is set; new `guards/screen-states.test.ts` with a probe tree; probe: a hand-rolled `screen-state-empty` under `src/apps` fails it |
| 4b | The 52 "what fills this" lines, copy only | `fills.test.ts`: every row has one sentence, no banned word on a customer screen, no exclamation mark or em dash, and the 24 Fill-later lines asserted by hand against §15.8 "Unblocked by"; `guards/design-naming.test.ts` stays green |
| 5 | Three routers | Per-app tests: every route in the role list renders its screen, static beats dynamic, unknown route honest; full gate run; `vite build`; probe: delete a `<Route>` and the test names it |

Gates run at every commit: `npx tsc -p tsconfig.json`, `npx tsc -p dashboards/tsconfig.json`, `npx vitest run`, `npx vitest run --project unit`, `npx vitest run --project dashboards`, `npx vitest run --project unit guards/design-naming.test.ts guards/appendix-a.test.ts`. `pnpm lint` and `pnpm e2e` still do not exist.

---

## Decisions, answered by the founder 2026-10-07

All four were open when this plan was written. None is open now, and nothing in the plan waits on a founder answer.

1. **Router.** Install `react-router-dom` pinned exact on major version 6. Confirmed version: **6.30.6**, the registry's `version-6` dist-tag. The lockfile diff is shown before the Task 5 commit.
2. **Standing Authority.** `/authority` is a route always; the sidebar link appears only when its flag is on. The broader Standing Authority question stays open elsewhere; this answer covers the nav only.
3. **Titles.** One `document.title` per app, from the entry HTML. The `<h1>` carries the screen name.
4. **The 52 `fills` lines.** Drafted in one copy-only commit, Task 4b, for review. The 24 Fill-later lines come from §15.8 "Unblocked by". No banned word on a customer screen.

## Self-review notes

- **Spec coverage.** §15.5 to §15.7: Task 2 carries all 52 rows, guarded against the PRD itself. §15.2: Task 3 forbids grid and tiles, with probes. §15.3: the titles are already green from the previous slice, and Task 2's copy is scanned by S-43. §15.4: Task 4 routes all six states through the one component, and Task 3 owns the paused banner. §15.8's definition of a shell — route, nav entry, title, states, S-43 green — is pinned across Tasks 2 to 5.
- **Not covered here, deliberately.** The 28 Fill-now screens' logic, the `ApiClient` and `MockApiClient`, TanStack Query, the org chart's strict-tree validation, and Playwright. Each belongs to a later slice of `docs/superpowers/plans/2026-10-05-v8-seam-and-contract.md`.
- **Type consistency.** `ScreenRow` is defined once in Task 2 and used by Tasks 3, 4 and 5 under that name. `ScreenStateValue` is the existing exported union and is not redefined.
- **Review Focus coverage.** Each of the five lines has a test in the task that owns the code: 1 and 5 in Task 5, 2, 3 and 4 in Task 3.
