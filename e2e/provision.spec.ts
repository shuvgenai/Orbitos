import { expect, test } from '@playwright/test';

/**
 * The provision and invitation screens, in a real browser.
 *
 * These exist for one specific risk the jsdom suite cannot see: the result screen prints a
 * **64-character hex token inside a URL**, which has no break opportunity in it at all. That
 * is the same class of defect as the founder's earlier report -- a grid child's minimum being
 * its widest unbreakable content -- and `break-all` is the thing being verified here, not
 * assumed.
 *
 * It also walks the whole flow end to end, which no unit test does: sign in, provision,
 * copy the link, open it, set a password, land on onboarding.
 */

const WIDTHS = [375, 768, 1280] as const;

const ACME = {
  name: 'Acme Ltd',
  domain: 'office.acme.com',
  admin: 'Ada Okonkwo',
  email: 'ada@acme.com',
};

/** Every test starts from a clean document, so an earlier run cannot satisfy a later one. */
async function freshOperator(page: import('@playwright/test').Page) {
  await page.goto('/superadmin/login');
  await page.evaluate(() => window.localStorage.clear());
  await page.goto('/superadmin/login');
  await page.getByLabel('Email address').fill('shuv@orbitumai.com');
  await page.getByLabel('Password').fill('orbitcrew-dev');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('table')).toBeVisible();
}

async function provisionAcme(page: import('@playwright/test').Page) {
  await page.goto('/superadmin#/provision');
  await page.getByLabel('Business name').fill(ACME.name);
  await page.getByLabel('Office domain').fill(ACME.domain);
  await page.getByLabel('Org Admin name').fill(ACME.admin);
  await page.getByLabel('Org Admin email').fill(ACME.email);
  await page.getByRole('button', { name: /Create office and invite/ }).click();
  await expect(page.getByText(/awaiting onboarding/i)).toBeVisible({ timeout: 15_000 });
}

/**
 * scrollWidth plus a per-element check, so a parent hiding the overflow cannot mask it.
 *
 * Unlike `layout.spec.ts`'s version this one **skips anything inside a deliberately
 * scrollable box**. `Table` wraps itself in `overflow-x-auto`, so the six-column fleet table
 * is 751px wide at 375px *by design* and the page itself still does not scroll sideways.
 * Flagging it was a false positive in the first draft of this file -- the page is fine, the
 * check was wrong.
 */
async function overflow(page: import('@playwright/test').Page) {
  return page.evaluate(() => {
    const d = document.documentElement;
    const vw = d.clientWidth;
    const scrollable = (el: HTMLElement): boolean => {
      for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
        const x = getComputedStyle(p).overflowX;
        if (x === 'auto' || x === 'scroll') return true;
      }
      return false;
    };
    const offenders = [...document.querySelectorAll<HTMLElement>('body *')]
      .filter((el) => !scrollable(el))
      .map((el) => ({ el, r: el.getBoundingClientRect() }))
      .filter(({ r }) => r.width > 0 && (r.right > vw + 1 || r.left < -1))
      .slice(0, 8)
      .map(({ el, r }) => ({
        tag: el.tagName.toLowerCase(),
        cls: String(el.className).slice(0, 60),
        text: (el.textContent ?? '').trim().slice(0, 40),
        right: Math.round(r.right),
      }));
    return { scrollWidth: d.scrollWidth, clientWidth: vw, offenders };
  });
}

