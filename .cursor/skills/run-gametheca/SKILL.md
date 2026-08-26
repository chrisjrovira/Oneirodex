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

Paths below are relative to the repo root. Canonical skill path is
`.cursor/skills/run-gametheca/` (mirrored to `.claude/`). Verified on
Windows 11 / Git Bash, Python 3.14, against `gametheca-review-db` (postgres:17.6).

Windows/Git-Bash gotchas and the troubleshooting table: [gotchas.md](gotchas.md).

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
bash .cursor/skills/run-gametheca/serve.sh
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
python .cursor/skills/run-gametheca/drive.py --smoke
```

Expected tail: `17/17 as expected`. The table shows each endpoint's HTTP
status, whether it answered with the shared envelope, and its `error_code`.
The two rows marked `[contract]` are asserted to **stay** non-envelope.

Call anything ad hoc:

```bash
python .cursor/skills/run-gametheca/drive.py --get /api/collections
MSYS_NO_PATHCONV=1 python .cursor/skills/run-gametheca/drive.py \
  --post /api/requests --body '{"title":"Test"}'
```

Stop it — this matters, see [gotchas.md](gotchas.md):

```bash
bash .cursor/skills/run-gametheca/serve.sh --stop
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
