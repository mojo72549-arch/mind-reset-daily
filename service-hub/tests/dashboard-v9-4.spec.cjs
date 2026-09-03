const { test, expect } = require('@playwright/test');

async function login(page, role) {
  await page.goto('/?role=' + role);
  await page.getByRole('button', { name: 'Anmelden' }).click();
  await expect(page.locator('header.top')).toBeVisible();
}

test('office overview is a focused CRM work surface instead of a blank metric wall', async ({ page }) => {
  await login(page, 'annette');

  const dashboard = page.locator('.crm-dashboard-v94');
  await expect(dashboard).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('data-sh-dashboard-build', '20260903-v9-4');
  await expect(page.getByRole('heading', { name: 'Was heute wichtig ist' })).toBeVisible();
  await expect(page.getByText('Heute im Blick', { exact: true })).toBeVisible();
  await expect(page.getByText('Direkt weiterarbeiten', { exact: true })).toBeVisible();
  await expect(page.getByText('Nächste Aufträge', { exact: true })).toBeVisible();

  await expect(page.locator('main.shell > .hero')).toHaveCount(0);
  await expect(page.locator('main.shell .grid.g4 .metric')).toHaveCount(0);
  await expect(page.locator('.crm-kpi')).toHaveCount(3);
  await expect(page.locator('.crm-attention-item')).toHaveCount(3);
  await expect(page.getByText('Rechnung 26175', { exact: true })).toBeVisible();
  await expect(page.getByText('Wartung Heizungsanlage', { exact: false }).first()).toBeVisible();

  const metrics = await page.locator('.crm-kpi').allTextContents();
  expect(metrics.join(' ')).toContain('Offene Aufträge');
  expect(metrics.join(' ')).toContain('Rapporte in Bearbeitung');
  expect(metrics.join(' ')).toContain('Offener Rechnungsbetrag');

  const overflow = await dashboard.evaluate((el) => ({
    right: el.getBoundingClientRect().right,
    viewport: window.innerWidth,
    docWidth: document.documentElement.scrollWidth
  }));
  expect(overflow.right).toBeLessThanOrEqual(overflow.viewport + 1);
  expect(overflow.docWidth).toBeLessThanOrEqual(overflow.viewport + 1);
});

test('dashboard attention items are actionable without detours', async ({ page }) => {
  await login(page, 'annette');
  await expect(page.locator('.crm-dashboard-v94')).toBeVisible();

  await page.getByRole('button', { name: 'Rechnung öffnen' }).first().click();
  await expect(page.locator('main h2')).toContainText('Rechnung 26175');

  await page.evaluate(() => SH.go('home'));
  await expect(page.locator('.crm-dashboard-v94')).toBeVisible();
  await page.locator('.crm-quick-grid button').filter({ hasText: 'Kunden' }).click();
  await expect(page.locator('main h2')).toHaveText('Kunden');
});

test('technician start page remains technician-focused', async ({ page }) => {
  await login(page, 'dome');
  await expect(page.getByRole('heading', { name: 'Meine Einsätze' })).toBeVisible();
  await expect(page.locator('.crm-dashboard-v94')).toHaveCount(0);
});
