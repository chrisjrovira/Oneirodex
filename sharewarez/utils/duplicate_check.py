"""Decide when a same-IGDB hit is a true duplicate vs a different folder."""

from __future__ import annotations

import os
import re

from sharewarez.utils.game_name_parse import parse_game_label
from sharewarez.utils.match_scoring import score_candidate

# Folder titles must be this similar to call same-IGDB a "Duplicate".
# Below this → treat as Unmatched (different packaging / remaster / bad match).
DEFAULT_TITLE_THRESHOLD = 0.85


def normalize_disk_path(path: str | None) -> str:
    if not path:
        return ''
    cleaned = path.replace('\\', '/').rstrip('/')
    try:
        cleaned = os.path.normcase(os.path.abspath(cleaned))
    except (OSError, ValueError):
        cleaned = os.path.normcase(cleaned)
    # Collapse duplicate slashes
    return re.sub(r'/+', '/', cleaned)


def folder_basename(path: str | None) -> str:
    if not path:
        return ''
    return os.path.basename(path.replace('\\', '/').rstrip('/'))


def should_mark_as_duplicate(
    existing_game,
    new_full_disk_path: str,
    new_raw_name: str | None = None,
    *,
    title_threshold: float = DEFAULT_TITLE_THRESHOLD,
) -> bool:
    """
    True only when the new folder is effectively the same title/path as an
    existing library game that already owns this IGDB ID.

    False when the IGDB ID collides but the folder looks like a different
    package (e.g. "Alan Wake Complete Collection" vs "Alan Wake") — those
    should stay Unmatched for human review / link-existing, not "Duplicate".
    """
    existing_path = getattr(existing_game, 'full_disk_path', None) or ''
    if normalize_disk_path(existing_path) and normalize_disk_path(existing_path) == normalize_disk_path(
        new_full_disk_path
    ):
        return True

    new_label = new_raw_name or folder_basename(new_full_disk_path)
    existing_label = folder_basename(existing_path) or (getattr(existing_game, 'name', None) or '')

    new_cleaned = parse_game_label(new_label).get('cleaned_name') or new_label
    existing_cleaned = parse_game_label(existing_label).get('cleaned_name') or existing_label
    library_name = getattr(existing_game, 'name', None) or ''

    score_vs_folder = score_candidate(new_cleaned, existing_cleaned)
    score_vs_library = score_candidate(new_cleaned, library_name) if library_name else 0.0
    return max(score_vs_folder, score_vs_library) >= title_threshold
