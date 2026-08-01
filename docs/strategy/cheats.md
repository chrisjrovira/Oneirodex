# Cheats — Wave 3 stance (Game Master)

**Date:** 2026-07-30  
**Status:** Taxonomy lock for implementers  
**Audience:** Backend · UI · Desktop · Docs  
**Related:** [emulation-coverage.md](emulation-coverage.md) · [desktop-companion.md](../user/desktop-companion.md) · `gametheca/utils/emulator_cheats.py`

---

## Inventory (today)

| Layer | What exists |
|---|---|
| Storage | Per-game dir `EMULATOR_CHEATS_PATH/{game_uuid}/*.cht` only |
| API | `GET/POST/DELETE /api/games/{uuid}/cheats` (+ download by name) |
| Browse/details field | `cheat_surface`: `retroarch` \| `pc_wand` \| `none` (via `browse_play_fields`) |
| POST modes | Multipart `file` upload **or** JSON easy-create `{ name, codes[], dialect? }` → write `.cht` |
| Apply | WebRetro `gt-apply-cht` bridge · companion stages `.cht` before RetroArch |
| Create UX | Backend create API shipped · SPA Cheats panel gated on `cheat_surface === 'retroarch'` (Wave 19 UI Done) |
| Bundled packs | None · no per-platform library (admin pack upload deferred) |
| PC / native | `cheat_surface=pc_wand` — UI shows nothing until wand ships; no memory injection |

## `cheat_surface` derivation (Wave 19 GM lock)

| Condition | Value |
|---|---|
| Platform in `NATIVE_PC` = `{PCWIN, PCDOS, MAC, OTHER}` | `pc_wand` |
| Else if `platform_emulator_mapping` non-empty | `retroarch` |
| Else | `none` |

- Mutating `.cht` (POST create/upload, GET download, DELETE) returns **403** with `cheat_surface` when not `retroarch`.
- GET list returns `cheat_surface` and `cheats: []` when not `retroarch`.

---

## Taxonomy lock

1. **Canonical on-disk format for all emu systems:** RetroArch / libretro **`.cht`** (multi-code files OK).
2. **Input dialects (create form → serialize to `.cht`):** Raw / GG-style / AR-style / GS-style — **capability language only** (API keys stay `raw` / `game_genie` / `action_replay` / `gameshark`); no Class A product brands in UI or `.cht` desc prefixes.
3. **Scope key:** primary = **game UUID**; optional secondary = **library platform enum** for shared system packs (operator-uploaded zip of `.cht`, not scraped).
4. **PC / DRM-free native:** `cheat_surface=pc_wand` — UI reserved until wand ships; notes/BYO only — **no** in-process cheat injection; multiplayer injection stays out of scope ([features.md](features.md)).
5. **Authorship:** operator-authored + household upload. Optional “import pack” from files the operator already owns. **Never** scrape pirate cheat DBs / romhacking.net / torrent indexes.

---

## Easy-create acceptance (Backend + UI)

| # | Criterion |
|---|---|
| C1 | Game details: **New cheat** → name + one+ code rows + dialect hint → POST saves `.cht` (no raw file required) — **API Done**; SPA Cheats gated on `retroarch` (Wave 19 UI Done) |
| C2 | Still accept legacy `.cht` upload — Done |
| C3 | List / apply / delete unchanged for WebRetro + companion |
| C4 | Platform pack upload (admin): zip of `.cht` keyed by `PLATFORM_IDS` leaf — attach or copy to matching games later |
| C5 | Honesty: “Quick Menu may still be required”; companion path for heavy cores |

---

## Locked out

- Scrapes of third-party cheat databases  
- Class A / warez-adjacent brand names in copy or code  
- Shipping a commercial trainer / multiplayer cheat injector  
- Claiming “all systems auto-cheat” without core support

---

## Handoffs

- **@agent-backend:** `.cht` builder · `cheat_surface` on browse/details · refuse `.cht` when not `retroarch` · librarian+ disk paths  
- **@agent-uiux:** Hide RetroArch Cheats when `cheat_surface !== 'retroarch'`; treat `pc_wand` as reserved (no panel until wand ships)  
- **@agent-desktop:** Stage `.cht` only when `cheat_surface === 'retroarch'`  
- **@agent-docs:** User note under browser-play / companion · progress Wave 19 bullet
