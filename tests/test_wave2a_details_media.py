"""Wave 2a — trailers empty contract + details media fields."""

from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import MagicMock, patch
from uuid import uuid4

import pytest
from flask_login import login_user

from gametheca.models import User
from gametheca.utils.game_details_payload import (
    _parse_video_urls,
    build_game_details_payload,
)


@pytest.fixture
def member(db_session):
    uid = str(uuid4())
    row = User(
        name=f'trail_{uid[:8]}',
        email=f'trail_{uid[:8]}@example.com',
        role='user',
        user_id=uid,
        state=True,
    )
    row.set_password('password123')
    db_session.add(row)
    db_session.commit()
    return row


@pytest.fixture
def admin(db_session):
    uid = str(uuid4())
    row = User(
        name=f'tradmin_{uid[:8]}',
        email=f'tradmin_{uid[:8]}@example.com',
        role='admin',
        user_id=uid,
        state=True,
    )
    row.set_password('password123')
    db_session.add(row)
    db_session.commit()
    return row


def _login(client, app, account):
    with client.session_transaction() as sess:
        sess['_user_id'] = str(account.get_id())
        sess['_fresh'] = True
    with app.test_request_context():
        login_user(account)


def test_parse_video_urls_csv_and_list():
    assert _parse_video_urls(None) == []
    assert _parse_video_urls('') == []
    assert _parse_video_urls('https://youtu.be/abc, https://youtu.be/def') == [
        'https://youtu.be/abc',
        'https://youtu.be/def',
    ]
    assert _parse_video_urls(['https://youtu.be/abc', '']) == ['https://youtu.be/abc']


def test_trailers_random_empty_returns_200_structured(client, app, member):
    """QA #6 — empty library returns 200 with has_videos/empty/code/cta."""
    _login(client, app, member)
    response = client.get('/api/trailers/random')
    assert response.status_code == 200
    data = response.get_json()
    assert data['has_videos'] is False
    assert data['empty'] is True
    assert data['code'] == 'no_trailers'
    assert isinstance(data.get('cta'), dict)
    assert data['cta'].get('href')
    assert data['cta'].get('label')


def test_build_game_details_payload_exposes_trailers_from_csv():
    game = SimpleNamespace(
        id=1,
        uuid='11111111-1111-4111-8111-111111111111',
        igdb_id=None,
        name='Demo',
        summary='Summary',
        storyline=None,
        aggregated_rating=None,
        aggregated_rating_count=None,
        rating=80,
        rating_count=10,
        total_rating=None,
        total_rating_count=None,
        first_release_date=None,
        date_identified=None,
        last_updated=None,
        slug='demo',
        status=None,
        category=None,
        url_igdb=None,
        url=None,
        video_urls='https://www.youtube.com/watch?v=dQw4w9WgXcQ,https://youtu.be/abc123XYZ01',
        genres=[],
        game_modes=[],
        themes=[],
        platforms=[],
        player_perspectives=[],
        developer=None,
        publisher=None,
        size=1024,
        times_downloaded=0,
        steam_app_id=None,
        steam_url=None,
        hltb_id=None,
        hltb_main_story=None,
        hltb_main_extra=None,
        hltb_completionist=None,
        hltb_all_styles=None,
        freshness_status=None,
        freshness_confidence=None,
        library_uuid='lib-1',
        library=None,
        nfo_content=None,
        urls=[],
        favorited_by=[],
        cover=None,
        images=MagicMock(),
        updates=[],
        extras=[],
        full_disk_path='/storage/games/Demo',
        rom_languages=None,
        rom_region=None,
        has_english=None,
        local_version=None,
        remote_version_summary=None,
    )
    game.images.all.return_value = []
    user = SimpleNamespace(id=7, role='user', preferences=None)

    with patch('gametheca.utils.game_details_payload.db') as mock_db, patch(
        'gametheca.utils.game_details_payload.load_lifecycle_map',
        return_value={},
    ), patch(
        'gametheca.utils.game_details_payload.resolve_game_cover_url',
        return_value='/static/newstyle/default_cover.jpg',
    ), patch(
        'gametheca.utils.game_details_payload.browse_play_fields',
        return_value={'play_url': None, 'can_play_in_browser': False},
    ), patch(
        'gametheca.utils.game_details_payload.game_card_flags',
        return_value={},
    ), patch(
        'gametheca.utils.game_details_payload.web_lifecycle_fields',
        return_value={
            'lifecycle_state': 'not_downloaded',
            'client_connected': False,
            'has_updates': False,
            'updates_count': 0,
        },
    ):
        mock_db.session.execute.return_value.scalars.return_value.all.return_value = []
        mock_db.session.execute.return_value.scalars.return_value.first.return_value = None
        mock_db.session.execute.return_value.first.return_value = None
        payload = build_game_details_payload(game, user)

    assert payload['has_trailers'] is True
    assert len(payload['video_urls']) == 2
    assert len(payload['trailers']) == 2
    assert payload['trailers'][0]['embed_url'].startswith('https://www.youtube.com/embed/')
    assert 'full_disk_path' not in payload
    assert payload['screenshot_count'] == 0
    assert payload['extras'] == []


