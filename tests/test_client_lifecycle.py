"""Unit tests for companion lifecycle file store (no DB)."""

from pathlib import Path

from oneirodex.utils import client_lifecycle as cl


def test_save_lifecycle_records_merges_partial_snapshot(tmp_path, monkeypatch):
    monkeypatch.setattr(cl, '_library_root', lambda: str(tmp_path))

    cl.save_lifecycle_records(
        7,
        [
            {'game_uuid': 'a', 'state': 'installed'},
            {'game_uuid': 'b', 'state': 'downloaded'},
        ],
    )
    cl.save_lifecycle_records(
        7,
        [{'game_uuid': 'a', 'state': 'update_available'}],
    )

    mapping = cl.load_lifecycle_map(7)
    assert mapping == {
        'a': 'update_available',
        'b': 'downloaded',
    }
    store = Path(tmp_path) / 'client_lifecycle' / 'user_7.json'
    assert store.is_file()


def test_save_lifecycle_records_replace_wipes_missing(tmp_path, monkeypatch):
    monkeypatch.setattr(cl, '_library_root', lambda: str(tmp_path))

    cl.save_lifecycle_records(
        3,
        [
            {'game_uuid': 'keep', 'state': 'installed'},
            {'game_uuid': 'drop', 'state': 'downloaded'},
        ],
    )
    cl.save_lifecycle_records(
        3,
        [{'game_uuid': 'keep', 'state': 'installed'}],
        replace=True,
    )

    assert cl.load_lifecycle_map(3) == {'keep': 'installed'}
