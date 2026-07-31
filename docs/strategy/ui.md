# UI Rebuild Plan — Sleeker GameTheca

**Date:** 2026-07-23 · **Updated:** 2026-07-29  
**Drivers:** Mixed Jinja + React islands, admin page sprawl, modern self-hosted library UX bar + 10-foot frontend patterns (Playnite fullscreen import/export integrations remain Class D).

## Current product chrome (Jul 29)

| Surface | State |
|---|---|
| Member SPA | Vite React app (`frontend/member-app`), **compressed top nav** (no left sidebar), glass Style **B+C** · Profile/account under TopNav · Friends More→dock (not `/social-companion` SPA takeover) · Library page sizes through **1000** |
| Accent | Default **`#2fd67b`** green (not teal); `GENERATOR_VERSION` **9** regenerates preset tokens |
| Systems hub | `/systems` — browse-by-console families + platform skins |
| Admin | **`base_admin.html`** + React top bar (`frontend/admin-app`); Themes page densified (`gt-themes-*` blocks); Settings hub cards tighter; **P1 densify wave (code):** logs · status · whitelist · library-create · SMTP/IGDB stubs · integrations Jinja body · users/downloads/invites/filters/extensions/image-queue/discovery/statistics/newsletter/attract/help/emoji/reference-sets — `gt-adminpage` / `--xl` · stripped redundant Back-to-Dashboard glass bars · `.settings-container` **1600px** (was 1100) · aurora `gt-meter` on server status |
| Auth / account Jinja | **P0 aurora scrub shipped (code)** — login · register · reset · confirm use **`gt-setup`** centered aurora shell (no legacy LHN). Profile / password / settings panel / invites use **`gt-account`** panels + `hide_lhn`. Preferences modal = **`gt-prefs-modal`**. Identify workbench = **`gt-adminpage`**. Member SPA leaks closed: FilterBar `gt-btn*` (no Bootstrap `btn-primary`), `formatLocaleDate`, CSS `showToast` (no jQuery `$.notify`) |
| Required asset | Built `member-app.css` (+ `member-app.js`) must ship in image/dist — SPA chrome is unstyled without it. After deploy: rebuild member-app dist **and** Admin → Themes → **Reset Themes** so library-volume copies pick up auth/account/identify **and P1 densified-admin** CSS (`admin-pages.css`, `admin-components.css`, `admin_server_status.css`, page CSS) |

**P0 done / P1 partial (pre-aurora densify):** P0 auth · account · identify · member SPA button/date/toast leaks closed. **P1 densify (this wave, code):** high-traffic admin Jinja onto `gt-adminpage` + 1600px settings cap. **P1 residual:** `new_server_info.html` / `new_server_settings.html` · `view_newsletter.html` · `admin_manage_themes_readme.html` · remaining nested Bootstrap cards on low-traffic pages. **CDN → local vendor (Waves 12–13):** Bootstrap on `base_admin` / member `base` / `base_empty` (`static/vendor/bootstrap/5.3.2/`); Wave 13 also scrubbed jquery/datatables/notify/cropper/sortable/chart → `/static/vendor/...` (rebuild/restart picks up vendor — not Reset Themes). **Wave 13:** admin-app `QualityProfilesPage` at `/admin/quality_profiles` (Jinja emptied to SPA shell). Optional retire of dead `game_details.html`.

Program board: Cursor canvas  
`C:\Users\cephyrix_zyth\.cursor\projects\c-Users-cephyrix-zyth-Desktop-gametheca\canvases\gametheca-program.canvas.tsx`

## Principles

1. **One design system** — tokens, type, spacing, components shared by web + future desktop client  
2. **Server remains source of truth** — UI is a client of OpenAPI  
3. **Progressive migration** — no big-bang rewrite; replace surfaces by traffic  
4. **Controller-first optional shell** — Big Picture mode without forcing desktop users into it  
5. **Admin ≠ user chrome** — ops density for admins; cinematic browse for members  
6. Stay on-brand (GameTheca **green** glass) but avoid AI-slop purple/glow/card spam

