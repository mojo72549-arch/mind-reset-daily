const { test, expect } = require('@playwright/test');

async function login(page, role) {
  await page.addInitScript(() => { window.__SHP_TEST_MODE__ = true; });
  await page.goto(`/?role=${role}`);
  await page.getByRole('button', { name: 'Anmelden' }).click();
  await expect(page.locator('header.top')).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('data-sh-build', '20260822-v10');
}

async function go(page, tab) {
  await page.evaluate(t => SH.go(t), tab);
}

async function openSeedInvoice(page) {
  await go(page, 'invoices');
  await page.getByRole('button', { name: '26175' }).first().click();
  await expect(page.locator('main h2')).toContainText('Rechnung 26175');
}

async function drawSignature(page, selector) {
  const canvas = page.locator(selector);
  await canvas.scrollIntoViewIfNeeded();
  const isTouch = await page.evaluate(() => navigator.maxTouchPoints > 0);
  if (isTouch) {
    await page.evaluate(sel => {
      const c = document.querySelector(sel);
      if (!c) throw new Error(`Canvas ${sel} not found`);
      const r = c.getBoundingClientRect();
      const points = [[20,35],[55,58],[90,38],[125,66],[165,32]];
      const touch = ([x,y]) => new Touch({
        identifier: 42,
        target: c,
        clientX: r.left + x,
        clientY: r.top + y,
        pageX: window.scrollX + r.left + x,
        pageY: window.scrollY + r.top + y,
        screenX: r.left + x,
        screenY: r.top + y,
        radiusX: 2,
        radiusY: 2,
        force: 0.6
      });
      const dispatch = (type, point, active) => {
        const t = touch(point);
        c.dispatchEvent(new TouchEvent(type, {
          bubbles: true,
          cancelable: true,
          composed: true,
          touches: active ? [t] : [],
          targetTouches: active ? [t] : [],
          changedTouches: [t]
        }));
      };
      dispatch('touchstart', points[0], true);
      points.slice(1).forEach(p => dispatch('touchmove', p, true));
      dispatch('touchend', points[points.length - 1], false);
    }, selector);
  } else {
    const box = await canvas.boundingBox();
    expect(box).toBeTruthy();
    await page.mouse.move(box.x + 20, box.y + 35);
    await page.mouse.down();
    await page.mouse.move(box.x + 70, box.y + 65, { steps: 6 });
    await page.mouse.move(box.x + 130, box.y + 30, { steps: 6 });
    await page.mouse.up();
  }
  await expect(canvas).toHaveAttribute('data-signed', '1');
  await expect(canvas.locator('xpath=..').locator('.ux-v10-signature-state')).toContainText('Unterschrift erfasst');
}

test('admin is settings only and persists cost-free communication settings', async ({ page }) => {
  await login(page, 'admin');
  await go(page, 'admin');
  await expect(page.locator('.ux-admin-title h2')).toHaveText('Administration');
  await expect(page.getByText('Ausschließlich Systemeinstellungen')).toBeVisible();
  await expect(page.locator('.ux-v10-delivery-settings')).toHaveCount(1);
  await expect(page.locator('#adm-waNumber')).toBeVisible();
  await expect(page.locator('#adm-emailReplyTo')).toBeVisible();
  await expect(page.locator('#adm-waMode')).toHaveValue('Geräte-App (kostenfrei)');
  await expect(page.locator('#adm-emailMode')).toHaveValue('Standard-Mail-App (kostenfrei)');
  await expect(page.getByText('Musterkunde Stuttgart GmbH')).toHaveCount(0);
  await expect(page.getByText('26175', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Kunden', exact: true })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Rechnungen', exact: true })).toHaveCount(0);

  await page.locator('#adm-waNumber').fill('0152 99988777');
  await page.locator('#adm-waLabel').fill('Winser Service');
  await page.locator('#adm-emailReplyTo').fill('service@example.de');
  await page.getByRole('button', { name: 'Einstellungen speichern' }).click();
  await expect.poll(async () => page.evaluate(() => JSON.parse(localStorage.getItem('shp_db')).settings.delivery.whatsappNumber)).toBe('0152 99988777');
  await expect.poll(async () => page.evaluate(() => JSON.parse(localStorage.getItem('shp_db')).settings.delivery.emailReplyTo)).toBe('service@example.de');
  await expect(page.locator('.ux-v10-delivery-settings')).toHaveCount(1);
});

