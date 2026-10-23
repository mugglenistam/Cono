// Run with: node test/ui-regressions.js
// Uses the installed Electron renderer, with an isolated session and no desktop API.
if (process.versions.electron && process.type === 'browser') {
  const { app, BrowserWindow } = require('electron');
  const assert = require('node:assert/strict');
  const path = require('node:path');
  const fs = require('node:fs');
  const os = require('node:os');
  const appRoot = process.env.CONO_APP_ROOT || path.join(__dirname, '..');
  app.commandLine.appendSwitch('force-device-scale-factor', '1');
  app.whenReady().then(async () => {
    const win = new BrowserWindow({ show: false, width: 1280, height: 780,
      webPreferences: { partition: `ui-test-${Date.now()}`, backgroundThrottling: false, offscreen: true } });
    const run = code => win.webContents.executeJavaScript(code);
    const paint = async () => {
      await run(`new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))`);
      // Allow the hidden window's compositor to submit the updated frame.
      await new Promise(resolve => setTimeout(resolve, 150));
    };
    try {
      await win.loadFile(path.join(appRoot, 'src/index.html'));
      for (let i = 0; i < 100 && !await run('window.__ready === true'); i++) {
        await new Promise(resolve => setTimeout(resolve, 20));
      }
      assert.equal(await run('window.__ready'), true, 'renderer initialized');
      await run(`$('#modalLayer').replaceChildren(); $('#modalLayer').style.pointerEvents = 'none'`);
      const check = async (code, label) => {
        const actual = await run(code);
        if (!actual) console.error(await run(`JSON.stringify({ view: S.view, open: S.libOpen, collapsed: S.libNavCollapsed, nav: $$('.lib-nav').map(e => e.getBoundingClientRect().width), library: $('#library').className, panel: $('#libPanel').className, app:$('#app').className, main:$('#main').getBoundingClientRect().toJSON(), title:$('#titlebar').getBoundingClientRect().toJSON(), bar:$('.lib-bar')?.getBoundingClientRect().toJSON() })`));
        assert.equal(actual, true, label);
      };
      await check(`$('#btnBack').disabled && $('#btnForward').disabled`, 'initial history limits');
      await run(`$('#btnLib').click()`);
      await check(`!$('#library').classList.contains('hidden') && $('#libPanel').classList.contains('hidden') && $$('.lib-nav').filter(e => e.getBoundingClientRect().width > 0).length === 1 && Math.abs($('.lib-nav').getBoundingClientRect().width - 54) < .1`, 'collapse in place without a second library');
      await run(`$('#library .nav-i[title="Videos"]').click()`);
      await check(`L.section === 'videos' && $('#library > .lib').classList.contains('nav-collapsed')`, 'collapsed navigation survives rendering');
      await run(`$('#library .nav-i[title="Music"]').click(); $('#btnBack').click()`);
      await check(`L.section === 'videos' && !$('#btnForward').disabled`, 'app bar back');
      await run(`$('#btnForward').click()`);
      await check(`L.section === 'music' && $('#btnForward').disabled`, 'app bar forward');
      await run(`$('#btnBack').click(); $('#library .nav-i[title="Recent"]').click()`);
      await check(`L.section === 'recent' && $('#btnForward').disabled`, 'new navigation clears forward history');
      await run(`libGo('recent')`);
      await check(`L.hist.filter(s => s.section === 'recent').length === 1`, 'same menu does not duplicate history');
      await run(`$('#btnLib').click()`);
      await check(`Math.abs($('.lib-nav').getBoundingClientRect().width - 216) < .1`, 'expand original navigation');
      await run(`showLibrary(false, 'full'); $('#btnLib').click()`);
      await check(`S.libOpen && $('#library').classList.contains('hidden') && !$('#libPanel').classList.contains('hidden')`, 'playback compact library');
      await run(`$('#btnFolder').click()`);
      await check(`!S.libOpen && $('#libPanel').classList.contains('hidden') && !$('#library').classList.contains('hidden')`, 'full library closes compact copy');
      await run(`showLibrary(false, 'full'); $('#btnBack').click()`);
      await check(`S.view === 'library' && L.section === 'recent'`, 'app bar returns to current list before changing folders');
      await run(`$('#btnBack').click()`);
      await check(`L.section === 'videos'`, 'back changes folders after returning to list');
      await run(`S.store.recents = Array.from({length:80}, (_,i) => ({path:'test'+i+'.mp3',url:'file:///missing'+i+'.mp3',name:'Song '+i+'.mp3',kind:'audio'})); libGo('recent'); L.q = 'Song'; cfg().libView='list'; renderLib()`);
      await paint();
      await run(`$('#library .lib-scroll').scrollTop=480; window.returnScroll=$('#library .lib-scroll').scrollTop; window.returnHistory=L.hi; playItems([S.store.recents[0]])`);
      await check(`S.view === 'player' && !$('#btnReturnList').classList.contains('hidden')`, 'explicit return button appears in player');
      await run(`$('#btnReturnList').click()`); await paint();
      await check(`S.view === 'library' && L.q === 'Song' && L.hi === returnHistory && Math.abs($('#library .lib-scroll').scrollTop-returnScroll)<2`, 'return button preserves search, history and scroll');
      await run(`libGo('music','C:\\Music\\Album'); L.q='track'; showLibrary(false,'full'); S.cur={kind:'video'}; $('#btnBack').click()`);
      await check(`S.view === 'library' && L.path === 'C:\\Music\\Album' && L.q === 'track'`, 'video back preserves same nested folder');
      await run(`L.q=''; libGo('home'); cfg().libView='grid'; S.cur=null; showLibrary(false,'full')`);
      const colors = [];
      for (const value of [0, .1, .5, 1]) {
        await run(`setVolume(${value}, true)`);
        colors.push(await run(`getComputedStyle($('#cone .fill')).backgroundColor`));
        await check(`Number($('#cone').getAttribute('aria-valuenow')) === ${value * 100} && Math.abs($('#cone .fill').getBoundingClientRect().width - $('#cone').getBoundingClientRect().width * ${value}) < .1`, `volume fill at ${value}`);
        await check(`Math.abs(V().volume - ${value ** 3}) < .00001`, `perceptual amplitude at ${value}`);
      }
      assert.equal(new Set(colors).size, 4, 'color changes with volume');
      const rgb = color => color.match(/\d+/g).map(Number);
      assert.ok(rgb(colors[1])[1] > rgb(colors[1])[0], 'low volume is green');
      assert.ok(rgb(colors[3])[0] > rgb(colors[3])[1], 'maximum volume is red');
      await run(`setVolume(.25, true)`);
      await paint();
      const rect = await run(`(() => { const r = $('#cone').getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), width: 64, height: 22 }; })()`);
      const pixels = (await win.webContents.capturePage(rect)).resize({ width: 64, height: 22 }).toBitmap();
      const pixel = (x, y) => [...pixels.subarray((y * 64 + x) * 4, (y * 64 + x) * 4 + 3)];
      const outside = pixel(8, 3), inside = pixel(8, 19);
      assert.ok(Math.max(...outside) - Math.min(...outside) < 3, 'low-volume fill stays inside cone silhouette');
      assert.ok(inside[1] > inside[2] + 20, 'low-volume fill is visible inside cone');
      win.webContents.debugger.attach('1.3');
      const mouse = (type, x, buttons) => win.webContents.debugger.sendCommand('Input.dispatchMouseEvent', { type, x, y: rect.y + 15, button: 'left', buttons, clickCount: 1 });
      await mouse('mousePressed', rect.x + 32, 1);
      await mouse('mouseMoved', rect.x - 20, 1);
      await mouse('mouseReleased', rect.x - 20, 0);
      await check(`V().volume === 0`, 'drag beyond left edge clamps to zero');
      await run(`setVolume(.5, true); toggleMute()`);
      await check(`V().muted && $('#cone .fill').style.width === '0%'`, 'mute clears fill');
      await run(`setVolume(.5, true); $('#cone').dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }))`);
      await check(`!V().muted && V().volume === 1`, 'keyboard volume and unmute');
      await run(`setVolume(.5,true); ACTIONS.volup()`);
      await check(`Math.abs(volumeLevel()-.55)<.00001 && Math.abs(V().volume-.166375)<.00001`, 'hotkey increments slider position, not engine amplitude');
      await run(`$('#cone').dispatchEvent(new WheelEvent('wheel',{deltaY:100,cancelable:true}))`);
      await check(`Math.abs(volumeLevel()-.5)<.00001`, 'wheel shares logical volume scale');
      await run(`toggleMute(); toggleMute(); renderControls()`);
      await check(`Math.abs(V().volume-.125)<.00001 && $('#cone').getAttribute('aria-valuenow')==='50'`, 'mute and control rebuild retain perceived level');
      for (const width of [760, 1280]) {
        win.setSize(width, 780);
        await check(`$('#btnForward').getBoundingClientRect().right <= $('#btnFolder').getBoundingClientRect().left && $('#cone').getBoundingClientRect().right <= innerWidth`, `controls fit at width ${width}`);
      }
      const out = path.join(os.tmpdir(), 'vlc-redesign-ui-tests');
      fs.mkdirSync(out, { recursive: true });
      await run(`$('#osd').classList.remove('show')`);
      await paint();
      fs.writeFileSync(path.join(out, 'expanded.png'), (await win.webContents.capturePage()).toPNG());
      await run(`$('#btnLib').click(); setVolume(.15, true)`);
      await paint();
      fs.writeFileSync(path.join(out, 'collapsed.png'), (await win.webContents.capturePage()).toPNG());
      await run(`S.cur = {kind:'video'}; showLibrary(true, 'full'); setFullscreenState(true)`);
      for (const width of [760, 1280, 1920]) {
        win.setSize(width, 780);
        await run(`onMouseMove({clientY:1})`);
        await check(`$('#main').getBoundingClientRect().top >= $('#titlebar').getBoundingClientRect().bottom && $('#library .lib-bar').getBoundingClientRect().top >= 40`, `fullscreen workspace clears header at ${width}`);
        await check(`(() => { const e = $('#library .nav-i'), r = e.getBoundingClientRect(); return document.elementFromPoint(r.x+r.width/2,r.y+r.height/2).closest('.nav-i') === e; })()`, `fullscreen navigation remains clickable at ${width}`);
        await run(`onMouseMove({clientY:300})`);
        await check(`!$('#app').classList.contains('bars-off')`, 'workspace controls stay available');
      }
      await paint();
      fs.writeFileSync(path.join(out, 'fullscreen-library.png'), (await win.webContents.capturePage()).toPNG());
      await run(`showLibrary(false, 'full'); onMouseMove({clientY:300})`);
      await check(`$('#main').getBoundingClientRect().top === 0 && $('#app').classList.contains('bars-off')`, 'video keeps immersive fullscreen');
      await run(`openPanel('side', 'video'); onMouseMove({clientY:1})`);
      await check(`$('#rightPanel').getBoundingClientRect().top >= 40`, 'fullscreen settings panel clears titlebar');
      await run(`closePanel(); setFullscreenState(false)`);
      console.log('PASS: sidebar, app bar history, volume color/clipping, dragging, mute, keyboard and window sizes.');
      console.log('Screenshots: ' + out);
      app.exit(0);
    } catch (error) { console.error(error); app.exit(1); }
  });
} else {
  const { spawnSync } = require('node:child_process');
  const env = { ...process.env };
  delete env.ELECTRON_RUN_AS_NODE;
  const result = spawnSync(require('electron'), [__filename], { env, stdio: 'inherit', windowsHide: true });
  process.exit(result.status ?? 1);
}

