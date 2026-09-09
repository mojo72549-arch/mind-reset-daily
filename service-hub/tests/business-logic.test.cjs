const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { harness } = require('./business-harness.cjs');

function addService(h, qty = '2') {
  h.set('rsvc', 'svc1'); h.set('rqty', qty); h.context.SH.addReportLine();
}
function addMaterial(h, name = 'QA Dichtung <DN50>', qty = '3', price = '4.50') {
  h.prompts.push(name, qty, price); h.context.SH.addMaterial();
}
function completionData(h) {
  h.context.SHP_REPORT_BRIDGE.saveDraft({ start: '09:00', end: '10:00', work: 'QA abgeschlossen', customerName: 'Testkunde' });
}
function overview(h) {
  return h.app.innerHTML.split('<h3>Leistungen im Rapport</h3>')[1].split('</table>')[0];
}

test('material is visible with quantity, price and total before both signature fields', async () => {
  const h = await harness(); h.createOrder(); addService(h); addMaterial(h);
  const table = overview(h);
  assert.match(table, /QA Dichtung &lt;DN50&gt;/);
  assert.equal((h.app.innerHTML.match(/QA Dichtung &lt;DN50&gt;/g) || []).length, 1);
  assert.match(table, /<td>Stk\.<\/td><td>3<\/td><td>4,50 €<\/td><td>13,50 €<\/td>/);
  assert.ok(h.app.innerHTML.indexOf('data-report-material-row') < h.app.innerHTML.indexOf('id="sigC"'));
  assert.ok(h.app.innerHTML.indexOf('data-report-material-row') < h.app.innerHTML.indexOf('id="sigT"'));
});

test('material-only reports show the material overview', async () => {
  const h = await harness(); h.createOrder(); addMaterial(h, 'QA Ersatzteil', '1', '9');
  assert.match(overview(h), /QA Ersatzteil/);
  assert.match(overview(h), /9,00 €/);
});

test('deleting and undoing a material restores the same material and totals', async () => {
  const h = await harness({ undo: true }); h.createOrder(); addMaterial(h);
  const before = h.localStorage.getItem('shp_db');
  h.context.SH.removeMaterial(0);
  assert.equal(h.report().materials.length, 0);
  assert.doesNotMatch(overview(h), /QA Dichtung/);
  h.context.SHP_UX_TEST_API.undoLast();
  assert.equal(h.localStorage.getItem('shp_db'), before);
  assert.equal(h.getDb().reports.find(r => r.orderId === h.report().orderId).materials[0].price, 4.5);
});

test('cancelling material deletion preserves the record and overview', async () => {
  const h = await harness({ undo: true, confirm: false }); h.createOrder(); addMaterial(h);
  const before = h.localStorage.getItem('shp_db'); h.context.SH.removeMaterial(0);
  assert.equal(h.localStorage.getItem('shp_db'), before);
  assert.match(overview(h), /QA Dichtung/);
});

test('material quantity and service prices are each counted once in the invoice', async () => {
  const h = await harness(); const r = h.createOrder(); addService(h); addMaterial(h);
  completionData(h); h.context.SH.finishReport(); h.context.SH.invoiceFromReport();
  const iv = h.getDb().invoices.find(i => i.reportId === r.id);
  assert.equal(iv.items.length, 2);
  assert.equal(iv.net, 263.5);
  assert.equal(iv.vat, 50.07);
  assert.equal(iv.gross, 313.57);
});

test('a repeated invoice action reopens the existing active invoice', async () => {
  const h = await harness(); const r = h.createOrder(); addService(h); completionData(h);
  h.context.SH.finishReport(); h.context.SH.invoiceFromReport(); h.context.SH.openReport(r.orderId); h.context.SH.invoiceFromReport();
  assert.equal(h.getDb().invoices.filter(i => i.reportId === r.id).length, 1);
});

test('a cancelled invoice allows an explicit replacement with a new number', async () => {
  const h = await harness(); const r = h.createOrder(); addService(h); completionData(h);
  h.context.SH.finishReport(); h.context.SH.invoiceFromReport();
  const first = h.getDb().invoices.find(i => i.reportId === r.id);
  h.set('ivstatus', 'Storniert'); h.context.SH.saveInvoiceStatus();
  h.context.SH.openReport(r.orderId); h.context.SH.invoiceFromReport();
  const list = h.getDb().invoices.filter(i => i.reportId === r.id);
  assert.equal(list.length, 2);
  assert.equal(list[0].status, 'Storniert');
  assert.notEqual(list[1].no, first.no);
});

