// Run: node test/video-subtitles.js. Generates a long-GOP MKV with embedded SRT/ASS.
if (!process.versions.electron || process.type !== 'browser') {
  const env = { ...process.env }; delete env.ELECTRON_RUN_AS_NODE;
  const result = require('node:child_process').spawnSync(require('electron'), [__filename], { env, stdio: 'inherit', windowsHide: true });
  process.exit(result.status ?? 1);
} else {
  const { app, BrowserWindow, ipcMain } = require('electron');
  ipcMain.handle('open:ready', () => []);
  const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
  const { execFileSync } = require('node:child_process');
  const { pathToFileURL } = require('node:url');
  const root = process.env.CONO_APP_ROOT || path.join(__dirname, '..');
  const { listEmbeddedSubtitles, extractEmbeddedSubtitle, stopSubtitleTools } = require(path.join(root, 'src/embedded-subtitles.cjs'));
  const dir = fs.mkdtempSync(path.join(require('node:os').tmpdir(), 'cono-video-test-'));
  const subtitle = path.join(dir, 'English.srt'), ass = path.join(dir, 'Persian.ass');
  const movie = path.join(dir, 'Video with embedded subtitles.mkv');
  fs.writeFileSync(subtitle, '1\n00:00:00,000 --> 00:00:23,500\nEmbedded English\n');
  fs.writeFileSync(ass, '[Script Info]\nScriptType: v4.00+\n[V4+ Styles]\nFormat: Name, Fontname, Fontsize, PrimaryColour\nStyle: Default,Arial,24,&H00FFFFFF\n[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\nDialogue: 0,0:00:00.00,0:00:23.50,Default,,0,0,0,,زیرنویس فارسی داخلی\n');
  const ffmpeg = require('ffmpeg-static');
  execFileSync(ffmpeg, ['-nostdin', '-v', 'error', '-f', 'lavfi', '-i', 'testsrc2=duration=24:size=320x180:rate=24', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=24', '-i', subtitle, '-i', ass, '-map', '0:v', '-map', '1:a', '-map', '2:s', '-map', '3:s', '-c:v', 'libx264', '-preset', 'ultrafast', '-g', '240', '-keyint_min', '240', '-sc_threshold', '0', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-c:s:0', 'srt', '-c:s:1', 'ass', '-metadata:s:s:0', 'language=eng', '-metadata:s:s:0', 'title=English', '-metadata:s:s:1', 'language=fas', '-metadata:s:s:1', 'title=Persian', '-disposition:s:0', 'default', '-disposition:s:1', '0', movie], { windowsHide: true, timeout: 30000 });
  const item = { path: movie, url: pathToFileURL(movie).href, name: path.basename(movie), kind: 'video' };
  ipcMain.handle('store:get', () => ({ settings: { onboarded: true, history: false, keepQueue: false }, sub: { defaultLang: 'fa' } }));
  ipcMain.handle('store:set', () => true);
  ipcMain.handle('fs:findSubs', () => []);
  ipcMain.handle('fs:listSubs', () => []);
  ipcMain.handle('fs:readText', (_e, file) => fs.readFileSync(file, 'utf8'));
  ipcMain.handle('media:subtitleTracks', (_e, file) => listEmbeddedSubtitles(file));
  ipcMain.handle('media:subtitleText', (_e, file, index) => extractEmbeddedSubtitle(file, index));
  app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');
  app.commandLine.appendSwitch('force-device-scale-factor', '1');
  app.on('before-quit', stopSubtitleTools);
  app.whenReady().then(async () => {
    const win = new BrowserWindow({ show: false, width: 1280, height: 780, webPreferences: { preload: path.join(root, 'preload.js'), offscreen: true, backgroundThrottling: false, contextIsolation: true, webSecurity: false, partition: `video-test-${Date.now()}` } });
    const run = code => win.webContents.executeJavaScript(code);
    const waitFor = async (code, label, timeout = 10000) => {
      const start = Date.now();
      while (Date.now() - start < timeout) {
        if (await run(code)) return;
        await new Promise(resolve => setTimeout(resolve, 25));
      }
      throw new Error('Timed out: ' + label);
    };
    const failTimer = setTimeout(() => { console.error('Video regression test timed out'); app.exit(1); }, 60000);
    try {
      const tracks = await listEmbeddedSubtitles(movie);
      assert.equal(tracks.length, 2);
      assert.deepEqual(tracks.map(track => track.language), ['eng', 'fas']);
      assert.ok(tracks.every(track => track.supported));
      assert.match(await extractEmbeddedSubtitle(movie, tracks[1].index), /زیرنویس فارسی داخلی/);
      await assert.rejects(extractEmbeddedSubtitle(movie, -1), /Invalid subtitle/);
      await assert.rejects(extractEmbeddedSubtitle(movie, 0), /unsupported/);
      await win.loadFile(path.join(root, 'src/index.html'));
      await waitFor('window.__ready', 'initialization');
      await run(`playItems([${JSON.stringify(item)}], 0)`);
      await waitFor(`S.subTracks.length === 2 && $('#subs').textContent.includes('زیرنویس فارسی داخلی')`, 'embedded Persian subtitles and language preference');
      assert.equal(await run('tv == null'), true, 'preview decoder is not started with playback');
      await run(`showThumb(.1, $('#seek').getBoundingClientRect().left + 100)`);
      await waitFor('tv != null && tv.readyState >= 2 && !tv.seeking', 'lazy preview on hover');
      const originalFrames = await run('V().getVideoPlaybackQuality().totalVideoFrames');
      const started = Date.now();
      await run(`seekBy(5)`);
      await waitFor('!V().seeking && pendingSeek == null && V().currentTime > 5', 'five-second seek');
      await waitFor(`V().getVideoPlaybackQuality().totalVideoFrames > ${originalFrames}`, 'frames resume after seek');
      const seekMs = Date.now() - started;
      assert.equal(await run('tv == null'), true, 'main seek releases preview decoder');
      assert.equal(await run('V().paused'), false, 'seek preserves playing state');
      const target = await run(`(() => { const before = V().currentTime; seekBy(5); seekBy(5); seekBy(5); return before + 15; })()`);
      await waitFor(`!V().seeking && pendingSeek == null && Math.abs(V().currentTime - ${target}) < 1`, 'accumulated repeated seeks');
      await run(`V().pause(); seekTo(2)`);
      await waitFor('!V().seeking && Math.abs(V().currentTime - 2) < .1', 'paused exact seek');
      assert.equal(await run('V().paused'), true);
      const assText = fs.readFileSync(ass, 'utf8');
      assert.match(await run(`JSON.stringify(parseSubs(${JSON.stringify(assText)}, '.ass'))`), /زیرنویس فارسی داخلی/, 'ASS Events format is used instead of Styles format');
      await run(`selectSub(0)`);
      await waitFor(`$('#subs').textContent.includes('Embedded English')`, 'manual track switch');
      await new Promise(resolve => setTimeout(resolve, 100));
      fs.writeFileSync(path.join(dir, 'video-subtitles.png'), (await win.webContents.capturePage()).toPNG());
      await run(`selectSub(-1)`);
      assert.equal(await run(`$('#subs').textContent`), '', 'subtitle off');
      await run(`S.subTracks[1].cues = null; S.subTracks[1].pending = null; window.pendingText = selectSub(1); selectSub(-1)`);
      await run('window.pendingText');
      assert.equal(await run(`S.subIdx === -1 && $('#subs').textContent === ''`), true, 'late extraction cannot re-enable subtitles');
      await run(`addSubtitlesDialog()`);
      await waitFor(`$('.modal-b').textContent.includes('Subtitles in this video')`, 'embedded tracks in add-subtitle dialog');
      assert.equal(await run(`$('.modal-b').textContent.includes('Find on SubDL')`), true, 'SubDL button');
      // A result for the previous file must not attach tracks to the next file.
      await run(`$('#modalLayer').replaceChildren(); $('#modalLayer').style.pointerEvents = 'none'; window.oldItem = S.cur; S.subTracks = []; window.staleScan = loadEmbeddedSubtitles(oldItem); S.cur = {kind:'audio',path:'new.wav',url:'new.wav'};`);
      await run('window.staleScan');
      assert.equal(await run('S.subTracks.length'), 0, 'stale track scan is ignored');
      clearTimeout(failTimer);
      console.log('PASS: MKV embedded SRT/ASS, Persian selection, exact/repeated seeks, resumed frames, paused seek, SubDL and stale results.');
      console.log('Five-second seek and resumed frames: ' + seekMs + ' ms (generated 320×180 long-GOP MKV).');
      console.log('Screenshot: ' + path.join(dir, 'video-subtitles.png'));
      app.exit(0);
    } catch (error) { clearTimeout(failTimer); console.error(error); app.exit(1); }
  });
}
