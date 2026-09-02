"""Skip-dir patterns for emu/FE/tool folders (console-gaming defense-in-depth)."""

import os

import pytest

from oneirodex.utils.functions import (
    DEFAULT_SKIP_DIR_GLOBS,
    DEFAULT_SKIP_DIR_REGEXES,
    load_skip_dir_patterns,
    load_skip_dir_regex_patterns,
)
from oneirodex.utils.gamenames import (
    _list_game_dirs,
    get_game_names_from_folder,
    should_skip_scan_dir,
)


@pytest.mark.parametrize(
    "name,expected",
    [
        ("_Emulators", True),
        ("Emulators", True),
        ("duckstation-qt-x64-Release-v0.1", True),
        ("YUZU", True),
        ("yuzu-windows", True),
        ("ryujinx-1.1", True),
        ("xenia_master", True),
        ("Zinc", True),
        ("mame0274b_64bit", True),
        ("MAME", False),
        ("bsnes_v115", True),
        ("mGBA-0.10", True),
        ("snes9x-1.62", True),
        ("virtualjaguar-2.1", True),
        ("pcsx2-v1.7", True),
        ("Dolphin-x64", True),
        ("citra-nightly", True),
        ("flycast-win", True),
        ("vita3k", True),
        ("RetroArch", True),
        ("cru-1.4.1", True),
        ("pegasus-fe_win", True),
        ("pegasus", True),
        ("GOD v1.0", True),
        # Emulator scaffolding dirs (W20-7 garbage class)
        ("Config", True),
        ("Lang", True),
        ("Plugin", True),
        ("ROMs", True),
        ("docs", True),
        # Scan-root / lane leaks
        ("_console-gaming", True),
        ("_pc", True),
        # Walkthrough trees
        ("walkthroughs", True),
        ("_walkthroughs", True),
        ("Game Walkthroughs Pack", True),
        # Mod / VR-mod pack markers (generic)
        ("Some Title MOD", True),
        ("Some Title - MOD Pack", True),
        ("Some Title-MOD", True),
        ("Some Game VR Mod v0 4", True),
        # Must NOT skip real game titles (substring / GOD* false positives)
        ("God of War", False),
        ("God Hand", False),
        ("Gods Will Be Watching", False),
        ("Ecco the Dolphin", False),
        ("Battle for Pegasus", False),
        ("Super Mario Bros", False),
        ("Ninentdo Entertainment System", False),
        ("Modern Warfare", False),
        ("_a", False),
    ],
)
def test_should_skip_scan_dir_default_globs(name, expected):
    assert should_skip_scan_dir(name, DEFAULT_SKIP_DIR_GLOBS) is expected


@pytest.mark.parametrize(
    "name,expected",
    [
        ("Abyssus [Repack]", True),
        ("Library Game [Scene Repack]", True),
        ("Title [HV Repack]", True),
        ("Plain Game", False),
        ("Bracket [Not A Tag]", False),
    ],
)
def test_should_skip_scan_dir_default_repack_regexes(name, expected):
    assert should_skip_scan_dir(
        name,
        DEFAULT_SKIP_DIR_GLOBS,
        DEFAULT_SKIP_DIR_REGEXES,
    ) is expected


def test_list_game_dirs_skips_emu_and_tools(tmp_path):
    (tmp_path / "Mega Man").mkdir()
    (tmp_path / "_Emulators").mkdir()
    (tmp_path / "duckstation-qt-x64").mkdir()
    (tmp_path / "pegasus-fe_nightly").mkdir()
    (tmp_path / "cru-1.4.1").mkdir()
    (tmp_path / "readme.txt").write_text("x")

    listed = _list_game_dirs(
        str(tmp_path),
        scan_depth=1,
        skip_dir_patterns=DEFAULT_SKIP_DIR_GLOBS,
        skip_dir_regexes=DEFAULT_SKIP_DIR_REGEXES,
    )
    names = [n for n, _ in listed]
    assert names == ["Mega Man"]


