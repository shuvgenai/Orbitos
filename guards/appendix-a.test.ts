import { expect, test } from 'vitest';
import { existsExact, readRepoFile } from './lib/walk.ts';

// PRD v9.0 Appendix A is the single home for the product's fixed lists. Code has
// to restate them to work, so this guard catches a restatement drifting from the
// PRD, and catches the appendix itself being deleted.

const PRD_PATH = 'docs/prd/ORBIT_OS_PRD_v9_0.md';

/**
 * The text of ONE section, not the whole document.
 *
 * The first draft of this guard asserted against all 1,081 lines of the PRD,
 * which meant it passed on the words "New" and "Done" and would have stayed
 * green with Appendix A.3 deleted. Throwing on a missing heading is what makes
 * a deleted appendix fail loudly.
 */
function prdSection(heading: string): string {
  const prd = readRepoFile(PRD_PATH);
  // Anchored to a line start and required to end on whitespace. indexOf was
  // wrong: '### A.3' also matches '### A.3x', so renaming a heading sliced the
  // next section silently instead of throwing. The drill caught it.
  const escaped = heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = new RegExp(`^### ${escaped}(?=\\s|$)`, 'm').exec(prd);
  if (!match) throw new Error(`PRD section "${heading}" is missing`);
  const start = match.index;
  const bounds = [prd.indexOf('\n### ', start + 1), prd.indexOf('\n## ', start + 1)].filter((n) => n !== -1);
  return prd.slice(start, bounds.length ? Math.min(...bounds) : prd.length);
}

test('the slicer returns one section, not the document, and throws on a missing heading', () => {
  const a3 = prdSection('A.3');
  expect(a3).toContain('Seven states');
  // Proof the slice is narrow: a phrase from a different section must not be in it.
  expect(a3).not.toContain('Finance Clerk');
  expect(a3.length).toBeLessThan(readRepoFile(PRD_PATH).length / 10);
  expect(() => prdSection('A.99')).toThrow(/PRD section "A.99" is missing/);
  // A heading name must match whole, not as a prefix. Before this was anchored,
  // 'A' matched '### A.1' and a renamed 'A.3x' still matched 'A.3', so a renamed
  // or deleted appendix sliced the wrong text instead of failing.
  expect(() => prdSection('A')).toThrow(/PRD section "A" is missing/);
  expect(() => prdSection('A.')).toThrow(/is missing/);
});

test('A.1 names the five hireable roles and Orbi as the only Coordinator', () => {
  const a1 = prdSection('A.1');
  for (const role of ['Finance Clerk', 'Sales Analyst', 'Support Triager', 'HR Coordinator', 'Operations Reporter']) {
    expect(a1, role).toContain(role);
  }
  expect(a1).toContain('Orbi, the Coordinator');
  expect(a1).toMatch(/Five hireable roles/i);
  // The prototype's nine are parked, not seeded.
  expect(a1).toContain('docs/backlog.md');
});

test('A.2 is the connector catalog and excludes the prototype extras', () => {
  const a2 = prdSection('A.2');
  for (const tool of ['Email', 'Calendar', 'Drive', 'Slack', 'HubSpot', 'Stripe', 'Notion', 'WhatsApp']) {
    expect(a2, tool).toContain(tool);
  }
  for (const parked of ['QuickBooks', 'Intercom', 'Salesforce']) {
    expect(a2, `${parked} must be named as NOT in the catalog`).toContain(parked);
  }
  expect(a2).toMatch(/Not in the catalog/i);
});

test('A.3 names seven task states and says declining is not one of them', () => {
  const a3 = prdSection('A.3');
  for (const state of ['New', 'Assigned', 'In progress', 'Waiting for approval', 'Done', 'Failed', 'Cancelled']) {
    expect(a3, state).toContain(state);
  }
  expect(a3).toMatch(/Seven states/i);
  expect(a3).toMatch(/not a state/i);
});

test('A.4 names four risk categories and the raise-never-lower rule', () => {
  const a4 = prdSection('A.4');
  for (const c of ['Routine', 'Decline or refer', 'High-risk', 'Office change']) expect(a4, c).toContain(c);
  expect(a4).toMatch(/never lower/i);
});

