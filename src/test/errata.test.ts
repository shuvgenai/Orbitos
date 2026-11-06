import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * The errata guard.
 *
 * `docs/spec-errata.md` records 18 statements in ORBIT-OS_Claude_Code_Build_Prompts.md that
 * are wrong against FD-18 to FD-25, plus four more. The repo copy is deliberately NOT
 * corrected: the canonical source is the OrbitOS project on claude.ai, and patching the copy
 * is the silent drift PRD v9.0 section 2 row 9 exists to end (FD-17).
 *
 * That leaves a trap. Prompts 2 to 5 get pasted out of the repo copy, which still carries
 * every wrong acceptance check, and a reading-order line in CLAUDE.md is advice rather than
 * a check. This is the check.
 *
 * It cannot demand that the old text be gone -- the copy is supposed to still contain it.
 * What it CAN do is keep the errata honest about the document it describes. Each entry below
 * holds one exact fragment of that entry's "Old:" text. If a fragment stops being findable,
 * exactly one of two things happened and both need a person:
 *
 *   1. The canonical copy was corrected and re-copied down. Good -- mark that entry
 *      `STATUS: applied` in docs/spec-errata.md and move its id into APPLIED below.
 *   2. Someone edited the repo copy in place, which FD-17 forbids.
 *
 * Either way the failure names the entry, so an errata list that has quietly stopped
 * matching reality cannot survive a test run. A stale errata file is worse than none.
 */

const PROMPTS = readFileSync(
  join(process.cwd(), 'ORBIT-OS_Claude_Code_Build_Prompts.md'),
  'utf8',
);
const ERRATA = readFileSync(join(process.cwd(), 'docs', 'spec-errata.md'), 'utf8');
const LANDING = readFileSync(
  join(process.cwd(), 'orbitcrew-landing-page-content.md'),
  'utf8',
);
const AUTH = readFileSync(
  join(process.cwd(), 'docs', 'auth-three-portals-build-prompt.md'),
  'utf8',
);

/**
 * One exact fragment of each entry's OLD text -- the wording that must still be in the repo
 * copy while the entry is pending. Short enough to be stable, distinctive enough to be real.
 */
const PENDING: ReadonlyArray<readonly [string, string]> = [
  ['E-1', "type Authority = 'leader' | 'approver' | 'budget';"],
  ['E-2', 'budget: number;       // USD per month'],
  ['E-3', '**Agents valid when:** exactly 1 coordinator; at least 1 specialist'],
  ['E-4', 'cannot remove the Coordinator while other agents exist'],
  ['E-5', '**Agent job templates (9):** Atlas (Coordinator), Scout, Echo, Ledger'],
  ['E-6', '**Tool catalog (10):** Gmail, Google Calendar, Slack, HubSpot, QuickBooks Online'],
  ['E-7', '9 agents, 2 pending requests. Copy from `assets/data/org.js`'],
  ['E-8', '- `map`: person picker (Everyone or one person)'],
  ['E-9', 'randomly changes running, waiting and idle agents and bumps runs and cost'],
  ['E-10', 'authority toggles Leader / Approver / Budget holder'],
  ['E-11', 'hide the Coordinator template once one exists'],
  ['E-12', 'Step 2 is blocked until there is one Coordinator and one specialist'],
  ['E-13', '3. #/map: person picker; per person, a node plus SVG curved connectors'],
  ['E-14', 'Relay and Quill are flagged in the demo office'],
  ['E-15', 'the map and performance show the new agent'],
  ['E-16', 'tables scroll inside their container; the map stacks'],
  ['E-17', '3. Step 2: hire Atlas, Scout, Ledger'],
  ['E-18', "Edit Scout's instructions to version 2"],
  ['E-19', 'ORBIT keeps the sign-in tokens, so agents never see your passwords'],
  ['E-20', 'Selection is by VITE_API_MODE=mock|http.'],
  ['E-21', 'Tailwind 3 + shadcn/ui'],
  // FD-30's URL rename, in the Build Prompts.
  ['E-29', 'three separately deployable dashboards (`/user/`, `/org-admin/`, `/fleet/`)'],
  ['E-30', 'npm run dev serves /user/, /org-admin/ and /fleet/'],
  ['E-31', 'Task: Build the User dashboard at /user/.'],
  ['E-32', 'Task: Build the Super Admin (fleet) dashboard at /fleet/.'],
  ['E-33', '1. Open `/org-admin/`. Dev tools, Start fresh onboarding.'],
  ['E-34', '5. `/user/`: Dev tools, sign in as David.'],
  ['E-35', '6. `/org-admin/` Requests: review, add a guardrail, approve. Open Agent map'],
  ['E-36', '7. `/fleet/`: open the office, confirm runtime ids; provision a new office.'],
  ['E-37', 'app.orbitumai.com/user/`, `/org-admin/`, `/fleet/`'],
];

/** The third errata'd document: Prompt 1.5. Same contract. */
const AUTH_PENDING: ReadonlyArray<readonly [string, string]> = [
  ['E-23', '| `dashboards/user/index.html` | `/login` |'],
  ['E-24', '| `dashboards/org-admin/index.html` | `/org/login` |'],
  ['E-25', '| `dashboards/fleet/index.html` | `/admin/login` |'],
  ['E-26', '(`/login`, `/org/login`, `/admin/login`)'],
  ['E-27', 'If a signed-in User opens `/admin/login`'],
  ['E-28', '- An Org Admin signing in at /admin/login is refused.'],
];

