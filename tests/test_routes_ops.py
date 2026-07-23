def test_ops_summary_requires_auth(client):
    """The operations summary API is unavailable to anonymous users."""
    response = client.get('/admin/api/ops/summary')

    assert response.status_code in (302, 401, 403)
