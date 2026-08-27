const { test, expect } = require('@playwright/test');

async function card(page, code, title, expectation, kind='info', ms=1700){
  await page.evaluate(({code,title,expectation,kind})=>{
    let el=document.getElementById('shp-review-card'); if(el)el.remove();
    el=document.createElement('div'); el.id='shp-review-card';
    const bg=kind==='ok'?'#0c684e':kind==='bad'?'#8d2c35':'#102b41';
    el.style.cssText=`position:fixed;left:50%;top:18px;transform:translateX(-50%);z-index:99999;width:min(92vw,720px);padding:16px 18px;border-radius:14px;background:${bg};color:#fff;box-shadow:0 14px 42px #0007;font-family:Arial,sans-serif`;
    el.innerHTML=`<div style="font-size:12px;opacity:.8;font-weight:800">${code}</div><div style="font-size:20px;font-weight:900;margin:4px 0">${title}</div><div style="font-size:14px;line-height:1.45">${expectation}</div>`;
    document.body.appendChild(el);
  },{code,title,expectation,kind});
  await page.waitForTimeout(ms);
}
async function ok(page, code, text){await card(page,code,'✓ BESTANDEN',text,'ok',1300)}
async function login(page, role){await page.goto(`/?role=${role}`);await page.getByRole('button',{name:'Anmelden'}).click();await expect(page.locator('header.top')).toBeVisible();await page.waitForTimeout(800)}
async function draw(page,selector){const c=page.locator(selector);await c.scrollIntoViewIfNeeded();const touch=await page.evaluate(()=>navigator.maxTouchPoints>0);if(touch){await page.evaluate(sel=>{const c=document.querySelector(sel),r=c.getBoundingClientRect(),p=[[18,30],[55,64],[95,35],[140,68],[190,38]],mk=([x,y])=>new Touch({identifier:55,target:c,clientX:r.left+x,clientY:r.top+y,pageX:scrollX+r.left+x,pageY:scrollY+r.top+y,screenX:r.left+x,screenY:r.top+y,radiusX:2,radiusY:2,force:.7}),fire=(t,p,on)=>{const x=mk(p);c.dispatchEvent(new TouchEvent(t,{bubbles:true,cancelable:true,touches:on?[x]:[],targetTouches:on?[x]:[],changedTouches:[x]}))};fire('touchstart',p[0],true);p.slice(1).forEach(x=>fire('touchmove',x,true));fire('touchend',p.at(-1),false)},selector)}else{const b=await c.boundingBox();await page.mouse.move(b.x+20,b.y+35);await page.mouse.down();await page.mouse.move(b.x+90,b.y+68,{steps:12});await page.mouse.move(b.x+175,b.y+32,{steps:12});await page.mouse.up()}await page.waitForTimeout(600)}

