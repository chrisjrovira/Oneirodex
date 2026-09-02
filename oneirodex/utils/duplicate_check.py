"""Decide when a same-IGDB hit is a true duplicate vs a different folder."""

from __future__ import annotations

import os
import re
from typing import Any

from oneirodex.utils.game_name_parse import parse_game_label
from oneirodex.utils.match_scoring import score_candidate

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


def explain_duplicate_match(
    existing_game,
    new_full_disk_path: str,
    new_raw_name: str | None = None,
    *,
    title_threshold: float = DEFAULT_TITLE_THRESHOLD,
) -> dict[str, Any]:
    """
    Return a structured match explanation for UI glance + fix logging.

    Keys: is_duplicate, match_reason (short code), match_score, matched_game_uuid,
    threshold, transforms (ordered Stage A peels for the new folder label)
    """
    existing_uuid = getattr(existing_game, 'uuid', None)
    existing_path = getattr(existing_game, 'full_disk_path', None) or ''
    existing_norm = normalize_disk_path(existing_path)
    new_norm = normalize_disk_path(new_full_disk_path)

    if existing_norm and new_norm and existing_norm == new_norm:
        label = new_raw_name or folder_basename(new_full_disk_path)
        return {
            'is_duplicate': True,
            'match_reason': 'same_path',
            'match_score': 1.0,
            'matched_game_uuid': existing_uuid,
            'threshold': title_threshold,
            'transforms': list(parse_game_label(label).get('transforms') or []),
        }

    new_label = new_raw_name or folder_basename(new_full_disk_path)
    existing_label = folder_basename(existing_path) or (getattr(existing_game, 'name', None) or '')

    new_parsed = parse_game_label(new_label)
    new_cleaned = new_parsed.get('cleaned_name') or new_label
    existing_cleaned = parse_game_label(existing_label).get('cleaned_name') or existing_label
    library_name = getattr(existing_game, 'name', None) or ''
    transforms = list(new_parsed.get('transforms') or [])

    score_vs_folder = score_candidate(new_cleaned, existing_cleaned)
    score_vs_library = score_candidate(new_cleaned, library_name) if library_name else 0.0
    best = max(score_vs_folder, score_vs_library)
    reason = 'title_vs_folder' if score_vs_folder >= score_vs_library else 'title_vs_library_name'
    is_dup = best >= title_threshold
    return {
        'is_duplicate': is_dup,
        'match_reason': reason if is_dup else 'title_below_threshold',
        'match_score': round(float(best), 4),
        'matched_game_uuid': existing_uuid if is_dup else None,
        'threshold': title_threshold,
        'score_vs_folder': round(float(score_vs_folder), 4),
        'score_vs_library': round(float(score_vs_library), 4),
        'transforms': transforms,
    }


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
    return bool(
        explain_duplicate_match(
            existing_game,
            new_full_disk_path,
            new_raw_name,
            title_threshold=title_threshold,
        )['is_duplicate']
    )
