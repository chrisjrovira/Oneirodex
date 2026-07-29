"""Tests for Meta/Quest + expanded identify metadata search (mocked HTTP)."""

from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest

from gametheca.utils.providers import reset_provider_cache
from gametheca.utils.providers.meta_quest import (
    META_QUEST_PLATFORM_IDS,
    MetaQuestProvider,
    get_meta_quest_api_mode,
    search_meta_quest_games,
)
from gametheca.utils.secondary_scrapers import (
    search_epic_games,
    search_giantbomb_games,
    search_itch_games,
)


@pytest.fixture(autouse=True)
def _reset_providers():
    reset_provider_cache()
    yield
    reset_provider_cache()


@patch('gametheca.utils.providers.meta_quest.make_igdb_api_request')
@patch('gametheca.utils.providers.meta_quest.igdb_credentials_configured', return_value=True)
def test_search_meta_quest_games_filters_platforms(mock_creds, mock_igdb):
    mock_igdb.return_value = [
        {
            'id': 99,
            'name': 'Beat Saber',
            'slug': 'beat-saber',
            'summary': 'VR rhythm',
            'cover': {'image_id': 'abc123'},
            'platforms': [{'name': 'Meta Quest 2'}],
            'first_release_date': 1530403200,
        }
    ]
    results = search_meta_quest_games('Beat Saber', limit=5)
    assert len(results) == 1
    assert results[0]['source'] == 'meta_quest'
    assert results[0]['name'] == 'Beat Saber'
    assert results[0]['ownership_only'] is True
    assert results[0]['is_vr'] is True
    assert results[0]['meta_quest_id'] == '99'
    assert 'download' not in (results[0].get('note') or '').lower() or 'never downloads' in results[0]['note'].lower()
    assert 'install' not in results[0]
    query = mock_igdb.call_args[0][1]
    for pid in META_QUEST_PLATFORM_IDS:
        assert str(pid) in query


@patch('gametheca.utils.providers.meta_quest.igdb_credentials_configured', return_value=False)
def test_search_meta_quest_without_igdb_returns_empty(mock_creds):
    assert search_meta_quest_games('Anything') == []


@patch.dict('os.environ', {'META_QUEST_API_MODE': 'csv_only'}, clear=False)
def test_search_meta_quest_csv_only_returns_empty():
    assert get_meta_quest_api_mode() == 'csv_only'
    assert search_meta_quest_games('Beat Saber') == []


@patch.dict('os.environ', {'META_QUEST_API_MODE': 'unofficial_graphql'}, clear=False)
def test_unofficial_graphql_off_by_default_returns_empty():
    assert get_meta_quest_api_mode() == 'unofficial_graphql'
    assert search_meta_quest_games('Beat Saber') == []


@patch('gametheca.utils.providers.meta_quest.make_igdb_api_request')
@patch('gametheca.utils.providers.meta_quest.igdb_credentials_configured', return_value=True)
def test_meta_quest_provider_search_covers(mock_creds, mock_igdb):
    mock_igdb.return_value = [
        {
            'id': 1,
            'name': 'Quest Title',
            'slug': 'quest-title',
            'cover': {'image_id': 'img1'},
            'platforms': [{'name': 'Oculus Quest'}],
        }
    ]
    provider = MetaQuestProvider()
    assert provider.is_enabled() is True
    covers = provider.search_covers('Quest Title', limit=5)
    assert len(covers) == 1
    assert covers[0].url.endswith('img1.jpg')


@patch('gametheca.utils.secondary_scrapers.request_with_backoff')
def test_search_epic_games_mocked(mock_req):
    resp = MagicMock()
    resp.content = b'{}'
    resp.json.return_value = {
        'elements': [
            {
                'id': 'offer1',
                'title': 'Fortnite',
                'urlSlug': 'fortnite',
                'keyImages': [{'type': 'Thumbnail', 'url': 'https://cdn.example/cover.jpg'}],
            }
        ]
    }
    mock_req.return_value = resp
    results = search_epic_games('Fortnite', limit=5)
    assert len(results) == 1
    assert results[0]['source'] == 'epic'
    assert results[0]['ownership_only'] is True


