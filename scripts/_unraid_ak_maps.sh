#!/bin/bash
set -eu
docker exec postgresql17 psql -U cephyrix_zyth -d authentikpostgresql -c '\d authentik_providers_oauth2_scopemapping'
docker exec postgresql17 psql -U cephyrix_zyth -d authentikpostgresql -c '\d authentik_core_propertymapping'
docker exec postgresql17 psql -U cephyrix_zyth -d authentikpostgresql -c 'SELECT pm.name, sm.scope_name FROM authentik_providers_oauth2_scopemapping sm JOIN authentik_core_propertymapping pm ON pm.id = sm.propertymapping_ptr_id ORDER BY sm.scope_name;'
docker exec postgresql17 psql -U cephyrix_zyth -d authentikpostgresql -c 'SELECT username, email, is_active FROM authentik_core_user ORDER BY username;'
docker exec authentik ak --help | head -50
