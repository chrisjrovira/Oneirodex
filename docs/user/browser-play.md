# Browser & companion play — platform matrix

GameTheca play modes for systems **below PS5 / Xbox Series**. Those two stay **catalog + download only**.

| Platform | Browser (WebRetro) | Companion | Notes |
|---|---|---|---|
| NES · SNES · N64 | Yes | Yes | N64: try alternate core if a title fails |
| GB · GBC · GBA · NDS · VB | Yes | Yes | |
| PS1 | Yes | Yes | Needs SCPH BIOS files |
| Genesis / MS / CD / 32X / GG | Yes | Yes | CD needs region BIOS |
| Saturn | Yes | Yes | Needs `saturn_bios.bin` |
| Atari · Lynx · Jaguar · WS · NGP · Coleco · Vectrex · 3DO · Neo Geo CD · INTV · CHAF · O2 | Yes | Yes | BIOS where listed in Admin → emulator BIOS |
| PC Engine · Commodore | Companion now (browser when WASM vendored) | Yes (RetroArch cores) | Drop cores via [webretro-cores.md](../runbooks/webretro-cores.md) (`fetch-webretro-cores --from-dir`); auto-unlocks from disk |
| PC DOS | When flag + WASM | Preferred | Companion default; `ENABLE_PCDOS_BROWSER` (default on) still needs vendored `dosbox_pure` WASM — see runbook |
| GameCube · Wii | No (WASM) | Preferred | Dolphin mapped; companion_hint on browse; no browser Play |
| Dreamcast · 3DS · PS Vita · PS2 | No | Preferred | flycast / citra / vita3k / pcsx2 companion cores + hints |
| Xbox · 360 · One · PS3 · PS4 | Catalog | Optional BYO | `play_mode=companion` + hints; no fake Play |
| PS5 · Xbox Series | Catalog only | — | `play_mode=catalog` |

Admin: upload BIOS via `/api/emulator-bios` (Settings / storage path). Browse API returns `bios` + `n64_note` on playable titles. Systems hub badges show **Browser** / **Companion** / **Catalog** per platform. Operator core drops: [webretro-cores.md](../runbooks/webretro-cores.md) · health: `GET /api/emulator/health` (`deferred_cores`) · JS allowlist: `GET /api/emulator/installed-cores.js`.

## Play shell (WebRetro room)

Browser play opens `webretro.html` with a per-system **room** skin (wallpaper, bezel chrome, bar typography, ambient light) — not just an accent color. Pass `platform=` (or rely on `core=` mapping) so the skin applies immediately; the bar shows the system name.

- **← Library** on the play bar returns via `history.back()` when the referrer is same-origin, else falls back to `/library`.
- Distinct rooms include NES den, SNES living room, Genesis arcade corner, PS1 CRT night, Dreamcast swirl, Arcade cabinet, GB/GBA handheld slabs, PC desk, and more.
- The emulator screen is **aspect-locked to the core's native shape** (SNES/NES/Genesis ~4:3, GBA 3:2, GB/GBC ~10:9, NDS portrait dual-screen, PSP/Vita ~16:9, etc.) instead of stretching to fill the bezel, so you no longer get big empty black bars around the picture.

## Audio/video tuning + WASM limits (SNES and friends)

Browser Play runs RetroArch compiled to WebAssembly inside the tab — there's no native audio thread or GPU passthrough, so a few defaults are tuned to reduce common WASM artifacts:

