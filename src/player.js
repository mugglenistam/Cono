/* ===== player: queue, playback, seek bar, subtitles, audio/video effects ===== */
const V = () => $('#video');
const MEDIA_RE = /\.(mp4|mkv|webm|mov|m4v|avi|ogv|mp3|flac|wav|ogg|m4a|opus|aac)$/i;
const AUDIO_RE = /\.(mp3|flac|wav|ogg|m4a|opus|aac)$/i;

function itemFromPath(p) {
  const name = baseName(p);
  return { path: p, name, kind: AUDIO_RE.test(name) ? 'audio' : 'video', url: 'file:///' + p.replace(/\\/g, '/').replace(/^\/+/, '').split('/').map(encodeURIComponent).join('/').replace(/^([A-Za-z])%3A/, '$1:') };
}
function itemFromUrl(url, name) {
  let filename = url;
  try { const parsed = new URL(url); filename = parsed.searchParams.get('f') || parsed.searchParams.get('filename') || parsed.pathname.split('/').pop() || parsed.hostname; filename = decodeURIComponent(filename); } catch {}
  return { url, name: name || filename, kind: AUDIO_RE.test(filename) ? 'audio' : 'video', stream: true, path: url };
}
const keyOf = it => it.path || it.url;

/* ---------- queue ---------- */
function persistQueue() { S.store.queue = cfg().keepQueue ? S.queue.slice(0, 300).map(({ path, name, url, kind, stream }) => ({ path, name, url, kind, stream })) : []; save(); }
function enqueue(items, { play = false, at = null } = {}) {
  items = items.filter(Boolean);
  if (!items.length) return;
  const start = at == null ? S.queue.length : at;
  S.queue.splice(start, 0, ...items);
  if (S.idx >= start && at != null) S.idx += items.length;
  persistQueue(); renderQueue(); refreshNav();
  if (play || (S.idx < 0 && !V().src)) playIndex(start);
  else toast(`Added ${items.length} item${items.length > 1 ? 's' : ''} to queue`);
}
function playItems(items, startAt = 0) {
  S.queue = items.slice(); S.idx = -1; persistQueue(); playIndex(startAt);
}
function playIndex(i) {
  if (i < 0 || i >= S.queue.length) return;
  S.idx = i; S.cur = S.queue[i];
  if (S.view === 'library') showLibrary(false, 'full');
  loadCurrent();
  renderQueue();
}
function nextIndex(dir = 1) {
  const n = S.queue.length; if (!n) return -1;
  if (cfg().shuffle && dir > 0 && n > 1) { let r; do { r = Math.floor(Math.random() * n); } while (r === S.idx); return r; }
  let i = S.idx + dir;
  if (i >= n) return cfg().repeat === 'all' ? 0 : -1;
  if (i < 0) return cfg().repeat === 'all' ? n - 1 : -1;
  return i;
}
function next() { const i = nextIndex(1); if (i >= 0) playIndex(i); else osd('End of queue'); }
function prev() { const v = V(); if (v.currentTime > 4) { v.currentTime = 0; return; } const i = nextIndex(-1); if (i >= 0) playIndex(i); else v.currentTime = 0; }

