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
  await expect(page.locator('html')).toHaveAttribute('data-sh-report-native-actions', /v19-report-native-actions/);
  await expect.poll(() => page.evaluate(() => Boolean(window.SHP_REPORT_NATIVE_PDF && window.SHP_REPORT_NATIVE_PDF.buildPdf))).toBe(true);
}

test('V19 exposes exactly one local rapport PDF action path and no legacy CDN generator', async ({ page }) => {
  const externalPdfRequests = [];
  page.on('request', req => {
    if (/cdnjs|jspdf|autotable/i.test(req.url())) externalPdfRequests.push(req.url());
  });

  await login(page, 'annette');
  await openSeedReport(page);

  await expect(page.getByRole('button', { name: 'PDF über WhatsApp teilen', exact: true })).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'PDF erstellen / Drucken', exact: true })).toHaveCount(1);

  const loadedScripts = await page.locator('script[src]').evaluateAll(nodes => nodes.map(n => n.getAttribute('src') || ''));
  expect(loadedScripts.some(src => /ux-v17-report-document\.js/i.test(src))).toBe(false);
  expect(loadedScripts.some(src => /cdnjs|jspdf|autotable/i.test(src))).toBe(false);
  expect(externalPdfRequests).toEqual([]);
});

test('V19 builds a real local PDF without jsPDF and downloads it from the PDF/Drucken action', async ({ page }) => {
  await login(page, 'annette');
  await openSeedReport(page);
  await page.locator('#rw').fill('Rohr identifiziert und Reparatur durchgeführt');
  await page.locator('#rr').fill('Erledigt');

  const pdfMeta = await page.evaluate(async () => {
    const built = await window.SHP_REPORT_NATIVE_PDF.buildPdf();
    const bytes = new Uint8Array(await built.blob.arrayBuffer());
    const head = String.fromCharCode(...bytes.slice(0, 8));
    return { name: built.name, type: built.blob.type, size: built.blob.size, head };
  });
  expect(pdfMeta.name).toBe('Rapport-A-2026-0101.pdf');
  expect(pdfMeta.type).toBe('application/pdf');
  expect(pdfMeta.size).toBeGreaterThan(500);
  expect(pdfMeta.head).toContain('%PDF-1.4');

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'PDF erstellen / Drucken', exact: true }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('Rapport-A-2026-0101.pdf');
});

test('V19 hands the locally generated PDF file to native sharing when supported', async ({ page }) => {
  await login(page, 'annette');
  await openSeedReport(page);
  await page.locator('#rw').fill('PDF Versandtest');
  await page.locator('#rr').fill('Erledigt');

  await page.evaluate(() => {
    Object.defineProperty(navigator, 'canShare', { configurable: true, value: () => true });
    Object.defineProperty(navigator, 'share', { configurable: true, value: async data => {
      const file = data.files[0];
      window.__sharedReport = { name: file.name, type: file.type, size: file.size, text: data.text, title: data.title };
    }});
  });

  await page.getByRole('button', { name: 'PDF über WhatsApp teilen', exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.__sharedReport || null)).not.toBeNull();
  const shared = await page.evaluate(() => window.__sharedReport);
  expect(shared.name).toBe('Rapport-A-2026-0101.pdf');
  expect(shared.type).toBe('application/pdf');
  expect(shared.size).toBeGreaterThan(500);
  expect(shared.title).toContain('Rapport A-2026-0101');
  expect(shared.text).toContain('Rapport zu Auftrag A-2026-0101');
});
