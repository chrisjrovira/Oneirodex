# Run GameTheca — host gotchas

Windows 11 / Git Bash notes for `.cursor/skills/run-gametheca/`. Load this file
when `serve.sh` or `drive.py` misbehaves; do not load it on a clean launch.

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
  `PORT` before loading it. `serve.sh` uses `ONEIRODEX_PORT` / `GT_PORT` and applies it *after*
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
| Port already in use / stale responses | `bash .cursor/skills/run-gametheca/serve.sh --stop` |
| `psycopg2 ... could not connect` | `docker start gametheca-review-db` |
