# Changelog

## 1.0.3 — 2026-10-24

Changes since the previous published release, 1.0.1.

### Playback

- Fixed a file-switching bug that saved the outgoing file's position against the newly selected file.
- Reset the decoder, seek state, and timeline before loading a different file.
- Added **Continue** and **Start from beginning** choices for unfinished videos. Playback waits for the selection.
- Music always starts at zero and ignores older audio resume positions.
- Preserved video bookmarks when changing files while a resume prompt is open; delayed dialog actions cannot seek the next file.

### Library and listening view

- Added **Back to list**, preserving the originating folder or playlist, search, scroll position, and folder history.
- Title-bar Back first returns to the current list before navigating folder history.
- Added a dedicated music view with embedded/fallback artwork, track tags, shuffle/repeat controls, and an up-next queue.
- Kept fullscreen navigation and settings below the title bar to avoid overlapping controls.
- Applied a perceptual volume taper consistently to the slider, keyboard, mouse wheel, and saved volume.

### Network and browser playback

- Added `cono://` and VLC-compatible `vlc://` launch links, including startup and already-running application handoff.
- Added downloaded M3U media-list opening and website blank-popup handoff handling.
- Added bounded media-link inspection, redirects, query-string filenames, website-session cookies, and HTTP range streaming.
- Distinguished login/subscription pages from unsupported media errors.

### Verification and limitations

- Six self-contained Electron checks cover the interface, audio, video/subtitles, network playback, browser links, and resume behavior.
- The resume checks use separate 130-second media fixtures and verify switching at 1:01, both resume choices, saved positions after reload, and stale dialogs.
- Packaged-application checks include resume behavior and real HTTP MKV playback/seeking.
- Website handoff uses a local test page; authenticated third-party player buttons have not been verified end to end.
- Playback still depends on Chromium-supported codecs. HLS, DTS, and embedded image subtitles remain unsupported.
- Windows executables are unsigned.

## 1.0.1

- Improved five-second and repeated seeking and released preview decoding during playback seeks.
- Added embedded text subtitle discovery and extraction using bundled FFmpeg/FFprobe tools.
- Added embedded SRT and ASS/SSA handling, Persian language preference, and SubDL links.
- Prevented delayed subtitle results from affecting newly selected files.
