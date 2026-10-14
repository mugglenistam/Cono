// Consistent line icon set (24x24, round caps) used everywhere, plus the two-tone set for menus.
const P = {
  play: '<polygon points="7 4 20 12 7 20" fill="currentColor"/>',
  pause: '<rect x="6" y="4" width="4.5" height="16" rx="1.2" fill="currentColor"/><rect x="13.5" y="4" width="4.5" height="16" rx="1.2" fill="currentColor"/>',
  prev: '<polygon points="19 19 9 12 19 5" fill="currentColor"/><line x1="5" y1="5" x2="5" y2="19"/>',
  next: '<polygon points="5 5 15 12 5 19" fill="currentColor"/><line x1="19" y1="5" x2="19" y2="19"/>',
  volume: '<polygon points="11 5 6 9 2.5 9 2.5 15 6 15 11 19" fill="currentColor"/><path d="M15.5 8.5a5 5 0 0 1 0 7M19 5.5a9.5 9.5 0 0 1 0 13"/>',
  mute: '<polygon points="11 5 6 9 2.5 9 2.5 15 6 15 11 19" fill="currentColor"/><path d="M16 9l6 6M22 9l-6 6"/>',
  audio: '<path d="M3 12h1.5M7.5 8v8M11.5 4v16M15.5 8.5v7M19.5 6v12"/>',
  subs: '<rect x="2.5" y="5" width="19" height="14" rx="2.5"/><path d="M6.5 11h4M13.5 11h4M6.5 15h7"/>',
  gear: '<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/>',
  queue: '<path d="M3 6h13M3 12h9M3 18h9"/><path d="M16 12.5l5.5 3.2-5.5 3.2z" fill="currentColor"/>',
  fullscreen: '<path d="M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M16 21h3a2 2 0 0 0 2-2v-3"/>',
  exitfs: '<path d="M8 3v3a2 2 0 0 1-2 2H3M21 8h-3a2 2 0 0 1-2-2V3M3 16h3a2 2 0 0 1 2 2v3M16 21v-3a2 2 0 0 1 2-2h3"/>',
  pip: '<path d="M21 9V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h4"/><rect x="12" y="13" width="10" height="8" rx="2"/>',
  sidebar: '<rect x="3" y="3" width="18" height="18" rx="3"/><path d="M9 3v18"/>',
  dots: '<circle cx="5" cy="12" r="1.6" fill="currentColor"/><circle cx="12" cy="12" r="1.6" fill="currentColor"/><circle cx="19" cy="12" r="1.6" fill="currentColor"/>',
  back: '<path d="M19 12H5M12 19l-7-7 7-7"/>',
  forward: '<path d="M5 12h14M12 5l7 7-7 7"/>',
  home: '<path d="M3 10.5l9-7.5 9 7.5V20a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z"/>',
  video: '<rect x="3" y="3" width="18" height="18" rx="4"/><polygon points="10 8 16 12 10 16" fill="currentColor"/>',
  music: '<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>',
  network: '<circle cx="12" cy="12" r="2"/><path d="M16.2 7.8a6 6 0 0 1 0 8.4M7.8 16.2a6 6 0 0 1 0-8.4M19.1 4.9a10 10 0 0 1 0 14.2M4.9 19.1a10 10 0 0 1 0-14.2"/>',
  playlist: '<path d="M3 6h14M3 12h14M3 18h8"/><path d="M17 17.5V13l4-1v4.5"/><circle cx="15.5" cy="18" r="1.6"/><circle cx="19.5" cy="16.6" r="1.6"/>',
  recent: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5M12 7v5l4 2"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  folder: '<path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.7-.9l-.8-1.2A2 2 0 0 0 7.9 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2z"/>',
  file: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>',
  sort: '<path d="M7 4v16M3 16l4 4 4-4M17 20V4M13 8l4-4 4 4"/>',
  grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13"/><circle cx="3.5" cy="6" r=".8" fill="currentColor"/><circle cx="3.5" cy="12" r=".8" fill="currentColor"/><circle cx="3.5" cy="18" r=".8" fill="currentColor"/>',
  detail: '<rect x="3" y="4" width="18" height="6" rx="1.5"/><rect x="3" y="14" width="18" height="6" rx="1.5"/>',
  close: '<path d="M18 6L6 18M6 6l12 12"/>',
  min: '<path d="M5 12h14"/>',
  max: '<rect x="5.5" y="5.5" width="13" height="13" rx="1.5"/>',
  restore: '<rect x="4.5" y="8.5" width="11" height="11" rx="1.5"/><path d="M8.5 8.5V6a1.5 1.5 0 0 1 1.5-1.5h8A1.5 1.5 0 0 1 19.5 6v8a1.5 1.5 0 0 1-1.5 1.5h-2.5"/>',
  chevron: '<path d="M9 18l6-6-6-6"/>',
  chevdown: '<path d="M6 9l6 6 6-6"/>',
  check: '<path d="M20 6L9 17l-5-5"/>',
  bookmark: '<path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>',
  shuffle: '<path d="M16 3h5v5M4 20L21 3M21 16v5h-5M15 15l6 6M4 4l5 5"/>',
  repeat: '<path d="M17 2l4 4-4 4M3 11v-1a4 4 0 0 1 4-4h14M7 22l-4-4 4-4M21 13v1a4 4 0 0 1-4 4H3"/>',
  trash: '<path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 16v-4M12 8h.01"/>',
  external: '<path d="M15 3h6v6M10 14L21 3M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>',
  keyboard: '<rect x="2" y="5" width="20" height="14" rx="2.5"/><path d="M6 9h.01M10 9h.01M14 9h.01M18 9h.01M7 15h10"/>',
  wand: '<path d="M15 4V2M15 16v-2M8 9h2M20 9h2M17.8 11.8L19 13M15 9h.01M17.8 6.2L19 5M3 21l9-9M12.2 6.2L11 5"/>',
  pin: '<path d="M12 17v5M9 10.8a2 2 0 0 1-1.1 1.8l-1.8.9A2 2 0 0 0 5 15.2V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.8a2 2 0 0 0-1.1-1.8l-1.8-.9a2 2 0 0 1-1.1-1.8V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z"/>',
  moon: '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9z"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  eyeoff: '<path d="M3 3l18 18M10.6 5.1A10 10 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3.2 4M6.6 6.6A16 16 0 0 0 2 12s3.5 7 10 7a9.7 9.7 0 0 0 5.4-1.6"/>',
  camera: '<path d="M23 7l-7 5 7 5z"/><rect x="1" y="5" width="15" height="14" rx="2.5"/>',
  clipboard: '<rect x="8" y="2" width="8" height="4" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>',
  rotate: '<path d="M21 12a9 9 0 1 1-3-6.7L21 8M21 3v5h-5"/>',
  flipH: '<path d="M12 3v18M8 7L3 12l5 5zM16 7l5 5-5 5z"/>',
  zoom: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3M8 11h6M11 8v6"/>',
  grip: '<circle cx="9" cy="6" r="1.2" fill="currentColor"/><circle cx="15" cy="6" r="1.2" fill="currentColor"/><circle cx="9" cy="12" r="1.2" fill="currentColor"/><circle cx="15" cy="12" r="1.2" fill="currentColor"/><circle cx="9" cy="18" r="1.2" fill="currentColor"/><circle cx="15" cy="18" r="1.2" fill="currentColor"/>',
  sliders: '<path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0"/><circle cx="16" cy="6" r="2"/><circle cx="10" cy="12" r="2"/><circle cx="18" cy="18" r="2"/>',
  palette: '<circle cx="12" cy="12" r="9"/><circle cx="8" cy="10" r="1.2" fill="currentColor"/><circle cx="12" cy="7.5" r="1.2" fill="currentColor"/><circle cx="16" cy="10" r="1.2" fill="currentColor"/>',
  lock: '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
  puzzle: '<path d="M10 4a2 2 0 1 1 4 0v2h4v4h2a2 2 0 1 1 0 4h-2v4h-4v-2a2 2 0 1 0-4 0v2H6v-4H4a2 2 0 1 1 0-4h2V6h4z"/>',
  mouse: '<rect x="6" y="2" width="12" height="20" rx="6"/><path d="M12 6v4"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  waveform: '<path d="M2 12h2M6 9v6M10 5v14M14 8v8M18 10v4M22 12h-1"/>',
  record: '<circle cx="12" cy="12" r="6" fill="#e5484d" stroke="none"/>',
  down: '<path d="M12 4v12M6 12l6 6 6-6"/>',
  star: '<polygon points="12 2 15 9 22 9.5 16.5 14 18.5 21 12 17 5.5 21 7.5 14 2 9.5 9 9" />',
};
function ico(name, cls = '') {
  const body = P[name] || '';
  return `<svg class="ico ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
}
// Two-tone (gray + accent) icons used for non-clickable menu glyphs.
function ico2(name) {
  return `<span class="ico2">${ico(name)}</span>`;
}
const CONE_SVG = `<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M16 3.2c.9 0 1.6.6 1.9 1.4L23 22H9L14.1 4.6c.3-.8 1-1.4 1.9-1.4z" fill="var(--accent)"/><path d="M13.1 13h5.8l1 3.6h-7.8z M11.3 19.2h9.4l.6 2.2h-10.6z" fill="#e9e9e9"/><rect x="3.5" y="22" width="25" height="6.5" rx="2" fill="var(--accent)"/></svg>`;
function hydrateIcons(root = document) {
  root.querySelectorAll('[data-ico]').forEach(el => { if (!el.dataset.done) { el.insertAdjacentHTML('afterbegin', ico(el.dataset.ico)); el.dataset.done = 1; } });
  root.querySelectorAll('.logo:not([data-done])').forEach(el => { el.innerHTML = CONE_SVG; el.dataset.done = 1; });
}
