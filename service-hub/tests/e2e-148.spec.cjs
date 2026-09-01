const { test, expect } = require('@playwright/test');

let DEFINED = 0;
function scenario(id, title, fn) {
  DEFINED += 1;
  test(`${id} ${title}`, fn);
}

async function login(page, role = 'annette') {
  await page.goto(`/?role=${role}`);
  await page.getByRole('button', { name: 'Anmelden' }).click();
  await expect(page.locator('header.top')).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('data-sh-quality', 'v12-160');
  await page.evaluate(() => { window.__SHP_TEST_MODE__ = true; });
}
async function go(page, tab) { await page.evaluate(t => SH.go(t), tab); await page.waitForTimeout(80); }
async function db(page) { return page.evaluate(() => JSON.parse(localStorage.getItem('shp_db'))); }
async function session(page) { return page.evaluate(() => JSON.parse(sessionStorage.getItem('shp_session') || 'null')); }
async function mutateDb(page, payload, code) {
  await page.evaluate(({ payload, code }) => {
    const d = SHP_INTERNAL.getDb();
    new Function('d', 'payload', code)(d, payload);
    SHP_INTERNAL.setDb(d);
    SHP_INTERNAL.render();
  }, { payload, code });
  await page.waitForTimeout(80);
}
async function openSeedCustomer(page) {
  await go(page, 'customers');
  await page.getByRole('button', { name: 'Kunde öffnen' }).first().click();
  await expect(page.locator('main h2')).toHaveText('Musterkunde Stuttgart GmbH');
}
async function openSeedReport(page) {
  await go(page, 'reports');
  await page.getByRole('button', { name: 'Rapport öffnen' }).first().click();
  await expect(page.locator('main h2')).toContainText('Rapport A-2026-0101');
}
async function openSeedInvoice(page) {
  await go(page, 'invoices');
  await page.getByRole('button', { name: '26175' }).first().click();
  await expect(page.locator('main h2')).toHaveText('Rechnung 26175');
}
function queueDialogs(page, answers, confirmValue = true) {
  const q = [...answers];
  const handler = async dialog => {
    if (dialog.type() === 'prompt') await dialog.accept(q.shift() ?? '');
    else if (confirmValue) await dialog.accept(); else await dialog.dismiss();
  };
  page.on('dialog', handler);
  return () => page.off('dialog', handler);
}
async function drawSignature(page, selector) {
  const canvas = page.locator(selector);
  await canvas.scrollIntoViewIfNeeded();
  const touch = await page.evaluate(() => navigator.maxTouchPoints > 0);
  if (touch) {
    await page.evaluate(sel => {
      const c = document.querySelector(sel), r = c.getBoundingClientRect();
      const pts = [[18,30],[52,65],[98,35],[145,72],[195,40]];
      const mk = ([x,y]) => new Touch({identifier:91,target:c,clientX:r.left+x,clientY:r.top+y,pageX:scrollX+r.left+x,pageY:scrollY+r.top+y,screenX:r.left+x,screenY:r.top+y,radiusX:2,radiusY:2,force:.7});
      const fire = (type,p,on) => { const t=mk(p); c.dispatchEvent(new TouchEvent(type,{bubbles:true,cancelable:true,touches:on?[t]:[],targetTouches:on?[t]:[],changedTouches:[t]})); };
      fire('touchstart',pts[0],true); pts.slice(1).forEach(p=>fire('touchmove',p,true)); fire('touchend',pts.at(-1),false);
    }, selector);
  } else {
    const b = await canvas.boundingBox(); expect(b).toBeTruthy();
    await page.mouse.move(b.x+18,b.y+30); await page.mouse.down();
    await page.mouse.move(b.x+65,b.y+68,{steps:5}); await page.mouse.move(b.x+125,b.y+34,{steps:5}); await page.mouse.move(b.x+195,b.y+62,{steps:5}); await page.mouse.up();
  }
  await page.waitForTimeout(120);
}
async function canvasHasInk(page, selector) {
  return page.locator(selector).evaluate(c => {
    const a=c.getContext('2d').getImageData(0,0,c.width,c.height).data;
    for(let i=3;i<a.length;i+=4) if(a[i]>0) return true;
    return false;
  });
}
async function createCustomer(page, values = {}) {
  await go(page, 'customers');
  const v = Object.assign({name:'Test Kunde GmbH',address:'Teststraße 1, 70437 Stuttgart',contact:'Max Test',phone:'0170 1111111',email:'test@example.de',rate:'85',channel:'E-Mail'}, values);
  const stop = queueDialogs(page,[v.name,v.address,v.contact,v.phone,v.email,v.rate,v.channel]);
  await page.getByRole('button',{name:'+ Kunde'}).click(); stop();
  return v;
}
async function editSeedCustomer(page, updates = {}) {
  await openSeedCustomer(page);
  const c=(await db(page)).customers[0];
  const v=Object.assign({name:c.name,contact:c.contact,phone:c.phone,email:c.email,address:c.address,channel:c.preferredChannel,interval:c.serviceInterval||'',next:c.nextService||''},updates);
  const stop=queueDialogs(page,[v.name,v.contact,v.phone,v.email,v.address,v.channel,v.interval,v.next]);
  await page.getByRole('button',{name:'Stammdaten bearbeiten'}).click(); stop();
  return v;
}
async function createOrderFromSeed(page, title='Testauftrag', type='Wartung') {
  await openSeedCustomer(page);
  const stop=queueDialogs(page,[title,type]);
  await page.getByRole('button',{name:'+ Auftrag'}).first().click(); stop();
  await expect(page.locator('main h2')).toContainText('Rapport A-');
}
async function setupCompletedReport(page, opts={}) {
  await mutateDb(page, opts, `
    const r=d.reports[0],o=d.orders[0];
    r.start=payload.start||'01.09.2026, 10:00:00'; r.end=payload.end||'01.09.2026, 11:00:00';
    r.work=payload.work||'Leitung gereinigt und geprüft.'; r.result=payload.result||'Funktion in Ordnung.';
    r.customerName=payload.customerName||'Thomas Berger'; r.status='Abgeschlossen';
    r.lines=payload.lines||[{catalogId:'svc1',name:'Gerätewageneinsatz (inkl. 1 Techniker)',unit:'Std.',qty:1,price:125}];
    r.materials=payload.materials||[]; r.sigC=payload.sigC||'data:image/png;base64,iVBORw0KGgo='; r.sigT=payload.sigT||'data:image/png;base64,iVBORw0KGgo=';
    o.status='Abgeschlossen';
  `);
  await openSeedReport(page);
}
async function generateInvoice(page, opts={}) {
  await setupCompletedReport(page, opts);
  await page.getByRole('button',{name:'Rechnung erzeugen'}).click();
  await expect(page.locator('main h2')).toContainText('Rechnung ');
  return (await db(page)).invoices.at(-1);
}
async function releaseCurrentInvoice(page) {
  await expect(page.locator('.ux-v12-release')).toBeVisible();
  await page.locator('.ux-v12-release').click();
  await expect(page.locator('#ivstatus')).toHaveValue('Offen');
}
async function setSeedInvoice(page, patch={}) {
  await mutateDb(page, patch, `Object.assign(d.invoices[0],payload.invoice||{});Object.assign(d.customers[0],payload.customer||{});`);
  await openSeedInvoice(page);
}
async function saveAdmin(page, changes={}) {
  await go(page,'admin');
  for (const [id,value] of Object.entries(changes)) await page.locator(id).fill(String(value));
  await page.getByRole('button',{name:'Einstellungen speichern'}).click();
  await expect(page.locator('.ux-admin-saved')).toContainText('Einstellungen gespeichert');
}

