const test = require('node:test');
const assert = require('node:assert/strict');
const core = require('../core.js');

test('normalizes legacy and current role names', () => {
  assert.equal(core.normalizeRole('dome'), 'dome');
  assert.equal(core.normalizeRole('tech'), 'dome');
  assert.equal(core.normalizeRole('technician'), 'dome');
  assert.equal(core.normalizeRole('annette'), 'annette');
  assert.equal(core.normalizeRole('office'), 'annette');
  assert.equal(core.normalizeRole('billing'), 'annette');
  assert.equal(core.normalizeRole('admin'), 'admin');
});

test('Dome has central visibility but no sensitive write rights', () => {
  for (const cap of ['viewCustomers','viewOrders','viewReports','editReports','viewInvoices']) {
    assert.equal(core.can('dome', cap), true, cap);
  }
  for (const cap of ['manageCustomers','manageOrders','manageInvoices','managePricing','manageAdmin']) {
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
