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
    active_job = SimpleNamespace(
        id=1,
        library=SimpleNamespace(name='Games'),
        status='Running',
        total_folders=4,
        folders_success=1,
        folders_failed=2,
    )
    active_result = MagicMock()
    active_result.scalars.return_value.all.return_value = [active_job]
    failure_result = MagicMock()
    failure_result.scalar.return_value = 3

    with patch(
        'gametheca.utils.ops_summary.db.session.execute',
        side_effect=(active_result, failure_result),
    ) as execute:
        from gametheca.utils.ops_summary import _scan_snapshot

        result = _scan_snapshot()

    failure_query = str(execute.call_args_list[1].args[0])
    assert 'folders_failed >' in failure_query
    assert result['jobs'][0]['errors'] == 2
    assert result['failure_count'] == 3


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
