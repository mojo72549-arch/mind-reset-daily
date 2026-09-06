const { test, expect } = require('@playwright/test');

async function loginAnnette(page) {
  await page.goto('/?role=annette');
  await page.getByRole('button', { name: 'Anmelden' }).click();
  await expect(page.locator('header.top')).toBeVisible();
}

async function openSeedInvoice(page) {
  await page.evaluate(() => SH.go('invoices'));
  await page.getByRole('button', { name: '26175', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Rechnung 26175' })).toBeVisible();
  await expect(page.locator('.crm-payment-escalation-v15')).toBeVisible();
}

test('Annette sees payment monitor without changing the existing invoice workflow', async ({ page }) => {
  await loginAnnette(page);
  await expect(page.locator('.crm-payment-monitor-v15')).toBeVisible();
  await expect(page.getByText('Zahlungen & Eskalation')).toBeVisible();
  await expect(page.locator('.crm-payment-metric')).toHaveCount(4);

  await page.evaluate(() => SH.go('invoices'));
  await expect(page.locator('.crm-payment-summary-v15')).toBeVisible();
  await expect(page.getByText('Zahlungsübersicht')).toBeVisible();

  await openSeedInvoice(page);
  await expect(page.getByRole('button', { name: 'WhatsApp', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'E-Mail', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Post / Druck', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'PDF / Drucken', exact: true })).toBeVisible();
  await expect(page.locator('#ivstatus')).toBeVisible();
});

test('Escalation stage survives navigation and payment status remains the existing source of truth', async ({ page }) => {
  await loginAnnette(page);
  await openSeedInvoice(page);

  const stage = page.locator('[id^="crm-payment-stage-"]');
  await stage.selectOption({ label: '1. Mahnung' });
  await page.getByRole('button', { name: 'Eskalation speichern', exact: true }).click();
  await expect(stage).toHaveValue('1. Mahnung');

  await page.evaluate(() => SH.go('home'));
  await expect(page.locator('.crm-payment-monitor-v15')).toBeVisible();
  await page.evaluate(() => SH.go('invoices'));
  await openSeedInvoice(page);
  await expect(page.locator('[id^="crm-payment-stage-"]')).toHaveValue('1. Mahnung');

  await page.locator('#ivstatus').selectOption({ label: 'Bezahlt' });
  await page.getByRole('button', { name: 'Status speichern', exact: true }).click();
  await expect(page.locator('.crm-payment-state')).toHaveText('Bezahlt');
  await expect(page.locator('#ivstatus')).toHaveValue('Bezahlt');

  const stored = await page.evaluate(() => ({
    db: JSON.parse(localStorage.getItem('shp_db')),
    meta: JSON.parse(localStorage.getItem('shp_invoice_payment_meta'))
  }));
  expect(stored.db.invoices.find(i => i.no === '26175').status).toBe('Bezahlt');
  expect(stored.meta['801'].stage).toBe('1. Mahnung');
});

test('Dome does not get office payment controls on the shared start', async ({ page }) => {
  await page.goto('/?role=dome');
  await page.getByRole('button', { name: 'Anmelden' }).click();
  await expect(page.locator('.crm-start-slim-v12')).toBeVisible();
  await expect(page.locator('.crm-payment-monitor-v15')).toHaveCount(0);
});
