from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import MagicMock, patch


def test_build_ops_summary_includes_required_keys():
    with patch(
        'gametheca.utils.ops_summary.get_cpu_usage',
        return_value={'percent': 1, 'cores_physical': 2, 'cores_logical': 4},
    ) as get_cpu_usage, patch(
        'gametheca.utils.ops_summary.get_memory_usage',
        return_value={'total': 8, 'used': 4, 'available': 4, 'percent': 50},
    ), patch(
        'gametheca.utils.ops_summary.get_disk_usage',
        return_value={'total': 1, 'used': 1, 'free': 0, 'percent': 40},
    ), patch(
        'gametheca.utils.ops_summary.get_games_folder_usage',
        return_value={'total': 1, 'used': 1, 'free': 0, 'percent': 40},
    ), patch(
        'gametheca.utils.ops_summary.get_system_info',
        return_value={
            'Operating System': 'Linux',
            'Hostname': 'h',
            'IP Address': '1.2.3.4',
            'Python Version': '3.12',
        },
    ), patch(
        'gametheca.utils.ops_summary.get_config_values',
        return_value={},
    ), patch(
        'gametheca.utils.ops_summary.get_formatted_system_uptime',
        return_value='1h',
    ), patch(
        'gametheca.utils.ops_summary.get_formatted_app_uptime',
        return_value='1h',
    ), patch(
        'gametheca.utils.ops_summary.get_network_stats',
        return_value={
            'bytes_sent': 0,
            'bytes_recv': 0,
            'packets_sent': 0,
            'packets_recv': 0,
            'errin': 0,
            'errout': 0,
            'dropin': 0,
            'dropout': 0,
            'connections': 0,
        },
    ), patch(
        'gametheca.utils.ops_summary._library_pulse',
        return_value={
            'libraries': 1,
            'games': 2,
            'unmatched_folders': 0,
            'download_requests_open': 0,
        },
    ), patch(
        'gametheca.utils.ops_summary._scan_snapshot',
        return_value={'active_count': 0, 'jobs': [], 'failure_count': 0},
    ), patch(
        'gametheca.utils.ops_summary._recent_errors',
        return_value=([], 0),
    ), patch(
        'gametheca.utils.ops_summary._services_snapshot',
        return_value={
            'livekit': {'enabled': False, 'configured': False, 'reachable': None},
            'malware': {'enabled': True, 'clamav_reachable': False},
            'companions': {'online': 0, 'registered': 0, 'window_minutes': 3},
            'queues': {
                'scans_active': 0,
                'scans_pending': 0,
                'scans_failures_24h': 0,
                'downloads_open': 0,
            },
            'malware_module_enabled': True,
        },
    ):
        from gametheca.utils.ops_summary import build_ops_summary

        result = build_ops_summary(datetime.now(timezone.utc))

    assert set(result.keys()) >= {
        'as_of',
        'host',
        'network',
        'issues',
        'scans',
        'library',
        'services',
        'recent_errors',
    }
    assert result['services']['companions']['online'] == 0
    assert result['host']['cpu']['cores_logical'] == 4
    assert result['issues']['overall'] == 'good'
    get_cpu_usage.assert_called_once_with()


def test_scan_snapshot_counts_active_folder_failures():
    last_update = datetime(2026, 7, 27, 12, 0, tzinfo=timezone.utc)
    active_job = SimpleNamespace(
        id='abcdef12-3456-7890-abcd-ef1234567890',
        library=SimpleNamespace(name='Games'),
        status='Running',
        total_folders=4,
        folders_success=1,
        folders_failed=2,
        current_processing='Processing: Halo (3/4)',
        last_progress_update=last_update,
    )
    active_result = MagicMock()
    active_result.scalars.return_value.all.return_value = [active_job]
    recent_result = MagicMock()
    recent_result.scalars.return_value.all.return_value = []
    failure_result = MagicMock()
    failure_result.scalar.return_value = 3

    with patch(
        'gametheca.utils.ops_summary.db.session.execute',
        side_effect=(active_result, recent_result, failure_result),
    ) as execute:
        from gametheca.utils.ops_summary import _scan_snapshot

        result = _scan_snapshot()

    failure_query = str(execute.call_args_list[2].args[0])
    assert 'folders_failed >' in failure_query
    job = result['jobs'][0]
    assert job['errors'] == 2
    assert job['folders_failed'] == 2
    assert job['folders_success'] == 1
    assert job['total_folders'] == 4
    assert job['status'] == 'Running'
    assert job['id_short'] == 'abcdef12'
    assert job['current_processing'] == 'Processing: Halo (3/4)'
    assert job['last_progress_update'] == last_update.isoformat()
    assert job['library'] == 'Games'
    assert job['progress'] == 75
    assert result['active_count'] == 1
    assert result['failure_count'] == 3


