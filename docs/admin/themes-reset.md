# Themes & reset

Themes live on the **library volume** (`/app/gametheca/static/library/themes/...`), not only in the image. Source of truth for defaults: `gametheca/setup/default_theme/`. Preset generation uses **`GENERATOR_VERSION` 6** in `gametheca/utils/preset_themes.py`.

## Default look

- Accent **`#2fd67b`** (green glass Style B+C).
- Glass tokens: `--gt-glass-bg`, `--gt-glass-border`, `--gt-glass-blur`.
- Member SPA also needs built **`member-app.css`** in dist — theme reset does not replace a missing SPA bundle.

## When to Reset Default Themes

After any deploy that changes tokens, admin CSS, or preset fingerprints:

1. `docker compose build --no-cache && docker compose up -d`
2. Admin → Themes → **Reset Default Themes**
3. Hard-refresh the browser; confirm accent green and admin pages styled

Or delete `themes/default` (and stale presets) under the library volume and restart so boot sync can reinstall.

## Apply a theme

- Members: preferences swatch grid.
- Admins: Manage Themes / Active Theme picker; `POST /admin/themes/apply` supports apply flows.

Never edit `gametheca/static/library/themes/` in git — it is runtime output. Change `setup/default_theme/` and bump generator version when output format changes.

Related: [preferences-themes.md](../user/preferences-themes.md) · [ui-wave0-tokens.md](../dev/ui-wave0-tokens.md)
