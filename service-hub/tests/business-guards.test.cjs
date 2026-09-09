const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { harness } = require('./business-harness.cjs');

function loadGuards(h) {
  vm.runInContext(fs.readFileSync(path.join(h.root, 'ux-v21-business-guards.js'), 'utf8'), h.context);
  return h.context.SHP_BUSINESS_GUARDS;
}
function addService(h, qty = '1') {
  h.set('rsvc', 'svc1'); h.set('rqty', qty); h.context.SH.addReportLine();
}
function completionData(h) {
  h.context.SHP_REPORT_BRIDGE.saveDraft({ start: '09:00', end: '10:00', work: 'QA abgeschlossen', customerName: 'Testkunde' });
}
function fakeCanvas(initialInk) {
  let ink = initialInk;
  const ctx = {
    getImageData() {
      const data = new Uint8ClampedArray(16 * 4);
      if (ink) for (let i = 0; i < 16; i++) { data[i * 4] = 20; data[i * 4 + 1] = 20; data[i * 4 + 2] = 20; data[i * 4 + 3] = 255; }
      return { data };
    },
    clearRect() { ink = false; }
  };
  return { width: 4, height: 4, dataset: {}, getContext() { return ctx; }, toDataURL() { return ink ? 'data:image/png;base64,SIGNED' : 'data:image/png;base64,BLANK'; } };
}
function sign(h, customer = true, tech = true) {
  h.fields.sigC = fakeCanvas(customer);
  h.fields.sigT = fakeCanvas(tech);
}

for (const [customer, tech, label] of [[false, false, 'both empty'], [true, false, 'technician empty'], [false, true, 'customer empty']]) {
  test('rapport completion rejects ' + label + ' signature canvas', async () => {
    const h = await harness(); loadGuards(h); h.createOrder(); addService(h); completionData(h); sign(h, customer, tech);
    const result = h.context.SH.finishReport();
    assert.equal(result, false);
    assert.notEqual(h.report().status, 'Abgeschlossen');
    assert.ok(h.notices.some(n => /tatsächlich unterschrieben/.test(n.textContent || '')));
  });
}

test('rapport completion accepts actual customer and technician signatures', async () => {
  const h = await harness(); loadGuards(h); h.createOrder(); addService(h); completionData(h); sign(h, true, true);
  h.context.SH.finishReport();
  assert.equal(h.report().status, 'Abgeschlossen');
  assert.match(h.report().sigC, /SIGNED/);
  assert.match(h.report().sigT, /SIGNED/);
});

test('post-completion material change archives signed state and requires fresh signatures', async () => {
  const h = await harness(); loadGuards(h); const report = h.createOrder(); addService(h); completionData(h); sign(h, true, true); h.context.SH.finishReport();
  const signed = h.report().sigC;
  h.prompts.push('Neue Dichtung', '1', '7.50'); h.context.SH.addMaterial();
  const changed = h.report();
  assert.equal(changed.status, 'Entwurf');
  assert.equal(changed.sigC, '');
  assert.equal(changed.sigT, '');
  assert.equal(changed.revisions.length, 1);
  assert.equal(changed.revisions[0].sigC, signed);
  assert.equal(changed.revisions[0].state.materials.length, 0);
  assert.equal(h.getDb().orders.find(o => o.id === report.orderId).status, 'In Bearbeitung');
});

test('editing text on an already completed rapport and pressing finish forces re-signing', async () => {
  const h = await harness(); loadGuards(h); h.createOrder(); addService(h); completionData(h); sign(h, true, true); h.context.SH.finishReport();
  h.set('rw', 'Nachträglich geänderter Text'); h.set('rr', 'Ergebnis'); h.set('rpay', 'Rechnung wird verschickt'); h.set('rcname', 'Testkunde');
  const result = h.context.SH.finishReport();
  assert.equal(result, false);
  assert.equal(h.report().status, 'Entwurf');
  assert.equal(h.report().work, 'Nachträglich geänderter Text');
  assert.equal(h.report().sigC, '');
  assert.equal(h.report().revisions.length, 1);
});

