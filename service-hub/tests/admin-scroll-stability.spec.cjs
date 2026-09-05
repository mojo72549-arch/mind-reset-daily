const { test, expect } = require('@playwright/test');

test.use({ viewport: { width: 390, height: 844 } });

test('Admin settings stay mounted and scroll position stays stable on mobile', async ({ page }) => {
  await page.goto('/?role=admin');
  await page.getByRole('button', { name: 'Anmelden' }).click();
  await expect(page.locator('.ux-admin-title h2')).toHaveText('Administration');
  await expect(page.locator('nav.mobile button')).toHaveCount(2);

  const start = await page.evaluate(() => {
    const title = document.querySelector('.ux-admin-title');
    const main = document.querySelector('main.shell');
    title.dataset.scrollProbe = 'stable';
    window.__adminMainMutations = 0;
    window.__adminScrollObserver = new MutationObserver(records => {
      window.__adminMainMutations += records.reduce((sum, record) => sum + record.addedNodes.length + record.removedNodes.length, 0);
    });
    window.__adminScrollObserver.observe(main, { childList: true, subtree: true });
    const max = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
    const target = Math.min(520, Math.max(180, max - 40));
    window.scrollTo(0, target);
    return { y: window.scrollY, target, max };
  });

  expect(start.max).toBeGreaterThan(200);
  await page.waitForTimeout(1000);

  await expect(page.locator('.ux-admin-title')).toHaveAttribute('data-scroll-probe', 'stable');
  const end = await page.evaluate(() => ({ y: window.scrollY, mutations: window.__adminMainMutations || 0 }));
  expect(Math.abs(end.y - start.y)).toBeLessThanOrEqual(3);
  expect(end.mutations).toBeLessThanOrEqual(2);
});
