const { app, BrowserWindow, ipcMain, dialog, shell, screen } = require('electron');
const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('url');
const { readAudioCover, readAudioInfo } = require('./src/audio-metadata.cjs');
const { listEmbeddedSubtitles, extractEmbeddedSubtitle, stopSubtitleTools } = require('./src/embedded-subtitles.cjs');
const { resolveNetworkMedia, fetchWithSession, createNetworkMediaProxy } = require('./src/network-media.cjs');
const networkMediaProxy = createNetworkMediaProxy();
const streamWebsites = new Set();
const { mediaLink, launchInputs } = require('./src/launch-input.cjs');
let rendererReady = false;
const pendingOpen = [];
function deliverOpen(inputs) {
  if (!inputs.length) return;
  if (win && rendererReady && !win.isDestroyed()) win.webContents.send('open:paths', inputs);
  else pendingOpen.push(...inputs);
}
function registerBrowserLinks() {
  const args = process.defaultApp ? [process.execPath, [path.resolve(process.argv[1])]] : [];
  return ['cono', 'vlc'].map(scheme => ({ scheme, registered: app.setAsDefaultProtocolClient(scheme, ...args) }));
}

const MEDIA_EXT = new Set(['.mp4','.mkv','.webm','.mov','.m4v','.avi','.ogv','.mp3','.flac','.wav','.ogg','.m4a','.opus','.aac']);
const AUDIO_EXT = new Set(['.mp3','.flac','.wav','.ogg','.m4a','.opus','.aac']);
const SUB_EXT = new Set(['.srt','.vtt','.ass','.ssa']);

let win;
const storeFile = () => path.join(app.getPath('userData'), 'store.json');
function readStore() {
  // Carry the existing library and settings across the application rename.
  const files = [storeFile(), ...['VLC Redesign', 'vlc-redesign'].map(name => path.join(app.getPath('appData'), name, 'store.json'))];
  for (const file of files) {
    try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch {}
  }
  return {};
}
function writeStore(o) { try { fs.writeFileSync(storeFile(), JSON.stringify(o)); } catch {} }

function describe(p) {
  const ext = path.extname(p).toLowerCase();
  return { path: p, name: path.basename(p), ext, kind: AUDIO_EXT.has(ext) ? 'audio' : 'video', url: pathToFileURL(p).href };
}
function scanDir(dir, depth = 0) {
  const out = { folders: [], files: [] };
  let ents = [];
  try { ents = fs.readdirSync(dir, { withFileTypes: true }); } catch { return out; }
  for (const e of ents) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) out.folders.push({ path: full, name: e.name });
    else if (MEDIA_EXT.has(path.extname(e.name).toLowerCase())) {
      let size = 0, mtime = 0;
      try { const st = fs.statSync(full); size = st.size; mtime = st.mtimeMs; } catch {}
      out.files.push({ ...describe(full), size, mtime });
    }
  }
  const cmp = (a, b) => a.name.localeCompare(b.name, undefined, { numeric: true });
  out.folders.sort(cmp); out.files.sort(cmp);
  return out;
}

function createWindow() {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;
  win = new BrowserWindow({
    width: Math.min(1280, width), height: Math.min(780, height), minWidth: 760, minHeight: 480,
    frame: false, backgroundColor: '#000000', title: 'Cono', icon: path.join(__dirname, 'src/assets/cono-icon.png'),
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, webSecurity: false }
  });
  win.setMenuBarVisibility(false);
  win.webContents.on('did-start-loading', () => { rendererReady = false; });
  win.loadFile(path.join(__dirname, 'src', 'index.html'));
  win.on('maximize', () => win.webContents.send('win:state', { maximized: true }));
  win.on('unmaximize', () => win.webContents.send('win:state', { maximized: false }));
  win.on('enter-full-screen', () => win.webContents.send('win:state', { fullscreen: true }));
  win.on('leave-full-screen', () => win.webContents.send('win:state', { fullscreen: false }));
  win.webContents.setWindowOpenHandler(({ url }) => { if (/^(cono|vlc):/i.test(url)) deliverOpen(launchInputs([url])); else if (/^https?:/i.test(url)) shell.openExternal(url); return { action: 'deny' }; });
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) app.quit();
app.on('second-instance', (_e, argv) => {
  if (win) { if (win.isMinimized()) win.restore(); win.focus(); }
  deliverOpen(launchInputs(argv.slice(app.isPackaged ? 1 : 2)));
});
app.on('open-url', (event, url) => { event.preventDefault(); deliverOpen(launchInputs([url])); });

app.whenReady().then(() => {
  if (!gotLock) return;
  if (process.platform === 'win32') app.setAppUserModelId('com.mugglenistam.cono');
  createWindow();
  deliverOpen(launchInputs(process.argv.slice(app.isPackaged ? 1 : 2)));
});
app.on('window-all-closed', () => app.quit());
app.on('before-quit', stopSubtitleTools);
app.on('before-quit', () => networkMediaProxy.close());

ipcMain.handle('win:minimize', () => win.minimize());
ipcMain.handle('win:maximize', () => (win.isMaximized() ? win.unmaximize() : win.maximize()));
ipcMain.handle('win:close', () => win.close());
ipcMain.handle('win:fullscreen', (_e, on) => { win.setFullScreen(on ?? !win.isFullScreen()); return win.isFullScreen(); });
ipcMain.handle('win:ontop', (_e, on) => { win.setAlwaysOnTop(!!on); return win.isAlwaysOnTop(); });

