# Feature Build Plans

**Date:** 2026-07-23 · **Updated:** 2026-07-26  
**Companion:** `docs/strategy/competitive.md`  
Each plan is implementation-ready at the *decision* level (scope, files, risks, tests) — not pre-written code.

---

## Program note — Wave 7 (Jul 26)

**Competitive:** ≥50-product catalog in `competitive.md` with steal/ignore for Wave 7.

**Shipped bets drawn from that map:**
- BYO acquire (Prowlarr/Jackett + qBit + optional Real-Debrid/AllDebrid) — not Hydra-style bundled indexers
- Store-hit → library bind + wanted queue (Sonarr-like “wanted”)
- WebRetro core registry + BIOS + cloud-save UI; RetroArch `.cht` toggles
- Wand-inspired single-player assist packs (`ENABLE_GAME_ASSISTS`) on companion + GameActionBar
- Big Picture fullscreen shell; React admin dashboard / settings / scans hubs

**Still out of scope:** pirate indexer hosting, Heroic DRM download queues, multiplayer cheat injection.

---

## Program note — Systems hub + Admin SPA (Jul 26)

**Shipped:** Member SPA top nav; Style B+C green `#2fd67b`; **Systems** hub (`/systems`) with family marks + platform skins; `member-app.css` required in dist; `GENERATOR_VERSION` 6.

**In progress:** Migrate `base_admin` Jinja (~38 pages) → React **`frontend/admin-app`** on `/admin/*` with progressive redirects. Program canvas:
`C:\Users\cephyrix_zyth\.cursor\projects\c-Users-cephyrix-zyth-Desktop-gametheca\canvases\gametheca-program.canvas.tsx`

Does not replace P0 items below; it is the UI execution track for admin parity.

---

## P0-1 — Companion desktop client

**Goal:** Native/Windows-first (then Linux/macOS) client that authenticates to GameTheca, browses library, downloads, extracts, optionally launches DRM-free games, syncs playtime.

**Approach options**
1. **Recommended:** Tauri + shared React library-grid components + OpenAPI client  
2. Electron (faster UI port, heavier)  
3. Web-only PWA install + File System Access API (limited launch)

**Work units**
- Auth: session cookie or OAuth device/API token  
- Download manager: resume, queue, checksums  
- Extract: zip/7z via native sidecar  
- **Install / Update / Uninstall** lifecycle (local install record; never wipe server library by default)  
- Launch: detect main exe / user override; never claim DRM store launch  
- Progress: heartbeat playtime to `/api/sessions`  
- Shared `GameActionBar` UI with web

**Likely touchpoints:** new `clients/desktop/`, `routes_apis/*` OpenAPI, models for `ClientDevice`, `PlaySession`, `UserGameInstall`

**Risks:** path safety, auto-update signing, antivirus false positives  
**Tests:** download resume, extract sandbox, install/uninstall idempotency, session heartbeat authz

---

## P0-1b — Title-card BadgeStack

**Goal:** Netflix/Roku-style overlay badges on library covers; readable; collision-aware.

**Work units**
- `BadgeStack` React component (default bottom-left; fallback corners)  
- Safe-zone heuristic so badges don’t cover title/wordmark  
- Signals: NEW import, UPDATE, RELEASE, freshness OUT/~, VR, OWNED (later)  
- Caps at 2–3 badges + `+N`; admin policy for day windows  
- Filter chips on library for badge types

**Likely touchpoints:** `frontend/library-grid/`, `frontend/design-system/`, browse JSON payload fields (`date_identified`, freshness, updates)

**Risks:** false “NEW” noise — tunable windows; persist dismissals optional  
**Tests:** placement fixtures (light/dark covers), priority ordering, payload fields present

---

## P0-2 — Playtime & session tracking

**Goal:** Replace status-only with real sessions (start/stop, duration, per-user aggregates, “friends activity”).

**Work units**
- Models: `PlaySession`, aggregates on `UserGameProgress`  
- APIs: start/heartbeat/stop; admin purge  
- UI: game details chart, user profile, library badges  
- Attract/ops: optional “now playing” strip

**Risks:** clock skew, ghost sessions — use TTL heartbeats  
**Tests:** concurrent sessions, orphan cleanup job

---

## P0-3 — RBAC & parental controls

**Goal:** Roles beyond admin/user; hide libraries/tags by age or group.

**Work units**
- Roles: `admin`, `librarian`, `member`, `child` (or custom)  
- Permissions table or CASL-like policy module  
- Library/tag ACL on browse + download endpoints  
- Admin UI for groups

**Risks:** leaking via search/API — enforce at query layer  
**Tests:** unauthorized library UUID, download denial

---

## P0-4 — OIDC / SSO

**Goal:** Login via Authentik/Authelia/Keycloak; keep local admin bootstrap.

**Work units**
- `authlib` / Flask-OIDC style flow  
- Map claims → user; JIT provision; role claim mapping  
- Settings under Integrations  
- Document reverse-proxy cookie notes (`SESSION_COOKIE_SECURE`)

**Risks:** CSRF/state, email uniqueness collisions  
**Tests:** login/logout, claim role mapping

---

## P0-5 — Store-grade browse UX

**Goal:** Collections, shelves, news, better filters — Drop/GameVault feel without abandoning React grid.

**Work units**
- `Collection` model (admin + user)  
- `Announcement` / news posts  
- Filter chips: platform, status, freshness, VR, year, size  
- Discover rewrite using same design system as UI rebuild

**Depends on:** UI rebuild foundations  
**Tests:** collection ACL, empty states

