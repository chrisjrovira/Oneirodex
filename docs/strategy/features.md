# Feature Build Plans

**Date:** 2026-07-23 · **Updated:** 2026-07-29  
**Companion:** private competitive catalog in `docs/_private/` — see [external-facing-scrub.md](external-facing-scrub.md)  
Each plan is implementation-ready at the *decision* level (scope, files, risks, tests) — not pre-written code.

---

## Nice-to-have / post-1.0 (backlog — not 1.0 gates)

Plans only — **no implementation** until PM dispatches Backend/Ops. Shipped optional sidecars (TRAWL · LiveKit · ClamAV) stay the 1.0 path.

| ID | Feature | Guide | Phases | Notes |
|---|---|---|---|---|
| **NCS** | Native challenge / captcha solver | [native-challenge-solver.md](native-challenge-solver.md) | NCS-1…NCS-5 | Replace TRAWL as Compose `challenge` default; keep FlareSolverr-compat BYO. Separate from shipped **20c** / CH-1…5. |
| **RTC-N** | Native household RTC / SFU | [native-rtc.md](native-rtc.md) | RTC-N1…RTC-N5 | Mesh-first + thin SFU; LiveKit demote to BYO. |
| **MAL-N** | Native malware scan engine | [native-malware-scan.md](native-malware-scan.md) | MAL-N1…MAL-N5 | Heuristics tier-0 already shipped; ClamAV demote to BYO. |

**Priority:** backlog / sprint nice-to-have — human picks which epic to sprint.

---

## Program note — Thin client (post-1.0)

**Not a 1.0 gate.** Full feature guide: [thin-client.md](thin-client.md).

**Goal:** Connect-only client for seats that need library + social + browser play **without** download/install/launch.

**Default shape:** Tauri thin shell (or desktop **build flavor**) + member SPA webview; least-privilege ACL like Friends window; optional PWA later.

**Early-safe (optional before 1.0):** API token scopes + `device_kind=thin` + capabilities — no thin UI required.

---

## Program note — Challenge / captcha bypass (BYO)

**In 1.0 scope (CH-1…CH-5).** Guide: [challenge-bypass.md](challenge-bypass.md).

**Locked:** Compose profile **`challenge`**; `CHALLENGE_SOLVER_MAX_TIER` default **5** (admin may raise); opt-in flag still default off.

**Post-1.0 follow-on (not a 1.0 gate):** native GameTheca-owned solver — [native-challenge-solver.md](native-challenge-solver.md) (NCS-1…5). TRAWL remains the supported 1.0 path.

**Also see PM packet:** [pm-dispatch-2026-07-27.md](pm-dispatch-2026-07-27.md) (art studio · GOW · mods/servers · lighting).

---

## Program note — Wave 7 (Jul 26)

**Shipped bets (product language):**
- Acquire: native Torznab/Newznab registry (add one / bulk / optional admin presets) + BYO Prowlarr/Jackett + qBit + optional debrid — **no** torrent marketplace
- Store-hit → library bind + wanted queue (Sonarr-like “wanted”)
- WebRetro core registry + BIOS + cloud-save UI; RetroArch `.cht` toggles
- Wand-inspired single-player assist packs (`ENABLE_GAME_ASSISTS`) on companion + GameActionBar
- Big Picture fullscreen shell; React admin dashboard / settings / scans hubs

**Still out of scope:** torrent marketplace / magnet scrapers that bypass Torznab, DRM store download/install queues, multiplayer cheat injection.

---

## Program note — Systems hub + Admin SPA (Jul 26)

**Shipped:** Member SPA top nav; Style B+C green `#2fd67b`; **Systems** hub (`/systems`) with family marks + platform skins; `member-app.css` required in dist; `GENERATOR_VERSION` 9.

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

**Goal:** Collections, shelves, news, better filters — store-grade browse UX without abandoning React grid.

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

**Goal:** Drop-in metadata providers and post-download hooks (plugin framework).

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

**Goal:** Optional *arr-style acquisition*. Feature-flagged (`ENABLE_ARR_MODULE`).

**Work units**
- **Shipped (1B):** Native Torznab/Newznab registry in `arr_settings.indexers` (add one / JSON·CSV bulk / curated presets) + merge search with optional Prowlarr **and** Jackett hubs
- Connectors: qBittorrent, Transmission, SABnzbd, NZBGet
- Job: search → score → send to client → on-complete organize into library path
- Safety scorer (filename heuristics) — never claim malware certainty
- Admin UI: Indexers tab (UI seat)

