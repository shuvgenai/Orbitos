import { expect, test } from '@playwright/test';

/**
 * Horizontal overflow, measured in a real browser at the widths the founder named.
 *
 * This is the test that could not be written in jsdom: it has no layout engine, so
 * `scrollWidth` there is meaningless and a clipped page passes. The founder's report --
 * the header button cut off at the right edge, the demo card running past the viewport --
 * was invisible to 225 passing unit tests.
 *
 * The cause was `min-width: auto` on grid items: a grid child's default minimum is its
 * widest unbreakable content, so the ten-chip row pushed the track wider than the viewport
 * instead of wrapping inside it. `min-w-0` on both children is the fix.
 */
const WIDTHS = [375, 768, 1024, 1280, 1440] as const;

/** Every public path, so no page is checked by accident of being the default. */
const PAGES = [
  ['the root page', '/'],
  ['the user sign-in', '/login'],
  ['the org admin sign-in', '/org/login'],
  ['the operator sign-in', '/superadmin/login'],
] as const;

for (const [name, path] of PAGES) {
  for (const width of WIDTHS) {
    test(`${name} has no horizontal overflow at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(path);
      await page.waitForSelector('h1');

      const measured = await page.evaluate(() => {
        const d = document.documentElement;
        const vw = d.clientWidth;
        const offenders = [...document.querySelectorAll<HTMLElement>('body *')]
          .map((el) => ({ el, r: el.getBoundingClientRect() }))
          .filter(({ r }) => r.width > 0 && (r.right > vw + 1 || r.left < -1))
          .slice(0, 8)
          .map(({ el, r }) => ({
            tag: el.tagName.toLowerCase(),
            cls: String(el.className).slice(0, 60),
            text: (el.textContent ?? '').trim().slice(0, 30),
            left: Math.round(r.left),
            right: Math.round(r.right),
          }));
        return { scrollWidth: d.scrollWidth, clientWidth: vw, offenders };
      });

      // The assertion the founder asked for, and the reason printed with it.
      expect(
        measured.scrollWidth,
        `scrollWidth ${measured.scrollWidth} > clientWidth ${measured.clientWidth}. ` +
          `Elements outside the viewport: ${JSON.stringify(measured.offenders, null, 1)}`,
      ).toBeLessThanOrEqual(measured.clientWidth);

      // And nothing clipped, which overflow alone would not catch if a parent hid it.
      expect(measured.offenders, 'elements extend past the viewport edge').toEqual([]);
    });
  }
}

test.describe('the root page layout', () => {
  test('stacks below 860px, hero first, and sits in two columns above it', async ({ page }) => {
    await page.goto('/');

    await page.setViewportSize({ width: 820, height: 900 });
    const stacked = await page.evaluate(() => {
      const h1 = document.querySelector('h1')!.getBoundingClientRect();
      const card = document.querySelector('section[aria-label]')!.getBoundingClientRect();
      return { heroTop: h1.top, cardTop: card.top, sameColumn: Math.abs(h1.left - card.left) < 2 };
    });
    expect(stacked.cardTop).toBeGreaterThan(stacked.heroTop);
    expect(stacked.sameColumn, 'stacked, so both start at the same left edge').toBe(true);

    await page.setViewportSize({ width: 1024, height: 900 });
    const columns = await page.evaluate(() => {
      const h1 = document.querySelector('h1')!.getBoundingClientRect();
      const card = document.querySelector('section[aria-label]')!.getBoundingClientRect();
      return { heroLeft: h1.left, cardLeft: card.left };
    });
    expect(columns.cardLeft, 'two columns, so the card starts to the right').toBeGreaterThan(
      columns.heroLeft + 100,
    );
  });

  test('the ten chips wrap and stay inside the card at 375px', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 900 });
    await page.goto('/');

    const chips = await page.evaluate(() => {
      const card = document.querySelector('section[aria-label]')!.getBoundingClientRect();
      const tabs = [...document.querySelectorAll<HTMLElement>('[role=tab]')];
      const rows = new Set(tabs.map((t) => Math.round(t.getBoundingClientRect().top)));
      return {
        count: tabs.length,
        rows: rows.size,
        allInsideCard: tabs.every((t) => t.getBoundingClientRect().right <= card.right + 1),
      };
    });
    expect(chips.count).toBe(10);
    expect(chips.rows, 'ten chips wrap onto several rows on a phone').toBeGreaterThan(1);
    expect(chips.allInsideCard).toBe(true);
  });

  test('scrolls vertically rather than clipping (FD-30 deviation)', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 700 });
    await page.goto('/');

    const measured = await page.evaluate(() => {
      const d = document.documentElement;
      const last = document.querySelector('footer')!.getBoundingClientRect();
      return { scrollHeight: d.scrollHeight, clientHeight: d.clientHeight, footerBottom: last.bottom };
    });
    // The page is taller than the phone, and that is the point: content decides the height.
    expect(measured.scrollHeight).toBeGreaterThan(measured.clientHeight);
    // Nothing is hidden to achieve a single screen: every piece of copy is still present.
    for (const text of [
      'You approve every message',
      'Your own private instance',
      'Every action and cost on record',
    ]) {
      await expect(page.getByText(text)).toBeVisible();
    }
  });
});

test.describe('the FD-30 URL scheme', () => {
  test('each sign-in path serves its own portal', async ({ page }) => {
    for (const [path, title, heading] of [
      ['/login', 'OrbitCrew', 'Sign in'],
      ['/org/login', 'OrbitCrew', 'Sign in'],
      ['/superadmin/login', 'ORBIT-OS', 'Operator sign-in'],
    ] as const) {
      await page.goto(path);
      await expect(page).toHaveTitle(title);
      await expect(page.getByRole('heading', { level: 2 })).toHaveText(heading);
    }
  });

  test('the replaced paths redirect rather than 404', async ({ page }) => {
    for (const [old, landed] of [
      ['/user/', '/user'],
      ['/org-admin/', '/orgadmin'],
      ['/fleet/', '/superadmin'],
      ['/admin/login', '/superadmin/login'],
    ] as const) {
      const response = await page.goto(old);
      expect(response?.status(), `${old} should not 404`).toBeLessThan(400);
      expect(new URL(page.url()).pathname, `${old} should land on ${landed}`).toBe(landed);
    }
  });

  test('the root page offers two sign-ins and names no operator path', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('link', { name: 'Sign in', exact: true })).toHaveAttribute(
      'href',
      '/login',
    );
    await expect(page.getByRole('link', { name: 'Org Admin sign in' })).toHaveAttribute(
      'href',
      '/org/login',
    );
    const html = await page.content();
    expect(html).not.toContain('superadmin');
    expect(html).not.toContain('ORBIT-OS');
  });
});
