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

Indirect envelopes (2026-08-16)
-------------------------------
Originally only a ``jsonify({...})`` **dict literal** was inspected, so an
envelope assembled anywhere else was invisible::

    result = attach_patch_guide(...)   # returns {'ok': True, ...}
    return jsonify(result), 201        # counted as zero

That is not academic: it is how ``routes_apis/patch_catalog.py`` was recorded as
migrated (6 → 2) while its main success path still hand-rolled the envelope, and
how ``routes_apis/wishlist.py`` left the baseline entirely with three such
returns still in it. A ratchet whose number is optimistic steers every wave that
reads it, so the number has to be honest before it is worth chasing.

Two indirect forms are resolved now, both chosen because they resolve with
certainty rather than by guessing:

* ``name = {...}`` in the same function, then ``jsonify(name)``
* ``jsonify(f())`` / ``name = f()`` then ``jsonify(name)``, where ``f`` is a
  **bare function** either defined in the same file or imported from inside the
  scanned tree with an absolute ``from x.y import f``, and ``f`` returns a dict
  literal carrying legacy keys.

Deliberately *not* resolved: attribute calls like ``obj.to_dict()``. They cannot
be tied to one definition — the tree has many ``to_dict`` methods — and most
carry a ``status`` that is genuine data (a scan's state, a ticket's state), not
an envelope. Guessing there would produce false positives, and a lint that cries
wolf gets ``--update``-ed away, which is the one outcome that breaks the ratchet.

Note the same imprecision already applies to dict literals: ``status`` is a real
field name as well as an envelope key, so a handful of recorded call sites are
data rather than envelopes. That is what the baseline is for — they are tolerated
and, more to the point, they can no longer grow.

Usage
-----
    python scripts/api_envelope_lint.py            # check (exit 1 on regression)
    python scripts/api_envelope_lint.py --list     # show every call site it finds
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


def _read_source(path: Path) -> str:
    """Read Python as text. ``utf-8-sig`` drops a BOM so a notepad-saved
    route file cannot vanish from the ratchet (``utf-8`` raises SyntaxError
    on ``\\ufeff``, which this script used to swallow as count 0).
    """
    return path.read_text(encoding='utf-8-sig')


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


def find_double_wrapped_envelopes(tree: ast.Module) -> list[tuple[int, str]]:
    """``return api_ok(...), 200`` — a status literal after a helper call.

    Both helpers already return ``(response, status)``, so a trailing literal
    nests the tuple and Flask rejects the response. Like the discarded case this
    is never legitimate, and neither the compiler nor the envelope count sees
    it: the call is well-formed and carries no legacy key.

    Also caught the hard way, twice, converting multi-line dict literals where
    the closing ``}), 200`` survives the rewrite.
    """
    found: list[tuple[int, str]] = []
    for node in ast.walk(tree):
        if not isinstance(node, ast.Return) or not isinstance(node.value, ast.Tuple):
            continue
        parts = node.value.elts
        if len(parts) != 2 or not isinstance(parts[0], ast.Call):
            continue
        name = getattr(parts[0].func, 'id', None) or getattr(parts[0].func, 'attr', None)
        if name in ('api_ok', 'api_error') and isinstance(parts[1], ast.Constant):
            found.append((node.lineno, name))
    return found


def find_discarded_envelopes(tree: ast.Module) -> list[tuple[int, str]]:
    """``api_ok(...)`` / ``api_error(...)`` whose return value is thrown away.

    Never legitimate: both build a response and return it, so a call in
    statement position means the handler computed a refusal and then carried on
    with the input it was refusing. This is not baselined — it is always a bug.

    Found the hard way. A migration regex consumed the `return` on eleven
    guards in one file; exactly one of them had a test covering that path, so
    the suite reported a single failure for eleven broken validators.
    """
    found: list[tuple[int, str]] = []
    for node in ast.walk(tree):
        if not isinstance(node, ast.Expr) or not isinstance(node.value, ast.Call):
            continue
        name = getattr(node.value.func, 'id', None) or getattr(node.value.func, 'attr', None)
        if name in ('api_ok', 'api_error'):
            found.append((node.lineno, name))
    return found


def _dict_legacy_keys(node: ast.AST) -> set[str]:
    """Top-level legacy keys in a dict *literal*."""
    if not isinstance(node, ast.Dict):
        return set()
    return {
        key.value
        for key in node.keys
        if isinstance(key, ast.Constant) and key.value in LEGACY_KEYS
    }


def _module_functions(tree: ast.Module) -> dict[str, ast.AST]:
    """Top-level ``def``s — the ones another module can import by name."""
    return {
        node.name: node
        for node in tree.body
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef))
    }


def _returns_legacy_keys(fn: ast.AST) -> set[str]:
    """Legacy keys in any dict literal this function returns."""
    literals: dict[str, set[str]] = {}
    for node in ast.walk(fn):
        if isinstance(node, ast.Assign) and isinstance(node.value, ast.Dict):
            keys = _dict_legacy_keys(node.value)
            for target in node.targets:
                if isinstance(target, ast.Name):
                    literals[target.id] = keys

    found: set[str] = set()
    for node in ast.walk(fn):
        if isinstance(node, ast.Return) and node.value is not None:
            found |= _dict_legacy_keys(node.value)
            if isinstance(node.value, ast.Name):
                found |= literals.get(node.value.id, set())
    return found


