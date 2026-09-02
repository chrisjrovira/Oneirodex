"""Every shipped SVG must parse as XML.

Why this exists: the brand mark disappeared from the rail, and every check that
could have caught it asked the wrong question.

`.od-brand-mark` paints `var(--od-accent)` through
`mask: url('/static/newstyle/oneirodex_glyph.svg')`, so the mark is a *mask
source*, not an image. The file's own `<desc>` explained the design and, in
doing so, wrote a bare tag in prose. An SVG is XML: that opened an element which
was never closed, so the document failed to parse. A mask whose source will not
decode contributes no alpha, so the element kept its 22px box and painted
nothing — the logo was simply gone, in both rail states.

Nothing caught it. The file was committed, served 200 with the right
content-type, and had the right byte length; `theme_asset` versioning, Reset
Themes and a hard refresh all "worked". `test_admin_shell.py` asserts the brand
is rendered by class rather than by filename, which is the right assertion for
what it guards and says nothing about whether the file behind it is valid.

So the guard has to be the one thing no other check does: parse it.
"""

from __future__ import annotations

import os
import xml.etree.ElementTree as ET

import pytest

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
STATIC_ROOT = os.path.join(REPO_ROOT, 'oneirodex', 'static')


def _svg_paths():
    """Every .svg under oneirodex/static, vendored trees excluded.

    Vendor bundles are third-party output — we do not edit them, so a failure
    there is not a regression this suite can act on.
    """
    for base, dirs, files in os.walk(STATIC_ROOT):
        dirs[:] = [d for d in dirs if d not in {'vendor', 'dist', 'node_modules'}]
        for name in sorted(files):
            if name.lower().endswith('.svg'):
                yield os.path.join(base, name)


SVGS = sorted(_svg_paths())


def test_there_are_svgs_to_check():
    """A discovery bug would otherwise make this whole file pass vacuously."""
    assert SVGS, f'no SVGs discovered under {STATIC_ROOT}'


@pytest.mark.parametrize('path', SVGS, ids=lambda p: os.path.relpath(p, STATIC_ROOT))
def test_svg_is_well_formed_xml(path):
    try:
        ET.parse(path)
    except ET.ParseError as exc:  # pragma: no cover - the message is the point
        rel = os.path.relpath(path, REPO_ROOT)
        pytest.fail(
            f'{rel} is not well-formed XML: {exc}\n'
            'A browser cannot decode it, so it renders as nothing wherever it is '
            'used as an <img> or a CSS mask. Escape angle brackets in <title>/'
            '<desc> prose as &lt; and &gt;.'
        )


def test_the_brand_glyph_has_opaque_geometry_for_the_mask():
    """Parsing is necessary but not sufficient for a mask source.

    `mask-mode` resolves to alpha for an image source, so a glyph drawn only
    with strokes, or with everything fully transparent, would parse cleanly and
    still paint nothing. The mark is built from filled rects; assert at least
    one shape carries a fill that is neither `none` nor fully transparent.
    """
    path = os.path.join(STATIC_ROOT, 'newstyle', 'oneirodex_glyph.svg')
    root = ET.parse(path).getroot()

    def opaque(el):
        fill = (el.get('fill') or '').strip().lower()
        if not fill or fill == 'none':
            return False
        return (el.get('fill-opacity') or '1') != '0' and (el.get('opacity') or '1') != '0'

    assert any(opaque(el) for el in root.iter()), (
        f'{path} parses but has no opaque filled shape, so a CSS mask built '
        'from it would contribute no alpha and paint nothing.'
    )
