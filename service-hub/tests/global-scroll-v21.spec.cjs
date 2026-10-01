const { test, expect } = require('@playwright/test');

async function login(page, role) {
  await page.goto('/?role=' + role);
  await page.getByRole('button', { name: 'Anmelden' }).click();
  await expect(page.locator('header.top')).toBeVisible();
  await expect(page.locator('main.shell')).toBeVisible();
}

async function installScrollProbe(page) {
  await page.evaluate(() => {
    document.getElementById('shp-scroll-probe')?.remove();
    const probe = document.createElement('div');
    probe.id = 'shp-scroll-probe';
    probe.style.height = '1400px';
    probe.style.width = '1px';
    probe.style.pointerEvents = 'none';
    document.querySelector('main.shell').appendChild(probe);
    window.scrollTo(0, 0);
  });
}

async function expectDocumentScrollable(page) {
  const state = await page.evaluate(() => {
    const html = getComputedStyle(document.documentElement);
    const body = getComputedStyle(document.body);
    return {
      htmlOverflowY: html.overflowY,
      bodyOverflowY: body.overflowY,
      htmlTouch: html.touchAction,
      bodyTouch: body.touchAction,
      max: Math.max(0, document.documentElement.scrollHeight - innerHeight)
    };
  });
  expect(state.max).toBeGreaterThan(600);
  expect(state.htmlOverflowY).not.toBe('hidden');
  expect(state.bodyOverflowY).not.toBe('hidden');
  expect(state.htmlTouch).toContain('pan-y');
  expect(state.bodyTouch).toContain('pan-y');

  await page.mouse.wheel(0, 650);
  await page.waitForTimeout(80);
  expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(100);
}

for (const role of ['annette', 'dome', 'admin']) {
  test(`${role} can vertically scroll on Samsung S20 sized viewport`, async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await login(page, role);
    await installScrollProbe(page);
    await expectDocumentScrollable(page);
  });
}

test('Annette recovers scrolling after a dialog and after a stale modal lock', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await login(page, 'annette');
  await installScrollProbe(page);
  await expectDocumentScrollable(page);

  await page.evaluate(() => window.SH.newCustomer());
  await expect(page.locator('#shp-app-modal')).toBeVisible();
  await expect(page.locator('html')).toHaveClass(/shp-modal-open/);
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).overflowY)).toBe('hidden');

  await page.getByRole('button', { name: 'Abbrechen' }).click();
  await expect(page.locator('#shp-app-modal')).toHaveCount(0);
  await page.waitForTimeout(80);
  expect(await page.locator('html').evaluate(el => el.classList.contains('shp-modal-open'))).toBe(false);

  await page.evaluate(() => {
    document.documentElement.classList.add('shp-modal-open');
    document.documentElement.style.overflowY = 'hidden';
    document.body.style.overflowY = 'hidden';
    window.SHP_SCROLL_GUARD.sync();
    window.scrollTo(0, 0);
  });
  await expectDocumentScrollable(page);
});

test('Annette layout remains vertically usable without page-width overflow from compact phone to desktop', async ({ page }) => {
  for (const viewport of [
    { width: 320, height: 568 },
    { width: 360, height: 800 },
    { width: 390, height: 844 },
    { width: 768, height: 1024 },
    { width: 1366, height: 768 }
  ]) {
    await page.setViewportSize(viewport);
    await page.goto('/?role=annette');
    await page.getByRole('button', { name: 'Anmelden' }).click();
    await expect(page.locator('main.shell')).toBeVisible();

    const sizes = await page.evaluate(() => ({
      viewport: innerWidth,
      html: document.documentElement.scrollWidth,
      body: document.body.scrollWidth,
      overflowY: getComputedStyle(document.documentElement).overflowY
    }));
    expect(sizes.html).toBeLessThanOrEqual(sizes.viewport + 1);
    expect(sizes.body).toBeLessThanOrEqual(sizes.viewport + 1);
    expect(sizes.overflowY).not.toBe('hidden');
  }
});
