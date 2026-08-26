# Icon & image packs

**Date:** 2026-07-29 · **Status:** Wave 2d Done (uncommitted, QA PASS)  
**Orthogonal to:** color themes under `static/library/themes/`

## Idea

Color themes change `--gt-*` surfaces and accents. **Icon packs** change glyph weight/style only, via `html[data-icon-pack="…"] .gt-icon` CSS. Packs use `currentColor` + theme `--gt-icon-*` tokens, so they work with **any** color theme (aurora + pixel, ember + filled, etc.).

### The one thing `--gt-icon-*` may not do: erase a glyph

`--gt-icon-fill` / `--gt-icon-fill-opacity` are set on `.gt-icon` — the `<svg>` —
so they inherit into every sub-path. The five outline presets (aurora, violet,
forest, rose, ice) set fill-opacity to `0`.

A sub-path authored `fill="currentColor" stroke="none"` — 23 of the rail glyphs
have one, and Favorites is *entirely* one — carries a `fill` presentation
attribute that outranks the inherited `fill: none`, but no `fill-opacity`
attribute at all. So it kept its colour, inherited alpha `0`, and had no stroke
to fall back on. Solid glyphs rendered as nothing on five of the nine presets.

`gt-primitives.css` re-asserts fill on any sub-path that explicitly opts in:

```css
.gt-icon [fill='currentColor'] { fill: currentColor; fill-opacity: 1; }
```

Writing `fill="currentColor"` on a sub-path is a statement that the piece is
solid, and a colour preset does not get to overrule it. A declaration *on* the
element outranks a value inherited from its parent, whatever the specificity —
which is why the selector has to target the sub-path and not the svg. The
reverse case needs no rule: `fill="none"` survives the filled packs for exactly
the same reason. Guarded by `frontend/member-app/src/chrome/iconVisibility.test.js`.

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

Presets (`GENERATOR_VERSION` **17**) own glass, CRT, typography, text tint, secondary accent, `--gt-icon-*` geometry, radius / space / type / shadow per pack (UID-006), **and** an era room (`--gt-era` / `html[data-era]`) so chrome is wallpaper rather than a colour slab. Paired default icon pack still lives in `theme.json` (`default_icon_pack`). Preferences auto-selects the paired pack when you pick a room card (still overridable before save). **Reset Default Themes** after a generator bump.

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