for (const role of ['dome','annette','admin']) scenario(`AUTH-00${role==='dome'?1:role==='annette'?2:3}`,`${role} Login verbirgt öffentliche Zugangsdaten`, async({page})=>{
  await page.goto(`/?role=${role}`); await expect(page.locator('#u')).toBeHidden(); await expect(page.locator('.loginbox')).not.toContainText('Demo-2026!'); await expect(page.getByText('Zugangsdaten werden nicht öffentlich angezeigt.')).toBeVisible();
});
scenario('AUTH-004','Passwortfeld ist maskiert und autocomplete-sicher',async({page})=>{await page.goto('/?role=dome');await expect(page.locator('#p')).toHaveAttribute('type','password');await expect(page.locator('#p')).toHaveAttribute('autocomplete','current-password');});
scenario('AUTH-005','Falsches Passwort erzeugt keine Sitzung',async({page})=>{await page.goto('/?role=dome');await page.locator('#p').fill('falsch');await page.getByRole('button',{name:'Anmelden'}).click();await expect(page.locator('header.top')).toHaveCount(0);expect(await session(page)).toBeNull();});
scenario('AUTH-006','Unbekannter Rollenparameter verrät keine Zugangsdaten',async({page})=>{await page.goto('/?role=superuser');await expect(page.locator('#u')).toBeHidden();await expect(page.locator('#p')).toHaveValue('');await expect(page.locator('.loginbox')).not.toContainText('Demo-2026!');});
for (const [id,role,user,storedRole] of [['AUTH-007','dome','dome','tech'],['AUTH-008','annette','annette','office'],['AUTH-009','admin','admin','admin']]) scenario(id,`${role} Anmeldung erzeugt korrekte Sitzung`,async({page})=>{await login(page,role);const s=await session(page);expect(s.user).toBe(user);expect(s.role).toBe(storedRole);});
scenario('AUTH-010','Abmeldung löscht Sitzung vollständig',async({page})=>{await login(page,'annette');await page.evaluate(()=>SH.logout());await expect(page.locator('.loginbox')).toBeVisible();expect(await session(page)).toBeNull();});
scenario('AUTH-011','Dome kann Administration auch direkt nicht öffnen',async({page})=>{await login(page,'dome');page.once('dialog',d=>d.accept());await page.evaluate(()=>SH.go('admin'));await expect(page.locator('.ux-admin-title')).toHaveCount(0);});
scenario('AUTH-012','Dome kann Kundenanlage auch per Direktaufruf nicht durchführen',async({page})=>{await login(page,'dome');const before=(await db(page)).customers.length;page.once('dialog',d=>d.accept());await page.evaluate(()=>SH.newCustomer());expect((await db(page)).customers.length).toBe(before);});
scenario('AUTH-013','Annette kann globale Administration nicht öffnen',async({page})=>{await login(page,'annette');page.once('dialog',d=>d.accept());await page.evaluate(()=>SH.go('admin'));await expect(page.locator('.ux-admin-title')).toHaveCount(0);});
scenario('AUTH-014','Dome kann Rechnungsstatus und Versand nicht verändern',async({page})=>{await login(page,'dome');await openSeedInvoice(page);await expect(page.locator('#ivstatus')).toBeDisabled();await expect(page.getByRole('button',{name:'Status speichern'})).toHaveCount(0);await expect(page.getByRole('button',{name:'WhatsApp'})).toHaveCount(0);});

scenario('CUS-001','Seed-Kunde wird korrekt angezeigt',async({page})=>{await login(page);await go(page,'customers');await expect(page.getByText('Musterkunde Stuttgart GmbH',{exact:true})).toBeVisible();});
scenario('CUS-002','Kunde wird vollständig angelegt und sofort geöffnet',async({page})=>{await login(page);const before=(await db(page)).customers.length;await createCustomer(page,{name:'CUS002 GmbH'});await expect(page.locator('main h2')).toHaveText('CUS002 GmbH');expect((await db(page)).customers.length).toBe(before+1);});
scenario('CUS-003','Abbruch beim Kundennamen verändert keine Daten',async({page})=>{await login(page);await go(page,'customers');const before=JSON.stringify((await db(page)).customers);page.once('dialog',d=>d.dismiss());await page.getByRole('button',{name:'+ Kunde'}).click();expect(JSON.stringify((await db(page)).customers)).toBe(before);});
scenario('CUS-004','Abbruch bei Adresse verändert keine Daten',async({page})=>{await login(page);await go(page,'customers');const before=JSON.stringify((await db(page)).customers);let n=0;page.on('dialog',d=>{n++===0?d.accept('Abbruch GmbH'):d.dismiss()});await page.getByRole('button',{name:'+ Kunde'}).click();expect(JSON.stringify((await db(page)).customers)).toBe(before);});
scenario('CUS-005','Neu angelegter Kunde überlebt Reload',async({page})=>{await login(page);await createCustomer(page,{name:'Reload CUS005 GmbH'});await page.reload();await expect(page.locator('header.top')).toBeVisible();await go(page,'customers');await expect(page.getByText('Reload CUS005 GmbH',{exact:true})).toBeVisible();});
const customerEditCases=[['CUS-006','Kundenname','name','Neuer Kundenname GmbH'],['CUS-007','Ansprechpartner','contact','Neue Kontaktperson'],['CUS-008','Telefon','phone','0711 987654'],['CUS-009','E-Mail','email','neu@example.de'],['CUS-010','Adresse','address','Neue Straße 9, 70173 Stuttgart'],['CUS-011','WhatsApp-Kanal','channel','WhatsApp'],['CUS-012','E-Mail-Kanal','channel','E-Mail'],['CUS-013','Post-Kanal','channel','Post'],['CUS-014','Serviceintervall','interval','12 Monate'],['CUS-015','Nächster Service','next','2027-09-01']];
for(const [id,label,key,value] of customerEditCases) scenario(id,`${label} wird gespeichert`,async({page})=>{await login(page);await editSeedCustomer(page,{[key]:value});const c=(await db(page)).customers[0];const map={name:'name',contact:'contact',phone:'phone',email:'email',address:'address',channel:'preferredChannel',interval:'serviceInterval',next:'nextService'};expect(c[map[key]]).toBe(value);});
scenario('CUS-016','Kundenanlage erzeugt Audit-Eintrag',async({page})=>{await login(page);await createCustomer(page,{name:'Audit Kunde 16 GmbH'});expect((await db(page)).settings.audit[0].text).toContain('Audit Kunde 16 GmbH');});
scenario('CUS-017','Stammdatenänderung erzeugt Audit-Eintrag',async({page})=>{await login(page);await editSeedCustomer(page,{contact:'Audit Kontakt'});expect((await db(page)).settings.audit[0].text).toContain('Stammdaten');});
scenario('CUS-018','Doppelter Kunde Name plus Adresse wird verhindert',async({page})=>{await login(page);const before=(await db(page)).customers.length;await createCustomer(page,{name:'Musterkunde Stuttgart GmbH',address:'Industriestraße 18, 70469 Stuttgart'});expect((await db(page)).customers.length).toBe(before);await expect(page.locator('.ux-v12-toast')).toContainText('existiert bereits');});
scenario('CUS-019','WhatsApp-Kunde ohne Telefonnummer wird verhindert',async({page})=>{await login(page);const before=(await db(page)).customers.length;await createCustomer(page,{name:'No Phone GmbH',phone:'',channel:'WhatsApp'});expect((await db(page)).customers.length).toBe(before);await expect(page.locator('.ux-v12-toast')).toContainText('Telefonnummer');});
scenario('CUS-020','E-Mail-Kunde ohne gültige Mail wird verhindert',async({page})=>{await login(page);const before=(await db(page)).customers.length;await createCustomer(page,{name:'Bad Mail GmbH',email:'ungueltig',channel:'E-Mail'});expect((await db(page)).customers.length).toBe(before);await expect(page.locator('.ux-v12-toast')).toContainText('gültige E-Mail');});
scenario('CUS-021','Neu angelegter Kunde kann per Undo zurückgesetzt werden',async({page})=>{await login(page);await createCustomer(page,{name:'Undo CUS021 GmbH'});await expect(page.locator('.ux-undo-toast')).toBeVisible();await page.locator('.ux-undo-toast button').click();await expect(page.locator('header.top')).toBeVisible();await go(page,'customers');await expect(page.getByText('Undo CUS021 GmbH')).toHaveCount(0);});
scenario('CUS-022','Script-Inhalt im Kundennamen wird escaped',async({page})=>{await login(page);const name='<img src=x onerror=window.__xss=1> XSS Kunde';await createCustomer(page,{name});await expect(page.locator('main h2')).toHaveText(name);await expect(page.locator('img[src="x"]')).toHaveCount(0);expect(await page.evaluate(()=>window.__xss||0)).toBe(0);});

