# Themes & reset

Themes live on the **library volume** (`/app/gametheca/static/library/themes/...`), not only in the image. Source of truth for defaults: `gametheca/setup/default_theme/`. Preset generation uses **`GENERATOR_VERSION` 10** in `gametheca/utils/preset_themes.py` (Wave 2d — colour + icon + glass/CRT divergence).

## Default look

- Accent **`#2fd67b`** (green glass Style B+C).
- Glass tokens: `--gt-glass-bg`, `--gt-glass-border`, `--gt-glass-blur`.
- Admin → Themes is a dense `gt-adminpage` surface (active swatches · install/reset · **installed themes as a list**) — no separate “Back to Dashboard” stack; use the React top bar.
- Member SPA also needs built **`member-app.css`** in dist — theme reset does not replace a missing SPA bundle.

## When to Reset Default Themes

After any deploy that changes tokens, admin CSS, or preset fingerprints:

1. Free Unraid host disk if ~99% full — [unraid-deploy.md § Deploy gates](../runbooks/unraid-deploy.md#deploy-gates-operator-checklist)
2. `docker compose build --no-cache && docker compose up -d` (image must rebuild **`frontend/member-app` dist**)
3. Admin → Themes → **Reset Default Themes**
4. Hard-refresh the browser; confirm accent green, admin pages styled, and View Source includes **`member-app.css` / `member-app.js`**

Or delete `themes/default` (and stale presets) under the library volume and restart so boot sync can reinstall.

**Post-deploy pair (always both):** Reset Themes (volume CSS/JS) **and** a rebuild that includes member-app dist (SPA bundle). Skipping either leaves a half-applied Unraid pull.

**Two different things after an Unraid `git pull` + rebuild:**

| Asset | Where it lives | How it updates |
|---|---|---|
| Admin / library color theme CSS (`gt-*` tokens, swatch grid) | `gametheca/setup/default_theme/` → copied onto the **library volume** on boot | Needs **Reset Default Themes** (or delete `themes/default` + restart) — a plain rebuild alone does not overwrite already-installed volume copies |
| Scan management CSS/JS (`admin_manage_scanjobs.css` / `.js` + **W22-1** `admin_manage_libs.css` / `.js` — Libraries tab merge, multi-select sticky **Scan**/**Edit** → batch APIs, force-delete, unmatched Open path, table scale, **UID-005** per-entry top actions bar + Resolve equal-pill bar + sortable columns, **UID-016** Dupe glance + Unmatched side-by-side Compare (This folder \| Library game · path/size/date), **Scan Filters** how-it-works / quick-add / `dir:` kind UI, Wave 17 **Search name**/batch/Dupe-of, **Wave 18** scan job elapsed/ETA/stalled + status/library/path filters, **W20-2** Name transform trail `<details>`, **Layout** chips / `gt-toast-host`, **UI-W22-M7** Soft title / Utility kind labels on Unmatched / Dupe glance / mark-kind) | Same theme tree → **library volume** copies | Needs rebuild **and** **Reset Default Themes** (or hard-refresh alone is not enough if volume copies are stale) — without Reset, unmatched tab can look cramped / miss Open path chrome / miss top actions bar · Resolve pill bar · column sort / miss UID-016 side-by-side Compare / miss Scan Filters explain UI / miss Wave 18 timing+filter chrome / miss W20-2 transform trail expander / miss W22 Libraries tab + sticky Scan/Edit batch wire + force-delete / miss Soft title·Utility kind copy (still show “experience”/opaque labels) |
| Auth / account / identify / Edit Images aurora (`gt-setup` · `gt-account` · prefs modal · identify `gt-adminpage` · **Wave 19** `game_edit_images` aurora + chip underline/scale) | Theme tree CSS/templates → **library volume** copies | Needs rebuild **and** **Reset Default Themes** after aurora / Edit Images deploy — without Reset, login/account/identify/Edit Images can still show pre-aurora / legacy Jinja chrome |
| P1 densified-admin Jinja (`gt-adminpage` logs/status/whitelist/library-create/SMTP/integrations/users/… · `admin-pages.css` `gt-meter` · `admin-components.css` 1600px settings) | Theme tree CSS/templates → **library volume** copies | After P1 densify deploy: **Reset Default Themes** so `library/themes` picks up widened settings shells and aurora meters — otherwise operators still see the 1100px / hybrid glass chrome |
| Member SPA bundle (`member-app.css` / `.js` — FilterBar `gt-btn*` · **UID-009** `ScrollJump` · locale dates, CSS toasts, Acquire indexer labels · **UID-001** BadgeStack / GameCard layout JS) | Built into the **image/dist**, not the theme volume | Needs image rebuild that includes a fresh `frontend/member-app` dist — **Reset Themes alone does not refresh SPA JS/CSS** |
| Member chrome theme mirror (**UID-009** `gt-chrome.css` — ScrollJump glass top/bottom controls) | Theme tree CSS → **library volume** copies | Needs rebuild **and** **Reset Default Themes** after ScrollJump / chrome deploy — without Reset, jump controls can miss aurora glass tokens from stale volume CSS |
| Library tile badge chrome (**UID-001** — rounded-square `.gt-badge` / stacks / platform chip / hamburger · favorite · status in `css/components.css` + Signals filter chips in `games/library_filters.css`) | Theme tree → **library volume** copies | Needs rebuild **and** **Reset Default Themes** — without Reset, tiles can keep old pill/circle badge chrome or empty reserved corner slots from stale volume CSS |
| Admin SPA SoT re-exports (`stageECandidates.js` / `unmatchedTriage.js` used by Dupe glance / unmatched triage) | Theme tree JS is SoT; `Dockerfile` `frontend-build` **COPY**s those files into `/build/gametheca/...` before admin-app `npm run build` | Image rebuild picks up admin bundle + theme JS together — still **Reset Themes** for Jinja scanjobs volume copies of the same files |
| Browser Play room skins (`play-skins.css` / `play-skins.js` / `webretro.html`, atmosphere stack · bezel mat · aspect-lock vars) | `gametheca/static/vendor/webretro/` — served **directly from the image**, not copied to the library volume | Picks up on a normal `docker compose build --no-cache && docker compose up -d` — **no** Reset Default Themes needed, but the browser tab needs a hard-refresh (Ctrl+F5) to drop cached CSS/JS |
| Modal stacking helper (`js/gt_modal_stack.js`) + `modal-components.css` | Copied onto the **library volume** with the theme tree | Needs rebuild **and** Reset Default Themes (or rely on **inline** stacking CSS in `base_admin.html` / Libraries / Integrations, which works after rebuild alone) |
| Local vendor CDN scrub (`static/vendor/bootstrap/5.3.2/` + jquery/datatables/notify/cropper/sortable/chart under `/static/vendor/...`) on `base_admin` · member `base.html` · `base_empty.html` (login extends `base`) | Served from the **image/static**, not the theme volume | Picks up on rebuild/restart — **no** Reset Themes for vendor libs; still Reset Themes for theme-volume CSS/JS (e.g. `admin_manage_libs.js` typed-confirm delete modal) |
| Account / prefs chrome (`gt-account.css` · prefs modal · `modal-components`) | Theme tree → **library volume** | After Wave 2c densify: if account/prefs chrome still looks pre-sectioned or modal stacking lags, run **Reset Default Themes** (volume copies stale) — same gate as aurora scrub row above |
| Wave 2d presets + loading motifs (`GENERATOR_VERSION` **10** · paired `default_icon_pack` · `gt-loading-motifs.css` / `gt_loading_motifs.js`) | Theme tree tokens/CSS/JS → **library volume** | After Wave 2d ship: rebuild **and** **Reset Default Themes** — without Reset, presets stay accent-only (v9) and Auto Scan misses motif CSS |

If a fresh Unraid pull looks half-applied (new play-skins room art shows but admin still looks old, or vice versa), check which of the two you skipped.

## Apply a theme

- Members: preferences swatch grid (colour + paired icon pack on save).
- Admins: Manage Themes / Active Theme picker; `POST /admin/themes/apply` accepts `theme` plus optional `icon_pack`, persists both on the calling admin’s `UserPreference` (same fields Preferences uses — **no** GlobalSettings household icon-pack field).
- When `icon_pack` is omitted/null/empty, apply falls back to the theme’s `theme.json` `default_icon_pack` when present; otherwise leaves the existing preference pack unchanged (new rows still default to `outline`).
- Response: `{ success, theme, icon_pack }`.
- **Done (uncommitted):** admin apply persists `icon_pack` on the calling admin’s `UserPreference` (`routes_admin_ext/themes.py`). Ship smoke still recommended after Reset Themes.

Never edit `gametheca/static/library/themes/` in git — it is runtime output. Change `gametheca/setup/default_theme/` and bump generator version when output format changes.

## Icon packs (separate from color themes)

Icon / image packs live under `static/library/icon-themes/{id}/` and are installed from `gametheca/setup/icon_themes/` on boot. They restyle `.gt-icon` via `html[data-icon-pack]` and work with **any** color theme.

- **Reset Default Themes does not wipe icon packs.**
- Members pick a pack in Preferences → Icon pack (same modal as color swatches).
- Details: [icon-themes.md](../strategy/icon-themes.md) · [preferences-themes.md](../user/preferences-themes.md)

## Loading icons (admin)

Household spinner mode is **DB settings**, not theme volume files — Reset Themes does not change it. Motif CSS/JS **do** live on the theme volume (`gt-loading-motifs.css` / `gt_loading_motifs.js`) — Reset after Wave 2d so Auto Scan picks them up.

- Admin UI: **Admin → Themes → Loading icons** (rotate catalogue vs lock to one).
- Admin API: `PUT /api/admin/loading-icon/config` (`loading_icon_mode` = `rotate` \| `lock`, optional `loading_icon_id`).
- Public bootstrap: `GET /api/loading-icon`.
- Details: [icon-themes.md](../strategy/icon-themes.md) · [settings-modules.md](settings-modules.md#loading-icons-admin-lock--rotate).

Related: [preferences-themes.md](../user/preferences-themes.md) · [ui-wave0-tokens.md](../dev/ui-wave0-tokens.md) · [unraid-deploy.md](../runbooks/unraid-deploy.md#deploy-gates-operator-checklist)
