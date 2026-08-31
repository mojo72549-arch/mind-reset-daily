const { test, expect } = require('@playwright/test');

const PAUSE = 650;

async function reviewCard(page, id, title, expectation) {
  await page.evaluate(({ id, title, expectation }) => {
    let el = document.getElementById('quality-review-card');
    if (!el) {
      el = document.createElement('div');
      el.id = 'quality-review-card';
      el.style.cssText = 'position:fixed;z-index:2147483647;top:12px;left:50%;transform:translateX(-50%);width:min(92vw,760px);padding:12px 16px;border-radius:14px;background:rgba(7,20,38,.95);color:white;box-shadow:0 10px 32px rgba(0,0,0,.35);font:600 14px/1.35 -apple-system,BlinkMacSystemFont,Segoe UI,Arial,sans-serif;pointer-events:none;text-align:left';
      document.body.appendChild(el);
    }
    el.innerHTML = `<div style="font-size:11px;letter-spacing:.08em;opacity:.75">SERVICE HUB · VIDEO-ABNAHME · ${id}</div><div style="font-size:18px;font-weight:800;margin:3px 0">${title}</div><div><b>Erwartung:</b> ${expectation}</div><div data-result style="margin-top:5px;opacity:.8">Ergebnis: Prüfung läuft …</div>`;
  }, { id, title, expectation });
  await page.waitForTimeout(PAUSE);
}

async function passCard(page, result) {
  await page.evaluate(result => {
    const el = document.getElementById('quality-review-card');
    if (!el) return;
    const r = el.querySelector('[data-result]');
    if (r) {
      r.textContent = `Ergebnis: ✓ ${result}`;
      r.style.opacity = '1';
      r.style.fontWeight = '800';
    }
  }, result);
  await page.waitForTimeout(900);
}

async function login(page, role, id, title, expectation) {
  await page.goto(`/?role=${role}`);
  await reviewCard(page, id, title, expectation);
  await page.getByRole('button', { name: 'Anmelden' }).click();
  await expect(page.locator('header.top')).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('data-sh-build', '20260830-v9-1');
}

async function go(page, tab) {
  await page.evaluate(target => SH.go(target), tab);
  await page.waitForTimeout(180);
}

async function openSeedCustomer(page) {
  await go(page, 'customers');
  await expect(page.locator('main h2')).toHaveText('Kunden');
  await page.getByRole('button', { name: 'Kunde öffnen' }).first().click();
  await expect(page.locator('main h2')).toHaveText('Musterkunde Stuttgart GmbH');
}

async function openSeedReport(page) {
  await go(page, 'reports');
  await page.getByRole('button', { name: 'Rapport öffnen' }).first().click();
  await expect(page.locator('main h2')).toContainText('Rapport A-2026-0101');
}

function promptQueue(page, answers, { acceptConfirms = true } = {}) {
  const queue = [...answers];
  page.on('dialog', async dialog => {
    if (dialog.type() === 'prompt') await dialog.accept(queue.shift() ?? '');
    else if (acceptConfirms) await dialog.accept();
    else await dialog.dismiss();
  });
  return queue;
}

async function drawSignature(page, selector) {
  const canvas = page.locator(selector);
  await canvas.scrollIntoViewIfNeeded();
  const touch = await page.evaluate(() => navigator.maxTouchPoints > 0);
  if (touch) {
    await page.evaluate(sel => {
      const c = document.querySelector(sel);
      const r = c.getBoundingClientRect();
      const pts = [[22,35],[62,66],[105,38],[150,72],[195,42]];
      const mk = ([x,y]) => new Touch({identifier:71,target:c,clientX:r.left+x,clientY:r.top+y,pageX:scrollX+r.left+x,pageY:scrollY+r.top+y,screenX:r.left+x,screenY:r.top+y,radiusX:2,radiusY:2,force:.7});
      const fire = (type,p,on) => { const t=mk(p); c.dispatchEvent(new TouchEvent(type,{bubbles:true,cancelable:true,touches:on?[t]:[],targetTouches:on?[t]:[],changedTouches:[t]})); };
      fire('touchstart',pts[0],true); pts.slice(1).forEach(p=>fire('touchmove',p,true)); fire('touchend',pts[pts.length-1],false);
    }, selector);
  } else {
    const box = await canvas.boundingBox();
    expect(box).toBeTruthy();
    await page.mouse.move(box.x + 22, box.y + 35);
    await page.mouse.down();
    await page.mouse.move(box.x + 70, box.y + 68, { steps: 7 });
    await page.mouse.move(box.x + 130, box.y + 34, { steps: 7 });
    await page.mouse.move(box.x + 195, box.y + 62, { steps: 7 });
    await page.mouse.up();
  }
  await page.waitForTimeout(220);
}

