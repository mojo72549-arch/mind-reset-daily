const { test, expect } = require('@playwright/test');

async function login(page, role) {
  await page.goto('/?role=' + role);
  await page.getByRole('button', { name: 'Anmelden' }).click();
  await expect(page.locator('header.top')).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('data-sh-crm-search-build', '20260904-v10');
}

async function searchFor(page, value) {
  const finder = page.locator('.crm-customer-finder-v10');
  await expect(finder).toBeVisible();
  await finder.getByLabel('Kundensuche').fill(value);
  await expect(finder.locator('.crm-customer-result-v10')).toHaveCount(1);
  return finder;
}

test('Annette finds customers by contact or customer number with useful CRM context', async ({ page }) => {
  await login(page, 'annette');

  const finder = await searchFor(page, 'Thomas Berger');
  await expect(finder).toContainText('K-2026-0001');
  await expect(finder).toContainText('Musterkunde Stuttgart GmbH');
  await expect(finder).toContainText('1 Auftrag');
  await expect(finder).toContainText('1 offen');
  await expect(finder).toContainText('Wartung Heizungsanlage');

  await finder.getByLabel('Kundensuche').fill('K-2026-0001');
  await expect(finder.locator('.crm-customer-result-v10')).toHaveCount(1);
  await expect(finder.getByRole('button', { name: '+ Auftrag anlegen' })).toBeVisible();
});

test('Annette creates an order directly from the search result', async ({ page }) => {
  await login(page, 'annette');
  const finder = await searchFor(page, 'Musterkunde');

  await finder.getByRole('button', { name: '+ Auftrag anlegen' }).click();
  const modal = page.locator('#shp-app-modal');
  await expect(modal.getByRole('heading', { name: 'Auftrag anlegen' })).toBeVisible();
  await expect(modal).toContainText('Kunde: Musterkunde Stuttgart GmbH');
  await modal.getByLabel('Auftragsbezeichnung').fill('Suchauftrag Annette');
  await modal.getByLabel('Auftragsart').selectOption('Rohrreinigung');
  await modal.getByRole('button', { name: 'Auftrag anlegen' }).click();

  await expect(page.locator('main h2')).toContainText('Rapport A-');
  const created = await page.evaluate(() => {
    const db = JSON.parse(localStorage.getItem('shp_db'));
    return db.orders.find(order => order.title === 'Suchauftrag Annette');
  });
  expect(created).toMatchObject({ customerId: 1, type: 'Rohrreinigung', assignedTo: 'Dome' });
});

test('Dome can find a known customer and start a linked order from his dashboard', async ({ page }) => {
  await login(page, 'dome');
  const finder = await searchFor(page, 'K-2026-0001');

  await expect(finder).toContainText('Musterkunde Stuttgart GmbH');
  await finder.getByRole('button', { name: '+ Auftrag anlegen' }).click();
  const modal = page.locator('#shp-app-modal');
  await expect(modal.getByRole('heading', { name: 'Auftrag anlegen' })).toBeVisible();
  await modal.getByLabel('Auftragsbezeichnung').fill('Suchauftrag Dome');
  await modal.getByLabel('Auftragsart').selectOption('TV-Kanaluntersuchung');
  await modal.getByRole('button', { name: 'Auftrag anlegen' }).click();

  const created = await page.evaluate(() => {
    const db = JSON.parse(localStorage.getItem('shp_db'));
    return db.orders.find(order => order.title === 'Suchauftrag Dome');
  });
  expect(created).toMatchObject({ customerId: 1, type: 'TV-Kanaluntersuchung', assignedTo: 'Dome' });
  await expect(page.locator('main')).not.toContainText('Messwert');

  const viewport = await page.evaluate(() => ({ documentWidth: document.documentElement.scrollWidth, viewportWidth: innerWidth }));
  expect(viewport.documentWidth).toBeLessThanOrEqual(viewport.viewportWidth + 1);
});
