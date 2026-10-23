/* ===== dialogs, menus, shortcuts, init ===== */
async function openFilesDialog(addOnly) {
  const add = addOnly === true;
  let items = [];
  if (hasApi) items = await api.pickFiles();
  else items = await new Promise(res => { const i = h('input', { type: 'file', multiple: true, accept: 'video/*,audio/*' }); i.onchange = () => res([...i.files].map(f => ({ name: f.name, path: f.name, kind: AUDIO_RE.test(f.name) ? 'audio' : 'video', url: URL.createObjectURL(f), stream: true }))); i.click(); });
  if (!items.length) return;
  if (add) enqueue(items); else playItems(items, 0);
}
async function openFolderDialog() {
  if (!hasApi) return; const d = await api.pickFolder(); if (!d) return;
  const files = (await api.scan(d)).files; if (!files.length) return toast('No media files in that folder');
  playItems(files, 0);
}
async function openCapture() {
  try { const st = await navigator.mediaDevices.getUserMedia({ video: true, audio: true }); const v = V(); v.removeAttribute('src'); v.srcObject = st; v.play(); S.cur = { name: 'Capture device', kind: 'video', stream: true, url: '', path: 'capture' }; $('#title').textContent = 'Capture device'; showLibrary(false, 'full'); }
  catch { toast('No capture device available'); }
}
async function openClipboard() { try { const t = (await navigator.clipboard.readText()).trim(); if (/^https?:\/\//.test(t)) playStream({ name: t.split('/').pop() || t, url: t }); else toast('Clipboard does not contain a link'); } catch { toast('Cannot read the clipboard'); } }

async function openExternalInputs(inputs) {
  const urls = inputs.filter(p => /^https?:\/\//i.test(p));
  const paths = inputs.filter(p => !/^https?:\/\//i.test(p));
  if (paths.length) {
    const info = await api.describe(paths), items = [];
    for (const item of info) {
      if (item.dir) items.push(...item.files);
      else if (/\.m3u8?$/i.test(item.name)) {
        const text = await api.readText(item.path);
        if (text?.includes('#EXT-X-')) { toast('HLS playlists are not supported yet.'); continue; }
        if (text) items.push(...parseM3U(text, item.url));
      } else if (MEDIA_RE.test(item.name || '')) items.push(item);
    }
    if (items.length) playItems(items, 0);
  }
  if (urls.length) await playStream({ url: urls[0] });
}

/* ---------- menus ---------- */
function appMenu(el) {
  const hk = cfg().hotkeys, kb = k => k.replace('Ctrl', 'Ctrl');
  menuAt(el, [
    { label: 'Open File…', icon: 'file', kb: 'Ctrl+O', action: () => openFilesDialog() },
    { label: 'Open Folder…', icon: 'folder', action: openFolderDialog },
    { label: 'Open Network Stream…', icon: 'network', kb: 'Ctrl+N', action: networkDialog },
    { label: 'Open Capture Device', icon: 'camera', action: openCapture },
    { label: 'Open Clipboard', icon: 'clipboard', action: openClipboard },
    { label: 'Open Recent', icon: 'recent', sub: () => S.store.recents.length ? S.store.recents.slice(0, 10).map(r => ({ label: stripExt(r.name), action: () => playItems([r], 0) })).concat(['-', { label: 'Clear recent', icon: 'trash', action: () => { S.store.recents = []; save(); renderLib(); } }]) : [{ label: 'Nothing yet', disabled: true }] },
    '-', { label: 'Keyboard Shortcuts', icon: 'keyboard', action: hotkeysDialog }, { label: 'Customize Player', icon: 'wand', action: customizeDialog },
    { label: 'Settings', icon: 'gear', kb: kb(hk.settings), action: () => settingsDialog() }, { label: 'About', icon: 'info', action: aboutDialog },
  ]);
}
function contextMenu(e) {
  e.preventDefault(); const v = V();
  showMenu([
    { label: v.paused ? 'Play' : 'Pause', icon: v.paused ? 'play' : 'pause', kb: 'Space', action: togglePlay }, { label: 'Stop', icon: 'min', action: stop },
    { label: 'Previous', icon: 'prev', kb: 'P', action: prev }, { label: 'Next', icon: 'next', kb: 'N', action: next }, '-',
    { label: 'Subtitle', icon: 'subs', sub: () => [{ label: 'Off', check: S.subIdx < 0, action: () => selectSub(-1) }, ...S.subTracks.map((t, i) => ({ label: t.name, check: S.subIdx === i, disabled: t.supported === false, action: () => selectSub(i) })), '-', { label: 'Add subtitles…', icon: 'plus', action: addSubtitlesDialog }] },
    { label: 'Audio', icon: 'audio', sub: () => [{ label: 'Equalizer', icon: 'sliders', action: () => openPanel('side', 'audio') }, { label: 'Output device…', action: () => openPanel('side', 'audio') }] },
    { label: 'Video', icon: 'video', sub: () => ['fit', 'fill', 'stretch', '16:9', '4:3', '21:9'].map(a => ({ label: 'Aspect: ' + a, check: S.store.video.aspect === a, action: () => { S.store.video.aspect = a; applyVideoFx(); save(); } })) },
    { label: 'Playback', icon: 'clock', sub: () => [0.5, 0.75, 1, 1.25, 1.5, 2].map(x => ({ label: 'Speed ' + x + '×', check: Math.abs(v.playbackRate - x) < .01, action: () => setSpeed(x) })) }, '-',
    { label: S.fullscreen ? 'Exit fullscreen' : 'Fullscreen', icon: 'fullscreen', kb: 'F', action: () => toggleFullscreen() },
    { label: 'Hide interface', icon: 'eyeoff', kb: 'Ctrl+H', action: toggleHideUI }, { label: 'Screenshot', icon: 'camera', kb: 'S', action: screenshot }, { label: 'Add bookmark', icon: 'bookmark', kb: 'Ctrl+B', action: () => addBookmark() }, '-',
    { label: 'Open File…', icon: 'file', kb: 'Ctrl+O', action: () => openFilesDialog() }, { label: 'Settings', icon: 'gear', kb: 'Ctrl+P', action: () => settingsDialog() },
  ], e.clientX, e.clientY);
}
function toggleHideUI() { S.hideui = !S.hideui; $('#app').classList.toggle('hideui', S.hideui); barsOff(S.hideui); osd(S.hideui ? 'Interface hidden — Ctrl+H or right-click to bring it back' : 'Interface shown'); setTimeout(() => { applySubStyle(); applyVideoFx(); }, 50); }

/* ---------- add subtitles (file / folder / queue) ---------- */
async function addSubtitlesDialog() {
  if (!S.cur) return toast('Open a video first');
  let scope = 'file';
  const opts = [['file', 'file', 'This file'], ['folder', 'folder', 'This folder'], ['queue', 'playlist', 'This playlist']];
  const cards = h('div', { class: 'opt-cards' }, opts.map(([id, ic, n]) => { const c = h('button', { class: 'opt-card' + (id === scope ? ' on' : ''), html: ico(ic) + `<span>${n}</span>`, onclick: () => { scope = id; $$('.opt-card', cards).forEach(x => x.classList.remove('on')); c.classList.add('on'); } }); return c; }));
  const note = h('div', { class: 'kbd-hint', style: { marginTop: '12px', lineHeight: 1.6 } }, 'Subtitle files are matched to episodes automatically (S01E02, 1x02 or episode number). The matches are saved, so they are used every time you play these files.');
  const from = h('div', { style: { display: 'flex', gap: '8px', marginTop: '14px' } },
    h('button', { class: 'btn primary', html: ico('file') + 'From this computer…', onclick: async () => { const subs = hasApi ? await api.pickFiles('subs') : []; if (!subs.length) return; m.close(); await assignSubs(scope, subs); } }),
    h('button', { class: 'btn ghost', html: ico('external') + 'Find on SubDL', onclick: () => window.open('https://subdl.com/') }));
  const embedded = h('div', { style: { marginTop: '18px' } });
  const m = modal({ title: 'Add subtitles to…', body: h('div', {}, cards, from, note, embedded) });
  if (hasApi && api.subtitleTracks && S.cur.kind === 'video' && !S.cur.stream) {
    const item = S.cur;
    embedded.append(h('div', { class: 'kbd-hint' }, 'Reading subtitles in this video…'));
    await loadEmbeddedSubtitles(item);
    if (S.cur !== item || !m.el.isConnected) return;
    embedded.replaceChildren(h('div', { class: 'sec-t' }, 'Subtitles in this video'));
    const tracks = S.subTracks.map((track, i) => ({ track, i })).filter(({ track }) => track.embedded);
    if (!tracks.length) embedded.append(h('div', { class: 'kbd-hint' }, 'No embedded subtitle tracks found. You can add a subtitle file from this computer or find one on SubDL.'));
    tracks.forEach(({ track, i }) => embedded.append(h('button', { class: 'btn ghost', style: { display: 'flex', width: '100%', marginTop: '6px' }, disabled: track.supported === false, onclick: () => { m.close(); selectSub(i); } }, track.name)));
  }
}
async function assignSubs(scope, subs) {
  let media = [S.cur];
  if (scope === 'folder' && S.cur.path && hasApi) media = (await api.scan(dirName(S.cur.path))).files;
  else if (scope === 'queue') media = S.queue.slice();
  media = media.filter(x => x.path && !x.stream); const sorted = subs.slice().sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  const byKey = {}; sorted.forEach(p => { const k = subKey(baseName(p)); if (k) (byKey[k] = byKey[k] || []).push(p); });
  const msorted = media.slice().sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true })); let n = 0;
  msorted.forEach((it, i) => {
    let match = scope === 'file' ? sorted : (byKey[subKey(it.name)] || (sorted.length === msorted.length ? [sorted[i]] : []));
    if (match.length) { S.store.subMap[it.path] = match; n++; }
  });
  save(); toast(`Subtitles matched to ${n} of ${media.length} file${media.length > 1 ? 's' : ''}`);
  S.subTracks = []; S.subIdx = -1; clearSubText(); await autoLoadSubs(S.cur); renderPanel();
}

/* ---------- hotkeys ---------- */
const HK_LABELS = { playpause: 'Play / Pause', seekfwd: 'Seek forward (short)', seekback: 'Seek back (short)', seekfwdL: 'Seek forward (long)', seekbackL: 'Seek back (long)', volup: 'Volume up', voldown: 'Volume down', mute: 'Mute', fullscreen: 'Fullscreen', next: 'Next', prev: 'Previous', bookmark: 'Add bookmark', subdelayminus: 'Subtitles earlier', subdelayplus: 'Subtitles later', speedup: 'Faster', speeddown: 'Slower', speedreset: 'Normal speed', hideui: 'Hide interface', open: 'Open file', queue: 'Toggle queue', settings: 'Settings', screenshot: 'Screenshot', frameNext: 'Next frame', framePrev: 'Previous frame', library: 'Toggle library' };
function comboFromEvent(e) { if (['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) return null; let k = e.key === ' ' ? 'Space' : e.key.length === 1 ? e.key.toLowerCase() : e.key; return (e.ctrlKey ? 'Ctrl+' : '') + (e.altKey ? 'Alt+' : '') + (e.shiftKey && k.length > 1 ? 'Shift+' : '') + k; }
function hotkeysDialog() {
  const hk = cfg().hotkeys; let rec = null; const body = h('div', {});
  const draw = () => { body.innerHTML = ''; const t = h('table', { class: 'kbtable' });
    Object.keys(HK_LABELS).forEach(id => { const cap = h('button', { class: 'keycap' + (rec === id ? ' rec' : ''), onclick: () => { rec = id; draw(); } }, rec === id ? 'Press a key…' : hk[id]); t.append(h('tr', {}, h('td', {}, HK_LABELS[id]), h('td', { style: { textAlign: 'right' } }, cap))); });
    body.append(t); };
  draw();
  const handler = e => { if (!rec) return; e.preventDefault(); e.stopPropagation(); const c = comboFromEvent(e); if (!c) return; if (c === 'Escape') { rec = null; return draw(); } const dup = Object.keys(hk).find(k => hk[k] === c && k !== rec); if (dup) { hk[dup] = hk[rec]; } hk[rec] = c; rec = null; save(); draw(); };
  addEventListener('keydown', handler, true);
  modal({ title: 'Keyboard shortcuts', body, buttons: [{ label: 'Reset to defaults', action: () => { Object.assign(hk, DEFAULTS.settings.hotkeys); save(); return false; } , primary: false }, { label: 'Done', primary: true }], onClose: () => removeEventListener('keydown', handler, true) });
}

/* ---------- customize ---------- */
function customizeDialog() {
  const L2 = cfg().layout; const body = h('div', {});
  const draw = () => {
    body.innerHTML = ''; body.append(h('div', { class: 'kbd-hint', style: { marginBottom: '10px' } }, 'Click a tile to add or remove it from the control bar. Drag the buttons in the preview to reorder them.'));
    const grid = h('div', { class: 'cust-grid' });
    Object.keys(CTL).forEach(id => { const on = L2.left.includes(id) || L2.right.includes(id), c = CTL[id], t = h('button', { class: 'cust-tile' + (on ? ' on' : ''), html: (c.icon ? ico(c.icon) : ico('volume')) + `<span>${CTL_LABELS[id]}</span>`, onclick: () => { if (on) { L2.left = L2.left.filter(x => x !== id); L2.right = L2.right.filter(x => x !== id); } else (['prev', 'play', 'next', 'stop'].includes(id) ? L2.left : L2.right).push(id); save(); renderControls(); draw(); } }); grid.append(t); });
    body.append(grid, h('div', { class: 'sec-t', style: { margin: '18px 0 8px' } }, 'Preview'));
    ['left', 'right'].forEach(side => {
      const bar = h('div', { class: 'cust-bar', style: { marginBottom: '8px' } }, h('span', { class: 'kbd-hint', style: { width: '48px' } }, side === 'left' ? 'Left' : 'Right'));
      L2[side].forEach((id, i) => { const b = h('div', { class: 'ctl', draggable: true, title: CTL_LABELS[id], html: CTL[id].icon ? ico(CTL[id].icon) : ico('volume') });
        b.addEventListener('dragstart', e => e.dataTransfer.setData('text/x-ctl', side + ':' + i)); b.addEventListener('dragover', e => e.preventDefault());
        b.addEventListener('drop', e => { e.preventDefault(); const [s, j] = e.dataTransfer.getData('text/x-ctl').split(':'); if (s !== side) return; const [x] = L2[side].splice(+j, 1); L2[side].splice(i, 0, x); save(); renderControls(); draw(); }); bar.append(b); });
      body.append(bar);
    });
  };
  draw();
  modal({ title: 'Customize player', body, wide: true, buttons: [{ label: 'Reset layout', action: () => { cfg().layout = JSON.parse(JSON.stringify(DEFAULTS.settings.layout)); save(); renderControls(); return true; } }, { label: 'Done', primary: true }] });
}

/* ---------- settings ---------- */
const ACCENTS = ['#f58a00', '#e5484d', '#e93d82', '#8e4ec6', '#3e63dd', '#0091ff', '#12a594', '#46a758', '#ffc53d', '#9ba1a6'];
function settingsDialog(startCat) {
  const c = cfg(), st = S.store; let cat = startCat || 'General';
  const info = t => h('span', { class: 'info-i', title: t, html: ico('info') });
  const row = (label, ctrl, i) => h('div', { class: 'row' }, h('label', {}, label), i ? info(i) : null, ctrl);
  const tog = (k, label, i, after) => row(label, toggle(c[k], on => { c[k] = on; save(); after && after(on); }), i);
  const sel = (k, label, opts, i, after) => row(label, selectField(opts, c[k], v => { c[k] = isNaN(+v) || typeof opts[0][0] === 'string' && isNaN(+opts[0][0]) ? v : (typeof c[k] === 'number' ? +v : v); save(); after && after(v); }), i);
  const pages = {
    General: [{ icon: 'gear' }, b => {
      b.append(h('h4', {}, 'Appearance'));
      b.append(row('Theme', h('div', { class: 'seg' }, ['system', 'dark', 'light'].map(t => h('button', { class: c.theme === t ? 'on' : '', onclick: e => { c.theme = t; save(); applyTheme(); $$('.seg button', e.target.parentElement).forEach(x => x.classList.remove('on')); e.target.classList.add('on'); } }, t[0].toUpperCase() + t.slice(1))))));
      const sw = h('div', { class: 'swatches' }, ACCENTS.map(a => h('button', { class: 'swatch' + (c.accent === a ? ' on' : ''), style: { background: a }, onclick: () => { c.accent = a; save(); applyTheme(); drawWave(); $$('.swatch', sw).forEach(x => x.classList.toggle('on', x.style.background && x === event.currentTarget)); } })));
      b.append(row('Accent colour', sw, 'Change the orange to any colour you like'), row('Custom colour', h('input', { type: 'color', value: c.accent, oninput: e => { c.accent = e.target.value; save(); applyTheme(); } })));
      b.append(h('h4', {}, 'Startup'), h('div', { class: 'row' }, h('button', { class: 'btn', onclick: () => onboarding() }, 'Show welcome screen')));
      if (hasApi && api.registerBrowserLinks) b.append(h('h4', {}, 'Browser playback'), row('Open website player links in Cono', h('button', { class: 'btn', onclick: async () => {
        const result = await api.registerBrowserLinks();
        toast(result.every(x => x.registered) ? 'Cono registered for Cono and VLC links. Windows may ask you to choose a default app.' : 'Windows could not register every link. Install Cono and choose it as the default for VLC links.');
      } }, 'Use Cono'), 'Registers cono:// and vlc:// links for this Windows account. This can replace VLC as the handler for website player links.'));
    }],
    Interface: [{ icon: 'sidebar' }, b => {
      b.append(h('h4', {}, 'Window'), tog('ontop', 'Keep window on top', null, on => hasApi && api.onTop(on)), tog('dblFs', 'Double-click video toggles fullscreen'), tog('clickPlay', 'Click video to play / pause'));
      b.append(h('h4', {}, 'Controls'), tog('autoHide', 'Hide bars in fullscreen until the mouse is near them', 'The top and bottom bars appear when you move to the edge of the screen'), tog('thumbs', 'Show preview thumbnail when seeking'));
    }],
    Privacy: [{ icon: 'lock' }, b => {
      b.append(h('h4', {}, 'History'), tog('history', 'Remember recently played files'), tog('keepQueue', 'Remember the queue between sessions'), tog('resume', 'Ask to resume unfinished videos', 'Music always starts from the beginning'));
      b.append(h('div', { class: 'row' }, h('button', { class: 'btn ghost', onclick: () => { st.recents = []; save(); renderLib(); toast('History cleared'); } }, 'Clear history'), h('button', { class: 'btn ghost', onclick: () => { st.resume = {}; save(); toast('Resume points cleared'); } }, 'Clear resume points')));
    }],
    Controls: [{ icon: 'mouse' }, b => {
      b.append(h('h4', {}, 'Keyboard'), h('div', { class: 'row' }, h('button', { class: 'btn', html: ico('keyboard') + 'Keyboard shortcuts…', onclick: hotkeysDialog })));
      b.append(h('h4', {}, 'Mouse'), sel('wheel', 'Mouse wheel on video', [['volume', 'Changes volume'], ['seek', 'Seeks'], ['none', 'Does nothing']]));
      b.append(sel('seekShort', 'Short jump', [[5, '5 seconds'], [10, '10 seconds'], [15, '15 seconds']]), sel('seekLong', 'Long jump', [[30, '30 seconds'], [60, '1 minute'], [300, '5 minutes']]));
    }],
    Playback: [{ icon: 'play' }, b => {
      b.append(h('h4', {}, 'Queue'), tog('autoNext', 'Play the next item automatically'), sel('repeat', 'Repeat', [['off', 'Off'], ['all', 'Whole queue'], ['one', 'Current item']]), tog('shuffle', 'Shuffle'));
      b.append(h('h4', {}, 'Speed'), tog('rememberSpeed', 'Remember playback speed between files'));
    }],
    Video: [{ icon: 'video' }, b => {
      b.append(h('h4', {}, 'Picture'), sel2(st.video, 'aspect', 'Default aspect ratio', [['fit', 'Fit to window'], ['fill', 'Fill (crop)'], ['stretch', 'Stretch'], ['16:9', '16:9'], ['4:3', '4:3'], ['21:9', '21:9']], () => { applyVideoFx(); save(); }));
      b.append(h('div', { class: 'row' }, h('button', { class: 'btn ghost', onclick: () => { Object.assign(st.video, DEFAULTS.video); applyVideoFx(); save(); toast('Video filters reset'); } }, 'Reset all filters')));
    }],
    Audio: [{ icon: 'audio' }, b => {
      b.append(h('h4', {}, 'Volume'), sliderRow('Default volume', 0, 100, 1, Math.round(c.volume * 100), x => x + '%', x => { setVolume(x / 100, true); }), sliderRow('Volume boost', 0, 200, 5, Math.round(c.gain * 100), x => x + '%', x => { c.gain = x / 100; applyAudioFx(); save(); }));
      b.append(h('h4', {}, 'Equalizer'), sel('eq', 'Preset', Object.keys(EQ_PRESETS).map(k => [k, k[0].toUpperCase() + k.slice(1)]), null, () => applyAudioFx()));
    }],
    Subtitles: [{ icon: 'subs' }, b => {
      b.append(h('h4', {}, 'Subtitle files'), tog('autoSubs', 'Detect subtitle files automatically'),
        sel('subMatch', 'Match subtitle files that…', [['none', 'Are never matched'], ['any', 'Are the only file for that episode'], ['contains', 'Start with the video’s name'], ['exact', 'Have exactly the video’s name']], 'How strictly subtitle file names must match the movie file name'),
        row('Appearance', h('button', { class: 'btn', onclick: () => openPanel('side', 'subs') }, 'Open in sidebar')));
      b.append(h('h4', {}, 'On-screen display'), tog('osdKeys', 'Show the pressed keyboard shortcut next to messages'));
    }],
    Library: [{ icon: 'folder' }, b => {
      b.append(h('h4', {}, 'View'), sel('libView', 'Default view', [['grid', 'Grid'], ['list', 'List'], ['detail', 'Details']], null, () => renderLib()), sel('libSort', 'Sort by', [['name', 'Name'], ['date', 'Date modified'], ['size', 'Size'], ['unwatched', 'Unwatched first'], ['watched', 'Watched first']], null, () => renderLib()));
      b.append(h('h4', {}, 'Folders'));
      if (!st.library.folders.length) b.append(h('div', { class: 'kbd-hint' }, 'No folders added yet.'));
      st.library.folders.forEach(f => b.append(h('div', { class: 'tl-chip' }, h('span', { class: 'l', style: { color: 'var(--text)' } }, f.path + '  ·  ' + f.kind), h('button', { class: 'icon-btn', html: ico('trash'), onclick: () => { st.library.folders = st.library.folders.filter(x => x !== f); save(); renderLib(); draw(); } }))));
      b.append(h('div', { class: 'row' }, h('button', { class: 'btn', onclick: () => addLibFolder('video').then(draw) }, 'Add video folder'), h('button', { class: 'btn', onclick: () => addLibFolder('music').then(draw) }, 'Add music folder')));
    }],
    Network: [{ icon: 'network' }, b => {
      b.append(h('h4', {}, 'Saved streams'));
      if (!st.streams.length) b.append(h('div', { class: 'kbd-hint' }, 'No saved streams.'));
      st.streams.forEach(s => b.append(h('div', { class: 'tl-chip' }, h('span', { class: 'l', style: { color: 'var(--text)' } }, s.name), h('button', { class: 'icon-btn', html: ico('trash'), onclick: () => { st.streams = st.streams.filter(x => x !== s); save(); draw(); } }))));
      b.append(h('div', { class: 'row' }, h('button', { class: 'btn', onclick: networkDialog }, 'Add network stream…')), h('div', { class: 'warn' }, 'Streams are played by Chromium’s media stack: direct MP4/WebM/MP3 links and M3U lists work. HLS/DASH need an additional engine.'));
    }],
    About: [{ icon: 'info' }, b => { b.append(aboutBody()); }],
  };
  const root = h('div', { class: 'settings' }), nav = h('div', { class: 'snav' }), main = h('div', { class: 'sbody' });
  root.append(nav, main);
  function draw() {
    nav.innerHTML = ''; Object.keys(pages).forEach(k => nav.append(h('button', { class: 'nav-i' + (cat === k ? ' on' : ''), html: ico(pages[k][0].icon) + `<span>${k}</span>`, onclick: () => { cat = k; draw(); } })));
    main.innerHTML = ''; main.append(h('div', { class: 'panel-head' }, h('h3', {}, cat)));
    const sc = h('div', { class: 'scroll' }); main.append(sc); pages[cat][1](sc);
  }
  function sel2(obj, k, label, opts, after) { return row(label, selectField(opts, obj[k], v => { obj[k] = v; after && after(v); })); }
  draw();
  modal({ title: 'Settings', body: root, wide: true });
  const mb = $('.modal-b:last-of-type', $('#modalLayer').lastChild); if (mb) mb.style.padding = '0';
}
function aboutBody() { return h('div', { class: 'sec' }, h('div', { class: 'logo', style: { width: '56px', height: '56px' }, html: APP_LOGO }), h('h3', { style: { margin: '12px 0 4px', fontSize: '18px' } }, 'Cono'), h('div', { class: 'kbd-hint' }, 'Version 1.0.1 · A modern audio and video player inspired by the “I Redesigned VLC After 25 Years” design study. Not affiliated with VideoLAN.'), h('div', { class: 'warn', style: { marginTop: '14px' } }, 'Playback uses Chromium’s media engine: MP4/H.264, WebM, MKV (H.264/VP9), MP3, FLAC, AAC, Opus, WAV, OGG. Formats such as AVI, WMV or DTS audio need a native engine like libVLC.')); }
function aboutDialog() { modal({ title: 'About', body: aboutBody(), buttons: [{ label: 'Close', primary: true }] }); }

/* ---------- onboarding ---------- */
function onboarding() {
  const c = cfg(); const body = h('div', { style: { display: 'grid', gap: '16px' } });
  const themeCards = h('div', { class: 'opt-cards' }, [['dark', 'moon', 'Dark'], ['light', 'sun', 'Light'], ['system', 'gear', 'System']].map(([id, ic, n]) => { const b = h('button', { class: 'opt-card' + (c.theme === id ? ' on' : ''), html: ico(ic) + `<span>${n}</span>`, onclick: () => { c.theme = id; applyTheme(); save(); $$('.opt-card', themeCards).forEach(x => x.classList.remove('on')); b.classList.add('on'); } }); return b; }));
  const sw = h('div', { class: 'swatches' }, ACCENTS.map(a => { const b = h('button', { class: 'swatch' + (c.accent === a ? ' on' : ''), style: { background: a }, onclick: () => { c.accent = a; applyTheme(); save(); $$('.swatch', sw).forEach(x => x.classList.remove('on')); b.classList.add('on'); } }); return b; }));
  const keys = [['Space', 'Play / Pause'], ['← →', 'Seek 5 s'], ['↑ ↓', 'Volume'], ['F', 'Fullscreen'], ['Ctrl+B', 'Bookmark'], ['Q', 'Queue']];
  body.append(h('div', {}, h('div', { class: 'sec-t' }, 'Theme'), themeCards), h('div', {}, h('div', { class: 'sec-t' }, 'Accent colour'), sw),
    h('div', {}, h('div', { class: 'sec-t' }, 'Essential shortcuts'), h('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 18px' } }, keys.map(([k, n]) => h('div', { class: 'row', style: { minHeight: '26px' } }, h('span', { class: 'keycap' }, k), h('label', {}, n))))));
  modal({ title: 'Welcome to Cono', body, buttons: [{ label: 'Get started', primary: true, action: () => { c.onboarded = true; save(); } }], onClose: () => { c.onboarded = true; save(); } });
}

/* ---------- keyboard ---------- */
const ACTIONS = {
  playpause: togglePlay, seekfwd: () => seekBy(cfg().seekShort), seekback: () => seekBy(-cfg().seekShort), seekfwdL: () => seekBy(cfg().seekLong), seekbackL: () => seekBy(-cfg().seekLong),
  volup: () => setVolume(volumeLevel() + .05), voldown: () => setVolume(volumeLevel() - .05), mute: toggleMute, fullscreen: () => toggleFullscreen(), next, prev, bookmark: () => addBookmark(),
  subdelayminus: () => setSubDelay(S.store.sub.delay - .1), subdelayplus: () => setSubDelay(S.store.sub.delay + .1), speedup: () => setSpeed(V().playbackRate + .25), speeddown: () => setSpeed(V().playbackRate - .25), speedreset: () => setSpeed(1),
  hideui: toggleHideUI, open: () => openFilesDialog(), queue: () => togglePanel('queue'), settings: () => settingsDialog(), screenshot, frameNext: () => stepFrame(1), framePrev: () => stepFrame(-1), library: () => showLibrary(S.view !== 'library', 'full'),
};
function onKey(e) {
  if (e.target.matches('input,textarea,select') || e.defaultPrevented) return;
  if (resumePrompt) { if (e.key === 'Escape') { e.preventDefault(); resumePrompt.close(); } return; }
  if (e.key === 'Escape') { if (S.fullscreen) toggleFullscreen(false); else if (S.view !== 'library') returnToList(); else if (S.cur) showLibrary(false, 'full'); return; }
  const combo = comboFromEvent(e); if (!combo) return;
  const id = Object.keys(cfg().hotkeys).find(k => cfg().hotkeys[k] === combo); if (!id) return;
  if (e.ctrlKey && id === 'open') e.preventDefault();
  e.preventDefault(); ACTIONS[id] && ACTIONS[id](); if (['seekfwd', 'seekback', 'volup', 'voldown'].includes(id)) {} 
  if (id === 'playpause') osd(V().paused ? 'Paused' : 'Playing', cfg().hotkeys.playpause);
}

/* ---------- auto-hide bars ---------- */
let idleT;
function barsOff(off) { $('#app').classList.toggle('bars-off', off); }
function kickIdle() {
  const a = $('#app'); a.classList.remove('cursor-off'); clearTimeout(idleT);
  if (S.fullscreen && !a.classList.contains('workspace-view')) idleT = setTimeout(() => a.classList.add('cursor-off'), 2600);
}
function onMouseMove(e) {
  kickIdle();
  if (S.hideui) return barsOff(true);
  if ($('#app').classList.contains('workspace-view')) return barsOff(false);
  if (!S.fullscreen || !cfg().autoHide) return barsOff(false);
  const nearTop = e.clientY < 90, nearBottom = e.clientY > innerHeight - 110;
  barsOff(!(nearTop || nearBottom || $('#menuLayer').firstChild || $('#modalLayer').firstChild));
}

/* ---------- init ---------- */
async function init() {
  await loadStore(); applyTheme(); hydrateIcons();
  const v = V(); v.volume = volumeGain(volumeLevel()); v.muted = cfg().muted;
  renderControls(); initSeek(); initSubTimelineDrag(); applySubStyle(); applyStrip(); renderLib();
  $('#musicShuffle').onclick = () => { CTL.shuffle.act(); updateMusicState(); };
  $('#musicRepeat').onclick = () => { CTL.repeat.act(); updateMusicState(); };
  $('#musicQueue').onclick = $('#musicViewQueue').onclick = () => togglePanel('queue');
  const A = $('#app');
  $('#btnMenu').onclick = e => appMenu(e.currentTarget);
  $('#btnLib').onclick = toggleLibrarySidebar;
  $('#btnBack').onclick = () => libBack(-1);
  $('#btnForward').onclick = () => libBack(1);
  $('#btnReturnList').onclick = returnToList;
  $('#btnFolder').onclick = () => S.view === 'library' ? showLibrary(false, 'full') : returnToList();
  $('#btnLogo').onclick = () => { libGo('home'); showLibrary(true, 'full'); };
  $('#btnFs').onclick = () => toggleFullscreen(); $('#btnPip').onclick = togglePip;
  $('#wMin').onclick = () => hasApi && api.minimize(); $('#wMax').onclick = () => hasApi && api.maximize(); $('#wClose').onclick = () => hasApi ? api.close() : window.close();
  if (hasApi) { api.onState(s => { if ('fullscreen' in s) setFullscreenState(s.fullscreen); if ('maximized' in s) { S.maximized = s.maximized; $('#wMax').innerHTML = ico(s.maximized ? 'restore' : 'max'); } }); api.onOpen(openExternalInputs); }
  document.addEventListener('fullscreenchange', () => { if (!hasApi) setFullscreenState(!!document.fullscreenElement); });
  document.addEventListener('keydown', onKey); document.addEventListener('mousemove', onMouseMove);
  $('#stage').addEventListener('contextmenu', contextMenu);
  $('#player').addEventListener('click', e => { if (e.target.closest('button,#subs,#metaCard,#artwork')) return; if (cfg().clickPlay && S.cur) togglePlay(); else if (!S.cur) openFilesDialog(); });
  $('#player').addEventListener('dblclick', e => { if (!e.target.closest('button,#artwork') && cfg().dblFs) toggleFullscreen(); });
  $('#player').addEventListener('wheel', e => { if (e.target.closest('#artwork')) return; const w = cfg().wheel; if (w === 'volume') setVolume(volumeLevel() + (e.deltaY < 0 ? .05 : -.05)); else if (w === 'seek') seekBy(e.deltaY < 0 ? cfg().seekShort : -cfg().seekShort); }, { passive: true });
  v.addEventListener('click', () => {});
  // drag & drop
  let dc = 0; const hint = $('#dropHint');
  addEventListener('dragenter', e => { if (e.dataTransfer.types.includes('Files')) { dc++; hint.classList.remove('hidden'); } });
  addEventListener('dragleave', () => { dc = Math.max(0, dc - 1); if (!dc) hint.classList.add('hidden'); });
  addEventListener('dragover', e => e.preventDefault());
  addEventListener('drop', async e => { e.preventDefault(); dc = 0; hint.classList.add('hidden'); if (e.defaultPrevented && e.target.closest('#rightPanel')) return; const items = await itemsFromDrop(e); if (!items.length) return; if (e.target.closest('#rightPanel')) enqueue(items); else playItems(items, 0); });
  addEventListener('resize', () => { applySubStyle(); applyVideoFx(); drawWave(); drawSubTimeline(); });
  matchMedia('(prefers-color-scheme: light)').addEventListener('change', () => cfg().theme === 'system' && applyTheme());
  if (cfg().ontop && hasApi) api.onTop(true);
  // restore queue (no autoplay)
  if (cfg().keepQueue && S.store.queue.length) { S.queue = S.store.queue.filter(x => !x.stream || /^https?:/.test(x.url)); S.idx = -1; }
  if (!S.store.playlists) S.store.playlists = [];
  showLibrary(true, 'full');
  if (!cfg().onboarded) onboarding();
  window.__ready = true;
  if (hasApi && api.readyForOpen) {
    try { await openExternalInputs(await api.readyForOpen()); } catch (error) { toast(error.message || 'Could not open the browser link'); }
  }
}
init();
