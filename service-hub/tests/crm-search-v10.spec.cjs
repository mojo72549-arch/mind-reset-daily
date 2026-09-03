const { test, expect } = require('@playwright/test');

async function login(page, role) {
  await page.addInitScript(() => { window.__SHP_TEST_MODE__ = true; });
  await page.goto(`/?role=${role}`);
  await page.getByRole('button', { name: 'Anmelden' }).click();
  await expect(page.locator('header.top')).toBeVisible();
}

async function search(page, query) {
  const input = page.locator('#shp-crm-query');
  await expect(input).toBeVisible();
  await input.fill(query);
  await expect(page.locator('#shp-crm-summary')).toContainText(/Kunde(n)? gefunden/);
}

function result(page) {
  return page.locator('.shp-crm-result').first();
}

async function answerOrderPrompts(page, title = 'Direktauftrag aus CRM-Suche', type = 'Wartung') {
  const answers = [title, type];
  page.on('dialog', async dialog => {
    if (dialog.type() === 'prompt') await dialog.accept(answers.shift() ?? '');
    else await dialog.accept();
  });
}

for (const role of ['annette', 'dome']) {
  test(`CRM-Suche ist im Dashboard für ${role} sichtbar und durchsucht Stammdaten + Auftragshistorie`, async ({ page }) => {
    await login(page, role);
    await expect(page.locator('#shp-crm-search')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Kunde schnell finden' })).toBeVisible();

    const variants = [
      ['Musterkunde', 'Musterkunde Stuttgart GmbH'],
      ['Thomas', 'Thomas Berger'],
      ['Berger', 'Thomas Berger'],
      ['K-00001', 'K-00001'],
      ['0711 555123', 'Musterkunde Stuttgart GmbH'],
      ['t.berger@example.de', 'Musterkunde Stuttgart GmbH'],
      ['Industriestrasse', 'Musterkunde Stuttgart GmbH'],
      ['A-2026-0101', 'Wartung Heizungsanlage'],
      ['Heizungsanlage', 'Wartung Heizungsanlage']
    ];

    for (const [query, expected] of variants) {
      await search(page, query);
      await expect(page.locator('.shp-crm-result')).toHaveCount(1);
      await expect(result(page)).toContainText(expected);
    }

    await search(page, 'DIESEN-KUNDEN-GIBT-ES-NICHT');
    await expect(page.locator('.shp-crm-result')).toHaveCount(0);
    await expect(page.getByText('Kein Kunde gefunden.')).toBeVisible();
  });
}

test('Suche ist tolerant gegenüber Groß-/Kleinschreibung, Umlauten und ß', async ({ page }) => {
  await login(page, 'annette');
  const db = await page.evaluate(() => JSON.parse(localStorage.getItem('shp_db')));
  db.customers.push({
    id: 77, name: 'Müller & Söhne GmbH', contact: 'Jörg Öztürk', phone: '0711 123456',
    email: 'joerg@example.de', address: 'Hauptstraße 7, Stuttgart', hourlyRate: 80,
    preferredChannel: 'E-Mail', priceOverrides: {}, serviceInterval: '', nextService: ''
  });
  await page.evaluate(next => { SHP_INTERNAL.setDb(next); SH.go('home'); }, db);

  for (const query of ['muller sohne', 'JORg OZTURK', 'hauptstrasse']) {
    await search(page, query);
    await expect(result(page)).toContainText('Müller & Söhne GmbH');
  }
  await expect(result(page)).toContainText('K-00002');
});

test('Kundenakte zeigt 10 frühere Aufträge und die letzten Vorgänge kompakt', async ({ page }) => {
  await login(page, 'annette');
  const db = await page.evaluate(() => JSON.parse(localStorage.getItem('shp_db')));
  for (let i = 2; i <= 10; i += 1) {
    db.orders.push({ id: 100 + i, no: `A-2026-01${String(i).padStart(2, '0')}`, customerId: 1, title: `Folgeauftrag ${i}`, type: 'Wartung', date: '03.09.2026', status: 'Zugewiesen', assignedTo: 'Dome' });
  }
  await page.evaluate(next => { SHP_INTERNAL.setDb(next); SH.go('home'); }, db);
  await search(page, 'Musterkunde');
  await expect(result(page).locator('.shp-crm-count')).toContainText('10');
  await expect(result(page)).toContainText('+7 weitere Aufträge');
  await result(page).getByRole('button', { name: 'Kunde öffnen' }).click();
  await expect(page.locator('main h2')).toHaveText('Musterkunde Stuttgart GmbH');
  await expect(page.locator('main')).toContainText('10 Aufträge');
});

test('Dome sieht die Kundenakte schreibgeschützt, kann aber einen Auftrag anlegen', async ({ page }) => {
  await login(page, 'dome');
  await search(page, 'Thomas Berger');
  await result(page).getByRole('button', { name: 'Kundenakte ansehen' }).click();
  await expect(page.locator('#shp-crm-customer-drawer')).toBeVisible();
  await expect(page.locator('#shp-crm-customer-drawer')).toContainText('Technikeransicht: Kundenstammdaten sind schreibgeschützt.');
  await expect(page.getByRole('button', { name: 'Stammdaten bearbeiten' })).toHaveCount(0);
  expect(await page.evaluate(() => SHP_CORE.can('dome', 'manageCustomers'))).toBe(false);
  expect(await page.evaluate(() => SHP_CORE.can('dome', 'manageOrders'))).toBe(true);
});

for (const role of ['annette', 'dome']) {
  test(`${role} legt aus dem Suchtreffer einen Auftrag sofort und ohne Navigation/Reload an`, async ({ page }) => {
    await login(page, role);
    await search(page, 'K-00001');
    const initialUrl = page.url();
    let navigations = 0;
    page.on('framenavigated', frame => { if (frame === page.mainFrame()) navigations += 1; });
    await answerOrderPrompts(page, `Suchauftrag ${role}`, 'Wartung');
    await result(page).getByRole('button', { name: '+ Auftrag anlegen' }).click();

    await expect(page.locator('main h2')).toHaveText('Rapport A-2026-0102');
    await expect(page.locator('.ux-v9-order-created')).toContainText('Auftrag A-2026-0102 angelegt und gespeichert.');
    await expect(page.locator('html')).toHaveAttribute('data-sh-surface-reason', 'order-add');
    expect(page.url()).toBe(initialUrl);
    expect(navigations).toBe(0);

    let persisted = await page.evaluate(() => JSON.parse(localStorage.getItem('shp_db')));
    expect(persisted.orders).toHaveLength(2);
    expect(persisted.orders[1]).toMatchObject({ no: 'A-2026-0102', customerId: 1, title: `Suchauftrag ${role}` });

    await page.reload();
    await expect(page.locator('header.top')).toBeVisible();
    persisted = await page.evaluate(() => JSON.parse(localStorage.getItem('shp_db')));
    expect(persisted.orders).toHaveLength(2);
    await expect(page.locator('#shp-crm-search')).toBeVisible();
    await search(page, 'K-00001');
    await expect(result(page).locator('.shp-crm-count')).toContainText('2');
    await expect(result(page)).toContainText('A-2026-0102');
  });
}

test('neu angelegter Kunde erhält Kundennummer und ist nach Rückkehr ins Dashboard sofort suchbar', async ({ page }) => {
  await login(page, 'annette');
  const answers = ['Neukunde Suchtest GmbH', 'Testweg 9, Stuttgart', 'Anna Beispiel', '0170 1234567', 'anna@example.de', '85', 'WhatsApp'];
  page.on('dialog', async dialog => {
    if (dialog.type() === 'prompt') await dialog.accept(answers.shift() ?? '');
    else await dialog.accept();
  });
  await page.evaluate(() => SH.newCustomer());
  await expect(page.locator('main h2')).toHaveText('Neukunde Suchtest GmbH');
  await page.evaluate(() => SH.go('home'));
  await search(page, 'Anna Beispiel');
  await expect(result(page)).toContainText('Neukunde Suchtest GmbH');
  await expect(result(page)).toContainText('K-00002');
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('shp_db')).customers.find(c => c.name === 'Neukunde Suchtest GmbH'));
  expect(saved.customerNo).toBe('K-00002');
});

test('Admin-Dashboard bleibt frei von operativer CRM-Suche', async ({ page }) => {
  await login(page, 'admin');
  await expect(page.locator('#shp-crm-search')).toHaveCount(0);
});
