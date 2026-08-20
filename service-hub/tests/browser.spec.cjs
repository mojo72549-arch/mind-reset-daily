const { test, expect } = require('@playwright/test');

async function login(page, role) {
  await page.goto(`/?role=${role}`);
  await page.getByRole('button', { name: 'Anmelden' }).click();
  await expect(page.locator('header.top')).toBeVisible();
}

async function openSeedReport(page) {
  const direct = page.getByRole('button', { name: 'Rapport öffnen' }).first();
  if (await direct.isVisible().catch(() => false)) {
    await direct.click();
  } else {
    await page.locator('.mobile button').filter({ hasText: 'Rapporte' }).click();
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

  await nav.filter({ hasText: 'Kunden' }).click();
  await expect(page.locator('main h2')).toHaveText('Kunden');
  await expect(page.getByRole('button', { name: '+ Kunde' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Kunde öffnen' }).first().click();
  await expect(page.getByText('Preis- und Konditionspflege erfolgt durch Büro / Administration.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Stammdaten bearbeiten' })).toHaveCount(0);

  await page.locator('.mobile button').filter({ hasText: 'Rechnung' }).click();
  await expect(page.locator('main h2')).toHaveText('Rechnungen');
  await page.getByRole('button', { name: '26175' }).first().click();
  await expect(page.locator('#ivstatus')).toBeDisabled();
  await expect(page.getByText('Nur Ansicht für Dome · Status und Versand werden im Büro bearbeitet.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Status speichern' })).toHaveCount(0);
});

test('Annette keeps office write rights without global administration', async ({ page }) => {
  await login(page, 'annette');
  await expect(page.locator('header.top')).toContainText('Annette · Büro');
  await page.locator('.mobile button').filter({ hasText: 'Kunden' }).click();
  await expect(page.getByRole('button', { name: '+ Kunde' })).toBeVisible();
  await expect(page.locator('.nav.desktop button').filter({ hasText: 'Administration' })).toHaveCount(0);

  await page.locator('.mobile button').filter({ hasText: 'Rechnung' }).click();
  await page.getByRole('button', { name: '26175' }).first().click();
  await expect(page.locator('#ivstatus')).toBeEnabled();
  await expect(page.getByRole('button', { name: 'Status speichern' })).toBeVisible();
});

test('Admin has the administration area', async ({ page }) => {
  await login(page, 'admin');
  await expect(page.locator('header.top')).toContainText('Administration');
  await expect(page.locator('.nav.desktop button').filter({ hasText: 'Administration' })).toHaveCount(1);
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
  await page.locator('.mobile button').filter({ hasText: 'Kunden' }).click();

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
  await page.locator('.mobile button').filter({ hasText: 'Kunden' }).click();
  await expect(page.getByText('Undo Testkunde GmbH')).toHaveCount(0);
});
