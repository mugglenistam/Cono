const { launch } = require('./harness');
const OUT = '/tmp/claude-0/-home-claude/591616d2-9b5c-5833-bfcc-01fbacb19e8e/scratchpad/shots/';
const M = '/tmp/claude-0/-home-claude/591616d2-9b5c-5833-bfcc-01fbacb19e8e/scratchpad/media';
(async () => {
  const t = await launch({ store: { settings: { onboarded: true }, library: { folders: [{ path: M + '/Shows', name: 'Shows', kind: 'video' }, { path: M + '/Songs', name: 'Songs', kind: 'music' }] } } }); const { page, logs } = t;
  await page.evaluate(p => libGo('videos', p), M + '/Shows/TheWand/S01'); await page.waitForTimeout(1500);
  await page.click('.card >> nth=0'); await page.waitForTimeout(2500);
  const st = await page.evaluate(() => ({ paused: V().paused, t: V().currentTime, dur: V().duration, src: V().src.slice(-30), subs: S.subTracks.map(x => x.name), idx: S.idx, q: S.queue.length, view: S.view, err: V().error && V().error.message }));
  console.log('state', JSON.stringify(st));
  await page.evaluate(() => { V().currentTime = 7; }); await page.waitForTimeout(700);
  await page.screenshot({ path: OUT + '04_playing.png' });
  await page.click('#btnLib'); await page.waitForTimeout(1500); await page.screenshot({ path: OUT + '05_compact_lib.png' });
  await page.click('#btnLib');
  await page.click('#ctlRight .ctl[data-id=settings]'); await page.waitForTimeout(400); await page.screenshot({ path: OUT + '06_side_subs.png' });
  for (const [tab, n] of [['audio', '07'], ['video', '08'], ['play', '09']]) { await page.evaluate(x => { S.panelTab = x; renderPanel(); }, tab); await page.waitForTimeout(200); await page.screenshot({ path: OUT + `${n}_side_${tab}.png` }); }
  await page.click('#ctlRight .ctl[data-id=queue]'); await page.waitForTimeout(300); await page.screenshot({ path: OUT + '10_queue.png' });
  await page.hover('#seek', { position: { x: 300, y: 10 } }); await page.waitForTimeout(900); await page.screenshot({ path: OUT + '11_seek_hover.png' });
  await page.mouse.move(600, 300); await page.keyboard.press('Control+b'); await page.waitForTimeout(300);
  await page.evaluate(() => { cfg().subTimeline = true; applyStrip(); }); await page.waitForTimeout(300);
  await page.screenshot({ path: OUT + '12_bookmark_timeline.png' });
  await page.click('#btnMenu'); await page.waitForTimeout(200); await page.screenshot({ path: OUT + '13_menu.png' });
  await page.keyboard.press('Escape'); await page.mouse.click(10, 10);
  await page.evaluate(() => settingsDialog()); await page.waitForTimeout(300); await page.screenshot({ path: OUT + '14_settings.png' });
  console.log(logs.join('\n')); await t.browser.close();
})().catch(e => { console.error(e); process.exit(1); });
