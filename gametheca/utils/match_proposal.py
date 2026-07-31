"""Build and optionally persist low-confidence match proposals (sidecar JSON)."""

import json
import os
from datetime import datetime, timezone

from gametheca.utils.match_scoring import rank_candidates
from gametheca.utils.game_name_parse import parse_game_label


PROPOSAL_FILENAME = 'gametheca.proposal.json'
LEGACY_PROPOSAL_FILENAME = 'gametheca.proposal.json'

# Display labels for Unmatched list / export (derived; not stored).
SUGGESTED_KIND_LABELS = {
    'game': 'Game',
    'experience': 'Experience',
    'emulator': 'Emulator',
    'tool': 'Tool',
}

# Deterministic one-liners for UI "Why unmatched?" (no DB / disk I/O).
MATCH_REASON_SUMMARIES = {
    'same_path': 'Same on-disk path as an existing library game',
    'title_vs_folder': 'Folder title matches an existing library game folder',
    'title_vs_library_name': 'Folder title matches an existing library game name',
    'title_below_threshold': 'IGDB already used by a differently titled folder',
}

STATUS_SUMMARIES = {
    'Duplicate': 'Looks like a duplicate of an existing library game',
    'Unmatched': 'Could not auto-match to IGDB',
    'Ignore': 'Folder is ignored',
    'Pending': 'Awaiting classification',
}


def empty_kind_hint() -> dict:
    return {
        'suggested_kind': None,
        'suggested_kind_label': None,
        'suggested_candidate_name': None,
    }


def hint_fields_from_proposal(proposal: dict | None) -> dict:
    """Extract cheap list-hint fields from an in-memory proposal payload.

    Returns suggested_kind (game|experience|emulator|tool|null),
    suggested_kind_label, and suggested_candidate_name (top software hit).
    """
    from gametheca.utils.item_kind import ITEM_KINDS, coerce_item_kind_token

    out = empty_kind_hint()
    if not isinstance(proposal, dict):
        return out
    body = proposal.get('proposal') if 'proposal' in proposal else proposal
    if not isinstance(body, dict):
        return out

    kind = coerce_item_kind_token(body.get('suggested_kind'))
    if kind is None and body.get('suggested_kind') in ITEM_KINDS:
        kind = body.get('suggested_kind')
    # Only surface a kind when the proposal actually set one (incl. default game).
    if kind is None and 'suggested_kind' in body and body.get('suggested_kind'):
        kind = coerce_item_kind_token(str(body.get('suggested_kind')))
    if kind is not None:
        out['suggested_kind'] = kind
        out['suggested_kind_label'] = SUGGESTED_KIND_LABELS.get(kind)

    candidates = body.get('software_candidates') or []
    if isinstance(candidates, list) and candidates:
        top = candidates[0] if isinstance(candidates[0], dict) else None
        if top:
            name = (top.get('name') or '').strip() or None
            out['suggested_candidate_name'] = name
            if out['suggested_kind'] is None:
                top_kind = coerce_item_kind_token(
                    top.get('item_kind') or top.get('suggested_kind')
                )
                if top_kind is not None:
                    out['suggested_kind'] = top_kind
                    out['suggested_kind_label'] = SUGGESTED_KIND_LABELS.get(top_kind)
    return out


def read_proposal_kind_hint(folder_path: str) -> dict:
    """One-file read of proposal sidecar hint fields (for denormalize-at-log)."""
    path = resolve_proposal_path(folder_path)
    if not path:
        return empty_kind_hint()
    try:
        with open(path, encoding='utf-8') as handle:
            data = json.load(handle)
    except (OSError, json.JSONDecodeError, TypeError):
        return empty_kind_hint()
    return hint_fields_from_proposal(data)


