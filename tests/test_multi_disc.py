"""BE-DET-5 — multi-disc / cue+bin grouping."""

from __future__ import annotations

from types import SimpleNamespace
from uuid import uuid4

import pytest

from gametheca.utils.multi_disc import (
    apply_disc_fields,
    attach_disc_sibling,
    disc_browse_fields,
    filter_cue_bin_companions,
    is_clear_multi_disc_sibling,
    is_cue_bin_companion,
    parse_disc_fields,
    try_attach_multi_disc_sibling,
)
from gametheca.utils.rom_name_peel import (
    capture_disc_index,
    parse_console_rom_label,
)


# --- Peel capture ---

DISC_PEEL_FIXTURES = [
    ('Final Fantasy VII (USA) (Disc 1) [!].bin', 'Final Fantasy VII', 1),
    ('Final Fantasy VII (USA) (Disc 2) [!].bin', 'Final Fantasy VII', 2),
    ('Metal Gear Solid (USA) (Disc 1) [!].cue', 'Metal Gear Solid', 1),
    ('Some Title (Japan) (Disk 3).iso', 'Some Title', 3),
    ('Racing Game (Europe) (CD1).bin', 'Racing Game', 1),
    ('Racing Game (Europe) (CD 2).bin', 'Racing Game', 2),
    ('Single Disc Game (USA) [!].bin', 'Single Disc Game', None),
]


@pytest.mark.parametrize('raw,cleaned,disc_index', DISC_PEEL_FIXTURES)
def test_parse_console_rom_label_captures_disc_index(raw, cleaned, disc_index):
    result = parse_console_rom_label(raw)
    assert result['cleaned_name'] == cleaned
    assert result['disc_index'] == disc_index
    assert '(Disc' not in result['cleaned_name']
    assert '(CD' not in result['cleaned_name']


def test_capture_disc_index_helpers():
    assert capture_disc_index('Game (Disc 2).bin') == 2
    assert capture_disc_index('Game (CD1).cue') == 1
    assert capture_disc_index('Game (USA).bin') is None


def test_psx_disc_tag_stripped_and_indexed():
    result = parse_console_rom_label('Final Fantasy VII (USA) (Disc 1) [!].bin')
    assert result['cleaned_name'] == 'Final Fantasy VII'
    assert result['disc_index'] == 1


# --- Clear sibling / non-merge ---

def test_clear_multi_disc_sibling_same_title_different_index():
    assert is_clear_multi_disc_sibling(
        new_disc_index=2,
        new_cleaned_name='Final Fantasy VII',
        existing_disc_index=1,
        existing_cleaned_name='Final Fantasy VII',
    )


def test_non_merge_different_titles():
    assert not is_clear_multi_disc_sibling(
        new_disc_index=2,
        new_cleaned_name='Final Fantasy VIII',
        existing_disc_index=1,
        existing_cleaned_name='Final Fantasy VII',
    )


def test_non_merge_missing_disc_token_ambiguous():
    assert not is_clear_multi_disc_sibling(
        new_disc_index=2,
        new_cleaned_name='Final Fantasy VII',
        existing_disc_index=None,
        existing_cleaned_name='Final Fantasy VII',
        existing_path=r'C:\roms\Final Fantasy VII (USA).bin',
    )


def test_non_merge_same_disc_index():
    assert not is_clear_multi_disc_sibling(
        new_disc_index=1,
        new_cleaned_name='Final Fantasy VII',
        existing_disc_index=1,
        existing_cleaned_name='Final Fantasy VII',
    )


def test_existing_path_fallback_disc_token():
    assert is_clear_multi_disc_sibling(
        new_disc_index=2,
        new_cleaned_name='Metal Gear Solid',
        existing_disc_index=None,
        existing_cleaned_name=None,
        existing_path=r'D:\psx\Metal Gear Solid (USA) (Disc 1) [!].cue',
    )


# --- Cue+bin companions ---

def test_is_cue_bin_companion():
    siblings = {'Game (Disc 1).cue', 'Game (Disc 1).bin', 'readme.txt'}
    assert is_cue_bin_companion('Game (Disc 1).bin', siblings)
    assert not is_cue_bin_companion('Game (Disc 1).cue', siblings)
    assert not is_cue_bin_companion('Other.bin', siblings)


def test_filter_cue_bin_companions_keeps_cue_drops_bin(tmp_path):
    entries = [
        {'name': 'Game', 'full_path': str(tmp_path / 'Game (Disc 1).cue'), 'file_type': 'cue'},
        {'name': 'Game', 'full_path': str(tmp_path / 'Game (Disc 1).bin'), 'file_type': 'bin'},
        {'name': 'Other', 'full_path': str(tmp_path / 'Other Game.iso'), 'file_type': 'iso'},
    ]
    kept = filter_cue_bin_companions(entries)
    paths = {e['full_path'] for e in kept}
    assert str(tmp_path / 'Game (Disc 1).cue') in paths
    assert str(tmp_path / 'Game (Disc 1).bin') not in paths
    assert str(tmp_path / 'Other Game.iso') in paths