async function db(page) {
  return page.evaluate(() => JSON.parse(localStorage.getItem('shp_db')));
}

test('V01 public login hides credentials', async ({ page }) => {
  await page.goto('/?role=dome');
  await reviewCard(page, 'V01', 'Öffentlicher Login ohne sichtbare Zugangsdaten', 'Benutzername bleibt verborgen, Passwort ist maskiert und kein Demo-Passwort wird als Text angezeigt.');
  await expect(page.locator('#u')).toBeHidden();
  await expect(page.locator('#p')).toHaveAttribute('type', 'password');
  await expect(page.getByText('Zugangsdaten werden nicht öffentlich angezeigt.')).toBeVisible();
  await expect(page.locator('.loginbox')).not.toContainText('Demo-2026!');
  await passCard(page, 'Keine Zugangsdaten öffentlich sichtbar.');
});

test('V02 Annette login and office rights', async ({ page }) => {
  await login(page, 'annette', 'V02', 'Annette meldet sich an', 'Büro-Arbeitsbereich wird geöffnet und Kunden können angelegt werden.');
  await expect(page.locator('header.top')).toContainText('Annette · Büro');
  await go(page, 'customers');
  await expect(page.getByRole('button', { name: '+ Kunde' })).toBeVisible();
  await passCard(page, 'Annette hat die vorgesehenen Bürorechte.');
});

