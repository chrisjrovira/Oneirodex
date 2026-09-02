"""Wave-2 regression guards for admin back-links and library edit scan_depth."""
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def test_no_admin2_admin_dashboard_url_for():
    admin_templates = ROOT / 'oneirodex' / 'templates' / 'admin'
    hits = []
    for path in admin_templates.rglob('*.html'):
        text = path.read_text(encoding='utf-8')
        if "admin2.admin_dashboard" in text:
            hits.append(str(path.relative_to(ROOT)))
    assert hits == [], f"Broken admin back-links remain: {hits}"


def test_edit_library_seeds_scan_depth_only_on_get():
    src = (ROOT / 'oneirodex' / 'routes_admin_ext' / 'libraries.py').read_text(encoding='utf-8')
    assert "if request.method == 'GET':" in src
    assert 'form.scan_depth.data = getattr(library, \'scan_depth\', 1) or 1' in src
    # Must not assign scan_depth from DB unconditionally before validate_on_submit
    before_validate, _, after = src.partition('def edit_library')
    edit_fn = after.split('def ', 1)[0] if 'def ' in after else after
    # Find the block between platform.choices and validate_on_submit
    chunk = edit_fn.split('form.validate_on_submit')[0]
    assert "if request.method == 'GET':" in chunk
    # Unconditional assignment lines should not appear outside the GET block as siblings
    # (simple guard: count of scan_depth.data assignments in edit_library == 1 inside GET)
    assert chunk.count('form.scan_depth.data') == 1


def test_base_html_collapses_member_nav_on_admin_paths():
    """Admin Jinja pages keep the member LHN for recovery nav, but start collapsed
    so it no longer competes with page chrome (handoff Wave 2 deferred #1).

    The guard, not the element: this used to assert the collapse sat on
    ``class="sidebar…"``. GT-B2 retired the legacy ``#sidebar`` for the rail and
    moved the collapsed state onto the ``#content`` shell, so the assertion
    failed against a template that was correct — it pinned where the behaviour
    used to live rather than that it still happens. Checked on the shell, it
    still means something: admin pages would otherwise open with the member nav
    expanded over the admin chrome.
    """
    base = (ROOT / 'oneirodex' / 'templates' / 'base.html').read_text(encoding='utf-8')
    assert "request.path.startswith('/admin')" in base
    assert 'admin_chrome' in base

    content_tag = next(
        (line for line in base.splitlines() if 'id="content"' in line),
        None,
    )
    assert content_tag, 'the #content shell the collapse applies to is gone'
    assert '{% if admin_chrome %} collapsed{% endif %}' in content_tag