/* ---------- loading ---------- */
let resumeTimer;
let mediaLoadId = 0, waveAbort, loadedMedia = null, resumePrompt = null;
async function loadCurrent() {
  const v = V(), it = S.cur; if (!it) return;
  // S.cur already points at the selection; save the item actually in the decoder.
  saveResume();
  const loadId = ++mediaLoadId;
  resumePrompt?.close(); resumePrompt = null;
  loadedMedia = null;
  waveAbort?.abort();
  resetSeek(); resetThumbVideo();
  v.onloadedmetadata = v.onerror = null;
  v.pause(); v.srcObject = null; v.removeAttribute('src'); v.load();
  S.subTracks = []; S.subIdx = -1; S.subCues = []; S.peaks = null; S.duration = 0;
  clearSubText(); updateTimes();
  if (it.stream && !it.networkResolved && hasApi && api.resolveMedia) {
    try {
      const source = /^https?:/.test(it.path || '') ? it.path : it.url;
      const result = await api.resolveMedia(source);
      if (loadId !== mediaLoadId) return;
      if (result.type === 'page') { showLibrary(true, 'full'); showStreamAccess(result); return; }
      if (result.type !== 'media') { showLibrary(true, 'full'); toast('Open this playlist from Network to browse its entries.'); return; }
      it.url = result.playbackUrl || result.url; it.kind = result.kind || it.kind; it.mime = result.mime || ''; it.networkResolved = true;
    } catch (error) { if (loadId === mediaLoadId) { showLibrary(true, 'full'); toast(error.message || 'Could not open this network link'); } return; }
  }
  if (it.stream) it.networkResolved = false;
  const active = loadedMedia = { item: it, loadId, ready: false, awaitingChoice: false, source: null };
  const valid = () => loadId === mediaLoadId && S.cur === it && loadedMedia === active;
  v.playbackRate = cfg().rememberSpeed ? cfg().speed : 1;
  if (!cfg().rememberSpeed) cfg().speed = 1;
  $('#artwork').classList.toggle('hidden', it.kind !== 'audio');
  syncWorkspaceLayout();
  const cover = $('.art-cover');
  cover.src = AUDIO_FALLBACK;
  $('.music-backdrop').src = AUDIO_FALLBACK;
  cover.onerror = () => { if (cover.getAttribute('src') !== AUDIO_FALLBACK) cover.src = AUDIO_FALLBACK; };
  drawWave();
  if (it.kind === 'audio') {
    audioCover(it).then(src => { if (loadId === mediaLoadId) cover.src = $('.music-backdrop').src = src; });
    if (!it.stream) computePeaks(it.url, loadId);
  }
  $('.art-title').textContent = stripExt(it.name);
  if (it.kind === 'audio') updateMusicMetadata(it, loadId);
  $('#title').textContent = stripExt(it.name);
  $('#folderName').textContent = it.path && !it.stream ? baseName(dirName(it.path)) || 'Library' : (it.stream ? 'Network' : 'Library');
  document.title = stripExt(it.name) + ' — Cono';
  const r = S.store.resume[keyOf(it)];
  const startPlayback = async time => {
    if (!valid()) return;
    active.awaitingChoice = false;
    if (!time) { delete S.store.resume[keyOf(it)]; save(); }
    v.currentTime = time; updateTimes();
    try { await v.play(); } catch {}
  };
  v.onloadedmetadata = () => {
    if (!valid()) return;
    v.onloadedmetadata = null;
    active.ready = true;
    S.duration = v.duration; updateTimes();
    applyVideoFx(); renderMarks(); updateMeta();
    if (it.kind === 'video' && cfg().resume && Number.isFinite(r?.t) && r.t >= 1 && r.t < v.duration - .5) {
      active.awaitingChoice = true;
      let settled = false;
      const choose = time => {
        if (settled) return;
        settled = true;
        if (!valid()) return;
        resumePrompt = null; startPlayback(time);
      };
      resumePrompt = modal({ title: 'Resume video?',
        body: h('div', {}, h('p', {}, stripExt(it.name)), h('p', { class: 'kbd-hint', style: { marginTop: '12px' } }, 'You stopped at ' + fmt(r.t) + '. Continue watching or start from the beginning?')),
        buttons: [{ label: 'Start from beginning', action: () => choose(0) }, { label: 'Continue from ' + fmt(r.t), primary: true, action: () => choose(r.t) }],
        onClose: () => choose(0) });
      resumePrompt.el.setAttribute('role', 'dialog');
      resumePrompt.el.setAttribute('aria-modal', 'true');
      resumePrompt.el.setAttribute('aria-label', 'Resume video?');
      resumePrompt.el.querySelector('.primary').focus();
    } else startPlayback(0);
  };
  v.onerror = () => { if (valid()) { osd('Cannot play this file — format or codec not supported'); toast('Unsupported format: ' + it.name + ' (try MP4/H.264, WebM, MP3, FLAC…)'); } };
  v.src = it.url; active.source = v.src; v.load();
  autoLoadSubs(it);
  addRecent(it);
  applyFolderPreset(it);
  renderPanel(); refreshNav();
}
function addRecent(it) {
  if (!cfg().history) return;
  const r = S.store.recents.filter(x => keyOf(x) !== keyOf(it));
  r.unshift({ path: it.path, name: it.name, url: it.url, kind: it.kind, stream: it.stream, when: Date.now() });
  S.store.recents = r.slice(0, 40); save();
}
function saveResume() {
  const v = V(), active = loadedMedia, it = active?.item;
  if (!it || !active.ready || active.awaitingChoice || v.currentSrc !== active.source || !Number.isFinite(v.duration) || v.duration <= 0) return;
  if (it.kind !== 'video' || v.currentTime < 1 || v.ended || v.currentTime >= v.duration - .5) delete S.store.resume[keyOf(it)];
  else S.store.resume[keyOf(it)] = { t: v.currentTime, d: v.duration };
  save();
}