for (const quantity of ['-1', '0', 'NaN', 'Infinity', '']) {
  test('service quantity rejects ' + JSON.stringify(quantity) + ' without data loss', async () => {
    const h = await harness(); h.createOrder(); addService(h, quantity);
    assert.equal(h.report().lines.length, 0);
    assert.ok(h.notices.some(n => /Menge/.test(n.innerHTML)));
  });
}

test('fractional service quantity remains supported', async () => {
  const h = await harness(); h.createOrder(); addService(h, '0.25');
  assert.equal(h.report().lines[0].qty, 0.25);
});

test('undo cannot erase an invoice and its dispatch history after handoff', async () => {
  const h = await harness({ undo: true }); h.createOrder(); addService(h); completionData(h);
  h.context.SH.finishReport(); h.context.SH.invoiceFromReport();
  h.context.SH.sendInvoice('E-Mail');
  const beforeUndo = h.localStorage.getItem('shp_db');
  h.context.SHP_UX_TEST_API.undoLast();
  assert.equal(h.localStorage.getItem('shp_db'), beforeUndo);
  assert.ok(h.external.some(e => e.kind === 'alert' && /Versandhistorie/.test(e.message)));
});

test('a later internal status change remains undoable without removing dispatch history', async () => {
  const h = await harness({ undo: true }); h.createOrder(); addService(h); completionData(h);
  h.context.SH.finishReport(); h.context.SH.invoiceFromReport(); h.context.SH.sendInvoice('E-Mail');
  const beforeStatus = h.localStorage.getItem('shp_db');
  h.set('ivstatus', 'Bezahlt'); h.context.SH.saveInvoiceStatus();
  h.context.SHP_UX_TEST_API.undoLast();
  assert.equal(h.localStorage.getItem('shp_db'), beforeStatus);
});

test('re-rendering the material overview does not change data or duplicate rows', async () => {
  const h = await harness(); const r = h.createOrder(); addMaterial(h);
  const before = h.localStorage.getItem('shp_db');
  for (let i = 0; i < 100; i++) h.context.SH.openReport(r.orderId);
  assert.equal(h.localStorage.getItem('shp_db'), before);
  assert.equal((overview(h).match(/data-report-material-row/g) || []).length, 1);
});

test('invoice and report document templates remain byte-identical to baseline', () => {
  const baselinePath = path.join(__dirname, 'document-template-hashes.json');
  const baseline = JSON.parse(fs.readFileSync(baselinePath));
  const source = fs.readFileSync(path.join(__dirname, '..', 'legacy.html'), 'utf8');
  const { createHash } = require('node:crypto');
  for (const [name, hash] of Object.entries(baseline)) {
    const content = name === 'ux-v18-report-native-pdf.js'
      ? fs.readFileSync(path.join(__dirname, '..', name))
      : source.split('\n').find(line => line.startsWith('function ' + name + '('));
    assert.equal(createHash('sha256').update(content).digest('hex'), hash, name);
  }
});

test('admin reset opens the existing app dialog and waits without a native confirmation', async () => {
  const h = await harness(); let form;
  h.sessionStorage.setItem('shp_session', JSON.stringify({ user: 'admin', role: 'admin' }));
  h.context.SHP_APP_DIALOGS = { openForm(options) { form = options; } };
  require('node:vm').runInContext(fs.readFileSync(path.join(h.root, 'ux-v6.js'), 'utf8'), h.context);
  const before = h.localStorage.getItem('shp_db');
  h.context.SHP_V6.resetDocumentDefaults();
  assert.equal(form.title, 'Standardwerte wiederherstellen?');
  assert.equal(h.localStorage.getItem('shp_db'), before);
  assert.equal(h.external.filter(x => x.kind === 'confirm').length, 0);
  assert.equal(form.onSubmit(), true);
  assert.ok(h.getDb().settings.company);
});

test('an office user cannot open an administrative reset', async () => {
  const h = await harness(); let form;
  h.context.SHP_APP_DIALOGS = { openForm(options) { form = options; } };
  require('node:vm').runInContext(fs.readFileSync(path.join(h.root, 'ux-v6.js'), 'utf8'), h.context);
  const before = h.localStorage.getItem('shp_db');
  h.context.SHP_V6.resetDocumentDefaults();
  assert.equal(form, undefined);
  assert.equal(h.localStorage.getItem('shp_db'), before);
});
