const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const core = require('../core.js');

function customerSearchHarness(database) {
  const values = new Map([['shp_db', JSON.stringify(database)]]);
  const storage = {
    getItem: key => values.has(key) ? values.get(key) : null,
    setItem: (key, value) => values.set(key, String(value))
  };
  const window = {};
  const context = {
    window,
    localStorage: storage,
    sessionStorage: { getItem: () => null, setItem: () => {} },
    document: { documentElement: { dataset: {} }, querySelector: () => null },
    MutationObserver: class { observe() {} },
    requestAnimationFrame: callback => callback(),
    Date,
    String,
    Number,
    JSON,
    Object,
    Array,
    RegExp
  };
  vm.runInNewContext(
    fs.readFileSync(path.join(__dirname, '..', 'ux-v10-customer-search.js'), 'utf8'),
    context
  );
  return { api: window.SHP_CRM_SEARCH, storage };
}

test('normalizes legacy and current role names', () => {
  assert.equal(core.normalizeRole('dome'), 'dome');
  assert.equal(core.normalizeRole('tech'), 'dome');
  assert.equal(core.normalizeRole('technician'), 'dome');
  assert.equal(core.normalizeRole('annette'), 'annette');
  assert.equal(core.normalizeRole('office'), 'annette');
  assert.equal(core.normalizeRole('billing'), 'annette');
  assert.equal(core.normalizeRole('admin'), 'admin');
});

test('Dome has central visibility and may create customer-linked orders', () => {
  for (const cap of ['viewCustomers','viewOrders','viewReports','editReports','viewInvoices']) {
    assert.equal(core.can('dome', cap), true, cap);
  }
  assert.equal(core.can('dome', 'manageOrders'), true, 'manageOrders');
  for (const cap of ['manageCustomers','manageInvoices','managePricing','manageAdmin']) {
    assert.equal(core.can('dome', cap), false, cap);
  }
});

test('Annette has office write rights but not global administration', () => {
  for (const cap of ['viewCustomers','viewOrders','viewReports','editReports','viewInvoices','manageCustomers','manageOrders','manageInvoices','managePricing']) {
    assert.equal(core.can('annette', cap), true, cap);
  }
  assert.equal(core.can('annette', 'manageAdmin'), false);
});

test('Admin has all defined rights', () => {
  for (const cap of Object.keys(core.ROLE_RIGHTS.admin)) {
    assert.equal(core.can('admin', cap), true, cap);
  }
});

test('invoice numbers advance in +5 steps', () => {
  assert.equal(core.nextInvoiceNo([]), '26175');
  assert.equal(core.nextInvoiceNo([{no:'26175'}]), '26180');
  assert.equal(core.nextInvoiceNo([{no:'26175'},{no:'26195'},{no:'bad'}]), '26200');
});

test('safe internal changes are undoable', () => {
  for (const name of ['newCustomer','newOrder','addReportLine','removeReportLine','removeMaterial','removeMeasurement','finishReport','saveInvoiceStatus','editCustomerPricing']) {
    assert.equal(core.isUndoableAction(name), true, name);
  }
});

test('external side effects are never presented as undoable', () => {
  for (const name of ['sendReportPreferred','sendInvoicePreferred','sendInvoice','printReport','printInvoice']) {
    assert.equal(core.hasExternalSideEffect(name), true, name);
    assert.equal(core.isUndoableAction(name), false, name);
  }
});

test('snapshot comparison and safe JSON helpers are deterministic', () => {
  const fakeStorage = { getItem: (key) => key === 'x' ? '{"a":1}' : null };
  assert.equal(core.snapshot(fakeStorage, 'x'), '{"a":1}');
  assert.equal(core.changed('{"a":1}', '{"a":1}'), false);
  assert.equal(core.changed('{"a":1}', '{"a":2}'), true);
  assert.deepEqual(core.safeJson('{"a":1}', {}), {a:1});
  assert.deepEqual(core.safeJson('broken', {fallback:true}), {fallback:true});
});

test('CRM search matches names, contacts and customer numbers and preserves useful ranking', () => {
  const { api } = customerSearchHarness({
    customers: [
      { id: 1, customerNo: 'K-2026-0001', name: 'Musterkunde Stuttgart GmbH', contact: 'Thomas Berger' },
      { id: 2, customerNo: 'K-2026-0002', name: 'Berger Haustechnik', contact: 'Annika Stein' }
    ],
    orders: []
  });
  assert.equal(api.search('Thomas Berger')[0].id, 1);
  assert.equal(api.search('K-2026-0002')[0].id, 2);
  assert.deepEqual(Array.from(api.search('Berger'), customer => customer.id), [2, 1]);
});

test('CRM migration assigns and persists a missing customer number', () => {
  const { api, storage } = customerSearchHarness({
    customers: [{ id: 7, name: 'Neukunde', contact: 'Nina Beispiel' }],
    orders: []
  });
  const customer = api.search('Nina')[0];
  assert.match(customer.customerNo, /^K-\d{4}-0001$/);
  assert.equal(JSON.parse(storage.getItem('shp_db')).customers[0].customerNo, customer.customerNo);
});