---

## P0-6 — OpenAPI + API tokens

**Goal:** Documented REST for clients/plugins; personal access tokens.

**Work units**
- Generate OpenAPI from Flask routes or hand-maintain `openapi.yaml`  
- API keys with scopes (`read:library`, `write:download`, `admin`)  
- Rate limits already partial — extend to tokens

**Tests:** token scope enforcement, OpenAPI snapshot CI

---

## P0-7 — Plugin framework

**Goal:** Drop-in metadata providers and post-download hooks (GameVault-like).

**Work units**
- Plugin manifest + sandbox (import path allowlist)  
- Hooks: `on_scan_candidate`, `on_metadata_enrich`, `on_download_complete`  
- Admin enable/disable UI  
- Ship 1–2 official plugins (SteamGridDB, PCGamingWiki)

**Risks:** security of arbitrary code — start with *config-only* provider plugins, not arbitrary Python until v2

---

## P0-8 — Client install pipeline

**Goal:** After download, extract + register local install record.

**Work units:** client-side primarily; server stores `InstallManifest` hints (exe relative path, args)  
**Tests:** path traversal blocked; install record sync

---

## P1-9 — Indexer / download-client module (optional)

**Goal:** Optional *arr-style acquisition* (Playerr/Gamarr inspiration). Feature-flagged; off by default.

**Work units**
- Connectors: Prowlarr, qBittorrent, Transmission, SABnzbd  
- Job: search → score → send to client → on-complete organize into library path  
- Safety scorer (filename heuristics) — never claim malware certainty  
- Admin UI: Indexers tab

**Legal/product note:** Frame as “bring your own indexers for *owned* content automation”; no bundled pirate sources.  
**Risks:** abuse perception; keep module optional and undocumented as “piracy helper”

---

## P1-10 — Wishlist / requests

**Goal:** Users request games; admins fulfill or reject; optional hook to indexer module.

**Models:** `GameRequest`  
**UI:** user wishlist + admin queue  
**Tests:** quota, duplicate requests

---

## P1-11 — Release calendar & update inbox

**Goal:** Unify freshness + calendar into an “Updates” hub.

**Work units**
- Inbox of OUT/~ games + IGDB/RAWG upcoming  
- Bulk actions already partially exist — promote to first-class page  
**Tests:** pagination, only_stale filters

---

## P1-12 — Quality / release profiles

**Goal:** Preferred naming patterns, size limits, excluded groups (extends ReleaseGroup filters).

**Work units:** profile CRUD; apply during scan + *arr search  
**Tests:** exclude terms, prefer terms scoring

---

## P1-13 — Storage helpers

**Goal:** Hardlink/copy tools for multi-library NAS layouts (when mounts are RW).

**Note:** Docker `DATA_FOLDER_WAREZ` is often RO — feature must detect RO and degrade gracefully.

---

## P1-14 — Multi-version / multi-install entities

**Goal:** One Game, many `GameVersion` (FitGirl, GOG, Update packs) with selector on details + download.

**Work units:** schema migration; UI selector; zip stream picks version  
**Tests:** default version, orphan cleanup

---

## P1-15 — Library health score

**Goal:** Bakabase-style health: missing cover, broken path, no IGDB, stale freshness.

**Work units:** scoring job + dashboard widget on Ops Glance  
**Tests:** deterministic scores

---

## P2 — Emulation depth

| ID | Feature | Plan sketch |
|---|---|---|
| 16 | Emulator profiles | Store JSON profiles; clients/WebRetro consume |
| 17 | Save sync | Encrypted blob store per user/game; size caps |
| 18 | Archive ROMs | Extract-on-serve or client-side; virus-scan hook optional |
| 19 | Big Picture mode | Fullscreen React shell; gamepad nav; Deck CSS |
| 20 | VR/Quest client | Separate optional app talking to same API (VRHub pattern) |

---

## P3 — Polish / social / metadata

| ID | Feature | Plan sketch |
|---|---|---|
| 21 | SteamGridDB / video art | Provider plugin + image types |
| 22 | GiantBomb / PCGW | Secondary enrichment providers |
| 23 | Collections | See P0-5 |
| 24 | Activity feed | Merge SystemEvents + announcements |
| 24b | Lite social | Friends/presence/profiles on Activity + playtime; BYO Stoat/Matrix for chat — see [social.md](social.md) |
| 25 | Stats cards | Canvas export PNG from playtime |
| 26 | Import bridges | Playnite/GameVault importers |
| 26b | Store ownership sync | Per-user Epic/GOG/Amazon/Steam ownership lists → personal library marks/matches; **register only — never download/install from stores**; tokens encrypted at rest; admin can disable connectors |
| 27 | AI assist | Ollama-only default; never required |
| 28 | Custom layouts | Admin JSON layout for details |
| 29 | i18n | Flask-Babel / react-i18next |
| 30 | WebSockets | Scan/download events; replace polling |

---

## Sequencing recommendation

```
Phase A (foundation): OpenAPI + tokens + WebSockets + UI design system + BadgeStack prototype
Phase B (parity):     Playtime + RBAC + Collections/News + Health + GameActionBar (Download live)
Phase C (clients):    Desktop companion + Install/Update/Uninstall + Big Picture
Phase D (auth):       OIDC
Phase E (automation): Wishlist → optional indexers (flagged)
Phase F (emu):        Profiles, archives, saves
Phase G (polish):     Providers, i18n, AI optional, imports, ownership badges + store ownership sync (register-only)
```