def sync_unmatched_kind_hint(folder_path: str, proposal: dict | None = None) -> bool:
    """Denormalize suggested_kind (+ candidate name) onto UnmatchedFolder by path.

    Prefer calling after write_match_proposal or from log_unmatched_folder so the
    list API never N+1-reads sidecars. Returns True when a row was updated.
    """
    if not folder_path:
        return False
    from sqlalchemy import select

    from gametheca import db
    from gametheca.models import UnmatchedFolder

    hint = (
        hint_fields_from_proposal(proposal)
        if proposal is not None
        else read_proposal_kind_hint(folder_path)
    )
    folder = db.session.execute(
        select(UnmatchedFolder).filter_by(folder_path=folder_path)
    ).scalar_one_or_none()
    if folder is None:
        return False
    folder.suggested_kind = hint.get('suggested_kind')
    folder.suggested_candidate_name = hint.get('suggested_candidate_name')
    try:
        db.session.commit()
    except Exception:
        db.session.rollback()
        return False
    return True


def backfill_unmatched_suggested_kind(
    *,
    limit: int | None = None,
    dry_run: bool = False,
) -> dict:
    """One-shot: fill null UnmatchedFolder.suggested_kind from proposal sidecars.

    Admin/CLI-safe. Idempotent — rows that already have suggested_kind are skipped.
    Sidecar reads happen only for null-hint candidates (no list-endpoint N+1).
    Single commit when writing. Returns count summary.
    """
    from sqlalchemy import select

    from gametheca import db
    from gametheca.models import UnmatchedFolder

    query = (
        select(UnmatchedFolder)
        .filter(UnmatchedFolder.suggested_kind.is_(None))
        .order_by(UnmatchedFolder.failed_time.desc())
    )
    if limit is not None:
        try:
            lim = int(limit)
        except (TypeError, ValueError):
            lim = 0
        if lim > 0:
            query = query.limit(lim)

    rows = list(db.session.execute(query).scalars().all())
    scanned = len(rows)
    updated = 0
    skipped_no_sidecar = 0
    skipped_empty_hint = 0

    for folder in rows:
        path = folder.folder_path or ''
        if not resolve_proposal_path(path):
            skipped_no_sidecar += 1
            continue
        hint = read_proposal_kind_hint(path)
        kind = hint.get('suggested_kind')
        candidate = hint.get('suggested_candidate_name')
        if kind is None and candidate is None:
            skipped_empty_hint += 1
            continue
        updated += 1
        if dry_run:
            continue
        if kind is not None:
            folder.suggested_kind = kind
        if candidate is not None:
            folder.suggested_candidate_name = candidate

    committed = False
    if not dry_run and updated:
        try:
            db.session.commit()
            committed = True
        except Exception:
            db.session.rollback()
            return {
                'ok': False,
                'scanned': scanned,
                'updated': 0,
                'skipped_no_sidecar': skipped_no_sidecar,
                'skipped_empty_hint': skipped_empty_hint,
                'dry_run': False,
                'committed': False,
                'error': 'commit_failed',
            }

    return {
        'ok': True,
        'scanned': scanned,
        'updated': updated,
        'skipped_no_sidecar': skipped_no_sidecar,
        'skipped_empty_hint': skipped_empty_hint,
        'dry_run': bool(dry_run),
        'committed': committed,
    }


