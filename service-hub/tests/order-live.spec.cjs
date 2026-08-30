const { test, expect } = require('@playwright/test');

async function login(page, role = 'annette') {
  await page.goto(`/?role=${role}`);
  await page.getByRole('button', { name: 'Anmelden' }).click();
  await expect(page.locator('header.top')).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('data-sh-build', '20260830-v9-1');
}

async function openSeedCustomer(page) {
  await page.evaluate(() => SH.go('customers'));
  await expect(page.locator('main h2')).toHaveText('Kunden');
  await page.getByRole('button', { name: 'Kunde öffnen' }).first().click();
  await expect(page.locator('main h2')).toHaveText('Musterkunde Stuttgart GmbH');
}

test('new order is persisted and visible immediately without back, navigation or reload', async ({ page }) => {
  await login(page);
  await openSeedCustomer(page);

  const beforeCount = await page.evaluate(() => JSON.parse(localStorage.getItem('shp_db')).orders.length);
  const initialUrl = page.url();
  let navigations = 0;
  page.on('framenavigated', frame => { if (frame === page.mainFrame()) navigations += 1; });

  const answers = ['Sofort sichtbarer Auftrag', 'Wartung'];
  page.on('dialog', async dialog => {
    if (dialog.type() === 'prompt') await dialog.accept(answers.shift() || '');
    else await dialog.accept();
  });

  await page.getByRole('button', { name: '+ Auftrag' }).first().click();

  await expect(page.locator('main h2')).toHaveText('Rapport A-2026-0102', { timeout: 750 });
  await expect(page.locator('.ux-v9-order-created')).toContainText('Auftrag A-2026-0102 angelegt und gespeichert.', { timeout: 750 });
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

  // The customer view must show the order immediately when opened later in-app.
  await openSeedCustomer(page);
  await expect(page.locator('main')).toContainText('Sofort sichtbarer Auftrag');

  // Persistence must survive a real reload as a second, independent guarantee.
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

  page.once('dialog', async dialog => { await dialog.dismiss(); });
  await page.getByRole('button', { name: '+ Auftrag' }).first().click();

  await expect(page.locator('main h2')).toHaveText('Musterkunde Stuttgart GmbH');
  const after = await page.evaluate(() => JSON.stringify(JSON.parse(localStorage.getItem('shp_db')).orders));
  expect(after).toBe(before);
  expect(page.url()).toBe(initialUrl);
  expect(navigations).toBe(0);
  await expect(page.locator('.ux-v9-order-created')).toHaveCount(0);
});
