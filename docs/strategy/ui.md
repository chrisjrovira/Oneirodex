# UI Rebuild Plan — Sleeker GameTheca

**Date:** 2026-07-23  
**Drivers:** Mixed Jinja + React islands, admin page sprawl, peer UX bar set by GameVault/Drop/Playnite/LaunchBox Big Box.

## Principles

1. **One design system** — tokens, type, spacing, components shared by web + future desktop client  
2. **Server remains source of truth** — UI is a client of OpenAPI  
3. **Progressive migration** — no big-bang rewrite; replace surfaces by traffic  
4. **Controller-first optional shell** — Big Picture mode without forcing desktop users into it  
5. **Admin ≠ user chrome** — ops density for admins; cinematic browse for members  
6. Stay on-brand (GameTheca teal) but avoid AI-slop purple/glow/card spam

## Target information architecture

```
/app                  Member shell (React SPA or hybrid)
  /library            Grid + filters + virtualized scroll
  /discover           Shelves / collections / trailers
  /game/:uuid         Details (path, freshness, versions, Download/Install/Update/Uninstall)
  /updates            Freshness inbox + requests
  /downloads          Queue + history (+ install status when client connected)
  /profile            Playtime, status, prefs, devices

/admin                Admin shell (React)
  /overview           Ops glance (exists — expand)
  /libraries          Scan, depth, refresh, doctor
  /recognition        Unmatched, proposals, identify
  /users              Users, invites, whitelist, RBAC
  /integrations       IGDB, Discord, SMTP, OIDC, HLTB, providers
  /content            Themes, discovery, news, newsletter
  /system             Logs, settings, health, backups
```

Legacy Jinja routes remain as redirects during migration.

## Visual system

| Token | Direction |
|---|---|
| Type | Distinct display + readable body (not Inter/Roboto defaults) |
| Color | Existing GameTheca teal accent; deep slate surfaces; theme presets remain |
| Layout | Full-bleed hero only on Discover/Attract; library is dense grid, not card farm |
| Motion | 2–3 purposeful transitions (shelf scroll, details cover, download progress) |
| Density | Member: airy; Admin: compact tables |

## Component inventory (build first)

- `AppShell` (LHN + topbar + command palette)  
- `LibraryGrid` (evolve existing React app)  
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
- Command palette (Ctrl+K) for games + admin jumps  
- **`BadgeStack` prototype** on library-grid covers (static NEW/UPDATE fixtures)

### Wave 1 — Library & details (3–4 weeks)
- Finish React library as default; retire `library_browser.html`  
- Rebuild `game_details` as React island or full page  
- Surface folder path, versions, freshness, HLTB  
- **`GameActionBar`** with Download live; Install/Update/Uninstall gated until client  
- Wire real badge signals (new import, freshness, updates)

### Wave 2 — Member chrome (2–3 weeks)
- Discover + collections + trailers under one shell  
- Downloads queue UX (pause/resume when client exists)  
- Preferences / theme picker redesigned (show all 10 presets with swatches)  
- Badge filter chips (“New”, “Updates”, “Releases”)

### Wave 3 — Admin consolidation (4–5 weeks)
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
3. “Why unmatched?” explainer on each unmatched row  
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
- Zero dual-maintained CSS for the same component after Wave 3
