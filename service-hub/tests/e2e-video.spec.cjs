const { test, expect } = require('@playwright/test');

const pause = page => page.waitForTimeout(650);

async function drawSignature(page, selector) {
  const canvas = page.locator(selector);
  await canvas.scrollIntoViewIfNeeded();
  const box = await canvas.boundingBox();
  expect(box).toBeTruthy();
  await page.mouse.move(box.x + 18, box.y + 35);
  await page.mouse.down();
  await page.mouse.move(box.x + 70, box.y + 70, { steps: 8 });
  await page.mouse.move(box.x + 135, box.y + 30, { steps: 8 });
  await page.mouse.move(box.x + 190, box.y + 60, { steps: 8 });
  await page.mouse.up();
  await expect(canvas).toHaveAttribute('data-signed', '1');
  await expect(canvas.locator('xpath=..').locator('.ux-v10-signature-state')).toContainText('Unterschrift erfasst');
}

async function login(page, role) {
  await page.goto(`/?role=${role}`);
  await page.getByRole('button', { name: 'Anmelden' }).click();
  await expect(page.locator('header.top')).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('data-sh-build', '20260822-v10');
  await pause(page);
}

test('VIDEO complete Service Hub flow from settings to confirmed WhatsApp invoice', async ({ page }) => {
  await page.addInitScript(() => { window.__SHP_TEST_MODE__ = true; });

  // 1) Administration: settings only + communication setup.
  await login(page, 'admin');
  await page.evaluate(() => SH.go('admin'));
  await expect(page.locator('.ux-admin-title h2')).toHaveText('Administration');
  await expect(page.locator('.ux-v10-delivery-settings')).toHaveCount(1);
  await expect(page.locator('#adm-waNumber')).toBeVisible();
  await expect(page.locator('#adm-waMode')).toHaveValue('Geräte-App (kostenfrei)');
  await expect(page.getByText('Musterkunde Stuttgart GmbH')).toHaveCount(0);
  await expect(page.getByText('26175', { exact: true })).toHaveCount(0);
  await page.locator('#adm-waNumber').fill('0152 23401628');
  await page.locator('#adm-emailReplyTo').fill('info@rokatech-winser.de');
  await page.getByRole('button', { name: 'Einstellungen speichern' }).click();
  await expect(page.locator('#adm-waNumber')).toHaveValue('0152 23401628');
  await pause(page);

  // 2) Annette: customer creation.
  await page.evaluate(() => SH.logout());
  await page.goto('/?role=annette');
  await page.getByRole('button', { name: 'Anmelden' }).click();
  await page.evaluate(() => SH.go('customers'));
  await expect(page.locator('main h2')).toHaveText('Kunden');
  await pause(page);

  let answers = [];
  page.on('dialog', async dialog => {
    if (dialog.type() === 'prompt') await dialog.accept(answers.shift() || '');
    else await dialog.accept();
  });
  answers = ['Video Testkunde GmbH','Teststraße 10, 70437 Stuttgart','Max Mustermann','0170 1234567','kunde@example.de','85','WhatsApp'];
  await page.getByRole('button', { name: '+ Kunde' }).click();
  await expect(page.locator('main h2')).toHaveText('Video Testkunde GmbH');
  await expect(page.locator('main')).toContainText('Bevorzugt: WhatsApp');
  await pause(page);

  // 3) Customer -> order -> rapport.
  answers = ['Rohrreinigung Video-Abnahme','Wartung'];
  await page.getByRole('button', { name: '+ Auftrag' }).first().click();
  await expect(page.locator('main h2')).toContainText('Rapport A-2026-');
  await page.getByRole('button', { name: 'Einsatz starten' }).click();
  await pause(page);

  await page.locator('#rsvc').selectOption('svc1');
  await page.locator('#rqty').fill('1.5');
  await page.getByRole('button', { name: '+ Leistung' }).click();
  await expect(page.locator('.report-lines-card')).toContainText('Gerätewageneinsatz');
  await pause(page);

  answers = ['Dichtungsring','2','3.50'];
  await page.getByRole('button', { name: '+ Material' }).click();
  await expect(page.locator('main')).toContainText('Dichtungsring');
  await page.locator('#rw').fill('Rohrleitung geprüft, gereinigt und Funktion kontrolliert.');
  await page.locator('#rr').fill('Anlage funktionsfähig. Keine weiteren Arbeiten erforderlich.');
  await page.getByRole('button', { name: 'Zwischenspeichern' }).click();
  await pause(page);

  // 4) Both signatures -> completed rapport.
  await drawSignature(page, '#sigC');
  await drawSignature(page, '#sigT');
  await pause(page);
  await page.getByRole('button', { name: 'Rapport abschließen' }).click();
  await expect(page.locator('main')).toContainText('Abgeschlossen');
  await pause(page);

  // 5) Completed rapport -> invoice draft -> approval.
  await page.getByRole('button', { name: 'Rechnung erzeugen' }).click();
  await expect(page.locator('main h2')).toContainText('Rechnung ');
  await expect(page.locator('#ivstatus')).toHaveValue('Entwurf');
  await expect(page.getByRole('button', { name: 'WhatsApp', exact: true })).toBeDisabled();
  await pause(page);
  await page.getByRole('button', { name: 'Rechnung freigeben' }).click();
  await expect(page.locator('#ivstatus')).toHaveValue('Offen');
  await pause(page);

  // 6) Cost-free WhatsApp handoff -> explicit confirmation.
  await page.getByRole('button', { name: 'Bevorzugten Kanal verwenden' }).click();
  await expect(page.locator('.ux-v10-pending')).toHaveCount(1);
  await expect(page.locator('.ux-v10-pending')).toContainText('WhatsApp vorbereitet');
  const last = await page.evaluate(() => window.SHP_LAST_DELIVERY);
  expect(last.url).toMatch(/^https:\/\/wa\.me\//);
  expect(last.url).not.toMatch(/twilio/i);
  await pause(page);
  await page.getByRole('button', { name: 'Versand bestätigen' }).click();
  await expect(page.locator('#ivstatus')).toHaveValue('Versendet');
  await expect(page.locator('main')).toContainText('Versand über WhatsApp bestätigt');
  await page.waitForTimeout(1800);
});
