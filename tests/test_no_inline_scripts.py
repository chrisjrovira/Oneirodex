"""Ratchet: Jinja templates must not ship executable inline script.

Executable inline ``<script>`` and inline event handlers (``onclick=``) are
what kept CSP on ``'unsafe-inline'`` for pages. JSON
``<script type="application/json">`` tags are data, not script. Classic pages
declare intent on ``data-od-*`` and ``static/js/od_dom_actions.js`` runs it.

See docs/strategy/security-legal-playbook.md.
"""

from __future__ import annotations

import re
from pathlib import Path

TEMPLATE_ROOT = Path(__file__).resolve().parents[1] / 'oneirodex' / 'templates'
STATIC_JS = Path(__file__).resolve().parents[1] / 'oneirodex' / 'static' / 'js'
THEME_JS = (
    Path(__file__).resolve().parents[1]
    / 'oneirodex' / 'setup' / 'default_theme' / 'js'
)
JINJA_RE = re.compile(r'\{\{|\{%')

SCRIPT_RE = re.compile(r'<script(?P<attrs>[^>]*)>(?P<body>.*?)</script>', re.I | re.S)
SRC_RE = re.compile(r'\bsrc\s*=', re.I)
TYPE_RE = re.compile(r"""type\s*=\s*["']([^"']+)""", re.I)

# CSP-safe data islands. Anything else without src= is executable JS.
JSON_TYPES = {
    'application/json',
    'application/ld+json',
}

EVENT_ATTR_RE = re.compile(
    r'\son(?:click|change|submit|keyup|keydown|input|mouseover|mouseenter|'
    r'focus|blur|error|load|toggle)\s*=',
    re.I,
)
JS_URL_RE = re.compile(r"""(?:href|src|action)\s*=\s*['"]\s*javascript:""", re.I)
INLINE_HANDLER_IN_JS_RE = re.compile(r'''\bon(?:click|change|submit)\s*=\s*['"]''')


def _executable_inline_scripts(text: str, path: Path) -> list[str]:
    hits = []
    for match in SCRIPT_RE.finditer(text):
        attrs = match.group('attrs')
        if SRC_RE.search(attrs):
            continue
        type_match = TYPE_RE.search(attrs)
        typ = (type_match.group(1) if type_match else 'text/javascript').strip().lower()
        if typ in JSON_TYPES:
            continue
        line = text[: match.start()].count('\n') + 1
        rel = path.relative_to(TEMPLATE_ROOT).as_posix()
        hits.append(f'{rel}:{line} type={typ!r}')
    return hits


def test_templates_have_no_executable_inline_scripts():
    hits = []
    for path in sorted(TEMPLATE_ROOT.rglob('*.html')):
        hits.extend(_executable_inline_scripts(path.read_text(encoding='utf-8'), path))
    assert hits == [], (
        'Executable inline <script> without src= — extract to static/js '
        'or move data into type=application/json:\n  ' + '\n  '.join(hits)
    )


def test_templates_have_no_inline_event_handlers():
    """onclick= is script as far as CSP script-src is concerned."""
    hits = []
    for path in sorted(TEMPLATE_ROOT.rglob('*.html')):
        text = path.read_text(encoding='utf-8')
        rel = path.relative_to(TEMPLATE_ROOT).as_posix()
        for index, line in enumerate(text.splitlines(), start=1):
            if EVENT_ATTR_RE.search(line) or JS_URL_RE.search(line):
                hits.append(f'{rel}:{index}')
    assert hits == [], (
        'Inline event handler or javascript: URL — use data-od-click / '
        'data-od-change / data-od-confirm / data-od-open:\n  ' + '\n  '.join(hits)
    )


def test_extracted_static_js_has_no_jinja():
    """A mechanical extract that left `{% if %}` in a .js file is a SyntaxError."""
    hits = []
    for path in sorted(STATIC_JS.glob('od_*.js')):
        text = path.read_text(encoding='utf-8')
        if JINJA_RE.search(text):
            hits.append(path.name)
    assert hits == [], 'Jinja leftover in static JS: ' + ', '.join(hits)


def test_shipped_js_does_not_inject_inline_handlers():
    """innerHTML + onclick= recreates the handler CSP just dropped."""
    hits = []
    paths = list(STATIC_JS.glob('od_*.js'))
    if THEME_JS.is_dir():
        paths.extend(THEME_JS.glob('*.js'))
    for path in sorted(paths):
        if path.name == 'od_dom_actions.js':
            continue
        text = path.read_text(encoding='utf-8')
        if INLINE_HANDLER_IN_JS_RE.search(text):
            hits.append(path.name)
    assert hits == [], (
        'JS still injects onclick=/onchange=/onsubmit= — switch to data-od-*:\n  '
        + '\n  '.join(hits)
    )
