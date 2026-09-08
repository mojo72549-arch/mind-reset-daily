const { test, expect } = require('@playwright/test');

async function login(page, role = 'dome') {
  await page.goto(`/?role=${role}`);
  await page.getByRole('button', { name: 'Anmelden' }).click();
  await expect(page.locator('header.top')).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.SHP_APP_DIALOGS && window.SHP_APP_DIALOGS.version)).toBe('20260903-v9-2');
}

async function openSeedReport(page) {
  const direct = page.getByRole('button', { name: 'Rapport öffnen' }).first();
  if (await direct.isVisible().catch(() => false)) await direct.click();
  else {
    await page.evaluate(() => SH.go('reports'));
    await page.getByRole('button', { name: 'Rapport öffnen' }).first().click();
  }
  await expect(page.locator('main h2')).toContainText('Rapport A-2026-0101');
}

function reportRows(page) {
  return page.locator('.report-lines-card table tr').filter({ has: page.locator('button.ux-danger-confirm') });
}

async function addService(page, id, qty = '1') {
  const before = await reportRows(page).count();
  await page.locator('#rsvc').selectOption(id);
  await page.locator('#rqty').fill(qty);
  await page.getByRole('button', { name: '+ Leistung' }).click();
  await expect(reportRows(page)).toHaveCount(before + 1);
  const storedCount = await page.evaluate(() => {
    const db = JSON.parse(localStorage.getItem('shp_db'));
    const heading = document.querySelector('main h2');
    const no = String(heading && heading.textContent || '').replace(/^Rapport\s+/, '').trim();
    const order = db.orders.find(o => String(o.no) === no);
    const report = order && db.reports.find(r => String(r.orderId) === String(order.id));
    return report && Array.isArray(report.lines) ? report.lines.length : -1;
  });
  expect(storedCount).toBe(before + 1);
}

async function modal(page, title) {
  const m = page.locator('#shp-app-modal');
  await expect(m).toBeVisible();
  await expect(m.getByRole('heading', { name: title })).toBeVisible();
  return m;
}

async function confirmDelete(page, title) {
  const m = await modal(page, title);
  await m.getByRole('button', { name: 'Löschen' }).click();
  await expect(page.locator('#shp-app-modal')).toHaveCount(0);
}

async function addMaterial(page, name, qty, price) {
  await page.getByRole('button', { name: '+ Material' }).click();
  const m = await modal(page, 'Material hinzufügen');
  await m.getByLabel('Material / Bezeichnung').fill(name);
  await m.getByLabel('Menge').fill(qty);
  await m.getByLabel('Einzelpreis €').fill(price);
  await m.getByRole('button', { name: 'Material hinzufügen' }).click();
}

test('material is not offered as a service and measurement UI is removed', async ({ page }) => {
  await login(page, 'dome');
  await openSeedReport(page);
  await expect(page.locator('#rsvc')).not.toContainText('Verbrauchsmaterialien');
  await expect(page.getByRole('heading', { name: 'Material', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '+ Material' })).toBeVisible();
  await expect(page.getByRole('button', { name: '+ Messwert' })).toHaveCount(0);
});

test('adding a service is immediately visible and persisted', async ({ page }) => {
  await login(page, 'dome');
  await openSeedReport(page);
  await addService(page, 'svc1', '1');
  await expect(reportRows(page)).toHaveCount(1);
  await expect(page.locator('.report-lines-card')).toBeVisible();
});

test('service add and delete update the same rapport without navigation or reload', async ({ page }) => {
  await login(page, 'dome');
  await openSeedReport(page);
  const initialUrl = page.url();
  let navigations = 0;
  page.on('framenavigated', frame => { if (frame === page.mainFrame()) navigations += 1; });

  await page.locator('#rsvc').selectOption('svc9');
  await page.locator('#rqty').fill('1');
  await page.getByRole('button', { name: '+ Leistung' }).click();
  await expect(page.locator('.report-lines-card tr').filter({ hasText: 'Anfahrt' })).toHaveCount(1);
  await expect(page.locator('main h2')).toContainText('Rapport A-2026-0101');

  const row = page.locator('.report-lines-card tr').filter({ hasText: 'Anfahrt' });
  await row.getByRole('button', { name: 'Löschen' }).click();
  await confirmDelete(page, 'Leistung löschen');
  await expect(page.locator('.report-lines-card tr').filter({ hasText: 'Anfahrt' })).toHaveCount(0);
  await expect(page.locator('main h2')).toContainText('Rapport A-2026-0101');
  expect(page.url()).toBe(initialUrl);
  expect(navigations).toBe(0);
});

