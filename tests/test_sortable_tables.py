"""Classic tables sort through one shared module (UX-C8 · W27-C1 · W27-C2).

Sorting on the Jinja side used to be per page: the unmatched table carried its
own sorter, its own hand-written header buttons and its own `.unmatched-sort-btn`
rules, while the active scan jobs table beside it had nothing — which is what
W27-C2 reported. Both now go through `js/od_sortable_table.js`.

These are source assertions rather than behaviour tests. The behaviour lives in
`frontend/admin-app/src/odSortableTable.test.js`, which runs the real module
against a DOM; what cannot be checked there is whether the *templates* still opt
in, because a table that quietly loses `data-od-sortable` keeps rendering
perfectly and simply stops sorting. That failure is invisible to every other
test in the suite, which is the reason for this file.

No database needed — everything here reads files from disk.
"""

from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
THEME_JS = ROOT / 'oneirodex' / 'setup' / 'default_theme' / 'js'
THEME_CSS = ROOT / 'oneirodex' / 'setup' / 'default_theme' / 'css'
TEMPLATES = ROOT / 'oneirodex' / 'templates'

SCANJOBS_HTML = TEMPLATES / 'admin' / 'admin_manage_scanjobs.html'
SCANJOBS_JS = THEME_JS / 'admin_manage_scanjobs.js'
MODULE = THEME_JS / 'od_sortable_table.js'


def _read(path: Path) -> str:
    return path.read_text(encoding='utf-8')


def _without_comments(css: str) -> str:
    """Rules only. A comment naming a retired class is documentation of the
    retirement, not a survival of it — asserting on the raw text would make
    explaining the change fail the test that checks the change happened."""
    return re.sub(r'/\*.*?\*/', '', css, flags=re.DOTALL)


def test_both_base_templates_load_the_module():
    """It auto-wires on DOMContentLoaded, so loading it is the whole adoption
    step for a page. A base that stops loading it silently disables sorting
    across every page that extends it."""
    for base in ('base.html', 'base_admin.html'):
        assert 'js/od_sortable_table.js' in _read(TEMPLATES / base), base


def test_the_scan_jobs_table_opts_in():
    """W27-C2: this table had no sorting at all."""
    markup = _read(SCANJOBS_HTML)
    table = markup[markup.index('id="scanJobsTable"'):]
    head = table[: table.index('</thead>')]

    assert 'data-od-sortable' in table[:200]
    for key in ('id', 'library', 'path', 'status', 'progress'):
        assert f'data-sort-key="{key}"' in head, key


def test_the_actions_column_is_not_sortable():
    """A column of controls has no order worth asking for, and a sort button
    over it would just be a dead control."""
    markup = _read(SCANJOBS_HTML)
    table = markup[markup.index('id="scanJobsTable"'):]
    head = table[: table.index('</thead>')]
    assert '<th>Actions</th>' in head


def test_progress_carries_a_numeric_sort_key_on_both_render_paths():
    """The cell shows "10/25", which sorts before "9/25" as text. The server
    renders these rows on first paint and the poller re-renders them every few
    seconds — a key on only one path means the order changes on its own."""
    assert 'data-sort-progress' in _read(SCANJOBS_HTML)
    assert 'data-sort-progress' in _read(SCANJOBS_JS)


def test_the_unmatched_table_keeps_its_default_order():
    """It arrived folder-ascending because the page sorted it after every
    render. That call is gone, so the order has to be declared instead —
    otherwise the table quietly starts arriving in server order."""
    markup = _read(SCANJOBS_HTML)
    table = markup[markup.index('id="unmatchedTable"'):]
    header = table[: table.index('</thead>')]

    assert 'data-od-sortable' in header
    assert 'data-od-sort-default="folder"' in header
    for key in ('folder', 'status', 'library', 'platform'):
        assert f'data-sort-key="{key}"' in header, key


def test_the_bespoke_unmatched_sorter_is_retired():
    """Both implementations running at once is worse than either alone: the
    page sorter and the shared module would fight over the same tbody."""
    page_js = _read(SCANJOBS_JS)
    assert 'unmatched-sort-btn' not in page_js
    assert 'sortUnmatchedRows' not in page_js
    assert 'unmatchedSortKey' not in page_js

    assert 'unmatched-sort-btn' not in _read(SCANJOBS_HTML)
    css = _without_comments(_read(THEME_CSS / 'admin' / 'admin_manage_scanjobs.css'))
    assert 'unmatched-sort-btn' not in css


def test_the_shared_button_style_ships_with_the_shared_module():
    """`.od-sort-btn` is built by the module, so it must be styled in the
    stylesheet both bases already load rather than beside one page's table —
    the per-page split is what let the two tables diverge."""
    assert '.od-sort-btn' in _read(THEME_CSS / 'table-components.css')
    assert 'od-sort-btn' in _read(MODULE)


def test_the_module_does_not_clear_the_header_cell():
    """Rebuilding a `<th>` from textContent would delete an `icons.icon()`
    macro's markup with no error. Pinned here as well as in the DOM test
    because the symptom is a missing icon nobody connects to sorting."""
    source = _read(MODULE)
    assert 'th.textContent = ' not in source
    assert 'while (entry.th.firstChild)' in source
