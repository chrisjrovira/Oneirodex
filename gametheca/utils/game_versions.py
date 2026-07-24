"""List downloadable versions for a game (base + updates + extras)."""

from __future__ import annotations

import os
from typing import Any

from sqlalchemy import select

from gametheca import db
from gametheca.models import Game, GameExtra, GameUpdate


def _basename_label(path: str, fallback: str) -> str:
    name = os.path.basename(path.rstrip('\\/')) if path else ''
    return name or fallback


def list_game_versions(game: Game) -> list[dict[str, Any]]:
    """Return selectable download versions for the game."""
    versions: list[dict[str, Any]] = [
        {
            'kind': 'base',
            'id': game.uuid,
            'uuid': game.uuid,
            'label': 'Base game',
            'is_default': True,
            'file_path': game.full_disk_path,
            'size': game.size,
        }
    ]

    updates = db.session.execute(
        select(GameUpdate).filter_by(game_uuid=game.uuid).order_by(GameUpdate.created_at.desc())
    ).scalars().all()
    for update in updates:
        versions.append(
            {
                'kind': 'update',
                'id': update.uuid,
                'uuid': update.uuid,
                'label': f'Update: {_basename_label(update.file_path, update.uuid[:8])}',
                'is_default': False,
                'file_path': update.file_path,
                'size': None,
            }
        )

    extras = db.session.execute(
        select(GameExtra).filter_by(game_uuid=game.uuid).order_by(GameExtra.created_at.desc())
    ).scalars().all()
    for extra in extras:
        versions.append(
            {
                'kind': 'extra',
                'id': extra.uuid,
                'uuid': extra.uuid,
                'label': f'Extra: {_basename_label(extra.file_path, extra.uuid[:8])}',
                'is_default': False,
                'file_path': extra.file_path,
                'size': None,
            }
        )

    return versions


def resolve_version_file(
    game: Game,
    *,
    kind: str | None = None,
    version_uuid: str | None = None,
) -> tuple[str, str, str | None]:
    """
    Resolve (file_location, zip_file_path_hint, version_uuid) for a download.

    kind: base | update | extra (default base)
    """
    kind = (kind or 'base').strip().lower()
    if kind in ('', 'base', 'game'):
        return game.full_disk_path, game.full_disk_path, None

    if not version_uuid:
        raise ValueError('version_uuid required for update/extra downloads')

    if kind == 'update':
        row = db.session.execute(
            select(GameUpdate).filter_by(game_uuid=game.uuid, uuid=version_uuid)
        ).scalars().first()
        if not row:
            raise LookupError('Update version not found')
        return row.file_path, row.file_path, row.uuid

    if kind == 'extra':
        row = db.session.execute(
            select(GameExtra).filter_by(game_uuid=game.uuid, uuid=version_uuid)
        ).scalars().first()
        if not row:
            raise LookupError('Extra version not found')
        return row.file_path, row.file_path, row.uuid

    raise ValueError('kind must be base, update, or extra')
