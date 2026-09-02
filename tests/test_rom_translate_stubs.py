"""Offline ROM translate capability stubs."""

from oneirodex.utils.rom_translate import get_pipeline_for_platform, list_rom_translate_capabilities
from oneirodex.utils.rom_translate.pipeline import GbaOfflineStub


def test_list_capabilities_includes_gba_stub_and_known_platforms():
    rows = list_rom_translate_capabilities()
    by_platform = {row['platform']: row for row in rows}
    assert by_platform['GBA']['status'] == 'stub'
    assert by_platform['GBA']['supports_offline'] is False
    assert by_platform['SNES']['status'] == 'unsupported'


def test_gba_pipeline_raises_on_extract():
    pipe = get_pipeline_for_platform('GBA')
    assert isinstance(pipe, GbaOfflineStub)
    try:
        pipe.extract('/tmp/no-rom.gba')
        assert False, 'expected NotImplementedError'
    except NotImplementedError as exc:
        assert 'not implemented' in str(exc).lower()
