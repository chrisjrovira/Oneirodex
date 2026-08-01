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


def test_infer_platform_switch_and_psx():
    assert infer_platform_from_name('Switch') == 'SWITCH'
    assert infer_platform_from_name('Nintendo Switch') == 'SWITCH'
    assert infer_platform_from_name('PlayStation') == 'PSX'
    assert infer_platform_from_name('Ninentdo Entertainment System') == 'NES'


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
