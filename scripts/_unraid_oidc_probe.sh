#!/bin/bash
set -euo pipefail
echo '=== app image / labels ==='
docker inspect oneirodex-app --format '{{.Config.Image}}'
docker inspect oneirodex-app --format '{{index .Config.Labels "com.docker.compose.project"}} {{index .Config.Labels "com.docker.compose.project.working_dir"}} {{index .Config.Labels "com.docker.compose.project.config_files"}}'
echo '=== authentik apps ==='
docker exec postgresql17 psql -U cephyrix_zyth -d authentikpostgresql -c 'SELECT slug, name FROM authentik_core_application;'
echo '=== authentik provider tables ==='
docker exec postgresql17 psql -U cephyrix_zyth -d authentikpostgresql -c '\dt authentik_providers*'
echo '=== oauth2 providers ==='
docker exec postgresql17 psql -U cephyrix_zyth -d authentikpostgresql -c 'SELECT id, name, client_id FROM authentik_providers_oauth2_oauth2provider;' || \
docker exec postgresql17 psql -U cephyrix_zyth -d authentikpostgresql -c 'SELECT id, name, client_id FROM authentik_providers_oauth2;' || true
echo '=== flows ==='
docker exec postgresql17 psql -U cephyrix_zyth -d authentikpostgresql -c "SELECT slug, designation FROM authentik_flows_flow WHERE designation IN ('authorization','authentication') ORDER BY designation, slug;"
echo '=== groups ==='
docker exec postgresql17 psql -U cephyrix_zyth -d authentikpostgresql -c 'SELECT name FROM authentik_core_group ORDER BY name;'
echo '=== authentik health ==='
curl -fsS http://127.0.0.1:9000/-/health/live/ || curl -fsS -o /dev/null -w '%{http_code}\n' http://127.0.0.1:9000/ || true
echo
docker ps --filter name=authentik --filter name=oneirodex --format '{{.Names}} {{.Status}}'
