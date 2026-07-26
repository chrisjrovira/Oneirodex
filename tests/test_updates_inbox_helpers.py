"""Unit tests for updates inbox helpers (no DB)."""

from types import SimpleNamespace

from gametheca.routes_apis import updates as updates_mod


def test_dlc_summary_reads_compare_payload_keys():
    game = SimpleNamespace(
        freshness_payload={
            'dlc': {
                'local_dlc_count_hint': 1,
                'store_dlc_count': 4,
                'missing_dlc_count_estimate': 3,
                'store': 'steam',
            }
        }
    )
    summary = updates_mod._dlc_summary(game)
    assert summary == {
        'store_count': 4,
        'local_hint': 1,
        'missing_count': 3,
        'store': 'steam',
    }


def test_dlc_summary_falls_back_to_remote_list():
    game = SimpleNamespace(
        freshness_payload={
            'local': {'dlc_count_hint': 0},
            'remotes': [{'store': 'gog', 'dlc_count': 2, 'ok': True}],
        }
    )
    summary = updates_mod._dlc_summary(game)
    assert summary['store_count'] == 2
    assert summary['local_hint'] == 0
    assert summary['store'] == 'gog'