test('V03 Dome login keeps sensitive writes protected', async ({ page }) => {
  await login(page, 'dome', 'V03', 'Dome meldet sich an', 'Techniker sieht CRM-Daten, aber keine Kundenanlage oder Administrationspflege.');
  await expect(page.locator('header.top')).toContainText('Dome · Techniker');
  await go(page, 'customers');
  await expect(page.getByRole('button', { name: '+ Kunde' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Kunde öffnen' }).first().click();
  await expect(page.getByRole('button', { name: 'Stammdaten bearbeiten' })).toHaveCount(0);
  await passCard(page, 'Technikerrechte sind sichtbar begrenzt.');
});

test('V04 admin is a settings area only', async ({ page }) => {
  await login(page, 'admin', 'V04', 'Administration öffnen', 'Admin-Maske zeigt ausschließlich Systemkonfiguration und keine operative Kunden-/Rechnungsliste.');
  await go(page, 'admin');
  await expect(page.locator('.ux-admin-title h2')).toHaveText('Administration');
  await expect(page.getByText('Hier werden ausschließlich globale Einstellungen des Service Hub verwaltet')).toBeVisible();
  await expect(page.getByText('Musterkunde Stuttgart GmbH')).toHaveCount(0);
  await expect(page.getByText('26175', { exact: true })).toHaveCount(0);
  await passCard(page, 'Administration bleibt reine Konfiguration.');
});

test('V05 create customer and show it immediately', async ({ page }) => {
  await login(page, 'annette', 'V05', 'Kunde vollständig anlegen', 'Nach dem letzten Eingabeschritt öffnet sich der neue Kunde sofort und ist persistent gespeichert.');
  await go(page, 'customers');
  const before = (await db(page)).customers.length;
  promptQueue(page, ['Video Kunde 05 GmbH','Videostraße 5, 70437 Stuttgart','Max Video','0170 5550505','video05@example.de','85','E-Mail']);
  await page.getByRole('button', { name: '+ Kunde' }).click();
  await expect(page.locator('main h2')).toHaveText('Video Kunde 05 GmbH');
  await expect(page.locator('main')).toContainText('video05@example.de');
  expect((await db(page)).customers.length).toBe(before + 1);
  await passCard(page, 'Kunde sofort sichtbar und gespeichert.');
});

test('V06 cancelled customer creation changes nothing', async ({ page }) => {
  await login(page, 'annette', 'V06', 'Kundenanlage abbrechen', 'Abbruch beim ersten Dialog erzeugt keinen Datensatz und lässt die Oberfläche unverändert.');
  await go(page, 'customers');
  const before = JSON.stringify((await db(page)).customers);
  page.once('dialog', dialog => dialog.dismiss());
  await page.getByRole('button', { name: '+ Kunde' }).click();
  await expect(page.locator('main h2')).toHaveText('Kunden');
  expect(JSON.stringify((await db(page)).customers)).toBe(before);
  await passCard(page, 'Abbruch erzeugt keine Seiteneffekte.');
});

test('V07 customer survives a real reload', async ({ page }) => {
  await login(page, 'annette', 'V07', 'Kunden-Persistenz nach Reload', 'Ein neu angelegter Kunde bleibt nach vollständigem Browser-Reload vorhanden.');
  await go(page, 'customers');
  promptQueue(page, ['Reload Kunde 07 GmbH','Reloadstraße 7, 70437 Stuttgart','Reload Kontakt','0170 7000007','reload07@example.de','79','E-Mail']);
  await page.getByRole('button', { name: '+ Kunde' }).click();
  await expect(page.locator('main h2')).toHaveText('Reload Kunde 07 GmbH');
  await page.reload();
  await expect(page.locator('header.top')).toBeVisible();
  await go(page, 'customers');
  await expect(page.getByText('Reload Kunde 07 GmbH', { exact: true })).toBeVisible();
  await passCard(page, 'Kunde bleibt nach echtem Reload vorhanden.');
});

test('V08 create order and open report immediately without reload', async ({ page }) => {
  await login(page, 'annette', 'V08', 'Auftrag sofort anlegen', 'Auftrag A-2026-0102 wird ohne Zurückgehen und ohne Browsernavigation sofort als Rapport angezeigt.');
  await openSeedCustomer(page);
  const before = (await db(page)).orders.length;
  const initialUrl = page.url();
  let navigations = 0;
  page.on('framenavigated', frame => { if (frame === page.mainFrame()) navigations += 1; });
  promptQueue(page, ['Video Sofortauftrag 08','Wartung']);
  await page.getByRole('button', { name: '+ Auftrag' }).first().click();
  await expect(page.locator('main h2')).toHaveText('Rapport A-2026-0102', { timeout: 1000 });
  await expect(page.locator('.ux-v9-order-created')).toContainText('angelegt und gespeichert');
  expect((await db(page)).orders.length).toBe(before + 1);
  expect(page.url()).toBe(initialUrl);
  expect(navigations).toBe(0);
  await passCard(page, 'Auftrag sofort sichtbar, 0 Reloads, 0 Navigationen.');
});

test('V09 cancelled order creation changes nothing', async ({ page }) => {
  await login(page, 'annette', 'V09', 'Auftragserfassung abbrechen', 'Abbruch erzeugt keinen Auftrag und der Kunde bleibt geöffnet.');
  await openSeedCustomer(page);
  const before = JSON.stringify((await db(page)).orders);
  page.once('dialog', dialog => dialog.dismiss());
  await page.getByRole('button', { name: '+ Auftrag' }).first().click();
  await expect(page.locator('main h2')).toHaveText('Musterkunde Stuttgart GmbH');
  expect(JSON.stringify((await db(page)).orders)).toBe(before);
  await expect(page.locator('.ux-v9-order-created')).toHaveCount(0);
  await passCard(page, 'Abbruch lässt Daten und Oberfläche unverändert.');
});

test('V10 order persists after reload and is visible at customer', async ({ page }) => {
  await login(page, 'annette', 'V10', 'Auftrag-Persistenz nach Reload', 'Ein neu angelegter Auftrag bleibt nach vollständigem Reload beim Kunden sichtbar.');
  await openSeedCustomer(page);
  promptQueue(page, ['Reload Auftrag 10','Rohrreinigung']);
  await page.getByRole('button', { name: '+ Auftrag' }).first().click();
  await expect(page.locator('main h2')).toHaveText('Rapport A-2026-0102');
  await page.reload();
  await expect(page.locator('header.top')).toBeVisible();
  await openSeedCustomer(page);
  await expect(page.locator('main')).toContainText('Reload Auftrag 10');
  await passCard(page, 'Auftrag bleibt nach Reload persistent.');
});

test('V11 starting a report updates persistent order state', async ({ page }) => {
  await login(page, 'dome', 'V11', 'Einsatz starten', 'Beginn wird gesetzt und der Auftrag wechselt persistent auf In Bearbeitung.');
  await openSeedReport(page);
  await page.getByRole('button', { name: 'Einsatz starten' }).click();
  const d = await db(page);
  expect(d.reports[0].start).not.toBe('');
  expect(d.orders[0].status).toBe('In Bearbeitung');
  await expect(page.locator('main')).not.toContainText('Beginn: –');
  await passCard(page, 'Startzeit und Auftragsstatus sind gespeichert.');
});

test('V12 report text persists across navigation and reload', async ({ page }) => {
  await login(page, 'dome', 'V12', 'Rapporttext zwischenspeichern', 'Arbeiten und Ergebnis bleiben nach Modulwechsel und vollständigem Reload erhalten.');
  await openSeedReport(page);
  await page.locator('#rw').fill('Video-Test: Leitung gereinigt und geprüft.');
  await page.locator('#rr').fill('Video-Test: Funktion in Ordnung.');
  await page.getByRole('button', { name: 'Zwischenspeichern' }).click();
  await go(page, 'customers');
  await openSeedReport(page);
  await expect(page.locator('#rw')).toHaveValue('Video-Test: Leitung gereinigt und geprüft.');
  await page.reload();
  await expect(page.locator('header.top')).toBeVisible();
  await openSeedReport(page);
  await expect(page.locator('#rr')).toHaveValue('Video-Test: Funktion in Ordnung.');
  await passCard(page, 'Rapporttext über Navigation und Reload persistent.');
});

test('V13 service addition is visible on the same surface immediately', async ({ page }) => {
  await login(page, 'dome', 'V13', 'Leistung sofort hinzufügen', 'Leistung erscheint innerhalb derselben Rapportansicht ohne Reload oder Zurücknavigation.');
  await openSeedReport(page);
  const initialUrl = page.url();
  let navigations = 0;
  page.on('framenavigated', frame => { if (frame === page.mainFrame()) navigations += 1; });
  await page.locator('#rsvc').selectOption('svc9');
  await page.locator('#rqty').fill('1');
  await page.getByRole('button', { name: '+ Leistung' }).click();
  await expect(page.locator('.report-lines-card tr').filter({ hasText: 'Anfahrt' })).toHaveCount(1, { timeout: 1000 });
  await expect(page.locator('html')).toHaveAttribute('data-sh-surface-reason', 'service-add');
  expect(page.url()).toBe(initialUrl);
  expect(navigations).toBe(0);
  await passCard(page, 'Leistung sofort sichtbar, ohne Reload.');
});

test('V14 cancelling service deletion keeps the service', async ({ page }) => {
  await login(page, 'dome', 'V14', 'Löschen einer Leistung abbrechen', 'Abbrechen der Sicherheitsabfrage darf weder UI noch persistenten Rapport verändern.');
  await openSeedReport(page);
  await page.locator('#rsvc').selectOption('svc1');
  await page.getByRole('button', { name: '+ Leistung' }).click();
  await expect(page.locator('.report-lines-card button.ux-danger-confirm')).toHaveCount(1);
  page.once('dialog', dialog => dialog.dismiss());
  await page.locator('.report-lines-card button.ux-danger-confirm').click();
  await expect(page.locator('.report-lines-card button.ux-danger-confirm')).toHaveCount(1);
  expect((await db(page)).reports[0].lines.length).toBe(1);
  await passCard(page, 'Abbruch schützt die vorhandene Leistung.');
});

test('V15 confirmed service deletion can be undone', async ({ page }) => {
  await login(page, 'dome', 'V15', 'Leistung löschen und Rückgängig', 'Bestätigtes Löschen wirkt sofort; Rückgängig stellt exakt die vorherige Leistung wieder her.');
  await openSeedReport(page);
  await page.locator('#rsvc').selectOption('svc1');
  await page.getByRole('button', { name: '+ Leistung' }).click();
  page.once('dialog', dialog => dialog.accept());
  await page.locator('.report-lines-card button.ux-danger-confirm').click();
  await expect(page.locator('.report-lines-card button.ux-danger-confirm')).toHaveCount(0);
  await expect(page.locator('.ux-undo-toast')).toContainText('Leistung entfernt');
  await page.locator('.ux-undo-toast button').click();
  await expect(page.locator('header.top')).toBeVisible();
  await openSeedReport(page);
  await expect(page.locator('.report-lines-card button.ux-danger-confirm')).toHaveCount(1);
  await passCard(page, 'Löschen und globales Undo funktionieren konsistent.');
});

test('V16 material addition and deletion update immediately', async ({ page }) => {
  await login(page, 'dome', 'V16', 'Material hinzufügen und entfernen', 'Material wird sofort angezeigt und nach bestätigtem Löschen sofort entfernt.');
  await openSeedReport(page);
  promptQueue(page, ['Video-Dichtungsring','2','4.50']);
  await page.getByRole('button', { name: '+ Material' }).click();
  await expect(page.getByText(/Video-Dichtungsring/)).toBeVisible({ timeout: 1000 });
  const del = page.locator('.card').filter({ hasText: 'Video-Dichtungsring' }).getByRole('button', { name: 'Löschen' }).first();
  await del.click();
  await expect(page.getByText(/Video-Dichtungsring/)).toHaveCount(0, { timeout: 1000 });
  await passCard(page, 'Materialänderungen sind sofort synchron.');
});

test('V17 report completion is blocked when mandatory work data is missing', async ({ page }) => {
  await login(page, 'dome', 'V17', 'Rapport ohne Pflichtdaten abschließen', 'Ohne Beginn und ausgeführte Arbeiten bleibt der Rapport im Entwurf und zeigt einen Fehlerhinweis.');
  await openSeedReport(page);
  await page.getByRole('button', { name: 'Rapport abschließen' }).click();
  await expect(page.locator('.toast')).toContainText('Beginn, Arbeiten und Kundenname fehlen');
  expect((await db(page)).reports[0].status).toBe('Entwurf');
  await passCard(page, 'Unvollständiger Rapport wird nicht abgeschlossen.');
});

test('V18 report PDF view contains job and company data and returns safely', async ({ page }) => {
  await login(page, 'dome', 'V18', 'Rapport als PDF/Druckansicht prüfen', 'Dokument enthält Auftragsnummer und Firmendaten; Zurück führt wieder in denselben Rapport.');
  await openSeedReport(page);
  await page.evaluate(() => { window.print = () => {}; });
  await page.getByRole('button', { name: 'PDF / Drucken' }).click();
  await expect(page.locator('.doc')).toBeVisible();
  await expect(page.locator('.doc')).toContainText('Rapport / Leistungsnachweis');
  await expect(page.locator('.doc')).toContainText('A-2026-0101');
  await expect(page.locator('.doc')).toContainText('Rohr- & Kanaltechnik Winser');
  await page.getByRole('button', { name: 'Zurück' }).click();
  await expect(page.locator('main h2')).toContainText('Rapport A-2026-0101');
  await passCard(page, 'Rapport-Dokument und Rückweg sind korrekt.');
});

test('V19 admin configuration is reflected in branded invoice PDF', async ({ page }) => {
  await login(page, 'admin', 'V19', 'Admin-Konfiguration bis Rechnung durchprüfen', 'Geänderter Firmenname und Zahlungstext erscheinen unmittelbar in der Rechnungs-Druckansicht.');
  await go(page, 'admin');
  await page.locator('#adm-companyName').fill('Winser Video Quality');
  await page.locator('#adm-paymentText').fill('Video-Abnahme: Zahlungshinweis aus Administration.');
  await page.getByRole('button', { name: 'Einstellungen speichern' }).click();
  await expect(page.locator('.ux-admin-saved')).toContainText('Einstellungen gespeichert');
  await go(page, 'invoices');
  await page.getByRole('button', { name: '26175' }).first().click();
  await page.evaluate(() => { window.print = () => {}; });
  await page.getByRole('button', { name: 'PDF / Drucken' }).click();
  await expect(page.locator('.invoice-doc-v6')).toBeVisible();
  await expect(page.locator('.invoice-brand-name')).toHaveText('Winser Video Quality');
  await expect(page.locator('.invoice-payment-v6')).toContainText('Video-Abnahme: Zahlungshinweis aus Administration.');
  await passCard(page, 'Admin-Konfiguration ist bis in die Rechnung durchgängig.');
});

test('V20 complete customer to order to signed report to invoice PDF flow', async ({ page }) => {
  await login(page, 'annette', 'V20', 'Kompletter fachlicher End-to-End-Durchlauf', 'Kunde → Auftrag → Einsatz → Leistung/Material → Unterschriften → Rapportabschluss → Rechnung → PDF funktioniert ohne manuellen Reload.');
  await go(page, 'customers');
  const answers = [];
  page.on('dialog', async dialog => {
    if (dialog.type() === 'prompt') await dialog.accept(answers.shift() ?? '');
    else await dialog.accept();
  });

  answers.push('E2E Video Kunde GmbH','Ende-zu-Ende-Straße 20, 70437 Stuttgart','Erika E2E','0170 2020202','e2e20@example.de','88','E-Mail');
  await page.getByRole('button', { name: '+ Kunde' }).click();
  await expect(page.locator('main h2')).toHaveText('E2E Video Kunde GmbH');

  answers.push('Kompletter E2E Auftrag','Rohrreinigung');
  await page.getByRole('button', { name: '+ Auftrag' }).first().click();
  await expect(page.locator('main h2')).toHaveText('Rapport A-2026-0102', { timeout: 1000 });

  await page.getByRole('button', { name: 'Einsatz starten' }).click();
  await page.locator('#rsvc').selectOption('svc1');
  await page.locator('#rqty').fill('1');
  await page.getByRole('button', { name: '+ Leistung' }).click();
  await expect(page.locator('.report-lines-card')).toContainText('Gerätewageneinsatz');

  answers.push('E2E Dichtungsring','2','3.50');
  await page.getByRole('button', { name: '+ Material' }).click();
  await expect(page.getByText(/E2E Dichtungsring/)).toBeVisible();

  await page.locator('#rw').fill('Rohrleitung gereinigt, geprüft und Funktionskontrolle durchgeführt.');
  await page.locator('#rr').fill('Anlage funktionsfähig; aktuell keine weiteren Arbeiten erforderlich.');
  await page.getByRole('button', { name: 'Zwischenspeichern' }).click();
  await drawSignature(page, '#sigC');
  await drawSignature(page, '#sigT');
  await page.getByRole('button', { name: 'Rapport abschließen' }).click();
  await expect(page.locator('main')).toContainText('Abgeschlossen');
  let d = await db(page);
  const order = d.orders.find(o => o.title === 'Kompletter E2E Auftrag');
  const report = d.reports.find(r => String(r.orderId) === String(order.id));
  expect(report.status).toBe('Abgeschlossen');
  expect(report.sigC).toMatch(/^data:image/);
  expect(report.sigT).toMatch(/^data:image/);

  await page.getByRole('button', { name: 'Rechnung erzeugen' }).click();
  await expect(page.locator('main h2')).toHaveText('Rechnung 26180');
  await expect(page.locator('main')).toContainText('Gerätewageneinsatz');
  await expect(page.locator('main')).toContainText('E2E Dichtungsring');
  d = await db(page);
  expect(d.invoices.some(iv => iv.no === '26180' && String(iv.orderId) === String(order.id))).toBe(true);

  await page.evaluate(() => { window.print = () => {}; });
  await page.getByRole('button', { name: 'PDF / Drucken' }).click();
  await expect(page.locator('.invoice-doc-v6')).toBeVisible();
  await expect(page.locator('.invoice-doc-v6')).toContainText('26180');
  await expect(page.locator('.invoice-doc-v6')).toContainText('E2E Video Kunde GmbH');
  await passCard(page, 'Der vollständige Geschäftsprozess endet in einer persistenten Rechnung mit PDF-Ansicht.');
});