test('invoice delivery uses cost-free device handoff for WhatsApp, email and post', async ({ page }) => {
  await login(page, 'annette');
  await openSeedInvoice(page);

  await page.getByRole('button', { name: 'WhatsApp', exact: true }).click();
  await expect(page.locator('.ux-v10-pending')).toHaveCount(1);
  await expect(page.locator('.ux-v10-pending')).toContainText('WhatsApp vorbereitet');
  let last = await page.evaluate(() => window.SHP_LAST_DELIVERY);
  expect(last.channel).toBe('WhatsApp');
  expect(last.url).toMatch(/^https:\/\/wa\.me\//);
  expect(last.url).not.toMatch(/twilio/i);
  await page.getByRole('button', { name: 'Verwerfen' }).click();
  await expect(page.locator('.ux-v10-pending')).toHaveCount(0);

  await page.getByRole('button', { name: 'E-Mail', exact: true }).click();
  await expect(page.locator('.ux-v10-pending')).toHaveCount(1);
  await expect(page.locator('.ux-v10-pending')).toContainText('E-Mail vorbereitet');
  last = await page.evaluate(() => window.SHP_LAST_DELIVERY);
  expect(last.channel).toBe('E-Mail');
  expect(last.url).toMatch(/^mailto:/);
  await page.getByRole('button', { name: 'Verwerfen' }).click();
  await expect(page.locator('.ux-v10-pending')).toHaveCount(0);

  await page.getByRole('button', { name: 'Post / Druck' }).click();
  await expect(page.locator('.ux-v10-pending')).toHaveCount(1);
  await expect(page.locator('.ux-v10-pending')).toContainText('Post vorbereitet');
  last = await page.evaluate(() => window.SHP_LAST_DELIVERY);
  expect(last.channel).toBe('Post');
  expect(last.url).toBe('print://invoice/26175');
});

test('rapport cannot be completed without both signatures', async ({ page }) => {
  await login(page, 'annette');
  await go(page, 'reports');
  await page.getByRole('button', { name: 'Rapport öffnen' }).first().click();
  await page.getByRole('button', { name: 'Einsatz starten' }).click();
  await page.locator('#rw').fill('Testarbeit durchgeführt');
  await page.getByRole('button', { name: 'Zwischenspeichern' }).click();

  let alertText = '';
  page.once('dialog', async dialog => { alertText = dialog.message(); await dialog.accept(); });
  await page.getByRole('button', { name: 'Rapport abschließen' }).click();
  await expect.poll(() => alertText).toContain('Kundenunterschrift fehlt');
  const status = await page.evaluate(() => JSON.parse(localStorage.getItem('shp_db')).reports[0].status);
  expect(status).not.toBe('Abgeschlossen');
});

test('completed rapport creates one draft invoice, requires release, then confirms delivery', async ({ page }) => {
  await login(page, 'annette');
  await go(page, 'reports');
  await page.getByRole('button', { name: 'Rapport öffnen' }).first().click();
  await page.getByRole('button', { name: 'Einsatz starten' }).click();
  await page.locator('#rsvc').selectOption('svc1');
  await page.getByRole('button', { name: '+ Leistung' }).click();
  await page.locator('#rw').fill('Wartung durchgeführt und Anlage geprüft.');
  await page.locator('#rr').fill('Keine weiteren Arbeiten erforderlich.');
  await page.getByRole('button', { name: 'Zwischenspeichern' }).click();
  await drawSignature(page, '#sigC');
  await drawSignature(page, '#sigT');
  await page.getByRole('button', { name: 'Rapport abschließen' }).click();
  await expect(page.locator('main')).toContainText('Abgeschlossen');

  const before = await page.evaluate(() => JSON.parse(localStorage.getItem('shp_db')).invoices.length);
  await page.getByRole('button', { name: 'Rechnung erzeugen' }).click();
  await expect(page.locator('main h2')).toContainText('Rechnung ');
  await expect(page.locator('#ivstatus')).toHaveValue('Entwurf');
  await expect(page.getByRole('button', { name: 'WhatsApp', exact: true })).toBeDisabled();
  const after = await page.evaluate(() => JSON.parse(localStorage.getItem('shp_db')).invoices.length);
  expect(after).toBe(before + 1);

  await page.getByRole('button', { name: 'Rechnung freigeben' }).click();
  await expect(page.locator('#ivstatus')).toHaveValue('Offen');
  await expect(page.getByRole('button', { name: 'WhatsApp', exact: true })).toBeEnabled();

  await page.getByRole('button', { name: 'Bevorzugten Kanal verwenden' }).click();
  await expect(page.locator('.ux-v10-pending')).toHaveCount(1);
  await expect(page.locator('.ux-v10-pending')).toContainText('WhatsApp vorbereitet');
  await page.getByRole('button', { name: 'Versand bestätigen' }).click();
  await expect(page.locator('#ivstatus')).toHaveValue('Versendet');
  await expect(page.locator('main')).toContainText('Versand über WhatsApp bestätigt');
});
