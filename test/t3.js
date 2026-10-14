const { launch } = require('./harness');
const OUT = '/tmp/claude-0/-home-claude/591616d2-9b5c-5833-bfcc-01fbacb19e8e/scratchpad/shots/';
const M = '/tmp/claude-0/-home-claude/591616d2-9b5c-5833-bfcc-01fbacb19e8e/scratchpad/media';
(async () => {
  const t = await launch({ store: { settings: { onboarded: false }, library: { folders: [{ path: M + '/Shows', name: 'Shows', kind: 'video' }, { path: M + '/Songs', name: 'Songs', kind: 'music' }] } } }); const { page, logs } = t;
  await page.waitForTimeout(400); await page.screenshot({ path: OUT + '20_onboarding.png' });
  await page.evaluate(() => { ($('#modalLayer').innerHTML = '', $('#modalLayer').style.pointerEvents = 'none'); cfg().onboarded = true; });
  // audio file
  await page.evaluate(p => playItems([itemFromPath(p)], 0), M + '/Songs/My_Song.ogg'); await page.waitForTimeout(1200);
  await page.screenshot({ path: OUT + '21_audio.png' });
  // video + fullscreen + hide bars
  await page.evaluate(p => playItems([itemFromPath(p + '/Shows/TheWand/S01/The_Wand_S01E02.webm'), itemFromPath(p + '/Shows/TheWand/S01/The_Wand_S01E03.webm')], 0), M); await page.waitForTimeout(1500);
  await page.evaluate(() => api.fullscreen(true)); await page.waitForTimeout(300);
  await page.mouse.move(600, 400); await page.waitForTimeout(500); await page.screenshot({ path: OUT + '22_fullscreen_clean.png' });
  await page.mouse.move(600, 765); await page.waitForTimeout(500); await page.screenshot({ path: OUT + '23_fullscreen_bottom.png' });
  await page.mouse.move(600, 10); await page.waitForTimeout(500); await page.screenshot({ path: OUT + '24_fullscreen_top.png' });
  await page.evaluate(() => api.fullscreen(false)); await page.waitForTimeout(300);
  // light theme
  await page.evaluate(() => { cfg().theme = 'light'; applyTheme(); }); await page.waitForTimeout(200); await page.screenshot({ path: OUT + '25_light.png' });
  await page.evaluate(() => { cfg().theme = 'dark'; cfg().accent = '#3e63dd'; applyTheme(); drawWave(); });
  await page.click('#stage', { button: 'right', position: { x: 300, y: 200 } }); await page.waitForTimeout(200); await page.hover('.mi:has-text("Subtitle")'); await page.waitForTimeout(200); await page.screenshot({ path: OUT + '26_context_blue.png' });
  await page.mouse.click(5, 5);
  await page.evaluate(() => { cfg().accent = '#f58a00'; applyTheme(); customizeDialog(); }); await page.waitForTimeout(300); await page.screenshot({ path: OUT + '27_customize.png' });
  await page.evaluate(() => { ($('#modalLayer').innerHTML = '', $('#modalLayer').style.pointerEvents = 'none'); hotkeysDialog(); }); await page.waitForTimeout(300); await page.screenshot({ path: OUT + '28_hotkeys.png' });
  // functional checks
  const r = await page.evaluate(async () => {
    ($('#modalLayer').innerHTML = '', $('#modalLayer').style.pointerEvents = 'none');
    const o = {};
    togglePlay(); o.afterToggle = V().paused; togglePlay();
    const before = V().currentTime; seekBy(5); o.seek = V().currentTime - before;
    setVolume(.5, true); o.vol = V().volume; setSpeed(1.5); o.speed = V().playbackRate; setSpeed(1);
    setSubDelay(1.5); o.delay = S.store.sub.delay;
    cfg().eq = 'bass'; applyAudioFx(); o.audioGraph = !!actx;
    S.store.video.aspect = '4:3'; applyVideoFx(); o.transform = V().style.transform;
    S.store.video.aspect = 'fit'; applyVideoFx();
    next(); o.afterNext = S.idx; return o;
  });
  console.log(JSON.stringify(r));
  console.log(logs.join('\n')); await t.browser.close();
})().catch(e => { console.error(e); process.exit(1); });
