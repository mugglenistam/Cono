# Cono (Windows)

A modern audio and video player based on the "I Redesigned VLC After 25 Years" design study. Not affiliated with VideoLAN.

## Run / build (on Windows, Node 18+)
    npm install
    npm start          # run the app
    npm run dist       # builds installer + portable .exe into dist/

## What works
Library (Home, Videos, Music, Network, Playlists, Recent, pinned folders), queue with drag & drop, thick seek bar with
thumbnail preview, cone volume, settings sidebar (subtitles with draggable timeline, audio EQ/boost/output device, video
filters/aspect/transform, speed, sleep timer, bookmarks), per-folder presets, subtitle matching for file/folder/playlist,
settings dialog with accent colour and dark/light/system themes, rebindable shortcuts, customizable control bar, onboarding.

Local audio files automatically show a waveform behind the seek bar, with the played portion in the current accent colour.
Embedded album art is used in the library and during playback; tracks without readable artwork use the bundled CD-case image.
Waveform analysis is limited to files up to 150 MB that Chromium can decode; playback and artwork still work without a waveform.

Renderer regression checks: `node test/ui-regressions.js` and `node test/audio-media.js`.

## Limits
Playback uses Chromium's media engine (MP4/H.264, WebM, MKV H.264/VP9, MP3, FLAC, AAC, Opus, OGG, WAV). AVI/WMV/DTS/HLS
are not supported. Audio delay, audio-track switching, convert/stream-to-device and recording are not implemented.
Music Artists/Genres need tag parsing and are not done. The Electron shell itself has not been run yet (see AGENT_BRIEF.md).