- **Audio buffer + timing skew** are set slightly above RetroArch's bare defaults (`audio_latency`, `audio_max_timing_skew`) so brief main-thread hiccups resample instead of crackling.
- **`video_vsync`** is explicit so WASM frame delivery paces to the browser's `requestAnimationFrame` instead of free-running.
- **SNES "Reduce Slowdown (Overclock)"** — a pre-start core option (gear icon before you press Start) enables `snes9x_overclock_cycles = balanced`, which fixes the slowdown-driven audio pitch/crackle some demanding SNES titles (Star Fox, Kirby's Dream Land 3, some Konami games) hit under WASM CPU pressure.
- **Browser autoplay policy**: audio stays muted/suspended until you interact with the page (the **Start** click/keypress inside the emulator). If you don't hear anything, click into the play screen once before pressing Start.

Residual limits that tuning can't fully fix in-browser: WASM is single-threaded on the main thread, so heavy cores (N64, PS1 HW renderer, Saturn) can still stutter under load on lower-end hardware, and audio scheduling jitter can't reach native-app smoothness. If a title is still choppy after the overclock option, prefer the **desktop companion** (native RetroArch) for that system.

## Compressed ROMs (extract-on-play)

Browser Play streams via `GET /api/downloadrom/<uuid>` (ASGI). Server extracts a playable member into `static/library/rom_cache/<uuid>/` for:

| Format | Notes |
|---|---|
| `.zip` | Nested folders + zip-in-zip (depth ≤ 3). Multi-ROM: prefers platform extension, then larger files; `.cue` (+ sibling `.bin`) for disc sets |
| `.7z` | Requires `py7zr` |
| `.rar` | Requires `rarfile` + a host `unrar`/`bsdtar`/`7z` binary — the Docker image ships `libarchive-tools` (`bsdtar`) + `p7zip-full` (`7z`) so this works out of the box in Compose/Unraid |
| `.gz` | Single ROM wrappers only (`Adventure.nes.gz`). `.tar.gz` is **not** browser-playable (`play_blocker=unsupported_archive`) |

Failures return JSON: `{"error": "…", "code": "…", "hint": "…"}` (`error` always present). The play shell (`webretro.html`) surfaces non-2xx `/api/downloadrom/` responses in an accessible `#gt-play-alert` region (`error` plus optional `hint`) instead of a silent `.catch`. Browse may set `play_blocker=unsupported_archive`; GameCard / Game Details show a disabled Play control with tooltip when that blocker is present.

### PS1 (and other disc/`.cue`) downloads are bundled as a zip

`.cue` sheets need their sibling `.bin`/`.img`/`.iso`/`.raw`/`.wav` track files to boot — a plain HTTP GET can only stream one file. `GET /api/downloadrom/<uuid>` detects this and streams a single **stored (uncompressed) `play.zip`** containing the `.cue` (with `FILE` lines rewritten to plain basenames) plus every disc-track companion sitting next to it. WebRetro's own client-side unzip (`unzipFileMulti`) splits the bundle back into files for disc cores (PS1, Saturn, Sega CD, etc.) — no server round-trip changes were needed on the WebRetro side beyond reading the real filename off the response.

Single-file discs (`.iso`, `.chd`, a lone `.bin`) stream unchanged — no zip wrapping. The play shell reads the actual filename from the response's `Content-Disposition` header (not the request URL, which is just `/api/downloadrom/<uuid>`) and uses a long fetch timeout for ROM downloads, since PS1-sized discs can take well past the old 8-second default.

## Cloud saves (WebRetro bridge)

The play bar **Sync cloud saves** uses `gt-bridge.js` postMessage (`gt-export-saves` / `gt-import-saves`):

- Export retries briefly so slow cores can flush `.state` / battery SRAM.
- SRAM pick prefers `.srm`, then memory-card `.mcr`, then `.sav` (helps PS1-style cores).
- Import writes IndexedDB + FS and calls `_cmd_load_state` when the core exposes it; otherwise use RetroArch **Load State**.
- CSRF for upload comes from the `csrf_token` cookie (meta tag is filled from the cookie when present).

If a deferred core is still warming, status may say to sync again after **Start**.

Full plan: [emulation-coverage.md](../strategy/emulation-coverage.md).

## Sample free ROMs (legal only)

For smoke-testing browser/companion play without commercial dumps, operators can fetch author-licensed homebrew and test ROMs via `python scripts/fetch-free-roms.py` (manifest + notes in [samples/free-roms/](../../samples/free-roms/README.md)). Binaries are gitignored; never commit pirated ROMs.
