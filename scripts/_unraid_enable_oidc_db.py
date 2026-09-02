#!/usr/bin/env python3
"""Turn on GlobalSettings.oidc_enabled after Unraid app is up. Does not print secrets."""
from __future__ import annotations

import subprocess
import sys

SSH = ["ssh", "-o", "BatchMode=yes", "root@192.168.50.116"]
SCRIPT = r"""
set -eu
# Wait until Postgres accepts connections from the app DB container.
for i in $(seq 1 60); do
  if docker exec oneirodex-db pg_isready -U postgres >/dev/null 2>&1; then
    break
  fi
  sleep 2
done
docker exec oneirodex-db psql -U postgres -d oneirodex -v ON_ERROR_STOP=1 -c "
UPDATE global_settings
SET oidc_enabled = true,
    oidc_issuer_url = 'http://192.168.50.116:9000/application/o/oneirodex/',
    oidc_client_id = 'oneirodex',
    oidc_redirect_uri = 'http://192.168.50.116:5006/login/oidc/callback',
    oidc_scopes = 'openid email profile groups',
    oidc_role_claim = 'groups',
    oidc_display_name = 'Sign in with SSO'
WHERE id = (SELECT MIN(id) FROM global_settings);
"
docker exec oneirodex-db psql -U postgres -d oneirodex -tAc \
  "SELECT id, oidc_enabled, oidc_client_id, oidc_issuer_url IS NOT NULL AS has_issuer FROM global_settings ORDER BY id LIMIT 1;"
"""


def main() -> int:
    run = subprocess.run(SSH + ["bash", "-s"], input=SCRIPT.encode())
    return run.returncode


if __name__ == "__main__":
    sys.exit(main())
