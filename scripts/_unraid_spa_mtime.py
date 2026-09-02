#!/usr/bin/env python3
"""Confirm rebuilt SPA timestamps inside the image."""
from __future__ import annotations

import subprocess
import sys

SSH = ["ssh", "-o", "BatchMode=yes", "root@192.168.50.116"]
SCRIPT = r"""
set -eu
docker exec oneirodex-app sh -c 'stat -c "%y %n" /app/oneirodex/static/dist/member-app/member-app.js /app/oneirodex/static/dist/admin-app/admin-app.css /app/oneirodex/static/dist/admin-app/admin-app.js'
docker exec oneirodex-app sh -c 'grep -n "Sign in with SSO\|oidc_enabled\|ENABLE_AI_AUTO_APPLY" /proc/1/environ 2>/dev/null | head || true'
"""


def main() -> int:
    run = subprocess.run(SSH + ["bash", "-s"], input=SCRIPT.encode())
    return run.returncode


if __name__ == "__main__":
    sys.exit(main())
