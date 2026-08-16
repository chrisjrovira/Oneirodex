#!/usr/bin/env python3
"""API envelope lint for GameTheca routes.

``gametheca/utils/api_response.py`` exists so every JSON response has one shape.
It landed with two route files migrated, and the register recorded the work as
"incremental". Measured a fortnight later the problem had grown from ~699
``jsonify`` call sites across ~72 files to **1194 across 84** — new routes kept
reaching for the old shapes faster than old ones were converted.

Incremental migration against a baseline growing at that rate does not converge.
This is the ratchet that makes it converge, on exactly the model
``css-token-lint.mjs`` already uses here and which took the CSS violations from
2365 to 1305: existing call sites are recorded and tolerated, a file may never
exceed its recorded count, and a file with no record may have none at all.

What counts as a violation
--------------------------
A ``jsonify`` call carrying one of the legacy envelope keys — ``error``,
``message``, ``status``, ``success``, ``ok`` — as a top-level key. Those are the
five competing shapes the helper exists to replace, and the reason the SPA could
not have one error component.

A ``jsonify`` returning *data* (``jsonify(games)``, ``jsonify({'items': …})``)
is not a violation. The envelope is about how success and failure are reported,
not about every JSON response.

Usage
-----
    python scripts/api_envelope_lint.py            # check (exit 1 on regression)
    python scripts/api_envelope_lint.py --update   # re-record after a reduction
"""

from __future__ import annotations

import argparse
import ast
import json
import os
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
BASELINE_PATH = REPO_ROOT / 'scripts' / 'api_envelope_lint.baseline.json'

#: Route trees that should answer through the shared envelope.
SCAN_ROOTS = [
    'gametheca',
]

#: Files that legitimately mention the legacy keys.
EXEMPT = {
    'gametheca/utils/api_response.py',  # defines the envelope, including compat keys
}

LEGACY_KEYS = {'error', 'message', 'status', 'success', 'ok'}


def iter_python_files(root: Path):
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = [
            d for d in dirnames
            if d not in {'__pycache__', 'node_modules', 'static', 'migrations'}
        ]
        for name in sorted(filenames):
            if name.endswith('.py'):
                yield Path(dirpath) / name


def _legacy_keys_in_call(node: ast.Call) -> set[str]:
    """Top-level legacy envelope keys this ``jsonify(...)`` call carries."""
    found: set[str] = set()

    for arg in node.args:
        if isinstance(arg, ast.Dict):
            for key in arg.keys:
                if isinstance(key, ast.Constant) and key.value in LEGACY_KEYS:
                    found.add(key.value)

    # jsonify(error='...') is the same shape written differently.
    for kw in node.keywords:
        if kw.arg in LEGACY_KEYS:
            found.add(kw.arg)

    return found


def count_violations(path: Path) -> int:
    try:
        tree = ast.parse(path.read_text(encoding='utf-8'))
    except (SyntaxError, UnicodeDecodeError):
        return 0

    count = 0
    for node in ast.walk(tree):
        if not isinstance(node, ast.Call):
            continue
        func = node.func
        name = getattr(func, 'id', None) or getattr(func, 'attr', None)
        if name != 'jsonify':
            continue
        if _legacy_keys_in_call(node):
            count += 1
    return count


def scan() -> dict[str, int]:
    counts: dict[str, int] = {}
    for root in SCAN_ROOTS:
        for path in iter_python_files(REPO_ROOT / root):
            rel = path.relative_to(REPO_ROOT).as_posix()
            if rel in EXEMPT:
                continue
            found = count_violations(path)
            if found:
                counts[rel] = found
    return counts


def read_baseline() -> dict[str, int]:
    if not BASELINE_PATH.is_file():
        return {}
    return json.loads(BASELINE_PATH.read_text(encoding='utf-8'))


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
    parser.add_argument('--update', action='store_true', help='re-record the baseline')
    args = parser.parse_args()

    counts = scan()
    total = sum(counts.values())

    if args.update:
        BASELINE_PATH.write_text(
            json.dumps(dict(sorted(counts.items())), indent=2) + '\n', encoding='utf-8'
        )
        print(f'api-envelope-lint: recorded {total} existing call sites across {len(counts)} files.')
        return 0

    baseline = read_baseline()
    regressions, improvements = compare(counts, baseline)

    if regressions:
        print('api-envelope-lint: new legacy-envelope responses\n')
        for file, found, allowed in regressions:
            print(f'  {file}: {found} > {allowed} allowed')
        print(
            '\nUse api_ok()/api_error() from gametheca.utils.api_response.\n'
            'The envelope keeps `error`, `message` and `success` alongside the new\n'
            'fields, so existing callers keep working — migration is additive.'
        )
        return 1

    if improvements:
        print(f'api-envelope-lint: OK ({total} known call sites, '
              f'{len(improvements)} file(s) below baseline).')
        print('  Baseline can be tightened: python scripts/api_envelope_lint.py --update')
        return 0

    print(f'api-envelope-lint: OK ({total} known call sites, none new).')
    return 0


if __name__ == '__main__':
    sys.exit(main())
