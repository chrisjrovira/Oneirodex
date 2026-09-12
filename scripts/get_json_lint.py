#!/usr/bin/env python3
"""``request.get_json`` ratchet for Oneirodex routes.

Why this exists
---------------
Named-field JSON bodies adopt ``@validate_body`` / ``@validate_batch_body``
file-by-file. A grep census of ``request.get_json(`` is how we know what is
left, but a census that is not a gate grows back the moment someone copies
the three-line pattern into a new route.

This is the same per-file ratchet as ``scripts/print_lint.py``: existing
call sites are recorded, a file may never exceed its recorded count, and a
file with no record may have none.

What counts as a violation
--------------------------
An AST ``request.get_json(...)`` call. Docstring examples, comments, and
``obj.get_json(...)`` on something other than the name ``request`` are
**not** counted.

Scope
-----
``oneirodex/**/*.py``. ``tests/`` and ``scripts/`` are out of scope.
``oneirodex/utils/validation.py`` is in scope — it is the decorator helper
and is allowed its recorded count (the shared ``_json_object`` reader).

Usage
-----
    python scripts/get_json_lint.py            # check (exit 1 on regression)
    python scripts/get_json_lint.py --list     # show every call site it finds
    python scripts/get_json_lint.py --update   # re-record after a reduction
"""

from __future__ import annotations

import argparse
import ast
import json
import os
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
BASELINE_PATH = REPO_ROOT / "scripts" / "get_json_lint.baseline.json"

SCAN_ROOTS = ["oneirodex"]


def _read_source(path: Path) -> str:
    """Read Python as text, tolerating a notepad-saved BOM (utf-8 raises on it)."""
    return path.read_text(encoding="utf-8-sig")


def iter_python_files(root: Path):
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = [
            d
            for d in dirnames
            if d not in {"__pycache__", "node_modules", "static", "migrations"}
        ]
        for name in sorted(filenames):
            if name.endswith(".py"):
                yield Path(dirpath) / name


def _iter_target_files():
    for root in SCAN_ROOTS:
        yield from iter_python_files(REPO_ROOT / root)


def _get_json_call_lines(tree: ast.AST) -> list[int]:
    """Line numbers of every ``request.get_json(...)`` call in the tree."""
    lines: list[int] = []
    for node in ast.walk(tree):
        if not isinstance(node, ast.Call) or not isinstance(node.func, ast.Attribute):
            continue
        if node.func.attr != "get_json":
            continue
        if isinstance(node.func.value, ast.Name) and node.func.value.id == "request":
            lines.append(node.lineno)
    return sorted(lines)


def count_get_json_calls(path: Path) -> int:
    """Single-file count. Takes any path (the tests hand it temp files)."""
    try:
        tree = ast.parse(_read_source(path))
    except (SyntaxError, UnicodeDecodeError):
        return 0
    return len(_get_json_call_lines(tree))


def scan(details: dict[str, list[int]] | None = None) -> dict[str, int]:
    counts: dict[str, int] = {}
    seen: set[str] = set()
    for path in _iter_target_files():
        rel = path.relative_to(REPO_ROOT).as_posix()
        if rel in seen:
            continue
        seen.add(rel)
        try:
            tree = ast.parse(_read_source(path))
        except (SyntaxError, UnicodeDecodeError):
            continue
        found = _get_json_call_lines(tree)
        if found:
            counts[rel] = len(found)
            if details is not None:
                details[rel] = found
    return counts


def read_baseline() -> dict[str, int]:
    if not BASELINE_PATH.is_file():
        return {}
    return json.loads(BASELINE_PATH.read_text(encoding="utf-8"))


def compare(counts: dict[str, int], baseline: dict[str, int]):
    regressions, improvements = [], []
    for file, found in sorted(counts.items()):
        allowed = baseline.get(file, 0)
        if found > allowed:
            regressions.append((file, found, allowed))
        elif found < allowed:
            improvements.append((file, found, allowed))
    for file, allowed in sorted(baseline.items()):
        if file not in counts and allowed:
            improvements.append((file, 0, allowed))
    return regressions, improvements


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--update", action="store_true", help="re-record the baseline")
    parser.add_argument(
        "--list", action="store_true", help="print every call site it finds"
    )
    args = parser.parse_args()

    details: dict[str, list[int]] = {}
    counts = scan(details)
    total = sum(counts.values())

    if args.list:
        for file in sorted(details):
            print(f"{file}")
            for line in details[file]:
                print(f"  {file}:{line}")
        print(f"\nget_json-lint: {total} call sites across {len(counts)} files.")
        return 0

    if args.update:
        BASELINE_PATH.write_text(
            json.dumps(dict(sorted(counts.items())), indent=2) + "\n",
            encoding="utf-8",
        )
        print(
            f"get_json-lint: recorded {total} existing call sites "
            f"across {len(counts)} files."
        )
        return 0

    baseline = read_baseline()
    regressions, improvements = compare(counts, baseline)

    if regressions:
        print("get_json-lint: new request.get_json() call sites\n")
        for file, found, allowed in regressions:
            print(f"  {file}: {found} > {allowed} allowed")
            for line in details.get(file, []):
                print(f"      {file}:{line}")
        print(
            "\nNew JSON POST/PUT/PATCH bodies use @validate_body / "
            "@validate_batch_body (docs/dev/pydantic-adoption.md).\n"
            "If a reduction elsewhere makes this unavoidable, re-record:\n"
            "  python scripts/get_json_lint.py --update"
        )
        return 1

    if improvements:
        print(
            f"get_json-lint: OK ({total} known call sites, "
            f"{len(improvements)} file(s) below baseline)."
        )
        print("  Baseline can be tightened: python scripts/get_json_lint.py --update")
        return 0

    print(f"get_json-lint: OK ({total} known call sites, none new).")
    return 0


if __name__ == "__main__":
    sys.exit(main())