def test_get_game_names_from_files_filters_cue_bin(tmp_path):
    from gametheca.utils.gamenames import get_game_names_from_files

    (tmp_path / 'Title (USA) (Disc 1).cue').write_text('FILE "Title.bin" BINARY\n', encoding='utf-8')
    (tmp_path / 'Title (USA) (Disc 1).bin').write_bytes(b'X' * 64)
    (tmp_path / 'Solo.iso').write_bytes(b'Y' * 64)

    result = get_game_names_from_files(
        str(tmp_path),
        ['cue', 'bin', 'iso'],
        [],
        [],
    )
    names = {e['file_type'] for e in result}
    assert 'cue' in names
    assert 'iso' in names
    assert 'bin' not in names


# --- Persist / attach (DB) ---

def test_apply_disc_fields_from_peel():
    game = SimpleNamespace(disc_index=None, disc_count=None)
    peel = parse_console_rom_label('Game (USA) (Disc 2).bin')
    apply_disc_fields(game, peel=peel)
    assert game.disc_index == 2
    assert game.disc_count == 1


def test_attach_disc_sibling_and_browse_fields(app, db_session):
    from gametheca.models import Game, GameExtra, Library
    from gametheca.platform import LibraryPlatform

    library = Library(
        name=f'PSX_MD_{uuid4().hex[:8]}',
        platform=LibraryPlatform.PSX,
    )
    db_session.add(library)
    db_session.flush()

    path1 = '/library/psx/Final Fantasy VII (USA) (Disc 1) [!].bin'
    path2 = '/library/psx/Final Fantasy VII (USA) (Disc 2) [!].bin'
    igdb_id = 8_000_000 + (uuid4().int % 1_000_000)

    game = Game(
        uuid=str(uuid4()),
        name='Final Fantasy VII',
        full_disk_path=path1,
        library_uuid=library.uuid,
        size=0,
        igdb_id=igdb_id,
        disc_index=1,
        disc_count=1,
        slug=f'ff7-{uuid4().hex[:8]}',
    )
    db_session.add(game)
    db_session.commit()

    peel2 = parse_disc_fields(path2)
    assert peel2['disc_index'] == 2
    assert peel2['cleaned_name'] == 'Final Fantasy VII'

    assert try_attach_multi_disc_sibling(
        existing_game=game,
        full_disk_path=path2,
        game_name=path2,
        peel=peel2,
    )

    db_session.refresh(game)
    extras = db_session.query(GameExtra).filter_by(game_uuid=game.uuid).all()
    disc_extras = [e for e in extras if e.extra_kind == 'disc']
    assert len(disc_extras) == 1
    assert disc_extras[0].disc_index == 2
    assert disc_extras[0].file_path == path2
    assert game.disc_index == 1
    assert game.disc_count >= 2

    fields = disc_browse_fields(game, extras=extras)
    assert fields['is_multi_disc'] is True
    assert fields['disc_index'] == 1
    assert len(fields['discs']) == 2


def test_attach_prefers_lower_disc_as_primary(app, db_session):
    from gametheca.models import Game, GameExtra, Library
    from gametheca.platform import LibraryPlatform

    library = Library(
        name=f'PSX_MD2_{uuid4().hex[:8]}',
        platform=LibraryPlatform.PSX,
    )
    db_session.add(library)
    db_session.flush()

    path2 = '/library/psx/Metal Gear Solid (USA) (Disc 2).cue'
    path1 = '/library/psx/Metal Gear Solid (USA) (Disc 1).cue'

    game = Game(
        uuid=str(uuid4()),
        name='Metal Gear Solid',
        full_disk_path=path2,
        library_uuid=library.uuid,
        size=0,
        igdb_id=8_000_000 + (uuid4().int % 1_000_000),
        disc_index=2,
        disc_count=1,
        slug=f'mgs-{uuid4().hex[:8]}',
    )
    db_session.add(game)
    db_session.commit()

    attach_disc_sibling(game, path1, disc_index=1)
    db_session.commit()
    db_session.refresh(game)

    assert game.full_disk_path == path1
    assert game.disc_index == 1
    extras = db_session.query(GameExtra).filter_by(game_uuid=game.uuid, extra_kind='disc').all()
    assert any(e.file_path == path2 and e.disc_index == 2 for e in extras)


def test_try_attach_refuses_different_title(app, db_session):
    from gametheca.models import Game, Library
    from gametheca.platform import LibraryPlatform

    library = Library(
        name=f'PSX_MD3_{uuid4().hex[:8]}',
        platform=LibraryPlatform.PSX,
    )
    db_session.add(library)
    db_session.flush()

    game = Game(
        uuid=str(uuid4()),
        name='Final Fantasy VII',
        full_disk_path='/library/psx/Final Fantasy VII (USA) (Disc 1).bin',
        library_uuid=library.uuid,
        size=0,
        igdb_id=8_000_000 + (uuid4().int % 1_000_000),
        disc_index=1,
        disc_count=1,
        slug=f'ff7b-{uuid4().hex[:8]}',
    )
    db_session.add(game)
    db_session.commit()

    ok = try_attach_multi_disc_sibling(
        existing_game=game,
        full_disk_path='/library/psx/Final Fantasy VIII (USA) (Disc 2).bin',
    )
    assert ok is False
    assert game.disc_count == 1
