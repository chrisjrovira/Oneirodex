from unittest.mock import patch, MagicMock

from oneirodex.utils.http_retry import request_with_backoff


@patch('oneirodex.utils.http_retry.time.sleep', return_value=None)
@patch('oneirodex.utils.http_retry.requests.get')
def test_retries_on_429_then_succeeds(mock_get, mock_sleep):
    bad = MagicMock(status_code=429)
    good = MagicMock(status_code=200)
    mock_get.side_effect = [bad, good]

    resp = request_with_backoff('https://example.com/x', host_key='example')
    assert resp is good
    assert mock_get.call_count == 2
    assert mock_sleep.called


@patch('oneirodex.utils.http_retry.time.sleep', return_value=None)
@patch('oneirodex.utils.http_retry.requests.get')
def test_gives_up_after_max_retries(mock_get, mock_sleep):
    mock_get.return_value = MagicMock(status_code=503)
    resp = request_with_backoff('https://example.com/x', host_key='example', max_retries=3)
    assert resp is None
    assert mock_get.call_count == 3


@patch('oneirodex.utils.http_retry.time.sleep', return_value=None)
@patch('oneirodex.utils.http_retry.requests.get')
def test_returns_none_on_non_retryable_status(mock_get, mock_sleep):
    mock_get.return_value = MagicMock(status_code=404)
    resp = request_with_backoff('https://example.com/x', host_key='example')
    assert resp is None
    assert mock_get.call_count == 1


@patch('oneirodex.utils.http_retry.time.sleep', return_value=None)
@patch('oneirodex.utils.http_retry.requests.get')
def test_retries_on_request_exception_then_succeeds(mock_get, mock_sleep):
    import requests

    good = MagicMock(status_code=200)
    mock_get.side_effect = [requests.exceptions.Timeout('timed out'), good]

    resp = request_with_backoff('https://example.com/x', host_key='example')
    assert resp is good
    assert mock_get.call_count == 2
