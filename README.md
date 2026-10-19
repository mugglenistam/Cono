<div align="center">

<img src="src/assets/cono-icon.png" alt="Cono logo" width="128" height="128">

# Cono

**Your music. Your videos. One focused player.**

A modern audio and video player for Windows, with a customizable interface, audio waveforms, album artwork, and a folder-based media library.

[Download for Windows](https://github.com/mugglenistam/Cono/releases/latest) · [Features](#features) · [Build from source](#build-from-source) · [Report an issue](https://github.com/mugglenistam/Cono/issues)

![Windows x64](https://img.shields.io/badge/platform-Windows_x64-0078D4)
![Electron](https://img.shields.io/badge/built_with-Electron-47848F)
![Version 1.0.1](https://img.shields.io/badge/version-1.0.1-A855F7)

</div>

## Download

The current release is **Cono 1.0.1 for 64-bit Windows**. Choose the download that fits how you want to use the app.

| Download | Best for | How to use |
| --- | --- | --- |
| [**Windows installer**](https://github.com/mugglenistam/Cono/releases/download/v1.0.1/Cono-Setup-1.0.1-x64.exe) | Regular use on your computer | Run the setup wizard and choose an installation folder. |
| [**Portable executable**](https://github.com/mugglenistam/Cono/releases/download/v1.0.1/Cono-Portable-1.0.1-x64.exe) | Running without installation | Save the executable in a folder or on a USB drive, then launch it directly. |

You only need one version. Both contain the same player features.

The portable executable stores settings and playback history in your Windows user profile; those settings do not travel with the executable.

**Signing:** Release executables are currently unsigned. Windows may display an unknown-publisher or SmartScreen prompt.

See [all releases](https://github.com/mugglenistam/Cono/releases) for downloads and release notes.

## Features

### A library that follows your folders

- Home, Videos, Music, Network, Playlists, and Recent sections.
- Add media folders, browse subfolders, and pin frequently used locations.
- Grid, list, and detail views with file durations and available file information.
- Search, sorting, watched status, and playback progress.
- Back and forward navigation between library locations.
- An expandable navigation menu and a compact library beside the player.
- Create playlists, manage the playback queue, and drag files into the app.

### Music with a visual timeline

- Audio waveforms displayed behind the seek bar for local audio files.
- The played portion of the waveform follows your selected accent color.
- Embedded album artwork in the library and during playback.
- A bundled fallback cover when a track has no readable artwork.
- Songs and folder-based album browsing.
- Equalizer presets, audio boost, and output-device selection where supported.
- A volume control that transitions from green toward red as volume increases.

### Playback controls within reach

- Resume playback, shuffle, repeat, and automatic advancement through the queue.
- Playback speed from **0.25× to 4×**.
- Bookmarks, a sleep timer, and screenshots from video frames.
- Fullscreen playback with controls that appear near the screen edges.
- Picture-in-picture when supported by the media and playback environment.
- Adjust brightness, contrast, saturation, rotation, flipping, zoom, and aspect ratio.

### Subtitles and customization

- Load SRT, VTT, ASS, and SSA subtitle files.
- Automatically match local subtitle files to media filenames.
- Discover and select embedded text subtitle tracks in local MKV and other supported video containers, including SRT, ASS/SSA, WebVTT, and MP4 timed text.
- Find additional subtitle files on [SubDL](https://subdl.com/).
- Adjust subtitle timing, font, size, color, outline, background, and position.
- Drag the subtitle timeline to adjust synchronization.
- Save playback and subtitle presets, including folder-specific presets.
- Dark, light, and system themes with a configurable accent color.
- Customizable control-bar buttons and rebindable keyboard shortcuts.

## Getting started

1. Launch Cono and choose your theme and accent color.
2. Open a file with **Ctrl+O**, use the top-left menu, or drag media into the window.
3. Use **Add item** in the library to add a music or video folder, create a playlist, or add a network stream.
4. Use the sidebar button to expand or collapse navigation. While playing media, it can show a compact library beside the player.
5. Open playback settings for subtitles, audio, video, and playback options. Use **Ctrl+P** for the full settings dialog.

## Media support and limitations

Cono uses **Chromium's media engine**, rather than libVLC or mpv. A filename extension alone does not guarantee playback: the codecs inside the file must also be supported.

| Media | Supported playback paths |
| --- | --- |
| Video | MP4/H.264, WebM, and compatible MKV files containing supported codecs such as H.264 or VP9. |
| Audio | MP3, FLAC, WAV, OGG/Vorbis, Opus, and compatible AAC/M4A files. |
| Network | Direct audio/video URLs supported by Chromium; M3U playlists with playable direct-media entries. |
| Subtitles | SRT and VTT text subtitles; basic ASS/SSA dialogue parsing. Full ASS styling and effects are not implemented. |

Current limits:

- AVI, WMV, DTS audio, and HLS/M3U8 streams are not supported in this release.
- Audio delay and manual audio-track switching are not implemented.
- Embedded image subtitles such as PGS and VobSub are detected but cannot currently be displayed. Text-based embedded subtitles are extracted with bundled FFmpeg tools; ASS styling is rendered as plain dialogue text.
- Waveforms are generated for local audio files up to **150 MB** that Chromium can decode. Larger files can still play without a waveform.
- Equalizer and boost processing work with local files.
- Music albums are grouped by folder. Dedicated Artists and Genres views are not implemented.
- Format conversion, recording, and casting to other devices are not implemented.
- Windows is the release target. macOS and Linux packages are not provided.

## Default keyboard shortcuts

Shortcuts can be changed in the app.

| Action | Shortcut |
| --- | --- |
| Play / pause | `Space` |
| Seek backward / forward 5 seconds | `←` / `→` |
| Seek backward / forward 30 seconds | `Shift+←` / `Shift+→` |
| Volume up / down | `↑` / `↓` |
| Mute | `M` |
| Fullscreen | `F` |
| Previous / next item | `P` / `N` |
| Open media files | `Ctrl+O` |
| Settings | `Ctrl+P` |
| Toggle library / queue | `L` / `Q` |
| Add bookmark | `Ctrl+B` |
| Adjust subtitle delay | `H` / `J` |
| Decrease / increase playback speed | `[` / `]` |
| Reset playback speed | `=` |
| Save a video screenshot | `S` |
| Hide / show the interface | `Ctrl+H` |

## Settings and local data

The desktop app stores its settings, library paths, playlists, queue, playback history, resume positions, bookmarks, and presets in:

```text
%APPDATA%\Cono\store.json
```

Library entries reference your existing media files; adding a folder does not copy those files into the application.

Settings from the earlier **VLC Redesign** application name are read as a fallback when no Cono settings file is available.

## Build from source

### Requirements

- Windows for creating the Windows installer and portable executable.
- Node.js **22 or newer**, with npm.
- Git to clone the repository.
- Internet access for the initial dependency installation and packaging-tool downloads.

### Run locally

```powershell
git clone https://github.com/mugglenistam/Cono.git
cd Cono
npm ci
npm start
```

### Build Windows x64 releases

```powershell
npm run dist -- --x64 --publish never
```

The generated files are placed in `dist/`:

```text
dist/
├── Cono Setup 1.0.1.exe     # Windows installer
├── Cono 1.0.1.exe           # Portable executable
└── win-unpacked/            # Unpacked application bundle
```

`--publish never` creates local artifacts without uploading them. Release assets use explicit `Setup`, `Portable`, and `x64` names on GitHub so the two downloads are easy to distinguish.

The `dist/` and `node_modules/` directories are excluded from source control. Upload distributable executables as **GitHub Release assets**.

### Update the app icon

The source logo is `src/assets/Cono-logo.png`. After replacing it, run:

```powershell
npm run icons
```

This generates the app PNG and Windows ICO with sizes from 16 to 256 pixels. Rebuild the release afterward to include the updated icon in the executable and installer.

## Verification

Run the self-contained Electron regression checks:

```powershell
node test/ui-regressions.js
node test/audio-media.js
node test/video-subtitles.js
```

- **UI checks:** sidebar behavior, navigation history, volume colors and clipping, dragging, mute, keyboard input, and window sizes.
- **Audio checks:** generated stereo fixtures, embedded and fallback artwork, durations in library views and playlists, waveform progress and accent colors, and cleanup when switching to video.
- **Video checks:** generated long-GOP MKV with embedded English SRT and Persian ASS, subtitle selection and timing, exact and repeated seeks, resumed video frames, and the SubDL entry point.

The audio checks can also target a packaged application:

```powershell
$env:CONO_APP_ROOT = (Resolve-Path "dist/win-unpacked/resources/app.asar").Path
node test/audio-media.js
Remove-Item Env:CONO_APP_ROOT
```

These checks validate application behavior; they do not cover every codec, Windows installation flow, or hardware output device. Older `test/t1.js`, `t2.js`, and `t3.js` scripts require external media fixtures and are not part of the self-contained checks above.

## Project structure

```text
main.js                    Electron main process, file access, settings, and IPC
preload.js                 Renderer-facing desktop API
src/
├── index.html             Application shell
├── style.css              Themes, layouts, and component styles
├── core.js                State, persistence, menus, and shared UI helpers
├── player.js              Playback, waveforms, subtitles, and media effects
├── library.js             Library navigation and media views
├── media.js               Shared artwork and duration loading
├── audio-metadata.cjs     Embedded artwork extraction
├── embedded-subtitles.cjs Embedded subtitle inspection and extraction
├── panels.js              Playback controls, side panels, and queue
├── dialogs.js             Settings, onboarding, dialogs, and shortcuts
├── icons.js               Interface icons and app-logo markup
└── assets/                Logo, app icon, and fallback cover
scripts/prepare-icons.cjs   Icon generation
test/                      Electron regression checks and legacy fixture scripts
build/                     Windows packaging icons
```

## Feedback and contributions

Found a bug? [Open an issue](https://github.com/mugglenistam/Cono/issues) with the Cono version, Windows version, steps to reproduce, and expected behavior. For playback problems, include the container and codec information if available. A short, non-sensitive sample can help reproduce media-specific problems.

For code contributions, keep changes focused, describe the problem and resulting behavior, and run the relevant regression checks before submitting a pull request.

## Credits

- Interface inspiration: Juxtopposed's [“I Redesigned VLC After 25 Years”](https://www.youtube.com/watch?v=ERFeOgqk324) design study.
- Desktop runtime and playback: [Electron](https://www.electronjs.org/) and Chromium.
- Embedded artwork parsing: [music-metadata](https://github.com/Borewit/music-metadata).
- Windows packaging: [electron-builder](https://www.electron.build/).
- Embedded subtitle tools: [FFmpeg and FFprobe](https://ffmpeg.org/). Bundled Windows helper license and build information are included in [`src/third-party/`](src/third-party/).

Cono is an independent project and is not affiliated with or endorsed by VideoLAN or the VLC project.

## License

A project license has not been added to this repository yet. Third-party dependencies retain their respective licenses.
