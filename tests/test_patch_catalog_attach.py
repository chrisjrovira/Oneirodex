"""Attach patch guide metadata to games."""

from uuid import uuid4

import pytest
from sqlalchemy import select

from oneirodex.models import Game, GameExtra, GameURL, Library
from oneirodex.platform import LibraryPlatform
from oneirodex.utils.patch_catalog.attach import GUIDE_URL_TYPE, attach_patch_guide


@pytest.fixture
def attach_game(db_session):
    library = Library(
        name=f'Patch Lib {uuid4().hex[:6]}',
        platform=LibraryPlatform.SNES,
        display_order=1,
    )
    db_session.add(library)
    db_session.flush()
    game = Game(
        uuid=str(uuid4()),
        name='Attach Target',
        library_uuid=library.uuid,
        full_disk_path=f'/test/attach/{uuid4().hex}',
    )
    db_session.add(game)
    db_session.flush()
    db_session.add(
        GameExtra(
            game_uuid=game.uuid,
            file_path=f'/test/attach/{uuid4().hex}/en.bps',
            extra_kind='translation_patch',
            patch_format='bps',
        )
    )
    db_session.commit()
    return game


def test_attach_patch_guide_creates_url_and_annotates_extra(db_session, attach_game):
    result = attach_patch_guide(
        attach_game,
        source_url='https://example.test/guide',
        notes='Operator note',
        target_language='en',
        patch_format='bps',
    )
    assert result['ok'] is True
    assert result['extras_annotated'] == 1

    urls = db_session.execute(
        select(GameURL).filter_by(game_uuid=attach_game.uuid, url_type=GUIDE_URL_TYPE)
    ).scalars().all()
    assert len(urls) == 1
    assert urls[0].url == 'https://example.test/guide'

    extra = db_session.execute(
        select(GameExtra).filter_by(game_uuid=attach_game.uuid)
    ).scalars().first()
    assert extra.source_url == 'https://example.test/guide'
    assert extra.target_language == 'en'


def test_attach_rejects_non_http(db_session, attach_game):
    with pytest.raises(ValueError, match='http'):
        attach_patch_guide(attach_game, source_url='ftp://bad.example/x')
