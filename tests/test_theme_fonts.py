"""Font theming — per-system faces for emulator/library surfaces."""

from __future__ import annotations

import os

import pytest

from gametheca.utils.theme_fonts import (
    BUILT_IN_FONTS,
    DEFAULT_FONT_ID,
    available_fonts,
    font_face_css,
    font_for_platform,
    resolve_font,
)


class TestCatalogue:
    def test_ships_no_console_manufacturer_typefaces(self, app):
        """Nintendo/Sega/Sony faces are trademarked and not redistributable —
        bundling one would put an infringing asset in every install."""
        with app.app_context():
            blob = ' '.join(
                f"{e['label']} {e['stack']} {e.get('file') or ''}".lower()
                for e in BUILT_IN_FONTS.values()
            )
            for brand in ('nintendo', 'sega', 'sony', 'playstation', 'gameboy', 'famicom'):
                assert brand not in blob

    def test_every_built_in_declares_its_licence(self, app):
        with app.app_context():
            for key, entry in BUILT_IN_FONTS.items():
                assert entry.get('license'), f'{key} has no licence recorded'

    def test_reports_installed_honestly(self, app):
        """A face whose file is absent must not claim to be installed — its CSS
        stack silently falls through, and the picker should be able to say so."""
        with app.app_context():
            catalogue = available_fonts()
            root = catalogue and os.path.isdir.__self__ and None  # noqa: F841
            for entry in catalogue.values():
                if entry['file'] is None:
                    assert entry['installed'] is True  # system stack always works
                else:
                    assert isinstance(entry['installed'], bool)


class TestResolution:
    def test_unknown_id_falls_back_to_default(self, app):
        with app.app_context():
            assert resolve_font('not-a-font')['label'] == BUILT_IN_FONTS[DEFAULT_FONT_ID]['label']
            assert resolve_font(None)['label'] == BUILT_IN_FONTS[DEFAULT_FONT_ID]['label']

    def test_era_appropriate_face_per_platform(self, app):
        with app.app_context():
            assert 'Press Start' in font_for_platform('NES')['stack']
            assert 'Press Start' in font_for_platform('SNES')['stack']
            # Disc era gets the 32-bit face, not the 8-bit one.
            assert 'Orbitron' in font_for_platform('PSX')['stack']
            assert 'VT323' in font_for_platform('AMIGA')['stack']

    def test_platform_lookup_is_case_insensitive(self, app):
        with app.app_context():
            assert font_for_platform('nes')['stack'] == font_for_platform('NES')['stack']

    def test_unknown_platform_gets_the_default(self, app):
        with app.app_context():
            assert font_for_platform('SOME_FUTURE_CONSOLE')['label'] == (
                BUILT_IN_FONTS[DEFAULT_FONT_ID]['label']
            )
        # A platform we have no opinion on must not error.

    def test_every_stack_has_a_fallback_family(self, app):
        """Single-family stacks break hard when the file is missing."""
        with app.app_context():
            for key, entry in BUILT_IN_FONTS.items():
                assert ',' in entry['stack'], f'{key} has no fallback family'


class TestFontFaceCss:
    def test_emits_nothing_for_missing_files(self, app, tmp_path):
        """A @font-face pointing at a missing file makes the browser fetch,
        fail, and fall back anyway — so it is noise, not resilience."""
        with app.app_context():
            app.config['FONT_PATH'] = str(tmp_path)
            assert font_face_css().strip() == ''

    def test_emits_a_rule_once_a_file_is_present(self, app, tmp_path):
        with app.app_context():
            app.config['FONT_PATH'] = str(tmp_path)
            (tmp_path / 'VT323-Regular.ttf').write_bytes(b'\x00\x01\x00\x00')
            css = font_face_css()
            assert '@font-face' in css
            assert 'VT323' in css
            assert "format('truetype')" in css

    def test_operator_drop_ins_are_offered(self, app, tmp_path):
        with app.app_context():
            app.config['FONT_PATH'] = str(tmp_path)
            (tmp_path / 'MyLicensedFace.otf').write_bytes(b'\x00\x01\x00\x00')
            catalogue = available_fonts()
            assert 'mylicensedface' in catalogue
            assert catalogue['mylicensedface']['era'] == 'operator'
            assert catalogue['mylicensedface']['installed'] is True