/* ---------- transport ---------- */
function togglePlay() {
  if (loadedMedia?.awaitingChoice) return;
  const v = V();
  if (!v.src && !S.queue.length) { openFilesDialog(); return; }
  if (!v.src && S.queue.length) { playIndex(Math.max(0, S.idx)); return; }
  if (v.paused) v.play(); else v.pause();
  pop(v.paused ? 'pause' : 'play');
}
function pop(icon) {
  const b = $('#bigState'); b.innerHTML = ico(icon); b.classList.remove('pop'); void b.offsetWidth; b.classList.add('pop');
}
let seekTarget = null, pendingSeek = null, seekFrame = 0;
function resetSeek() { cancelAnimationFrame(seekFrame); seekFrame = 0; seekTarget = pendingSeek = null; }
function flushSeek() {
  seekFrame = 0;
  const v = V(); if (v.seeking || pendingSeek == null) return;
  const target = pendingSeek; pendingSeek = null;
  if (Math.abs(v.currentTime - target) > .001) v.currentTime = target;
  else seekTarget = null;
}
function seekTo(time) {
  if (loadedMedia?.awaitingChoice) return;
  const v = V(); if (!Number.isFinite(v.duration) || v.duration <= 0) return;
  seekTarget = pendingSeek = clamp(time, 0, v.duration);
  // Let the active decode finish instead of restarting it on every repeated key.
  flushSeek(); updateTimes();
}
function finishSeek() {
  if (pendingSeek != null) seekFrame = requestAnimationFrame(flushSeek);
  else seekTarget = null;
  updateTimes(); renderSubs();
}
function seekBy(d) {
  const v = V(); if (!Number.isFinite(v.duration) || !v.duration) return;
  const target = clamp((pendingSeek ?? seekTarget ?? v.currentTime) + d, 0, v.duration);
  seekTo(target); osd((d > 0 ? '+' : '') + d + 's  ' + fmt(target));
}
// Slider position is perceived loudness; the media engine expects amplitude.
// A cubic taper gives useful control at low levels and room above the midpoint.
const volumeGain = x => Math.pow(clamp(Number(x) || 0, 0, 1), 3);
const volumeLevel = () => clamp(Number(cfg().volume) || 0, 0, 1);
function setVolume(x, quiet) {
  const v = V(); x = clamp(Number(x) || 0, 0, 1); cfg().volume = x; v.volume = volumeGain(x);
  if (x > 0 && v.muted) { v.muted = false; cfg().muted = false; }
  updateVolumeUI(); save(); if (!quiet) osd('Volume ' + Math.round(x * 100) + '%');
}
function toggleMute() { const v = V(); v.muted = !v.muted; cfg().muted = v.muted; updateVolumeUI(); save(); osd(v.muted ? 'Muted' : 'Volume ' + Math.round(volumeLevel() * 100) + '%'); }
function setSpeed(x) { x = clamp(Math.round(x * 100) / 100, 0.25, 4); V().playbackRate = x; cfg().speed = x; osd('Speed ' + x + '×'); save(); if (S.panel === 'side') renderPanel(); }
function stepFrame(d) { const v = V(); v.pause(); v.currentTime = Math.max(0, v.currentTime + d / 30); }
function toggleFullscreen(on) { if (hasApi) api.fullscreen(on); else if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen(); }
function setFullscreenState(on) {
  S.fullscreen = on; $('#app').classList.toggle('fs', on);
  $('#btnFs').innerHTML = ico(on ? 'exitfs' : 'fullscreen');
  syncWorkspaceLayout(); barsOff(false); kickIdle();
}
function togglePip() { const v = V(); if (document.pictureInPictureElement) document.exitPictureInPicture(); else if (v.requestPictureInPicture && v.src) v.requestPictureInPicture().catch(() => osd('Picture-in-picture unavailable')); }
function screenshot() {
  const v = V(); if (!v.videoWidth) return;
  const c = document.createElement('canvas'); c.width = v.videoWidth; c.height = v.videoHeight; c.getContext('2d').drawImage(v, 0, 0);
  c.toBlob(b => { const a = h('a', { href: URL.createObjectURL(b), download: stripExt(S.cur?.name || 'snapshot') + '_' + fmt(v.currentTime).replace(/:/g, '-') + '.png' }); a.click(); osd('Screenshot saved to Downloads'); });
}
function stop() { const v = V(); v.pause(); v.currentTime = 0; }

/* ---------- time / seek bar ---------- */
function updateTimes() {
  const v = V();
  $('#tCur').textContent = fmt(v.currentTime, S.cur?.kind !== 'audio'); $('#tDur').textContent = fmt(isFinite(v.duration) ? v.duration : 0, S.cur?.kind !== 'audio');
  const p = v.duration ? v.currentTime / v.duration : 0;
  $('.seek-played').style.width = p * 100 + '%'; $('.seek-handle').style.left = p * 100 + '%';
  $('#seek').classList.toggle('disabled', !v.duration || !isFinite(v.duration));
  const pb = $('#ctlLeft .play'); if (pb) pb.innerHTML = ico(v.paused ? 'play' : 'pause');
  drawWave();
  drawSubTimeline();
  updateMusicState();
}

