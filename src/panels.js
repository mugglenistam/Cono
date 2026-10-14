/* ===== controls bar + right-hand panels (sidebar tabs & queue) ===== */
const CTL = {
  prev: { icon: 'prev', title: 'Previous (P)', act: () => prev() },
  play: { icon: 'play', title: 'Play / Pause (Space)', act: () => togglePlay(), cls: 'play' },
  next: { icon: 'next', title: 'Next (N)', act: () => next() },
  stop: { icon: 'min', title: 'Stop', act: () => stop() },
  shuffle: { icon: 'shuffle', title: 'Shuffle', act: () => { cfg().shuffle = !cfg().shuffle; save(); osd('Shuffle ' + (cfg().shuffle ? 'on' : 'off')); renderControls(); renderQueue(); }, on: () => cfg().shuffle },
  repeat: { icon: 'repeat', title: 'Repeat', act: () => { const o = ['off', 'all', 'one']; cfg().repeat = o[(o.indexOf(cfg().repeat) + 1) % 3]; save(); osd('Repeat: ' + cfg().repeat); renderControls(); renderQueue(); }, on: () => cfg().repeat !== 'off' },
  volume: { special: 'volume' },
  audio: { icon: 'audio', title: 'Audio tracks & output', act: (e, el) => audioMenu(el) },
  subs: { icon: 'subs', title: 'Subtitles', act: (e, el) => subsMenu(el), badge: () => S.subIdx >= 0 },
  settings: { icon: 'gear', title: 'Playback settings', act: () => togglePanel('side'), on: () => S.panel === 'side' },
  queue: { icon: 'queue', title: 'Queue (Q)', act: () => togglePanel('queue'), on: () => S.panel === 'queue' },
  bookmark: { icon: 'bookmark', title: 'Add bookmark (Ctrl+B)', act: () => addBookmark() },
  screenshot: { icon: 'camera', title: 'Screenshot (S)', act: () => screenshot() },
  speed: { icon: 'clock', title: 'Playback speed', act: (e, el) => menuAt(el, [0.5, 0.75, 1, 1.25, 1.5, 2, 3].map(x => ({ label: x + '×', check: Math.abs(cfg().speed - x) < .01, action: () => setSpeed(x) })), 'right') },
};
const CTL_LABELS = { prev: 'Previous', play: 'Play / Pause', next: 'Next', stop: 'Stop', shuffle: 'Shuffle', repeat: 'Repeat', volume: 'Volume', audio: 'Audio', subs: 'Subtitles', settings: 'Playback settings', queue: 'Queue', bookmark: 'Bookmark', screenshot: 'Screenshot', speed: 'Speed' };

function ctlButton(id) {
  const c = CTL[id]; if (!c) return null;
  if (c.special === 'volume') return volumeControl();
  const b = h('button', { class: 'ctl ' + (c.cls || '') + (c.on && c.on() ? ' on' : '') + (c.badge && c.badge() ? ' badge' : ''), title: c.title, 'data-id': id, html: ico(c.icon) });
  b.addEventListener('click', e => c.act(e, b));
  return b;
}
function renderControls() {
  const L = cfg().layout, l = $('#ctlLeft'), r = $('#ctlRight'); l.innerHTML = ''; r.innerHTML = '';
  L.left.forEach(id => { const b = ctlButton(id); b && l.append(b); });
  L.right.forEach(id => { const b = ctlButton(id); b && r.append(b); });
  updateVolumeUI(); updateTimes();
}
function refreshNav() { $$('#ctlRight .ctl, #ctlLeft .ctl').forEach(b => { const c = CTL[b.dataset.id]; if (!c) return; b.classList.toggle('on', !!(c.on && c.on())); b.classList.toggle('badge', !!(c.badge && c.badge())); }); }

