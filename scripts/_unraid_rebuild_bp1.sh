#!/bin/bash
# Rebuild Unraid app for BP-1 (Nostalgist NES host + admin toggle).
# App stack only. Do not run while scans are Running — recreate reclaims them.
# Does not requeue leaf scans (unlike _unraid_rebuild_bp0.sh).
set -euo pipefail
ROOT=/mnt/user/infernal-data-streams/_projects/Oneirodex
cd "$ROOT"

echo "== refuse if scans are active =="
active="$(docker exec oneirodex-db psql -U postgres -d oneirodex -tAc \
  "SELECT COUNT(*) FROM scan_jobs WHERE status IN ('Running','Queued');")"
active="${active//[[:space:]]/}"
if [ "${active:-0}" != "0" ]; then
  echo "scan queue still active ($active). wait, then re-run." >&2
  bash "$ROOT/scripts/_unraid_scan_status.sh" || true
  exit 2
fi

echo "== HEAD =="
git -c safe.directory=* log -1 --oneline

echo "== docker compose up -d --build =="
docker compose up -d --build

echo "== wait readyz =="
for i in $(seq 1 90); do
  if curl -sf http://127.0.0.1:5006/readyz >/dev/null; then
    echo "readyz ok after ${i}"
    break
  fi
  sleep 4
  if [ "$i" -eq 90 ]; then
    echo "readyz timed out" >&2
    exit 1
  fi
done
curl -s http://127.0.0.1:5006/readyz
echo

echo "== reset themes =="
docker exec -i oneirodex-app python - < "$ROOT/scripts/_unraid_reset_themes.py"

echo "== BP-1 files =="
docker exec oneirodex-app python -c \
  "from pathlib import Path
from oneirodex.utils.browser_player import SHIPPED_ENGINES, play_engine_fields
p = Path('/app/oneirodex/static/vendor/nostalgist/play.html')
print('play.html', p.is_file(), 'engines', SHIPPED_ENGINES, play_engine_fields())"

echo "== status =="
bash "$ROOT/scripts/_unraid_scan_status.sh"
