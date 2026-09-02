#!/usr/bin/env python3
"""Unraid compose + themes + smoke. Skip git pull (NAS share already has the ship commit)."""
from __future__ import annotations

import subprocess
import sys

SSH = ["ssh", "-o", "BatchMode=yes", "root@192.168.50.116"]
REPO = "/mnt/user/infernal-data-streams/_projects/Oneirodex"
SCRIPT = rf"""
set -eu
cd {REPO}
export COMPOSE_FILE=docker-compose.yml
GIT="git -c safe.directory={REPO}"
echo '=== HEAD ==='
$GIT log -1 --oneline
echo '=== compose up --build (livekit clamav challenge) ==='
docker compose --profile livekit --profile clamav --profile challenge up -d --build
echo '=== readyz ==='
ok=0
for i in $(seq 1 90); do
  if curl -fsS http://127.0.0.1:5006/readyz >/dev/null 2>&1; then
    curl -fsS http://127.0.0.1:5006/readyz
    echo
    ok=1
    break
  fi
  sleep 2
done
test "$ok" = 1
echo '=== reset default themes ==='
docker exec -i oneirodex-app python - < {REPO}/scripts/_unraid_reset_themes.py
echo '=== flags ==='
docker exec oneirodex-app sh -c 'printf "OIDC_ENABLED=%s\nENABLE_AI_AUTO_APPLY=%s\nALLOW_HARDLINK_APPLY=%s\nENABLE_LIVEKIT=%s\nENABLE_CHALLENGE_SOLVER=%s\n" "$OIDC_ENABLED" "$ENABLE_AI_AUTO_APPLY" "$ALLOW_HARDLINK_APPLY" "$ENABLE_LIVEKIT" "$ENABLE_CHALLENGE_SOLVER"'
echo '=== login SSO ==='
curl -fsS http://127.0.0.1:5006/login | grep -F 'Sign in with SSO' | head -n 1
echo '=== authentik ==='
curl -fsS -o /dev/null -w 'authentik_http=%{{http_code}}\n' http://127.0.0.1:9000/ || true
echo '=== oidc db ==='
docker exec oneirodex-db psql -U postgres -d oneirodex -tAc "SELECT oidc_enabled, oidc_client_id FROM global_settings ORDER BY id LIMIT 1;"
"""


def main() -> int:
    run = subprocess.run(SSH + ["bash", "-s"], input=SCRIPT.encode())
    return run.returncode


if __name__ == "__main__":
    sys.exit(main())