test('A.5 is three numbers per teammate plus a per-connector limit', () => {
  const a5 = prdSection('A.5');
  expect(a5).toMatch(/Monthly budget/i);
  expect(a5).toMatch(/Daily cap/i);
  expect(a5).toMatch(/Turn limit/i);
  expect(a5).toMatch(/per connector/i);
});

test('A.6 is three approval bases with no nullable case', () => {
  const a6 = prdSection('A.6');
  for (const basis of ['Per-action approval', 'Standing template approval', 'Standing Authority']) {
    expect(a6, basis).toContain(basis);
  }
  expect(a6).toMatch(/exactly one/i);
  expect(a6).toMatch(/no nullable/i);
});

test('A.7 lists five things Standing Authority never covers, fixed by the PRD', () => {
  const a7 = prdSection('A.7');
  for (const item of [
    'Hiring or removing people',
    'Signing or agreeing to contracts',
    'Changing roles, limits or budgets',
    'Deleting data',
    'Sending anything to an outside person that is not a fixed approved text',
  ]) {
    expect(a7, item).toContain(item);
  }
  expect(a7).toMatch(/not free text per grant/i);
});

test('7.2 restores Backup approver as a named authority', () => {
  const s72 = prdSection('7.2 Authorities');
  for (const a of ['Leader', 'Approver', 'Backup approver', 'Budget holder']) expect(s72, a).toContain(a);
  expect(s72).toMatch(/moment of each decision/i);
});

// The half that compares these appendix sections against the CODE restating
// them lives in Task 8's acceptance, not here.
//
// It cannot be armed ahead of the code the way the text-scanning guards are. A
// guard that greps files can run before those files exist; one that imports real
// modules cannot. `await import('../contract/...')` is still resolved statically
// by tsc, so it fails `pnpm typecheck` until the package exists, and the only
// way around that is a variable specifier, which buys an any-typed code path
// nobody can verify today. A test that cannot be run is not worth the machinery.
//
// So Task 8 adds, as acceptance: TaskStatusSchema has the seven A.3 options and
// not 'declined'; RiskCategorySchema has the four from A.4; AuthoritySchema
// equals leader, approver, backup, budget per 7.2; NEVER_COVERS matches A.7
// verbatim; each restating file cites its section; the nine parked prototype
// roles appear in no seed; and receipts uses a discriminatedUnion with no
// nullable approver.
/**
 * The seven assertions that compare the CODE restating each fixed list against
 * the appendix slices above. They are written out here, not referenced by task
 * number, so whoever creates the contract does not have to reconstruct them from
 * a plan document that may have moved on by then.
 */
const DUE_WHEN_CONTRACT_EXISTS = [
  "TaskStatusSchema.options has the seven values from the A.3 slice and does not contain 'declined'",
  'RiskCategorySchema.options has the four values from the A.4 slice',
  "AuthoritySchema.options equals ['leader', 'approver', 'backup', 'budget'] per the 7.2 slice",
  'NEVER_COVERS has five entries and each one appears verbatim in the A.7 slice',
  'each restating file cites its section: tasks.ts cites A.3 and A.4, authority.ts cites A.7, ' +
    'org.ts cites 7.2, teammates.ts cites A.5, receipts.ts cites A.6',
  'none of Atlas, Scout, Echo, Ledger, Compass, Beacon, Pulse, Quill or Relay appears in ' +
    'contract/src/v1/teammates.ts, because A.1 parks all nine in docs/backlog.md',
  "receipts.ts contains 'discriminatedUnion' and does not match /approvedById:\\s*Id\\.nullable\\(\\)/",
] as const;

test('once the contract exists, the code-vs-appendix checks are due here', () => {
  // A tripwire on a precondition, not an assertion about today. It stays quiet
  // while the contract is absent and fires the moment the deferred work becomes
  // possible, which is the only moment anyone would otherwise forget it.
  //
  // Asserting the contract is absent would instead be a time bomb: it would fail
  // on the very commit that correctly creates it.
  if (!existsExact('contract/src/experimental/tasks.ts')) return;

  throw new Error(
    [
      'contract/src/experimental/ now exists, so the deferred half of this guard is due.',
      'Add these assertions above this test, then delete this test:',
      ...DUE_WHEN_CONTRACT_EXISTS.map((a, i) => `  ${i + 1}. ${a}`),
      'Use the prdSection() slices already in this file. Do not assert against the whole PRD.',
    ].join('\n'),
  );
});
