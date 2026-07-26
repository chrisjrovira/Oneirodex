"""Unit tests for game details payload builder (no DB fixture)."""

from types import SimpleNamespace
from unittest.mock import MagicMock, patch

from gametheca.utils.game_details_payload import build_game_details_payload


def test_build_game_details_payload_omits_disk_paths():
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
        video_urls=[],
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
    )
    game.images.all.return_value = []
    user = SimpleNamespace(id=7, role='user')

    with patch('gametheca.utils.game_details_payload.db') as mock_db, patch(
        'gametheca.utils.game_details_payload.load_lifecycle_map',
        return_value={},
    ), patch(
        'gametheca.utils.game_details_payload.resolve_cover_url',
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

    assert payload['uuid'] == game.uuid
    assert payload['name'] == 'Demo'
    assert 'full_disk_path' not in payload
    assert payload['cover_url']
    assert payload['rating'] == 80