function volumeControl() {
  const w = h('div', { class: 'vol' });
  const m = h('button', { class: 'ctl dim', title: 'Mute (M)', id: 'btnMute', html: ico('volume') }); m.addEventListener('click', toggleMute);
  const cone = h('div', { class: 'cone', id: 'cone', role: 'slider', tabindex: 0, 'aria-label': 'Volume', 'aria-valuemin': 0, 'aria-valuemax': 100 }, h('div', { class: 'shape' }, h('div', { class: 'shape fill' })));
  const set = e => { const r = cone.getBoundingClientRect(); setVolume((e.clientX - r.left) / r.width, true); osd('Volume ' + Math.round(V().volume * 100) + '%'); };
  let d = false;
  cone.addEventListener('pointerdown', e => { d = true; cone.setPointerCapture(e.pointerId); set(e); });
  cone.addEventListener('pointermove', e => d && set(e)); cone.addEventListener('pointerup', () => d = false);
  cone.addEventListener('lostpointercapture', () => d = false);
  cone.addEventListener('keydown', e => {
    const values = { ArrowRight: V().volume + .05, ArrowUp: V().volume + .05, ArrowLeft: V().volume - .05, ArrowDown: V().volume - .05, Home: 0, End: 1 };
    if (!(e.key in values)) return;
    e.preventDefault(); e.stopPropagation(); setVolume(values[e.key]);
  });
  cone.addEventListener('wheel', e => { e.preventDefault(); setVolume(V().volume + (e.deltaY < 0 ? .05 : -.05)); });
  w.append(m, cone); return w;
}
function updateVolumeUI() {
  const v = V(), f = $('#cone .fill'), m = $('#btnMute'); if (!f) return;
  const volume = v.muted ? 0 : v.volume, cone = $('#cone');
  f.style.width = volume * 100 + '%';
  cone.style.setProperty('--volume-color', `hsl(${120 * (1 - volume)} 65% 48%)`);
  cone.classList.toggle('muted', v.muted);
  cone.setAttribute('aria-valuenow', String(Math.round(volume * 100)));
  cone.title = 'Volume ' + Math.round(volume * 100) + '%';
  m.innerHTML = ico(v.muted || v.volume === 0 ? 'mute' : 'volume');
}

/* ---------- quick menus from the control bar ---------- */
function subsMenu(el) {
  const items = [{ head: 'Subtitles' }, { label: 'Off', check: S.subIdx < 0, action: () => selectSub(-1) }];
  S.subTracks.forEach((t, i) => items.push({ label: t.name, check: S.subIdx === i, action: () => selectSub(i) }));
  items.push('-', { label: 'Add subtitles…', icon: 'plus', action: () => addSubtitlesDialog() }, { label: 'Subtitle settings', icon: 'sliders', action: () => openPanel('side', 'subs') });
  menuAt(el, items, 'right');
}
async function audioMenu(el) {
  const devs = await listAudioDevices(); const cur = V().sinkId || 'default';
  const items = [{ head: 'Audio output' }];
  if (!devs.length) items.push({ label: 'Default output', check: true });
  devs.forEach(d => items.push({ label: d.label || 'Output ' + d.deviceId.slice(0, 6), check: d.deviceId === cur, action: () => setAudioDevice(d.deviceId) }));
  items.push('-', { label: 'Audio settings', icon: 'sliders', action: () => openPanel('side', 'audio') });
  menuAt(el, items, 'right');
}

