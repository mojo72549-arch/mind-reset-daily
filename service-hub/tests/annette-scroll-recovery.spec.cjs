const { test, expect } = require('@playwright/test');

test.use({ viewport: { width: 390, height: 844 } });

test('Annette recovers from a stale body/modal scroll lock and remains scrollable', async ({ page }) => {
  await page.goto('/?role=annette');
  await page.getByRole('button', { name: 'Anmelden' }).click();
  await expect(page.locator('main.shell')).toBeVisible();

  await page.evaluate(() => {
    const spacer = document.createElement('div');
    spacer.id = 'annette-scroll-probe';
    spacer.style.height = '1400px';
    spacer.setAttribute('aria-hidden', 'true');
    document.querySelector('main.shell').appendChild(spacer);

    document.documentElement.classList.add('shp-modal-open');
    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
  });

  await page.waitForTimeout(150);

  const state = await page.evaluate(() => {
    const max = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
    window.scrollTo(0, Math.min(520, max));
    return {
      max,
      y: window.scrollY,
      htmlClass: document.documentElement.className,
      htmlOverflow: getComputedStyle(document.documentElement).overflowY,
      bodyOverflow: getComputedStyle(document.body).overflowY,
      bodyPosition: getComputedStyle(document.body).position
    };
  });

  expect(state.max).toBeGreaterThan(500);
  expect(state.y).toBeGreaterThan(100);
  expect(state.htmlClass).not.toContain('shp-modal-open');
  expect(state.htmlOverflow).not.toBe('hidden');
  expect(state.bodyOverflow).not.toBe('hidden');
  expect(state.bodyPosition).not.toBe('fixed');
});
