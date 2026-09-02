#!/usr/bin/env python3
"""Git preflight with per-invocation safe.directory (does not write git config)."""
from __future__ import annotations

import subprocess
import sys

SSH = ["ssh", "-o", "BatchMode=yes", "root@192.168.50.116"]
REPO = "/mnt/user/infernal-data-streams/_projects/Oneirodex"
SCRIPT = rf"""
set -eu
cd {REPO}
GIT='git -c safe.directory={REPO}'
echo '=== branch ==='
$GIT branch --show-current
echo '=== log ==='
$GIT log -5 --oneline
echo '=== status -sb ==='
$GIT status -sb
echo '=== status --short ==='
$GIT status --short
"""


def main() -> int:
    run = subprocess.run(SSH + ["bash", "-s"], input=SCRIPT.encode())
    return run.returncode


if __name__ == "__main__":
    sys.exit(main())
