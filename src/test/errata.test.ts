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

  it('every errata entry has an anchor here, so none can be forgotten', () => {
    const ids = [...ERRATA.matchAll(/^## (E-\d+) /gm)].map((m) => m[1]!);
    const covered = new Set([
      ...PENDING.map(([id]) => id),
      ...APPLIED,
      ...NO_ANCHOR.map(([id]) => id),
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