scenario('ORD-001','Seed-Auftrag wird angezeigt',async({page})=>{await login(page);await go(page,'orders');await expect(page.locator('main')).toContainText('A-2026-0101');});
scenario('ORD-002','Auftrag wird sofort ohne Reload als Rapport geöffnet',async({page})=>{await login(page);await openSeedCustomer(page);const url=page.url();let nav=0;page.on('framenavigated',f=>{if(f===page.mainFrame())nav++});const stop=queueDialogs(page,['Sofortauftrag 002','Wartung']);await page.getByRole('button',{name:'+ Auftrag'}).first().click();stop();await expect(page.locator('main h2')).toContainText('Rapport A-');expect(page.url()).toBe(url);expect(nav).toBe(0);});
scenario('ORD-003','Abbruch beim Auftragstitel verändert keine Daten',async({page})=>{await login(page);await openSeedCustomer(page);const before=(await db(page)).orders.length;page.once('dialog',d=>d.dismiss());await page.getByRole('button',{name:'+ Auftrag'}).first().click();expect((await db(page)).orders.length).toBe(before);});
scenario('ORD-004','Leere Auftragsart fällt auf Wartung zurück',async({page})=>{await login(page);await createOrderFromSeed(page,'Default Art','');expect((await db(page)).orders.at(-1).type).toBe('Wartung');});
scenario('ORD-005','Benutzerdefinierte Auftragsart wird gespeichert',async({page})=>{await login(page);await createOrderFromSeed(page,'Rohr Auftrag','Rohrreinigung');expect((await db(page)).orders.at(-1).type).toBe('Rohrreinigung');});
scenario('ORD-006','Neue Auftragsnummer ist vierstellig',async({page})=>{await login(page);await createOrderFromSeed(page,'Nummernschema','Wartung');expect((await db(page)).orders.at(-1).no).toMatch(/^A-\d{4}-\d{4}$/);});
scenario('ORD-007','Auftragsnummer nutzt höchsten Zähler plus eins',async({page})=>{await login(page);await mutateDb(page,{},`d.orders.push({id:999,no:'A-2026-0999',customerId:1,title:'Alt',type:'Wartung',date:'01.01.2026',status:'Zugewiesen',assignedTo:'Dome'});`);await createOrderFromSeed(page,'Nummer 1000','Wartung');expect((await db(page)).orders.at(-1).no).toMatch(/-1000$/);});
scenario('ORD-008','Neuer Auftrag erzeugt exakt einen Rapport',async({page})=>{await login(page);const before=(await db(page)).reports.length;await createOrderFromSeed(page,'Rapport einmal','Wartung');const d=await db(page),o=d.orders.at(-1);expect(d.reports.filter(r=>String(r.orderId)===String(o.id))).toHaveLength(1);expect(d.reports.length).toBe(before+1);});
scenario('ORD-009','Neuer Auftrag wird Dome zugewiesen',async({page})=>{await login(page);await createOrderFromSeed(page,'Dome Zuordnung','Wartung');expect((await db(page)).orders.at(-1).assignedTo).toBe('Dome');});
scenario('ORD-010','Neuer Auftrag startet Zugewiesen',async({page})=>{await login(page);await createOrderFromSeed(page,'Status Start','Wartung');expect((await db(page)).orders.at(-1).status).toBe('Zugewiesen');});
scenario('ORD-011','Auftragsanlage erzeugt Audit',async({page})=>{await login(page);await createOrderFromSeed(page,'Audit Auftrag 11','Wartung');expect((await db(page)).settings.audit[0].text).toContain('Audit Auftrag 11');});
scenario('ORD-012','Neuer Auftrag überlebt Reload',async({page})=>{await login(page);await createOrderFromSeed(page,'Reload Auftrag 12','Wartung');await page.reload();await expect(page.locator('header.top')).toBeVisible();await go(page,'orders');await expect(page.locator('main')).toContainText('Reload Auftrag 12');});
scenario('ORD-013','Kundenansicht zeigt neuen Auftrag',async({page})=>{await login(page);await createOrderFromSeed(page,'Kundenansicht 13','Wartung');await openSeedCustomer(page);await expect(page.locator('main')).toContainText('Kundenansicht 13');});
scenario('ORD-014','Auftragsübersicht zeigt neuen Auftrag',async({page})=>{await login(page);await createOrderFromSeed(page,'Übersicht 14','Wartung');await go(page,'orders');await expect(page.locator('main')).toContainText('Übersicht 14');});
scenario('ORD-015','Dome kann zugewiesenen Rapport öffnen',async({page})=>{await login(page,'dome');await openSeedReport(page);await expect(page.locator('#rw')).toBeVisible();});
scenario('ORD-016','Dome kann keinen Auftrag anlegen',async({page})=>{await login(page,'dome');await go(page,'orders');await expect(page.getByRole('button',{name:'+ Auftrag'})).toHaveCount(0);});
scenario('ORD-017','Annette kann Auftrag anlegen',async({page})=>{await login(page);await go(page,'orders');await expect(page.getByRole('button',{name:'+ Auftrag'})).toBeVisible();});
scenario('ORD-018','Doppeltes Absenden erzeugt nur einen Auftrag',async({page})=>{await login(page);const before=(await db(page)).orders.length;const stop=queueDialogs(page,['Doppelauftrag 18','Wartung','Doppelauftrag 18','Wartung']);await page.evaluate(()=>SH.newOrder(1));await page.evaluate(()=>SH.newOrder(1));stop();const d=await db(page);expect(d.orders.filter(o=>o.title==='Doppelauftrag 18')).toHaveLength(1);expect(d.orders.length).toBe(before+1);});
scenario('ORD-019','Ohne Kunden wird kein Auftrag erzeugt',async({page})=>{await login(page);await mutateDb(page,{},`d.customers=[];d.orders=[];d.reports=[];`);await go(page,'orders');await page.getByRole('button',{name:'+ Auftrag'}).click();expect((await db(page)).orders).toHaveLength(0);});
scenario('ORD-020','Script-Inhalt im Auftragstitel wird escaped',async({page})=>{await login(page);const title='<img src=x onerror=window.__ordxss=1> Auftrag';await createOrderFromSeed(page,title,'Wartung');await go(page,'orders');await expect(page.locator('main')).toContainText(title);await expect(page.locator('img[src="x"]')).toHaveCount(0);expect(await page.evaluate(()=>window.__ordxss||0)).toBe(0);});

