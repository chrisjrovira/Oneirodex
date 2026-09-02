"""W21-BE-2 Stage E — propose-only Moby/TGDB after Stage D miss (mocked HTTP)."""

from __future__ import annotations

from unittest.mock import patch
from uuid import uuid4

import pytest

from oneirodex.models import Game, Library
from oneirodex.platform import LibraryPlatform
from oneirodex.utils.match_proposal import hint_fields_from_proposal
from oneirodex.utils.software_identify import (
    CUSTOM_IGDB_BASE,
    enrich_proposal_with_stage_e,
    filter_tgdb_hits_for_platform,
    resolve_stage_e_catalog_hints,
    tgdb_platform_matches,
    try_stage_d_store_identify,
)


@pytest.fixture
def sample_pc_library(db_session):
    lib = Library(
        name=f'StageE_PC_{uuid4().hex[:8]}',
        platform=LibraryPlatform.PCWIN,
    )
    db_session.add(lib)
    db_session.flush()
    return lib


def test_tgdb_gb_matches_game_boy_not_playstation():
    assert tgdb_platform_matches(['Nintendo Game Boy'], 'GB')
    assert tgdb_platform_matches(['Nintendo GameBoy'], 'GB')
    assert not tgdb_platform_matches(['Sony Playstation'], 'GB')


def test_filter_tgdb_hits_for_platform():
    hits = [
        {'name': 'Tetris', 'platforms': ['Nintendo Game Boy']},
        {'name': 'Tetris', 'platforms': ['Sega Genesis']},
    ]
    filtered = filter_tgdb_hits_for_platform(hits, 'GB')
    assert len(filtered) == 1
    assert filtered[0]['platforms'] == ['Nintendo Game Boy']


@patch('oneirodex.utils.providers.mobygames.get_mobygames_api_key', return_value=None)
@patch('oneirodex.utils.providers.thegamesdb.get_thegamesdb_api_key', return_value=None)
def test_stage_e_keys_unset_skips_silently(mock_tgdb_key, mock_moby_key):
    hints = resolve_stage_e_catalog_hints(
        cleaned_name='Doom',
        library_platform='PCWIN',
    )
    assert hints['candidates'] == []
    assert hints['suggested_candidate_name'] is None
    assert 'mobygames_key_unset' in hints['skipped']


@patch('oneirodex.utils.providers.mobygames.get_mobygames_api_key', return_value='moby-key')
@patch('oneirodex.utils.software_identify.search_mobygames_games')
def test_stage_e_moby_exact_propose_only(mock_moby, mock_key, sample_pc_library, db_session):
    mock_moby.return_value = [{
        'source': 'mobygames',
        'id': 15,
        'name': 'Doom',
        'url': 'https://www.mobygames.com/game/15/doom/',
        'cover_url': 'https://cdn.example/doom.jpg',
        'summary': 'Id Software classic',
        'mobygames_id': 15,
        'platforms': ['DOS', 'Windows'],
    }]
    with patch(
        'oneirodex.utils.providers.thegamesdb.get_thegamesdb_api_key',
        return_value=None,
    ):
        hints = resolve_stage_e_catalog_hints(
            cleaned_name='Doom',
            library_platform='PCWIN',
        )
    assert len(hints['candidates']) == 1
    assert hints['candidates'][0]['propose_only'] is True
    assert hints['candidates'][0]['match_mode'] == 'moby_exact'
    assert hints['suggested_candidate_name'] == 'Doom'
    assert hints['match_reason'] == 'stage_e_moby_exact'
    assert hints['identify_path'] == 'stage_e'
    # No Game create from Stage E
    from sqlalchemy import select

    games = db_session.execute(select(Game).filter_by(name='Doom')).scalars().all()
    assert games == []


@patch('oneirodex.utils.providers.mobygames.get_mobygames_api_key', return_value=None)
@patch('oneirodex.utils.providers.thegamesdb.get_thegamesdb_api_key', return_value='tgdb-key')
@patch('oneirodex.utils.software_identify.search_thegamesdb_games')
def test_stage_e_tgdb_exact_propose_only(mock_tgdb, mock_tgdb_key, mock_moby_key):
    mock_tgdb.return_value = [
        {
            'source': 'thegamesdb',
            'id': 42,
            'name': 'Tetris',
            'url': 'https://thegamesdb.net/game.php?id=42',
            'cover_url': 'https://cdn.example/tetris.jpg',
            'thegamesdb_id': 42,
            'platforms': ['Nintendo Game Boy'],
        },
        {
            'source': 'thegamesdb',
            'id': 99,
            'name': 'Tetris',
            'url': 'https://thegamesdb.net/game.php?id=99',
            'thegamesdb_id': 99,
            'platforms': ['Sega Genesis'],
        },
    ]
    hints = resolve_stage_e_catalog_hints(
        cleaned_name='Tetris',
        library_platform='GB',
    )
    assert len(hints['candidates']) == 1
    assert hints['candidates'][0]['thegamesdb_id'] == 42
    assert hints['candidates'][0]['propose_only'] is True
    assert hints['candidates'][0]['match_mode'] == 'tgdb_exact'
    assert hints['suggested_candidate_name'] == 'Tetris'
    assert hints['match_reason'] == 'stage_e_tgdb_exact'


