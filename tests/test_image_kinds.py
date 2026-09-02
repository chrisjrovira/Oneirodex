"""BE-DET-10 — image kind taxonomy persist + queue/game filter."""

from __future__ import annotations

from unittest.mock import MagicMock, patch
from uuid import uuid4

import pytest
from flask import json
from sqlalchemy import text

from oneirodex.models import Game, Image, Library, LibraryPlatform, User
from oneirodex.utils.image_kinds import (
    IMAGE_KIND_ORDER,
    IMAGE_KINDS,
    normalize_image_kind,
    parse_image_kind,
)


@pytest.fixture(scope='function', autouse=True)
def clean_database(db_session):
    db_session.execute(text('TRUNCATE TABLE images RESTART IDENTITY CASCADE'))
    db_session.execute(text('TRUNCATE TABLE games RESTART IDENTITY CASCADE'))
    db_session.execute(text('TRUNCATE TABLE libraries RESTART IDENTITY CASCADE'))
    db_session.commit()


@pytest.fixture
def admin_user(db_session):
    user_uuid = str(uuid4())
    user = User(
        name=f'admin_{user_uuid[:8]}',
        email=f'admin_{user_uuid[:8]}@example.com',
        password_hash='hashed_password',
        role='admin',
        user_id=user_uuid,
        avatarpath='newstyle/avatar_default.jpg',
        invite_quota=10,
    )
    user.set_password('adminpassword123')
    db_session.add(user)
    db_session.commit()
    return user


@pytest.fixture
def sample_library(db_session):
    library = Library(name='Kind Lib', platform=LibraryPlatform.PCWIN, display_order=1)
    db_session.add(library)
    db_session.flush()
    return library


@pytest.fixture
def sample_game(db_session, sample_library):
    game = Game(library_uuid=sample_library.uuid, name='Kind Game', igdb_id=424242)
    db_session.add(game)
    db_session.flush()
    return game


class TestImageKindHelpers:
    def test_locked_kinds_include_cover_screenshot_and_new(self):
        assert 'cover' in IMAGE_KINDS
        assert 'screenshot' in IMAGE_KINDS
        for kind in ('box', 'cart', 'disc', 'logo', 'hero', 'fanart'):
            assert kind in IMAGE_KINDS
        assert IMAGE_KIND_ORDER[:2] == ('cover', 'screenshot')

    def test_aliases_coerce_safely(self):
        assert normalize_image_kind('cart_label') == 'cart'
        assert normalize_image_kind('disc_label') == 'disc'
        assert normalize_image_kind('fan_art') == 'fanart'
        assert normalize_image_kind('grid') == 'cover'
        assert normalize_image_kind('ClearLogo') == 'logo'

    def test_parse_rejects_unknown(self):
        with pytest.raises(ValueError, match='image_type must be one of'):
            parse_image_kind('banner')

    def test_parse_allow_all(self):
        assert parse_image_kind('all', allow_all=True) == 'all'
        assert parse_image_kind(None, allow_all=True) == 'all'
        assert parse_image_kind('box', allow_all=True) == 'box'


class TestImageQueueKindFilter:
    def test_filter_by_box_kind(self, client, admin_user, db_session, sample_game):
        db_session.add_all([
            Image(
                game_uuid=sample_game.uuid,
                image_type='cover',
                url='cover.jpg',
                is_downloaded=False,
            ),
            Image(
                game_uuid=sample_game.uuid,
                image_type='box',
                url='box.jpg',
                is_downloaded=False,
            ),
            Image(
                game_uuid=sample_game.uuid,
                image_type='fanart',
                url='fan.jpg',
                is_downloaded=True,
            ),
        ])
        db_session.flush()

        with client.session_transaction() as sess:
            sess['_user_id'] = str(admin_user.id)
            sess['_fresh'] = True

        response = client.get('/admin/api/image_queue_list?kind=box')
        assert response.status_code == 200
        data = json.loads(response.data)
        assert data['kind_filter'] == 'box'
        assert data['allowed_kinds'] == list(IMAGE_KIND_ORDER)
        assert data['pagination']['total'] == 1
        assert data['images'][0]['kind'] == 'box'
        assert data['images'][0]['image_type'] == 'box'

    def test_unknown_kind_filter_rejected(self, client, admin_user):
        with client.session_transaction() as sess:
            sess['_user_id'] = str(admin_user.id)
            sess['_fresh'] = True

        response = client.get('/admin/api/image_queue_list?type=banner')
        assert response.status_code == 400
        data = json.loads(response.data)
        assert 'image_type must be one of' in data['error']


