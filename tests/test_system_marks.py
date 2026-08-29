"""System mark prompts and paths stay catalogue-safe and slug-safe."""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path
from unittest.mock import patch
from uuid import uuid4

import pytest

from gametheca.utils.system_marks import (
    build_system_mark_prompt,
    generate_system_marks,
    list_system_marks_catalog,
    mark_path,
    platform_ids,
    static_mark_url,
    theme_slugs,
)


def test_platform_ids_cover_library_platform_enum():
    ids = platform_ids()
    assert 'nes' in ids
    assert 'ps2' in ids
    assert len(ids) >= 70


def test_theme_slugs_include_default_and_presets():
    slugs = theme_slugs()
    assert slugs[0] == 'default'
    assert 'aurora' in slugs
    assert 'era-80s' in slugs


def test_prompt_is_catalogue_only():
    prompt = build_system_mark_prompt(platform='nes', theme='aurora')
    assert 'Nintendo Entertainment System' in prompt
    assert 'front-loading' in prompt or 'NES' in prompt
    assert 'recognizable' in prompt
    assert '#' in prompt  # accent hex from preset tokens
    for banned in ('/mnt/', 'C:\\', 'username', 'password', 'library/'):
        assert banned not in prompt


def test_mark_path_rejects_traversal(tmp_path: Path):
    with pytest.raises(ValueError):
        mark_path('../evil', 'nes', package_root=tmp_path)
    with pytest.raises(ValueError):
        mark_path('aurora', '../nes', package_root=tmp_path)


def test_static_url_shape():
    assert static_mark_url('aurora', 'nes') == '/static/library/system-marks/aurora/nes.webp'


def test_catalog_lists_themes(tmp_path: Path):
    rows = list_system_marks_catalog(package_root=tmp_path)
    assert any(row['theme'] == 'default' for row in rows)
    assert all('generated' in row and 'total' in row for row in rows)


def test_generate_skips_without_ai_when_file_exists(tmp_path: Path, monkeypatch):
    monkeypatch.setenv('ENABLE_AI_ARTWORK', 'false')
    target = mark_path('default', 'nes', package_root=tmp_path)
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_bytes(b'RIFF....WEBP')
    result = generate_system_marks(
        themes=['default'],
        platforms=['nes'],
        package_root=tmp_path,
        force=False,
    )
    assert result['skipped'] == 1
    assert result['generated'] == 0
    assert result['errors'] == []


def test_cli_help_exits_zero():
    script = Path(__file__).resolve().parents[1] / 'scripts' / 'generate_system_marks.py'
    completed = subprocess.run(
        [sys.executable, str(script), '--help'],
        check=False,
        capture_output=True,
        text=True,
    )
    assert completed.returncode == 0
    assert 'Generate AI system marks' in completed.stdout
    assert '--theme' in completed.stdout
    assert '--all' in completed.stdout


@pytest.fixture
def admin_user(db_session):
    from gametheca.models import User

    uid = str(uuid4())
    suffix = uid[:8]
    user = User(
        user_id=uid,
        name=f'MarksAdmin_{suffix}',
        email=f'marksadmin_{suffix}@test.com',
        role='admin',
        is_email_verified=True,
    )
    user.set_password('testpass123')
    db_session.add(user)
    db_session.commit()
    return user


def test_art_studio_system_marks_api_catalog_and_generate(client, db_session, admin_user, tmp_path):
    with client.session_transaction() as sess:
        sess['_user_id'] = str(admin_user.id)
        sess['_fresh'] = True

    with patch(
        'gametheca.utils.system_marks.list_system_marks_catalog',
        return_value=[{
            'theme': 'default',
            'era': 'wood_den_80s',
            'generated': 0,
            'total': 72,
            'platforms': [],
            'manifest_platforms': [],
            'complete': False,
        }],
    ):
        catalog = client.get('/admin/api/art-studio/system-marks')
    assert catalog.status_code == 200
    body = catalog.get_json()
    assert body.get('ok') is True
    assert body['count'] == 1
    assert body['items'][0]['theme'] == 'default'

    with patch(
        'gametheca.utils.system_marks.generate_system_marks',
        return_value={'generated': 1, 'skipped': 0, 'errors': [], 'results': []},
    ) as gen:
        response = client.post(
            '/admin/api/art-studio/system-marks/generate',
            json={'themes': ['default'], 'platforms': ['nes'], 'force': False},
        )
    assert response.status_code == 201
    payload = response.get_json()
    assert payload.get('ok') is True
    assert payload['generated'] == 1
    gen.assert_called_once()
    assert gen.call_args.kwargs['themes'] == ['default']
    assert gen.call_args.kwargs['platforms'] == ['nes']
