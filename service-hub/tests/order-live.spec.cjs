const { test, expect } = require('@playwright/test');

async function login(page, role = 'annette') {
  await page.goto(`/?role=${role}`);
  await page.getByRole('button', { name: 'Anmelden' }).click();
  await expect(page.locator('header.top')).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('data-sh-build', '20260830-v9-1');
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

test('new order is persisted and visible immediately without back, navigation or reload', async ({ page }) => {
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

  await expect(page.locator('main h2')).toHaveText('Rapport A-2026-0102', { timeout: 1000 });
  await expect(page.locator('.ux-v9-order-created')).toContainText('Auftrag A-2026-0102 angelegt und gespeichert.', { timeout: 1000 });
  await expect(page.locator('.ux-v9-order-created')).toContainText('Sofort sichtbarer Auftrag');
  await expect(page.locator('html')).toHaveAttribute('data-sh-surface-reason', 'order-add');

  const after = await page.evaluate(() => {
    const db = JSON.parse(localStorage.getItem('shp_db'));
    return {
      count: db.orders.length,
      order: db.orders.find(o => o.no === 'A-2026-0102'),
      report: db.reports.find(r => {
        const order = db.orders.find(o => o.no === 'A-2026-0102');
        return order && String(r.orderId) === String(order.id);
      })
    };
  });
  expect(after.count).toBe(beforeCount + 1);
  expect(after.order.title).toBe('Sofort sichtbarer Auftrag');
  expect(after.report).toBeTruthy();
  expect(page.url()).toBe(initialUrl);
  expect(navigations).toBe(0);

  await openSeedCustomer(page);
  await expect(page.locator('main')).toContainText('Sofort sichtbarer Auftrag');

  await page.reload();
  await expect(page.locator('header.top')).toBeVisible();
  await openSeedCustomer(page);
  await expect(page.locator('main')).toContainText('Sofort sichtbarer Auftrag');
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
  await expect(page.locator('.ux-v9-order-created')).toHaveCount(0);
});
