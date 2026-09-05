const { test, expect } = require('@playwright/test');

async function login(page, role) {
  await page.goto(`/?role=${role}`);
  await page.getByRole('button', { name: 'Anmelden' }).click();
  await expect(page.locator('header.top')).toBeVisible();
}

async function goModule(page, label, tab) {
  const mobile = page.locator('.mobile button').filter({ hasText: label }).first();
  if (await mobile.isVisible().catch(() => false)) { await mobile.click(); return; }
  const desktop = page.locator('.nav.desktop button').filter({ hasText: label }).first();
  if (await desktop.isVisible().catch(() => false)) { await desktop.click(); return; }
  await page.evaluate(target => SH.go(target), tab);
}

async function openSeedReport(page) {
  const direct = page.getByRole('button', { name: 'Rapport öffnen' }).first();
  if (await direct.isVisible().catch(() => false)) await direct.click();
  else {
    await goModule(page, 'Rapporte', 'reports');
    await page.getByRole('button', { name: 'Rapport öffnen' }).first().click();
  }
  await expect(page.locator('main h2')).toContainText('Rapport A-2026-0101');
}

async function modal(page, title) {
  const m = page.locator('#shp-app-modal');
  await expect(m).toBeVisible();
  await expect(m.getByRole('heading', { name: title })).toBeVisible();
  return m;
}

