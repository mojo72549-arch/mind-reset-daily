const { test, expect } = require('@playwright/test');

async function login(page, role = 'annette') {
  await page.goto('/?role=' + role);
  await page.getByRole('button', { name: 'Anmelden' }).click();
  await expect(page.locator('header.top')).toBeVisible();
}

async function openSeedReport(page) {
  await page.evaluate(() => SH.go('reports'));
  await page.getByRole('button', { name: 'Rapport öffnen' }).first().click();
  await expect(page.locator('#rw')).toBeVisible();
}

test('V17 prints the rapport in the approved invoice design language without changing invoice code', async ({ page }) => {
  await login(page, 'annette');
  await openSeedReport(page);
  await page.locator('#rw').fill('Rohr identifiziert und Reparatur durchgeführt');
  await page.locator('#rr').fill('Erledigt');
  await page.evaluate(() => { window.__reportPrints = 0; window.print = () => { window.__reportPrints += 1; }; });

  await page.getByRole('button', { name: 'PDF erstellen / Drucken' }).click();

  await expect(page.locator('.report-doc-v17')).toBeVisible();
  await expect(page.locator('.report-doc-v17')).toHaveClass(/invoice-doc-v6/);
  await expect(page.locator('.report-doc-v17 .invoice-brand-line-v6')).toHaveCount(1);
  await expect(page.locator('.report-doc-v17 .invoice-brand-v6 img')).toHaveAttribute('src', './assets/rokatech-winser-logo.webp');
  await expect(page.locator('.report-doc-v17 .report-meta-v17 h1')).toHaveText('RAPPORT');
  await expect(page.locator('.report-doc-v17 .report-recipient-v17')).toContainText('Musterkunde Stuttgart GmbH');
  await expect(page.locator('.report-doc-v17 .report-items-v17')).toHaveClass(/invoice-items-v6/);
  await expect(page.locator('.report-doc-v17 .report-totals-v17')).toHaveClass(/invoice-totals-v6/);
  await expect(page.locator('.report-doc-v17')).toContainText('Rohr identifiziert und Reparatur durchgeführt');
  await expect(page.locator('.report-doc-v17')).toContainText('Erledigt');
  await expect(page.locator('html')).toHaveAttribute('data-sh-report-document', '20260907-v17-report-document1');
  await expect.poll(() => page.evaluate(() => window.__reportPrints)).toBe(1);
});

test('V17 creates a real PDF File and hands it to native share when file sharing is available', async ({ page }) => {
  await login(page, 'annette');
  await openSeedReport(page);
  await page.locator('#rw').fill('PDF Versandtest');
  await page.locator('#rr').fill('Erledigt');

  await page.evaluate(() => {
    function FakePDF() { this.lastAutoTable = { finalY: 85 }; }
    FakePDF.API = { autoTable() {} };
    ['setFillColor','rect','setTextColor','setFont','setFontSize','text','setDrawColor','setLineWidth','line','roundedRect','addPage','addImage'].forEach((name) => {
      FakePDF.prototype[name] = function(){ return this; };
    });
    FakePDF.prototype.splitTextToSize = function(text){ return [String(text)]; };
    FakePDF.prototype.autoTable = function(opts){ this.lastAutoTable = { finalY: (opts.startY || 40) + 25 }; return this; };
    FakePDF.prototype.output = function(){ return new Blob(['%PDF-1.4\nService Hub Pro\n'], { type: 'application/pdf' }); };
    window.jspdf = { jsPDF: FakePDF };
    Object.defineProperty(navigator, 'canShare', { configurable: true, value: () => true });
    Object.defineProperty(navigator, 'share', { configurable: true, value: async (data) => {
      const file = data.files[0];
      window.__sharedReport = { name: file.name, type: file.type, size: file.size, text: data.text, title: data.title };
    }});
  });

  await page.getByRole('button', { name: 'PDF über WhatsApp teilen' }).click();
  await expect.poll(() => page.evaluate(() => window.__sharedReport || null)).not.toBeNull();
  const shared = await page.evaluate(() => window.__sharedReport);
  expect(shared.name).toBe('Rapport-A-2026-0101.pdf');
  expect(shared.type).toBe('application/pdf');
  expect(shared.size).toBeGreaterThan(10);
  expect(shared.title).toContain('Rapport A-2026-0101');
  expect(shared.text).toContain('Rapport zu Auftrag A-2026-0101');
});
