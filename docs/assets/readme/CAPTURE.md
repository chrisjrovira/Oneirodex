# Capture checklist (README / docs media)

Live pixels from local Playwright capture (`scripts/capture_docs_media.py`). Prefer **1920×1080**; dark default theme. Finals live under `docs/media/screenshots/`; README slots under `docs/assets/readme/` must stay in sync.

## README required (live only)

| Shot | README slot | `docs/media/` source | Status |
|---|---|---|---|
| **Hero strip** | `hero-banner.png` | `/library` (same session) | **Recaptured 2026-08-28** — review stack; LHN logo `5.5rem` / icons `0.7rem` |
| **Library + free ROMs** | `screenshot-library.png` | `library-free-roms.png` | **Recaptured 2026-08-28** — rail sizing |
| **Systems** | `screenshot-systems.png` | `systems-platforms.png` | **Recaptured 2026-08-28** |
| **Chat / Activity / Friends** | `screenshot-chat.png` | `/chat` (`chat-channels.png` in media) | **Recaptured 2026-08-28** — slide-over with seeded #general messages |

Retired: `hero-banner.jpg`, `screenshot-*.jpg` — illustrative mock previews; do not restore to README.

## Docs media (also captured)

| Shot | File | Status |
|---|---|---|
| **Ctrl/Cmd+K palette** | `command-palette.png` | Captured |
| **Ops Services tile** | `admin-ops-services.png` | Captured — LiveKit · malware · companions · queues |
| **Features** | `admin-features.png` | Captured |
| **Integrations** | `admin-integrations.png` | Captured |
| **Discover** | `discover.png` | Captured |
| **Admin libraries** | `admin-libraries.png` | Captured — **refresh needed** after W22-1 (unified Libraries & scans tabs · multi-select · force-delete) when `:5006` healthy |
| **`/readyz` JSON** | `readyz.json` | Captured |
| **`/healthz` JSON** | `healthz.json` | Captured |
| **Product tour video** | `docs/media/video/product-tour.webm` | Captured |
| **How-to videos (10)** | `docs/media/video/howto/howto-*.webm` | Captured 2026-08-05 — one worked example per section; index + honest gaps in [howto/README.md](../../media/video/howto/README.md) |

## Refresh rule (Docs owns)

**Every commit/ship pass** that touches member or admin UI — or every wave pass when Docs is seated — **must** re-run capture (or copy freshest `docs/media/screenshots/` into readme slots) **before ship**. Do not ship README with stale or mock JPG frames.

Also useful later: Friends companion pop-out, voice lobby with LiveKit secrets.

## Local capture recipe

1. Build SPAs: `frontend/member-app`, `frontend/admin-app` (`npm run build`).
   **Do this first** — the dists are what get photographed, so a stale build
   silently captures old UI.
2. Fetch legal ROMs: `python scripts/fetch-free-roms.py` (see `samples/free-roms/`).
3. Create a throwaway capture DB and env. **Never point capture at your real
   deploy `.env`** — its paths are container-side (`/mnt/user/…`, `DATABASE_HOST=db`)
   and will not resolve on the host:

   ```bash
   # .env.capture.local (gitignored)
   SECRET_KEY=<generate one>
   DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/gamethecacapture
   DATA_FOLDER_GAMES=<repo>/data/games-capture
   UPLOAD_FOLDER=<repo>/gametheca/static/library
   BASE_FOLDER_WINDOWS=Z:/
   # keep outbound integrations off so capture never hits the network
   ENABLE_FREE_GAMES=false
   ENABLE_AI_ARTWORK=false
   SCAN_CHECK_FRESHNESS=false
   ```

4. Seed: `python scripts/finish_capture_setup.py` · `python scripts/seed_capture_games.py`,
   then create an admin matching `CAPTURE_USER` / `CAPTURE_PASS` (default
   `admin` / `CaptureAdmin1!`).
5. Give the instance representative content **using real product features**, not
   hand-placed files:
   - covers — `POST /admin/api/art-studio/batch-generate` (system-templated
     placeholder covers). Without this every tile reads *"No cover art"* and the
     hero looks like an empty install.
   - a little chat history — `POST /api/chat/channels/<id>/messages`.
   Both need the CSRF token from the `<meta name="csrf-token">` on an admin page,
   sent as `X-CSRFToken`.
6. Run the app **the way the launchers do** — initialization first, then workers:

   ```python
   from gametheca.init_manager import run_complete_startup_initialization
   run_complete_startup_initialization()      # otherwise /readyz stays 503
   uvicorn.run(asgi_app, host="127.0.0.1", port=5006)
   ```

   Starting uvicorn alone leaves `initialization.complete = false`, so `/readyz`
   returns 503 and the captured `readyz.json` records a not-ready box.
7. Capture:
   - `python scripts/capture_docs_media.py` — stills + the product tour
   - `python scripts/capture_howto_videos.py` — one how-to video per section
     (`python scripts/capture_howto_videos.py library discover` for a subset)
8. `capture_docs_media.py` writes canonical README slots automatically:
   - `/library` → `screenshot-library.png` + `hero-banner.png` (+ `library-free-roms.png`)
   - `/systems` → `screenshot-systems.png`
   - `/chat` → `screenshot-chat.png`
   - plus Ops/Features/palette under `docs/media/screenshots/`

**Note:** Capture blocks `/api/activity/stream` so a single-worker uvicorn is not stalled by SSE. Login + Library must return 200 (not 500) before capture can refresh pixels.

**Health gate (added 2026-08-05):** every surface is checked with
`page_is_healthy()` before it is photographed. If a page renders an error or is
near-empty, that shot is **skipped and the existing file left untouched**, and
the run exits **3** with a list of what was not refreshed. This exists because a
run that hit a mid-capture 500 wrote *"Internal Server Error"* into
`screenshot-library.png` and `hero-banner.png` and reported success. Treat a
non-zero exit as "pixels are stale", never as "done".

**Known local flake:** under Python 3.14 + asgiref, aborting a request mid-flight
(navigation away, blocked SSE) can kill the WSGI→ASGI bridge with
`RuntimeError: CurrentThreadExecutor already quit or is broken`, after which the
worker 500s until restarted. If a run reports skips, restart the app and re-run.

**2026-08-05 — capture unblocked and everything above re-shot.** `:5006` had been
**BLOCKED (env)** since Wave 15; the blocker was that the only `.env` on the box
is the Unraid deploy env (container-side paths). A throwaway local capture env
plus a `gamethecacapture` DB cleared it, and all README slots + docs media were
re-captured from live pixels against freshly built SPA dists.

Two things worth knowing before the next pass:

* **Seed content first.** With no covers every tile reads *"No cover art"* and
  the hero looks like an empty install. `POST /admin/api/art-studio/batch-generate`
  gives real system-templated covers; a few seeded chat messages do the same for
  `screenshot-chat.png`.
* **A capture run can lie.** One run hit a mid-capture 500 and wrote
  *"Internal Server Error"* into `screenshot-library.png` and `hero-banner.png`
  while reporting success. Hence the health gate + non-zero exit described above.
  Always check the exit code, and eyeball the hero before shipping.

Still owed (needs data or config the capture box does not have): Calendar
List/Month · News featured · play honesty / artistic rooms · Library
typeahead / MISSING · Admin Extensions/Stock/Art Studio · Friends companion
pop-out · voice lobby with LiveKit secrets. **Do not invent pixels** for these.