scenario('RAP-001','Rapportübersicht zeigt Seed-Rapport',async({page})=>{await login(page,'dome');await go(page,'reports');await expect(page.locator('main')).toContainText('A-2026-0101');});
scenario('RAP-002','Seed-Rapport lässt sich öffnen',async({page})=>{await login(page,'dome');await openSeedReport(page);await expect(page.locator('#rw')).toBeVisible();});
scenario('RAP-003','Einsatzstart setzt Startzeit',async({page})=>{await login(page,'dome');await openSeedReport(page);await page.getByRole('button',{name:'Einsatz starten'}).click();expect((await db(page)).reports[0].start).not.toBe('');});
scenario('RAP-004','Einsatzstart setzt Auftrag In Bearbeitung',async({page})=>{await login(page,'dome');await openSeedReport(page);await page.getByRole('button',{name:'Einsatz starten'}).click();expect((await db(page)).orders[0].status).toBe('In Bearbeitung');});
scenario('RAP-005','Erneuter Einsatzstart überschreibt Startzeit nicht',async({page})=>{await login(page,'dome');await openSeedReport(page);await page.getByRole('button',{name:'Einsatz starten'}).click();const first=(await db(page)).reports[0].start;await page.waitForTimeout(50);await page.getByRole('button',{name:'Einsatz starten'}).click();expect((await db(page)).reports[0].start).toBe(first);});
scenario('RAP-006','Einsatzende setzt Endzeit',async({page})=>{await login(page,'dome');await openSeedReport(page);await page.getByRole('button',{name:'Einsatz beenden'}).click();expect((await db(page)).reports[0].end).not.toBe('');});
const saveTextCases=[['RAP-007','#rw','work','Arbeiten RAP007'],['RAP-008','#rr','result','Ergebnis RAP008']];
for(const [id,sel,key,value] of saveTextCases) scenario(id,`${key} wird zwischengespeichert`,async({page})=>{await login(page,'dome');await openSeedReport(page);await page.locator(sel).fill(value);await page.getByRole('button',{name:'Zwischenspeichern'}).click();expect((await db(page)).reports[0][key]).toBe(value);});
for(const [id,payment] of [['RAP-009','Betrag per EC erhalten'],['RAP-010','Betrag bar erhalten'],['RAP-011','Rechnung wird verschickt']]) scenario(id,`Zahlungsart ${payment} wird gespeichert`,async({page})=>{await login(page,'dome');await openSeedReport(page);await page.locator('#rpay').selectOption({label:payment});await page.getByRole('button',{name:'Zwischenspeichern'}).click();expect((await db(page)).reports[0].payment).toBe(payment);});
scenario('RAP-012','Kundenname im Rapport wird gespeichert',async({page})=>{await login(page,'dome');await openSeedReport(page);await page.locator('#rcname').fill('Erika Rapport');await page.getByRole('button',{name:'Zwischenspeichern'}).click();expect((await db(page)).reports[0].customerName).toBe('Erika Rapport');});
scenario('RAP-013','Rapporttext bleibt nach Modulwechsel erhalten',async({page})=>{await login(page,'dome');await openSeedReport(page);await page.locator('#rw').fill('Navigation persistent');await page.getByRole('button',{name:'Zwischenspeichern'}).click();await go(page,'customers');await openSeedReport(page);await expect(page.locator('#rw')).toHaveValue('Navigation persistent');});
scenario('RAP-014','Rapporttext bleibt nach Reload erhalten',async({page})=>{await login(page,'dome');await openSeedReport(page);await page.locator('#rr').fill('Reload persistent');await page.getByRole('button',{name:'Zwischenspeichern'}).click();await page.reload();await expect(page.locator('header.top')).toBeVisible();await openSeedReport(page);await expect(page.locator('#rr')).toHaveValue('Reload persistent');});
scenario('RAP-015','Rapport ohne Startzeit bleibt offen',async({page})=>{await login(page,'dome');await openSeedReport(page);await page.locator('#rw').fill('Arbeit vorhanden');await page.getByRole('button',{name:'Rapport abschließen'}).click();expect((await db(page)).reports[0].status).toBe('Entwurf');});
scenario('RAP-016','Rapport ohne Arbeiten bleibt offen',async({page})=>{await login(page,'dome');await openSeedReport(page);await page.getByRole('button',{name:'Einsatz starten'}).click();await page.locator('#rw').fill('');await page.getByRole('button',{name:'Rapport abschließen'}).click();expect((await db(page)).reports[0].status).toBe('Entwurf');});
scenario('RAP-017','Rapport ohne Kundennamen bleibt offen',async({page})=>{await login(page,'dome');await openSeedReport(page);await page.getByRole('button',{name:'Einsatz starten'}).click();await page.locator('#rw').fill('Arbeit');await page.locator('#rcname').fill('');await page.getByRole('button',{name:'Rapport abschließen'}).click();expect((await db(page)).reports[0].status).toBe('Entwurf');});
scenario('RAP-018','Rapport ohne Kundenunterschrift bleibt offen',async({page})=>{await login(page,'dome');await openSeedReport(page);await page.getByRole('button',{name:'Einsatz starten'}).click();await page.locator('#rw').fill('Arbeit');await drawSignature(page,'#sigT');await page.getByRole('button',{name:'Rapport abschließen'}).click();expect((await db(page)).reports[0].status).toBe('Entwurf');await expect(page.locator('.ux-v12-toast')).toContainText('Kundenunterschrift');});
scenario('RAP-019','Rapport ohne Technikerunterschrift bleibt offen',async({page})=>{await login(page,'dome');await openSeedReport(page);await page.getByRole('button',{name:'Einsatz starten'}).click();await page.locator('#rw').fill('Arbeit');await drawSignature(page,'#sigC');await page.getByRole('button',{name:'Rapport abschließen'}).click();expect((await db(page)).reports[0].status).toBe('Entwurf');await expect(page.locator('.ux-v12-toast')).toContainText('Technikerunterschrift');});
scenario('RAP-020','Rapport mit beiden Unterschriften wird abgeschlossen',async({page})=>{await login(page,'dome');await openSeedReport(page);await page.getByRole('button',{name:'Einsatz starten'}).click();await page.locator('#rw').fill('Arbeit abgeschlossen');await drawSignature(page,'#sigC');await drawSignature(page,'#sigT');await page.getByRole('button',{name:'Rapport abschließen'}).click();expect((await db(page)).reports[0].status).toBe('Abgeschlossen');});
scenario('RAP-021','Rapportabschluss setzt Auftrag Abgeschlossen',async({page})=>{await login(page,'dome');await openSeedReport(page);await page.getByRole('button',{name:'Einsatz starten'}).click();await page.locator('#rw').fill('Arbeit');await drawSignature(page,'#sigC');await drawSignature(page,'#sigT');await page.getByRole('button',{name:'Rapport abschließen'}).click();expect((await db(page)).orders[0].status).toBe('Abgeschlossen');});
scenario('RAP-022','Rapportabschluss setzt fehlende Endzeit',async({page})=>{await login(page,'dome');await openSeedReport(page);await page.getByRole('button',{name:'Einsatz starten'}).click();await page.locator('#rw').fill('Arbeit');await drawSignature(page,'#sigC');await drawSignature(page,'#sigT');await page.getByRole('button',{name:'Rapport abschließen'}).click();expect((await db(page)).reports[0].end).not.toBe('');});
scenario('RAP-023','Rapportabschluss erzeugt Audit-Eintrag',async({page})=>{await login(page,'dome');await openSeedReport(page);await page.getByRole('button',{name:'Einsatz starten'}).click();await page.locator('#rw').fill('Arbeit');await drawSignature(page,'#sigC');await drawSignature(page,'#sigT');await page.getByRole('button',{name:'Rapport abschließen'}).click();expect((await db(page)).settings.audit[0].text).toContain('abgeschlossen');});
scenario('RAP-024','Abgeschlossener Rapport bleibt nach Reload abgeschlossen',async({page})=>{await login(page,'annette');await setupCompletedReport(page);await page.reload();await expect(page.locator('header.top')).toBeVisible();await openSeedReport(page);expect((await db(page)).reports[0].status).toBe('Abgeschlossen');});
scenario('RAP-025','Erneutes Öffnen erzeugt keinen zweiten Rapport',async({page})=>{await login(page,'dome');const before=(await db(page)).reports.length;await openSeedReport(page);await go(page,'reports');await openSeedReport(page);expect((await db(page)).reports.length).toBe(before);});
scenario('RAP-026','Dome darf Rapport bearbeiten',async({page})=>{await login(page,'dome');await openSeedReport(page);await page.locator('#rw').fill('Dome bearbeitet');await page.getByRole('button',{name:'Zwischenspeichern'}).click();expect((await db(page)).reports[0].work).toBe('Dome bearbeitet');});
scenario('RAP-027','Annette darf Rapport bearbeiten',async({page})=>{await login(page,'annette');await openSeedReport(page);await page.locator('#rw').fill('Annette bearbeitet');await page.getByRole('button',{name:'Zwischenspeichern'}).click();expect((await db(page)).reports[0].work).toBe('Annette bearbeitet');});
scenario('RAP-028','Rapporttext kann per Undo zurückgesetzt werden',async({page})=>{await login(page,'dome');await openSeedReport(page);await page.locator('#rw').fill('Vorher');await page.getByRole('button',{name:'Zwischenspeichern'}).click();await page.locator('#rw').fill('Nachher');await page.getByRole('button',{name:'Zwischenspeichern'}).click();await page.locator('.ux-undo-toast button').click();await expect(page.locator('header.top')).toBeVisible();await openSeedReport(page);await expect(page.locator('#rw')).toHaveValue('Vorher');});

