"""H1d (pass-8 finding): agreement from N sources before an auto-import.

``IDENTIFY_AGREEMENT_MIN`` defaults to 1 -- today's behaviour, a
high-confidence IGDB match imports on its own. At 2, a title only IGDB named
goes to review with ``insufficient_agreement``; one agreeing catalogue row
(or a DAT / hash signal the caller already has) satisfies it.
"""
from __future__ import annotations

from unittest.mock import patch
from uuid import uuid4

import pytest

from oneirodex.models import Library, UnmatchedFolder
from oneirodex.platform import LibraryPlatform
from oneirodex.utils.match_proposal import (
    MATCH_REASON_INSUFFICIENT_AGREEMENT,
    format_why_unmatched,
)
from oneirodex.utils.software_identify import (
    agreement_count,
    agreement_satisfied,
    identify_agreement_min,
)

AGREE_ROW = {'source': 'mobygames', 'name': 'Test Game', 'match_mode': 'moby_exact'}


def test_minimum_defaults_to_one_and_never_below(monkeypatch):
    monkeypatch.delenv('IDENTIFY_AGREEMENT_MIN', raising=False)
    assert identify_agreement_min() == 1
    monkeypatch.setenv('IDENTIFY_AGREEMENT_MIN', '0')
    assert identify_agreement_min() == 1
    monkeypatch.setenv('IDENTIFY_AGREEMENT_MIN', 'lots')
    assert identify_agreement_min() == 1
    monkeypatch.setenv('IDENTIFY_AGREEMENT_MIN', '2')
    assert identify_agreement_min() == 2


def test_agreement_counts_igdb_plus_catalogue_plus_extra():
    assert agreement_count(None) == 1
    assert agreement_count({'agreed': []}) == 1
    assert agreement_count({'agreed': [AGREE_ROW]}) == 2
    assert agreement_count({'agreed': [AGREE_ROW, 'junk']}) == 2
    assert agreement_count({'agreed': []}, extra_signals=1) == 2


def test_agreement_satisfied_follows_the_minimum(monkeypatch):
    monkeypatch.setenv('IDENTIFY_AGREEMENT_MIN', '2')
    assert agreement_satisfied({'verdict': 'no_signal', 'agreed': []}) is False
    assert agreement_satisfied({'verdict': 'agree', 'agreed': [AGREE_ROW]}) is True
    assert agreement_satisfied({'agreed': []}, extra_signals=1) is True
    assert agreement_satisfied({'agreed': []}, minimum=1) is True


def test_reason_has_a_plain_language_line():
    line = format_why_unmatched(status='Unmatched', match_reason=MATCH_REASON_INSUFFICIENT_AGREEMENT)
    assert 'second source' in line.lower() or 'igdb' in line.lower()


@pytest.fixture
def sample_library(db_session):
    lib = Library(name=f'H1d_Lib_{uuid4().hex[:8]}', platform=LibraryPlatform.PCWIN)
    db_session.add(lib)
    db_session.flush()
    return lib


def _settings():
    return {
        'use_local_metadata': False,
        'write_local_metadata': False,
        'use_local_images': False,
        'local_metadata_filename': 'oneirodex.json',
        'propose_only_scan': False,
    }


@patch('oneirodex.utils.services.scan_identify.select_best_match')
@patch('oneirodex.utils.services.scan_identify.corroborate_igdb_with_catalogs')
@patch('oneirodex.utils.services.scan_identify.notify_admins_new_game')
@patch('oneirodex.utils.services.scan_identify.smart_process_images_for_game')
@patch('oneirodex.utils.services.scan_identify.get_folder_size_in_bytes_updates', return_value=0)
@patch('oneirodex.utils.services.scan_identify.read_first_nfo_content', return_value=None)
@patch('oneirodex.utils.clients.igdb.make_igdb_api_request')
@patch('oneirodex.utils.services.scan_identify.create_game_instance')
def test_igdb_alone_goes_to_review_when_two_sources_are_required(
    mock_create, mock_api, mock_nfo, mock_size, mock_images, mock_notify, mock_corroborate, mock_best,
    app, db_session, sample_library, tmp_path, monkeypatch,
):
    from oneirodex.utils.game_core import retrieve_and_save_game

    monkeypatch.setenv('IDENTIFY_AGREEMENT_MIN', '2')
    folder = tmp_path / 'Lonely Game'
    folder.mkdir()
    selected = {'id': 5151, 'name': 'Lonely Game'}
    mock_api.return_value = [selected]
    mock_best.return_value = (selected, 'high')
    mock_corroborate.return_value = {'verdict': 'no_signal', 'agreed': [], 'disagreed': [], 'skipped': []}
    db_session.commit()

    with app.app_context():
        result = retrieve_and_save_game('Lonely Game', str(folder), library_uuid=sample_library.uuid, settings=_settings())

    assert result is None
    mock_create.assert_not_called()
    row = db_session.query(UnmatchedFolder).filter_by(folder_path=str(folder)).one_or_none()
    assert row is not None
    assert row.match_reason == MATCH_REASON_INSUFFICIENT_AGREEMENT
    body = (folder / 'oneirodex.proposal.json').read_text(encoding='utf-8')
    assert 'insufficient_agreement' in body and 'review' in body and '"sources_agreeing": 1' in body


@patch('oneirodex.utils.services.scan_identify.select_best_match')
@patch('oneirodex.utils.services.scan_identify.corroborate_igdb_with_catalogs')
@patch('oneirodex.utils.clients.igdb.make_igdb_api_request')
@patch('oneirodex.utils.services.scan_identify.create_game_instance')
def test_default_minimum_keeps_igdb_alone_importing(
    mock_create, mock_api, mock_corroborate, mock_best, app, db_session, sample_library, tmp_path, monkeypatch,
):
    """Default 1: the gate is a no-op, so the walk reaches create_game_instance."""
    from oneirodex.utils.game_core import retrieve_and_save_game

    monkeypatch.delenv('IDENTIFY_AGREEMENT_MIN', raising=False)
    folder = tmp_path / 'Solo Game'
    folder.mkdir()
    selected = {'id': 6161, 'name': 'Solo Game'}
    mock_api.return_value = [selected]
    mock_best.return_value = (selected, 'high')
    mock_corroborate.return_value = {'verdict': 'no_signal', 'agreed': [], 'disagreed': [], 'skipped': []}
    mock_create.side_effect = RuntimeError('reached create_game_instance')
    db_session.commit()

    with app.app_context():
        try:
            retrieve_and_save_game('Solo Game', str(folder), library_uuid=sample_library.uuid, settings=_settings())
        except RuntimeError as exc:
            assert 'reached create_game_instance' in str(exc)
    assert mock_create.called
    row = db_session.query(UnmatchedFolder).filter_by(folder_path=str(folder), match_reason=MATCH_REASON_INSUFFICIENT_AGREEMENT).one_or_none()
    assert row is None
