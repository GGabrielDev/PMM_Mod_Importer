const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
function element() {
  return { children: [], dataset: {}, disabled: true, textContent: '',
    appendChild(child) { this.children.push(child); },
    querySelectorAll() { return this.children.flatMap(child => child.children || []).filter(child => child.type === 'checkbox'); }
  };
}
async function popup({ queryError = false, messageError = false, launchThrows = false } = {}) {
  const btn = element(), links = element(), body = element();
  let ready, url;
  const mod = { modName: '艾莲皮肤 🎮', modSource: 'https://gamebanana.com/mods/1',
    downloadLinks: [{ filename: '<script>Unicode.zip', href: 'https://gamebanana.com/dl/1' }] };
  const context = { TextEncoder, btoa, location: { reload() {} },
    document: { body, createElement: element, getElementById: id => id === 'ImportBtn' ? btn : links,
      addEventListener: (_, fn) => { ready = fn; } },
    chrome: { runtime: { lastError: messageError ? { message: 'Permission denied' } : undefined },
      tabs: { query: async () => { if (queryError) throw new Error('denied'); return [{ id: 1 }]; },
        sendMessage: (_, request, callback) => { assert.equal(request.type, 'GET_MOD_INFO'); callback(mod); } } },
    window: { open(value) { url = value; if (launchThrows) throw new Error('blocked'); return null; } } };
  vm.runInNewContext(fs.readFileSync('PMM_Mod_Importer/popup.js', 'utf8'), context);
  await ready();
  return { btn, links, body, mod, url: () => url };
}
test('actual popup round-trips Unicode and does not claim completed import when open returns null', async () => {
  const p = await popup(); p.btn.onclick();
  const data = new URL(p.url()).searchParams.get('data');
  assert.deepEqual(JSON.parse(Buffer.from(data, 'base64').toString('utf8')), p.mod);
  assert.equal(p.btn.disabled, false);
  assert.match(p.body.children[0].textContent, /Launch requested/);
  assert.equal(p.links.children[0].children[1].textContent, '<script>Unicode.zip');
  p.btn.onclick(); assert.equal(p.btn.disabled, false);
});
test('tab query and content messaging permission failures expose retry', async () => {
  for (const options of [{ queryError: true }, { messageError: true }]) {
    const p = await popup(options);
    assert.equal(p.btn.disabled, false); assert.match(p.body.children[0].textContent, /site access/);
  }
});
test('throwing external-app launch remains retryable with handler guidance', async () => {
  const p = await popup({ launchThrows: true }); p.btn.onclick();
  assert.equal(p.btn.disabled, false); assert.match(p.body.children[0].textContent, /URL handler/);
});
test('actual shared content script responds to the popup message', () => {
  let listener;
  const context = { location: { href: 'https://gamebanana.com/mods/1' }, console: { log() {} },
    document: { querySelector(selector) { if (selector === '#PageTitle') return { textContent: '艾莲皮肤' };
      if (selector === '#FilesModule') return { querySelectorAll: () => [] }; return null; } },
    chrome: { runtime: { onMessage: { addListener(fn) { listener = fn; } } } } };
  vm.runInNewContext(fs.readFileSync('PMM_Mod_Importer/content.js', 'utf8'), context);
  let result; listener({ type: 'GET_MOD_INFO' }, {}, value => { result = value; });
  assert.equal(result.modName, '艾莲皮肤'); assert.equal(result.modSource, context.location.href);
});