scenario('PRC-001','Verbrauchsmaterial ist keine Leistung',async({page})=>{await login(page,'dome');await openSeedReport(page);await expect(page.locator('#rsvc')).not.toContainText('Verbrauchsmaterial');});
scenario('PRC-002','Messwert-Oberfläche ist entfernt',async({page})=>{await login(page,'dome');await openSeedReport(page);await expect(page.getByRole('button',{name:'+ Messwert'})).toHaveCount(0);});
scenario('PRC-003','Standardpreis Gerätewageneinsatz beträgt 125 Euro',async({page})=>{await login(page,'dome');await openSeedReport(page);await page.locator('#rsvc').selectOption('svc1');await page.locator('#rqty').fill('1');await page.getByRole('button',{name:'+ Leistung'}).click();expect((await db(page)).reports[0].lines[0].price).toBe(125);});
scenario('PRC-004','Menge 1,5 berechnet Position korrekt',async({page})=>{await login(page,'dome');await openSeedReport(page);await page.locator('#rsvc').selectOption('svc1');await page.locator('#rqty').fill('1.5');await page.getByRole('button',{name:'+ Leistung'}).click();await expect(page.locator('.report-lines-card')).toContainText('187,50 €');});
scenario('PRC-005','Kundenspezifischer Preis wird verwendet',async({page})=>{await login(page,'dome');await mutateDb(page,{},`d.customers[0].priceOverrides.svc1=99;`);await openSeedReport(page);await page.locator('#rsvc').selectOption('svc1');await page.getByRole('button',{name:'+ Leistung'}).click();expect((await db(page)).reports[0].lines[0].price).toBe(99);});
scenario('PRC-006','Gespeicherter Rapportpreis bleibt nach Preisänderung unverändert',async({page})=>{await login(page,'dome');await openSeedReport(page);await page.locator('#rsvc').selectOption('svc1');await page.getByRole('button',{name:'+ Leistung'}).click();await mutateDb(page,{},`d.settings.catalog.find(x=>x.id==='svc1').price=200;`);expect((await db(page)).reports[0].lines[0].price).toBe(125);});
scenario('PRC-007','Materialmenge und Einzelpreis werden gespeichert',async({page})=>{await login(page,'dome');await openSeedReport(page);const stop=queueDialogs(page,['Dichtungsring','2','3.50']);await page.getByRole('button',{name:'+ Material'}).click();stop();const m=(await db(page)).reports[0].materials[0];expect(m).toMatchObject({name:'Dichtungsring',qty:2,price:3.5});});
for(const [id,val,msg] of [['PRC-008','-1','größer als 0'],['PRC-009','0','größer als 0']]) scenario(id,`Ungültige Leistungsmenge ${val} wird abgewiesen`,async({page})=>{await login(page,'dome');await openSeedReport(page);await page.locator('#rqty').fill(val);await page.getByRole('button',{name:'+ Leistung'}).click();expect((await db(page)).reports[0].lines).toHaveLength(0);await expect(page.locator('.ux-v12-toast')).toContainText(msg);});
scenario('PRC-010','Nichtnumerische Leistungsmenge wird abgewiesen',async({page})=>{await login(page,'dome');await openSeedReport(page);await page.locator('#rqty').evaluate(el=>{el.value='';});await page.getByRole('button',{name:'+ Leistung'}).click();expect((await db(page)).reports[0].lines).toHaveLength(0);});
scenario('PRC-011','Negative Materialmenge wird abgewiesen',async({page})=>{await login(page,'dome');await openSeedReport(page);const stop=queueDialogs(page,['Bad Menge','-1','2']);await page.getByRole('button',{name:'+ Material'}).click();stop();expect((await db(page)).reports[0].materials).toHaveLength(0);});
scenario('PRC-012','Negativer Materialpreis wird abgewiesen',async({page})=>{await login(page,'dome');await openSeedReport(page);const stop=queueDialogs(page,['Bad Preis','1','-2']);await page.getByRole('button',{name:'+ Material'}).click();stop();expect((await db(page)).reports[0].materials).toHaveLength(0);});
scenario('PRC-013','Leistungslöschung bleibt auf derselben Oberfläche',async({page})=>{await login(page,'dome');await openSeedReport(page);const url=page.url();await page.locator('#rsvc').selectOption('svc9');await page.getByRole('button',{name:'+ Leistung'}).click();page.once('dialog',d=>d.accept());await page.locator('.report-lines-card tr').filter({hasText:'Anfahrt'}).getByRole('button',{name:'Löschen'}).click();await expect(page.locator('.report-lines-card tr').filter({hasText:'Anfahrt'})).toHaveCount(0);expect(page.url()).toBe(url);await expect(page.locator('html')).toHaveAttribute('data-sh-surface-reason','service-remove');});
scenario('PRC-014','Gelöschte Leistung kann per Undo wiederhergestellt werden',async({page})=>{await login(page,'dome');await openSeedReport(page);await page.locator('#rsvc').selectOption('svc1');await page.getByRole('button',{name:'+ Leistung'}).click();page.once('dialog',d=>d.accept());await page.locator('.report-lines-card button.ux-danger-confirm').click();await page.locator('.ux-undo-toast button').click();await expect(page.locator('header.top')).toBeVisible();await openSeedReport(page);await expect(page.locator('.report-lines-card')).toContainText('Gerätewageneinsatz');});
scenario('PRC-015','Materiallöschung bleibt auf derselben Oberfläche',async({page})=>{await login(page,'dome');await openSeedReport(page);const url=page.url();const stop=queueDialogs(page,['Delete Material','1','2']);await page.getByRole('button',{name:'+ Material'}).click();stop();await page.locator('.card').filter({hasText:'Delete Material'}).getByRole('button',{name:'Löschen'}).first().click();await expect(page.getByText(/Delete Material/)).toHaveCount(0);expect(page.url()).toBe(url);});
scenario('PRC-016','Inaktive Katalogleistung wird nicht angeboten',async({page})=>{await login(page,'dome');await mutateDb(page,{},`d.settings.catalog.find(x=>x.id==='svc1').active=false;`);await openSeedReport(page);await expect(page.locator('#rsvc option[value="svc1"]')).toHaveCount(0);});

