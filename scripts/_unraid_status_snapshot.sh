#!/bin/bash
# Quick Unraid status for the chrome pickup canvas (no secrets).
set -euo pipefail
docker exec oneirodex-db psql -U postgres -d oneirodex -Atc \
  "SELECT 'scan:' || status || '=' || count(*) FROM scan_jobs GROUP BY status ORDER BY 1;"
docker exec oneirodex-db psql -U postgres -d oneirodex -Atc \
  "SELECT 'libraries=' || count(*) FROM libraries;"
docker exec oneirodex-db psql -U postgres -d oneirodex -Atc \
  "SELECT 'platforms=' || count(DISTINCT platform::text) FROM libraries;"
docker exec oneirodex-db psql -U postgres -d oneirodex -Atc \
  "SELECT 'favorites=' || count(*) FROM user_favorites;"
docker exec oneirodex-db psql -U postgres -d oneirodex -Atc \
  "SELECT 'games=' || count(*) FROM games;"
curl -sf http://127.0.0.1:5006/readyz && echo
docker exec oneirodex-app grep -c get_global_settings /app/oneirodex/utils/member_spa.py || true
