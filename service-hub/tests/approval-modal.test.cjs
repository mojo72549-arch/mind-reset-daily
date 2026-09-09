const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { harness } = require('./business-harness.cjs');

test('modal commit invalidates signatures before dialog dismissal, for the originating report', async () => {
  const h = await harness();
  const report = h.createOrder();
  report.status = 'Abgeschlossen'; report.sigC = 'signed-c'; report.sigT = 'signed-t';
  const modal = { isConnected: true };
  h.context.SH.addMaterial = () => { h.fields['shp-app-modal'] = modal; };
  vm.runInContext(fs.readFileSync(path.join(h.root, 'ux-v23-approval-signature-guard.js'), 'utf8'), h.context);
  h.context.SH.addMaterial();
  report.materials.push({ name: 'Dichtung', qty: 1, price: 5 });
  h.context.SHP_APPROVAL_SIGNATURE_GUARD.flushPending(true);
  const saved = h.getDb().reports.find(r => r.orderId === report.orderId);
  assert.equal(modal.isConnected, true);
  assert.equal(saved.status, 'Entwurf');
  assert.equal(saved.sigC, '');
  assert.equal(saved.sigT, '');
  assert.equal(saved.revisions.length, 1);
  assert.equal(saved.revisions[0].sigC, 'signed-c');
  h.context.SHP_APPROVAL_SIGNATURE_GUARD.flushPending(true);
  assert.equal(h.getDb().reports.find(r => r.orderId === report.orderId).revisions.length, 1);
});
