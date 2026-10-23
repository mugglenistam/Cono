/* ===== library: home, videos, music, network, playlists, recent ===== */
const L = { section: 'home', path: null, root: null, hist: [{ section: 'home', path: null }], hi: 0, q: '', open: null, m3u: null };
const thumbCache = new Map(); let thumbQ = Promise.resolve();
function makeThumb(url) {
  if (thumbCache.has(url)) return thumbCache.get(url);
  const p = thumbQ = thumbQ.then(() => new Promise(res => {
    const v = document.createElement('video'); v.muted = true; v.preload = 'metadata'; v.src = url; let done = false;
    const fin = val => { if (done) return; done = true; v.removeAttribute('src'); v.load(); res(val); };
    v.onloadedmetadata = () => { v.currentTime = Math.min(v.duration * 0.1 || 1, 20); };
    v.onseeked = () => { try { const c = document.createElement('canvas'); c.width = 320; c.height = 180; c.getContext('2d').drawImage(v, 0, 0, 320, 180); fin({ url: c.toDataURL('image/jpeg', .7), dur: v.duration }); } catch { fin(null); } };
    v.onerror = () => fin(null); setTimeout(() => fin(null), 6000);
  }));
  thumbCache.set(url, p); return p;
}
const lazyObs = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { lazyObs.unobserve(e.target); e.target._load && e.target._load(); } }), { rootMargin: '120px' });
function thumbBox(it, cls) {
  const box = h('div', { class: cls, html: it.kind === 'audio' ? ico('music') : ico('video') });
  if (it.kind === 'audio') {
    const img = coverImage(); box.replaceChildren(img); box.classList.add('audio-cover');
    box._load = async () => { img.src = await audioCover(it); }; lazyObs.observe(box);
  }
  if (it.kind === 'video' && !it.stream) { box._load = async () => { const t = await makeThumb(it.url); if (t) { $('svg', box)?.remove(); box.prepend(h('img', { src: t.url })); } }; lazyObs.observe(box); }
  if (cls !== 'mini') box.append(durationLabel(it, 'dur'));
  return box;
}
const isWatched = it => !!(S.store.watched && S.store.watched[keyOf(it)]);
function progressOf(it) { const r = S.store.resume[keyOf(it)]; return r && r.d ? r.t / r.d : 0; }

