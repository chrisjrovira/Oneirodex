"""INSP-22 / H2b: read-only mod catalogue sources (Thunderstore, Modrinth).

Every network call is a mocked ``safe_request``; the sources stay off under
pytest unless ``MOD_CATALOG_IN_TESTS=1`` is set, so no suite reaches a
registry by accident.
"""
from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import patch
from uuid import uuid4

import pytest

from oneirodex.models import Game, Library, User
from oneirodex.platform import LibraryPlatform
from oneirodex.utils.mod_catalog import catalog_search, modrinth, source_ids, thunderstore

COMMUNITIES = {
    'results': [
        {'identifier': 'riskofrain2', 'name': 'Risk of Rain 2'},
        {'identifier': 'valheim', 'name': 'Valheim'},
        {'identifier': 'lethal-company', 'name': 'Lethal Company'},
    ]
}
PACKAGES = {
    'packages': [
        {
            'name': 'BepInExPack',
            'namespace': 'bbepis',
            'description': 'The loader everything needs',
            'package_url': 'https://thunderstore.io/c/riskofrain2/p/bbepis/BepInExPack/',
            'categories': [{'name': 'Libraries'}, {'name': 'BepInEx'}],
            'download_count': 10000000,
            'last_updated': '2025-01-01T00:00:00Z',
            'latest': {'version_number': '5.4.2100'},
        },
        {'name': 'OldThing', 'namespace': 'x', 'is_deprecated': True},
        {
            'name': 'Better_UI',
            'namespace': 'someone',
            'description': 'UI tweaks',
            'categories': ['Mods'],
            'download_count': 'lots',
        },
        'junk',
    ]
}
MODRINTH = {
    'hits': [
        {
            'project_id': 'AANobbMI',
            'slug': 'sodium',
            'title': 'Sodium',
            'description': 'Rendering engine',
            'categories': ['fabric', 'optimization'],
            'downloads': 50000000,
            'latest_version': '1.21.1',
            'author': 'jellysquid3',
            'date_modified': '2025-02-02T00:00:00Z',
        },
        {'slug': 'multi', 'title': 'Multi-loader', 'categories': ['fabric', 'forge']},
        {'title': 'no slug'},
    ]
}


def _resp(payload, status=200):
    return SimpleNamespace(status_code=status, json=lambda: payload)


@pytest.fixture
def live(monkeypatch):
    monkeypatch.setenv('MOD_CATALOG_IN_TESTS', '1')
    monkeypatch.delenv('ENABLE_MOD_CATALOG', raising=False)
    thunderstore._COMMUNITIES = None
    yield
    thunderstore._COMMUNITIES = None


def test_sources_are_off_under_pytest_by_default(app, monkeypatch):
    monkeypatch.delenv('MOD_CATALOG_IN_TESTS', raising=False)
    with app.app_context(), patch.object(thunderstore, 'safe_request') as req:
        assert thunderstore.search('Valheim') is None
        assert catalog_search('thunderstore', 'Valheim')['status'] == 'unavailable'
        req.assert_not_called()


def test_thunderstore_finds_the_community_and_maps_packages(app, live):
    def fake(method, url, **kw):
        if url.endswith('/api/experimental/community/'):
            return _resp(COMMUNITIES)
        assert '/c/riskofrain2/packages/' in url
        assert kw['params']['ordering'] == 'top-rated'
        assert kw['headers']['User-Agent'].startswith('Oneirodex')
        return _resp(PACKAGES)

    with app.app_context(), patch.object(thunderstore, 'safe_request', side_effect=fake):
        hits = thunderstore.search('Risk of Rain 2')
    assert hits is not None and len(hits) == 2
    first = hits[0]
    assert first.name == 'BepInExPack' and first.loader == 'bepinex' and first.version == '5.4.2100'
    assert first.url.endswith('/p/bbepis/BepInExPack/') and first.downloads == 10000000
    assert first.source == 'thunderstore'
    second = hits[1]
    assert second.name == 'Better UI' and second.loader == '' and second.downloads is None
    assert second.url == 'https://thunderstore.io/c/riskofrain2/p/someone/Better_UI/'


