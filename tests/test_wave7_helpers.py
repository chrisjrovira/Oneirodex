"""Wave 7 unit tests — wanted queue, cheats helpers, play gates (no DB)."""

from types import SimpleNamespace

from gametheca.platform import WEBRETR_INSTALLED_CORES, core_is_browser_playable
from gametheca.utils import wanted_updates as wu
from gametheca.utils.play_url import WEBRETRO_PLATFORMS, browse_play_fields


def test_webretro_platforms_include_sega_cd_and_exclude_pcdos():
    assert 'SEGA_CD' in WEBRETRO_PLATFORMS
    assert 'PCDOS' not in WEBRETRO_PLATFORMS
    assert core_is_browser_playable('nestopia')
    assert not core_is_browser_playable('dosbox_pure')
    assert 'parallel_n64' in WEBRETR_INSTALLED_CORES


def test_browse_play_fields_requires_bundled_core(monkeypatch):
    game = SimpleNamespace(uuid='aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee', library=None)

    def fake_resolve(_platform):
        return {'emulators': ['nestopia'], 'preferred': 'nestopia'}

    monkeypatch.setattr(
        'gametheca.utils.emulator_profiles.resolve_emulators_for_platform',
        fake_resolve,
    )
    # No platform → not playable
    assert browse_play_fields(game)['can_play_in_browser'] is False


def test_wanted_queue_add_and_fulfill(tmp_path, monkeypatch):
    monkeypatch.setattr(wu, '_library_root', lambda: str(tmp_path))
    item = wu.add_wanted(1, game_uuid='game-1', kind='update', label='Patch')
    assert item['status'] == 'wanted'
    assert len(wu.list_wanted(1)) == 1
    assert wu.mark_fulfilled(1, 'game-1', kind='update') == 1
    assert wu.list_wanted(1)[0]['status'] == 'available'
