# ROM auto-translate strategy

**Date:** 2026-07-27 · **Status:** Runtime AI hints shipped · Offline pipeline **stubbed**  
**Bar:** Prefer curated patches and RetroArch AI overlays. Do **not** scrape third-party patch DBs.

## Two lanes

| Lane | What | When |
|---|---|---|
| **A — Runtime overlay** | RetroArch AI Service (OCR + MT) | No fan patch; companion/native play |
| **B — Offline rebuild** | Dump scripts → MT → reinject ROM | Rare; per-system tooling; **stubs only** in GameTheca |

## Feasibility matrix

| System | Runtime AI (RetroArch) | Offline dump/rebuild | GameTheca status |
|---|---|---|---|
| NES / SNES / GB / GBC | Good on soft FB cores | Hard (pointer tables, fonts) | AI hint · offline unsupported |
| GBA | Good | Partial (external tools exist per-game) | AI hint · `gba_stub` |
| NDS / 3DS | Mixed | Hard | AI hint · unsupported |
| Genesis / PCE / PS1 | Mixed | Hard | AI hint · unsupported |
| N64 / GC / Wii / PS2 | Often HW buffer limits | Very hard | Document limitations |
| Browser WebRetro | **No** AI Service | N/A | Use companion or curated patch |

## Operator patch catalog (safe hooks)

- `ENABLE_PATCH_CATALOG` + `PATCH_CATALOG_PATH` → local YAML/JSON metadata
- Example: [`data/patch_catalog.example.json`](../../data/patch_catalog.example.json)
- Admin APIs: `/api/patch-catalog/*` — attach **guide URLs** only; place `.ips/.bps/.ups` under extras yourself
- `remote_stub` provider stays disabled forever in-tree (no romhacking.net scrape)

## Offline stubs API

`GET /api/rom-translate/capabilities` (admin) lists platforms as `unsupported` / `stub` / `external_tool`. Calling extract/translate/build raises `NotImplementedError` with a clear message — GameTheca will not mutate library ROMs in this pass.

### GBA {#gba}

External one-off tools (operator-owned) can dump/translate/build some GBA titles. GameTheca exposes a **stub** only so UI can say “not available — use AI overlay or curated patch.”

## Related

- [retroarch-ai-service.md](../runbooks/retroarch-ai-service.md)
- [translation-patches.md](../user/translation-patches.md)
- [emulation-coverage.md](emulation-coverage.md)