test('material add and delete update the same rapport without navigation or reload', async ({ page }) => {
  await login(page, 'dome');
  await openSeedReport(page);
  const initialUrl = page.url();
  let navigations = 0;
  page.on('framenavigated', frame => { if (frame === page.mainFrame()) navigations += 1; });

  await addMaterial(page, 'Sofort-Material', '2', '4.50');
  await expect(page.getByText(/Sofort-Material/)).toBeVisible();
  const materialDelete = page.locator('.card').filter({ hasText: 'Sofort-Material' }).getByRole('button', { name: 'Löschen' }).first();
  await materialDelete.click();
  await confirmDelete(page, 'Material löschen');
  await expect(page.getByText(/Sofort-Material/)).toHaveCount(0);
  expect(page.url()).toBe(initialUrl);
  expect(navigations).toBe(0);
});

test('deleted service stays deleted after navigation and full reload', async ({ page }) => {
  await login(page, 'dome');
  await openSeedReport(page);
  await addService(page, 'svc1');
  await addService(page, 'svc9');
  await addService(page, 'svc3');
  await expect(reportRows(page)).toHaveCount(3);

  const anfahrtRow = page.locator('.report-lines-card tr').filter({ hasText: 'Anfahrt' });
  await expect(anfahrtRow).toHaveCount(1);
  await anfahrtRow.getByRole('button', { name: 'Löschen' }).click();
  await confirmDelete(page, 'Leistung löschen');
  await expect(anfahrtRow).toHaveCount(0);
  await expect(reportRows(page)).toHaveCount(2);

  const storedAfterDelete = await page.evaluate(() => {
    const db = JSON.parse(localStorage.getItem('shp_db'));
    const report = db.reports.find(r => String(r.orderId) === '101');
    return report.lines.map(l => l.name);
  });
  expect(storedAfterDelete).not.toContain('Anfahrt');

  await page.evaluate(() => SH.go('customers'));
  await expect(page.locator('main h2')).toHaveText('Kunden');
  await page.evaluate(() => SH.go('reports'));
  await page.getByRole('button', { name: 'Rapport öffnen' }).first().click();
  await expect(page.locator('.report-lines-card tr').filter({ hasText: 'Anfahrt' })).toHaveCount(0);
  await expect(reportRows(page)).toHaveCount(2);

  await page.reload();
  await expect(page.locator('header.top')).toBeVisible();
  await openSeedReport(page);
  await expect(page.locator('.report-lines-card tr').filter({ hasText: 'Anfahrt' })).toHaveCount(0);
  await expect(reportRows(page)).toHaveCount(2);
});

test('deleted material stays deleted after navigation and reload', async ({ page }) => {
  await login(page, 'dome');
  await openSeedReport(page);
  await addMaterial(page, 'Dichtungsring Test', '2', '3.50');
  await expect(page.getByText(/Dichtungsring Test/)).toBeVisible();

  const deleteButton = page.locator('.card').filter({ hasText: 'Dichtungsring Test' }).getByRole('button', { name: 'Löschen' }).first();
  await deleteButton.click();
  await confirmDelete(page, 'Material löschen');
  await expect(page.getByText(/Dichtungsring Test/)).toHaveCount(0);

  await page.evaluate(() => SH.go('customers'));
  await page.evaluate(() => SH.go('reports'));
  await page.getByRole('button', { name: 'Rapport öffnen' }).first().click();
  await expect(page.getByText(/Dichtungsring Test/)).toHaveCount(0);
  await page.reload();
  await openSeedReport(page);
  await expect(page.getByText(/Dichtungsring Test/)).toHaveCount(0);
});

test('admin catalog no longer exposes Verbrauchsmaterialien as service', async ({ page }) => {
  await login(page, 'admin');
  await page.evaluate(() => SH.go('admin'));
  await expect(page.getByRole('heading', { name: 'Leistungskatalog' })).toBeVisible();
  await expect(page.getByText('Verbrauchsmaterialien', { exact: true })).toHaveCount(0);
});
