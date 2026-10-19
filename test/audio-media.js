// Run with: node test/audio-media.js (uses Electron and generated audio fixtures).
if (!process.versions.electron || process.type !== 'browser') {
  const env = { ...process.env }; delete env.ELECTRON_RUN_AS_NODE;
  const result = require('node:child_process').spawnSync(require('electron'), [__filename], { env, stdio: 'inherit', windowsHide: true });
  process.exit(result.status ?? 1);
} else {
  const { app, BrowserWindow, ipcMain, nativeImage } = require('electron');
  const assert = require('node:assert/strict');
  const fs = require('node:fs');
  const path = require('node:path');
  const appRoot = process.env.CONO_APP_ROOT || path.join(__dirname, '..');
  const { pathToFileURL } = require('node:url');
  const { readAudioCover } = require(path.join(appRoot, 'src/audio-metadata.cjs'));
  app.commandLine.appendSwitch('force-device-scale-factor', '1');
  app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');
  const dir = fs.mkdtempSync(path.join(require('node:os').tmpdir(), 'vlc-audio-test-'));
  function chunk(name, bytes) {
    const header = Buffer.alloc(8); header.write(name); header.writeUInt32LE(bytes.length, 4);
    return Buffer.concat([header, bytes, Buffer.alloc(bytes.length % 2)]);
  }
  function wave(cover) {
    const format = Buffer.alloc(16);
    format.writeUInt16LE(1, 0); format.writeUInt16LE(2, 2); format.writeUInt32LE(16000, 4);
    format.writeUInt32LE(64000, 8); format.writeUInt16LE(4, 12); format.writeUInt16LE(16, 14);
    const pcm = Buffer.alloc(4 * 32000);
    // Left channel is silent: the waveform must include the right channel.
    for (let i = 0; i < 32000; i++) pcm.writeInt16LE(Math.round(Math.sin(i * 2 * Math.PI * 440 / 16000) * (4000 + 20000 * i / 32000)), i * 4 + 2);
    const chunks = [chunk('fmt ', format), chunk('data', pcm)];
    if (cover) {
      const picture = Buffer.concat([Buffer.from([0]), Buffer.from('image/png\0'), Buffer.from([3, 0]), cover]);
      const frame = Buffer.alloc(10); frame.write('APIC'); frame.writeUInt32BE(picture.length, 4);
      const body = Buffer.concat([frame, picture]), header = Buffer.from('49443303000000000000', 'hex');
      for (let i = 0; i < 4; i++) header[9 - i] = (body.length >>> (7 * i)) & 127;
      chunks.push(chunk('id3 ', Buffer.concat([header, body])));
    }
    const body = Buffer.concat([Buffer.from('WAVE'), ...chunks]), header = Buffer.alloc(8);
    header.write('RIFF'); header.writeUInt32LE(body.length, 4);
    return Buffer.concat([header, body]);
  }
  const coverPng = nativeImage.createFromBitmap(Buffer.from([0, 0, 255, 255]), { width: 1, height: 1 }).resize({ width: 32, height: 32 }).toPNG();
  const plain = path.join(dir, 'No cover.wav'), embedded = path.join(dir, 'Embedded cover.wav');
  fs.writeFileSync(plain, wave()); fs.writeFileSync(embedded, wave(coverPng));
  const items = [plain, embedded].map(file => ({ path: file, url: pathToFileURL(file).href, name: path.basename(file), kind: 'audio' }));
  ipcMain.handle('store:get', () => ({ settings: { onboarded: true, autoSubs: false, history: false, keepQueue: false, waveform: false } }));
  ipcMain.handle('store:set', () => true);
  ipcMain.handle('media:cover', (_e, file) => readAudioCover(file));
  ipcMain.handle('fs:scan', () => ({ folders: [], files: items }));
  app.whenReady().then(async () => {
    const win = new BrowserWindow({ show: false, width: 1280, height: 780, webPreferences: {
      preload: path.join(appRoot, 'preload.js'), contextIsolation: true,
      backgroundThrottling: false, offscreen: true, partition: `audio-test-${Date.now()}`, webSecurity: false,
    } });
    const run = code => win.webContents.executeJavaScript(code);
    win.webContents.debugger.attach('1.3');
    const errors = [];
    win.webContents.on('console-message', (_e, level, message) => { if (level === 3 && !message.includes('ERR_FILE_NOT_FOUND')) errors.push(message); });
    const waitFor = async (code, label) => {
      for (let i = 0; i < 250; i++) {
        if (await run(code)) return;
        await new Promise(resolve => setTimeout(resolve, 20));
      }
      throw new Error('Timed out: ' + label);
    };
    try {
      assert.equal(await readAudioCover(plain), null, 'audio without embedded image');
      assert.match(await readAudioCover(embedded), /^data:image\/png;base64,/, 'real embedded image parser');
      assert.equal(await readAudioCover(path.join(dir, 'missing.wav')), null, 'missing files fall back');
      await win.loadFile(path.join(appRoot, 'src/index.html'));
      await waitFor('window.__ready', 'initialization');
      await run(`libGo('music', ${JSON.stringify(dir)})`);
      await waitFor(`$$('#library .card .th img').length === 2 && $$('#library .card .th img').some(img => img.src.startsWith('data:'))`, 'folder artwork');
      assert.equal(await run(`$$('#library .card .th img').filter(img => img.src.endsWith('audio-fallback.jpg')).length`), 1, 'fallback in audio folder');
      await waitFor(`$$('#library .card .dur').length === 2 && $$('#library .card .dur').every(el => el.textContent === '00:02')`, 'grid durations before playback');
      assert.equal(await run(`V().getAttribute('src')`), null, 'duration reads do not start playback');
      for (const mode of ['list', 'detail']) {
        await run(`cfg().libView = '${mode}'; renderLib()`);
        await waitFor(`$$('#library .rows .mini img').length === 2 && $$('#library .rows .mini img').some(img => img.src.startsWith('data:'))`, `${mode} artwork`);
        await waitFor(`$$('#library .file-duration').length === 2 && $$('#library .file-duration').every(el => el.textContent === '00:02')`, `${mode} durations`);
      }
      await run(`S.store.playlists.push({ name: 'Duration test', items: ${JSON.stringify(items)} }); libGo('playlists', 'Duration test')`);
      await waitFor(`$$('#library .file-duration').length === 2 && $$('#library .file-duration').every(el => el.textContent === '00:02')`, 'playlist durations');
      await run(`libGo('music', ${JSON.stringify(dir)})`);
      await run(`cfg().libView = 'grid'; renderLib()`);
      await run(`playItems(${JSON.stringify(items)}, 0)`);
      await waitFor(`S.peaks?.length > 0 && V().duration > 0`, 'decoded audio waveform');
      await run(`V().pause(); V().currentTime = 0; updateTimes()`);
      assert.equal(await run(`$('.art-cover').getAttribute('src')`), 'assets/audio-fallback.jpg', 'playback fallback');
      await waitFor(`$('.art-cover').complete && $('.art-cover').naturalWidth === 600`, 'bundled fallback image loads');
      assert.ok(await run('Math.max(...S.peaks) > .9'), 'right channel contributes to waveform');
      await run(`V().currentTime = V().duration / 2; cfg().accent = '#12ab34'; applyTheme(); updateTimes()`);
      const colors = await run(`(() => {
        const c = $('#wave'), g = c.getContext('2d'), points = [[], []];
        for (let x = 0; x < c.width; x++) {
          const p = [...g.getImageData(x, Math.floor(c.height / 2), 1, 1).data];
          if (p[3]) points[x < c.width / 2 ? 0 : 1].push(p.slice(0, 3).join(','));
        }
        return points;
      })()`);
      assert.ok(colors[0].includes('18,171,52'), 'played waveform follows current accent');
      assert.ok(colors[1].includes('90,90,90') && !colors[1].includes('18,171,52'), 'unplayed waveform is neutral');
      await run(`playIndex(1)`);
      await waitFor(`$('.art-cover').src.startsWith('data:') && S.peaks?.length > 0 && V().duration > 0`, 'embedded artwork during playback');
      await run(`V().pause(); V().currentTime = V().duration * .45; updateTimes()`);
      await run(`showLibrary(true, 'compact')`);
      await waitFor(`$$('#libPanel .dur').length === 2 && $$('#libPanel .dur').every(el => el.textContent === '00:02')`, 'compact grid durations');
      await new Promise(resolve => setTimeout(resolve, 200));
      fs.writeFileSync(path.join(dir, 'audio-playback.png'), (await win.webContents.capturePage()).toPNG());
      await run(`$('.art-cover').src = AUDIO_FALLBACK`);
      await new Promise(resolve => setTimeout(resolve, 200));
      fs.writeFileSync(path.join(dir, 'audio-fallback.png'), (await win.webContents.capturePage()).toPNG());
      await run(`S.cur = { kind: 'video', url: 'video.webm' }; drawWave()`);
      assert.equal(await run(`$('#wave').getContext('2d').getImageData(0, 0, $('#wave').width, $('#wave').height).data.some(v => v !== 0)`), false, 'no waveform for video');
      // Simulate a decoder finishing after switching to a video.
      await run(`S.cur = ${JSON.stringify(items[0])}; peakCache.clear(); window.pendingWave = computePeaks(S.cur.url); S.cur = { kind: 'video', url: 'video.webm' }; S.peaks = null;`);
      await run('window.pendingWave');
      assert.equal(await run('S.peaks'), null, 'stale audio analysis cannot overwrite video');
      assert.deepEqual(errors, [], 'renderer has no errors');
      console.log('PASS: embedded/fallback artwork in folders and playback, stereo waveform, progress/accent, audio-only and stale results.');
      console.log('Screenshot: ' + path.join(dir, 'audio-playback.png'));
      app.exit(0);
    } catch (error) { console.error(error); app.exit(1); }
  });
}
