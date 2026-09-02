#!/bin/bash
docker exec oneirodex-db psql -U postgres -d oneirodex -c \
  "SELECT id, status, error_message, LEFT(scan_folder, 90) AS folder FROM scan_jobs ORDER BY id DESC LIMIT 8;"
docker logs oneirodex-app --tail 80 2>&1 | grep -E 'Ninentdo|FAILED|Error|auto scan|scan mode' | tail -40
