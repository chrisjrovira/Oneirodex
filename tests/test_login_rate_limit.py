"""Login rate-limit unit tests (no DB)."""

import os

from gametheca.utils import login_rate_limit as lrl


def setup_function():
    lrl.reset_for_tests()
    os.environ['ENABLE_LOGIN_RATE_LIMIT'] = 'true'
    os.environ['LOGIN_RATE_LIMIT_ATTEMPTS'] = '3'
    os.environ['LOGIN_RATE_LIMIT_WINDOW_SECONDS'] = '60'


def teardown_function():
    lrl.reset_for_tests()


def test_not_limited_until_threshold():
    key = lrl.login_rate_key('1.2.3.4', 'alice')
    assert lrl.is_rate_limited(key) is False
    lrl.record_failure(key)
    lrl.record_failure(key)
    assert lrl.is_rate_limited(key) is False
    lrl.record_failure(key)
    assert lrl.is_rate_limited(key) is True


def test_clear_failures_unlocks():
    key = lrl.login_rate_key('1.2.3.4', 'bob')
    for _ in range(5):
        lrl.record_failure(key)
    assert lrl.is_rate_limited(key) is True
    lrl.clear_failures(key)
    assert lrl.is_rate_limited(key) is False


def test_window_expiry(monkeypatch):
    key = lrl.login_rate_key('9.9.9.9', 'carol')
    now = 1000.0
    lrl.record_failure(key, now=now)
    lrl.record_failure(key, now=now + 1)
    lrl.record_failure(key, now=now + 2)
    assert lrl.is_rate_limited(key, now=now + 3) is True
    # After window (60s) all hits expire
    assert lrl.is_rate_limited(key, now=now + 70) is False


def test_disabled_never_limits(monkeypatch):
    monkeypatch.setenv('ENABLE_LOGIN_RATE_LIMIT', 'false')
    key = lrl.login_rate_key('5.5.5.5', 'dave')
    for _ in range(20):
        lrl.record_failure(key)
    assert lrl.is_rate_limited(key) is False
