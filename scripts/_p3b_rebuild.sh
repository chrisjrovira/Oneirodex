#!/usr/bin/env bash
# Rebuild + Reset Themes after P3b identifier leftovers. Does not re-run renames.
set -eu
REPO=/mnt/user/infernal-data-streams/_projects/Oneirodex
cd "$REPO"
export COMPOSE_FILE=docker-compose.yml

echo '=== build + up ==='
docker compose --profile livekit --profile clamav --profile challenge up -d --build --force-recreate app

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

echo '=== verify ==='
docker exec oneirodex-app python -c "from oneirodex.utils.preset_themes import GENERATOR_VERSION; from oneirodex.product import PACKAGE_NAME, RESET_CONFIRM_LEGACY; print(GENERATOR_VERSION, PACKAGE_NAME, RESET_CONFIRM_LEGACY)"
docker ps --format '{{.Names}} {{.Status}}' | grep -E 'oneirodex-|authentik' || true
if docker ps --format '{{.Names}}' | grep -E '^gametheca-'; then
  echo 'FAIL: gametheca-* still running'
  exit 1
fi
echo '=== DONE rebuild ==='