def test_list_game_dirs_skips_inside_letter_buckets(tmp_path):
    bucket = tmp_path / "_b"
    bucket.mkdir()
    (bucket / "Baldurs Gate").mkdir()
    (bucket / "bsnes_nightly").mkdir()

    listed = _list_game_dirs(
        str(tmp_path),
        scan_depth=2,
        skip_dir_patterns=DEFAULT_SKIP_DIR_GLOBS,
        skip_dir_regexes=DEFAULT_SKIP_DIR_REGEXES,
    )
    names = [n for n, _ in listed]
    assert names == ["Baldurs Gate"]


def test_list_game_dirs_skips_emu_scaffolding_and_repack_tags(tmp_path):
    (tmp_path / "Real Game").mkdir()
    (tmp_path / "Config").mkdir()
    (tmp_path / "ROMs").mkdir()
    (tmp_path / "Sample Title [Scene Repack]").mkdir()

    listed = _list_game_dirs(
        str(tmp_path),
        scan_depth=1,
        skip_dir_patterns=DEFAULT_SKIP_DIR_GLOBS,
        skip_dir_regexes=DEFAULT_SKIP_DIR_REGEXES,
    )
    names = [n for n, _ in listed]
    assert names == ["Real Game"]


def test_get_game_names_from_folder_honors_skip_patterns(tmp_path):
    (tmp_path / "Zelda").mkdir()
    (tmp_path / "ryujinx-canary").mkdir()

    rows = get_game_names_from_folder(
        str(tmp_path),
        [],
        [],
        scan_depth=1,
        skip_dir_patterns=DEFAULT_SKIP_DIR_GLOBS,
        skip_dir_regexes=DEFAULT_SKIP_DIR_REGEXES,
    )
    assert [r["name"] for r in rows] == ["Zelda"]
    assert all(os.path.isdir(r["full_path"]) for r in rows)


def test_load_skip_dir_patterns_includes_dir_prefix(db_session):
    from oneirodex.models import ReleaseGroup
    from oneirodex import db

    db.session.add(ReleaseGroup(filter_pattern="dir:_MyTools", case_sensitive="no"))
    db.session.add(ReleaseGroup(filter_pattern="GOG", case_sensitive="no"))
    db.session.commit()

    patterns = load_skip_dir_patterns()
    assert "_Emulators" in patterns
    assert "_MyTools" in patterns
    assert "GOG" not in patterns
    assert should_skip_scan_dir("_MyTools", patterns)


def test_load_skip_dir_regex_patterns_includes_re_prefix(db_session):
    from oneirodex.models import ReleaseGroup
    from oneirodex import db

    db.session.add(
        ReleaseGroup(filter_pattern=r"re:\[Demo\s+Build\]", case_sensitive="no")
    )
    db.session.commit()

    regexes = load_skip_dir_regex_patterns()
    assert len(regexes) >= len(DEFAULT_SKIP_DIR_REGEXES) + 1
    assert should_skip_scan_dir(
        "Title [Demo Build]",
        DEFAULT_SKIP_DIR_GLOBS,
        regexes,
    )


def test_dir_prefix_not_in_name_clean_patterns(db_session):
    from oneirodex.models import ReleaseGroup
    from oneirodex import db
    from oneirodex.utils.functions import load_scanning_filter_patterns

    db.session.add(ReleaseGroup(filter_pattern="dir:_SkipMe", case_sensitive="no"))
    db.session.add(
        ReleaseGroup(filter_pattern=r"re:\[Demo\s+Build\]", case_sensitive="no")
    )
    db.session.add(ReleaseGroup(filter_pattern="Open Source", case_sensitive="no"))
    db.session.commit()

    insensitive, _sensitive = load_scanning_filter_patterns()
    assert "-Open Source" in insensitive
    assert "-dir:_SkipMe" not in insensitive
    assert "-_SkipMe" not in insensitive
    assert "-re:" not in "".join(insensitive)
