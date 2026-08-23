const { test, expect } = require('@playwright/test');

async function card(page, code, title, text, kind='info', ms=1650){
  await page.evaluate(({code,title,text,kind})=>{let el=document.getElementById('shp-review-card');if(el)el.remove();el=document.createElement('div');el.id='shp-review-card';const bg=kind==='ok'?'#0c684e':kind==='bad'?'#8d2c35':'#102b41';el.style.cssText=`position:fixed;left:50%;top:18px;transform:translateX(-50%);z-index:99999;width:min(92vw,720px);padding:16px 18px;border-radius:14px;background:${bg};color:#fff;box-shadow:0 14px 42px #0007;font-family:Arial,sans-serif`;el.innerHTML=`<div style="font-size:12px;opacity:.8;font-weight:800">${code}</div><div style="font-size:20px;font-weight:900;margin:4px 0">${title}</div><div style="font-size:14px;line-height:1.45">${text}</div>`;document.body.appendChild(el)}, {code,title,text,kind}); await page.waitForTimeout(ms);
}
async function pass(page,code,text){await card(page,code,'✓ NEGATIVTEST BESTANDEN',text,'ok',1250)}
async function login(page,role='annette'){await page.goto(`/?role=${role}`);await page.getByRole('button',{name:'Anmelden'}).click();await expect(page.locator('header.top')).toBeVisible();await page.waitForTimeout(700)}
async function getDb(page){return page.evaluate(()=>JSON.parse(localStorage.getItem('shp_db')))}
async function setDb(page,src){await page.evaluate(s=>{const d=JSON.parse(localStorage.getItem('shp_db'));(0,eval)(s)(d);SHP_INTERNAL.setDb(d);SHP_INTERNAL.render()},src)}
async function prompts(page,answers,alerts){const q=[...answers];const h=async d=>{if(d.type()==='prompt')await d.accept(q.shift()??'');else{alerts.push(d.message());await d.accept()}};page.on('dialog',h);return()=>page.off('dialog',h)}
async function oneAlert(page,action){let msg='';page.once('dialog',async d=>{msg=d.message();await d.accept()});await action();await expect.poll(()=>msg).not.toBe('');return msg}


