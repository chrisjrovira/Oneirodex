"""Unit tests for companion command queue (no DB)."""

from datetime import datetime, timedelta, timezone

from gametheca.utils import client_commands as cc


def test_enqueue_and_claim_pending_commands(tmp_path, monkeypatch):
    monkeypatch.setattr(cc, '_library_root', lambda: str(tmp_path))

    first = cc.enqueue_client_command(9, 'game-a', 'install')
    second = cc.enqueue_client_command(9, 'game-b', 'uninstall')
    assert first['status'] == 'pending'
    assert first['action'] == 'install'

    claimed = cc.claim_pending_commands(9)
    assert {row['game_uuid'] for row in claimed} == {'game-a', 'game-b'}
    assert cc.claim_pending_commands(9) == []


def test_enqueue_dedupes_same_game_action(tmp_path, monkeypatch):
    monkeypatch.setattr(cc, '_library_root', lambda: str(tmp_path))

    cc.enqueue_client_command(1, 'game-a', 'install')
    cc.enqueue_client_command(1, 'game-a', 'install')
    claimed = cc.claim_pending_commands(1)
    assert len(claimed) == 1
    assert claimed[0]['action'] == 'install'


def test_enqueue_update_pack_includes_kind_and_version(tmp_path, monkeypatch):
    monkeypatch.setattr(cc, '_library_root', lambda: str(tmp_path))

    command = cc.enqueue_client_command(
        2,
        'game-a',
        'update',
        kind='update',
        version_uuid='upd-9',
    )
    assert command['kind'] == 'update'
    assert command['version_uuid'] == 'upd-9'
    claimed = cc.claim_pending_commands(2)
    assert claimed[0]['kind'] == 'update'
    assert claimed[0]['version_uuid'] == 'upd-9'


def test_enqueue_rejects_invalid_action(tmp_path, monkeypatch):
    monkeypatch.setattr(cc, '_library_root', lambda: str(tmp_path))
    try:
        cc.enqueue_client_command(1, 'game-a', 'launch')
        assert False, 'expected ValueError'
    except ValueError as exc:
        assert 'action' in str(exc)


def test_ack_removes_in_flight_and_nack_requeues(tmp_path, monkeypatch):
    monkeypatch.setattr(cc, '_library_root', lambda: str(tmp_path))

    command = cc.enqueue_client_command(3, 'game-a', 'install')
    claimed = cc.claim_pending_commands(3)
    assert len(claimed) == 1
    assert claimed[0]['id'] == command['id']
    assert cc.claim_pending_commands(3) == []

    assert cc.nack_client_commands(3, [command['id']]) == 1
    reclaimed = cc.claim_pending_commands(3)
    assert len(reclaimed) == 1
    assert reclaimed[0]['id'] == command['id']

    assert cc.ack_client_commands(3, [command['id']]) == 1
    assert cc.claim_pending_commands(3) == []


def test_stale_in_flight_is_reclaimed(tmp_path, monkeypatch):
    monkeypatch.setattr(cc, '_library_root', lambda: str(tmp_path))
    monkeypatch.setattr(cc, '_IN_FLIGHT_TTL_SECONDS', 1)

    command = cc.enqueue_client_command(4, 'game-a', 'update')
    claimed = cc.claim_pending_commands(4)
    assert claimed[0]['id'] == command['id']

    path = cc._store_path(4)
    queue = cc._read_queue(path)
    queue[0]['claimed_at'] = (datetime.now(timezone.utc) - timedelta(seconds=30)).isoformat()
    cc._write_queue(path, queue)

    again = cc.claim_pending_commands(4)
    assert len(again) == 1
    assert again[0]['id'] == command['id']
