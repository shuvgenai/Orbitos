// The shared accessibility assertion. Spec section 8 requires zero serious and
// zero critical findings, per route, run in each phase rather than once at the
// end, so every Playwright spec in the project calls this rather than building
// its own axe run.
// The named import, not the default. @axe-core/playwright is CommonJS and this
// repo does not set esModuleInterop, so a default import resolves to the module
// namespace and `new AxeBuilder(...)` fails to typecheck with TS2351.
import { AxeBuilder } from '@axe-core/playwright';
import { expect } from '@playwright/test';
import type { Page } from '@playwright/test';

/**
 * The serious and critical findings on the page as it stands.
 *
 * Exported as well as used below, because the harness spec has to assert that
 * axe found a specific known defect, which an assertion that only reports
 * "none" cannot do.
 */
export async function axeViolations(page: Page) {
  const { violations } = await new AxeBuilder({ page }).analyze();
  return violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
}

/**
 * Fail unless the page has no serious and no critical findings.
 *
 * The expectation compares lists of strings rather than a count, so a failure
 * names the rule and how many nodes broke it instead of saying 3 is not 0.
 */
export async function expectNoSeriousViolations(page: Page) {
  const found = await axeViolations(page);
  expect(found.map((v) => `${v.id}: ${v.nodes.length} node(s)`)).toEqual([]);
}
