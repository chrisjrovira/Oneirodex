"""W20-1: propose leaf libraries (propose-only; never auto-create)."""

import os

from gametheca.utils.functions import DEFAULT_SKIP_DIR_GLOBS
from gametheca.utils.propose_leaf_libraries import (
    FAMILY_PARENT_NAMES,
    infer_platform_from_name,
    is_family_parent_name,
    propose_leaf_libraries,
)


def _paths(candidates):
    return {os.path.normcase(c['path']) for c in candidates}


def _by_suffix(candidates, *parts):
    """Return first candidate whose path ends with the joined parts."""
    needle = os.path.normcase(os.path.join(*parts))
    for c in candidates:
        if os.path.normcase(c['path']).endswith(needle):
            return c
    return None


def test_family_parent_names_locked():
    for name in ('NINTENDO', 'Sega', 'Sony', 'ATARI', '_console-gaming', 'Arcade'):
        assert is_family_parent_name(name)
    assert 'nintendo' in FAMILY_PARENT_NAMES
    assert not is_family_parent_name('Switch')
    assert not is_family_parent_name('PlayStation')
    assert not is_family_parent_name('MAME')
    # HuCard dumps live in a folder named PC Engine — not a family parent.
    assert not is_family_parent_name('PC Engine')
    assert not is_family_parent_name('PC-Engine')


def test_infer_platform_switch_and_psx():
    assert infer_platform_from_name('Switch') == 'SWITCH'
    assert infer_platform_from_name('Nintendo Switch') == 'SWITCH'
    assert infer_platform_from_name('PlayStation') == 'PSX'
    assert infer_platform_from_name('Ninentdo Entertainment System') == 'NES'


def test_infer_platform_household_leaves():
    """Household `_console-gaming` basenames, including the NES/SNES typo."""
    assert infer_platform_from_name('Super Ninentdo Entertainment System') == 'SNES'
    assert infer_platform_from_name('Super Nintendo Entertainment System') == 'SNES'
    assert infer_platform_from_name('Sega Genesis 32X') == 'SEGA_32X'
    assert infer_platform_from_name('Sega Genesis') == 'SEGA_MD'
    assert infer_platform_from_name('Sega SG-1000') == 'SEGA_SG1000'
    assert infer_platform_from_name('Neo Geo Pocket Color') == 'NGPC'
    assert infer_platform_from_name('Neo Geo Pocket') == 'NGP'
    assert infer_platform_from_name('TurboGrafx CD') == 'PCE_CD'
    assert infer_platform_from_name('TurboGrafx-16') == 'PCE'
    assert infer_platform_from_name('SuperGrafx') == 'SUPERGRAFX'
    assert infer_platform_from_name('Commodore Amiga') == 'AMIGA'
    assert infer_platform_from_name('Future Pinball') == 'PINBALL'
    assert infer_platform_from_name('Actionmax') == 'ACTIONMAX'
    assert infer_platform_from_name('Magnavox Odyssey 2') == 'O2EM'
    assert infer_platform_from_name('Channel F') == 'CHAF'
    assert infer_platform_from_name('Atari - 7800 [Headered]') == 'ATARI_7800'
    assert infer_platform_from_name('Sony PlayStation 2') == 'PS2'
    assert infer_platform_from_name('Adventurevision') == 'ADVISION'
    assert infer_platform_from_name('AAE') == 'ARCADE'
    assert infer_platform_from_name('MAME') == 'ARCADE'
    assert infer_platform_from_name('PC Engine') == 'PCE'
    assert infer_platform_from_name('Wonderswan Color') == 'WS'
    assert infer_platform_from_name('Wonderswan Mono') == 'WS'
    assert infer_platform_from_name('Nintendo Game Boy') == 'GB'
    assert infer_platform_from_name('Nintendo Game Boy Color') == 'GBC'
    assert infer_platform_from_name('Nintendo Game Boy Advance') == 'GBA'
    assert infer_platform_from_name('Nintendo GameCube') == 'NGC'
    assert infer_platform_from_name('Nintendo Switch') == 'SWITCH'
    assert infer_platform_from_name('GCE Vectrex') == 'VECTREX'
    assert infer_platform_from_name('Panasonic 3DO') == 'THREEDO'
    assert infer_platform_from_name('RCA Studio II') == 'STUDIO2'
    assert infer_platform_from_name('Atari - Jaguar') == 'JAGUAR'
    assert infer_platform_from_name('Atari - Lynx [Headered]') == 'LYNX'
    assert infer_platform_from_name('Sony PSP') == 'PSP'
    assert infer_platform_from_name('PCFX') == 'PCFX'


