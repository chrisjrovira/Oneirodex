#!/usr/bin/env bash
# Finish P3b: rename leftover Postgres DB, wait for /readyz, reset themes.
set -eu
REPO=/mnt/user/infernal-data-streams/_projects/Oneirodex
cd "$REPO"
export COMPOSE_FILE=docker-compose.yml

echo '=== stop app so ALTER DATABASE can proceed ==='
docker compose stop app || docker stop oneirodex-app || true

echo '=== list databases ==='
docker exec oneirodex-db psql -U postgres -tAc "SELECT datname FROM pg_database WHERE datistemplate = false;"

if docker exec oneirodex-db psql -U postgres -tAc "SELECT 1 FROM pg_database WHERE datname='oneirodex'" | grep -q 1; then
  echo 'DB oneirodex already exists'
elif docker exec oneirodex-db psql -U postgres -tAc "SELECT 1 FROM pg_database WHERE datname='gametheca'" | grep -q 1; then
  echo '=== terminate backends on gametheca ==='
  docker exec oneirodex-db psql -U postgres -v ON_ERROR_STOP=1 -c \
    "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = 'gametheca' AND pid <> pg_backend_pid();"
  echo '=== ALTER DATABASE gametheca RENAME TO oneirodex ==='
  docker exec oneirodex-db psql -U postgres -v ON_ERROR_STOP=1 -c \
    "ALTER DATABASE gametheca RENAME TO oneirodex;"
  echo 'renamed database gametheca -> oneirodex'
else
  echo 'FAIL: neither gametheca nor oneirodex database found'
  exit 1
fi

echo '=== databases after rename ==='
docker exec oneirodex-db psql -U postgres -tAc "SELECT datname FROM pg_database WHERE datistemplate = false;"

echo '=== start app ==='
docker compose --profile livekit --profile clamav --profile challenge start app || docker start oneirodex-app

echo '=== wait readyz ==='
ok=0
for i in $(seq 1 90); do
  if curl -fsS -m 3 http://127.0.0.1:5006/readyz >/dev/null 2>&1; then
    curl -fsS -m 3 http://127.0.0.1:5006/readyz
    echo
    ok=1
    break
  fi
  sleep 2
done
test "$ok" = 1

echo '=== reset themes ==='
docker exec -i oneirodex-app python - < "$REPO/scripts/_unraid_reset_themes.py"

echo '=== verify no gametheca containers ==='
if docker ps --format '{{.Names}}' | grep -E '^gametheca-'; then
  echo 'FAIL: gametheca-* still running'
  docker ps --format '{{.Names}} {{.Status}}' | grep -E 'gametheca-|oneirodex-' || true
  exit 1
fi
docker ps --format '{{.Names}} {{.Status}}' | grep -E 'oneirodex-|authentik' || true

echo '=== GENERATOR_VERSION ==='
docker exec oneirodex-app python -c "from oneirodex.utils.preset_themes import GENERATOR_VERSION; print(GENERATOR_VERSION)"

echo '=== DONE P3b finish ==='
