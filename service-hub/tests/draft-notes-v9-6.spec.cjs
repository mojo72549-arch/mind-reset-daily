const { test, expect } = require('@playwright/test');

async function login(page, role = 'dome') {
  await page.goto(`/?role=${role}`);
  await page.getByRole('button', { name: 'Anmelden' }).click();
  await expect(page.locator('header.top')).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.SHP_DRAFT_NOTES && window.SHP_DRAFT_NOTES.build)).toBe('20260903-v9-6');
}

async function openSeedReport(page) {
  const direct = page.getByRole('button', { name: 'Rapport öffnen' }).first();
  if (await direct.isVisible().catch(() => false)) await direct.click();
  else {
    await page.evaluate(() => SH.go('reports'));
    await page.getByRole('button', { name: 'Rapport öffnen' }).first().click();
  }
  await expect(page.locator('main h2')).toContainText('Rapport A-2026-0101');
  await expect(page.locator('#shp-rapport-autosave')).toBeVisible();
}

async function openNewOrderForSeedCustomer(page, title) {
  await page.evaluate(() => SH.go('customers'));
  await page.getByRole('button', { name: 'Kunde öffnen' }).first().click();
  await page.getByRole('button', { name: '+ Auftrag' }).first().click();
  const modal = page.locator('#shp-app-modal');
  await expect(modal).toBeVisible();
  await modal.getByLabel('Auftragsbezeichnung').fill(title);
  await modal.getByLabel('Auftragsart').selectOption('Wartung');
  await modal.getByRole('button', { name: 'Auftrag anlegen' }).click();
  await expect(page.locator('main h2')).toContainText('Rapport A-2026-0102');
}

test('rapport free text survives an immediate service and material render without manual intermediate save', async ({ page }) => {
  await login(page, 'dome');
  await openSeedReport(page);

  const work = 'Küchenleitung geöffnet, gereinigt und mit Kamera kontrolliert.';
  const result = 'Durchfluss wieder frei. Bei erneutem Auftreten Fallstrang prüfen.';
  await page.locator('#rw').fill(work);
  await page.locator('#rr').fill(result);

  // Deliberately click immediately: the action must synchronously flush the draft before the legacy render.
  await page.locator('#rsvc').selectOption('svc1');
  await page.locator('#rqty').fill('1.25');
  await page.getByRole('button', { name: '+ Leistung' }).click();

  await expect(page.locator('#rw')).toHaveValue(work);
  await expect(page.locator('#rr')).toHaveValue(result);
  await expect.poll(() => page.evaluate(() => {
    const db = JSON.parse(localStorage.getItem('shp_db'));
    const report = db.reports.find(r => String(r.orderId) === '101');
    return [report.work, report.result];
  })).toEqual([work, result]);

  await page.getByRole('button', { name: '+ Material' }).click();
  const modal = page.locator('#shp-app-modal');
  await expect(modal).toBeVisible();
  await modal.getByLabel('Material / Bezeichnung').fill('Dichtungsring');
  await modal.getByLabel('Menge').fill('2');
  await modal.getByLabel('Einzelpreis €').fill('3.50');
  await modal.getByRole('button', { name: 'Material hinzufügen' }).click();

  await expect(page.locator('#rw')).toHaveValue(work);
  await expect(page.locator('#rr')).toHaveValue(result);
});

