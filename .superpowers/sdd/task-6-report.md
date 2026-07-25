# Task 6 Report: SPA shell template + Flask route wiring

**Status:** DONE

**Changes:**
- Created `gametheca/templates/base_empty.html`: head assets (CSRF meta, theme CSS including `gt-tokens.css`, Bootstrap/jQuery), flash messages, content block only — **no `#sidebar`**, no `library_filters.html`. Zeroed `#content` left margin via `.member-spa-content`.
- Created `gametheca/templates/site/member_spa.html` extending `base_empty` with `#member-app-root` and shell `data-*` attrs mapped from `parseShellConfig` / old island roots:
  - Core: `tile-size`, `is-admin`, `show-trailers`, `show-help`, `enable-vr`, `locale`, `per-page`, `default-sort`, `default-sort-order`
  - Extra (library/favorites/TopNav): `show-play-status`, `username`, `library-count`, `games-count`, `enable-delete-on-disk`, `discord-*`, `current-filters`
  - Discover: `data-sections` when `discover_sections` is passed (embedded JSON from existing server build)
  - Module script: `dist/member-app/member-app.js`
- Wired browse routes (kept `@login_required`):
  - `discover()` → `site/member_spa.html` + embeds `discover_sections` (still built server-side)
  - `library()` → SPA shell; seeds filters/counts/prefs; games via `/api/browse` (no `get_games` page render)
  - `favorites()` → SPA shell
  - `downloads()` → SPA shell
- Admin routes unchanged; old Jinja browse templates left in tree but unused by these four views.

**Data-attribute mapping notes:**
- Old `discover-grid-root` `data-sections` / `data-is-admin` → shell root
- Old `library-grid-root` prefs/filters/counts/discord/delete flags → shell root
- Old `favorites-grid-root` admin + play-status → shell root
- Context flags (`show_trailers`, `show_help_button`, `enable_vr_browse`, `show_play_status`, etc.) come from existing blueprint/`get_global_settings` processors + app `enable_vr_browse`

**Tests:**
- `python -m py_compile` on the four route modules: passed
- Manual browser smoke not run in this environment

**SHA:** d06760fb8d8c8c52163137d04231783d01c0ae4e

**Commit:** feat: serve member SPA shell for browse routes