def test_thunderstore_none_without_a_community_or_on_errors(app, live):
    with app.app_context(), patch.object(thunderstore, 'safe_request', return_value=_resp(COMMUNITIES)):
        assert thunderstore.find_community('Lethal Company')['identifier'] == 'lethal-company'
        assert thunderstore.find_community('Stardew Valley') is None
        assert thunderstore.search('Stardew Valley') is None
    with app.app_context(), patch.object(thunderstore, 'safe_request', return_value=_resp({}, 503)):
        assert thunderstore.search('Valheim') is None
    with app.app_context(), patch.object(thunderstore, 'safe_request', side_effect=OSError('offline')):
        assert thunderstore.search('Valheim') is None


def test_modrinth_only_answers_for_minecraft_and_reads_loaders(app, live):
    with app.app_context(), patch.object(modrinth, 'safe_request', return_value=_resp(MODRINTH)) as req:
        assert modrinth.search('Valheim') is None
        req.assert_not_called()
        hits = modrinth.search('Minecraft: Java Edition', query='sodium')
        params = req.call_args.kwargs['params']
        assert params['query'] == 'sodium' and params['index'] == 'relevance'
        assert 'project_type:mod' in params['facets']
    assert hits is not None and len(hits) == 2
    assert hits[0].name == 'Sodium' and hits[0].loader == 'fabric' and hits[0].url == 'https://modrinth.com/mod/sodium'
    assert hits[0].categories == ['optimization']
    # Two loaders is a choice, not a fact
    assert hits[1].loader == ''
    with app.app_context(), patch.object(modrinth, 'safe_request', return_value=_resp({'nope': 1})):
        assert modrinth.search('Minecraft') is None


def test_catalog_search_envelope_never_hides_silence(app, live):
    assert set(source_ids()) == {'thunderstore', 'modrinth'}
    assert catalog_search('nexus', 'X')['status'] == 'unknown_source'
    with app.app_context(), patch.object(modrinth, 'safe_request', return_value=_resp({'hits': []})):
        ok = catalog_search('modrinth', 'Minecraft')
    assert ok['status'] == 'ok' and ok['hits'] == [] and ok['count'] == 0
    with app.app_context(), patch.object(modrinth, 'safe_request', side_effect=OSError('offline')):
        gone = catalog_search('modrinth', 'Minecraft')
    assert gone['status'] == 'unavailable' and gone['hits'] is None and 'note' in gone


@pytest.fixture
def librarian(db_session):
    uid = str(uuid4())
    row = User(name=f'lib_{uid[:8]}', email=f'lib_{uid[:8]}@example.com', role='librarian', user_id=uid, state=True)
    row.set_password('password123')
    db_session.add(row)
    db_session.commit()
    return row


@pytest.fixture
def minecraft(db_session, tmp_path):
    lib = Library(name=f'PC_{uuid4().hex[:6]}', platform=LibraryPlatform.PCWIN)
    db_session.add(lib)
    db_session.flush()
    game = Game(uuid=str(uuid4()), name='Minecraft', library_uuid=lib.uuid, full_disk_path=str(tmp_path / 'mc'))
    db_session.add(game)
    db_session.commit()
    return game


def test_catalog_route_is_librarian_and_reports_status(client, app, live, librarian, minecraft, tmp_path):
    from flask_login import login_user

    app.config['GAME_MODS_PATH'] = str(tmp_path)
    url = f'/api/games/{minecraft.uuid}/mods/catalog'
    assert client.get(f'{url}?source=modrinth').status_code in (302, 401, 403)

    with client.session_transaction() as sess:
        sess['_user_id'] = str(librarian.get_id())
        sess['_fresh'] = True
    with app.test_request_context():
        login_user(librarian)

    assert client.get(f'{url}?source=steam').status_code == 400
    with patch.object(modrinth, 'safe_request', return_value=_resp(MODRINTH)):
        resp = client.get(f'{url}?source=modrinth&q=sodium&limit=5')
    assert resp.status_code == 200, resp.get_json()
    body = resp.get_json()
    assert body['ok'] is True and body['status'] == 'ok' and body['hits'][0]['name'] == 'Sodium'
    with patch.object(modrinth, 'safe_request', side_effect=OSError('offline')):
        resp = client.get(f'{url}?source=modrinth')
    assert resp.get_json()['status'] == 'unavailable' and resp.get_json()['hits'] is None
