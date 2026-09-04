#!/usr/bin/env python3
"""Wait for Unraid app /awake then print SPA hash + login SSO marker. No secrets."""
from __future__ import annotations

import subprocess
import sys

SSH = ["ssh", "-o", "BatchMode=yes", "root@192.168.50.116"]
SCRIPT = r"""
set -eu
for i in $(seq 1 90); do
  if curl -fsS http://127.0.0.1:5006/awake >/dev/null 2>&1; then
    echo 'READYZ=ok'
    break
  fi
  sleep 2
done
curl -fsS http://127.0.0.1:5006/awake || { echo 'READYZ=fail'; exit 1; }
echo '--- login SSO ---'
curl -fsS http://127.0.0.1:5006/login | grep -E 'Sign in with SSO|oidc|/login/oidc' | head -n 20 || true
echo '--- member-app hash ---'
curl -fsS http://127.0.0.1:5006/ | grep -oE 'member-app[^" ]+\.(css|js)' | head -n 8 || true
echo '--- admin-app hash ---'
curl -fsS http://127.0.0.1:5006/admin/ | grep -oE 'admin-app[^" ]+\.(css|js)' | head -n 8 || true
echo '--- authentik ---'
curl -fsS -o /dev/null -w 'authentik_http=%{http_code}\n' http://127.0.0.1:9000/ || true
echo '--- oidc env present (names only) ---'
docker exec oneirodex-app sh -c 'env | grep -E "^OIDC_|^ENABLE_LIVEKIT=|^ENABLE_MALWARE=|^ENABLE_CHALLENGE=|^COMPOSE_FILE=" | sed "s/=.*/=set/" | sort'
echo '--- containers ---'
docker ps --format '{{.Names}} {{.Status}}' | grep -E 'oneirodex-|authentik' || true
"""


def main() -> int:
    run = subprocess.run(SSH + ["bash", "-s"], input=SCRIPT.encode())
    return run.returncode


if __name__ == "__main__":
    sys.exit(main())
