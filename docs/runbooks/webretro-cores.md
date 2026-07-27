# WebRetro cores — operator vendor guide

**Status:** Default image ships the **24** WebRetro 6.5 cores already in this tree. PCE / VICE / DOSBox WASM stay **operator-owned** (size + licensing) — drop them here or mount a host folder. Companion Play remains available without them.

Related: [browser-play.md](../user/browser-play.md) · [emulation-coverage.md](../strategy/emulation-coverage.md)

## Storage path

```
gametheca/static/vendor/webretro/cores/
  {core_id}_libretro.js
  {core_id}_libretro.wasm
```

Optional Docker bind-mount (must include shipped cores **or** run `--defaults` into that host dir first — an empty mount hides image cores):

```yaml
# docker-compose.yml (uncomment when ready)
# - "${WEBRETRO_CORES_HOST_PATH}:/app/gametheca/static/vendor/webretro/cores"
```

## One-command fetch

```bash
# Defaults from BinBashBanana/webretro@6.5 (jsDelivr) — 24 cores
./scripts/fetch-webretro-cores.sh --defaults

# Deferred cores from your Emscripten / WebRetro pack (not on the CDN)
./scripts/fetch-webretro-cores.sh --from-dir /path/to/built/cores

# Windows
.\scripts\fetch-webretro-cores.ps1 -Defaults
.\scripts\fetch-webretro-cores.ps1 -FromDir C:\path\to\built\cores
```

You are responsible for each core’s license compliance.

## Deferred cores (Wave 19)

| Core ID | Platforms | Extra flag |
|---|---|---|
| `mednafen_pce_fast` | PCE | none — auto browser when files present |
| `mednafen_supergrafx` | PCE (optional) | none |
| `vice_x64` | VICE / C64 family | none |
| `dosbox_pure` (preferred) or `dosbox` | PCDOS | `ENABLE_PCDOS_BROWSER=true` |

These IDs return **404** on the webretro@6.5 CDN — build via RetroArch emscripten ([pkg/emscripten README](https://github.com/libretro/RetroArch/blob/master/pkg/emscripten/README.md)) or copy from a compatible WebRetro core pack, then `--from-dir`.

## Steps (end-to-end)

1. Fetch defaults and/or copy deferred pairs into `cores/` (script above).
2. **No `base.js` edit** — GameTheca serves `GET /api/emulator/installed-cores.js` from disk discovery; `standalone.html` loads WASM from `/static/vendor/webretro/` (not CDN).
3. Restart the app if cores live only in the image layer (bind-mounts are live).
4. Check health:
   ```bash
   curl -sS "$BASE/api/emulator/health" | jq '.deferred_cores, .installed_cores'
   curl -sS "$BASE/api/emulator/installed-cores.js"
   ```
5. For DOS only: set `ENABLE_PCDOS_BROWSER=true`.
6. Confirm Systems badge flips to **Browser** and game details shows **Play in browser** when `can_play_in_browser` is true.

## Cold start (GameTheca embed)

Play opens `webretro.html` → iframe `standalone.html?core=&rom=&nobundle=1`.

| Optimization | Where |
|---|---|
| Local CSS/JS (no jsDelivr on boot) | `standalone.html` → `/static/vendor/webretro/assets/*` |
| Skip RetroArch asset bundle CDN storm | `nobundle=1` on the iframe URL |
| Local BIOS path | `base.js` `biosCdn` → `/static/library/bios/` (admin uploads) |
| Preload core JS/WASM + warm ROM cache | `webretro.html` `preloadPlayAssets()` |
| Defer cloud-save API | After `mainCompleted` + `requestIdleCallback` |
| Cache installed-cores allowlist | `GET /api/emulator/installed-cores.js` → `private, max-age=300` |

Manual **Sync cloud saves** still works immediately once the ROM is ready.

## Honesty rules

- Do **not** advertise browser Play if WASM is missing.
- Leaving deferred cores out is fine — companion / catalog modes stay accurate.
- Large DOS WASM still needs vendored cores on disk; `ENABLE_PCDOS_BROWSER` defaults **on** (see `.env.example`).

## Verify

```bash
curl -sS "$BASE/api/emulator/health" | jq '.deferred_cores, .installed_cores'
```
