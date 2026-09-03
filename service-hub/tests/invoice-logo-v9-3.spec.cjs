const { test, expect } = require('@playwright/test');

async function loginAnnette(page) {
  await page.goto('/?role=annette');
  await page.getByRole('button', { name: 'Anmelden' }).click();
  await expect(page.locator('header.top')).toBeVisible();
}

async function openSeedInvoice(page) {
  await page.evaluate(() => SH.go('invoices'));
  await page.getByRole('button', { name: '26175' }).first().click();
  await expect(page.locator('main h2')).toContainText('Rechnung 26175');
}

test('invoice print loads the original Rokatech logo before opening browser print', async ({ page }) => {
  await loginAnnette(page);
  await openSeedInvoice(page);
  await page.evaluate(() => {
    window.__printCalls = [];
    window.print = () => {
      const img = document.querySelector('.invoice-brand-v6 img');
      window.__printCalls.push({
        complete: !!(img && img.complete),
        naturalWidth: img ? img.naturalWidth : 0,
        src: img ? img.currentSrc || img.src : ''
      });
    };
  });

  await page.getByRole('button', { name: 'PDF / Drucken' }).click();
  const logo = page.locator('.invoice-brand-v6 img');
  await expect(logo).toBeVisible();
  await expect(logo).toHaveAttribute('src', /rokatech-winser\.de\/.*image-911x911\.png/);
  await expect(logo).toHaveAttribute('referrerpolicy', 'no-referrer');
  await expect.poll(() => page.evaluate(() => {
    const img = document.querySelector('.invoice-brand-v6 img');
    return img ? img.naturalWidth : 0;
  }), { timeout: 10_000 }).toBeGreaterThan(0);
  await expect.poll(() => page.evaluate(() => window.__printCalls.length), { timeout: 10_000 }).toBe(1);
  const call = await page.evaluate(() => window.__printCalls[0]);
  expect(call.complete).toBe(true);
  expect(call.naturalWidth).toBeGreaterThan(0);
  expect(call.src).toContain('rokatech-winser.de');
});

test('invoice document keeps a visible branded fallback if remote logo fails', async ({ page }) => {
  await loginAnnette(page);
  await page.evaluate(() => {
    const db = JSON.parse(localStorage.getItem('shp_db'));
    db.settings = db.settings || {};
    db.settings.company = Object.assign({}, db.settings.company || {}, { logoUrl: 'https://invalid.example.invalid/logo.png' });
    localStorage.setItem('shp_db', JSON.stringify(db));
  });
  await openSeedInvoice(page);
  await page.evaluate(() => { window.print = () => {}; });
  await page.getByRole('button', { name: 'PDF / Drucken' }).click();
  await expect(page.locator('.invoice-logo-fallback-v6')).toBeVisible({ timeout: 8_000 });
  await expect(page.locator('.invoice-logo-fallback-v6')).toContainText('ROHR- & KANALTECHNIK');
});
