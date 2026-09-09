const { test, expect } = require('@playwright/test');

async function login(page, role = 'annette') {
  await page.goto(`/?role=${role}`);
  await page.getByRole('button', { name: 'Anmelden' }).click();
  await expect(page.locator('header.top')).toBeVisible();
}

async function drawSignature(page, selector) {
  const canvas = page.locator(selector);
  await canvas.scrollIntoViewIfNeeded();
  const box = await canvas.boundingBox();
  expect(box).toBeTruthy();
  const x = box.x + Math.min(30, box.width * 0.15);
  const y = box.y + Math.min(40, box.height * 0.35);
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + Math.min(65, box.width * 0.32), y + 14, { steps: 5 });
  await page.mouse.move(x + Math.min(120, box.width * 0.58), y - 7, { steps: 5 });
  await page.mouse.up();
}

async function prepareSeedReport(page) {
  await page.evaluate(() => SH.openReport(101));
  await expect(page.locator('#rw')).toBeVisible();
  await page.locator('#rw').fill('Freigabetest vollständig durchgeführt.');
  await page.locator('#rr').fill('Ergebnis in Ordnung.');
  await page.locator('#uxReportStart').fill('09:00');
  await page.locator('#uxReportEnd').fill('10:00');
  await page.evaluate(() => window.SHP_REPORT_TIME && window.SHP_REPORT_TIME.save());
}

async function finishSignedSeedReport(page) {
  await prepareSeedReport(page);
  await drawSignature(page, '#sigC');
  await drawSignature(page, '#sigT');
  await page.getByRole('button', { name: 'Rapport abschließen' }).click();
  await expect.poll(() => page.evaluate(() => {
    const db = JSON.parse(localStorage.getItem('shp_db'));
    return db.reports.find(r => r.orderId === 101).status;
  })).toBe('Abgeschlossen');
}

test('F01: leere Unterschriftsflächen verhindern den Rapportabschluss', async ({ page }) => {
  await login(page);
  await prepareSeedReport(page);
  await page.getByRole('button', { name: 'Rapport abschließen' }).click();
  await expect(page.locator('.shp-business-guard-notice')).toContainText('Kunde und Techniker');
  const report = await page.evaluate(() => JSON.parse(localStorage.getItem('shp_db')).reports.find(r => r.orderId === 101));
  expect(report.status).not.toBe('Abgeschlossen');
  expect(report.sigC || '').toBe('');
  expect(report.sigT || '').toBe('');
});

test('F01 positiv: echte Kunden- und Technikerunterschrift erlaubt Abschluss', async ({ page }) => {
  await login(page);
  await finishSignedSeedReport(page);
  const report = await page.evaluate(() => JSON.parse(localStorage.getItem('shp_db')).reports.find(r => r.orderId === 101));
  expect(report.status).toBe('Abgeschlossen');
  expect(report.sigC).toMatch(/^data:image\/png/);
  expect(report.sigT).toMatch(/^data:image\/png/);
});

test('F02: Materialänderung nach Abschluss archiviert Stand und fordert neue Unterschriften', async ({ page }) => {
  await login(page);
  await finishSignedSeedReport(page);
  const oldSignature = await page.evaluate(() => JSON.parse(localStorage.getItem('shp_db')).reports.find(r => r.orderId === 101).sigC);

  await page.getByRole('button', { name: '+ Material' }).click();
  const modal = page.locator('#shp-app-modal');
  await modal.getByLabel('Material / Bezeichnung').fill('Korrektur-Dichtung');
  await modal.getByLabel('Menge').fill('1');
  await modal.getByLabel('Einzelpreis €').fill('5.00');
  await modal.getByRole('button', { name: 'Material hinzufügen' }).click();
  await expect(modal).toHaveCount(0);

  const state = await page.evaluate(() => {
    const db = JSON.parse(localStorage.getItem('shp_db'));
    const report = db.reports.find(r => r.orderId === 101);
    const order = db.orders.find(o => o.id === 101);
    return { report, order };
  });
  expect(state.report.status).toBe('Entwurf');
  expect(state.report.sigC).toBe('');
  expect(state.report.sigT).toBe('');
  expect(state.report.revisions).toHaveLength(1);
  expect(state.report.revisions[0].sigC).toBe(oldSignature);
  expect(state.order.status).toBe('In Bearbeitung');
});

