const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// Deterministic scheduler and observer doubles: exercises the actual guard,
// without opening a browser or waiting for real time to pass.
function guard() {
  let now = 0, native, created = 0, next = 1;
  const frames = [], timers = new Map(), records = [], errors = [];
  const root = { id: 'app' };
  class Observer {
    constructor(callback) { native = callback; created++; }
    observe() {} disconnect() {}
    takeRecords() { return records.splice(0); }
  }
  const window = {
    performance: { now: () => now },
    document: { getElementById: () => root, body: root, documentElement: { dataset: {} } },
    MutationObserver: Observer,
    requestAnimationFrame: fn => { frames.push(fn); return next++; },
    setTimeout(fn, delay) { const id = next++; timers.set(id, { at: now + delay, fn }); return id; },
    clearTimeout(id) { timers.delete(id); },
    console: { error: (...args) => errors.push(args) },
  };
  window.window = window;
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', 'ux-v20-stability.js'), 'utf8'), window);
  function flush() {
    let count = 0;
    while (frames.length) {
      assert.ok(++count < 60, 'guard must settle in fewer than 60 frames');
      now += 16; frames.shift()(now);
    }
    return count;
  }
  return {
    api: window.SHP_STABILITY, errors, flush,
    created: () => created,
    mutate: () => records.push({ type: 'childList' }),
    external: () => native([{ type: 'childList' }]),
    advance: ms => { now += ms; },
  };
}

test('all enhancement layers share one observer and settle when idle', () => {
  const g = guard(); let calls = 0;
  for (let i = 0; i < 21; i++) g.api.register('layer-' + i, () => calls++);
  g.flush();
  assert.equal(g.created(), 1);
  assert.equal(calls, 21);
  assert.equal(g.flush(), 0);
  assert.equal(g.api.snapshot().pending, false);
});

test('a burst of external mutations is coalesced into one pass', () => {
  const g = guard(); let calls = 0;
  g.api.register('layer', () => calls++); g.flush(); calls = 0;
  for (let i = 0; i < 200; i++) g.external();
  assert.equal(g.flush(), 1);
  assert.equal(calls, 1);
  assert.equal(g.api.snapshot().diagnostics.circuitTrips, 0);
});

test('a self-triggering mutation loop is stopped while other layers remain available', () => {
  const g = guard(); let healthy = 0, looping = 0;
  g.api.register('bad-layer', () => { looping++; g.mutate(); });
  g.api.register('healthy-layer', () => healthy++);
  g.flush();
  assert.ok(looping > 0 && looping < 10);
  assert.ok(g.api.snapshot().diagnostics.quarantines > 0);
  const before = healthy; g.external(); g.flush();
  assert.ok(healthy > before);
  assert.equal(g.api.snapshot().registrations.find(r => r.name === 'bad-layer').quarantined, true);
});

test('repeated callback errors are contained and do not stop a healthy layer', () => {
  const g = guard(); let healthy = 0;
  g.api.register('throwing-layer', () => { throw new Error('QA exception'); });
  g.api.register('healthy-layer', () => healthy++);
  for (let i = 0; i < 8; i++) { g.external(); g.flush(); }
  assert.ok(healthy >= 8);
  assert.ok(g.api.snapshot().diagnostics.callbackErrors > 0);
  assert.equal(g.api.snapshot().registrations.find(r => r.name === 'throwing-layer').quarantined, true);
});

test('normal idempotent updates across repeated edits do not trigger quarantine', () => {
  const g = guard(); let revision = 0, rendered = -1;
  g.api.register('report-table', () => { if (rendered !== revision) { rendered = revision; g.mutate(); } });
  g.flush();
  for (let i = 0; i < 40; i++) { revision++; g.advance(600); g.external(); g.flush(); }
  assert.equal(rendered, 40);
  assert.equal(g.api.snapshot().diagnostics.circuitTrips, 0);
  assert.equal(g.api.snapshot().diagnostics.callbackErrors, 0);
});

test('re-registering one layer replaces its callback without multiplying observers', () => {
  const g = guard(); let old = 0, current = 0;
  g.api.register('report', () => old++);
  g.api.register('report', () => current++);
  g.flush();
  assert.equal(old, 0); assert.equal(current, 1);
  assert.equal(g.api.snapshot().registrationCount, 1);
  assert.equal(g.created(), 1);
});

test('an unregistered layer does not run in an already queued pass', () => {
  const g = guard(); let calls = 0;
  const unregister = g.api.register('report', () => calls++);
  unregister(); g.flush(); assert.equal(calls, 0);
});

test('repeated slow callbacks are quarantined after returning', () => {
  const g = guard();
  g.api.register('slow-layer', () => g.advance(120));
  for (let i = 0; i < 6; i++) { g.external(); g.flush(); }
  const snapshot = g.api.snapshot();
  assert.ok(snapshot.diagnostics.slowCallbacks > 0);
  assert.equal(snapshot.registrations[0].quarantined, true);
});
