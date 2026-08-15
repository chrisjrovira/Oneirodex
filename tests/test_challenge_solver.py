"""Challenge solver client + wiring (CH-1…CH-5)."""

from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest
import requests

from gametheca.utils.challenge_solver import (
    ChallengeSolverClient,
    SolverSolution,
    TokenCaptchaClient,
    fetch_with_challenge_retry,
    is_challenge_response,
)


def _mock_response(status: int, text: str = '', headers: dict | None = None) -> requests.Response:
    resp = requests.Response()
    resp.status_code = status
    resp._content = text.encode('utf-8')
    resp.headers = headers or {}
    resp.url = 'https://example.test/page'
    return resp


def test_is_challenge_response_cloudflare_503():
    body = '<html><title>Just a moment...</title><body>Checking your browser before accessing cloudflare</body></html>'
    assert is_challenge_response(_mock_response(503, body)) is True


def test_is_challenge_response_normal_json_200():
    assert is_challenge_response(_mock_response(200, '[{"title":"Game"}]')) is False


def test_is_challenge_response_403_single_marker_not_enough():
    assert is_challenge_response(_mock_response(403, 'access denied for this resource')) is False


def test_challenge_solver_client_parses_flaresolverr_solution():
    session = MagicMock()
    session.post.return_value = MagicMock(
        status_code=200,
        content=b'{"status":"ok","solution":{"url":"https://idx.test/results","status":200,"response":"[{\\"title\\":\\"Ok\\"}]","cookies":[{"name":"cf_clearance","value":"abc"}],"userAgent":"Mozilla/5.0"}}',
        json=lambda: {
            'status': 'ok',
            'solution': {
                'url': 'https://idx.test/results',
                'status': 200,
                'response': '[{"title":"Ok"}]',
                'cookies': [{'name': 'cf_clearance', 'value': 'abc'}],
                'userAgent': 'Mozilla/5.0 Test',
            },
        },
    )
    client = ChallengeSolverClient('http://solver:8191', session=session)
    solution = client.request_get('https://idx.test/results')
    assert isinstance(solution, SolverSolution)
    assert solution.status_code == 200
    assert solution.body == '[{"title":"Ok"}]'
    assert solution.cookie_header() == 'cf_clearance=abc'
    assert solution.user_agent == 'Mozilla/5.0 Test'
    session.post.assert_called_once()
    call_args = session.post.call_args
    assert call_args[0][0] == 'http://solver:8191/v1'
    assert call_args[1]['json']['cmd'] == 'request.get'


def test_challenge_solver_client_trawl_scrape():
    session = MagicMock()
    session.post.return_value = MagicMock(
        status_code=200,
        content=b'{}',
        json=lambda: {
            'tier': 2,
            'timings': {'total': 1.2},
            'solution': {
                'url': 'https://idx.test/x',
                'status': 200,
                'response': 'ok',
                'cookies': [],
            },
        },
    )
    client = ChallengeSolverClient('http://trawl:8191', provider='trawl', max_tier=5, session=session)
    solution = client.request_get('https://idx.test/x')
    assert solution.body == 'ok'
    assert session.post.call_args[0][0] == 'http://trawl:8191/scrape'
    assert session.post.call_args[1]['json']['maxTier'] == 4


def test_token_captcha_client_create_task_never_logs_key(caplog):
    session = MagicMock()
    secret = 'super-secret-capsolver-key'
    session.post.return_value = MagicMock(
        status_code=200,
        content=b'{}',
        json=lambda: {'errorId': 0, 'taskId': 'task-123'},
    )
    client = TokenCaptchaClient('https://api.capsolver.com', secret, session=session)
    task_id = client.create_task(
        'ReCaptchaV2TaskProxyLess',
        website_url='https://example.test',
        website_key='site-key',
    )
    assert task_id == 'task-123'
    posted = session.post.call_args[1]['json']
    assert posted['clientKey'] == secret
    assert secret not in caplog.text


