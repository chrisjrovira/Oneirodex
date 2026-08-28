#!/usr/bin/env python3
"""Mirror .cursor/{skills,agents} → .claude/{skills,agents}.

Canonical edit surface is ``.cursor/``. Claude Code still loads ``.claude/``,
so this script copies the trees. ``--check`` exits 1 if they differ (CI and
ship-ready). Does not copy ``.cursor/rules`` (Cursor glob rules only).
"""
from __future__ import annotations

import argparse
import filecmp
import shutil
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
PAIRS = (
    (REPO / ".cursor" / "skills", REPO / ".claude" / "skills"),
    (REPO / ".cursor" / "agents", REPO / ".claude" / "agents"),
)


def _rel_files(root: Path) -> set[str]:
    if not root.is_dir():
        return set()
    return {p.relative_to(root).as_posix() for p in root.rglob("*") if p.is_file()}


def check() -> list[str]:
    problems: list[str] = []
    for src, dst in PAIRS:
        src_files = _rel_files(src)
        dst_files = _rel_files(dst)
        src_label = src.relative_to(REPO).as_posix()
        dst_label = dst.relative_to(REPO).as_posix()
        for rel in sorted(src_files - dst_files):
            problems.append(f"missing in {dst_label}: {rel}")
        for rel in sorted(dst_files - src_files):
            problems.append(f"extra in {dst_label}: {rel}")
        for rel in sorted(src_files & dst_files):
            if not filecmp.cmp(src / rel, dst / rel, shallow=False):
                problems.append(f"differ: {src_label}/{rel} vs {dst_label}/{rel}")
    return problems


def sync() -> int:
    copied = 0
    for src, dst in PAIRS:
        if dst.exists():
            shutil.rmtree(dst)
        shutil.copytree(src, dst)
        copied += len(_rel_files(dst))
    return copied


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--check",
        action="store_true",
        help="exit 1 if .claude/ drifted from .cursor/",
    )
    args = parser.parse_args()
    if args.check:
        problems = check()
        if problems:
            print("prompt trees drifted:", file=sys.stderr)
            for item in problems:
                print(f"  {item}", file=sys.stderr)
            print("Run: python scripts/sync_prompt_trees.py", file=sys.stderr)
            return 1
        print("prompt trees in sync")
        return 0
    count = sync()
    print(f"mirrored {count} files .cursor/ → .claude/")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