/* ---------- right panel ---------- */
function togglePanel(name) { if (S.panel === name) closePanel(); else openPanel(name); }
function openPanel(name, tab) { S.panel = name; if (tab) S.panelTab = tab; $('#rightPanel').classList.remove('hidden'); renderPanel(); afterLayout(); }
function closePanel() { S.panel = null; $('#rightPanel').classList.add('hidden'); refreshNav(); afterLayout(); }
function afterLayout() { setTimeout(() => { applySubStyle(); applyVideoFx(); drawWave(); drawSubTimeline(); }, 30); refreshNav(); }
function renderPanel() {
  const p = $('#rightPanel'); if (!S.panel) return;
  if (S.panel === 'queue') return renderQueue();
  const keep = $('.scroll', p)?.scrollTop || 0;
  p.innerHTML = '';
  const tabs = [['subs', 'Subtitles', 'subs'], ['audio', 'Audio', 'audio'], ['video', 'Video', 'video'], ['play', 'Playback', 'sliders']];
  p.append(h('div', { class: 'panel-head' }, h('h3', {}, 'Playback settings'), h('button', { class: 'icon-btn', html: ico('close'), onclick: closePanel })));
  p.append(h('div', { class: 'tabs' }, tabs.map(([id, label, ic]) => h('button', { class: 'tab' + (S.panelTab === id ? ' on' : ''), onclick: () => { S.panelTab = id; renderPanel(); }, html: ico(ic) + `<span>${label}</span>` }))));
  const sc = h('div', { class: 'scroll' }); p.append(sc);
  ({ subs: tabSubs, audio: tabAudio, video: tabVideo, play: tabPlay })[S.panelTab](sc);
  sc.scrollTop = keep; refreshNav();
}
function sRow(label, ctrl, valEl, hint) {
  return h('div', { class: 'row' }, h('label', {}, label, hint ? h('span', { class: 'hint' }, hint) : null), ctrl, valEl);
}
function sliderRow(label, min, max, step, val, fmtf, on, hint) {
  const v = h('span', { class: 'val' }, fmtf(val));
  const r = rangeInput(min, max, step, val, x => { v.textContent = fmtf(x); on(x); });
  const row = h('div', { class: 'row', style: { flexWrap: 'wrap' } }, h('label', { style: { flexBasis: '100%' } }, label, hint ? h('span', { class: 'hint' }, hint) : null), r, v);
  return row;
}
function selectField(opts, val, on, cls = 'w-m') {
  const s = h('select', { class: 'field ' + cls }, opts.map(o => { const [v, l] = Array.isArray(o) ? o : [o, o]; return h('option', { value: v, selected: String(v) === String(val) }, l); }));
  s.addEventListener('change', () => on(s.value)); return s;
}
function tabSubs(sc) {
  const s = S.store.sub;
  let sec = h('div', { class: 'sec' }, h('div', { class: 'sec-t' }, 'Track'));
  sec.append(sRow('Subtitle track', selectField([['-1', 'Off'], ...S.subTracks.map((t, i) => [i, t.name])], S.subIdx, v => selectSub(+v), 'w-m')));
  sec.append(h('div', { class: 'row' }, h('button', { class: 'btn', onclick: addSubtitlesDialog, html: ico('plus') + 'Add subtitles…' }), h('button', { class: 'btn ghost', onclick: () => hasApi ? window.open('https://www.opensubtitles.org') : open('https://www.opensubtitles.org'), html: ico('external') + 'OpenSubtitles' })));
  sc.append(sec);
  sec = h('div', { class: 'sec' }, h('div', { class: 'sec-t' }, 'Timing'));
  sec.append(sliderRow('Subtitle delay', -30, 30, 0.1, s.delay, x => (x > 0 ? '+' : '') + x.toFixed(1) + ' s', x => { s.delay = x; renderSubs(); drawSubTimeline(); save(); }, 'Positive = later. Drag the timeline strip to sync by eye.'));
  sec.append(sRow('Show subtitle timeline', toggle(cfg().subTimeline, on => { cfg().subTimeline = on; applyStrip(); save(); })));
  sc.append(sec);
  sec = h('div', { class: 'sec' }, h('div', { class: 'sec-t' }, 'Appearance'));
  sec.append(sRow('Font', selectField(['Segoe UI', 'Arial', 'Verdana', 'Tahoma', 'Georgia', 'Consolas', 'Comic Sans MS', 'Impact'], s.font, v => { s.font = v; applySubStyle(); save(); })));
  sec.append(sRow('Size mode', h('div', { class: 'seg' }, ['relative', 'precise'].map(m => h('button', { class: s.sizeMode === m ? 'on' : '', onclick: () => { s.sizeMode = m; s.size = m === 'precise' ? 28 : 100; applySubStyle(); save(); renderPanel(); } }, m[0].toUpperCase() + m.slice(1))))));
  sec.append(s.sizeMode === 'precise' ? sliderRow('Font size', 12, 96, 1, s.size, x => x + ' px', x => { s.size = x; applySubStyle(); save(); }) : sliderRow('Font size', 50, 260, 5, s.size, x => x + '%', x => { s.size = x; applySubStyle(); save(); }));
  sec.append(sRow('Text colour', h('input', { type: 'color', value: s.color, oninput: e => { s.color = e.target.value; applySubStyle(); save(); } })));
  sec.append(sRow('Outline colour', h('input', { type: 'color', value: s.outlineColor, oninput: e => { s.outlineColor = e.target.value; applySubStyle(); save(); } })));
  sec.append(sliderRow('Outline thickness', 0, 8, 1, s.outline, x => x + ' px', x => { s.outline = x; applySubStyle(); save(); }));
  sec.append(sliderRow('Background opacity', 0, 100, 5, s.bg, x => x + '%', x => { s.bg = x; applySubStyle(); save(); }));
  sec.append(sliderRow('Position from bottom', 2, 40, 1, s.pos, x => x + '%', x => { s.pos = x; applySubStyle(); save(); }));
  sc.append(sec);
  sec = h('div', { class: 'sec' }, h('div', { class: 'sec-t' }, 'Defaults'));
  sec.append(sRow('Preferred language', h('input', { class: 'field w-s', placeholder: 'e.g. en', value: s.defaultLang, onchange: e => { s.defaultLang = e.target.value.trim(); save(); } }), null, 'Picked automatically when a name contains it'));
  sec.append(sRow('Auto-load matching files', toggle(cfg().autoSubs, on => { cfg().autoSubs = on; save(); })));
  sc.append(sec);
  sc.append(presetSection());
}
function presetSection() {
  const st = S.store, sec = h('div', { class: 'sec' }, h('div', { class: 'sec-t' }, 'Presets'));
  const folder = S.cur && S.cur.path && !S.cur.stream ? dirName(S.cur.path) : null, active = folder && st.folderPreset[folder];
  sec.append(h('div', { class: 'chips' }, st.presets.length ? st.presets.map(p => h('button', { class: 'chip' + (active === p.name ? ' on' : ''), onclick: () => { applyPreset(p); if (folder) { st.folderPreset[folder] = p.name; save(); renderPanel(); } }, oncontextmenu: e => { e.preventDefault(); showMenu([{ label: 'Delete preset', icon: 'trash', action: () => { st.presets = st.presets.filter(x => x !== p); for (const k in st.folderPreset) if (st.folderPreset[k] === p.name) delete st.folderPreset[k]; save(); renderPanel(); } }], e.clientX, e.clientY); } }, p.name)) : h('span', { class: 'kbd-hint' }, 'No presets yet')));
  sec.append(h('div', { class: 'row' }, h('button', { class: 'btn', html: ico('plus') + 'Save current settings…', onclick: () => promptName('Save preset', 'Preset name', cfg().layout && (S.cur ? stripExt(S.cur.name).replace(/[\s._-]*[sS]?\d+[eE]\d+.*/, '') : ''), name => { const i = st.presets.findIndex(x => x.name === name); const p = snapshotPreset(name); if (i >= 0) st.presets[i] = p; else st.presets.push(p); if (folder) st.folderPreset[folder] = name; save(); renderPanel(); toast('Preset saved' + (folder ? ' for this folder' : '')); }) })));
  sec.append(h('div', { class: 'kbd-hint' }, 'A saved preset is re-applied automatically to every episode in this folder. Right-click a preset to delete it.'));
  return sec;
}
function tabAudio(sc) {
  let sec = h('div', { class: 'sec' }, h('div', { class: 'sec-t' }, 'Output'));
  const sel = selectField([['default', 'Default output']], 'default', setAudioDevice, 'w-l');
  sec.append(h('div', { class: 'row' }, sel));
  listAudioDevices().then(ds => { if (ds.length) { sel.innerHTML = ''; ds.forEach(d => sel.append(h('option', { value: d.deviceId, selected: d.deviceId === (V().sinkId || 'default') }, d.label || 'Output ' + d.deviceId.slice(0, 6)))); } });
  sec.append(sliderRow('Volume boost', 0, 200, 5, Math.round(cfg().gain * 100), x => x + '%', x => { cfg().gain = x / 100; applyAudioFx(); save(); }, 'Above 100% amplifies quiet files'));
  sc.append(sec);
  sec = h('div', { class: 'sec' }, h('div', { class: 'sec-t' }, 'Equalizer'));
  sec.append(h('div', { class: 'fchips' }, Object.keys(EQ_PRESETS).map(k => {
    const g = EQ_PRESETS[k], bars = g.map(x => `<i style="display:block;width:6px;border-radius:2px;background:var(--accent);height:${12 + x * 1.6}px"></i>`).join('');
    return h('button', { class: 'fchip' + (cfg().eq === k ? ' on' : ''), onclick: () => { cfg().eq = k; applyAudioFx(); save(); renderPanel(); osd('Equalizer: ' + k); } },
      h('div', { class: 'pv', style: { background: 'var(--panel2)', display: 'flex', gap: '3px', alignItems: 'flex-end', justifyContent: 'center', padding: '4px 0', aspectRatio: '16/10' }, html: bars }), k[0].toUpperCase() + k.slice(1));
  })));
  sc.append(sec);
  sc.append(h('div', { class: 'sec' }, h('div', { class: 'warn' }, 'The equalizer and boost work with local files. Audio delay and track switching need a native decoder engine (libVLC) and are not available in this build.')));
}
function tabVideo(sc) {
  const f = S.store.video, fx = () => { applyVideoFx(); save(); };
  let sec = h('div', { class: 'sec' }, h('div', { class: 'sec-t' }, 'Filters'));
  sec.append(h('div', { class: 'fchips' }, Object.entries(FILTER_PRESETS).map(([k, [n, css]]) => h('button', { class: 'fchip' + (f.filter === k ? ' on' : ''), onclick: () => { f.filter = k; fx(); renderPanel(); } }, h('div', { class: 'pv', style: { filter: css || 'none' } }), n))));
  sc.append(sec);
  sec = h('div', { class: 'sec' }, h('div', { class: 'sec-t' }, 'Adjust'));
  sec.append(sliderRow('Brightness', 20, 200, 1, f.brightness, x => x + '%', x => { f.brightness = x; fx(); }));
  sec.append(sliderRow('Contrast', 20, 200, 1, f.contrast, x => x + '%', x => { f.contrast = x; fx(); }));
  sec.append(sliderRow('Saturation', 0, 300, 1, f.saturate, x => x + '%', x => { f.saturate = x; fx(); }));
  sec.append(sliderRow('Hue', -180, 180, 1, f.hue, x => x + '°', x => { f.hue = x; fx(); }));
  sc.append(sec);
  sec = h('div', { class: 'sec' }, h('div', { class: 'sec-t' }, 'Transform'));
  sec.append(h('div', { class: 'chips' },
    h('button', { class: 'chip' + (f.flipH ? ' on' : ''), onclick: () => { f.flipH = !f.flipH; fx(); renderPanel(); } }, 'Flip horizontal'),
    h('button', { class: 'chip' + (f.flipV ? ' on' : ''), onclick: () => { f.flipV = !f.flipV; fx(); renderPanel(); } }, 'Flip vertical'),
    h('button', { class: 'chip', onclick: () => { f.rotate = (f.rotate + 90) % 360; fx(); renderPanel(); } }, 'Rotate ' + f.rotate + '° ↻')));
  sec.append(sliderRow('Zoom', 50, 300, 5, f.zoom, x => x + '%', x => { f.zoom = x; fx(); }));
  sc.append(sec);
  sec = h('div', { class: 'sec' }, h('div', { class: 'sec-t' }, 'Aspect ratio'));
  sec.append(h('div', { class: 'chips' }, [['fit', 'Fit'], ['fill', 'Fill'], ['stretch', 'Stretch'], ['16:9', '16:9'], ['4:3', '4:3'], ['21:9', '21:9'], ['1:1', '1:1']].map(([k, n]) => h('button', { class: 'chip' + (f.aspect === k ? ' on' : ''), onclick: () => { f.aspect = k; fx(); renderPanel(); } }, n))));
  sec.append(h('div', { class: 'row', style: { marginTop: '12px' } }, h('button', { class: 'btn ghost', onclick: () => { Object.assign(f, DEFAULTS.video); fx(); renderPanel(); } }, 'Reset video settings')));
  sc.append(sec);
}
function applyStrip() { $('#subTimeline').classList.toggle('hidden', !cfg().subTimeline); afterLayout(); }
function tabPlay(sc) {
  let sec = h('div', { class: 'sec' }, h('div', { class: 'sec-t' }, 'Speed'));
  sec.append(sliderRow('Playback speed', 0.25, 4, 0.05, V().playbackRate, x => x.toFixed(2) + '×', x => { V().playbackRate = x; cfg().speed = x; save(); }));
  sec.append(h('div', { class: 'chips' }, [0.5, 0.75, 1, 1.25, 1.5, 2].map(x => h('button', { class: 'chip' + (Math.abs(V().playbackRate - x) < .01 ? ' on' : ''), onclick: () => { setSpeed(x); renderPanel(); } }, x + '×'))));
  sc.append(sec);
  sec = h('div', { class: 'sec' }, h('div', { class: 'sec-t' }, 'Sleep timer'));
  const act = S.sleepAfter ? 'end' : S.sleepAt ? 'on' : 'off';
  sec.append(h('div', { class: 'chips' }, [['off', 'Off', () => { S.sleepAt = 0; S.sleepAfter = false; }], ['15', '15 min', () => { S.sleepAt = Date.now() + 15 * 6e4; S.sleepAfter = false; }], ['30', '30 min', () => { S.sleepAt = Date.now() + 30 * 6e4; S.sleepAfter = false; }], ['60', '60 min', () => { S.sleepAt = Date.now() + 60 * 6e4; S.sleepAfter = false; }], ['end', 'End of file', () => { S.sleepAt = 0; S.sleepAfter = true; }]].map(([k, n, f]) => h('button', { class: 'chip' + ((k === 'off' && act === 'off') || (k === 'end' && act === 'end') ? ' on' : ''), onclick: () => { f(); renderPanel(); osd(k === 'off' ? 'Sleep timer off' : 'Sleep timer set'); } }, n))));
  if (S.sleepAt) sec.append(h('div', { class: 'kbd-hint', style: { marginTop: '8px' } }, 'Pauses at ' + new Date(S.sleepAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })));
  sc.append(sec);
  sec = h('div', { class: 'sec' }, h('div', { class: 'sec-t' }, 'Display'));
  sec.append(sRow('Show subtitle timeline', toggle(cfg().subTimeline, on => { cfg().subTimeline = on; applyStrip(); save(); })));
  sec.append(sRow('Show metadata', toggle(!$('#metaCard').classList.contains('hidden'), on => { $('#metaCard').classList.toggle('hidden', !on); updateMeta(); })));
  sec.append(sRow('Thumbnail on seek hover', toggle(cfg().thumbs, on => { cfg().thumbs = on; save(); })));
  sc.append(sec);
  sec = h('div', { class: 'sec' }, h('div', { class: 'sec-t' }, 'Bookmarks'));
  sec.append(h('div', { class: 'row' }, h('button', { class: 'btn', html: ico('bookmark') + 'Add bookmark  <span class="kbd-hint">Ctrl+B</span>', onclick: () => addBookmark() })));
  const list = S.cur ? S.store.bookmarks[keyOf(S.cur)] || [] : [];
  if (!list.length) sec.append(h('div', { class: 'kbd-hint' }, 'No bookmarks for this file.'));
  list.forEach(b => sec.append(h('div', { class: 'tl-chip' }, h('span', { class: 't', onclick: () => { V().currentTime = b.t; } }, fmt(b.t)), h('span', { class: 'l' }, b.label), h('button', { class: 'icon-btn', style: { width: '24px', height: '24px' }, html: ico('close'), onclick: () => { const a = S.store.bookmarks[keyOf(S.cur)]; a.splice(a.indexOf(b), 1); save(); renderMarks(); renderPanel(); } }))));
  sc.append(sec);
}
function promptName(title, label, value, cb) {
  const inp = h('input', { class: 'field w-l', value: value || '', placeholder: label });
  const m = modal({ title, body: h('div', {}, inp), buttons: [{ label: 'Cancel' }, { label: 'Save', primary: true, action: () => { if (!inp.value.trim()) return false; cb(inp.value.trim()); } }] });
  setTimeout(() => inp.focus(), 30); inp.addEventListener('keydown', e => { if (e.key === 'Enter') { if (inp.value.trim()) { cb(inp.value.trim()); m.close(); } } });
}