for(const [id,selector,name] of [['DOC-001','#sigC','Kunde'],['DOC-002','#sigT','Techniker']]) scenario(id,`${name}-Unterschrift kann erfasst werden`,async({page})=>{await login(page,'dome');await openSeedReport(page);await drawSignature(page,selector);expect(await canvasHasInk(page,selector)).toBe(true);});
for(const [id,selector,name] of [['DOC-003','#sigC','Kunde'],['DOC-004','#sigT','Techniker']]) scenario(id,`${name}-Unterschrift kann gelöscht werden`,async({page})=>{await login(page,'dome');await openSeedReport(page);await drawSignature(page,selector);await page.evaluate(sel=>SH.clearSig(sel.slice(1)),selector);expect(await canvasHasInk(page,selector)).toBe(false);});
scenario('DOC-005','Beide Unterschriften bleiben nach Abschluss und Reload erhalten',async({page})=>{await login(page,'dome');await openSeedReport(page);await page.getByRole('button',{name:'Einsatz starten'}).click();await page.locator('#rw').fill('Signaturen speichern');await drawSignature(page,'#sigC');await drawSignature(page,'#sigT');await page.getByRole('button',{name:'Rapport abschließen'}).click();await page.reload();await expect(page.locator('header.top')).toBeVisible();const r=(await db(page)).reports[0];expect(r.sigC).toMatch(/^data:image/);expect(r.sigT).toMatch(/^data:image/);});
scenario('DOC-006','Rapport-Druck enthält Unternehmensdaten',async({page})=>{await login(page,'dome');await openSeedReport(page);await page.evaluate(()=>{window.print=()=>{}});await page.getByRole('button',{name:'PDF / Drucken'}).click();await expect(page.locator('.doc')).toContainText('Rohr- & Kanaltechnik Winser');});
scenario('DOC-007','Rapport-Druck enthält Kunde und Adresse',async({page})=>{await login(page,'dome');await openSeedReport(page);await page.evaluate(()=>{window.print=()=>{}});await page.getByRole('button',{name:'PDF / Drucken'}).click();await expect(page.locator('.doc')).toContainText('Musterkunde Stuttgart GmbH');await expect(page.locator('.doc')).toContainText('Industriestraße 18');});
scenario('DOC-008','Rapport-Druck enthält Arbeiten und Ergebnis',async({page})=>{await login(page,'dome');await mutateDb(page,{},`d.reports[0].work='Dokument Arbeit';d.reports[0].result='Dokument Ergebnis';`);await openSeedReport(page);await page.evaluate(()=>{window.print=()=>{}});await page.getByRole('button',{name:'PDF / Drucken'}).click();await expect(page.locator('.doc')).toContainText('Dokument Arbeit');await expect(page.locator('.doc')).toContainText('Dokument Ergebnis');});
scenario('DOC-009','Rapport-Druck berechnet Netto MwSt Brutto',async({page})=>{await login(page,'dome');await mutateDb(page,{},`d.reports[0].lines=[{catalogId:'svc1',name:'Gerätewageneinsatz',unit:'Std.',qty:1,price:125}];d.reports[0].materials=[{name:'Ring',qty:2,price:3.5}];`);await openSeedReport(page);await page.evaluate(()=>{window.print=()=>{}});await page.getByRole('button',{name:'PDF / Drucken'}).click();await expect(page.locator('.doc-total')).toContainText('132,00 €');await expect(page.locator('.doc-total')).toContainText('25,08 €');await expect(page.locator('.doc-total')).toContainText('157,08 €');});
scenario('DOC-010','Rapport-Druck enthält beide Unterschriften',async({page})=>{await login(page,'dome');await openSeedReport(page);await page.getByRole('button',{name:'Einsatz starten'}).click();await page.locator('#rw').fill('Arbeit');await drawSignature(page,'#sigC');await drawSignature(page,'#sigT');await page.getByRole('button',{name:'Rapport abschließen'}).click();await page.evaluate(()=>{window.print=()=>{}});await page.getByRole('button',{name:'PDF / Drucken'}).click();await expect(page.locator('.doc img[src^="data:image"]')).toHaveCount(2);});
scenario('DOC-011','Zurück aus Rapport-Druck führt zum selben Rapport',async({page})=>{await login(page,'dome');await openSeedReport(page);await page.evaluate(()=>{window.print=()=>{}});await page.getByRole('button',{name:'PDF / Drucken'}).click();await page.getByRole('button',{name:'Zurück'}).click();await expect(page.locator('main h2')).toContainText('Rapport A-2026-0101');});
scenario('DOC-012','Rapport-Dokument ist vollständig im Viewport erreichbar',async({page})=>{await login(page,'dome');await openSeedReport(page);await page.evaluate(()=>{window.print=()=>{}});await page.getByRole('button',{name:'PDF / Drucken'}).click();await expect(page.locator('.doc')).toBeVisible();await page.getByRole('button',{name:'Zurück'}).scrollIntoViewIfNeeded();await expect(page.getByRole('button',{name:'Zurück'})).toBeVisible();const w=await page.locator('.doc').evaluate(el=>({right:el.getBoundingClientRect().right,width:innerWidth}));expect(w.right).toBeLessThanOrEqual(w.width+2);});

