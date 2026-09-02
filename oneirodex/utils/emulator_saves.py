"""Opt-in emulator save-state storage (per user / game)."""

from __future__ import annotations

import os
from datetime import datetime, timezone
from io import BytesIO

from flask import current_app
from sqlalchemy import select
from werkzeug.utils import secure_filename

from oneirodex import db
from oneirodex.models import EmulatorSave, GlobalSettings
from oneirodex.utils.save_crypto import maybe_decrypt, maybe_encrypt

MAX_SAVE_BYTES = 2 * 1024 * 1024  # 2 MiB
MAX_SLOTS_PER_GAME = 10


def save_sync_enabled() -> bool:
    settings = db.session.execute(
        select(GlobalSettings).order_by(GlobalSettings.id).limit(1),
    ).scalars().first()
    if settings is not None and getattr(settings, 'enable_emulator_save_sync', None) is not None:
        return bool(settings.enable_emulator_save_sync)
    return str(current_app.config.get('ENABLE_EMULATOR_SAVE_SYNC', 'true')).lower() in (
        '1', 'true', 'yes', 'on',
    )


def _saves_root() -> str:
    root = current_app.config.get('EMULATOR_SAVES_PATH')
    if root:
        return root
    return os.path.join(current_app.root_path, 'static', 'library', 'saves')


def list_saves(user_id: int, game_uuid: str) -> list[EmulatorSave]:
    return list(
        db.session.execute(
            select(EmulatorSave)
            .filter_by(user_id=user_id, game_uuid=game_uuid)
            .order_by(EmulatorSave.slot_name.asc()),
        ).scalars().all(),
    )


def read_save_bytes(row: EmulatorSave) -> bytes:
    if not row.storage_path or not os.path.isfile(row.storage_path):
        raise FileNotFoundError('Save file missing on disk')
    with open(row.storage_path, 'rb') as handle:
        payload = handle.read()
    return maybe_decrypt(payload)


def store_save(
    *,
    user_id: int,
    game_uuid: str,
    slot_name: str,
    file_storage,
) -> EmulatorSave:
    if not save_sync_enabled():
        raise RuntimeError('Emulator save sync is disabled')

    slot = (slot_name or 'slot1').strip()[:64] or 'slot1'
    existing = list_saves(user_id, game_uuid)
    current = next((row for row in existing if row.slot_name == slot), None)
    if current is None and len(existing) >= MAX_SLOTS_PER_GAME:
        raise ValueError(f'Maximum of {MAX_SLOTS_PER_GAME} save slots per game')

    raw = file_storage.read(MAX_SAVE_BYTES + 1)
    if not raw:
        raise ValueError('Save file was empty')
    if len(raw) > MAX_SAVE_BYTES:
        raise ValueError(f'Save exceeds {MAX_SAVE_BYTES} byte limit')

    original = secure_filename(getattr(file_storage, 'filename', None) or 'save.state')
    if not original:
        original = 'save.state'

    payload, encrypted = maybe_encrypt(raw)

    dest_dir = os.path.join(_saves_root(), str(user_id), game_uuid)
    os.makedirs(dest_dir, exist_ok=True)
    dest_name = f'{secure_filename(slot)}_{original}'
    dest_path = os.path.join(dest_dir, dest_name)
    with open(dest_path, 'wb') as handle:
        handle.write(payload)

    if current is None:
        current = EmulatorSave(
            user_id=user_id,
            game_uuid=game_uuid,
            slot_name=slot,
            filename=original,
            size_bytes=len(raw),
            storage_path=dest_path,
            encrypted=encrypted,
        )
        db.session.add(current)
    else:
        old_path = current.storage_path
        current.filename = original
        current.size_bytes = len(raw)
        current.storage_path = dest_path
        current.encrypted = encrypted
        current.updated_at = datetime.now(timezone.utc)
        if old_path and old_path != dest_path and os.path.isfile(old_path):
            try:
                os.remove(old_path)
            except OSError:
                pass

    db.session.commit()
    return current


def delete_save(user_id: int, game_uuid: str, slot_name: str) -> bool:
    row = db.session.execute(
        select(EmulatorSave).filter_by(
            user_id=user_id,
            game_uuid=game_uuid,
            slot_name=slot_name,
        ),
    ).scalars().first()
    if not row:
        return False
    if row.storage_path and os.path.isfile(row.storage_path):
        try:
            os.remove(row.storage_path)
        except OSError:
            pass
    db.session.delete(row)
    db.session.commit()
    return True


def save_as_file_storage(row: EmulatorSave):
    """Return a BytesIO of decrypted save bytes for send_file."""
    return BytesIO(read_save_bytes(row))