def test_family_parent_rejected_as_candidate(tmp_path):
    """Pointing at a family parent must not propose the family itself as a lib."""
    root = tmp_path / '_console-gaming'
    nintendo = root / 'NINTENDO'
    switch = nintendo / 'Switch'
    switch.mkdir(parents=True)
    (switch / 'Zelda').mkdir()
    (switch / 'Mario Odyssey').mkdir()
    # Sibling emu under family — must not be proposed
    (nintendo / 'ryujinx-1.1.0').mkdir()
    (root / 'Sega').mkdir()

    candidates = propose_leaf_libraries(str(root))
    paths = _paths(candidates)

    assert os.path.normcase(str(root)) not in paths
    assert os.path.normcase(str(nintendo)) not in paths
    assert os.path.normcase(str(root / 'Sega')) not in paths
    assert all(not is_family_parent_name(os.path.basename(c['path'])) for c in candidates)

    switch_c = _by_suffix(candidates, 'NINTENDO', 'Switch')
    assert switch_c is not None
    assert switch_c['platform'] == 'SWITCH'
    assert switch_c['scan_mode'] == 'folders'
    assert switch_c['scan_depth'] == 1


def test_ryujinx_emu_skipped(tmp_path):
    root = tmp_path / '_console-gaming'
    nintendo = root / 'NINTENDO'
    emu = nintendo / 'ryujinx-canary'
    emu.mkdir(parents=True)
    (emu / 'bis').mkdir()
    (emu / 'system').mkdir()
    leaf = nintendo / 'Switch'
    leaf.mkdir()
    (leaf / 'Title A').mkdir()

    candidates = propose_leaf_libraries(str(root), skip_dir_patterns=DEFAULT_SKIP_DIR_GLOBS)
    paths = _paths(candidates)
    assert os.path.normcase(str(emu)) not in paths
    assert any(c['platform'] == 'SWITCH' for c in candidates)


def test_switch_leaf_folders_depth_1(tmp_path):
    leaf = tmp_path / 'Switch'
    leaf.mkdir()
    (leaf / 'Animal Crossing').mkdir()
    (leaf / 'Splatoon 2').mkdir()
    (leaf / 'readme.txt').write_text('x')

    candidates = propose_leaf_libraries(str(leaf))
    assert len(candidates) == 1
    c = candidates[0]
    assert c['platform'] == 'SWITCH'
    assert c['scan_mode'] == 'folders'
    assert c['scan_depth'] == 1
    assert 'Switch' in c['suggested_name'] or c['suggested_name'] == 'Nintendo Switch'


def test_playstation_roms_proposes_psx(tmp_path):
    root = tmp_path / '_console-gaming'
    ps = root / 'Sony' / 'PlayStation'
    roms = ps / 'ROMs'
    roms.mkdir(parents=True)
    (roms / 'Final Fantasy VII.bin').write_bytes(b'x')
    (roms / 'Metal Gear Solid.bin').write_bytes(b'x')
    # Portable emu sibling — skip
    (root / 'Sony' / 'duckstation-qt-x64').mkdir(parents=True)

    candidates = propose_leaf_libraries(str(root))
    assert all('duckstation' not in c['path'].casefold() for c in candidates)
    roms_c = _by_suffix(candidates, 'PlayStation', 'ROMs')
    assert roms_c is not None
    assert roms_c['platform'] == 'PSX'
    assert roms_c['scan_mode'] == 'files'
    assert roms_c['scan_depth'] == 1
    # Never propose Sony family or PlayStation emu-ish parent when ROMs exists
    assert os.path.normcase(str(root / 'Sony')) not in _paths(candidates)
    assert os.path.normcase(str(ps)) not in _paths(candidates)


