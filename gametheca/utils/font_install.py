"""Install the built-in theme fonts.

``scripts/fetch-fonts.py`` has always known how to do this. Nothing called it,
so a fresh install offered five faces in the picker and shipped none of them —
``available_fonts()`` reported ``installed: False`` for each, which was honest
and still left the product looking broken to anyone who had not read the script.

This is the same download, importable, so first boot can do it and the script
stays the manual/air-gapped path. Both use one source table: two copies of a URL
list is how one of them ends up stale.

All faces are SIL Open Font License 1.1 from the official ``google/fonts``
repository, fetched by exact path.
"""

from __future__ import annotations

import os
import urllib.error
import urllib.request

RAW = 'https://raw.githubusercontent.com/google/fonts/main/ofl'

USER_AGENT = 'GameTheca-font-install/1.0 (+https://github.com/chrisjrovira/gametheca)'

#: ``(filename, url)`` for every built-in face that ships as a file.
#: Keep in step with ``BUILT_IN_FONTS`` in :mod:`gametheca.utils.theme_fonts`;
#: :func:`missing_builtin_fonts` reads that registry rather than this table, so a
#: face added there without a source here is reported, not silently skipped.
FONT_SOURCES: dict[str, str] = {
    'PressStart2P-Regular.ttf': f'{RAW}/pressstart2p/PressStart2P-Regular.ttf',
    'Silkscreen-Regular.ttf': f'{RAW}/silkscreen/Silkscreen-Regular.ttf',
    'VT323-Regular.ttf': f'{RAW}/vt323/VT323-Regular.ttf',
    'ShareTechMono-Regular.ttf': f'{RAW}/sharetechmono/ShareTechMono-Regular.ttf',
    'Orbitron-Variable.ttf': f'{RAW}/orbitron/Orbitron%5Bwght%5D.ttf',
}

#: TrueType, OpenType, and the two WOFF wrappers.
_FONT_MAGIC = (b'\x00\x01\x00\x00', b'OTTO', b'true', b'ttcf', b'wOFF', b'wOF2')


def _looks_like_font(head: bytes) -> bool:
    return any(head.startswith(magic) for magic in _FONT_MAGIC)


def missing_builtin_fonts(root: str) -> list[str]:
    """Built-in font filenames not present under *root*."""
    from gametheca.utils.theme_fonts import BUILT_IN_FONTS

    missing = []
    for entry in BUILT_IN_FONTS.values():
        name = entry.get('file')
        if name and not os.path.isfile(os.path.join(root, name)):
            missing.append(name)
    return missing


def install_builtin_fonts(root: str, *, force: bool = False) -> int:
    """Download any missing built-in face into *root*. Returns files written.

    Never raises for a single failed download: a face that does not arrive falls
    through to the next family in its CSS stack, so one unreachable URL should
    cost one font rather than the whole install.
    """
    os.makedirs(root, exist_ok=True)

    opener = urllib.request.build_opener()
    opener.addheaders = [('User-Agent', USER_AGENT)]

    wanted = list(FONT_SOURCES) if force else missing_builtin_fonts(root)
    written = 0

    for name in wanted:
        url = FONT_SOURCES.get(name)
        if not url:
            # Registered face with no source here — worth knowing about, but not
            # worth failing the others for.
            continue
        dest = os.path.join(root, name)
        try:
            with opener.open(url, timeout=60) as response:
                payload = response.read()
        except (urllib.error.HTTPError, urllib.error.URLError, OSError):
            continue

        # An HTML error page with a .ttf name is the usual failure, and writing
        # it would leave a file that exists, never renders, and stops this
        # function ever retrying.
        if not payload or not _looks_like_font(payload[:4]):
            continue

        with open(dest, 'wb') as handle:
            handle.write(payload)
        written += 1

    return written
