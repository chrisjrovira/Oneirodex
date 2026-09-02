"""BIOS files in subdirectories must be found and correctly reported (UID-007).

Reported symptom: "bios we push for my local repo don't show as loaded or on the
system". Cause: `list_bios_files` was a flat `os.listdir` that skipped
directories, and firmware sets almost always ship organised per system —
`bios/psx/`, `bios/saturn/`. So an operator could copy a hundred files in and
see an empty panel with nothing explaining why.

Finding them is only half of it. Libretro cores read the *system root*, so a
nested file is present on disk and still will not load. "Absent" and "present
but misplaced" are different problems with different fixes, and collapsing them
into "missing" is what made a populated volume look empty.
"""

import os

import pytest


@pytest.fixture
def bios_volume(app, tmp_path):
    """A firmware volume with files at the root and one level down."""
    root = tmp_path / 'bios'
    (root / 'psx').mkdir(parents=True)
    (root / 'saturn').mkdir(parents=True)

    (root / 'scph5501.bin').write_bytes(b'\x00' * 512)      # root: loadable
    (root / 'psx' / 'scph1001.bin').write_bytes(b'\x00' * 512)   # nested
    (root / 'saturn' / 'sega_101.bin').write_bytes(b'\x00' * 512)  # nested

    app.config['EMULATOR_BIOS_PATH'] = str(root)
    return root


def test_finds_files_in_subdirectories(app, bios_volume):
    from oneirodex.utils.emulator_bios import list_bios_files

    with app.test_request_context():
        names = {row['name'] for row in list_bios_files()}

    # The whole bug: these three were invisible.
    assert names == {'scph5501.bin', 'scph1001.bin', 'sega_101.bin'}


def test_reports_which_subdirectory_a_file_is_in(app, bios_volume):
    from oneirodex.utils.emulator_bios import list_bios_files

    with app.test_request_context():
        rows = {row['name']: row for row in list_bios_files()}

    assert rows['scph1001.bin']['subdir'] == 'psx'
    assert rows['sega_101.bin']['subdir'] == 'saturn'
    assert rows['scph5501.bin']['subdir'] == ''


def test_only_root_files_are_loadable(app, bios_volume):
    """Being found is not being usable — cores read the system root only."""
    from oneirodex.utils.emulator_bios import list_bios_files

    with app.test_request_context():
        rows = {row['name']: row for row in list_bios_files()}

    assert rows['scph5501.bin']['loadable'] is True
    assert rows['scph1001.bin']['loadable'] is False
    assert rows['sega_101.bin']['loadable'] is False


def test_an_empty_volume_lists_nothing_without_erroring(app, tmp_path):
    from oneirodex.utils.emulator_bios import list_bios_files

    app.config['EMULATOR_BIOS_PATH'] = str(tmp_path / 'empty')
    with app.test_request_context():
        assert list_bios_files() == []


def test_core_status_separates_misplaced_from_missing(app, tmp_path):
    """The distinction that turns a dead end into an actionable message."""
    from oneirodex.utils.emulator_bios import BIOS_REQUIREMENTS, bios_status_for_cores

    core, required = next(iter(BIOS_REQUIREMENTS.items()))
    wanted = required[0]

    root = tmp_path / 'bios'
    (root / 'nested').mkdir(parents=True)
    (root / 'nested' / wanted).write_bytes(b'\x00' * 64)
    app.config['EMULATOR_BIOS_PATH'] = str(root)

    with app.test_request_context():
        status = {row['core']: row for row in bios_status_for_cores()}[core]

    assert status['ready'] is False, 'a nested file must not report as ready'
    assert [row['name'] for row in status['misplaced']] == [wanted]
    assert status['misplaced'][0]['subdir'] == 'nested'


def test_root_file_reports_ready(app, tmp_path):
    from oneirodex.utils.emulator_bios import BIOS_REQUIREMENTS, bios_status_for_cores

    core, required = next(iter(BIOS_REQUIREMENTS.items()))
    root = tmp_path / 'bios'
    root.mkdir(parents=True)
    (root / required[0]).write_bytes(b'\x00' * 64)
    app.config['EMULATOR_BIOS_PATH'] = str(root)

    with app.test_request_context():
        status = {row['core']: row for row in bios_status_for_cores()}[core]

    assert status['ready'] is True
    assert status['misplaced'] == []


def _first_platform_needing_bios(app, tmp_path):
    """(platform name, one required filename) for a system that needs firmware."""
    from oneirodex.utils.emulator_bios import bios_status_for_platforms

    app.config['EMULATOR_BIOS_PATH'] = str(tmp_path / 'probe')
    with app.test_request_context():
        row = next(r for r in bios_status_for_platforms() if r['required'])
    return row['platform'], row['required'][0]


