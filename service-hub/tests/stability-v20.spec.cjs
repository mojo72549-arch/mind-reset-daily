const { test, expect } = require('@playwright/test');

const EXPECTED_LAYERS = [
  'auth-v7',
  'ux-v5',
  'ux-v6',
  'ux-v6-context',
  'ux-v6-admin-route',
  'ux-v9-invoice-logo',
  'ux-v9-dashboard',
  'ux-v10-customer-search',
  'ux-v10-navigation',
  'ux-v10-report-time',
  'ux-v11-dome-memory-order',
  'ux-v12-slim-start',
  'ux-v14-state-safety',
  'ux-v15-payments',
  'ux-v18-report-native-pdf',
  'ux-v19-report-native-actions'
];

function browserHealth(page) {
  const pageErrors = [];
  const consoleErrors = [];
  page.on('pageerror', error => pageErrors.push(String(error && error.message || error)));
  page.on('console', message => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  return () => ({ pageErrors, consoleErrors });
}

async function login(page, role) {
  await page.goto(`/?role=${role}`);
  await page.getByRole('button', { name: 'Anmelden' }).click();
  await expect(page.locator('header.top')).toBeVisible();
}

async function settle(page, label) {
  const state = await page.evaluate(() => window.SHP_STABILITY.whenIdle({ quietMs: 300, timeoutMs: 5_000 }));
  expect(state.idle, `${label}: Stabilitätswächter muss Leerlauf erkennen`).toBe(true);
  expect(state.timedOut, `${label}: Leerlauf darf nicht in ein Zeitlimit laufen`).toBe(false);
  expect(state.build).toBe('20260908-v20-global-stability1');
  expect(state.root).toBe('#app');
  expect(state.observerCount).toBe(1);
  expect(state.registrationCount).toBe(EXPECTED_LAYERS.length);
  expect(state.registrations.map(entry => entry.name).sort()).toEqual(EXPECTED_LAYERS.slice().sort());
  expect(state.registrations.filter(entry => entry.quarantined), `${label}: keine Erweiterung darf angehalten sein`).toEqual([]);
  expect(state.registrations.filter(entry => entry.errors), `${label}: keine Erweiterung darf Fehler werfen`).toEqual([]);
  expect(state.diagnostics.callbackErrors, `${label}: keine Callback-Fehler`).toBe(0);
  expect(state.diagnostics.circuitTrips, `${label}: normale Bedienung darf die Notbremse nicht benötigen`).toBe(0);
  expect(state.diagnostics.maxConsecutiveFlushes, `${label}: DOM muss deutlich vor der Notbremse zur Ruhe kommen`).toBeLessThanOrEqual(4);

  const quietMutations = await page.evaluate(async () => {
    let count = 0;
    const observer = new MutationObserver(records => { count += records.length; });
    observer.observe(document.getElementById('app'), { childList: true, subtree: true });
    await new Promise(resolve => setTimeout(resolve, 450));
    observer.disconnect();
    return count;
  });
  expect(quietMutations, `${label}: #app muss nach dem Rendern wirklich stillstehen`).toBe(0);
}

async function go(page, tab, heading) {
  await page.evaluate(target => SH.go(target), tab);
  if (heading) await expect(page.locator('main h2')).toContainText(heading);
  await settle(page, tab);
}

test('Dome: jede erreichbare Ansicht und ein Rapport mit Löschzeilen werden stabil', async ({ page }) => {
  const health = browserHealth(page);
  await login(page, 'dome');
  await settle(page, 'Dome Start');

  await go(page, 'customers', 'Kunden');
  const customerId = await page.evaluate(() => JSON.parse(localStorage.getItem('shp_db')).customers[0].id);
  await page.evaluate(id => SH.openCustomer(id), customerId);
  await expect(page.locator('main h2')).toContainText('Musterkunde');
  await settle(page, 'Dome Kundendetail und Konditionen-Schutz');

  await go(page, 'orders', 'Aufträge');
  await go(page, 'reports', 'Rapporte');
  await page.evaluate(() => SH.openReport(101));
  await expect(page.locator('#rw')).toBeVisible();
  await settle(page, 'Dome Rapport');

  await page.locator('#rsvc').selectOption('svc1');
  await page.locator('#rqty').fill('1');
  await page.getByRole('button', { name: '+ Leistung' }).click();
  await expect(page.locator('.report-lines-card button.ux-danger-confirm')).toHaveCount(1);
  await settle(page, 'Dome Rapport mit Leistungs-Löschen-Schaltfläche');

  await page.getByRole('button', { name: '+ Material' }).click();
  const modal = page.locator('#shp-app-modal');
  await modal.getByLabel('Material / Bezeichnung').fill('Stabilitätstest-Dichtung');
  await modal.getByLabel('Menge').fill('1');
  await modal.getByLabel('Einzelpreis €').fill('2.50');
  await modal.getByRole('button', { name: 'Material hinzufügen' }).click();
  await expect(page.getByText(/Stabilitätstest-Dichtung/)).toBeVisible();
  await settle(page, 'Dome Rapport mit Material-Löschen-Schaltfläche');

  expect(health()).toEqual({ pageErrors: [], consoleErrors: [] });
});

test('Annette: alle operativen und kaufmännischen Ansichten werden stabil', async ({ page }) => {
  const health = browserHealth(page);
  await login(page, 'annette');
  await settle(page, 'Annette Start');

  await go(page, 'customers', 'Kunden');
  const ids = await page.evaluate(() => {
    const db = JSON.parse(localStorage.getItem('shp_db'));
    return { customer: db.customers[0].id, invoice: db.invoices[0].id };
  });
  await page.evaluate(id => SH.openCustomer(id), ids.customer);
  await expect(page.locator('main h2')).toContainText('Musterkunde');
  await settle(page, 'Annette Kundendetail');

  await go(page, 'orders', 'Aufträge');
  await go(page, 'reports', 'Rapporte');
  await page.evaluate(() => SH.openReport(101));
  await expect(page.locator('#rw')).toBeVisible();
  await settle(page, 'Annette Rapport');
  await go(page, 'invoices', 'Rechnungen');
  await page.evaluate(id => SH.openInvoice(id), ids.invoice);
  await expect(page.locator('#ivstatus')).toBeVisible();
  await settle(page, 'Annette Rechnung und Zahlungsüberwachung');

  await page.evaluate(() => {
    const tabs = ['home', 'customers', 'orders', 'reports', 'invoices'];
    for (let index = 0; index < 50; index += 1) SH.go(tabs[index % tabs.length]);
  });
  await expect(page.locator('main')).toBeVisible();
  await settle(page, 'Annette nach 50 schnellen Ansichtswechseln');

  expect(health()).toEqual({ pageErrors: [], consoleErrors: [] });
});

test('Admin: Einstellungen bleiben bei allen abgefangenen Routen stabil', async ({ page }) => {
  const health = browserHealth(page);
  await login(page, 'admin');
  await expect(page.locator('.ux-admin-title h2')).toHaveText('Administration');
  await settle(page, 'Admin Einstellungen');

  for (const target of ['home', 'customers', 'orders', 'reports', 'invoices', 'customer', 'report', 'invoice', 'admin']) {
    await page.evaluate(tab => SH.go(tab), target);
    await expect(page.locator('.ux-admin-title h2')).toHaveText('Administration');
    await settle(page, `Admin Route ${target}`);
  }

  expect(health()).toEqual({ pageErrors: [], consoleErrors: [] });
});

test('die Notbremse isoliert eine absichtlich selbsttriggernde DOM-Schleife', async ({ page }) => {
  await login(page, 'annette');
  await settle(page, 'Notbremsen-Ausgangszustand');

  const result = await page.evaluate(async () => {
    const api = window.SHP_STABILITY;
    const before = api.snapshot();
    const app = document.getElementById('app');
    let heartbeatAt = 0;
    const started = performance.now();
    const heartbeat = new Promise(resolve => setTimeout(() => {
      heartbeatAt = performance.now();
      resolve();
    }, 100));
    const unregister = api.register('__intentional-loop-test__', () => {
      const node = document.createElement('i');
      node.hidden = true;
      node.className = 'intentional-loop-test';
      app.appendChild(node);
    }, { initial: false });

    api.request('intentional-loop-test');
    await heartbeat;
    await new Promise(resolve => setTimeout(resolve, 350));
    const protectedState = api.snapshot();
    const createdNodes = app.querySelectorAll('.intentional-loop-test').length;
    unregister();
    app.querySelectorAll('.intentional-loop-test').forEach(node => node.remove());
    const recovered = await api.whenIdle({ quietMs: 250, timeoutMs: 3_000 });
    return {
      beforeTrips: before.diagnostics.circuitTrips,
      afterTrips: protectedState.diagnostics.circuitTrips,
      quarantine: protectedState.registrations.find(entry => entry.name === '__intentional-loop-test__'),
      createdNodes,
      heartbeatDelay: heartbeatAt - started,
      recovered
    };
  });

  expect(result.afterTrips).toBeGreaterThan(result.beforeTrips);
  expect(result.quarantine.quarantined).toBe(true);
  expect(result.quarantine.quarantines).toBeGreaterThanOrEqual(1);
  expect(result.createdNodes).toBeLessThanOrEqual(5);
  expect(result.heartbeatDelay, 'der JavaScript-Thread muss trotz Schleife reagieren').toBeLessThan(500);
  expect(result.recovered.idle).toBe(true);
  expect(result.recovered.pending).toBe(false);
  await expect(page.locator('main')).toBeVisible();
});
