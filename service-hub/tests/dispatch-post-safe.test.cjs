const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { harness } = require('./business-harness.cjs');

function load(h, file) {
  vm.runInContext(fs.readFileSync(path.join(h.root, file), 'utf8'), h.context);
}

test('repeated enhancement cannot recurse when invoice is sent by Post', async () => {
  const h = await harness();
  load(h, 'ux-v21-business-guards.js');
  load(h, 'ux-v22-dispatch-post-safe.js');
  h.context.SH.openInvoice(801);
  let prints = 0;
  h.context.SH.printInvoice = () => { prints += 1; return true; };

  for (let i = 0; i < 8; i++) {
    h.context.SHP_BUSINESS_GUARDS.enhance();
    h.context.SHP_DISPATCH_POST_SAFE.enhance();
  }

  assert.equal(h.context.SH.sendInvoice('Post'), true);
  assert.equal(prints, 1);
});

test('preferred Post channel remains safe after repeated enhancement', async () => {
  const h = await harness();
  load(h, 'ux-v21-business-guards.js');
  load(h, 'ux-v22-dispatch-post-safe.js');
  h.context.SH.openInvoice(801);
  const bridge = h.context.SHP_DATA_BRIDGE;
  bridge.readDb().customers[0].preferredChannel = 'Post';
  bridge.save();
  let prints = 0;
  h.context.SH.printInvoice = () => { prints += 1; return true; };

  for (let i = 0; i < 8; i++) {
    h.context.SHP_BUSINESS_GUARDS.enhance();
    h.context.SHP_DISPATCH_POST_SAFE.enhance();
  }

  assert.equal(h.context.SH.sendInvoicePreferred(), true);
  assert.equal(prints, 1);
});