/** Entries whose fix has reached the canonical copy and been re-copied down. */
const APPLIED: ReadonlyArray<string> = [];

/**
 * Entries that correct no wording, so there is nothing in the copy to anchor to. Only a
 * build choice the prompts left open belongs here -- never a correction, which is the whole
 * point of the "every entry has an anchor" test below.
 */
const NO_ANCHOR: ReadonlyArray<readonly [string, string]> = [
  ['E-22', 'Prompt 1 names no linter; it only requires that lint passes.'],
];

/**
 * The second errata'd document: orbitcrew-landing-page-content.md. Same contract -- these
 * fragments must still be present while the entry is pending.
 */
const LANDING_PENDING: ReadonlyArray<readonly [string, string]> = [
  ['L-2', '**Brand:** Orbitcrew'],
  ['L-4', '**Logo text:** Orbitcrew'],
  ['L-9', 'cool blue-grey background, deep navy text, blue accent'],
  ['L-10', 'Choose one of the three options in section 6'],
];

/** L-1 to L-8 are one count, not eight fragments: the brand casing, everywhere it appears. */
const LANDING_LOWERCASE_BRAND_COUNT = 8;

describe('the errata still describes the Build Prompts copy', () => {
  it.each(PENDING)('%s: its old text is still in the repo copy', (id, fragment) => {
    expect(
      PROMPTS.includes(fragment),
      `${id}'s old text is gone from ORBIT-OS_Claude_Code_Build_Prompts.md.\n` +
        `Either the canonical copy was corrected and re-copied down -- mark ${id} ` +
        `STATUS: applied in docs/spec-errata.md and move it to APPLIED in this file -- ` +
        `or the repo copy was edited in place, which FD-17 forbids.\n` +
        `Fragment: ${fragment}`,
    ).toBe(true);
  });

  it('every pending entry is actually written up in the errata file', () => {
    for (const [id] of PENDING) {
      expect(ERRATA.includes(`## ${id} `), `${id} has an anchor here but no entry in the errata`).toBe(
        true,
      );
    }
  });

  it.each(AUTH_PENDING)('%s: its old text is still in the Prompt 1.5 copy', (id, fragment) => {
    expect(
      AUTH.includes(fragment),
      `${id}'s old text is gone from docs/auth-three-portals-build-prompt.md. Either the ` +
        `canonical copy was corrected and re-copied down -- mark ${id} STATUS: applied -- ` +
        `or the repo copy was edited in place, which FD-17 forbids.
Fragment: ${fragment}`,
    ).toBe(true);
  });

  it.each(LANDING_PENDING)('%s: its old text is still in the landing content spec', (id, fragment) => {
    expect(
      LANDING.includes(fragment),
      `${id}'s old text is gone from orbitcrew-landing-page-content.md. Either the ` +
        `canonical copy was corrected and re-copied down -- mark ${id} STATUS: applied -- ` +
        `or the repo copy was edited in place, which FD-17 forbids.
Fragment: ${fragment}`,
    ).toBe(true);
  });

  it('the landing spec still spells the brand with a lowercase c eight times (L-1 to L-8)', () => {
    // This is the real assertion behind L-1 to L-8: a count, not eight separate fragments.
    // `orbitcrew.com` / `orbitcrew.ai` in section 5 are domains and correctly lowercase, so
    // they are not counted -- the regex requires the capital O.
    const hits = LANDING.match(/Orbitcrew/g) ?? [];
    expect(hits).toHaveLength(LANDING_LOWERCASE_BRAND_COUNT);
    // And the page we actually built uses the correct casing, which is the point.
    expect(LANDING.includes('OrbitCrew')).toBe(false);
  });

  it('every errata entry has an anchor here, so none can be forgotten', () => {
    const ids = [...ERRATA.matchAll(/^## (E-\d+) /gm)].map((m) => m[1]!);
    const covered = new Set([
      ...PENDING.map(([id]) => id),
      ...APPLIED,
      ...NO_ANCHOR.map(([id]) => id),
      ...LANDING_PENDING.map(([id]) => id),
      ...AUTH_PENDING.map(([id]) => id),
    ]);
    const missing = ids.filter((id) => !covered.has(id));
    expect(missing, `errata entries with no anchor in src/test/errata.test.ts: ${missing}`).toEqual(
      [],
    );
  });

  it('an applied entry has really gone from the copy', () => {
    for (const id of APPLIED) {
      const anchor = PENDING.find(([pendingId]) => pendingId === id);
      expect(anchor, `${id} is in both PENDING and APPLIED`).toBeUndefined();
    }
  });

  it('the count in both CLAUDE.md files matches the number of answer-driven entries', () => {
    // 18 come from the founder's answers; E-19 to E-22 are carried from Prompt 0 section 4
    // and the two build deviations. If that split changes, both files have to say so.
    const answerDriven = PENDING.filter(([id]) => Number(id.slice(2)) <= 18).length;
    expect(answerDriven).toBe(18);
    expect(readFileSync(join(process.cwd(), 'CLAUDE.md'), 'utf8')).toContain(
      '18 of its statements are stale',
    );
  });
});
