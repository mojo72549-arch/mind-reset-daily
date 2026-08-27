const { test, expect } = require('@playwright/test');

async function login(page, role='annette') {
  await page.addInitScript(() => { window.__SHP_TEST_MODE__ = true; });
  await page.goto(`/?role=${role}`);
  await page.getByRole('button', { name: 'Anmelden' }).click();
  await expect(page.locator('header.top')).toBeVisible();
}
async function go(page, tab){ await page.evaluate(t => SH.go(t), tab); }
async function db(page){ return page.evaluate(() => JSON.parse(localStorage.getItem('shp_db'))); }
async function setDb(page, mutatorSource){ await page.evaluate(src => { const d=JSON.parse(localStorage.getItem('shp_db')); (0,eval)(src)(d); SHP_INTERNAL.setDb(d); SHP_INTERNAL.render(); }, mutatorSource); }
async function dialogs(page, answers){
  const queue=[...answers], alerts=[];
  page.on('dialog', async d => { if(d.type()==='prompt') await d.accept(queue.shift() ?? ''); else { alerts.push(d.message()); await d.accept(); } });
  return alerts;
}
async function openSeedReport(page){ await go(page,'reports'); await page.getByRole('button',{name:'Rapport öffnen'}).first().click(); }
async function realDraw(page, selector){
  const c=page.locator(selector); await c.scrollIntoViewIfNeeded(); const box=await c.boundingBox(); expect(box).toBeTruthy();
  const touch=await page.evaluate(()=>navigator.maxTouchPoints>0);
  if(touch){
    await page.evaluate(sel=>{const c=document.querySelector(sel),r=c.getBoundingClientRect(),pts=[[20,30],[60,60],[100,35],[145,70],[190,40]];const mk=([x,y])=>new Touch({identifier:9,target:c,clientX:r.left+x,clientY:r.top+y,pageX:scrollX+r.left+x,pageY:scrollY+r.top+y,screenX:r.left+x,screenY:r.top+y,radiusX:2,radiusY:2,force:.7});const fire=(type,p,on)=>{const t=mk(p);c.dispatchEvent(new TouchEvent(type,{bubbles:true,cancelable:true,touches:on?[t]:[],targetTouches:on?[t]:[],changedTouches:[t]}))};fire('touchstart',pts[0],true);pts.slice(1).forEach(p=>fire('touchmove',p,true));fire('touchend',pts.at(-1),false)},selector);
  }else{ await page.mouse.move(box.x+20,box.y+30); await page.mouse.down(); await page.mouse.move(box.x+80,box.y+65,{steps:8}); await page.mouse.move(box.x+160,box.y+35,{steps:8}); await page.mouse.up(); }
}

// CUSTOMER VALIDATION

test('POS customer with complete WhatsApp data is created', async ({page})=>{
  await login(page); await go(page,'customers'); const before=(await db(page)).customers.length;
  await dialogs(page,['Positiv Kunde GmbH','Positivstraße 1, 70173 Stuttgart','Max Positiv','01701234567','info@positiv.de','85','WhatsApp']);
  await page.getByRole('button',{name:'+ Kunde'}).click();
  const d=await db(page); expect(d.customers.length).toBe(before+1); expect(d.customers.at(-1).preferredChannel).toBe('WhatsApp');
  await expect(page.locator('main h2')).toHaveText('Positiv Kunde GmbH');
});

test('NEG duplicate customer is rejected and database stays unchanged', async ({page})=>{
  await login(page); await go(page,'customers'); const before=await db(page); const alerts=await dialogs(page,['Musterkunde Stuttgart GmbH','Industriestraße 18, 70469 Stuttgart','Thomas Berger','0711 555123','t.berger@example.de','72','WhatsApp']);
  await page.getByRole('button',{name:'+ Kunde'}).click();
  await expect.poll(()=>alerts.join(' ')).toContain('existiert bereits'); const after=await db(page); expect(after.customers.length).toBe(before.customers.length);
});

