# AGENTS.md

## Cursor Cloud specific instructions

GameTheca is a self-hosted game-library server: a **Flask app served via ASGI/uvicorn** (`asgi:asgi_app`, port **5006**), a **PostgreSQL** database, and three **React/Vite frontends** under `frontend/` that build into `gametheca/static/dist/`. See `README.md` for the general dev commands; the notes below only cover cloud-environment caveats.

### Startup (do this at the beginning of a session)
- **PostgreSQL is NOT a running systemd service here — start it manually each session:**
  `sudo pg_ctlcluster 16 main start`
  The `gametheca` and `gamethecatest` databases already exist (`postgres` / `postgres` @ `localhost:5432`) and persist in the VM snapshot. Verify with `pg_lsclusters`.
- A local-dev `.env` already exists at the repo root (git-ignored, persisted in the snapshot). It sets `SECRET_KEY`, `DATABASE_URL`, `TEST_DATABASE_URL`, and points the scan base at `BASE_FOLDER_POSIX=/workspace/data/games`. The app refuses to start without a real `SECRET_KEY`, so keep `.env` intact.

### Run the app
- `./startweb.sh` — activates `venv`, runs one-time startup init/migrations, then launches uvicorn (4 workers) on `:5006`. On a fresh database the app redirects to the first-run wizard at `/setup` (create the admin there). Use `./startweb.sh --force-setup` to drop/recreate tables and re-trigger the wizard.
- The Python venv lives at `./venv` (git-ignored). Run backend tools with `./venv/bin/python` / `./venv/bin/pytest`.

### Tests
- Backend: `./venv/bin/python -m pytest` (uses `TEST_DATABASE_URL` from `.env`; `pytest` is installed by the update script, not in `requirements.txt`).
  - The full suite has ~50 **pre-existing** failures/errors caused by cross-test DB isolation (`conftest.py` intentionally skips `db.drop_all()` for speed, so FK cleanup ordering breaks when many DB tests share one database). Individual test files pass in isolation. If a full run leaves the test DB dirty, reset it: `PGPASSWORD=postgres psql -h localhost -U postgres -c "DROP DATABASE gamethecatest;" && ... "CREATE DATABASE gamethecatest;"`.
- Frontend: in `frontend/library-grid`, `frontend/ops-glance`, `frontend/api-client` run `npm test` (Vitest). `library-grid` has 5 pre-existing failing tests; `ops-glance` and `api-client` pass fully.

### Build the frontends
- `npm run build` in each `frontend/*` package emits bundles into `gametheca/static/dist/` (already committed). Rebuilding regenerates `dist/index.html` — avoid committing those incidental diffs unless intended.

### Notes / gotchas
- Game identification (IGDB/Steam/GOG/RAWG) needs real API keys. Without them, scanned folders show as **Unmatched** rather than fully identified games — this is expected, and folder scanning itself still works.
- Optional modules are feature-flagged **off** by default (`ENABLE_ARR_MODULE`, `ENABLE_AI_ASSIST`, `ENABLE_VR_BROWSE`, `OIDC_ENABLED`) and are not required to run or test the core app.
- No Python linter config and no pre-commit/husky hooks are present in this repo.
