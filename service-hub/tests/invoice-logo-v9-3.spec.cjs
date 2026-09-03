const { test, expect } = require('@playwright/test');

const LOCAL_LOGO = './assets/rokatech-winser-logo.webp';
const LEGACY_LOGO = 'https://www.rokatech-winser.de/wp-content/uploads/go-x/u/e15217ec-0726-4ba7-973f-a03bedee5f55/image-911x911.png';

async function login(page, role = 'annette') {
  await page.goto('/?role=' + role);
  await page.getByRole('button', { name: 'Anmelden' }).click();
  await expect(page.locator('header.top')).toBeVisible();
}

async function openSeedInvoice(page) {
  await page.evaluate(() => SH.go('invoices'));
  await page.getByRole('button', { name: '26175' }).first().click();
  await expect(page.locator('main h2')).toContainText('Rechnung 26175');
}

test('V9.5 serves and renders the original Winser logo from the local Service Hub asset', async ({ page, request }) => {
  const asset = await request.get('/assets/rokatech-winser-logo.webp');
  expect(asset.ok()).toBeTruthy();
  expect((await asset.body()).length).toBeGreaterThan(6000);

  await login(page, 'annette');
  await openSeedInvoice(page);
  await page.evaluate(() => {
    window.__printCalls = [];
    window.print = () => {
      const img = document.querySelector('.invoice-brand-v6 img');
      window.__printCalls.push({
        complete: !!(img && img.complete),
        naturalWidth: img ? img.naturalWidth : 0,
        naturalHeight: img ? img.naturalHeight : 0,
        src: img ? (img.currentSrc || img.src) : '',
        attributeSrc: img ? img.getAttribute('src') : ''
      });
    };
  });

  await page.getByRole('button', { name: 'PDF / Drucken' }).click();
  const logo = page.locator('.invoice-brand-v6 img');
  await expect(logo).toBeVisible();
  await expect(logo).toHaveAttribute('src', LOCAL_LOGO);
  await expect(logo).toHaveAttribute('alt', 'Rohr- & Kanaltechnik Winser – Firmenlogo');
  await expect(page.locator('html')).toHaveAttribute('data-sh-invoice-logo', '20260903-v9-5');
  await expect(page.locator('.invoice-logo-fallback-v95')).toHaveCount(0);

  await expect.poll(() => page.evaluate(() => {
    const img = document.querySelector('.invoice-brand-v6 img');
    return img ? img.naturalWidth : 0;
  }), { timeout: 8_000 }).toBeGreaterThan(200);

  await expect.poll(() => page.evaluate(() => window.__printCalls.length), { timeout: 8_000 }).toBe(1);
  const call = await page.evaluate(() => window.__printCalls[0]);
  expect(call.complete).toBe(true);
  expect(call.naturalWidth).toBeGreaterThan(200);
  expect(call.naturalHeight).toBeGreaterThan(200);
  expect(call.attributeSrc).toBe(LOCAL_LOGO);
  expect(call.src).toContain('/assets/rokatech-winser-logo.webp');
});

test('V9.5 migrates the previous remote logo setting to the local original logo', async ({ page }) => {
  await login(page, 'annette');
  await page.evaluate((legacy) => {
    const db = JSON.parse(localStorage.getItem('shp_db'));
    db.settings = db.settings || {};
    db.settings.company = Object.assign({}, db.settings.company || {}, { logoUrl: legacy });
    localStorage.setItem('shp_db', JSON.stringify(db));
  }, LEGACY_LOGO);

  await page.reload();
  await expect(page.locator('header.top')).toBeVisible();
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('shp_db')).settings.company.logoUrl);
  expect(stored).toBe(LOCAL_LOGO);

  await openSeedInvoice(page);
  await page.evaluate(() => { window.print = () => {}; });
  await page.getByRole('button', { name: 'PDF / Drucken' }).click();
  await expect(page.locator('.invoice-brand-v6 img')).toHaveAttribute('src', LOCAL_LOGO);
});

test('V9.5 keeps a clean text fallback only when an explicitly configured custom logo really fails', async ({ page }) => {
  await login(page, 'annette');
  await page.evaluate(() => {
    const db = JSON.parse(localStorage.getItem('shp_db'));
    db.settings = db.settings || {};
    db.settings.company = Object.assign({}, db.settings.company || {}, { logoUrl: 'https://invalid.example.invalid/company-logo.webp' });
    localStorage.setItem('shp_db', JSON.stringify(db));
  });
  await openSeedInvoice(page);
  await page.evaluate(() => { window.print = () => {}; });
  await page.getByRole('button', { name: 'PDF / Drucken' }).click();

  const fallback = page.locator('.invoice-logo-fallback-v95');
  await expect(fallback).toBeVisible({ timeout: 8_000 });
  await expect(fallback).toHaveAttribute('aria-label', 'Firmenlogo nicht verfügbar – Rohr- & Kanaltechnik Winser');
  await expect(fallback).toContainText('Winser');
  await expect(page.locator('.invoice-logo-fallback-v6')).toHaveCount(0);
});

test('V9.5 admin branding shows and persists the local original logo as the company default', async ({ page }) => {
  await login(page, 'admin');
  await page.evaluate(() => SH.go('admin'));
  await expect(page.getByRole('heading', { name: 'Administration' })).toBeVisible();

  const input = page.locator('#adm-logoUrl');
  const preview = page.locator('.ux-admin-logo-preview');
  await expect(input).toHaveValue(LOCAL_LOGO);
  await expect(preview).toHaveAttribute('src', LOCAL_LOGO);
  await expect(page.getByText('Original Winser-Logo lokal im Service Hub', { exact: false })).toBeVisible();

  await page.getByRole('button', { name: 'Einstellungen speichern' }).click();
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('shp_db')).settings.company.logoUrl);
  expect(stored).toBe(LOCAL_LOGO);
});
