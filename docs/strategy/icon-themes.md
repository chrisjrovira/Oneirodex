# Icon & image packs

**Date:** 2026-07-29 · **Status:** Wave 2d Done (uncommitted, QA PASS)  
**Orthogonal to:** color themes under `static/library/themes/`

## Idea

Color themes change `--gt-*` surfaces and accents. **Icon packs** change glyph weight/style only, via `html[data-icon-pack="…"] .gt-icon` CSS. Packs use `currentColor` + theme `--gt-icon-*` tokens, so they work with **any** color theme (aurora + pixel, ember + filled, etc.).

## Builtin packs

| Id | Style |
|---|---|
| `outline` | Default stroke (theme `--gt-icon-stroke` may refine) |
| `filled` | Solid fill, light stroke |
| `duotone` | Soft fill + stroke |
| `pixel` | Chunky square caps |
| `soft` | Thin stroke |
| `mono` | Heavy block fill |

Source: `gametheca/setup/icon_themes/{id}/` → installed to `static/library/icon-themes/{id}/` on boot (`install_icon_themes`).

Each pack: `manifest.json` + `pack.css` (+ optional `icons/`, `images/` for future glyph/image overrides).

## Wave 2d — preset colour + icon pairing

Presets (`GENERATOR_VERSION` **10**) are no longer accent-only. Each pack owns glass, CRT, typography, text tint, secondary accent, and `--gt-icon-*` geometry, plus a **paired default icon pack** in `theme.json` (`default_icon_pack`). Preferences auto-selects the paired pack when you pick a colour swatch (still overridable before save).

### Before → after token deltas (summary)

| Preset | Before (effectively) | After (signature) | Paired icon pack |
|---|---|---|---|
| `aurora` | cyan accent + dark cyan surfaces | cyan text tint · CRT 0.09 · square stroke 2.75 · mono display | `pixel` |
| `ember` | magenta accent | pink text · filled icons · blur 14px | `filled` |
| `violet` | violet accent | soft glass blur 18px · thin stroke 1.35 | `soft` |
| `forest` | green accent | phosphor text · low glass blur 6px · butt caps | `outline` |
| `ocean` | blue accent | duotone fill 0.22 · blur 14px | `duotone` |
| `rose` | rose accent | Georgia display · soft stroke | `soft` |
| `mono` | slate accent | heavy fill icons · minimal CRT | `mono` |
| `sunset` | gold accent | warm CRT 0.08 · filled gold chrome | `filled` |
| `ice` | sky accent | high blur 20px · thin soft stroke | `soft` |

Default theme still ships green `#2fd67b` + outline icons.

**Ops:** after deploy, rebuild + **Admin → Themes → Reset Default Themes** so library volume copies rebuild managed `gt-tokens.css` / `theme.json` / loading-motif assets.

## Loading icon catalogue

Animated system motifs (stylized, not trademark logos) for Auto Scan + SPA `PageStatus`:

| Id | Motif |
|---|---|
| `ring` | Spinning ring |
| `orbit` | Disc + satellites |
| `pulse` | Concentric breathe |
| `blocks` | 8-bit block cascade |
| `scan` | CRT horizontal sweep |
| `arcade` | Coin-slot bounce |

- Public: `GET /api/loading-icon` (`loading_icon_mode` = `rotate`|`lock`, `resolved_id`, `catalogue`)
- Admin: Themes page → Loading icons · `PUT /api/admin/loading-icon/config`
- Theme CSS/JS: `css/gt-loading-motifs.css`, `js/gt_loading_motifs.js`
- Member SPA: `LoadingMotif.jsx` + `PageStatus`

Rotate = random motif per browser session; lock = one id for everyone.

## User preference

- DB: `UserPreference.icon_pack` (default `outline`) — per-user; no GlobalSettings household icon-pack field
- UI: Preferences modal — Icon pack chips next to Theme swatches
- Apply: **Preferences only** — the one place a theme and pack are chosen, for admins too. `POST /admin/themes/apply` and the admin swatch grid were **retired 2026-08-16** as a duplicate write to the same `UserPreference` fields; see [themes-reset.md § Apply a theme](../admin/themes-reset.md#apply-a-theme). Pack fallback is unchanged: omitted/`null` → `theme.json` `default_icon_pack` when set.
- Shell: `<html data-icon-pack="…">` + `<link id="gt-icon-pack-css">`
- API: `GET /api/icon-packs`

## Extending

1. Add folder under `setup/icon_themes/my-pack/` with `manifest.json` + `pack.css`.  
2. Prefer selectors like `html[data-icon-pack="my-pack"] .gt-icon { … }` reading `var(--gt-icon-stroke, …)`.  
3. Optional later: per-key SVG files listed in `manifest.icons` for true alternate glyphs; resolver already reserved in `icon_themes.py`.

## Admin note

Reset Default Themes does **not** wipe icon packs. Icon packs are independent of theme ZIP uploads. Reset **does** rebuild colour presets (tokens + `default_icon_pack`).