def test_fetch_with_challenge_retry_solver_once(app, monkeypatch):
    monkeypatch.setitem(app.config, 'ENABLE_CHALLENGE_SOLVER', True)
    monkeypatch.setitem(app.config, 'CHALLENGE_SOLVER_URL', 'http://solver:8191')
    monkeypatch.setitem(app.config, 'ALLOW_PRIVATE_LAN_URLS', True)

    challenged = _mock_response(
        503,
        '<html><title>Just a moment...</title>cloudflare challenge-platform</html>',
    )
    success = _mock_response(200, '[{"title":"Hit"}]')

    with app.app_context():
        with patch('gametheca.utils.challenge_solver.requests.get', side_effect=[challenged, success]) as mock_get:
            with patch('gametheca.utils.challenge_solver.ChallengeSolverClient.request_get') as mock_solve:
                mock_solve.return_value = SolverSolution(
                    url='https://idx.test/search',
                    status_code=200,
                    body='[{"title":"Hit"}]',
                    headers={},
                    cookies=[{'name': 'cf_clearance', 'value': 'xyz'}],
                    user_agent='UA/1.0',
                )
                resp = fetch_with_challenge_retry(
                    'get',
                    'https://idx.test/search',
                    headers={'X-Api-Key': 'k'},
                    timeout=5,
                )
    assert mock_get.call_count == 2
    assert mock_solve.call_count == 1
    assert resp.status_code == 200


def _disable_challenge_solver(app, db_session, monkeypatch):
    """Env off + clear DB toggle (test DB may retain prior saves)."""
    from sqlalchemy.orm.attributes import flag_modified

    from gametheca.models import GlobalSettings

    monkeypatch.setitem(app.config, 'ENABLE_CHALLENGE_SOLVER', False)
    row = db_session.query(GlobalSettings).order_by(GlobalSettings.id).first()
    if row is None:
        return
    cfg = dict(row.arr_settings) if isinstance(row.arr_settings, dict) else {}
    cfg['challenge_solver_enabled'] = False
    cfg.pop('challenge_solver_max_tier', None)
    row.arr_settings = cfg
    flag_modified(row, 'arr_settings')
    db_session.commit()
    monkeypatch.setitem(app.config, 'CHALLENGE_SOLVER_MAX_TIER', 5)


def test_fetch_with_challenge_retry_disabled_unchanged(app, db_session, monkeypatch):
    _disable_challenge_solver(app, db_session, monkeypatch)
    challenged = _mock_response(
        503,
        '<html><title>Just a moment...</title>cloudflare challenge-platform</html>',
    )
    with app.app_context():
        with patch('gametheca.utils.challenge_solver.requests.get', return_value=challenged) as mock_get:
            with patch('gametheca.utils.challenge_solver.ChallengeSolverClient.request_get') as mock_solve:
                resp = fetch_with_challenge_retry('get', 'https://idx.test/search', timeout=5)
    assert mock_get.call_count == 1
    assert mock_solve.call_count == 0
    assert resp.status_code == 503


def test_challenge_solver_status_api(client, app, db_session, monkeypatch):
    _disable_challenge_solver(app, db_session, monkeypatch)
    from uuid import uuid4

    from gametheca.models import User

    admin = User(
        user_id=str(uuid4()),
        name=f'chadmin_{uuid4().hex[:8]}',
        email=f'chadmin_{uuid4().hex[:8]}@test.local',
        role='admin',
        is_email_verified=True,
    )
    admin.set_password('testpass123')
    db_session.add(admin)
    db_session.commit()
    with client.session_transaction() as sess:
        sess['_user_id'] = str(admin.id)
        sess['_fresh'] = True
    resp = client.get('/api/admin/challenge-solver/status')
    assert resp.status_code == 200
    data = resp.get_json()
    assert data['enabled'] is False
    assert data['provider'] == 'flaresolverr_compat'
    assert data['max_tier'] == 5


def test_save_challenge_config_validates_url(app, db_session, global_settings, monkeypatch):
    monkeypatch.setitem(app.config, 'ALLOW_PRIVATE_LAN_URLS', True)
    with app.app_context():
        from gametheca.utils.challenge_solver import save_challenge_config

        saved = save_challenge_config({
            'enabled': True,
            'url': 'http://192.168.1.10:8191',
            'max_tier': 6,
        })
        assert saved['db_enabled'] is True
        assert saved['url'] == 'http://192.168.1.10:8191'
        assert saved['max_tier'] == 6

        with pytest.raises(ValueError, match='not allowed'):
            save_challenge_config({'url': 'http://169.254.169.254/'})
