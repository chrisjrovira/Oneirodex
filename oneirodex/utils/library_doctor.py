"""Library doctor: batch dry-run / write proposals for recognition + rename."""

from __future__ import annotations

import os
import re
from pathlib import Path

from oneirodex.utils.game_name_parse import parse_game_label
from oneirodex.utils.disk_rename import build_rename_plan, apply_rename_template
from oneirodex.utils.match_proposal import build_match_proposal, write_match_proposal

LETTER_BUCKET_RE = re.compile(r'^_[a-z#]$', re.IGNORECASE)


def iter_game_folders(root: str) -> list[str]:
    """
    Yield game folder paths under root.
    Letter buckets (_a … _z, _#) are containers; their children are games.
    """
    root_path = Path(root)
    if not root_path.is_dir():
        return []

    results = []
    for entry in sorted(root_path.iterdir(), key=lambda p: p.name.lower()):
        if not entry.is_dir():
            continue
        if LETTER_BUCKET_RE.match(entry.name):
            for child in sorted(entry.iterdir(), key=lambda p: p.name.lower()):
                if child.is_dir():
                    results.append(str(child))
        else:
            results.append(str(entry))
    return results


def dry_run_folder(folder_path: str, *, template: str = '{title}', year=None) -> dict:
    """Build a doctor report row for one folder (no network)."""
    raw = Path(folder_path).name
    parsed = parse_game_label(raw)
    title = parsed['cleaned_name'] or raw
    suggested = apply_rename_template(template, title=title, year=year)
    rename_plan = build_rename_plan(
        folder_path,
        title=title,
        year=year,
        template=template,
        rename_root=True,
        rename_top_level_media=False,
        move_letter_bucket=False,
    )
    return {
        'path': folder_path,
        'raw_name': raw,
        'cleaned_name': title,
        'steam_app_id': parsed.get('steam_app_id'),
        'suggested_rename': suggested,
        'rename_plan': rename_plan,
    }


def doctor_dry_run(roots: list[str], *, template: str = '{title}', limit: int | None = None) -> list[dict]:
    rows = []
    for root in roots:
        for folder in iter_game_folders(root):
            rows.append(dry_run_folder(folder, template=template))
            if limit is not None and len(rows) >= limit:
                return rows
    return rows


def doctor_write_proposals(rows: list[dict], *, candidates_by_path: dict[str, list] | None = None) -> list[dict]:
    """
    Write oneirodex.proposal.json for selected rows.
    candidates_by_path maps folder path → IGDB candidate list (optional).
    """
    results = []
    candidates_by_path = candidates_by_path or {}
    for row in rows:
        path = row.get('path')
        cands = candidates_by_path.get(path) or []
        payload = build_match_proposal(row.get('raw_name') or Path(path).name, cands)
        ok = write_match_proposal(path, payload) if path and os.path.isdir(path) else False
        results.append({'path': path, 'ok': ok})
    return results


def doctor_apply_renames(rows: list[dict], allowed_bases: list[str], *, template: str = '{title}') -> list[dict]:
    """
    Apply root-folder renames for checked doctor rows using the rename planner.
    Each row needs 'path' and optionally 'cleaned_name' / 'suggested_rename'.
    """
    from oneirodex.utils.disk_rename import apply_rename_plan

    results = []
    for row in rows:
        path = row.get('path')
        if not path or not os.path.isdir(path):
            results.append({'path': path, 'ok': False, 'error': 'Missing folder'})
            continue
        title = row.get('cleaned_name') or Path(path).name
        plan = build_rename_plan(
            path,
            title=title,
            year=row.get('year'),
            template=template,
            rename_root=True,
            rename_top_level_media=bool(row.get('rename_top_level_media')),
            move_letter_bucket=bool(row.get('move_letter_bucket')),
        )
        # Only apply items explicitly allowed via row flags (default root only)
        applied = apply_rename_plan(plan, allowed_bases)
        results.append({'path': path, 'ok': all(r.get('ok') for r in applied) if applied else True, 'results': applied})
    return results