def test_build_game_details_payload_admin_gets_paths():
    game = SimpleNamespace(
        id=1,
        uuid='11111111-1111-4111-8111-111111111111',
        igdb_id=None,
        name='Demo',
        summary=None,
        storyline=None,
        aggregated_rating=None,
        aggregated_rating_count=None,
        rating=None,
        rating_count=None,
        total_rating=None,
        total_rating_count=None,
        first_release_date=None,
        date_identified=None,
        last_updated=None,
        slug='demo',
        status=None,
        category=None,
        url_igdb=None,
        url=None,
        video_urls=None,
        genres=[],
        game_modes=[],
        themes=[],
        platforms=[],
        player_perspectives=[],
        developer=None,
        publisher=None,
        size=0,
        times_downloaded=0,
        steam_app_id=None,
        steam_url=None,
        hltb_id=None,
        hltb_main_story=None,
        hltb_main_extra=None,
        hltb_completionist=None,
        hltb_all_styles=None,
        freshness_status=None,
        freshness_confidence=None,
        library_uuid='lib-1',
        library=None,
        nfo_content=None,
        urls=[],
        favorited_by=[],
        cover=None,
        images=MagicMock(),
        updates=[],
        extras=[],
        full_disk_path='/storage/games/Demo',
        rom_languages=None,
        rom_region=None,
        has_english=None,
        local_version=None,
        remote_version_summary=None,
    )
    game.images.all.return_value = []
    admin = SimpleNamespace(id=1, role='admin', preferences=None)

    with patch('gametheca.utils.game_details_payload.db') as mock_db, patch(
        'gametheca.utils.game_details_payload.load_lifecycle_map',
        return_value={},
    ), patch(
        'gametheca.utils.game_details_payload.resolve_game_cover_url',
        return_value='/static/newstyle/default_cover.jpg',
    ), patch(
        'gametheca.utils.game_details_payload.browse_play_fields',
        return_value={},
    ), patch(
        'gametheca.utils.game_details_payload.game_card_flags',
        return_value={},
    ), patch(
        'gametheca.utils.game_details_payload.web_lifecycle_fields',
        return_value={},
    ):
        mock_db.session.execute.return_value.scalars.return_value.all.return_value = []
        mock_db.session.execute.return_value.scalars.return_value.first.return_value = None
        mock_db.session.execute.return_value.first.return_value = None
        payload = build_game_details_payload(game, admin)

    assert payload['full_disk_path'] == '/storage/games/Demo'
    assert payload['server_path'] == '/storage/games/Demo'
    assert payload['youtube_demo_url'] is None
