# Themes & reset

Themes live on the **library volume** (`/app/gametheca/static/library/themes/...`), not only in the image. Source of truth for defaults: `gametheca/setup/default_theme/`. Preset generation uses **`GENERATOR_VERSION` 8** in `gametheca/utils/preset_themes.py`.

## Default look

- Accent **`#2fd67b`** (green glass Style B+C).
- Glass tokens: `--gt-glass-bg`, `--gt-glass-border`, `--gt-glass-blur`.
- Admin → Themes is a dense `gt-adminpage` surface (active swatches · install/reset · installed cards) — no separate “Back to Dashboard” stack; use the React top bar.
- Member SPA also needs built **`member-app.css`** in dist — theme reset does not replace a missing SPA bundle.

## When to Reset Default Themes

After any deploy that changes tokens, admin CSS, or preset fingerprints:

1. `docker compose build --no-cache && docker compose up -d`
2. Admin → Themes → **Reset Default Themes**
3. Hard-refresh the browser; confirm accent green and admin pages styled

Or delete `themes/default` (and stale presets) under the library volume and restart so boot sync can reinstall.

**Two different things after an Unraid `git pull` + rebuild:**

| Asset | Where it lives | How it updates |
|---|---|---|
| Admin / library color theme CSS (`gt-*` tokens, swatch grid) | `gametheca/setup/default_theme/` → copied onto the **library volume** on boot | Needs **Reset Default Themes** (or delete `themes/default` + restart) — a plain rebuild alone does not overwrite already-installed volume copies |
| Browser Play room skins (`play-skins.css` / `play-skins.js`, per-system bezel/wallpaper, aspect-lock vars) | `gametheca/static/vendor/webretro/` — served **directly from the image**, not copied to the library volume | Picks up on a normal `docker compose build --no-cache && docker compose up -d` — **no** Reset Default Themes needed, but the browser tab needs a hard-refresh (Ctrl+F5) to drop cached CSS/JS |

If a fresh Unraid pull looks half-applied (new play-skins room art shows but admin still looks old, or vice versa), check which of the two you skipped.

## Apply a theme

- Members: preferences swatch grid.
- Admins: Manage Themes / Active Theme picker; `POST /admin/themes/apply` supports apply flows.

Never edit `gametheca/static/library/themes/` in git — it is runtime output. Change `gametheca/setup/default_theme/` and bump generator version when output format changes.

## Icon packs (separate from color themes)

Icon / image packs live under `static/library/icon-themes/{id}/` and are installed from `gametheca/setup/icon_themes/` on boot. They restyle `.gt-icon` via `html[data-icon-pack]` and work with **any** color theme.

- **Reset Default Themes does not wipe icon packs.**
- Members pick a pack in Preferences → Icon pack (same modal as color swatches).
- Details: [icon-themes.md](../strategy/icon-themes.md) · [preferences-themes.md](../user/preferences-themes.md)

Related: [preferences-themes.md](../user/preferences-themes.md) · [ui-wave0-tokens.md](../dev/ui-wave0-tokens.md)