/* ---------- queue ---------- */
function renderQueue() {
  if (S.panel !== 'queue') return;
  const p = $('#rightPanel'); p.innerHTML = '';
  const btn = (ic, title, f, on) => h('button', { class: 'icon-btn' + (on ? ' on' : ''), title, html: ico(ic), onclick: f });
  p.append(h('div', { class: 'panel-head' }, h('h3', {}, 'Queue · ' + S.queue.length),
    btn('shuffle', 'Shuffle', () => CTL.shuffle.act(), cfg().shuffle), btn('repeat', 'Repeat: ' + cfg().repeat, () => CTL.repeat.act(), cfg().repeat !== 'off'),
    btn('file', 'Add files', () => openFilesDialog(true)), btn('folder', 'Add folder', addFolderToQueue), btn('playlist', 'Save as playlist', saveQueueAsPlaylist), btn('trash', 'Clear', () => { S.queue = []; S.idx = -1; persistQueue(); renderQueue(); }),
    btn('close', 'Close', closePanel)));
  const sc = h('div', { class: 'scroll', style: { paddingTop: '6px' } }); p.append(sc);
  if (!S.queue.length) sc.append(h('div', { class: 'empty', html: ico('queue') + '<br><br>The queue is empty.<br>Drag files here, or use the buttons above.' }));
  S.queue.forEach((it, i) => {
    const row = h('div', { class: 'list-item' + (i === S.idx ? ' cur' : ''), draggable: true },
      h('span', { html: ico(i === S.idx ? 'play' : it.kind === 'audio' ? 'music' : 'video'), style: { width: '18px', color: i === S.idx ? 'var(--accent)' : 'var(--faint)' } }),
      h('div', { class: 'grow' }, h('div', { class: 'n' }, stripExt(it.name)), h('div', { class: 's' }, it.stream ? 'Network stream' : baseName(dirName(it.path || '')))),
      h('button', { class: 'icon-btn x', style: { width: '26px', height: '26px' }, html: ico('close'), onclick: e => { e.stopPropagation(); removeFromQueue(i); } }));
    row.addEventListener('dblclick', () => playIndex(i)); row.addEventListener('click', () => { if (i !== S.idx) playIndex(i); });
    row.addEventListener('dragstart', e => { e.dataTransfer.setData('application/x-qidx', String(i)); e.dataTransfer.effectAllowed = 'move'; });
    row.addEventListener('dragover', e => { e.preventDefault(); row.classList.add('drop-before'); }); row.addEventListener('dragleave', () => row.classList.remove('drop-before'));
    row.addEventListener('drop', e => { e.preventDefault(); e.stopPropagation(); row.classList.remove('drop-before'); handleQueueDrop(e, i); });
    row.addEventListener('contextmenu', e => { e.preventDefault(); showMenu([{ label: 'Play', icon: 'play', action: () => playIndex(i) }, { label: 'Remove', icon: 'trash', action: () => removeFromQueue(i) }, it.path && !it.stream ? { label: 'Show in folder', icon: 'folder', action: () => hasApi && api.showInFolder(it.path) } : null], e.clientX, e.clientY); });
    sc.append(row);
  });
  sc.addEventListener('dragover', e => e.preventDefault()); sc.addEventListener('drop', e => { e.preventDefault(); handleQueueDrop(e, S.queue.length); });
}
function removeFromQueue(i) { S.queue.splice(i, 1); if (i < S.idx) S.idx--; else if (i === S.idx) { S.idx = -1; } persistQueue(); renderQueue(); }
async function handleQueueDrop(e, at) {
  const qi = e.dataTransfer.getData('application/x-qidx');
  if (qi !== '') { const from = +qi; const [it] = S.queue.splice(from, 1); const cur = S.cur; if (at > from) at--; S.queue.splice(at, 0, it); S.idx = S.queue.indexOf(cur); persistQueue(); renderQueue(); return; }
  const items = await itemsFromDrop(e); if (items.length) enqueue(items, { at });
}
async function itemsFromDrop(e) {
  const lib = e.dataTransfer.getData('application/x-media'); if (lib) { try { return JSON.parse(lib); } catch {} }
  const files = [...(e.dataTransfer.files || [])]; if (!files.length) return [];
  if (hasApi) { const paths = files.map(f => api.pathForFile(f)).filter(Boolean); const info = await api.describe(paths); return info.flatMap(x => x.dir ? x.files : [x]).filter(x => MEDIA_RE.test(x.name || '')); }
  return files.filter(f => MEDIA_RE.test(f.name)).map(f => ({ name: f.name, kind: AUDIO_RE.test(f.name) ? 'audio' : 'video', url: URL.createObjectURL(f), path: f.name, stream: true }));
}
async function addFolderToQueue() { if (!hasApi) return; const d = await api.pickFolder(); if (!d) return; const r = await api.scan(d); enqueue(r.files); }
function saveQueueAsPlaylist() { if (!S.queue.length) return toast('Queue is empty'); promptName('Save queue as playlist', 'Playlist name', '', name => { S.store.playlists.push({ name, items: S.queue.map(({ path, name, url, kind, stream }) => ({ path, name, url, kind, stream })) }); save(); toast('Playlist “' + name + '” saved'); }); }