def test_letter_buckets_folders_depth_2(tmp_path):
    leaf = tmp_path / 'Genesis'
    leaf.mkdir()
    for bucket in ('_a', '_b', '_m', '_z'):
        (leaf / bucket).mkdir()
        (leaf / bucket / 'Some Title').mkdir()

    candidates = propose_leaf_libraries(str(leaf))
    assert len(candidates) == 1
    assert candidates[0]['platform'] == 'SEGA_MD'
    assert candidates[0]['scan_mode'] == 'folders'
    assert candidates[0]['scan_depth'] == 2


def test_propose_is_side_effect_free(tmp_path):
    """Propose returns candidates only — no Library create path in this module."""
    leaf = tmp_path / 'Switch'
    leaf.mkdir()
    (leaf / 'Game').mkdir()
    import gametheca.utils.propose_leaf_libraries as mod
    assert not hasattr(mod, 'Library')
    out = propose_leaf_libraries(str(leaf))
    assert len(out) == 1
    assert out[0]['platform'] == 'SWITCH'


def test_nested_roms_under_emu_install(tmp_path):
    """Portable PS1 tree: propose nested ROMs only, not emu root."""
    emu = tmp_path / 'epsxe_portable'
    # Treat as duckstation-like via skip pattern override for this fixture name
    roms = emu / 'ROMs'
    roms.mkdir(parents=True)
    (roms / 'game.bin').write_bytes(b'x')
    (emu / 'BIOS').mkdir()
    (emu / 'plugins').mkdir()

    patterns = list(DEFAULT_SKIP_DIR_GLOBS) + ['epsxe*']
    candidates = propose_leaf_libraries(str(tmp_path), skip_dir_patterns=patterns)
    assert os.path.normcase(str(emu)) not in _paths(candidates)
    roms_c = _by_suffix(candidates, 'epsxe_portable', 'ROMs')
    assert roms_c is not None


def test_pc_engine_hucard_dump_is_a_leaf(tmp_path):
    """Household PC Engine folder is a .pce dump, not a skipped family parent."""
    root = tmp_path / '_console-gaming'
    leaf = root / 'PC Engine'
    leaf.mkdir(parents=True)
    (leaf / 'Bomberman (Japan).pce').write_bytes(b'x')
    (leaf / 'Gradius (Japan).pce').write_bytes(b'x')
    (root / 'NINTENDO').mkdir()

    candidates = propose_leaf_libraries(str(root))
    pce = _by_suffix(candidates, 'PC Engine')
    assert pce is not None
    assert pce['platform'] == 'PCE'
    assert pce['scan_mode'] == 'files'


def test_aae_vector_sets_propose_as_arcade(tmp_path):
    leaf = tmp_path / 'AAE'
    leaf.mkdir()
    (leaf / 'asteroid').mkdir()
    (leaf / 'llander').mkdir()

    candidates = propose_leaf_libraries(str(leaf))
    assert len(candidates) == 1
    assert candidates[0]['platform'] == 'ARCADE'
    assert candidates[0]['scan_mode'] == 'folders'


