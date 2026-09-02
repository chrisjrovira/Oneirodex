#!/usr/bin/env python3
"""Push Authentik OIDC create script over SSH and apply it. Does not print the secret."""
from __future__ import annotations

import subprocess
from pathlib import Path

ROOT = Path(r"Z:\_projects\Oneirodex")
CREATE = ROOT / "scripts" / "_ak_create_oneirodex.py"
REMOTE_PY = "/mnt/user/appdata/authentik/media/create_oneirodex.py"
SSH = ["ssh", "-o", "BatchMode=yes", "root@192.168.50.116"]


def main() -> int:
    script = CREATE.read_bytes().replace(b"\r\n", b"\n")
    up = subprocess.run(SSH + [f"cat > {REMOTE_PY}"], input=script)
    if up.returncode != 0:
        return up.returncode
    apply = """
set -eu
MEDIA=/mnt/user/appdata/authentik/media
if [ ! -s "$MEDIA/.oneirodex_oidc_secret" ]; then
  openssl rand -base64 32 | tr -d '\\n' > "$MEDIA/.oneirodex_oidc_secret"
fi
echo 'exec(open("/media/create_oneirodex.py").read())' | docker exec -i authentik ak shell
echo OKFILE
cat "$MEDIA/.oneirodex_oidc_ok" || true
docker exec postgresql17 psql -U cephyrix_zyth -d authentikpostgresql -c "SELECT slug, name FROM authentik_core_application;"
docker exec postgresql17 psql -U cephyrix_zyth -d authentikpostgresql -c "SELECT client_id FROM authentik_providers_oauth2_oauth2provider;"
"""
    run = subprocess.run(SSH + ["bash", "-s"], input=apply.encode())
    return run.returncode


if __name__ == "__main__":
    raise SystemExit(main())