class TestGameImagesKindFilter:
    def test_list_and_filter(self, client, admin_user, db_session, sample_game):
        db_session.add_all([
            Image(game_uuid=sample_game.uuid, image_type='cover', url='c.jpg', is_downloaded=True),
            Image(game_uuid=sample_game.uuid, image_type='logo', url='l.jpg', is_downloaded=True),
            Image(game_uuid=sample_game.uuid, image_type='screenshot', url='s1.jpg', is_downloaded=True),
        ])
        db_session.flush()

        with client.session_transaction() as sess:
            sess['_user_id'] = str(admin_user.id)
            sess['_fresh'] = True

        all_resp = client.get(f'/api/game_images/{sample_game.uuid}')
        assert all_resp.status_code == 200
        all_data = json.loads(all_resp.data)
        assert all_data['count'] == 3
        assert 'logo' in {row['kind'] for row in all_data['images']}

        logo_resp = client.get(f'/api/game_images/{sample_game.uuid}?kind=logo')
        assert logo_resp.status_code == 200
        logo_data = json.loads(logo_resp.data)
        assert logo_data['count'] == 1
        assert logo_data['images'][0]['kind'] == 'logo'

        bad = client.get(f'/api/game_images/{sample_game.uuid}?kind=icon')
        assert bad.status_code == 400


class TestArtworkApplyKinds:
    @patch('oneirodex.utils.artwork_apply.get_provider')
    def test_persist_box_kind(self, mock_get_provider, app, db_session, sample_game, tmp_path):
        provider = MagicMock()
        provider.is_enabled.return_value = True
        provider.fetch_image.return_value = (b'\xff\xd8\xfffake', 'image/jpeg')
        mock_get_provider.return_value = provider
        game_uuid = sample_game.uuid
        db_session.commit()

        with app.test_request_context('/'):
            app.config['IMAGE_SAVE_PATH'] = str(tmp_path)
            from oneirodex.utils.artwork_apply import apply_cover_from_url
            from sqlalchemy import select as sa_select

            result = apply_cover_from_url(
                game_uuid,
                'https://example.com/box.jpg',
                provider_id='steamgriddb',
                image_type='box',
            )
            assert result['kind'] == 'box'
            assert result['image_type'] == 'box'
            row = db_session.execute(
                sa_select(Image).filter_by(game_uuid=game_uuid, image_type='box')
            ).scalars().first()
            assert row is not None
            assert row.is_downloaded is True

    @patch('oneirodex.utils.artwork_apply.get_provider')
    def test_reject_unknown_kind(self, mock_get_provider, app, sample_game, tmp_path):
        provider = MagicMock()
        provider.is_enabled.return_value = True
        mock_get_provider.return_value = provider

        with app.test_request_context('/'):
            app.config['IMAGE_SAVE_PATH'] = str(tmp_path)
            from oneirodex.utils.artwork_apply import apply_cover_from_url

            with pytest.raises(ValueError, match='image_type must be one of'):
                apply_cover_from_url(
                    sample_game.uuid,
                    'https://example.com/x.jpg',
                    image_type='banner',
                )

    @patch('oneirodex.utils.artwork_apply.get_provider')
    def test_coerce_cart_label_alias(self, mock_get_provider, app, db_session, sample_game, tmp_path):
        provider = MagicMock()
        provider.is_enabled.return_value = True
        provider.fetch_image.return_value = (b'\xff\xd8\xfffake', 'image/jpeg')
        mock_get_provider.return_value = provider
        game_uuid = sample_game.uuid
        db_session.commit()

        with app.test_request_context('/'):
            app.config['IMAGE_SAVE_PATH'] = str(tmp_path)
            from oneirodex.utils.artwork_apply import apply_cover_from_url

            result = apply_cover_from_url(
                game_uuid,
                'https://example.com/cart.png',
                image_type='cart_label',
            )
            assert result['kind'] == 'cart'
