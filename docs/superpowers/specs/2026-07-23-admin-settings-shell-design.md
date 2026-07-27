# Admin Settings Shell (`/admin/settings`) — Design

**Date:** 2026-07-23
**Status:** Approved for planning (Track 5)
**Product sequence (locked):** 1 pagination ✓ → 2 ops glance ✓ → 3 rename ✓ → 4 find/add ✓ → **5 settings (this spec)**

## Problem

Admin settings are spread across four independent pages (Server Settings, Attract
Mode, Integrations, Themes), each reachable only from its own dashboard button.
There is no single "Settings" landing page, no shared nav chrome between the
sections, and no way to deep-link into a specific section from outside the
dashboard. Three older single-purpose pages (SMTP, IGDB, Discord "manage"
pages) also still exist as parallel, un-navigated entry points now that
Integrations consolidates all three into tabs.

## Goals

- One `/admin/settings` landing page ("shell") that groups the four settings
  areas with consistent nav chrome.
- Left nav + cards for Server Settings, Attract Mode, Integrations, Themes.
- `?section=server|attract|integrations|themes` deep-links and highlights the
  matching nav item / detail card.
- Dashboard buttons for these four areas route through the shell instead of
  jumping straight to the individual pages.
- Soft-deprecate the orphaned standalone SMTP/IGDB/Discord pages by pointing
  users at the Integrations hub, without breaking their still-active
  save/test POST endpoints.
- Zero changes to the underlying settings forms/logic (`new_server_settings`,
  `attract_mode_settings_page`, `integrations`, `manage_themes` keep their own
  routes, templates, and behavior) — this is a navigation shell, not a form
  rewrite.
- Leave the user-facing `settings_panel` (personal user settings) completely
  untouched — this track is admin-only.

## Non-goals (v1)

- Rewriting or merging the Server Settings / Attract Mode / Integrations /
  Themes forms into a single page.
- iframing the existing pages inside the shell (rejected as unreliable: mixed
  CSRF/session context, broken deep-linking, awkward height sizing).
- Hard-redirecting the standalone SMTP/IGDB/Discord GET pages to
  `/admin/integrations` — their GET responses are covered by existing tests
  and (more importantly) their POST endpoints are the live save/test backends
  used by the Integrations tabs' JS/forms; only a non-breaking banner is
  added.
- Any change to `GlobalSettings` model fields or the settings JSON schema.

## Decisions locked

| Topic | Choice |
|-------|--------|
| Route | Reuse existing `GET/POST /admin/settings` (`admin2.settings`); GET now renders the shell instead of redirecting to Server Settings; POST behavior (settings save, used by `admin_manage_server_settings.js`) is unchanged |
| Embedding strategy | Hub page with left nav + 4 cards, each deep-linking to the real existing page (no iframe, no template `{% include %}` merge) |
| Section param | `?section=server\|attract\|integrations\|themes`; invalid/missing falls back to `server` |
| Section metadata | Single `SETTINGS_SHELL_SECTIONS` dict in `routes_admin_ext/settings.py` (label, icon, description, endpoint) — one source of truth for nav + cards |
| Dashboard buttons | Server Settings / Attract Mode / Integrations / Themes buttons on `admin_dashboard.html` now link to `/admin/settings?section=...` |
| Standalone SMTP/IGDB/Discord pages | Kept fully functional (GET renders, POST saves/tests unchanged); each template gets a one-line "This page has moved… Integrations hub" banner |
| User settings | `settings_panel` and any user-facing settings routes/templates are not touched |

## Architecture

```
Admin Dashboard ──link──► GET /admin/settings?section=X (Jinja shell)
                              │
                              ├── Left nav (4 items, highlights active section)
                              ├── Active-section detail card ── "Open <label>" ──► real page
                              └── 4 cards grid ── click ──► real page
                                       │
                                       ├── GET /admin/new_server_settings
                                       ├── GET /admin/attract_mode_settings
                                       ├── GET /admin/integrations
                                       └── GET /admin/themes
```

