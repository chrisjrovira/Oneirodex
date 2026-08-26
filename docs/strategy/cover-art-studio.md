# Cover art studio — fallback art + admin art creator

**Date:** 2026-07-27  
**Status:** **ART-1…ART-3 shipped** (Jul 27) · **ART-5 shipped** · **ART-6 backend shipped** (stock/platform catalog + generate + library/fallback apply; UI picker parallel) — ART-4 ops quota deferred  
**Audience:** UI/UX · Backend · Ops · Docs  
**Related:** `gametheca/utils/cover_url.py` · `gametheca/utils/cover_art_stock.py` · icon themes · Themes admin · [v1-readiness.md](v1-readiness.md) · [pm-dispatch-2026-07-27.md](archive/pm-dispatch-2026-07-27.md)

---

## Locked (Jul 27)

| Decision | Stance |
|---|---|
| 1.0 bar | **ART-1 + ART-2 + ART-3** all required |
| GOW / LIGHT | **1.0** (separate streams — not Art studio) |

## Problem

Titles without downloaded cover/fanart fall back to a single static `default_cover.jpg` / `default_library.jpg`. That asset is weak for:

- Library grid tiles (multiple densities / tile-size slider)
- Big Picture / Systems / details hero
- Social share cards / notifications
- Desktop companion list thumbnails

Operators also cannot generate on-brand placeholders (title text, system accent, theme colors) without external tools.

---

## Product definition

**Cover art studio** (Admin / Ops only):

1. **Better baked fallbacks** — high-quality GameTheca-branded default cover + library hero (SVG → raster sizes).  
2. **Procedural / template art creator** — admin uploads or types title + optional system → generates PNG/WebP at **all sizes UI needs**.  
3. **Apply path** — bind generated art to a game UUID or set as library-wide fallback pack.

### Size matrix (minimum)

| Outlet | Aspect | Example sizes |
|---|---|---|
| Library tile | 2:3 portrait | 200×300, 400×600, 600×900 |
| Wide row / BP | 16:9 | 480×270, 960×540, 1920×1080 |
| Square / icon | 1:1 | 128, 256, 512 |
| Details hero blur | 16:9 crop | 1280×720 |

### In scope

- Admin SPA/Jinja page under Themes or new **Art studio**  
- Server-side render (Pillow / cairo / SVG templates) — no paid cloud AI required  
- **Per-system template packs** — distinct palette + glyph + stronger title typography (≥14px on 200×300 tiles) keyed by LibraryPlatform / system string  
- Optional Ollama later for “describe cover” — **not** required for 1.0  
- Store under `static/library/generated/` or per-game image dirs  
- Batch generate for missing-cover slice: `POST /admin/api/art-studio/batch-generate`  

### Not in this slice

*Scope note: these are **not in this slice**, not refused. Reasoning and
reopen conditions live in the private working doc.*

- Member self-serve generator (admin/ops only)  
- Scraping third-party art marketplaces / official console brand PNGs  
- Replacing SteamGridDB provider (complement)

---

## Stock + platform packs (ART-6)

Operators pick from a catalog instead of only the single dull `default_library.jpg`:

| Kind | Pack id examples | Storage |
|---|---|---|
| `era` | `era-80s-den`, `era-90s-bedroom`, `era-arcade-floor` | `static/library/stock/{id}/` |
| `platform` | `platform-nes`, `platform-psx`, `platform-pcwin` | `static/library/stock/{id}/` |
| `stock` | `stock-controller`, `stock-crt-grid`, `stock-neon-court` | same |

- **Catalog:** `GET /admin/api/art-studio/stock` → `{ items: [{ id, label, kind, platform?, pack_id, path, urls: { tile, wide, hero }, generated }], count }`
- **Generate:** `POST /admin/api/art-studio/stock/generate` body `{ ids?: string[] }` — idempotent Pillow write of the size matrix
- **Apply library:** `POST /admin/api/art-studio/apply` `{ pack_id, mode: "library", library_uuid }` → sets `Library.image_url` to the pack wide/hero static URL
- **Apply fallback:** existing `{ pack_id, mode: "fallback" }` also resolves packs under `library/stock/`
- Original geometry only (controller silhouette, cartridge, disc ring, CRT grid, neon court, decade-room scenery) — no scraped box art. Platform packs also paint the play-room for that hardware. Untitled library tiles cache a per-theme placeholder (`covers/{title_hash}_{theme_slug}.jpg`) so backup art follows the member's decade room.

### Frontend handoff (exact)

```http
GET /admin/api/art-studio/stock
→ 200 { "items": [ { "id": "platform-nes", "label": "NES", "kind": "platform", "platform": "nes", "pack_id": "platform-nes", "path": "library/stock/platform-nes", "urls": { "tile": "/static/library/stock/platform-nes/tile_400x600.webp", "wide": "…/wide_960x540.webp", "hero": "…/hero_1280x720.webp" }, "generated": true } ], "count": 34 }

POST /admin/api/art-studio/stock/generate
{ "ids": ["stock-controller", "platform-nes"] }   // omit ids = all
→ 201 { "generated": [ { "pack_id", "title", "kind", "files": [...] } ], "count": 2 }

POST /admin/api/art-studio/apply
{ "pack_id": "stock-neon-court", "mode": "library", "library_uuid": "<uuid>" }
→ 200 { "mode": "library", "library_uuid", "pack_id", "image_url", "filename" }

POST /admin/api/art-studio/apply
{ "pack_id": "platform-nes", "mode": "fallback" }
→ 200 { "mode": "fallback", "pack_id", "paths": { "default_cover", "default_library" } }
```

UI: stock picker grid → Generate if `generated: false` → Apply to library (create/edit) or Set as fallback.

## Waves

| ID | Outcome | Owner |
|---|---|---|
| ART-1 | Ship new default_cover / default_library assets + CSS-safe SVG fallback | UI/UX + Docs |
| ART-2 | Admin art creator API + size matrix export | Backend |
| ART-3 | Admin UI: preview, download zip, attach to game / set fallback pack | UI/UX |
| ART-5 | Per-system template packs + readable tile typography · ArtStudioPage system previews | UI/UX + Backend |
| ART-6 | Stock / platform catalog API + Pillow packs under `library/stock/` · apply library/fallback · UI `#stock` picker | Backend shipped · UI/UX parallel |
| ART-4 | Ops: disk quota for generated art; purge orphan | Ops |

---

## DoD (1.0 bar)

- Missing cover never shows a broken image; branded fallback is recognizable as GameTheca  
- Admin can generate a full size set for one title in &lt;10s local  
- Idle title scale is **1.3×** (floor 0.85×); headline/subtitle/`title_scale` always post from the studio UI  
- Vitest/pytest for URL resolution still green  

## Locked

- Admin/ops only  
- Local render first; no required paid image API  
