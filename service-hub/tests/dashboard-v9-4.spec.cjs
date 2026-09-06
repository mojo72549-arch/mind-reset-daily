const { test, expect } = require('@playwright/test');

async function login(page, role) {
  await page.goto('/?role=' + role);
  await page.getByRole('button', { name: 'Anmelden' }).click();
  await expect(page.locator('header.top')).toBeVisible();
  await expect(page.locator('.crm-start-slim-v12')).toBeVisible();
}

for (const role of ['dome','annette']) {
  test(`${role} gets the same useful, compact start dashboard`, async ({ page }) => {
    await login(page, role);
    const dashboard = page.locator('.crm-start-slim-v12');
    await expect(dashboard).toHaveAttribute('data-build', '20260906-v14-start1');
    await expect(page.locator('.crm-start-hero-v14')).toBeVisible();
    await expect(page.locator('.crm-start-status-tile')).toHaveCount(3);
    await expect(page.getByText('Offene Aufträge', { exact: true })).toBeVisible();
    await expect(page.getByText('Offene Rapporte', { exact: true })).toBeVisible();
    await expect(page.getByText('Offene Rechnungen', { exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Nächste Aufträge' })).toBeVisible();
    await expect(page.locator('.crm-slim-order')).toHaveCount(1);

    const overflow = await dashboard.evaluate((el) => ({
      right: el.getBoundingClientRect().right,
      viewport: window.innerWidth,
      docWidth: document.documentElement.scrollWidth
    }));
    expect(overflow.right).toBeLessThanOrEqual(overflow.viewport + 1);
    expect(overflow.docWidth).toBeLessThanOrEqual(overflow.viewport + 1);
  });
}

test('start status tiles navigate directly to the working areas', async ({ page }) => {
  await login(page, 'annette');
  await page.locator('.crm-start-status-tile').filter({ hasText: 'Offene Aufträge' }).click();
  await expect(page.locator('main h2')).toHaveText('Aufträge');
  await page.evaluate(() => SH.go('home'));
  await expect(page.locator('.crm-start-slim-v12')).toBeVisible();
  await page.locator('.crm-start-status-tile').filter({ hasText: 'Offene Rapporte' }).click();
  await expect(page.locator('main h2')).toHaveText('Rapporte');
});
