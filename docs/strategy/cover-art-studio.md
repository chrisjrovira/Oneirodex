# Cover art studio — fallback art + admin art creator

**Date:** 2026-07-27  
**Status:** **ART-1…ART-3 shipped** (Jul 27) — ART-4 ops quota deferred  
**Audience:** UI/UX · Backend · Ops · Docs  
**Related:** `gametheca/utils/cover_url.py` · icon themes · Themes admin · [v1-readiness.md](v1-readiness.md) · [pm-dispatch-2026-07-27.md](pm-dispatch-2026-07-27.md)

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
- Optional Ollama later for “describe cover” — **not** required for 1.0  
- Store under `static/library/generated/` or per-game image dirs  

### Out of scope

- Member self-serve generator (admin/ops only)  
- Scraping third-party art marketplaces  
- Replacing SteamGridDB provider (complement)

---

## Waves

| ID | Outcome | Owner |
|---|---|---|
| ART-1 | Ship new default_cover / default_library assets + CSS-safe SVG fallback | UI/UX + Docs |
| ART-2 | Admin art creator API + size matrix export | Backend |
| ART-3 | Admin UI: preview, download zip, attach to game / set fallback pack | UI/UX |
| ART-4 | Ops: disk quota for generated art; purge orphan | Ops |

---

## DoD (1.0 bar)

- Missing cover never shows a broken image; branded fallback is recognizable as GameTheca  
- Admin can generate a full size set for one title in &lt;10s local  
- Vitest/pytest for URL resolution still green  

## Locked

- Admin/ops only  
- Local render first; no required paid image API  