/* ---------- music listening view ---------- */
let musicQueueSignature = '';
async function updateMusicMetadata(item, loadId) {
  const name = stripExt(item.name), split = name.indexOf(' - ');
  $('.art-artist').textContent = split > 0 ? name.slice(0, split) : 'Unknown artist';
  $('.art-title').textContent = split > 0 ? name.slice(split + 3) : name;
  $('.art-album').textContent = item.stream ? 'Listening online' : 'From your library';
  musicQueueSignature = ''; updateMusicState();
  if (item.stream || !hasApi || !api.audioInfo) return;
  try {
    const info = await api.audioInfo(item.path);
    if (!info || loadId !== mediaLoadId || S.cur !== item) return;
    if (info.title) $('.art-title').textContent = info.title;
    if (info.artist) $('.art-artist').textContent = info.artist;
    if (info.album) $('.art-album').textContent = [info.album, info.year].filter(Boolean).join(' · ');
    if (info.title) { $('#title').textContent = [info.artist, info.title].filter(Boolean).join(' — '); document.title = $('#title').textContent + ' — Cono'; }
  } catch {}
}
function updateMusicState() {
  if (S.cur?.kind !== 'audio') return;
  $('.music-status').textContent = V().paused ? 'Paused' : 'Playing';
  $('#musicShuffle').classList.toggle('on', cfg().shuffle);
  $('#musicShuffle').setAttribute('aria-pressed', String(cfg().shuffle));
  $('#musicRepeat').classList.toggle('on', cfg().repeat !== 'off');
  $('#musicRepeat').setAttribute('aria-label', 'Repeat: ' + cfg().repeat);
  $('#musicRepeat').title = 'Repeat: ' + cfg().repeat;
  const signature = JSON.stringify([S.idx, S.queue.map(item => keyOf(item)), cfg().shuffle, cfg().repeat]);
  if (signature === musicQueueSignature) return;
  musicQueueSignature = signature;
  const box = $('#musicNext'); box.replaceChildren();
  $('.music-next h2').textContent = cfg().shuffle ? 'In your queue' : 'Up next';
  let indices = S.queue.map((_, i) => i).filter(i => cfg().shuffle ? i !== S.idx : i > S.idx);
  if (cfg().repeat === 'all' && !cfg().shuffle) indices = indices.concat(S.queue.map((_, i) => i).filter(i => i <= S.idx));
  if (cfg().repeat === 'one') indices = [S.idx];
  indices.slice(0, 3).forEach(i => {
    const item = S.queue[i]; if (!item) return;
    const image = item.kind === 'audio' ? coverImage('music-track-thumb') : h('span', { class: 'music-track-thumb', html: ico('video') });
    if (item.kind === 'audio') audioCover(item).then(src => { if (image.isConnected) image.src = src; });
    box.append(h('button', { class: 'music-track', onclick: () => playIndex(i) }, image, h('span', { class: 'music-track-title', title: item.name }, stripExt(item.name)), durationLabel(item, 'music-track-time')));
  });
  if (!box.children.length) box.append(h('p', { class: 'music-empty' }, 'You’re all caught up. Add more music to your queue.'));
}
function initSeek() {
  const seek = $('#seek'), v = V(); let drag = false;
  new ResizeObserver(drawWave).observe(seek);
  const at = e => { const r = seek.getBoundingClientRect(); return clamp((e.clientX - r.left) / r.width, 0, 1); };
  seek.addEventListener('pointerdown', e => { drag = true; seek.setPointerCapture(e.pointerId); if (v.duration) seekTo(at(e) * v.duration); });
  seek.addEventListener('pointermove', e => {
    const f = at(e); if (drag && v.duration) seekTo(f * v.duration);
    else showThumb(f, e.clientX);
  });
  seek.addEventListener('pointerup', () => drag = false);
  seek.addEventListener('lostpointercapture', () => drag = false);
  seek.addEventListener('pointerleave', resetThumbVideo);
  v.addEventListener('timeupdate', () => { updateTimes(); sleepCheck(); });
  v.addEventListener('play', () => { updateTimes(); renderSubs(); });
  v.addEventListener('pause', () => { updateTimes(); saveResume(); });
  v.addEventListener('seeking', resetThumbVideo);
  v.addEventListener('seeked', finishSeek);
  v.addEventListener('ended', onEnded);
  v.addEventListener('durationchange', () => { S.duration = v.duration; updateTimes(); renderMarks(); });
  v.addEventListener('volumechange', updateVolumeUI);
  v.addEventListener('enterpictureinpicture', () => osd('Picture-in-picture'));
  clearInterval(resumeTimer); resumeTimer = setInterval(() => { if (!v.paused) saveResume(); }, 5000);
  addEventListener('beforeunload', () => { saveResume(); persistQueue(); });
  (function loop() { if (!v.paused) renderSubs(); requestAnimationFrame(loop); })();
}
function onEnded() {
  if (!loadedMedia?.ready || loadedMedia.awaitingChoice || !V().ended || V().currentSrc !== loadedMedia.source) return;
  if (S.cur) { S.store.watched = S.store.watched || {}; S.store.watched[keyOf(S.cur)] = 1; delete S.store.resume[keyOf(S.cur)]; save(); }
  if (S.sleepAfter) { S.sleepAfter = false; osd('Sleep timer: stopped'); return; }
  if (cfg().repeat === 'one') { V().currentTime = 0; V().play(); return; }
  if (cfg().autoNext) { const i = nextIndex(1); if (i >= 0) playIndex(i); }
}
function sleepCheck() { if (S.sleepAt && Date.now() >= S.sleepAt) { S.sleepAt = 0; V().pause(); osd('Sleep timer: paused'); if (S.panel === 'side') renderPanel(); } }

