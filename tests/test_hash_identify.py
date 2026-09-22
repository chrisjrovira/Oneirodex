"""INSP-31 (v11 H1a): the keyless hash-identify source.

Off under pytest unless ``HASH_IDENTIFY_IN_TESTS=1``; every outbound call is
mocked at ``safe_request``. A miss, a 5xx, an unparseable body and a blocked
URL all come back as ``None`` -- the same shape as a local DAT miss.
"""
from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import patch
from uuid import uuid4

import pytest

from oneirodex.models import Library
from oneirodex.platform import LibraryPlatform
from oneirodex.utils import hash_identify
from oneirodex.utils.set_completion import try_dat_hash_identify
from oneirodex.utils.software_identify import CUSTOM_IGDB_BASE

HASHES = {
    'crc': 'aabbcc01',
    'md5': '11111111111111111111111111111111',
    'sha1': 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
}


def _response(status, body=None):
    def _json():
        if isinstance(body, Exception):
            raise body
        return body

    return SimpleNamespace(status_code=status, json=_json)


@pytest.fixture
def service_on(monkeypatch):
    monkeypatch.setenv('HASH_IDENTIFY_IN_TESTS', '1')
    monkeypatch.delenv('ENABLE_HASH_IDENTIFY', raising=False)
    monkeypatch.delenv('HASH_IDENTIFY_BASE_URL', raising=False)


def test_off_under_pytest_by_default(app):
    with app.app_context():
        assert hash_identify.is_enabled() is False
        assert hash_identify.lookup_by_hashes(HASHES) is None


def test_env_kill_switch_wins(app, monkeypatch, service_on):
    monkeypatch.setenv('ENABLE_HASH_IDENTIFY', 'false')
    with app.app_context():
        assert hash_identify.is_enabled() is False


def test_lookup_prefers_md5_then_falls_through_on_404(app, service_on):
    calls = []

    def fake(method, url, **kwargs):
        calls.append(url)
        if '/md5/' in url:
            return _response(404)
        return _response(200, {
            'signature': {'game': {'name': 'Tetris (World)', 'system': 'Game Boy'}},
            'metadata': [{'source': 'IGDB', 'id': '1234'}],
        })

    with app.app_context(), patch('oneirodex.utils.hash_identify.safe_request', side_effect=fake):
        found = hash_identify.lookup_by_hashes(HASHES, library_platform='GB')

    assert [u.split('/ByHash/')[1].split('/')[0] for u in calls] == ['md5', 'sha1']
    assert found == {
        'name': 'Tetris (World)',
        'platform': 'Game Boy',
        'igdb_id': 1234,
        'source_url': None,
        'match_method': 'sha1',
        'source': 'hash_identify',
        'service': 'hasheous.org',
        'library_platform': 'GB',
    }


@pytest.mark.parametrize(
    'response',
    [
        _response(500),
        _response(200, {'unexpected': 'shape'}),
        _response(200, ValueError('not json')),
        _response(200, {'name': '   '}),
    ],
    ids=['5xx', 'no-name', 'bad-json', 'blank-name'],
)
def test_every_failure_is_a_miss(app, service_on, response):
    with app.app_context(), patch('oneirodex.utils.hash_identify.safe_request', return_value=response):
        assert hash_identify.lookup_by_hashes(HASHES) is None


def test_blocked_or_unreachable_url_is_a_miss(app, service_on):
    with app.app_context(), patch(
        'oneirodex.utils.hash_identify.safe_request', side_effect=RuntimeError('blocked outbound host')
    ):
        assert hash_identify.lookup_by_hashes(HASHES) is None


def test_no_hashes_makes_no_request(app, service_on):
    with app.app_context(), patch('oneirodex.utils.hash_identify.safe_request') as req:
        assert hash_identify.lookup_by_hashes({}) is None
        assert hash_identify.lookup_by_hashes({'md5': ''}) is None
    req.assert_not_called()


def test_custom_base_url_is_honoured(app, service_on, monkeypatch):
    monkeypatch.setenv('HASH_IDENTIFY_BASE_URL', 'https://hashes.example.test/')
    seen = {}

    def fake(method, url, **kwargs):
        seen['url'] = url
        return _response(200, {'name': 'Some Game'})

    with app.app_context(), patch('oneirodex.utils.hash_identify.safe_request', side_effect=fake):
        found = hash_identify.lookup_by_hashes({'md5': HASHES['md5']})
    assert seen['url'].startswith('https://hashes.example.test/api/v1/Lookup/ByHash/md5/')
    assert found['service'] == 'hashes.example.test'


@pytest.fixture
def gb_library(db_session):
    library = Library(name=f'GBLib_{uuid4().hex[:6]}', platform=LibraryPlatform.GB)
    db_session.add(library)
    db_session.commit()
    return library


def test_dat_identify_falls_through_to_the_service(db_session, app, gb_library, tmp_path, service_on):
    """No local reference set -> the service names the game -> a custom-range Game,
    with a summary that says where the identity came from."""
    rom = tmp_path / f'Mystery {uuid4().hex[:6]}.gb'
    rom.write_bytes(b'rom-bytes')

    body = {'signature': {'game': {'name': 'Kirby Dream Land', 'system': 'Game Boy'}}, 'metadata': [{'source': 'IGDB', 'id': 2222}]}
    with app.app_context(), patch(
        'oneirodex.utils.hash_identify.safe_request', return_value=_response(200, body)
    ), patch('oneirodex.utils.rom_hash.hash_archive_inner_primary_dumps', return_value=[]):
        game = try_dat_hash_identify(
            full_disk_path=str(rom),
            library_uuid=gb_library.uuid,
            library_platform='GB',
            size=0,
            hashes=HASHES,
        )

    assert game is not None
    assert game.name == 'Kirby Dream Land'
    assert game.igdb_id >= CUSTOM_IGDB_BASE
    assert 'community hash service' in (game.summary or '')
    assert 'hasheous.org' in (game.summary or '')
    assert 'IGDB #2222' in (game.summary or '')
    assert game.file_md5 == HASHES['md5']


def test_dat_identify_stays_none_when_the_service_misses(db_session, app, gb_library, tmp_path, service_on):
    rom = tmp_path / f'Nothing {uuid4().hex[:6]}.gb'
    rom.write_bytes(b'rom-bytes')
    with app.app_context(), patch(
        'oneirodex.utils.hash_identify.safe_request', return_value=_response(404)
    ), patch('oneirodex.utils.rom_hash.hash_archive_inner_primary_dumps', return_value=[]):
        assert try_dat_hash_identify(
            full_disk_path=str(rom),
            library_uuid=gb_library.uuid,
            library_platform='GB',
            size=0,
            hashes=HASHES,
        ) is None