## Target information architecture

```
/app                  Member shell (React SPA — shipping)
  /discover           Shelves / discovery
  /library            Grid + filters + virtualized scroll
  /systems            Console/family hub (Style B+C)
  /game/:uuid         Details (path, freshness, versions, Download/Install/Update/Uninstall)
  /updates            Freshness inbox + requests
  /downloads          Queue + history (+ install status when client connected)
  /profile            Playtime, status, prefs, devices

/admin                Admin shell (Jinja today → React SPA)
  /overview           Ops glance (exists — expand)
  /libraries          Scan, depth, refresh, doctor
  /recognition        Unmatched, proposals, identify
  /users              Users, invites, whitelist, RBAC
  /integrations       IGDB, SMTP, OIDC, HLTB, community chat, providers
  /content            Themes, discovery, news, newsletter
  /system             Logs, settings, health, backups
```

Legacy Jinja member hubs retired; admin Jinja routes remain until SPA parity, then redirect.

## Visual system

| Token | Direction |
|---|---|
| Type | Distinct display + readable body (not Inter/Roboto defaults) |
| Color | Default accent **`#2fd67b`**; deep slate surfaces; glass (`--gt-glass-*`); theme presets remain |
| Layout | Full-bleed hero only on Discover/Attract; library is dense grid, not card farm |
| Motion | 2–3 purposeful transitions (shelf scroll, details cover, download progress) |
| Density | Member: airy; Admin: compact tables |

See [dev/ui-wave0-tokens.md](../dev/ui-wave0-tokens.md).

## Component inventory (build first)

- `AppShell` (top nav + More menu + command palette) — member top nav + Ctrl/Cmd+K palette shipped  
- `LibraryGrid` (evolve existing React app)  
- `SystemsHub` — shipped (`/systems`)  
- `FilterRail` / chip bar  
- `GameHero` + `PathBanner` (disk path always visible for admins)  
- **`BadgeStack`** — overlay badges on title/cover cards (see Badge system)  
- **`GameActionBar`** — Download · Install · Update · Uninstall (shared web + client)  
- `FreshnessBadge` / `HealthBadge` (fed into `BadgeStack`)  
- `DownloadQueue`  
- `ScanJobTimeline`  
- `IdentifyWorkbench` (multi-scanner)  
- `OpsStatStrip`  
- `BigPictureShell` (fullscreen)  
- **Admin `AppShell`** — React SPA (program Wave 3)

## Badge system (Netflix / Roku-inspired)

**Placement**
- Badges sit **on the cover/title card**, not in a separate metadata row by default  
- **Default anchor: bottom-left** of the artwork (Roku/Netflix “tile corner” pattern)  
- Prefer a single horizontal stack; max **2–3 visible** badges before collapsing to `+N`

**Collision / readability**
- Badges must not cover the **title text** or primary wordmark on the art  
- Layout algorithm (client-side):
  1. Place stack at bottom-left with padding from edges  
  2. If intersection with title/logo safe-zone (bottom ~28% center band or detected title region), **shift**: bottom-left → bottom-right → top-left → top-right  
  3. If still colliding, shrink to icon-only / single highest-priority badge  
- Prefer solid pill with slight scrim behind text (readable on light and dark covers); no glow spam

**Badge taxonomy (v1)**

| Badge | Signal | Priority |
|---|---|---|
| `NEW` | Newly imported into library (scan age &lt; N days) | High |
| `UPDATE` | Local update/extra newer than last install, or freshness OUT | High |
| `RELEASE` | New store/IGDB release window (calendar / first_release_date recent) | Medium |
| `OUT` / `~` | Freshness behind / heuristic | High |
| `OWNED` | Sandboxed store ownership match (later) | Medium |
| `VR` | Existing VR flag | Low |
| Status icons | Unplayed / beaten / etc. | Low (may sit outside stack) |

Admin can tune N-day windows and which badges show on library vs details.

