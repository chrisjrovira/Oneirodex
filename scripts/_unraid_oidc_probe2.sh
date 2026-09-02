#!/bin/bash
set -eu
echo '=== oauth2 columns ==='
docker exec postgresql17 psql -U cephyrix_zyth -d authentikpostgresql -c '\d authentik_providers_oauth2_oauth2provider'
echo '=== provider rows ==='
docker exec postgresql17 psql -U cephyrix_zyth -d authentikpostgresql -c 'SELECT * FROM authentik_providers_oauth2_oauth2provider;'
echo '=== crypto keys ==='
docker exec postgresql17 psql -U cephyrix_zyth -d authentikpostgresql -c 'SELECT name FROM authentik_crypto_certificatekeypair;'
echo '=== override exists ==='
ls -la /mnt/user/infernal-data-streams/_projects/Oneirodex/docker-compose.override.yml
echo '=== disk cache ==='
df -h /mnt/cache | tail -1