ipcMain.handle('store:get', () => readStore());
ipcMain.handle('store:set', (_e, o) => { writeStore(o); return true; });
ipcMain.handle('open:ready', event => {
  if (event.sender !== win?.webContents) return [];
  rendererReady = true; return pendingOpen.splice(0);
});
ipcMain.handle('app:browserLinks', () => registerBrowserLinks());

ipcMain.handle('dialog:files', async (_e, kind) => {
  const filters = kind === 'subs' ? [{ name: 'Subtitles', extensions: ['srt','vtt','ass','ssa'] }]
    : [{ name: 'Media', extensions: [...MEDIA_EXT].map(x => x.slice(1)) }, { name: 'All', extensions: ['*'] }];
  const r = await dialog.showOpenDialog(win, { properties: ['openFile', 'multiSelections'], filters });
  if (r.canceled) return [];
  return kind === 'subs' ? r.filePaths : r.filePaths.map(describe);
});
ipcMain.handle('dialog:folder', async () => {
  const r = await dialog.showOpenDialog(win, { properties: ['openDirectory'] });
  return r.canceled ? null : r.filePaths[0];
});
ipcMain.handle('fs:scan', (_e, dir) => scanDir(dir));
ipcMain.handle('media:cover', (_e, file) => readAudioCover(file));
ipcMain.handle('media:audioInfo', (_e, file) => readAudioInfo(file));
ipcMain.handle('net:resolveMedia', async (event, url) => {
  const link = mediaLink(url); if (!link) throw new Error('Use an HTTP, HTTPS, Cono or VLC media link');
  const result = await resolveNetworkMedia(link, (input, init) => fetchWithSession(input, init, event.sender.session));
  result.sourceUrl = link;
  if (result.type === 'media') result.playbackUrl = await networkMediaProxy.register(result.url, event.sender.session);
  return result;
});
ipcMain.handle('net:openWebsite', (_e, input) => {
  const url = new URL(input); if (!['http:', 'https:'].includes(url.protocol)) return false;
  const site = new BrowserWindow({ width: 1000, height: 760, title: 'Cono · Website access', webPreferences: { session: _e.sender.session, sandbox: true, contextIsolation: true, nodeIntegration: false } });
  streamWebsites.add(site); site.on('closed', () => streamWebsites.delete(site));
  const openAppLink = url => { if (!/^(cono|vlc):/i.test(url)) return false; deliverOpen(launchInputs([url])); if (win) win.focus(); return true; };
  site.webContents.on('will-navigate', (event, url) => { if (openAppLink(url)) event.preventDefault(); });
  site.webContents.on('will-redirect', (event, url) => { if (openAppLink(url)) event.preventDefault(); });
  site.webContents.setWindowOpenHandler(({ url }) => {
    if (openAppLink(url)) return { action: 'deny' };
    // Some sites create about:blank first, then assign the player URL to it.
    return url === 'about:blank' || /^https?:/i.test(url) ? { action: 'allow', overrideBrowserWindowOptions: { webPreferences: { session: _e.sender.session, sandbox: true, contextIsolation: true, nodeIntegration: false } } } : { action: 'deny' };
  });
  site.webContents.on('did-create-window', child => {
    streamWebsites.add(child); child.on('closed', () => streamWebsites.delete(child));
    child.webContents.on('will-navigate', (event, url) => { if (openAppLink(url)) { event.preventDefault(); child.close(); } });
    child.webContents.on('will-redirect', (event, url) => { if (openAppLink(url)) { event.preventDefault(); child.close(); } });
    child.webContents.setWindowOpenHandler(({ url }) => { openAppLink(url); return { action: 'deny' }; });
  });
  site.loadURL(url.href).catch(() => {}); return true;
});
ipcMain.handle('media:subtitleTracks', (_e, file) => listEmbeddedSubtitles(file));
ipcMain.handle('media:subtitleText', (_e, file, index) => extractEmbeddedSubtitle(file, index));
ipcMain.handle('fs:describe', (_e, paths) => paths.map(p => {
  try { const st = fs.statSync(p); if (st.isDirectory()) return { dir: p, ...scanDir(p) }; return describe(p); } catch { return null; }
}).filter(Boolean));
ipcMain.handle('fs:readText', (_e, p) => { try { return fs.readFileSync(p).toString('utf8').replace(/^﻿/, ''); } catch { return null; } });
ipcMain.handle('fs:findSubs', (_e, mediaPath) => {
  try {
    const dir = path.dirname(mediaPath); const base = path.basename(mediaPath, path.extname(mediaPath)).toLowerCase();
    return fs.readdirSync(dir).filter(f => SUB_EXT.has(path.extname(f).toLowerCase()) && path.basename(f, path.extname(f)).toLowerCase().startsWith(base)).map(f => path.join(dir, f));
  } catch { return []; }
});
ipcMain.handle('fs:listSubs', (_e, dir) => {
  try { return fs.readdirSync(dir).filter(f => SUB_EXT.has(path.extname(f).toLowerCase())).map(f => path.join(dir, f)); } catch { return []; }
});
ipcMain.handle('net:fetchText', async (_e, url) => {
  try { const r = await fetch(url); return await r.text(); } catch { return null; }
});
ipcMain.handle('shell:show', (_e, p) => shell.showItemInFolder(p));