test('NEG customer without name is rejected', async ({page})=>{
  await login(page); await go(page,'customers'); const before=(await db(page)).customers.length; const alerts=await dialogs(page,['','Teststraße 1','Kontakt','07111234567','a@b.de','70','E-Mail']);
  await page.getByRole('button',{name:'+ Kunde'}).click(); await expect.poll(()=>alerts.join(' ')).toContain('Kundenname'); expect((await db(page)).customers.length).toBe(before);
});

test('NEG WhatsApp customer without phone is rejected', async ({page})=>{
  await login(page); await go(page,'customers'); const before=(await db(page)).customers.length; const alerts=await dialogs(page,['Ohne Telefon GmbH','Teststraße 2','Kontakt','','mail@test.de','70','WhatsApp']);
  await page.getByRole('button',{name:'+ Kunde'}).click(); await expect.poll(()=>alerts.join(' ')).toContain('Telefonnummer'); expect((await db(page)).customers.length).toBe(before);
});

test('NEG email customer with invalid email is rejected', async ({page})=>{
  await login(page); await go(page,'customers'); const before=(await db(page)).customers.length; const alerts=await dialogs(page,['Mail Fehler GmbH','Teststraße 3','Kontakt','07111234567','keine-mail','70','E-Mail']);
  await page.getByRole('button',{name:'+ Kunde'}).click(); await expect.poll(()=>alerts.join(' ')).toContain('E-Mail-Adresse'); expect((await db(page)).customers.length).toBe(before);
});

test('NEG unknown preferred channel is rejected', async ({page})=>{
  await login(page); await go(page,'customers'); const before=(await db(page)).customers.length; const alerts=await dialogs(page,['Kanal Fehler GmbH','Teststraße 4','Kontakt','07111234567','mail@test.de','70','Fax']);
  await page.getByRole('button',{name:'+ Kunde'}).click(); await expect.poll(()=>alerts.join(' ')).toContain('WhatsApp, E-Mail oder Post'); expect((await db(page)).customers.length).toBe(before);
});

// ORDER VALIDATION

test('POS valid order is created for selected customer', async ({page})=>{
  await login(page); await go(page,'customers'); await page.getByRole('button',{name:'Kunde öffnen'}).first().click(); const before=(await db(page)).orders.length; await dialogs(page,['Positivauftrag','Wartung']);
  await page.getByRole('button',{name:'+ Auftrag'}).first().click(); expect((await db(page)).orders.length).toBe(before+1); await expect(page.locator('main h2')).toContainText('Rapport A-');
});

test('NEG order with invalid customer id is rejected', async ({page})=>{
  await login(page); const before=(await db(page)).orders.length; let msg=''; page.once('dialog',async d=>{msg=d.message();await d.accept()}); await page.evaluate(()=>SH.newOrder(999999999)); await expect.poll(()=>msg).toContain('Kunde wurde nicht gefunden'); expect((await db(page)).orders.length).toBe(before);
});

test('NEG order without title is rejected', async ({page})=>{
  await login(page); await go(page,'customers'); await page.getByRole('button',{name:'Kunde öffnen'}).first().click(); const before=(await db(page)).orders.length; const alerts=await dialogs(page,['','Wartung']);
  await page.getByRole('button',{name:'+ Auftrag'}).first().click(); await expect.poll(()=>alerts.join(' ')).toContain('Auftragsbezeichnung'); expect((await db(page)).orders.length).toBe(before);
});

test('NEG order cannot be created when no customer exists', async ({page})=>{
  await login(page); await setDb(page,'d=>{d.customers=[];d.orders=[];d.reports=[]}'); let msg=''; page.once('dialog',async d=>{msg=d.message();await d.accept()}); await page.evaluate(()=>SH.newOrder()); await expect.poll(()=>msg).toContain('Zuerst muss ein Kunde'); expect((await db(page)).orders.length).toBe(0);
});

// RAPPORT VALIDATION

test('NEG rapport without signatures cannot be completed', async ({page})=>{
  await login(page); await openSeedReport(page); await page.getByRole('button',{name:'Einsatz starten'}).click(); await page.locator('#rw').fill('Arbeit durchgeführt'); await page.getByRole('button',{name:'Zwischenspeichern'}).click(); let msg=''; page.once('dialog',async d=>{msg=d.message();await d.accept()}); await page.getByRole('button',{name:'Rapport abschließen'}).click(); await expect.poll(()=>msg).toContain('Kundenunterschrift'); expect((await db(page)).reports[0].status).not.toBe('Abgeschlossen');
});

