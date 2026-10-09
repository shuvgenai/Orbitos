// The harness proves itself.
//
// There are no screens yet, so the obvious move is an empty Playwright run,
// which reports green while proving nothing: the end-to-end and accessibility
// rows of spec section 8 would stay green through a CI image that cannot launch
// a browser at all. Instead these three run against a fixture page carrying one
// known serious defect, so a green run means the browser launched, axe ran, and
// the shared helper reads the result correctly.
import { expect, test } from '@playwright/test';
import { axeViolations, expectNoSeriousViolations } from './axe.ts';

test('a browser really loads a page in this environment', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#ok')).toHaveText(/prove the browser and axe both run/);
});

test('axe really runs and really reports a known defect', async ({ page }) => {
  await page.goto('/');
  const found = await axeViolations(page);
  expect(found.map((v) => v.id)).toContain('image-alt');
});

test('expectNoSeriousViolations is quiet on the page without the defect', async ({ page }) => {
  // A second page rather than removing the image from this one. Deleting a node
  // in the browser means a DOM-typed callback, and the root tsconfig project is
  // Node-only: lib es2024, types node, no DOM. Two served pages say the same
  // thing without asking the typecheck gate to loosen for a test.
  await page.goto('/clean.html');
  await expectNoSeriousViolations(page);
});