def test_scan_snapshot_includes_recent_terminal_jobs():
    completed = SimpleNamespace(
        id='deadbeef-0000-0000-0000-000000000001',
        library=SimpleNamespace(name='PC'),
        status='Completed',
        total_folders=10,
        folders_success=9,
        folders_failed=1,
        current_processing=None,
        last_progress_update=datetime(2026, 7, 27, 11, 0, tzinfo=timezone.utc),
    )
    active_result = MagicMock()
    active_result.scalars.return_value.all.return_value = []
    recent_result = MagicMock()
    recent_result.scalars.return_value.all.return_value = [completed]
    failure_result = MagicMock()
    failure_result.scalar.return_value = 0

    with patch(
        'gametheca.utils.ops_summary.db.session.execute',
        side_effect=(active_result, recent_result, failure_result),
    ):
        from gametheca.utils.ops_summary import _scan_snapshot

        result = _scan_snapshot()

    assert result['active_count'] == 0
    assert len(result['jobs']) == 1
    job = result['jobs'][0]
    assert job['status'] == 'Completed'
    assert job['id_short'] == 'deadbeef'
    assert job['folders_success'] == 9
    assert job['folders_failed'] == 1
    assert job['total_folders'] == 10
    assert job['progress'] == 100


def test_build_ops_summary_keeps_other_sections_on_network_failure():
    with patch(
        'gametheca.utils.ops_summary.get_cpu_usage',
        return_value={'percent': 1, 'cores_physical': 2, 'cores_logical': 4},
    ), patch(
        'gametheca.utils.ops_summary.get_memory_usage',
        return_value={'total': 8, 'used': 4, 'available': 4, 'percent': 50},
    ), patch(
        'gametheca.utils.ops_summary.get_disk_usage',
        return_value={'total': 1, 'used': 1, 'free': 0, 'percent': 40},
    ), patch(
        'gametheca.utils.ops_summary.get_games_folder_usage',
        return_value={'total': 1, 'used': 1, 'free': 0, 'percent': 40},
    ), patch(
        'gametheca.utils.ops_summary.get_system_info',
        return_value={
            'Operating System': 'Linux',
            'Hostname': 'h',
            'IP Address': '1.2.3.4',
            'Python Version': '3.12',
        },
    ), patch(
        'gametheca.utils.ops_summary.get_config_values',
        return_value={},
    ), patch(
        'gametheca.utils.ops_summary.get_formatted_system_uptime',
        return_value='1h',
    ), patch(
        'gametheca.utils.ops_summary.get_formatted_app_uptime',
        return_value='1h',
    ), patch(
        'gametheca.utils.ops_summary.get_network_stats',
        side_effect=RuntimeError('secret connection string'),
    ), patch(
        'gametheca.utils.ops_summary._library_pulse',
        return_value={
            'libraries': 1,
            'games': 2,
            'unmatched_folders': 0,
            'download_requests_open': 0,
        },
    ), patch(
        'gametheca.utils.ops_summary._scan_snapshot',
        return_value={'active_count': 0, 'jobs': [], 'failure_count': 0},
    ), patch(
        'gametheca.utils.ops_summary._recent_errors',
        return_value=([], 0),
    ), patch(
        'gametheca.utils.ops_summary._services_snapshot',
        return_value={
            'livekit': {'enabled': False, 'configured': False},
            'malware': {'enabled': True, 'clamav_reachable': False},
            'companions': {'online': 0, 'registered': 0, 'window_minutes': 3},
            'queues': {
                'scans_active': 0,
                'scans_pending': 0,
                'scans_failures_24h': 0,
                'downloads_open': 0,
            },
            'malware_module_enabled': True,
        },
    ):
        from gametheca.utils.ops_summary import build_ops_summary

        result = build_ops_summary(datetime.now(timezone.utc))

    assert result['network'] is None
    assert result['network_error'] == 'Network data unavailable'
    assert 'secret connection string' not in result['network_error']
    assert result['host']['hostname'] == 'h'
    assert result['scans'] == {'active_count': 0, 'jobs': []}
    assert result['library']['games'] == 2
    assert result['services']['companions']['online'] == 0
    assert result['recent_errors'] == []