test('missing invoice email blocks handoff and does not create dispatch history', async () => {
  const h = await harness(); loadGuards(h); h.createOrder(); addService(h); completionData(h); sign(h, true, true); h.context.SH.finishReport(); h.context.SH.invoiceFromReport();
  const bridge = h.context.SHP_DATA_BRIDGE, db = bridge.readDb(), iv = bridge.currentInvoice();
  db.customers.find(c => c.id === iv.customerId).email = ''; bridge.save();
  const before = iv.sentHistory.length;
  const result = h.context.SH.sendInvoice('E-Mail');
  assert.equal(result, false);
  assert.equal(iv.sentHistory.length, before);
  assert.equal(h.external.filter(x => x.kind === 'navigate' && /^mailto:/.test(x.url)).length, 0);
});

test('0049, +49 and national German phone formats normalize to the same WhatsApp target', async () => {
  const h = await harness(); const guards = loadGuards(h);
  assert.equal(guards.normalizePhone('0049 152 23401628'), '4915223401628');
  assert.equal(guards.normalizePhone('+49 152 23401628'), '4915223401628');
  assert.equal(guards.normalizePhone('0152 23401628'), '4915223401628');
});

test('invoice WhatsApp handoff uses normalized 0049 phone number', async () => {
  const h = await harness(); loadGuards(h); h.context.SH.openInvoice(801);
  const bridge = h.context.SHP_DATA_BRIDGE, db = bridge.readDb(); db.customers[0].phone = '0049 152 23401628'; bridge.save();
  assert.equal(h.context.SH.sendInvoice('WhatsApp'), true);
  const nav = h.external.find(x => x.kind === 'navigate' && /^https:\/\/wa\.me\//.test(x.url));
  assert.ok(nav);
  assert.match(nav.url, /^https:\/\/wa\.me\/4915223401628\?/);
});

test('overdue partial payment uses remaining amount in action-required totals', async () => {
  const h = await harness(); const guards = loadGuards(h), bridge = h.context.SHP_DATA_BRIDGE, db = bridge.readDb(), iv = db.invoices[0];
  iv.status = 'Teilbezahlt'; iv.gross = 100; iv.due = '01.01.2020'; bridge.save();
  h.localStorage.setItem('shp_invoice_payment_meta', JSON.stringify({ [String(iv.id)]: { stage: 'Keine', history: [], paidAmount: 40 } }));
  const state = guards.paymentState(iv), totals = guards.stats(db);
  assert.equal(state.key, 'overdue');
  assert.equal(state.openAmount, 60);
  assert.equal(totals.overdue, 1);
  assert.equal(totals.overdueAmount, 60);
  assert.equal(totals.openAmount, 60);
});

test('paid invoice rejects a new reminder stage while preserving prior metadata', async () => {
  const h = await harness(); const guards = loadGuards(h), bridge = h.context.SHP_DATA_BRIDGE, db = bridge.readDb(), iv = db.invoices[0];
  iv.status = 'Bezahlt'; bridge.save();
  h.localStorage.setItem('shp_invoice_payment_meta', JSON.stringify({ [String(iv.id)]: { stage: 'Zahlungserinnerung', history: [{ text: 'bestehend' }] } }));
  h.fields['crm-payment-stage-' + iv.id] = { value: '1. Mahnung' };
  assert.equal(guards.saveStage(iv.id), false);
  const meta = JSON.parse(h.localStorage.getItem('shp_invoice_payment_meta'))[String(iv.id)];
  assert.equal(meta.stage, 'Zahlungserinnerung');
  assert.equal(meta.history.length, 1);
});

test('native share cancellation is classified separately from PDF creation errors', async () => {
  const h = await harness(); const guards = loadGuards(h);
  assert.equal(guards.isShareAbort({ name: 'AbortError', message: 'Share canceled' }), true);
  assert.equal(guards.isShareAbort(new Error('PDF build failed')), false);
});
