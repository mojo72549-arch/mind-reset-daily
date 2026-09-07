const { test, expect } = require('@playwright/test');

async function login(page, role='annette') {
  await page.goto('/?role='+role);
  await page.getByRole('button', { name: 'Anmelden' }).click();
  await expect(page.locator('header.top')).toBeVisible();
}

test('V18 creates a real rapport PDF locally with no CDN dependency', async ({ page }) => {
  const cdnRequests=[];
  page.on('request', req => { if (/cdnjs\.cloudflare\.com/i.test(req.url())) cdnRequests.push(req.url()); });
  await page.route('https://cdnjs.cloudflare.com/**', route => route.abort());

  await login(page, 'annette');
  await page.evaluate(() => SH.openReport(101));
  await expect(page.locator('#rw')).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('data-sh-report-native-pdf', '20260907-v18-report-native-pdf1');

  await page.locator('#rw').fill('Rohr geprüft und gereinigt');
  await page.locator('#rr').fill('Arbeiten abgeschlossen');

  const result = await page.evaluate(async () => {
    const built = await window.SHP_REPORT_NATIVE_PDF.buildPdf();
    const buf = new Uint8Array(await built.blob.arrayBuffer());
    return {
      name: built.name,
      type: built.blob.type,
      size: built.blob.size,
      header: String.fromCharCode(...buf.slice(0,5)),
      tail: String.fromCharCode(...buf.slice(-5))
    };
  });

  expect(result.name).toBe('Rapport-A-2026-0101.pdf');
  expect(result.type).toBe('application/pdf');
  expect(result.size).toBeGreaterThan(1500);
  expect(result.header).toBe('%PDF-');
  expect(result.tail).toContain('EOF');
  expect(cdnRequests).toHaveLength(0);
});

test('V18 leaves the approved invoice document version untouched', async ({ page }) => {
  await login(page, 'annette');
  await page.evaluate(() => SH.go('invoices'));
  await page.getByRole('button', { name: '26175' }).first().click();
  await page.evaluate(() => { window.print = () => {}; });
  await page.getByRole('button', { name: 'PDF / Drucken' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-sh-invoice-logo', '20260903-v9-5');
  await expect(page.locator('.invoice-brand-v6 img')).toHaveAttribute('src', './assets/rokatech-winser-logo.webp');
});