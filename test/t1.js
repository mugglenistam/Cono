const { launch } = require('./harness'); const path = require('path');
const OUT = '/tmp/claude-0/-home-claude/591616d2-9b5c-5833-bfcc-01fbacb19e8e/scratchpad/shots/';
require('fs').mkdirSync(OUT, { recursive: true });
const M = '/tmp/claude-0/-home-claude/591616d2-9b5c-5833-bfcc-01fbacb19e8e/scratchpad/media';
(async () => {
  const t = await launch({ store: { settings: { onboarded: true } } }); const { page, logs } = t;
  await page.screenshot({ path: OUT + '01_home_empty.png' });
  t.setPick([], M + '/Shows'); await page.evaluate(() => addLibFolder('video'));
  await page.waitForTimeout(500);
  await page.evaluate(() => libGo('videos', null)); await page.waitForTimeout(300);
  await page.screenshot({ path: OUT + '02_videos_root.png' });
  await page.evaluate(([p]) => libGo('videos', p), [M + '/Shows/TheWand/S01']); await page.waitForTimeout(2500);
  await page.screenshot({ path: OUT + '03_folder_grid.png' });
  console.log(logs.join('\n'));
  await t.browser.close();
})().catch(e => { console.error(e); process.exit(1); });
