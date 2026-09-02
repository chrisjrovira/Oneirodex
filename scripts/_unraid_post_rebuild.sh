#!/bin/bash
# App-stack only. Reset themes, then optionally create a small leaf set.
set -euo pipefail
ROOT=/mnt/user/infernal-data-streams/_projects/Oneirodex
cd "$ROOT"

echo "== wait readyz =="
for i in $(seq 1 60); do
  if curl -sf http://127.0.0.1:5006/readyz >/dev/null; then
    echo "readyz ok"
    break
  fi
  sleep 3
  if [ "$i" -eq 60 ]; then
    echo "readyz timed out" >&2
    exit 1
  fi
done
curl -s http://127.0.0.1:5006/readyz
echo

echo "== reset themes =="
docker exec -i oneirodex-app python - < "$ROOT/scripts/_unraid_reset_themes.py"

echo "== theme tokens =="
docker exec oneirodex-app grep -E "od-rail-mark-expanded:|od-rail-icon-w: 0.7" \
  /app/oneirodex/static/library/themes/default/css/od-density.css | head -8
docker exec oneirodex-app grep -n "border: 0" \
  /app/oneirodex/static/library/themes/default/css/od-appbar.css | head -8

echo "== users (names only) =="
docker exec oneirodex-db psql -U postgres -d oneirodex -c "SELECT name, role FROM users ORDER BY id LIMIT 8;"

echo "== libraries =="
docker exec oneirodex-db psql -U postgres -d oneirodex -c \
  "SELECT name, platform, last_scan_folder FROM libraries ORDER BY name;"

if [ "${1:-}" = "--scan" ]; then
  echo "== create small leaf set + queue scans =="
  docker exec -i oneirodex-app python - < "$ROOT/scripts/_unraid_scan_leaves.py"
  echo "== scan jobs =="
  docker exec oneirodex-db psql -U postgres -d oneirodex -c \
    "SELECT id, status, scan_folder, scan_mode FROM scan_jobs ORDER BY id DESC LIMIT 12;"
fi
