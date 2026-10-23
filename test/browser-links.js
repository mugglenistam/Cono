// Real main/preload/renderer integration, isolated data, no Windows registry changes.
if (!process.versions.electron || process.type !== 'browser') {
  const env = { ...process.env }; delete env.ELECTRON_RUN_AS_NODE;
  process.exit(require('node:child_process').spawnSync(require('electron'), [__filename], { env, stdio: 'inherit', windowsHide: true }).status ?? 1);
} else {
  const { app, BrowserWindow } = require('electron');
  const fs = require('node:fs'), path = require('node:path'), http = require('node:http'), assert = require('node:assert/strict');
  const root = process.env.CONO_APP_ROOT || path.join(__dirname, '..');
  const { mediaLink, launchInputs } = require(path.join(root, 'src/launch-input.cjs'));
  const folder = fs.mkdtempSync(path.join(require('node:os').tmpdir(), 'cono-links-'));
  app.setPath('userData', folder); app.setPath('appData', folder);
  fs.writeFileSync(path.join(folder, 'store.json'), JSON.stringify({ settings: { onboarded: true, history: false, keepQueue: false, volume: .4 } }));
  app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');
  const movie = path.join(folder, 'online.mkv');
  require('node:child_process').execFileSync(require('ffmpeg-static'), ['-v','error','-f','lavfi','-i','testsrc2=duration=8:size=320x180:rate=24','-c:v','libx264','-preset','ultrafast','-pix_fmt','yuv420p','-g','24',movie], { windowsHide: true, timeout: 20000 });
  const binary = fs.readFileSync(movie);
  let origin;
  const server = http.createServer((req,res) => {
    if (req.url === '/website') { res.writeHead(200, {'Content-Type':'text/html'}); return res.end(`<button id="play" onclick="const w=window.open('about:blank');w.location='vlc://${origin}/online.mkv?from=website'">Play online</button>`); }
    const match = req.headers.range?.match(/bytes=(\d+)-(\d*)/), start = match ? +match[1] : 0, end = Math.min(match?.[2] ? +match[2] : binary.length-1,binary.length-1);
    res.writeHead(match ? 206 : 200, { 'Content-Type':'video/x-matroska', 'Content-Length':end-start+1, 'Accept-Ranges':'bytes', ...(match ? {'Content-Range':`bytes ${start}-${end}/${binary.length}`} : {}) }); res.end(binary.subarray(start,end+1));
  });
  const wait = async (fn,label) => { const until=Date.now()+15000; while(Date.now()<until) { if(await fn()) return; await new Promise(r=>setTimeout(r,40)); } throw new Error('Timed out: '+label); };
  (async () => {
    try {
      await new Promise(r=>server.listen(0,'127.0.0.1',r)); origin=`http://127.0.0.1:${server.address().port}`;
      const url=origin+'/online.mkv?token=a%2Bb&f=movie.mkv';
      for(const input of [url, 'vlc://'+url, 'cono://'+url, 'vlc://'+url.replace('http:','http'), 'vlc://'+encodeURIComponent(url), 'cono://open?url='+encodeURIComponent(url)]) assert.equal(mediaLink(input),url);
      for(const input of ['vlc://javascript:alert(1)','cono://open?url=file:///C:/secret','vlc://%','--inspect=123','https://example.com\n--flag']) assert.equal(mediaLink(input),null);
      assert.deepEqual(launchInputs(['--inspect=123','vlc://'+url,movie]),[url,movie]);
      process.argv=[process.execPath,path.join(root,'main.js'),'vlc://'+url];
      app.on('browser-window-created',(_event,window)=>{ window.hide(); window.webContents.setBackgroundThrottling(false); });
      if (process.env.CONO_DEBUG_LINKS) app.on('web-contents-created',(_event,wc)=> {
        for (const name of ['will-navigate','did-start-navigation','will-frame-navigate','did-fail-load','console-message']) wc.on(name,(_e,...args)=>console.log(name,JSON.stringify(args)));
      });
      require(path.join(root,'main.js'));
      await wait(()=>BrowserWindow.getAllWindows().length,'main window');
      const win=BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().includes('index.html')) || BrowserWindow.getAllWindows()[0];
      const run=code=>win.webContents.executeJavaScript(code);
      await wait(async()=>!win.webContents.isLoading() && await run(`window.__ready && S.cur?.path===${JSON.stringify(url)} && V().videoWidth===320 && V().currentTime>.2`),'cold browser launch produces MKV frames');
      assert.ok(Math.abs(await run('V().volume')-.064)<.00001,'saved volume uses taper on startup');
      app.emit('second-instance',{},[process.execPath,path.join(root,'main.js'),'cono://open?url='+encodeURIComponent(origin+'/online.mkv?from=second')]);
      await wait(()=>run(`S.cur?.path.endsWith('from=second') && V().currentTime>.2`),'existing app receives browser URL');
      const playlist=path.join(folder,'website.m3u'); fs.writeFileSync(playlist,'#EXTM3U\n#EXTINF:-1,Playlist movie\n'+origin+'/online.mkv?from=playlist\n');
      app.emit('second-instance',{},[process.execPath,path.join(root,'main.js'),playlist]);
      await wait(()=>run(`S.cur?.name==='Playlist movie' && V().currentTime>.2`),'downloaded playlist opens');
      await run(`api.openStreamWebsite(${JSON.stringify(origin+'/website')})`);
      await wait(()=>BrowserWindow.getAllWindows().some(w=>w.webContents.getURL()===origin+'/website'),'website popup');
      const site=BrowserWindow.getAllWindows().find(w=>w.webContents.getURL()===origin+'/website');
      await wait(()=>!site.webContents.isLoading(),'website loaded');
      await site.webContents.executeJavaScript(`document.querySelector('#play').click()`);
      await wait(()=>run(`S.cur?.path.endsWith('from=website') && V().currentTime>.2`),'about:blank popup hands VLC URL to Cono');
      console.log('PASS: URL validation, cold launch, saved volume, second instance, M3U file and website blank-popup handoff with real MKV frames.');
      server.close(); app.exit(0);
    } catch(error) {
      console.error(error);
      for (const window of BrowserWindow.getAllWindows()) {
        console.error('Window',window.webContents.getURL());
        try { console.error(await window.webContents.executeJavaScript(`JSON.stringify({ready:window.__ready,cur:typeof S!=='undefined'?S.cur:null,error:document.querySelector('video')?.error?.message,time:document.querySelector('video')?.currentTime,text:document.body.innerText.slice(-500)})`)); } catch {}
      }
      server.close(); app.exit(1);
    }
  })();
}