@patch('gametheca.utils.secondary_scrapers.request_with_backoff')
def test_search_itch_games_mocked(mock_req):
    resp = MagicMock()
    resp.content = b'{}'
    resp.json.return_value = {
        'games': [
            {
                'id': 42,
                'title': 'Celeste',
                'url': 'https://example.itch.io/celeste',
                'cover': 'https://cdn.example/celeste.png',
            }
        ]
    }
    mock_req.return_value = resp
    results = search_itch_games('Celeste', limit=5)
    assert len(results) == 1
    assert results[0]['source'] == 'itch'
    assert results[0]['id'] == 42


@patch('gametheca.utils.providers.giantbomb.get_giantbomb_api_key', return_value='gb-key')
@patch('gametheca.utils.secondary_scrapers.request_with_backoff')
def test_search_giantbomb_games_mocked(mock_req, mock_key):
    resp = MagicMock()
    resp.content = b'{}'
    resp.json.return_value = {
        'results': [
            {
                'id': 7,
                'name': 'Doom',
                'site_detail_url': 'https://www.giantbomb.com/doom/3030-7/',
                'deck': 'Classic shooter',
                'image': {'super_url': 'https://cdn.example/doom.jpg'},
            }
        ]
    }
    mock_req.return_value = resp
    results = search_giantbomb_games('Doom', limit=5)
    assert len(results) == 1
    assert results[0]['source'] == 'giantbomb'


def test_metadata_search_sources_endpoint(client, db_session, admin_user_for_meta):
    with client.session_transaction() as sess:
        sess['_user_id'] = str(admin_user_for_meta.id)
        sess['_fresh'] = True
    resp = client.get('/api/search_metadata/sources')
    assert resp.status_code == 200
    ids = {s['id'] for s in resp.get_json()['sources']}
    assert 'meta_quest' in ids
    assert 'epic' in ids
    assert 'itch' in ids
    assert 'giantbomb' in ids
    meta = next(s for s in resp.get_json()['sources'] if s['id'] == 'meta_quest')
    assert meta['ownership_only'] is True
    assert meta['api_mode'] in ('igdb', 'csv_only', 'disabled', 'unofficial_graphql')
    assert meta['unofficial_graphql'] is False
    assert 'meta' in meta.get('aliases', [])


@pytest.fixture
def admin_user_for_meta(db_session):
    from uuid import uuid4

    from gametheca.models import User

    uid = str(uuid4())
    user = User(
        user_id=uid,
        name=f'MetaAdmin_{uid[:8]}',
        email=f'metaadmin_{uid[:8]}@test.com',
        role='admin',
        is_email_verified=True,
    )
    user.set_password('testpass123')
    db_session.add(user)
    db_session.commit()
    return user


@patch('gametheca.routes_apis.metadata_search.search_meta_quest_games')
def test_search_metadata_meta_alias(mock_search, client, db_session, admin_user_for_meta):
    mock_search.return_value = [
        {'source': 'meta_quest', 'id': 1, 'name': 'Quest Game', 'ownership_only': True, 'is_vr': True}
    ]
    with client.session_transaction() as sess:
        sess['_user_id'] = str(admin_user_for_meta.id)
        sess['_fresh'] = True
    resp = client.get('/api/search_metadata?name=Quest&source=meta')
    assert resp.status_code == 200
    data = resp.get_json()
    assert data['source'] == 'meta_quest'
    assert data['ownership_only'] is True
    assert 'api_mode' in data


@patch('gametheca.routes_apis.metadata_search.search_meta_quest_games')
def test_search_metadata_meta_quest_route(mock_search, client, db_session, admin_user_for_meta):
    mock_search.return_value = [
        {'source': 'meta_quest', 'id': 1, 'name': 'Quest Game', 'ownership_only': True}
    ]
    with client.session_transaction() as sess:
        sess['_user_id'] = str(admin_user_for_meta.id)
        sess['_fresh'] = True
    resp = client.get('/api/search_metadata?name=Quest&source=meta_quest')
    assert resp.status_code == 200
    data = resp.get_json()
    assert data['source'] == 'meta_quest'
    assert data['ownership_only'] is True
    assert len(data['results']) == 1