## GameActionBar (Download + lifecycle)

Shared component used on **game details**, hover/focus on **library cards** (compact), and **desktop client**.

| Action | Web (no client) | With companion client |
|---|---|---|
| **Download** | Stream zip / file (existing) | Same + optional “download then install” |
| **Install** | Disabled / “Open in client” | Extract + register local install |
| **Update** | Link to updates/extras or freshness inbox | Apply newer package / re-extract |
| **Uninstall** | N/A on server files | Remove local install only (never delete server library by default) |

State machine per game/user: `not_downloaded` → `downloaded` → `installed` → `update_available` → (uninstall → downloaded or cleared).

## Migration waves

### Wave 0 — Foundations (2–3 weeks)
- Design tokens CSS + Storybook or simple gallery page  
- OpenAPI types → TS client  
- Shared `frontend/design-system` package  
- Command palette (Ctrl+K) for games + admin jumps — **nav jumps shipped** (member SPA `cmdk`); **Library route title search shipped** (Search library group via `/api/search`)  
- **`BadgeStack` prototype** on library-grid covers (static NEW/UPDATE fixtures)

### Wave 1 — Library & details (3–4 weeks) — largely shipped
- React library as default member browse; retire Jinja library hubs  
- Rebuild `game_details` as a full member SPA page under TopNav (Wave 5b)
- Surface folder path, versions, freshness, HLTB  
- **`GameActionBar`** with Download live; Install/Update/Uninstall gated until client  
- Wire real badge signals (new import, freshness, updates)
- **V1-UI-1 (partial):** `GameGrid` row virtualization via `@tanstack/react-virtual` (window scroll; keeps `--gt-tile-*` + pagination)

### Wave 2 — Member chrome (2–3 weeks) — largely shipped
- Discover + collections + trailers under one SPA shell  
- Top nav + Systems hub + green glass Style B+C  
- Downloads queue UX (pause/resume when client exists)  
- Preferences / theme picker (presets with swatches; `GENERATOR_VERSION` 9)  
- ~~Badge filter chips (“New”, “Updates”, “Releases”)~~ **Done** (O5)

### Wave 3 — Admin consolidation / React SPA (active program)
- New `frontend/admin-app` on `/admin/*`; progressive Jinja redirects  
- Collapse duplicate settings pages into Integrations + System  
- Library Tools + Scan + Unmatched → Recognition hub  
- Ops glance becomes home dashboard with health + scan + freshness widgets  
- Badge policy settings (windows, which badges enabled)

### Wave 4 — Big Picture & client skin (2–3 weeks)
- Fullscreen gamepad nav  
- Desktop client reuses web assets via Tauri webview  
- **Install/Update/Uninstall** fully client-backed

## Usability wins to ship early (independent of full rebuild)

1. Global search that returns games + admin entities  
2. Sticky download/scan progress toaster (WebSocket)  
3. ~~“Why unmatched?” explainer on each unmatched row~~ — **Done (Wave 5)** — one-liner from `why_unmatched` / `unmatched_reason` on Unmatched + Dupe glance · Backfill kind hints toolbar
4. Theme swatches in preferences (not names only)  
5. Batch actions on library selection (freshness, refresh images, favorite)  
6. Confirm destructive admin actions with typed game/library name  
7. Badge filter: show only New / Updates on library grid

## Anti-goals

- Do not rebuild Flask → Nest/Rust as part of UI work  
- Do not clone Steam purple neon aesthetic  
- Do not block P0 backend features on perfect pixels  
- Do not delete server library files from Uninstall (local install only)

## Success metrics

- Time-to-download from login &lt; 3 clicks for returning users  
- Install/Update/Uninstall discoverable on details without hunting menus  
- Badges readable on light and dark covers; &lt;5% title occlusion in spot checks  
- Admin scan start &lt; 2 clicks from Ops home  
- Lighthouse / a11y baseline on library + details  
- Zero dual-maintained CSS for the same component after Wave 3 SPA complete
