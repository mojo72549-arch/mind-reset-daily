const { test, expect } = require('@playwright/test');

for (const role of ['dome','annette','admin']) {
  test(`public login does not reveal credentials for ${role}`, async ({ page }) => {
    await page.goto(`/?role=${role}`);

    const box = page.locator('.loginbox');
    await expect(box).toBeVisible();
    await expect(page.locator('#u')).toBeHidden();
    await expect(page.locator('#p')).toHaveAttribute('type', 'password');
    await expect(page.locator('#p')).not.toHaveAttribute('type', 'text');
    await expect(box.getByText(/Demo-2026/i)).toHaveCount(0);
    await expect(box.getByText(/dome\s*\/\s*annette\s*\/\s*admin/i)).toHaveCount(0);
    await expect(box.getByText('Zugangsdaten werden nicht öffentlich angezeigt.')).toBeVisible();
  });
}
