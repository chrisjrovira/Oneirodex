#!/usr/bin/env bash
set -eu
echo '=== containers ==='
docker ps -a --format '{{.Names}}\t{{.Status}}' | grep -E 'oneirodex|gametheca|authentik' || true
echo '=== readyz ==='
curl -sS -m 5 http://127.0.0.1:5006/readyz || echo FAIL
echo
echo '=== healthz ==='
curl -sS -m 5 http://127.0.0.1:5006/healthz || echo FAIL
echo
echo '=== app logs ==='
docker logs oneirodex-app --tail 100 2>&1 || echo 'no oneirodex-app'
echo '=== dbs ==='
docker exec oneirodex-db psql -U postgres -tAc "SELECT datname FROM pg_database WHERE datistemplate = false;" || true
echo '=== env pins ==='
grep -E '^(APP_|DB_|POSTGRES_DB|DATABASE_URL|UPLOAD_FOLDER)=' /mnt/user/infernal-data-streams/_projects/Oneirodex/.env | sed 's/:[^:@]*@/:***@/'
echo '=== package dir ==='
ls -ld /mnt/user/infernal-data-streams/_projects/Oneirodex/oneirodex /mnt/user/infernal-data-streams/_projects/Oneirodex/gametheca 2>&1 || true
