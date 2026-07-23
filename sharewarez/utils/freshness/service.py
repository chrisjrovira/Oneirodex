"""Orchestrate local + store freshness check and persist on Game."""

from __future__ import annotations

from datetime import datetime, timezone

from sharewarez.utils.freshness.compare import compare_freshness
from sharewarez.utils.freshness.epic import fetch_epic_remote
from sharewarez.utils.freshness.gog import fetch_gog_remote
from sharewarez.utils.freshness.ids import (
    resolve_epic_identity,
    resolve_gog_identity,
    resolve_steam_app_id,
)
from sharewarez.utils.freshness.local import detect_local_facts
from sharewarez.utils.freshness.steam import fetch_steam_remote


def check_game_freshness(game, *, include_gog=True, include_epic=True) -> dict:
    """Run sensors + remotes and return comparison payload (does not commit)."""
    local = detect_local_facts(game)
    remotes = []

    steam_id = resolve_steam_app_id(game)
    if steam_id:
        remotes.append(fetch_steam_remote(steam_id))
    else:
        remotes.append({
            'store': 'steam',
            'ok': False,
            'error': 'missing_app_id',
            'version': None,
            'dlc_count': None,
        })

    if include_gog:
        gog_id = resolve_gog_identity(game)
        if gog_id:
            remotes.append(fetch_gog_remote(**gog_id))
        else:
            remotes.append({
                'store': 'gog',
                'ok': False,
                'error': 'missing_gog_identity',
                'version': None,
            })

    if include_epic:
        epic_id = resolve_epic_identity(game)
        if epic_id:
            remotes.append(fetch_epic_remote(**epic_id))
        else:
            remotes.append({
                'store': 'epic',
                'ok': False,
                'error': 'missing_epic_identity',
                'version': None,
                'note': 'No Epic URL on this game.',
            })

    return compare_freshness(local, remotes)


def apply_freshness_to_game(game, payload: dict) -> dict:
    """Write freshness fields onto the Game instance (caller commits)."""
    now = datetime.now(timezone.utc)
    game.local_version = payload.get('local_version')
    game.remote_version_summary = payload.get('remote_version_summary')
    game.freshness_status = payload.get('status')
    game.freshness_confidence = payload.get('confidence')
    game.freshness_checked_at = now
    game.freshness_payload = payload

    steam = next(
        (r for r in (payload.get('remotes') or []) if r.get('store') == 'steam' and r.get('app_id')),
        None,
    )
    if steam and steam.get('app_id'):
        game.steam_app_id = int(steam['app_id'])
    else:
        resolved = resolve_steam_app_id(game)
        if resolved:
            game.steam_app_id = resolved

    return freshness_public_view(game)


def check_and_store_freshness(game, *, commit=False, db_session=None) -> dict:
    payload = check_game_freshness(game)
    public = apply_freshness_to_game(game, payload)
    if commit and db_session is not None:
        db_session.commit()
    return public


def freshness_public_view(game) -> dict:
    """Safe JSON for APIs / browse badges."""
    payload = getattr(game, 'freshness_payload', None) or {}
    return {
        'status': getattr(game, 'freshness_status', None),
        'confidence': getattr(game, 'freshness_confidence', None),
        'checked_at': (
            game.freshness_checked_at.isoformat()
            if getattr(game, 'freshness_checked_at', None)
            else None
        ),
        'local_version': getattr(game, 'local_version', None),
        'remote_version_summary': getattr(game, 'remote_version_summary', None),
        'steam_app_id': getattr(game, 'steam_app_id', None),
        'dlc': payload.get('dlc'),
        'reasons': payload.get('reasons'),
        'remotes': payload.get('remotes'),
        'local': payload.get('local'),
    }
