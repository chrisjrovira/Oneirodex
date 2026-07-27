# Capture checklist (README / docs media)

Live pixels from local Playwright capture (`scripts/capture_docs_media.py`). Prefer **1920×1080**; dark default theme. Finals live under `docs/media/screenshots/` and key shots also under `docs/assets/readme/`.

| Shot | File | Status |
|---|---|---|
| **Library + free ROMs** | `library-free-roms.png` | Captured — 5 legal sample titles |
| **Systems** | `systems-platforms.png` | Captured |
| **Ctrl/Cmd+K palette** | `command-palette.png` | Captured |
| **Ops Services tile** | `admin-ops-services.png` | Captured — LiveKit · malware · companions · queues |
| **Features** | `admin-features.png` | Captured |
| **Integrations** | `admin-integrations.png` | Captured |
| **`/readyz` JSON** | `readyz.json` | Captured |
| **`/healthz` JSON** | `healthz.json` | Captured |
| **Product tour video** | `docs/media/video/product-tour.webm` | Captured |

## Local capture recipe

1. Build SPAs: `frontend/member-app`, `frontend/admin-app` (`npm run build`).
2. Fetch legal ROMs: `python scripts/fetch-free-roms.py` (see `samples/free-roms/`).
3. Point `DATA_FOLDER_GAMES` / `BASE_FOLDER_WINDOWS` at a games tree (e.g. `data/games-capture`).
4. Run uvicorn: `python -m uvicorn asgi:asgi_app --host 127.0.0.1 --port 5006` with `PYTHONUTF8=1`.
5. Optional seed: `python scripts/finish_capture_setup.py` · `python scripts/seed_capture_games.py`.
6. Capture: `pip install playwright && playwright install chromium` then `python scripts/capture_docs_media.py`.

**Note:** Capture blocks `/api/activity/stream` so a single-worker uvicorn is not stalled by SSE.

Also still useful later: Friends companion pop-out, voice lobby with LiveKit secrets.
