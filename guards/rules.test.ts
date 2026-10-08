// The governance documents exist, and each one says the thing it exists to say.
//
// Task 2 of docs/superpowers/plans/2026-10-05-v8-seam-and-contract.md is five
// documents and two guards. This is the first guard. It checks the five
// documents; guards/standing-rules.test.ts checks the two founder rules that
// outlive any one document.
//
// Seven checks, eight cases. The plan's prose said seven and then listed six,
// and the count is recorded here because neither number is what vitest prints:
// the threat-model check is a test.each over two files, so seven test blocks
// report as eight cases. A check added later changes this sentence with it.
//
// Shape, never content, for the reason guards/decisions-log.test.ts already
// gives: this file cannot tell a threat model from a document that names five
// threats and says nothing useful about any of them. What it prevents is a
// document landing empty, or landing without the one sentence that makes it
// load-bearing, which is the failure that happens when a task is finished in a
// hurry.
//
// It reads through readRepoFile, so a missing document fails with ENOENT naming
// the path. That is the intended failure before the documents exist, and it is
// why this guard was committed red.
import { expect, test } from 'vitest';
import { readRepoFile } from './lib/walk.ts';

/**
 * The phrases that confine work to the browser. They belong in
 * `dashboards/CLAUDE.md` and nowhere else.
 *
 * Checked in both directions, because one direction alone is useless. Absent
 * from the root file, they cannot gate the engine stream; present in the
 * dashboards file, the rule still exists. A guard that only checked the root
 * would pass on the day somebody deleted the rule outright.
 */
const BROWSER_ONLY = [/frontend only/i, /no backend/i, /no database/i, /MockApiClient/] as const;

/** The five threats, named in PRD section 14 and in the plan's Step 7. */
const THREATS = [
  /prompt injection/i,
  /tool it was not granted/i,
  /bypass(es)? the Action Gateway/i,
  /secret leakage/i,
  /one office read/i,
] as const;

/**
 * The four labelled parts every threat carries. A threat with an attack and no
 * control is a worry; a threat with a control and no test is a claim.
 */
const PARTS = [/attack/i, /control/i, /test that proves/i, /when the control fails/i] as const;

const THREAT_MODELS = ['docs/security/threat-model-engine.md', 'docs/security/threat-model-gateway.md'] as const;

/**
 * The governance documents, and only these.
 *
 * The dated-checkpoint rule is scoped to this list on purpose (founder
 * decision, 2026-10-08). A plan may say "week 3" and mean it: a plan is a
 * statement of intent by the person writing it. A governance document is read
 * as a commitment by everybody else, and "week 3" in one is a date nobody
 * agreed to that a later reader treats as agreed.
 */
const GOVERNANCE = [
  'CLAUDE.md',
  'dashboards/CLAUDE.md',
  'docs/rules/engine.md',
  'docs/decisions.md',
  ...THREAT_MODELS,
  'docs/security/keys.md',
] as const;

/**
 * Shapes a credential has. Named, so a failure says what it thinks it found.
 *
 * The last two are shape rules rather than vendor rules: 64 hex characters is
 * the shape TOKEN_ENCRYPTION_KEY has, and a 40-character run of base64 is long
 * enough that no English word and no key name reaches it. A git SHA would trip
 * the second one, which is correct for this file: docs/security/keys.md is an
 * inventory of names, and a long opaque string in it is either a secret or
 * something that needs to be somewhere else.
 */
const SECRET_SHAPED = [
  ['an AWS access key id', /AKIA[0-9A-Z]{16}/],
  ['an sk- prefixed API key', /\bsk-[A-Za-z0-9_-]{16,}/],
  ['a Resend key', /\bre_[A-Za-z0-9]{16,}/],
  ['a GitHub token', /\b(gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,})/],
  ['a Slack token', /\bxox[abprs]-[A-Za-z0-9-]{10,}/],
  ['a Google API key', /\bAIza[0-9A-Za-z_-]{30,}/],
  ['a JWT', /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\./],
  ['64 hex characters, the shape TOKEN_ENCRYPTION_KEY has', /\b[0-9a-fA-F]{64}\b/],
  ['a run of 40 or more base64 characters', /[A-Za-z0-9+/]{40,}={0,2}/],
] as const satisfies readonly (readonly [string, RegExp])[];

test('the root rules file holds no rule that confines work to the browser', () => {
  const root = readRepoFile('CLAUDE.md');
  const found = BROWSER_ONLY.filter((rule) => rule.test(root)).map(String);

  // Named rather than counted, because the fix depends on which phrase it is.
  expect(found, 'these belong in dashboards/CLAUDE.md, not at the root').toEqual([]);
});

test('the browser-only rule does live in the dashboards rules file', () => {
  const dashboards = readRepoFile('dashboards/CLAUDE.md');
  const missing = BROWSER_ONLY.filter((rule) => !rule.test(dashboards)).map(String);

  expect(missing, 'the rule was moved or deleted, not just scoped').toEqual([]);
});

test('the engine rules file requires a threat model before any code', () => {
  const engine = readRepoFile('docs/rules/engine.md');

  expect(engine).toMatch(/threat model/i);
  expect(engine).toMatch(/before (any )?code/i);
});

test.each(THREAT_MODELS)('%s names all five threats and the four parts each one needs', (path) => {
  const text = readRepoFile(path);

  const unnamed = THREATS.filter((threat) => !threat.test(text)).map(String);
  expect(unnamed, 'every threat in PRD section 14 appears in both models').toEqual([]);

  const unlabelled = PARTS.filter((part) => !part.test(text)).map(String);
  expect(unlabelled, 'a threat needs the attack, the control, the test and the failure mode').toEqual([]);
});

test('no governance document promises a dated checkpoint', () => {
  const promising = GOVERNANCE.filter((path) => /\bweek *\d/i.test(readRepoFile(path)));

  expect(promising, 'name the owner and the condition instead of a week number').toEqual([]);
});

test('the key inventory records what TYPESAFE_API_KEY actually is', () => {
  const keys = readRepoFile('docs/security/keys.md');

  // The one correction this inventory exists to carry: the name says TypeSafe
  // and the value is an OpenRouter key, so anybody rotating it by its name
  // rotates the wrong thing in the wrong console.
  expect(keys).toMatch(/TYPESAFE_API_KEY/);
  expect(keys).toMatch(/OpenRouter/i);
});

test('the key inventory holds names only, and no value shaped like a credential', () => {
  const lines = readRepoFile('docs/security/keys.md').split('\n');
  const found: string[] = [];

  for (const [index, line] of lines.entries()) {
    for (const [name, shape] of SECRET_SHAPED) {
      // The line number and the shape's name, never the matched text. A guard
      // that printed the value would put it in CI logs, which is the same
      // mistake that put one in this repository's history on 2026-10-08.
      if (shape.test(line)) found.push(`docs/security/keys.md:${index + 1} looks like ${name}`);
    }
  }

  expect(found, 'this file lists key names; values live in .env.local only').toEqual([]);
});