test('SLOW REVIEW negative and exception paths', async ({page})=>{
  test.setTimeout(180000); await page.addInitScript(()=>{window.__SHP_TEST_MODE__=true}); await login(page,'annette');
  await card(page,'NEG-00','Fachliche Negativ-Abnahme','Das CRM muss falsche oder unvollständige Aktionen verständlich ablehnen. Nach jedem Fehler prüfen wir: kein unerwünschter Datensatz, kein falscher Status, kein angeblicher Versand.','info',2300);

  await page.evaluate(()=>SH.go('customers'));
  await card(page,'NEG-01','Doppelten Kunden anlegen','Erwartung: Exakt gleicher Name + Adresse wird nicht ein zweites Mal angelegt.');
  let before=(await getDb(page)).customers.length,alerts=[],off=await prompts(page,['Musterkunde Stuttgart GmbH','Industriestraße 18, 70469 Stuttgart','Thomas Berger','0711 555123','t.berger@example.de','72','WhatsApp'],alerts);
  await page.getByRole('button',{name:'+ Kunde'}).click(); off(); await expect.poll(()=>alerts.join(' ')).toContain('existiert bereits'); expect((await getDb(page)).customers.length).toBe(before);
  await pass(page,'NEG-01','Dublette abgewiesen. Kundenzahl unverändert. Grund wurde angezeigt.');

  await card(page,'NEG-02','WhatsApp-Kunde ohne Telefonnummer','Erwartung: Kunde wird nicht gespeichert, weil der bevorzugte Versandkanal ohne Telefonnummer nicht funktionieren kann.');
  alerts=[]; before=(await getDb(page)).customers.length; off=await prompts(page,['Ohne Telefon GmbH','Teststraße 2','Kontakt','','mail@test.de','70','WhatsApp'],alerts); await page.getByRole('button',{name:'+ Kunde'}).click(); off(); await expect.poll(()=>alerts.join(' ')).toContain('Telefonnummer'); expect((await getDb(page)).customers.length).toBe(before);
  await pass(page,'NEG-02','Kunde nicht angelegt. Fehlende WhatsApp-Telefonnummer erkannt.');

  await card(page,'NEG-03','E-Mail-Kunde mit ungültiger Adresse','Erwartung: Ungültige Mailadresse wird vor Speicherung abgewiesen.');
  alerts=[]; before=(await getDb(page)).customers.length; off=await prompts(page,['Mail Fehler GmbH','Teststraße 3','Kontakt','07111234567','keine-mail','70','E-Mail'],alerts); await page.getByRole('button',{name:'+ Kunde'}).click(); off(); await expect.poll(()=>alerts.join(' ')).toContain('E-Mail-Adresse'); expect((await getDb(page)).customers.length).toBe(before);
  await pass(page,'NEG-03','Ungültige E-Mail erkannt. Kundendaten unverändert.');

  await card(page,'NEG-04','Auftrag mit ungültigem Kunden','Erwartung: Auftrag wird nicht angelegt, wenn die referenzierte Kundennummer nicht existiert.');
  before=(await getDb(page)).orders.length; let msg=await oneAlert(page,()=>page.evaluate(()=>SH.newOrder(999999999))); expect(msg).toContain('Kunde wurde nicht gefunden'); expect((await getDb(page)).orders.length).toBe(before);
  await pass(page,'NEG-04','Ungültige Kundenreferenz abgewiesen. Kein Auftrag erzeugt.');

  await card(page,'NEG-05','Auftrag ohne Bezeichnung','Erwartung: Ein Auftrag ohne fachliche Bezeichnung darf nicht gespeichert werden.');
  await page.evaluate(()=>SH.go('customers')); await page.getByRole('button',{name:'Kunde öffnen'}).first().click(); before=(await getDb(page)).orders.length; alerts=[];off=await prompts(page,['','Wartung'],alerts);await page.getByRole('button',{name:'+ Auftrag'}).first().click();off();await expect.poll(()=>alerts.join(' ')).toContain('Auftragsbezeichnung');expect((await getDb(page)).orders.length).toBe(before);
  await pass(page,'NEG-05','Leerer Auftrag abgewiesen.');

  await card(page,'NEG-06','Rapport ohne Unterschriften abschließen','Erwartung: Abschluss wird blockiert; Rapport bleibt offen.');
  await page.evaluate(()=>SH.go('reports'));await page.getByRole('button',{name:'Rapport öffnen'}).first().click();await page.getByRole('button',{name:'Einsatz starten'}).click();await page.locator('#rw').fill('Arbeit durchgeführt');await page.getByRole('button',{name:'Zwischenspeichern'}).click();msg=await oneAlert(page,()=>page.getByRole('button',{name:'Rapport abschließen'}).click());expect(msg).toContain('Kundenunterschrift');expect((await getDb(page)).reports[0].status).not.toBe('Abgeschlossen');
  await pass(page,'NEG-06','Rapport blieb offen. Fehlende Kundenunterschrift erkannt.');

  await card(page,'NEG-07','Unfertigen Rapport fakturieren','Erwartung: Keine Rechnung aus einem noch nicht abgeschlossenen Rapport.');
  before=(await getDb(page)).invoices.length;msg=await oneAlert(page,()=>page.getByRole('button',{name:'Rechnung erzeugen'}).click());expect(msg).toContain('abgeschlossenem Rapport');expect((await getDb(page)).invoices.length).toBe(before);
  await pass(page,'NEG-07','Keine Rechnung erzeugt. Rechnungsbestand unverändert.');

  await card(page,'NEG-08','Entwurfsrechnung versenden','Erwartung: Versandbuttons sind deaktiviert, solange die Rechnung nicht freigegeben wurde.');
  await setDb(page,"d=>{d.invoices[0].status='Entwurf'}");await page.evaluate(()=>SH.go('invoices'));await page.getByRole('button',{name:'26175'}).first().click();await expect(page.getByRole('button',{name:'WhatsApp',exact:true})).toBeDisabled();expect(await page.evaluate(()=>sessionStorage.getItem('shp_pending_delivery_v10'))).toBeNull();
  await pass(page,'NEG-08','Entwurfsrechnung ist nicht versendbar.');

  await card(page,'NEG-09','WhatsApp-Versand ohne Kundentelefon','Erwartung: Versand wird nicht vorbereitet und Rechnung bleibt Offen.');
  await setDb(page,"d=>{d.invoices[0].status='Offen';d.customers[0].phone=''}");await page.evaluate(()=>SH.go('invoices'));await page.getByRole('button',{name:'26175'}).first().click();msg=await oneAlert(page,()=>page.getByRole('button',{name:'WhatsApp',exact:true}).click());expect(msg).toContain('Telefonnummer');expect(await page.evaluate(()=>sessionStorage.getItem('shp_pending_delivery_v10'))).toBeNull();
  await pass(page,'NEG-09','WhatsApp-Versand blockiert. Kein falscher Versandstatus.');

  await card(page,'NEG-10','Stornierte Rechnung versenden','Erwartung: Stornierte Rechnungen dürfen nicht versendet werden.');
  await setDb(page,"d=>{d.invoices[0].status='Storniert';d.customers[0].phone='0711555123'}");await page.evaluate(()=>SH.go('invoices'));await page.getByRole('button',{name:'26175'}).first().click();msg=await oneAlert(page,()=>page.getByRole('button',{name:'WhatsApp',exact:true}).click());expect(msg).toContain('Stornierte Rechnungen');expect(await page.evaluate(()=>sessionStorage.getItem('shp_pending_delivery_v10'))).toBeNull();
  await pass(page,'NEG-10','Stornierte Rechnung blieb gesperrt.');

  await card(page,'NEG-11','Versand vorbereiten und abbrechen','Erwartung: Öffnet man den Versand, bricht aber ab, darf die Rechnung nicht auf Versendet springen.');
  await setDb(page,"d=>{d.invoices[0].status='Offen';d.customers[0].phone='0711555123'}");await page.evaluate(()=>SH.go('invoices'));await page.getByRole('button',{name:'26175'}).first().click();await page.getByRole('button',{name:'WhatsApp',exact:true}).click();await expect(page.locator('.ux-v10-pending')).toHaveCount(1);await page.getByRole('button',{name:'Verwerfen'}).click();expect((await getDb(page)).invoices[0].status).toBe('Offen');
  await pass(page,'NEG-11','Versand verworfen. Rechnung bleibt Offen und wird nicht fälschlich als Versendet markiert.');

  await card(page,'NEG-12','Ungültige Admin-Mailadresse','Erwartung: Fehlerhafte Kommunikationsdaten werden nicht in die Systemeinstellungen übernommen.');
  await page.evaluate(()=>SH.logout());await login(page,'admin');await page.evaluate(()=>SH.go('admin'));const old=(await getDb(page)).settings.delivery?.emailReplyTo||'';await page.locator('#adm-emailReplyTo').fill('ungueltig');msg=await oneAlert(page,()=>page.getByRole('button',{name:'Einstellungen speichern'}).click());expect(msg).toContain('Antwortadresse');expect(((await getDb(page)).settings.delivery?.emailReplyTo||'')).toBe(old);
  await pass(page,'NEG-12','Ungültige Admin-E-Mail abgewiesen. Systemeinstellung unverändert.');

  await card(page,'NEG-END','Negativpfad abgeschlossen','Alle gezeigten Fehlbedienungen wurden abgefangen, ohne unerwünschte Kunden, Aufträge, Rechnungen oder Versandstatus zu erzeugen.','ok',2400);
});
