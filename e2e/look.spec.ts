import { expect, test } from '@playwright/test';

/**
 * Not an assertion suite -- a look. It captures what the page actually renders at the two
 * widths the founder asked to see, and prints the measurements that matter, so the report
 * says what was observed rather than only that a test passed.
 *
 * Screenshots land in e2e/shots/, which is git-ignored.
 */
for (const [label, width, height] of [
  ['375', 375, 812],
  ['1280', 1280, 800],
] as const) {
  test(`look at the root page at ${label}px`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.goto('/');
    await page.waitForSelector('h1');

    const seen = await page.evaluate(() => {
      const d = document.documentElement;
      const box = (sel: string) => {
        const el = document.querySelector(sel);
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return { left: Math.round(r.left), right: Math.round(r.right), top: Math.round(r.top) };
      };
      const tabs = [...document.querySelectorAll<HTMLElement>('[role=tab]')];
      return {
        viewport: `${d.clientWidth}x${d.clientHeight}`,
        scrollWidth: d.scrollWidth,
        horizontalOverflow: d.scrollWidth > d.clientWidth,
        pageHeight: d.scrollHeight,
        scrollsVertically: d.scrollHeight > d.clientHeight,
        header: box('header'),
        requestButtonInHeader: box('header nav a:last-of-type'),
        hero: box('h1'),
        card: box('section[aria-label]'),
        footer: box('footer'),
        chipRows: new Set(tabs.map((t) => Math.round(t.getBoundingClientRect().top))).size,
        chipsRightmost: Math.max(...tabs.map((t) => Math.round(t.getBoundingClientRect().right))),
        signInLinks: [...document.querySelectorAll('header nav a')].map(
          (a) => `${a.textContent?.trim()} -> ${a.getAttribute('href')}`,
        ),
        everyTrustLineVisible: [
          'You approve every message',
          'Your own private instance',
          'Every action and cost on record',
        ].every((t) => document.body.innerText.includes(t)),
      };
    });

    // eslint-disable-next-line no-console
    console.log(`\n=== root page at ${label}px ===\n${JSON.stringify(seen, null, 2)}`);
    await page.screenshot({ path: `e2e/shots/root-${label}.png`, fullPage: true });

    expect(seen.horizontalOverflow).toBe(false);
    expect(seen.everyTrustLineVisible).toBe(true);
  });
}
