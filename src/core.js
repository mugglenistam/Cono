/* ===== core: helpers, state, persistence, menus, modals ===== */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
function h(tag, attrs = {}, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') e.className = v;
    else if (k === 'html') e.innerHTML = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'style' && typeof v === 'object') Object.assign(e.style, v);
    else e.setAttribute(k, v === true ? '' : v);
  }
  for (const k of kids.flat()) if (k != null && k !== false) e.append(k.nodeType ? k : document.createTextNode(k));
  return e;
}
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
function fmt(t, long = true) {
  if (!isFinite(t) || t < 0) t = 0;
  const s = Math.floor(t % 60), m = Math.floor(t / 60) % 60, hh = Math.floor(t / 3600);
  const p = n => String(n).padStart(2, '0');
  return long || hh ? `${p(hh)}:${p(m)}:${p(s)}` : `${p(m)}:${p(s)}`;
}
function baseName(p) { return (p || '').split(/[\\/]/).pop(); }
function dirName(p) { const i = Math.max(p.lastIndexOf('\\'), p.lastIndexOf('/')); return i < 0 ? '' : p.slice(0, i); }
function stripExt(n) { return n.replace(/\.[^.]+$/, ''); }
function sizeStr(b) { if (!b) return ''; const u = ['B', 'KB', 'MB', 'GB']; let i = 0; while (b >= 1024 && i < 3) { b /= 1024; i++; } return b.toFixed(i ? 1 : 0) + ' ' + u[i]; }
function esc(s) { return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
function setRange(r) { const p = ((r.value - r.min) / (r.max - r.min)) * 100; r.style.setProperty('--p', p + '%'); }
function rangeInput(min, max, step, value, oninput) {
  const r = h('input', { type: 'range', min, max, step, value });
  setRange(r);
  r.addEventListener('input', () => { setRange(r); oninput(parseFloat(r.value)); });
  return r;
}
function toggle(on, onchange) {
  const t = h('button', { class: 'toggle' + (on ? ' on' : ''), role: 'switch' });
  t.addEventListener('click', () => { t.classList.toggle('on'); onchange(t.classList.contains('on')); });
  return t;
}

/* ---------- defaults + state ---------- */
const DEFAULTS = {
  settings: {
    theme: 'dark', accent: '#f58a00', onboarded: false,
    resume: true, autoNext: true, osdKeys: true, autoHide: true, hideDelay: 2000,
    seekShort: 5, seekLong: 30, wheel: 'volume', clickPlay: true, dblFs: true,
    volume: 0.8, muted: false, speed: 1, rememberSpeed: false,
    autoSubs: true, subMatch: 'contains', thumbs: true, subTimeline: false,
    history: true, keepQueue: true, libView: 'grid', libSort: 'name',
    gain: 1, eq: 'flat', ontop: false, repeat: 'off', shuffle: false,
    layout: { left: ['prev', 'play', 'next'], right: ['volume', 'audio', 'subs', 'settings', 'queue'], top: ['pip', 'fs'] },
    hotkeys: {
      playpause: 'Space', seekfwd: 'ArrowRight', seekback: 'ArrowLeft', seekfwdL: 'Shift+ArrowRight', seekbackL: 'Shift+ArrowLeft',
      volup: 'ArrowUp', voldown: 'ArrowDown', mute: 'm', fullscreen: 'f', next: 'n', prev: 'p', bookmark: 'Ctrl+b',
      subdelayminus: 'h', subdelayplus: 'j', speedup: ']', speeddown: '[', speedreset: '=', hideui: 'Ctrl+h', open: 'Ctrl+o',
      queue: 'q', settings: 'Ctrl+p', screenshot: 's', frameNext: '.', framePrev: ',', library: 'l',
    },
  },
  sub: { enabled: true, delay: 0, size: 100, font: 'Segoe UI', color: '#ffffff', outlineColor: '#000000', outline: 2, bg: 0, pos: 8, sizeMode: 'relative', defaultLang: '' },
  video: { brightness: 100, contrast: 100, saturate: 100, hue: 0, flipH: false, flipV: false, rotate: 0, zoom: 100, aspect: 'fit', filter: 'none' },
  library: { folders: [] }, playlists: [], streams: [], recents: [], resume: {}, bookmarks: {}, subMap: {}, presets: [], folderPreset: {}, pins: [], queue: [],
};
const S = {
  store: null, queue: [], idx: -1, cur: null, subCues: [], subName: null, subTracks: [],
  panel: null, panelTab: 'subs', libOpen: false, libMode: 'compact', libNavCollapsed: false, view: 'player',
  fullscreen: false, hideui: false, maximized: false, sleepAt: 0, sleepAfter: false, peaks: null, duration: 0,
};
function deepMerge(a, b) {
  if (Array.isArray(a) || typeof a !== 'object' || a === null) return b === undefined ? a : b;
  const out = { ...a };
  for (const k of Object.keys(b || {})) out[k] = (k in a && a[k] && typeof a[k] === 'object' && !Array.isArray(a[k])) ? deepMerge(a[k], b[k]) : b[k];
  return out;
}
const hasApi = typeof window.api !== 'undefined';
async function loadStore() {
  let raw = {};
  try { raw = hasApi ? await api.getStore() : JSON.parse(localStorage.getItem('vlcr') || '{}'); } catch {}
  S.store = deepMerge(DEFAULTS, raw || {});
  S.store.settings.layout = { ...DEFAULTS.settings.layout, ...(raw?.settings?.layout || {}) };
}
let saveT;
function save() {
  clearTimeout(saveT);
  saveT = setTimeout(() => { try { hasApi ? api.setStore(S.store) : localStorage.setItem('vlcr', JSON.stringify(S.store)); } catch {} }, 250);
}
const cfg = () => S.store.settings;

/* ---------- OSD + toast ---------- */
let osdT;
function osd(text, key) {
  const o = $('#osd');
  o.innerHTML = '';
  o.append(text);
  if (key && cfg().osdKeys) o.append(h('kbd', {}, key));
  o.classList.add('show');
  clearTimeout(osdT); osdT = setTimeout(() => o.classList.remove('show'), 1400);
}
function toast(msg) {
  let w = $('.toast-wrap');
  if (!w) { w = h('div', { class: 'toast-wrap' }); $('#app').append(w); }
  const t = h('div', { class: 'toast' }, msg); w.append(t);
  setTimeout(() => { t.remove(); }, 2600);
}

/* ---------- menus (with submenus) ---------- */
function closeMenus() { $('#menuLayer').innerHTML = ''; }
function buildMenu(items, x, y, parent) {
  const m = h('div', { class: 'menu' });
  m.addEventListener('contextmenu', e => e.preventDefault());
  for (const it of items) {
    if (!it) continue;
    if (it === '-') { m.append(h('div', { class: 'msep' })); continue; }
    if (it.head) { m.append(h('div', { class: 'mhead' }, it.head)); continue; }
    const row = h('div', { class: 'mi' + (it.disabled ? ' dis' : '') });
    if (it.check !== undefined) row.append(h('span', { class: 'tick', html: it.check ? ico('check') : '' }));
    else if (it.icon) row.append(h('span', { class: 'ico2' + (it.acc ? ' acc' : ''), html: ico(it.icon) }));
    row.append(h('span', { class: 'lab' }, it.label));
    if (it.kb) row.append(h('span', { class: 'kb' }, it.kb));
    if (it.sub) row.append(h('span', { class: 'chev', html: ico('chevron') }));
    let subEl = null;
    const openSub = () => {
      closeSiblings(m); if (!it.sub || subEl) return;
      const r = row.getBoundingClientRect();
      subEl = buildMenu(typeof it.sub === 'function' ? it.sub() : it.sub, r.right + 2, r.top - 5, m);
      row.classList.add('open'); row._sub = subEl;
    };
    row.addEventListener('mouseenter', () => { if (it.sub) openSub(); else closeSiblings(m); });
    row.addEventListener('click', e => {
      e.stopPropagation();
      if (it.sub) { openSub(); return; }
      closeMenus(); it.action && it.action();
    });
    m.append(row);
  }
  m._parent = parent;
  $('#menuLayer').append(m);
  const r = m.getBoundingClientRect(), W = innerWidth, H = innerHeight;
  if (x + r.width > W - 6) x = parent ? parent.getBoundingClientRect().left - r.width - 2 : W - r.width - 6;
  if (y + r.height > H - 6) y = Math.max(6, H - r.height - 6);
  m.style.left = Math.max(6, x) + 'px'; m.style.top = Math.max(6, y) + 'px';
  return m;
}
function closeSiblings(m) {
  $$('.mi', m).forEach(r => { if (r._sub) { closeDescendants(r._sub); r._sub.remove(); r._sub = null; r.classList.remove('open'); } });
}
function closeDescendants(m) { $$('.mi', m).forEach(r => { if (r._sub) { closeDescendants(r._sub); r._sub.remove(); r._sub = null; } }); }
function showMenu(items, x, y) { closeMenus(); const l = $('#menuLayer'); l.style.pointerEvents = 'auto'; buildMenu(items, x, y); }
function menuAt(el, items, align = 'left') {
  const r = el.getBoundingClientRect();
  closeMenus(); $('#menuLayer').style.pointerEvents = 'auto';
  const m = buildMenu(items, r.left, r.bottom + 4);
  if (align === 'right') { m.style.left = Math.max(6, r.right - m.offsetWidth) + 'px'; }
  if (r.bottom + m.offsetHeight > innerHeight - 6) m.style.top = Math.max(6, r.top - m.offsetHeight - 4) + 'px';
}
document.addEventListener('mousedown', e => {
  if (!e.target.closest('.menu')) { closeMenus(); $('#menuLayer').style.pointerEvents = 'none'; }
}, true);

/* ---------- modal ---------- */
function modal({ title, body, buttons = [], wide = false, onClose }) {
  const layer = $('#modalLayer');
  const scrim = h('div', { class: 'scrim' });
  const close = () => { scrim.remove(); if (!layer.children.length) layer.style.pointerEvents = 'none'; onClose && onClose(); };
  const m = h('div', { class: 'modal' + (wide ? ' wide' : '') });
  m.append(h('div', { class: 'modal-h' }, h('h2', {}, title), h('button', { class: 'icon-btn', html: ico('close'), onclick: close })));
  const b = h('div', { class: 'modal-b' }); b.append(body); m.append(b);
  if (buttons.length) {
    const f = h('div', { class: 'modal-f' });
    buttons.forEach(bt => f.append(h('button', { class: 'btn ' + (bt.primary ? 'primary' : 'ghost'), onclick: () => { const r = bt.action ? bt.action() : undefined; if (r !== false) close(); } }, bt.label)));
    m.append(f);
  }
  scrim.append(m); scrim.addEventListener('mousedown', e => { if (e.target === scrim) close(); });
  layer.style.pointerEvents = 'auto'; layer.append(scrim);
  return { close, el: m, body: b };
}
function applyTheme() {
  const a = $('#app');
  a.classList.remove('theme-dark', 'theme-light');
  let t = cfg().theme; if (t === 'system') t = matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  a.classList.add('theme-' + t);
  document.documentElement.style.setProperty('--accent', cfg().accent);
  drawWave();
}
