const fs = require('node:fs/promises');
const path = require('node:path');
const { execFile } = require('node:child_process');
const { setPriority, constants } = require('node:os');

const textCodecs = new Set(['subrip', 'ass', 'ssa', 'webvtt', 'mov_text', 'text', 'ttml', 'subviewer', 'microdvd', 'jacosub', 'sami', 'realtext', 'stl', 'pjs', 'vplayer']);
const probes = new Map(), extracts = new Map(), children = new Set();
let extractionQueue = Promise.resolve();
function toolPath(name) {
  const file = name === 'ffmpeg' ? require('ffmpeg-static') : require('@ffprobe-installer/ffprobe').path;
  if (!file) throw new Error('Subtitle tools are unavailable on this platform');
  return file.replace(/app\.asar([\\/])/, 'app.asar.unpacked$1');
}
function runTool(name, args, timeout) {
  return new Promise((resolve, reject) => {
    const child = execFile(toolPath(name), args, { windowsHide: true, timeout, maxBuffer: 32 * 1024 * 1024, encoding: 'utf8' }, (error, stdout) => {
      children.delete(child);
      if (error) reject(new Error(`${name === 'ffprobe' ? 'Reading subtitle tracks' : 'Extracting subtitles'} failed${error.killed ? ' (timed out)' : ''}`));
      else resolve(stdout);
    });
    children.add(child);
    try { setPriority(child.pid, constants.priority.PRIORITY_BELOW_NORMAL); } catch {}
  });
}
async function source(file) {
  if (typeof file !== 'string' || !/\.(mkv|mp4|webm|mov|m4v|avi|ogv)$/i.test(file)) throw new Error('Choose a local video file');
  const absolute = path.resolve(file), stat = await fs.stat(absolute);
  if (!stat.isFile()) throw new Error('Video file was not found');
  return { file: absolute, key: `${absolute}:${stat.size}:${stat.mtimeMs}` };
}
async function listEmbeddedSubtitles(file) {
  const input = await source(file);
  if (!probes.has(input.key)) {
    const pending = runTool('ffprobe', ['-v', 'error', '-select_streams', 's', '-show_entries', 'stream=index,codec_name:stream_tags=language,title:stream_disposition=default,forced', '-of', 'json', input.file], 20000)
      .then(raw => (JSON.parse(raw).streams || []).map(stream => ({
        index: stream.index, codec: stream.codec_name, language: stream.tags?.language || '',
        title: stream.tags?.title || '', default: !!stream.disposition?.default, forced: !!stream.disposition?.forced,
        supported: textCodecs.has(stream.codec_name),
      })));
    probes.set(input.key, pending);
    pending.catch(() => probes.delete(input.key));
    if (probes.size > 64) probes.delete(probes.keys().next().value);
  }
  return probes.get(input.key);
}
async function extractEmbeddedSubtitle(file, index) {
  if (!Number.isInteger(index) || index < 0) throw new Error('Invalid subtitle track');
  const input = await source(file);
  const track = (await listEmbeddedSubtitles(input.file)).find(track => track.index === index);
  if (!track?.supported) throw new Error('This subtitle track is image-based or uses an unsupported codec');
  const key = `${input.key}:${index}`;
  if (!extracts.has(key)) {
    const pending = extractionQueue.then(() => runTool('ffmpeg', ['-nostdin', '-v', 'error', '-i', input.file, '-map', `0:${index}`, '-c:s', 'srt', '-f', 'srt', 'pipe:1'], 120000));
    extractionQueue = pending.catch(() => {});
    extracts.set(key, pending);
    pending.catch(() => extracts.delete(key));
    if (extracts.size > 8) extracts.delete(extracts.keys().next().value);
  }
  return extracts.get(key);
}
function stopSubtitleTools() { for (const child of children) child.kill(); }
module.exports = { listEmbeddedSubtitles, extractEmbeddedSubtitle, stopSubtitleTools, toolPath };
