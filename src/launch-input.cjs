// External app links are data, never command-line options or executable commands.
const fs = require('node:fs');
function mediaLink(input) {
  if (typeof input !== 'string' || input.length > 32768 || /[\r\n\0]/.test(input)) return null;
  let value = input.trim();
  if (/^(cono|vlc):\/\//i.test(value)) {
    if (/^cono:\/\/open(?:[/?]|$)/i.test(value)) {
      try { value = new URL(value).searchParams.get('url') || ''; } catch { return null; }
    }
    else {
      value = value.replace(/^(cono|vlc):\/\//i, '');
      if (/^https?%3a/i.test(value)) { try { value = decodeURIComponent(value); } catch { return null; } }
      // Chromium canonicalizes vlc://https://host to vlc://https//host.
      value = value.replace(/^(https?)\/\//i, '$1://');
    }
  }
  try { const url = new URL(value); return ['http:', 'https:'].includes(url.protocol) ? url.href : null; } catch { return null; }
}
function launchInputs(argv) {
  return argv.flatMap(value => {
    if (typeof value !== 'string' || value.startsWith('-')) return [];
    const url = mediaLink(value); if (url) return [url];
    try { return fs.existsSync(value) ? [value] : []; } catch { return []; }
  });
}
module.exports = { mediaLink, launchInputs };
