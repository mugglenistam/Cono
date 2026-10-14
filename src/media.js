/* Shared audio artwork for playback, folders, recents and playlists. */
const AUDIO_FALLBACK = 'assets/audio-fallback.jpg';
const audioCovers = new Map();
function audioCover(it) {
  if (it.kind !== 'audio' || it.stream || !it.path || !hasApi || !api.audioCover) return Promise.resolve(AUDIO_FALLBACK);
  const key = `${it.path}:${it.mtime || ''}:${it.size || ''}`;
  if (!audioCovers.has(key)) {
    audioCovers.set(key, Promise.resolve().then(() => api.audioCover(it.path)).then(cover => cover || AUDIO_FALLBACK).catch(() => AUDIO_FALLBACK));
    if (audioCovers.size > 64) audioCovers.delete(audioCovers.keys().next().value);
  }
  return audioCovers.get(key);
}
function coverImage(cls = '') {
  return h('img', { class: cls, src: AUDIO_FALLBACK, alt: 'Album cover', onerror: e => {
    const img = e.currentTarget;
    if (img.getAttribute('src') !== AUDIO_FALLBACK) img.src = AUDIO_FALLBACK;
  } });
}

/* Read only metadata, with a small queue so large folders stay responsive. */
const durationCache = new Map(), durationQueue = [];
let durationReads = 0;
function drainDurations() {
  while (durationReads < 4 && durationQueue.length) {
    durationReads++;
    durationQueue.shift()().finally(() => { durationReads--; drainDurations(); });
  }
}
function mediaDuration(it) {
  if (Number.isFinite(it.duration) && it.duration > 0) return Promise.resolve(it.duration);
  if (!it.url || it.stream) return Promise.resolve(null);
  const key = `${it.url}:${it.mtime || ''}:${it.size || ''}`;
  if (!durationCache.has(key)) {
    const pending = new Promise(resolve => durationQueue.push(() => new Promise(done => {
      const media = document.createElement(it.kind === 'audio' ? 'audio' : 'video');
      let timer;
      const finish = duration => {
        clearTimeout(timer); media.onloadedmetadata = media.onerror = null;
        media.removeAttribute('src'); media.load();
        resolve(duration); done();
      };
      media.preload = 'metadata';
      media.onloadedmetadata = () => finish(Number.isFinite(media.duration) && media.duration > 0 ? media.duration : null);
      media.onerror = () => finish(null);
      timer = setTimeout(() => finish(null), 10000);
      media.src = it.url;
    })));
    durationCache.set(key, pending);
    if (durationCache.size > 500) durationCache.delete(durationCache.keys().next().value);
    drainDurations();
  }
  return durationCache.get(key);
}
function durationLabel(it, cls) {
  const label = h('span', { class: cls, title: 'Duration' }, '—');
  label._load = async () => {
    const duration = await mediaDuration(it);
    label.textContent = duration == null ? '—' : fmt(duration, false);
    label.setAttribute('aria-label', 'Duration: ' + label.textContent);
  };
  lazyObs.observe(label);
  return label;
}