def _load_modules() -> dict[str, tuple[str, ast.Module]]:
    """Dotted module name -> (repo-relative path, parsed tree)."""
    modules: dict[str, tuple[str, ast.Module]] = {}
    for root in SCAN_ROOTS:
        for path in iter_python_files(REPO_ROOT / root):
            rel = path.relative_to(REPO_ROOT).as_posix()
            try:
                tree = ast.parse(_read_source(path))
            except (SyntaxError, UnicodeDecodeError):
                continue
            dotted = rel[:-3].replace('/', '.')
            if dotted.endswith('.__init__'):
                dotted = dotted[: -len('.__init__')]
            modules[dotted] = (rel, tree)
    return modules


def _find_violations(tree: ast.Module,
                     modules: dict[str, tuple[str, ast.Module]]) -> list[tuple[int, str]]:
    """Every offending ``jsonify`` in one file, as (line, why).

    ``modules`` may be empty — cross-module resolution simply finds nothing then,
    which is what ``count_violations`` relies on for standalone files.
    """
    here = _module_functions(tree)

    imported: dict[str, tuple[str, str]] = {}
    for node in ast.walk(tree):
        # level 0 only: an absolute `from x.y import f`. Relative imports are
        # left unresolved on purpose — conservative beats wrong here.
        if isinstance(node, ast.ImportFrom) and node.module and node.level == 0:
            for alias in node.names:
                imported[alias.asname or alias.name] = (node.module, alias.name)

    def resolve_call(call: ast.Call) -> tuple[set[str], str]:
        """Legacy keys a *bare* function call returns, if it resolves."""
        if not isinstance(call.func, ast.Name):
            return set(), ''          # obj.to_dict() — not resolvable, see docstring
        name = call.func.id
        if name in here:
            return _returns_legacy_keys(here[name]), f'{name}() in this file'
        if name in imported:
            module, original = imported[name]
            if module in modules:
                target = _module_functions(modules[module][1]).get(original)
                if target is not None:
                    return _returns_legacy_keys(target), f'{name}() from {module}'
        return set(), ''

    found: list[tuple[int, str]] = []
    for scope in ast.walk(tree):
        if not isinstance(scope, (ast.FunctionDef, ast.AsyncFunctionDef)):
            continue
        assigned: dict[str, ast.AST] = {}
        for node in ast.walk(scope):
            if isinstance(node, ast.Assign):
                for target in node.targets:
                    if isinstance(target, ast.Name):
                        assigned[target.id] = node.value

        for node in ast.walk(scope):
            if not isinstance(node, ast.Call):
                continue
            called = getattr(node.func, 'id', None) or getattr(node.func, 'attr', None)
            if called != 'jsonify':
                continue

            direct = _legacy_keys_in_call(node)
            if direct:
                found.append((node.lineno, f'literal {sorted(direct)}'))
                continue

            for arg in node.args:
                keys, why = set(), ''
                if isinstance(arg, ast.Name):
                    source = assigned.get(arg.id)
                    if isinstance(source, ast.Dict):
                        keys, why = _dict_legacy_keys(source), f'{arg.id} = {{...}}'
                    elif isinstance(source, ast.Call):
                        keys, why = resolve_call(source)
                        if why:
                            why = f'{arg.id} = {why}'
                elif isinstance(arg, ast.Call):
                    keys, why = resolve_call(arg)
                if keys:
                    found.append((node.lineno, f'{why} -> {sorted(keys)}'))
                    break

    return sorted(set(found))


def count_violations(path: Path) -> int:
    """Single-file count.

    Takes any path, in or out of the repo — the tests hand it temp files. Only
    cross-module resolution is unavailable here; same-file forms still count.
    """
    try:
        tree = ast.parse(_read_source(path))
    except (SyntaxError, UnicodeDecodeError):
        return 0
    return len(_find_violations(tree, {}))


def scan(details: dict[str, list[tuple[int, str]]] | None = None) -> dict[str, int]:
    modules = _load_modules()
    counts: dict[str, int] = {}
    for _, (rel, tree) in sorted(modules.items()):
        if rel in EXEMPT:
            continue
        found = _find_violations(tree, modules)
        if found:
            counts[rel] = len(found)
            if details is not None:
                details[rel] = found
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
    parser.add_argument('--list', action='store_true',
                        help='print every call site found, with why it counted')
    args = parser.parse_args()

    details: dict[str, list[tuple[int, str]]] = {}
    counts = scan(details)
    total = sum(counts.values())

    # Hard failure, never baselined: a built-then-discarded envelope means the
    # handler refused the request and then went on to honour it anyway.
    misuse: list[str] = []
    for _, (rel, tree) in sorted(_load_modules().items()):
        for line, name in find_discarded_envelopes(tree):
            misuse.append(f'  {rel}:{line}  {name}(...) result is discarded - missing `return`?')
        for line, name in find_double_wrapped_envelopes(tree):
            misuse.append(f'  {rel}:{line}  {name}(...), <status> - the tuple is already built')
    if misuse:
        print('api-envelope-lint: envelope helper misused\n')
        print('\n'.join(misuse))
        print('\nBoth helpers build a response *and* return it, as `(body, status)`.\n'
              'Discarding that, or appending a second status to it, is always a bug —\n'
              'and neither the compiler nor the call-site count will tell you.')
        return 1

    if args.list:
        for file in sorted(details):
            print(f'{file}')
            for line, why in details[file]:
                print(f'  {file}:{line}  {why}')
        print(f'\napi-envelope-lint: {total} call sites across {len(counts)} files.')
        return 0

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
            # Indirect envelopes are assembled away from the jsonify() line, so
            # a bare count sends you hunting. Say which line and why it counted.
            for line, why in details.get(file, []):
                print(f'      {file}:{line}  {why}')
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
