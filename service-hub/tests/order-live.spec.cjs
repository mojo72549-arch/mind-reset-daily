const { test, expect } = require('@playwright/test');

async function login(page, role = 'annette') {
  await page.goto(`/?role=${role}`);
  await page.getByRole('button', { name: 'Anmelden' }).click();
  await expect(page.locator('header.top')).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.SHP_APP_DIALOGS && window.SHP_APP_DIALOGS.version)).toBe('20260903-v9-2');
}

async function openSeedCustomer(page) {
  await page.evaluate(() => SH.go('customers'));
  await expect(page.locator('main h2')).toHaveText('Kunden');
  await page.getByRole('button', { name: 'Kunde öffnen' }).first().click();
  await expect(page.locator('main h2')).toHaveText('Musterkunde Stuttgart GmbH');
}

async function orderModal(page) {
  const m = page.locator('#shp-app-modal');
  await expect(m).toBeVisible();
  await expect(m.getByRole('heading', { name: 'Auftrag anlegen' })).toBeVisible();
  return m;
}

test('new order is persisted exactly once and report is immediately usable', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', err => pageErrors.push(String(err && err.message || err)));
  await login(page);
  await openSeedCustomer(page);

  const beforeCount = await page.evaluate(() => JSON.parse(localStorage.getItem('shp_db')).orders.length);
  const initialUrl = page.url();
  let navigations = 0;
  page.on('framenavigated', frame => { if (frame === page.mainFrame()) navigations += 1; });

  await page.getByRole('button', { name: '+ Auftrag' }).first().click();
  const m = await orderModal(page);
  await m.getByLabel('Auftragsbezeichnung').fill('Sofort sichtbarer Auftrag');
  await m.getByLabel('Auftragsart').selectOption('Wartung');
  await m.getByRole('button', { name: 'Auftrag anlegen' }).click();

  await expect(m).toHaveCount(0);
  await expect(page.locator('main h2')).toHaveText('Rapport A-2026-0102');
  await expect(page.locator('#rw')).toBeVisible();
  await expect(page.locator('#rsvc')).toBeVisible();
  await expect(page.locator('#rqty')).toBeVisible();

  const after = await page.evaluate(() => {
    const db = JSON.parse(localStorage.getItem('shp_db'));
    const orders = db.orders.filter(o => o.no === 'A-2026-0102');
    const order = orders[0];
    return {
      count: db.orders.length,
      matches: orders.length,
      order,
      report: order && db.reports.find(r => String(r.orderId) === String(order.id))
    };
  });
  expect(after.count).toBe(beforeCount + 1);
  expect(after.matches).toBe(1);
  expect(after.order.title).toBe('Sofort sichtbarer Auftrag');
  expect(after.report).toBeTruthy();
  expect(page.url()).toBe(initialUrl);
  expect(navigations).toBe(0);

  await page.locator('#rw').fill('Direkte Weiterbearbeitung funktioniert.');
  await page.evaluate(() => window.SHP_REPORT_TIME && window.SHP_REPORT_TIME.save());
  await expect.poll(() => page.evaluate(() => {
    const db = JSON.parse(localStorage.getItem('shp_db'));
    const order = db.orders.find(o => o.no === 'A-2026-0102');
    const report = db.reports.find(r => order && String(r.orderId) === String(order.id));
    return report && report.work;
  })).toBe('Direkte Weiterbearbeitung funktioniert.');

  await openSeedCustomer(page);
  await expect(page.locator('main')).toContainText('Sofort sichtbarer Auftrag');

  await page.reload();
  await expect(page.locator('header.top')).toBeVisible();
  await openSeedCustomer(page);
  await expect(page.locator('main')).toContainText('Sofort sichtbarer Auftrag');
  expect(pageErrors).toEqual([]);
});

test('cancelled order creation leaves customer and persistent data unchanged', async ({ page }) => {
  await login(page);
  await openSeedCustomer(page);

  const before = await page.evaluate(() => JSON.stringify(JSON.parse(localStorage.getItem('shp_db')).orders));
  const initialUrl = page.url();
  let navigations = 0;
  page.on('framenavigated', frame => { if (frame === page.mainFrame()) navigations += 1; });

  await page.getByRole('button', { name: '+ Auftrag' }).first().click();
  const m = await orderModal(page);
  await m.getByLabel('Auftragsbezeichnung').fill('Muss verworfen werden');
  await m.getByRole('button', { name: 'Abbrechen' }).click();
  await expect(page.locator('#shp-app-modal')).toHaveCount(0);

  await expect(page.locator('main h2')).toHaveText('Musterkunde Stuttgart GmbH');
  const after = await page.evaluate(() => JSON.stringify(JSON.parse(localStorage.getItem('shp_db')).orders));
  expect(after).toBe(before);
  expect(page.url()).toBe(initialUrl);
  expect(navigations).toBe(0);
});
