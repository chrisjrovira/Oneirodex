"""Tests for cover art studio (ART-1/2) — no database required for render paths."""

from __future__ import annotations

import io
import zipfile
from pathlib import Path
from unittest.mock import patch
from uuid import uuid4

import pytest
from PIL import Image

from gametheca.models import Game, Image as GameImage, Library, LibraryPlatform, User
from gametheca.utils.cover_art_studio import (
    bake_default_fallbacks,
    build_zip_bytes,
    generate_size_matrix,
    render_cover_art,
    safe_pack_dir,
    safe_pack_file,
    save_pack,
)


def test_render_cover_art_returns_valid_image():
    img = render_cover_art(400, 600, title='Test Game', system='SNES')
    assert img.size == (400, 600)
    buf = io.BytesIO()
    img.save(buf, format='PNG')
    assert len(buf.getvalue()) > 500


def test_generate_size_matrix_has_all_outlets():
    files = generate_size_matrix('Demo Title', system='NES')
    assert 'tile_200x300.webp' in files
    assert 'wide_1920x1080.webp' in files
    assert 'square_512.webp' in files
    assert 'hero_1280x720.webp' in files
    assert len(files) == 10


def test_safe_pack_dir_blocks_traversal(tmp_path):
    root = tmp_path / 'generated'
    root.mkdir()
    with patch('gametheca.utils.cover_art_studio.generated_root', return_value=root):
        assert safe_pack_dir('valid-pack_1') == root / 'valid-pack_1'
        with pytest.raises(ValueError):
            safe_pack_dir('../etc')
        with pytest.raises(ValueError):
            safe_pack_dir('bad/id')


def test_safe_pack_file_only_known_names(tmp_path):
    pack = tmp_path / 'pack1'
    pack.mkdir()
    (pack / 'tile_400x600.webp').write_bytes(b'x')
    with patch('gametheca.utils.cover_art_studio.generated_root', return_value=tmp_path):
        path = safe_pack_file('pack1', 'tile_400x600.webp')
        assert path.is_file()
        with pytest.raises(ValueError):
            safe_pack_file('pack1', '../../../etc/passwd')


def test_save_pack_and_zip(tmp_path):
    with patch('gametheca.utils.cover_art_studio.generated_root', return_value=tmp_path):
        manifest = save_pack('Zip Test', system='GBA', pack_id='testpack01')
        assert manifest['pack_id'] == 'testpack01'
        assert (tmp_path / 'testpack01' / 'manifest.json').is_file()
        payload = build_zip_bytes('testpack01')
    with zipfile.ZipFile(io.BytesIO(payload)) as zf:
        names = zf.namelist()
        assert any('tile_600x900.webp' in n for n in names)


def test_bake_default_fallbacks(tmp_path):
    ns = tmp_path / 'newstyle'
    with patch('gametheca.utils.cover_art_studio.newstyle_root', return_value=ns):
        paths = bake_default_fallbacks()
    assert Path(paths['default_cover']).is_file()
    assert Path(paths['default_library']).is_file()
    cover = Image.open(paths['default_cover'])
    assert cover.size == (600, 900)


@pytest.fixture
def admin_user(db_session):
    uid = str(uuid4())
    suffix = uid[:8]
    user = User(
        user_id=uid,
        name=f'ArtAdmin_{suffix}',
        email=f'artadmin_{suffix}@test.com',
        role='admin',
        is_email_verified=True,
    )
    user.set_password('testpass123')
    db_session.add(user)
    db_session.commit()
    return user


def test_art_studio_api_requires_admin(client, db_session, admin_user):
    with client.session_transaction() as sess:
        sess['_user_id'] = str(admin_user.id)
        sess['_fresh'] = True

    ok = client.post(
        '/admin/api/art-studio/preview',
        json={'title': 'Preview Me'},
    )
    assert ok.status_code == 200
    assert 'preview' in ok.get_json()

    bad = client.post('/admin/api/art-studio/preview', json={'title': ''})
    assert bad.status_code == 400


def test_art_studio_generate_surfaces_permission_error(client, db_session, admin_user):
    """A disk write failure (e.g. read-only IMAGE_SAVE_PATH) must return a JSON
    error instead of a bare 500 HTML page, so the admin UI can show it."""
    with client.session_transaction() as sess:
        sess['_user_id'] = str(admin_user.id)
        sess['_fresh'] = True

    with patch(
        'gametheca.routes_admin_ext.art_studio.save_pack',
        side_effect=PermissionError('Permission denied'),
    ):
        response = client.post(
            '/admin/api/art-studio/generate',
            json={'title': 'Broken Perms'},
        )
        assert response.status_code == 500
        data = response.get_json()
        assert 'error' in data
        assert 'Permission denied' in data['error']


