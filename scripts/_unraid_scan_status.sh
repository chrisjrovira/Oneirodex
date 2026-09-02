#!/bin/bash
docker exec oneirodex-db psql -U postgres -d oneirodex -c \
  "SELECT id, status, LEFT(scan_folder, 80) AS folder, total_folders, folders_success, folders_failed FROM scan_jobs ORDER BY id DESC LIMIT 12;"
docker exec oneirodex-db psql -U postgres -d oneirodex -c \
  "SELECT name, platform, LEFT(last_scan_folder, 80) AS folder FROM libraries ORDER BY name;"
docker exec oneirodex-db psql -U postgres -d oneirodex -c \
  "SELECT COUNT(*) AS games FROM games;"