/* ----- navigation ----- */
function libGo(section, path = null, push = true) {
  if (push && (section !== L.section || path !== L.path)) { L.hist = L.hist.slice(0, L.hi + 1); L.hist.push({ section, path }); L.hi = L.hist.length - 1; }
  L.section = section; L.path = path; L.q = ''; L.open = null; renderLib();
}
function libBack(d) {
  if (d < 0 && S.view !== 'library') { returnToList(); return; }
  const i = L.hi + d; if (i < 0 || i >= L.hist.length) return;
  L.hi = i; const s = L.hist[i]; libGo(s.section, s.path, false);
  if (S.view !== 'library' && !S.libOpen) showLibrary(true, 'full');
}
function toggleLibrarySidebar() {
  if (S.view === 'library') {
    S.libNavCollapsed = !S.libNavCollapsed;
    $('#library > .lib').classList.toggle('nav-collapsed', S.libNavCollapsed);
    updateLibraryButtons();
  } else showLibrary(!S.libOpen, 'compact');
}
function updateLibraryButtons() {
  $('#btnBack').disabled = S.view === 'library' && L.hi <= 0;
  $('#btnBack').title = S.view === 'library' ? 'Previous folder' : 'Back to list';
  $('#btnBack').setAttribute('aria-label', $('#btnBack').title);
  $('#btnReturnList').classList.toggle('hidden', S.view === 'library');
  $('#btnForward').disabled = L.hi >= L.hist.length - 1;
  const expanded = S.view === 'library' ? !S.libNavCollapsed : S.libOpen;
  $('#btnLib').classList.toggle('on', expanded);
  $('#btnLib').setAttribute('aria-expanded', String(expanded));
  $('#btnLib').title = S.view === 'library' ? (expanded ? 'Collapse sidebar' : 'Expand sidebar') : 'Library sidebar';
}
function showLibrary(on, mode) {
  if (S.view === 'library' && ((!on && mode === 'full') || (on && mode === 'compact'))) {
    L.playbackOrigin = { section: L.section, path: L.path, root: L.root, q: L.q, open: L.open, m3u: L.m3u, musicTab: L.musicTab,
      hist: L.hist.slice(), hi: L.hi, scroll: $('#library .lib-scroll')?.scrollTop || 0 };
  }
  if (mode) S.libMode = mode;
  if (mode === 'full') {
    S.view = on ? 'library' : 'player';
    if (on) S.libOpen = false;
  }
  if (mode === 'compact') {
    S.libOpen = on;
    if (on) S.view = 'player';
  }
  $('#library').classList.toggle('hidden', S.view !== 'library');
  $('#libPanel').classList.toggle('hidden', !S.libOpen);
  $('#btnFolder').classList.toggle('on', S.view === 'library');
  renderLib(); setTimeout(() => { applySubStyle(); applyVideoFx(); }, 30);
}
function returnToList() {
  if (L.playbackOrigin) {
    const { scroll, ...origin } = L.playbackOrigin;
    Object.assign(L, origin); L.pendingScroll = scroll;
  }
  showLibrary(true, 'full');
}
function restoreListScroll(sc) {
  if (sc.isConnected && sc._returnScroll != null) sc.scrollTop = sc._returnScroll;
}
function renderLib() {
  syncWorkspaceLayout();
  updateLibraryButtons();
  if (S.view === 'library') { const c = $('#library'); c.innerHTML = ''; c.append(libUI(false)); }
  if (S.libOpen) { const c = $('#libPanel'); c.innerHTML = ''; c.append(libUI(true)); }
}
const SECTIONS = [['home', 'Home', 'home'], ['videos', 'Videos', 'video'], ['music', 'Music', 'music'], ['network', 'Network', 'network'], ['playlists', 'Playlists', 'playlist'], ['recent', 'Recent', 'recent']];
function libUI(compact) {
  const root = h('div', { class: 'lib' + (compact ? ' compact' : S.libNavCollapsed ? ' nav-collapsed' : '') });
  const nav = h('div', { class: 'lib-nav' });
  SECTIONS.forEach(([id, label, ic]) => nav.append(h('button', { class: 'nav-i' + (L.section === id ? ' on' : ''), title: label, html: ico(ic) + `<span>${label}</span>`, onclick: () => libGo(id) })));
  if (S.store.pins.length) { nav.append(h('div', { class: 'nav-div' }), h('div', { class: 'nav-sec' }, 'Pinned')); S.store.pins.forEach(p => nav.append(h('button', { class: 'nav-i' + (L.path === p.path ? ' on' : ''), title: p.name, html: ico('pin') + `<span>${esc(p.name)}</span>`, onclick: () => libGo('videos', p.path), oncontextmenu: e => { e.preventDefault(); showMenu([{ label: 'Unpin', icon: 'pin', action: () => { S.store.pins = S.store.pins.filter(x => x.path !== p.path); save(); renderLib(); } }], e.clientX, e.clientY); } }))); }
  nav.append(h('div', { style: { flex: 1 } }), h('button', { class: 'nav-i', title: 'Add item', html: ico('plus') + '<span>Add item</span>', onclick: e => menuAt(e.currentTarget, addItemMenu()) }));
  root.append(nav);
  const body = h('div', { class: 'lib-body' }); root.append(body);
  libBody(body, compact);
  return root;
}
function addItemMenu() {
  return [{ label: 'Add folder to Videos', icon: 'video', action: () => addLibFolder('video') }, { label: 'Add folder to Music', icon: 'music', action: () => addLibFolder('music') }, '-',
    { label: 'New playlist…', icon: 'playlist', action: newPlaylistDialog }, { label: 'Add network stream…', icon: 'network', action: networkDialog }];
}
async function addLibFolder(kind) {
  if (!hasApi) return toast('Folders need the desktop app');
  const d = await api.pickFolder(); if (!d) return;
  if (!S.store.library.folders.some(f => f.path === d)) S.store.library.folders.push({ path: d, name: baseName(d), kind });
  save(); toast('Added “' + baseName(d) + '” to ' + (kind === 'music' ? 'Music' : 'Videos')); libGo(kind === 'music' ? 'music' : 'videos');
}
function titleFor() { return { home: 'Home', videos: 'Videos', music: 'Music', network: 'Network', playlists: 'Playlists', recent: 'Recent' }[L.section]; }
function ensureRoot() { if (L.path && (!L.root || !L.path.startsWith(L.root))) { const f = S.store.library.folders.find(f => L.path.startsWith(f.path)); L.root = f ? f.path : L.path; } }
function libBar(compact, count) {
  ensureRoot();
  const bar = h('div', { class: 'lib-bar' });
  const b = (ic, t, f, dis) => h('button', { class: 'icon-btn', title: t, html: ico(ic), onclick: f, disabled: dis });
  bar.append(b('back', 'Back', () => libBack(-1), L.hi <= 0), b('forward', 'Forward', () => libBack(1), L.hi >= L.hist.length - 1));
  const path = h('div', { class: 'path' });
  const crumbs = [{ label: titleFor(), go: () => libGo(L.section) }];
  if (L.path && L.root) {
    crumbs.push({ label: baseName(L.root), go: () => libGo(L.section, L.root) });
    const rel = L.path.slice(L.root.length).split(/[\\/]/).filter(Boolean); let acc = L.root;
    rel.forEach(seg => { acc += (L.root.includes('\\') ? '\\' : '/') + seg; const a = acc; crumbs.push({ label: seg, go: () => libGo(L.section, a) }); });
  } else if (L.open) crumbs.push({ label: L.open.name, go: () => {} });
  crumbs.forEach((c, i) => { if (i) path.append(h('span', { html: ico('chevron') })); path.append(h('button', { onclick: c.go }, c.label)); });
  bar.append(path);
  if (!compact) { bar.append(h('input', { class: 'field search', placeholder: 'Search', value: L.q, oninput: e => { L.q = e.target.value; refreshBody(); } })); }
  bar.append(h('button', { class: 'icon-btn', title: 'Sort', html: ico('sort'), onclick: e => menuAt(e.currentTarget, [{ head: 'Sort by' }, ...[['name', 'Name'], ['date', 'Date modified'], ['size', 'Size'], ['unwatched', 'Unwatched first'], ['watched', 'Watched first']].map(([k, n]) => ({ label: n, check: cfg().libSort === k, action: () => { cfg().libSort = k; save(); renderLib(); } }))], 'right') }));
  const vm = cfg().libView, nxt = { grid: 'list', list: 'detail', detail: 'grid' }[vm];
  bar.append(h('button', { class: 'icon-btn', title: 'View: ' + vm + ' (click to change)', html: ico(vm), onclick: () => { cfg().libView = nxt; save(); renderLib(); } }));
  bar.append(h('button', { class: 'icon-btn', title: 'More', html: ico('dots'), onclick: e => menuAt(e.currentTarget, [...addItemMenu(), '-', { label: 'Open library full screen', icon: 'external', action: () => showLibrary(true, 'full') }], 'right') }));
  return bar;
}
function refreshBody() { const b = $('.lib-scroll', S.view === 'library' ? $('#library') : $('#libPanel')); if (b) { const parent = b.parentElement; const compact = parent.parentElement.classList.contains('compact'); b.remove(); parent.append(libContent(compact)); } }
function libBody(body, compact) {
  body.append(libBar(compact)); body.append(libContent(compact));
}
function sortFiles(a) {
  const s = cfg().libSort, f = [...a];
  const by = { name: (x, y) => x.name.localeCompare(y.name, undefined, { numeric: true }), date: (x, y) => (y.mtime || 0) - (x.mtime || 0), size: (x, y) => (y.size || 0) - (x.size || 0), unwatched: (x, y) => (isWatched(x) - isWatched(y)) || by.name(x, y), watched: (x, y) => (isWatched(y) - isWatched(x)) || by.name(x, y) };
  return f.sort(by[s] || by.name);
}
function libContent(compact) {
  const sc = h('div', { class: 'lib-scroll' });
  if (!compact && L.pendingScroll != null) { sc._returnScroll = L.pendingScroll; delete L.pendingScroll; }
  const sect = L.section;
  if (sect === 'home') homeView(sc, compact);
  else if (sect === 'videos' || sect === 'music') { if (L.path) folderView(sc, compact).then(() => restoreListScroll(sc)); else rootView(sc, sect, compact); }
  else if (sect === 'network') networkView(sc, compact);
  else if (sect === 'playlists') playlistsView(sc, compact);
  else if (sect === 'recent') { const items = S.store.recents; sc.append(h('div', { class: 'sect-h' }, 'Recent')); itemsView(sc, items.filter(x => !L.q || x.name.toLowerCase().includes(L.q.toLowerCase())), compact, items); }
  requestAnimationFrame(() => restoreListScroll(sc));
  // Stop restoring after the user moves the list themselves.
  sc.addEventListener('wheel', () => { delete sc._returnScroll; }, { passive: true });
  return sc;
}
function cardFor(it, ctx, all, compact) {
  const watched = isWatched(it), cur = S.cur && keyOf(S.cur) === keyOf(it);
  const c = h('div', { class: 'card' + (cur ? ' cur' : '') + (watched ? ' watched' : ''), draggable: true });
  const th = thumbBox(it, 'th'); const pr = progressOf(it); if (pr > 0.02 && !watched) th.append(h('div', { class: 'prog', style: { width: pr * 100 + '%' } })); c.append(th);
  c.append(h('div', { class: 'nm', title: it.name }, stripExt(it.name)), h('div', { class: 'sub' }, [it.size ? sizeStr(it.size) : '', watched ? 'Watched' : ''].filter(Boolean).join(' · ') || (it.stream ? 'Stream' : '')));
  bindItem(c, it, all, ctx); return c;
}
function bindItem(el, it, all, ctx) {
  el.addEventListener('click', () => { const i = all.indexOf(it); playItems(all.slice(i >= 0 ? i : 0).concat(all.slice(0, 0)), 0); });
  el.addEventListener('dragstart', e => { e.dataTransfer.setData('application/x-media', JSON.stringify([it])); e.dataTransfer.effectAllowed = 'copy'; });
  el.addEventListener('contextmenu', e => { e.preventDefault(); showMenu(itemMenu(it, all), e.clientX, e.clientY); });
}
function itemMenu(it, all) {
  return [{ label: 'Play', icon: 'play', action: () => playItems([it], 0) }, { label: 'Add to queue', icon: 'queue', action: () => enqueue([it]) }, { label: 'Play next', icon: 'next', action: () => enqueue([it], { at: S.idx + 1 }) },
    { label: 'Add to playlist', icon: 'playlist', sub: () => [...S.store.playlists.map(p => ({ label: p.name, action: () => { p.items.push({ ...it }); save(); toast('Added to ' + p.name); } })), S.store.playlists.length ? '-' : null, { label: 'New playlist…', icon: 'plus', action: () => promptName('New playlist', 'Playlist name', '', n => { S.store.playlists.push({ name: n, items: [{ ...it }] }); save(); }) }] },
    '-', { label: isWatched(it) ? 'Mark as unwatched' : 'Mark as watched', icon: 'eye', action: () => { S.store.watched = S.store.watched || {}; if (isWatched(it)) delete S.store.watched[keyOf(it)]; else S.store.watched[keyOf(it)] = 1; save(); renderLib(); } },
    it.path && !it.stream ? { label: 'Show in folder', icon: 'folder', action: () => hasApi && api.showInFolder(it.path) } : null];
}
function itemsView(sc, items, compact, all) {
  const mode = compact && cfg().libView === 'grid' ? 'grid' : cfg().libView;
  if (!items.length) { sc.append(h('div', { class: 'empty' }, 'Nothing here yet.')); return; }
  if (mode === 'grid') { const g = h('div', { class: 'grid' }); items.forEach(it => g.append(cardFor(it, 'lib', all || items, compact))); sc.append(g); return; }
  const rows = h('div', { class: 'rows' + (mode === 'detail' ? ' detail' : '') });
  items.forEach(it => {
    const cur = S.cur && keyOf(S.cur) === keyOf(it), r = h('div', { class: 'r' + (cur ? ' cur' : ''), draggable: true });
    if (mode === 'detail' || it.kind === 'audio') r.append(thumbBox(it, 'mini')); else r.append(h('span', { html: ico('video') }));
    r.append(h('span', { class: 'nm', title: it.name }, stripExt(it.name)));
    r.append(durationLabel(it, 'file-duration'));
    if (!compact) r.append(h('span', { class: 'c' }, it.size ? sizeStr(it.size) : ''), h('span', { class: 'c' }, isWatched(it) ? 'Watched' : progressOf(it) > .02 ? Math.round(progressOf(it) * 100) + '%' : ''));
    bindItem(r, it, all || items); rows.append(r);
  });
  sc.append(rows);
}
function folderCard(f, compact, opts = {}) {
  const c = h('div', { class: 'card folder' }, h('div', { class: 'th', html: ico('folder') }), h('div', { class: 'nm' }, f.name), h('div', { class: 'sub' }, opts.sub || 'Folder'));
  c.addEventListener('click', () => libGo(opts.section || L.section, f.path));
  c.addEventListener('contextmenu', e => { e.preventDefault(); showMenu([{ label: 'Open', icon: 'folder', action: () => libGo(opts.section || L.section, f.path) }, { label: 'Play all', icon: 'play', action: async () => { const items = await filesRecursive(f.path); if (items.length) playItems(items, 0); } }, { label: 'Add to queue', icon: 'queue', action: async () => enqueue(await filesRecursive(f.path)) }, { label: 'Pin to sidebar', icon: 'pin', action: () => { if (!S.store.pins.some(p => p.path === f.path)) S.store.pins.push({ path: f.path, name: f.name }); save(); renderLib(); } }, opts.removable ? { label: 'Remove from library', icon: 'trash', action: () => { S.store.library.folders = S.store.library.folders.filter(x => x.path !== f.path); save(); renderLib(); } } : null], e.clientX, e.clientY); });
  c.setAttribute('draggable', true); c.addEventListener('dragstart', async e => { e.dataTransfer.setData('application/x-media', JSON.stringify(await filesRecursive(f.path))); });
  return c;
}
async function filesRecursive(dir, depth = 0) { if (!hasApi) return []; const r = await api.scan(dir); let out = r.files.slice(); if (depth < 3) for (const f of r.folders) out = out.concat(await filesRecursive(f.path, depth + 1)); return out; }
function rootView(sc, kind, compact) {
  const k = kind === 'music' ? 'music' : 'video', folders = S.store.library.folders.filter(f => f.kind === k);
  const addCard = h('div', { class: 'card', onclick: () => addLibFolder(k) }, h('div', { class: 'th', html: ico('plus') }), h('div', { class: 'nm' }, 'Add folder'), h('div', { class: 'sub' }, 'Choose a folder with ' + (k === 'music' ? 'songs' : 'videos')));
  if (kind === 'music') {
    sc.append(h('div', { class: 'sect-h' }, 'Music'));
    const tabs = h('div', { class: 'chips', style: { marginBottom: '14px' } }, [['folders', 'Folders'], ['songs', 'Songs'], ['albums', 'Albums']].map(([id, n]) => h('button', { class: 'chip' + ((L.musicTab || 'folders') === id ? ' on' : ''), onclick: () => { L.musicTab = id; renderLib(); } }, n)));
    sc.append(tabs);
    if (L.musicTab === 'songs' || L.musicTab === 'albums') { const box = h('div', {}); sc.append(box); musicAgg(box, L.musicTab, compact, folders).then(() => restoreListScroll(sc)); return; }
  } else sc.append(h('div', { class: 'sect-h' }, 'Videos'));
  const g = h('div', { class: 'grid' }); g.append(addCard); folders.forEach(f => g.append(folderCard(f, compact, { removable: true, sub: 'Library folder' }))); sc.append(g);
}
async function musicAgg(box, tab, compact, folders) {
  box.append(h('div', { class: 'empty' }, 'Scanning…'));
  let all = []; for (const f of folders) all = all.concat(await filesRecursive(f.path)); all = all.filter(x => x.kind === 'audio'); box.innerHTML = '';
  if (!all.length) return box.append(h('div', { class: 'empty' }, 'No songs found. Add a Music folder first.'));
  if (tab === 'songs') return itemsView(box, sortFiles(all).filter(x => !L.q || x.name.toLowerCase().includes(L.q.toLowerCase())), compact, all);
  const groups = {}; all.forEach(x => { const d = dirName(x.path); (groups[d] = groups[d] || []).push(x); });
  const g = h('div', { class: 'grid' }); Object.entries(groups).forEach(([d, files]) => { const c = h('div', { class: 'card folder' }, h('div', { class: 'th', html: ico('music') }), h('div', { class: 'nm' }, baseName(d)), h('div', { class: 'sub' }, files.length + ' songs')); c.addEventListener('click', () => playItems(files, 0)); g.append(c); }); box.append(g);
}
async function folderView(sc, compact) {
  sc.append(h('div', { class: 'empty' }, 'Loading…'));
  ensureRoot();
  const r = hasApi ? await api.scan(L.path) : { folders: [], files: [] }; sc.innerHTML = '';
  const q = L.q.toLowerCase(), files = sortFiles(r.files.filter(f => !q || f.name.toLowerCase().includes(q))), folders = r.folders.filter(f => !q || f.name.toLowerCase().includes(q));
  sc.append(h('div', { class: 'sect-h' }, baseName(L.path), h('span', { style: { flex: 1 } }), h('button', { class: 'btn', html: ico('play') + 'Play all', onclick: () => files.length && playItems(files, 0) }), h('button', { class: 'btn ghost', html: ico('queue') + 'Add to queue', onclick: () => enqueue(files) })));
  if (!folders.length && !files.length) return sc.append(h('div', { class: 'empty' }, 'This folder has no media files.'));
  if (folders.length) { const g = h('div', { class: 'grid', style: { marginBottom: '16px' } }); folders.forEach(f => g.append(folderCard(f, compact))); sc.append(g); }
  if (files.length) itemsView(sc, files, compact, files);
}
function homeView(sc, compact) {
  const rec = S.store.recents, cont = rec.filter(x => { const p = progressOf(x); return p > .02 && p < .95; }).slice(0, 6);
  sc.append(h('div', { class: 'sect-h' }, 'Watch Next', h('span', { html: ico('chevron') })));
  if (cont.length) { const g = h('div', { class: 'home-row' }); cont.forEach(it => g.append(cardFor(it, 'home', cont, compact))); sc.append(g); } else sc.append(h('div', { class: 'ph-card' }, 'Things you start watching will show up here so you can pick up where you left off.'));
  sc.append(h('div', { class: 'sect-h' }, 'Recent files', h('span', { html: ico('chevron') })));
  if (rec.length) { const g = h('div', { class: 'home-row' }); rec.slice(0, 6).forEach(it => g.append(cardFor(it, 'home', rec, compact))); sc.append(g); } else sc.append(h('div', { class: 'ph-card' }, 'No recent files. Use ⋯ → Open file, drop a file here, or add a folder with “Add item”.'));
  if (S.store.playlists.length) { sc.append(h('div', { class: 'sect-h' }, 'Playlists', h('span', { html: ico('chevron') }))); const g = h('div', { class: 'home-row' }); S.store.playlists.slice(0, 4).forEach(p => g.append(playlistCard(p))); sc.append(g); }
  if (S.store.streams.length) { sc.append(h('div', { class: 'sect-h' }, 'Streams', h('span', { html: ico('chevron') }))); const g = h('div', { class: 'home-row' }); S.store.streams.slice(0, 4).forEach(s => g.append(streamCard(s))); sc.append(g); }
}
function playlistCard(p) {
  const c = h('div', { class: 'card folder' }, h('div', { class: 'th', html: ico('playlist') }), h('div', { class: 'nm' }, p.name), h('div', { class: 'sub' }, p.items.length + ' items'));
  c.addEventListener('click', () => libGo('playlists', p.name)); return c;
}
function playlistsView(sc, compact) {
  if (L.path) {
    const p = S.store.playlists.find(x => x.name === L.path); if (!p) return sc.append(h('div', { class: 'empty' }, 'Playlist not found'));
    sc.append(h('div', { class: 'sect-h' }, p.name, h('span', { style: { flex: 1 } }), h('button', { class: 'btn', html: ico('play') + 'Play', onclick: () => p.items.length && playItems(p.items.slice(), 0) }), h('button', { class: 'btn ghost', html: ico('queue') + 'Add to queue', onclick: () => enqueue(p.items.slice()) }), h('button', { class: 'icon-btn', title: 'Delete playlist', html: ico('trash'), onclick: () => { S.store.playlists = S.store.playlists.filter(x => x !== p); save(); libGo('playlists'); } })));
    return itemsView(sc, p.items, compact, p.items);
  }
  sc.append(h('div', { class: 'sect-h' }, 'Playlists'));
  const g = h('div', { class: 'grid' }); g.append(h('div', { class: 'card', onclick: newPlaylistDialog }, h('div', { class: 'th', html: ico('plus') }), h('div', { class: 'nm' }, 'New playlist'), h('div', { class: 'sub' }, 'Name it and pick files')));
  S.store.playlists.forEach(p => g.append(playlistCard(p))); sc.append(g);
}
function streamCard(s) { const c = h('div', { class: 'card folder' }, h('div', { class: 'th', html: ico('network') }), h('div', { class: 'nm' }, s.name), h('div', { class: 'sub' }, s.url.replace(/^https?:\/\//, ''))); c.addEventListener('click', () => playStream(s)); return c; }
let streamRequestId = 0;
function showStreamAccess(result) {
  modal({ title: result.accessRequired ? 'Website access required' : 'This is a web page', body: h('div', {}, h('p', {}, result.message), h('p', { class: 'kbd-hint', style: { marginTop: '12px' } }, 'After signing in, close the website window and try the stream again.')),
    buttons: [{ label: 'Close' }, { label: 'Open website', primary: true, action: () => hasApi && api.openStreamWebsite ? api.openStreamWebsite(result.url) : window.open(result.url) }] });
}
async function playStream(s) {
  const request = ++streamRequestId, startedAt = mediaLoadId;
  osd('Opening network media…');
  try {
    const result = hasApi && api.resolveMedia ? await api.resolveMedia(s.url) : { type: 'media', url: s.url };
    if (request !== streamRequestId || startedAt !== mediaLoadId) return;
    if (result.type === 'page') {
      showStreamAccess(result);
      return;
    }
    if (result.type === 'playlist') {
      const items = parseM3U(result.text, result.url); if (!items.length) return toast('This playlist contains no playable entries');
      L.m3u = { name: s.name, items }; libGo('network', 'm3u:' + s.name); showLibrary(true, 'full'); return;
    }
    if (result.type === 'hls') return toast('HLS playlists are not supported yet. Use a direct media link.');
    const item = itemFromUrl(result.playbackUrl || result.url, s.name || result.filename);
    item.path = result.sourceUrl || s.url; item.kind = result.kind || item.kind;
    item.originalUrl = s.url; item.mime = result.mime || ''; item.networkResolved = true;
    playItems([item], 0);
  } catch (error) { if (request === streamRequestId) toast(error.message || 'Could not open this network link'); }
}
function parseM3U(txt, base) {
  const out = []; let name = null;
  for (const line of txt.split(/\r?\n/)) {
    const l = line.trim(); if (!l) continue;
    if (l.startsWith('#EXTINF')) name = l.split(',').slice(1).join(',').trim();
    else if (!l.startsWith('#')) {
      let u; try { u = new URL(l.replace(/\\/g, '/'), base); } catch { name = null; continue; }
      if (u.protocol === 'file:') {
        const p = u.hostname ? '\\\\' + u.hostname + decodeURIComponent(u.pathname).replace(/\//g, '\\') : decodeURIComponent(u.pathname).replace(/^\/([a-z]:)/i, '$1').replace(/\//g, '\\');
        const it = itemFromPath(p); if (name) it.name = name; out.push(it);
      } else if (/^https?:$/.test(u.protocol)) out.push(itemFromUrl(u.href, name || undefined));
      name = null;
    }
  }
  return out;
}
function networkView(sc, compact) {
  if (L.path && L.path.startsWith('m3u:') && L.m3u) { sc.append(h('div', { class: 'sect-h' }, L.m3u.name, h('span', { style: { flex: 1 } }), h('button', { class: 'btn', html: ico('play') + 'Play all', onclick: () => playItems(L.m3u.items.slice(), 0) }))); const rows = h('div', { class: 'rows' }); L.m3u.items.forEach(it => { const r = h('div', { class: 'r' }, h('span', { html: ico('network') }), h('span', { class: 'nm' }, it.name)); r.addEventListener('click', () => playItems(L.m3u.items.slice(L.m3u.items.indexOf(it)), 0)); rows.append(r); }); return sc.append(rows); }
  sc.append(h('div', { class: 'sect-h' }, 'Network'));
  const rows = h('div', { class: 'rows' });
  rows.append(h('div', { class: 'r', onclick: networkDialog }, h('span', { html: ico('plus') }), h('span', { class: 'nm' }, 'Add Network Stream')));
  S.store.streams.forEach(s => { const r = h('div', { class: 'r' }, h('span', { html: ico('network') }), h('span', { class: 'nm' }, s.name), h('button', { class: 'icon-btn', html: ico('trash'), title: 'Remove', onclick: e => { e.stopPropagation(); S.store.streams = S.store.streams.filter(x => x !== s); save(); renderLib(); } })); r.addEventListener('click', () => playStream(s)); rows.append(r); });
  sc.append(rows);
  if (!S.store.streams.length) sc.append(h('div', { class: 'empty' }, 'Paste a direct video/audio link or an .m3u playlist URL (for example a public IPTV list).'));
}
function networkDialog() {
  const url = h('input', { class: 'field w-l', placeholder: 'https://example.com/video.mkv  or  list.m3u' }), name = h('input', { class: 'field w-l', placeholder: 'Name (optional)' });
  modal({ title: 'Open network stream', body: h('div', { style: { display: 'grid', gap: '10px' } }, url, name, h('div', { class: 'kbd-hint' }, 'Direct MKV/MP4/WebM/audio links and M3U playlists. The codecs must be supported. Websites may require you to sign in first.')),
    buttons: [{ label: 'Cancel' }, { label: 'Play once', action: () => { if (!url.value.trim()) return false; playStream({ name: name.value.trim() || undefined, url: url.value.trim() }); } }, { label: 'Save & play', primary: true, action: () => { const u = url.value.trim(); if (!u) return false; const s = { name: name.value.trim() || itemFromUrl(u).name, url: u }; S.store.streams.push(s); save(); playStream(s); } }] });
  setTimeout(() => url.focus(), 30);
}
function newPlaylistDialog() {
  const name = h('input', { class: 'field w-l', placeholder: 'Playlist name' }); let files = [];
  const list = h('div', { class: 'kbd-hint' }, 'No files selected yet');
  const pick = h('button', { class: 'btn', html: ico('plus') + 'Choose files…', onclick: async () => { const f = hasApi ? await api.pickFiles() : []; files = files.concat(f); list.textContent = files.length + ' file(s) selected'; } });
  const cur = S.queue.length ? h('button', { class: 'btn ghost', onclick: () => { files = S.queue.slice(); list.textContent = files.length + ' file(s) from the queue'; } }, 'Use current queue') : null;
  modal({ title: 'New playlist', body: h('div', { style: { display: 'grid', gap: '12px' } }, name, h('div', { style: { display: 'flex', gap: '8px' } }, pick, cur), list), buttons: [{ label: 'Cancel' }, { label: 'Create', primary: true, action: () => { if (!name.value.trim()) return false; S.store.playlists.push({ name: name.value.trim(), items: files.map(({ path, name, url, kind, stream }) => ({ path, name, url, kind, stream })) }); save(); libGo('playlists'); } }] });
  setTimeout(() => name.focus(), 30);
}
