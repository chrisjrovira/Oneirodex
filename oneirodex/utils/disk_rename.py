"""Safe rename planning for confirmed game folders (root + top-level media)."""

from __future__ import annotations

import os
import re
from pathlib import Path

from oneirodex.utils.security import is_safe_path

WINDOWS_FORBIDDEN = re.compile(r'[<>:"/\\|?*\x00-\x1f]')
TOP_LEVEL_MEDIA_EXTS = {'.iso', '.img', '.rar', '.zip', '.7z', '.exe'}
LETTER_BUCKET_RE = re.compile(r'^_[a-z#]$', re.IGNORECASE)


def sanitize_fs_name(name: str) -> str:
    cleaned = WINDOWS_FORBIDDEN.sub('', name or '').strip(' .')
    cleaned = re.sub(r'\s+', ' ', cleaned)
    return cleaned or 'Untitled'


def apply_rename_template(template: str, *, title: str, year: str | int | None = None) -> str:
    year_str = '' if year in (None, '') else str(year)
    result = (template or '{title}').replace('{title}', title or '').replace('{year}', year_str)
    result = re.sub(r'\(\s*\)', '', result)
    return sanitize_fs_name(result.strip())


def detect_letter_bucket_parent(game_root: str) -> str | None:
    parent = Path(game_root).parent.name
    if LETTER_BUCKET_RE.match(parent):
        return parent
    return None


def letter_bucket_for_title(title: str) -> str:
    for ch in (title or '').strip():
        if ch.isalpha():
            return f'_{ch.lower()}'
        if ch.isdigit():
            return '_#'
    return '_#'


def build_rename_plan(
    game_root: str,
    *,
    title: str,
    year: str | int | None = None,
    template: str = '{title}',
    rename_root: bool = True,
    rename_top_level_media: bool = False,
    move_letter_bucket: bool = False,
) -> list[dict]:
    """
    Build a list of rename operations (not applied).

    Each item: {kind, from_path, to_path, enabled_default}
    kinds: root_folder | top_level_media | letter_bucket_move
    """
    root = Path(game_root)
    if not root.exists():
        return []

    new_base = apply_rename_template(template, title=title, year=year)
    plan: list[dict] = []

    dest_parent = root.parent
    if move_letter_bucket and detect_letter_bucket_parent(str(root)):
        dest_parent = root.parent.parent / letter_bucket_for_title(new_base)

    new_root = dest_parent / new_base

    if rename_root and new_root.resolve() != root.resolve():
        plan.append({
            'kind': 'root_folder',
            'from_path': str(root),
            'to_path': str(new_root),
        })

    if rename_top_level_media and root.is_dir():
        for entry in root.iterdir():
            if not entry.is_file():
                continue
            if entry.suffix.lower() not in TOP_LEVEL_MEDIA_EXTS:
                continue
            # Only rename when basename loosely matches old folder name
            old_stem = root.name
            if entry.stem.lower().startswith(old_stem.lower()[: min(8, len(old_stem))].lower()) or entry.stem.lower() == old_stem.lower():
                new_name = f'{new_base}{entry.suffix.lower()}'
                # Media stays inside the (possibly renamed) root
                media_parent = new_root if rename_root else root
                plan.append({
                    'kind': 'top_level_media',
                    'from_path': str(entry),
                    'to_path': str(media_parent / new_name),
                })

    return plan


def apply_rename_plan(plan: list[dict], allowed_bases: list[str]) -> list[dict]:
    """
    Apply checked rename operations. Returns per-item results with ok/error.
    Caller must only pass items the user checked.
    """
    results = []
    for item in plan:
        src = item.get('from_path')
        dst = item.get('to_path')
        result = {'from_path': src, 'to_path': dst, 'kind': item.get('kind'), 'ok': False, 'error': None}

        if not src or not dst:
            result['error'] = 'Missing path'
            results.append(result)
            continue

        safe_src, err_src = is_safe_path(src, allowed_bases)
        safe_dst_parent, err_dst = is_safe_path(str(Path(dst).parent), allowed_bases)
        if not safe_src:
            result['error'] = err_src or 'Unsafe source path'
            results.append(result)
            continue
        if not safe_dst_parent:
            result['error'] = err_dst or 'Unsafe destination path'
            results.append(result)
            continue

        if os.path.exists(dst):
            result['error'] = 'Destination already exists'
            results.append(result)
            continue

        try:
            Path(dst).parent.mkdir(parents=True, exist_ok=True)
            os.rename(src, dst)
            result['ok'] = True
        except OSError as exc:
            result['error'] = str(exc)
        results.append(result)

    return results
