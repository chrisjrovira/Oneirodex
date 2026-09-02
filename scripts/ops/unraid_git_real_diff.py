#!/usr/bin/env python3
"""List tracked files whose LF-normalized content differs from HEAD. Unraid-only."""
from __future__ import annotations

import subprocess
from pathlib import Path

REPO = Path("/mnt/user/infernal-data-streams/_projects/Oneirodex")
GIT = ["git", "-c", f"safe.directory={REPO}", "-C", str(REPO)]


def lf(data: bytes) -> bytes:
    return data.replace(b"\r\n", b"\n").replace(b"\r", b"\n")


def main() -> int:
    names = subprocess.check_output(
        GIT + ["diff", "--name-only", "--diff-filter=ACMR"],
        stderr=subprocess.DEVNULL,
    ).decode().splitlines()
    real: list[str] = []
    for name in names:
        path = REPO / name
        if not path.is_file():
            real.append(f"{name} (missing-or-not-file)")
            continue
        head = subprocess.check_output(
            GIT + ["show", f"HEAD:{name}"],
            stderr=subprocess.DEVNULL,
        )
        work = path.read_bytes()
        if lf(head) != lf(work):
            real.append(name)
    print(f"tracked_modified={len(names)}")
    print(f"real_content={len(real)}")
    for name in real:
        print(name)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
