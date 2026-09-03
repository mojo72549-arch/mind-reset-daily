const { test, expect } = require('@playwright/test');

async function login(page, role = 'annette') {
  await page.goto(`/?role=${role}`);
  await page.getByRole('button', { name: 'Anmelden' }).click();
  await expect(page.locator('header.top')).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.SHP_APP_DIALOGS && window.SHP_APP_DIALOGS.version)).toBe('20260903-v9-2');
}

async function openSeedCustomer(page) {
  await page.evaluate(() => SH.go('customers'));
  await page.getByRole('button', { name: 'Kunde öffnen' }).first().click();
  await expect(page.locator('main h2')).toHaveText('Musterkunde Stuttgart GmbH');
}

async function modal(page, title) {
  const m = page.locator('#shp-app-modal');
  await expect(m).toBeVisible();
  await expect(m.getByRole('heading', { name: title })).toBeVisible();
  return m;
}

function trackNativeDialogs(page) {
  let count = 0;
  page.on('dialog', async dialog => {
    count += 1;
    await dialog.dismiss().catch(() => {});
  });
  return () => count;
}

test('Konditionen bearbeiten uses one CRM modal and cancel stops the entire action', async ({ page }) => {
  const nativeDialogs = trackNativeDialogs(page);
  await login(page, 'annette');
  await openSeedCustomer(page);
  const before = await page.evaluate(() => JSON.stringify(JSON.parse(localStorage.getItem('shp_db')).customers[0]));

  await page.getByRole('button', { name: 'Konditionen bearbeiten' }).click();
  const m = await modal(page, 'Konditionen bearbeiten');
  await expect(m.getByText('Musterkunde Stuttgart GmbH')).toBeVisible();
  await expect(m.getByLabel('Stundensatz €/h')).toHaveValue('72');
  await expect(m.getByText('Kundenspezifische Leistungspreise')).toBeVisible();
  await expect(m.getByText('Bevorzugter Kommunikationskanal')).toHaveCount(0);

  await m.getByLabel('Stundensatz €/h').fill('99');
  await m.getByRole('button', { name: 'Abbrechen' }).click();
  await expect(page.locator('#shp-app-modal')).toHaveCount(0);
  await page.waitForTimeout(350);
  await expect(page.locator('#shp-app-modal')).toHaveCount(0);
  const after = await page.evaluate(() => JSON.stringify(JSON.parse(localStorage.getItem('shp_db')).customers[0]));
  expect(after).toBe(before);
  expect(nativeDialogs()).toBe(0);
});

test('Konditionen save only prices and leaves communication channel untouched', async ({ page }) => {
  const nativeDialogs = trackNativeDialogs(page);
  await login(page, 'annette');
  await openSeedCustomer(page);
  const beforeChannel = await page.evaluate(() => JSON.parse(localStorage.getItem('shp_db')).customers[0].preferredChannel);
  expect(beforeChannel).toBe('WhatsApp');

  await page.getByRole('button', { name: 'Konditionen bearbeiten' }).click();
  const m = await modal(page, 'Konditionen bearbeiten');
  await m.getByLabel('Stundensatz €/h').fill('89');
  await m.locator('input[name="price_svc1"]').fill('119.50');
  await m.getByRole('button', { name: 'Konditionen speichern' }).click();
  await expect(page.locator('#shp-app-modal')).toHaveCount(0);

  const saved = await page.evaluate(() => {
    const c = JSON.parse(localStorage.getItem('shp_db')).customers[0];
    return { rate: c.hourlyRate, channel: c.preferredChannel, price: c.priceOverrides.svc1 };
  });
  expect(saved).toEqual({ rate: 89, channel: 'WhatsApp', price: 119.5 });
  await expect(page.getByText('Stundensatz: 89,00 €/h')).toBeVisible();
  await expect(page.getByText('Bevorzugt: WhatsApp')).toBeVisible();
  expect(nativeDialogs()).toBe(0);
});