test('F03: fehlende E-Mail erzeugt weder Übergabe noch Versandhistorie', async ({ page }) => {
  await login(page);
  await page.evaluate(() => SH.openInvoice(801));
  await expect(page.locator('main h2')).toContainText('Rechnung 26175');
  const before = await page.evaluate(() => {
    const bridge = window.SHP_DATA_BRIDGE;
    const db = bridge.readDb();
    const iv = bridge.currentInvoice();
    db.customers.find(c => c.id === iv.customerId).email = '';
    bridge.save();
    return iv.sentHistory.length;
  });
  const result = await page.evaluate(() => SH.sendInvoice('E-Mail'));
  expect(result).toBe(false);
  await expect(page.locator('.shp-business-guard-notice')).toContainText('Keine gültige E-Mail-Adresse');
  const after = await page.evaluate(() => window.SHP_DATA_BRIDGE.currentInvoice().sentHistory.length);
  expect(after).toBe(before);
});

test('F04: überfällige Teilzahlung zählt nur den offenen Restbetrag', async ({ page }) => {
  await login(page);
  const result = await page.evaluate(() => {
    const bridge = window.SHP_DATA_BRIDGE;
    const db = bridge.readDb();
    const iv = db.invoices.find(i => i.id === 801);
    iv.gross = 100;
    iv.status = 'Teilbezahlt';
    iv.due = '01.01.2020';
    bridge.save();
    localStorage.setItem('shp_invoice_payment_meta', JSON.stringify({
      '801': { stage: 'Keine', history: [], paidAmount: 40 }
    }));
    return {
      state: window.SHP_BUSINESS_GUARDS.paymentState(iv),
      stats: window.SHP_BUSINESS_GUARDS.stats(db)
    };
  });
  expect(result.state.key).toBe('overdue');
  expect(result.state.openAmount).toBe(60);
  expect(result.stats.overdue).toBe(1);
  expect(result.stats.overdueAmount).toBe(60);
  expect(result.stats.openAmount).toBe(60);
});

test('F05: bezahlte Rechnung kann keine neue Mahnstufe erhalten', async ({ page }) => {
  await login(page);
  await page.evaluate(() => {
    const bridge = window.SHP_DATA_BRIDGE;
    const db = bridge.readDb();
    db.invoices.find(i => i.id === 801).status = 'Bezahlt';
    bridge.save();
    localStorage.setItem('shp_invoice_payment_meta', JSON.stringify({
      '801': { stage: 'Zahlungserinnerung', history: [{ text: 'bestehend' }] }
    }));
    SH.openInvoice(801);
  });
  await expect(page.locator('#crm-payment-stage-801')).toBeDisabled();
  const saved = await page.evaluate(() => {
    const select = document.getElementById('crm-payment-stage-801');
    select.disabled = false;
    select.value = '1. Mahnung';
    const result = window.SHP_BUSINESS_GUARDS.saveStage(801);
    return { result, meta: JSON.parse(localStorage.getItem('shp_invoice_payment_meta'))['801'] };
  });
  expect(saved.result).toBe(false);
  expect(saved.meta.stage).toBe('Zahlungserinnerung');
  expect(saved.meta.history).toHaveLength(1);
});

test('A07: deutsche Telefonnummern werden für WhatsApp konsistent normalisiert', async ({ page }) => {
  await login(page);
  const values = await page.evaluate(() => [
    window.SHP_BUSINESS_GUARDS.normalizePhone('0152 23401628'),
    window.SHP_BUSINESS_GUARDS.normalizePhone('+49 152 23401628'),
    window.SHP_BUSINESS_GUARDS.normalizePhone('0049 152 23401628')
  ]);
  expect(new Set(values).size).toBe(1);
  expect(values[0]).toBe('4915223401628');
});
