"""Library health scoring — missing cover, broken path, metadata gaps, freshness."""

from __future__ import annotations

import os
from datetime import datetime, timezone

from sqlalchemy import select

from gametheca import db
from gametheca.models import Game, Image


def score_game(game: Game) -> dict:
    """Return a 0–100 health score and issue list for one game."""
    issues = []
    deductions = 0

    path = getattr(game, 'full_disk_path', None) or ''
    if not path:
        issues.append({'code': 'missing_path', 'severity': 25})
        deductions += 25
    elif not os.path.exists(path):
        issues.append({'code': 'broken_path', 'severity': 30})
        deductions += 30

    has_cover = False
    if getattr(game, 'cover', None):
        has_cover = True
    else:
        cover = db.session.execute(
            select(Image).filter_by(game_uuid=game.uuid, image_type='cover').limit(1)
        ).scalars().first()
        has_cover = cover is not None
    if not has_cover:
        issues.append({'code': 'missing_cover', 'severity': 15})
        deductions += 15

    igdb_id = getattr(game, 'igdb_id', None)
    if not igdb_id:
        issues.append({'code': 'missing_igdb', 'severity': 10})
        deductions += 10

    if not (getattr(game, 'summary', None) or '').strip():
        issues.append({'code': 'missing_summary', 'severity': 5})
        deductions += 5

    freshness = getattr(game, 'freshness_status', None)
    if freshness in ('behind', 'heuristic_behind'):
        issues.append({'code': 'stale_freshness', 'severity': 10, 'status': freshness})
        deductions += 10
    elif not getattr(game, 'freshness_checked_at', None):
        issues.append({'code': 'never_freshness_checked', 'severity': 5})
        deductions += 5

    score = max(0, 100 - deductions)
    grade = (
        'A' if score >= 90 else
        'B' if score >= 75 else
        'C' if score >= 60 else
        'D' if score >= 40 else
        'F'
    )
    return {
        'uuid': game.uuid,
        'name': game.name,
        'score': score,
        'grade': grade,
        'issues': issues,
    }


def summarize_library_health(limit: int = 200, library_uuid: str | None = None) -> dict:
    query = select(Game).order_by(Game.name.asc())
    if library_uuid:
        query = query.filter(Game.library_uuid == library_uuid)
    games = db.session.execute(query.limit(limit)).scalars().all()

    scored = [score_game(g) for g in games]
    if not scored:
        return {
            'count': 0,
            'average_score': 100,
            'grade_counts': {},
            'top_issues': [],
            'worst': [],
            'checked_at': datetime.now(timezone.utc).isoformat(),
        }

    avg = sum(s['score'] for s in scored) / len(scored)
    grade_counts: dict[str, int] = {}
    issue_counts: dict[str, int] = {}
    for s in scored:
        grade_counts[s['grade']] = grade_counts.get(s['grade'], 0) + 1
        for issue in s['issues']:
            code = issue['code']
            issue_counts[code] = issue_counts.get(code, 0) + 1

    worst = sorted(scored, key=lambda s: s['score'])[:25]
    top_issues = sorted(
        ({'code': k, 'count': v} for k, v in issue_counts.items()),
        key=lambda x: -x['count'],
    )
    return {
        'count': len(scored),
        'average_score': round(avg, 1),
        'grade_counts': grade_counts,
        'top_issues': top_issues,
        'worst': worst,
        'library_uuid': library_uuid,
        'checked_at': datetime.now(timezone.utc).isoformat(),
    }
