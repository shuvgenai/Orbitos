import { describe, expect, test } from 'vitest';
import { SCREENS } from './screens';

// The section 15.4 empty state, for all 52 screens: what appears here, and the
// one action or condition that fills it.
//
// This is a copy review in test form. It cannot judge whether a sentence reads
// well, so it pins the rules that can be checked: every screen has both lines,
// each is one sentence, the customer screens carry no internal name, and the 24
// Fill-later screens say the thing section 15.8 says they are waiting for.

/** Section 15.3, for the User and Org Admin apps. The fleet console is exempt. */
const BANNED = [/ORBIT-OS/i, /Paperclip/i, /Hermes/i, /OpenClaw/i, /\bMCP\b/, /\btokens?\b/i, /adapter/i];

/** Words that are true of the build but mean nothing to the person reading. */
const INTERNAL = [/\bstream [ab]\b/i, /\bCD-\d/i, /open decision/i, /\bS-\d\d/, /\bA-\d\d/, /\bU-\d\d/];

const customers = SCREENS.filter((row) => row.section !== '15.7');

describe('every screen says what appears and what fills it', () => {
  test('both lines are present on all 52', () => {
    expect(SCREENS).toHaveLength(52);
    for (const row of SCREENS) {
      expect(row.appears.length, `${row.route} says nothing about what appears`).toBeGreaterThan(0);
      expect(row.fills.length, `${row.route} says nothing about what fills it`).toBeGreaterThan(0);
    }
  });

  test('what fills it is one sentence, ending in one full stop', () => {
    for (const row of SCREENS) {
      expect(row.fills, `${row.route} must end in a full stop`).toMatch(/\.$/);
      expect(row.fills.slice(0, -1), `${row.route} is more than one sentence`).not.toMatch(/[.!?]/);
    }
  });

  test('what appears is a phrase, not a sentence, so it reads as a label', () => {
    for (const row of SCREENS) expect(row.appears, `${row.route} ends in a full stop`).not.toMatch(/\.$/);
  });

  test('no exclamation mark and no em dash anywhere, per the plain-language rule', () => {
    for (const row of SCREENS) {
      expect(`${row.appears} ${row.fills}`, `${row.route}`).not.toMatch(/[!—]/);
    }
  });

  test('no illustration is promised, because section 15.4 forbids one', () => {
    for (const row of SCREENS) {
      expect(`${row.appears} ${row.fills}`.toLowerCase(), `${row.route}`).not.toMatch(/illustration|picture|graphic/);
    }
  });
});

describe('the customer screens name nothing internal', () => {
  test('the 35 customer screens carry no banned word', () => {
    expect(customers).toHaveLength(35);
    for (const row of customers) {
      for (const word of BANNED) {
        expect(`${row.appears} ${row.fills}`, `${row.route} names ${word}`).not.toMatch(word);
      }
    }
  });

  test('no screen, customer or fleet, quotes a stream, a decision or a feature id', () => {
    for (const row of SCREENS) {
      for (const word of INTERNAL) {
        expect(`${row.appears} ${row.fills}`, `${row.route} quotes ${word}`).not.toMatch(word);
      }
    }
  });

  test('the fleet console is the one exempt surface, and it is 17 screens', () => {
    // A reminder, not a rule: a future fleet line that names ORBIT-OS must not
    // be "fixed" to match the customer screens.
    expect(SCREENS.filter((row) => row.section === '15.7')).toHaveLength(17);
  });
});

describe('the 24 Fill-later screens say what section 15.8 says they wait for', () => {
  // Route to the words that must appear, each taken by hand from section 15.8's
  // "Unblocked by" column. Written out rather than parsed: the PRD says things
  // like "the test office producing real numbers", which a customer screen
  // cannot say, so each mapping is a judgment and belongs where it can be read.
  const WAITS_FOR: ReadonlyArray<readonly [string, RegExp]> = [
    ['/reviews', /full week/],
    ['/chat', /running its own work/],
    ['/me', /choose how/i],
    ['/authority', /read only until/],
    ['/rules', /more than once/],
    ['/rules/data', /starts able to see nothing/],
    ['/activity', /first approval/],
    ['/spending/plan', /first full month/],
    ['/results', /full week of work/],
    ['/privacy', /outside tools/],
    ['/data', /ask for a copy/i],
    ['/upgrades', /second office/],
    ['/backups', /first backup/],
    ['/fleet/:id/shutdown', /ask for a shutdown/],
    ['/incidents', /check fails/],
    ['/fleet/:id/view', /consent/],
    ['/money', /full month of cost/],
    ['/quality', /test set runs/],
    ['/library', /rather than fixed/],
    ['/skills', /proposes one/],
    ['/connectors', /connector decisions/],
    ['/connectors/review', /switched off/],
    ['/numbers', /first nightly report/],
    ['/checks', /already run on every build/],
  ];

  test('there are 24 of them, and each is a real route', () => {
    expect(WAITS_FOR).toHaveLength(24);
    for (const [route] of WAITS_FOR) {
      expect(
        SCREENS.some((row) => row.route === route),
        `${route} is not a screen`,
      ).toBe(true);
    }
  });

  test('each one says what it waits for', () => {
    for (const [route, phrase] of WAITS_FOR) {
      const row = SCREENS.find((screen) => screen.route === route);
      expect(row?.fills, `${route} does not say what it waits for`).toMatch(phrase);
    }
  });
});
