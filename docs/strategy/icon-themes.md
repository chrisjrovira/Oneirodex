# Icon & image packs

**Date:** 2026-07-26 · **Status:** shipped (v1 CSS packs)  
**Orthogonal to:** color themes under `static/library/themes/`

## Idea

Color themes change `--gt-*` surfaces and accents. **Icon packs** change glyph weight/style only, via `html[data-icon-pack="…"] .gt-icon` CSS. Packs use `currentColor`, so they work with **any** color theme (aurora + pixel, ember + filled, etc.).

## Builtin packs

| Id | Style |
|---|---|
| `outline` | Default 2px stroke |
| `filled` | Solid fill, light stroke |
| `duotone` | Soft fill + stroke |
| `pixel` | Chunky square caps |
| `soft` | Thin stroke |
| `mono` | Heavy block fill |

Source: `gametheca/setup/icon_themes/{id}/` → installed to `static/library/icon-themes/{id}/` on boot (`install_icon_themes`).

Each pack: `manifest.json` + `pack.css` (+ optional `icons/`, `images/` for future glyph/image overrides).

## User preference

- DB: `UserPreference.icon_pack` (default `outline`)
- UI: Preferences modal — Icon pack chips next to Theme swatches
- Shell: `<html data-icon-pack="…">` + `<link id="gt-icon-pack-css">`
- API: `GET /api/icon-packs`

## Extending

1. Add folder under `setup/icon_themes/my-pack/` with `manifest.json` + `pack.css`.  
2. Prefer selectors like `html[data-icon-pack="my-pack"] .gt-icon { … }`.  
3. Optional later: per-key SVG files listed in `manifest.icons` for true alternate glyphs; resolver already reserved in `icon_themes.py`.

## Admin note

Reset Default Themes does **not** wipe icon packs. Icon packs are independent of theme ZIP uploads.
