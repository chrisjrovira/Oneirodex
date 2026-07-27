"""Unit tests for ASGI static path resolution (no server required)."""

from gametheca.utils.static_files import resolve_static_path


def test_static_path_rejects_traversal(tmp_path):
    root = tmp_path / 'static'
    root.mkdir()
    (root / 'ok.css').write_text('a{}')
    assert resolve_static_path(root, '/static/ok.css') == (root / 'ok.css').resolve()
    assert resolve_static_path(root, '/static/../ok.css') is None
    assert resolve_static_path(root, '/static/foo/../../etc/passwd') is None


def test_static_path_nested(tmp_path):
    root = tmp_path / 'static'
    nested = root / 'dist' / 'member-app'
    nested.mkdir(parents=True)
    target = nested / 'member-app.js'
    target.write_text('console.log(1)')
    resolved = resolve_static_path(root, '/static/dist/member-app/member-app.js')
    assert resolved == target.resolve()
