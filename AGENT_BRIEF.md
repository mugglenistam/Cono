# Task brief: finish "VLC Redesign" — a Windows media player (Electron)

## Goal
Build a Windows media player that matches the redesigned VLC UI from the YouTube video
"I Redesigned VLC After 25 Years" (https://www.youtube.com/watch?v=ERFeOgqk324, by Juxtopposed).
The project already exists in this folder (`vlc-redesign/`). Your job is to finish, verify and package it.
Windows only (the user dropped the Android requirement).

## Current state
Written and syntax-checked: `main.js`, `preload.js`, `src/{index.html,style.css,icons.js,core.js,player.js,panels.js,library.js,dialogs.js}`, `package.json`, plus a Playwright harness in `test/` (`harness.js`, `t1.js`, `t2.js`, `t3.js`).

Already verified in headless Chromium (stand-in for the Electron preload API): library home and folder grid with thumbnails, playback, subtitle auto-detect and rendering, compact library sidebar, the four sidebar tabs (Subtitles, Audio, Video, Playback), queue panel, seek hover, bookmarks, subtitle timeline, ⋯ menu, settings dialog. All looked correct.

NOT yet done:
1. `test/t3.js` was never run (onboarding, audio-file artwork, fullscreen auto-hide bars, light theme, right-click menu, customize dialog, hotkeys dialog, and a block of functional asserts: toggle play, seek, volume, speed, subtitle delay, EQ graph, aspect transform, next()).
2. This CSS patch was NOT applied. Append to `src/style.css`:
   ```css
   .panel-head h3{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
   .panel-head .icon-btn{width:30px;height:30px}
   .lib.compact .sect-h{flex-wrap:wrap;font-size:16px;gap:6px;margin:12px 4px 8px}
   .lib.compact .sect-h .btn{height:28px;padding:0 10px;font-size:12px}
   .lib.compact .lib-bar{padding:8px;gap:0;justify-content:space-between}
   .lib.compact .lib-bar .path{display:none}
   .lib.compact .lib-bar .icon-btn{width:30px;height:30px}
   ```
3. The real Electron app has never been run, and no `.exe` exists. The sandbox where this was written had no access to npm or GitHub.
4. Needs a Windows icon at `build/icon.ico` (a 256×256 orange traffic-cone icon).

## Design spec (taken from the video)
- **Colours:** near-black neutrals (`#0a0a0a` bg, `#141414` bars, `#171717` panels) and VLC orange `#f58a00` as the accent. The accent must be user-changeable (Settings → General) and there must be dark, light and system themes. Keep the orange traffic cone logo.
- **Shape:** rectangular, but slightly rounded (about 7px radius). Do not make it circular.
- **Icons:** one consistent line-icon set. Two-tone (grey + orange) icons are used for non-clickable menu glyphs.
- **Bottom bar (one thin row):** `prev | play (orange rounded rectangle) | next`, current time, **thick seek bar** (dark-orange played region, thin orange handle, chapter/bookmark gaps), duration, **cone-shaped volume slider** (green gradient), then audio, subtitles, settings (gear) and queue icons on the right. Seeking shows a thumbnail preview.
- **Top bar:** cone logo, ⋯ menu, library-sidebar toggle, folder name (click opens the full library), centred media title, PiP, fullscreen, window controls.
- **Fullscreen:** top and bottom bars appear only when the mouse is near them and vanish as soon as it leaves. Right-click menu has "Hide interface". Show the pressed keyboard shortcut in OSD messages.
- **Right sidebar (settings):** four tabs.
  - Subtitles: track, delay slider, subtitle timeline you can drag to re-sync, font/size (relative or precise)/outline/position, presets saved per folder or show, default language.
  - Audio: output device, equalizer presets with preview icons, boost.
  - Video: filter presets with previews, flip/rotate/zoom/aspect.
  - Playback: speed, sleep timer, show waveform on seek bar, show metadata, bookmarks list.
- **Library:** Home (Watch Next, recent, playlists, streams), Videos, Music (songs, albums), Network (streams and M3U playlists), Playlists, Recent, pinned folders, "Add item". Breadcrumb bar, back/forward, sort (including unwatched/watched first), search, grid/list/detail view cycle. It can be shown full-screen or as a compact sidebar next to the video. Drag files into the queue.
- **Other dialogs:** Add subtitles for this file, this folder or this playlist, with auto-matching by episode. Full Settings dialog with categories. Keyboard shortcuts dialog (rebindable, Ctrl+B = bookmark). Customize Player (drag/toggle control-bar buttons). First-run onboarding with theme, accent and shortcuts.

## Steps for you
1. `cd vlc-redesign && npm install` (installs electron and electron-builder; needs network).
2. Apply the CSS patch above. Run `node test/t3.js` (needs Playwright with Chromium; the harness lives in `test/harness.js`) and review the screenshots it writes. Fix anything broken or misaligned. Compare against the video's look.
3. Run `npm start` on Windows and check, with real Electron: custom frameless title bar and window buttons, fullscreen, file association/open-with, drag-and-drop of files and folders, folder picker, PiP, `file://` thumbnails in the library, OS audio-output switching.
4. Add `build/icon.ico`, then run `npm run dist` to produce the NSIS installer and portable `.exe` in `dist/`.
5. Smoke-test the built `.exe`.

## Known limits (keep or improve, but be honest in the README)
- Playback uses Chromium's media engine: MP4/H.264, WebM, MKV (H.264/VP9), MP3, FLAC, AAC, Opus, OGG, WAV. AVI, WMV, DTS and HLS streams are not supported. For full VLC-level format support the engine would need to be swapped for libVLC/mpv, which is a much bigger job.
- Audio delay and audio-track switching are not implemented (HTML video limitation). Equalizer and boost work only for local files.
- Convert, stream-to-device and recording from the original redesign are not implemented.
- Music "Artists" and "Genres" need tag parsing (e.g. `music-metadata`) and are not done; Songs and Albums (by folder) work.

## Deliverable
A working Windows installer and portable `.exe`, the source in this folder, and a short README listing what works and the limits above.
