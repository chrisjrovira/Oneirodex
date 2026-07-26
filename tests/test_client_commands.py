"""Unit tests for companion command queue (no DB)."""

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


def test_enqueue_rejects_invalid_action(tmp_path, monkeypatch):
    monkeypatch.setattr(cc, '_library_root', lambda: str(tmp_path))
    try:
        cc.enqueue_client_command(1, 'game-a', 'launch')
        assert False, 'expected ValueError'
    except ValueError as exc:
        assert 'action' in str(exc)
