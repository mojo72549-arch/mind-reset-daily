const { test, expect } = require('@playwright/test');

async function login(page){await page.goto('/?role=annette');await page.getByRole('button',{name:'Anmelden'}).click();await expect(page.locator('header.top')).toBeVisible()}
async function db(page){return page.evaluate(()=>JSON.parse(localStorage.getItem('shp_db')))}
async function go(page,t){await page.evaluate(x=>SH.go(x),t)}
async function dialogs(page,answers){const q=[...answers],alerts=[];const h=async d=>{if(d.type()==='prompt')await d.accept(q.shift()??'');else{alerts.push(d.message());await d.accept()}};page.on('dialog',h);return{alerts,off:()=>page.off('dialog',h)}}

test('NEG customer without address is rejected',async({page})=>{await login(page);await go(page,'customers');const before=(await db(page)).customers.length;const x=await dialogs(page,['Ohne Adresse GmbH','','Kontakt','07111234567','mail@test.de','70','E-Mail']);await page.getByRole('button',{name:'+ Kunde'}).click();x.off();await expect.poll(()=>x.alerts.join(' ')).toContain('Adresse');expect((await db(page)).customers.length).toBe(before)});

test('NEG invalid hourly rate is rejected',async({page})=>{await login(page);await go(page,'customers');const before=(await db(page)).customers.length;const x=await dialogs(page,['Rate Fehler GmbH','Teststraße 5','Kontakt','07111234567','mail@test.de','keine-zahl','E-Mail']);await page.getByRole('button',{name:'+ Kunde'}).click();x.off();await expect.poll(()=>x.alerts.join(' ')).toContain('Stundensatz');expect((await db(page)).customers.length).toBe(before)});

test('NEG preferred email channel without email is rejected',async({page})=>{await login(page);await go(page,'customers');const before=(await db(page)).customers.length;const x=await dialogs(page,['Ohne Mail GmbH','Teststraße 6','Kontakt','07111234567','','70','E-Mail']);await page.getByRole('button',{name:'+ Kunde'}).click();x.off();await expect.poll(()=>x.alerts.join(' ')).toContain('gültige E-Mail-Adresse');expect((await db(page)).customers.length).toBe(before)});

test('NEG order without type is rejected',async({page})=>{await login(page);await go(page,'customers');await page.getByRole('button',{name:'Kunde öffnen'}).first().click();const before=(await db(page)).orders.length;const x=await dialogs(page,['Auftrag ohne Art','']);await page.getByRole('button',{name:'+ Auftrag'}).first().click();x.off();await expect.poll(()=>x.alerts.join(' ')).toContain('Auftragsart');expect((await db(page)).orders.length).toBe(before)});

test('NEG editing a customer into an existing duplicate is rejected',async({page})=>{
  await login(page);
  await page.evaluate(()=>{const d=JSON.parse(localStorage.getItem('shp_db'));d.customers.push({id:2,name:'Zweiter Kunde GmbH',contact:'Zwei',phone:'0711999888',email:'zwei@test.de',address:'Andere Straße 2, Stuttgart',hourlyRate:70,preferredChannel:'E-Mail',priceOverrides:{},serviceInterval:'',nextService:''});SHP_INTERNAL.setDb(d)});
  const before=await db(page);const x=await dialogs(page,['Musterkunde Stuttgart GmbH','Industriestraße 18, 70469 Stuttgart','Zwei','0711999888','zwei@test.de','70','E-Mail']);await page.evaluate(()=>SH.editCustomer(2));x.off();await expect.poll(()=>x.alerts.join(' ')).toContain('existiert bereits');const after=await db(page);const c=after.customers.find(v=>v.id===2);expect(c.name).toBe('Zweiter Kunde GmbH');expect(c.address).toContain('Andere Straße');expect(after.customers.length).toBe(before.customers.length)
});
