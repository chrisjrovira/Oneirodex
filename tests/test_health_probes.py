"""Unauthenticated liveness / readiness probes for Docker and Unraid."""


def test_healthz_ok(client):
    response = client.get('/healthz')
    assert response.status_code == 200
    data = response.get_json()
    assert data['status'] == 'ok'
    assert data['probe'] == 'liveness'
    assert 'version' in data


def test_readyz_ok_when_db_up(client, db_session):
    response = client.get('/readyz')
    assert response.status_code == 200
    data = response.get_json()
    assert data['status'] == 'ok'
    assert data['probe'] == 'readiness'
    assert data['checks']['database']['ok'] is True


def test_health_probes_skip_setup_redirect(client, monkeypatch):
    """Probes must stay reachable before setup wizard completes."""
    monkeypatch.setattr(
        'gametheca.utils.setup.should_redirect_to_setup',
        lambda: True,
    )
    assert client.get('/healthz').status_code == 200
    assert client.get('/readyz').status_code == 200
