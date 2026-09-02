#!/usr/bin/env python3
"""List SPA dist filenames in the live app image. No secrets."""
from __future__ import annotations

import subprocess
import sys

SSH = ["ssh", "-o", "BatchMode=yes", "root@192.168.50.116"]
SCRIPT = r"""
set -eu
echo '=== member-app dist ==='
docker exec oneirodex-app sh -c 'ls -1 /app/oneirodex/static/dist/member-app 2>/dev/null | head -n 20'
echo '=== admin-app dist ==='
docker exec oneirodex-app sh -c 'ls -1 /app/oneirodex/static/dist/admin-app 2>/dev/null | head -n 20'
echo '=== extra flags ==='
docker exec oneirodex-app sh -c 'env | grep -E "^(ENABLE_CHALLENGE_SOLVER|ENABLE_MALWARE_SCAN|ENABLE_REMOTE_PLAY|ENABLE_AI_AUTO_APPLY|ALLOW_HARDLINK_APPLY)=" | sed "s/=.*/=set/"'
"""


def main() -> int:
    run = subprocess.run(SSH + ["bash", "-s"], input=SCRIPT.encode())
    return run.returncode


if __name__ == "__main__":
    sys.exit(main())
