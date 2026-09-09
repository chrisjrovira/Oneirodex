"""The global API error handlers return the JSON envelope, not HTML.

Regression guard for the Phase 0 fix. Before it, ``oneirodex/__init__.py``
registered an error handler for 413 and nothing else, so an uncaught exception
in an ``/api/`` route came back as Flask's stock HTML 500 and the SPA had no
error state at the crash path. See ``oneirodex/utils/error_envelope.py``.
"""

import pytest
from werkzeug.exceptions import Forbidden


@pytest.fixture
def error_app(app):
    """The test app with throwaway routes that fail in known ways.

    Routes are added before the first request, which Flask allows. The ``app``
    fixture is function-scoped, so endpoint names never collide across tests.
    """

    @app.route('/api/_test_boom')
    def _boom():
        raise RuntimeError('secret path /etc/passwd must not leak to the client')

    @app.route('/api/_test_forbidden')
    def _forbidden():
        raise Forbidden('You may not do that.')

    @app.route('/_test_boom_html')
    def _boom_html():
        raise RuntimeError('kaboom')

    return app


def test_uncaught_exception_on_api_route_returns_envelope(error_app):
    resp = error_app.test_client().get('/api/_test_boom')

    assert resp.status_code == 500
    body = resp.get_json()
    assert body is not None, resp.data
    assert body['ok'] is False
    assert body['error_code'] == 'internal'
    assert isinstance(body['error'], str) and body['error']
    # The raw exception text must never reach the client.
    assert '/etc/passwd' not in resp.get_data(as_text=True)


def test_http_exception_on_api_route_keeps_status_and_code(error_app):
    resp = error_app.test_client().get('/api/_test_forbidden')

    assert resp.status_code == 403
    body = resp.get_json()
    assert body['ok'] is False
    assert body['error_code'] == 'forbidden'


def test_unknown_api_path_is_an_envelope_404(error_app):
    resp = error_app.test_client().get('/api/nope/not/a/route')

    assert resp.status_code == 404
    body = resp.get_json()
    assert body is not None, resp.data
    assert body['ok'] is False
    assert body['error_code'] == 'not_found'


def test_non_api_route_gets_html_not_the_envelope(error_app):
    # A non-API path with a wildcard Accept header must be left on Flask's
    # default behaviour — the envelope handlers do not touch it. Pin
    # PROPAGATE_EXCEPTIONS off so this asserts the *response shape* (HTML, not
    # the JSON envelope) rather than ambient exception-propagation state, which
    # other test modules in the same process can and do flip.
    error_app.config['PROPAGATE_EXCEPTIONS'] = False
    resp = error_app.test_client().get('/_test_boom_html')

    assert resp.status_code == 500
    assert 'text/html' in resp.content_type
    body = resp.get_data(as_text=True)
    assert '"error_code"' not in body  # not the JSON envelope
    assert 'kaboom' not in body  # Flask's generic 500 page, no leak


def test_non_api_route_propagates_when_testing(error_app):
    # With propagation on (the default under TESTING), an uncaught error on a
    # non-API route still surfaces to the caller rather than being swallowed.
    error_app.config['PROPAGATE_EXCEPTIONS'] = True
    with pytest.raises(RuntimeError):
        error_app.test_client().get('/_test_boom_html')
