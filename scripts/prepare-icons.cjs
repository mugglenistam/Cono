// Convert the supplied logo into application PNG and multi-resolution Windows ICO.
// Run with: node scripts/prepare-icons.cjs
if (!process.versions.electron || process.type !== 'browser') {
  const env = { ...process.env }; delete env.ELECTRON_RUN_AS_NODE;
  const result = require('node:child_process').spawnSync(require('electron'), [__filename], { env, stdio: 'inherit', windowsHide: true });
  process.exit(result.status ?? 1);
} else {
  const { app, nativeImage } = require('electron');
  const fs = require('node:fs'), path = require('node:path');
  app.whenReady().then(() => {
    try {
      const root = path.join(__dirname, '..');
      const source = nativeImage.createFromPath(path.join(root, 'src/assets/Cono-logo.png'));
      if (source.isEmpty()) throw new Error('Cannot read Cono-logo.png');
      const { width, height } = source.getSize(), pixels = source.toBitmap();
      let left = width, top = height, right = -1, bottom = -1;
      for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
        if (pixels[(y * width + x) * 4 + 3] > 16) {
          left = Math.min(left, x); right = Math.max(right, x);
          top = Math.min(top, y); bottom = Math.max(bottom, y);
        }
      }
      if (right < left) throw new Error('Logo is fully transparent');
      // Retain the artwork and a little padding while removing excess empty margins.
      const side = Math.min(width, height, Math.ceil(Math.max(right - left + 1, bottom - top + 1) * 1.14));
      const x = Math.max(0, Math.min(width - side, Math.round((left + right - side) / 2)));
      const y = Math.max(0, Math.min(height - side, Math.round((top + bottom - side) / 2)));
      const icon = source.crop({ x, y, width: side, height: side }).resize({ width: 512, height: 512, quality: 'best' });
      fs.mkdirSync(path.join(root, 'build'), { recursive: true });
      fs.writeFileSync(path.join(root, 'src/assets/cono-icon.png'), icon.toPNG());
      fs.writeFileSync(path.join(root, 'build/icon.png'), icon.toPNG());
      const sizes = [16, 24, 32, 48, 64, 128, 256];
      const frames = sizes.map(size => icon.resize({ width: size, height: size, quality: 'best' }).toPNG());
      const header = Buffer.alloc(6 + 16 * sizes.length);
      header.writeUInt16LE(1, 2); header.writeUInt16LE(sizes.length, 4);
      let offset = header.length;
      frames.forEach((frame, i) => {
        const entry = 6 + 16 * i;
        header[entry] = header[entry + 1] = sizes[i] === 256 ? 0 : sizes[i];
        header.writeUInt16LE(1, entry + 4); header.writeUInt16LE(32, entry + 6);
        header.writeUInt32LE(frame.length, entry + 8); header.writeUInt32LE(offset, entry + 12);
        offset += frame.length;
      });
      fs.writeFileSync(path.join(root, 'build/icon.ico'), Buffer.concat([header, ...frames]));
      console.log('Prepared Cono PNG and Windows ICO (16–256 px).');
      app.exit(0);
    } catch (error) { console.error(error); app.exit(1); }
  });
}