test('NEG a simple tap does not count as a signature', async ({page})=>{
  await login(page); await openSeedReport(page); await page.getByRole('button',{name:'Einsatz starten'}).click(); await page.locator('#rw').fill('Arbeit durchgeführt'); await page.getByRole('button',{name:'Zwischenspeichern'}).click(); const c=page.locator('#sigC'); const b=await c.boundingBox(); await page.mouse.click(b.x+40,b.y+40); let msg=''; page.once('dialog',async d=>{msg=d.message();await d.accept()}); await page.getByRole('button',{name:'Rapport abschließen'}).click(); await expect.poll(()=>msg).toContain('Kundenunterschrift');
});

test('NEG only customer signature is insufficient', async ({page})=>{
  await login(page); await openSeedReport(page); await page.getByRole('button',{name:'Einsatz starten'}).click(); await page.locator('#rw').fill('Arbeit durchgeführt'); await page.getByRole('button',{name:'Zwischenspeichern'}).click(); await realDraw(page,'#sigC'); let msg=''; page.once('dialog',async d=>{msg=d.message();await d.accept()}); await page.getByRole('button',{name:'Rapport abschließen'}).click(); await expect.poll(()=>msg).toContain('Technikerunterschrift'); expect((await db(page)).reports[0].status).not.toBe('Abgeschlossen');
});

test('POS both real signatures allow rapport completion', async ({page})=>{
  await login(page); await openSeedReport(page); await page.getByRole('button',{name:'Einsatz starten'}).click(); await page.locator('#rw').fill('Arbeit vollständig durchgeführt'); await page.getByRole('button',{name:'Zwischenspeichern'}).click(); await realDraw(page,'#sigC'); await realDraw(page,'#sigT'); await page.getByRole('button',{name:'Rapport abschließen'}).click(); expect((await db(page)).reports[0].status).toBe('Abgeschlossen');
});

// INVOICE / DELIVERY VALIDATION

test('NEG invoice cannot be created from unfinished rapport', async ({page})=>{
  await login(page); await openSeedReport(page); const before=(await db(page)).invoices.length; let msg=''; page.once('dialog',async d=>{msg=d.message();await d.accept()}); await page.getByRole('button',{name:'Rechnung erzeugen'}).click(); await expect.poll(()=>msg).toContain('abgeschlossenem Rapport'); expect((await db(page)).invoices.length).toBe(before);
});

test('NEG duplicate invoice for same rapport is prevented', async ({page})=>{
  await login(page); await setDb(page,"d=>{d.reports[0].status='Abgeschlossen';d.reports[0].lines=[{catalogId:'svc1',name:'Gerätewageneinsatz',qty:1,unit:'Std.',price:125}]}" ); await openSeedReport(page); const before=(await db(page)).invoices.length; await page.getByRole('button',{name:'Rechnung erzeugen'}).click(); const once=(await db(page)).invoices.length; expect(once).toBe(before+1); await page.evaluate(()=>{SHP_INTERNAL.setSelectedOrder(101);SHP_INTERNAL.setTab('report');SHP_INTERNAL.render()}); await page.getByRole('button',{name:'Rechnung erzeugen'}).click(); expect((await db(page)).invoices.length).toBe(once);
});

test('NEG draft invoice cannot be sent', async ({page})=>{
  await login(page); await go(page,'invoices'); await page.getByRole('button',{name:'26175'}).first().click(); await setDb(page,"d=>{d.invoices[0].status='Entwurf'}"); await go(page,'invoices'); await page.getByRole('button',{name:'26175'}).first().click(); await expect(page.getByRole('button',{name:'WhatsApp',exact:true})).toBeDisabled(); expect(await page.evaluate(()=>sessionStorage.getItem('shp_pending_delivery_v10'))).toBeNull();
});

