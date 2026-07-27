# GameTheca member SPA rebrand — design

**Date:** 2026-07-24  
**Status:** Design approved in chat; awaiting user review of this written spec before the implementation plan  
**Wave:** 1 (visual rebrand + member SPA). Wave 2 = admin/feature bugfixes on new chrome.

## Goal

Make GameTheca look and feel distinct from generic teal-glass media-library chrome (prior fork) by shipping a **React member SPA** with a **top navigation bar**, hybrid visual language (modern media library bones + arcade accents + subtle CRT texture), new background/fallback art, theme-tinted icons, and adjustable tile sizing. Admin remains Jinja in this wave.

## Decisions (locked)

| Topic | Choice |
|---|---|
| Priority | Rebrand first; fix remaining feature bugs on new chrome afterward |
| Visual lead | Modern media library bones; arcade accents; CRT only as subtle bg/focus |
| Nav | Single top bar + **More** overflow (no member left sidebar) |
| Primary links | Discover · Library · Downloads · Favorites · Admin |
| Tile sizing | Global preference + on-page control (same field) |
| Architecture | Member app SPA (React Router); Admin stays Jinja |
| Approach | Expand/replace library-grid islands into a routed member SPA served by Flask |

## Architecture

### Serving model

- Flask continues to own: login, setup, admin (Jinja), REST/JSON APIs, downloads of game files, static assets.
- Authenticated member browse URLs are served by a thin Jinja **SPA shell** that loads one Vite-built React bundle from `/static/dist/member-app/`.
- Unauthenticated access to member SPA routes redirects to `/login` (existing Flask-Login behavior).
- **Admin** top-bar link navigates to the existing Jinja admin dashboard (`site.admin_dashboard`). Admin Settings keeps its in-page section list only (not a second global LHN).

### Frontend package

- Evolve `frontend/library-grid` into `frontend/member-app` (rename allowed) with:
  - React 19 + Vite
  - React Router for client routes
  - Reuse existing library/favorites/discover grid logic where possible
- Build output: `gametheca/static/dist/member-app/` with `base` `/static/dist/member-app/`.
- Docker image build runs `npm ci && npm run build` for member-app so Unraid images include fresh assets.

### Auth / CSRF

- Same-origin session cookies (Flask-Login), as today.
- Shell includes CSRF meta; mutating `fetch` calls send `X-CSRFToken`.
- On 401: redirect to login. On CSRF failure: refresh token once and retry one time.

### APIs (wave 1)

| Need | Endpoint strategy |
|---|---|
| Library browse | Keep `GET /browse_games` until a dedicated `/api` list exists; wrap in a small client module |
| Favorites | `GET /api/favorites`, `POST /api/toggle_favorite/<uuid>` |
| Downloads UI | Existing download-request JSON endpoints already used by the site |
| Preferences | Extend settings endpoints to read/write `tile_size` (and existing theme/locale fields) |
| Filters | Existing `/api/get_libraries`, genres, platforms, etc. |

Bearer/`@gametheca/api-client` is optional later; wave 1 stays cookie+CSRF for the browser SPA.

## Visual language

### Tokens

Introduce a GameTheca token set used by SPA and theme CSS, including at least:

- `--gt-bg`, `--gt-surface`, `--gt-surface-2`
- `--gt-text`, `--gt-text-muted`
- `--gt-accent`, `--gt-accent-contrast`
- `--gt-border`, `--gt-focus-ring`
- `--gt-tile-min` (driven by tile size preference)
- Optional `--gt-crt-opacity` (default low; presets may vary slightly)

Presets (`aurora`, `ember`, `violet`, `forest`, `ocean`, `rose`, `mono`, `sunset`, `ice`, `default`) recolor accent and surfaces. Default must not clone generic teal-glass media-library chrome.

### Chrome

- Sticky top bar: GameTheca wordmark; primary links; **More**; account menu.
- **More** contains: Collections, News, Wishlist, Updates, Playtime, Release calendar, Ownership, Big Picture, VR (if `ENABLE_VR_BROWSE`), Trailers/Help when global settings allow.
- Mobile: hamburger drawer with the same items.
- Member SPA pages have **no left sidebar**.
- Typography: distinctive UI sans + more expressive display for section titles (not Inter/Roboto/Arial/system-ui as the brand face).
- Contrast: body text meets WCAG AA on surfaces; muted text only for metadata; reduce washed-out glass overlays.

### Art & icons

- Replace `/static/newstyle/gamecontroller.jpg` page background with new GameTheca art (abstract media-library + soft arcade geometry).
- Replace `/static/newstyle/default_cover.jpg` and `/static/newstyle/default_library.jpg` with matching fallbacks.
- Nav and chrome icons are inline SVG (or React icon components) using `currentColor` / `--gt-accent` so theme presets recolor them.

### Theme application fixes (required for rebrand to work in Docker)

- Resolve theme assets from the application root (not process CWD) so `theme_asset` does not falsely fall back to `default`.
- Ensure Docker volume / image path includes refreshed preset themes (build-time copy or documented reset).
- SPA shell receives `current_theme` from Flask and loads that theme’s CSS with default fallback.

## Tile sizing

- Add `UserPreference.tile_size` with values `S | M | L | XL`, default `M`.
- Map to CSS variables controlling grid `minmax` / cover width for Discover, Library, Favorites (and any other card grids in the SPA).
- Controls:
  1. Preferences modal (global)
  2. On-page control on Library (and Discover/Favorites) that writes the same preference and updates live without full reload

## Routes (wave 1 must be React)

| Path | Owner |
|---|---|
| `/discover` | React |
| `/library` | React |
| `/favorites` | React |
| `/downloads` (member download manager UI) | React |
| More targets not listed above | May remain Jinja initially; still framed by leaving SPA or loading full page — chrome is React only while on SPA routes |
| `/admin/*`, `/login`, `/setup/*` | Jinja |

Flask registers SPA shell for the React-owned paths (and a catch-all under those prefixes if needed for client-side routing). Deep links must work on refresh.

## Error handling

- Empty library / no favorites: intentional empty states with CTA, not a blank screen.
- API failure: inline error with retry.
- Never rely on a second global LHN for recovery navigation.

## Testing

- Vitest for tile-size mapping and nav primary/More membership helpers.
- Manual / smoke: login → Discover → Library → Favorites → Downloads; theme switch applies accent; tile slider persists after reload; Admin link reaches Jinja dashboard; mobile hamburger usable.
- Regression: CSRF POST favorite toggle still works from SPA.

## Explicitly out of wave 1 (wave 2)

- Fix `admin2.admin_dashboard` BuildError on Emulators / Arr / Quality / Layouts / AI / Storage pages.
- Scan depth save/UX improvements on library forms.
- Full admin visual restyle and remaining contrast passes on admin-only screens.
- Migrating all More destinations to React.
- Publishing Hub image / Authentik smoke / desktop signing (unrelated).

## Success criteria

1. Member browse no longer uses a left sidebar; top bar matches locked IA.
2. UI is visually distinct from prior fork chrome (tokens, art, icons, surfaces).
3. Theme presets visibly change accent/icons in Docker.
4. Tile size S–XL works from Preferences and on-page control and persists.
5. Discover, Library, Favorites, Downloads are React routes with working session auth.
6. Admin remains reachable and functional via Jinja.
