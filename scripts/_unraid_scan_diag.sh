#!/bin/bash
set -euo pipefail
docker exec oneirodex-db psql -U postgres -d oneirodex -c \
  "SELECT id, status, folders_success, folders_failed, total_folders,
          LEFT(COALESCE(error_message, ''), 140) AS err
   FROM scan_jobs
   ORDER BY id DESC LIMIT 10;"
echo "--- games ---"
docker exec oneirodex-db psql -U postgres -d oneirodex -c "SELECT COUNT(*) AS games FROM games;"
echo "--- recent logs ---"
docker logs oneirodex-app --tail 60 2>&1 | tail -60
echo "--- processes ---"
docker top oneirodex-app -eo pid,cmd 2>/dev/null | head -25 || true