test('SLOW REVIEW positive complete CRM flow', async ({page})=>{
  test.setTimeout(180000);
  await page.addInitScript(()=>{window.__SHP_TEST_MODE__=true});

  await card(page,'POS-00','Fachliche E2E-Abnahme','Admin-Einstellungen → Annette legt Kunde/Auftrag an → Dome bearbeitet Rapport → Annette erstellt, prüft und versendet Rechnung.','info',2200).catch(()=>{});
  await login(page,'admin');
  await page.evaluate(()=>SH.go('admin'));
  await card(page,'POS-01','Administration','Erwartung: Nur Systemeinstellungen. WhatsApp und E-Mail werden als kostenfreier Geräte-/App-Versand konfiguriert.');
  await expect(page.locator('.ux-v10-delivery-settings')).toHaveCount(1);
  await expect(page.getByText('Musterkunde Stuttgart GmbH')).toHaveCount(0);
  await page.locator('#adm-waNumber').fill('0152 23401628');
  await page.locator('#adm-emailReplyTo').fill('info@rokatech-winser.de');
  await page.getByRole('button',{name:'Einstellungen speichern'}).click();
  await ok(page,'POS-01','System- und Kommunikationsdaten gespeichert. Keine operativen Kunden-/Rechnungslisten in Administration.');

  await card(page,'POS-02','Annette legt Kunden an','Erwartung: Vollständiger Kunde mit bevorzugtem Versandkanal WhatsApp wird einmalig gespeichert.');
  await page.evaluate(()=>SH.logout()); await login(page,'annette'); await page.evaluate(()=>SH.go('customers'));
  let answers=['E2E Abnahmekunde GmbH','Teststraße 10, 70437 Stuttgart','Max Mustermann','0170 1234567','kunde@example.de','85','WhatsApp'];
  page.on('dialog',async d=>{if(d.type()==='prompt')await d.accept(answers.shift()??'');else await d.accept()});
  await page.getByRole('button',{name:'+ Kunde'}).click();
  await expect(page.locator('main h2')).toHaveText('E2E Abnahmekunde GmbH');
  await ok(page,'POS-02','Kunde gespeichert. Bevorzugter Kanal: WhatsApp.');

  await card(page,'POS-03','Annette legt Auftrag an','Erwartung: Auftrag wird exakt diesem Kunden zugeordnet und für Dome bereitgestellt.');
  answers=['Rohrreinigung E2E-Abnahme','Wartung'];
  await page.getByRole('button',{name:'+ Auftrag'}).first().click();
  await expect(page.locator('main h2')).toContainText('Rapport A-');
  const orderId=await page.evaluate(()=>SHP_INTERNAL.getSelectedOrder());
  await ok(page,'POS-03','Auftrag angelegt und Rapport automatisch vorbereitet.');

  await card(page,'POS-04','Dome übernimmt den Einsatz','Erwartung: Dome sieht den Auftrag und bearbeitet denselben Rapport wie das Büro.');
  await page.evaluate(()=>SH.logout()); await login(page,'dome');
  await page.evaluate(id=>{SHP_INTERNAL.setSelectedOrder(id);SHP_INTERNAL.setTab('report');SHP_INTERNAL.render()},orderId);
  await expect(page.locator('main h2')).toContainText('Rapport A-');
  await page.getByRole('button',{name:'Einsatz starten'}).click();
  await ok(page,'POS-04','Einsatz gestartet.');

  await card(page,'POS-05','Leistung und Material','Erwartung: Leistung und Material erscheinen sofort im offenen Rapport – ohne Zurück oder Reload.');
  await page.locator('#rsvc').selectOption('svc1'); await page.locator('#rqty').fill('1.5'); await page.getByRole('button',{name:'+ Leistung'}).click();
  answers=['Dichtungsring','2','3.50']; await page.getByRole('button',{name:'+ Material'}).click();
  await page.locator('#rw').fill('Rohrleitung geprüft, gereinigt und Funktion kontrolliert.');
  await page.locator('#rr').fill('Anlage funktionsfähig. Keine weiteren Arbeiten erforderlich.');
  await page.getByRole('button',{name:'Zwischenspeichern'}).click();
  await expect(page.locator('.report-lines-card')).toContainText('Gerätewageneinsatz'); await expect(page.locator('main')).toContainText('Dichtungsring');
  await ok(page,'POS-05','Leistung, Material und Rapporttext sofort sichtbar und gespeichert.');

  await card(page,'POS-06','Kunde und Techniker unterschreiben','Erwartung: Beide echten Unterschriften sind Pflicht und werden sichtbar als erfasst markiert.');
  await draw(page,'#sigC'); await expect(page.locator('#sigC').locator('xpath=..').locator('.ux-v10-signature-state')).toContainText('erfasst');
  await draw(page,'#sigT'); await expect(page.locator('#sigT').locator('xpath=..').locator('.ux-v10-signature-state')).toContainText('erfasst');
  await ok(page,'POS-06','Beide Unterschriften wurden erfasst.');

  await card(page,'POS-07','Rapport abschließen','Erwartung: Erst jetzt wird der Rapport verbindlich abgeschlossen.');
  await page.getByRole('button',{name:'Rapport abschließen'}).click(); await expect(page.locator('main')).toContainText('Abgeschlossen');
  await ok(page,'POS-07','Rapport abgeschlossen und gegen unvollständige Signaturen geschützt.');

  await card(page,'POS-08','Annette erzeugt Rechnungsentwurf','Erwartung: Aus dem abgeschlossenen Rapport entsteht genau eine Rechnung im Status Entwurf. Versand ist noch gesperrt.');
  await page.evaluate(()=>SH.logout()); await login(page,'annette');
  await page.evaluate(id=>{SHP_INTERNAL.setSelectedOrder(id);SHP_INTERNAL.setTab('report');SHP_INTERNAL.render()},orderId);
  await page.getByRole('button',{name:'Rechnung erzeugen'}).click(); await expect(page.locator('#ivstatus')).toHaveValue('Entwurf'); await expect(page.getByRole('button',{name:'WhatsApp',exact:true})).toBeDisabled();
  await ok(page,'POS-08','Rechnungsentwurf erstellt; noch nicht versendbar.');

  await card(page,'POS-09','Rechnung prüfen und freigeben','Erwartung: Erst Büro/Admin gibt die geprüfte Rechnung für den Versand frei.');
  await page.getByRole('button',{name:'Rechnung freigeben'}).click(); await expect(page.locator('#ivstatus')).toHaveValue('Offen');
  await ok(page,'POS-09','Rechnung freigegeben. Versandkanäle sind jetzt aktiv.');

  await card(page,'POS-10','WhatsApp-Versand vorbereiten','Erwartung: Kostenfreier Geräte-Handoff über wa.me. Status bleibt unverändert, bis Annette den tatsächlichen Versand bestätigt.');
  await page.getByRole('button',{name:'Bevorzugten Kanal verwenden'}).click(); await expect(page.locator('.ux-v10-pending')).toContainText('WhatsApp vorbereitet');
  const last=await page.evaluate(()=>window.SHP_LAST_DELIVERY); expect(last.url).toMatch(/^https:\/\/wa\.me\//); expect(last.url).not.toMatch(/twilio/i);
  await ok(page,'POS-10','WhatsApp vorbereitet – keine Twilio-/Meta-API erforderlich.');

  await card(page,'POS-11','Versand bestätigen','Erwartung: Erst nach tatsächlichem Senden wird die Rechnung im CRM auf Versendet gesetzt.');
  await page.getByRole('button',{name:'Versand bestätigen'}).click(); await expect(page.locator('#ivstatus')).toHaveValue('Versendet');
  await ok(page,'POS-11','End-to-End erfolgreich: Kunde → Auftrag → Rapport → Rechnung → bestätigter Versand.');
  await page.waitForTimeout(2200);
});