async function confirmModal(page, title, button) {
  const m = await modal(page, title);
  await m.getByRole('button', { name: button }).click();
  await expect(page.locator('#shp-app-modal')).toHaveCount(0);
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

test('Admin is settings-only and cannot enter operational modules', async ({ page }) => {
  await login(page, 'admin');
  await expect(page.locator('header.top')).toContainText('Administration');
  await expect(page.locator('.ux-admin-title h2')).toHaveText('Administration');

  const desktop = page.locator('.nav.desktop button');
  await expect(desktop).toHaveCount(2);
  await expect(desktop.filter({ hasText: 'Einstellungen' })).toHaveCount(1);
  await expect(desktop.filter({ hasText: 'Abmelden' })).toHaveCount(1);
  await expect(desktop.filter({ hasText: /Start|Kunde|Auftrag|Rapport|Rechnung/ })).toHaveCount(0);

  const mobile = page.locator('nav.mobile button');
  await expect(mobile).toHaveCount(2);
  await expect(mobile.filter({ hasText: 'Einstellungen' })).toHaveCount(1);
  await expect(mobile.filter({ hasText: 'Logout' })).toHaveCount(1);
  await expect(mobile.filter({ hasText: /Start|Kunde|Auftrag|Rapport|Rechnung/ })).toHaveCount(0);

  for (const target of ['home','customers','orders','reports','invoices','customer','report','invoice']) {
    await page.evaluate(tab => SH.go(tab), target);
    await expect(page.locator('.ux-admin-title h2')).toHaveText('Administration');
  }

  await expect(page.getByText('Hier werden ausschließlich globale Einstellungen des Service Hub verwaltet')).toBeVisible();
  await expect(page.locator('#adm-companyName')).toHaveValue('Rohr- & Kanaltechnik Winser');
  await expect(page.locator('#adm-iban')).toHaveValue('DE78 6009 0300 0424 6090 02');
  await expect(page.locator('#adm-vat')).toHaveValue('19');
  await expect(page.getByRole('heading', { name: 'Leistungskatalog' })).toBeVisible();
  await expect(page.getByText('Kundenkonditionen')).toHaveCount(0);
  await expect(page.getByText('Musterkunde Stuttgart GmbH')).toHaveCount(0);
});

test('Admin configures branding, Annette verifies it in the invoice', async ({ page }) => {
  await login(page, 'admin');
  await expect(page.locator('#adm-companyName')).toBeVisible();
  await page.locator('#adm-companyName').fill('Winser Test Branding');
  await page.locator('#adm-paymentText').fill('Test-Zahlungshinweis aus Administration.');
  await page.getByRole('button', { name: 'Einstellungen speichern' }).click();
  await expect(page.locator('.ux-admin-saved')).toContainText('Einstellungen gespeichert');

  await page.evaluate(() => SH.logout());
  await expect(page.locator('.loginbox')).toBeVisible();
  await page.goto('/?role=annette');
  await page.getByRole('button', { name: 'Anmelden' }).click();
  await expect(page.locator('header.top')).toContainText('Annette · Büro');
  await goModule(page, 'Rechnung', 'invoices');
  await page.getByRole('button', { name: '26175' }).first().click();
  await page.evaluate(() => { window.print = () => {}; });
  await page.getByRole('button', { name: 'PDF / Drucken' }).click();
  await expect(page.locator('.invoice-doc-v6')).toBeVisible();
  await expect(page.locator('.invoice-brand-name')).toHaveText('Winser Test Branding');
  const logo = page.locator('.invoice-brand-v6 img');
  await expect(logo).toHaveAttribute('src', './assets/rokatech-winser-logo.webp');
  await expect.poll(() => logo.evaluate(img => img.naturalWidth), { timeout: 8_000 }).toBeGreaterThan(200);
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
  await page.locator('.report-lines-card button.ux-danger-confirm').click();
  await confirmModal(page, 'Leistung löschen', 'Löschen');
  await expect(page.locator('.report-lines-card button.ux-danger-confirm')).toHaveCount(0);
  await expect(page.locator('.ux-empty')).toContainText('Noch keine Leistung');
  await expect(page.locator('.ux-undo-toast')).toContainText('Leistung entfernt');
  await page.locator('.ux-undo-toast button').click();
  await expect(page.locator('header.top')).toBeVisible();
  await openSeedReport(page);
  await expect(page.locator('.report-lines-card button.ux-danger-confirm')).toHaveCount(1);
});

test('Material can be removed with in-app confirmation', async ({ page }) => {
  await login(page, 'dome');
  await openSeedReport(page);
  await page.getByRole('button', { name: '+ Material' }).click();
  let m = await modal(page, 'Material hinzufügen');
  await m.getByLabel('Material / Bezeichnung').fill('Testmaterial');
  await m.getByLabel('Menge').fill('2');
  await m.getByLabel('Einzelpreis €').fill('4.50');
  await m.getByRole('button', { name: 'Material hinzufügen' }).click();
  await expect(page.getByText(/Testmaterial/)).toBeVisible();
  const materialDelete = page.locator('.card').filter({ hasText: 'Testmaterial' }).getByRole('button', { name: 'Löschen' }).first();
  await materialDelete.click();
  await confirmModal(page, 'Material löschen', 'Löschen');
  await expect(page.getByText(/Testmaterial/)).toHaveCount(0);
});

test('A newly created customer can be reverted globally', async ({ page }) => {
  await login(page, 'annette');
  await goModule(page, 'Kunden', 'customers');
  await page.getByRole('button', { name: '+ Kunde' }).click();
  const m = await modal(page, 'Kunde anlegen');
  await m.getByLabel('Kundenname').fill('Undo Testkunde GmbH');
  await m.getByLabel('Adresse').fill('Teststraße 1, 70173 Stuttgart');
  await m.getByLabel('Ansprechpartner').fill('Test Kontakt');
  await m.getByLabel('Telefon').fill('0711 123456');
  await m.getByLabel('E-Mail').fill('test@example.de');
  await m.getByLabel('Stundensatz €/h').fill('85');
  await m.getByLabel('Bevorzugter Kommunikationskanal').selectOption('E-Mail');
  await m.getByRole('button', { name: 'Kunde anlegen' }).click();
  await expect(page.locator('main h2')).toHaveText('Undo Testkunde GmbH');
  await expect(page.locator('.ux-undo-toast')).toContainText('Kunde angelegt');
  await page.locator('.ux-undo-toast button').click();
  await expect(page.locator('header.top')).toBeVisible();
  await goModule(page, 'Kunden', 'customers');
  await expect(page.getByText('Undo Testkunde GmbH')).toHaveCount(0);
});
