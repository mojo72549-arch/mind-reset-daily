const { test, expect } = require('@playwright/test');

async function loginAnnette(page) {
  await page.goto('/?role=annette');
  await page.getByRole('button', { name: 'Anmelden' }).click();
  await expect(page.locator('header.top')).toBeVisible();
  await expect(page.locator('.crm-start-slim-v12')).toBeVisible();
}

async function expectNoHorizontalOverflow(page) {
  const sizes = await page.evaluate(() => ({
    viewport: window.innerWidth,
    document: document.documentElement.scrollWidth,
    body: document.body.scrollWidth
  }));
  expect(sizes.document).toBeLessThanOrEqual(sizes.viewport + 1);
  expect(sizes.body).toBeLessThanOrEqual(sizes.viewport + 1);
}

async function expectDesktopNavigation(page) {
  const desktop = page.locator('.nav.desktop[data-sh-nav-build]');
  await expect(desktop).toBeVisible();
  await expect(desktop.locator('button')).toHaveCount(6);
  await expect(desktop.locator('button.ux-active')).toHaveText('Start');
  const activeStyle = await desktop.locator('button.ux-active').evaluate(el => {
    const style = getComputedStyle(el);
    return { radius: parseFloat(style.borderRadius), background: style.backgroundColor };
  });
  expect(activeStyle.radius).toBeGreaterThan(0);
  expect(activeStyle.background).not.toBe('rgba(0, 0, 0, 0)');
  await expect(page.locator('nav.mobile')).toBeHidden();
}

async function expectMobileNavigation(page) {
  await expect(page.locator('.nav.desktop')).toBeHidden();
  const mobile = page.locator('nav.mobile.shp-six-tab-nav');
  await expect(mobile).toBeVisible();
  await expect(mobile.locator('button')).toHaveCount(6);
  await expect(mobile.locator('button.ux-active')).toContainText('Start');
}

test('final CRM surface uses available space and stays usable at all target sizes', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await loginAnnette(page);
  await expectDesktopNavigation(page);
  await expect(page.locator('.crm-customer-finder-v10')).toBeVisible();
  await expect(page.locator('.crm-payment-monitor-v15')).toBeVisible();
  const wideBox = await page.locator('.crm-start-slim-v12').boundingBox();
  expect(wideBox).not.toBeNull();
  expect(wideBox.width).toBeGreaterThan(1200);
  expect(wideBox.width).toBeLessThanOrEqual(1481);
  await expectNoHorizontalOverflow(page);

  await page.setViewportSize({ width: 1024, height: 800 });
  await expectDesktopNavigation(page);
  const notebookBox = await page.locator('.crm-start-slim-v12').boundingBox();
  expect(notebookBox).not.toBeNull();
  expect(notebookBox.width).toBeGreaterThan(900);
  await expectNoHorizontalOverflow(page);

  await page.setViewportSize({ width: 768, height: 1024 });
  await expectMobileNavigation(page);
  await expect(page.locator('.crm-start-status-tile')).toHaveCount(3);
  const statusColumns = await page.locator('.crm-start-status-grid').evaluate(el => getComputedStyle(el).gridTemplateColumns.split(' ').length);
  expect(statusColumns).toBe(3);
  await expect(page.locator('.crm-payment-metric')).toHaveCount(4);
  await expectNoHorizontalOverflow(page);

  await page.setViewportSize({ width: 390, height: 844 });
  await expectMobileNavigation(page);
  await expect(page.locator('.crm-customer-search-input')).toBeVisible();
  await expect(page.locator('.crm-payment-monitor-v15')).toBeVisible();
  await expectNoHorizontalOverflow(page);
});
