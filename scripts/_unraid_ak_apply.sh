#!/bin/bash
set -eu
MEDIA=/mnt/user/appdata/authentik/media
SRC=/mnt/user/infernal-data-streams/_projects/Oneirodex/scripts/_ak_create_oneirodex.py
sed -i 's/\r$//' "$SRC"
cp "$SRC" "$MEDIA/create_oneirodex.py"
if [ ! -s "$MEDIA/.oneirodex_oidc_secret" ]; then
  openssl rand -base64 32 | tr -d '\n' > "$MEDIA/.oneirodex_oidc_secret"
fi
echo "exec(open('/media/create_oneirodex.py').read())" | docker exec -i authentik ak shell
echo '=== ok file ==='
cat "$MEDIA/.oneirodex_oidc_ok" 2>/dev/null || echo 'NO_OK_FILE'
echo '=== apps ==='
docker exec postgresql17 psql -U cephyrix_zyth -d authentikpostgresql -c 'SELECT slug, name FROM authentik_core_application;'
echo '=== providers ==='
docker exec postgresql17 psql -U cephyrix_zyth -d authentikpostgresql -c 'SELECT client_id FROM authentik_providers_oauth2_oauth2provider;'