scenario('INV-001','Abgeschlossener Rapport kann fakturiert werden',async({page})=>{await login(page);const before=(await db(page)).invoices.length;await generateInvoice(page);expect((await db(page)).invoices.length).toBe(before+1);});
scenario('INV-002','Nicht abgeschlossener Rapport kann nicht fakturiert werden',async({page})=>{await login(page);await openSeedReport(page);const before=(await db(page)).invoices.length;await page.getByRole('button',{name:'Rechnung erzeugen'}).click();expect((await db(page)).invoices.length).toBe(before);await expect(page.locator('.ux-v12-toast')).toContainText('abgeschlossenem Rapport');});
scenario('INV-003','Derselbe Rapport erzeugt keine zweite Rechnung',async({page})=>{await login(page);await generateInvoice(page);const after1=(await db(page)).invoices.length;await openSeedReport(page);await page.getByRole('button',{name:'Rechnung erzeugen'}).click();expect((await db(page)).invoices.length).toBe(after1);});
scenario('INV-004','Neue Rechnungsnummer ist Maximum plus fünf',async({page})=>{await login(page);await mutateDb(page,{},`d.invoices[0].no='26995';`);const iv=await generateInvoice(page);expect(iv.no).toBe('27000');});
scenario('INV-005','Leistungsposition wird übernommen',async({page})=>{await login(page);const iv=await generateInvoice(page,{lines:[{catalogId:'svc1',name:'Leistung INV005',unit:'Std.',qty:2,price:10}]});expect(iv.items.some(x=>x.name==='Leistung INV005'&&x.qty===2)).toBe(true);});
scenario('INV-006','Materialposition wird übernommen',async({page})=>{await login(page);const iv=await generateInvoice(page,{materials:[{name:'Material INV006',qty:3,price:4}]});expect(iv.items.some(x=>x.name==='Material INV006'&&x.qty===3)).toBe(true);});
scenario('INV-007','Rechnungs-Netto wird korrekt berechnet',async({page})=>{await login(page);const iv=await generateInvoice(page,{lines:[{catalogId:'svc1',name:'L',unit:'Std.',qty:2,price:50}],materials:[{name:'M',qty:2,price:10}]});expect(iv.net).toBe(120);});
scenario('INV-008','Mehrwertsteuer wird korrekt berechnet',async({page})=>{await login(page);const iv=await generateInvoice(page,{lines:[{catalogId:'svc1',name:'L',unit:'Std.',qty:1,price:100}]});expect(iv.vat).toBeCloseTo(19,8);});
scenario('INV-009','Bruttobetrag wird korrekt berechnet',async({page})=>{await login(page);const iv=await generateInvoice(page,{lines:[{catalogId:'svc1',name:'L',unit:'Std.',qty:1,price:100}]});expect(iv.gross).toBeCloseTo(119,8);});
scenario('INV-010','Fälligkeit berücksichtigt Zahlungsziel',async({page})=>{await login(page);await mutateDb(page,{},`d.settings.paymentDays=14;`);const iv=await generateInvoice(page);const parse=s=>{const [d,m,y]=s.split('.').map(Number);return Date.UTC(y,m-1,d)};expect(Math.round((parse(iv.due)-parse(iv.date))/86400000)).toBe(14);});
scenario('INV-011','Neue Rechnung startet als Entwurf',async({page})=>{await login(page);const iv=await generateInvoice(page);expect(iv.status).toBe('Entwurf');await expect(page.locator('#ivstatus')).toHaveValue('Entwurf');});
scenario('INV-012','Büro kann Rechnungsentwurf freigeben',async({page})=>{await login(page);await generateInvoice(page);await releaseCurrentInvoice(page);expect((await db(page)).invoices.at(-1).status).toBe('Offen');});
const statusCases=[['INV-013','Bezahlt'],['INV-015','Teilbezahlt'],['INV-016','Überfällig'],['INV-017','Storniert']];
for(const [id,status] of statusCases) scenario(id,`Rechnungsstatus ${status} kann gesetzt werden`,async({page})=>{await login(page);await openSeedInvoice(page);await page.locator('#ivstatus').selectOption(status);await page.getByRole('button',{name:'Status speichern'}).click();expect((await db(page)).invoices[0].status).toBe(status);});
scenario('INV-014','Bezahlt kann wieder auf Offen korrigiert werden',async({page})=>{await login(page);await openSeedInvoice(page);await page.locator('#ivstatus').selectOption('Bezahlt');await page.getByRole('button',{name:'Status speichern'}).click();await page.locator('#ivstatus').selectOption('Offen');await page.getByRole('button',{name:'Status speichern'}).click();expect((await db(page)).invoices[0].status).toBe('Offen');});
scenario('INV-018','Statuswechsel wird historisiert',async({page})=>{await login(page);await openSeedInvoice(page);const before=(await db(page)).invoices[0].history.length;await page.locator('#ivstatus').selectOption('Bezahlt');await page.getByRole('button',{name:'Status speichern'}).click();const iv=(await db(page)).invoices[0];expect(iv.history.length).toBe(before+1);expect(iv.history.at(-1).text).toContain('Offen → Bezahlt');});

