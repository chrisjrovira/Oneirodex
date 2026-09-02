#!/usr/bin/env bash
set -eu
REPO=/mnt/user/infernal-data-streams/_projects/Oneirodex
# One-off `docker run` of the app image inherits the entrypoint and waits on db.
docker ps -aq --filter ancestor=oneirodex:1.0.0-beta --filter status=restarting | xargs -r docker rm -f
docker ps -a --format '{{.ID}} {{.Names}} {{.Status}}' | awk '/pytest|Waiting/ && $2 !~ /^oneirodex-/ {print $1}' | xargs -r docker rm -f || true

docker exec -i oneirodex-app python - < "$REPO/scripts/_p3b_verify.py"

echo '=== containers ==='
docker ps --format '{{.Names}} {{.Status}}' | grep -E 'oneirodex-|gametheca-|authentik' || true
if docker ps --format '{{.Names}}' | grep -E '^gametheca-'; then
  echo 'FAIL: gametheca-* still running'
  exit 1
fi
echo '=== DONE verify ==='