test('communication channel is edited in Stammdaten, not in Konditionen', async ({ page }) => {
  const nativeDialogs = trackNativeDialogs(page);
  await login(page, 'annette');
  await openSeedCustomer(page);
  await page.getByRole('button', { name: 'Stammdaten bearbeiten' }).click();
  const m = await modal(page, 'Stammdaten bearbeiten');
  await expect(m.getByLabel('Bevorzugter Kommunikationskanal')).toBeVisible();
  await m.getByLabel('Bevorzugter Kommunikationskanal').selectOption('E-Mail');
  await m.getByLabel('E-Mail').fill('neu@example.de');
  await m.getByRole('button', { name: 'Stammdaten speichern' }).click();
  const saved = await page.evaluate(() => {
    const c = JSON.parse(localStorage.getItem('shp_db')).customers[0];
    return { channel: c.preferredChannel, email: c.email };
  });
  expect(saved).toEqual({ channel: 'E-Mail', email: 'neu@example.de' });
  expect(nativeDialogs()).toBe(0);
});

test('customer and order cancellation are atomic and never open browser prompts', async ({ page }) => {
  const nativeDialogs = trackNativeDialogs(page);
  await login(page, 'annette');
  await page.evaluate(() => SH.go('customers'));
  const beforeCustomers = await page.evaluate(() => JSON.stringify(JSON.parse(localStorage.getItem('shp_db')).customers));
  await page.getByRole('button', { name: '+ Kunde' }).click();
  let m = await modal(page, 'Kunde anlegen');
  await m.getByLabel('Kundenname').fill('Abbruchkunde GmbH');
  await m.getByRole('button', { name: 'Abbrechen' }).click();
  const afterCustomers = await page.evaluate(() => JSON.stringify(JSON.parse(localStorage.getItem('shp_db')).customers));
  expect(afterCustomers).toBe(beforeCustomers);

  await openSeedCustomer(page);
  const beforeOrders = await page.evaluate(() => JSON.stringify(JSON.parse(localStorage.getItem('shp_db')).orders));
  await page.getByRole('button', { name: '+ Auftrag' }).first().click();
  m = await modal(page, 'Auftrag anlegen');
  await m.getByLabel('Auftragsbezeichnung').fill('Abbruchauftrag');
  await m.getByRole('button', { name: 'Abbrechen' }).click();
  const afterOrders = await page.evaluate(() => JSON.stringify(JSON.parse(localStorage.getItem('shp_db')).orders));
  expect(afterOrders).toBe(beforeOrders);
  expect(nativeDialogs()).toBe(0);
});

test('material add and delete use app-owned modal and confirmation', async ({ page }) => {
  const nativeDialogs = trackNativeDialogs(page);
  await login(page, 'dome');
  await page.getByRole('button', { name: 'Rapport öffnen' }).first().click();
  await page.getByRole('button', { name: '+ Material' }).click();
  let m = await modal(page, 'Material hinzufügen');
  await m.getByLabel('Material / Bezeichnung').fill('Dialog-Testmaterial');
  await m.getByLabel('Menge').fill('2');
  await m.getByLabel('Einzelpreis €').fill('5.25');
  await m.getByRole('button', { name: 'Material hinzufügen' }).click();
  await expect(page.getByText(/Dialog-Testmaterial/)).toBeVisible();

  await page.locator('.card').filter({ hasText: 'Dialog-Testmaterial' }).getByRole('button', { name: 'Löschen' }).first().click();
  m = await modal(page, 'Material löschen');
  await m.getByRole('button', { name: 'Abbrechen' }).click();
  await expect(page.getByText(/Dialog-Testmaterial/)).toBeVisible();
  await page.locator('.card').filter({ hasText: 'Dialog-Testmaterial' }).getByRole('button', { name: 'Löschen' }).first().click();
  m = await modal(page, 'Material löschen');
  await m.getByRole('button', { name: 'Löschen' }).click();
  await expect(page.getByText(/Dialog-Testmaterial/)).toHaveCount(0);
  expect(nativeDialogs()).toBe(0);
});
