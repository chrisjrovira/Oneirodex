#!/bin/bash
# Poll until no Running/Queued scan jobs remain (Failed/Completed OK).
set -euo pipefail
ROOT=/mnt/user/infernal-data-streams/_projects/Oneirodex
INTERVAL="${1:-90}"
while true; do
  out=$(docker exec oneirodex-db psql -U postgres -d oneirodex -t -A -c \
    "SELECT status || ':' || count(*) FROM scan_jobs WHERE status IN ('Running','Queued','Stopping') GROUP BY status ORDER BY 1;")
  games=$(docker exec oneirodex-db psql -U postgres -d oneirodex -t -A -c "SELECT count(*) FROM games;")
  echo "$(date -u +%H:%M:%S) games=$games active=[${out//$'\n'/ }]"
  if [ -z "$out" ]; then
    echo "SCAN_QUEUE_IDLE games=$games"
    bash "$ROOT/scripts/_unraid_scan_status.sh"
    exit 0
  fi
  sleep "$INTERVAL"
done
