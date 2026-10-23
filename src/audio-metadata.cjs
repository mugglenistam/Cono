const fs = require('node:fs/promises');
const path = require('node:path');
const { nativeImage } = require('electron');
const covers = new Map();
const details = new Map();
let parser;

async function readAudioCover(file) {
  if (typeof file !== 'string' || !/\.(mp3|flac|wav|ogg|m4a|opus|aac)$/i.test(file)) return null;
  try {
    const stat = await fs.stat(file);
    const key = `${path.resolve(file)}:${stat.size}:${stat.mtimeMs}`;
    if (!covers.has(key)) {
      const pending = (async () => {
        const { parseFile, selectCover } = await (parser ||= import('music-metadata'));
        const { common } = await parseFile(file, { duration: false });
        const cover = selectCover(common.picture);
        if (!cover) return null;
        const image = nativeImage.createFromBuffer(Buffer.from(cover.data));
        if (image.isEmpty()) return null;
        const { width, height } = image.getSize();
        return (Math.max(width, height) > 640
          ? image.resize(width >= height ? { width: 640 } : { height: 640 })
          : image).toDataURL();
      })().catch(() => null);
      covers.set(key, pending);
      if (covers.size > 64) covers.delete(covers.keys().next().value);
    }
    return await covers.get(key);
  } catch { return null; }
}

async function readAudioInfo(file) {
  if (typeof file !== 'string' || !/\.(mp3|flac|wav|ogg|m4a|opus|aac)$/i.test(file)) return null;
  try {
    const stat = await fs.stat(file), key = `${path.resolve(file)}:${stat.size}:${stat.mtimeMs}`;
    if (!details.has(key)) {
      details.set(key, (async () => {
        const { parseFile } = await (parser ||= import('music-metadata'));
        const { common, format } = await parseFile(file, { skipCovers: true, duration: false });
        return { title: common.title || '', artist: common.artist || '', album: common.album || '', year: common.year || null, duration: format.duration || null };
      })().catch(() => null));
      if (details.size > 64) details.delete(details.keys().next().value);
    }
    return details.get(key);
  } catch { return null; }
}
module.exports = { readAudioCover, readAudioInfo };
