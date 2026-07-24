# tests/test_utils_ops_network.py
from unittest.mock import MagicMock, patch
from gametheca.utils.ops_network import get_network_stats


def test_get_network_stats_shape():
    counters = MagicMock(
        bytes_sent=1, bytes_recv=2, packets_sent=3, packets_recv=4,
        errin=0, errout=0, dropin=0, dropout=0,
    )
    with patch('gametheca.utils.ops_network.psutil') as mock_psutil:
        mock_psutil.net_io_counters.return_value = counters
        mock_psutil.net_connections.return_value = [1, 2, 3]
        result = get_network_stats()
    assert result['bytes_sent'] == 1
    assert result['connections'] == 3


def test_get_network_stats_returns_none_on_failure():
    with patch('gametheca.utils.ops_network.psutil') as mock_psutil:
        mock_psutil.net_io_counters.side_effect = OSError('denied')
        assert get_network_stats() is None