/* thumbnail preview while hovering the seek bar */
let tv, thumbPending = null, thumbTimer;
function resetThumbVideo() {
  clearTimeout(thumbTimer); thumbPending = null;
  if (tv) { tv.onloadedmetadata = tv.onseeked = tv.onerror = null; tv.pause(); tv.removeAttribute('src'); tv.load(); tv = null; }
  $('#thumb').classList.add('hidden');
}
function queueThumbFrame() {
  clearTimeout(thumbTimer);
  thumbTimer = setTimeout(() => {
    if (V().seeking || !S.cur || thumbPending == null) return;
    if (!tv) {
      const preview = tv = document.createElement('video'); preview.muted = true; preview.preload = 'metadata';
      preview.onloadedmetadata = queueThumbFrame;
      preview.onseeked = () => {
        if (preview !== tv) return;
        try { $('#thumb canvas').getContext('2d').drawImage(preview, 0, 0, 224, 126); } catch {}
        if (thumbPending != null) queueThumbFrame();
      };
      preview.onerror = () => { if (preview === tv) resetThumbVideo(); };
      preview.src = S.cur.url;
    }
    if (tv.readyState < 1 || tv.seeking) return;
    const target = thumbPending; thumbPending = null;
    if (Math.abs(tv.currentTime - target) > .01) tv.currentTime = target;
  }, 100);
}
function showThumb(f, clientX) {
  const th = $('#thumb'), v = V(); if (!v.duration || v.seeking) return th.classList.add('hidden');
  const t = f * v.duration, seek = $('#seek').getBoundingClientRect();
  th.classList.remove('hidden');
  const w = 204, x = clamp(clientX - seek.left, w / 2, seek.width - w / 2);
  th.style.left = x + 'px'; th.lastElementChild.textContent = fmt(t);
  const showCanvas = cfg().thumbs && S.cur && S.cur.kind === 'video' && !S.cur.stream;
  th.classList.toggle('audio', !showCanvas);
  if (showCanvas) { thumbPending = t; queueThumbFrame(); }
}
function renderMarks() {
  const m = $('.seek-marks'); m.innerHTML = '';
  const d = V().duration; if (!d || !isFinite(d)) return;
  (S.store.bookmarks[keyOf(S.cur || {})] || []).forEach(b => m.append(h('i', { style: { left: (b.t / d) * 100 + '%' }, title: b.label })));
}
/* waveform seek bar */
const peakCache = new Map();
async function computePeaks(url, loadId = mediaLoadId) {
  if (S.cur?.kind !== 'audio' || S.cur.stream) return;
  const current = () => loadId === mediaLoadId && S.cur?.url === url && S.cur.kind === 'audio';
  if (peakCache.has(url)) {
    if (current()) { S.peaks = peakCache.get(url); drawWave(); }
    return;
  }
  try {
    waveAbort = new AbortController();
    const response = await fetch(url, { signal: waveAbort.signal });
    if (Number(response.headers.get('content-length')) > 150e6) return;
    const buf = await response.arrayBuffer();
    if (buf.byteLength > 150e6) return;
    const ac = new (window.OfflineAudioContext || window.webkitOfflineAudioContext)(1, 44100, 44100);
    const dec = await ac.decodeAudioData(buf);
    if (!current()) return;
    const N = Math.min(1200, dec.length), peaks = new Array(N).fill(0);
    for (let channel = 0; channel < dec.numberOfChannels; channel++) {
      const samples = dec.getChannelData(channel);
      for (let i = 0; i < N; i++) {
        const start = Math.floor(i * samples.length / N), end = Math.floor((i + 1) * samples.length / N);
        for (let j = start; j < end; j += Math.max(1, Math.floor((end - start) / 200))) peaks[i] = Math.max(peaks[i], Math.abs(samples[j]));
      }
    }
    const max = Math.max(...peaks, .001);
    S.peaks = peaks.map(p => p / max);
    peakCache.set(url, S.peaks);
    if (peakCache.size > 8) peakCache.delete(peakCache.keys().next().value);
    drawWave();
  } catch {}
}
function drawWave() {
  const c = $('#wave'), r = c.getBoundingClientRect();
  const width = Math.round(r.width * devicePixelRatio), height = Math.round(r.height * devicePixelRatio);
  if (c.width !== width || c.height !== height) { c.width = width; c.height = height; }
  const g = c.getContext('2d'); g.clearRect(0, 0, c.width, c.height);
  if (S.cur?.kind !== 'audio' || !S.peaks?.length || !width || !height) return;
  const N = Math.min(S.peaks.length, Math.max(1, Math.floor(r.width / 3))), bw = width / N;
  const bars = () => {
    for (let i = 0; i < N; i++) {
      const start = Math.floor(i * S.peaks.length / N), end = Math.floor((i + 1) * S.peaks.length / N);
      let peak = 0; for (let j = start; j < end; j++) peak = Math.max(peak, S.peaks[j]);
      const hh = Math.max(2 * devicePixelRatio, peak * height * .9);
      g.fillRect(i * bw, (height - hh) / 2, Math.max(1, bw - devicePixelRatio), hh);
    }
  };
  g.fillStyle = getComputedStyle($('#app')).getPropertyValue('--faint').trim(); bars();
  const progress = isFinite(V().duration) && V().duration > 0 ? clamp(V().currentTime / V().duration, 0, 1) : 0;
  g.save(); g.beginPath(); g.rect(0, 0, width * progress, height); g.clip();
  g.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#f58a00'; bars(); g.restore();
}

/* ---------- bookmarks ---------- */
function addBookmark(label) {
  if (!S.cur) return; const v = V(), k = keyOf(S.cur);
  const list = S.store.bookmarks[k] = S.store.bookmarks[k] || [];
  list.push({ t: v.currentTime, label: label || 'Bookmark ' + (list.length + 1) }); list.sort((a, b) => a.t - b.t);
  save(); renderMarks(); osd('Bookmark added at ' + fmt(v.currentTime), cfg().hotkeys.bookmark); if (S.panel === 'side') renderPanel();
}