**Legal/product note:** Frame as household automation for *owned* content; curated preset **display names** are admin-only (scrub carve-out). No secrets in the pack; README/Help stay free of scene marketing.  
**Risks:** abuse perception; keep module optional

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
**API + UI (Wave 4 closed — uncommitted · QA DoD met):**
- `GET /api/calendar?days_ahead=&days_behind=&limit=` — stable **200** + empty `releases` when IGDB off/empty; includes `generated_at`
- `GET /api/updates/inbox?limit=` — behind / heuristic-behind games; payload `generated_at` + `limit` for UI poll; does **not** re-check stores
- Freshness re-probe: `POST /api/games/<uuid>/freshness/check` · member multi-select `POST /api/games/batch/freshness/check` (max 50; API accepts `only_stale`; sticky Refresh **always re-probes** selection) · admin bulk `POST /api/admin/freshness/refresh` (`only_stale` default true)
- Favorite multi-select: `POST /api/games/batch/favorite` (`uuids` ≤100, `favorite` true|false) — ACL-scoped partial success · sticky **Select page** + partial-success toasts (Wave 10)
- Play-status multi-select (Wave 11): `POST /api/games/batch/status` (`uuids` ≤100, `status` unplayed|unfinished|beaten|completed|'' clear) — same semantics as `set_game_status` · sticky Play status control
- Wishlist multi-select (Wave 11): `POST /api/games/batch/wishlist` (`uuids` ≤50; title from `Game.name`; `can_request_games`; skip `already_pending`) — sticky **Add to wishlist** (canonical path, not `/api/requests/batch`)
- **UI:** Calendar densify (Ahead/Behind window · News-style list) · Updates auto-refresh (~50s while tab visible) + **Refresh** + calendar teaser · Library sticky wishlist + play status (Wave 11) — [faq.md](../user/faq.md#updates--calendar)
**Tests:** calendar empty-safe; inbox `generated_at`; admin refresh `only_stale` · member batch favorite/freshness/status/wishlist · UI vitest member calendar/updates + selection-bar slices

---

## P1-12 — Quality / release profiles

**Goal:** Preferred naming patterns, size limits, excluded groups (extends ReleaseGroup filters).

**Status (Waves 12–13):** **Shipped (code, uncommitted)** — multi-profile CRUD on `GlobalSettings.quality_profiles` · active profile scores *arr search (prefer/exclude; `excluded_by_quality`) · blocked/excluded terms merge into scan name-clean · `POST /api/games/batch/refresh_images` (≤20) · lean SQL path for `clear_restored_missing_path_status` · **Wave 13 UI:** admin-app `QualityProfilesPage` at `/admin/quality_profiles` (list · set active · new · delete · edit · score probe) · Jinja emptied to SPA shell · CDN scrub jquery/datatables/notify/cropper/sortable/chart → `/static/vendor/...`  
**Work units:** profile CRUD; apply during scan + *arr search; admin SPA  
**Tests:** exclude terms, prefer terms scoring · `tests/test_quality_profiles.py` (**4/4**) · `test_quality_profiles_list_spa_contract` · refresh_images unique `igdb_id` (**5/5**) · vitest QualityProfiles (**3/3**)

---

## P1-13 — Storage helpers

**Goal:** Hardlink/copy tools for multi-library NAS layouts (when mounts are RW).

**Note:** Docker `DATA_FOLDER_GAMES` is often RO — feature must detect RO and degrade gracefully.  
**Status (Wave 14a):** **Shipped (code, uncommitted)** — `GET /api/storage/status` (helpers/apply flags · `games_path` probes · `degrade_reason`) · RO honesty · preview reason “destination parent not writable (read-only mount?)” · `ALLOW_HARDLINK_APPLY` stays **off** · admin-app `StoragePage` at `/admin/storage` (banners · preview/apply · readable reasons · Jinja SPA shell)  
**Work units:** status API · preview/apply · admin SPA honesty  
**Tests:** `tests/test_storage_helpers.py` (**11/11**) · vitest StoragePage (**4/4**)

---

## P1-14 — Multi-version / multi-install entities

**Goal:** One Game, many installs/versions (repack/scene tags, GOG, Update packs) with selector on details + download honesty.

**Status (Wave 14b):** **Shipped (code, uncommitted)** — version list exposes `path_missing` / `downloadable` / measured `size` · base-only default (**no** full GameVersion schema) · `POST /api/games/<uuid>/versions/cleanup_orphans` (librarian+) · GameDetails **Default** chip · size · hide Download + “Missing on disk” when not downloadable · admin **Remove missing versions**  
**Work units:** version honesty fields · details selector UI · orphan cleanup API (full GameVersion schema deferred)  
**Tests:** `tests/test_wishlist_versions_artwork.py` (**7/7**) · vitest GameDetails+detailsMedia (**15/15**)

---

## P1-15 — Library health score

**Goal:** Library health scoring: missing cover, broken path, no IGDB, stale freshness.

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
| 20b | **Thin client** | Post-1.0 connect-only shell — [thin-client.md](thin-client.md); scopes + `device_kind`; no install pipeline |
| 20c | **Challenge / captcha bypass** | BYO TRAWL / FlareSolverr-compat + token APIs — [challenge-bypass.md](challenge-bypass.md); opt-in; wire acquire (**shipped 1.0 path**; native follow-on = NCS above) |

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
| 26 | Import bridges | Playnite importers |
| 26b | Store ownership sync | Per-user Epic/GOG/Amazon/Steam ownership lists → personal library marks/matches; **register only — never download/install from stores**; tokens encrypted at rest; admin can disable connectors |
| 27 | AI assist | Ollama-only default; never required |
| 28 | Custom layouts | Admin JSON layout for details |
| 28b | Icon packs | CSS packs orthogonal to color themes — [icon-themes.md](icon-themes.md) |
| 29 | i18n | Flask-Babel / react-i18next |
| 30 | WebSockets | Scan/download events; replace polling |

---

## Sequencing recommendation

```
Phase A (foundation): OpenAPI + tokens + WebSockets + UI design system + BadgeStack prototype
Phase B (parity):     Playtime + RBAC + Collections/News + Health + GameActionBar (Download live)
Phase C (clients):    Desktop companion + Install/Update/Uninstall + Big Picture
Phase D (auth):       OIDC
Phase E (automation): Wishlist → optional indexers (flagged) + challenge solver sidecar ([challenge-bypass.md](challenge-bypass.md))
Phase F (emu):        Profiles, archives, saves
Phase G (polish):     Providers, i18n, AI optional, imports, ownership badges + store ownership sync (register-only)
Phase H (post-1.0):   Thin client shell + PWA (after official 1.0.0) — [thin-client.md](thin-client.md)
Phase I (nice-to-have): Native challenge solver · native RTC · native malware scan — [native-challenge-solver.md](native-challenge-solver.md) · [native-rtc.md](native-rtc.md) · [native-malware-scan.md](native-malware-scan.md)
```

