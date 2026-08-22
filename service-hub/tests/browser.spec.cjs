const { test, expect } = require('@playwright/test');

async function login(page, role) {
  await page.goto(`/?role=${role}`);
  await page.getByRole('button', { name: 'Anmelden' }).click();
  await expect(page.locator('header.top')).toBeVisible();
}

async function goModule(page, label, tab) {
  const mobile = page.locator('.mobile button').filter({ hasText: label }).first();
  if (await mobile.isVisible().catch(() => false)) {
    await mobile.click();
    return;
  }
  const desktop = page.locator('.nav.desktop button').filter({ hasText: label }).first();
  if (await desktop.isVisible().catch(() => false)) {
    await desktop.click();
    return;
  }
  await page.evaluate(target => SH.go(target), tab);
}

async function openSeedReport(page) {
  const direct = page.getByRole('button', { name: 'Rapport öffnen' }).first();
  if (await direct.isVisible().catch(() => false)) {
    await direct.click();
  } else {
    await goModule(page, 'Rapporte', 'reports');
    await page.getByRole('button', { name: 'Rapport öffnen' }).first().click();
  }
  await expect(page.locator('main h2')).toContainText('Rapport A-2026-0101');
}

test('Dome sees the central CRM but sensitive write areas stay protected', async ({ page }) => {
  await login(page, 'dome');
  await expect(page.locator('header.top')).toContainText('Dome · Techniker');

  const nav = page.locator('.mobile button');
  await expect(nav.filter({ hasText: 'Start' })).toHaveCount(1);
  await expect(nav.filter({ hasText: 'Aufträge' })).toHaveCount(1);
  await expect(nav.filter({ hasText: 'Kunden' })).toHaveCount(1);
  await expect(nav.filter({ hasText: 'Rapporte' })).toHaveCount(1);
  await expect(nav.filter({ hasText: 'Rechnung' })).toHaveCount(1);
  await expect(page.locator('.nav.desktop button').filter({ hasText: 'Administration' })).toHaveCount(0);

  await goModule(page, 'Kunden', 'customers');
  await expect(page.locator('main h2')).toHaveText('Kunden');
  await expect(page.getByRole('button', { name: '+ Kunde' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Kunde öffnen' }).first().click();
  await expect(page.getByText('Preis- und Konditionspflege erfolgt durch Büro / Administration.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Stammdaten bearbeiten' })).toHaveCount(0);

  await goModule(page, 'Rechnung', 'invoices');
  await expect(page.locator('main h2')).toHaveText('Rechnungen');
  await page.getByRole('button', { name: '26175' }).first().click();
  await expect(page.locator('#ivstatus')).toBeDisabled();
  await expect(page.getByText('Nur Ansicht für Dome · Status und Versand werden im Büro bearbeitet.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Status speichern' })).toHaveCount(0);
});

test('Annette keeps office write rights without global administration', async ({ page }) => {
  await login(page, 'annette');
  await expect(page.locator('header.top')).toContainText('Annette · Büro');
  await goModule(page, 'Kunden', 'customers');
  await expect(page.getByRole('button', { name: '+ Kunde' })).toBeVisible();
  await expect(page.locator('.nav.desktop button').filter({ hasText: 'Administration' })).toHaveCount(0);

  await goModule(page, 'Rechnung', 'invoices');
  await page.getByRole('button', { name: '26175' }).first().click();
  await expect(page.locator('#ivstatus')).toBeEnabled();
  await expect(page.getByRole('button', { name: 'Status speichern' })).toBeVisible();
});

test('Admin has the administration area', async ({ page }) => {
  await login(page, 'admin');
  await expect(page.locator('header.top')).toContainText('Administration');
  await expect(page.locator('.nav.desktop button').filter({ hasText: 'Administration' })).toHaveCount(1);
});

test('Admin area is system configuration, not an operational customer or invoice screen', async ({ page }) => {
  await login(page, 'admin');
  await page.evaluate(() => SH.go('admin'));
  await expect(page.locator('.ux-admin-title h2')).toHaveText('Administration');
  await expect(page.getByText('Ausschließlich Systemeinstellungen')).toBeVisible();
  await expect(page.locator('#adm-companyName')).toHaveValue('Rohr- & Kanaltechnik Winser');
  await expect(page.locator('#adm-iban')).toHaveValue('DE78 6009 0300 0424 6090 02');
  await expect(page.locator('#adm-vat')).toHaveValue('19');
  await expect(page.locator('#adm-waNumber')).toBeVisible();
  await expect(page.locator('#adm-emailReplyTo')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Leistungskatalog' })).toBeVisible();
  await expect(page.getByText('Kundenkonditionen')).toHaveCount(0);
  await expect(page.getByText('Musterkunde Stuttgart GmbH')).toHaveCount(0);
  await expect(page.getByText('26175', { exact: true })).toHaveCount(0);
});

test('Branded invoice uses logo and values from the admin configuration', async ({ page }) => {
  await login(page, 'admin');
  await page.evaluate(() => SH.go('admin'));
  await expect(page.locator('#adm-companyName')).toBeVisible();
  await page.locator('#adm-companyName').fill('Winser Test Branding');
  await page.locator('#adm-paymentText').fill('Test-Zahlungshinweis aus Administration.');
  await page.getByRole('button', { name: 'Einstellungen speichern' }).click();
  await expect(page.locator('.ux-admin-saved')).toContainText('Einstellungen gespeichert');

  await page.evaluate(() => SH.go('invoices'));
  await page.getByRole('button', { name: '26175' }).first().click();
  await page.evaluate(() => { window.print = () => {}; });
  await page.getByRole('button', { name: 'PDF / Drucken' }).click();

  await expect(page.locator('.invoice-doc-v6')).toBeVisible();
  await expect(page.locator('.invoice-brand-name')).toHaveText('Winser Test Branding');
  await expect(page.locator('.invoice-brand-v6 img')).toHaveAttribute('src', /rokatech-winser\.de/);
  await expect(page.locator('.invoice-payment-v6')).toContainText('Test-Zahlungshinweis aus Administration.');
  await expect(page.locator('.invoice-totals-v6')).toBeVisible();
});

test('Report service can be added, deleted and restored with Undo', async ({ page }) => {
  await login(page, 'dome');
  await openSeedReport(page);

  await page.locator('#rsvc').selectOption('svc1');
  await page.locator('#rqty').fill('1');
  await page.getByRole('button', { name: '+ Leistung' }).click();
  await expect(page.locator('.report-lines-card button.ux-danger-confirm')).toHaveCount(1);

  page.once('dialog', dialog => dialog.accept());
  await page.locator('.report-lines-card button.ux-danger-confirm').click();
  await expect(page.locator('.report-lines-card button.ux-danger-confirm')).toHaveCount(0);
  await expect(page.locator('.ux-empty')).toContainText('Noch keine Leistung');
  await expect(page.locator('.ux-undo-toast')).toContainText('Leistung entfernt');

  await page.locator('.ux-undo-toast button').click();
  await expect(page.locator('header.top')).toBeVisible();
  await openSeedReport(page);
  await expect(page.locator('.report-lines-card button.ux-danger-confirm')).toHaveCount(1);
});

test('Material can be removed with confirmation', async ({ page }) => {
  await login(page, 'dome');
  await openSeedReport(page);

  const answers = ['Testmaterial', '2', '4.50'];
  page.on('dialog', async dialog => {
    if (dialog.type() === 'prompt') await dialog.accept(answers.shift() || '');
    else await dialog.accept();
  });
  await page.getByRole('button', { name: '+ Material' }).click();
  await expect(page.getByText(/Testmaterial/)).toBeVisible();

  const materialDelete = page.locator('.card').filter({ hasText: 'Testmaterial' }).getByRole('button', { name: 'Löschen' }).first();
  await materialDelete.click();
  await expect(page.getByText(/Testmaterial/)).toHaveCount(0);
});

test('A newly created customer can be reverted globally', async ({ page }) => {
  await login(page, 'annette');
  await goModule(page, 'Kunden', 'customers');

  const answers = [
    'Undo Testkunde GmbH',
    'Teststraße 1, 70173 Stuttgart',
    'Test Kontakt',
    '0711 123456',
    'test@example.de',
    '85',
    'E-Mail'
  ];
  page.on('dialog', async dialog => {
    if (dialog.type() === 'prompt') await dialog.accept(answers.shift() || '');
    else await dialog.accept();
  });

  await page.getByRole('button', { name: '+ Kunde' }).click();
  await expect(page.locator('main h2')).toHaveText('Undo Testkunde GmbH');
  await expect(page.locator('.ux-undo-toast')).toContainText('Kunde angelegt');
  await page.locator('.ux-undo-toast button').click();

  await expect(page.locator('header.top')).toBeVisible();
  await goModule(page, 'Kunden', 'customers');
  await expect(page.getByText('Undo Testkunde GmbH')).toHaveCount(0);
});
