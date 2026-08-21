const { test, expect } = require('@playwright/test');

async function login(page, role = 'dome') {
  await page.goto(`/?role=${role}`);
  await page.getByRole('button', { name: 'Anmelden' }).click();
  await expect(page.locator('header.top')).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('data-sh-build', '20260821-v9');
}

async function openSeedReport(page) {
  const direct = page.getByRole('button', { name: 'Rapport öffnen' }).first();
  if (await direct.isVisible().catch(() => false)) {
    await direct.click();
  } else {
    await page.evaluate(() => SH.go('reports'));
    await page.getByRole('button', { name: 'Rapport öffnen' }).first().click();
  }
  await expect(page.locator('main h2')).toContainText('Rapport A-2026-0101');
}

async function addService(page, id, qty = '1') {
  await page.locator('#rsvc').selectOption(id);
  await page.locator('#rqty').fill(qty);
  await page.getByRole('button', { name: '+ Leistung' }).click();
  await expect(page.locator('.ux-v9-toast')).toContainText('sofort gespeichert und angezeigt');
}

function reportRows(page) {
  return page.locator('.report-lines-card table tr').filter({ has: page.locator('button.ux-danger-confirm') });
}

test('material is not offered as a service and measurement UI is removed', async ({ page }) => {
  await login(page, 'dome');
  await openSeedReport(page);
  await expect(page.locator('#rsvc')).not.toContainText('Verbrauchsmaterialien');
  await expect(page.getByRole('heading', { name: 'Material', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '+ Material' })).toBeVisible();
  await expect(page.getByRole('button', { name: '+ Messwert' })).toHaveCount(0);
});

test('adding a service gives immediate confirmation', async ({ page }) => {
  await login(page, 'dome');
  await openSeedReport(page);
  await addService(page, 'svc1', '1');
  await expect(reportRows(page)).toHaveCount(1);
  await expect(page.locator('.report-lines-card')).toBeVisible();
});

test('service add and delete update the same rapport surface without navigation or reload', async ({ page }) => {
  await login(page, 'dome');
  await openSeedReport(page);
  const initialUrl = page.url();
  let navigations = 0;
  page.on('framenavigated', frame => { if (frame === page.mainFrame()) navigations += 1; });

  await page.locator('#rsvc').selectOption('svc9');
  await page.locator('#rqty').fill('1');
  await page.getByRole('button', { name: '+ Leistung' }).click();
  await expect(page.locator('.report-lines-card tr').filter({ hasText: 'Anfahrt' })).toHaveCount(1, { timeout: 750 });
  await expect(page.locator('main h2')).toContainText('Rapport A-2026-0101');
  await expect(page.locator('html')).toHaveAttribute('data-sh-surface-reason', 'service-add');

  const row = page.locator('.report-lines-card tr').filter({ hasText: 'Anfahrt' });
  page.once('dialog', dialog => dialog.accept());
  await row.getByRole('button', { name: 'Löschen' }).click();
  await expect(page.locator('.report-lines-card tr').filter({ hasText: 'Anfahrt' })).toHaveCount(0, { timeout: 750 });
  await expect(page.locator('main h2')).toContainText('Rapport A-2026-0101');
  await expect(page.locator('html')).toHaveAttribute('data-sh-surface-reason', 'service-remove');

  expect(page.url()).toBe(initialUrl);
  expect(navigations).toBe(0);
});

test('material add and delete update the same rapport surface without navigation or reload', async ({ page }) => {
  await login(page, 'dome');
  await openSeedReport(page);
  const initialUrl = page.url();
  let navigations = 0;
  page.on('framenavigated', frame => { if (frame === page.mainFrame()) navigations += 1; });

  const answers = ['Sofort-Material', '2', '4.50'];
  page.on('dialog', async dialog => {
    if (dialog.type() === 'prompt') await dialog.accept(answers.shift() || '');
    else await dialog.accept();
  });
  await page.getByRole('button', { name: '+ Material' }).click();
  await expect(page.getByText(/Sofort-Material/)).toBeVisible({ timeout: 750 });
  await expect(page.locator('html')).toHaveAttribute('data-sh-surface-reason', 'material-add');

  const materialDelete = page.locator('.card').filter({ hasText: 'Sofort-Material' }).getByRole('button', { name: 'Löschen' }).first();
  await materialDelete.click();
  await expect(page.getByText(/Sofort-Material/)).toHaveCount(0, { timeout: 750 });
  await expect(page.locator('html')).toHaveAttribute('data-sh-surface-reason', 'material-remove');

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
  page.once('dialog', dialog => dialog.accept());
  await anfahrtRow.getByRole('button', { name: 'Löschen' }).click();
  await expect(page.locator('.ux-v9-toast')).toContainText('sofort entfernt');
  await expect(anfahrtRow).toHaveCount(0);
  await expect(reportRows(page)).toHaveCount(2);

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
  const answers = ['Dichtungsring Test', '2', '3.50'];
  page.on('dialog', async dialog => {
    if (dialog.type() === 'prompt') await dialog.accept(answers.shift() || '');
    else await dialog.accept();
  });
  await page.getByRole('button', { name: '+ Material' }).click();
  await expect(page.getByText(/Dichtungsring Test/)).toBeVisible();
  const deleteButton = page.locator('.card').filter({ hasText: 'Dichtungsring Test' }).getByRole('button', { name: 'Löschen' }).first();
  await deleteButton.click();
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