def test_platform_status_does_not_call_a_nested_file_ready(app, tmp_path):
    """The per-platform view has to agree with the per-core one.

    Both read the same list, and this one judged readiness on every row rather
    than the loadable ones — so it announced a system ready to play while the
    core view called the very same file misplaced. The panel answers "which of
    my systems can actually play?", and a nested file is precisely the case
    where the honest answer is no.
    """
    from oneirodex.utils.emulator_bios import bios_status_for_platforms

    platform, wanted = _first_platform_needing_bios(app, tmp_path)

    root = tmp_path / 'bios'
    (root / 'nested').mkdir(parents=True)
    (root / 'nested' / wanted).write_bytes(b'\x00' * 64)
    app.config['EMULATOR_BIOS_PATH'] = str(root)

    with app.test_request_context():
        status = {r['platform']: r for r in bios_status_for_platforms()}[platform]

    assert status['ready'] is False, 'a nested file must not report as ready'
    assert wanted in status['missing']
    assert wanted not in status['present']
    # Named separately so the panel can say "move this" rather than "missing".
    assert [row['name'] for row in status['misplaced']] == [wanted]
    assert status['misplaced'][0]['subdir'] == 'nested'


def test_platform_status_reports_ready_for_a_root_file(app, tmp_path):
    from oneirodex.utils.emulator_bios import bios_status_for_platforms

    platform, wanted = _first_platform_needing_bios(app, tmp_path)

    root = tmp_path / 'bios'
    root.mkdir(parents=True)
    (root / wanted).write_bytes(b'\x00' * 64)
    app.config['EMULATOR_BIOS_PATH'] = str(root)

    with app.test_request_context():
        status = {r['platform']: r for r in bios_status_for_platforms()}[platform]

    assert status['ready'] is True
    assert status['misplaced'] == []


def test_cartridge_sega_systems_do_not_inherit_the_sega_cd_bios(app, tmp_path):
    """One core serves many consoles; its firmware list belongs to one of them.

    `genesis_plus_gx` runs Mega Drive, Master System, Game Gear, SG-1000, 32X
    *and* Sega CD, and only the last needs a BIOS. The per-platform view used to
    union every requirement of every core mapped to a platform, so all six
    claimed to need `bios_CD_*.bin` — and once those files were present, all six
    reported ready on the strength of firmware irrelevant to a cartridge. The
    verdict happened to be right and the reason shown to the operator was wrong.
    """
    from oneirodex.utils.emulator_bios import bios_status_for_platforms

    root = tmp_path / 'bios'
    root.mkdir(parents=True)
    for name in ('bios_CD_U.bin', 'bios_CD_E.bin', 'bios_CD_J.bin'):
        (root / name).write_bytes(b'\x00' * 64)
    app.config['EMULATOR_BIOS_PATH'] = str(root)

    with app.test_request_context():
        rows = {r['platform']: r for r in bios_status_for_platforms()}

    # The CD add-on is the one that needs it, and still says so.
    assert 'SEGA_CD' in rows
    assert rows['SEGA_CD']['ready'] is True

    # The cartridge systems need no firmware, so they are absent entirely
    # rather than listed with a requirement the operator can never make sense of.
    for platform in ('SEGA_MD', 'SEGA_MS', 'SEGA_GG', 'SEGA_32X', 'SEGA_SG1000'):
        assert platform not in rows, (
            f'{platform} is a cartridge system and must not claim to need a Sega CD BIOS'
        )


def test_other_shared_core_platforms_are_scoped_too(app, tmp_path):
    """The same trap on three more cores — assert the whole set, not one case."""
    from oneirodex.utils.emulator_bios import bios_status_for_platforms

    root = tmp_path / 'bios'
    root.mkdir(parents=True)
    app.config['EMULATOR_BIOS_PATH'] = str(root)

    with app.test_request_context():
        rows = {r['platform']: r for r in bios_status_for_platforms()}

    # mgba carries gba_bios.bin; Game Boy and Game Boy Color need nothing.
    assert 'GBA' in rows and rows['GBA']['required'] == ['gba_bios.bin']
    assert 'GB' not in rows and 'GBC' not in rows

    # mednafen_pce* carry the CD system card; HuCard and SuperGrafx carts do not.
    assert 'PCE_CD' in rows and rows['PCE_CD']['required'] == ['syscard3.pce']
    assert 'PCE' not in rows and 'SUPERGRAFX' not in rows

    # dolphin carries the GameCube IPL; the Wii does not use it.
    assert 'NGC' in rows and rows['NGC']['required'] == ['IPL.bin']
    assert 'WII' not in rows


def test_every_override_names_a_real_platform(app):
    """A typo in the override table would silently do nothing."""
    from oneirodex.platform import LibraryPlatform
    from oneirodex.utils.emulator_bios import PLATFORM_BIOS_OVERRIDES

    known = {p.name for p in LibraryPlatform}
    unknown = sorted(set(PLATFORM_BIOS_OVERRIDES) - known)
    assert not unknown, f'PLATFORM_BIOS_OVERRIDES names unknown platforms: {unknown}'


def test_optional_cart_systems_drop_out_of_the_platform_panel(app, tmp_path):
    """NES/SNES/N64 optional files must not look like a missing-BIOS row."""
    from oneirodex.utils.emulator_bios import bios_status_for_platforms

    root = tmp_path / 'bios'
    root.mkdir(parents=True)
    app.config['EMULATOR_BIOS_PATH'] = str(root)

    with app.test_request_context():
        rows = {r['platform']: r for r in bios_status_for_platforms()}

    for platform in ('NES', 'SNES', 'N64'):
        assert platform not in rows, (
            f'{platform} carts boot without the optional add-on ROM and must not '
            'appear as an unready firmware row'
        )
