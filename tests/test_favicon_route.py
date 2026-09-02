"""Public favicon / static icon route smoke tests (no login)."""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ICO_PATH = ROOT / "oneirodex" / "static" / "icons" / "favicon.ico"


def test_favicon_ico_route(client):
    resp = client.get("/favicon.ico")
    assert resp.status_code == 200
    ct = (resp.content_type or "").lower()
    assert "icon" in ct or "image" in ct
    assert "max-age=3600" in (resp.headers.get("Cache-Control") or "")
    body = resp.data
    assert body
    if ICO_PATH.is_file():
        assert body == ICO_PATH.read_bytes()
    else:
        assert len(body) > 100
        assert body[:4] == b"\x00\x00\x01\x00"


def test_static_favicon_png(client):
    resp = client.get("/static/icons/favicon.png")
    assert resp.status_code == 200
    assert "image/png" in (resp.content_type or "").lower()


def test_static_favicon_ico(client):
    resp = client.get("/static/icons/favicon.ico")
    assert resp.status_code == 200