### Backend

- `gametheca/routes_admin_ext/settings.py`
  - New module-level `SETTINGS_SHELL_SECTIONS` dict (ordered: server, attract,
    integrations, themes) and `DEFAULT_SETTINGS_SHELL_SECTION = 'server'`.
  - `settings()` view: GET now validates `?section=` against the dict (falls
    back to default on missing/invalid) and renders
    `admin/admin_settings_shell.html` with `sections` + `active_section`.
    POST is unchanged (`update_settings()`).
- No changes to `new_server_settings()`, `attract_mode_settings_page()`,
  `integrations()`, or `manage_themes()` — they keep their existing routes.

### Frontend

- New template: `gametheca/templates/admin/admin_settings_shell.html`
  - Left nav (`<nav>` + `<ul>`) built from `sections.items()`; each link is
    `url_for('admin2.settings', section=key)`.
  - Active-section detail card with a primary "Open <label>" button that
    deep-links via `url_for(section.endpoint)`.
  - Card grid (all 4 sections) below/beside, each card also deep-links via
    `url_for(section.endpoint)`.
- New stylesheet: `gametheca/setup/default_theme/css/admin/admin_settings_shell.css`
  reusing existing admin glass-panel CSS variables (`--container-glass-*`,
  `--border-light`, `--primary-brand-*`, `--spacing-*`, `--border-radius-*`).
- `admin_dashboard.html`: Server Settings / Attract Mode / Integrations /
  Themes buttons updated to `url_for('admin2.settings', section='...')`.
- Soft-deprecation banners (`alert alert-info`) added to
  `admin_manage_smtp_settings.html`, `admin_manage_igdb_settings.html`,
  `admin_manage_discord_settings.html`, linking to `admin2.integrations`.
  These templates keep all existing markup/behavior; the banner is additive.

## Testing

- Unit/route: `tests/test_routes_admin_ext_settings_shell.py`
  - Section config shape (4 sections, ordered, default `server`, endpoints
    resolve via `url_for`).
  - `GET /admin/settings` auth guards (login/admin required).
  - Default section renders all 4 labels; `?section=attract` highlights
    Attract Mode; invalid `?section=` falls back to `server`.
  - Cards deep-link to the real admin URLs.
  - `POST /admin/settings` still saves settings (regression guard for the
    unchanged save path).
- Existing suites intentionally left green without modification:
  `test_routes_smtp.py`, `test_routes_admin_ext_igdb.py`,
  `test_routes_admin_ext_discord.py`, `test_routes_admin_ext_settings.py`
  (no route/behavior changes to the paths they assert on beyond the new
  banner markup).
- Environment note: this sandbox has no reachable Postgres
  (`TEST_DATABASE_URL`/`DATABASE_URL` at `localhost:5432`) and Docker Desktop
  is not running, so `python -m pytest` hangs on DB-backed fixtures rather
  than failing fast — same limitation recorded by the Track 2 (ops glance)
  and Track 1 (filters hardening) work. Verified instead via: Python `ast`
  syntax parse of the modified route module, and Jinja2 `Environment.parse`
  syntax checks of every modified/created template. Full pytest run should
  be re-run in an environment with Postgres reachable before merge.

## Delivery notes

- No new dependencies, no DB migration, no Docker/Dockerfile changes needed.
- `*.md` is gitignored — use `git add -f` for this spec and its plan.
- Commit author via env (`GIT_AUTHOR_NAME`/`GIT_AUTHOR_EMAIL` = axewater /
  wateraxe@gmail.com) since local git config has no identity set.

## Open follow-ups (out of v1)

- Consider hard-redirecting the standalone SMTP/IGDB/Discord GET pages once
  their POST save/test endpoints are refactored to live under
  `/admin/integrations/...` (mirroring the IGDB save/test endpoints already
  added under `/admin/integrations/igdb/*`).
- Consider an in-shell tabbed/iframe experience once CSRF/session concerns
  across embedded pages are resolved.
