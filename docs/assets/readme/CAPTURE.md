# Capture checklist (README / docs media)

Live pixels from local Playwright capture (`scripts/capture_docs_media.py`). Prefer **1920×1080**; dark default theme. Finals live under `docs/media/screenshots/`; README slots under `docs/assets/readme/` must stay in sync.

## README required (live only)

| Shot | README slot | `docs/media/` source | Status |
|---|---|---|---|
| **Hero strip** | `hero-banner.png` | `/library` (same session) | Captured |
| **Library + free ROMs** | `screenshot-library.png` | `library-free-roms.png` | Captured |
| **Systems** | `screenshot-systems.png` | `systems-platforms.png` | Captured |
| **Chat / Activity / Friends** | `screenshot-chat.png` | `/chat` (`chat-channels.png` in media) | **Needed on ship** — Wave 2b–3 slide-out · Archive/Leave · Wave 4 Leave → muted badge; re-capture when `/login`+`/library` return 200 |

Retired: `hero-banner.jpg`, `screenshot-*.jpg` — illustrative mock previews; do not restore to README.

## Docs media (also captured)

| Shot | File | Status |
|---|---|---|
| **Ctrl/Cmd+K palette** | `command-palette.png` | Captured |
| **Ops Services tile** | `admin-ops-services.png` | Captured — LiveKit · malware · companions · queues |
| **Features** | `admin-features.png` | Captured |
| **Integrations** | `admin-integrations.png` | Captured |
| **Discover** | `discover.png` | Captured |
| **Admin libraries** | `admin-libraries.png` | Captured |
| **`/readyz` JSON** | `readyz.json` | Captured |
| **`/healthz` JSON** | `healthz.json` | Captured |
| **Product tour video** | `docs/media/video/product-tour.webm` | Captured |

## Refresh rule (Docs owns)

**Every commit/ship pass** that touches member or admin UI — or every wave pass when Docs is seated — **must** re-run capture (or copy freshest `docs/media/screenshots/` into readme slots) **before ship**. Do not ship README with stale or mock JPG frames.

Also useful later: Friends companion pop-out, voice lobby with LiveKit secrets.

## Local capture recipe

1. Build SPAs: `frontend/member-app`, `frontend/admin-app` (`npm run build`).
2. Fetch legal ROMs: `python scripts/fetch-free-roms.py` (see `samples/free-roms/`).
3. Point `DATA_FOLDER_GAMES` / `BASE_FOLDER_WINDOWS` at a games tree (e.g. `data/games-capture`).
4. Run uvicorn: `python -m uvicorn asgi:asgi_app --host 127.0.0.1 --port 5006` with `PYTHONUTF8=1`.
5. Optional seed: `python scripts/finish_capture_setup.py` · `python scripts/seed_capture_games.py`.
6. Capture: `pip install playwright && playwright install chromium` then `python scripts/capture_docs_media.py`.
7. The script writes canonical README slots automatically:
   - `/library` → `screenshot-library.png` + `hero-banner.png` (+ `library-free-roms.png`)
   - `/systems` → `screenshot-systems.png`
   - `/chat` → `screenshot-chat.png`
   - plus Ops/Features/palette under `docs/media/screenshots/`

**Note:** Capture blocks `/api/activity/stream` so a single-worker uvicorn is not stalled by SSE. Login + Library must return 200 (not 500) before capture can refresh pixels.

**Waves 4–13 (2026-07-30):** Capture **needed on ship after Wave 14b** — `screenshot-chat.png` (Leave → muted badge) + Calendar densify + Updates auto-refresh/teaser under `docs/media/` + optional Library **multi-select sticky** (Select page · Favorite/Unfavorite · **Add to wishlist** · **Play status** · More freshness · Clear · partial-success toasts) + W12 theme swatches / More densify / fair factors if useful + Admin **`/admin/quality_profiles` SPA** (list · set active · new · delete · edit · score probe) + optional Unmatched **Why unmatched?** / `match_score` / Backfill kind hints + Ops **library health** MetricTile toned by grade + poor-grade factors light danger left edge (and refresh README Library/Systems/hero if presets drifted) — do not invent pixels. Waves **4–13** closed (uncommitted · W13 QA DoD: refresh_images **5/5** · quality **4/4** · vitest QualityProfiles **3/3**); finish-before-ship: **14a → 14b → ship (4–14)**; live `:5006` still **BLOCKED (env)** OK. Re-run when human ships and `/login`+`/library` are healthy.
