#!/usr/bin/env python3
"""Summarize real vs whitespace git diffs on Unraid. No config writes."""
from __future__ import annotations

import subprocess
import sys

SSH = ["ssh", "-o", "BatchMode=yes", "root@192.168.50.116"]
REPO = "/mnt/user/infernal-data-streams/_projects/Oneirodex"
SCRIPT = rf"""
set -eu
cd {REPO}
GIT='git -c safe.directory={REPO}'
echo '=== name-only count ==='
$GIT diff --name-only | wc -l
echo '=== ignore-space name-only count ==='
$GIT diff -w --name-only | wc -l
echo '=== ignore-cr-at-eol name-only count ==='
$GIT diff --ignore-cr-at-eol --name-only | wc -l
echo '=== untracked count ==='
$GIT ls-files --others --exclude-standard | wc -l
echo '=== sample first 5 diffs (stat) ==='
$GIT diff --stat -- docker-compose.yml frontend/admin-app/src/pages.jsx frontend/admin-app/src/styles.css docs/runbooks/unraid-deploy.md docs/runbooks/oidc-authentik-unraid.md docs/strategy/progress.md | tail -n 20
echo '=== porcelain untracked helpers ==='
$GIT status --short -- scripts/_unraid_compose_rebuild.py scripts/_unraid_enable_oidc_db.py scripts/_ak_create_oneirodex.py scripts/_unraid_patch_env.py docker-compose.yml frontend/admin-app/src/pages.jsx .env
"""


def main() -> int:
    run = subprocess.run(SSH + ["bash", "-s"], input=SCRIPT.encode())
    return run.returncode


if __name__ == "__main__":
    sys.exit(main())