def test_propose_from_games_root_walks_console_lane_and_pc(tmp_path):
    """Household games root: `_console-gaming` + `_pc` are skip-dir names
    but still the trees to propose from — walkthroughs and emu installs are not.
    """
    root = tmp_path / 'games'
    console = root / '_console-gaming'
    nes = console / 'NINTENDO' / 'Ninentdo Entertainment System'
    nes.mkdir(parents=True)
    (nes / 'Mario').mkdir()
    snes = console / 'NINTENDO' / 'Super Ninentdo Entertainment System'
    snes_roms = snes / 'ROMs'
    snes_roms.mkdir(parents=True)
    (snes_roms / 'Zelda').mkdir()
    pce = console / 'PC Engine'
    pce.mkdir()
    (pce / 'Bomberman (Japan).pce').write_bytes(b'x')
    mame = console / 'MAME'
    mame.mkdir()
    (mame / '1942.zip').write_bytes(b'x')
    (mame / 'mslug.zip').write_bytes(b'x')
    (mame / 'mame0274b_64bit').mkdir()
    (console / 'Zinc').mkdir()
    (console / 'xenia_master').mkdir()
    arcade_roms = console / 'Arcade' / 'ROMs'
    arcade_roms.mkdir(parents=True)
    (arcade_roms / 'pacman').mkdir()
    pc = root / '_pc'
    for bucket in ('_a', '_b', '_c', '_s'):
        (pc / bucket).mkdir(parents=True)
        (pc / bucket / 'Some Title').mkdir()
    (root / '_walkthroughs' / 'A Guide').mkdir(parents=True)

    candidates = propose_leaf_libraries(str(root))
    paths = _paths(candidates)

    nes_c = _by_suffix(candidates, 'Ninentdo Entertainment System')
    assert nes_c is not None
    assert nes_c['platform'] == 'NES'

    snes_c = _by_suffix(candidates, 'Super Ninentdo Entertainment System', 'ROMs')
    assert snes_c is not None
    assert snes_c['platform'] == 'SNES'

    pce_c = _by_suffix(candidates, 'PC Engine')
    assert pce_c is not None
    assert pce_c['platform'] == 'PCE'
    assert pce_c['scan_mode'] == 'files'

    mame_c = _by_suffix(candidates, 'MAME')
    assert mame_c is not None
    assert mame_c['platform'] == 'ARCADE'
    assert mame_c['scan_mode'] == 'files'
    assert all('mame0274' not in c['path'].casefold() for c in candidates)

    arcade_c = _by_suffix(candidates, 'Arcade', 'ROMs')
    assert arcade_c is not None
    assert arcade_c['platform'] == 'ARCADE'

    pc_c = _by_suffix(candidates, '_pc')
    assert pc_c is not None
    assert pc_c['platform'] == 'PCWIN'
    assert pc_c['scan_mode'] == 'folders'
    assert pc_c['scan_depth'] == 2

    assert os.path.normcase(str(root / '_walkthroughs')) not in paths
    assert all('zinc' not in c['path'].casefold() for c in candidates)
    assert all('xenia' not in c['path'].casefold() for c in candidates)
    assert os.path.normcase(str(console)) not in paths
    assert os.path.normcase(str(console / 'NINTENDO')) not in paths
    assert os.path.normcase(str(console / 'Arcade')) not in paths


def test_mame_zip_dump_is_arcade_files(tmp_path):
    leaf = tmp_path / 'MAME'
    leaf.mkdir()
    (leaf / '1942.zip').write_bytes(b'x')
    (leaf / 'mslug.zip').write_bytes(b'x')
    (leaf / 'pacman.zip').write_bytes(b'x')

    candidates = propose_leaf_libraries(str(leaf))
    assert len(candidates) == 1
    assert candidates[0]['platform'] == 'ARCADE'
    assert candidates[0]['scan_mode'] == 'files'


def test_platform_leaf_does_not_propose_title_folders(tmp_path):
    """Game titles that contain a platform word are not extra libraries."""
    root = tmp_path / '_console-gaming'
    pin = root / 'Future Pinball'
    pin.mkdir(parents=True)
    (pin / 'Scooby Doo (Roney Pinball) (3.0b)').mkdir()
    (pin / 'War of the Worlds (Roney Pinball) (1.0)').mkdir()
    nes = root / 'NINTENDO' / 'Ninentdo Entertainment System'
    nes.mkdir(parents=True)
    (nes / 'Mario').mkdir()
    (nes / 'Pinball Quest').mkdir()
    (nes / 'Quattro Arcade').mkdir()
    nsw = root / 'NINTENDO' / 'Nintendo Switch'
    nsw.mkdir(parents=True)
    (nsw / 'Cadence of Hyrule').mkdir()
    (nsw / 'Stars In The Trash Switch NSP BASE GAME').mkdir()

    candidates = propose_leaf_libraries(str(root))
    paths = _paths(candidates)

    assert _by_suffix(candidates, 'Future Pinball') is not None
    assert all('scooby' not in c['path'].casefold() for c in candidates)
    assert _by_suffix(candidates, 'Ninentdo Entertainment System') is not None
    assert os.path.normcase(str(nes / 'Pinball Quest')) not in paths
    assert os.path.normcase(str(nes / 'Quattro Arcade')) not in paths
    assert _by_suffix(candidates, 'Nintendo Switch') is not None
    assert all('stars in the trash' not in c['path'].casefold() for c in candidates)
