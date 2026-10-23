/* Inspect a small prefix only. Never download an entire movie as text. */
const MAX_PREFIX = 128 * 1024;
const http = require('node:http');
const { randomUUID } = require('node:crypto');
const { Readable } = require('node:stream');
async function fetchWithSession(url, init, browserSession) {
  const { session } = require('electron');
  const jar = browserSession || session.defaultSession;
  const cookies = await jar.cookies.get({ url });
  const headers = new Headers(init.headers);
  if (cookies.length) headers.set('Cookie', cookies.map(cookie => `${cookie.name}=${cookie.value}`).join('; '));
  const response = await fetch(url, { ...init, headers });
  for (const line of response.headers.getSetCookie?.() || []) {
    const [pair, ...attributes] = line.split(';'), equals = pair.indexOf('=');
    if (equals < 1) continue;
    const cookie = { url, name: pair.slice(0, equals).trim(), value: pair.slice(equals + 1).trim(), path: new URL('.', url).pathname };
    for (const attribute of attributes) {
      const [name, ...parts] = attribute.trim().split('='), value = parts.join('=');
      switch (name.toLowerCase()) {
        case 'path': cookie.path = value; break;
        case 'domain': cookie.domain = value; break;
        case 'secure': cookie.secure = true; break;
        case 'httponly': cookie.httpOnly = true; break;
        case 'expires': { const expires = Date.parse(value); if (Number.isFinite(expires)) cookie.expirationDate = expires / 1000; break; }
        case 'max-age': if (/^-?\d+$/.test(value)) cookie.expirationDate = Date.now() / 1000 + Number(value); break;
        case 'samesite': cookie.sameSite = { none: 'no_restriction', lax: 'lax', strict: 'strict' }[value.toLowerCase()]; break;
      }
    }
    try { await jar.cookies.set(cookie); } catch {}
  }
  return response;
}
function httpUrl(value, base) {
  const url = new URL(value, base);
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Use an HTTP or HTTPS media link');
  return url.href;
}
function mediaFilename(url, disposition = '') {
  const encoded = disposition.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
  const plain = disposition.match(/filename\s*=\s*"([^"]+)"/i)?.[1] || disposition.match(/filename\s*=\s*([^;]+)/i)?.[1];
  const parsed = new URL(url);
  const name = encoded || plain || ['f', 'file', 'filename'].map(key => parsed.searchParams.get(key)).find(value => /\.(mkv|mp4|webm|mov|m4v|mp3|flac|wav|ogg|m4a|opus|aac)$/i.test(value || '')) || parsed.pathname.split('/').pop() || parsed.hostname;
  try { return decodeURIComponent(name).trim(); } catch { return name.trim(); }
}
async function resolveNetworkMedia(input, fetcher = fetch) {
  let url = httpUrl(input);
  for (let hop = 0; hop < 8; hop++) {
    const response = await fetcher(url, { redirect: 'manual', headers: { Range: `bytes=0-${MAX_PREFIX - 1}`, Accept: '*/*' }, signal: AbortSignal.timeout(20000), credentials: 'include' });
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get('location'); await response.body?.cancel();
      if (!location) throw new Error('The website returned an invalid redirect');
      url = httpUrl(location, url); continue;
    }
    if ([401, 403].includes(response.status)) { await response.body?.cancel(); return { type: 'page', url, accessRequired: true, message: 'This website requires access or sign-in. Open the website, sign in if needed, then try again or copy its direct media link.' }; }
    if (!response.ok) { await response.body?.cancel(); throw new Error(`The media server returned HTTP ${response.status}`); }
    const mime = (response.headers.get('content-type') || '').split(';')[0].toLowerCase();
    const filename = mediaFilename(url, response.headers.get('content-disposition') || '');
    const reader = response.body?.getReader();
    const chunks = []; let size = 0, textual = /text|html|mpegurl|json|xml/.test(mime);
    try {
      while (reader && size < MAX_PREFIX) {
        const { value, done } = await reader.read(); if (done) break;
        const take = value.subarray(0, MAX_PREFIX - size); chunks.push(Buffer.from(take)); size += take.length;
        if (!textual && size >= 512) {
          textual = /^#EXTM3U|^#EXTINF/.test(Buffer.concat(chunks).toString('utf8').trimStart());
          if (!textual) break;
        }
      }
    } finally { await reader?.cancel(); }
    const prefix = Buffer.concat(chunks).toString('utf8').replace(/^\uFEFF/, '').trimStart();
    if (/html|xhtml/.test(mime) || /^<!doctype\s+html|^<html\b/i.test(prefix)) {
      // Follow declared media elements, not arbitrary links or website scripts.
      const source = prefix.match(/<(?:video|audio|source)\b[^>]*\bsrc\s*=\s*["']([^"']+)["']/i)?.[1];
      if (source) { url = httpUrl(source.replaceAll('&amp;', '&'), url); continue; }
      return { type: 'page', url, accessRequired: /اشتراک|ورود|subscription|sign.?in|log.?in|purchase/i.test(prefix), message: 'This link returned a web page instead of a media file. Open the website to check access, then retry or paste a direct media link.' };
    }
    if (/^#EXTM3U|^#EXTINF/.test(prefix)) {
      if (size >= MAX_PREFIX) throw new Error('This playlist is too large. Use a smaller playlist or a direct media URL.');
      return { type: /#EXT-X-/.test(prefix) ? 'hls' : 'playlist', url, text: prefix };
    }
    if (/text\/|json|xml/.test(mime)) throw new Error('The server did not return a playable media file');
    return { type: 'media', url, filename, mime, kind: /^audio\//.test(mime) || /\.(mp3|flac|wav|ogg|m4a|opus|aac)$/i.test(filename) ? 'audio' : 'video' };
  }
  throw new Error('This link redirected too many times');
}
function createNetworkMediaProxy() {
  const entries = new Map(), requests = new Set();
  const server = http.createServer(async (req, res) => {
    const token = req.url?.match(/^\/media\/([a-f0-9-]+)$/)?.[1], entry = entries.get(token);
    if (!entry) { res.writeHead(404); return res.end(); }
    if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405); return res.end(); }
    const controller = new AbortController(); requests.add(controller);
    const timer = setTimeout(() => controller.abort(), 20000);
    res.on('close', () => { controller.abort(); requests.delete(controller); });
    try {
      let url = entry.url, response;
      for (let hop = 0; hop < 8; hop++) {
        response = await fetchWithSession(url, { method: req.method, redirect: 'manual', headers: { 'Accept-Encoding': 'identity', ...(req.headers.range ? { Range: req.headers.range } : {}) }, signal: controller.signal }, entry.session);
        if (![301, 302, 303, 307, 308].includes(response.status)) break;
        const location = response.headers.get('location'); await response.body?.cancel();
        if (!location) throw new Error('Invalid media redirect');
        url = httpUrl(location, url);
      }
      clearTimeout(timer);
      if (/html|json|xml/.test(response.headers.get('content-type') || '')) { await response.body?.cancel(); res.writeHead(502); return res.end('The website returned a page instead of media'); }
      const headers = { 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store' };
      for (const key of ['content-type', 'content-length', 'content-range', 'accept-ranges', 'etag', 'last-modified']) {
        const value = response.headers.get(key); if (value != null) headers[key] = value;
      }
      res.writeHead(response.status, headers);
      if (req.method === 'HEAD' || !response.body) return res.end();
      const body = Readable.fromWeb(response.body); body.on('error', () => res.destroy()); body.pipe(res);
    } catch { if (!res.headersSent) res.writeHead(502); res.end(); }
    finally { clearTimeout(timer); }
  });
  let ready;
  return {
    async register(url, session) {
      url = httpUrl(url);
      ready ||= new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', () => { server.unref(); resolve(); }); });
      await ready;
      const token = randomUUID(); entries.set(token, { url, session });
      if (entries.size > 64) entries.delete(entries.keys().next().value);
      return `http://127.0.0.1:${server.address().port}/media/${token}`;
    },
    close() { entries.clear(); for (const controller of requests) controller.abort(); server.closeAllConnections(); server.close(); },
  };
}
module.exports = { resolveNetworkMedia, mediaFilename, fetchWithSession, createNetworkMediaProxy };