test('NEG WhatsApp delivery without customer phone is rejected', async ({page})=>{
  await login(page); await setDb(page,"d=>{d.customers[0].phone='';d.invoices[0].status='Offen'}"); await go(page,'invoices'); await page.getByRole('button',{name:'26175'}).first().click(); let msg=''; page.once('dialog',async d=>{msg=d.message();await d.accept()}); await page.getByRole('button',{name:'WhatsApp',exact:true}).click(); await expect.poll(()=>msg).toContain('Telefonnummer'); expect(await page.evaluate(()=>sessionStorage.getItem('shp_pending_delivery_v10'))).toBeNull();
});

test('NEG email delivery without customer email is rejected', async ({page})=>{
  await login(page); await setDb(page,"d=>{d.customers[0].email='';d.invoices[0].status='Offen'}"); await go(page,'invoices'); await page.getByRole('button',{name:'26175'}).first().click(); let msg=''; page.once('dialog',async d=>{msg=d.message();await d.accept()}); await page.getByRole('button',{name:'E-Mail',exact:true}).click(); await expect.poll(()=>msg).toContain('E-Mail-Adresse'); expect(await page.evaluate(()=>sessionStorage.getItem('shp_pending_delivery_v10'))).toBeNull();
});

test('NEG post delivery without address is rejected', async ({page})=>{
  await login(page); await setDb(page,"d=>{d.customers[0].address='';d.invoices[0].status='Offen'}"); await go(page,'invoices'); await page.getByRole('button',{name:'26175'}).first().click(); let msg=''; page.once('dialog',async d=>{msg=d.message();await d.accept()}); await page.getByRole('button',{name:'Post / Druck'}).click(); await expect.poll(()=>msg).toContain('Postanschrift'); expect(await page.evaluate(()=>sessionStorage.getItem('shp_pending_delivery_v10'))).toBeNull();
});

test('NEG cancelled invoice cannot be sent', async ({page})=>{
  await login(page); await setDb(page,"d=>{d.invoices[0].status='Storniert'}"); await go(page,'invoices'); await page.getByRole('button',{name:'26175'}).first().click(); let msg=''; page.once('dialog',async d=>{msg=d.message();await d.accept()}); await page.getByRole('button',{name:'WhatsApp',exact:true}).click(); await expect.poll(()=>msg).toContain('Stornierte Rechnungen'); expect(await page.evaluate(()=>sessionStorage.getItem('shp_pending_delivery_v10'))).toBeNull();
});

test('NEG prepared delivery cancelled by user does not mark invoice as sent', async ({page})=>{
  await login(page); await go(page,'invoices'); await page.getByRole('button',{name:'26175'}).first().click(); await page.getByRole('button',{name:'WhatsApp',exact:true}).click(); await expect(page.locator('.ux-v10-pending')).toHaveCount(1); await page.getByRole('button',{name:'Verwerfen'}).click(); expect((await db(page)).invoices[0].status).toBe('Offen'); expect(await page.evaluate(()=>sessionStorage.getItem('shp_pending_delivery_v10'))).toBeNull();
});

// ADMIN VALIDATION

test('NEG invalid admin email is not saved', async ({page})=>{
  await login(page,'admin'); await go(page,'admin'); const before=(await db(page)).settings.delivery?.emailReplyTo || ''; await page.locator('#adm-emailReplyTo').fill('ungueltig'); let msg=''; page.once('dialog',async d=>{msg=d.message();await d.accept()}); await page.getByRole('button',{name:'Einstellungen speichern'}).click(); await expect.poll(()=>msg).toContain('Antwortadresse'); const after=(await db(page)).settings.delivery?.emailReplyTo || ''; expect(after).toBe(before);
});

test('NEG invalid admin WhatsApp number is not saved', async ({page})=>{
  await login(page,'admin'); await go(page,'admin'); const before=(await db(page)).settings.delivery?.whatsappNumber || ''; await page.locator('#adm-waNumber').fill('12'); let msg=''; page.once('dialog',async d=>{msg=d.message();await d.accept()}); await page.getByRole('button',{name:'Einstellungen speichern'}).click(); await expect.poll(()=>msg).toContain('WhatsApp-Geschäftsnummer'); const after=(await db(page)).settings.delivery?.whatsappNumber || ''; expect(after).toBe(before);
});