def test_art_studio_apply_fallback_surfaces_disk_error(client, db_session, admin_user):
    """apply mode=fallback should surface OSError/PermissionError as JSON, not crash."""
    with client.session_transaction() as sess:
        sess['_user_id'] = str(admin_user.id)
        sess['_fresh'] = True

    with patch(
        'gametheca.routes_admin_ext.art_studio.apply_pack_as_fallback',
        side_effect=OSError('Disk full'),
    ):
        response = client.post(
            '/admin/api/art-studio/apply',
            json={'pack_id': 'some-pack', 'mode': 'fallback'},
        )
        assert response.status_code == 500
        data = response.get_json()
        assert 'error' in data
        assert 'Disk full' in data['error']


def test_art_studio_download_surfaces_disk_error(client, db_session, admin_user):
    """download should surface OSError as JSON rather than an unhandled 500."""
    with client.session_transaction() as sess:
        sess['_user_id'] = str(admin_user.id)
        sess['_fresh'] = True

    with patch('gametheca.routes_admin_ext.art_studio.safe_pack_dir', return_value=Path('/fake')):
        with patch(
            'gametheca.routes_admin_ext.art_studio.build_zip_bytes',
            side_effect=PermissionError('Permission denied'),
        ):
            response = client.get('/admin/api/art-studio/download/some-pack')
            assert response.status_code == 500
            data = response.get_json()
            assert 'error' in data
            assert 'Permission denied' in data['error']


def test_apply_pack_to_game_rolls_back_and_removes_file_on_db_failure(tmp_path, db_session):
    """If the DB commit fails after the cover file is written, the orphaned
    file must be cleaned up and the original exception re-raised."""
    from gametheca.utils.cover_art_studio import apply_pack_to_game, save_pack

    game_uuid = str(uuid4())
    library = Library(name=f'ArtLib_{uuid4().hex[:6]}', platform=LibraryPlatform.PCWIN)
    db_session.add(library)
    db_session.flush()
    game = Game(uuid=game_uuid, name='Rollback Target', library_uuid=library.uuid)
    db_session.add(game)
    db_session.commit()

    gen_root = tmp_path / 'generated'
    img_root = tmp_path / 'images'
    img_root.mkdir()

    with patch('gametheca.utils.cover_art_studio.generated_root', return_value=gen_root):
        manifest = save_pack('Rollback Test', pack_id='rollbackpack01')

        with patch('gametheca.utils.cover_art_studio.current_app') as mock_app:
            mock_app.config = {'IMAGE_SAVE_PATH': str(img_root)}
            with patch('gametheca.utils.cover_art_studio.db.session.commit', side_effect=RuntimeError('db down')):
                with pytest.raises(RuntimeError, match='db down'):
                    apply_pack_to_game(manifest['pack_id'], game_uuid)

    # The written cover file should have been cleaned up after the rollback.
    assert list(img_root.glob(f'{game_uuid}_cover_studio_*')) == []


def test_art_studio_generate_apply_game(client, db_session, admin_user, app, tmp_path):
    game_uuid = str(uuid4())
    library = Library(name=f'ArtLib_{uuid4().hex[:6]}', platform=LibraryPlatform.PCWIN)
    db_session.add(library)
    db_session.flush()
    game = Game(uuid=game_uuid, name='Art Target', library_uuid=library.uuid)
    db_session.add(game)
    db_session.commit()

    gen_root = tmp_path / 'generated'
    img_root = tmp_path / 'images'
    img_root.mkdir()
    app.config['IMAGE_SAVE_PATH'] = str(img_root)

    with client.session_transaction() as sess:
        sess['_user_id'] = str(admin_user.id)
        sess['_fresh'] = True

    with patch('gametheca.utils.cover_art_studio.generated_root', return_value=gen_root):
        gen = client.post(
            '/admin/api/art-studio/generate',
            json={'title': 'Apply Test', 'system': 'PS1'},
        )
        assert gen.status_code == 201
        pack_id = gen.get_json()['pack_id']

        apply_resp = client.post(
            '/admin/api/art-studio/apply',
            json={'pack_id': pack_id, 'mode': 'game', 'game_uuid': game_uuid},
        )
        assert apply_resp.status_code == 200
        data = apply_resp.get_json()
        assert data['game_uuid'] == game_uuid
        assert '/static/library/images/' in data['cover_url']

    row = db_session.execute(
        __import__('sqlalchemy').select(GameImage).filter_by(game_uuid=game_uuid, image_type='cover')
    ).scalars().first()
    assert row is not None
    assert row.is_downloaded is True