/* ---------- subtitles ---------- */
function parseTime(s) { const m = s.trim().replace(',', '.').match(/(?:(\d+):)?(\d+):(\d+(?:\.\d+)?)/); return m ? (+(m[1] || 0)) * 3600 + (+m[2]) * 60 + parseFloat(m[3]) : 0; }
function cleanText(t) { return t.replace(/\{\\[^}]*\}/g, '').replace(/\\N/g, '\n').replace(/<(?!\/?(i|b|u)\b)[^>]+>/gi, '').trim(); }
function parseSubs(text, ext) {
  const cues = []; text = text.replace(/\r/g, '');
  if (/\.(ass|ssa)$/i.test(ext)) {
    let fmtCols = [], inEvents = false;
    for (const line of text.split('\n')) {
      if (/^\[/.test(line)) inEvents = /^\[Events\]/i.test(line.trim());
      if (inEvents && /^Format:/i.test(line)) fmtCols = line.slice(7).split(',').map(s => s.trim().toLowerCase());
      if (inEvents && /^Dialogue:/i.test(line)) {
        const parts = line.slice(9).split(','); const si = fmtCols.indexOf('start'), ei = fmtCols.indexOf('end'), ti = fmtCols.indexOf('text');
        const txt = parts.slice(ti < 0 ? 9 : ti).join(',');
        cues.push({ s: parseTime(parts[si < 0 ? 1 : si]), e: parseTime(parts[ei < 0 ? 2 : ei]), text: cleanText(txt) });
      }
    }
  } else {
    for (const block of text.split(/\n\s*\n/)) {
      const lines = block.split('\n').filter(Boolean); const ti = lines.findIndex(l => l.includes('-->'));
      if (ti < 0) continue;
      const [a, b] = lines[ti].split('-->');
      cues.push({ s: parseTime(a), e: parseTime(b.trim().split(/\s/)[0]), text: cleanText(lines.slice(ti + 1).join('\n')) });
    }
  }
  return cues.filter(c => c.text).sort((a, b) => a.s - b.s);
}
async function addSubtitleFile(path, select = true, valid = () => true) {
  const item = S.cur;
  const text = await (hasApi ? api.readText(path) : null); if (text == null) return false;
  if (S.cur !== item || !valid()) return false;
  const cues = parseSubs(text, path); if (!cues.length) { toast('No cues found in ' + baseName(path)); return false; }
  if (S.subTracks.some(t => t.path === path)) { if (select) selectSub(S.subTracks.findIndex(t => t.path === path)); return true; }
  S.subTracks.push({ path, name: stripExt(baseName(path)), cues });
  if (select) selectSub(S.subTracks.length - 1);
  return true;
}
async function selectSub(i) {
  const track = S.subTracks[i], item = S.cur;
  if (i >= 0 && (!track || track.supported === false)) return;
  S.subIdx = i; S.subCues = track?.cues || []; S.sub_last = 0;
  const on = i >= 0; S.store.sub.enabled = on; clearSubText(); renderSubs(); save();
  renderPanel(); refreshNav(); drawSubTimeline();
  if (track?.embedded && !track.cues) {
    osd('Loading embedded subtitles…');
    try {
      const text = await (track.pending ||= api.subtitleText(track.path, track.streamIndex));
      if (S.cur !== item || !S.subTracks.includes(track)) return;
      track.cues = parseSubs(text, '.srt');
      if (S.subIdx !== i) return;
      S.subCues = track.cues;
      if (!track.cues.length) toast('This subtitle track contains no readable text');
      renderSubs(); renderPanel(); drawSubTimeline();
    } catch {
      track.pending = null;
      if (S.cur === item && S.subTracks[S.subIdx] === track) { selectSub(-1); toast('Could not extract this subtitle track. Try another track or a subtitle file from SubDL.'); }
      return;
    }
  }
  osd(on ? 'Subtitles: ' + S.subTracks[i].name : 'Subtitles off');
}
async function loadEmbeddedSubtitles(it, valid = () => true) {
  if (it?.kind !== 'video' || !it.path || it.stream || !hasApi || !api.subtitleTracks) return;
  try {
    const tracks = await api.subtitleTracks(it.path);
    if (S.cur !== it || !valid()) return;
    for (const track of tracks) {
      if (S.subTracks.some(t => t.embedded && t.path === it.path && t.streamIndex === track.index)) continue;
      const label = [track.title || 'Track ' + (track.index + 1), track.language, 'Embedded', track.supported ? '' : 'image/unsupported'].filter(Boolean).join(' · ');
      S.subTracks.push({ path: it.path, name: label, embedded: true, streamIndex: track.index, language: track.language, default: track.default, forced: track.forced, supported: track.supported, cues: null });
    }
    renderPanel();
  } catch { if (S.cur === it && valid()) toast('Could not read embedded subtitles from this video'); }
}
function subKey(name) { const m = name.match(/[sS](\d{1,2})[eE](\d{1,3})/) || name.match(/(\d{1,2})x(\d{2,3})/); if (m) return `${+m[1]}x${+m[2]}`; const n = name.match(/(?:^|[^\d])(\d{1,3})(?:[^\dp]|$)/); return n ? 'e' + +n[1] : null; }
let subtitleLoadId = 0;
async function autoLoadSubs(it) {
  const id = ++subtitleLoadId, valid = () => S.cur === it && id === subtitleLoadId;
  if (!it.path || it.stream || it.kind !== 'video' || !hasApi) return;
  const mapped = S.store.subMap[it.path] || [];
  for (const p of mapped) { await addSubtitleFile(p, S.subIdx < 0, valid); if (!valid()) return; }
  if (!mapped.length && cfg().autoSubs && cfg().subMatch !== 'none') {
    const base = stripExt(it.name).toLowerCase();
    let found = [];
    if (cfg().subMatch === 'any') { const all = await api.listSubs(dirName(it.path)); const k = subKey(it.name); found = all.filter(p => !k || subKey(baseName(p)) === k); if (!k && all.length > 1) found = []; }
    else { found = await api.findSubs(it.path); if (cfg().subMatch === 'exact') found = found.filter(p => { const b = stripExt(baseName(p)).toLowerCase(); return b === base || b.startsWith(base + '.') && b.length - base.length <= 6; }); }
    if (!valid()) return;
    for (const p of found) { await addSubtitleFile(p, S.subIdx < 0, valid); if (!valid()) return; }
  }
  await loadEmbeddedSubtitles(it, valid);
  if (!valid()) return;
  if (S.subIdx < 0 && cfg().autoSubs && S.store.sub.enabled) {
    const canonicalLanguage = value => { try { return new Intl.Locale(value).language; } catch { return value.toLowerCase(); } };
    const language = canonicalLanguage(S.store.sub.defaultLang);
    const choices = S.subTracks.map((track, i) => ({ track, i })).filter(({ track }) => track.supported !== false);
    const preferred = (language && choices.find(({ track }) => canonicalLanguage(track.language || '') === language)) || choices.find(({ track }) => track.default) || choices.find(({ track }) => track.forced) || choices[0];
    if (preferred) await selectSub(preferred.i);
  }
  if (!valid()) return;
  if (S.subIdx < 0) selectSubSilent(-1); else { renderPanel(); }
  S.subLoadedFor = it;
}
function selectSubSilent(i) { S.subIdx = i; S.subCues = []; renderPanel(); refreshNav(); }
function clearSubText() { $('#subs').innerHTML = ''; S.sub_cur = null; }
function renderSubs() {
  const box = $('#subs'), v = V(); if (S.subIdx < 0 || !S.store.sub.enabled || !S.subCues.length) { if (box.firstChild) box.innerHTML = ''; S.sub_cur = null; return; }
  const t = v.currentTime - S.store.sub.delay, cues = S.subCues; let hit = null;
  let i = clamp(S.sub_last || 0, 0, cues.length - 1); if (cues[i].s > t) i = 0;
  for (; i < cues.length; i++) { const c = cues[i]; if (c.s > t) break; if (t <= c.e) { hit = c; S.sub_last = i; break; } }
  if (hit === S.sub_cur) return; S.sub_cur = hit;
  box.innerHTML = '';
  if (hit) { const sp = h('span'); sp.innerHTML = esc(hit.text).replace(/&lt;(\/?)(i|b|u)&gt;/gi, '<$1$2>').replace(/\n/g, '<br>'); box.append(sp); }
}
function applySubStyle() {
  const s = S.store.sub, box = $('#subs'), stageH = $('#stage').clientHeight || 600;
  const px = s.sizeMode === 'precise' ? s.size : Math.max(12, (stageH * 0.046) * (s.size / 100));
  box.style.fontSize = px + 'px'; box.style.fontFamily = `"${s.font}", sans-serif`; box.style.color = s.color; box.style.bottom = s.pos + '%';
  const o = s.outlineColor, w = s.outline;
  box.style.textShadow = w ? `0 0 ${w}px ${o}, 0 0 ${w}px ${o}, ${w / 2}px ${w / 2}px ${w}px ${o}, -${w / 2}px -${w / 2}px ${w}px ${o}` : 'none';
  box.style.setProperty('--sbg', `rgba(0,0,0,${s.bg / 100})`);
  let st = $('#subStyle'); if (!st) { st = h('style', { id: 'subStyle' }); document.head.append(st); }
  st.textContent = `#subs span{background:var(--sbg)}`;
}
function drawSubTimeline() {
  const strip = $('#subTimeline'); if (strip.classList.contains('hidden')) return;
  const c = $('#subCanvas'), r = c.getBoundingClientRect(); if (!r.width) return;
  c.width = r.width * devicePixelRatio; c.height = r.height * devicePixelRatio;
  const g = c.getContext('2d'), v = V(), d = v.duration; g.clearRect(0, 0, c.width, c.height);
  if (!d || !S.subCues.length) { g.fillStyle = '#777'; g.font = `${11 * devicePixelRatio}px sans-serif`; g.fillText('No subtitles loaded', 8, c.height * .68); return; }
  const dl = S.store.sub.delay; g.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim();
  g.globalAlpha = .75; S.subCues.forEach(q => g.fillRect(((q.s + dl) / d) * c.width, 2, Math.max(1.5, ((q.e - q.s) / d) * c.width), c.height - 4));
  g.globalAlpha = 1; g.fillStyle = '#fff'; g.fillRect((v.currentTime / d) * c.width - 1, 0, 2, c.height);
}
function initSubTimelineDrag() {
  const strip = $('#subTimeline'); let down = null;
  strip.addEventListener('pointerdown', e => { down = { x: e.clientX, delay: S.store.sub.delay, moved: false }; strip.setPointerCapture(e.pointerId); });
  strip.addEventListener('pointermove', e => {
    if (!down || !V().duration) return; const w = strip.clientWidth - 24, dx = e.clientX - down.x;
    if (Math.abs(dx) > 3) down.moved = true;
    if (down.moved) { S.store.sub.delay = Math.round((down.delay + (dx / w) * V().duration) * 10) / 10; osd('Subtitle delay ' + S.store.sub.delay.toFixed(1) + 's'); renderSubs(); drawSubTimeline(); if (S.panel === 'side') renderPanel(); }
  });
  strip.addEventListener('pointerup', e => { if (down && !down.moved && V().duration) { const r = strip.getBoundingClientRect(); V().currentTime = clamp((e.clientX - r.left - 12) / (r.width - 24), 0, 1) * V().duration; } down = null; save(); });
}
function setSubDelay(d) { S.store.sub.delay = Math.round(d * 10) / 10; osd('Subtitle delay ' + S.store.sub.delay.toFixed(1) + 's'); renderSubs(); save(); if (S.panel === 'side') renderPanel(); }

/* ---------- audio graph (EQ + gain) ---------- */
const EQ_FREQS = [60, 230, 910, 3600, 12000];
const EQ_PRESETS = { flat: [0, 0, 0, 0, 0], bass: [8, 5, 0, -1, -2], vocal: [-3, 0, 5, 4, -1], treble: [-2, -1, 0, 5, 8], cinema: [5, 2, 3, 3, 4], night: [-6, -3, 1, 2, -3] };
let actx, gainNode, eqNodes = [];
function ensureAudioGraph() {
  if (actx) return true;
  if (S.cur && S.cur.stream) { osd('Equalizer works with local files only'); return false; }
  try {
    actx = new (window.AudioContext || window.webkitAudioContext)();
    const src = actx.createMediaElementSource(V());
    let node = src;
    eqNodes = EQ_FREQS.map((f, i) => { const b = actx.createBiquadFilter(); b.type = i === 0 ? 'lowshelf' : i === 4 ? 'highshelf' : 'peaking'; b.frequency.value = f; b.Q.value = 1; node.connect(b); node = b; return b; });
    gainNode = actx.createGain(); node.connect(gainNode); gainNode.connect(actx.destination);
    return true;
  } catch { return false; }
}
function applyAudioFx() {
  const c = cfg(); if (c.eq === 'flat' && c.gain === 1 && !actx) return;
  if (!ensureAudioGraph()) return;
  (EQ_PRESETS[c.eq] || EQ_PRESETS.flat).forEach((g, i) => eqNodes[i].gain.value = g);
  gainNode.gain.value = c.gain; if (actx.state === 'suspended') actx.resume();
}
async function listAudioDevices() { try { await navigator.mediaDevices.getUserMedia({ audio: true }).then(s => s.getTracks().forEach(t => t.stop())).catch(() => {}); return (await navigator.mediaDevices.enumerateDevices()).filter(d => d.kind === 'audiooutput'); } catch { return []; } }
async function setAudioDevice(id) { try { await V().setSinkId(id); osd('Audio output changed'); } catch { osd('Could not switch output device'); } }

/* ---------- video effects ---------- */
const FILTER_PRESETS = {
  none: ['Original', ''], vivid: ['Vivid', 'saturate(1.5) contrast(1.1)'], warm: ['Warm', 'sepia(.35) saturate(1.2)'], cool: ['Cool', 'hue-rotate(190deg) saturate(.9)'],
  mono: ['Mono', 'grayscale(1) contrast(1.1)'], vintage: ['Vintage', 'sepia(.7) contrast(.95)'], night: ['Night', 'brightness(.75) contrast(1.15)'], hdr: ['HDR-ish', 'contrast(1.25) saturate(1.3) brightness(1.05)'],
};
function applyVideoFx() {
  const f = S.store.video, v = V();
  v.style.filter = `brightness(${f.brightness}%) contrast(${f.contrast}%) saturate(${f.saturate}%) hue-rotate(${f.hue}deg) ${FILTER_PRESETS[f.filter]?.[1] || ''}`;
  let sx = f.flipH ? -1 : 1, sy = f.flipV ? -1 : 1, z = f.zoom / 100;
  const vw = v.videoWidth, vh = v.videoHeight, W = v.clientWidth, H = v.clientHeight;
  v.style.objectFit = f.aspect === 'fill' ? 'cover' : f.aspect === 'stretch' ? 'fill' : 'contain';
  if (/^\d+:\d+$/.test(f.aspect) && vw && vh && W && H) {
    const [a, b] = f.aspect.split(':').map(Number), t = a / b, d = vw / vh, sc = Math.min(W / vw, H / vh);
    const w0 = vw * sc, h0 = vh * sc, w1 = t > d ? w0 * t / d : w0, h1 = t > d ? h0 : h0 * d / t, fit = Math.min(1, W / w1, H / h1);
    sx *= (w1 / w0) * fit; sy *= (h1 / h0) * fit;
  }
  v.style.transform = `rotate(${f.rotate}deg) scale(${sx * z}, ${sy * z})`;
}
function updateMeta() {
  const c = $('#metaCard'), v = V(), it = S.cur; if (!it) return;
  c.innerHTML = `<div><b>Title</b>${esc(stripExt(it.name))}</div><div><b>Type</b>${it.kind}</div>` +
    (v.videoWidth ? `<div><b>Resolution</b>${v.videoWidth}×${v.videoHeight}</div>` : '') + `<div><b>Duration</b>${fmt(v.duration || 0)}</div>` +
    (it.path && !it.stream ? `<div><b>Location</b>${esc(dirName(it.path))}</div>` : '');
}

/* ---------- presets ---------- */
function snapshotPreset(name) { const s = S.store; return { name, sub: { ...s.sub }, video: { ...s.video }, eq: cfg().eq, gain: cfg().gain, speed: cfg().speed }; }
function applyPreset(p, quiet) {
  const s = S.store; s.sub = { ...s.sub, ...p.sub, enabled: s.sub.enabled }; s.video = { ...s.video, ...p.video };
  cfg().eq = p.eq || 'flat'; cfg().gain = p.gain || 1; if (p.speed) { V().playbackRate = p.speed; cfg().speed = p.speed; }
  applySubStyle(); applyVideoFx(); applyAudioFx(); renderSubs(); save(); if (!quiet) osd('Preset: ' + p.name); if (S.panel === 'side') renderPanel();
}
function applyFolderPreset(it) { if (!it.path) return; const n = S.store.folderPreset[dirName(it.path)]; const p = n && S.store.presets.find(x => x.name === n); if (p) applyPreset(p, true); }