test.describe('the operator provision flow', () => {
  for (const width of WIDTHS) {
    test(`the 64-character invite link does not overflow at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await freshOperator(page);
      await provisionAcme(page);

      // The link really is on the page and really is unbreakable text.
      const url = await page
        .getByRole('region', { name: 'Invitation link' })
        .getByText(/\/orgadmin#\/invite\//)
        .innerText();
      expect(url).toMatch(/invite\/[0-9a-f]{64}$/);

      const m = await overflow(page);
      expect(
        m.scrollWidth,
        `scrollWidth ${m.scrollWidth} > clientWidth ${m.clientWidth}. ` +
          `Outside the viewport: ${JSON.stringify(m.offenders, null, 1)}`,
      ).toBeLessThanOrEqual(m.clientWidth);
      expect(m.offenders, 'elements extend past the viewport edge').toEqual([]);
    });
  }

  test('the provision form and the fleet table do not overflow at 375px', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 900 });
    await freshOperator(page);

    const table = await overflow(page);
    expect(table.offenders, 'the fleet screen at 375px').toEqual([]);
    // The six-column table scrolls inside its own box; the PAGE must not.
    expect(table.scrollWidth).toBeLessThanOrEqual(table.clientWidth);

    await page.goto('/superadmin#/provision');
    await page.waitForSelector('input');
    const form = await overflow(page);
    expect(form.offenders, 'the provision form at 375px').toEqual([]);
  });

  test('walks the whole flow: provision, open the link, set a password, land on onboarding', async ({
    page,
  }) => {
    await freshOperator(page);
    await provisionAcme(page);

    // Scoped to the result panel: the same URL is also listed in the operator's Dev tools.
    const url = (
      await page
        .getByRole('region', { name: 'Invitation link' })
        .getByText(/\/orgadmin#\/invite\//)
        .innerText()
    ).trim();

    // The office is in the table, awaiting its Org Admin.
    await page.goto('/superadmin#/fleet');
    await expect(page.locator('tr', { hasText: 'Acme Ltd' })).toContainText(
      'Awaiting onboarding',
    );

    // Open the link exactly as the invitee would, from the URL on the screen.
    await page.goto(url);
    await expect(page.getByText(/Ada Okonkwo/)).toBeVisible();
    await expect(page.getByText(/Acme Ltd/)).toBeVisible();
    await page.getByLabel('Choose a password').fill('ada-first-password');
    await page.getByRole('button', { name: /Set password and continue/ }).click();

    // Landed in HER office, on onboarding, with the customer title (PRD 15.3).
    await expect(page).toHaveURL(/#\/onboarding$/);
    await expect(page).toHaveTitle(/OrbitCrew$/);
    await expect(page.locator('aside')).toContainText('Acme Ltd');

    // S-23: the operator's two actions are in HER office's audit, where she can read them.
    const audit = await page.evaluate(() => {
      // `window.localStorage`, not the bare global: this runs in the page under test, but
      // the file is still linted by the rule that keeps app code off storage, and the e2e
      // folder is not in that rule's test-file exemption.
      const doc = JSON.parse(window.localStorage.getItem('orbitcrew.v1') ?? '{}');
      const acme = Object.values(doc.instances as Record<string, { org: { name: string }; audit: { who: string; what: string }[] }>)
        .find((o) => o.org.name === 'Acme Ltd');
      return acme?.audit.map((a) => `${a.who}: ${a.what}`) ?? [];
    });
    expect(audit.some((a) => a.includes('Office created for Acme Ltd'))).toBe(true);
    expect(audit.some((a) => a.includes('Invitation issued to ada@acme.com'))).toBe(true);

    // The fleet row moved on its own, because the status is derived.
    await page.goto('/superadmin#/fleet');
    await expect(page.locator('tr', { hasText: 'Acme Ltd' })).toContainText(
      'Org Admin onboarding',
    );

    // And the link is spent.
    await page.goto(url);
    await expect(page.getByText('This invitation has already been used.')).toBeVisible();
    // Refuse, never redirect: no way out of this screen but asking for a new invitation.
    expect(await page.locator('main a').count()).toBe(0);
  });

  test('says nothing was emailed, and never claims a send', async ({ page }) => {
    await freshOperator(page);
    await provisionAcme(page);
    const body = (await page.locator('body').innerText()).toLowerCase();
    expect(body).toContain('nothing has been emailed');
    for (const lie of ['email sent', 'sent an email', 'invitation sent', 'we emailed']) {
      expect(body, `must not claim: ${lie}`).not.toContain(lie);
    }
  });
});
