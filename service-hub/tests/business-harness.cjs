// Isolated execution of the shipped business code. No browser, login or network.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function memoryStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem: key => values.has(key) ? values.get(key) : null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: key => values.delete(key)
  };
}

function node() {
  const button = { onclick: null };
  return {
    innerHTML: '', textContent: '', dataset: {}, style: {}, parentNode: null,
    classList: { add() {}, remove() {}, contains() { return false; } },
    querySelector: selector => selector === 'button' ? button : null,
    querySelectorAll: () => [],
    appendChild(child) { child.parentNode = this; },
    removeChild(child) { child.parentNode = null; },
    remove() { this.parentNode = null; },
    setAttribute() {}, addEventListener() {}
  };
}

async function harness(options = {}) {
  const root = options.root || path.join(__dirname, '..');
  const legacy = fs.readFileSync(path.join(root, 'legacy.html'), 'utf8');
  const loader = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const localStorage = memoryStorage();
  const sessionStorage = memoryStorage({ shp_session: JSON.stringify({ user: 'annette', role: 'office' }) });
  const app = node(), fields = {}, notices = [], prompts = [], external = [];
  const document = {
    body: { appendChild(n) { notices.push(n); n.parentNode = this; } },
    head: node(), documentElement: node(),
    getElementById: id => id === 'app' ? app : fields[id] || null,
    querySelector: selector => selector.startsWith('#') ? fields[selector.slice(1)] || null : null,
    querySelectorAll: () => [], createElement: () => node(), addEventListener() {},
    open() {}, close() {}, write(html) { this.output = html; }
  };
  let milliseconds = Date.UTC(2026, 8, 9, 9);
  class TestDate extends Date {
    constructor(...args) { super(...(args.length ? args : [milliseconds])); }
    static now() { return milliseconds++; }
  }
  const context = {
    document, localStorage, sessionStorage, Date: TestDate,
    console, URL, Blob, File, Uint8Array, JSON, Promise,
    location: { search: '', reload() { external.push({ kind: 'reload' }); } },
    setTimeout() { return 1; }, clearTimeout() {}, requestAnimationFrame() { return 1; },
    prompt() { if (!prompts.length) throw new Error('Unexpected native prompt'); return prompts.shift(); },
    confirm(message) { external.push({ kind: 'confirm', message }); return options.confirm !== false; },
    alert(message) { external.push({ kind: 'alert', message }); },
    print() { external.push({ kind: 'print' }); },
    fetch: async () => ({ ok: true, text: async () => legacy }),
    navigator: {}, addEventListener() {},
  };
  Object.defineProperty(context.location, 'href', { set(url) { external.push({ kind: 'navigate', url }); } });
  context.window = context;
  vm.createContext(context);
  await vm.runInContext(loader.match(/<script>([\s\S]*?)<\/script>/)[1], context);
  vm.runInContext(document.output.match(/<script>([\s\S]*?)<\/script>/)[1], context);
  vm.runInContext(fs.readFileSync(path.join(root, 'core.js'), 'utf8'), context);
  if (options.undo) vm.runInContext(fs.readFileSync(path.join(root, 'ux-v5.js'), 'utf8'), context);

  const set = (id, value) => fields[id] = { value, dataset: {}, addEventListener() {} };
  const getDb = () => JSON.parse(localStorage.getItem('shp_db'));
  const report = () => context.SHP_REPORT_BRIDGE.read();
  const createOrder = () => {
    prompts.push('Isolierter QA-Auftrag', 'Wartung');
    context.SH.newOrder(getDb().customers[0].id);
    return report();
  };
  return { context, app, document, fields, notices, prompts, external, localStorage, sessionStorage, set, getDb, report, createOrder, root };
}

module.exports = { harness, memoryStorage };
