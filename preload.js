const { contextBridge, ipcRenderer, webUtils } = require('electron');
const inv = (c, ...a) => ipcRenderer.invoke(c, ...a);
contextBridge.exposeInMainWorld('api', {
  minimize: () => inv('win:minimize'), maximize: () => inv('win:maximize'), close: () => inv('win:close'),
  fullscreen: on => inv('win:fullscreen', on), onTop: on => inv('win:ontop', on),
  getStore: () => inv('store:get'), setStore: o => inv('store:set', o),
  pickFiles: kind => inv('dialog:files', kind), pickFolder: () => inv('dialog:folder'),
  scan: d => inv('fs:scan', d), describe: p => inv('fs:describe', p),
  audioCover: p => inv('media:cover', p),
  audioInfo: p => inv('media:audioInfo', p),
  resolveMedia: url => inv('net:resolveMedia', url), openStreamWebsite: url => inv('net:openWebsite', url),
  subtitleTracks: p => inv('media:subtitleTracks', p), subtitleText: (p, index) => inv('media:subtitleText', p, index),
  readText: p => inv('fs:readText', p), findSubs: p => inv('fs:findSubs', p), listSubs: d => inv('fs:listSubs', d),
  fetchText: u => inv('net:fetchText', u), showInFolder: p => inv('shell:show', p),
  pathForFile: f => webUtils.getPathForFile(f),
  onState: cb => ipcRenderer.on('win:state', (_e, s) => cb(s)),
  onOpen: cb => ipcRenderer.on('open:paths', (_e, p) => cb(p)),
  readyForOpen: () => inv('open:ready'), registerBrowserLinks: () => inv('app:browserLinks'),
});