def format_why_unmatched(
    *,
    status: str | None = None,
    match_reason: str | None = None,
    match_score: float | None = None,
    suggested_kind: str | None = None,
    suggested_kind_label: str | None = None,
    suggested_candidate_name: str | None = None,
    folder_name: str | None = None,
) -> str:
    """Cheap deterministic one-line explainer for Unmatched list/detail rows."""
    reason_key = (match_reason or '').strip()
    base = MATCH_REASON_SUMMARIES.get(reason_key)
    if not base:
        status_key = (status or '').strip()
        base = STATUS_SUMMARIES.get(status_key) or (
            f'Status: {status_key}' if status_key else 'Unmatched folder'
        )

    parts = [base]
    if match_score is not None:
        try:
            parts[0] = f'{base} (score {float(match_score):.2f})'
        except (TypeError, ValueError):
            pass

    kind = (suggested_kind or '').strip().lower() or None
    label = (suggested_kind_label or '').strip() or (
        SUGGESTED_KIND_LABELS.get(kind) if kind else None
    )
    candidate = (suggested_candidate_name or '').strip() or None
    if label and candidate:
        parts.append(f'suggested {label}: {candidate}')
    elif label:
        parts.append(f'suggested {label}')
    elif candidate:
        parts.append(f'suggested: {candidate}')

    name = (folder_name or '').strip()
    # Prefix with folder basename only when it adds context and is short enough.
    if name and len(name) <= 80:
        return f'{name} — ' + '; '.join(parts)
    return '; '.join(parts)


def resolve_proposal_path(folder_path: str) -> str | None:
    """Return path to an existing proposal sidecar (new or legacy), or None."""
    if not folder_path:
        return None
    primary = os.path.join(folder_path, PROPOSAL_FILENAME)
    if os.path.isfile(primary):
        return primary
    legacy = os.path.join(folder_path, LEGACY_PROPOSAL_FILENAME)
    if os.path.isfile(legacy):
        return legacy
    return None


def remove_proposal_files(folder_path: str) -> None:
    """Remove new and legacy proposal sidecars if present."""
    if not folder_path:
        return
    for name in (PROPOSAL_FILENAME, LEGACY_PROPOSAL_FILENAME):
        path = os.path.join(folder_path, name)
        try:
            if os.path.isfile(path):
                os.remove(path)
        except OSError:
            pass


def build_match_proposal(
    raw_label: str,
    candidates: list[dict],
    *,
    steam_title: str | None = None,
    confidence: str = 'low',
    software_candidates: list[dict] | None = None,
    suggested_kind: str | None = None,
) -> dict:
    """Create a proposal payload from a folder label and IGDB candidate list.

    `confidence` defaults to 'low' (the normal ambiguous-match case) but callers
    such as the propose-only scan mode pass 'high' when a confident match was
    found but auto-import was skipped by policy.

    Optional software_candidates / suggested_kind enrich Unmatched review when
    IGDB has no Main Game hit (Steam software / emulator / tool path).
    """
    from gametheca.utils.item_kind import DEFAULT_ITEM_KIND, normalize_item_kind

    parsed = parse_game_label(raw_label)
    cleaned = parsed['cleaned_name'] or raw_label
    ranked = rank_candidates(cleaned, candidates, steam_title=steam_title)
    body = {
        'cleaned_name': cleaned,
        'steam_app_id': parsed.get('steam_app_id'),
        'had_vr_suffix': bool(parsed.get('had_vr_suffix')),
        'candidates': [
            {
                'igdb_id': c.get('id'),
                'name': c.get('name'),
                'score': round(float(c.get('match_score') or 0), 4),
            }
            for c in ranked[:10]
        ],
        'confidence': confidence,
        'proposed_at': datetime.now(timezone.utc).isoformat(),
        'suggested_kind': normalize_item_kind(suggested_kind) if suggested_kind else DEFAULT_ITEM_KIND,
    }
    if software_candidates is not None:
        body['software_candidates'] = software_candidates
        body['identify_path'] = 'software' if software_candidates else 'igdb'
    return {'proposal': body}


def write_match_proposal(folder_path: str, proposal: dict, filename: str = PROPOSAL_FILENAME) -> bool:
    """Write proposal JSON into a game folder. Returns True on success."""
    if not folder_path or not os.path.isdir(folder_path):
        return False
    if not isinstance(proposal, dict) or 'proposal' not in proposal:
        return False
    target = os.path.join(folder_path, filename)
    try:
        with open(target, 'w', encoding='utf-8') as handle:
            json.dump(proposal, handle, indent=2, ensure_ascii=False)
        return True
    except OSError:
        return False
