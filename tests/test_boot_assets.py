"""An install should arrive with its fonts and firmware.

Both capabilities existed as scripts — `scripts/fetch-fonts.py` and
`scripts/import_bios.py` — and nothing called either. The result was a font
picker offering five faces and shipping none (`available_fonts()` honestly
reporting `installed: False` for each), and a populated local firmware folder
that the Emulators page still reported as empty.

The logic is now importable so boot can use it and the scripts stay the manual
path. These tests cover the importable half: no network, no database.
"""

from __future__ import annotations

import os
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]


# --------------------------------------------------------------------------
# Fonts
# --------------------------------------------------------------------------

def test_every_builtin_font_file_has_a_source(app):
    """A face registered without a download URL would report missing forever
    and never explain why."""
    from gametheca.utils.font_install import FONT_SOURCES
    from gametheca.utils.theme_fonts import BUILT_IN_FONTS

    registered = {e['file'] for e in BUILT_IN_FONTS.values() if e.get('file')}
    assert registered, 'no built-in faces ship files any more'
    assert registered <= set(FONT_SOURCES), (
        f'no source for: {sorted(registered - set(FONT_SOURCES))}'
    )


def test_missing_builtin_fonts_reports_only_absent_files(tmp_path, app):
    from gametheca.utils.font_install import missing_builtin_fonts
    from gametheca.utils.theme_fonts import BUILT_IN_FONTS

    names = [e['file'] for e in BUILT_IN_FONTS.values() if e.get('file')]
    assert missing_builtin_fonts(str(tmp_path)) == names

    (tmp_path / names[0]).write_bytes(b'\x00\x01\x00\x00stub')
    assert names[0] not in missing_builtin_fonts(str(tmp_path))


def test_install_rejects_an_html_error_page(tmp_path, app, monkeypatch):
    """The usual upstream failure is an HTML page served under a .ttf name.
    Writing it would leave a file that exists, never renders, and stops this
    ever retrying — the worst of the three outcomes."""
    import gametheca.utils.font_install as font_install

    class _Response:
        def __init__(self, payload):
            self._payload = payload

        def read(self):
            return self._payload

        def __enter__(self):
            return self

        def __exit__(self, *exc):
            return False

    class _Opener:
        addheaders: list = []

        def open(self, url, timeout=None):
            return _Response(b'<!doctype html><title>404</title>')

    monkeypatch.setattr(font_install.urllib.request, 'build_opener', lambda: _Opener())

    written = font_install.install_builtin_fonts(str(tmp_path))
    assert written == 0
    assert list(tmp_path.iterdir()) == []


def test_install_writes_a_real_font(tmp_path, app, monkeypatch):
    import gametheca.utils.font_install as font_install

    class _Response:
        def read(self):
            return b'\x00\x01\x00\x00' + b'x' * 64

        def __enter__(self):
            return self

        def __exit__(self, *exc):
            return False

    class _Opener:
        addheaders: list = []

        def open(self, url, timeout=None):
            return _Response()

    monkeypatch.setattr(font_install.urllib.request, 'build_opener', lambda: _Opener())

    written = font_install.install_builtin_fonts(str(tmp_path))
    assert written == len(font_install.FONT_SOURCES)
    # And a second call is a no-op, so boot does not re-download every start.
    assert font_install.install_builtin_fonts(str(tmp_path)) == 0


# --------------------------------------------------------------------------
# Firmware
# --------------------------------------------------------------------------

def test_scan_finds_firmware_in_subdirectories(app, tmp_path):
    """Collections arrive organised per system. A flat listing missing them is
    the same bug the serving-side discovery fix addressed."""
    from gametheca.utils.bios_install import scan_for_firmware, wanted_firmware_names

    name = next(iter(wanted_firmware_names().values()))
    nested = tmp_path / 'psx' / 'variants'
    nested.mkdir(parents=True)
    (nested / name).write_bytes(b'firmware')

    found = scan_for_firmware(str(tmp_path))
    assert name in found


def test_import_copies_missing_and_never_overwrites(app, tmp_path):
    """Safe to run on every boot: tops up gaps, leaves installed files alone —
    including firmware an operator deliberately swapped."""
    from gametheca.utils.bios_install import import_bios_from, wanted_firmware_names

    names = list(wanted_firmware_names().values())[:2]
    source = tmp_path / 'src'
    dest = tmp_path / 'dest'
    source.mkdir()
    dest.mkdir()
    for name in names:
        (source / name).write_bytes(b'from-source')

    # One already present, deliberately different.
    (dest / names[0]).write_bytes(b'operator-supplied')

    copied = import_bios_from(str(source), str(dest))

    assert copied == 1
    assert (dest / names[0]).read_bytes() == b'operator-supplied'
    assert (dest / names[1]).read_bytes() == b'from-source'


def test_import_is_idempotent(app, tmp_path):
    from gametheca.utils.bios_install import import_bios_from, wanted_firmware_names

    name = next(iter(wanted_firmware_names().values()))
    source = tmp_path / 'src'
    dest = tmp_path / 'dest'
    source.mkdir()
    (source / name).write_bytes(b'firmware')

    assert import_bios_from(str(source), str(dest)) == 1
    assert import_bios_from(str(source), str(dest)) == 0


# --------------------------------------------------------------------------
# Wiring
# --------------------------------------------------------------------------

def test_boot_calls_both_installers():
    """Source guard: the whole point is that these stopped being scripts nobody
    ran. Importable helpers that boot never calls would be the same bug."""
    source = (ROOT / 'gametheca' / 'init_data.py').read_text(encoding='utf-8')
    assert 'initialize_theme_fonts()' in source
    assert 'initialize_emulator_bios()' in source


def test_font_install_is_configurable_and_off_the_boot_path():
    """It downloads over the network. A slow or firewalled host must not become
    a slow or failed startup."""
    source = (ROOT / 'gametheca' / 'init_data.py').read_text(encoding='utf-8')
    assert 'FETCH_FONTS_ON_BOOT' in source
    assert 'run_in_background' in source

    config = (ROOT / 'config.py').read_text(encoding='utf-8')
    assert 'FETCH_FONTS_ON_BOOT' in config
    assert 'BIOS_IMPORT_SOURCE' in config
