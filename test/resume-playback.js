// Real decoder regression: per-file positions and video-only resume choices.
if (!process.versions.electron || process.type !== 'browser') {
  const env = { ...process.env }; delete env.ELECTRON_RUN_AS_NODE;
  process.exit(require('node:child_process').spawnSync(require('electron'), [__filename], { env, stdio: 'inherit', windowsHide: true }).status ?? 1);
} else {
  const { app, BrowserWindow, ipcMain } = require('electron');
  const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
  const { pathToFileURL } = require('node:url');
  const root = process.env.CONO_APP_ROOT || path.join(__dirname, '..');
  const dir = fs.mkdtempSync(path.join(require('node:os').tmpdir(), 'cono-resume-'));
  const a = path.join(dir,'First.mkv'), b = path.join(dir,'Second.mkv');
  const audioA = path.join(dir,'First.wav'), audioB = path.join(dir,'Second.wav');
  const ffmpeg = require('ffmpeg-static'), exec = require('node:child_process').execFileSync;
  exec(ffmpeg, ['-v','error','-f','lavfi','-i','testsrc2=duration=130:size=64x64:rate=5','-c:v','libx264','-preset','ultrafast','-g','5',a], { windowsHide:true, timeout:30000 });
  exec(ffmpeg, ['-v','error','-f','lavfi','-i','sine=frequency=440:duration=130:sample_rate=8000','-c:a','pcm_s16le',audioA], { windowsHide:true, timeout:30000 });
  fs.copyFileSync(a,b); fs.copyFileSync(audioA,audioB);
  const item = file => ({path:file,url:pathToFileURL(file).href,name:path.basename(file),kind:file.endsWith('.wav')?'audio':'video'});
  const items = [a,b,audioA,audioB].map(item);
  let persisted = { settings:{ onboarded:true, history:false, keepQueue:false, autoSubs:false, autoNext:false } };
  ipcMain.handle('store:get', () => persisted);
  ipcMain.handle('store:set', () => true); ipcMain.handle('open:ready', () => []);
  ipcMain.handle('fs:findSubs', () => []); ipcMain.handle('media:subtitleTracks', () => []);
  ipcMain.handle('media:cover', () => null); ipcMain.handle('media:audioInfo', () => null);
  app.commandLine.appendSwitch('autoplay-policy','no-user-gesture-required');
  app.whenReady().then(async () => {
    const win = new BrowserWindow({show:false,width:1280,height:780,webPreferences:{preload:path.join(root,'preload.js'),contextIsolation:true,offscreen:true,backgroundThrottling:false,webSecurity:false,partition:`resume-${Date.now()}`}});
    const run = code => win.webContents.executeJavaScript(code);
    const wait = async (code,label) => { const until=Date.now()+12000; while(Date.now()<until) { if(await run(code)) return; await new Promise(r=>setTimeout(r,25)); } throw new Error('Timed out: '+label); };
    const check = async (code,label) => assert.equal(await run(code),true,label);
    const play = async index => { await run(`playItems([${JSON.stringify(items[index])}])`); await wait(`loadedMedia?.ready && V().readyState >= 2`,'loaded '+index); };
    const position = async time => { await run(`V().pause(); seekTo(${time})`); await wait(`!V().seeking && Math.abs(V().currentTime-${time})<.1`,'seek '+time); };
    try {
      await win.loadFile(path.join(root,'src/index.html')); await wait('window.__ready','init');
      await play(0); await position(61);
      await play(1);
      await check(`V().currentTime < 1 && !resumePrompt`, 'new video starts at zero without a prompt');
      await check(`Math.abs(S.store.resume[${JSON.stringify(a)}].t-61)<.1 && !S.store.resume[${JSON.stringify(b)}]`, 'outgoing time belongs only to outgoing video');
      await position(37); await play(0);
      await wait('!!resumePrompt','resume prompt');
      await check(`V().paused && V().currentTime===0 && Math.abs(S.store.resume[${JSON.stringify(b)}].t-37)<.1`, 'unfinished video waits for choice and saves second video independently');
      await run(`saveResume(); togglePlay(); seekTo(90)`);
      await check(`V().paused && V().currentTime===0 && Math.abs(S.store.resume[${JSON.stringify(a)}].t-61)<.1`, 'pending prompt protects bookmark and blocks playback shortcuts');
      fs.writeFileSync(path.join(dir,'resume-choice.png'),(await win.webContents.capturePage()).toPNG());
      await run(`resumePrompt.el.querySelector('.primary').click()`);
      await wait(`!V().paused && V().currentTime>=61`,'continue at own bookmark');
      await play(1); await wait('!!resumePrompt','second video prompt');
      await run(`resumePrompt.el.querySelector('.modal-f .ghost').click()`);
      await wait('!V().paused && V().currentTime<1','start from beginning');
      await check(`!S.store.resume[${JSON.stringify(b)}]`, 'start-over clears old bookmark');
      await run(`S.store.resume[${JSON.stringify(audioA)}]={t:61,d:130}; S.store.resume[${JSON.stringify(audioB)}]={t:37,d:130}`);
      await play(2); await check('V().currentTime<1 && !resumePrompt','music ignores legacy bookmarks');
      await position(61); await play(3);
      await check(`V().currentTime<1 && !resumePrompt && !S.store.resume[${JSON.stringify(audioA)}] && !S.store.resume[${JSON.stringify(audioB)}]`, 'switching music resets time and discards audio resume positions');
      await play(0); await wait('!!resumePrompt','prompt before quick switch');
      await run(`window.staleResumeButton=resumePrompt.el.querySelector('.primary')`);
      await play(2); await run(`staleResumeButton.click()`);
      await check('!resumePrompt && V().currentTime<1 && S.cur.kind===\'audio\'', 'stale dialog cannot seek a newly selected file');
      await check(`S.store.resume[${JSON.stringify(a)}].t>=61`, 'leaving an unanswered prompt preserves video bookmark');
      await run(`cfg().resume=false`); await play(0);
      await check('!resumePrompt && V().currentTime<1','resume setting off starts video from zero');
      await position(129.8); await run('saveResume()');
      await check(`!S.store.resume[${JSON.stringify(a)}]`,'completed video has no resume prompt');
      await play(0);
      await check('!resumePrompt && V().currentTime<1','completed video reopens at zero');
      await position(61); await run(`cfg().resume=true; saveResume()`);
      persisted = await run('JSON.parse(JSON.stringify(S.store))');
      await win.loadFile(path.join(root,'src/index.html')); await wait('window.__ready','reinitialization');
      await play(0); await wait('!!resumePrompt','persisted video bookmark after reload');
      await check(`V().paused && resumePrompt.body.textContent.includes('00:01:01')`, 'restored store prompts at saved video position');
      await run(`resumePrompt.el.querySelector('.modal-h button').click()`);
      await wait('!V().paused && V().currentTime<1','dismiss prompt starts from beginning');
      console.log('PASS: independent video positions, zero start, video-only choice, continue/start over, music, stale prompts, persisted positions, resume setting and completed videos.');
      console.log('Screenshot: '+path.join(dir,'resume-choice.png'));
      app.exit(0);
    } catch(error) { console.error(error); console.error(await run(`JSON.stringify({cur:S.cur,time:V().currentTime,paused:V().paused,ready:V().readyState,resume:S.store.resume,prompt:!!resumePrompt,seeking:V().seeking,pendingSeek,seekFrame,active:loadedMedia,duration:V().duration})`)); app.exit(1); }
  });
}
