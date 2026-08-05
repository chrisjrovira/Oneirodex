"""FEAT-D5 — per-system room treatment for the play surface."""

from __future__ import annotations

import pytest

from gametheca.utils.play_rooms import (
    DEFAULT_ROOM,
    PLATFORM_ROOMS,
    ROOMS,
    room_css_vars,
    room_for_platform,
    room_id_for_platform,
)


class TestRoomMapping:
    def test_groups_by_setting_not_by_brand(self, app):
        """The point of rooms: a Mega Drive and a SNES shared a living room,
        while a Neo Geo cabinet did not — brand is the wrong axis here."""
        with app.app_context():
            assert room_id_for_platform('SNES') == room_id_for_platform('SEGA_MD')
            assert room_id_for_platform('NEOGEO') == 'arcade_cabinet'
            assert room_id_for_platform('SNES') != room_id_for_platform('NEOGEO')

    def test_handhelds_share_a_room_across_brands(self, app):
        with app.app_context():
            for key in ('GB', 'LYNX', 'NGP', 'PSP', 'WS'):
                assert room_id_for_platform(key) == 'handheld'

    def test_disc_generation_is_its_own_setting(self, app):
        with app.app_context():
            for key in ('PSX', 'SEGA_SATURN', 'NGC', 'THREEDO'):
                assert room_id_for_platform(key) == 'disc_era'

    def test_computers_land_on_the_desk(self, app):
        with app.app_context():
            for key in ('PCDOS', 'AMIGA', 'VICE_X64SC'):
                assert room_id_for_platform(key) == 'desk'

    def test_unmapped_platform_gets_a_plausible_default(self, app):
        """A console added tomorrow should look fine, not break the page."""
        with app.app_context():
            assert room_id_for_platform('SOME_FUTURE_CONSOLE') == DEFAULT_ROOM
            assert room_id_for_platform(None) == DEFAULT_ROOM

    def test_lookup_is_case_insensitive(self, app):
        with app.app_context():
            assert room_id_for_platform('psx') == room_id_for_platform('PSX')

    def test_every_mapped_room_actually_exists(self, app):
        with app.app_context():
            for platform, room_id in PLATFORM_ROOMS.items():
                assert room_id in ROOMS, f'{platform} points at unknown room {room_id}'


class TestRoomPayload:
    def test_carries_palette_and_era_font(self, app):
        with app.app_context():
            room = room_for_platform('NES')
            assert room['id'] == 'crt_living_room'
            assert room['backdrop'].startswith('#')
            assert room['glow'].startswith('#')
            # Pairs with the font registry rather than duplicating it.
            assert 'Press Start' in room['font_stack']

    def test_arcade_and_living_room_are_visually_distinct(self, app):
        with app.app_context():
            arcade = room_for_platform('ARCADE')
            living = room_for_platform('SNES')
            assert arcade['backdrop'] != living['backdrop']
            assert arcade['ambience'] != living['ambience']

    def test_css_vars_are_ready_to_apply(self, app):
        with app.app_context():
            css = room_css_vars('PSX')
            assert set(css) == {
                '--gt-room-backdrop', '--gt-room-glow',
                '--gt-room-accent', '--gt-room-font',
            }
            assert all(v for v in css.values())

    def test_no_room_imitates_manufacturer_trade_dress(self, app):
        """Period setting, not branding — same line the font registry holds."""
        with app.app_context():
            blob = ' '.join(
                f"{r['label']} {r['blurb']} {r['surface']}" for r in ROOMS.values()
            ).lower()
            for brand in ('nintendo', 'sega', 'sony', 'playstation', 'xbox', 'atari'):
                assert brand not in blob