@patch('oneirodex.utils.providers.mobygames.get_mobygames_api_key', return_value='moby-key')
@patch('oneirodex.utils.software_identify.search_mobygames_games')
def test_stage_e_enrich_proposal_sidecar_fields(mock_moby, mock_key):
    mock_moby.return_value = [{
        'source': 'mobygames',
        'id': 7,
        'name': 'Keeper',
        'url': 'https://www.mobygames.com/game/7/keeper/',
        'mobygames_id': 7,
    }]
    with patch(
        'oneirodex.utils.providers.thegamesdb.get_thegamesdb_api_key',
        return_value=None,
    ):
        proposal = {'proposal': {'cleaned_name': 'Keeper', 'suggested_kind': 'game'}}
        proposal = enrich_proposal_with_stage_e(
            proposal,
            cleaned_name='Keeper',
            library_platform='PCWIN',
        )
    body = proposal['proposal']
    assert body['stage_e']['propose_only'] is True
    assert body['stage_e']['match_reason'] == 'stage_e_moby_exact'
    assert len(body['stage_e_candidates']) == 1
    assert body['suggested_candidate_name'] == 'Keeper'
    assert body['identify_path'] == 'stage_e'
    hint = hint_fields_from_proposal(proposal)
    assert hint['suggested_candidate_name'] == 'Keeper'


@patch('oneirodex.utils.providers.mobygames.get_mobygames_api_key', return_value='moby-key')
@patch('oneirodex.utils.software_identify.search_mobygames_games')
def test_stage_e_never_creates_game(mock_moby, mock_key, sample_pc_library, db_session):
    mock_moby.return_value = [{
        'source': 'mobygames',
        'id': 1,
        'name': 'Unique Stage E Title',
        'mobygames_id': 1,
    }]
    from sqlalchemy import func, select

    before = db_session.execute(select(func.count()).select_from(Game)).scalar()
    with patch(
        'oneirodex.utils.providers.thegamesdb.get_thegamesdb_api_key',
        return_value=None,
    ):
        hints = resolve_stage_e_catalog_hints(
            cleaned_name='Unique Stage E Title',
            library_platform='PCWIN',
        )
        enrich_proposal_with_stage_e(
            {'proposal': {}},
            cleaned_name='Unique Stage E Title',
            library_platform='PCWIN',
        )
    assert hints['suggested_candidate_name'] == 'Unique Stage E Title'
    after = db_session.execute(select(func.count()).select_from(Game)).scalar()
    assert after == before


@patch('oneirodex.utils.steam_lookup.fetch_steam_app_details')
@patch('oneirodex.utils.software_identify.search_steam_games')
@patch('oneirodex.utils.software_identify.search_gog_games', return_value=[])
@patch('oneirodex.utils.software_identify.search_mobygames_games')
@patch('oneirodex.utils.providers.mobygames.get_mobygames_api_key', return_value='moby-key')
def test_stage_d_still_preferred_when_it_hits(
    mock_moby_key,
    mock_moby,
    mock_gog,
    mock_steam,
    mock_details,
    sample_pc_library,
    db_session,
    tmp_path,
):
    """Stage D App-ID / exact Steam path creates Game; Stage E must not run first."""
    mock_details.return_value = {
        'steam_app_id': 570,
        'name': 'Dota 2',
        'steam_type': 'game',
        'header_image': None,
        'short_description': 'MOBA',
    }
    folder = tmp_path / 'Dota 2'
    folder.mkdir()
    game = try_stage_d_store_identify(
        raw_label='Dota 2',
        cleaned_name='Dota 2',
        full_disk_path=str(folder),
        library_uuid=sample_pc_library.uuid,
        steam_app_id=570,
    )
    assert game is not None
    assert game.igdb_id >= CUSTOM_IGDB_BASE
    assert game.steam_app_id == 570
    mock_moby.assert_not_called()


@patch('oneirodex.utils.providers.mobygames.get_mobygames_api_key', return_value='moby-key')
@patch('oneirodex.utils.software_identify.search_mobygames_games')
def test_stage_e_fuzzy_multi_hit_not_preferred(mock_moby, mock_key):
    """Near matches without exact title → no preferred propose name."""
    mock_moby.return_value = [
        {'source': 'mobygames', 'id': 1, 'name': 'Final Fantasy VII', 'mobygames_id': 1},
        {'source': 'mobygames', 'id': 2, 'name': 'Final Fantasy', 'mobygames_id': 2},
    ]
    with patch(
        'oneirodex.utils.providers.thegamesdb.get_thegamesdb_api_key',
        return_value=None,
    ):
        hints = resolve_stage_e_catalog_hints(
            cleaned_name='Final Fantasy VII Remake',
            library_platform='PCWIN',
        )
    assert hints['candidates'] == []
    assert hints['suggested_candidate_name'] is None
