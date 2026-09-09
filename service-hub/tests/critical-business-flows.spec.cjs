const { test, expect } = require('@playwright/test');

function browserHealth(page) {
  const pageErrors = [];
  const consoleErrors = [];
  page.on('pageerror', err => pageErrors.push(String(err && err.message || err)));
  page.on('console', msg => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  return () => ({ pageErrors, consoleErrors });
}

async function expectDomToSettle(page, label) {
  const childListMutations = await page.evaluate(async () => {
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    let count = 0;
    const observer = new MutationObserver(records => {
      count += records.filter(record => record.type === 'childList').length;
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
    await new Promise(resolve => setTimeout(resolve, 900));
    observer.disconnect();
    return count;
  });
  expect(childListMutations, `${label}: DOM muss nach dem Rendern zur Ruhe kommen`).toBeLessThan(20);
  await expect(page.locator('main')).toBeVisible();
}

async function login(page, role = 'annette') {
  await page.goto(`/?role=${role}`);
  await page.getByRole('button', { name: 'Anmelden' }).click();
  await expect(page.locator('header.top')).toBeVisible();
}

async function openSeedCustomer(page) {
  await page.evaluate(() => SH.go('customers'));
  await expect(page.locator('main h2')).toHaveText('Kunden');
  await page.getByRole('button', { name: 'Kunde öffnen' }).first().click();
  await expect(page.locator('main h2')).toHaveText('Musterkunde Stuttgart GmbH');
}

async function createOrderForSeedCustomer(page, title, type = 'Rohrreinigung') {
  await openSeedCustomer(page);
  const before = await page.evaluate(() => JSON.parse(localStorage.getItem('shp_db')).orders.length);
  await page.getByRole('button', { name: '+ Auftrag' }).first().click();
  const modal = page.locator('#shp-app-modal');
  await expect(modal).toBeVisible();
  await modal.getByLabel('Auftragsbezeichnung').fill(title);
  await modal.getByLabel('Auftragsart').selectOption(type);
  await modal.getByRole('button', { name: 'Auftrag anlegen' }).click();
  await expect(modal).toHaveCount(0);
  await expect(page.locator('main h2')).toContainText('Rapport A-');
  await expect(page.locator('#rw')).toBeVisible();
  const result = await page.evaluate(({ title, before }) => {
    const db = JSON.parse(localStorage.getItem('shp_db'));
    const matches = db.orders.filter(o => o.title === title);
    return { before, after: db.orders.length, matches };
  }, { title, before });
  expect(result.after).toBe(before + 1);
  expect(result.matches).toHaveLength(1);
  return result.matches[0];
}

async function setReportTimes(page, start, end) {
  await expect(page.locator('#uxReportStart')).toBeVisible();
  await page.locator('#uxReportStart').fill(start);
  await page.locator('#uxReportEnd').fill(end);
  await page.evaluate(() => window.SHP_REPORT_TIME && window.SHP_REPORT_TIME.save());
}

async function addService(page, catalogId, qty) {
  await page.locator('#rsvc').selectOption(catalogId);
  await page.locator('#rqty').fill(String(qty));
  await page.getByRole('button', { name: '+ Leistung' }).click();
}

async function canvasHasInk(page, selector) {
  return page.locator(selector).evaluate(canvas => {
    if (window.SHP_BUSINESS_GUARDS && typeof window.SHP_BUSINESS_GUARDS.canvasHasInk === 'function') {
      return window.SHP_BUSINESS_GUARDS.canvasHasInk(canvas);
    }
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return false;
    const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    for (let i = 3; i < pixels.length; i += 4) if (pixels[i] > 8) return true;
    return false;
  });
}

async function dispatchSignatureStroke(page, selector) {
  await page.locator(selector).evaluate(canvas => {
    const rect = canvas.getBoundingClientRect();
    const sx = rect.left + Math.min(32, Math.max(12, rect.width * 0.15));
    const sy = rect.top + Math.min(42, Math.max(18, rect.height * 0.35));
    const ex = rect.left + Math.min(rect.width - 12, Math.max(90, rect.width * 0.72));
    const points = [
      [sx, sy],
      [sx + (ex - sx) * 0.25, sy + 12],
      [sx + (ex - sx) * 0.5, sy - 5],
      [sx + (ex - sx) * 0.75, sy + 10],
      [ex, sy - 3]
    ];
    const fire = (type, p, buttons) => canvas.dispatchEvent(new PointerEvent(type, {
      bubbles: true,
      cancelable: true,
      pointerId: 91,
      pointerType: 'touch',
      isPrimary: true,
      clientX: p[0],
      clientY: p[1],
      button: type === 'pointerdown' ? 0 : -1,
      buttons
    }));
    fire('pointerdown', points[0], 1);
    for (let i = 1; i < points.length; i++) fire('pointermove', points[i], 1);
    fire('pointerup', points[points.length - 1], 0);
  });
}

async function drawSignature(page, selector) {
  const canvas = page.locator(selector);
  await canvas.scrollIntoViewIfNeeded();
  await expect(canvas).toBeVisible();
  const box = await canvas.boundingBox();
  expect(box, `${selector}: Unterschriftsfeld muss sichtbar sein`).toBeTruthy();
  const x = box.x + Math.min(35, box.width * 0.15);
  const y = box.y + Math.min(45, box.height * 0.35);
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + Math.min(70, box.width * 0.35), y + 16, { steps: 6 });
  await page.mouse.move(x + Math.min(125, box.width * 0.6), y - 8, { steps: 6 });
  await page.mouse.up();

  if (!(await canvasHasInk(page, selector))) {
    await dispatchSignatureStroke(page, selector);
  }
  expect(await canvasHasInk(page, selector), `${selector}: Unterschrift muss tatsächlich Canvas-Inhalt erzeugen`).toBe(true);
}

async function signReport(page) {
  await drawSignature(page, '#sigC');
  await drawSignature(page, '#sigT');

  // Auf kleinen Viewports können UI-Nachläufe beim Scrollen ein Canvas neu einsetzen.
  // Deshalb prüfen wir unmittelbar vor dem Abschluss beide Felder erneut und zeichnen
  // ausschließlich über die echten Canvas-Handler nach, falls eines leer geworden ist.
  for (const selector of ['#sigC', '#sigT']) {
    if (!(await canvasHasInk(page, selector))) await drawSignature(page, selector);
  }
  expect(await canvasHasInk(page, '#sigC'), 'Kundenunterschrift muss vor Abschluss vorhanden sein').toBe(true);
  expect(await canvasHasInk(page, '#sigT'), 'Technikerunterschrift muss vor Abschluss vorhanden sein').toBe(true);
}

test('Annette: Auftrag anlegen, Rapport weiterbearbeiten, navigieren und neu laden ohne Fehler', async ({ page }) => {
  const health = browserHealth(page);
  await login(page, 'annette');
  const order = await createOrderForSeedCustomer(page, 'Annette Qualitätsgate Auftrag');

  await setReportTimes(page, '08:30', '10:00');
  await page.locator('#rw').fill('Siphon demontiert, Leitung gereinigt und wieder montiert.');
  await page.locator('#rr').fill('Anlage läuft wieder ab.');
  await page.evaluate(() => window.SHP_REPORT_TIME && window.SHP_REPORT_TIME.save());

  await addService(page, 'svc1', 1.5);
  await expectDomToSettle(page, 'Annette Rapport mit erfasster Leistung');
  await expect.poll(async () => page.evaluate(id => {
    const db = JSON.parse(localStorage.getItem('shp_db'));
    const r = db.reports.find(x => String(x.orderId) === String(id));
    return r && r.lines && r.lines.length;
  }, order.id)).toBe(1);

  await page.getByRole('button', { name: '+ Material' }).click();
  let modal = page.locator('#shp-app-modal');
  await expect(modal).toBeVisible();
  await modal.getByLabel('Material / Bezeichnung').fill('Dichtung Qualitätsgate');
  await modal.getByLabel('Menge').fill('2');
  await modal.getByLabel('Einzelpreis €').fill('3.50');
  await modal.getByRole('button', { name: 'Material hinzufügen' }).click();
  await expect(modal).toHaveCount(0);
  await expectDomToSettle(page, 'Annette Rapport mit Material');

  const saved = await page.evaluate(id => {
    const db = JSON.parse(localStorage.getItem('shp_db'));
    const r = db.reports.find(x => String(x.orderId) === String(id));
    return {
      work: r.work,
      result: r.result,
      start: r.start,
      end: r.end,
      lines: r.lines,
      materials: r.materials
    };
  }, order.id);
  expect(saved.work).toContain('Siphon demontiert');
  expect(saved.result).toContain('läuft wieder ab');
  expect(saved.start).toBe('08:30');
  expect(saved.end).toBe('10:00');
  expect(saved.lines).toHaveLength(1);
  expect(saved.lines[0].qty).toBe(1.5);
  expect(saved.materials).toHaveLength(1);
  expect(saved.materials[0].name).toBe('Dichtung Qualitätsgate');

  await page.evaluate(() => SH.go('customers'));
  await page.getByRole('button', { name: 'Kunde öffnen' }).first().click();
  await expect(page.locator('main')).toContainText('Annette Qualitätsgate Auftrag');

  await page.evaluate(id => SH.openReport(id), order.id);
  await expect(page.locator('#rw')).toHaveValue(/Siphon demontiert/);
  await page.reload();
  await expect(page.locator('header.top')).toBeVisible();
  await page.evaluate(id => SH.openReport(id), order.id);
  await expect(page.locator('#rw')).toHaveValue(/Siphon demontiert/);
  await expect(page.locator('#rqty')).toBeVisible();
  await expectDomToSettle(page, 'Annette Rapport nach Reload');

  const h = health();
  expect(h.pageErrors).toEqual([]);
  expect(h.consoleErrors).toEqual([]);
});

test('Annette: kundenspezifischer Preis fließt in Rapport und Rechnung', async ({ page }) => {
  const health = browserHealth(page);
  await login(page, 'annette');
  await openSeedCustomer(page);

  await page.getByRole('button', { name: 'Konditionen bearbeiten' }).click();
  let modal = page.locator('#shp-app-modal');
  await expect(modal).toBeVisible();
  await modal.locator('input[name="price_svc1"]').fill('111');
  await modal.getByRole('button', { name: 'Konditionen speichern' }).click();
  await expect(modal).toHaveCount(0);

  const order = await createOrderForSeedCustomer(page, 'Preis- und Rechnungsprüfung');
  await setReportTimes(page, '09:00', '11:00');
  await page.locator('#rw').fill('Leistung vollständig durchgeführt.');
  await addService(page, 'svc1', 2);
  await expectDomToSettle(page, 'Preisprüfung Rapport');

  const line = await page.evaluate(id => {
    const db = JSON.parse(localStorage.getItem('shp_db'));
    return db.reports.find(r => String(r.orderId) === String(id)).lines[0];
  }, order.id);
  expect(line.price).toBe(111);
  expect(line.qty).toBe(2);

  await signReport(page);
  await page.getByRole('button', { name: 'Rapport abschließen' }).click();
  await expect.poll(async () => page.evaluate(id => {
    const db = JSON.parse(localStorage.getItem('shp_db'));
    return db.reports.find(r => String(r.orderId) === String(id)).status;
  }, order.id)).toBe('Abgeschlossen');

  await page.getByRole('button', { name: 'Rechnung erzeugen' }).click();
  await expect(page.locator('main h2')).toContainText('Rechnung ');
  const invoice = await page.evaluate(id => {
    const db = JSON.parse(localStorage.getItem('shp_db'));
    return db.invoices.find(i => String(i.orderId) === String(id));
  }, order.id);
  expect(invoice).toBeTruthy();
  expect(invoice.net).toBe(222);
  expect(invoice.vat).toBeCloseTo(42.18, 2);
  expect(invoice.gross).toBeCloseTo(264.18, 2);
  expect(invoice.items).toHaveLength(1);
  expect(invoice.items[0].price).toBe(111);

  const h = health();
  expect(h.pageErrors).toEqual([]);
  expect(h.consoleErrors).toEqual([]);
});

test('Dome: Technikerrolle bleibt fachlich eingeschränkt und Rapport ist bearbeitbar', async ({ page }) => {
  const health = browserHealth(page);
  await login(page, 'dome');
  await expect(page.getByRole('button', { name: 'Rechnungen' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Administration' })).toHaveCount(0);

  await openSeedCustomer(page);
  await expectDomToSettle(page, 'Dome Kundensicht mit geschützten Konditionen');

  await page.evaluate(() => SH.openReport(101));
  await expect(page.locator('#rw')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Rechnung erzeugen' })).toHaveCount(0);
  await setReportTimes(page, '07:45', '08:30');
  await page.locator('#rw').fill('Techniker-Test: Auftrag fachlich bearbeitet.');
  await addService(page, 'svc9', 1);
  await expectDomToSettle(page, 'Dome Rapport mit erfasster Leistung');
  await page.evaluate(() => window.SHP_REPORT_TIME && window.SHP_REPORT_TIME.save());
  const work = await page.evaluate(() => {
    const db = JSON.parse(localStorage.getItem('shp_db'));
    return db.reports.find(r => String(r.orderId) === '101').work;
  });
  expect(work).toContain('Techniker-Test');

  const h = health();
  expect(h.pageErrors).toEqual([]);
  expect(h.consoleErrors).toEqual([]);
});

test('Annette: Abbruch und Validierung erzeugen keine Teilobjekte', async ({ page }) => {
  const health = browserHealth(page);
  await login(page, 'annette');
  await openSeedCustomer(page);
  const before = await page.evaluate(() => JSON.stringify(JSON.parse(localStorage.getItem('shp_db')).orders));

  await page.getByRole('button', { name: '+ Auftrag' }).first().click();
  let modal = page.locator('#shp-app-modal');
  await expect(modal).toBeVisible();
  await modal.getByLabel('Auftragsbezeichnung').fill('Wird verworfen');
  await modal.getByRole('button', { name: 'Abbrechen' }).click();
  await expect(modal).toHaveCount(0);
  const afterCancel = await page.evaluate(() => JSON.stringify(JSON.parse(localStorage.getItem('shp_db')).orders));
  expect(afterCancel).toBe(before);

  await page.getByRole('button', { name: '+ Auftrag' }).first().click();
  modal = page.locator('#shp-app-modal');
  await modal.getByRole('button', { name: 'Auftrag anlegen' }).click();
  await expect(modal).toBeVisible();
  const afterInvalid = await page.evaluate(() => JSON.stringify(JSON.parse(localStorage.getItem('shp_db')).orders));
  expect(afterInvalid).toBe(before);

  const h = health();
  expect(h.pageErrors).toEqual([]);
  expect(h.consoleErrors).toEqual([]);
});
