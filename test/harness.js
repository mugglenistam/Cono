// Test harness: runs the renderer in headless Chromium with a Node-backed stand-in for the Electron preload API.
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path'), { pathToFileURL } = require('url');
const MEDIA = new Set(['.mp4','.mkv','.webm','.mov','.m4v','.ogv','.mp3','.flac','.wav','.ogg','.m4a','.opus','.aac']);
const AUDIO = new Set(['.mp3','.flac','.wav','.ogg','.m4a','.opus','.aac']);
const desc = p => { const e = path.extname(p).toLowerCase(); return { path: p, name: path.basename(p), ext: e, kind: AUDIO.has(e) ? 'audio' : 'video', url: pathToFileURL(p).href }; };
function scan(dir) { const o = { folders: [], files: [] }; for (const e of fs.readdirSync(dir, { withFileTypes: true })) { const f = path.join(dir, e.name); if (e.isDirectory()) o.folders.push({ path: f, name: e.name }); else if (MEDIA.has(path.extname(e.name).toLowerCase())) { const st = fs.statSync(f); o.files.push({ ...desc(f), size: st.size, mtime: st.mtimeMs }); } } const c = (a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }); o.folders.sort(c); o.files.sort(c); return o; }
async function launch(opts = {}) {
  const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required', '--allow-file-access-from-files', '--disable-web-security'] });
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 780 }, deviceScaleFactor: 1 })).newPage();
  const logs = []; page.on('console', m => logs.push(m.type() + ': ' + m.text())); page.on('pageerror', e => logs.push('PAGEERROR: ' + e.message));
  let store = opts.store || {}, nextFiles = [], nextFolder = null, nextSubs = [];
  await page.exposeFunction('__n', async (fn, ...a) => {
    switch (fn) {
      case 'getStore': return store; case 'setStore': store = a[0]; return true;
      case 'scan': return scan(a[0]); case 'describe': return a[0].map(p => fs.statSync(p).isDirectory() ? { dir: p, ...scan(p) } : desc(p));
      case 'readText': return fs.readFileSync(a[0], 'utf8');
      case 'findSubs': { const d = path.dirname(a[0]), b = path.basename(a[0], path.extname(a[0])).toLowerCase(); return fs.readdirSync(d).filter(f => /\.(srt|vtt|ass)$/i.test(f) && path.basename(f, path.extname(f)).toLowerCase().startsWith(b)).map(f => path.join(d, f)); }
      case 'listSubs': return fs.readdirSync(a[0]).filter(f => /\.(srt|vtt|ass)$/i.test(f)).map(f => path.join(a[0], f));
      case 'pickFiles': return a[0] === 'subs' ? nextSubs : nextFiles; case 'pickFolder': return nextFolder;
      case 'fetchText': return null; default: return null;
    }
  });
  await page.addInitScript(() => {
    const call = (n) => (...a) => window.__n(n, ...a);
    window.api = { minimize() {}, maximize() {}, close() {}, fullscreen: async on => { window.__fs = on ?? !window.__fs; document.dispatchEvent(new Event('x')); window.__setFs && window.__setFs(window.__fs); return window.__fs; }, onTop() {},
      getStore: call('getStore'), setStore: call('setStore'), pickFiles: call('pickFiles'), pickFolder: call('pickFolder'), scan: call('scan'), describe: call('describe'), readText: call('readText'), findSubs: call('findSubs'), listSubs: call('listSubs'), fetchText: call('fetchText'), showInFolder() {}, pathForFile: f => f.name, onState: cb => { window.__setFs = on => cb({ fullscreen: on }); }, onOpen() {} };
  });
  await page.goto('file://' + path.resolve(__dirname, '../src/index.html'));
  await page.waitForFunction('window.__ready === true', null, { timeout: 8000 });
  return { browser, page, logs, set: o => Object.assign(store, o), setPick: (f, d, s) => { nextFiles = f || nextFiles; nextFolder = d ?? nextFolder; nextSubs = s || nextSubs; }, getStore: () => store };
}
module.exports = { launch, desc, scan };
