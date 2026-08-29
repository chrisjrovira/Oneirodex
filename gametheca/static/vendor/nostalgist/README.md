# Nostalgist (BP-1 NES pilot)

Vendored **nostalgist@0.21.1** (`nostalgist.umd.js`, MIT).

- Host page: `play.html?guid=<uuid>&core=nestopia&platform=NES`
- ROM URL is **absolute same-origin** `/api/downloadrom/<uuid>` (relative names would hit Nostalgist's CDN sample ROM resolver)
- Cores resolve from `/static/vendor/webretro/cores/` (same WASM as WebRetro)
- Gated by `GlobalSettings.settings.browser_player.nostalgist_nes_pilot` (default **off**)

See [docs/dev/browser-play-engines.md](../../../../docs/dev/browser-play-engines.md).