async function clickPreferred(page){const card=page.locator('.card').filter({has:page.getByRole('heading',{name:'Versand'})});await card.getByRole('button',{name:'Bevorzugten Kanal verwenden'}).click();}
scenario('COM-001','WhatsApp erzeugt wa.me Übergabe',async({page})=>{await login(page);await setSeedInvoice(page,{customer:{preferredChannel:'WhatsApp'}});await clickPreferred(page);const x=await page.evaluate(()=>SHP_LAST_DELIVERY);expect(x.url).toMatch(/^https:\/\/wa\.me\//);expect(x.url.toLowerCase()).not.toContain('twilio');});
scenario('COM-002','E-Mail erzeugt mailto Übergabe',async({page})=>{await login(page);await setSeedInvoice(page,{customer:{preferredChannel:'E-Mail'}});await clickPreferred(page);expect((await page.evaluate(()=>SHP_LAST_DELIVERY)).url).toMatch(/^mailto:/);});
scenario('COM-003','Post erzeugt Druckübergabe',async({page})=>{await login(page);await setSeedInvoice(page,{customer:{preferredChannel:'Post'}});await clickPreferred(page);expect((await page.evaluate(()=>SHP_LAST_DELIVERY)).url).toBe('print://invoice/26175');});
scenario('COM-004','WhatsApp ohne Telefon wird verhindert',async({page})=>{await login(page);await setSeedInvoice(page,{customer:{preferredChannel:'WhatsApp',phone:''}});await clickPreferred(page);expect(await page.evaluate(()=>SHP_V12.pending())).toBeNull();});
scenario('COM-005','E-Mail ohne gültige Adresse wird verhindert',async({page})=>{await login(page);await setSeedInvoice(page,{customer:{preferredChannel:'E-Mail',email:'ungueltig'}});await clickPreferred(page);expect(await page.evaluate(()=>SHP_V12.pending())).toBeNull();});
scenario('COM-006','Versand aus Entwurf ist gesperrt',async({page})=>{await login(page);await setSeedInvoice(page,{invoice:{status:'Entwurf'},customer:{preferredChannel:'WhatsApp'}});const card=page.locator('.card').filter({has:page.getByRole('heading',{name:'Versand'})});await expect(card.getByRole('button',{name:'Bevorzugten Kanal verwenden'})).toBeDisabled();await page.evaluate(()=>SH.sendInvoice('WhatsApp'));expect(await page.evaluate(()=>SHP_V12.pending())).toBeNull();});
scenario('COM-007','Vorbereitung markiert noch nicht als versendet',async({page})=>{await login(page);await setSeedInvoice(page,{customer:{preferredChannel:'WhatsApp'}});const before=(await db(page)).invoices[0].sentHistory.length;await clickPreferred(page);const iv=(await db(page)).invoices[0];expect(iv.status).toBe('Offen');expect(iv.sentHistory.length).toBe(before);});
scenario('COM-008','Abbruch lässt Rechnung unversendet',async({page})=>{await login(page);await setSeedInvoice(page,{customer:{preferredChannel:'WhatsApp'}});await clickPreferred(page);await page.getByRole('button',{name:'Abbrechen'}).click();expect(await page.evaluate(()=>SHP_V12.pending())).toBeNull();expect((await db(page)).invoices[0].status).toBe('Offen');});
scenario('COM-009','Bestätigung setzt Versendet und Historie',async({page})=>{await login(page);await setSeedInvoice(page,{customer:{preferredChannel:'WhatsApp'}});await clickPreferred(page);await page.getByRole('button',{name:'Versand bestätigen'}).click();const iv=(await db(page)).invoices[0];expect(iv.status).toBe('Versendet');expect(iv.sentHistory.at(-1)).toMatchObject({channel:'WhatsApp',state:'Bestätigt'});expect(iv.history.at(-1).text).toContain('Versand über WhatsApp bestätigt');});
scenario('COM-010','Wiederholte Bestätigung dupliziert Versandhistorie nicht',async({page})=>{await login(page);await setSeedInvoice(page,{customer:{preferredChannel:'WhatsApp'}});await clickPreferred(page);await page.getByRole('button',{name:'Versand bestätigen'}).click();const n=(await db(page)).invoices[0].sentHistory.length;await page.evaluate(()=>SHP_V12.confirmDelivery());expect((await db(page)).invoices[0].sentHistory.length).toBe(n);});

scenario('ADM-001','Administration ist reine Systemkonfiguration',async({page})=>{await login(page,'admin');await go(page,'admin');await expect(page.locator('.ux-admin-title h2')).toHaveText('Administration');await expect(page.getByText('Musterkunde Stuttgart GmbH')).toHaveCount(0);await expect(page.getByText('26175',{exact:true})).toHaveCount(0);});
scenario('ADM-002','Firmenname wird gespeichert',async({page})=>{await login(page,'admin');await saveAdmin(page,{'#adm-companyName':'Winser ADM002'});expect((await db(page)).settings.company.companyName).toBe('Winser ADM002');});
scenario('ADM-003','Mehrwertsteuer wird gespeichert',async({page})=>{await login(page,'admin');await saveAdmin(page,{'#adm-vat':'7'});expect((await db(page)).settings.vat).toBe(7);});
scenario('ADM-004','Zahlungsziel wird gespeichert',async({page})=>{await login(page,'admin');await saveAdmin(page,{'#adm-paymentDays':'21'});expect((await db(page)).settings.paymentDays).toBe(21);});
scenario('ADM-005','Standard-Stundensatz wird gespeichert',async({page})=>{await login(page,'admin');await saveAdmin(page,{'#adm-defaultRate':'95'});expect((await db(page)).settings.defaultHourlyRate).toBe(95);});
scenario('ADM-006','Bank und IBAN werden gespeichert',async({page})=>{await login(page,'admin');await saveAdmin(page,{'#adm-bankName':'Testbank','#adm-iban':'DE001234'});const c=(await db(page)).settings.company;expect(c.bankName).toBe('Testbank');expect(c.iban).toBe('DE001234');});
scenario('ADM-007','Rechnungstexte erscheinen im Rechnungsdokument',async({page})=>{await login(page,'admin');await saveAdmin(page,{'#adm-invoiceIntro':'ADM007 Einleitung','#adm-paymentText':'ADM007 Zahlung','#adm-invoiceFooter':'ADM007 Ende'});await go(page,'invoices');await page.getByRole('button',{name:'26175'}).first().click();await page.evaluate(()=>{window.print=()=>{}});await page.getByRole('button',{name:'PDF / Drucken'}).click();await expect(page.locator('.invoice-doc-v6')).toContainText('ADM007 Einleitung');await expect(page.locator('.invoice-doc-v6')).toContainText('ADM007 Zahlung');await expect(page.locator('.invoice-doc-v6')).toContainText('ADM007 Ende');});
scenario('ADM-008','Kommunikations- und Absendereinstellungen werden gespeichert',async({page})=>{await login(page,'admin');await go(page,'admin');await expect(page.locator('.ux-v12-delivery-settings')).toBeVisible();await page.locator('#adm-waNumber').fill('0711 12345');await page.locator('#adm-emailReplyTo').fill('reply@example.de');await page.locator('#adm-postSender').fill('Winser · Testweg 1');await page.getByRole('button',{name:'Kommunikation speichern'}).click();const d=(await db(page)).settings.delivery;expect(d).toMatchObject({whatsappNumber:'0711 12345',emailReplyTo:'reply@example.de',postSender:'Winser · Testweg 1'});});

if (DEFINED !== 148) throw new Error(`Frontend-Fachtestkatalog muss exakt 148 Szenarien enthalten, ist aber ${DEFINED}.`);
