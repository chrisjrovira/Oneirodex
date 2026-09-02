#!/bin/bash
# Rebuild Unraid app for latest main (BP-0). App stack only.
# Queued ScanJob rows survive; a Running job is reclaimed after recreate.
set -euo pipefail
ROOT=/mnt/user/infernal-data-streams/_projects/Oneirodex
cd "$ROOT"

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

echo "== BP-0 module present =="
docker exec oneirodex-app python -c "from oneirodex.utils.browser_player import SHIPPED_ENGINES, play_engine_fields; print(SHIPPED_ENGINES, play_engine_fields())"

echo "== reclaim + requeue leaf scans =="
docker exec -i oneirodex-app python - < "$ROOT/scripts/_unraid_requeue_leaves.py"

echo "== status =="
bash "$ROOT/scripts/_unraid_scan_status.sh"
