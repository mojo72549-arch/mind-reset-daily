const { test, expect } = require('@playwright/test');

async function login(page, role) {
  await page.goto(`/?role=${role}`);
  await page.getByRole('button', { name: 'Anmelden' }).click();
  await expect(page.locator('header.top')).toBeVisible();
}

async function openSeedReport(page) {
  await page.evaluate(() => SH.openReport(101));
  await expect(page.locator('#rw')).toBeVisible();
  await expect(page.locator('#uxReportStart')).toBeVisible();
}

async function expectReportDraft(page) {
  await expect(page.locator('#rw')).toHaveValue('Küche geprüft und Leitung gespült.');
  await expect(page.locator('#rr')).toHaveValue('Ablauf frei, keine weiteren Arbeiten nötig.');
  await expect(page.locator('#uxReportStart')).toHaveValue('08:15');
  await expect(page.locator('#uxReportEnd')).toHaveValue('09:45');
  await expect(page.locator('#rcname')).toHaveValue('Thomas Berger Test');
  await expect(page.locator('#rpay')).toHaveValue('Betrag bar erhalten');
  await expect(page.locator('#rsvc')).toHaveValue('svc1');
  await expect(page.locator('#rqty')).toHaveValue('1.5');
}

for (const role of ['dome', 'annette']) {
  test(`${role}: report fields survive actions and new items appear immediately`, async ({ page }) => {
    await login(page, role);
    await openSeedReport(page);

    await page.locator('#rw').fill('Küche geprüft und Leitung gespült.');
    await page.locator('#rr').fill('Ablauf frei, keine weiteren Arbeiten nötig.');
    await page.locator('#uxReportStart').fill('08:15');
    await page.locator('#uxReportEnd').fill('09:45');
    await page.locator('#rcname').fill('Thomas Berger Test');
    await page.locator('#rpay').selectOption({ label: 'Betrag bar erhalten' });
    await page.locator('#rsvc').selectOption('svc1');
    await page.locator('#rqty').fill('1.5');

    await page.getByRole('button', { name: '+ Leistung', exact: true }).click();
    await expectReportDraft(page);
    await expect(page.locator('.report-lines-card')).toContainText('Gerätewageneinsatz');
    await expect(page.locator('.report-lines-card')).toContainText('1.5');

    await page.getByRole('button', { name: '+ Material', exact: true }).click();
    const material = page.locator('#shp-app-modal');
    await material.getByLabel('Material / Bezeichnung').fill('Dichtung Test');
    await material.getByLabel('Menge').fill('2');
    await material.getByLabel('Einzelpreis €').fill('4.50');
    await material.getByRole('button', { name: 'Material hinzufügen' }).click();
    await expect(page.getByText(/Dichtung Test/)).toBeVisible();
    await expectReportDraft(page);

    await page.getByRole('button', { name: '+ Messwert', exact: true }).click();
    const measurement = page.locator('#shp-app-modal');
    await measurement.getByLabel('Messwert / Prüfpunkt').fill('Rohrdurchmesser');
    await measurement.getByLabel('Wert').fill('100');
    await measurement.getByLabel('Einheit').fill('mm');
    await measurement.getByRole('button', { name: 'Messwert hinzufügen' }).click();
    await expect(page.getByText(/Rohrdurchmesser/)).toBeVisible();
    await expectReportDraft(page);

    await page.evaluate(() => {
      const c = document.getElementById('sigC');
      const ctx = c.getContext('2d');
      ctx.beginPath(); ctx.moveTo(10, 10); ctx.lineTo(80, 35); ctx.stroke();
      c.dataset.signatureDirty = '1';
      SHP_REPORT_TIME.save();
    });

    await page.evaluate(() => SH.go('reports'));
    await expect(page.locator('main h2')).toHaveText('Rapporte');
    await openSeedReport(page);
    await expectReportDraft(page);
    await expect(page.locator('.report-lines-card')).toContainText('Gerätewageneinsatz');
    await expect(page.getByText(/Dichtung Test/)).toBeVisible();
    await expect(page.getByText(/Rohrdurchmesser/)).toBeVisible();

    const storedSignature = await page.evaluate(() => {
      const db = JSON.parse(localStorage.getItem('shp_db'));
      return db.reports.find(r => r.orderId === 101).sigC || '';
    });
    expect(storedSignature.startsWith('data:image/')).toBeTruthy();
  });
}

test('Dome memory draft survives navigation before explicit save', async ({ page }) => {
  await login(page, 'dome');
  await page.evaluate(() => SH.go('orders'));
  await expect(page.locator('.dome-order-memory-v12')).toBeVisible();
  await page.locator('.dome-order-memory-details summary').first().click();
  const input = page.locator('.dome-order-memory-input').first();
  await input.fill('Kellerleitung gespült und Zugang über Revisionsöffnung geprüft.');
  await page.evaluate(() => SH.go('home'));
  await page.evaluate(() => SH.go('orders'));
  await expect(page.locator('.dome-order-memory-input').first()).toHaveValue('Kellerleitung gespült und Zugang über Revisionsöffnung geprüft.');
});

test('Admin unsaved settings draft survives an internal rerender', async ({ page }) => {
  await login(page, 'admin');
  await expect(page.locator('#adm-companyName')).toBeVisible();
  await page.locator('#adm-companyName').fill('Winser Entwurf nicht verloren');
  await page.locator('#adm-street').fill('Entwurfstraße 99');
  await page.evaluate(() => SH.go('admin'));
  await expect(page.locator('#adm-companyName')).toHaveValue('Winser Entwurf nicht verloren');
  await expect(page.locator('#adm-street')).toHaveValue('Entwurfstraße 99');
});

test('Shared start dashboard stays compact but useful for Dome and Annette', async ({ page }) => {
  for (const role of ['dome','annette']) {
    await page.goto(`/?role=${role}`);
    await page.getByRole('button', { name: 'Anmelden' }).click();
    await expect(page.locator('.crm-start-hero-v14')).toBeVisible();
    await expect(page.locator('.crm-start-status-tile')).toHaveCount(3);
    await expect(page.getByText('Nächste Aufträge')).toBeVisible();
    await expect(page.locator('.crm-slim-order')).toHaveCount(1);
    await page.evaluate(() => SH.logout());
  }
});
