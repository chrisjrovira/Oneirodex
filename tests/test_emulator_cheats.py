"""Emulator .cht library helpers."""

from io import BytesIO
from uuid import uuid4

import pytest
from werkzeug.datastructures import FileStorage

from gametheca.utils.emulator_cheats import (
    delete_cheat_file,
    list_cheat_files,
    read_cheat_file,
    store_cheat_file,
)


def test_store_list_read_delete_cheat(app, tmp_path, monkeypatch):
    game_uuid = str(uuid4())
    monkeypatch.setitem(app.config, 'EMULATOR_CHEATS_PATH', str(tmp_path))

    with app.app_context():
        storage = FileStorage(
            stream=BytesIO(b'cheat "inf"\n'),
            filename='inf codes.cht',
            content_type='text/plain',
        )
        stored = store_cheat_file(game_uuid, storage)
        assert stored['name'].endswith('.cht')
        assert stored['size'] > 0

        listed = list_cheat_files(game_uuid)
        assert len(listed) == 1
        assert listed[0]['name'] == stored['name']

        raw = read_cheat_file(game_uuid, stored['name'])
        assert b'inf' in raw

        delete_cheat_file(game_uuid, stored['name'])
        assert list_cheat_files(game_uuid) == []


def test_store_rejects_non_cht(app, tmp_path, monkeypatch):
    monkeypatch.setitem(app.config, 'EMULATOR_CHEATS_PATH', str(tmp_path))
    with app.app_context():
        storage = FileStorage(
            stream=BytesIO(b'nope'),
            filename='codes.txt',
            content_type='text/plain',
        )
        with pytest.raises(ValueError, match='\\.cht'):
            store_cheat_file(str(uuid4()), storage)


def test_invalid_game_uuid_rejected(app, tmp_path, monkeypatch):
    monkeypatch.setitem(app.config, 'EMULATOR_CHEATS_PATH', str(tmp_path))
    with app.app_context():
        with pytest.raises(ValueError, match='Invalid game UUID'):
            list_cheat_files('not-a-uuid')
