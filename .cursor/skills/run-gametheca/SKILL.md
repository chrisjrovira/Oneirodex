---
name: run-gametheca
description: >-
  Build, launch, and drive the GameTheca server to see a change working in the
  real app. Use when asked to run, start, serve, smoke-test, or hit the
  GameTheca API/SPA — or to verify a route change end-to-end rather than only
  with pytest/vitest. Covers launching uvicorn against the test database,
  logging in, and calling authenticated JSON endpoints.
---

# Run GameTheca

Flask-under-ASGI backend that also serves the four built React SPAs. The agent
path is two scripts in this directory: `serve.sh` launches uvicorn against the
**test** database, `drive.py` logs in and calls the JSON API.

Paths below are relative to the repo root. Verified on Windows 11 / Git Bash,
Python 3.14, against `gametheca-review-db` (postgres:17.6).

## Prerequisites

Postgres must be up — pytest and this skill share the same container:

```bash
docker ps -a --format '{{.Names}}\t{{.Status}}'
docker start gametheca-review-db
```

`requests` is needed by the driver (already present here):

```bash
python -c "import requests; print(requests.__version__)"
```

No build step is required to exercise the API — the SPAs are served from
`gametheca/static/dist/`, which is committed. Rebuild only if you changed
frontend source (`cd frontend/member-app && npm run build`).

## Run (agent path)

Launch in the background, wait for `/healthz`, then drive it:

```bash
bash .claude/skills/run-gametheca/serve.sh
```

It prints its banner and then blocks, so background it. Wait for readiness —
first start takes ~30s because startup initialisation rebuilds themes:

```bash
for i in $(seq 1 60); do
  python -c "import urllib.request,sys
try: urllib.request.urlopen('http://127.0.0.1:5099/healthz',timeout=2)
except Exception: sys.exit(1)" >/dev/null 2>&1 && { echo UP; break; }
  sleep 4
done
```

Walk the response envelope across every migrated surface:

```bash
python .claude/skills/run-gametheca/drive.py --smoke
```

Expected tail: `17/17 as expected`. The table shows each endpoint's HTTP
status, whether it answered with the shared envelope, and its `error_code`.
The two rows marked `[contract]` are asserted to **stay** non-envelope.

Call anything ad hoc:

```bash
python .claude/skills/run-gametheca/drive.py --get /api/collections
MSYS_NO_PATHCONV=1 python .claude/skills/run-gametheca/drive.py \
  --post /api/requests --body '{"title":"Test"}'
```

Stop it — this matters, see Gotchas:

```bash
bash .claude/skills/run-gametheca/serve.sh --stop
```

## Run (human path)

`startweb_windows.cmd` (or `startweb.sh`) is the operator path: it activates
`venv/`, loads `.env`, and serves the **live** database on port 5006 with four
workers. Use it to look at the UI in a browser; do not use it to exercise
error paths, because they mutate real library data.

## Test

```bash
python -m pytest tests/test_api_response.py tests/test_api_envelope_lint.py -q
python scripts/api_envelope_lint.py
node scripts/css-token-lint.mjs
```

## Gotchas

- **uvicorn dies at ASGI startup on Windows without UTF-8 stdio.** Startup
  prints an emoji; a cp1252 console raises
  `'charmap' codec can't encode character '\U0001f527'` and the process exits
  *after* logging "Application startup complete"-adjacent lines, so it reads
  like a crash rather than an encoding fault. `serve.sh` exports
  `PYTHONUTF8=1` and `PYTHONIOENCODING=utf-8`.
- **`curl` cannot reach 127.0.0.1 from Git Bash here.** It returns exit `000`
  with an empty body while the server is demonstrably serving; `netstat` shows
  the listener and Python reaches it fine. No proxy variables are set. This is
  why the driver is Python — do not "simplify" it to curl.
- **Git Bash mangles a leading-slash argument.** `--get /api/collections`
  arrives as `C:/Program Files/Git/api/collections` and requests raises
  `InvalidURL`. Prefix with `MSYS_NO_PATHCONV=1`, or pass `api/collections`.
  `drive.py` also recovers from the mangled form.
- **`.env` sets `PORT=5006`,** which wins over a shell default if you export
  `PORT` before loading it. `serve.sh` uses `GT_PORT` and applies it *after*
  the load, so it cannot collide with a real instance.
- **Stopping the launching shell leaves uvicorn orphaned** holding the port —
  a later launch then appears to work while you are talking to the old build.
  Always `serve.sh --stop`.
- **`config.py` raises at import** if `SECRET_KEY` is unset, so any script that
  imports the app needs `.env` loaded first. The batch file does this; a bare
  `python -c "from gametheca import create_app"` does not.
- **The login form field is `username`, not `email`.** Two different CSRF
  tokens are involved: the `csrf_token` form input for login, and the
  `csrf-token` `<meta>` on any rendered page for the `X-CSRFToken` header on
  API calls. `drive.py` handles both.
- **The test database is shared with pytest and never rolled back**
  (`conftest.py` leaves rows in place for speed). `serve.sh` therefore owns a
  dedicated `RunSkillAdmin` account rather than resetting an existing admin's
  password, and refuses to bootstrap credentials unless the database name
  contains `test`.

## Troubleshooting

| Symptom | Fix |
|---|---|
| `RuntimeError: SECRET_KEY environment variable is not set` | `.env` not loaded — run through `serve.sh`, don't invoke uvicorn directly. |
| `'charmap' codec can't encode character '\U0001f527'` | `export PYTHONUTF8=1` (already in `serve.sh`). |
| `requests.exceptions.InvalidURL: ...C:/Program Files/Git/api/...` | Git Bash path conversion — prefix `MSYS_NO_PATHCONV=1`. |
| curl returns nothing, exit `000` | Expected here; use `drive.py` or Python. |
| `login failed as 'RunSkillAdmin'` | Server was started against a non-test DB, so no admin was bootstrapped. Pass `--user <an existing admin>`. |
| Port already in use / stale responses | `bash .claude/skills/run-gametheca/serve.sh --stop` |
| `psycopg2 ... could not connect` | `docker start gametheca-review-db` |
