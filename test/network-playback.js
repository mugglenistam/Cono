// node test/network-playback.js — local HTTP fixtures, no external account needed.
if (!process.versions.electron || process.type !== 'browser') {
  const env = { ...process.env }; delete env.ELECTRON_RUN_AS_NODE;
  process.exit(require('node:child_process').spawnSync(require('electron'), [__filename], { env, stdio: 'inherit', windowsHide: true }).status ?? 1);
} else {
  const { app, BrowserWindow, ipcMain, net } = require('electron');
  const fs = require('node:fs'), path = require('node:path'), http = require('node:http'), assert = require('node:assert/strict');
  const root = process.env.CONO_APP_ROOT || path.join(__dirname, '..');
  const { resolveNetworkMedia, fetchWithSession, createNetworkMediaProxy } = require(path.join(root, 'src/network-media.cjs'));
  const proxy = createNetworkMediaProxy();
  app.on('before-quit', () => proxy.close());
  const folder = fs.mkdtempSync(path.join(require('node:os').tmpdir(), 'cono-network-'));
  const movie = path.join(folder, 'online.mkv');
  require('node:child_process').execFileSync(require('ffmpeg-static'), ['-v', 'error', '-f', 'lavfi', '-i', 'testsrc2=duration=8:size=320x180:rate=24', '-c:v', 'libx264', '-preset', 'ultrafast', '-pix_fmt', 'yuv420p', '-g', '24', movie], { windowsHide: true, timeout: 20000 });
  const binary = fs.readFileSync(movie); let origin, bytesSent = 0, ignoredRangeBytes = 0;
  const server = http.createServer((req, res) => {
    if (req.url === '/ignores-range.mkv') {
      res.writeHead(200, { 'Content-Type': 'application/octet-stream' });
      const timer = setInterval(() => { ignoredRangeBytes += 4096; res.write(Buffer.alloc(4096)); }, 10);
      res.on('close', () => clearInterval(timer)); return;
    }
    if (req.url === '/redirect') { res.writeHead(302, { Location: '/download.php?f=online.mkv' }); return res.end(); }
    if (req.url === '/auth-redirect') { res.writeHead(302, { Location: '/protected.mkv', 'Set-Cookie': 'cono_test=allowed; Path=/; HttpOnly' }); return res.end(); }
    if (req.url === '/protected.mkv' && !req.headers.cookie?.includes('cono_test=allowed')) { res.writeHead(200, { 'Content-Type': 'text/html' }); return res.end('<html>Sign in required</html>'); }
    if (req.url.startsWith('/gate')) { res.writeHead(200, { 'Content-Type': 'text/html' }); return res.end('<html><h1>اشتراک خود را فعال کنید</h1></html>'); }
    if (req.url === '/playlist.m3u') { res.writeHead(200, { 'Content-Type': 'audio/x-mpegurl' }); return res.end('#EXTM3U\n#EXTINF:-1,Online MKV\n/download.php?f=online.mkv\n'); }
    if (req.url.startsWith('/download.php') || req.url === '/protected.mkv') {
      const range = req.headers.range?.match(/bytes=(\d+)-(\d*)/);
      const start = range ? +range[1] : 0, end = Math.min(range?.[2] ? +range[2] : binary.length - 1, binary.length - 1);
      if (start >= binary.length) { res.writeHead(416, { 'Content-Range': `bytes */${binary.length}` }); return res.end(); }
      res.writeHead(range ? 206 : 200, { 'Content-Type': 'application/octet-stream', 'Accept-Ranges': 'bytes', 'Content-Length': end - start + 1, ...(range ? { 'Content-Range': `bytes ${start}-${end}/${binary.length}` } : {}) });
      bytesSent += end - start + 1; return res.end(binary.subarray(start, end + 1));
    }
    res.writeHead(404); res.end();
  });
  ipcMain.handle('store:get', () => ({ settings: { onboarded: true, history: false, keepQueue: false } }));
  ipcMain.handle('store:set', () => true);
  ipcMain.handle('open:ready', () => []);
  ipcMain.handle('net:resolveMedia', async (event, url) => {
    const result = await resolveNetworkMedia(url, (input, init) => fetchWithSession(input, init, event.sender.session));
    if (result.type === 'media') result.playbackUrl = await proxy.register(result.url, event.sender.session);
    return result;
  });
  app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');
  app.whenReady().then(async () => {
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve)); origin = `http://127.0.0.1:${server.address().port}`;
    const win = new BrowserWindow({ show: false, width: 1280, height: 780, webPreferences: { preload: path.join(root, 'preload.js'), contextIsolation: true, offscreen: true, backgroundThrottling: false, webSecurity: false, partition: `network-${Date.now()}` } });
    const run = code => win.webContents.executeJavaScript(code);
    const wait = async (code, label) => {
      const deadline = Date.now() + 12000;
      while (Date.now() < deadline) { if (await run(code)) return; await new Promise(resolve => setTimeout(resolve, 30)); }
      throw new Error('Timed out: ' + label + ' ' + await run('JSON.stringify({error:V().error?.message,src:V().src,ready:V().readyState,time:V().currentTime})'));
    };
    try {
      const resolved = await resolveNetworkMedia(origin + '/redirect');
      assert.equal(resolved.filename, 'online.mkv'); assert.equal(resolved.type, 'media');
      assert.ok(bytesSent <= 128 * 1024, 'resolver fetch is bounded, not the whole movie');
      const started = Date.now();
      assert.equal((await resolveNetworkMedia(origin + '/ignores-range.mkv')).type, 'media');
      assert.ok(Date.now() - started < 1000 && ignoredRangeBytes < 128 * 1024, 'a server ignoring Range cannot trigger a whole-file text download');
      assert.equal((await resolveNetworkMedia(origin + '/gate')).accessRequired, true);
      assert.equal((await resolveNetworkMedia(origin + '/playlist.m3u')).type, 'playlist');
      await win.loadFile(path.join(root, 'src/index.html')); await wait('window.__ready', 'init');
      await run(`playStream({url:${JSON.stringify(origin + '/redirect')},name:'Online MKV'})`);
      await wait('V().currentTime > .3 && V().videoWidth === 320', 'HTTP MKV playback');
      assert.equal(await run('V().paused'), false);
      await run(`seekBy(5)`); await wait('!V().seeking && V().currentTime > 5', 'HTTP MKV seeking');
      await run(`playStream({url:${JSON.stringify(origin + '/auth-redirect')},name:'Authenticated MKV'})`);
      await wait(`S.cur.name === 'Authenticated MKV' && V().currentTime > .3`, 'session cookie preserved across redirects and playback');
      const cookies = await win.webContents.session.cookies.get({ url: origin });
      assert.equal(cookies.find(cookie => cookie.name === 'cono_test')?.httpOnly, true);
      await run(`playItems([itemFromUrl(${JSON.stringify(origin + '/redirect')}, 'Saved MKV')])`);
      await wait(`!!resumePrompt`, 'unfinished saved stream asks to resume');
      await run(`resumePrompt.el.querySelector('.primary').click()`);
      await wait(`S.cur.name === 'Saved MKV' && V().currentTime > .3`, 'saved stream items resolve on replay');
      await run(`playStream({url:${JSON.stringify(origin + '/gate')},name:'Access required'})`);
      assert.equal(await run(`$('.modal-h h2').textContent`), 'Website access required');
      console.log('PASS: bounded resolution, redirects, query-string MKV, actual HTTP video frames/seek, playlist and subscription-page detection.');
      server.close(); app.exit(0);
    } catch (error) { console.error(error); server.close(); app.exit(1); }
  });
}