test('rapport text is flushed before start, end, navigation and full reload', async ({ page }) => {
  await login(page, 'dome');
  await openSeedReport(page);

  const work = 'Arbeitsbeschreibung bleibt auch über Statuswechsel erhalten.';
  const result = 'Ergebnis bleibt ebenfalls dauerhaft erhalten.';
  await page.locator('#rw').fill(work);
  await page.getByRole('button', { name: 'Einsatz starten' }).click();
  await expect(page.locator('#rw')).toHaveValue(work);

  await page.locator('#rr').fill(result);
  await page.getByRole('button', { name: 'Einsatz beenden' }).click();
  await expect(page.locator('#rw')).toHaveValue(work);
  await expect(page.locator('#rr')).toHaveValue(result);

  await page.evaluate(() => SH.go('reports'));
  await page.getByRole('button', { name: 'Rapport öffnen' }).first().click();
  await expect(page.locator('#rw')).toHaveValue(work);
  await expect(page.locator('#rr')).toHaveValue(result);

  await page.reload();
  await expect(page.locator('header.top')).toBeVisible();
  await page.evaluate(() => SH.go('reports'));
  await page.getByRole('button', { name: 'Rapport öffnen' }).first().click();
  await expect(page.locator('#rw')).toHaveValue(work);
  await expect(page.locator('#rr')).toHaveValue(result);
  await expect(page.locator('#shp-rapport-autosave')).toContainText(/gespeichert/i);
});

test('Dome internal note persists, stays office-hidden and appears as previous-visit history on the next order', async ({ page }) => {
  await login(page, 'dome');
  await openSeedReport(page);

  const note = 'Beim nächsten Termin zuerst Revisionsöffnung im Keller prüfen; Zugang hinter Regal.';
  await expect(page.getByRole('heading', { name: 'Interne Notiz für den nächsten Besuch' })).toBeVisible();
  await page.locator('#shp-tech-note').fill(note);
  await expect.poll(() => page.evaluate(() => {
    const data = JSON.parse(localStorage.getItem('shp_tech_notes_v9_6') || '{"entries":[]}');
    return data.entries[0] && data.entries[0].text;
  })).toBe(note);

  await page.evaluate(() => SH.logout());
  await login(page, 'annette');
  await openSeedReport(page);
  await expect(page.locator('.shp-tech-note-card')).toHaveCount(0);

  await openNewOrderForSeedCustomer(page, 'Folgebesuch interne Notiz');
  await page.evaluate(() => SH.logout());
  await login(page, 'dome');
  await page.evaluate(() => SH.go('reports'));
  const next = page.locator('.card').filter({ hasText: 'A-2026-0102' });
  await next.getByRole('button', { name: 'Rapport öffnen' }).click();

  await expect(page.getByText('Frühere Besuche bei diesem Kunden')).toBeVisible();
  const previous = page.locator('#shp-tech-note-history details').filter({ hasText: 'A-2026-0101' });
  await expect(previous).toHaveCount(1);
  await previous.locator('summary').click();
  await expect(previous).toContainText(note);

  const dbContainsPrivateNote = await page.evaluate(privateNote => localStorage.getItem('shp_db').includes(privateNote), note);
  expect(dbContainsPrivateNote).toBe(false);
});

test('Dome can dictate an internal note when browser speech recognition is available', async ({ page }) => {
  await page.addInitScript(() => {
    class FakeSpeechRecognition {
      constructor() { this.lang = ''; this.interimResults = false; this.continuous = false; }
      start() {
        if (this.onstart) this.onstart();
        setTimeout(() => {
          const result = { 0: { transcript: 'Siphon gereinigt und Zugang für Folgetermin markiert' }, isFinal: true, length: 1 };
          if (this.onresult) this.onresult({ resultIndex: 0, results: [result] });
          setTimeout(() => { if (this.onend) this.onend(); }, 15);
        }, 15);
      }
      stop() { if (this.onend) setTimeout(() => this.onend(), 0); }
    }
    window.SpeechRecognition = FakeSpeechRecognition;
    window.webkitSpeechRecognition = FakeSpeechRecognition;
  });

  await login(page, 'dome');
  await openSeedReport(page);
  await page.getByRole('button', { name: '🎤 Reinsprechen' }).click();
  await expect(page.locator('#shp-tech-note')).toContainText('Siphon gereinigt und Zugang für Folgetermin markiert');
  await expect(page.locator('#shp-tech-note-status')).toContainText(/übernommen|gespeichert/i);
  await expect.poll(() => page.evaluate(() => {
    const data = JSON.parse(localStorage.getItem('shp_tech_notes_v9_6') || '{"entries":[]}');
    return data.entries[0] && data.entries[0].text;
  })).toContain('Siphon gereinigt');
});
